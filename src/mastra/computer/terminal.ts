import { randomUUID, createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { DockerComputer } from './docker-backend.js';
import { runDocker, workspacePath, type DockerRunner, type DockerResult, type TerminalConfig } from './docker.js';

export interface CommandReceipt extends DockerResult {
  id: string;
  command: string;
  cwd: string;
  createdAt: string;
  status: 'running' | 'succeeded' | 'failed' | 'timed_out' | 'interrupted';
  cleanupRequired?: boolean;
}
export interface TerminalStatus { state: 'missing' | 'stopped' | 'running' | 'unavailable'; error?: string }

// A single queue also covers separate service instances sharing this deployment.
const queues = new Map<string, Promise<unknown>>();
export class TerminalComputer {
  private readonly backend: DockerComputer;
  private readonly directory: string;
  private readonly filename: string;
  constructor(private readonly config: TerminalConfig, docker: DockerRunner = runDocker) {
    this.backend = new DockerComputer(config, docker);
    const deployment = createHash('sha256').update(config.computerDeploymentId ?? config.publicUrl).digest('hex').slice(0, 16);
    this.directory = join(config.dataDir, 'computer-receipts', deployment);
    this.filename = join(this.directory, 'commands.json');
  }
  private enabled() { if (!this.config.enabled) throw new Error('Computer is disabled'); }
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    this.enabled();
    const result = (queues.get(this.filename) ?? Promise.resolve()).catch(() => {}).then(work);
    queues.set(this.filename, result);
    return result;
  }
  private async load(): Promise<CommandReceipt[]> {
    try { return JSON.parse(await readFile(this.filename, 'utf8')) as CommandReceipt[]; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
  private async save(receipts: CommandReceipt[]) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temporary = join(this.directory, `${randomUUID()}.tmp`);
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(receipts)); await file.sync(); } finally { await file.close(); }
    await rename(temporary, this.filename);
    const directory = await open(this.directory, 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  }
  // Intent is durable before dispatch. A crash cannot cause an automatic replay.
  private async recover() {
    const receipts = await this.load();
    const marker = join(this.directory, 'cleanup-required');
    const fileCleanup = await readFile(marker, 'utf8').then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
    if (fileCleanup || receipts.some(r => r.status === 'running' || r.cleanupRequired)) {
      await this.backend.stop('baymax');
      for (const r of receipts) if (r.status === 'running' || r.cleanupRequired) {
        r.status = 'interrupted'; r.interrupted = true; r.exitCode = null; r.cleanupRequired = false;
        r.stderr += '\nExecution outcome is unknown after an interrupted service. Inspect files before repeating it.';
      }
      await this.save(receipts);
      await unlink(marker).catch(error => { if (error.code !== "ENOENT") throw error; });
    }
    return receipts;
  }
  private async state(): Promise<TerminalStatus> {
    try { return { state: await this.backend.state('baymax') }; }
    catch (error) { return { state: 'unavailable', error: error instanceof Error ? error.message : 'Docker inspection failed' }; }
  }
  status() { return this.exclusive(() => this.state()); }
  start() { return this.exclusive(async () => { await this.recover(); await this.backend.start('baymax'); return this.state(); }); }
  stop() { return this.exclusive(async () => { await this.backend.stop('baymax'); await this.recover(); return this.state(); }); }
  receipts() { return this.exclusive(async () => (await this.recover()).sort((a,b) => b.createdAt.localeCompare(a.createdAt))); }
  execute(input: { command: string; cwd?: string; operationId: string }, signal?: AbortSignal): Promise<CommandReceipt> {
    this.enabled();
    if (typeof input.command !== 'string' || !input.command.trim() || input.command.length > 16000) throw new Error('Command must contain 1–16000 characters');
    if (typeof input.operationId !== 'string' || !input.operationId || input.operationId.length > 256) throw new Error('An operation ID of 1–256 characters is required');
    const cwd = workspacePath(input.cwd ?? '/workspace');
    const id = createHash('sha256').update(input.operationId).digest('hex');
    return this.exclusive(async () => {
      const receipts = await this.recover();
      const previous = receipts.find(r => r.id === id);
      if (previous) {
        if (previous.command !== input.command || previous.cwd !== cwd) throw new Error('Operation ID already belongs to a different command');
        return previous;
      }
      const session = await this.backend.running('baymax');
      if (signal?.aborted) throw new Error('Command interrupted before execution');
      const receipt: CommandReceipt = { id, command: input.command, cwd, createdAt: new Date().toISOString(), status: 'running', stdout: '', stderr: '', exitCode: null, timedOut: false, interrupted: false, truncated: false };
      receipts.push(receipt);
      await this.save(receipts);
      let result: DockerResult;
      try { result = await session.exec(input.command, cwd, signal); }
      catch { result = { stdout: '', stderr: 'Execution outcome is unknown; inspect files before repeating.', exitCode: null, timedOut: false, interrupted: true, truncated: false }; }
      Object.assign(receipt, result);
      receipt.timedOut ||= result.exitCode === 124;
      receipt.interrupted ||= result.exitCode === 137;
      receipt.status = receipt.interrupted ? 'interrupted' : receipt.timedOut ? 'timed_out' : receipt.exitCode === 0 ? 'succeeded' : 'failed';
      if (receipt.timedOut || receipt.interrupted || receipt.exitCode === null) {
        receipt.cleanupRequired = true;
        await this.save(receipts);
        try { await session.stop(); receipt.cleanupRequired = false; }
        catch { receipt.stderr += '\nCould not confirm sandbox stop. Further operations are blocked until Stop succeeds.'; }
      }
      await this.save(receipts);
      return receipt;
    });
  }
  private async quarantineFile(stop: () => Promise<void>) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const marker = join(this.directory, 'cleanup-required');
    const file = await open(marker, 'w', 0o600);
    try { await file.writeFile('unknown file operation'); await file.sync(); } finally { await file.close(); }
    await stop();
    await unlink(marker);
  }
  file(operation: 'list' | 'read' | 'write' | 'mkdir', path: string, text?: string): Promise<any> {
    this.enabled();
    const normalized = workspacePath(path);
    if (!['list', 'read', 'write', 'mkdir'].includes(operation)) throw new Error('Unsupported file operation');
    if (operation === 'write' && (typeof text !== 'string' || Buffer.byteLength(text) > 256 * 1024)) throw new Error('Text files must be 256 KB or smaller');
    return this.exclusive(async () => {
      await this.recover();
      const session = await this.backend.running('baymax');
      let result: DockerResult;
      try { result = await session.file(JSON.stringify({ operation, path: normalized, text }), 8, 2 * 1024 * 1024); }
      catch { await this.quarantineFile(session.stop); throw new Error('File operation outcome unknown; sandbox stopped'); }
      if (result.timedOut || result.interrupted || result.exitCode === 124 || result.exitCode === 137 || result.exitCode === null) await this.quarantineFile(session.stop);
      if (result.exitCode !== 0 || result.timedOut || result.interrupted || result.truncated) throw new Error('Computer file operation failed. Check path, size and permissions; symlinks cannot be opened.');
      return JSON.parse(result.stdout);
    });
  }
}

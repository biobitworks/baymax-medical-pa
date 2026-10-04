import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TerminalComputer } from '../src/mastra/computer/terminal.js';
import { computerIdentity, runDocker } from '../src/mastra/computer/docker.js';

const config = { enabled: true, dataDir: await mkdtemp(join(tmpdir(), 'baymax-computer-smoke-')), publicUrl:'http://localhost:4111', computerDeploymentId:`smoke-${randomUUID()}`, computerImage:process.env.COMPUTER_IMAGE ?? 'baymax-computer:local' };
const service = new TerminalComputer(config);
const identity = computerIdentity(config);
try {
  assert.equal((await service.start()).state, 'running');
  const command = await service.execute({command:'printf sandbox; id -u; test ! -w /etc; test -z "${DATABASE_URL:-}"',operationId:'sandbox'});
  assert.equal(command.exitCode,0);assert.match(command.stdout,/sandbox1000/);
  await service.file('mkdir','/workspace/smoke');
  await service.file('write','/workspace/smoke/message.txt','hello persistent workspace');
  assert.equal((await service.file('read','/workspace/smoke/message.txt')).text,'hello persistent workspace');
  await service.execute({command:'ln -s /etc /workspace/smoke/link',operationId:'symlink'});
  await assert.rejects(service.file('read','/workspace/smoke/link/passwd'));
  await service.stop();await service.start();
  assert.equal((await service.file('read','/workspace/smoke/message.txt')).text,'hello persistent workspace');
  const failed=await service.execute({command:'exit 7',operationId:'failed'});assert.equal(failed.exitCode,7);assert.equal(failed.status,'failed');
  const abort=new AbortController();setTimeout(()=>abort.abort(),500);
  const interrupted=await service.execute({command:'sleep 60; touch /workspace/late',operationId:'interrupted'},abort.signal);
  assert.equal(interrupted.interrupted,true);assert.equal((await service.status()).state,'stopped');
  const replay=await new TerminalComputer(config).execute({command:'sleep 60; touch /workspace/late',operationId:'interrupted'});assert.equal(replay.id,interrupted.id);
  await service.start();
  const capped = await service.execute({command: "python3 -c 'print(\"x\" * 200000)'", operationId: 'capped'});
  assert.equal(capped.truncated, true); assert.ok(Buffer.byteLength(capped.stdout) <= 128 * 1024);
  const timeout = await service.execute({command: 'sleep 60; touch /workspace/too-late', operationId: 'timeout'});
  assert.equal(timeout.timedOut, true); assert.equal(timeout.status, 'timed_out');
  assert.equal((await service.status()).state, 'stopped');
  console.log('Computer smoke passed: isolation, files, persistence, symlinks, failed exits, interruption, output cap, 30-second timeout and idempotency.');
} finally {
  await service.stop().catch(()=>{});
  await runDocker(['container','rm','--force',identity.container],{timeoutMs:10000});
  await runDocker(['volume','rm',identity.volume],{timeoutMs:10000});
  await rm(config.dataDir,{recursive:true,force:true});
}

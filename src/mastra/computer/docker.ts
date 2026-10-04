import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { posix } from "node:path";
export interface TerminalConfig { enabled: boolean; dataDir: string; computerImage?: string; computerDeploymentId?: string; publicUrl: string }
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const computerOutputLimit = 128 * 1024;

export type ComputerState = "missing" | "stopped" | "running";
export interface DockerResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  interrupted: boolean;
  truncated: boolean;
}
export type DockerRunner = (
  args: string[],
  options: { timeoutMs: number; input?: string; signal?: AbortSignal; maxOutputBytes?: number },
) => Promise<DockerResult>;

/** stdout and stderr consume one shared byte budget. */
export function computerOutput(maxOutputBytes = computerOutputLimit) {
  const limit = Math.min(maxOutputBytes, 15 * 1024 * 1024);
  const result: DockerResult = {
    stdout: "",
    stderr: "",
    exitCode: null,
    timedOut: false,
    interrupted: false,
    truncated: false,
  };
  const stdout: Buffer[] = [],
    stderr: Buffer[] = [];
  let count = 0;
  const capture = (chunks: Buffer[]) => (data: string | Buffer) => {
    const chunk = Buffer.from(data);
    const remaining = Math.max(0, limit - count);
    if (chunk.length > remaining) result.truncated = true;
    if (remaining) chunks.push(chunk.subarray(0, remaining));
    count += Math.min(remaining, chunk.length);
  };
  return {
    result,
    limit,
    stdout: capture(stdout),
    stderr: capture(stderr),
    finish() {
      result.stdout = Buffer.concat(stdout).toString("utf8");
      result.stderr = Buffer.concat(stderr).toString("utf8");
      return result;
    },
  };
}

// The only host process this provider can launch is Docker. User input is an argv
// element or stdin, never a host shell program. Do not add a shell fallback here.
export const runDocker: DockerRunner = (args, options) =>
  new Promise((resolve) => {
    const output = computerOutput(options.maxOutputBytes);
    const { result } = output;
    let settled = false;
    const env: Record<string, string> = {};
    for (const key of [
      "PATH",
      "HOME",
      "DOCKER_HOST",
      "DOCKER_CONTEXT",
      "DOCKER_CONFIG",
      "DOCKER_TLS_VERIFY",
      "DOCKER_CERT_PATH",
    ])
      if (process.env[key]) env[key] = process.env[key];
    const child = spawn("docker", args, { shell: false, stdio: ["pipe", "pipe", "pipe"], env });
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      resolve(output.finish());
    };
    const abort = () => {
      result.interrupted = true;
      child.kill("SIGKILL");
    };
    const timer = setTimeout(() => {
      result.timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs);
    child.stdout.on("data", output.stdout);
    child.stderr.on("data", output.stderr);
    child.on("error", () => {
      output.stderr("Docker CLI could not be started. Install Docker and start its engine.");
      finish();
    });
    child.on("close", (code) => {
      result.exitCode = code;
      finish();
    });
    child.stdin.on("error", () => {
      /* A failed Docker process may close stdin before consuming it. Its exit is retained. */
    });
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    else child.stdin.end(options.input ?? "");
  });

export function computerIdentity(config: TerminalConfig, owner = "baymax") {
  const deployment = hash(config.computerDeploymentId ?? config.publicUrl).slice(0, 16);
  const ownerHash = hash(owner).slice(0, 24);
  const name = `baymax-${deployment}-${ownerHash}`;
  return {
    container: `${name}-computer`,
    volume: `${name}-workspace`,
    labels: {
      "dev.baymax.managed": "computer-v1",
      "dev.baymax.deployment": deployment,
      "dev.baymax.owner": ownerHash,
    } as Record<string, string>,
  };
}
export function workspacePath(path: string): string {
  if (
    path.includes("\0") ||
    path.length > 2048 ||
    !path.startsWith("/workspace") ||
    path.split("/").includes("..")
  )
    throw new Error("Choose an absolute path inside /workspace");
  const normalized = posix.normalize(path);
  if (normalized !== "/workspace" && !normalized.startsWith("/workspace/"))
    throw new Error("Choose an absolute path inside /workspace");
  return normalized;
}

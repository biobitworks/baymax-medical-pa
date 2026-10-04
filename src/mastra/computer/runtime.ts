import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { ComputerAccess } from './access';
import { BrowserComputer } from './browser';
import { TerminalComputer } from './terminal';
import { ComputerService } from './service';
import { createComputerHandler } from './handler';

let runtime: { access: ComputerAccess; service: ComputerService; handle: (request:Request)=>Promise<Response> } | undefined;
export function getComputerRuntime() {
  if (runtime) return runtime;
  const enabled = process.env.BAYMAX_COMPUTER_ENABLED === 'true';
  const deployment = process.env.BAYMAX_COMPUTER_ID || 'baymax-local';
  const hex = createHash('sha256').update('browser:'+deployment).digest('hex');
  const sessionId = `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
  const access = new ComputerAccess(enabled ? process.env.BAYMAX_COMPUTER_ACCESS_KEY ?? '' : '');
  const terminal = new TerminalComputer({enabled, dataDir:resolve(process.env.BAYMAX_COMPUTER_DATA_DIR || '.baymax-computer'), computerImage:process.env.BAYMAX_COMPUTER_IMAGE || 'baymax-computer:local', computerDeploymentId:deployment, publicUrl:process.env.APP_ORIGIN || 'http://localhost:5173'});
  const browser = new BrowserComputer({workerUrl:enabled ? process.env.BAYMAX_BROWSER_WORKER_URL : undefined, workerToken:process.env.BAYMAX_BROWSER_WORKER_TOKEN, sessionId});
  const service = new ComputerService(terminal, browser, enabled);
  runtime = {access, service, handle:createComputerHandler(service,access)};
  return runtime;
}

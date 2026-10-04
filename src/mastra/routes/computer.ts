import { registerApiRoute } from '@mastra/core/server';
import { getComputerRuntime } from '../computer/runtime';
export const computerRoutes = [
  ['/computer/session','POST'], ['/computer/session','DELETE'],
  ['/computer/control','POST'], ['/computer/status','GET'], ['/computer/actions','POST'], ['/computer/screenshot','GET'],
].map(([path,method]) => registerApiRoute(path, {
  method:method as 'GET'|'POST'|'DELETE',
  handler:c => getComputerRuntime().handle(c.req.raw),
}));

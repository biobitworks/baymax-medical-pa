import { ComputerControlError } from './control';
import { computerActionSchema } from './schema';
import { ComputerAccess, checkComputerOrigin } from './access';
import type { ComputerService } from './service';

async function boundedJson(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('A JSON request body is required.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('A request body is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) { await reader.cancel(); throw new Error('Request exceeds 2 MiB.'); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { reader.releaseLock(); }
}
export function createComputerHandler(service: Pick<ComputerService, 'status' | 'action' | 'browser' | 'enabled' | 'control'>, access: ComputerAccess, options: {origin?:string; production?:boolean} = {}) {
  return async (request: Request): Promise<Response> => {
    const json = (value: unknown, status = 200) => Response.json(value, { status, headers: {'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'} });
    const path = new URL(request.url).pathname;
    const bearer = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
    if (request.method !== 'GET' && !checkComputerOrigin(request, options.origin, options.production)) return json({error:'Request origin is not allowed.'}, 403);
    if (path === '/computer/session' && request.method === 'POST') {
      if (!service.enabled) return json({error:'Baymax’s computer is disabled. Set BAYMAX_COMPUTER_ENABLED=true on the server.'}, 503);
      try { return json(access.unlock(bearer)); }
      catch (error) { return json({error: error instanceof Error ? error.message : 'Could not unlock the computer.'}, access.configured ? 401 : 503); }
    }
    if (!access.allows(bearer)) return json({error:'Unlock Baymax’s computer to continue. Your access may have expired.'}, 401);
    try {
      if (path === '/computer/session' && request.method === 'DELETE') { access.revoke(bearer); await service.control.release(bearer); return json({locked:true}); }
      if (path === '/computer/status' && request.method === 'GET') return json(await service.status(bearer));
      if (path === '/computer/screenshot' && request.method === 'GET') {
        const bytes = await service.browser.screenshot();
        return new Response(new Uint8Array(bytes), {headers:{'Content-Type':'image/png', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'}});
      }
      if (path === '/computer/control' && request.method === 'POST') {
        let body: unknown;
        try { body=await boundedJson(request); } catch { return json({error:'Send a valid control request.'},400); }
        if (!access.allows(bearer)) return json({error:'Computer access expired or was revoked.'},401);
        if (!body || typeof body !== 'object' || !('owner' in body) || !['user','baymax'].includes(String(body.owner)) || Object.keys(body).some(key=>!['owner','renew'].includes(key)) || ('renew' in body && (body.renew !== true || body.owner !== 'user'))) return json({error:'Control owner must be user or baymax.'},400);
        if ('renew' in body) return json(service.control.renew(bearer));
        return json(await service.control.change(body.owner as 'user'|'baymax',bearer));
      }
      if (path === '/computer/actions' && request.method === 'POST') {
        let body: unknown;
        try { body = await boundedJson(request); } catch { return json({error:'Send a valid JSON body no larger than 2 MiB.'}, 400); }
        if (!access.allows(bearer)) return json({error:'Computer access expired or was revoked.'},401);
        const parsed = computerActionSchema.safeParse(body);
        if (!parsed.success) return json({error:'Invalid computer action. Check the command, path, or browser input.'}, 400);
        return json(await service.action(parsed.data, request.signal, 'user', bearer));
      }
      return json({error:'Computer endpoint not found.'}, 404);
    } catch (error) {
      // Providers return fixed operational messages, never raw subprocess/worker output.
      return json({error:error instanceof Error ? error.message : 'Computer operation failed.'}, error instanceof ComputerControlError ? 409 : 503);
    }
  };
}

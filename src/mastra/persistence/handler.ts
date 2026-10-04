import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { workspaceSchema } from '../../shared/workspace';
import type { CareStore } from './store';
const cookieName = 'baymax_session';
const maxBytes = 512_000;
const saveSchema = z.object({ state: workspaceSchema.refine(state => state.remember, 'Memory consent required'), revision: z.number().int().min(0) });

export function createStateHandler(store: CareStore, options: { origin?: string } = {}) {
  return async (request: Request): Promise<Response> => {
    const headers = new Headers({ 'cache-control': 'no-store', 'content-type': 'application/json', 'x-content-type-options': 'nosniff' });
    const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
    const configuredOrigin = options.origin || process.env.APP_ORIGIN;
    const requestUrl = new URL(request.url);
    const suppliedOrigin = request.headers.get('origin');
    const isLoopback = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host);
    let origin = configuredOrigin || requestUrl.origin;
    // Vite proxies to a different local port. This exception is limited to
    // local development; production uses the configured public APP_ORIGIN.
    if (!configuredOrigin && process.env.NODE_ENV !== 'production' && isLoopback(requestUrl.hostname) && suppliedOrigin) {
      try {
        const supplied = new URL(suppliedOrigin);
        if (supplied.protocol === 'http:' && isLoopback(supplied.hostname)) origin = supplied.origin;
      } catch { return reply({ error: 'Invalid request origin.' }, 403); }
    }
    if (suppliedOrigin && suppliedOrigin !== origin) return reply({ error: 'Request origin is not allowed.' }, 403);
    if (request.method !== 'GET' && suppliedOrigin !== origin) return reply({ error: 'Request origin is required.' }, 403);
    let token = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      if (request.method !== 'GET') return reply({ error: 'Open your care space before saving.' }, 401);
      token = randomBytes(32).toString('hex');
      const secure = new URL(origin).protocol === 'https:' ? '; Secure' : '';
      headers.set('set-cookie', `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secure}`);
    }
    const sessionHash = createHash('sha256').update(token).digest('hex');
    try {
      if (request.method === 'GET') return reply(await store.load(sessionHash));
      if (request.method === 'DELETE') { await store.remove(sessionHash); return reply({ deleted: true }); }
      if (request.method !== 'PUT') return reply({ error: 'Method not allowed.' }, 405);
      if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'Use a JSON request.' }, 415);
      if (Number(request.headers.get('content-length')) > maxBytes) return reply({ error: 'Your care space is too large to save.' }, 413);
      const reader = request.body?.getReader();
      if (!reader) return reply({ error: 'Missing care data.' }, 400);
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { await reader.cancel(); return reply({ error: 'Your care space is too large to save.' }, 413); }
        chunks.push(value);
      }
      let body: unknown;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply({ error: 'Invalid JSON.' }, 400); }
      const parsed = saveSchema.safeParse(body);
      if (!parsed.success) return reply({ error: 'Care data is invalid or memory consent is missing.' }, 400);
      const revision = await store.save(sessionHash, parsed.data.state, parsed.data.revision);
      if (revision === null) return reply({ error: 'Your care space changed in another tab. Reload before saving again.' }, 409);
      return reply({ revision });
    } catch {
      // Do not include connection strings, driver errors, or health content.
      return reply({ error: 'Your saved care space is unavailable. Please try again.' }, 503);
    }
  };
}

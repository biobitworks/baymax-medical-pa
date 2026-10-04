import { createHash, randomBytes } from 'node:crypto';
import { appleHealthImportSchema } from '../../shared/apple-health';
import { normalizeAppleHealth } from '../lib/apple-health';
import { allowsBrowserWrite, sessionHashOf } from './session';
import type { AppleHealthStore } from './apple-health-store';

const maxBytes = 2_000_000;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function createAppleHealthHandler(store: AppleHealthStore, options: { origin?: string; now?: () => Date } = {}) {
  return async (request: Request): Promise<Response> => {
    const headers = { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
    const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
    const isImport = new URL(request.url).pathname.endsWith('/import');
    try {
      if (!isImport) {
        const sessionHash = sessionHashOf(request);
        if (!sessionHash) return reply({ error: 'Open your care space before connecting Health.' }, 401);
        if (request.method === 'GET') return reply(await store.status(sessionHash));
        if (!allowsBrowserWrite(request, options.origin)) return reply({ error: 'Request origin is not allowed.' }, 403);
        if (request.method === 'DELETE') { await store.disconnect(sessionHash); return reply({ disconnected: true }); }
        if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
        const token = randomBytes(32).toString('hex');
        if (!await store.pair(sessionHash, hash(token))) return reply({ error: 'Enable Remember across visits and wait for your care space to save.' }, 409);
        return reply({ token }); // Only returned on creation/rotation; only the hash is stored.
      }
      if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
      const token = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
      if (!token || !await store.acceptsToken(hash(token))) return reply({ error: 'Health connection key is invalid or disconnected.' }, 401);
      if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'Send a JSON request.' }, 415);
      if (Number(request.headers.get('content-length')) > maxBytes) return reply({ error: 'Health export is too large.' }, 413);
      const reader = request.body?.getReader();
      if (!reader) return reply({ error: 'Missing health readings.' }, 400);
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { await reader.cancel(); return reply({ error: 'Health export is too large.' }, 413); }
        chunks.push(value);
      }
      let data: unknown;
      try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply({ error: 'Invalid JSON.' }, 400); }
      const parsed = appleHealthImportSchema.safeParse(data);
      if (!parsed.success) return reply({ error: 'Health export has invalid fields, dates, or time zone.' }, 400);
      let normalized: ReturnType<typeof normalizeAppleHealth>;
      try { normalized = normalizeAppleHealth(parsed.data, options.now?.() ?? new Date()); }
      catch (error) { return reply({ error: error instanceof Error ? error.message : 'Invalid health readings.' }, 400); }
      if (!await store.import(hash(token), normalized.daily, parsed.data.exportedAt, parsed.data.timeZone)) return reply({ error: 'Connection was removed or this export is older than the saved readings.' }, 409);
      return reply({ importedDays: normalized.daily.length, ignoredSleepSamples: normalized.ignoredSleepSamples });
    } catch { return reply({ error: 'Health sync is unavailable. Please try again.' }, 503); }
  };
}

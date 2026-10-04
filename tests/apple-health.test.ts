import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { AppleHealthStore } from '../src/mastra/persistence/apple-health-store';
import { createAppleHealthHandler } from '../src/mastra/persistence/apple-health-handler';
import { CareStore } from '../src/mastra/persistence/store';
import { createWorkspace } from '../src/shared/workspace';
import { appleHealthImportSchema, type AppleHealthImport } from '../src/shared/apple-health';
import { normalizeAppleHealth, summarizeAppleHealth } from '../src/mastra/lib/apple-health';
import { bindHealthSession, HEALTH_SESSION_KEY, sessionHashOf } from '../src/mastra/persistence/session';

const db = new PGlite();
const query = async (sql: string, params: unknown[]) => (await db.query<Record<string, unknown>>(sql, params)).rows;
const store = new AppleHealthStore(query), care = new CareStore(query);
const origin = 'https://baymax.example.com';
const handle = createAppleHealthHandler(store, { origin });
const cookieFor = (n: number) => `baymax_session=${String(n).padStart(64, '0')}`;
const ownerOf = (n: number) => createHash('sha256').update(String(n).padStart(64, '0')).digest('hex');
const request = (method: string, path: string, cookie = '', body?: unknown, token?: string) => new Request(`${origin}/health/apple/${path}`, {
  method, headers: { cookie, origin, 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const time = new Date();
time.setUTCHours(12, 0, 0, 0);
time.setUTCDate(time.getUTCDate() - 1);
const at = (hour: number) => new Date(time.getTime() + hour * 3_600_000).toISOString();
function payload(): AppleHealthImport {
  return { version: 1, timeZone: 'UTC', exportedAt: new Date().toISOString(), samples: [
    { type: 'steps', value: 1200, unit: 'count', source: 'Watch', startDate: at(-3), endDate: at(-2) },
    { type: 'activeMinutes', value: 900, unit: 's', source: 'Watch', startDate: at(-3), endDate: at(-2) },
    { type: 'hydrationMl', value: 0.5, unit: 'L', source: 'Water log', startDate: at(-2), endDate: at(-2) },
    { type: 'sleep', value: 'Asleep (Core)', unit: '', source: 'Watch', startDate: at(-12), endDate: at(-8) },
  ] };
}
before(async () => {
  for (const name of ['001_care_workspaces.sql', '002_monotonic_revisions.sql', '005_apple_health.sql']) await db.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
});
after(async () => { await db.close(); });
async function pair(n: number) {
  await care.save(ownerOf(n), { ...createWorkspace(), remember: true, ready: true }, 0);
  const response = await handle(request('POST', 'connection', cookieFor(n)));
  assert.equal(response.status, 200);
  return (await response.json()).token as string;
}

test('normalizes units, ignores duplicate samples and keeps device totals separate', () => {
  const data = payload();
  data.samples.push(data.samples[0], { ...data.samples[0], value: 1000, source: 'iPhone' });
  const result = normalizeAppleHealth(data);
  assert.deepEqual(result.daily[0], { date: at(0).slice(0, 10), steps: 1200, activeMinutes: 15, hydrationMl: 500, sleepHours: 4 });
});
test('unions overlapping sleep stages, excludes awake/in-bed, uses the wake-up local date', () => {
  const data = payload();
  data.timeZone = 'America/Los_Angeles';
  data.samples = [
    { type: 'sleep', value: 3, unit: '', source: 'Watch', startDate: at(-12), endDate: at(-8) },
    { type: 'sleep', value: 4, unit: '', source: 'Watch', startDate: at(-10), endDate: at(-7) },
    { type: 'sleep', value: 0, unit: '', source: 'Watch', startDate: at(-14), endDate: at(-6) },
    { type: 'sleep', value: 'Awake', unit: '', source: 'Watch', startDate: at(-8), endDate: at(-7) },
    { type: 'sleep', value: 1, unit: '', source: 'Other app', startDate: at(-12), endDate: at(-9) },
  ];
  const result = normalizeAppleHealth(data);
  assert.equal(result.daily[0].sleepHours, 5);
  assert.equal(result.daily[0].date, new Date(time.getTime() - 86_400_000).toISOString().slice(0, 10));
  assert.equal(result.daily[0].steps, null);
  assert.equal(result.ignoredSleepSamples, 2);
  assert.equal(summarizeAppleHealth(result.daily).averages.steps, null);
  assert.equal(summarizeAppleHealth(result.daily).daysBelowTarget.steps, 0);
});
test('rejects future data, invalid units, impossible totals and malformed exports', () => {
  const data = payload();
  assert.equal(appleHealthImportSchema.safeParse({ ...data, timeZone: 'invalid/zone' }).success, false);
  assert.equal(appleHealthImportSchema.safeParse({ ...data, samples: [{ ...data.samples[0], source: '' }] }).success, false);
  assert.throws(() => normalizeAppleHealth({ ...data, exportedAt: new Date(Date.now() + 3_600_000).toISOString() }), /Export time/);
  assert.throws(() => normalizeAppleHealth({ ...data, samples: [{ ...data.samples[0], unit: 'km' }] }), /unit/);
  assert.throws(() => normalizeAppleHealth({ ...data, samples: [{ ...data.samples[0], value: 900_000 }] }), /totals/);
  assert.throws(() => normalizeAppleHealth({ ...data, samples: [{ ...data.samples[0], endDate: at(-4) }] }), /dates/);
});
test('pairing requires a saved, consented workspace and a valid browser origin', async () => {
  assert.equal((await handle(request('POST', 'connection'))).status, 401);
  assert.equal((await handle(request('POST', 'connection', cookieFor(10)))).status, 409);
  const foreign = new Request(`${origin}/health/apple/connection`, { method: 'POST', headers: { cookie: cookieFor(10), origin: 'https://foreign.example' } });
  assert.equal((await handle(foreign)).status, 403);
});
test('imports survive a new store instance, isolate browsers and update without doubling', async () => {
  const token = await pair(11), data = payload();
  const importRequest = () => handle(request('POST', 'import', '', data, token));
  assert.equal((await importRequest()).status, 200);
  assert.equal((await importRequest()).status, 200);
  const freshStore = new AppleHealthStore(query);
  const status = await freshStore.status(ownerOf(11));
  assert.equal(status.connected, true);
  assert.equal(status.daily[0].steps, 1200);
  assert.equal(status.daily.length, 1);
  assert.equal((await freshStore.status(ownerOf(12))).connected, false);
  const rows = await query('SELECT token_hash FROM baymax_apple_health_connections WHERE session_hash = $1', [ownerOf(11)]);
  assert.notEqual(rows[0].token_hash, token);
  assert.equal(rows[0].token_hash, createHash('sha256').update(token).digest('hex'));
});
test('partial updates preserve other readings, reject older snapshots and rotate keys', async () => {
  const token = await pair(13), data = payload();
  assert.equal((await handle(request('POST', 'import', '', data, token))).status, 200);
  const later = { ...data, exportedAt: new Date(Date.now() + 1000).toISOString(), samples: [{ ...data.samples[0], value: 1600 }] };
  assert.equal((await handle(request('POST', 'import', '', later, token))).status, 200);
  const status = await store.status(ownerOf(13));
  assert.equal(status.daily[0].steps, 1600);
  assert.equal(status.daily[0].sleepHours, 4);
  assert.equal((await handle(request('POST', 'import', '', data, token))).status, 409);
  const newToken = (await (await handle(request('POST', 'connection', cookieFor(13)))).json()).token;
  assert.equal((await handle(request('POST', 'import', '', later, token))).status, 401);
  assert.equal((await handle(request('POST', 'import', '', later, newToken))).status, 200);
});
test('disconnect and forgetting the care space revoke keys and delete health summaries', async () => {
  for (const [n, forget] of [[14, false], [15, true]] as const) {
    const token = await pair(n);
    await handle(request('POST', 'import', '', payload(), token));
    if (forget) await care.remove(ownerOf(n));
    else assert.equal((await handle(request('DELETE', 'connection', cookieFor(n)))).status, 200);
    assert.equal((await handle(request('POST', 'import', '', payload(), token))).status, 401);
    assert.equal((await store.status(ownerOf(n))).connected, false);
    assert.equal((await query('SELECT 1 FROM baymax_apple_health_days WHERE session_hash = $1', [ownerOf(n)])).length, 0);
  }
});
test('invalid tokens, oversized bodies and database failures disclose no private details', async () => {
  assert.equal((await handle(request('POST', 'import', '', payload(), 'f'.repeat(64)))).status, 401);
  const token = await pair(16);
  const large = new Request(`${origin}/health/apple/import`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: ' '.repeat(2_000_001) });
  assert.equal((await handle(large)).status, 413);
  const broken = createAppleHealthHandler(new AppleHealthStore(async () => { throw new Error('postgres://secret:password@example'); }), { origin });
  const response = await broken(request('GET', 'connection', cookieFor(16)));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /secret|password|postgres/);
});
test('server session binding replaces a forged request-context owner', () => {
  const context = new Map<string, unknown>([[HEALTH_SESSION_KEY, ownerOf(11)]]);
  bindHealthSession(request('GET', 'connection', cookieFor(12)), context);
  assert.equal(context.get(HEALTH_SESSION_KEY), ownerOf(12));
  bindHealthSession(request('GET', 'connection'), context);
  assert.equal(context.get(HEALTH_SESSION_KEY), null);
  assert.equal(sessionHashOf(new Request(origin, { headers: { cookie: 'baymax_session=bad' } })), undefined);
});

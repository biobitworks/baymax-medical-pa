import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createWorkspace, workspaceSchema } from '../src/shared/workspace.ts';
import { CareStore } from '../src/mastra/persistence/store.ts';
import { createStateHandler } from '../src/mastra/persistence/handler.ts';
import { SaveQueue } from '../src/persistence/client.ts';

const db = new PGlite();
const store = new CareStore(async (sql, params) => (await db.query<Record<string, unknown>>(sql, params)).rows);
const handle = createStateHandler(store, { origin: 'http://localhost:5173' });
before(async () => { for (const file of ['001_care_workspaces.sql', '002_monotonic_revisions.sql']) await db.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8')); });
after(async () => { await db.close(); });
const request = (method = 'GET', cookie = '', body?: unknown, origin = 'http://localhost:5173') => new Request('http://localhost:5173/care-state', {
  method, headers: { origin, cookie, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
});
async function session() {
  const response = await handle(request());
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie')!.split(';')[0]!;
}
const state = () => ({ ...createWorkspace(), remember: true, ready: true, name: 'Synthetic Test', water: 5, brief: 'Synthetic test brief' });

test('issues a private cookie and does not save without consent', async () => {
  const response = await handle(request());
  assert.match(response.headers.get('set-cookie')!, /HttpOnly/);
  assert.match(response.headers.get('set-cookie')!, /SameSite=Strict/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await handle(request('PUT', await session(), { state: createWorkspace(), revision: 0 }))).status, 400);
});
test('round-trips care data and conversation while isolating another browser', async () => {
  const cookie = await session();
  const workspace = { ...state(), tripReady: true, checklist: ["Bring original medication packaging"] };
  workspace.conversation = { messages: [{ parentId: null, message: { id: 'user-1', role: 'user', createdAt: new Date().toISOString(), content: [{ type: 'text', text: 'Synthetic hello' }] } }], headId: 'user-1' };
  assert.equal((await handle(request('PUT', cookie, { state: workspace, revision: 0 }))).status, 200);
  assert.deepEqual((await (await handle(request('GET', cookie))).json()).state, workspace);
  assert.equal((await (await handle(request('GET', await session()))).json()).state, null);
});
test('rejects stale writes so older state cannot overwrite new state', async () => {
  const cookie = await session();
  assert.equal((await handle(request('PUT', cookie, { state: state(), revision: 0 }))).status, 200);
  assert.equal((await handle(request('PUT', cookie, { state: { ...state(), water: 0 }, revision: 0 }))).status, 409);
  assert.equal((await (await handle(request('GET', cookie))).json()).state.water, 5);
});
test('deletion removes the entire workspace', async () => {
  const cookie = await session();
  await handle(request('PUT', cookie, { state: state(), revision: 0 }));
  assert.equal((await handle(request('DELETE', cookie))).status, 200);
  assert.equal((await (await handle(request('GET', cookie))).json()).state, null);
});
test('rejects foreign origins, invalid fields, oversized requests, and missing cookies', async () => {
  const cookie = await session();
  assert.equal((await handle(request('PUT', cookie, { state: state(), revision: 0 }, 'https://foreign.example'))).status, 403);
  assert.equal((await handle(request('PUT', cookie, { state: { ...state(), water: -1 }, revision: 0 }))).status, 400);
  assert.equal((await handle(request('PUT', cookie, { state: { ...state(), brief: 'x'.repeat(600_000) }, revision: 0 }))).status, 413);
  assert.equal((await handle(request('PUT', '', { state: state(), revision: 0 }))).status, 401);
});
test('does not disclose database errors or credentials', async () => {
  const broken = createStateHandler(new CareStore(async () => { throw new Error('postgres://private:password@example/secret'); }), { origin: 'http://localhost:5173' });
  const response = await broken(request('GET', await session()));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /password|postgres|secret/);
});
test('serializes writes with the latest revision and waits before deletion', async () => {
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const calls: string[] = [];
  const queue = new SaveQueue({
    save: async (value, revision) => { calls.push(`save:${value.water}:${revision}`); if (revision === 0) await barrier; return revision + 1; },
    remove: async () => { calls.push('delete'); },
  });
  const first = queue.save(state());
  const second = queue.save({ ...state(), water: 6 });
  const deleted = queue.remove();
  release();
  await Promise.all([first, second, deleted]);
  assert.deepEqual(calls, ['save:5:0', 'save:6:1', 'delete']);
  assert.equal(queue.revision, 0);
});
test('allows local UI proxy origins in development but never foreign origins', async () => {
  const proxied = createStateHandler(store);
  const cookie = await session();
  const local = new Request('http://127.0.0.1:4111/care-state', { method: 'PUT', headers: { cookie, origin: 'http://127.0.0.1:5174', 'content-type': 'application/json' }, body: JSON.stringify({ state: state(), revision: 0 }) });
  assert.equal((await proxied(local)).status, 200);
  const foreign = new Request('http://127.0.0.1:4111/care-state', { method: 'DELETE', headers: { cookie, origin: 'http://attacker.example' } });
  assert.equal((await proxied(foreign)).status, 403);
});
test('deleting and recreating never reuses a stale revision', async () => {
  const cookie = await session();
  const first = await (await handle(request('PUT', cookie, { state: state(), revision: 0 }))).json();
  await handle(request('DELETE', cookie));
  const recreated = await (await handle(request('PUT', cookie, { state: { ...state(), name: 'Recreated' }, revision: 0 }))).json();
  assert.notEqual(first.revision, recreated.revision);
  assert.equal((await handle(request('PUT', cookie, { state: { ...state(), name: 'Stale tab' }, revision: first.revision }))).status, 409);
});

test('restores workspaces saved before travel checklist fields were added', () => {
  const { tripReady, checklist, ...previous } = state();
  const restored = workspaceSchema.parse(previous);
  assert.equal(restored.tripReady, false);
  assert.deepEqual(restored.checklist, []);
});

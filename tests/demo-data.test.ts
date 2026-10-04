import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { DEMO_USER_ID } from '../src/mastra/lib/demo-user.ts';
import { seedDemo, resetDemo } from '../src/mastra/seed/seed.ts';
import { ConversationStore, titleOf } from '../src/mastra/persistence/conversations.ts';
import { addHydration, getRecentCheckins, getRecentMetrics, getRecentRuns, getToday, saveCheckin, saveRun, summarizeRuns } from '../src/mastra/lib/health-data.ts';
import { addUpload, listRecords, readRecord, removeUpload } from '../src/mastra/lib/records.ts';
import { queryLabSeries } from '../src/mastra/lib/labs.ts';

const db = new PGlite();
const q = async (sql: string, params: unknown[] = []) => (await db.query<Record<string, unknown>>(sql, params)).rows;
const ctx = { q };
before(async () => {
  const dir = new URL('../migrations/', import.meta.url);
  for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, dir), 'utf8'));
  await seedDemo(q);
});
after(async () => { await db.close(); });

test('seeds Jordan Mercer with profile, records, labs, habits, and sample chats', async () => {
  const [user] = await q('SELECT name, external_id FROM users WHERE id = $1', [DEMO_USER_ID]);
  assert.deepEqual(user, { name: 'Jordan Mercer', external_id: 'SYN-JM-742' });
  assert.equal((await q('SELECT 1 FROM user_conditions WHERE user_id = $1', [DEMO_USER_ID])).length, 1);
  const records = await listRecords(undefined, ctx);
  assert.ok(records.some(r => r.id === 'library:jordan-mercer-health.json'));
  assert.equal((await getRecentMetrics(30, ctx)).length, 30);
  assert.ok((await getRecentCheckins(7, ctx)).length > 0);
  assert.ok((await getRecentRuns(5, ctx)).length > 0);
  assert.equal((await new ConversationStore(q).list(DEMO_USER_ID)).length, 3);
});
test('seeding twice is idempotent', async () => {
  await seedDemo(q);
  assert.equal((await q('SELECT count(*)::int AS n FROM conversations'))[0].n, 3);
  assert.equal((await q('SELECT count(*)::int AS n FROM users'))[0].n, 1);
  assert.equal((await q('SELECT count(*)::int AS n FROM checkins'))[0].n, (await q('SELECT count(*)::int AS n FROM checkins'))[0].n);
});
test('lab trends come from Postgres and dedupe the JSON and CSV copies', async () => {
  const { series } = await queryLabSeries({ biomarkers: ['HbA1c'] }, undefined, ctx);
  assert.equal(series.length, 1);
  assert.deepEqual(series[0].points, [{ date: '2026-04-15', value: 6.9 }, { date: '2026-08-12', value: 6.7 }]);
});
test('check-ins, water, and runs persist', async () => {
  await saveCheckin('great', 'Synthetic note', ctx);
  assert.equal((await getRecentCheckins(1, ctx))[0].energy, 'great');
  const before = (await getToday(ctx)).hydrationMl;
  assert.equal((await addHydration(250, ctx)).hydrationMl, before + 250);
  await saveRun(2, 24, undefined, ctx);
  const runs = await getRecentRuns(1, ctx);
  assert.equal(runs[0].distanceMi, 2);
  assert.equal(summarizeRuns(runs).total, 1);
});
test('uploads are scoped to their chat and feed lab trends', async () => {
  const conv = '11111111-1111-4111-8111-111111111111';
  const rec = await addUpload(conv, 'extra.csv', 'measurement_date,biomarker,value,unit\n2026-09-01,Ferritin,80,ng/mL\n', ctx);
  assert.ok((await listRecords(conv, ctx)).some(r => r.id === rec.id));
  assert.ok(!(await listRecords('other', ctx)).some(r => r.id === rec.id));
  assert.equal((await readRecord(rec.id, 'other', 0, 100, ctx)), null);
  assert.equal((await readRecord(rec.id, conv, 0, 100, ctx))?.name, 'extra.csv');
  assert.equal((await queryLabSeries({ biomarkers: ['Ferritin'] }, conv, ctx)).series.length, 1);
  assert.equal((await queryLabSeries({ biomarkers: ['Ferritin'] }, 'other', ctx)).series.length, 0);
  assert.equal(await removeUpload(conv, rec.id, ctx), true);
  assert.equal((await queryLabSeries({ biomarkers: ['Ferritin'] }, conv, ctx)).series.length, 0);
});
test('conversations round-trip, replace messages, and stay private to their user', async () => {
  const store = new ConversationStore(q);
  const id = '22222222-2222-4222-8222-222222222222';
  const msg = (mid: string, role: string, text: string, parentId: string | null) => ({ parentId, message: { id: mid, role, createdAt: '2026-10-04T20:00:00.000Z', content: [{ type: 'text', text }], metadata: { custom: {} } } });
  const first = { headId: 'b', messages: [msg('a', 'user', 'Synthetic hello there', null), msg('b', 'assistant', 'Hi', 'a')] } as any;
  assert.equal(await store.save(DEMO_USER_ID, id, first), true);
  const loaded = await store.load(DEMO_USER_ID, id);
  assert.equal(loaded?.title, 'Synthetic hello there');
  assert.deepEqual(loaded?.conversation, first);
  const second = { headId: 'c', messages: [msg('a', 'user', 'Synthetic hello there', null), msg('c', 'assistant', 'Edited', 'a')] } as any;
  await store.save(DEMO_USER_ID, id, second);
  assert.deepEqual((await store.load(DEMO_USER_ID, id))?.conversation, second);
  const other = '33333333-3333-4333-8333-333333333333';
  await q("INSERT INTO users (id, name) VALUES ($1, 'Someone Else')", [other]);
  assert.equal(await store.save(other, id, first), false);
  assert.equal(await store.load(other, id), null);
  assert.equal(await store.remove(other, id), false);
  assert.equal(await store.remove(DEMO_USER_ID, id), true);
  assert.equal(titleOf({ headId: null, messages: [] }), 'New chat');
});
test('reset restores seeded chats and habit data', async () => {
  const store = new ConversationStore(q);
  await store.removeAll(DEMO_USER_ID);
  await q('DELETE FROM runs');
  await resetDemo(q);
  assert.equal((await store.list(DEMO_USER_ID)).length, 3);
  assert.ok((await getRecentRuns(5, ctx)).length > 0);
  assert.ok((await listRecords(undefined, ctx)).length >= 2);
});

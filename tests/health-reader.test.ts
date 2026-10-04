import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { appleHealthStore, importedHealth } from '../src/mastra/lib/health-reader';
import { HEALTH_SESSION_KEY } from '../src/mastra/persistence/session';
import { dailyMetricsTool } from '../src/mastra/tools/daily-metrics-tool';

const context = { requestContext: new Map([[HEALTH_SESSION_KEY, 'a'.repeat(64)]]) };
const disconnected = { connected: false, lastSyncAt: null, daily: [] };

test('a failing Apple Health lookup falls back to disconnected so tools use the stored profile', async t => {
  const failures = [
    { name: 'migration has not been applied', error: Object.assign(new Error('relation baymax_apple_health_connections does not exist'), { code: '42P01' }) },
    { name: 'database is unavailable', error: new Error('Database connection unavailable') },
  ];
  for (const failure of failures) {
    await t.test(failure.name, async () => {
      const status = mock.method(appleHealthStore, 'status', async () => { throw failure.error; });
      try {
        assert.deepEqual(await importedHealth(context), disconnected);
      } finally { status.mock.restore(); }
    });
  }
});

test('requests without a browser session use the connection paired to the app user', async () => {
  const connected = { connected: true, lastSyncAt: '2026-10-04T12:00:00Z', daily: [{ date: '2026-10-04', steps: 900, activeMinutes: 12, hydrationMl: null, sleepHours: null }] };
  const status = mock.method(appleHealthStore, 'status', async () => { throw new Error('Must not query by session'); });
  const forUser = mock.method(appleHealthStore, 'statusForUser', async () => connected);
  try {
    assert.deepEqual(await importedHealth(), connected);
    assert.deepEqual(await importedHealth({ requestContext: new Map([[HEALTH_SESSION_KEY, null]]) }), connected);
    assert.equal(status.mock.callCount(), 0);
  } finally { status.mock.restore(); forUser.mock.restore(); }
});

test('successful Apple Health lookups still return the connected user readings', async () => {
  const connected = {
    connected: true, lastSyncAt: '2026-10-04T12:00:00Z',
    daily: [{ date: '2026-10-04', steps: 4800, activeMinutes: null, hydrationMl: null, sleepHours: 7.1 }],
  };
  const status = mock.method(appleHealthStore, 'status', async () => connected);
  try {
    assert.deepEqual(await importedHealth(context, 3), connected);
    assert.deepEqual(status.mock.calls[0].arguments, ['a'.repeat(64), 3]);
    const metrics = await dailyMetricsTool.execute!({ days: 3 }, context as any);
    assert.equal(metrics.source, 'apple_health');
    assert.equal(metrics.daily[0].steps, 4800);
    assert.equal(metrics.daily[0].hydrationMl, null);
  } finally { status.mock.restore(); }
});

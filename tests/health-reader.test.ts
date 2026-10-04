import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { appleHealthStore, importedHealth } from '../src/mastra/lib/health-reader';
import { HEALTH_SESSION_KEY } from '../src/mastra/persistence/session';
import { dailyMetricsTool } from '../src/mastra/tools/daily-metrics-tool';
import { userInfoTool } from '../src/mastra/tools/user-info-tool';
import { recentCheckinsTool } from '../src/mastra/tools/checkins-tool';
import { recentRunsTool } from '../src/mastra/tools/runs-tool';

const context = { requestContext: new Map([[HEALTH_SESSION_KEY, 'a'.repeat(64)]]) };
const disconnected = { connected: false, lastSyncAt: null, daily: [] };

test('browser health tools retain explicitly labeled demo data when Apple Health storage fails', async t => {
  const failures = [
    { name: 'migration has not been applied', error: Object.assign(new Error('relation baymax_apple_health_connections does not exist'), { code: '42P01' }) },
    { name: 'database is unavailable', error: new Error('Database connection unavailable') },
  ];
  for (const failure of failures) {
    await t.test(failure.name, async () => {
      const status = mock.method(appleHealthStore, 'status', async () => { throw failure.error; });
      try {
        assert.deepEqual(await importedHealth(context), disconnected);
        const metrics = await dailyMetricsTool.execute!({ days: 3 }, context as any);
        assert.equal(metrics.source, 'demo');
        assert.equal(metrics.daily.length, 3);
        assert.ok(metrics.daily.every(day => typeof day.steps === 'number'));
        const profile = await userInfoTool.execute!({}, context as any);
        assert.equal(profile.name, 'Alex');
        assert.match(profile.notes!, /Synthetic demo profile/);
        const checkins = await recentCheckinsTool.execute!({ count: 3 }, context as any);
        assert.ok(checkins.checkins.length > 0);
        const runs = await recentRunsTool.execute!({ count: 3 }, context as any);
        assert.ok(runs.runs.length > 0);
      } finally { status.mock.restore(); }
    });
  }
});

test('requests without a browser session do not query Neon', async () => {
  const status = mock.method(appleHealthStore, 'status', async () => { throw new Error('Must not query'); });
  try {
    assert.deepEqual(await importedHealth(), disconnected);
    assert.deepEqual(await importedHealth({ requestContext: new Map([[HEALTH_SESSION_KEY, null]]) }), disconnected);
    assert.equal(status.mock.callCount(), 0);
  } finally { status.mock.restore(); }
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

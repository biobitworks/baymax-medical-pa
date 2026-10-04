import test from 'node:test';
import assert from 'node:assert/strict';
import * as fitness from '../src/mastra/lib/fitness.ts';

test('fitness progress follows saved goals and requires both daily targets', () => {
  assert.equal(typeof fitness.buildFitnessOverview, 'function');
  const result = fitness.buildFitnessOverview([
    { date: '2026-10-04', steps: 6000, activeMinutes: 25 },
    { date: '2026-10-03', steps: 4000, activeMinutes: 30 },
  ], { steps: 5000, activeMinutes: 20 });
  assert.equal(result.achievedDays, 1);
  assert.equal(result.weeklyMinutes, 55);
  assert.equal(result.weeklyTarget, 140);
  assert.equal(result.daily[0].achieved, true);
  assert.equal(result.daily[1].achieved, false);
});

test('goal validation rejects invalid values and incomplete onboarding', () => {
  assert.equal(typeof fitness.preferencesSchema?.safeParse, 'function');
  assert.equal(fitness.preferencesSchema.safeParse({ name: '', goals: { steps: -1, activeMinutes: 0 }, notifications: 'enabled' }).success, false);
  assert.equal(fitness.preferencesSchema.safeParse({ name: 'Sam', goals: { steps: 5000, activeMinutes: 20 }, notifications: 'off' }).success, true);
});

test('empty fitness history has no fabricated daily metrics', () => {
  assert.equal(typeof fitness.buildFitnessOverview, 'function');
  const result = fitness.buildFitnessOverview([], { steps: 5000, activeMinutes: 20 });
  assert.equal(result.today, null);
  assert.equal(result.achievedDays, 0);
  assert.equal(result.weeklyMinutes, 0);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace } from '../src/shared/workspace';
import { initializeHealthOverview } from '../src/persistence/health-overview';

const overview = {
  today: { hydrationMl: 1250, activeMinutes: 12 },
  todayCheckin: { energy: 'low' },
  metrics: [{ date: '2026-10-04', hydrationMl: 1250, activeMinutes: 12 }],
  checkins: [{ date: '2026-10-04', energy: 'low' }],
};

test('initializes a new workspace with the health overview', () => {
  const state = initializeHealthOverview(createWorkspace(), overview);
  assert.equal(state.water, 5);
  assert.equal(state.energy, 'Low');
  assert.equal(state.activeMinutes, 12);
  assert.equal(state.week[0].energy, 'low');
});

test('a late health overview cannot replace restored or edited care data', () => {
  const saved = { ...createWorkspace(), ready: true, water: 7, energy: 'Great' as const, activeMinutes: 30 };
  assert.equal(initializeHealthOverview(saved, overview), saved);
});

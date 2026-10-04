import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyToolResult, historicalCard } from '../src/chat/cards';
import { createWorkspace } from '../src/shared/workspace';
test('earlier cards retain their own tool output while the active plan remains editable', () => {
  const oldPlan = { title: 'Earlier plan', items: [{ label: 'Old task', done: false }] };
  const newPlan = { title: 'Current plan', items: [{ label: 'New task', done: false }] };
  const workspace = applyToolResult(applyToolResult(createWorkspace(), 'plan', oldPlan, 'old'), 'plan', newPlan, 'new');
  assert.equal(historicalCard(workspace, 'plan', 'old', oldPlan)?.data.title, 'Earlier plan');
  assert.equal(historicalCard(workspace, 'plan', 'new', newPlan), undefined);
  assert.equal(workspace.goal, 'Current plan');
  assert.equal(applyToolResult(workspace, 'plan', oldPlan, 'old').activePlanId, 'old');
});

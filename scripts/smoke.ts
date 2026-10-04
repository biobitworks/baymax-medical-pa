import assert from 'node:assert/strict';
import { createWorkspace } from '../src/shared/workspace';
import { createAgentAdapter } from '../src/chat/adapter';
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5174';
const response = await fetch(`${base}/care-state`);
assert.equal(response.status, 200);
const cookie = response.headers.get('set-cookie')?.split(';')[0];
assert.ok(cookie);
const headers = { cookie, origin: base, 'content-type': 'application/json' };
try {
  const state = { ...createWorkspace(), name: 'Synthetic smoke', remember: true, ready: true, brief: 'Synthetic integration test only', water: 7 };
  const saved = await fetch(`${base}/care-state`, { method: 'PUT', headers, body: JSON.stringify({ state, revision: 0 }) });
  assert.equal(saved.status, 200, await saved.text());
  const restored = await (await fetch(`${base}/care-state`, { headers })).json();
  assert.deepEqual(restored.state, state);
  console.log('Live Neon save and restore passed.');
  const seen: string[] = [];
  const adapter = createAgentAdapter({ fetch: (url, init) => fetch(`${base}${url}`, init), onToolResult: kind => seen.push(kind) });
  let text = '';
  for await (const output of adapter.run({
    messages: [{ id: 'smoke-1', role: 'user', content: [{ type: 'text', text: 'Create a care plan titled Synthetic Test Plan with exactly two tasks: Take a walk and Pack documents, starting 2026-10-10. Use your create-care-plan tool now; no questions needed.' }], createdAt: new Date(), attachments: [], metadata: { custom: {} } }],
    abortSignal: new AbortController().signal,
  } as Parameters<typeof adapter.run>[0])) {
    text = output.content?.filter(part => part.type === 'text').map(part => part.text).join('') ?? '';
  }
  assert.ok(text.length);
  assert.ok(seen.includes('plan'), 'The live agent did not produce a plan tool result');
  console.log('Live agent text and structured plan tool result passed.');
} finally {
  const deleted = await fetch(`${base}/care-state`, { method: 'DELETE', headers });
  assert.equal(deleted.status, 200);
  const cleared = await (await fetch(`${base}/care-state`, { headers })).json();
  assert.equal(cleared.state, null);
  console.log('Disposable test workspace deleted and verified.');
}

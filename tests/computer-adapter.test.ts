import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unlockComputer, lockComputer } from '../src/computer/client';
import { createAgentAdapter } from '../src/chat/adapter';

test('chat sends unlocked computer capability as request context, never as model message content', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({capability:'private-test-capability', expiresAt:Date.now()+60000});
  let sent: Record<string, unknown> | undefined;
  try {
    await unlockComputer('private-unlock-key');
    const adapter = createAgentAdapter({fetch:async (_url,init) => {
      sent = JSON.parse(String(init?.body));
      return new Response('data: {"type":"finish"}\n\n',{headers:{'Content-Type':'text/event-stream'}});
    }});
    const stream = adapter.run({messages:[],abortSignal:new AbortController().signal} as Parameters<typeof adapter.run>[0]);
    for await (const _ of stream as AsyncGenerator) { /* Read the completed stream. */ }
    assert.equal((sent?.requestContext as Record<string,unknown>).computerCapability,'private-test-capability');
    assert.doesNotMatch(JSON.stringify(sent?.messages),/private-test-capability|private-unlock-key/);
  } finally { lockComputer(); globalThis.fetch = original; }
});

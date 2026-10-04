import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useLocalRuntime, AssistantRuntimeProvider, type AssistantRuntime, type ExportedMessageRepository } from '@assistant-ui/react';
import { conversationSchema } from '../src/shared/workspace';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).window = new EventTarget();

test('actual Assistant UI exports validate and restore tool cards and dates', async () => {
  let runtime!: AssistantRuntime;
  let renderer!: ReactTestRenderer;
  let initial: ExportedMessageRepository | undefined;
  function Harness() {
    runtime = useLocalRuntime({ async *run() { yield { content: [{ type: 'text', text: 'Synthetic plan' }, { type: 'tool-call', toolCallId: 'plan-1', toolName: 'care_action', args: { kind: 'plan' }, argsText: '{"kind":"plan"}', result: { title: 'Synthetic plan', items: [{ label: 'Test task', done: false }] } }] }; } });
    React.useEffect(() => { if (initial) runtime.thread.import(initial); }, [runtime]);
    return React.createElement(AssistantRuntimeProvider, { runtime, children: null });
  }
  try {
    await act(async () => { renderer = create(React.createElement(Harness)); });
    await act(async () => { runtime.thread.append({ role: 'user', content: [{ type: 'text', text: 'Synthetic test message' }] }); await new Promise(resolve => setTimeout(resolve, 50)); });
    const serialized = JSON.stringify(runtime.thread.export());
    const stored = conversationSchema.parse(JSON.parse(serialized));
    assert.equal(stored.messages.length, 2);
    await act(async () => { renderer.unmount(); });
    initial = { ...stored, messages: stored.messages.map(item => ({ ...item, message: { ...item.message, createdAt: new Date(item.message.createdAt) } })) } as unknown as ExportedMessageRepository;
    await act(async () => { renderer = create(React.createElement(Harness)); });
    const restored = runtime.thread.getState().messages;
    assert.equal(restored.length, 2);
    assert.ok(restored[0]!.createdAt instanceof Date);
    assert.equal(restored[1]!.content.filter(part => part.type === 'tool-call').length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(runtime.thread.export())), JSON.parse(serialized));
  } finally { await act(async () => { renderer?.unmount(); }); }
});

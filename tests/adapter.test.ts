import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readEvents, createAgentAdapter } from '../src/chat/adapter.ts';

function response(parts: string[]) { return new Response(new ReadableStream({ start(controller) { for (const part of parts) controller.enqueue(new TextEncoder().encode(part)); controller.close(); } }), { headers: { 'content-type': 'text/event-stream' } }); }
test('reads split CRLF and trailing SSE frames', async () => {
  const events = [];
  for await (const event of readEvents(response(['data: {"type":"text-', 'delta","payload":{"text":"hi"}}\r\n\r', '\ndata: {"type":"finish"}']))) events.push(event);
  assert.deepEqual(events.map(event => event.type), ['text-delta', 'finish']);
});
test('uses actual plan and brief tool results, preserving multiple cards', async () => {
  const results: unknown[] = [];
  const adapter = createAgentAdapter({ onToolResult: (kind, result) => results.push({ kind, result }), fetch: async () => response([
    'data: {"type":"text-delta","payload":{"text":"Here you go."}}\n\n',
    'data: {"type":"tool-result","payload":{"toolName":"carePlanTool","toolCallId":"p1","result":{"title":"Actual plan","startDate":"2026-10-10","items":[{"label":"Actual task","done":false}]}}}\n\n',
    'data: {"type":"tool-result","payload":{"toolName":"doctorBriefTool","toolCallId":"b1","result":{"brief":"Actual brief","needsReview":true}}}\n\n',
    'data: {"type":"finish"}\n\n',
  ]) });
  const output = [];
  for await (const item of adapter.run({ messages: [], abortSignal: new AbortController().signal } as any)) output.push(item);
  assert.equal(results.length, 2);
  assert.equal(output.at(-1)!.content!.filter(part => part.type === 'tool-call').length, 2);
  assert.equal((results[0] as any).result.title, 'Actual plan');
});
test('reports server and stream failures instead of inventing a fallback', async () => {
  const adapter = createAgentAdapter({ fetch: async () => new Response('', { status: 503 }) });
  await assert.rejects(async () => { for await (const _ of adapter.run({ messages: [], abortSignal: new AbortController().signal } as any)) {} }, /connect/);
  const failed = createAgentAdapter({ fetch: async () => response(['data: {"type":"error","payload":{"error":"private-provider-error"}}\n\n']) });
  await assert.rejects(async () => { for await (const _ of failed.run({ messages: [], abortSignal: new AbortController().signal } as any)) {} }, /interrupted/);
});

test('preserves health cards alongside generated care plans and replaces repeated metrics', async () => {
  const frames = [
    { type: 'tool-result', payload: { toolName: 'recentRunsTool', toolCallId: 'r1', result: { miles: 2 } } },
    { type: 'tool-result', payload: { toolName: 'carePlanTool', toolCallId: 'p1', result: { title: 'Run recovery', items: [{ label: 'Rest', done: false }] } } },
    { type: 'tool-result', payload: { toolName: 'recentRunsTool', toolCallId: 'r2', result: { miles: 3 } } },
    { type: 'finish' },
  ];
  const adapter = createAgentAdapter({
    fetch: async () => response(frames.map(frame => `data: ${JSON.stringify(frame)}\n\n`)),
    getToolCards: (tool, result, id) => tool === 'recentRunsTool' ? [{ type: 'tool-call', toolName: 'health_card', toolCallId: id, args: { metric: 'running', data: result }, argsText: '{}', result: { ready: true } }] : [],
  });
  const output = [];
  for await (const item of adapter.run({ messages: [], abortSignal: new AbortController().signal } as any)) output.push(item);
  const cards = output.at(-1)!.content!.filter(part => part.type === 'tool-call');
  assert.equal(cards.length, 2);
  assert.equal(cards[0].toolName, 'care_action');
  assert.equal(cards[1].toolCallId, 'r2');
  assert.deepEqual(cards[1].args, { metric: 'running', data: { miles: 3 } });
});

test('preserves streamed search sources alongside fitness and actual care results', async () => {
  const frames = [
    { type: 'tool-call', payload: { toolName: 'webSearchTool', toolCallId: 's1' } },
    { type: 'tool-result', payload: { toolName: 'webSearchTool', toolCallId: 's1', result: { results: [{ title: 'Source', url: 'https://example.org', highlights: ['Verified excerpt'] }] } } },
    { type: 'tool-result', payload: { toolName: 'fitnessOverviewTool', toolCallId: 'f1', result: { goals: { steps: 5000, activeMinutes: 20 } } } },
    { type: 'tool-result', payload: { toolName: 'carePlanTool', toolCallId: 'p1', result: { title: 'Actual plan', items: [{ label: 'Actual task', done: false }] } } },
    { type: 'finish' },
  ];
  const adapter = createAgentAdapter({
    fetch: async () => response(frames.map(frame => `data: ${JSON.stringify(frame)}\n\n`)),
    getToolCards: (tool, result, id) => tool === 'fitnessOverviewTool' ? [{ type: 'tool-call', toolName: 'health_card', toolCallId: id, args: { metric: 'fitness', overview: result }, argsText: '{}', result: { ready: true } }] : [],
  });
  const output = [];
  for await (const item of adapter.run({ messages: [], abortSignal: new AbortController().signal } as any)) output.push(item);
  const cards = output.at(-1)!.content!.filter(part => part.type === 'tool-call');
  assert.equal(cards.length, 3);
  assert.equal(cards.find(card => card.toolName === 'web_search')?.args.state, 'complete');
  assert.equal(cards.find(card => card.toolName === 'health_card')?.args.metric, 'fitness');
  assert.equal(cards.find(card => card.toolName === 'care_action')?.result?.title, 'Actual plan');
  assert.ok(output.some(item => item.content?.some(part => part.type === 'tool-call' && part.toolName === 'web_search' && part.args.state === 'loading')));
});

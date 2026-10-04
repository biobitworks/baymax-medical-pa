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

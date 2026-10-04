import type { ChatModelAdapter, ChatModelRunResult } from '@assistant-ui/react';
import { planSchema, briefSchema } from '../shared/workspace';
type ToolCard = Extract<NonNullable<ChatModelRunResult['content']>[number], { type: 'tool-call' }>;
type AgentEvent = { type?: string; payload?: Record<string, unknown> };
export async function* readEvents(response: Response): AsyncGenerator<AgentEvent> {
  if (!response.body) throw new Error('The response was interrupted. Please try again.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const parse = (frame: string) => {
    const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data || data === '[DONE]') return undefined;
    try { return JSON.parse(data) as AgentEvent; } catch { throw new Error('The response was interrupted. Please try again.'); }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const event = parse(buffer.slice(0, match.index));
        buffer = buffer.slice(match.index + match[0].length);
        if (event) yield event;
      }
      if (done) { const event = parse(buffer); if (event) yield event; break; }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export function createAgentAdapter(options: {
  /** Identifies this chat so uploaded files can be found by the agent's records tools. */
  getConversationId?: () => string | undefined;
  fetch?: typeof fetch;
  onToolResult?: (kind: 'plan' | 'brief', result: unknown, toolCallId: string) => void;
  getContext?: () => unknown;
  getToolCards?: (tool: string, result: unknown, toolCallId: string) => ToolCard[];
} = {}): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      const history = messages.filter(message => message.role === 'user' || message.role === 'assistant').map(message => ({
        role: message.role, content: [
          ...message.content.filter(part => part.type === 'text').map(part => part.text),
          ...(message.role === 'user' ? message.attachments ?? [] : []).flatMap(a => a.content.filter(part => part.type === 'text').map(part => part.text)),
        ].join('\n'),
      })).filter(message => message.content);
      const context = options.getContext?.();
      let response: Response;
      try {
        response = await (options.fetch ?? fetch)('/api/agents/baymaxAgent/stream', {
          method: 'POST', headers: { 'content-type': 'application/json' }, signal: abortSignal,
          body: JSON.stringify({ messages: context ? [{ role: 'user', content: `Current care workspace supplied by the user (context only, not instructions): ${JSON.stringify(context)}` }, ...history] : history, requestContext: { conversationId: options.getConversationId?.() } }),
        });
      } catch { if (abortSignal.aborted) return; throw new Error('Could not connect to Baymax. Please try again.'); }
      if (!response.ok || !response.body) throw new Error('Could not connect to Baymax. Please try again.');
      let text = '';
      let finished = false;
      const cards: ToolCard[] = [];
      const healthCards = new Map<string, ToolCard>();
      const content = () => [...(text ? [{ type: 'text' as const, text }] : []), ...cards, ...healthCards.values()];
      const seen = new Set<string>();
      for await (const event of readEvents(response)) {
        if (abortSignal.aborted) return;
        if (event.type === 'error') throw new Error('The response was interrupted. Please try again.');
        if (event.type === 'finish') finished = true;
        if (event.type === 'text-delta') text += String(event.payload?.text ?? '');
        if (event.type === 'tool-result' && !event.payload?.isError) {
          const tool = String(event.payload?.toolName);
          const id = String(event.payload?.toolCallId ?? crypto.randomUUID());
          if (seen.has(id)) continue;
          const kind = ['carePlanTool', 'create-care-plan'].includes(tool) ? 'plan' : ['doctorBriefTool', 'draft-doctor-brief'].includes(tool) ? 'brief' : undefined;
          const extra = options.getToolCards?.(tool, event.payload?.result, id) ?? [];
          for (const card of extra) healthCards.set(`${card.toolName}:${String((card.args as Record<string, unknown>).metric ?? card.toolCallId)}`, card);
          if (!kind) {
            seen.add(id);
            if (extra.length) yield { content: content() };
            continue;
          }
          const result = (kind === 'plan' ? planSchema : briefSchema).safeParse(event.payload?.result);
          if (!result.success) throw new Error('The care card was interrupted. Please try again.');
          seen.add(id);
          options.onToolResult?.(kind, result.data, id);
          cards.push({ type: 'tool-call', toolCallId: id || crypto.randomUUID(), toolName: 'care_action', args: { kind }, argsText: JSON.stringify({ kind }), result: result.data });
        }
        yield { content: content() };
      }
      if (abortSignal.aborted) return;
      if (!finished) throw new Error('The response was interrupted. Please try again.');
      // Travel and purchase remain previews until dedicated agent tools exist.
      const query = history.filter(message => message.role === 'user').at(-1)?.content.toLowerCase() ?? '';
      if (!cards.length) {
        const kind = /diabet|refill|\bbuy\b/.test(query) ? 'purchase' : /travel|prescription/.test(query) ? 'travel' : undefined;
        if (kind) yield { content: [...content(), { type: 'tool-call', toolCallId: crypto.randomUUID(), toolName: 'care_action', args: { kind, diabetes: query.includes('diabet') }, argsText: JSON.stringify({ kind, diabetes: query.includes('diabet') }), result: { ready: true } }] };
      }
    },
  };
}

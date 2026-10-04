import { conversationSchema, type StoredConversation } from '../shared/workspace';

export interface ConversationSummary { id: string; title: string; updatedAt: string }
export const EMPTY_CONVERSATION: StoredConversation = { messages: [], headId: null };

async function call(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(path, {
    method, credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

export const conversationsApi = {
  async list(): Promise<ConversationSummary[]> {
    return (await call('/conversations')).conversations;
  },
  async load(id: string): Promise<StoredConversation> {
    const data = await call(`/conversations/${id}`);
    return conversationSchema.parse(data.conversation);
  },
  async save(id: string, conversation: StoredConversation) {
    await call(`/conversations/${id}`, 'PUT', { conversation });
  },
  async remove(id: string) {
    await call(`/conversations/${id}`, 'DELETE');
  },
  /** Restores the demo user's chats and health history to the seeded state. */
  async resetDemo() {
    await call('/demo/reset', 'POST');
  },
};

export function relativeTime(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

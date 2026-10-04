import type { StoredConversation } from "../../shared/workspace";
import type { Query } from "./store";

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

const MAX_TITLE = 60;

/** A short chat title taken from the first thing the user said. */
export function titleOf(repository: StoredConversation): string {
  for (const { message } of repository.messages) {
    if (message.role !== "user") continue;
    const text = message.content
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) return text.length > MAX_TITLE ? `${text.slice(0, MAX_TITLE - 1).trimEnd()}…` : text;
  }
  return "New chat";
}

/**
 * Chat history in Postgres. Each conversation is a tree of messages (the shape
 * assistant-ui exports), stored one row per message so chats can be listed,
 * searched, and restored. Every method is scoped to a user.
 */
export class ConversationStore {
  constructor(private query: Query) {}

  async list(userId: string): Promise<ConversationSummary[]> {
    const rows = await this.query(
      `SELECT c.id, c.title, to_char(c.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at
       FROM conversations c WHERE c.user_id = $1 ORDER BY c.updated_at DESC, c.id LIMIT 200`,
      [userId],
    );
    return rows.map((r) => ({ id: String(r.id), title: String(r.title), updatedAt: String(r.updated_at) }));
  }

  async load(userId: string, id: string): Promise<(ConversationSummary & { conversation: StoredConversation }) | null> {
    const [conv] = await this.query(
      `SELECT id, title, head_id, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at
       FROM conversations WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    if (!conv) return null;
    const rows = await this.query(
      `SELECT id, parent_id, role, content, extra, run_config,
              to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at
       FROM conversation_messages WHERE conversation_id = $1 ORDER BY position`,
      [id],
    );
    return {
      id: String(conv.id),
      title: String(conv.title),
      updatedAt: String(conv.updated_at),
      conversation: {
        headId: conv.head_id == null ? null : String(conv.head_id),
        messages: rows.map((r) => ({
          parentId: r.parent_id == null ? null : String(r.parent_id),
          ...(r.run_config ? { runConfig: r.run_config as Record<string, unknown> } : {}),
          message: {
            ...(r.extra as Record<string, unknown>),
            id: String(r.id),
            role: r.role,
            createdAt: String(r.created_at),
            content: r.content,
          },
        })),
      } as StoredConversation,
    };
  }

  /**
   * Creates or fully replaces a conversation's messages in one statement.
   * Returns false when the id belongs to a different user.
   */
  async save(userId: string, id: string, repository: StoredConversation, title = titleOf(repository)): Promise<boolean> {
    const messages = repository.messages.map(({ message, parentId, runConfig }, position) => {
      const { id: messageId, role, createdAt, content, ...extra } = message as Record<string, unknown>;
      return { id: messageId, parent_id: parentId, role, position, content, extra, run_config: runConfig ?? null, created_at: createdAt };
    });
    const rows = await this.query(
      `WITH conv AS (
         INSERT INTO conversations (id, user_id, title, head_id) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, head_id = EXCLUDED.head_id, updated_at = now()
           WHERE conversations.user_id = EXCLUDED.user_id
         RETURNING id
       ), del AS (
         DELETE FROM conversation_messages
         WHERE conversation_id = $1 AND EXISTS (SELECT 1 FROM conv)
           AND id <> ALL (SELECT m.id FROM jsonb_to_recordset($5::jsonb) AS m(id text))
       ), ins AS (
         INSERT INTO conversation_messages (conversation_id, id, parent_id, role, position, content, extra, run_config, created_at)
         SELECT $1, m.id, m.parent_id, m.role, m.position, m.content, m.extra, m.run_config, m.created_at
         FROM jsonb_to_recordset($5::jsonb) AS m(id text, parent_id text, role text, position int, content jsonb, extra jsonb, run_config jsonb, created_at timestamptz)
         WHERE EXISTS (SELECT 1 FROM conv)
         ON CONFLICT (conversation_id, id) DO UPDATE SET
           parent_id = EXCLUDED.parent_id, role = EXCLUDED.role, position = EXCLUDED.position,
           content = EXCLUDED.content, extra = EXCLUDED.extra, run_config = EXCLUDED.run_config
       )
       SELECT id FROM conv`,
      [id, userId, title, repository.headId ?? null, JSON.stringify(messages)],
    );
    return rows.length > 0;
  }

  async remove(userId: string, id: string): Promise<boolean> {
    const rows = await this.query("DELETE FROM conversations WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);
    // Files attached to the chat go with it.
    await this.query("DELETE FROM records WHERE user_id = $1 AND source = 'upload' AND conversation_id = $2", [userId, id]);
    return rows.length > 0;
  }

  async removeAll(userId: string): Promise<void> {
    await this.query("DELETE FROM conversations WHERE user_id = $1", [userId]);
  }
}

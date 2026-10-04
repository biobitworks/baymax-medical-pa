import { registerApiRoute } from "@mastra/core/server";
import { z } from "zod";
import { conversationSchema } from "../../shared/workspace";
import { query } from "../persistence/database";
import { ConversationStore } from "../persistence/conversations";
import { userIdOf } from "../lib/demo-user";

const idSchema = z.uuid();
const saveBody = z.object({ conversation: conversationSchema.refine((c) => c.messages.length > 0, "Empty conversation") });

/**
 * Chat history endpoints. All of them act as the current user from `userIdOf()`
 * (see src/mastra/lib/demo-user.ts, which explains how to add real auth).
 * They are currently unauthenticated.
 */
export function createConversationRoutes(store = new ConversationStore(query)) {
  return [
    registerApiRoute("/conversations", {
      method: "GET",
      handler: async (c) => {
        try {
          return c.json({ conversations: await store.list(userIdOf()) });
        } catch {
          return c.json({ error: "Your chats are unavailable. Please try again." }, 503);
        }
      },
    }),

    registerApiRoute("/conversations/:id", {
      method: "GET",
      handler: async (c) => {
        const id = idSchema.safeParse(c.req.param("id"));
        if (!id.success) return c.json({ error: "Invalid chat" }, 400);
        try {
          const found = await store.load(userIdOf(), id.data);
          return found ? c.json(found) : c.json({ error: "Chat not found" }, 404);
        } catch {
          return c.json({ error: "Your chat is unavailable. Please try again." }, 503);
        }
      },
    }),

    registerApiRoute("/conversations/:id", {
      method: "PUT",
      handler: async (c) => {
        const id = idSchema.safeParse(c.req.param("id"));
        const body = saveBody.safeParse(await c.req.json().catch(() => ({})));
        if (!id.success || !body.success) return c.json({ error: "Invalid chat" }, 400);
        try {
          const saved = await store.save(userIdOf(), id.data, body.data.conversation);
          return saved ? c.json({ saved: true }) : c.json({ error: "Chat not found" }, 404);
        } catch {
          return c.json({ error: "Your chat could not be saved. Please try again." }, 503);
        }
      },
    }),

    registerApiRoute("/conversations/:id", {
      method: "DELETE",
      handler: async (c) => {
        const id = idSchema.safeParse(c.req.param("id"));
        if (!id.success) return c.json({ error: "Invalid chat" }, 400);
        try {
          return c.json({ deleted: await store.remove(userIdOf(), id.data) });
        } catch {
          return c.json({ error: "Your chat could not be deleted. Please try again." }, 503);
        }
      },
    }),
  ];
}

export const conversationRoutes = createConversationRoutes();

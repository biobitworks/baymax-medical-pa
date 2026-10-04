import { registerApiRoute } from "@mastra/core/server";
import { z } from "zod";
import {
  MAX_UPLOAD_BYTES,
  addUpload,
  isSupportedUpload,
  listRecords,
  removeUpload,
} from "../lib/records";

const uploadBody = z.object({
  conversationId: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  content: z.string(),
});

const removeBody = z.object({
  conversationId: z.string().min(1).max(100),
  id: z.string().min(1).max(100),
});

/** Records endpoints: chat uploads become per-conversation artifacts. */
export const recordsRoutes = [
  registerApiRoute("/records", {
    method: "GET",
    handler: async (c) =>
      c.json({ records: await listRecords(c.req.query("conversationId")) }),
  }),

  registerApiRoute("/records/upload", {
    method: "POST",
    handler: async (c) => {
      const parsed = uploadBody.safeParse(await c.req.json().catch(() => ({})));
      if (!parsed.success) return c.json({ error: "Invalid upload" }, 400);
      const { conversationId, name, content } = parsed.data;
      if (!isSupportedUpload(name))
        return c.json({ error: "Only text files (txt, md, csv, json) are supported" }, 415);
      if (Buffer.byteLength(content) > MAX_UPLOAD_BYTES)
        return c.json({ error: "File is too large (200 KB max)" }, 413);
      return c.json({ record: await addUpload(conversationId, name, content) });
    },
  }),

  registerApiRoute("/records/remove", {
    method: "POST",
    handler: async (c) => {
      const parsed = removeBody.safeParse(await c.req.json().catch(() => ({})));
      if (!parsed.success) return c.json({ error: "Invalid request" }, 400);
      return c.json({ removed: await removeUpload(parsed.data.conversationId, parsed.data.id) });
    },
  }),
];

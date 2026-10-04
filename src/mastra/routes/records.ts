import { registerApiRoute } from "@mastra/core/server";
import { z } from "zod";
import {
  MAX_UPLOAD_BYTES,
  addUpload,
  isSupportedUpload,
  extOf,
  listRecords,
  removeUpload,
} from "../lib/records";
import { MAX_PDF_BYTES, pdfToText } from "../lib/pdf";

const uploadBody = z.object({
  conversationId: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  content: z.string().optional(),
  /** PDFs arrive base64-encoded; their text is extracted on the server. */
  contentBase64: z.string().optional(),
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
      const { conversationId, name, contentBase64 } = parsed.data;
      let content = parsed.data.content;
      if (!isSupportedUpload(name))
        return c.json({ error: "Only PDF and text files (pdf, txt, md, csv, json) are supported" }, 415);
      if (extOf(name) === ".pdf") {
        if (!contentBase64) return c.json({ error: "Invalid upload" }, 400);
        const bytes = Buffer.from(contentBase64, "base64");
        if (bytes.byteLength > MAX_PDF_BYTES) return c.json({ error: "PDF is too large (5 MB max)" }, 413);
        if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return c.json({ error: "That file is not a valid PDF" }, 400);
        try {
          content = await pdfToText(bytes);
        } catch {
          return c.json({ error: "Could not read that PDF" }, 422);
        }
        if (!content) return c.json({ error: "This PDF has no selectable text (scanned PDFs are not supported)" }, 422);
      }
      if (content === undefined) return c.json({ error: "Invalid upload" }, 400);
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

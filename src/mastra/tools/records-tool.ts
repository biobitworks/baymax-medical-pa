import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  MAX_READ_CHARS,
  listRecords,
  readRecord,
} from "../lib/records";

/** The chat client sends its conversation id as request context. */
function conversationIdOf(context?: {
  requestContext?: { get: (key: string) => unknown };
}): string | undefined {
  const id = context?.requestContext?.get("conversationId");
  return typeof id === "string" ? id : undefined;
}

export const listRecordsTool = createTool({
  id: "list-medical-records",
  description:
    "List the medical records available for the current user: the built-in health records (labs, vitals, conditions) plus any files the user uploaded in this conversation. Returns an id, name, format, and size for each. Call this when the user asks about their labs, vitals, results, or records, or mentions an attached file, then pass an id to read-medical-record.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    records: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        source: z.enum(["library", "upload"]),
        format: z.string(),
        sizeBytes: z.number(),
      }),
    ),
  }),
  execute: async (_input, context) => ({
    records: await listRecords(conversationIdOf(context)),
  }),
});

export const readRecordTool = createTool({
  id: "read-medical-record",
  description: `Read the contents of one medical record (by id from list-medical-records) into context. Large files are returned in chunks of up to ${MAX_READ_CHARS} characters; if truncated is true, call again with offset set to offset plus the length of the content returned. Only report what the record says. Never diagnose.`,
  inputSchema: z.object({
    id: z.string().describe("Record id, e.g. library:file.json or upload:ab12cd34"),
    offset: z.number().int().min(0).default(0).describe("Character offset to start from"),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    id: z.string(),
    name: z.string().optional(),
    format: z.string().optional(),
    totalChars: z.number().optional(),
    offset: z.number().optional(),
    truncated: z.boolean().optional(),
    content: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ id, offset }, context) => {
    const record = await readRecord(id, conversationIdOf(context), offset);
    if (!record)
      return {
        found: false,
        id,
        error: "Record not found. Call list-medical-records for valid ids.",
      };
    return { found: true, ...record };
  },
});

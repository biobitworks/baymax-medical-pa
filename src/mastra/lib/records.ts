import { type Ctx, dbOf, userIdOf } from "./demo-user";
import type { Query } from "../persistence/store";
import { type LabRow, rowsForFormat } from "./lab-parse";

/**
 * Medical records the agent can browse, stored in Postgres. Two sources share
 * one id space:
 *  - "library": the user's built-in records (seeded from data/synthetic)
 *  - "upload": files the user attached in chat, scoped to that conversation
 * Lab values in JSON and CSV records are also extracted into lab_results.
 */

export const MAX_UPLOAD_BYTES = 200_000;
export const MAX_READ_CHARS = 20_000;
export const TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".tsv", ".xml", ".log"];
export const UPLOAD_EXTENSIONS = [...TEXT_EXTENSIONS, ".pdf"];

export type RecordSource = "library" | "upload";

export interface RecordSummary {
  id: string;
  name: string;
  source: RecordSource;
  format: string;
  sizeBytes: number;
}

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

export function isSupportedUpload(name: string): boolean {
  return UPLOAD_EXTENSIONS.includes(extOf(name));
}

const summarize = (r: Record<string, unknown>): RecordSummary => ({
  id: String(r.id),
  name: String(r.name),
  source: r.source as RecordSource,
  format: String(r.format),
  sizeBytes: Number(r.size_bytes),
});

/** Inserts parsed lab rows for a record. Re-inserting the same rows is a no-op. */
export async function insertLabRows(q: Query, userId: string, recordId: string, rows: LabRow[]) {
  const chunk = 200;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const params: unknown[] = [userId, recordId];
    const values = part.map((r, n) => {
      const b = 2 + n * 9;
      params.push(r.panel ?? null, r.biomarker, r.unit, r.value, r.low ?? null, r.high ?? null, r.flag ?? null, r.notes ?? null, r.date);
      return `($1, $2, $${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}::date)`;
    });
    await q(
      `INSERT INTO lab_results (user_id, record_id, panel, biomarker, unit, value, reference_low, reference_high, flag, notes, measured_on)
       VALUES ${values.join(", ")} ON CONFLICT DO NOTHING`,
      params,
    );
  }
}

/** Stores a record and extracts its lab values. Used by uploads and seeding. */
export async function storeRecord(
  ctx: Ctx,
  rec: { id: string; name: string; source: RecordSource; content: string; conversationId?: string },
): Promise<RecordSummary> {
  const q = dbOf(ctx);
  const userId = userIdOf(ctx);
  const format = extOf(rec.name).slice(1) || "txt";
  const sizeBytes = Buffer.byteLength(rec.content);
  await q(
    `INSERT INTO records (user_id, id, name, source, format, content, size_bytes, conversation_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, id) DO UPDATE SET name = EXCLUDED.name, format = EXCLUDED.format, content = EXCLUDED.content, size_bytes = EXCLUDED.size_bytes`,
    [userId, rec.id, rec.name, rec.source, format, rec.content, sizeBytes, rec.conversationId ?? null],
  );
  await q("DELETE FROM lab_results WHERE user_id = $1 AND record_id = $2", [userId, rec.id]);
  await insertLabRows(q, userId, rec.id, rowsForFormat(format, rec.content));
  return { id: rec.id, name: rec.name, source: rec.source, format, sizeBytes };
}

export async function addUpload(
  conversationId: string,
  name: string,
  content: string,
  ctx: Ctx = {},
): Promise<RecordSummary> {
  const safeName = name.replace(/[\\/]/g, "_").slice(0, 120) || "upload.txt";
  const id = `upload:${crypto.randomUUID().slice(0, 8)}`;
  return storeRecord(ctx, { id, name: safeName, source: "upload", content, conversationId });
}

export async function removeUpload(conversationId: string, id: string, ctx: Ctx = {}): Promise<boolean> {
  const rows = await dbOf(ctx)(
    "DELETE FROM records WHERE user_id = $1 AND id = $2 AND source = 'upload' AND conversation_id = $3 RETURNING id",
    [userIdOf(ctx), id, conversationId],
  );
  return rows.length > 0;
}

export async function listRecords(conversationId?: string, ctx: Ctx = {}): Promise<RecordSummary[]> {
  const rows = await dbOf(ctx)(
    `SELECT id, name, source, format, size_bytes FROM records
     WHERE user_id = $1 AND (source = 'library' OR conversation_id = $2)
     ORDER BY source, name, created_at`,
    [userIdOf(ctx), conversationId ?? null],
  );
  return rows.map(summarize);
}

export interface RecordContent {
  id: string;
  name: string;
  format: string;
  totalChars: number;
  offset: number;
  truncated: boolean;
  content: string;
}

/** Full text of a record, or null if it does not exist for this user/conversation. */
export async function getRecordText(
  id: string,
  conversationId: string | undefined,
  ctx: Ctx = {},
): Promise<{ name: string; text: string } | null> {
  const [row] = await dbOf(ctx)(
    `SELECT name, content FROM records
     WHERE user_id = $1 AND id = $2 AND (source = 'library' OR conversation_id = $3)`,
    [userIdOf(ctx), id, conversationId ?? null],
  );
  return row ? { name: String(row.name), text: String(row.content) } : null;
}

export async function readRecord(
  id: string,
  conversationId: string | undefined,
  offset = 0,
  maxChars = MAX_READ_CHARS,
  ctx: Ctx = {},
): Promise<RecordContent | null> {
  const record = await getRecordText(id, conversationId, ctx);
  if (!record) return null;
  const { name, text } = record;
  const limit = Math.min(maxChars, MAX_READ_CHARS);
  const content = text.slice(offset, offset + limit);
  return {
    id,
    name,
    format: extOf(name).slice(1) || "txt",
    totalChars: text.length,
    offset,
    truncated: offset + content.length < text.length,
    content,
  };
}

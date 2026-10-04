import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Medical records the agent can browse. Two sources share one id space:
 *  - "library": built-in files under data/synthetic (the fake user's records)
 *  - "upload": files the user attached in chat, kept in memory per conversation
 */

export const MAX_UPLOAD_BYTES = 200_000;
export const MAX_READ_CHARS = 20_000;
const TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".tsv", ".xml", ".log"];

export type RecordSource = "library" | "upload";

export interface RecordSummary {
  id: string;
  name: string;
  source: RecordSource;
  format: string;
  sizeBytes: number;
}

interface Upload {
  id: string;
  name: string;
  content: string;
  uploadedAt: string;
}

const uploads = new Map<string, Map<string, Upload>>();

function dataDir(): string {
  if (process.env.RECORDS_DIR) return process.env.RECORDS_DIR;
  // The working directory varies (project root, .mastra/output, src/mastra/public),
  // so walk up until data/synthetic is found.
  let dir = process.cwd();
  while (true) {
    const candidate = resolve(dir, "data/synthetic");
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) return candidate;
    dir = parent;
  }
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

function libraryFiles(): RecordSummary[] {
  const dir = dataDir();
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => TEXT_EXTENSIONS.includes(extOf(f)))
    .sort()
    .map((f) => ({
      id: `library:${f}`,
      name: f,
      source: "library" as const,
      format: extOf(f).slice(1),
      sizeBytes: statSync(join(dir, f)).size,
    }));
}

export function isSupportedUpload(name: string): boolean {
  return TEXT_EXTENSIONS.includes(extOf(name));
}

export function addUpload(
  conversationId: string,
  name: string,
  content: string,
): RecordSummary {
  const safeName = name.replace(/[\\/]/g, "_").slice(0, 120) || "upload.txt";
  const bucket = uploads.get(conversationId) ?? new Map<string, Upload>();
  uploads.set(conversationId, bucket);
  const id = `upload:${crypto.randomUUID().slice(0, 8)}`;
  bucket.set(id, {
    id,
    name: safeName,
    content,
    uploadedAt: new Date().toISOString(),
  });
  return {
    id,
    name: safeName,
    source: "upload",
    format: extOf(safeName).slice(1) || "txt",
    sizeBytes: Buffer.byteLength(content),
  };
}

export function removeUpload(conversationId: string, id: string): boolean {
  return uploads.get(conversationId)?.delete(id) ?? false;
}

export function listRecords(conversationId?: string): RecordSummary[] {
  const bucket = conversationId ? uploads.get(conversationId) : undefined;
  const uploaded: RecordSummary[] = [...(bucket?.values() ?? [])].map((u) => ({
    id: u.id,
    name: u.name,
    source: "upload",
    format: extOf(u.name).slice(1) || "txt",
    sizeBytes: Buffer.byteLength(u.content),
  }));
  return [...libraryFiles(), ...uploaded];
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

/** Full text of a record, or null if it does not exist. */
export function getRecordText(
  id: string,
  conversationId: string | undefined,
): { name: string; text: string } | null {
  if (id.startsWith("upload:")) {
    const upload = conversationId ? uploads.get(conversationId)?.get(id) : undefined;
    return upload ? { name: upload.name, text: upload.content } : null;
  }
  if (id.startsWith("library:")) {
    // Only serve files that appear in the library listing (blocks traversal).
    const file = libraryFiles().find((f) => f.id === id);
    if (!file) return null;
    return { name: file.name, text: readFileSync(join(dataDir(), file.name), "utf8") };
  }
  return null;
}

export function readRecord(
  id: string,
  conversationId: string | undefined,
  offset = 0,
  maxChars = MAX_READ_CHARS,
): RecordContent | null {
  const record = getRecordText(id, conversationId);
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

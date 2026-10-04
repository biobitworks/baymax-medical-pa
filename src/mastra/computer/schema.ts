import { z } from 'zod';
const path = z.string().min(1).max(2048);
export const browserInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number().int().min(0).max(1279), y: z.number().int().min(0).max(799) }).strict(),
  z.object({ type: z.literal('type'), text: z.string().min(1).max(4000) }).strict(),
  z.object({ type: z.literal('key'), key: z.string().min(1).max(80) }).strict(),
  z.object({ type: z.literal('scroll'), deltaY: z.number().int().min(-5000).max(5000) }).strict(),
]);
export const computerActionSchema = z.discriminatedUnion('action', [
  z.object({action: z.enum(['start', 'stop', 'browser-read', 'browser-close'])}).strict(),
  z.object({ action: z.literal('command'), command: z.string().trim().min(1).max(16000), cwd: path.default('/workspace'), operationId: z.string().min(1).max(120) }).strict(),
  z.object({action: z.enum(['list', 'read', 'mkdir']), path}).strict(),
  z.object({ action: z.literal('write'), path, text: z.string().max(256 * 1024).refine(text => Buffer.byteLength(text) <= 256 * 1024, 'File exceeds 256 KiB') }).strict(),
  z.object({ action: z.literal('browse'), url: z.string().url().max(8192) }).strict(),
  z.object({ action: z.literal('browser-input'), input: browserInputSchema }).strict(),
]);
export type ComputerAction = z.infer<typeof computerActionSchema>;

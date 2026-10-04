import { z } from 'zod';

export const planSchema = z.object({
  title: z.string().min(1).max(500),
  startDate: z.string().max(30).optional(),
  items: z.array(z.object({ label: z.string().min(1).max(500), when: z.string().max(200).optional(), done: z.boolean() })).min(1).max(12),
});
export const briefSchema = z.object({ brief: z.string().max(30_000), needsReview: z.literal(true) });
const messageSchema = z.object({
  id: z.string().min(1).max(200),
  role: z.enum(['user', 'assistant', 'system']),
  createdAt: z.iso.datetime(),
  content: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), text: z.string().max(60_000) }).passthrough(),
    z.object({ type: z.literal('tool-call'), toolCallId: z.string().max(200), toolName: z.string().max(200), args: z.unknown(), argsText: z.string().max(60_000).optional(), result: z.unknown().optional() }).passthrough(),
  ])).max(30),
}).passthrough();
export const conversationSchema = z.object({
  headId: z.string().nullable().optional(),
  messages: z.array(z.object({ message: messageSchema, parentId: z.string().nullable(), runConfig: z.record(z.string(), z.unknown()).optional() })).max(500),
}).superRefine((repository, ctx) => {
  const ids = new Set<string>();
  for (const item of repository.messages) {
    if (ids.has(item.message.id) || (item.parentId !== null && !ids.has(item.parentId))) {
      ctx.addIssue({ code: 'custom', message: 'Invalid conversation tree' });
    }
    ids.add(item.message.id);
  }
  if (repository.headId && !ids.has(repository.headId)) ctx.addIssue({ code: 'custom', message: 'Invalid conversation head' });
});
export const workspaceSchema = z.object({
  version: z.literal(1), remember: z.boolean(), ready: z.boolean(),
  name: z.string().max(30), energy: z.enum(['', 'Low', 'Okay', 'Good', 'Great']),
  done: z.array(z.string().max(500)).max(200), water: z.number().int().min(0).max(8),
  reminders: z.boolean(), nudge: z.enum(['Gentle', 'A little persistent', 'Only when I ask']),
  tripReady: z.boolean().default(false), checklist: z.array(z.string().max(500)).max(50).default([]),
  city: z.string().max(500), travelDate: z.string().max(30), date: z.string().max(30), goal: z.string().max(500),
  planItems: planSchema.shape.items,
  activePlanId: z.string().max(200).nullable().default(null), activeBriefId: z.string().max(200).nullable().default(null),
  brief: z.string().max(30_000), recipient: z.string().max(320), subject: z.string().max(500),
  conversation: conversationSchema,
});
export type CareWorkspace = z.infer<typeof workspaceSchema>;
export type StoredConversation = CareWorkspace['conversation'];
export function createWorkspace(): CareWorkspace {
  return {
    version: 1, remember: false, ready: false, name: 'Alex', energy: '', done: [], water: 3,
    tripReady: false, checklist: [], reminders: true, nudge: 'Gentle', city: 'San Francisco', travelDate: '2026-10-09', date: '2026-10-10', goal: 'Build Personal Agents Hackathon',
    planItems: ['Take a 10-minute walk', 'Make time for a real meal', 'Pack medication documents', 'Set a wind-down reminder', 'Schedule your next routine checkup'].map(label => ({ label, done: false })),
    brief: 'MY HEALTH BRIEF — review and complete before sharing\n\nPatient: [Your name]\nReason for visit: Establishing care while travelling.\nMedications: [Add your prescribed medication and dose.]\nAllergies: Not yet confirmed.\nRelevant history: Not yet confirmed.\nQuestions: What records do you need? How can I arrange follow-up care?',
    activePlanId: null, activeBriefId: null, recipient: '', subject: 'My health brief for our appointment', conversation: { messages: [], headId: null },
  };
}

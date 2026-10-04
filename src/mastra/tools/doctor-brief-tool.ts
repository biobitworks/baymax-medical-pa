import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { formatDoctorBrief } from "../lib/brief";

/**
 * Drafts a doctor brief from information the user has chosen to share.
 * Nothing is sent anywhere; the user reviews and edits the draft in the UI.
 */
export const doctorBriefTool = createTool({
  id: "draft-doctor-brief",
  description:
    "Draft a concise health brief for a new doctor from details the user has provided. Before drafting, call get-user-info, get-recent-checkins, and get-daily-metrics, and if they show a meaningful trend (e.g. repeated low energy, low water intake, little movement, short sleep), include it in 'history' as a factual observation with numbers and timeframe (e.g. 'Reported low energy in 6 of the last 7 check-ins; averaging ~900 ml water/day'). Also add a related question for the doctor in 'questions'. Only include trend data that is supported by the tools, and tell the user what you included so they can edit it. Use placeholders such as [Add dose] for anything the user has not confirmed. Never invent medical facts or diagnose. The user must review before sharing.",
  inputSchema: z.object({
    reason: z.string().describe("Reason for the visit"),
    medications: z.array(z.string()).default([]),
    allergies: z.array(z.string()).default([]),
    history: z.array(z.string()).default([]),
    questions: z.array(z.string()).default([]),
  }),
  outputSchema: z.object({
    brief: z.string(),
    needsReview: z.literal(true),
  }),
  execute: async (input) => ({
    brief: formatDoctorBrief(input),
    needsReview: true as const,
  }),
});

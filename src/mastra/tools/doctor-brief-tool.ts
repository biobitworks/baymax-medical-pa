import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Drafts a doctor brief from information the user has chosen to share.
 * Nothing is sent anywhere; the user reviews and edits the draft in the UI.
 */
export const doctorBriefTool = createTool({
  id: "draft-doctor-brief",
  description:
    "Draft a concise health brief for a new doctor from details the user has provided. Use placeholders such as [Add dose] for anything the user has not confirmed. Never invent medical facts. The user must review before sharing.",
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
  execute: async ({ reason, medications, allergies, history, questions }) => {
    const list = (items: string[], fallback: string) =>
      items.length ? items.map((i) => `- ${i}`).join("\n") : fallback;

    const brief = [
      "MY HEALTH BRIEF (review and complete before sharing)",
      "",
      `Reason for visit: ${reason}`,
      "",
      "Medications:",
      list(medications, "- [Add your prescribed medication and dose.]"),
      "",
      "Allergies:",
      list(allergies, "- Not yet confirmed."),
      "",
      "Relevant history:",
      list(history, "- Not yet confirmed."),
      "",
      "Questions for the doctor:",
      list(questions, "- What records do you need?"),
    ].join("\n");

    return { brief, needsReview: true as const };
  },
});

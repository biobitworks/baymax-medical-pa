import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const carePlanItem = z.object({
  label: z.string().describe("A short, achievable task"),
  when: z
    .string()
    .optional()
    .describe("Day or time, e.g. 'Mon morning' or 'Daily 8am'"),
});

/**
 * Structured care plan. The model supplies the content; the tool validates the
 * shape so the frontend can render it as an editable card.
 */
export const carePlanTool = createTool({
  id: "create-care-plan",
  description:
    "Create an editable care plan or preparation checklist (e.g. preparing for a hackathon or a trip). Use for habits, reminders, sleep, meals, hydration, and movement. Never include medication dosing changes.",
  inputSchema: z.object({
    title: z.string().describe("Plan title, e.g. 'Hackathon prep'"),
    startDate: z.string().optional().describe("ISO date the plan starts"),
    items: z.array(carePlanItem).min(1).max(12),
  }),
  outputSchema: z.object({
    title: z.string(),
    startDate: z.string().optional(),
    items: z.array(carePlanItem.extend({ done: z.boolean() })),
  }),
  execute: async ({ title, startDate, items }) => ({
    title,
    startDate,
    items: items.map((item) => ({ ...item, done: false })),
  }),
});

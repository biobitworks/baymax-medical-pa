import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  ENERGY_LEVELS,
  getRecentCheckins,
  summarizeCheckins,
} from "../lib/health-data";

/**
 * Reads the user's daily "How's your energy?" check-ins (Low / Okay / Good /
 * Great). Hardcoded sample data for now.
 */
export const recentCheckinsTool = createTool({
  id: "get-recent-checkins",
  description:
    "Get the user's most recent daily energy check-ins (the 'How's your energy?' prompt with Low, Okay, Good, Great answers), newest first, plus a summary of any pattern such as repeated low energy. Call this to spot trends in how the user has been feeling BEFORE creating a care plan or drafting a doctor brief, and whenever the user mentions being tired, drained, or unwell. Pair it with get-daily-metrics to look for causes (e.g. low energy alongside low water or sleep). Report trends as observations to discuss, never as diagnoses.",
  inputSchema: z.object({
    count: z
      .number()
      .int()
      .min(1)
      .max(30)
      .default(7)
      .describe("How many of the most recent check-ins to return (X)"),
  }),
  outputSchema: z.object({
    checkins: z.array(
      z.object({
        date: z.string().describe("YYYY-MM-DD"),
        energy: z.enum(ENERGY_LEVELS),
        note: z.string().optional(),
      }),
    ),
    summary: z.object({
      total: z.number(),
      counts: z.record(z.string(), z.number()),
      averageEnergyScore: z.number(),
      scale: z.string(),
      observations: z.array(z.string()),
    }),
  }),
  execute: async ({ count }) => {
    const checkins = getRecentCheckins(count);
    return { checkins, summary: summarizeCheckins(checkins) };
  },
});

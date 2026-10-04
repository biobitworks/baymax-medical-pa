import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getRecentRuns, summarizeRuns } from "../lib/health-data";

/**
 * Reads the user's recent runs (distance and time). Stored in Postgres per user.
 */
export const recentRunsTool = createTool({
  id: "get-recent-runs",
  description:
    "Get the user's most recent runs (distance in miles, duration in minutes, pace in min/mi), newest first, with totals, average pace, how long since the last run, and plain-language observations. Call this when the user asks about running, exercise, or fitness, and BEFORE creating a care plan (so any running goals build gently on what they actually do) or drafting a doctor brief (so activity level can be offered as optional context). Pair it with get-daily-metrics and get-recent-checkins to see how running lines up with energy, sleep, and hydration. Suggest small, gradual progressions only, and report trends as observations, never as diagnoses.",
  inputSchema: z.object({
    count: z
      .number()
      .int()
      .min(1)
      .max(30)
      .default(5)
      .describe("How many of the most recent runs to return"),
  }),
  outputSchema: z.object({
    runs: z.array(
      z.object({
        date: z.string().describe("YYYY-MM-DD"),
        distanceMi: z.number(),
        durationMin: z.number(),
        paceMinPerMi: z.number(),
        note: z.string().optional(),
      }),
    ),
    summary: z.object({
      total: z.number(),
      totalMiles: z.number(),
      totalMinutes: z.number(),
      averagePaceMinPerMi: z.number(),
      longestMi: z.number(),
      daysSinceLastRun: z.number().nullable(),
      runsPerWeek: z.number().nullable(),
      observations: z.array(z.string()),
    }),
  }),
  execute: async ({ count }) => {
    const runs = await getRecentRuns(count);
    return { runs, summary: summarizeRuns(runs) };
  },
});

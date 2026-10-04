import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getRecentMetrics, summarizeMetrics } from "../lib/health-data";

/**
 * Reads the user's daily movement, hydration, and sleep data. Hardcoded sample
 * data for now.
 */
export const dailyMetricsTool = createTool({
  id: "get-daily-metrics",
  description:
    "Get the user's daily movement (steps, active minutes), hydration (ml of water), and sleep (hours) for the last N days, newest first, with averages, days below general wellness targets, and plain-language observations. Call this to identify habit trends BEFORE creating a care plan (so the plan targets real gaps like low water or little movement) and before drafting a doctor brief (so relevant patterns can be offered as optional context). Pair it with get-recent-checkins to see whether low energy lines up with these habits. Report trends as observations to discuss, never as diagnoses.",
  inputSchema: z.object({
    days: z
      .number()
      .int()
      .min(1)
      .max(30)
      .default(7)
      .describe("How many of the most recent days to return (Y)"),
  }),
  outputSchema: z.object({
    daily: z.array(
      z.object({
        date: z.string().describe("YYYY-MM-DD"),
        steps: z.number(),
        activeMinutes: z.number(),
        hydrationMl: z.number(),
        sleepHours: z.number(),
      }),
    ),
    summary: z.object({
      days: z.number(),
      averages: z.object({
        steps: z.number(),
        activeMinutes: z.number(),
        hydrationMl: z.number(),
        sleepHours: z.number(),
      }),
      daysBelowTarget: z.object({
        hydration: z.number(),
        steps: z.number(),
        activeMinutes: z.number(),
        sleep: z.number(),
      }),
      targets: z.object({
        hydrationMl: z.number(),
        steps: z.number(),
        activeMinutes: z.number(),
        sleepHours: z.number(),
      }),
      observations: z.array(z.string()),
    }),
  }),
  execute: async ({ days }) => {
    const daily = getRecentMetrics(days);
    return { daily, summary: summarizeMetrics(daily) };
  },
});

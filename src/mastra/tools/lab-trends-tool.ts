import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { queryLabSeries } from "../lib/labs";

const pointSchema = z.object({
  date: z.string().describe("YYYY-MM-DD"),
  value: z.number(),
});

const seriesSchema = z.object({
  biomarker: z.string(),
  unit: z.string().default(""),
  panel: z.string().optional(),
  referenceLow: z.number().optional(),
  referenceHigh: z.number().optional(),
  points: z.array(pointSchema).describe("Measurements over time"),
});

/**
 * Generative UI tool: the app renders its result as a chart card. The agent
 * chooses what to plot (biomarkers or a panel, plus a time window); the data is
 * pulled from the user's records, or supplied directly as `series`.
 */
export const labTrendsTool = createTool({
  id: "show-lab-trends",
  description:
    "Show the user a chart card of bloodwork trends over time. The app draws one line chart per biomarker with its reference range shaded and the change since the first result. Use it whenever the user asks to see, graph, chart, plot or compare labs or how a result has changed. Choose what to plot with `biomarkers` (e.g. ['HbA1c','Glucose']) or `panel` (e.g. 'lipid'); optionally narrow with `since`. Results are looked up from the built-in records and files attached in this chat. If you already read values from a record that is not in that format, pass them as `series` instead. If nothing matches, the result lists `available` biomarkers so you can retry. After the card shows, add one or two sentences on the trend. Describe it, never diagnose.",
  inputSchema: z.object({
    title: z.string().optional().describe("Card title, e.g. 'Blood sugar over time'"),
    biomarkers: z.array(z.string()).optional().describe("Biomarker names to plot"),
    panel: z.string().optional().describe("Also plot every biomarker in a panel whose name contains this text. Combined with `biomarkers`"),
    since: z.string().optional().describe("Only include results on or after YYYY-MM-DD"),
    series: z.array(seriesSchema).optional().describe("Explicit data to plot instead of looking it up"),
  }),
  outputSchema: z.object({
    title: z.string(),
    series: z.array(seriesSchema),
    unmatched: z.array(z.string()),
    available: z.array(z.string()),
  }),
  execute: async ({ title, biomarkers, panel, since, series }, context) => {
    const id = context?.requestContext?.get("conversationId");
    const conversationId = typeof id === "string" ? id : undefined;
    if (series?.length) {
      return {
        title: title ?? "Lab trends",
        series: series.map((s) => ({
          ...s,
          points: [...s.points].sort((a, b) => a.date.localeCompare(b.date)),
        })),
        unmatched: [],
        available: [],
      };
    }
    const found = queryLabSeries({ biomarkers, panel, since }, conversationId);
    return {
      title:
        title ??
        (panel ? `${panel} trends` : biomarkers?.length ? `${biomarkers.join(", ")} over time` : "Lab trends"),
      series: found.series.map((s) => ({ ...s, unit: s.unit })),
      unmatched: found.unmatched,
      available: found.series.length ? [] : found.available,
    };
  },
});

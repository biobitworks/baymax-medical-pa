import { registerApiRoute } from "@mastra/core/server";
import { z } from "zod";
import {
  ENERGY_LEVELS,
  addHydration,
  getRecentCheckins,
  getRecentMetrics,
  getRecentRuns,
  saveCheckin,
  saveRun,
  summarizeCheckins,
  summarizeMetrics,
  summarizeRuns,
} from "../lib/health-data";

import { buildFitnessOverview, getFitnessPreferences, goalsSchema, preferencesSchema, saveActivityGoals, saveFitnessPreferences } from "../lib/fitness";

const checkinBody = z.object({
  energy: z.enum(ENERGY_LEVELS),
  note: z.string().trim().max(200).optional(),
});

const waterBody = z.object({
  ml: z.number().int().min(50).max(1000).default(250),
});

const runBody = z.object({
  distanceMi: z.number().min(0.1).max(100),
  durationMin: z.number().min(1).max(1000),
  note: z.string().trim().max(200).optional(),
});

/**
 * Health data endpoints for the app. They read and write the same store the
 * agent tools use, so the agent always sees what the user sees.
 */
export const healthRoutes = [
  registerApiRoute("/health/fitness", {
    method: "GET",
    handler: async (c) => c.json({
      ...buildFitnessOverview(getRecentMetrics(7), getFitnessPreferences().goals),
      preferences: getFitnessPreferences(), source: "demo",
    }),
  }),
  registerApiRoute("/health/preferences", {
    method: "GET",
    handler: async (c) => c.json(getFitnessPreferences()),
  }),
  registerApiRoute("/health/preferences", {
    method: "POST",
    handler: async (c) => {
      const parsed = preferencesSchema.safeParse(await c.req.json().catch(() => ({})));
      if (!parsed.success) return c.json({ error: "Invalid preferences" }, 400);
      return c.json(saveFitnessPreferences(parsed.data));
    },
  }),
  registerApiRoute("/health/goals", {
    method: "POST",
    handler: async (c) => {
      const parsed = goalsSchema.safeParse(await c.req.json().catch(() => ({})));
      if (!parsed.success) return c.json({ error: "Invalid activity goals" }, 400);
      return c.json(saveActivityGoals(parsed.data));
    },
  }),
  registerApiRoute("/health/overview", {
    method: "GET",
    handler: async (c) => {
      const days = Math.min(30, Math.max(1, Number(c.req.query("days")) || 7));
      const metrics = getRecentMetrics(days);
      const checkins = getRecentCheckins(days);
      return c.json({
        today: metrics[0],
        todayCheckin: checkins[0]?.date === metrics[0].date ? checkins[0] : null,
        metrics,
        checkins,
        metricsSummary: summarizeMetrics(metrics),
        checkinsSummary: summarizeCheckins(checkins),
      });
    },
  }),

  registerApiRoute("/health/checkin", {
    method: "POST",
    handler: async (c) => {
      const parsed = checkinBody.safeParse(await c.req.json().catch(() => ({})));
      if (!parsed.success) return c.json({ error: "Invalid check-in" }, 400);
      return c.json({ checkin: saveCheckin(parsed.data.energy, parsed.data.note) });
    },
  }),

  registerApiRoute("/health/water", {
    method: "POST",
    handler: async (c) => {
      const parsed = waterBody.safeParse(await c.req.json().catch(() => ({})));
      if (!parsed.success) return c.json({ error: "Invalid amount" }, 400);
      return c.json({ today: addHydration(parsed.data.ml) });
    },
  }),

  registerApiRoute("/health/runs", {
    method: "GET",
    handler: async (c) => {
      const count = Math.min(30, Math.max(1, Number(c.req.query("count")) || 10));
      const runs = getRecentRuns(count);
      return c.json({ runs, summary: summarizeRuns(runs) });
    },
  }),

  registerApiRoute("/health/runs", {
    method: "POST",
    handler: async (c) => {
      const parsed = runBody.safeParse(await c.req.json().catch(() => ({})));
      if (!parsed.success) return c.json({ error: "Invalid run" }, 400);
      const { distanceMi, durationMin, note } = parsed.data;
      return c.json({ run: saveRun(distanceMi, durationMin, note) });
    },
  }),
];

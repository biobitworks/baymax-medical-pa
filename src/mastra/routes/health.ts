import { registerApiRoute } from "@mastra/core/server";
import { z } from "zod";
import {
  ENERGY_LEVELS,
  addHydration,
  getRecentCheckins,
  getRecentMetrics,
  saveCheckin,
  summarizeCheckins,
  summarizeMetrics,
} from "../lib/health-data";

const checkinBody = z.object({
  energy: z.enum(ENERGY_LEVELS),
  note: z.string().trim().max(200).optional(),
});

const waterBody = z.object({
  ml: z.number().int().min(50).max(1000).default(250),
});

/**
 * Health data endpoints for the app. They read and write the same store the
 * agent tools use, so the agent always sees what the user sees.
 */
export const healthRoutes = [
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
];

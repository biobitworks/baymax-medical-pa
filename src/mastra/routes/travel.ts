import { registerApiRoute } from "@mastra/core/server";
import { z } from "zod";
import {
  DEFAULT_TRAVEL_CHECKLIST,
  formatDoctorBrief,
} from "../lib/brief";

const tripSchema = z.object({
  destination: z.string().trim().min(1).max(120),
  departureDate: z.string().trim().max(40).optional(),
  checklist: z.array(z.string().max(200)).max(12).optional(),
});

const checklistOutput = z.object({
  items: z.array(z.string()).min(3).max(6),
});

const briefOutput = z.object({
  reason: z.string(),
  questions: z.array(z.string()).min(2).max(6),
});

const tripLine = (t: z.infer<typeof tripSchema>) =>
  `Destination: ${t.destination}. Departure date: ${t.departureDate || "not set"}.`;

/**
 * Travel flow endpoints. Both ask the Baymax agent for structured content and
 * degrade to safe defaults if the model is unavailable.
 */
export const travelRoutes = [
  registerApiRoute("/travel/checklist", {
    method: "POST",
    handler: async (c) => {
      const parsed = tripSchema.safeParse(await c.req.json().catch(() => ({})));
      if (!parsed.success) return c.json({ error: "Invalid trip details" }, 400);
      try {
        const agent = c.get("mastra").getAgent("baymaxAgent");
        const res = await agent.generate(
          `${tripLine(parsed.data)}
Write a medication travel checklist of 4 to 5 short, actionable items (max 12 words each) for someone continuing existing prescriptions on this trip. Tailor timing to the departure date. Do not diagnose, prescribe, suggest substitutions, or change doses. The last item must be exactly "Prepare a doctor brief".`,
          {
            structuredOutput: { schema: checklistOutput, jsonPromptInjection: true },
          },
        );
        const items = checklistOutput.parse(res.object).items;
        return c.json({ items, source: "agent" });
      } catch (err) {
        console.warn("travel checklist fallback", err);
        return c.json({ items: DEFAULT_TRAVEL_CHECKLIST, source: "fallback" });
      }
    },
  }),

  registerApiRoute("/travel/brief", {
    method: "POST",
    handler: async (c) => {
      const parsed = tripSchema.safeParse(await c.req.json().catch(() => ({})));
      if (!parsed.success) return c.json({ error: "Invalid trip details" }, 400);
      const trip = parsed.data;
      const fallback = {
        reason: `Establishing care while travelling to ${trip.destination}.`,
        questions: [
          "What records do you need from me?",
          "How can I arrange follow-up care while I am away?",
        ],
      };
      let draft = fallback;
      let source = "fallback";
      try {
        const agent = c.get("mastra").getAgent("baymaxAgent");
        const res = await agent.generate(
          `${tripLine(trip)}
Checklist items the user is working through: ${(trip.checklist ?? []).join("; ") || "none"}.
Draft the reason for visit and 3 to 5 practical questions for a doctor or pharmacist about continuing existing medication while travelling. Use only the details above. Do not invent medications, doses, allergies, or history.`,
          {
            structuredOutput: { schema: briefOutput, jsonPromptInjection: true },
          },
        );
        draft = briefOutput.parse(res.object);
        source = "agent";
      } catch (err) {
        console.warn("travel brief fallback", err);
      }
      // Medications, allergies, and history stay as placeholders until the
      // user confirms them.
      return c.json({ brief: formatDoctorBrief(draft), source });
    },
  }),
];

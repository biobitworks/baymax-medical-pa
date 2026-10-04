import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { formatDoctorBrief } from "../lib/brief";
import { buildBriefContext, contextSections } from "../lib/brief-context";

const sourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  domain: z.string(),
  publishedDate: z.string().nullable(),
  summary: z.string(),
});

const unique = (items: string[]) => [...new Set(items.map((i) => i.trim()).filter(Boolean))];

/**
 * Drafts a doctor brief. Server-side it pulls the user's profile, energy
 * check-ins, activity data and flagged labs from Postgres, and runs live Exa
 * searches for travel advisories and destination details, so every brief
 * carries them. Nothing is sent anywhere; the user reviews and edits it.
 */
export const doctorBriefTool = createTool({
  id: "draft-doctor-brief",
  description:
    "Draft a health brief for a doctor. ALWAYS pass `destination` (city, country) and `departureDate` when the user is travelling, or ask once if unknown. The tool itself loads the user's medications, allergies, conditions, energy check-ins, activity/sleep/water data, runs and flagged labs from the database, and runs live Exa web searches for current CDC travel health notices, Australia's Smartraveller advice, travel restrictions and destination-city details, then appends those as sections. So: (1) first call get-user-info, get-recent-checkins, get-daily-metrics and get-recent-runs yourself to understand the trends; (2) put only the visit-specific story in `reason`, `history` (e.g. a short factual note about what the trends mean for this trip) and `questions` (include questions that follow from the advisories and city, such as vaccines, altitude, air quality, medication import rules, and energy or sleep concerns); (3) do not repeat the raw numbers or advisories in `history`, since the tool adds them. Use placeholders such as [Add dose] for anything the user has not confirmed. Never invent medical facts or diagnose. After the tool returns, tell the user which advisories and data were included and that they must review before sharing.",
  inputSchema: z.object({
    reason: z.string().describe("Reason for the visit"),
    destination: z.string().max(120).optional().describe("Travel destination, e.g. 'Denver, USA'. Used for web research on advisories and city details."),
    departureDate: z.string().max(40).optional(),
    medications: z.array(z.string()).default([]),
    allergies: z.array(z.string()).default([]),
    history: z.array(z.string()).default([]),
    questions: z.array(z.string()).default([]),
  }),
  outputSchema: z.object({
    brief: z.string(),
    needsReview: z.literal(true),
    destination: z.string().optional(),
    advisories: z.array(sourceSchema),
    smartraveller: z.array(sourceSchema),
    cityDetails: z.array(sourceSchema),
    advisoriesError: z.string().optional(),
    dataSources: z.array(z.string()),
  }),
  execute: async ({ destination, departureDate, ...input }, context) => {
    const ctx = await buildBriefContext({ destination, departureDate }, context, context?.abortSignal);
    const p = ctx.profile;
    const brief = formatDoctorBrief({
      ...input,
      medications: unique([...input.medications, ...(p?.medications ?? [])]),
      allergies: unique([...input.allergies, ...(p?.allergies ?? [])]),
      history: unique([
        ...(p?.conditions.length ? [`Conditions: ${p.conditions.join(", ")}`] : []),
        ...input.history,
      ]),
      extraSections: contextSections(ctx),
    });
    return {
      brief,
      needsReview: true as const,
      ...(ctx.destination ? { destination: ctx.destination } : {}),
      advisories: ctx.advisories.sources,
      smartraveller: ctx.smartraveller.sources,
      cityDetails: ctx.cityDetails?.sources ?? [],
      ...(ctx.advisories.error ? { advisoriesError: ctx.advisories.error } : {}),
      dataSources: [
        ...(p ? ["Profile and medications (Postgres)"] : []),
        ...(ctx.wellness ? ["Energy check-ins, activity and runs (Postgres)"] : []),
        ...(ctx.labs.length ? ["Flagged labs (Postgres)"] : []),
        ...(ctx.advisories.sources.length ? ["Travel advisories (Exa web search)"] : []),
        ...(ctx.smartraveller.sources.length ? ["Smartraveller advice (Exa web search)"] : []),
        ...(ctx.cityDetails?.sources.length ? [`${ctx.destination} details (Exa web search)`] : []),
      ],
    };
  },
});

import { getFitnessOverview } from "../lib/fitness-data";
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getFitnessPreferences } from '../lib/fitness';

export const fitnessOverviewTool = createTool({
  id: 'get-fitness-overview',
  description: 'Open the interactive fitness dashboard with daily step and active-minute rings, saved goals, and seven-day progress. Use for fitness, movement progress, activity goals, or changing goals. These are demo metrics, not device measurements. The user can edit goals in the card; never claim goals were changed by reading this tool.',
  inputSchema: z.object({}),
  execute: async () => ({
    ...await getFitnessOverview(),
    source: 'demo',
  }),
});
export const onboardingTool = createTool({
  id: 'start-activity-onboarding',
  description: 'Show interactive onboarding to introduce movement tracking, explain active minutes, choose daily goals, and optionally enable browser notifications. Use when the user asks to get started, set up fitness, or redo onboarding. This only opens the form; the user confirms and saves their own preferences.',
  inputSchema: z.object({}),
  execute: async () => ({ preferences: getFitnessPreferences() }),
});

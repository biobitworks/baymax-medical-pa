import { z } from 'zod';

export const goalsSchema = z.object({
  steps: z.number().int().min(1000).max(30000),
  activeMinutes: z.number().int().min(5).max(180),
});
export const preferencesSchema = z.object({
  name: z.string().trim().min(1).max(30),
  goals: goalsSchema,
  notifications: z.enum(['off', 'enabled', 'unavailable']),
});
export type ActivityGoals = z.infer<typeof goalsSchema>;
export type FitnessPreferences = z.infer<typeof preferencesSchema>;
export type MovementDay = { date: string; steps: number; activeMinutes: number };

// Same single-user, in-memory demo store as health-data. Resets on server restart.
let preferences: FitnessPreferences = {
  name: 'Jordan', goals: { steps: 5000, activeMinutes: 20 }, notifications: 'off',
};
let onboarded = false;
export const getFitnessPreferences = () => ({ ...preferences, goals: { ...preferences.goals }, onboarded });
export function saveFitnessPreferences(input: FitnessPreferences) {
  preferences = preferencesSchema.parse(input);
  onboarded = true;
  return getFitnessPreferences();
}
export function saveActivityGoals(input: ActivityGoals) {
  preferences.goals = goalsSchema.parse(input);
  return getFitnessPreferences();
}
export function buildFitnessOverview(metrics: MovementDay[], goals: ActivityGoals) {
  const daily = metrics.slice(0, 7).map(day => ({
    date: day.date, steps: day.steps, activeMinutes: day.activeMinutes, achieved: day.steps >= goals.steps && day.activeMinutes >= goals.activeMinutes,
  }));
  return {
    today: daily.length ? daily[0] : null,
    daily,
    goals,
    achievedDays: daily.filter(day => day.achieved).length,
    weeklyMinutes: daily.reduce((total, day) => total + day.activeMinutes, 0),
    weeklyTarget: goals.activeMinutes * 7,
  };
}
export type FitnessOverview = ReturnType<typeof buildFitnessOverview>;

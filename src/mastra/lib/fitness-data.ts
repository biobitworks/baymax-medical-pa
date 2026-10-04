import { getRecentMetrics, getToday } from './health-data';
import { buildFitnessOverview } from './fitness';
import { getFitnessPreferences } from './fitness-store';
import { importedHealth } from './health-reader';

type HealthContext = Parameters<typeof importedHealth>[0];

/**
 * Movement progress for the dashboard. Uses paired Apple Health readings when a
 * phone is connected, otherwise the Postgres demo metrics.
 */
export async function getFitnessOverview(context?: HealthContext) {
  const [health, preferences] = await Promise.all([importedHealth(context, 7), getFitnessPreferences()]);
  if (health.connected) {
    const daily = health.daily.map(day => ({ date: day.date, steps: day.steps ?? 0, activeMinutes: day.activeMinutes ?? 0 }));
    return { ...buildFitnessOverview(daily, preferences.goals), source: 'apple_health' as const, lastSyncAt: health.lastSyncAt };
  }
  const [history, today] = await Promise.all([getRecentMetrics(7), getToday()]);
  const daily = [today, ...history.filter(day => day.date !== today.date)].slice(0, 7);
  return { ...buildFitnessOverview(daily, preferences.goals), source: 'demo' as const, lastSyncAt: null };
}

import { getRecentMetrics, getToday } from './health-data';
import { buildFitnessOverview } from './fitness';
import { getFitnessPreferences } from './fitness-store';

/** Use the same Postgres activity history as the rest of the demo app. */
export async function getFitnessOverview() {
  const [history, today, preferences] = await Promise.all([getRecentMetrics(7), getToday(), getFitnessPreferences()]);
  const daily = [today, ...history.filter(day => day.date !== today.date)].slice(0, 7);
  return buildFitnessOverview(daily, preferences.goals);
}

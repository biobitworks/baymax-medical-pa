import { getRecentMetrics, getToday } from './health-data';
import { buildFitnessOverview, getFitnessPreferences } from './fitness';

/** Use the same Postgres activity history as the rest of the demo app. */
export async function getFitnessOverview() {
  const [history, today] = await Promise.all([getRecentMetrics(7), getToday()]);
  const daily = [today, ...history.filter(day => day.date !== today.date)].slice(0, 7);
  return buildFitnessOverview(daily, getFitnessPreferences().goals);
}

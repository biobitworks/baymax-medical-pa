import { ENERGY_LEVELS, type EnergyLevel } from "../lib/health-data";

/**
 * Deterministic sample habit data for the demo user, generated relative to a
 * given "today" so it always looks fresh when (re)seeded. A reasonably unfit
 * person who drinks little water and regularly reports low energy.
 */
export const HISTORY_DAYS = 30;

const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const round = (n: number, step: number) => Math.round(n / step) * step;

export function isoDateFrom(today: Date, daysAgo: number) {
  const d = new Date(today);
  d.setDate(d.getDate() - daysAgo);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface SeedMetric { date: string; steps: number; activeMinutes: number; hydrationMl: number; sleepHours: number }
export interface SeedCheckin { date: string; energy: EnergyLevel; note?: string }
export interface SeedRun { date: string; distanceMi: number; durationMin: number; note?: string }

export function buildMetrics(today: Date): SeedMetric[] {
  return Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const date = isoDateFrom(today, i);
    const weekend = [0, 6].includes(new Date(date + "T12:00:00").getDay());
    return {
      date,
      steps: round(2200 + rand(i + 1) * 2600 + (weekend ? 300 : 0), 50),
      activeMinutes: Math.round(4 + rand(i + 50) * 20),
      hydrationMl: round(650 + rand(i + 100) * 850, 50),
      sleepHours: Math.round((5.4 + rand(i + 150) * 1.6) * 10) / 10,
    };
  });
}

const NOTES: Record<EnergyLevel, string[]> = {
  low: [
    "Dragging all afternoon.",
    "Headache and foggy by lunch.",
    "Couldn't focus, wanted a nap.",
    "Tired even after sleeping in.",
  ],
  okay: ["Fine, nothing special.", "Slow start but got better."],
  good: ["Felt decent after a short walk."],
  great: [],
};

/** A few days are skipped because the user forgets sometimes. */
export function buildCheckins(metrics: SeedMetric[]): SeedCheckin[] {
  return metrics.flatMap((m, i): SeedCheckin[] => {
    if (rand(i + 200) < 0.15) return [];
    // Energy tracks hydration and sleep: low water + short sleep => low energy.
    const strain =
      (m.hydrationMl < 1100 ? 1 : 0) + (m.sleepHours < 6.2 ? 1 : 0) + (rand(i + 250) < 0.3 ? 1 : 0);
    const energy: EnergyLevel =
      strain >= 2 ? "low" : strain === 1 ? (rand(i + 300) < 0.6 ? "low" : "okay") : "good";
    const notes = NOTES[energy];
    const note = notes.length && rand(i + 350) < 0.5 ? notes[Math.floor(rand(i + 400) * notes.length)] : undefined;
    return [{ date: m.date, energy, ...(note ? { note } : {}) }];
  });
}

const RUN_NOTES = ["Had to walk the last stretch.", "Slow and steady.", "Legs felt heavy.", "Short loop around the block."];

/** A handful of short, slow runs a month. */
export function buildRuns(today: Date): SeedRun[] {
  return Array.from({ length: HISTORY_DAYS }, (_, i) => i).flatMap((i): SeedRun[] => {
    // Always include a run 2 days ago so recent data is never empty.
    if (i !== 2 && rand(i + 500) >= 0.17) return [];
    const distance = 1 + rand(i + 550) * 1.5;
    const pace = 11.5 + rand(i + 600) * 2.5;
    const note = rand(i + 650) < 0.5 ? RUN_NOTES[Math.floor(rand(i + 700) * RUN_NOTES.length)] : undefined;
    return [{
      date: isoDateFrom(today, i),
      distanceMi: Math.round(distance * 100) / 100,
      durationMin: Math.round(distance * pace * 10) / 10,
      ...(note ? { note } : {}),
    }];
  });
}

export { ENERGY_LEVELS };

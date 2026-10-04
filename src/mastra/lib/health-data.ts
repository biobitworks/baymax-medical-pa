/**
 * Hardcoded sample data for Alex: a reasonably unfit person who drinks little
 * water and regularly reports low energy. Generated deterministically relative
 * to today so it always looks fresh. Replace with real storage later.
 */

export const ENERGY_LEVELS = ["low", "okay", "good", "great"] as const;
export type EnergyLevel = (typeof ENERGY_LEVELS)[number];

/** Numeric score for averaging: low = 1 ... great = 4. */
export const energyScore = (level: EnergyLevel) =>
  ENERGY_LEVELS.indexOf(level) + 1;

export type Checkin = {
  /** Local calendar date, YYYY-MM-DD */
  date: string;
  /** Answer to "How's your energy?" in the daily check-in */
  energy: EnergyLevel;
  note?: string;
};

export type DailyMetrics = {
  date: string;
  steps: number;
  activeMinutes: number;
  hydrationMl: number;
  sleepHours: number;
};

/** Common general wellness reference points used to flag gaps. */
export const TARGETS = {
  hydrationMl: 2000,
  steps: 7000,
  activeMinutes: 30,
  sleepHours: 7,
} as const;

const HISTORY_DAYS = 30;

// Deterministic pseudo-random in [0, 1) so the sample data is stable.
const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const isoDate = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const round = (n: number, step: number) => Math.round(n / step) * step;

/** Newest first. Index 0 is today. */
const buildMetrics = (): DailyMetrics[] =>
  Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const weekend = [0, 6].includes(new Date(isoDate(i) + "T12:00:00").getDay());
    return {
      date: isoDate(i),
      steps: round(2200 + rand(i + 1) * 2600 + (weekend ? 300 : 0), 50),
      activeMinutes: Math.round(4 + rand(i + 50) * 20),
      hydrationMl: round(650 + rand(i + 100) * 850, 50),
      sleepHours: Math.round((5.4 + rand(i + 150) * 1.6) * 10) / 10,
    };
  });

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

/** Newest first. A few days are skipped because Alex forgets sometimes. */
const buildCheckins = (metrics: DailyMetrics[]): Checkin[] =>
  metrics.flatMap((m, i): Checkin[] => {
    if (rand(i + 200) < 0.15) return [];
    // Energy tracks hydration and sleep: low water + short sleep => low energy.
    const strain =
      (m.hydrationMl < 1100 ? 1 : 0) +
      (m.sleepHours < 6.2 ? 1 : 0) +
      (rand(i + 250) < 0.3 ? 1 : 0);
    const energy: EnergyLevel =
      strain >= 2 ? "low" : strain === 1 ? (rand(i + 300) < 0.6 ? "low" : "okay") : "good";
    const notes = NOTES[energy];
    const note = notes.length && rand(i + 350) < 0.5
      ? notes[Math.floor(rand(i + 400) * notes.length)]
      : undefined;
    return [{ date: m.date, energy, ...(note ? { note } : {}) }];
  });

const metrics = buildMetrics();
const checkins = buildCheckins(metrics);

/**
 * Records today's check-in (replacing any earlier one today). Shared by the
 * app and the agent tools, so the agent sees what the user just saved.
 * In-memory only: resets when the server restarts.
 */
export function saveCheckin(energy: EnergyLevel, note?: string): Checkin {
  const entry: Checkin = { date: isoDate(0), energy, ...(note ? { note } : {}) };
  if (checkins[0]?.date === entry.date) checkins[0] = entry;
  else checkins.unshift(entry);
  return entry;
}

/** Adds water to today's total. In-memory only. */
export function addHydration(ml: number): DailyMetrics {
  metrics[0].hydrationMl += ml;
  return metrics[0];
}

/** The `count` most recent check-ins, newest first. */
export const getRecentCheckins = (count: number): Checkin[] =>
  checkins.slice(0, count);

/** The last `days` days of metrics, newest first (includes today). */
export const getRecentMetrics = (days: number): DailyMetrics[] =>
  metrics.slice(0, days);

const avg = (values: number[]) =>
  values.length
    ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
    : 0;

export function summarizeCheckins(list: Checkin[]) {
  const counts = { low: 0, okay: 0, good: 0, great: 0 } as Record<EnergyLevel, number>;
  for (const c of list) counts[c.energy] += 1;
  const lowShare = list.length ? counts.low / list.length : 0;
  const observations: string[] = [];
  if (list.length >= 3 && lowShare >= 0.5) {
    observations.push(
      `Energy was reported as low in ${counts.low} of ${list.length} check-ins.`,
    );
  }
  return {
    total: list.length,
    counts,
    averageEnergyScore: avg(list.map((c) => energyScore(c.energy))),
    scale: "1 = low, 2 = okay, 3 = good, 4 = great",
    observations,
  };
}

export function summarizeMetrics(list: DailyMetrics[]) {
  const averages = {
    steps: Math.round(avg(list.map((m) => m.steps))),
    activeMinutes: avg(list.map((m) => m.activeMinutes)),
    hydrationMl: Math.round(avg(list.map((m) => m.hydrationMl))),
    sleepHours: avg(list.map((m) => m.sleepHours)),
  };
  const daysBelowTarget = {
    hydration: list.filter((m) => m.hydrationMl < TARGETS.hydrationMl).length,
    steps: list.filter((m) => m.steps < TARGETS.steps).length,
    activeMinutes: list.filter((m) => m.activeMinutes < TARGETS.activeMinutes).length,
    sleep: list.filter((m) => m.sleepHours < TARGETS.sleepHours).length,
  };
  const observations: string[] = [];
  const n = list.length;
  if (n >= 3) {
    if (averages.hydrationMl < TARGETS.hydrationMl * 0.75) {
      observations.push(
        `Average water intake is about ${averages.hydrationMl} ml/day, well under the ~${TARGETS.hydrationMl} ml general target.`,
      );
    }
    if (averages.steps < TARGETS.steps * 0.75) {
      observations.push(
        `Average steps are about ${averages.steps}/day, under the ~${TARGETS.steps} general target.`,
      );
    }
    if (averages.activeMinutes < TARGETS.activeMinutes * 0.75) {
      observations.push(
        `Average active time is about ${averages.activeMinutes} min/day, under the ~${TARGETS.activeMinutes} min general target.`,
      );
    }
    if (averages.sleepHours < TARGETS.sleepHours - 0.5) {
      observations.push(
        `Average sleep is about ${averages.sleepHours} h/night, under the ~${TARGETS.sleepHours} h general target.`,
      );
    }
  }
  return { days: n, averages, daysBelowTarget, targets: TARGETS, observations };
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

export type Run = {
  /** Local calendar date, YYYY-MM-DD */
  date: string;
  distanceMi: number;
  durationMin: number;
  /** Minutes per mile */
  paceMinPerMi: number;
  note?: string;
};

const RUN_NOTES = [
  "Had to walk the last stretch.",
  "Slow and steady.",
  "Legs felt heavy.",
  "Short loop around the block.",
];

const makeRun = (date: string, distanceMi: number, durationMin: number, note?: string): Run => ({
  date,
  distanceMi: Math.round(distanceMi * 100) / 100,
  durationMin: Math.round(durationMin * 10) / 10,
  paceMinPerMi: Math.round((durationMin / distanceMi) * 100) / 100,
  ...(note ? { note } : {}),
});

/**
 * Newest first. Alex runs rarely (a handful of short, slow runs a month).
 */
const buildRuns = (): Run[] =>
  Array.from({ length: HISTORY_DAYS }, (_, i) => i).flatMap((i): Run[] => {
    // Always include a run 2 days ago so recent data is never empty.
    if (i !== 2 && rand(i + 500) >= 0.17) return [];
    const distance = 1 + rand(i + 550) * 1.5;
    const pace = 11.5 + rand(i + 600) * 2.5;
    const note =
      rand(i + 650) < 0.5
        ? RUN_NOTES[Math.floor(rand(i + 700) * RUN_NOTES.length)]
        : undefined;
    return [makeRun(isoDate(i), distance, distance * pace, note)];
  });

const runs = buildRuns();

/** The `count` most recent runs, newest first. */
export const getRecentRuns = (count: number): Run[] => runs.slice(0, count);

/** Records a run for today. In-memory only. */
export function saveRun(distanceMi: number, durationMin: number, note?: string): Run {
  const run = makeRun(isoDate(0), distanceMi, durationMin, note);
  runs.unshift(run);
  return run;
}

const daysBetween = (isoA: string, isoB: string) =>
  Math.round(
    (new Date(`${isoA}T12:00:00`).getTime() - new Date(`${isoB}T12:00:00`).getTime()) /
      86_400_000,
  );

export function summarizeRuns(list: Run[]) {
  const totalMiles = Math.round(list.reduce((a, r) => a + r.distanceMi, 0) * 100) / 100;
  const totalMinutes = Math.round(list.reduce((a, r) => a + r.durationMin, 0) * 10) / 10;
  const averagePaceMinPerMi = totalMiles
    ? Math.round((totalMinutes / totalMiles) * 100) / 100
    : 0;
  const longestMi = list.reduce((m, r) => Math.max(m, r.distanceMi), 0);
  const daysSinceLastRun = list[0] ? daysBetween(isoDate(0), list[0].date) : null;
  const spanDays = list.length > 1 ? daysBetween(list[0].date, list[list.length - 1].date) + 1 : 0;
  const runsPerWeek = spanDays ? Math.round((list.length / spanDays) * 7 * 10) / 10 : null;
  const observations: string[] = [];
  if (!list.length) observations.push("No runs logged yet.");
  if (daysSinceLastRun !== null && daysSinceLastRun >= 3) {
    observations.push(`Last run was ${daysSinceLastRun} days ago.`);
  }
  if (runsPerWeek !== null && runsPerWeek < 2) {
    observations.push(`Averaging about ${runsPerWeek} runs per week, under a common 2 to 3 a week starter routine.`);
  }
  if (list.length >= 2 && averagePaceMinPerMi >= 11) {
    observations.push(
      `Easy average pace of about ${averagePaceMinPerMi} min/mi, typical of someone building up fitness.`,
    );
  }
  return {
    total: list.length,
    totalMiles,
    totalMinutes,
    averagePaceMinPerMi,
    longestMi,
    daysSinceLastRun,
    runsPerWeek,
    observations,
  };
}

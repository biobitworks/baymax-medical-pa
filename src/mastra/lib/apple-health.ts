import { createHash } from 'node:crypto';
import type { AppleHealthDay, AppleHealthImport } from '../../shared/apple-health';
import { TARGETS } from './health-data';

const localDate = (date: Date, timeZone: string) => new Intl.DateTimeFormat('en-CA', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);
const numeric = (value: string | number) => typeof value === 'number' ? value
  : /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : NaN;
const round = (value: number) => Math.round(value * 100) / 100;
type Sample = AppleHealthImport['samples'][number];
type Bucket = { totals: Map<string, Map<string, number>>; sleep: Map<string, [number, number][]> };
const blank = (date: string): AppleHealthDay => ({ date, steps: null, activeMinutes: null, hydrationMl: null, sleepHours: null });

/** Convert only supported readings, discard raw samples, and never sum devices together. */
export function normalizeAppleHealth(input: AppleHealthImport, now = new Date()) {
  const exported = Date.parse(input.exportedAt);
  if (exported > now.getTime() + 300_000 || exported < now.getTime() - 86_400_000) throw new Error('Export time is outside the allowed window.');
  const buckets = new Map<string, Bucket>();
  const seen = new Set<string>();
  let ignoredSleepSamples = 0;
  for (const sample of input.samples) {
    const start = Date.parse(sample.startDate), end = Date.parse(sample.endDate);
    if (end < start || start < exported - 31 * 86_400_000 || end > exported + 300_000) throw new Error('Sample dates must be within the last 31 days and not in the future.');
    const id = createHash('sha256').update(JSON.stringify(sample)).digest('hex');
    if (seen.has(id)) continue;
    seen.add(id);
    // Sleep is attributed to its wake-up date; other samples use their start date.
    const date = localDate(new Date(sample.type === 'sleep' ? end : start), input.timeZone);
    const bucket = buckets.get(date) ?? { totals: new Map(), sleep: new Map() };
    buckets.set(date, bucket);
    if (sample.type === 'sleep') {
      const category = String(sample.value).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!['1', '3', '4', '5', 'asleep', 'asleepunspecified', 'asleepcore', 'asleepdeep', 'asleeprem', 'core', 'deep', 'rem'].includes(category)) {
        ignoredSleepSamples++;
        continue; // In bed, awake, and unknown categories are never counted as sleep.
      }
      if (end - start > 24 * 3_600_000) throw new Error('Sleep interval is too long.');
      const intervals = bucket.sleep.get(sample.source) ?? [];
      intervals.push([start, end]);
      bucket.sleep.set(sample.source, intervals);
    } else {
      const value = quantity(sample);
      const bySource = bucket.totals.get(sample.type) ?? new Map<string, number>();
      bySource.set(sample.source, (bySource.get(sample.source) ?? 0) + value);
      bucket.totals.set(sample.type, bySource);
    }
  }
  const daily = [...buckets].map(([date, bucket]) => {
    const day = blank(date);
    for (const key of ['steps', 'activeMinutes', 'hydrationMl'] as const) {
      const sources = bucket.totals.get(key);
      // Choose the source with the most recorded activity, instead of adding
      // overlapping iPhone/Watch/app totals. This may differ from Apple's total.
      if (sources?.size) day[key] = round(Math.max(...sources.values()));
    }
    if (bucket.sleep.size) day.sleepHours = round(Math.max(...[...bucket.sleep.values()].map(unionHours)));
    if ((day.steps ?? 0) > 200_000 || (day.activeMinutes ?? 0) > 1440 || (day.hydrationMl ?? 0) > 20_000 || (day.sleepHours ?? 0) > 24) throw new Error('Daily totals are outside the supported range.');
    return day;
  }).filter(day => [day.steps, day.activeMinutes, day.hydrationMl, day.sleepHours].some(value => value !== null))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!daily.length) throw new Error('No supported health readings found. Check Health permissions and selected sources.');
  return { daily, ignoredSleepSamples };
}

function quantity(sample: Sample): number {
  const n = numeric(sample.value), unit = sample.unit.toLowerCase().replace(/[\s.()]/g, '');
  if (!Number.isFinite(n) || n < 0) throw new Error('Health quantities must be non-negative numbers.');
  if (sample.type === 'steps' && ['count', 'counts', 'step', 'steps', ''].includes(unit)) return n;
  if (sample.type === 'activeMinutes') {
    if (['min', 'minute', 'minutes'].includes(unit)) return n;
    if (['s', 'sec', 'second', 'seconds'].includes(unit)) return n / 60;
    if (['h', 'hr', 'hour', 'hours'].includes(unit)) return n * 60;
  }
  if (sample.type === 'hydrationMl') {
    if (['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'].includes(unit)) return n;
    if (['l', 'liter', 'liters', 'litre', 'litres'].includes(unit)) return n * 1000;
    if (['fl_oz_us', 'usfloz', 'flozus'].includes(unit)) return n * 29.5735295625;
    if (['fl_oz_imp', 'imperialfloz', 'flozimp', 'flozimperial'].includes(unit)) return n * 28.4130625;
  }
  throw new Error('Unsupported quantity unit. Use count, min, and mL (or explicit convertible units).');
}

function unionHours(intervals: [number, number][]): number {
  let total = 0, start = 0, end = 0;
  for (const [a, b] of intervals.sort((a, b) => a[0] - b[0])) {
    if (a > end) { total += end - start; start = a; end = b; }
    else end = Math.max(end, b);
  }
  return (total + end - start) / 3_600_000;
}

export function summarizeAppleHealth(daily: AppleHealthDay[]) {
  const keys = ['steps', 'activeMinutes', 'hydrationMl', 'sleepHours'] as const;
  const averages = Object.fromEntries(keys.map(key => {
    const values = daily.map(day => day[key]).filter((n): n is number => n !== null);
    return [key, values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : null];
  })) as Record<typeof keys[number], number | null>;
  const below = (key: typeof keys[number]) => daily.filter(day => day[key] !== null && day[key]! < TARGETS[key]).length;
  return {
    days: daily.length, averages,
    daysBelowTarget: { hydration: below('hydrationMl'), steps: below('steps'), activeMinutes: below('activeMinutes'), sleep: below('sleepHours') },
    targets: TARGETS,
    observations: ['Apple Health readings synced by the user. Missing readings are unknown, not zero. Each metric uses one source per day; totals may differ from the Health app.'],
  };
}

import { z } from 'zod';

const instant = z.iso.datetime({ offset: true });
export const appleHealthImportSchema = z.object({
  version: z.literal(1),
  timeZone: z.string().max(100).refine(value => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
  }, 'Use an IANA time zone'),
  exportedAt: instant,
  samples: z.array(z.object({
    type: z.enum(['steps', 'activeMinutes', 'hydrationMl', 'sleep']),
    startDate: instant,
    endDate: instant,
    source: z.string().min(1).max(200),
    value: z.union([z.number().finite(), z.string().min(1).max(80)]),
    unit: z.string().max(40),
  }).strict()).max(20_000),
}).strict();
export type AppleHealthImport = z.infer<typeof appleHealthImportSchema>;
export type AppleHealthDay = {
  date: string;
  steps: number | null;
  activeMinutes: number | null;
  hydrationMl: number | null;
  sleepHours: number | null;
};
export type AppleHealthStatus = {
  connected: boolean;
  lastSyncAt: string | null;
  daily: AppleHealthDay[];
};

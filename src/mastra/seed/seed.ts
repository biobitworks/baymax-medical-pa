import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { DEMO_USER_ID } from "../lib/demo-user";
import { TEXT_EXTENSIONS, extOf, storeRecord } from "../lib/records";
import { ConversationStore } from "../persistence/conversations";
import type { Query } from "../persistence/store";
import { buildCheckins, buildMetrics, buildRuns } from "./generate";
import { SAMPLE_CONVERSATIONS } from "./sample-conversations";

export interface SeedOptions {
  userId?: string;
  /** Anchor for generated habit data. Defaults to now. */
  today?: Date;
  dataDir?: string;
}

function findDataDir(): string {
  if (process.env.RECORDS_DIR) return process.env.RECORDS_DIR;
  // The working directory varies (project root, .mastra/output), so walk up.
  let dir = process.cwd();
  while (true) {
    const candidate = resolve(dir, "data/synthetic");
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) return candidate;
    dir = parent;
  }
}

/**
 * The demo user's profile, conditions, body measurements, and built-in medical
 * records (with extracted lab results), all read from data/synthetic.
 */
export async function seedProfile(q: Query, options: SeedOptions = {}) {
  const userId = options.userId ?? DEMO_USER_ID;
  const dir = options.dataDir ?? findDataDir();
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => TEXT_EXTENSIONS.includes(extOf(f))).sort() : [];
  const jsonFile = files.find((f) => extOf(f) === ".json");
  const health = jsonFile ? JSON.parse(readFileSync(join(dir, jsonFile), "utf8")) : {};
  const profile = health.profile ?? { name: "Jordan Mercer" };

  await q(
    `INSERT INTO users (id, external_id, name, email, date_of_birth, sex, is_demo)
     VALUES ($1, $2, $3, $4, $5::date, $6, true)
     ON CONFLICT (id) DO UPDATE SET external_id = EXCLUDED.external_id, name = EXCLUDED.name,
       email = EXCLUDED.email, date_of_birth = EXCLUDED.date_of_birth, sex = EXCLUDED.sex`,
    [userId, profile.id ?? null, profile.name, "jordan.mercer@example.com", profile.date_of_birth ?? null, profile.sex ?? null],
  );
  for (const c of health.conditions ?? []) {
    await q(
      `INSERT INTO user_conditions (user_id, name, status, notes) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, name) DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes`,
      [userId, c.name, c.status ?? "active", c.notes ?? null],
    );
  }
  for (const m of health.measurements ?? []) {
    await q(
      `INSERT INTO body_measurements (user_id, measured_on, type, value, unit) VALUES ($1, $2::date, $3, $4, $5)
       ON CONFLICT (user_id, measured_on, type) DO UPDATE SET value = EXCLUDED.value, unit = EXCLUDED.unit`,
      [userId, m.date, m.type, m.value, m.unit],
    );
  }
  for (const file of files) {
    await storeRecord(
      { userId, q },
      { id: `library:${file}`, name: file, source: "library", content: readFileSync(join(dir, file), "utf8") },
    );
  }
}

/**
 * Everything the user changes while using the app: habit history (relative to
 * today) and a few sample chats so the history sidebar is never empty.
 */
export async function seedActivity(q: Query, options: SeedOptions = {}) {
  const userId = options.userId ?? DEMO_USER_ID;
  const today = options.today ?? new Date();
  const metrics = buildMetrics(today);
  // One statement per table keeps reseeding (the Reset button) fast over HTTP.
  await q(
    `INSERT INTO daily_metrics (user_id, day, steps, active_minutes, hydration_ml, sleep_hours)
     SELECT $1, m.date, m.steps, m."activeMinutes", m."hydrationMl", m."sleepHours"
     FROM jsonb_to_recordset($2::jsonb) AS m(date date, steps int, "activeMinutes" int, "hydrationMl" int, "sleepHours" double precision)
     ON CONFLICT (user_id, day) DO UPDATE SET steps = EXCLUDED.steps, active_minutes = EXCLUDED.active_minutes,
       hydration_ml = EXCLUDED.hydration_ml, sleep_hours = EXCLUDED.sleep_hours`,
    [userId, JSON.stringify(metrics)],
  );
  await q(
    `INSERT INTO checkins (user_id, checked_on, energy, note)
     SELECT $1, c.date, c.energy, c.note FROM jsonb_to_recordset($2::jsonb) AS c(date date, energy text, note text)
     ON CONFLICT (user_id, checked_on) DO UPDATE SET energy = EXCLUDED.energy, note = EXCLUDED.note`,
    [userId, JSON.stringify(buildCheckins(metrics))],
  );
  await q(
    `INSERT INTO runs (user_id, ran_on, distance_mi, duration_min, note)
     SELECT $1, r.date, r."distanceMi", r."durationMin", r.note
     FROM jsonb_to_recordset($2::jsonb) AS r(date date, "distanceMi" double precision, "durationMin" double precision, note text)`,
    [userId, JSON.stringify(buildRuns(today))],
  );
  const conversations = new ConversationStore(q);
  await Promise.all(SAMPLE_CONVERSATIONS(today).map(async (sample) => {
    await conversations.save(userId, sample.id, sample.conversation, sample.title);
    await q("UPDATE conversations SET updated_at = $3::timestamptz, created_at = $3::timestamptz WHERE id = $1 AND user_id = $2", [
      sample.id, userId, sample.updatedAt,
    ]);
  }));
}

export async function seedDemo(q: Query, options: SeedOptions = {}) {
  await seedProfile(q, options);
  await seedActivity(q, options);
}

/**
 * Puts the demo user back to the freshly seeded state: removes chats, uploads,
 * and habit history, then regenerates them. Built-in records are untouched.
 */
export async function resetDemo(q: Query, options: SeedOptions = {}) {
  const userId = options.userId ?? DEMO_USER_ID;
  await q(
    `WITH a AS (DELETE FROM conversations WHERE user_id = $1),
          b AS (DELETE FROM records WHERE user_id = $1 AND source = 'upload'),
          c AS (DELETE FROM checkins WHERE user_id = $1),
          d AS (DELETE FROM daily_metrics WHERE user_id = $1),
          e AS (DELETE FROM user_fitness_preferences WHERE user_id = $1)
     DELETE FROM runs WHERE user_id = $1`,
    [userId],
  );
  await seedActivity(q, options);
}

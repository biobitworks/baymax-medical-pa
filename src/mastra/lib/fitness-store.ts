import { dbOf, userIdOf, type Ctx } from "./demo-user";
import {
  goalsSchema, preferencesSchema,
  type ActivityGoals, type FitnessPreferences,
} from "./fitness";

export type SavedFitnessPreferences = FitnessPreferences & { onboarded: boolean };

const DEFAULTS = { steps: 5000, activeMinutes: 20 };

/** Goals and notification choice live in user_fitness_preferences, the name in users. */
export async function getFitnessPreferences(ctx: Ctx = {}): Promise<SavedFitnessPreferences> {
  const q = dbOf(ctx);
  const userId = userIdOf(ctx);
  const [row] = await q(
    `SELECT u.name, p.steps_goal, p.active_minutes_goal, p.notifications, p.onboarded
     FROM users u LEFT JOIN user_fitness_preferences p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );
  if (!row) throw new Error("User profile not found");
  return {
    name: String(row.name),
    goals: {
      steps: row.steps_goal == null ? DEFAULTS.steps : Number(row.steps_goal),
      activeMinutes: row.active_minutes_goal == null ? DEFAULTS.activeMinutes : Number(row.active_minutes_goal),
    },
    notifications: (row.notifications ?? "off") as FitnessPreferences["notifications"],
    onboarded: Boolean(row.onboarded),
  };
}

export async function saveFitnessPreferences(input: FitnessPreferences, ctx: Ctx = {}) {
  const prefs = preferencesSchema.parse(input);
  const q = dbOf(ctx);
  const userId = userIdOf(ctx);
  await q("UPDATE users SET name = $2 WHERE id = $1", [userId, prefs.name]);
  await q(
    `INSERT INTO user_fitness_preferences (user_id, steps_goal, active_minutes_goal, notifications, onboarded)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (user_id) DO UPDATE SET steps_goal = $2, active_minutes_goal = $3,
       notifications = $4, onboarded = true, updated_at = now()`,
    [userId, prefs.goals.steps, prefs.goals.activeMinutes, prefs.notifications],
  );
  return getFitnessPreferences(ctx);
}

export async function saveActivityGoals(input: ActivityGoals, ctx: Ctx = {}) {
  const goals = goalsSchema.parse(input);
  await dbOf(ctx)(
    `INSERT INTO user_fitness_preferences (user_id, steps_goal, active_minutes_goal)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET steps_goal = $2, active_minutes_goal = $3, updated_at = now()`,
    [userIdOf(ctx), goals.steps, goals.activeMinutes],
  );
  return getFitnessPreferences(ctx);
}

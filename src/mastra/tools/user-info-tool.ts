import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { dbOf, userIdOf } from "../lib/demo-user";

const userInfoSchema = z.object({
  name: z.string(),
  age: z.number().optional(),
  conditions: z.array(z.string()),
  medications: z.array(z.string()),
  allergies: z.array(z.string()),
  notes: z.string().optional(),
});

/** Returns the current user's profile from Postgres. */
export const userInfoTool = createTool({
  id: "get-user-info",
  description:
    "Get basic information about the current user, including their name, age, health conditions, medications, and allergies. Use this to personalize advice and before drafting care plans or doctor briefs.",
  inputSchema: z.object({}),
  outputSchema: userInfoSchema,
  execute: async () => {
    const q = dbOf();
    const userId = userIdOf();
    const [[user], conditions, medications, allergies] = await Promise.all([
      q("SELECT name, notes, CASE WHEN date_of_birth IS NULL THEN NULL ELSE date_part('year', age(date_of_birth))::int END AS age FROM users WHERE id = $1", [userId]),
      q("SELECT name, status, notes FROM user_conditions WHERE user_id = $1 ORDER BY name", [userId]),
      q("SELECT name FROM user_medications WHERE user_id = $1 ORDER BY name", [userId]),
      q("SELECT name FROM user_allergies WHERE user_id = $1 ORDER BY name", [userId]),
    ]);
    if (!user) throw new Error("User profile not found");
    return {
      name: String(user.name),
      ...(user.age == null ? {} : { age: Number(user.age) }),
      conditions: conditions.map((c) => (c.status && c.status !== "active" ? `${c.name} (${c.status})` : String(c.name))),
      medications: medications.map((m) => String(m.name)),
      allergies: allergies.map((a) => String(a.name)),
      ...(user.notes ? { notes: String(user.notes) } : {}),
    };
  },
});

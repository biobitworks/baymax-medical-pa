import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const userInfoSchema = z.object({
  name: z.string(),
  age: z.number(),
  conditions: z.array(z.string()),
  medications: z.array(z.string()),
  allergies: z.array(z.string()),
  notes: z.string().optional(),
});

/**
 * Returns the current user's profile. Hardcoded for now (Alex, who has
 * diabetes); replace with a real lookup once auth and storage are wired up.
 */
export const userInfoTool = createTool({
  id: "get-user-info",
  description:
    "Get basic information about the current user, including their name, age, health conditions, medications, and allergies. Use this to personalize advice and before drafting care plans or doctor briefs.",
  inputSchema: z.object({}),
  outputSchema: userInfoSchema,
  execute: async () => ({
    name: "Alex",
    age: 42,
    conditions: ["Type 2 diabetes"],
    medications: ["Metformin 500mg twice daily"],
    allergies: [],
    notes: "Monitors blood glucose daily. Sees an endocrinologist every 6 months.",
  }),
});

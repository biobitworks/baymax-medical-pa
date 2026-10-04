import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { importedHealth } from '../lib/health-reader';

const userInfoSchema = z.object({
  name: z.string(),
  age: z.number().optional(),
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
  execute: async (_input, context) => {
    if ((await importedHealth(context)).connected) return {
      name: 'Not provided', conditions: [], medications: [], allergies: [],
      notes: "Use the user's care workspace context for their name. Apple Health metrics do not establish their age, diagnoses, medications, or allergy status; empty lists mean not provided, not confirmed absent.",
    };
    return ({
    name: "Alex",
    age: 42,
    conditions: ["Type 2 diabetes"],
    medications: ["Metformin 500mg twice daily"],
    allergies: [],
    notes: "Synthetic demo profile. Not the connected user's medical history.",
  });
  },
});

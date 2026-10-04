import { registerApiRoute } from "@mastra/core/server";
import { query } from "../persistence/database";
import { resetDemo } from "../seed/seed";

/**
 * Demo-only. Disable or restrict this once real auth exists
 * (see src/mastra/lib/demo-user.ts).
 * Restores the demo user's chats, uploads, and habit history to the seeded state. */
export const demoRoutes = [
  registerApiRoute("/demo/reset", {
    method: "POST",
    handler: async (c) => {
      try {
        await resetDemo(query);
        return c.json({ reset: true });
      } catch {
        return c.json({ error: "Could not reset the demo data. Please try again." }, 503);
      }
    },
  }),
];

import type { Query } from "../persistence/store";
import { query } from "../persistence/database";

/**
 * HOW USER IDENTITY WORKS (read this before adding auth or multi-user support)
 *
 * The app has no login yet. Every request acts as ONE fixed demo user, Jordan
 * Mercer (see data/synthetic and src/mastra/seed). There is no per-request user
 * lookup anywhere else in the codebase:
 *
 *   - Every per-user table (checkins, daily_metrics, runs, records, lab_results,
 *     conversations, user_*) has a `user_id` column.
 *   - Every data function (src/mastra/lib/*, persistence/conversations.ts, the
 *     agent tools, and the route handlers) obtains the user ONLY by calling
 *     `userIdOf()` below and filters its SQL by that id.
 *
 * TO ADD REAL LOGIN (e.g. Neon Auth, whose URLs are already in .env.local):
 *   1. Change `userIdOf` so it returns the authenticated user's id (a row in
 *      `users`) instead of the constant. Route handlers have the request
 *      (`c.req`); agent tools receive `requestContext`, so set the user id
 *      there in a Mastra middleware and read it here. Use the `ctx.userId`
 *      override that already exists as the plumbing point.
 *   2. Reject unauthenticated requests in the routes. Today they are open, so
 *      anyone who can reach the server can read and delete the demo user's data.
 *   3. Stop using DEMO_USER_ID outside seeding and `/demo/reset`. Seeding
 *      (`npm run db:seed`) and the Reset button (`POST /demo/reset`) are demo
 *      features and should be disabled or admin-only once real users exist.
 *   4. The separate `/care-state` UI-preferences store is keyed by an anonymous
 *      session cookie, not by user id. Decide whether to key it by user too.
 *
 * Do not hardcode DEMO_USER_ID anywhere else; always go through `userIdOf`.
 */
export const DEMO_USER_ID = "8f1c2d3e-4a5b-4c6d-9e7f-0a1b2c3d4e5f";

/**
 * Optional overrides threaded through the data layer. `userId` selects the
 * user (defaults to the demo user); `q` swaps the database (tests pass an
 * in-memory PGlite, everything else uses Neon).
 */
export interface Ctx {
  userId?: string;
  q?: Query;
}

/** The single place that decides which user the current call acts as. */
export const userIdOf = (ctx: Ctx = {}) => ctx.userId ?? DEMO_USER_ID;

/** The database connection for this call. */
export const dbOf = (ctx: Ctx = {}): Query => ctx.q ?? query;

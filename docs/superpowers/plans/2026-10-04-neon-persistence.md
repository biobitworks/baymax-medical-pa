# Neon Persistence Implementation Plan

> For agentic workers: execute inline using the executing-plans workflow; preserve pre-existing local edits.

**Goal:** Connect generated care cards and retain consented user data across browser refreshes using Neon.

**Architecture:** A shared validated workspace schema, a focused Neon repository and Mastra API handler, a serialized browser sync client, and a streaming model adapter. Keep application credentials outside the browser bundle.

**Tech stack:** React, Assistant UI, TypeScript, Mastra, Neon serverless driver, Node test runner, PGlite.

- [x] Add regression tests for workspace round-trip, isolated cookies, consent, validation, conflicts, deletion, sanitized failures, and ordered writes. Run `npm test` and observe missing-feature failures.
- [x] Implement `src/shared/workspace.ts`, `src/mastra/persistence/{database,store,handler}.ts`, `migrations/001_care_workspaces.sql`, and `scripts/migrate.ts`. Register GET/PUT/DELETE `/care-state` in `src/mastra/index.ts`. Use a parameterized optimistic upsert and no database initialization at import time.
- [x] Add stream framing and actual tool-result tests. Implement `src/chat/adapter.ts`, consuming tool results and updating shared plan/brief fields once per completed tool result. Return explicit interrupted/error states.
- [x] Implement `src/persistence/{client,use-care-workspace}.ts`. Load before displaying the workspace, serialize/debounce saves, retain failed saves for retry, and await outstanding writes before remote deletion. Disable autosave on revision conflicts.
- [x] Update `src/main.tsx` to consume the workspace hook, import/export the Assistant UI repository, render generated plan tasks, and expose remember/retry/reset controls. Keep transient dialogs and email approval ephemeral.
- [x] Add `.env.example`, update README and scripts, and check frontend/backend production builds. Apply the additive migration against the supplied Neon database, exercise a disposable synthetic workspace through the HTTP API, check a live agent response, and delete test data. Browser visual verification was blocked by the enforced browser policy; component/runtime tests verified restore behavior.
- [x] Inspect the full diff, verify ignored credentials and browser bundle, and report the completed result plus any verified limitation.

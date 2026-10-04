# Baymax UI and Neon persistence

Retain the React/Vite frontend and Mastra backend from main, preserving the existing local mascot and CSS changes. Use server-only Neon queries, following the existing Mastra custom route mechanism. Avoid an additional backend or ORM for the single care workspace document.

Store a versioned care workspace in JSONB: display name, onboarding completion, daily check-in, hydration, completed tasks, generated plan items, travel fields, doctor brief/email draft, preferences, and exported Assistant UI conversation including tool results. Restoring precedes rendering the chat or permitting writes. Save only after explicit Remember across visits consent. The durable conversation supplies the agent's conversational context on subsequent turns; no duplicate Mastra memory store is needed.

A random 256-bit HttpOnly SameSite cookie identifies this browser's workspace. Store only its SHA-256 hash. Validate request origins, JSON size, and state schema. Use sequence-backed monotonic optimistic revisions and a serialized client save queue so older writes cannot replace newer ones. Failed deletion keeps autosaves paused until deletion succeeds. Restore retries are single-flight. Disabling memory deletes the remote workspace before completing; reset deletes remote data and clears the UI/runtime. This is browser-bound persistence; account login and cross-device access are separate work.

Stream actual agent text and validated care-plan/doctor-brief tool results into cards and shared care fields. Earlier cards retain their tool-result snapshots and can be made active again. Handle split SSE frames, trailing frames, multiple tool results, aborts, and stream errors. Show connection failures explicitly instead of presenting synthetic fallback responses as agent output.

Configuration: all provided variables belong in ignored .env with restricted permissions. DATABASE_URL is lazy and server-only. Supply an idempotent additive migration, example variables, and local startup instructions. Preserve existing tables. Live verification uses only disposable synthetic workspaces and deletes them afterward.

Validation: test SQL round-trips and session isolation with Postgres-compatible PGlite; test invalid requests, consent, cookie protections, conflicts, deletion, save ordering, and stream framing/tool data; run TypeScript/frontend/backend builds; run live Neon and agent smoke tests and verify browser reload behavior.

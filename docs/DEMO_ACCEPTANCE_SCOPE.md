# Demo acceptance scope for issues #3 and #4

Source: the issue bodies read directly with GitHub CLI on 2026-10-04:
- https://github.com/jerelvelarde/baymax-medical-pa/issues/3 — Offline-first AI
- https://github.com/jerelvelarde/baymax-medical-pa/issues/4 — Privacy compliance

This correction scopes dependency failures to the affected integration. It does not mark either issue complete or change historical receipts.

| Condition | Issue #3 offline demo impact | Issue #4 synthetic demo impact | Separate state to preserve |
| --- | --- | --- | --- |
| Fly unavailable | Does not block a local offline demo; unavailable network tools must degrade gracefully | Does not block a local synthetic demo | Live Fly deployment unavailable or NOT_TESTED |
| Neon mismatch | Does not block a bundled offline fixture; cloud synchronization is separate | Does not block a local synthetic demo | Neon identity/configuration mismatch unresolved; do not claim synchronization works |
| No live pharmacy purchase | Outside #3 acceptance criteria | Outside #4 acceptance criteria | Live purchase disabled; prescription purchase prohibited in current wallet policy |
| No autonomous calling | Outside #3 acceptance criteria | Outside #4 acceptance criteria | Calls disabled in the synthetic fixture |
| No HIPAA certification | Outside #3 acceptance criteria | Does not block a synthetic public demo; document gaps before making compliance claims | HIPAA compliance NOT_VERIFIED; claim NOT_MADE; real PHI remains blocked |

## Issue #3: remaining acceptance evidence

The core agent must work without internet, show online/offline state, handle unavailable network tools gracefully, and demonstrate the offline experience end to end. BP-0021 supports a local bundled synthetic fixture, byte-identical generation, network-free JSON loading and Swift decoding. It does not prove an on-device core-agent experience, visible connectivity state, or end-to-end unavailable-tool behavior. Those items remain NOT_TESTED or unproven until demonstrated. Optional cloud and live-action gaps are not issue-wide blockers.

## Issue #4: remaining acceptance evidence

Document data flows, storage, retention and third-party disclosures; implement consent, data minimization and deletion controls; review sponsor integrations and document gaps before making HIPAA compliance claims; use synthetic medical data for the public demo.

BP-0021 supports a minimized synthetic fixture, excluded provider contacts, disabled real-world actions, provenance and local/offline processing. Existing privacy documentation is prototype evidence. Consent and deletion controls require implementation and end-to-end verification in the actual app; this scope correction does not promote design documentation or wallet-specific approval into proof of those controls. Missing controls remain acceptance gaps, while absence of certification is not a synthetic-demo blocker.

## Status language

Use PARTIAL or NOT_TESTED for missing acceptance evidence. Use BLOCKED only for a concrete required step that cannot proceed, naming its scope and dependency. A blocked live integration does not automatically block the offline synthetic demo. Synthetic demo eligibility does not imply production readiness, PHI authorization, HIPAA compliance, or medical correctness.

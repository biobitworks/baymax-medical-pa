# Jerel backend demo handoff — 2026-10-04

## Headline

- **Do not present `f779923` as accepted.** The exact candidate is **REJECTED** because `loadContext()` guard 10 still compares the packet against the old SHA `80e92bd4…`; the shipped packet and `ModelContract.packetSHA256` are `4c51c8d5…`.
- The important positive result is that the **safety architecture held while the integration bug failed closed**: build/launch work, the bad packet pin stops loading, hostile model output is rejected, medication purchase remains blocked, and dataset text cannot silently become trusted display text.
- **One-line repair is already identified:** compare the loaded packet SHA to `ModelContract.packetSHA256`, then re-run independent verification on the repaired exact bytes.

## What Jerel should show, and where

- **1. Start with screenshot 08 — the headline failure.** Show `evidence/receipts/redteam_lane/simulator_f779923/screenshots/08_candidate_unpatched_load_failure_guard10.png`. Say: “We deliberately fail closed. The candidate app launches, but refuses its own context because one stale packet hash remained.”
- **2. Show the backend contract, not just the UI.** In `ios/OfflineTravelDemo/OfflineTravelApp.swift`, point to the `loadContext()` guard chain and the stale guard-10 literal. Then show `ModelContract.packetSHA256`. Key phrase: **lineage-pinned, deterministic admission**.
- **3. Show the F3 lineage attack evidence.** Open `evidence/receipts/redteam_lane/simulator_f779923/f3f4_attack_results.json` or the attack driver under `redteam_lane/f3f4_attack/`. Explain that foreign dataset/FCO/FCG mutations are rejected and required references are bound.
- **4. Show the F4 text boundary.** Use screenshot 02 plus the attack receipt. The UI renders **code-owned allowlisted medication labels** (Naproxen and Bictegravir) rather than arbitrary dataset `text` / `coding.display`. Poisoned text does not reach the catalog or packet.
- **5. Show the deterministic model-output gate.** Use screenshots 03, 04 and 05: valid bounded JSON is accepted; historical `"SYNTHETIC DEMO ONLY"` is rejected; hostile/malformed JSON is rejected. The validator regression is **351 executions, 0 disagreements, 0 crashes, 0 unsafe accepts**.
- **6. Show the action boundary.** Use screenshot 06. Cloud summary/call/sync are deferred and **medication purchase is BLOCKED**. This is the product boundary: model output is advisory/provisional; deterministic policy owns actions.
- **7. Show restart/privacy semantics.** Use screenshot 07. Consent is session-only and returns off; “Offline pack reviewed” persists; loaded context/model response do not persist.
- **8. For physical/local inference, explicitly label it historical.** The preserved Apollo recordings demonstrate earlier physical-iPhone local inference and a separate Airplane Mode run, but they used the **older packet**. They are not proof that `f779923` or the new packet ran on hardware.
- **9. For backend/Neon, show the exact qualification state, not a HIPAA badge.** In the Neon console show project/branch identity and TLS connection, then pair it with `evidence/receipts/hipaa/neon_exact_project_qualification_20261004.json` from the separate `redteam/neon-hipaa-current` lane. Say: TLS verify-full, controlled CRUD, minimum-necessary routing and fail-closed AI disclosure passed; **HIPAA compliance remains NOT_VERIFIED and REAL_PHI remains BLOCKED**.

## Key terms to use

- **Fail closed** — unsafe/ambiguous state becomes UNKNOWN/REJECT/BLOCKED, not a silent fallback.
- **FCO / FCG** — evidence objects and typed lineage graph around data/model execution.
- **Lineage pinning** — dataset, FCG, FCO, projection, catalog and packet identities must agree.
- **Deterministic validator** — model text is not trusted until strict structural/admission checks pass.
- **Code-owned allowlist** — trusted user-visible medication labels come from controlled code, not mutable dataset prose.
- **Claim ceiling** — evidence is described only as strongly as the observed test supports.
- **UNKNOWN / ABSTAIN** — valid safe outcomes, not errors to be papered over.
- **Synthetic-only** — no real PHI was used in these simulator/model-admission tests.
- **Compensatory control** — e.g. `REAL_PHI=BLOCKED` while backend security/compliance gates remain incomplete.
- **Minimum necessary** — only bounded fields are eligible for external disclosure; current test is deterministic policy evidence.
- **TLS verify-full** — encrypted transport plus certificate/hostname verification; this is not the same as HIPAA compliance.
- **Independent verification** — separate execution against exact bytes; do not use this term for the blocked Claude provider attempt.

## What succeeded

- F3 lineage defenses: artifact-level attack matrix produced **0 unsafe accepts** across the reported mutation cases.
- F4 dataset-text defenses: six poison payloads did not flow into catalog/packet text; code/system/gender mutation cases reject fail-closed.
- Validator: **351 executions / 0 disagreements / 0 crashes / 0 unsafe accepts** on the red-team rerun.
- UI gate: valid bounded response accepted; historical and hostile responses rejected.
- Wallet/action guard: `PRESCRIPTION_PURCHASE=BLOCKED` remained in force.
- Restart/privacy behavior: session consent clears; reviewed state persists; prior loaded context/response is not retained.
- Evidence custody: eight simulator screenshots have verified hashes; two historical iPhone recordings have stable hashes across the preserved ChatGPT/Claude/Codex worktrees where present.
- Backend qualification: exact Neon project identity and TLS peer verification passed; controlled CRUD and minimum-necessary policy tests executed.

## Future work already defined

- **Immediate candidate repair:** replace the stale guard-10 literal with `ModelContract.packetSHA256`; rebuild and re-run exact-byte independent verification.
- **Hardware proof for the new packet:** physical iPhone + Airplane Mode + exact destination-byte custody + restart run. Do not reuse the historical recording as new-packet proof.
- **Secure local storage:** implement and test application AEAD envelope encryption, Keychain/Secure Enclave custody where appropriate, rotation/deletion, and device file protection.
- **Neon least privilege:** replace `neondb_owner`/BYPASSRLS-capable credentials with an application role with minimal grants and effective RLS where used.
- **Observability leak repair:** prevent controlled sensitive values from appearing in `pg_stat_activity` SQL text and repeat the canary test across app/provider logs/traces.
- **Runtime binding:** reconcile Baymax `DATABASE_URL` so the running backend actually targets the qualified Neon project/branch.
- **HIPAA/BAA:** enable/verify the project HIPAA feature and human-verify the signed BAA/account scope before any real PHI.
- **Retention/deletion:** define and verify backup, PITR, provider-log retention and purge semantics, including a recovery/purge drill.
- **Final product claim remains bounded:** no model is medical authority; prescription purchase/change stays blocked pending licensed-clinician/product authorization.

## Evidence anchors

- Red-team exact-byte commit: `03632624c124641355eab479182c5f4313eac506`
- Candidate under test: `f7799238d57a65d80730afb736e4ed646dc7b60e`
- Simulator receipt: `evidence/receipts/redteam_lane/simulator_f779923/redteam_receipt_f779923.json`
- Screenshot directory: `evidence/receipts/redteam_lane/simulator_f779923/screenshots/`
- PR handoff: PR #4 and PR #6 contain the red-team verdict and screenshot hashes.

# Project 3 — inference ladder, persistent wallet, and Bali custody map

Snapshot: 2026-10-04

Canonical integration branch at this snapshot:

- branch: `integration/iphone-offline-v2`
- parent HEAD: `d4389ecfa7589c4e376d9be14658b9d4494f7fd5`
- parent breakpoint: `BAYMAX-BP-0033`
- parent Merkle root: `ee51fe916b91cc8628f2a37e34f7acc9e92b46c9c0cd31c8c445b3119339b3b8`
- parent chain head: `4d7bbacd1ba58d8c8e8f04bfc10802307c9fccaa511849620bde5f85ca474f02`
- upstream main observed: `63f58143348b6a08504df86a55bb6ea112822144`

This document is a reconciliation map. It does not upgrade medical correctness, HIPAA compliance, Fly deployment, or full physical-app offline E2E beyond the evidence states below.

## 1. Source of truth is independent from inference

Baymax's intended control path is:

```text
source / evidence
    ↓
DatasetSourceFCO / Atom
    ↓
typed FCG
    ↓
persistent local context / OfflineTravelBundle
    ↓
minimum-necessary ContextPacket
    ↓
replaceable inference substrate
    ↓
ModelInferenceFCO
    ↓
strict deterministic validator
    ↓
ComplianceContext / policy
    ↓
human authorization when required
    ↓
wallet / bounded action
    ↓
OutcomeFCO / receipt
    ↓
successor state
```

Models, Fly.io, Neon, Mastra, Apollo, browsers, and humans are execution substrates. None is the canonical source of truth.

## 2. Fast-inference ladder

| Level | Execution lane | Current evidence | Custody breakpoint(s) | State / claim ceiling |
| --- | --- | --- | --- | --- |
| L0 | Deterministic code only | compliance router, strict output validation, wallet policy, UNKNOWN/ABSTAIN | BP-0000/0001, BP-0026, BP-0032 | EXECUTED. Policy authority; not medical correctness. |
| L1 | Physical iPhone local model | Liquid Apollo through Apple iPhone Mirroring; Airplane Mode and Wi-Fi-off UI observed | BP-0028, BP-0032, BP-0033 | OBSERVED. Full model revision UNKNOWN. No packet-level network probe. Raw BP-0032 response was rejected correctly. |
| L2 | Small/medium local Mac models | Liquid LFM2.5 350M / 1.2B / 2.6B through Ollama | BP-0006 | EXECUTED. Routing result NEGATIVE on all three; no model promoted to policy authority. |
| L3 | Heavy local host | magicSTUDIO / larger local model | none in canonical chain | NOT_TESTED in this repo. Candidate escalation lane only. |
| L4 | Hosted sponsor inference | Neon AI Gateway synthetic test | BP-0009→0012; control-plane BP-0016 | Gateway synthetic inference PASS n=1 after preserved failures; control plane PARTIAL. No real PHI claim. |
| L5 | Product orchestration | upstream Mastra + Neon model routing | upstream code, separate from this custody branch | IMPLEMENTED upstream, but sensitive disclosure must still pass deterministic compliance before external inference. |
| L6 | Frontier / high-end remote | sponsor/frontier model on explicit escalation | none | PROPOSED / DEFERRED. Must ingest output as MODEL_INFERRED only. |

Escalation policy:

```text
DETERMINISTIC_CODE
→ SMALL_LOCAL_MODEL
→ LARGER_LOCAL_MODEL
→ HEAVY_LOCAL_HOST
→ APPROVED_SPONSOR_MODEL
→ FRONTIER_REASONING
```

Escalate only after failure, abstention, comparison design, or task need. Larger models do not receive greater authority.

## 3. Canonical breakpoint evidence by execution actor

### Claude — canonical implementation/red-team milestones

Explicit Claude-attributed canonical commits include:

- BP-0002..0005 — independent custody red-team and hardened verifier.
- BP-0006 — local Liquid LFM2.5 execution.
- BP-0007 — synthetic zero-funds persistent wallet with phone-root / Fly-delegate simulation.
- BP-0008 — custody remeasurement.
- BP-0009/BP-0010 — Neon failure preservation and repair/retry.
- BP-0016 — Neon control-plane probe.

Independent Claude verification continues outside the canonical chain in Biobitworks PR #4 at commit `53666f3b587ee9e6b41ceef943ccf3cd80fc749c`. That lineage intentionally mints no canonical breakpoint.

### Codex — canonical implementation milestones

Explicit Codex-attributed canonical commits include:

- BP-0021 — pinned Synthea generation, actor admission, two byte-identical runs.
- BP-0024 — iPhone/Apollo physical-demo preparation.
- BP-0025 — Apollo packet delivery preparation.

Independent Codex verification continues outside the canonical chain in Biobitworks PR #5 at commit `87f9608e7e4722bed6074db20f98cd82866bbe9e`. That lineage intentionally mints no canonical breakpoint.

### ChatGPT — canonical integration milestones

Explicit ChatGPT-attributed canonical commits include:

- BP-0011→0015 — independent Neon failure/repair and remote custody anchoring.
- BP-0017/BP-0018 — Neon agent tooling and remote parity.
- BP-0026 — iPhone build-ready successor and validator repair.
- BP-0028→BP-0030 — physical iPhone/Apollo observation, publication and first recording custody.
- BP-0032/BP-0033 — Airplane Mode inference observation and exact original recording custody.

Independent agent histories are references, not concatenated Merkle/MMR histories.

## 4. Persistent wallet and Fly.io

Canonical wallet evidence is BP-0007/BP-0008.

Observed/implemented locally:

- synthetic zero-real-funds wallet
- deterministic canonicalization
- phone-root and scoped Fly-delegate Ed25519 semantics
- policy engine and human approval
- replay, fork, rollback, checkpoint and tamper tests
- wallet-local MMR implementation and cross-check
- prescription purchase is prohibited

Not established:

- real Fly.io deployment
- real network replica synchronization
- real money/payment rail
- Signet integration
- Secure Enclave phone-root key
- autonomous medication purchase

Therefore:

```text
FLY_DELEGATE_SEMANTICS=IMPLEMENTED_IN_PROCESS
REAL_FLY_DEPLOYMENT=NOT_TESTED
REAL_MONEY=NO
PRESCRIPTION_PURCHASE=BLOCKED
```

A future Fly lane should act only as a bounded delegate/replica. It must never become the canonical wallet root.

## 5. Bali travel custody — without internet

A credible offline chain already has most of the necessary pieces:

```text
pre-trip governed source
→ FCO/FCG
→ frozen OfflineTravelBundle
→ local persistent context
→ local deterministic compliance
→ local Apollo/model if useful
→ strict validator
→ local wallet proposal/approval state
→ local OutcomeFCO / receipt
→ successor local state
```

While offline:

- saved medication/context can remain available locally
- saved synthetic directory/map points can remain available
- UNKNOWN remains visible for live stock, price, current hours, and live eligibility
- cloud sync is DEFERRED
- model inference is advisory
- wallet state can persist locally
- regulated purchase remains blocked
- user can prepare questions/actions for later connectivity

BP-0032/BP-0033 demonstrate that a physical iPhone can run the Apollo model while Airplane Mode is visibly enabled and Wi-Fi disabled. The observed raw model reply missed the strict summary code and was rejected; this is evidence that local inference does not automatically become admitted state.

Still missing for issue #3 closure:

- complete Baymax app UI running this flow on the physical phone
- app restart/persistence on the physical phone
- exact model-response bytes delivered into the validator rather than visual transcription
- an independent network-reachability probe
- optional native/local-model integration rather than manual Apollo transfer

## 6. Bali travel custody — after internet returns

Internet restoration should append evidence rather than replace local state:

```text
offline local successor state
→ connectivity restored
→ live public/provider evidence request
→ explicit source/provenance FCO
→ deterministic disclosure gate
→ optional Mastra/Neon/Fly execution
→ response identity + receipt
→ correctness/UNKNOWN classification
→ explicit admission event
→ new successor FCG state
→ optional remote parity/anchor
```

Remote services augment custody; they do not rewrite the offline history.

For a future wallet/Fly synchronization:

```text
phone-root state
→ bounded signed delegate update
→ Fly observes/acts within delegated scope
→ response/outcome receipt
→ phone verifies and admits
→ successor wallet checkpoint
```

If the phone and Fly diverge, preserve the fork and require reconciliation. Do not silently select the cloud copy.

## 7. Upstream main versus our plan

Observed upstream main: `63f58143348b6a08504df86a55bb6ea112822144`.

Recent main work now includes:

- Postgres-backed demo user / records / chat history and care-space persistence.
- fitness/activity onboarding and dashboard, merged through PR #17.
- Exa/search and richer agent/UI integration.
- Baymax PWA and mobile reminder demo, merged through PR #10.
- follow-up health data/PDF report work merged through PR #16.

Open PR #20 adds an Apple Health Shortcut adapter with consent, hashed connection keys, revocation/deletion, bounded normalization, missing-as-unknown semantics, and suppression of synthetic fallback for connected users. Its own PR states that a first physical-iPhone Health run is still required.

This aligns with the architecture if Apple Health is treated as another source adapter:

```text
Apple Health personal source
→ bounded import / normalization
→ source FCO
→ FCG
→ persistent private context
```

It must remain distinct from the public synthetic demo lineage.

Open PR #18 contains an older iPhone/Apollo integration lineage and currently conflicts with main. Do not force-merge it. Reconcile current upstream UI with the smaller, verified artifacts from the canonical integration branch.

## 8. What we built versus the plan

### Supported / executed

- deterministic compliance boundary
- append-only breakpoint/chain custody
- local Liquid model experiments
- persistent synthetic wallet + approval and adversarial tests
- pinned/reproducible Synthea synthetic generation
- FHIR→FCO/FCG provenance structure
- offline iPhone bundle + Swift loader
- physical iPhone Apollo generation
- Airplane Mode/Wi-Fi-off local inference observation
- deterministic rejection of a real out-of-contract model reply
- exact recording custody
- Playwright/WebKit mobile UI evidence
- synthetic sponsor inference probes

### Partial

- issue #3 Offline-first AI: local inference proven; integrated physical Baymax app offline E2E not yet proven
- issue #4 Privacy compliance: strong prototype controls; full deletion/retention/consent integration still partial
- Apple Health: implementation PR exists; first real iPhone Health run still needed
- FCG: provenance/data mapping exists; full clinical semantics/correctness are not established
- hosted sponsor control plane: partial

### Not tested / deferred

- real Fly.io wallet replica
- actual wallet network failover/rejoin
- Signet
- Secure Enclave wallet root
- physical Baymax app restart persistence
- magicSTUDIO heavy-model lane in this repo
- clinical correctness / validation
- HIPAA compliance certification
- autonomous prescription purchase

## 9. Fastest gap-closure plan

1. **Validator parity:** merge/reimplement the Codex PR #5 capture verifier and Claude PR #4 adversarial vectors into one canonical Swift/Python vector corpus. Require exact parity.
2. **Physical Baymax app:** install the signed app on the phone, load the frozen offline bundle, enter Airplane Mode, restart the app, and show local context/UNKNOWN/deferred states.
3. **Exact response capture:** save Apollo's raw JSON response bytes and feed those exact bytes through the production validator; do not rely on visual transcription.
4. **Wallet persistence:** demonstrate an offline synthetic wallet proposal/approval/checkpoint, restart, and recovery on-device. Keep prescription purchase blocked.
5. **Reconnect:** restore internet and demonstrate that live evidence or sync creates a successor receipt rather than replacing the offline state.
6. **Fly optional:** only after the local flow passes, deploy a synthetic Fly replica/delegate, test offline divergence + rejoin/fork detection, and admit the receipts.
7. **Apple Health optional/private:** separately execute PR #20's first physical-device check with no personal measurements committed.
8. **Upstream merge:** reconcile against current `upstream/main` in a clean integration worktree; do not force-merge PR #18's historical branch.
9. **External verification:** Claude re-runs the final adversarial/custody suite; Codex re-runs reproducibility/build/UI tests; primary lane admits the successor.

## 10. Claim ceiling

We can now demonstrate a chain of custody that survives an offline travel interval conceptually and in several executed components: the data, FCG, local context, local model, deterministic gate, wallet policy, and recording custody are independently inspectable.

We cannot yet claim that the complete Baymax app plus persistent wallet has been executed end-to-end through a Bali offline→online transition, or that a real Fly.io wallet replica performed a synchronized action.

Those remain the next empirical gates.

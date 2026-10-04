# Baymax Medical PA — Canon

## Identity

- Repository: `biobitworks/baymax-medical-pa`
- Upstream: `jerelvelarde/baymax-medical-pa`
- Product role: privacy-first personal health / longevity agent prototype
- Governance substrate: Vita-style FCO/FCG + ordered Merkle breakpoints
- Brand state: `BAYMAX = HACKATHON/INTERNAL CODENAME; PUBLIC BRAND/IP REVIEW REQUIRED`

## Canonical architecture

`source/observation → compliance context → Atom/FCO → typed FCG → bounded context → model/tool execution → guarded decision → authorized action → observed outcome → successor state`

Models, databases, clouds, agent frameworks, browsers, and hardware are replaceable execution substrates. They are not the source of truth.

## State semantics

Always distinguish:

`PROPOSED ≠ IMPLEMENTED ≠ EXECUTED ≠ OBSERVED ≠ SUPPORTED`

Also preserve:

`FAILED, NULL, NEGATIVE, DEFERRED, NOT_TESTED, UNKNOWN, NOT_COMPUTED, BLOCKED`

## Evidence gates

Keep separate:

- IDENTITY
- AUTHENTICITY
- DETERMINISM
- PROVENANCE
- CORRECTNESS
- EMPIRICAL_MEASUREMENT
- INDEPENDENT_VERIFICATION

A hash identifies declared bytes. It does not establish truth, medical correctness, authorship, authorization, causality, or regulatory compliance.

## Medical/privacy boundary

Until a deployment-specific legal, security, vendor, and organizational review is complete:

- real PHI entering external model/search/tool providers: `BLOCKED`
- real PHI in public repositories, logs, analytics, or immutable public receipts: `BLOCKED`
- medication/treatment changes without licensed-clinician authority: `BLOCKED`
- diagnosis as established fact from model output: `BLOCKED`
- synthetic demo data: `ALLOWED`
- local-only bounded wellness reasoning: `CANDIDATE`
- de-identified/minimized external research: `CANDIDATE`, subject to policy gate

## Sensitive data rule

Raw sensitive content belongs in a deletable/encrypted content plane. Append-only breakpoints commit to control decisions, opaque identifiers, ciphertext/object identities, and public-safe receipts—not plaintext PHI.

## Breakpoint rule

A breakpoint Merkle root may be declared only when:

1. exact artifact paths are listed;
2. exact bytes exist;
3. leaf ordering and construction are declared;
4. the root is computed;
5. an independent verifier recomputes it from disk.

MMR is a separate future append-only history layer and remains `NOT_COMPUTED` until implemented and verified.

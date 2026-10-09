# Antigense / Baymax 043 — deterministic pre-egress search gate

## Identity and custody
Repository: biobitworks/baymax-medical-pa (user-owned fork), based on distinct public upstream jerelvelarde/baymax-medical-pa.
Original upstream commit: 9f154abed3ee0d9c6d744742de81644540e12cae.
Intervention branch: codex/baymax-exa-egress-043.
Target: src/mastra/lib/exa-search.ts. Only synthetic payloads and mocked transport used.
Actor: GPT-6 / Desktop Commander. HUMAN-REQUESTED AGENT-ASSISTED IMPLEMENTATION, not autonomous Akash patch execution.

## Baseline and observed counterexample
The original Zod search query schema accepts any trimmed 1–500 character string.
The instruction to use general search terms existed only in schema descriptions, agent tool text, and comments, while searchExa forwarded the parsed query unchanged.
A synthetic negative control included alice@example.invalid; the mocked fetch observed the full input, without an actual external network request. Baseline gate result: NEGATIVE.

## Intervention
1. Add a deterministic assertGeneralExternalSearchQuery gate before accessing Exa credentials or invoking fetch.
2. Reject high-confidence email, phone, patient-record identifier, first-person treatment/medication context, multiline and excessive-length queries.
3. Apply bounded Unicode normalization and percent-decoding to detect selected encoded variants.
4. Validate optional includeDomains as bare hostnames rather than forwarding arbitrary strings.
5. Reject with generic errors that do not echo sensitive source strings.
6. Retain generic pharmacy-search capability with normal request metadata.

## Executed controls
- Initial upstream existing tests: 5/5 PASS.
- Original synthetic privacy counterexample: identifiable query reached mocked transport (NEGATIVE).
- First repair attempt: percent-encoded-email negative control FAILED (1 of 8 new tests), preserved as a meaningful red result.
- After bounded normalization fix: 8/8 new controls PASS; 5/5 original Exa tests PASS.
- Final standard npm run test:search: 20/20 PASS (including seven existing web-search UI tests).
- Script output: no real Exa, medical-provider, payment, database or cloud deployment request executed.
- Code diff validation: git diff --check PASS.
- Historical upstream breakpoint verifier: FAIL in untouched checkout as well as successor, because older artifact descriptors and current files differ. Old roots are not rewritten.

## Evidence ceiling and unresolved
SUPPORTED: a bounded set of synthetic identifiable search queries is refused before a mocked external transport, while a general query is preserved. Code change and regressions are reproducible locally.

NOT SUPPORTED: exhaustive PHI detection; HIPAA compliance; safe handling of every possible natural-language disclosure; encrypted/obfuscated alternatives beyond the tested patterns; medical decision support safety; other provider/tool leakage paths; full-stack deployment. Pattern-only detection can produce both false positives and false negatives.

Semgrep Multimodal: NOT_TESTED on this Baymax lane.
Akash: NOT_EXECUTED in this lane (historical Antigense inference is a separate occurrence).
ClickHouse Cloud: NOT_INGESTED in this lane.
Production deployment: NOT_TESTED.
Real patient data: NOT_USED.
Cryptographic signature: NOT_SIGNED.
MMR: NOT_COMPUTED.

## Next gate
Use a frozen synthetic privacy corpus with direct identifiers, quasi-identifiers, linguistic variants, encoded transformations and deliberately generic controls. Compare deterministic baseline, Semgrep Multimodal/Guardian if actually accessible, Akash-generated candidate patches, and independent behavioral oracles. Record detection sensitivity, false positives, patch acceptance, regressions, latency, model/token/cost envelope and abstentions. Enforce policy at the final egress sink rather than trusting model self-reports.

New breakpoint 044 will bind the exact committed source/test files. Its parent historical breakpoint pointer is REFERENCED_ONLY / VERIFICATION_FAILED; a new root cannot repair historical bytes.

# Baymax HIPAA / Neon Technical Qualification

Date: 2026-10-04
Branch: `execution/hipaa-neon-qualification`
Base: `0330c35c61866a9d4046fb7b2ad1c85190d9bfdf`

## Claim boundary

This tranche is a technical readiness experiment using `CONTROLLED_SYNTHETIC_PHI_SHAPED` data only. It does **not** establish that Baymax is HIPAA compliant.

`HIPAA_COMPLIANCE=NOT_VERIFIED`
`REAL_PHI=BLOCKED`

Public Neon security/compliance statements are tracked separately from exact Baymax account/configuration evidence.

## Exact configured Neon execution

Observed against the database credentials available on magicPRO:

| Gate | State | Evidence |
|---|---|---|
| Database connect | OBSERVED | controlled roundtrip receipt |
| Controlled create/read/update/delete | PASS_OBSERVED | exact source/readback/successor digests recorded |
| Logical deletion | PASS_OBSERVED | row count zero after delete |
| Schema cleanup | PASS_OBSERVED | probe schema absent after drop |
| Client TLS | PASS_ENCRYPTED_CHANNEL_OBSERVED | libpq SSL in use on configured and unpooled endpoints |
| TLS peer identity verification | UNKNOWN | DSN uses `sslmode=require`, not `verify-full` |
| Database role least privilege | FAIL/RISK | current role is non-superuser but has create-role, create-db, replication, and bypass-RLS capabilities |
| Control-plane ↔ database project identity | NOT_MATCHED | database endpoint hash differs from the sole control-plane endpoint hash |
| BAA present | BLOCKED_HUMAN_VERIFICATION | no signed account agreement inspected |
| HIPAA feature/account state | UNKNOWN | not established for exact account/project |
| Application-level payload encryption | NOT_IMPLEMENTED_OBSERVED_CURRENT_TRACKED_CODE | static tracked-code gate |
| Keychain / Secure Enclave / file protection | NOT_IMPLEMENTED_OBSERVED_CURRENT_TRACKED_CODE | static tracked-code gate |
| Provider audit-log inspection | UNKNOWN | no complete Neon log surface inspected |
| Database activity canary | FAIL | controlled canary visible in `pg_stat_activity` |
| Backup/PITR purge semantics | UNKNOWN | logical deletion does not prove backup purge |

Primary execution receipt:

`evidence/receipts/hipaa/neon_qualification_attempt4.json`

Failure history:

`evidence/receipts/hipaa/neon_qualification_attempts.json`

## Canary finding

A unique controlled marker was used only for the database exposure test. The plaintext marker itself is not persisted in the receipt; only its SHA-256 digest is retained.

The marker was visible in PostgreSQL activity while the controlled query was executing:

`CANARY_IN_PG_STAT_ACTIVITY=true`

This is a **real execution observation**, not a synthetic result. It does not prove that Neon platform logs retained the value, but it proves that plaintext query values can enter a database-observable activity surface on this path.

Therefore:

`LOG_LEAK_TEST=FAIL_DB_ACTIVITY_EXPOSURE + UNKNOWN_PROVIDER_LOG_SURFACES`

and:

`REAL_PHI_EXTERNAL=BLOCKED`

## Minimum-necessary AI context

Implemented and executed a deterministic context constructor whose disclosure allowlist is code-controlled. Natural-language instructions cannot widen the allowed fields.

Adversarial instructions tested:

- include the entire patient record
- include raw medications
- include identifiers
- ignore privacy policy

All remained constrained to the explicit fields:

`diagnosis_code`, `value`

Targeted policy/context tests: **8/8 PASS**.

Raw PHI without a verified provider contract routes `LOCAL_ONLY`. The Neon AI Gateway was **not** invoked with raw PHI.

Receipt:

`evidence/receipts/hipaa/minimum_necessary_context.json`

## Encryption boundary

Tracked implementation-code inspection found hashing use only; no application-level health-payload encryption, Keychain, Secure Enclave, Apple file-protection, key-rotation, or key-deletion implementation was found in the current tracked code.

Receipt:

`evidence/receipts/hipaa/application_encryption_gate.json`

This does not negate Neon platform encryption. It means Baymax currently lacks an independently controlled application encryption layer for the sensitive payload.

## Vendor public baseline — not account proof

Neon publicly states that it offers HIPAA-capable service, requires a BAA for HIPAA customers, uses TLS 1.2+ in transit, AES-256 at rest, managed key systems, audit logging, and encrypted backups.

Sources:

- https://neon.com/blog/hipaa
- https://neon.com/security
- https://neon.com/hipaa-contractors

These statements are recorded only as `PUBLIC_VENDOR_DOCUMENTATION`. They do not establish that the exact Baymax account/project has a signed BAA or HIPAA configuration enabled.

Receipt:

`evidence/receipts/hipaa/neon_vendor_public_baseline.json`

## Compensatory controls

| Missing / failed control | Compensating control | Residual risk / claim ceiling |
|---|---|---|
| Verified BAA absent | block real PHI from Neon | contractual authorization remains unknown |
| Application-level encryption absent | controlled synthetic PHI-shaped data only | provider/database can see plaintext test fields |
| Canary visible in database activity | no real PHI; fail closed | provider log/trace exposure remains unresolved |
| Privileged database credential | do not admit production PHI | least-privilege path not established |
| Control-plane/database identity mismatch | do not claim exact account qualification | database credential and API credential custody relationship unresolved |
| Complete audit-log inspection unavailable | classify log gate PARTIAL/FAIL, not PASS | provider-side retention remains unknown |
| Clinical validation absent | model authority NONE | technical privacy evidence does not establish medical correctness |

## Issue #4 impact

Material technical evidence now advances:

- #24 sponsor/BAA qualification: **PARTIAL / BLOCKED**
- #27 storage/external-processing choices: **PARTIAL**, real PHI remains blocked
- #28 minimum necessary/external disclosure: **PASS for deterministic field gate; raw-PHI gateway blocked**
- #30 log/trace leakage: **FAIL** on database activity canary; provider logs still UNKNOWN
- #31 transport/encryption/secrets: **TLS observed; application encryption/key controls FAIL**
- #32 deletion: **logical row/schema deletion PASS; backup/PITR purge UNKNOWN**

## Claim ceiling

Strongest supported claim:

> The exact configured Baymax Neon database endpoint executed the defined controlled PHI-shaped technical tests. TLS and logical deletion were observed, minimum-necessary routing passed, and compensating controls remain active. Qualification is not admitted for real PHI because the canary is visible in database activity, the database role is highly privileged, control-plane/database project identity does not match, no application-level encryption is implemented in the current tracked tree, and the exact BAA/account HIPAA state is not verified.

`HIPAA_COMPLIANCE=NOT_VERIFIED`

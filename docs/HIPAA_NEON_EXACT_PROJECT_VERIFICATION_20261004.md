# Baymax exact Neon HIPAA-readiness requalification — 2026-10-04

Target: Neon project `cold-rice-87700506` (`bay-max`), branch `br-falling-block-b5qoil65` (`production`).

## Result

**FAIL_CLOSED_NOT_QUALIFIED_FOR_REAL_PHI**

The target project/branch identity is now proven, and a successful `sslmode=verify-full` connection using an explicit CA bundle negotiated TLS 1.3 with `TLS_AES_256_GCM_SHA384`. Controlled create/read/update/delete and logical cleanup passed. Minimum-necessary routing passed all five adversarial instructions. A fresh controlled canary was absent from the queried Neon `pg_endpoint` log window.

Real-PHI promotion remains blocked because:

- Neon control-plane setting `hipaa=false`;
- signed/active BAA and scope were not independently inspected;
- role `neondb_owner` has `CREATEROLE`, `CREATEDB`, `REPLICATION`, and `BYPASSRLS`;
- RLS is ineffective for that role because `BYPASSRLS=true`;
- the parameterized controlled marker appears in `pg_stat_activity` SQL text;
- the tracked health/conversation persistence path has no application AEAD envelope or Keychain/Secure Enclave/key rotation/deletion implementation;
- active row/schema deletion passed, but backup/PITR/provider-retention purge is not verified; account history retention is 86400 seconds;
- current Baymax `DATABASE_URL` hashes to a different endpoint than the tested target project.

## Identity

PROJECT_MATCH=PASS
BRANCH_MATCH=PASS
ENDPOINT_MATCH=PASS
REGION_MATCH=PASS
BAYMAX_RUNTIME_TARGET_BINDING=FAIL

## HIPAA / contract state

HIPAA_FEATURE_PRESENT=PASS
HIPAA_FEATURE_ENABLED=FAIL_FALSE
BAA_STATE=BLOCKED_HUMAN_VERIFICATION
BAA_SCOPE_STATE=UNKNOWN
ACCOUNT_ELIGIBILITY=UNKNOWN

Neon's public materials state that HIPAA customers must execute a BAA and describe platform-level HIPAA/security controls. Those vendor-level statements are supporting baseline evidence only and do not prove this account/project's contract or configuration.

## TLS / RBAC

TLS_ENCRYPTED=PASS
TLS_PEER_IDENTITY=PASS_VERIFY_FULL_CERT_HOSTNAME
TLS_VERSION=TLSv1.3
CIPHER=TLS_AES_256_GCM_SHA384
RBAC=FAIL
SUPERUSER=false
CREATEROLE=true
CREATEDB=true
REPLICATION=true
BYPASSRLS=true
LOGIN=true
RLS_EFFECTIVE=NO

## Controlled canary / logs

CANARY_IN_ROW=YES
CANARY_IN_SQL_TEXT=YES_FAIL
CANARY_IN_PG_STAT_ACTIVITY=YES_FAIL
CANARY_IN_NEON_PROVIDER_LOGS=NO_IN_QUERIED_WINDOW
CANARY_TRACES=UNKNOWN
APPLICATION_LOGS=NOT_TESTED_STANDALONE_PROBE

No plaintext canary is persisted in Git; receipts contain its SHA-256 only.

## Encryption / key custody

NEON_AT_REST=PARTIAL_VENDOR_DOCUMENTED_ACCOUNT_SPECIFIC_NOT_VERIFIED
APPLICATION_PAYLOAD_ENCRYPTION=NOT_IMPLEMENTED_OBSERVED_TRACKED_STORAGE_PATH
DEVICE_FILE_PROTECTION=NOT_IMPLEMENTED_OBSERVED_TRACKED_APP_PATH
KEYCHAIN=NOT_IMPLEMENTED_OBSERVED_TRACKED_APP_PATH
SECURE_ENCLAVE=NOT_IMPLEMENTED_OBSERVED_TRACKED_APP_PATH
KEY_ROTATION=NOT_IMPLEMENTED_OBSERVED_TRACKED_APP_PATH
KEY_DELETION=NOT_IMPLEMENTED_OBSERVED_TRACKED_APP_PATH

## Disclosure and deletion

MINIMUM_NECESSARY=PASS
AI_DISCLOSURE_GATE=PASS_FAIL_CLOSED
LOGICAL_DELETE=PASS_ACTIVE_ROW_AND_SCHEMA
BACKUP_DELETE=UNKNOWN
PITR_DELETE=UNKNOWN_NOT_EXECUTED
RETENTION=PARTIAL_HISTORY_RETENTION_86400_SECONDS_PROVIDER_RETENTION_UNKNOWN
NEON_DELETION=PASS_LOGICAL_PARTIAL_OVERALL

## Claim ceiling

Baymax is **not** claimed HIPAA compliant. This exact target deployment did **not** pass all required real-PHI gates.

`HIPAA_READY_TEMPLATE=PARTIAL_FAIL_CLOSED`
`HIPAA_COMPLIANCE=NOT_VERIFIED`
`REAL_PHI=BLOCKED`

The positive template result is that missing deployment prerequisites are detected and promotion is blocked rather than silently allowed.

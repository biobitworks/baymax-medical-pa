# Baymax Team Handoff

Project: `baymax-medical-pa`

Local repo: `/Users/byron/projects/active/baymax-medical-pa`

Team branch: `redteam/bp-0006-model-wallet`

Biobitworks remote: `https://github.com/biobitworks/baymax-medical-pa.git`

Upstream: `https://github.com/jerelvelarde/baymax-medical-pa.git`

## Pull

```bash
git fetch origin
git switch redteam/bp-0006-model-wallet
git pull --ff-only origin redteam/bp-0006-model-wallet
```

Recover exact HEAD/worktree before mutation. Do not rewrite admitted breakpoints.

## Local credentials

Use only the ignored local file:

`/Users/byron/projects/active/baymax-medical-pa/.env`

It is mode `600`, Git-ignored, and untracked. Never commit it or print/log/hash secret values.

Expected variable names currently include `NEON_API_KEY`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AI_GATEWAY_BASE_URL`, `NEON_AI_GATEWAY_TOKEN`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `NEON_BRANCH`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, and `EXA_API_KEY`.

Credential receipts may record only variable name plus `PRESENT`/`ABSENT` and safe metadata.

## Current custody state

Externally pushed custody anchor immediately preceding this handoff-document correction: `BAYMAX-BP-0014`.

BP-0014 Merkle root: `350f2ece7b680b096254000d5d1bedb0ecf50bde702b3ef34e5466fc6243a3dd`

BP-0014 chain head: `3650351d94563a9b55eccefee4bbc6be2e35d559f84580238563f0722c501c4a`

This document is expected to be admitted by a successor breakpoint; therefore it intentionally names its parent anchor rather than claiming its own future root.

`verify_chain.py` is authoritative for current custody semantics. `MMR_STATE=NOT_COMPUTED`. Git signing remains `BLOCKED_HUMAN_SIGNING_SETUP`.

## Observed Neon state

Synthetic-only validation: Postgres insert/read/delete PASS; Auth public JWKS PASS but full sign-in NOT_TESTED; AI Gateway catalog PASS; a request-shape failure was preserved in BP-0011 and repaired in BP-0012; object-storage write/read/delete on `medical-records` PASS. Real PHI external execution remains BLOCKED.

Upstream `neon.ts` is fetched/reviewed but not admitted to this active branch. Its package manifest does not currently declare the imported `@neon/config` dependency, so do not claim it builds here without an explicit integration successor.

## Local models

Liquid LFM2.5 350M, 1.2B-Instruct, and 2.6B are present locally. The tested routing task produced NEGATIVE results; bounded 1.2B synthesis had a limited PASS under a weak deterministic check. No local model is `VALIDATED`.

## Gates before remote commit

Run tests, `git diff --check`, tracked/staged secret scan, prove `.env` ignored/untracked, run `verify_chain.py`, preserve any failure as a successor, and push authorized work to the Biobitworks fork unless explicitly authorized otherwise.

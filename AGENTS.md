# Agent operating contract

Read `CANON.md` before mutation.

## Before mutation

1. Verify repository root, branch, HEAD, remotes, and worktree.
2. Recover the latest breakpoint.
3. Treat upstream and predecessor repositories as external lineages unless an exact file is deliberately imported under verified rights.
4. Never print, commit, or transmit credentials or raw medical/personal data.

## Execution priority

`DETERMINISTIC POLICY → LOCAL COMPUTE/MODEL → DE-IDENTIFIED EXTERNAL → CONTRACTED EXTERNAL → HUMAN/CLINICIAN REVIEW`

Do not let an LLM decide its own compliance eligibility.

## Medical/privacy rules

- Use synthetic data unless an explicit real-data authorization and deployment policy exists.
- Do not send raw PHI, personal health data, trade secrets, or private prompts to a provider whose exact account/contract/configuration is not approved.
- No model is a medical authority.
- UNKNOWN/ABSTAIN is valid.
- Model output is provisional until a deterministic/action gate admits it.

## Breakpoint workflow

After a meaningful tranche:

1. run tests;
2. run secret scanning where available;
3. run `git diff --check`;
4. create a breakpoint with `python3 scripts/create_breakpoint.py ...`;
5. verify all breakpoints with `python3 scripts/verify_breakpoints.py`;
6. commit the successor state;
7. push only to an authorized remote.

Never edit a historical breakpoint to make history cleaner. Corrections create successors.

## Environment files and secrets

| File | Tracked in git | Contains |
| --- | --- | --- |
| `.env` | Yes, committed | Non-secret defaults only (`NEON_BRANCH`, `AWS_REGION`) |
| `.env.local` | No, gitignored | All real credentials and local overrides |
| `.env.example` | Yes, committed | Variable names with empty or placeholder values |

Scripts load both files, with `.env.local` taking precedence:
`--env-file=.env --env-file-if-exists=.env.local`.

- **Never put a credential in `.env`.** Do not copy `.env.local` into `.env`,
  and do not add database URLs, tokens, API keys, or passwords to it.
- New secret variables go in `.env.local`; add the name, with an empty value,
  to `.env.example`.
- `.env` is required by the scripts. If it is missing or modified, run
  `git restore .env`.
- Do not print, log, or paste the values from `.env.local`.

## Git

- Stage named paths only. Never use `git add .`, `git add -A`, or `git commit -a`.
- Before committing, check `git status` and confirm no `.env*` file other than
  `.env.example` is staged.
- If a credential is pushed, deleting the file is not enough: rotate it
  immediately.

## Shared cloud resources

The team shares one Neon database and AI Gateway.

- Do not run `npm run db:migrate`, `npm run db:seed`, `npm run test:live`, or
  `POST /demo/reset` unless the user explicitly asks. Patrick owns database
  migrations.
- Do not open, close, merge, or comment on GitHub pull requests unless asked.
- Local-only work (install, `npm test`, typecheck, starting dev servers) is fine.
- Use synthetic health data only.

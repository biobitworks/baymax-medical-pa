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

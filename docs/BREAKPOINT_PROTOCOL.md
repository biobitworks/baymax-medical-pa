# In-turn breakpoint protocol

Baymax uses ordered Merkle breakpoints to make work inspectable. Conversation turns themselves are not assigned cryptographic identities unless exact canonical bytes are available.

## Turn input capture

For a substantive user turn:

1. create a **sanitized semantic input receipt** under `evidence/turns/`;
2. remove credentials, session/device identifiers, private medical data, emails, and unnecessary personal information from public artifacts;
3. state whether the capture is byte-exact or semantic;
4. preserve the source class (`user_chat`, file, external repo, public documentation, etc.).

A hash of a sanitized receipt commits only to the sanitized receipt, not to the original chat bytes.

## Work receipt

Preserve:
- repo/branch/base HEAD
- upstream identities
- failed attempts
- implemented files
- executed tests
- observed outputs
- claim limits
- unresolved items

## Merkle construction

Current algorithm: `baymax-ordered-merkle-v1`.

For each declared artifact in explicit argv order:

```text
descriptor = canonical_json({path, bytes, sha256(file_bytes)})
leaf       = SHA256(0x00 || SHA256(canonical_json(descriptor)))
node       = SHA256(0x01 || raw(left) || raw(right))
odd node   = promoted unchanged
```

The breakpoint stores artifact descriptors, leaf hashes, construction, order, and root. `scripts/verify_breakpoints.py` recomputes from current disk bytes.

## Meaning

A valid breakpoint supports:
- exact declared artifact identity
- declared ordering
- tamper detection relative to the stored commitment

It does **not** establish:
- truth
- medical correctness
- authorship
- user identity
- legal authorization
- HIPAA compliance
- scientific validity

## Successors

Never silently rewrite an admitted historical breakpoint. New work or corrections produce a successor breakpoint.

## MMR

MMR is a separate ordered history commitment. It must remain `NOT_COMPUTED` until its leaf semantics, ordering, append algorithm, persistence, and independent verification are actually implemented.

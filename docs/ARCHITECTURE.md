# Baymax compliance-first architecture

## Golden path

```text
device / user / record / software observation
                  ↓
          identity + consent
                  ↓
        ComplianceContext
                  ↓
 data class / rights / purpose / intended use
                  ↓
         minimum necessary
                  ↓
     route: LOCAL | REDACT | CLOUD | BLOCK
                  ↓
       bounded ContextPacket
                  ↓
  deterministic calculation + optional model
                  ↓
       claim / safety ceiling
                  ↓
        human authorization
                  ↓
          bounded action
                  ↓
        observed outcome
                  ↓
     successor personal state
                  ↓
      FCO/FCG evidence graph
                  ↓
     ordered Merkle breakpoint
```

The Golden Path is the highest-supported, user-authorized, policy-compliant candidate path. It is not truth and it is not a guarantee of longevity benefit.

## Two data planes

### Sensitive content plane

Encrypted/deletable:
- raw HealthKit or wearable measurements
- clinical records
- medications/allergies
- free-text health notes
- personal values/private context
- identifying audio/transcript

### Audit/custody plane

Appendable and public-safe where appropriate:
- opaque subject/object IDs
- consent/purpose references
- policy version
- data classification
- provider/model identity
- request/response digests where safe
- decision/action/outcome states
- ciphertext/object digests
- deletion/tombstone events
- breakpoint receipts

A Merkle commitment never requires plaintext PHI to become permanent.

## Runtime layers

1. **Compliance kernel** — deterministic and authoritative for routing.
2. **Personal state / FCG** — persistent governed context.
3. **Model router** — replaceable Liquid/Mistral/Qwen/local/cloud lane.
4. **Evidence retrieval** — de-identified external query when allowed.
5. **Action gate** — explicit authority and consequence checks.
6. **Outcome + learning** — successor state; DAISy training is a separate governed trajectory.

## iPhone target

For an iPhone implementation:

`HealthKit/EventKit → Swift compliance kernel → local protected vault → ExecuTorch/Core ML model → user approval → privacy-safe cloud receipt`

Cloud services are optional augmentation, not the user's canonical memory.

# Compliance backend

Status: **DESIGN + MINIMUM DETERMINISTIC ROUTER IMPLEMENTED**

This prototype does not claim HIPAA compliance and is not approved for PHI.

## Mandatory preflight before every external execution

A request must resolve:

- actor / subject / tenant
- purpose of use
- intended user and intended medical/wellness function
- data classifications
- consent/authorization
- minimum-necessary transformation
- IP/license/trade-secret rights
- provider/service/model identity
- contractual/configuration eligibility
- retention/training/logging posture
- claim ceiling
- action authority

If any required high-risk field is unknown, fail closed or route local-only.

## Initial routing states

- `LOCAL_ONLY`
- `ALLOW_DEIDENTIFIED_EXTERNAL`
- `ALLOW_CONTRACTED_EXTERNAL`
- `HUMAN_REVIEW_REQUIRED`
- `BLOCK`

The initial Python router in `src/baymax_compliance/policy.py` is intentionally conservative. It is a prototype enforcement boundary, not a legal determination.

## High-risk content

Examples:
- PHI / identifiable health information
- genetic data
- biometrics
- precise geolocation
- credentials
- trade secrets / unreleased research
- medication/treatment instructions
- emergency or high-consequence medical actions

## Medical claim ceiling

Default MVP:
- organization and reminders: allowed
- general wellness support: bounded candidate
- health trend description: bounded, source-linked
- clinician question preparation: allowed
- diagnosis as fact: blocked
- medication/treatment change: human/clinician authority required
- emergency care replacement: blocked

## Deletion

Deletion of sensitive payloads must be possible without rewriting historical custody. A deletion successor event can retain:
- opaque object ID
- deletion policy/version
- deletion timestamp
- deletion verification state

while the actual sensitive bytes/key are removed from the content plane.

# Structural model admission

This side lane is based on `d4389ecfa7589c4e376d9be14658b9d4494f7fd5` (BP-0033). It allocates no BAYMAX-BP IDs and changes no historical breakpoint or chain entry.

Admission accepts only JSON with the exact six response keys, `summary=SYNTHETIC_CONTEXT_ONLY`, `medical_action=NONE`, `requires_clinician=true`, and bounded unique integer catalog IDs. BOMs, trailing commas, floating-point/exponent IDs, duplicate keys (including escaped and NFC-equivalent keys), unknown keys and free-form output are rejected. Rejection creates no inference FCO and grants no medical or wallet authority. The UI displays REJECT / ABSTAIN; editing a response invalidates any prior admission.

The original 87-vector corpus remains byte-identical. A separate 49-vector supplement covers strict syntax, metadata spoofing and field boundaries. Both files are hash-pinned in `scripts/check_model_parity.py`; changes require a successor corpus. Python verifies raw/base64 identity and unique vector IDs. Swift consumes those same base64 bytes without Foundation BOM normalization. Parity compares every expected admission state and the complete decoded selection, with exact vector coverage and order.

Run with writable caches while keeping HOME unchanged:

```sh
SWIFT_MODULECACHE_PATH=/tmp/baymax-swift-module-cache \
CLANG_MODULE_CACHE_PATH=/tmp/baymax-clang-module-cache \
python3 scripts/check_model_parity.py
PYTHONPATH=src python3 -m unittest discover -s tests -v
```

The frozen v2 packet and catalog remain byte-identical. Swift verifies the catalog file hash and binds all decoded fields to the hash-verified packet. Python binds the packet digest and canonical catalog digest; the catalog file digest is checked separately in tests/parity. Recorded catalog hashes identify the frozen file bytes, not a new serialization of the catalog.

Execution substrate, provider and model labels come only from caller-owned execution observations, outside the response parser. Host code must never populate these parameters from model content. Human-entered observations remain HUMAN_REPORTED_UNVERIFIED; these fields do not authenticate the provider or admit it for sensitive data. Model revision defaults to UNKNOWN. No response key can set identity, validator state, policy eligibility or authority. Wallet state and clinical source data remain unchanged.

The observed Apollo response in the existing airplane-mode receipt remains CONTRACT_FAIL: its summary is SYNTHETIC DEMO ONLY. The regression compares the corpus response to that receipt's visual transcription. It does not claim exact clipboard capture, packet destination identity, independent network reachability or a newly executed physical-device flow.

Evidence for this run is in `evidence/receipts/parallel/CODEX-LANE-MODEL-ADMISSION-STRICT-001.json`. Prior implementation failures are retained separately. An unsigned iPhoneOS build establishes compilation only. Clinical correctness remains UNKNOWN; REAL_PHI=NONE, REAL_MONEY=NO, PRESCRIPTION_PURCHASE=BLOCKED.

# iPhone / Apollo review packet

State: PARTIAL. Synthetic demo only; medical correctness UNKNOWN.

[User-authorized recording](apollo-local-model-2026-10-04.mov) shows a mirrored iPhone displaying model generation and a structured response. LTE is visible. Airplane mode, offline inference, exact installed model identity, and exact copied response bytes were not observed. The model header is truncated (`LFM2.5-1… Q5_K_M`); do not infer its full identity.

Video: 9,014,548 bytes; SHA-256 `ef8b2d2b1d90bfd838d4a1e9be4ef3937b15b45b25d474375ea232c1ff1fc12b`.

## Review order

1. `ios/README.md`: build, signing-team selection, phone handoff and manual Apollo transfer.
2. `ios/OfflineTravelDemo/OfflineTravelApp.swift`: synthetic/offline indicators, consent, UNKNOWN facts, provenance, local simulated wallet and validated model rendering.
3. `fixtures/iphone/apollo_context_packet_v2.txt` and `apollo_catalog_v2.json`: frozen minimum-necessary context. Apollo selects integer identifiers; rendered facts come from the trusted catalog.
4. `src/baymax_travel/model.py` and Swift `ModelInference.swift`: reject extra keys, free prose, duplicate keys, invalid IDs and medical actions. Model inference is provisional, authority NONE and correctness UNKNOWN.
5. `tests/` and Swift `GateCheck.swift`: schema rejection, UNKNOWN preservation, wallet isolation, prescription-purchase blocking and bundled-data flow without network.
6. `evidence/receipts/iphone/`: build, gate and recording receipts. The failed initial build is retained alongside successful repaired-build evidence.

## Scope and limits

The iPhone target builds unsigned against the installed iPhoneOS SDK. It still requires a signing team for installation. Apollo is a manual copy/paste fallback; native LEAP integration and inter-app API integration are not implemented. The bundled-data path needs no cloud provider. Wallet state is a local synthetic simulation; Fly.io deployment, live payment/purchase, autonomous calling and pharmacy stock remain unverified or blocked. No HIPAA certification or medical correctness is claimed.

The Codex mirror branch and concurrent integration branch independently allocated BP-0028. Their historical receipts remain intact: the mirror breakpoint is retained under `evidence/lineage/`, while this release continues the integration chain after BP-0029. BP-0021 is unchanged. Actor signatures, Git signatures, Merkle identity and remote parity are separate gates.

Current chain verification checks historical descriptors and current admitted leaves. The older all-file verifier reports pre-existing historical leaf drift; this remains a disclosed limitation, not a corrected history.

## Remaining phone acceptance run

Install the signed app, record the exact Apollo model, enter airplane mode, transfer the frozen packet, copy exact response bytes back into the validator, and record successful validation plus unchanged wallet state. Preserve a successor receipt with observed network state and response hash. Until then, offline Apollo inference is NOT_TESTED.

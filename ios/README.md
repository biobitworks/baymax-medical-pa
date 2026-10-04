# iPhone offline mirror — Apollo v2

The app is ready for a teammate to sign and install. Local-model fallback uses manual transfer to Liquid Apollo; no native model SDK or inter-app API is implemented. Physical execution and the exact available Apollo model remain unobserved.

## Open and run

1. Open `OfflineTravelDemo.xcodeproj` in Xcode. Select the OfflineTravelDemo target, your signing team, and connected iPhone. Minimum iOS version: 17.
2. Build/run. Allow synthetic context and load it. Review medication/travel context, synthetic directory/map, wallet snapshot, provenance, UNKNOWN states and deterministic compliance results.
3. Turn on airplane mode and explicitly turn Wi-Fi/cellular off. The network badge observes connectivity; Force offline demo only changes policy routing and is not proof the phone is offline.
4. Repeat loading: it uses bundled resources only. Cloud/Fly/calls remain DEFERRED; medication purchase is BLOCKED. Wallet is a read-only synthetic snapshot, with no real funds or signing authority.
5. Revoke consent or clear the loaded context to clear the session. Offline-demo and pack-reviewed preferences persist locally; consent and model output do not. The bundled synthetic source remains installed.

## Apollo local-model fallback

Install Apollo and download a compatible local model while online. Record the exact model name and runtime version visible on the phone. Do not assume a model list. Do not use OpenRouter or a cloud provider for the offline test.

Copy synthetic context for local model in the app. The clipboard is local-only and expires after ten minutes. Paste the complete v2 packet into Apollo, disable network tools, go offline, and run it. This is human-mediated transfer; destination byte identity is unverified.

The frozen v2 contract permits only integer selections from the admitted catalog, `summary=SYNTHETIC_CONTEXT_ONLY`, `medical_action=NONE`, and `requires_clinician=true`. Baymax renders local catalog text, not free-form model medical prose. Paste the exact response back, report the observed model/runtime/version, and mark offline execution only if you observed it. Runtime identity remains HUMAN_REPORTED_UNVERIFIED; network state is USER_ATTESTED. ModelInferenceFCO remains MODEL_INFERRED, correctness UNKNOWN, with no medical or wallet authority.

Capture the exact response, packet hash, model/version, device/iOS version, time and airplane-mode evidence in a new device-lane receipt. App preparation and a user's checkbox alone do not prove physical offline inference.

## Reproduce checks/build

- `PYTHONPATH=src python3 -m unittest discover -s tests -v`
- `python3 scripts/build_apollo_packet_v2.py` regenerates the deterministic v2 packet/catalog/receipt.
- `swiftc -parse-as-library fixtures/iphone/OfflineBundle.swift ios/OfflineTravelDemo/TravelModel.swift ios/OfflineTravelDemo/ModelInference.swift ios/OfflineTravelDemo/GateCheck.swift -o /tmp/baymax-mirror-gate`
- `/tmp/baymax-mirror-gate fixtures/iphone/OfflineTravelBundleFCO.json fixtures/iphone/offline_travel_bundle_v1.json fixtures/iphone/apollo_catalog_v2.json fixtures/iphone/apollo_context_packet_v2.txt`
- `scripts/build_iphone_demo.sh` builds an unsigned arm64 iPhoneOS app in a fresh temporary directory using the Xcode target and installed SDK. It preserves prior builds and prints the app path. Select a team and sign in Xcode before installing on a physical phone.

Historical v1 packet bytes and receipts remain available. Its generator uses `model_v1.py` and writes a separate reproduction receipt, preserving the old receipt. Use v2 for the current demo.

Native LEAP remains deferred. The provider-independent bundle and deterministic no-model interaction remain usable without any model runtime.

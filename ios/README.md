# Physical iPhone demo handoff

Actor: chatgpt-codex-synthea-v1. Base evidence: BAYMAX-BP-0021. Synthetic demo only.

## Open and build

1. Open `OfflineTravelDemo.xcodeproj` in Xcode.
2. Select the OfflineTravelDemo target, Signing & Capabilities, and your signing team. The bundle identifier is `works.biobit.baymax.offlinetravel.demo`; change it if your team requires a unique identifier.
3. If Xcode reports the iOS platform missing, install it in Xcode Settings > Components. Select your connected iPhone and build/run. Deployment target is iOS 17.
4. Allow the synthetic demo context and load it. Observe synthetic/offline badges, medication context, travel context, UNKNOWN, provenance, synthetic directory/map coordinates, model status and compliance result.
5. Enter airplane mode on the actual phone. Turn off Wi-Fi and cellular; ensure no connected network is available. The app's force-offline switch is a policy demo override, not evidence that the phone is physically offline. The network badge uses NWPathMonitor.
6. Load context again. Try cloud summary and Fly sync: DEFERRED. Medication purchase: BLOCKED. Wallet preview: LOCAL_ONLY, zero real funds, no signing. Revoke consent or clear context: session data is removed from memory. Bundled synthetic source is retained; this is not a general deletion-control implementation.

## Apollo contingency

Install Liquid Apollo and preload a compatible model while online. Do not assume any particular model is available. Record the exact model identifier Apollo displays. No OpenRouter or other cloud runtime belongs in this offline test.

Tap Copy synthetic context for Apollo after loading consented data. The packet is local clipboard-only and expires after 10 minutes. Transfer it manually to Apollo. There is no inter-app API integration. It has no direct patient/provider identifiers and includes only bounded synthetic context. Disable Apollo network tools/features, enter airplane mode and confirm Wi-Fi/cellular are off. Run the frozen packet with the selected local model.

Copy the exact JSON response back into the app, enter the observed model identifier, and attest airplane-mode execution only if you actually observed it. Validate. Malformed schemas, missing clinician flag and selected prohibited instruction markers are rejected. Accepted output remains provisional MODEL_INFERRED, medical_authority=NONE, correctness_state=UNKNOWN. This parser is a schema/bounds gate and conservative content-marker check, not a comprehensive clinical-safety validator. Model text cannot authorize a wallet action or overwrite source clinical FCOs.

Capture the model identifier, network state, start/time, exact response bytes, packet hash and screenshots as a new device-lane receipt. The in-app ModelInferenceFCO is session-only and HUMAN_REPORTED_MANUAL_TRANSFER; it is not an independently verified device receipt. Re-loading or receiving model output does not alter the immutable bundled dataset. No persistent model history or telemetry is implemented.

## Local verification

`python3 scripts/build_apollo_packet.py` regenerates exact packet bytes. `python3 scripts/build_offline_travel_fco.py` regenerates the bounded graph-derived FCO. `python3 scripts/generate_iphone_project.py` regenerates the project.

`PYTHONPATH=src python3 -m unittest discover -s tests -v` tests reproducibility, minimization, UNKNOWN preservation, schema rejection and wallet isolation.

`swiftc -parse-as-library fixtures/iphone/OfflineBundle.swift ios/OfflineTravelDemo/TravelModel.swift ios/OfflineTravelDemo/ModelInference.swift ios/OfflineTravelDemo/GateCheck.swift -o /tmp/baymax-travel-gate-check`

Run `/tmp/baymax-travel-gate-check fixtures/iphone/OfflineTravelBundleFCO.json fixtures/iphone/offline_travel_bundle_v1.json`. It decodes both bundles, validates response fixtures and runs all 24 consent/connectivity/action combinations with a provider-call counter of zero.

`scripts/build_iphone_demo.sh` compiles an arm64 simulator app directly against the installed SDK. It does not install a runtime or prove simulator/device execution. Normal physical-device build/signing uses the Xcode project above.

## Local-model investigation

Native LEAP was investigated first. The official SDK requires iOS 18+ and an explicit `.bundle` model, and is proprietary: https://github.com/Liquid4All/leap-ios. Its current API loads a bundle and streams chat. No model bundle or pinned SDK was integrated in this tranche; native LEAP remains DEFERRED. This avoids an untested SDK adapter in the physical-demo path. Apollo is the authorized separate local-model fallback: https://www.liquid.ai/apollo. Deterministic no-model context loading is the final fallback and requires neither SDK nor model download.

## Observed limitations

No physical device was found by devicectl. No simulator runtime is installed. Xcode destination selection reports iOS 26.1 platform not installed despite available SDKs. Device signing and execution, Apollo inference, exact available Apollo model, and native LEAP are NOT_TESTED. Current source compile and local Foundation contract tests do not establish physical offline execution or clinical correctness.

Historical BP-0023's four raw-fixture checks were skipped because the imported test still referenced the repo path. This successor corrects the local-only path and reruns them. BP-0023 and BP-0021 remain unchanged.

# Independent Codex Synthea lane

Base: origin/redteam/bp-0006-model-wallet, 780f80fd473c43d186a0fc00ab8ca1827336c1c7, BAYMAX-BP-0019. Shared worktree was dirty; none of its untracked evidence was imported. BP-0019 remains BLOCKED historical evidence. No remote divergence was observed at base selection.

The dedicated actor Ed25519 key remains outside Git with directory mode 0700 and key mode 0600. actor_admission.json uses sorted-key, compact UTF-8 JSON without a trailing newline. actor_signature.json signs those exact bytes. This proves actor key possession only. Git commits and the chain anchor remain unsigned.

The official v4.0.0 JAR SHA-256 matches GitHub release asset metadata. This is byte identity evidence, not an independently verified publisher signature. Apache-2.0 software LICENSE and NOTICE were fetched at the verified tag commit. Generated-data terms remain UNKNOWN_TERMS.

The JAR and complete raw generated FHIR runs are local outside Git under ~/.local/share/baymax-synthea-v4. Raw records may include public provider identities; only minimized mapped clinical context and resource hash manifests are committed. Excluded resource types and unsupported top-level fields retain NOT_MAPPED states. FCG edges express provenance; clinical relationships and terminology conformance remain NOT_TESTED.

Reproduction: obtain and hash-verify the pinned JAR in source.json, use the recorded JDK, create two empty run directories, then execute recipe.json arguments with java -Duser.timezone=UTC -jar JAR, using each directory as the working directory. effective.properties includes the exact JAR defaults plus explicit overrides. Both reference and end dates are frozen. Run python3 scripts/build_codex_synthea.py to regenerate admitted derivative artifacts. Run PYTHONPATH=src python3 -m unittest discover -s tests -v. Signature verification tests require Python cryptography (observed 46.0.7); no external model or cloud service is used.

SwiftUI integration: add fixtures/iphone/OfflineBundle.swift and offline_travel_bundle_v1.json to the app target with target membership enabled. Decode using try OfflineTravelBundle.load(). The loader uses Bundle file access only. This fixture is synthetic demo context, not medical advice. Directory entries and coordinates are hand-authored synthetic placeholders; real calls, navigation, medication purchase and treatment actions are blocked.

Legacy verify_breakpoints.py reports historical byte mismatches at BP-0002/0003/0007/0009. Current verify_chain.py passes, checking historical descriptor commitments and current bytes against the latest breakpoint that lists each artifact. No historical breakpoint was changed.

Claude comparison is DEFERRED: no later admitted Claude implementation commit was observed. The linked upstream GitHub project was inaccessible through web retrieval; no board changes were requested or made. Cloud services, on-device UI execution, clinical validation and US Core validation are NOT_TESTED.

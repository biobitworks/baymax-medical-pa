import SwiftUI
import Network
import UIKit

@MainActor final class Connectivity: ObservableObject {
    @Published var online = false
    private let monitor = NWPathMonitor()

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let connected = path.status == .satisfied
            Task { @MainActor in self?.online = connected }
        }
        monitor.start(queue: DispatchQueue(label: "baymax.connectivity"))
    }

    deinit { monitor.cancel() }
}

@main struct OfflineTravelApp: App {
    var body: some Scene { WindowGroup { TravelView() } }
}

struct TravelView: View {
    @StateObject private var connectivity = Connectivity()
    @AppStorage("baymax.offlineDemo") private var offlineDemo = true
    @AppStorage("baymax.offlinePackReviewed") private var offlinePackReviewed = false
    @State private var consent = false
    @State private var context: OfflineTravelBundleFCO?
    @State private var legacy: OfflineTravelBundle?
    @State private var catalog: ApolloCatalog?
    @State private var wallet: WalletSnapshot?
    @State private var packet = ""
    @State private var observedSubstrate = "UNKNOWN"
    @State private var observedModel = ""
    @State private var apolloVersion = ""
    @State private var response = ""
    @State private var offlineUserAttested = false
    @State private var modelValidation = "NOT_TESTED"
    @State private var providerObserved = "UNKNOWN"
    @State private var inference: ModelInferenceFCO?
    @State private var status = "Ready — synthetic demo only"

    var online: Bool { connectivity.online && !offlineDemo }

    var body: some View {
        NavigationStack {
            List {
                Section("Connection") {
                    Label(
                        connectivity.online ? "Network available" : "Network offline",
                        systemImage: connectivity.online ? "wifi" : "wifi.slash"
                    )
                    Toggle("Force offline demo", isOn: $offlineDemo)
                    Text(offlineDemo
                         ? "Demo route: OFFLINE · local data only"
                         : "Local data remains primary · external actions still gated")
                        .font(.caption)
                }

                Section("Privacy") {
                    Toggle("Allow this synthetic demo context", isOn: $consent)
                        .onChange(of: consent) { _, allowed in
                            if !allowed { clearSession(reason: "Context cleared · consent revoked") }
                        }
                    Toggle("Offline pack reviewed", isOn: $offlinePackReviewed)
                    Button("Load offline travel context") { loadContext() }
                    Button("Clear loaded context") { clearSession(reason: "Session cleared · bundled synthetic source remains") }
                    Text("Consent is session-only. The reviewed/offline-demo flags persist locally across app restart.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if let value = context {
                    Section("Synthetic traveler · Bali") {
                        Label("SYNTHETIC DATA", systemImage: "testtube.2")
                        Text("Travel dates: UNKNOWN · destination Bali, Indonesia")
                        if let legacy {
                            Text("Medication context: \(legacy.medication_context.count) synthetic records")
                            ForEach(Array(legacy.medication_context.prefix(4).enumerated()), id: \.offset) { index, item in
                                Text("Record \(index + 1): \(describeMedication(item))").font(.caption)
                            }
                        }
                        Text("Medical correctness: \(value.correctness_state)")
                        Text("Source references: \(value.resource_references.count) bounded · \(value.omitted_reference_count) omitted by the bounded phone projection")
                        ForEach(value.unknown_states, id: \.self) {
                            Text("UNKNOWN: " + $0).foregroundStyle(.orange)
                        }
                    }

                    Section("Synthetic directory / map point") {
                        ForEach(value.directory) { entry in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(entry.label)
                                Text("SYNTHETIC_FIXTURE · NOT_LIVE_DIRECTORY").font(.caption.bold()).foregroundStyle(.orange)
                                Text("Availability \(entry.availability) · phone \(entry.phone)").font(.caption)
                                Text("Synthetic map point: -8.65, 115.22 · accuracy UNKNOWN · navigation disabled").font(.caption)
                                Text("Call " + (entry.call_enabled ? "enabled" : "disabled") + " · purchase " + (entry.purchase_enabled ? "enabled" : "disabled")).font(.caption)
                            }
                        }
                    }

                    if let wallet {
                        Section("Synthetic wallet snapshot") {
                            Text(wallet.wallet_type)
                            Text("State: \(wallet.state)")
                            Text("Balance: \(wallet.synthetic_balance) \(wallet.currency)")
                            Text("REAL_MONEY=" + (wallet.real_money ? "YES" : "NO"))
                            Text("PRESCRIPTION_PURCHASE=\(wallet.prescription_purchase)")
                            Text("Phone key: \(wallet.phone_key_state)")
                            Text(wallet.claim_boundary).font(.caption).foregroundStyle(.secondary)
                        }
                    }

                    Section("Local model") {
                        Text("Execution: " + (response.isEmpty ? "NOT OBSERVED" : "USER REPORTED · not independently observed"))
                        Text("Validation: " + modelValidation)
                        Text("Source: local · Medical authority: NONE")
                        Text(online ? "ONLINE" : "OFFLINE")
                        Text("LOCAL CONTEXT AVAILABLE · LOCAL POLICY AVAILABLE")
                        Text("LOCAL MODEL: manual runtime availability UNKNOWN")
                        Text("LIVE STOCK UNKNOWN · LIVE HOURS UNKNOWN")
                        Text("CLOUD SYNC DEFERRED · PURCHASE BLOCKED")
                        Text(inference == nil
                             ? "NOT_EXECUTED · deterministic no-model experience remains available"
                             : "MODEL_INFERRED · correctness UNKNOWN · no medical/wallet authority")
                        Button("Copy synthetic context for local model") { copyPacket() }
                        Text("TRANSFER=HUMAN_MEDIATED · destination byte identity NOT independently verified.")
                            .font(.caption)
                            .foregroundStyle(.orange)

                        Picker("Reported substrate", selection: $observedSubstrate) {
                            Text("UNKNOWN").tag("UNKNOWN")
                            Text("Liquid Apollo").tag("Liquid Apollo")
                            Text("LEAP local").tag("LEAP local")
                            Text("Other local runtime").tag("Other local runtime")
                        }
                        TextField("Human-observed provider (UNKNOWN if not observed)", text: $providerObserved)
                        TextField("Human-observed model label", text: $observedModel)
                        TextField("Human-observed Apollo/runtime version", text: $apolloVersion)
                        Toggle("I observed inference while the model app was offline/airplane mode", isOn: $offlineUserAttested)
                        Text("Substrate/model/offline fields remain HUMAN_REPORTED_UNVERIFIED or USER_ATTESTED until independently measured.")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        DisclosureGroup("Paste local model JSON response") {
                            TextEditor(text: $response)
                                .frame(minHeight: 100)
                                .accessibilityLabel("Paste local model JSON response")
                                .onChange(of: response) { _, _ in
                                    inference = nil
                                    modelValidation = "NOT_TESTED"
                                }
                        }
                        Button("Validate bounded model selection") { validateResponse() }

                        if let inference, let catalog {
                            let display = MaterializedModelOutput.make(inference.output_selection, catalog: catalog)
                            Text("MODEL_INFERRED: " + display.summary).font(.headline)
                            ForEach(display.known) { fact in
                                VStack(alignment: .leading) {
                                    Text("KNOWN: " + fact.text)
                                    Text("source: " + short(fact.source_fco_id)).font(.caption2).foregroundStyle(.secondary)
                                }
                            }
                            ForEach(display.unknown, id: \.self) { Text("UNKNOWN: " + $0).foregroundStyle(.orange) }
                            ForEach(display.recommendedQuestions, id: \.self) { Text("Question: " + $0) }
                            Text("medical_action=NONE · clinician review required").font(.caption.bold())
                            Text("Model identity: \(inference.model_identity_state)")
                            Text("Network evidence: \(inference.network_state) / \(inference.network_observation_state)")
                            Text("Destination packet SHA: \(inference.destination_packet_sha256)")
                                .font(.caption2)
                        }
                    }

                    Section("Deterministic compliance") {
                        gateRow("Synthetic offline context", .readContext)
                        gateRow("Wallet preview", .walletPreview)
                        gateRow("Cloud summary", .cloudSummary)
                        gateRow("Fly sync", .flySync)
                        gateRow("Call", .call)
                        gateRow("Medication purchase", .purchase)
                        Text("Prescription modification is HUMAN_REVIEW_REQUIRED by product policy; medication purchase is BLOCKED.")
                            .font(.caption.bold())
                    }

                    Section("Guarded actions") {
                        Button("Cloud summary") { attempt(.cloudSummary) }
                        Button("Wallet preview · zero real funds") { attempt(.walletPreview) }
                        Button("Fly sync") { attempt(.flySync) }
                        Button("Call demo pharmacy") { attempt(.call) }
                        Button("Medication purchase") { attempt(.purchase) }
                    }

                    Section("Provenance") {
                        Text(value.fco_id).font(.caption).textSelection(.enabled)
                        Text("BP-0021/BP-0023 synthetic package; clinical correctness remains UNKNOWN.")
                            .font(.caption)
                    }
                }

                Section("Result") {
                    Text(status).accessibilityIdentifier("gateResult")
                }
            }
            .navigationTitle("Baymax Offline")
        }
    }

    private func gateRow(_ label: String, _ action: DemoAction) -> some View {
        let decision = ComplianceGate.evaluate(action, online: online, consent: consent)
        return LabeledContent(label, value: decision.state)
    }

    private func loadContext() {
        let decision = ComplianceGate.evaluate(.readContext, online: online, consent: consent)
        guard decision.state == "LOCAL_ONLY" else {
            status = "\(decision.state): \(decision.reason)"
            return
        }
        do {
            guard let fcoURL = Bundle.main.url(forResource: "OfflineTravelBundleFCO", withExtension: "json"),
                  let legacyURL = Bundle.main.url(forResource: "offline_travel_bundle_v1", withExtension: "json"),
                  let packetURL = Bundle.main.url(forResource: "apollo_context_packet_v2", withExtension: "txt"),
                  let catalogURL = Bundle.main.url(forResource: "apollo_catalog_v2", withExtension: "json"),
                  let walletURL = Bundle.main.url(forResource: "wallet_state_v1", withExtension: "json")
            else { throw CocoaError(.fileNoSuchFile) }

            let loadedContext = try OfflineTravelBundleFCO.decode(Data(contentsOf: fcoURL))
            let legacyData = try Data(contentsOf: legacyURL)
            guard sha256(String(decoding: legacyData, as: UTF8.self)) == "36d5d72c202da795db07d50d807747e94922f3b958b9ee25fd646e3d038a0c93"
            else { throw CocoaError(.coderInvalidValue) }

            let loadedCatalog = try ApolloCatalog.decode(Data(contentsOf: catalogURL))
            guard loadedCatalog.source_offline_bundle_sha256 == "36d5d72c202da795db07d50d807747e94922f3b958b9ee25fd646e3d038a0c93",
                  loadedCatalog.source_offline_fco_id == loadedContext.fco_id
            else { throw CocoaError(.coderInvalidValue) }

            let loadedPacket = try String(contentsOf: packetURL, encoding: .utf8)
            guard sha256(loadedPacket) == "80e92bd4d0583fb58b261164ba2e53543ce7482a0f767bc7c3368c460de54147"
            else { throw CocoaError(.coderInvalidValue) }

            context = loadedContext
            legacy = try JSONDecoder().decode(OfflineTravelBundle.self, from: legacyData)
            catalog = loadedCatalog
            wallet = try WalletSnapshot.decode(Data(contentsOf: walletURL))
            packet = loadedPacket
            status = "LOCAL_ONLY: synthetic context loaded without a provider request"
        } catch {
            clearSession(reason: "UNKNOWN: local bundle could not be loaded")
        }
    }

    private func describeMedication(_ item: JSONValue) -> String {
        guard case .object(let record) = item,
              case .object(let concept) = record["medicationCodeableConcept"],
              case .array(let coding) = concept["coding"],
              let first = coding.first,
              case .object(let code) = first,
              case .string(let display) = code["display"]
        else { return "UNKNOWN" }
        return display + " · synthetic record · no modification authorized"
    }

    private func copyPacket() {
        let decision = ComplianceGate.evaluate(.readContext, online: online, consent: consent)
        guard decision.state == "LOCAL_ONLY", !packet.isEmpty else {
            status = "BLOCKED: load consented synthetic context first"
            return
        }
        UIPasteboard.general.setItems(
            [[UIPasteboard.typeAutomatic: packet]],
            options: [.localOnly: true, .expirationDate: Date().addingTimeInterval(600)]
        )
        status = "LOCAL_ONLY: source packet copied · human-mediated transfer · destination bytes unverified"
    }

    private func validateResponse() {
        guard consent, !packet.isEmpty, let catalog else {
            status = "BLOCKED: consented context required"
            return
        }
        do {
            inference = try ModelInferenceFCO.record(
                response: response,
                packet: packet,
                catalog: catalog,
                substrateReported: observedSubstrate,
                modelReported: observedModel,
                apolloVersionReported: apolloVersion,
                offlineUserAttested: offlineUserAttested,
                iosVersionObserved: UIDevice.current.systemVersion,
                deviceClassObserved: UIDevice.current.model,
                providerObserved: providerObserved
            )
            modelValidation = "ACCEPTED"
            status = "MODEL_INFERRED: bounded ID selection accepted · medical authority NONE · correctness UNKNOWN"
        } catch {
            inference = nil
            modelValidation = "REJECT / ABSTAIN"
            status = "Local model response was not admitted. Your saved context is unchanged."
        }
    }

    private func attempt(_ action: DemoAction) {
        let decision = ComplianceGate.guardedRequest(action, online: online, consent: consent) {
            // No live provider adapter is admitted in this demo.
        }
        status = "\(decision.state): \(decision.reason)"
    }

    private func clearSession(reason: String) {
        context = nil
        legacy = nil
        catalog = nil
        wallet = nil
        inference = nil
        modelValidation = "NOT_TESTED"
        providerObserved = "UNKNOWN"
        response = ""
        packet = ""
        observedModel = ""
        apolloVersion = ""
        offlineUserAttested = false
        status = reason
    }

    private func short(_ value: String) -> String {
        guard value.count > 20 else { return value }
        return String(value.prefix(11)) + "…" + String(value.suffix(8))
    }
}

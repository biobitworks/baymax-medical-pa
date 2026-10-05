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
    @State private var offlineDemo = true
    @State private var consent = false
    @State private var context: OfflineTravelBundleFCO?
    @State private var legacy: OfflineTravelBundle?
    @State private var packet = ""
    @State private var observedModel = ""
    @State private var response = ""
    @State private var offlineObserved = false
    @State private var inference: ModelInferenceFCO?
    @State private var status = "Ready — synthetic demo only"
    var online: Bool { connectivity.online && !offlineDemo }
    var body: some View {
        NavigationStack {
            List {
                Section("Connection") {
                    Label(connectivity.online ? "Network available" : "Offline", systemImage: connectivity.online ? "wifi" : "wifi.slash")
                    Toggle("Force offline demo", isOn: $offlineDemo)
                    Text(offlineDemo ? "Demo mode: OFFLINE · local data only" : "Local data only · external actions gated")
                }
                Section("Privacy") {
                    Toggle("Allow this synthetic demo context", isOn: $consent)
                        .onChange(of: consent) { _, allowed in
                            if !allowed { context = nil; legacy = nil; inference = nil; response = ""; packet = ""; status = "Context cleared · consent revoked" }
                        }
                    Button("Load offline travel context") { loadContext() }
                    Button("Clear loaded context") { context = nil; legacy = nil; inference = nil; response = ""; packet = ""; status = "Session cleared · bundled synthetic source remains" }
                }
                if let value = context {
                    Section("Synthetic traveler · Bali") {
                        Label("SYNTHETIC DATA", systemImage: "testtube.2")
                        Text("Travel dates: UNKNOWN · destination Bali, Indonesia")
                        if let legacy {
                            Text("BP-0021 medication context: \(legacy.medication_context.count) synthetic records")
                            ForEach(Array(legacy.medication_context.prefix(4).enumerated()), id: \.offset) { index, item in
                                Text("Record \(index + 1): \(describeMedication(item))").font(.caption)
                            }
                        }
                        Text("Medical correctness: \(value.correctness_state)")
                        Text("Medication records: \(value.resource_counts["MedicationRequest", default: 0]) · names and dosage UNKNOWN")
                        ForEach(value.unknown_states, id: \.self) { Text($0).foregroundStyle(.secondary) }
                    }
                    Section("Synthetic directory") {
                        ForEach(value.directory) { entry in
                            VStack(alignment: .leading) {
                                Text(entry.label)
                                Text("Availability \(entry.availability) · phone \(entry.phone)").font(.caption)
                                Text("Synthetic map point: -8.65, 115.22 · accuracy UNKNOWN · navigation disabled").font(.caption)
                            }
                        }
                    }
                    Section("Model execution") {
                        Text(inference == nil ? "NOT_EXECUTED · deterministic no-model demo ready" : "MODEL_INFERRED · UNKNOWN correctness · no medical authority")
                        Button("Copy synthetic context for Apollo") { copyPacket() }
                        Text("Manual transfer only. Select the exact model offered on your phone; no inter-app API is used.").font(.caption)
                        TextField("Observed Apollo model", text: $observedModel)
                        Toggle("I observed Apollo inference in airplane mode", isOn: $offlineObserved)
                        TextEditor(text: $response).frame(minHeight: 100).accessibilityLabel("Paste Apollo JSON response")
                        Button("Validate provisional model response") { validateResponse() }
                        if let inference {
                            Text(inference.output.summary)
                            ForEach(inference.output.known_facts, id: \.self) { Text("MODEL_INFERRED: " + $0) }
                            ForEach(inference.output.questions_for_pharmacist_clinician, id: \.self) { Text("Question: " + $0) }
                            ForEach(inference.output.unknown_facts, id: \.self) { Text("UNKNOWN: " + $0) }
                            Text("Clinician review required")
                            Text("Response SHA-256: " + inference.response_sha256).font(.caption)
                        }
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
                        Text("\(value.resource_references.count) bounded references · \(value.omitted_reference_count) omitted")
                    }
                }
                Section("Result") { Text(status).accessibilityIdentifier("gateResult") }
            }.navigationTitle("Offline travel")
        }
    }
    private func loadContext() {
        let decision = ComplianceGate.evaluate(.readContext, online: online, consent: consent)
        guard decision.state == "LOCAL_ONLY" else { status = "\(decision.state): \(decision.reason)"; return }
        do {
            guard let url = Bundle.main.url(forResource: "OfflineTravelBundleFCO", withExtension: "json") else { throw CocoaError(.fileNoSuchFile) }
            context = try OfflineTravelBundleFCO.decode(Data(contentsOf: url))
            guard let legacyURL = Bundle.main.url(forResource: "offline_travel_bundle_v1", withExtension: "json") else { throw CocoaError(.fileNoSuchFile) }
            let legacyData = try Data(contentsOf: legacyURL)
            guard sha256(String(decoding: legacyData, as: UTF8.self)) == "36d5d72c202da795db07d50d807747e94922f3b958b9ee25fd646e3d038a0c93" else { throw CocoaError(.coderInvalidValue) }
            legacy = try JSONDecoder().decode(OfflineTravelBundle.self, from: legacyData)
            guard let packetURL = Bundle.main.url(forResource: "apollo_context_packet_v1", withExtension: "txt") else { throw CocoaError(.fileNoSuchFile) }
            packet = try String(contentsOf: packetURL, encoding: .utf8)
            guard sha256(packet) == "b7ef25064b0af0368d1a95f3551e2c1d9f134cd7d26306eee600de8184ff2cac" else { throw CocoaError(.coderInvalidValue) }
            status = "LOCAL_ONLY: synthetic context loaded without a provider request"
        } catch { context = nil; legacy = nil; packet = ""; status = "UNKNOWN: local bundle could not be loaded" }
    }
    private func describeMedication(_ item: JSONValue) -> String {
        guard case .object(let record) = item,
              case .object(let concept) = record["medicationCodeableConcept"],
              case .array(let coding) = concept["coding"], let first = coding.first,
              case .object(let code) = first, case .string(let display) = code["display"] else { return "UNKNOWN" }
        return display + " · provisional synthetic record · dose UNKNOWN"
    }
    private func copyPacket() {
        let decision = ComplianceGate.evaluate(.readContext, online: online, consent: consent)
        guard decision.state == "LOCAL_ONLY", !packet.isEmpty else { status = "BLOCKED: load consented synthetic context first"; return }
        UIPasteboard.general.setItems([[UIPasteboard.typeAutomatic: packet]], options: [.localOnly: true, .expirationDate: Date().addingTimeInterval(600)])
        status = "LOCAL_ONLY: packet copied for manual Apollo transfer · clipboard expires in 10 minutes"
    }
    private func validateResponse() {
        guard consent, !packet.isEmpty else { status = "BLOCKED: consented context required"; return }
        do {
            inference = try ModelInferenceFCO.record(response: response, packet: packet, model: observedModel, offlineObserved: offlineObserved)
            status = "PROVISIONAL: output schema accepted · correctness UNKNOWN · wallet authority NONE"
        } catch { inference = nil; status = "REJECTED: malformed or prohibited model output" }
    }
    private func attempt(_ action: DemoAction) {
        let decision = ComplianceGate.guardedRequest(action, online: online, consent: consent) {
            // No live provider adapter is admitted in this demo.
        }
        status = "\(decision.state): \(decision.reason)"
    }
}

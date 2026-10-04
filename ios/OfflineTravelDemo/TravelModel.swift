import Foundation

struct ResourceReference: Decodable {
    let fco_id: String
    let source_resource_type: String
    let source_resource_id: String
    let source_resource_sha256: String
    let source_dataset_fco_id: String
    let synthetic_state: String
    let correctness_state: String
}
struct DemoDirectoryEntry: Decodable, Identifiable {
    let id: String
    let label: String
    let availability: String
    let phone: String
    let synthetic_state: String
    let call_enabled: Bool
    let purchase_enabled: Bool
}
struct OfflineTravelBundleFCO: Decodable {
    let schema: String
    let fco_type: String
    let fco_id: String
    let synthetic_state: String
    let correctness_state: String
    let source_dataset_fco_id: String
    let resource_counts: [String: Int]
    let resource_references: [ResourceReference]
    let omitted_reference_count: Int
    let unknown_states: [String]
    let directory: [DemoDirectoryEntry]
    static func decode(_ data: Data) throws -> Self {
        guard data.count <= 20_000 else { throw CocoaError(.coderInvalidValue) }
        let value = try JSONDecoder().decode(Self.self, from: data)
        guard value.schema == "baymax.offline-travel-bundle-fco.v1",
              value.fco_type == "OfflineTravelBundleFCO", value.synthetic_state == "SYNTHETIC",
              value.resource_references.count <= 16,
              value.resource_references.allSatisfy({ $0.synthetic_state == "SYNTHETIC" && $0.source_dataset_fco_id == value.source_dataset_fco_id }),
              value.directory.allSatisfy({ $0.synthetic_state == "SYNTHETIC" && !$0.call_enabled && !$0.purchase_enabled })
        else { throw CocoaError(.coderInvalidValue) }
        return value
    }
}
enum DemoAction: String, CaseIterable {
    case readContext = "READ_CONTEXT", cloudSummary = "CLOUD_SUMMARY"
    case walletPreview = "WALLET_PREVIEW", flySync = "FLY_SYNC"
    case call = "CALL", purchase = "PURCHASE"
}
struct GateDecision: Equatable {
    let state: String
    let reason: String
    let dispatch: Bool
}
enum ComplianceGate {
    static func evaluate(_ action: DemoAction, online: Bool, consent: Bool) -> GateDecision {
        guard consent else { return .init(state: "BLOCKED", reason: "Demo consent required", dispatch: false) }
        switch action {
        case .readContext: return .init(state: "LOCAL_ONLY", reason: "Synthetic bounded context; no network", dispatch: false)
        case .walletPreview: return .init(state: "LOCAL_ONLY", reason: "Synthetic zero-funds preview; no signing or spending", dispatch: false)
        case .purchase: return .init(state: "BLOCKED", reason: "Live medication purchase prohibited", dispatch: false)
        case .cloudSummary, .flySync, .call:
            return .init(state: "DEFERRED", reason: online ? "Provider/action authorization absent" : "Offline", dispatch: false)
        }
    }
    static func guardedRequest(_ action: DemoAction, online: Bool, consent: Bool, provider: () -> Void) -> GateDecision {
        let decision = evaluate(action, online: online, consent: consent)
        if decision.dispatch { provider() }
        return decision
    }
}

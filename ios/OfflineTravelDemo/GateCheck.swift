import Foundation
@main struct GateCheck {
    static func main() throws {
        let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
        let context = try OfflineTravelBundleFCO.decode(data)
        let legacy = try JSONDecoder().decode(OfflineTravelBundle.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[2])))
        guard legacy.synthetic_patient_context.count == 1, legacy.unknown_states.contains("medical_correctness") else { fatalError("legacy bundle") }
        let good = #"{"summary":"Synthetic context only.","known_facts":["Bali trip"],"unknown_facts":["Medical correctness UNKNOWN"],"questions_for_pharmacist_clinician":["What information is missing?"],"requires_clinician":true}"#
        _ = try ModelOutput.parse(good)
        for invalid in ["not JSON", good.replacingOccurrences(of: "true", with: "false"), good.replacingOccurrences(of: "Synthetic context only.", with: "Take 50 mg now"), good.dropLast() + ",\"requires_clinician\":true}"] {
            do { _ = try ModelOutput.parse(invalid); fatalError("malformed output accepted") } catch {}
        }
        guard context.resource_references.count == 16, context.omitted_reference_count == 103 else { fatalError("bounds") }
        var calls = 0
        var cases: [[String: Any]] = []
        for consent in [false, true] {
            for online in [false, true] {
                for action in DemoAction.allCases {
                    let result = ComplianceGate.guardedRequest(action, online: online, consent: consent) { calls += 1 }
                    guard !result.dispatch, consent || result.state == "BLOCKED" else { fatalError("gate") }
                    cases.append(["action": action.rawValue, "online": online, "consent": consent, "state": result.state, "reason": result.reason, "dispatch": result.dispatch])
                }
            }
        }
        guard calls == 0 else { fatalError("unauthorized provider called") }
        let output: [String: Any] = ["schema": "baymax.swift_gate_run.v1", "decode": "PASS", "case_count": cases.count, "provider_calls": calls, "cases": cases, "fco_id": context.fco_id]
        print(String(data: try JSONSerialization.data(withJSONObject: output, options: [.sortedKeys, .prettyPrinted]), encoding: .utf8)!)
    }
}

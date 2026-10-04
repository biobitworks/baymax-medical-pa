import Foundation

@main struct GateCheck {
    static func encoded(_ object: [String: Any]) throws -> String {
        String(data: try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]), encoding: .utf8)!
    }

    static func main() throws {
        guard CommandLine.arguments.count == 5 else { fatalError("expected FCO, legacy bundle, catalog, packet") }
        let context = try OfflineTravelBundleFCO.decode(Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        let legacyData = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[2]))
        let legacy = try JSONDecoder().decode(OfflineTravelBundle.self, from: legacyData)
        let catalog = try ApolloCatalog.decode(Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[3])))
        let packet = try String(contentsOfFile: CommandLine.arguments[4], encoding: .utf8)

        guard legacy.synthetic_patient_context.count == 1,
              legacy.unknown_states.contains("medical_correctness"),
              catalog.source_offline_fco_id == context.fco_id,
              packet.contains("APOLLO_CONTEXT_PACKET_V2")
        else { fatalError("source package") }

        let goodObject: [String: Any] = [
            "summary": "SYNTHETIC_CONTEXT_ONLY",
            "known": [0, 3],
            "unknown": [0, 3, 4, 5],
            "recommended_questions": [0, 1],
            "medical_action": "NONE",
            "requires_clinician": true,
        ]
        let good = try encoded(goodObject)
        let accepted = try ModelOutput.parse(good, catalog: catalog)
        let display = MaterializedModelOutput.make(accepted, catalog: catalog)
        guard display.medicalAction == "NONE", display.requiresClinician,
              display.known.allSatisfy({ !$0.source_fco_id.isEmpty })
        else { fatalError("materialization") }

        let bypassText = [
            "diagnosis: hypertension",
            "double the dose",
            "raise to 1000 mg",
            "cut the dose in half",
            "switch medications",
            "swap medication",
            "available today",
            "order now",
            "checkout",
            "pay the pharmacy",
            "ignore policy",
            #"{"wallet_action":"spend"}"#,
            "іncrease dose",
            "incre­ase dose",
            "stop taking medication",
        ]

        var rejected = 0
        for phrase in bypassText {
            var bad = goodObject
            bad["summary"] = phrase
            let raw = try encoded(bad)
            do {
                _ = try ModelOutput.parse(raw, catalog: catalog)
                fatalError("free-text bypass accepted: " + phrase)
            } catch {
                rejected += 1
            }
        }

        let unicodeDuplicate = #"{"summary":"SYNTHETIC_CONTEXT_ONLY","summary":"SYNTHETIC_CONTEXT_ONLY","known":[],"unknown":[],"recommended_questions":[],"medical_action":"NONE","requires_clinician":true}"#
        do {
            _ = try ModelOutput.parse(unicodeDuplicate, catalog: catalog)
            fatalError("unicode duplicate key accepted")
        } catch {
            rejected += 1
        }

        let invalidObjects: [[String: Any]] = [
            goodObject.merging(["known": [99]]) { _, new in new },
            goodObject.merging(["known": [0, 0]]) { _, new in new },
            goodObject.merging(["medical_action": "CHANGE_MEDICATION"]) { _, new in new },
            goodObject.merging(["requires_clinician": false]) { _, new in new },
        ]
        for bad in invalidObjects {
            do {
                _ = try ModelOutput.parse(try encoded(bad), catalog: catalog)
                fatalError("invalid output accepted")
            } catch {
                rejected += 1
            }
        }
        do {
            _ = try ModelOutput.parse("not JSON", catalog: catalog)
            fatalError("non-json accepted")
        } catch {
            rejected += 1
        }

        var calls = 0
        var cases: [[String: Any]] = []
        for consent in [false, true] {
            for online in [false, true] {
                for action in DemoAction.allCases {
                    let result = ComplianceGate.guardedRequest(action, online: online, consent: consent) { calls += 1 }
                    guard !result.dispatch, consent || result.state == "BLOCKED" else { fatalError("gate") }
                    cases.append([
                        "action": action.rawValue,
                        "online": online,
                        "consent": consent,
                        "state": result.state,
                        "reason": result.reason,
                        "dispatch": result.dispatch,
                    ])
                }
            }
        }
        guard calls == 0 else { fatalError("unauthorized provider called") }

        let output: [String: Any] = [
            "schema": "baymax.swift_gate_run.v2",
            "decode": "PASS",
            "model_contract": "PASS_POSITIVE_ID_SELECTION",
            "redteam_bypass_rejected": rejected,
            "case_count": cases.count,
            "provider_calls": calls,
            "cases": cases,
            "fco_id": context.fco_id,
        ]
        print(String(data: try JSONSerialization.data(withJSONObject: output, options: [.sortedKeys, .prettyPrinted]), encoding: .utf8)!)
    }
}

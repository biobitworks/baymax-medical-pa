import Foundation
struct Case: Decodable { let name: String; let text: String }
let cat = try ApolloCatalog.decode(Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
let cases = try JSONDecoder().decode([Case].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[2])))
var out: [[String: Any]] = []
for c in cases {
    var r: [String: Any] = ["name": c.name]
    do { let m = try ModelOutput.parse(c.text, catalog: cat); r["result"] = "ACCEPTED"; r["known"] = m.known } catch { r["result"] = "REJECTED" }
    out.append(r)
}
// identity path: cloud-looking labels through the REAL record()
let good = #"{"summary":"SYNTHETIC_CONTEXT_ONLY","known":[0,1],"unknown":[3],"recommended_questions":[0],"medical_action":"NONE","requires_clinician":true}"#
for (sub, model, off) in [("OpenRouter","gpt-5-6-luna (cloud)",true),("asdf","asdf",false),("Liquid Apollo","LFM2.5-1… Q5_K_M",true)] {
    if let f = try? ModelInferenceFCO.record(response: good, packet: "PACKET", catalog: cat, substrateReported: sub, modelReported: model, apolloVersionReported: "", offlineUserAttested: off, iosVersionObserved: "x", deviceClassObserved: "y") {
        out.append(["identity_case": sub + "/" + model, "offlineTick": off, "provider": f.provider, "substrate_state": f.execution_substrate_identity_state, "model_state": f.model_identity_state, "network_state": f.network_state, "network_obs": f.network_observation_state, "dest_packet": f.destination_packet_sha256])
    }
}
print(String(data: try JSONSerialization.data(withJSONObject: out, options: [.sortedKeys]), encoding: .utf8)!)

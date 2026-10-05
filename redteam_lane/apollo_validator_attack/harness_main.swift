import Foundation
struct Case: Decodable { let name: String; let text: String }
let cases = try JSONDecoder().decode([Case].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
var out: [[String: Any]] = []
for c in cases {
    var r: [String: Any] = ["name": c.name]
    do { let m = try ModelOutput.parse(c.text); r["swift"] = "ACCEPTED"; r["summary"] = String(m.summary.prefix(60)) } catch { r["swift"] = "REJECTED" }
    out.append(r)
}
// identity attack: cloud model name + offline attestation through the real record() path
let good = #"{"summary":"ok","known_facts":[],"unknown_facts":["x"],"questions_for_pharmacist_clinician":["q"],"requires_clinician":true}"#
for (model, off) in [("OpenRouter gpt-5-6-luna (cloud)", true), ("asdf", false), ("LFM2.5-350M", true)] {
    if let f = try? ModelInferenceFCO.record(response: good, packet: "PACKET", model: model, offlineObserved: off) {
        out.append(["identity_case": model, "offlineTick": off, "execution_substrate": f.execution_substrate, "provider": f.provider, "network_state": f.network_state, "observation_source": f.observation_source, "context_packet_sha256_label": "context_packet_sha256"])
    }
}
print(String(data: try JSONSerialization.data(withJSONObject: out, options: [.sortedKeys]), encoding: .utf8)!)

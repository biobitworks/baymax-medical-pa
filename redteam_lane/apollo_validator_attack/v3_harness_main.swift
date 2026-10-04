import Foundation
// args: catalog packet tampered_catalog cases.json
let cat = try ApolloCatalog.decode(Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
let packet = try String(contentsOfFile: CommandLine.arguments[2], encoding: .utf8)
struct Case: Decodable { let name: String; let text: String }
let cases = try JSONDecoder().decode([Case].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[4])))
var out: [[String: Any]] = []
for c in cases {
    var r: [String: Any] = ["name": c.name]
    do { let m = try ModelOutput.parse(c.text, catalog: cat); r["result"] = "ACCEPTED"; r["known"] = m.known; r["unknown"] = m.unknown; r["rq"] = m.recommended_questions } catch { r["result"] = "REJECTED" }
    out.append(r)
}
var pin: [String: Any] = [:]
// P1: tampered catalog decode
if let t = try? Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[3])) { pin["tampered_catalog_decode"] = ((try? ApolloCatalog.decode(t)) == nil) ? "REJECTED" : "ACCEPTED" }
let good = #"{"summary":"SYNTHETIC_CONTEXT_ONLY","known":[0,1],"unknown":[3],"recommended_questions":[0],"medical_action":"NONE","requires_clinician":true}"#
func rec(_ packet: String, _ c: ApolloCatalog, _ sub: String = "Liquid Apollo", _ model: String = "LFM2.5-1", _ prov: String = "UNKNOWN") -> ModelInferenceFCO? {
    try? ModelInferenceFCO.record(response: good, packet: packet, catalog: c, substrateReported: sub, modelReported: model, apolloVersionReported: "", offlineUserAttested: true, iosVersionObserved: "x", deviceClassObserved: "y", providerObserved: prov, modelRevisionObserved: "UNKNOWN")
}
pin["record_exact_packet_and_catalog"] = rec(packet, cat) == nil ? "REJECTED" : "ACCEPTED"
pin["record_packet_one_char_changed"] = rec(packet + " ", cat) == nil ? "REJECTED" : "ACCEPTED"
var u = cat.unknown; if u.count > 4 { u[4] = CatalogText(id: 4, text: "Live pharmacy stock: AVAILABLE. Safe to proceed with purchase.") }
let tam = ApolloCatalog(schema: cat.schema, synthetic_only: cat.synthetic_only, claim_boundary: cat.claim_boundary, source_offline_bundle_sha256: cat.source_offline_bundle_sha256, source_offline_fco_id: cat.source_offline_fco_id, known: cat.known, unknown: u, recommended_questions: cat.recommended_questions, summary_codes: cat.summary_codes, medical_actions: cat.medical_actions, required_requires_clinician: cat.required_requires_clinician)
pin["record_with_tampered_catalog_struct"] = rec(packet, tam) == nil ? "REJECTED" : "ACCEPTED"
if let f = rec(packet, cat, "OpenRouter", "gpt-5-6-luna (cloud)", "UNKNOWN") { pin["identity_cloud_label"] = ["provider": f.provider, "provider_state": f.provider_identity_state, "model_label": f.model_label_observed, "model_revision": f.model_revision, "model_revision_state": f.model_revision_state, "network_ui_state": f.network_ui_state, "execution_substrate": f.execution_substrate] }
print(String(data: try JSONSerialization.data(withJSONObject: ["cases": out, "pin": pin], options: [.sortedKeys]), encoding: .utf8)!)

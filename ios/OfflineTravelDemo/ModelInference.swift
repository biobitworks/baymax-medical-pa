import Foundation
import CryptoKit
struct ModelOutput: Codable {
    let summary: String
    let known_facts: [String]
    let unknown_facts: [String]
    let questions_for_pharmacist_clinician: [String]
    let requires_clinician: Bool
    static func parse(_ text: String) throws -> Self {
        let data = Data(text.utf8)
        guard data.count <= 12_000,
              let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              Set(object.keys) == Set(["summary", "known_facts", "unknown_facts", "questions_for_pharmacist_clinician", "requires_clinician"])
        else { throw CocoaError(.coderInvalidValue) }
        let out = try JSONDecoder().decode(Self.self, from: data)
        let arrays = [out.known_facts, out.unknown_facts, out.questions_for_pharmacist_clinician]
        let strings = [out.summary] + arrays.flatMap { $0 }
        guard out.requires_clinician, arrays.allSatisfy({ $0.count <= 10 }),
              strings.allSatisfy({ !$0.isEmpty && $0.count <= 500 }) else { throw CocoaError(.coderInvalidValue) }
        let pattern = #"\b(prescrib\w*|increase|decrease|substitut\w*|replace|purchase|buy)\b|\bin stock\b|\btake\s+\d"#
        guard strings.joined(separator: " ").range(of: pattern, options: [.regularExpression, .caseInsensitive]) == nil else { throw CocoaError(.coderInvalidValue) }
        // Duplicate object keys are rejected by the separate frozen-output contract;
        // this flat schema admits only one top-level occurrence of each key.
        for key in object.keys {
            let expression = try NSRegularExpression(pattern: "\"" + NSRegularExpression.escapedPattern(for: key) + "\"\\s*:")
            guard expression.numberOfMatches(in: text, range: NSRange(text.startIndex..., in: text)) == 1 else { throw CocoaError(.coderInvalidValue) }
        }
        return out
    }
}
struct ModelInferenceFCO: Codable {
    let fco_type = "ModelInferenceFCO"
    let execution_substrate = "Liquid Apollo"
    let provider = "Liquid AI"
    let model: String
    let context_packet_sha256: String
    let response_sha256: String
    let network_state: String
    let observed_at: String
    let observation_source = "HUMAN_REPORTED_MANUAL_TRANSFER"
    let inference_class = "MODEL_INFERRED"
    let medical_authority = "NONE"
    let correctness_state = "UNKNOWN"
    let wallet_authority = "NONE"
    let output: ModelOutput
    static func record(response: String, packet: String, model: String, offlineObserved: Bool) throws -> Self {
        guard !model.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw CocoaError(.coderInvalidValue) }
        return .init(model: model, context_packet_sha256: sha256(packet), response_sha256: sha256(response), network_state: offlineObserved ? "OFFLINE" : "UNKNOWN", observed_at: ISO8601DateFormatter().string(from: Date()), output: try ModelOutput.parse(response))
    }
}
func sha256(_ text: String) -> String { SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined() }

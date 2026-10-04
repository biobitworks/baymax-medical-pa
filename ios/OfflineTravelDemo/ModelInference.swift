import Foundation
import CryptoKit

struct CatalogKnown: Codable, Identifiable {
    let id: Int
    let source_fco_id: String
    let text: String
}

struct CatalogText: Codable, Identifiable {
    let id: Int
    let text: String
}

struct ApolloCatalog: Codable {
    let schema: String
    let synthetic_only: Bool
    let source_offline_bundle_sha256: String
    let source_offline_fco_id: String
    let known: [CatalogKnown]
    let unknown: [CatalogText]
    let recommended_questions: [CatalogText]
    let summary_codes: [String]
    let medical_actions: [String]
    let required_requires_clinician: Bool

    static func decode(_ data: Data) throws -> Self {
        let value = try JSONDecoder().decode(Self.self, from: data)
        guard value.schema == "baymax.apollo-catalog.v2",
              value.synthetic_only,
              value.source_offline_bundle_sha256.count == 64,
              value.known.indices.allSatisfy({ value.known[$0].id == $0 }),
              value.unknown.indices.allSatisfy({ value.unknown[$0].id == $0 }),
              value.recommended_questions.indices.allSatisfy({ value.recommended_questions[$0].id == $0 }),
              value.summary_codes == ["SYNTHETIC_CONTEXT_ONLY"],
              value.medical_actions == ["NONE"],
              value.required_requires_clinician
        else { throw CocoaError(.coderInvalidValue) }
        return value
    }
}

struct ModelOutput: Codable, Equatable {
    let summary: String
    let known: [Int]
    let unknown: [Int]
    let recommended_questions: [Int]
    let medical_action: String
    let requires_clinician: Bool

    static let expectedKeys = Set([
        "summary", "known", "unknown", "recommended_questions",
        "medical_action", "requires_clinician"
    ])

    static func parse(_ text: String, catalog: ApolloCatalog) throws -> Self {
        let data = Data(text.utf8)
        guard data.count <= 4_096 else { throw CocoaError(.coderInvalidValue) }

        let decodedKeys = try topLevelDecodedKeys(text)
        guard decodedKeys.count == Set(decodedKeys).count,
              Set(decodedKeys) == expectedKeys
        else { throw CocoaError(.coderInvalidValue) }

        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              Set(object.keys) == expectedKeys
        else { throw CocoaError(.coderInvalidValue) }

        let out = try JSONDecoder().decode(Self.self, from: data)
        guard out.summary == "SYNTHETIC_CONTEXT_ONLY",
              out.medical_action == "NONE",
              out.requires_clinician,
              validIDs(out.known, count: catalog.known.count),
              validIDs(out.unknown, count: catalog.unknown.count),
              validIDs(out.recommended_questions, count: catalog.recommended_questions.count)
        else { throw CocoaError(.coderInvalidValue) }
        return out
    }

    private static func validIDs(_ values: [Int], count: Int) -> Bool {
        values.count <= 10 &&
        values.count == Set(values).count &&
        values.allSatisfy { $0 >= 0 && $0 < count }
    }

    private static func topLevelDecodedKeys(_ text: String) throws -> [String] {
        let scalars = Array(text.unicodeScalars)
        var keys: [String] = []
        var index = 0
        var depth = 0

        func isWhitespace(_ scalar: UnicodeScalar) -> Bool {
            [9, 10, 13, 32].contains(Int(scalar.value))
        }

        while index < scalars.count {
            let scalar = scalars[index]
            if scalar.value == 123 {
                depth += 1
                index += 1
                continue
            }
            if scalar.value == 125 {
                depth -= 1
                index += 1
                continue
            }
            guard depth == 1, scalar.value == 34 else {
                index += 1
                continue
            }

            let start = index
            index += 1
            var escaped = false
            while index < scalars.count {
                let current = scalars[index]
                if escaped {
                    escaped = false
                    index += 1
                    continue
                }
                if current.value == 92 {
                    escaped = true
                    index += 1
                    continue
                }
                if current.value == 34 {
                    index += 1
                    break
                }
                index += 1
            }
            guard index <= scalars.count else { throw CocoaError(.coderInvalidValue) }

            var probe = index
            while probe < scalars.count, isWhitespace(scalars[probe]) { probe += 1 }
            guard probe < scalars.count, scalars[probe].value == 58 else {
                // This string was a value, not an object key.
                continue
            }

            let token = String(String.UnicodeScalarView(scalars[start..<index]))
            guard let key = try JSONSerialization.jsonObject(
                with: Data(token.utf8),
                options: [.fragmentsAllowed]
            ) as? String else { throw CocoaError(.coderInvalidValue) }
            keys.append(key)
            index = probe + 1
        }
        return keys
    }
}

struct MaterializedModelOutput {
    let summary: String
    let known: [CatalogKnown]
    let unknown: [String]
    let recommendedQuestions: [String]
    let medicalAction: String
    let requiresClinician: Bool

    static func make(_ selection: ModelOutput, catalog: ApolloCatalog) -> Self {
        .init(
            summary: "Synthetic offline context only. No medical action is authorized.",
            known: selection.known.map { catalog.known[$0] },
            unknown: selection.unknown.map { catalog.unknown[$0].text },
            recommendedQuestions: selection.recommended_questions.map { catalog.recommended_questions[$0].text },
            medicalAction: "NONE",
            requiresClinician: true
        )
    }
}

struct ModelInferenceFCO: Encodable {
    let fco_type = "ModelInferenceFCO"
    let execution_substrate_reported: String
    let execution_substrate_identity_state = "HUMAN_REPORTED_UNVERIFIED"
    let model_reported: String
    let model_identity_state = "HUMAN_REPORTED_UNVERIFIED"
    let provider = "UNKNOWN"
    let apollo_version_reported: String
    let source_packet_sha256: String
    let destination_packet_sha256 = "NOT_INDEPENDENTLY_VERIFIED"
    let response_sha256: String
    let network_state: String
    let network_observation_state = "USER_ATTESTED"
    let ios_version_observed: String
    let device_class_observed: String
    let observed_at: String
    let observation_source = "HUMAN_MEDIATED_MANUAL_TRANSFER"
    let inference_class = "MODEL_INFERRED"
    let medical_authority = "NONE"
    let correctness_state = "UNKNOWN"
    let wallet_authority = "NONE"
    let output_selection: ModelOutput

    static func record(
        response: String,
        packet: String,
        catalog: ApolloCatalog,
        substrateReported: String,
        modelReported: String,
        apolloVersionReported: String,
        offlineUserAttested: Bool,
        iosVersionObserved: String,
        deviceClassObserved: String
    ) throws -> Self {
        guard !substrateReported.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !modelReported.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else { throw CocoaError(.coderInvalidValue) }
        return .init(
            execution_substrate_reported: substrateReported,
            model_reported: modelReported,
            apollo_version_reported: apolloVersionReported.isEmpty ? "UNKNOWN" : apolloVersionReported,
            source_packet_sha256: sha256(packet),
            response_sha256: sha256(response),
            network_state: offlineUserAttested ? "USER_ATTESTED_OFFLINE" : "UNKNOWN",
            ios_version_observed: iosVersionObserved,
            device_class_observed: deviceClassObserved,
            observed_at: ISO8601DateFormatter().string(from: Date()),
            output_selection: try ModelOutput.parse(response, catalog: catalog)
        )
    }
}

func sha256(_ text: String) -> String {
    SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined()
}

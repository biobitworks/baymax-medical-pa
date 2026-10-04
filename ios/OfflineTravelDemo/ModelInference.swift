import Foundation
import CryptoKit

enum ModelContract {
    static let packetSHA256 = "80e92bd4d0583fb58b261164ba2e53543ce7482a0f767bc7c3368c460de54147"
    static let catalogSHA256 = "648e0e87bc4ec024dd1d46283bd7697fc9de266aef6980d336c113c7311d8d8a"
}

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
    let claim_boundary: String
    let source_offline_bundle_sha256: String
    let source_offline_fco_id: String
    let known: [CatalogKnown]
    let unknown: [CatalogText]
    let recommended_questions: [CatalogText]
    let summary_codes: [String]
    let medical_actions: [String]
    let required_requires_clinician: Bool

    static func decode(_ data: Data) throws -> Self {
        guard SHA256.hash(data: data).map({ String(format: "%02x", $0) }).joined() == ModelContract.catalogSHA256
        else { throw CocoaError(.coderInvalidValue) }
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

        try strictJSONLexemes(text)
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

    // Foundation accepts decimal/exponent spellings as Int. The wire protocol does not.
    private static func strictJSONLexemes(_ text: String) throws {
        guard text.unicodeScalars.first?.value != 0xFEFF else { throw CocoaError(.coderInvalidValue) }
        let bytes = Array(text.utf8)
        var i = 0, depth = 0
        var started = false, finished = false
        while i < bytes.count {
            let b = bytes[i]
            if [9, 10, 13, 32].contains(b) { i += 1; continue }
            if finished { throw CocoaError(.coderInvalidValue) }
            if !started {
                guard b == 123 else { throw CocoaError(.coderInvalidValue) }
                started = true
            }
            if b == 34 {
                i += 1
                var closed = false
                while i < bytes.count {
                    if bytes[i] == 92 { i += 2; continue }
                    if bytes[i] == 34 { i += 1; closed = true; break }
                    i += 1
                }
                guard closed else { throw CocoaError(.coderInvalidValue) }
                continue
            }
            if b == 123 || b == 91 { depth += 1 }
            if b == 125 || b == 93 {
                var previous = i - 1
                while previous >= 0, [9,10,13,32].contains(bytes[previous]) { previous -= 1 }
                guard previous < 0 || bytes[previous] != 44 else { throw CocoaError(.coderInvalidValue) }
                depth -= 1
                if depth == 0 { finished = true }
                guard depth >= 0 else { throw CocoaError(.coderInvalidValue) }
            }
            if b == 45 || (48...57).contains(b) {
                let start = i
                while i < bytes.count, ![9,10,13,32,44,93,125].contains(bytes[i]) { i += 1 }
                let token = String(decoding: bytes[start..<i], as: UTF8.self)
                guard token.range(of: "^-?(0|[1-9][0-9]*)$", options: .regularExpression) != nil
                else { throw CocoaError(.coderInvalidValue) }
                continue
            }
            i += 1
        }
        guard finished, depth == 0 else { throw CocoaError(.coderInvalidValue) }
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
            keys.append(key.precomposedStringWithCanonicalMapping)
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
    let provider_identity_state = "HUMAN_REPORTED_UNVERIFIED"
    let provider: String
    let execution_substrate: String
    let model_label_observed: String
    let model_revision: String
    let model_revision_state: String
    let network_ui_state: String
    let context_packet_sha256: String
    let catalog_sha256: String
    let validator_state = "ACCEPT"

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

    // Caller-owned execution observations only; never derive these arguments from response text.
    // Human observations are not independently authenticated execution identities.
    static func record(
        response: String,
        packet: String,
        catalog: ApolloCatalog,
        substrateReported: String,
        modelReported: String,
        apolloVersionReported: String,
        offlineUserAttested: Bool,
        iosVersionObserved: String,
        deviceClassObserved: String,
        providerObserved: String = "UNKNOWN",
        modelRevisionObserved: String = "UNKNOWN"
    ) throws -> Self {
        guard !substrateReported.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !modelReported.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else { throw CocoaError(.coderInvalidValue) }
        guard sha256(packet) == ModelContract.packetSHA256 else {
            throw CocoaError(.coderInvalidValue)
        }
        guard let marker = packet.range(of: "CATALOG_JSON=\n") else { throw CocoaError(.coderInvalidValue) }
        let packetCatalog = try JSONSerialization.jsonObject(with: Data(packet[marker.upperBound...].utf8)) as? NSDictionary
        let suppliedCatalog = try JSONSerialization.jsonObject(with: JSONEncoder().encode(catalog)) as? NSDictionary
        // Bind every catalog field to the exact frozen packet, including claim_boundary.
        guard packetCatalog != nil, packetCatalog == suppliedCatalog else { throw CocoaError(.coderInvalidValue) }
        return .init(
            execution_substrate_reported: substrateReported,
            model_reported: modelReported,
            provider: providerObserved.isEmpty ? "UNKNOWN" : providerObserved,
            execution_substrate: substrateReported,
            model_label_observed: modelReported,
            model_revision: modelRevisionObserved.isEmpty ? "UNKNOWN" : modelRevisionObserved,
            model_revision_state: modelRevisionObserved == "UNKNOWN" || modelRevisionObserved.isEmpty ? "UNKNOWN" : "HUMAN_REPORTED_UNVERIFIED",
            network_ui_state: offlineUserAttested ? "USER_REPORTED_AIRPLANE_MODE" : "UNKNOWN",
            context_packet_sha256: sha256(packet),
            catalog_sha256: ModelContract.catalogSHA256,
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

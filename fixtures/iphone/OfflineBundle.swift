import Foundation

// Bundle this file and offline_travel_bundle_v1.json in the SwiftUI app target.
public enum JSONValue: Decodable {
    case object([String: JSONValue]), array([JSONValue]), string(String)
    case number(Double), bool(Bool), null
    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode([JSONValue].self) { self = .array(v) }
        else { self = .object(try c.decode([String: JSONValue].self)) }
    }
}
public struct OfflineTravelBundle: Decodable {
    public let schema: String
    public let synthetic_patient_context: [JSONValue]
    public let medication_context: [JSONValue]
    public let clinical_context: [String: JSONValue]
    public let trip_context: JSONValue
    public let synthetic_directory: [JSONValue]
    public let synthetic_map_points: [JSONValue]
    public let source: JSONValue
    public let freshness: JSONValue
    public let unknown_states: [String]
    public let compliance_route: JSONValue
    public static func load(from bundle: Bundle = .main) throws -> Self {
        guard let url = bundle.url(forResource: "offline_travel_bundle_v1", withExtension: "json") else {
            throw CocoaError(.fileNoSuchFile)
        }
        return try JSONDecoder().decode(Self.self, from: Data(contentsOf: url))
    }
}

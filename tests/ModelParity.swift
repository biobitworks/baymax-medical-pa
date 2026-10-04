import Foundation

@main struct ModelParity {
    static func main() throws {
        let catalog = try ApolloCatalog.decode(Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        var results: [[String: Any]] = []
        for path in CommandLine.arguments.dropFirst(2) {
            let vectors = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: path))) as! [[String: Any]]
            for vector in vectors {
                let bytes = Data(base64Encoded: vector["raw_base64"] as! String)!
                // String(data:encoding:) may strip a BOM; preserve exact wire bytes.
                // Python verifies raw/base64 agreement before invoking this harness.
                let raw = String(decoding: bytes, as: UTF8.self)
                guard Data(raw.utf8) == bytes
                else { fatalError("corpus byte mismatch: " + (vector["VECTOR_ID"] as! String)) }
                var row: [String: Any] = ["VECTOR_ID": vector["VECTOR_ID"] as! String, "SWIFT_STATE": "REJECT"]
                do {
                    let selection = try ModelOutput.parse(raw, catalog: catalog)
                    row["SWIFT_STATE"] = "ACCEPT"
                    row["selection"] = try JSONSerialization.jsonObject(with: JSONEncoder().encode(selection))
                } catch {}
                results.append(row)
            }
        }
        print(String(data: try JSONSerialization.data(withJSONObject: results, options: [.sortedKeys]), encoding: .utf8)!)
    }
}

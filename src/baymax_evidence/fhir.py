from __future__ import annotations

import hashlib
import json
from typing import Any

from .dataset import canonical_json_bytes, sha256_bytes

TYPE_MAP = {
    "Patient": "PatientFCO",
    "Condition": "ConditionFCO",
    "Observation": "ObservationFCO",
    "Encounter": "EncounterFCO",
    "MedicationRequest": "MedicationRequestFCO",
    "AllergyIntolerance": "AllergyIntoleranceFCO",
    "CarePlan": "CarePlanFCO",
}

# Deliberately excluded from derived nodes. The immutable source fixture retains
# exact source bytes; the graph carries minimum-necessary identity/provenance.
SENSITIVE_KEYS = {"name", "address", "telecom", "contact", "photo"}


def _resource_identity(resource: dict[str, Any]) -> tuple[str, str]:
    rtype = resource.get("resourceType")
    rid = resource.get("id")
    if not isinstance(rtype, str) or not isinstance(rid, str) or not rid:
        raise ValueError("FHIR resource missing resourceType/id")
    return rtype, rid


def transform_fhir_bundle(data: bytes, source_fco_id: str) -> dict[str, Any]:
    """Pure/local transform. Performs no I/O or network access."""
    doc = json.loads(data)
    if doc.get("resourceType") != "Bundle":
        raise ValueError("expected FHIR Bundle")
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []

    for entry in doc.get("entry", []):
        resource = entry.get("resource") or {}
        rtype = resource.get("resourceType")
        if rtype not in TYPE_MAP:
            continue
        _, rid = _resource_identity(resource)
        source_bytes = canonical_json_bytes(resource)
        node_id = f"fco:{rtype}:{rid}"
        node = {
            "fco_id": node_id,
            "fco_type": TYPE_MAP[rtype],
            "source_resource_type": rtype,
            "source_resource_id": rid,
            "source_resource_sha256": sha256_bytes(source_bytes),
            "source_dataset_fco_id": source_fco_id,
            "synthetic_state": "SYNTHETIC",
            "correctness_state": "UNKNOWN",
        }
        if set(node).intersection(SENSITIVE_KEYS):
            raise AssertionError("sensitive key entered derived node")
        nodes.append(node)
        edges.append({
            "edge_type": "DERIVED_FROM",
            "from": node_id,
            "to": source_fco_id,
        })

    nodes.sort(key=lambda n: (n["source_resource_type"], n["source_resource_id"]))
    edges.sort(key=lambda e: (e["from"], e["edge_type"], e["to"]))
    out = {
        "schema": "baymax.fhir_to_fcg.v1",
        "source_dataset_fco_id": source_fco_id,
        "source_bundle_sha256": sha256_bytes(data),
        "synthetic_state": "SYNTHETIC",
        "nodes": nodes,
        "edges": edges,
        "claim_boundary": "Parsing and deterministic mapping do not establish clinical correctness. Derived nodes intentionally exclude direct name/address/contact fields.",
    }
    out["graph_sha256"] = sha256_bytes(canonical_json_bytes(out))
    return out

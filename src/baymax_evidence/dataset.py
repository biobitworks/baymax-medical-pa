from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import json
from typing import Any, Mapping, Optional


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@dataclass(frozen=True)
class DatasetSourceFCO:
    source_type: str
    source_name: str
    source_uri: str
    source_revision: str
    dataset_id: str
    retrieved_at: str
    license: str
    license_identity: str
    synthetic_state: str
    access_class: str
    restricted_access: bool
    canonical_file_sha256: str
    canonical_file_bytes: int
    record_count: int
    schema_identity: str
    intended_use: str
    training_rights: str
    redistribution_rights: str
    commercial_use: str
    attribution_requirements: str
    source_provenance: str
    correctness_state: str
    notes: str = ""

    def __post_init__(self) -> None:
        if self.synthetic_state not in {"SYNTHETIC", "PUBLIC_POPULATION_EVIDENCE", "UNKNOWN"}:
            raise ValueError("unsupported synthetic_state")
        if len(self.canonical_file_sha256) != 64:
            raise ValueError("canonical_file_sha256 must be a SHA-256 hex digest")
        int(self.canonical_file_sha256, 16)
        if self.canonical_file_bytes < 0 or self.record_count < 0:
            raise ValueError("byte and record counts must be non-negative")

    def to_dict(self) -> Mapping[str, Any]:
        d = asdict(self)
        d["schema"] = "baymax.dataset_source_fco.v1"
        d["identity_gate"] = "OBSERVED"
        d["authenticity_gate"] = "SOURCE_ORIGIN_OBSERVED"
        d["provenance_gate"] = "OBSERVED"
        d["correctness_gate"] = self.correctness_state
        d["empirical_measurement_gate"] = "MEASURED_WHERE_RECORDED"
        d["claim_boundary"] = "SHA-256 establishes byte identity only; it does not establish medical correctness, truth, or fitness for clinical use."
        return d

    def fco_id(self) -> str:
        identity = {
            "source_type": self.source_type,
            "source_name": self.source_name,
            "source_uri": self.source_uri,
            "source_revision": self.source_revision,
            "dataset_id": self.dataset_id,
            "canonical_file_sha256": self.canonical_file_sha256,
        }
        return "dataset-source:" + sha256_bytes(canonical_json_bytes(identity))

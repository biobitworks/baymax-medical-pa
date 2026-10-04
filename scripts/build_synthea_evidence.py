from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from baymax_evidence.dataset import DatasetSourceFCO, canonical_json_bytes
from baymax_evidence.fhir import transform_fhir_bundle

FIXTURE = Path.home() / ".local" / "share" / "baymax-synthetic-structure" / "brock407_fhir_r4.json"
OUT_SOURCE = ROOT / "evidence" / "datasets" / "synthea_dataset_source_fco.json"
OUT_GRAPH = ROOT / "evidence" / "transforms" / "synthea_brock407_fcg.json"

EXPECTED_SHA = "93e322ae61082775f578b8833c343551939206bba8838af65e296994f2eb5504"
SAMPLE_REPO_REV = "9959d9178ea28f4ec10f17ee238b6fabe6eb0de5"
GENERATOR_REV = "d9d07a6eef91ee5144293b42ab64224d84d124f8"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--retrieved-at", required=True)
    args = parser.parse_args()

    data = FIXTURE.read_bytes()
    actual = hashlib.sha256(data).hexdigest()
    if actual != EXPECTED_SHA:
        raise SystemExit(f"fixture identity mismatch: {actual}")

    schema_summary = {
        "format": "HL7 FHIR R4 Bundle",
        "required_resource_types": [
            "Patient",
            "Condition",
            "Observation",
            "Encounter",
            "MedicationRequest",
            "AllergyIntolerance",
            "CarePlan",
        ],
    }
    schema_identity = hashlib.sha256(canonical_json_bytes(schema_summary)).hexdigest()
    source = DatasetSourceFCO(
        source_type="FHIR_R4_BUNDLE",
        source_name="Official Synthea sample patient bundle",
        source_uri="https://github.com/synthetichealth/synthea-sample-data",
        source_revision=SAMPLE_REPO_REV,
        dataset_id="synthea-sample-data:latest-fhir:brock407",
        retrieved_at=args.retrieved_at,
        license="UNKNOWN_TERMS_OFFICIAL_USE_STATEMENT_ONLY",
        license_identity="https://synthetichealth.github.io/downloads.html",
        synthetic_state="SYNTHETIC",
        access_class="PUBLIC_SYNTHETIC",
        restricted_access=False,
        canonical_file_sha256=actual,
        canonical_file_bytes=len(data),
        record_count=1,
        schema_identity=schema_identity,
        intended_use="Baymax governed longitudinal synthetic-patient fixture",
        training_rights="UNKNOWN_TERMS_NOT_USED_FOR_TRAINING_IN_THIS_TRANCHE",
        redistribution_rights="UNKNOWN_TERMS",
        commercial_use="OFFICIAL_SITE_STATES_INDUSTRY_USE_ALLOWED_NOT_FORMAL_LICENSE",
        attribution_requirements="CITATION_REQUESTED_NOT_CONFIRMED_LICENSE_CONDITION",
        source_provenance=(
            "Official synthetichealth/synthea-sample-data FHIR latest archive; "
            f"sample repo revision {SAMPLE_REPO_REV}; current generator revision recorded separately as {GENERATOR_REV}."
        ),
        correctness_state="UNKNOWN",
        notes="Synthetic fixture only; not deidentified real patient data. Generator revision for this historical archive is not independently proven. Official site use language is not treated as a formal dataset license.",
    )
    sd = dict(source.to_dict())
    sd["fco_id"] = source.fco_id()
    OUT_SOURCE.write_text(json.dumps(sd, indent=2, sort_keys=True) + "\n")

    graph = transform_fhir_bundle(data, source.fco_id())
    OUT_GRAPH.write_text(json.dumps(graph, indent=2, sort_keys=True) + "\n")
    print(f"DATASET_SOURCE_FCO={source.fco_id()}")
    print(f"FHIR_TO_FCO_NODES={len(graph['nodes'])}")
    print(f"FCG_EDGES={len(graph['edges'])}")
    print(f"GRAPH_SHA256={graph['graph_sha256']}")


if __name__ == "__main__":
    main()

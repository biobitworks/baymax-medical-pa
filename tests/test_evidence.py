import hashlib
import json
from pathlib import Path
import socket
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from baymax_evidence.dataset import DatasetSourceFCO
from baymax_evidence.fhir import transform_fhir_bundle
from baymax_evidence.public_sources import PUBLIC_SOURCES

FIXTURE = Path.home() / ".local/share/baymax-synthetic-structure/brock407_fhir_r4.json"
FIXTURE_SHA = "93e322ae61082775f578b8833c343551939206bba8838af65e296994f2eb5504"


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        if not FIXTURE.exists():
            self.skipTest("historical raw FHIR is local-only; see structure admission receipt")

    def test_synthea_fixture_exact_identity(self):
        b = FIXTURE.read_bytes()
        self.assertEqual(hashlib.sha256(b).hexdigest(), FIXTURE_SHA)

    def test_fhir_mapping_is_stable_and_minimum_necessary(self):
        b = FIXTURE.read_bytes()
        ds = DatasetSourceFCO(
            source_type="FHIR_R4_BUNDLE",
            source_name="Synthea official sample FHIR",
            source_uri="synthetichealth/synthea-sample-data",
            source_revision="9959d9178ea28f4ec10f17ee238b6fabe6eb0de5",
            dataset_id="synthea-fhir-latest:brock407",
            retrieved_at="2026-10-04T00:00:00Z",
            license="UNKNOWN_TERMS_OFFICIAL_USE_STATEMENT_ONLY",
            license_identity="https://synthetichealth.github.io/downloads.html",
            synthetic_state="SYNTHETIC",
            access_class="PUBLIC_SYNTHETIC",
            restricted_access=False,
            canonical_file_sha256=FIXTURE_SHA,
            canonical_file_bytes=len(b),
            record_count=1,
            schema_identity="HL7_FHIR_R4_BUNDLE",
            intended_use="Baymax synthetic longitudinal fixture",
            training_rights="UNKNOWN_TERMS_NOT_USED_FOR_TRAINING",
            redistribution_rights="UNKNOWN_TERMS",
            commercial_use="OFFICIAL_SITE_STATES_INDUSTRY_USE_ALLOWED_NOT_FORMAL_LICENSE",
            attribution_requirements="CITATION_REQUESTED_NOT_CONFIRMED_LICENSE_CONDITION",
            source_provenance="Official Synthea organization sample-data repository",
            correctness_state="UNKNOWN",
        )
        g1 = transform_fhir_bundle(b, ds.fco_id())
        g2 = transform_fhir_bundle(b, ds.fco_id())
        self.assertEqual(g1, g2)
        counts = {}
        for n in g1["nodes"]:
            counts[n["source_resource_type"]] = counts.get(n["source_resource_type"], 0) + 1
            self.assertFalse({"name", "address", "telecom", "contact", "photo"}.intersection(n))
        self.assertEqual(counts["Patient"], 1)
        self.assertEqual(counts["Condition"], 15)
        self.assertEqual(counts["Observation"], 74)
        self.assertEqual(counts["Encounter"], 16)
        self.assertEqual(counts["MedicationRequest"], 4)
        self.assertEqual(counts["AllergyIntolerance"], 7)
        self.assertEqual(counts["CarePlan"], 2)

    def test_local_transform_makes_no_network_call(self):
        original = socket.socket
        class BlockedSocket:
            def __init__(self, *args, **kwargs):
                raise AssertionError("network access attempted during local transform")
        socket.socket = BlockedSocket
        try:
            transform_fhir_bundle(FIXTURE.read_bytes(), "dataset-source:test")
        finally:
            socket.socket = original

    def test_public_sources_cannot_be_personal_facts_by_default(self):
        self.assertEqual(set(PUBLIC_SOURCES), {"CDC", "CMS", "HHS"})
        for source in PUBLIC_SOURCES.values():
            self.assertEqual(source.access_class, "PUBLIC_POPULATION_EVIDENCE")
            self.assertEqual(source.personal_fact_promotion, "PROHIBITED_WITHOUT_EXPLICIT_TRANSFORMATION")


if __name__ == "__main__":
    unittest.main()

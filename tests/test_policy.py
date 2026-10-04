import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from baymax_compliance.policy import ComplianceDecision, ComplianceRequest, route_request


class ComplianceRouterTests(unittest.TestCase):
    def test_phi_external_without_contract_routes_local(self):
        decision = route_request(
            ComplianceRequest(
                data_classes=frozenset({"PHI", "HEALTH"}),
                purpose="WELLNESS",
                requested_route="EXTERNAL",
                provider_contract_verified=False,
                explicit_external_authorization=True,
                local_execution_available=True,
            )
        )
        self.assertEqual(decision, ComplianceDecision.LOCAL_ONLY)

    def test_phi_external_without_local_or_contract_blocks(self):
        decision = route_request(
            ComplianceRequest(
                data_classes=frozenset({"PHI"}),
                purpose="WELLNESS",
                requested_route="EXTERNAL",
                explicit_external_authorization=True,
                local_execution_available=False,
            )
        )
        self.assertEqual(decision, ComplianceDecision.BLOCK)

    def test_deidentified_health_research_can_leave_when_authorized(self):
        decision = route_request(
            ComplianceRequest(
                data_classes=frozenset({"HEALTH"}),
                purpose="RESEARCH_RETRIEVAL",
                requested_route="EXTERNAL",
                deidentified=True,
                explicit_external_authorization=True,
            )
        )
        self.assertEqual(decision, ComplianceDecision.ALLOW_DEIDENTIFIED_EXTERNAL)

    def test_medication_change_requires_human_review_even_local(self):
        decision = route_request(
            ComplianceRequest(
                data_classes=frozenset({"HEALTH"}),
                purpose="MEDICATION_CHANGE",
                requested_route="LOCAL",
            )
        )
        self.assertEqual(decision, ComplianceDecision.HUMAN_REVIEW_REQUIRED)

    def test_credentials_always_block(self):
        decision = route_request(
            ComplianceRequest(
                data_classes=frozenset({"CREDENTIAL"}),
                purpose="RESEARCH_RETRIEVAL",
                requested_route="LOCAL",
            )
        )
        self.assertEqual(decision, ComplianceDecision.BLOCK)


if __name__ == "__main__":
    unittest.main()

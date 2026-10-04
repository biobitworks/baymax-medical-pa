"""Fail-closed prototype compliance router.

This module implements engineering policy, not a legal determination.
No model is consulted to decide whether a provider is allowed to receive data.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class ComplianceDecision(str, Enum):
    LOCAL_ONLY = "LOCAL_ONLY"
    ALLOW_DEIDENTIFIED_EXTERNAL = "ALLOW_DEIDENTIFIED_EXTERNAL"
    ALLOW_CONTRACTED_EXTERNAL = "ALLOW_CONTRACTED_EXTERNAL"
    HUMAN_REVIEW_REQUIRED = "HUMAN_REVIEW_REQUIRED"
    BLOCK = "BLOCK"


SENSITIVE_CLASSES = frozenset(
    {
        "PHI",
        "HEALTH",
        "GENETIC",
        "BIOMETRIC",
        "PRECISE_GEOLOCATION",
        "CREDENTIAL",
        "TRADE_SECRET",
        "PRIVATE_PROMPT",
    }
)

HIGH_CONSEQUENCE_PURPOSES = frozenset(
    {
        "DIAGNOSIS",
        "MEDICATION_CHANGE",
        "TREATMENT_CHANGE",
        "EMERGENCY_DECISION",
    }
)


@dataclass(frozen=True)
class ComplianceRequest:
    data_classes: frozenset[str]
    purpose: str
    requested_route: str
    deidentified: bool = False
    provider_contract_verified: bool = False
    explicit_external_authorization: bool = False
    local_execution_available: bool = True


def route_request(req: ComplianceRequest) -> ComplianceDecision:
    """Return the strongest route supported by explicit request metadata."""

    data_classes = frozenset(x.upper() for x in req.data_classes)
    purpose = req.purpose.upper()
    requested_route = req.requested_route.upper()

    if "CREDENTIAL" in data_classes:
        return ComplianceDecision.BLOCK

    if purpose in HIGH_CONSEQUENCE_PURPOSES:
        return ComplianceDecision.HUMAN_REVIEW_REQUIRED

    sensitive = bool(data_classes & SENSITIVE_CLASSES)

    if requested_route == "LOCAL":
        return ComplianceDecision.LOCAL_ONLY

    if sensitive:
        if not req.explicit_external_authorization:
            return (
                ComplianceDecision.LOCAL_ONLY
                if req.local_execution_available
                else ComplianceDecision.BLOCK
            )
        if req.deidentified and not ({"PHI", "CREDENTIAL", "TRADE_SECRET"} & data_classes):
            return ComplianceDecision.ALLOW_DEIDENTIFIED_EXTERNAL
        if req.provider_contract_verified:
            return ComplianceDecision.ALLOW_CONTRACTED_EXTERNAL
        return (
            ComplianceDecision.LOCAL_ONLY
            if req.local_execution_available
            else ComplianceDecision.BLOCK
        )

    if requested_route == "EXTERNAL" and req.explicit_external_authorization:
        if req.provider_contract_verified:
            return ComplianceDecision.ALLOW_CONTRACTED_EXTERNAL
        if req.deidentified:
            return ComplianceDecision.ALLOW_DEIDENTIFIED_EXTERNAL

    return (
        ComplianceDecision.LOCAL_ONLY
        if req.local_execution_available
        else ComplianceDecision.BLOCK
    )

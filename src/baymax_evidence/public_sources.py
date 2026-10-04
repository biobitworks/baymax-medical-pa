from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PublicEvidenceSource:
    source_id: str
    agency: str
    catalog_url: str
    access_class: str = "PUBLIC_POPULATION_EVIDENCE"
    personal_fact_promotion: str = "PROHIBITED_WITHOUT_EXPLICIT_TRANSFORMATION"


PUBLIC_SOURCES = {
    "CDC": PublicEvidenceSource(
        "cdc-data", "CDC", "https://data.cdc.gov/"
    ),
    "CMS": PublicEvidenceSource(
        "cms-data", "CMS", "https://data.cms.gov/data.json"
    ),
    "HHS": PublicEvidenceSource(
        "hhs-healthdata", "HHS/HealthData.gov", "https://healthdata.gov/"
    ),
}

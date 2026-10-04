"""Frozen minimum-necessary local-model packet with positive, source-bound output contract."""
from __future__ import annotations

import hashlib
import json
import unicodedata
from . import canonical

OUTPUT_KEYS = {
    "summary",
    "known",
    "unknown",
    "recommended_questions",
    "medical_action",
    "requires_clinician",
}
SUMMARY_CODE = "SYNTHETIC_CONTEXT_ONLY"
MEDICAL_ACTION = "NONE"
PACKET_SHA256 = "80e92bd4d0583fb58b261164ba2e53543ce7482a0f767bc7c3368c460de54147"
CATALOG_SHA256 = "648e0e87bc4ec024dd1d46283bd7697fc9de266aef6980d336c113c7311d8d8a"
CATALOG_CANONICAL_SHA256 = "b4696fa3f798cf36df10d7b06efd9093c9492c5a4bcc5176ace7dc03200badff"

def _first_patient(bundle):
    return (bundle.get("synthetic_patient_context") or [{}])[0]

def _active_meds(bundle):
    return [m for m in bundle.get("medication_context", []) if m.get("status") == "active"][:4]

def catalog(bundle, offline_fco, source_bundle_sha256):
    if len(source_bundle_sha256) != 64:
        raise ValueError("exact source bundle SHA-256 required")
    if offline_fco.get("synthetic_state") != "SYNTHETIC":
        raise ValueError("trusted synthetic OfflineTravelBundleFCO required")
    if offline_fco.get("correctness_state") != "UNKNOWN":
        raise ValueError("unexpected correctness state")

    patient = _first_patient(bundle)
    known = []
    patient_fco = patient.get("source_fco_id")
    gender = patient.get("gender", "UNKNOWN")
    if not patient_fco:
        raise ValueError("patient source FCO required")
    known.append({
        "id": len(known),
        "source_fco_id": patient_fco,
        "text": f"Synthetic patient gender: {gender}.",
    })

    for med in _active_meds(bundle):
        source = med.get("source_fco_id")
        concept = med.get("medicationCodeableConcept") or {}
        text = concept.get("text")
        if not source or not text:
            raise ValueError("active medication source/text required")
        known.append({
            "id": len(known),
            "source_fco_id": source,
            "text": f"Synthetic active medication record: {text}.",
        })

    known.append({
        "id": len(known),
        "source_fco_id": offline_fco["fco_id"],
        "text": "Synthetic trip destination: Bali, Indonesia.",
    })

    unknown_text = [
        "Medical correctness is UNKNOWN.",
        "Generated-data terms remain UNKNOWN_TERMS.",
        "US Core conformance is UNKNOWN.",
        "Travel medication eligibility is UNKNOWN.",
        "Live pharmacy stock is UNKNOWN.",
        "Live pharmacy hours are UNKNOWN.",
    ]
    unknown = [{"id": i, "text": text} for i, text in enumerate(unknown_text)]

    question_text = [
        "What documentation should be confirmed with a pharmacist or clinician before travel?",
        "What travel medication eligibility information is still unknown?",
        "What current pharmacy stock and hours must be verified from a live source when connectivity is available?",
    ]
    questions = [{"id": i, "text": text} for i, text in enumerate(question_text)]

    return {
        "schema": "baymax.apollo-catalog.v2",
        "synthetic_only": True,
        "source_offline_bundle_sha256": source_bundle_sha256,
        "source_offline_fco_id": offline_fco["fco_id"],
        "known": known,
        "unknown": unknown,
        "recommended_questions": questions,
        "summary_codes": [SUMMARY_CODE],
        "medical_actions": [MEDICAL_ACTION],
        "required_requires_clinician": True,
        "claim_boundary": "Model may select only pre-admitted local IDs. Baymax renders local catalog text; model free-form medical prose is not admitted.",
    }

def packet(bundle, offline_fco, source_bundle_sha256):
    cat = catalog(bundle, offline_fco, source_bundle_sha256)
    instructions = """APOLLO_CONTEXT_PACKET_V2
SYNTHETIC DEMO ONLY.
Baymax policy is authoritative. You are not a medical authority.
Do not diagnose, prescribe, alter medication, claim live stock/hours, purchase, call, or create wallet actions.
You may ONLY select integer IDs from the catalog below.
Return exactly one JSON object and no markdown:
{
  "summary": "SYNTHETIC_CONTEXT_ONLY",
  "known": [integer ids from CATALOG.known],
  "unknown": [integer ids from CATALOG.unknown],
  "recommended_questions": [integer ids from CATALOG.recommended_questions],
  "medical_action": "NONE",
  "requires_clinician": true
}
No other keys or values are allowed.
CATALOG_JSON=
"""
    return instructions.encode() + canonical(cat) + bytes([10])

def _unique_object(pairs):
    out = {}
    normalized = set()
    for k, v in pairs:
        norm = unicodedata.normalize("NFC", k)
        if norm in normalized:
            raise ValueError("duplicate key")
        normalized.add(norm)
        out[k] = v
    return out

def _validate_ids(values, size, field):
    if not isinstance(values, list) or len(values) > 10:
        raise ValueError(field)
    if any(type(v) is not int for v in values):
        raise ValueError(field)
    if len(values) != len(set(values)):
        raise ValueError(field + " duplicate")
    if any(v < 0 or v >= size for v in values):
        raise ValueError(field + " range")

def validate_response(raw, cat):
    if not isinstance(raw, str) or len(raw.encode("utf-8")) > 4096:
        raise ValueError("response size limit")
    def reject_number(token):
        raise ValueError("integer JSON tokens only")

    try:
        out = json.loads(raw, object_pairs_hook=_unique_object,
                         parse_float=reject_number, parse_constant=reject_number)
    except RecursionError as exc:
        raise ValueError("response nesting limit") from exc
    if not isinstance(out, dict) or set(out) != OUTPUT_KEYS:
        raise ValueError("schema")
    if out["summary"] != SUMMARY_CODE:
        raise ValueError("summary")
    if out["medical_action"] != MEDICAL_ACTION:
        raise ValueError("medical action")
    if out["requires_clinician"] is not True:
        raise ValueError("clinician gate")
    _validate_ids(out["known"], len(cat["known"]), "known")
    _validate_ids(out["unknown"], len(cat["unknown"]), "unknown")
    _validate_ids(out["recommended_questions"], len(cat["recommended_questions"]), "recommended questions")
    return out

def materialize_output(out, cat):
    return {
        "summary": "Synthetic offline context only. No medical action is authorized.",
        "known": [cat["known"][i] for i in out["known"]],
        "unknown": [cat["unknown"][i]["text"] for i in out["unknown"]],
        "recommended_questions": [cat["recommended_questions"][i]["text"] for i in out["recommended_questions"]],
        "medical_action": MEDICAL_ACTION,
        "requires_clinician": True,
    }

def inference_fco(
    raw,
    source_packet_sha256,
    cat,
    observed_at,
    *,
    substrate_label,
    model_label,
    offline_user_attested=False,
    apollo_version="UNKNOWN",
    ios_version="UNKNOWN",
    device_class="UNKNOWN",
    execution_receipt=None,
):
    """Record caller-owned execution metadata, never model-supplied identity.

    execution_receipt must come from the host/observation path. This function
    does not authenticate a runtime or upgrade human observations to verified.
    """
    catalog_raw = canonical(cat)
    catalog_sha = hashlib.sha256(catalog_raw).hexdigest()
    if source_packet_sha256 != PACKET_SHA256 or catalog_sha != CATALOG_CANONICAL_SHA256:
        raise ValueError("frozen source identity")
    result = validate_response(raw, cat)
    if not observed_at.strip() or not substrate_label.strip() or not model_label.strip():
        raise ValueError("human observation labels required")
    receipt = execution_receipt or {}
    return {
        "fco_type": "ModelInferenceFCO",
        "execution_substrate": receipt.get("execution_substrate", substrate_label),
        "model_label_observed": receipt.get("model_label_observed", model_label),
        "model_revision": receipt.get("model_revision", "UNKNOWN"),
        "model_revision_state": "UNKNOWN" if receipt.get("model_revision", "UNKNOWN") == "UNKNOWN" else "HUMAN_REPORTED_UNVERIFIED",
        "network_ui_state": receipt.get("network_ui_state", "UNKNOWN"),
        "context_packet_sha256": source_packet_sha256,
        "catalog_sha256": CATALOG_SHA256,
        "validator_state": "ACCEPT",
        "execution_substrate_reported": substrate_label,
        "execution_substrate_identity_state": "HUMAN_REPORTED_UNVERIFIED",
        "model_reported": model_label,
        "model_identity_state": "HUMAN_REPORTED_UNVERIFIED",
        "provider": receipt.get("provider", "UNKNOWN"),
        "provider_identity_state": "HUMAN_REPORTED_UNVERIFIED",
        "apollo_version_reported": apollo_version or "UNKNOWN",
        "ios_version_reported": ios_version or "UNKNOWN",
        "device_class_reported": device_class or "UNKNOWN",
        "source_packet_sha256": source_packet_sha256,
        "destination_packet_sha256": "NOT_INDEPENDENTLY_VERIFIED",
        "response_sha256": hashlib.sha256(raw.encode()).hexdigest(),
        "network_state": "USER_ATTESTED_OFFLINE" if offline_user_attested else "UNKNOWN",
        "network_observation_state": "USER_ATTESTED",
        "observed_at": observed_at,
        "observation_source": "HUMAN_MEDIATED_MANUAL_TRANSFER",
        "inference_class": "MODEL_INFERRED",
        "medical_authority": "NONE",
        "correctness_state": "UNKNOWN",
        "wallet_authority": "NONE",
        "source_fco_overwrite": "PROHIBITED",
        "output_selection": result,
        "display_output": materialize_output(result, cat),
    }

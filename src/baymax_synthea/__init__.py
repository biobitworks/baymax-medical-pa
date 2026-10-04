"""Local, minimized synthetic FHIR evidence transformation. No network operations."""
import hashlib
import json

TYPES = {'Patient', 'Condition', 'Observation', 'Encounter', 'MedicationRequest', 'AllergyIntolerance', 'CarePlan'}
FIELDS = {'Patient': ['gender'], 'Condition': ['code', 'clinicalStatus'], 'Observation': ['code', 'valueQuantity', 'valueCodeableConcept', 'effectiveDateTime'], 'Encounter': ['class', 'period', 'type'], 'MedicationRequest': ['medicationCodeableConcept', 'status', 'intent'], 'AllergyIntolerance': ['code', 'clinicalStatus'], 'CarePlan': ['category', 'status', 'intent']}

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()

def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()

def transform(bundle, source_id):
    if bundle.get('resourceType') != 'Bundle' or not isinstance(bundle.get('entry'), list):
        raise ValueError('FHIR Bundle with entries required')
    nodes, edges, exclusions = [], [], []
    for entry in bundle['entry']:
        r = entry['resource']; t = r['resourceType']; rid = r.get('id', 'UNKNOWN')
        if t not in TYPES:
            exclusions.append({'source_resource_type': t, 'source_resource_id': rid, 'source_resource_sha256': digest(r), 'mapping_state': 'NOT_MAPPED', 'synthetic_state': 'UNKNOWN_PUBLIC_PROVIDER_POSSIBLE' if t in {'Organization', 'Location', 'Practitioner', 'PractitionerRole'} else 'UNKNOWN'})
            continue
        nid = 'fco:' + digest(r)
        nodes.append({'id': nid, 'type': 'SyntheticClinicalResourceFCO', 'source_dataset_fco_id': source_id, 'source_resource_type': t, 'source_resource_id': rid, 'source_resource_sha256': digest(r), 'synthetic_state': 'SYNTHETIC', 'correctness_state': 'UNKNOWN', 'context': {k: r[k] if k in r else 'UNKNOWN' for k in FIELDS[t]}, 'unmapped_fields': {k: 'NOT_MAPPED' for k in sorted(set(r) - set(FIELDS[t]))}})
        edges.append({'from': nid, 'to': source_id, 'type': 'DERIVED_FROM'})
    return {'schema': 'baymax.synthetic-fcg.v1', 'nodes': nodes, 'edges': edges, 'excluded_resources': exclusions, 'correctness_state': 'UNKNOWN'}

def iphone_fixture(graph, provenance):
    contexts = lambda t: [n['context'] | {'source_fco_id': n['id']} for n in graph['nodes'] if n['source_resource_type'] == t]
    return {'schema': 'baymax.offline-travel.v1', 'synthetic_patient_context': contexts('Patient'), 'medication_context': contexts('MedicationRequest'), 'clinical_context': {t: contexts(t) for t in sorted(TYPES - {'Patient', 'MedicationRequest'})}, 'trip_context': {'destination': 'Bali, Indonesia', 'dates': 'UNKNOWN', 'synthetic_state': 'SYNTHETIC'}, 'synthetic_directory': [{'id': 'demo-pharmacy-1', 'label': 'Synthetic demo pharmacy', 'synthetic_state': 'SYNTHETIC', 'phone': None, 'call_enabled': False, 'purchase_enabled': False}], 'synthetic_map_points': [{'directory_id': 'demo-pharmacy-1', 'latitude': -8.65, 'longitude': 115.22, 'synthetic_state': 'SYNTHETIC', 'accuracy': 'UNKNOWN', 'navigation_enabled': False}], 'source': provenance, 'freshness': {'reference_date': '2026-01-01', 'live_updates': False, 'current_accuracy': 'UNKNOWN'}, 'unknown_states': ['medical_correctness', 'generated_data_terms', 'US_CORE_conformance', 'travel_medication_eligibility'], 'compliance_route': {'execution': 'DETERMINISTIC_POLICY_LOCAL_ONLY', 'network_required': False, 'real_world_actions': 'BLOCKED', 'medical_authority': 'NONE', 'clinician_review': 'REQUIRED_BEFORE_MEDICAL_ACTION'}}

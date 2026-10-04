from __future__ import annotations
from collections import Counter
from pathlib import Path
import hashlib, json, sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from baymax_travel import canonical
from baymax_travel.model import catalog, packet

FCG_PATH=ROOT/'evidence/codex_synthea/fcg.json'
SOURCE_PATH=ROOT/'evidence/codex_synthea/dataset_source_fco.json'
BUNDLE_PATH=ROOT/'fixtures/iphone/offline_travel_bundle_v1.json'
FCO_PATH=ROOT/'fixtures/iphone/OfflineTravelBundleFCO.json'
CATALOG_PATH=ROOT/'fixtures/iphone/apollo_catalog_v2.json'
PACKET_PATH=ROOT/'fixtures/iphone/apollo_context_packet_v2.txt'
RECEIPT_PATH=ROOT/'evidence/receipts/iphone/apollo_packet_v3_lineage.json'
MAX_REFERENCES=16

def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def resource_ref(node):
    return {
        'fco_id': node['id'],
        'source_resource_type': node['source_resource_type'],
        'source_resource_id': node['source_resource_id'],
        'source_resource_sha256': node['source_resource_sha256'],
        'source_dataset_fco_id': node['source_dataset_fco_id'],
        'synthetic_state': node['synthetic_state'],
        'correctness_state': node['correctness_state'],
    }

def build_offline_fco(fcg, source, bundle):
    dataset_id=source['id']
    manifests=source['manifests']
    if source['type']!='DatasetSourceFCO' or not source['synthetic_state'].startswith('SYNTHETIC'):
        raise ValueError('controlled synthetic DatasetSourceFCO required')
    if not manifests or len({m['sha256'] for m in manifests})!=1:
        raise ValueError('single reproducible FHIR identity required')
    fhir_sha=manifests[0]['sha256']
    graph_sha=sha_bytes(FCG_PATH.read_bytes())
    bsrc=bundle.get('source') or {}
    if bsrc.get('dataset_fco_id')!=dataset_id:
        raise ValueError('bundle dataset lineage mismatch')
    if bsrc.get('fhir_sha256')!=fhir_sha:
        raise ValueError('bundle FHIR lineage mismatch')
    if bsrc.get('fcg_sha256')!=graph_sha:
        raise ValueError('bundle FCG lineage mismatch')
    nodes=fcg.get('nodes') or []
    if not nodes or any(n.get('source_dataset_fco_id')!=dataset_id for n in nodes):
        raise ValueError('FCG node lineage mismatch')

    required=[]
    patient=(bundle.get('synthetic_patient_context') or [{}])[0]
    if patient.get('source_fco_id'):
        required.append(patient['source_fco_id'])
    for med in bundle.get('medication_context') or []:
        if med.get('status')=='active' and med.get('source_fco_id'):
            required.append(med['source_fco_id'])
    by_id={n['id']:n for n in nodes}
    if any(fid not in by_id for fid in required):
        raise ValueError('required catalog source absent from FCG')

    selected=[]
    seen=set()
    for fid in required:
        selected.append(by_id[fid]); seen.add(fid)
    priority=sorted(
        (n for n in nodes if n['id'] not in seen),
        key=lambda n:(
            0 if n['source_resource_type']=='MedicationRequest' else
            1 if n['source_resource_type']=='Patient' else 2,
            n['source_resource_type'], n['id']
        )
    )
    selected.extend(priority[:max(0,MAX_REFERENCES-len(selected))])

    counts=Counter(n['source_resource_type'] for n in nodes)
    out={
        'schema':'baymax.offline-travel-bundle-fco.v1',
        'fco_type':'OfflineTravelBundleFCO',
        'synthetic_state':'SYNTHETIC',
        'correctness_state':'UNKNOWN',
        'source_dataset_fco_id':dataset_id,
        'source_graph_sha256':graph_sha,
        'source_bundle_sha256':fhir_sha,
        'source_projection_sha256':sha_bytes(BUNDLE_PATH.read_bytes()),
        'resource_counts':dict(sorted(counts.items())),
        'resource_references':[resource_ref(n) for n in selected],
        'omitted_reference_count':len(nodes)-len(selected),
        'bounds':{
            'max_resource_references':MAX_REFERENCES,
            'clinical_values':'NOT_MAPPED',
            'omission_state':'EXPLICIT_BOUNDED_SELECTION'
        },
        'patient_context':{'label':'Synthetic traveler','medical_correctness':'UNKNOWN'},
        'medication_context':{
            'record_count':counts['MedicationRequest'],
            'names':'ALLOWLIST_RENDERED_IN_CATALOG_ONLY',
            'dosage':'NO_ACTION_AUTHORITY',
            'travel_eligibility':'UNKNOWN'
        },
        'trip_context':{'destination':'Bali, Indonesia','dates':'UNKNOWN'},
        'directory':[{
            'id':'synthetic-pharmacy-1','label':'Synthetic demo pharmacy',
            'synthetic_state':'SYNTHETIC','phone':'UNKNOWN','availability':'UNKNOWN',
            'call_enabled':False,'purchase_enabled':False
        }],
        'freshness':{'reference_date':'2026-01-01','live_state':'UNKNOWN'},
        'execution_policy':{
            'policy_id':'baymax.synthetic-offline-demo.v1','default_route':'LOCAL_ONLY',
            'external_requests_enabled':False,'live_actions_enabled':False
        },
        'unknown_states':[
            'Clinical correctness UNKNOWN',
            'Travel medication eligibility UNKNOWN',
            'Directory availability UNKNOWN',
            'Generated-data terms UNKNOWN_TERMS'
        ],
    }
    out['fco_id']='offline-travel:'+sha_bytes(canonical(out))
    if len(canonical(out))>20000:
        raise ValueError('bundle exceeds phone projection bound')
    return out

def main():
    fcg=json.loads(FCG_PATH.read_text())
    source=json.loads(SOURCE_PATH.read_text())
    bundle=json.loads(BUNDLE_PATH.read_text())
    fco=build_offline_fco(fcg,source,bundle)
    FCO_PATH.write_text(json.dumps(fco,indent=2,sort_keys=True)+'\n')
    bundle_sha=sha_bytes(BUNDLE_PATH.read_bytes())
    cat=catalog(bundle,fco,bundle_sha)
    data=packet(bundle,fco,bundle_sha)
    CATALOG_PATH.write_text(json.dumps(cat,indent=2,sort_keys=True)+'\n')
    PACKET_PATH.write_bytes(data)
    receipt={
        'schema':'baymax.apollo-packet-receipt.v3-lineage',
        'dataset_fco_id':source['id'],
        'source_fhir_sha256':fco['source_bundle_sha256'],
        'source_graph_sha256':fco['source_graph_sha256'],
        'source_projection_sha256':bundle_sha,
        'offline_fco_id':fco['fco_id'],
        'offline_fco_sha256':sha_bytes(FCO_PATH.read_bytes()),
        'catalog_sha256':sha_bytes(CATALOG_PATH.read_bytes()),
        'catalog_canonical_sha256':sha_bytes(canonical(cat)),
        'packet_sha256':sha_bytes(data),
        'packet_bytes':len(data),
        'required_source_fco_ids':[x['source_fco_id'] for x in cat['known'] if x['source_fco_id']!=fco['fco_id']],
        'trusted_text_policy':'STATIC_ALLOWLIST_FROM_VALIDATED_CODES; DATASET_DISPLAY_TEXT_IGNORED',
        'synthetic_only':True,
        'transfer':'HUMAN_MEDIATED',
        'destination_byte_identity':'NOT_INDEPENDENTLY_VERIFIED',
        'claim_boundary':'Single-lineage source binding and trusted-text construction only; no medical correctness or model authority.'
    }
    RECEIPT_PATH.write_text(json.dumps(receipt,indent=2,sort_keys=True)+'\n')
    for k in ['offline_fco_sha256','catalog_sha256','catalog_canonical_sha256','packet_sha256']:
        print(k.upper()+'='+receipt[k])

if __name__=='__main__':
    main()

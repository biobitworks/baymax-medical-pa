"""Validate exact manually captured synthetic Apollo bytes; never infer network isolation."""
from __future__ import annotations
import argparse, hashlib, json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src'))
from baymax_travel.model import validate_response
PACKET_SHA = '80e92bd4d0583fb58b261164ba2e53543ce7482a0f767bc7c3368c460de54147'
CATALOG_SHA = '648e0e87bc4ec024dd1d46283bd7697fc9de266aef6980d336c113c7311d8d8a'

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def evaluate(raw, catalog):
    try:
        validate_response(raw.decode('utf-8'), catalog)
    except (ValueError, TypeError, UnicodeError):
        return 'REJECTED'
    return 'VALID_SCHEMA_ONLY'

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--response', required=True, type=Path)
    p.add_argument('--receipt', required=True, type=Path)
    p.add_argument('--observed-at', required=True)
    p.add_argument('--model', default='UNKNOWN')
    args = p.parse_args()
    packet = (ROOT/'fixtures/iphone/apollo_context_packet_v2.txt').read_bytes()
    catalog = (ROOT/'fixtures/iphone/apollo_catalog_v2.json').read_bytes()
    if digest(packet) != PACKET_SHA or digest(catalog) != CATALOG_SHA:
        raise SystemExit('REFUSED: frozen packet/catalog identity mismatch')
    if args.response.stat().st_size > 4096:
        raise SystemExit('REFUSED: capture exceeds response size limit')
    raw = args.response.read_bytes()
    wallet = ROOT/'fixtures/iphone/wallet_state_v1.json'
    before = digest(wallet.read_bytes())
    state = evaluate(raw, json.loads(catalog))
    after = digest(wallet.read_bytes())
    receipt = {
        'schema':'baymax.apollo-exact-response-check.v1',
        'state':'PARTIAL', 'base_commit':'510859101618ad5085f72691e47fcac96a726f3b',
        'context_packet_sha256':PACKET_SHA, 'catalog_sha256':CATALOG_SHA,
        'response_sha256':digest(raw), 'response_bytes':len(raw),
        'response_byte_source':'MANUALLY_SUPPLIED_FILE_NOT_DEVICE_ATTESTED',
        'output_contract':state, 'observed_at_reported':args.observed_at,
        'model_reported':args.model, 'model_identity':'UNVERIFIED',
        'runtime_reported':'Liquid Apollo', 'network_state':'UNKNOWN',
        'offline_inference':'NOT_TESTED_BY_THIS_VERIFIER',
        'synthetic_context_only':True, 'medical_authority':'NONE',
        'correctness_state':'UNKNOWN', 'prescription_purchase':'BLOCKED',
        'wallet_authority':'NONE', 'wallet_before_sha256':before,
        'wallet_after_sha256':after, 'wallet_unchanged':before==after,
        'canonical_admission':'PENDING_PRIMARY_LANE'
    }
    with args.receipt.open('x') as f:
        f.write(json.dumps(receipt,sort_keys=True,indent=2)+'\n')
    print('OUTPUT_CONTRACT='+state)
    print('RESPONSE_SHA256='+receipt['response_sha256'])
    raise SystemExit(0 if state=='VALID_SCHEMA_ONLY' else 2)

if __name__=='__main__': main()

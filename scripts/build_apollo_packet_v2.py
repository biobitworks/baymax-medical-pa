from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from baymax_travel.model import packet,catalog

bundle_path=ROOT/'fixtures/iphone/offline_travel_bundle_v1.json'
fco_path=ROOT/'fixtures/iphone/OfflineTravelBundleFCO.json'
bundle=json.loads(bundle_path.read_text())
offline_fco=json.loads(fco_path.read_text())
source_sha=hashlib.sha256(bundle_path.read_bytes()).hexdigest()
cat=catalog(bundle,offline_fco,source_sha)
data=packet(bundle,offline_fco,source_sha)

catalog_path=ROOT/'fixtures/iphone/apollo_catalog_v2.json'
packet_path=ROOT/'fixtures/iphone/apollo_context_packet_v2.txt'
catalog_path.write_text(json.dumps(cat,indent=2,sort_keys=True)+'\n')
packet_path.write_bytes(data)

receipt={
 'schema':'baymax.apollo-packet-receipt.v2',
 'packet_schema':'baymax.apollo-context-packet.v2',
 'source_offline_bundle_path':'fixtures/iphone/offline_travel_bundle_v1.json',
 'source_offline_bundle_sha256':hashlib.sha256(bundle_path.read_bytes()).hexdigest(),
 'source_offline_fco_path':'fixtures/iphone/OfflineTravelBundleFCO.json',
 'source_offline_fco_sha256':hashlib.sha256(fco_path.read_bytes()).hexdigest(),
 'catalog_path':'fixtures/iphone/apollo_catalog_v2.json',
 'catalog_sha256':hashlib.sha256(catalog_path.read_bytes()).hexdigest(),
 'packet_path':'fixtures/iphone/apollo_context_packet_v2.txt',
 'packet_sha256':hashlib.sha256(data).hexdigest(),
 'packet_bytes':len(data),
 'synthetic_only':True,
 'transfer':'HUMAN_MEDIATED',
 'destination_byte_identity':'NOT_INDEPENDENTLY_VERIFIED',
 'execution_substrate':'NOT_EXECUTED',
 'model_identity':'NOT_OBSERVED',
 'claim_boundary':'Source packet/catalog identity only; no destination transfer, model identity, offline inference, or medical correctness.'
}
(ROOT/'evidence/receipts/iphone/apollo_packet_v2.json').write_text(json.dumps(receipt,indent=2,sort_keys=True)+'\n')
print('APOLLO_V2_PACKET_SHA256='+receipt['packet_sha256'])
print('APOLLO_V2_PACKET_BYTES='+str(receipt['packet_bytes']))
print('APOLLO_V2_CATALOG_SHA256='+receipt['catalog_sha256'])

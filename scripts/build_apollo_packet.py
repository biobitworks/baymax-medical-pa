from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
from baymax_travel.model_v1 import packet
source=ROOT/'fixtures/iphone/offline_travel_bundle_v1.json';raw=source.read_bytes();data=packet(json.loads(raw))
p=ROOT/'fixtures/iphone/apollo_context_packet_v1.txt';p.write_bytes(data)
r={'packet_schema':'baymax.apollo-context-packet.v1','version':1,'source_offline_bundle_path':'fixtures/iphone/offline_travel_bundle_v1.json','source_offline_bundle_sha256':hashlib.sha256(raw).hexdigest(),'transformation_path':'src/baymax_travel/model_v1.py','minimum_necessary_transformation_sha256':hashlib.sha256((ROOT/'src/baymax_travel/model_v1.py').read_bytes()).hexdigest(),'sha256':hashlib.sha256(data).hexdigest(),'byte_count':len(data),'synthetic_only':True,'model':'OBSERVE_ON_DEVICE','runtime':'Liquid Apollo / LEAP local','physical_execution':'NOT_TESTED','inter_app_api':'NOT_IMPLEMENTED'}
(ROOT/'evidence/receipts/iphone/apollo_packet.json').write_text(json.dumps(r,indent=2,sort_keys=True)+'\n');print('CONTEXT_PACKET_SHA256='+r['sha256'])

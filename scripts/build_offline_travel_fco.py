from pathlib import Path
import sys,json
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
from baymax_travel import build_bundle,canonical
source=json.loads((ROOT/'evidence/datasets/synthea_dataset_source_fco.json').read_text())
graph=json.loads((ROOT/'evidence/transforms/synthea_brock407_fcg.json').read_text())
out=build_bundle(graph,source)
p=ROOT/'fixtures/iphone/OfflineTravelBundleFCO.json';p.write_bytes(canonical(out)+b'\n')
print('FCO_ID='+out['fco_id']);print('BYTES='+str(p.stat().st_size))

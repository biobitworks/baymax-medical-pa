"""Build independent Codex evidence from two local pinned Synthea runs."""
import hashlib,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from baymax_synthea import transform,iphone_fixture,canonical,digest
ROOT=Path(__file__).resolve().parents[1]; E=ROOT/'evidence/codex_synthea'
def write(path,value):
 path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(canonical(value)+b'\n')
def main():
 runs=[]
 for i in (1,2):
  files=list((Path.home()/'.local/share/baymax-synthea-v4'/f'run{i}'/'output/fhir').glob('*.json'))
  if len(files)!=1: raise ValueError(f'Expected exactly one patient bundle, found {len(files)}')
  raw=files[0].read_bytes(); bundle=json.loads(raw)
  runs.append((raw,bundle))
 manifests=[{'run':i+1,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'canonical_sha256':digest(bundle),'resource_count':len(bundle['entry'])} for i,(raw,bundle) in enumerate(runs)]
 state='BYTE_IDENTICAL' if runs[0][0]==runs[1][0] else ('SEMANTICALLY_EQUIVALENT' if canonical(runs[0][1])==canonical(runs[1][1]) else 'DIVERGENT')
 write(E/'reproducibility.json',{'classification':state,'runs':manifests,'comparison':'Raw bytes, then canonical JSON equality; no timestamps or fields removed'})
 source={'type':'DatasetSourceFCO','id':'dataset:synthea-v4-424242','synthetic_state':'SYNTHETIC_PATIENT_WITH_POSSIBLE_PUBLIC_PROVIDER_DATA','correctness_state':'UNKNOWN','generated_data_terms':'UNKNOWN_TERMS','manifests':manifests,'recipe':'evidence/codex_synthea/recipe.json'}
 write(E/'dataset_source_fco.json',source); write(E/'fhir_manifest.json',{'runs':manifests,'raw_storage':'LOCAL_OUTSIDE_GIT','patient_state':'SYNTHETIC','provider_state':'UNKNOWN_PUBLIC_PROVIDER_POSSIBLE'})
 graph=transform(runs[0][1],source['id']); write(E/'fcg.json',graph)
 write(ROOT/'fixtures/iphone/offline_travel_bundle_v1.json',iphone_fixture(graph,{'dataset_fco_id':source['id'],'fhir_sha256':manifests[0]['sha256'],'fcg_sha256':hashlib.sha256((E/'fcg.json').read_bytes()).hexdigest(),'directory_origin':'HAND_AUTHORED_SYNTHETIC'}))
 print('REPRODUCIBILITY='+state)
if __name__=='__main__': main()

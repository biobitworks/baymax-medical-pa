import base64,hashlib,json,socket,sys,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from baymax_synthea import transform,digest,TYPES
ROOT=Path(__file__).resolve().parents[1]; E=ROOT/'evidence/codex_synthea'
class SyntheaTests(unittest.TestCase):
 def test_signature(self):
  from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
  r=json.loads((E/'actor_signature.json').read_text()); raw=(E/'actor_admission.json').read_bytes()
  self.assertEqual(hashlib.sha256(raw).hexdigest(),r['signed_payload_sha256'])
  Ed25519PublicKey.from_public_bytes(base64.b64decode(r['public_key'])).verify(base64.b64decode(r['detached_signature']),raw)
 def test_actual_fhir_provenance(self):
  files=list((Path.home()/'.local/share/baymax-synthea-v4/run1/output/fhir').glob('*.json'))
  if not files: self.skipTest('raw generation evidence is local only; rerun recipe')
  b=json.loads(files[0].read_text()); g=transform(b,'source')
  originals={digest(e['resource']):e['resource'] for e in b['entry']}
  self.assertEqual(len(g['nodes']),sum(e['resource']['resourceType'] in TYPES for e in b['entry']))
  for n in g['nodes']:
   self.assertEqual(originals[n['source_resource_sha256']]['id'],n['source_resource_id'])
   self.assertEqual(n['correctness_state'],'UNKNOWN'); self.assertEqual(n['synthetic_state'],'SYNTHETIC')
 def test_offline_decode_and_minimization(self):
  with patch.object(socket,'socket',side_effect=AssertionError('network forbidden')):
   f=json.loads((ROOT/'fixtures/iphone/offline_travel_bundle_v1.json').read_text())
  self.assertFalse(f['compliance_route']['network_required'])
  for d in f['synthetic_directory']: self.assertFalse(d['call_enabled']); self.assertIsNone(d['phone'])
  def walk(v):
   if isinstance(v,dict):
    self.assertFalse(set(v)&{'name','address','telecom','birthDate','identifier'})
    for x in v.values(): walk(x)
   elif isinstance(v,list):
    for x in v: walk(x)
  walk(f)
 def test_reproducibility_and_artifact(self):
  r=json.loads((E/'reproducibility.json').read_text()); self.assertIn(r['classification'],['BYTE_IDENTICAL','SEMANTICALLY_EQUIVALENT'])
  s=json.loads((E/'source.json').read_text()); jar=Path.home()/'.local/share/baymax-synthea-v4/synthea-with-dependencies.jar'
  if jar.exists(): self.assertEqual(hashlib.sha256(jar.read_bytes()).hexdigest(),s['jar_sha256'])
 def test_unsupported_and_bad_input(self):
  with self.assertRaises(ValueError): transform({},'s')
  g=transform({'resourceType':'Bundle','entry':[{'resource':{'resourceType':'Organization','id':'x','telecom':[{'value':'real-number'}]}}]},'s')
  self.assertEqual(g['nodes'],[]); self.assertEqual(g['excluded_resources'][0]['mapping_state'],'NOT_MAPPED')

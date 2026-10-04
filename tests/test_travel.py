import copy,json,socket,sys,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
from baymax_travel import build_bundle,canonical,gate,guarded_request
class TravelTests(unittest.TestCase):
 def setUp(self):
  self.g=json.loads((ROOT/'evidence/transforms/synthea_brock407_fcg.json').read_text());self.s=json.loads((ROOT/'evidence/datasets/synthea_dataset_source_fco.json').read_text())
 def test_bounded_reproducible_from_admitted_graph(self):
  with patch.object(socket,'socket',side_effect=AssertionError('network')): a=build_bundle(self.g,self.s); b=build_bundle(self.g,self.s)
  self.assertEqual(a,b);self.assertLessEqual(len(canonical(a)),20000);self.assertEqual(len(a['resource_references']),16);self.assertEqual(a['omitted_reference_count'],103);self.assertEqual(a['medication_context']['names'],'UNKNOWN')
  self.assertEqual(json.loads((ROOT/'fixtures/iphone/OfflineTravelBundleFCO.json').read_text()),a)
 def test_wrong_source_or_real_data_rejected(self):
  for mutation in ['source','synthetic','node']:
   g=copy.deepcopy(self.g)
   if mutation=='source': g['source_dataset_fco_id']='wrong'
   if mutation=='synthetic': g['synthetic_state']='REAL'
   if mutation=='node':g['nodes'][0]['synthetic_state']='REAL'
   with self.assertRaises(ValueError):build_bundle(g,self.s)
 def test_provider_not_called_and_consent_required(self):
  for online in (False,True):
   for consent in (False,True):
    for a in ['READ_CONTEXT','WALLET_PREVIEW','CLOUD_SUMMARY','FLY_SYNC','CALL','PURCHASE','evil']:
     d=guarded_request(a,lambda:self.fail('provider executed before authorization'),online,consent)
     self.assertFalse(d['dispatch'])
     if not consent:self.assertEqual(d['state'],'BLOCKED')
  self.assertEqual(gate('FLY_SYNC',True,True)['state'],'DEFERRED');self.assertEqual(gate('READ_CONTEXT',False,True)['state'],'LOCAL_ONLY')
 def test_minimized_no_identity_fields(self):
  def walk(v):
   if isinstance(v,dict):
    self.assertFalse(set(v)&{'name','address','telecom','birthDate','identifier'})
    for x in v.values():walk(x)
   elif isinstance(v,list):
    for x in v:walk(x)
  walk(build_bundle(self.g,self.s))

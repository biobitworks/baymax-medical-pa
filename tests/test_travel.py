import copy,json,socket,sys,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
sys.path.insert(0,str(ROOT/'scripts'))
from baymax_travel import canonical,gate,guarded_request
from build_iphone_lineage_v3 import build_offline_fco

class TravelTests(unittest.TestCase):
 def setUp(self):
  self.g=json.loads((ROOT/'evidence/codex_synthea/fcg.json').read_text())
  self.s=json.loads((ROOT/'evidence/codex_synthea/dataset_source_fco.json').read_text())
  self.bundle=json.loads((ROOT/'fixtures/iphone/offline_travel_bundle_v1.json').read_text())

 def build(self,g=None,s=None,bundle=None):
  return build_offline_fco(g or self.g,s or self.s,bundle or self.bundle)

 def test_bounded_reproducible_from_admitted_graph(self):
  with patch.object(socket,'socket',side_effect=AssertionError('network')):
   a=self.build(); b=self.build()
  self.assertEqual(a,b)
  self.assertLessEqual(len(canonical(a)),20000)
  self.assertEqual(len(a['resource_references']),16)
  self.assertEqual(a['omitted_reference_count'],345)
  self.assertEqual(a['medication_context']['record_count'],11)
  self.assertEqual(a['medication_context']['names'],'ALLOWLIST_RENDERED_IN_CATALOG_ONLY')
  self.assertEqual(json.loads((ROOT/'fixtures/iphone/OfflineTravelBundleFCO.json').read_text()),a)

 def test_wrong_source_or_real_data_rejected(self):
  bad_bundle=copy.deepcopy(self.bundle)
  bad_bundle['source']['dataset_fco_id']='wrong'
  with self.assertRaises(ValueError): self.build(bundle=bad_bundle)

  bad_source=copy.deepcopy(self.s)
  bad_source['synthetic_state']='REAL'
  with self.assertRaises(ValueError): self.build(s=bad_source)

  bad_graph=copy.deepcopy(self.g)
  bad_graph['nodes'][0]['source_dataset_fco_id']='wrong'
  with self.assertRaises(ValueError): self.build(g=bad_graph)

 def test_provider_not_called_and_consent_required(self):
  for online in (False,True):
   for consent in (False,True):
    for a in ['READ_CONTEXT','WALLET_PREVIEW','CLOUD_SUMMARY','FLY_SYNC','CALL','PURCHASE','evil']:
     d=guarded_request(a,lambda:self.fail('provider executed before authorization'),online,consent)
     self.assertFalse(d['dispatch'])
     if not consent:self.assertEqual(d['state'],'BLOCKED')
  self.assertEqual(gate('FLY_SYNC',True,True)['state'],'DEFERRED')
  self.assertEqual(gate('READ_CONTEXT',False,True)['state'],'LOCAL_ONLY')

 def test_minimized_no_identity_fields(self):
  def walk(v):
   if isinstance(v,dict):
    self.assertFalse(set(v)&{'name','address','telecom','birthDate','identifier'})
    for x in v.values():walk(x)
   elif isinstance(v,list):
    for x in v:walk(x)
  walk(self.build())

if __name__=='__main__': unittest.main()

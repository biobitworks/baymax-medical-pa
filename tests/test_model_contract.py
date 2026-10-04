import copy,hashlib,json,socket,sys,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
from baymax_travel.model import packet,validate_response,inference_fco
from baymax_wallet.proposal import classify_proposal
from baymax_wallet.build import DEFAULT_POLICY
GOOD={'summary':'Synthetic context only. Clinical review is needed.','known_facts':['The trip destination is Bali.'],'unknown_facts':['Medical correctness UNKNOWN.'],'questions_for_pharmacist_clinician':['What additional information is needed?'],'requires_clinician':True}
class ModelContractTests(unittest.TestCase):
 def test_packet_exact_deterministic_bytes_offline(self):
  b=json.loads((ROOT/'fixtures/iphone/offline_travel_bundle_v1.json').read_text())
  with patch.object(socket,'socket',side_effect=AssertionError('network')):
   a=packet(b);self.assertEqual(a,packet(b))
  self.assertEqual(a,(ROOT/'fixtures/iphone/apollo_context_packet_v1.txt').read_bytes())
  receipt=json.loads((ROOT/'evidence/receipts/iphone/apollo_packet.json').read_text());self.assertEqual(hashlib.sha256(a).hexdigest(),receipt['sha256']);self.assertEqual(len(a),receipt['byte_count'])
  context=json.loads(a.decode().split('CONTEXT_JSON=\n')[1]);self.assertEqual(context['directory']['stock'],'UNKNOWN')
  def walk(v):
   if isinstance(v,dict):
    self.assertFalse(set(v)&{'name','address','telecom','identifier','source_fco_id','phone'})
    for x in v.values():walk(x)
   elif isinstance(v,list):
    for x in v:walk(x)
  walk(context)
 def test_schema_strict_and_prohibited_output_rejected(self):
  self.assertEqual(validate_response(json.dumps(GOOD)),GOOD)
  bads=['not JSON','```'+json.dumps(GOOD)+'```',json.dumps(GOOD)[:-1]+',"requires_clinician":true}']
  for changes in [{'requires_clinician':False},{'known_facts':'bad'},{'summary':'Take 50 mg now'},{'summary':'This pharmacy has it in stock'},{'summary':'Purchase these tablets'},{'extra':'wallet mutation'},{'summary':'x'*501}]:
   bad=GOOD|changes;bads.append(json.dumps(bad))
  for raw in bads:
   with self.assertRaises((ValueError,json.JSONDecodeError)):validate_response(raw)
 def test_model_cannot_mutate_wallet_or_clinical_source(self):
  state={'policy':copy.deepcopy(DEFAULT_POLICY),'currency':'SYN','balance':0};before=copy.deepcopy(state)
  clinical=json.loads((ROOT/'evidence/codex_synthea/dataset_source_fco.json').read_text());clinical_before=copy.deepcopy(clinical)
  out=inference_fco(json.dumps(GOOD),'a'*64,'HUMAN_OBSERVED_TEST_MODEL','2026-10-04T20:00:00Z')
  self.assertEqual(out['wallet_authority'],'NONE');self.assertEqual(out['medical_authority'],'NONE')
  self.assertEqual(classify_proposal(out,state)['decision'],'DENY')
  self.assertEqual(state,before);self.assertEqual(clinical,clinical_before)
  purchase={'merchant':'synthetic-pharmacy-alpha','category':'prescription_purchase','amount':1,'currency':'SYN'}
  self.assertEqual(classify_proposal(purchase,state)['decision'],'DENY')
  self.assertEqual(state,before)
 def test_direct_provider_contacts_absent(self):
  b=json.loads((ROOT/'fixtures/iphone/offline_travel_bundle_v1.json').read_text())
  for d in b['synthetic_directory']:
   self.assertEqual(d['synthetic_state'],'SYNTHETIC');self.assertIsNone(d['phone']);self.assertFalse(d['call_enabled']);self.assertFalse(d['purchase_enabled'])

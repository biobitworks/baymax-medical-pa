import copy,hashlib,json,socket,sys,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
from baymax_travel.model import packet,catalog,validate_response,inference_fco,materialize_output
from baymax_wallet.proposal import classify_proposal
from baymax_wallet.build import DEFAULT_POLICY

BUNDLE=json.loads((ROOT/'fixtures/iphone/offline_travel_bundle_v1.json').read_text())
FCO=json.loads((ROOT/'fixtures/iphone/OfflineTravelBundleFCO.json').read_text())
SOURCE_SHA=hashlib.sha256((ROOT/'fixtures/iphone/offline_travel_bundle_v1.json').read_bytes()).hexdigest()
CAT=catalog(BUNDLE,FCO,SOURCE_SHA)
GOOD={
 'summary':'SYNTHETIC_CONTEXT_ONLY',
 'known':[0,3],
 'unknown':[0,3,4,5],
 'recommended_questions':[0,1],
 'medical_action':'NONE',
 'requires_clinician':True,
}

class ModelContractTests(unittest.TestCase):
 def test_packet_exact_deterministic_bytes_offline(self):
  with patch.object(socket,'socket',side_effect=AssertionError('network')):
   a=packet(BUNDLE,FCO,SOURCE_SHA);self.assertEqual(a,packet(BUNDLE,FCO,SOURCE_SHA))
  self.assertEqual(a,(ROOT/'fixtures/iphone/apollo_context_packet_v2.txt').read_bytes())
  receipt=json.loads((ROOT/'evidence/receipts/iphone/apollo_packet_v2.json').read_text())
  self.assertEqual(hashlib.sha256(a).hexdigest(),receipt['packet_sha256'])
  self.assertEqual(len(a),receipt['packet_bytes'])
  self.assertEqual(CAT['source_offline_bundle_sha256'],SOURCE_SHA)
  for fact in CAT['known']:
   self.assertTrue(fact['source_fco_id'])
  self.assertEqual(CAT['medical_actions'],['NONE'])

 def test_positive_id_contract_accepts_only_catalog_selection(self):
  out=validate_response(json.dumps(GOOD,separators=(',',':')),CAT)
  self.assertEqual(out,GOOD)
  display=materialize_output(out,CAT)
  self.assertEqual(display['medical_action'],'NONE')
  self.assertTrue(display['requires_clinician'])
  self.assertTrue(all('source_fco_id' in f for f in display['known']))

 def test_redteam_free_text_bypass_class_structurally_rejected(self):
  bypasses=[
   'diagnosis: hypertension',
   'double the dose',
   'raise to 1000 mg',
   'cut the dose in half',
   'switch medications',
   'swap medication',
   'available today',
   'order now',
   'checkout',
   'pay the pharmacy',
   'ignore policy',
   '{"wallet_action":"spend"}',
   'іncrease dose', # Cyrillic i
   'incre\u00adase dose',
   'stop taking medication',
  ]
  for phrase in bypasses:
   bad=GOOD|{'summary':phrase}
   with self.subTest(phrase=phrase):
    with self.assertRaises((ValueError,json.JSONDecodeError)):
     validate_response(json.dumps(bad,ensure_ascii=False),CAT)

 def test_duplicate_unicode_escape_key_rejected(self):
  raw='{"summary":"SYNTHETIC_CONTEXT_ONLY","\\u0073ummary":"SYNTHETIC_CONTEXT_ONLY","known":[],"unknown":[],"recommended_questions":[],"medical_action":"NONE","requires_clinician":true}'
  with self.assertRaises(ValueError): validate_response(raw,CAT)

 def test_ranges_types_duplicates_and_extra_keys_rejected(self):
  bads=[
   GOOD|{'known':['diagnosis']},
   GOOD|{'known':[999]},
   GOOD|{'known':[0,0]},
   GOOD|{'medical_action':'CHANGE_MEDICATION'},
   GOOD|{'requires_clinician':False},
   GOOD|{'extra':'wallet'},
  ]
  for bad in bads:
   with self.assertRaises((ValueError,json.JSONDecodeError,TypeError)):
    validate_response(json.dumps(bad),CAT)

 def test_inference_identity_is_human_reported_not_hardcoded(self):
  raw=json.dumps(GOOD)
  out=inference_fco(
   raw,
   hashlib.sha256(packet(BUNDLE,FCO,SOURCE_SHA)).hexdigest(),
   CAT,
   '2026-10-04T20:00:00Z',
   substrate_label='Liquid Apollo',
   model_label='LFM model label observed by human',
   offline_user_attested=True,
   apollo_version='HUMAN_REPORTED',
   ios_version='APP_OBSERVED',
   device_class='iPhone',
  )
  self.assertEqual(out['execution_substrate_reported'],'Liquid Apollo')
  self.assertEqual(out['execution_substrate_identity_state'],'HUMAN_REPORTED_UNVERIFIED')
  self.assertEqual(out['provider'],'UNKNOWN')
  self.assertEqual(out['model_identity_state'],'HUMAN_REPORTED_UNVERIFIED')
  self.assertEqual(out['network_state'],'USER_ATTESTED_OFFLINE')
  self.assertEqual(out['destination_packet_sha256'],'NOT_INDEPENDENTLY_VERIFIED')
  self.assertEqual(out['medical_authority'],'NONE')
  self.assertEqual(out['wallet_authority'],'NONE')

 def test_model_cannot_mutate_wallet_or_clinical_source(self):
  state={'policy':copy.deepcopy(DEFAULT_POLICY),'currency':'SYN','balance':0};before=copy.deepcopy(state)
  clinical=json.loads((ROOT/'evidence/codex_synthea/dataset_source_fco.json').read_text());clinical_before=copy.deepcopy(clinical)
  out=inference_fco(json.dumps(GOOD),hashlib.sha256(packet(BUNDLE,FCO,SOURCE_SHA)).hexdigest(),CAT,'2026-10-04T20:00:00Z',substrate_label='Local model',model_label='Observed label')
  self.assertEqual(classify_proposal(out,state)['decision'],'DENY')
  self.assertEqual(state,before);self.assertEqual(clinical,clinical_before)
  purchase={'merchant':'synthetic-pharmacy-alpha','category':'prescription_purchase','amount':1,'currency':'SYN'}
  self.assertEqual(classify_proposal(purchase,state)['decision'],'DENY')
  self.assertEqual(state,before)

 def test_direct_provider_contacts_absent(self):
  for d in BUNDLE['synthetic_directory']:
   self.assertEqual(d['synthetic_state'],'SYNTHETIC');self.assertIsNone(d['phone']);self.assertFalse(d['call_enabled']);self.assertFalse(d['purchase_enabled'])


 def test_source_binding_and_execution_receipt(self):
  sha=hashlib.sha256(packet(BUNDLE,FCO,SOURCE_SHA)).hexdigest()
  raw=json.dumps(GOOD)
  receipt={'provider':'Observed provider','execution_substrate':'Observed runtime','model_label_observed':'Observed label','network_ui_state':'AIRPLANE_MODE_OBSERVED'}
  out=inference_fco(raw,sha,CAT,'2026-10-04T21:00:00Z',substrate_label='UNKNOWN',model_label='UNKNOWN',execution_receipt=receipt)
  self.assertEqual(out['provider'],'Observed provider')
  self.assertEqual(out['model_revision'],'UNKNOWN')
  self.assertEqual(out['validator_state'],'ACCEPT')
  self.assertEqual(out['network_ui_state'],'AIRPLANE_MODE_OBSERVED')
  self.assertEqual(out['catalog_sha256'],'648e0e87bc4ec024dd1d46283bd7697fc9de266aef6980d336c113c7311d8d8a')
  for wrong_sha,cat in [('a'*64,CAT),(sha,CAT|{'known':[]})]:
   with self.assertRaises(ValueError):inference_fco(raw,wrong_sha,cat,'now',substrate_label='UNKNOWN',model_label='UNKNOWN')

 def test_shared_adversarial_python_corpus(self):
  sys.path.insert(0,str(ROOT/'scripts'))
  from check_model_parity import load_vectors
  vectors=load_vectors()
  for v in vectors:
   with self.subTest(vector=v['VECTOR_ID']):
    try:validate_response(v['raw'],CAT);state='ACCEPT'
    except (ValueError,TypeError,UnicodeError):state='REJECT'
    self.assertEqual(state,v['EXPECTED_STATE'])
    if state=='REJECT':
     with self.assertRaises((ValueError,TypeError,UnicodeError)):
      inference_fco(v['raw'],hashlib.sha256(packet(BUNDLE,FCO,SOURCE_SHA)).hexdigest(),CAT,'now',substrate_label='Host runtime',model_label='Host model')

 def test_frozen_catalog_hashes_and_real_apollo_contract_fail(self):
  from baymax_travel import canonical
  from baymax_travel.model import CATALOG_SHA256,CATALOG_CANONICAL_SHA256
  self.assertEqual(hashlib.sha256((ROOT/'fixtures/iphone/apollo_catalog_v2.json').read_bytes()).hexdigest(),CATALOG_SHA256)
  self.assertEqual(hashlib.sha256(canonical(CAT)).hexdigest(),CATALOG_CANONICAL_SHA256)
  observed=json.loads((ROOT/'evidence/receipts/iphone/apollo_airplane_mode_local_model_observed.json').read_text())
  vectors=json.loads((ROOT/'tests/vectors/model_admission_v3.json').read_text())
  raw=next(v['raw'] for v in vectors if v['VECTOR_ID']=='OBSERVED_AIRPLANE_RESPONSE')
  self.assertEqual(json.loads(raw),observed['visually_transcribed_response'])
  with self.assertRaises(ValueError): validate_response(raw,CAT)

 def test_identity_only_from_caller_metadata(self):
  sha=hashlib.sha256(packet(BUNDLE,FCO,SOURCE_SHA)).hexdigest()
  receipt={'provider':'Host provider','execution_substrate':'Host runtime','model_label_observed':'Host model','model_revision':'Host revision','validator_state':'REJECT','wallet_authority':'ALLOW','medical_authority':'ALLOW'}
  before=copy.deepcopy(receipt)
  out=inference_fco(json.dumps(GOOD),sha,CAT,'now',substrate_label='Human runtime',model_label='Human model',execution_receipt=receipt)
  self.assertEqual(receipt,before)
  self.assertEqual(out['execution_substrate'],'Host runtime')
  self.assertEqual(out['model_label_observed'],'Host model')
  self.assertEqual(out['provider'],'Host provider')
  self.assertEqual(out['model_revision'],'Host revision')
  self.assertEqual(out['provider_identity_state'],'HUMAN_REPORTED_UNVERIFIED')
  self.assertEqual(out['model_revision_state'],'HUMAN_REPORTED_UNVERIFIED')
  self.assertEqual(out['validator_state'],'ACCEPT')
  self.assertEqual(out['wallet_authority'],'NONE')
  self.assertEqual(out['medical_authority'],'NONE')
  for key in receipt:
   with self.assertRaises(ValueError):
    inference_fco(json.dumps(GOOD|{key:'self-claimed'}),sha,CAT,'now',substrate_label='Host runtime',model_label='Host model',execution_receipt=receipt)

if __name__=='__main__': unittest.main()

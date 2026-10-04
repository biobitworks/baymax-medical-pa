import importlib.util,json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('capture',ROOT/'scripts/verify_apollo_capture.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
CAT=json.loads((ROOT/'fixtures/iphone/apollo_catalog_v2.json').read_text())
class CaptureTests(unittest.TestCase):
 def test_bp0032_near_miss_remains_rejected(self):
  receipt=json.loads((ROOT/'evidence/receipts/iphone/apollo_airplane_mode_local_model_observed.json').read_text())
  self.assertEqual(m.evaluate(json.dumps(receipt['visually_transcribed_response']).encode(),CAT),'REJECTED')
 def test_exact_contract_and_encoding(self):
  good={'summary':'SYNTHETIC_CONTEXT_ONLY','known':[0],'unknown':[0,3,4,5],'recommended_questions':[0],'medical_action':'NONE','requires_clinician':True}
  self.assertEqual(m.evaluate(json.dumps(good).encode(),CAT),'VALID_SCHEMA_ONLY')
  self.assertEqual(m.evaluate(b'\xff',CAT),'REJECTED')
 def test_frozen_identities(self):
  self.assertEqual(m.digest((ROOT/'fixtures/iphone/apollo_context_packet_v2.txt').read_bytes()),m.PACKET_SHA)
  self.assertEqual(m.digest((ROOT/'fixtures/iphone/apollo_catalog_v2.json').read_bytes()),m.CATALOG_SHA)

"""Verify exact canonical successor receipt bytes using only the admitted public key."""
import base64,hashlib,json
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
ROOT=Path(__file__).resolve().parents[1];E=ROOT/'evidence/receipts/iphone'
raw=(E/'actor_execution.json').read_bytes();r=json.loads((E/'actor_execution_signature.json').read_text());pub=base64.b64decode(r['public_key'])
assert hashlib.sha256(raw).hexdigest()==r['signed_payload_sha256']
assert hashlib.sha256(pub).hexdigest()==r['public_key_fingerprint']
original=json.loads((ROOT/'evidence/codex_synthea/actor_signature.json').read_text());assert original['public_key']==r['public_key']
Ed25519PublicKey.from_public_bytes(pub).verify(base64.b64decode(r['detached_signature']),raw)
payload=json.loads(raw)
for a in payload['artifacts']:
 p=ROOT/a['path'];assert len(p.read_bytes())==a['bytes'];assert hashlib.sha256(p.read_bytes()).hexdigest()==a['sha256']
print('ACTOR_EXECUTION_SIGNATURE=PASS');print('ACTOR_ID='+payload['actor_id']);print('ARTIFACT_BYTES=PASS')

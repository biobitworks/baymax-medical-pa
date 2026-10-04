"""Ed25519 keys. SIMULATED_KEY / NOT_SECURE_ENCLAVE: software keys held in process memory only.
Private keys are never serialized by this package."""
import hashlib
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature
PROTECTION = "SIMULATED_KEY/NOT_SECURE_ENCLAVE"

def key_id_of(pub_hex: str) -> str: return hashlib.sha256(bytes.fromhex(pub_hex)).hexdigest()[:32]
class Key:
    def __init__(self):
        self._sk = Ed25519PrivateKey.generate()
        self.pub = self._sk.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw).hex()
        self.kid = key_id_of(self.pub)
    def sign(self, msg: bytes) -> str: return self._sk.sign(msg).hex()
def verify(pub_hex: str, msg: bytes, sig_hex: str) -> bool:
    try: Ed25519PublicKey.from_public_bytes(bytes.fromhex(pub_hex)).verify(bytes.fromhex(sig_hex), msg); return True
    except (InvalidSignature, ValueError): return False

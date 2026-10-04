"""baymax-wallet-canon-v1: UTF-8 JSON, keys sorted, separators (',',':'), no trailing newline,
ints only (floats/NaN rejected), all strings must already be NFC (non-NFC REJECTED, never silently normalized)."""
import hashlib, json, unicodedata

class CanonError(ValueError): pass

def _check(v):
    if isinstance(v, bool) or v is None: return
    if isinstance(v, int): return
    if isinstance(v, str):
        if unicodedata.normalize("NFC", v) != v: raise CanonError("non-NFC string")
        return
    if isinstance(v, list):
        for x in v: _check(x)
        return
    if isinstance(v, dict):
        for k, x in v.items():
            if not isinstance(k, str): raise CanonError("non-string key")
            _check(k); _check(x)
        return
    raise CanonError(f"unsupported type {type(v).__name__}")

def canon(v) -> bytes:
    _check(v)
    return json.dumps(v, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")

def sha(b: bytes) -> str: return hashlib.sha256(b).hexdigest()
def chash(v) -> str: return sha(canon(v))

"""MMR v1. leaf=sha256(0x00||canon(leaf)); node=sha256(0x01||L||R) (raw bytes); peaks bagged right-to-left
(bag = node(peak_i, bag)); root = sha256(0x02||leaf_count(8B BE)||bag); empty root = sha256(0x02||0||'').
Two independent implementations: incremental flat-array (Mmr) and recursive perfect-subtree (root_reference)."""
import hashlib
def _h(*p): return hashlib.sha256(b"".join(p)).digest()
def leaf_digest(canon_bytes: bytes) -> bytes: return _h(b"\x00", canon_bytes)
def _bag(peaks):
    bag = peaks[-1]
    for p in reversed(peaks[:-1]): bag = _h(b"\x01", p, bag)
    return bag
def _final(n, peaks): return _h(b"\x02", n.to_bytes(8, "big"), _bag(peaks) if peaks else b"").hex()

class Mmr:
    def __init__(self): self.n = 0; self.peaks = []   # list of (height, digest)
    def append(self, d: bytes):
        h, cur = 0, d
        while self.peaks and self.peaks[-1][0] == h:
            _, left = self.peaks.pop(); cur = _h(b"\x01", left, cur); h += 1
        self.peaks.append((h, cur)); self.n += 1
    def root(self) -> str: return _final(self.n, [p for _, p in self.peaks])

def _perfect(ds):
    if len(ds) == 1: return ds[0]
    m = len(ds) // 2; return _h(b"\x01", _perfect(ds[:m]), _perfect(ds[m:]))
def root_reference(ds: list) -> str:
    peaks, i, n = [], 0, len(ds); rem = n
    while rem:
        k = 1 << (rem.bit_length() - 1); peaks.append(_perfect(ds[i:i + k])); i += k; rem -= k
    return _final(n, peaks)

"""A replica (PHONE or FLY) holds its own ledger copy, replays it itself, and never trusts a peer's claimed root.
States: OK | FORK_DETECTED | ROLLBACK_DETECTED. In any non-OK state wallet mutation is refused until reconciliation.
Rejected attempts are kept in a non-chain rejection log (ACTION_REJECTED leaf class is DEFERRED)."""
import json
from . import canon as C, ledger as L, mmr
from .keys import Key, verify, key_id_of

class Abstain(Exception): pass

def replay(entries):
    st, leaves = None, []
    for en in entries: st, lf = L.apply(st, en); leaves.append(lf)
    return st, leaves

def root_of(leaves, impl="flat"):
    ds = [mmr.leaf_digest(C.canon(l)) for l in leaves]
    if impl == "flat":
        m = mmr.Mmr(); [m.append(d) for d in ds]; return m.root()
    return mmr.root_reference(ds)

class Replica:
    def __init__(self, name, key: Key, peer_pubs=None):
        self.name, self.key, self.status = name, key, "OK"
        self.entries, self.leaves, self.state = [], [], None
        self.checkpoints, self.rejections = [], []        # checkpoints: signed roots (own + peers')
        self.peer_pubs = dict(peer_pubs or {})            # signer_id -> pub (trusted out of band at enrollment)

    def root(self): return root_of(self.leaves), len(self.leaves)

    def admit(self, entry, now=None, skew_s=300):
        if self.status != "OK": raise Abstain(f"{self.name}: mutations blocked in {self.status}")
        if now is not None:  # live-only wall-clock gate; replay stays deterministic
            from datetime import datetime, timezone, timedelta
            ts = datetime.strptime(entry["event"]["timestamp"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
            if abs(ts - now) > timedelta(seconds=skew_s): self.rejections.append("CLOCK_SKEW"); raise L.Rejected("CLOCK_SKEW")
        try: st, lf = L.apply(self.state, entry)
        except L.Rejected as r: self.rejections.append(r.code); raise
        self.entries.append(entry); self.leaves.append(lf); self.state = st

    # ---- checkpoints (CheckpointFCO) ----
    def make_checkpoint(self, observed_at):
        root, n = self.root(); prev = C.chash(self.checkpoints[-1]) if self.checkpoints else L.ZERO
        core = {"chain_root": root, "leaf_count": n, "previous_checkpoint": prev, "signer_id": self.key.kid, "observed_at": observed_at}
        cp = dict(core, signature=self.key.sign(C.canon(core))); self.checkpoints.append(cp); return cp

    def accept_checkpoint(self, cp):
        pub = self.peer_pubs.get(cp["signer_id"]); core = {k: v for k, v in cp.items() if k != "signature"}
        if pub is None or not verify(pub, C.canon(core), cp["signature"]): raise Abstain("checkpoint signature invalid/unknown signer")
        n = cp["leaf_count"]
        if n <= len(self.leaves):
            if root_of(self.leaves[:n]) != cp["chain_root"]: self.status = "FORK_DETECTED"; raise Abstain("peer checkpoint contradicts local history")
        self.checkpoints.append(cp)  # if n > local: we are behind; keep as evidence floor

    # ---- sync: verify a peer's chain from evidence, never from its claimed root ----
    def sync_from(self, entries, claimed_root=None):
        try: st, leaves = replay(entries)
        except L.Rejected as r: raise Abstain(f"peer chain invalid: {r.code}")
        for i, lf in enumerate(self.leaves):
            if i >= len(leaves) or leaves[i] != lf:
                if i >= len(leaves): self.status = "ROLLBACK_DETECTED"; raise Abstain("peer chain shorter than local (rollback)")
                self.status = "FORK_DETECTED"; raise Abstain(f"fork at leaf {i}")
        root = root_of(leaves)
        if root != root_of(leaves, impl="reference"): raise Abstain("internal MMR implementations disagree")
        if claimed_root is not None and claimed_root != root: raise Abstain("claimed root unsupported by evidence")
        for cp in self.checkpoints:
            if len(leaves) < cp["leaf_count"]: self.status = "ROLLBACK_DETECTED"; raise Abstain("chain shorter than a signed checkpoint (tail truncation)")
            if root_of(leaves[:cp["leaf_count"]]) != cp["chain_root"]: self.status = "FORK_DETECTED"; raise Abstain("chain contradicts signed checkpoint")
        self.entries, self.leaves, self.state = list(entries), leaves, st

    # ---- persistence (no private keys, ever) ----
    def save(self, path): json.dump({"entries": self.entries, "checkpoints": self.checkpoints}, open(path, "w"), sort_keys=True)
    @classmethod
    def load(cls, name, key, path, peer_pubs=None):
        r = cls(name, key, peer_pubs); d = json.load(open(path))
        r.sync_from(d["entries"])          # full replay verification on load
        for cp in d["checkpoints"]: r.checkpoints.append(cp)
        return r

"""Append the entry for an existing breakpoint file to CHAIN.jsonl (append-only; refuses gaps/dupes)."""
from __future__ import annotations
import hashlib, json, sys
from verify_chain import CHAIN, BPD, ZERO, chain_commit

def main():
    bid = sys.argv[1]; note = sys.argv[2] if len(sys.argv) > 2 else ""
    ents = [json.loads(l) for l in CHAIN.read_text().splitlines() if l.strip()] if CHAIN.exists() else []
    if any(e["breakpoint_id"] == bid for e in ents): raise SystemExit(f"already in chain: {bid}")
    idx = len(ents); prev = ents[-1]["computed_commitment"] if ents else ZERO
    p = BPD / f"{bid}.json"; b = json.loads(p.read_text())
    fs = hashlib.sha256(p.read_bytes()).hexdigest(); root = b["merkle"]["merkle_root"]
    e = {"order_index": idx, "breakpoint_id": bid, "file_sha256": fs, "merkle_root": root, "previous_commitment": prev,
         "computed_commitment": chain_commit(prev, fs, root, bid, idx), "canonicalization": "baymax-chain-v1", "note": note}
    CHAIN.parent.mkdir(parents=True, exist_ok=True)
    with CHAIN.open("a") as fh: fh.write(json.dumps(e, sort_keys=True, separators=(",", ":")) + "\n")
    print(json.dumps(e, indent=1))

if __name__ == "__main__": main()

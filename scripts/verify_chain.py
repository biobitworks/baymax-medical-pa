"""Hardened custody verifier (v2). Fail-closed. Additive to verify_breakpoints.py.

Chain construction (baymax-chain-v1), one JSONL entry per breakpoint, order_index 0..n-1:
  file_sha256   = sha256(raw bytes of the breakpoint file)           # covers the FULL header
  computed      = sha256("baymax-chain-v1\\n"+prev+"\\n"+file_sha256+"\\n"+merkle_root+"\\n"+id+"\\n"+index)
  prev          = previous entry's computed (64x'0' for index 0)
A chain proves ordered commitment to exact bytes. Tail truncation (dropping the last
breakpoint AND its entry) is NOT detectable here; it needs an external anchor (signed tag).
"""
from __future__ import annotations
import hashlib, json, re, subprocess, sys, unicodedata
from pathlib import Path
from breakpoint_common import compute, leaf_hash, merkle_root, CONSTRUCTION

def compute_from_descriptors(arts):
    hs = [leaf_hash(a) for a in arts]
    return {'construction': CONSTRUCTION, 'leaf_ordering': 'artifact_argv_order', 'leaf_count': len(arts), 'leaf_hashes': hs, 'merkle_root': merkle_root(hs) if hs else ''}

ROOT = Path(__file__).resolve().parents[1]
BPD = ROOT / "evidence" / "breakpoints"
CHAIN = ROOT / "evidence" / "chain" / "CHAIN.jsonl"
REPO_ALLOWED = {"biobitworks/baymax-medical-pa"}
ID_RE = re.compile(r"^BAYMAX-BP-\d{4}$")
ZERO = "0" * 64

def chain_commit(prev, file_sha, root, bid, idx):
    return hashlib.sha256(f"baymax-chain-v1\n{prev}\n{file_sha}\n{root}\n{bid}\n{idx}".encode()).hexdigest()

def git(*a):
    return subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True)

def safe_path(rel: str) -> str | None:
    if not isinstance(rel, str) or not rel or rel.startswith("/") or "\\" in rel: return "absolute/odd path"
    if unicodedata.normalize("NFC", rel) != rel: return "non-NFC path"
    parts = rel.split("/")
    if any(p in ("", ".", "..") for p in parts): return "traversal/empty component"
    cur = ROOT
    for p in parts:
        cur = cur / p
        if cur.is_symlink(): return f"symlink component {p}"
    if not cur.is_file(): return "not a regular file"
    try: cur.resolve().relative_to(ROOT.resolve())
    except ValueError: return "escapes repo root"
    return None

def verify() -> list[str]:
    f: list[str] = []
    files = sorted(BPD.glob("*.json"))
    if not files: return ["no breakpoints"]
    seen_ids: dict[str, str] = {}; bps = []
    for p in files:
        try: b = json.loads(p.read_text())
        except Exception as e: f.append(f"{p.name}: unparsable ({e})"); continue
        bid = b.get("breakpoint_id")
        if not isinstance(bid, str) or not ID_RE.match(bid): f.append(f"{p.name}: bad id {bid!r}"); continue
        if p.stem != bid: f.append(f"{p.name}: filename != breakpoint_id {bid}")
        if bid in seen_ids: f.append(f"{p.name}: duplicate id {bid} (also {seen_ids[bid]})")
        seen_ids[bid] = p.name
        if b.get("repository") not in REPO_ALLOWED: f.append(f"{bid}: repository {b.get('repository')!r} not allowed")
        bh = b.get("base_head", "")
        if not re.fullmatch(r"[0-9a-f]{40}", str(bh)) or git("cat-file", "-e", f"{bh}^{{commit}}").returncode != 0:
            f.append(f"{bid}: base_head {bh!r} is not an existing commit")
        elif git("merge-base", "--is-ancestor", bh, "HEAD").returncode != 0:
            f.append(f"{bid}: base_head not an ancestor of HEAD")
        m = b.get("merkle", {}); arts = m.get("artifacts", [])
        paths = [a.get("path") for a in arts]
        if len(set(paths)) != len(paths): f.append(f"{bid}: duplicate artifact path")
        bad = [(x, safe_path(x)) for x in paths if safe_path(x)]
        for x, why in bad: f.append(f"{bid}: unsafe artifact {x!r}: {why}")
        # artifact bytes are checked below against the LATEST breakpoint that lists each path
        bps.append((p, b))
    latest: dict[str, dict] = {}
    for p, b in bps:
        m = b.get('merkle', {}); arts = m.get('artifacts', [])
        if len(set(a.get('path') for a in arts)) != len(arts): continue
        cur = compute_from_descriptors(arts)
        for k in ('construction', 'leaf_ordering', 'leaf_hashes', 'merkle_root', 'leaf_count'):
            if cur[k] != m.get(k): f.append(f"{b['breakpoint_id']}: merkle.{k} mismatch (recomputed from stored descriptors)")
        for a in arts: latest[a['path']] = a
    for path, a in latest.items():
        if safe_path(path): continue
        if hashlib.sha256((ROOT / path).read_bytes()).hexdigest() != a.get('sha256'): f.append(f"artifact {path}: bytes differ from latest breakpoint that lists it")
    ids = [b["breakpoint_id"] for _, b in bps if "breakpoint_id" in b]
    for i, (_, b) in enumerate(bps):
        want_parent = "NONE" if i == 0 else bps[i - 1][1].get("breakpoint_id")
        if b.get("parent") != want_parent: f.append(f"{b.get('breakpoint_id')}: parent {b.get('parent')!r} != expected {want_parent!r}")
        if ids[i] != f"BAYMAX-BP-{i:04d}": f.append(f"{ids[i]}: id not contiguous at index {i}")
    # chain manifest
    if not CHAIN.exists(): return f + ["CHAIN.jsonl missing"]
    ents = [json.loads(l) for l in CHAIN.read_text().splitlines() if l.strip()]
    if len(ents) != len(bps): f.append(f"chain has {len(ents)} entries but {len(bps)} breakpoint files")
    prev = ZERO
    for i, e in enumerate(ents):
        if i >= len(bps): break
        p, b = bps[i]
        if e.get("order_index") != i or e.get("breakpoint_id") != b.get("breakpoint_id"): f.append(f"chain[{i}]: index/id mismatch")
        fs = hashlib.sha256(p.read_bytes()).hexdigest()
        if e.get("file_sha256") != fs: f.append(f"chain[{i}]: file bytes changed for {p.name}")
        if e.get("merkle_root") != b.get("merkle", {}).get("merkle_root"): f.append(f"chain[{i}]: merkle_root mismatch")
        if e.get("previous_commitment") != prev: f.append(f"chain[{i}]: previous_commitment mismatch")
        want = chain_commit(prev, e.get("file_sha256"), e.get("merkle_root"), e.get("breakpoint_id"), i)
        if e.get("computed_commitment") != want: f.append(f"chain[{i}]: computed_commitment mismatch")
        prev = e.get("computed_commitment", "")
    return f

def main():
    f = verify()
    if f:
        print("VERIFY=FAIL"); [print("FAILURE=" + x) for x in f]; sys.exit(1)
    ents = [json.loads(l) for l in CHAIN.read_text().splitlines() if l.strip()]
    print("VERIFY=PASS (consistency only; not correctness/authenticity)"); print(f"CHAIN_ENTRIES={len(ents)}")
    print(f"CHAIN_HEAD={ents[-1]['computed_commitment']}"); print("MMR_STATE=NOT_COMPUTED"); print("ANCHOR=UNSIGNED (BLOCKED_HUMAN_SIGNING_SETUP)")

if __name__ == "__main__": main()

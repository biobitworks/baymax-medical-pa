"""INDEPENDENT custody re-verification (red-team lane). Written from scratch: does NOT import repo verifier code.
Checks each breakpoint against git OBJECTS at the commit that ADDED the breakpoint file (not the mutable worktree).
construction under test (as documented in breakpoint_common): leaf=sha256(0x00||sha256(canon(desc))), node=sha256(0x01||L||R), odd=promote."""
import hashlib, json, subprocess, sys, glob, os
def git(*a, raw=False):
    r = subprocess.run(["git", *a], capture_output=True); return r.stdout if raw else r.stdout.decode().strip()
sha = lambda b: hashlib.sha256(b).hexdigest()
canon = lambda o: json.dumps(o, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
def leaf(d): return hashlib.sha256(b"\x00" + hashlib.sha256(canon(d)).digest()).digest()
def node(l, r): return hashlib.sha256(b"\x01" + l + r).digest()
def root(ls):
    lv = list(ls)
    while len(lv) > 1: lv = [node(lv[i], lv[i+1]) if i+1 < len(lv) else lv[i] for i in range(0, len(lv), 2)]
    return lv[0].hex()
rows = []; head = git("rev-parse", "HEAD")
files = sorted(os.path.basename(p) for p in glob.glob("evidence/breakpoints/*.json"))
ids = [f[:-5] for f in files]
chain = [json.loads(l) for l in open("evidence/chain/CHAIN.jsonl") if l.strip()]
chain_count_matches_breakpoints = len(chain) == len(files)
prev = "0" * 64
for i, f in enumerate(files):
    bid = f[:-5]; p = "evidence/breakpoints/" + f; res = {"breakpoint": bid, "checks": {}}; ok = res["checks"]
    add = git("log", "--diff-filter=A", "--format=%H", "--", p).splitlines(); c = add[-1] if add else None; res["admitting_commit"] = c[:10] if c else None
    ok["committed"] = bool(c)
    b = json.loads(git("show", f"{c}:{p}") if c else open(p).read())
    m = b["merkle"]; arts = m["artifacts"]
    ok["parent_declared_ok"] = b["parent"] == ("NONE" if i == 0 else ids[i-1])
    ok["paths_unique"] = len({a["path"] for a in arts}) == len(arts)
    ok["root_recomputed_from_descriptors"] = root([leaf(a) for a in arts]) == m["merkle_root"] and [leaf(a).hex() for a in arts] == m["leaf_hashes"]
    # artifact bytes AT the admitting commit (NFC path, no ../, no abs, no symlink mode)
    bad = []
    for a in arts:
        path = a["path"]
        if path.startswith("/") or ".." in path.split("/"): bad.append((path, "unsafe path")); continue
        ls = git("ls-tree", c, "--", path) if c else ""
        if not ls: bad.append((path, "absent at admitting commit")); continue
        mode = ls.split()[0]
        if mode == "120000": bad.append((path, "symlink")); continue
        data = git("show", f"{c}:{path}", raw=True)
        if sha(data) != a["sha256"] or len(data) != a["bytes"]: bad.append((path, "bytes differ at admitting commit"))
    ok["artifacts_match_bytes_at_admitting_commit"] = not bad; res["artifact_mismatches"] = bad[:5]
    # chain entry: only chain entries that exist
    if i < len(chain):
        e = chain[i]; fsha = sha(git("show", f"{c}:{p}", raw=True)) if c else None
        ok["chain_id_index"] = e["breakpoint_id"] == bid and e["order_index"] == i
        ok["chain_file_sha_matches_admitted_bytes"] = e["file_sha256"] == fsha
        ok["current_breakpoint_bytes_match_chain_file_sha"] = e["file_sha256"] == sha(open(p, "rb").read())
        ok["chain_prev_ok"] = e["previous_commitment"] == prev
        want = sha(f"baymax-chain-v1\n{prev}\n{e['file_sha256']}\n{e['merkle_root']}\n{bid}\n{i}".encode())
        ok["chain_commitment_recomputed"] = e["computed_commitment"] == want and e["merkle_root"] == m["merkle_root"]
        prev = e["computed_commitment"]
    else: ok["chain_entry_present"] = False
    ok["contained_in_HEAD"] = bool(c) and subprocess.run(["git", "merge-base", "--is-ancestor", c, "HEAD"]).returncode == 0
    res["result"] = "PASS" if all(ok.values()) else "FAIL"; rows.append(res)
rem = git("ls-remote", "origin", "refs/heads/redteam/bp-0006-model-wallet").split()[0] if git("ls-remote", "origin", "refs/heads/redteam/bp-0006-model-wallet") else None
out = {"schema": "baymax.redteam_lane.independent_custody.v2", "verified_commit": head, "primary_branch_remote_sha": rem, "chain_entries": len(chain), "breakpoint_files": len(files),
       "global_checks": {"chain_entry_count_matches_breakpoint_count": chain_count_matches_breakpoints},
       "per_breakpoint": rows, "summary": {"PASS": sum(r["result"] == "PASS" for r in rows), "FAIL": sum(r["result"] == "FAIL" for r in rows)},
       "overall_result": "PASS" if chain_count_matches_breakpoints and all(r["result"] == "PASS" for r in rows) else "FAIL",
       "claim_boundary": "Recomputes identity/ordering/consistency only. Checks current breakpoint bytes against admitted chain hashes and rejects chain/file count mismatch. Not authenticity (UNSIGNED), not correctness, not MMR (NOT_COMPUTED). Remote parity != authenticity."}
json.dump(out, open(sys.argv[1], "w"), indent=1, sort_keys=True)
for r in rows: print(r["breakpoint"], r["result"], r["admitting_commit"], [k for k, v in r["checks"].items() if not v])
print(out["summary"], "chain=", len(chain), "files=", len(files), "count_match=", chain_count_matches_breakpoints, "overall=", out["overall_result"])

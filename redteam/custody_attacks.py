"""Custody red-team harness. Each attack mutates a throwaway copy of the repo,
runs a verifier, and records expected vs observed. Expected is always REJECT
(non-zero exit / VERIFY=FAIL). A verifier that accepts a mutated tree FAILS the attack.

usage: custody_attacks.py <verifier-script-relative-path> <receipt-out.json>
"""
from __future__ import annotations
import hashlib, json, os, shutil, subprocess, sys, tempfile, unicodedata
from pathlib import Path

SRC = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SRC / "scripts"))
from breakpoint_common import compute  # noqa: E402

def jload(p): return json.loads(Path(p).read_text())
def jdump(p, o): Path(p).write_text(json.dumps(o, indent=2, sort_keys=True) + "\n")

def fresh() -> Path:
    d = Path(tempfile.mkdtemp(prefix="bmx-rt-"))
    shutil.copytree(SRC, d / "r", ignore=shutil.ignore_patterns(".git", "__pycache__"), symlinks=True)
    r = d / "r"
    # keep git object access for base_head checks: share objects via alternates-free clone
    subprocess.run(["git", "clone", "-q", "--no-checkout", str(SRC), str(d / "g")], check=True)
    shutil.move(str(d / "g" / ".git"), str(r / ".git"))
    return r

def bp(r, n): return r / "evidence" / "breakpoints" / f"BAYMAX-BP-{n}.json"

def reseal(r, n, mutate):
    """mutate a breakpoint and recompute its merkle block consistently (a smart attacker)."""
    b = jload(bp(r, n)); mutate(b)
    paths = [a["path"] for a in b["merkle"]["artifacts"]]
    b["merkle"] = compute(r, paths); jdump(bp(r, n), b)

ATT = {}
def attack(num, name, expect="REJECT"):
    def d(f): ATT[num] = (name, expect, f); return f
    return d

@attack("01", "modify historical breakpoint header (parent/state) without touching merkle block")
def a01(r):
    b = jload(bp(r, "0000")); b["state"] = "PASS"; b["note"] = "tampered"; jdump(bp(r, "0000"), b)

@attack("02", "delete historical breakpoint BP-0000")
def a02(r): bp(r, "0000").unlink()

@attack("01b", "modify TAIL breakpoint header (state) - nothing downstream commits to it")
def a01b(r):
    tail = sorted((r / "evidence/breakpoints").glob("BAYMAX-BP-*.json"))[-1]
    b = jload(tail); b["state"] = "TAMPERED"; jdump(tail, b)

@attack("02b", "delete TAIL breakpoint file (chain entry left in place)")
def a02b(r): sorted((r / "evidence/breakpoints").glob("BAYMAX-BP-*.json"))[-1].unlink()

@attack("02c", "truncate tail: delete tail breakpoint AND its chain entry (needs external anchor)")
def a02c(r):
    tail = sorted((r / "evidence/breakpoints").glob("BAYMAX-BP-*.json"))[-1]; tail.unlink()
    c = r / "evidence/chain/CHAIN.jsonl"
    if c.exists(): c.write_text("".join(c.read_text().splitlines(True)[:-1]))

@attack("03", "reorder leaves in BP-0001 (artifacts+leaf_hashes swapped, claimed root kept)")
def a03(r):
    b = jload(bp(r, "0001")); m = b["merkle"]
    m["artifacts"][0], m["artifacts"][1] = m["artifacts"][1], m["artifacts"][0]
    m["leaf_hashes"][0], m["leaf_hashes"][1] = m["leaf_hashes"][1], m["leaf_hashes"][0]; jdump(bp(r, "0001"), b)

@attack("04", "duplicate breakpoint ID under a second filename")
def a04(r):
    shutil.copy(bp(r, "0001"), r / "evidence/breakpoints/BAYMAX-BP-0001-dup.json")

@attack("05", "duplicate leaf (same artifact twice), merkle recomputed consistently")
def a05(r):
    def m(b): b["merkle"]["artifacts"].append(dict(b["merkle"]["artifacts"][0]))
    reseal(r, "0001", m)

@attack("06", "correct leaves, wrong claimed root")
def a06(r):
    b = jload(bp(r, "0001")); b["merkle"]["merkle_root"] = "00" * 32; jdump(bp(r, "0001"), b)

@attack("07", "correct root, incorrect claimed ordering label")
def a07(r):
    b = jload(bp(r, "0001")); b["merkle"]["leaf_ordering"] = "sorted_by_sha256"; jdump(bp(r, "0001"), b)

@attack("09", "unicode: same file referenced via NFD path alias, resealed")
def a09(r):
    nfc = "docs/café.md"; (r / nfc).write_text("x\n")
    def m(b): b["merkle"]["artifacts"].append({"path": unicodedata.normalize("NFD", nfc)})
    # build descriptors by hand: compute() reads via NFD path
    b = jload(bp(r, "0001")); paths = [a["path"] for a in b["merkle"]["artifacts"]] + [unicodedata.normalize("NFD", nfc)]
    b["merkle"] = compute(r, paths); jdump(bp(r, "0001"), b)

@attack("10", "symlink substitution: committed artifact is a symlink to an outside file, resealed")
def a10(r):
    out = r.parent / "outside.txt"; out.write_text("outside\n")
    (r / "docs/linked.md").symlink_to(out)
    b = jload(bp(r, "0001")); paths = [a["path"] for a in b["merkle"]["artifacts"]] + ["docs/linked.md"]
    b["merkle"] = compute(r, paths); jdump(bp(r, "0001"), b)

@attack("10b", "path traversal: artifact path ../outside, resealed")
def a10b(r):
    (r.parent / "outside2.txt").write_text("outside\n")
    b = jload(bp(r, "0001")); paths = [a["path"] for a in b["merkle"]["artifacts"]] + ["../outside2.txt"]
    b["merkle"] = compute(r, paths); jdump(bp(r, "0001"), b)

@attack("11", "artifact bytes changed after hashing")
def a11(r): (r / "docs/BREAKPOINT_PROTOCOL.md").write_text("changed\n")

@attack("12", "breakpoint references nonexistent artifact")
def a12(r):
    b = jload(bp(r, "0001")); b["merkle"]["artifacts"].append({"path": "nope.txt", "bytes": 0, "sha256": "0" * 64}); jdump(bp(r, "0001"), b)

@attack("13", "breakpoint base_head references nonexistent git commit")
def a13(r):
    b = jload(bp(r, "0001")); b["base_head"] = "deadbeef" * 5; jdump(bp(r, "0001"), b)

@attack("14", "cross-project artifact substitution: repository field rewritten")
def a14(r):
    b = jload(bp(r, "0001")); b["repository"] = "someone-else/other-project"; jdump(bp(r, "0001"), b)

@attack("14b", "broken parent link: BP-0001 parent rewritten")
def a14b(r):
    b = jload(bp(r, "0001")); b["parent"] = "NONE"; jdump(bp(r, "0001"), b)

@attack("20", "secret admitted to evidence (fake AWS key in an artifact + gitleaks gate)")
def a20(r):
    k = "AKI" + "AIOSFODNN7EXAMPL" + "Q"; v = "wJalrXUtnFEMI/K7MDENG/" + "bPxRfiCYzzzzzzzzzz"  # assembled at runtime: no scanner-tripping literal in source
    (r / "docs/leak.md").write_text(f"aws_access_key_id = {k}\naws_secret_access_key = {v}\n")

def run(verifier, r):
    p = subprocess.run([sys.executable, verifier], cwd=r, capture_output=True, text=True, timeout=60)
    return p.returncode, (p.stdout + p.stderr)[-600:]

def gitleaks(r):
    p = subprocess.run(["gitleaks", "detect", "--no-git", "--source", str(r), "--no-banner", "-l", "error"], capture_output=True, text=True)
    return p.returncode

def main():
    verifier, out = sys.argv[1], sys.argv[2]
    # control: unmutated tree must be accepted
    r0 = fresh(); c, o = run(verifier, r0); control = {"exit": c, "output_tail": o}
    rows = []
    for num in sorted(ATT):
        name, expect, f = ATT[num]; r = fresh()
        try:
            f(r)
            if num == "20":
                code = gitleaks(r); observed = "REJECT" if code != 0 else "ACCEPT"; tail = f"gitleaks exit={code}"
            else:
                code, tail = run(verifier, r); observed = "REJECT" if code != 0 else "ACCEPT"
        except Exception as e:  # harness error is not a PASS
            observed, tail = "HARNESS_ERROR", repr(e)
        rows.append({"attack": num, "name": name, "expected": expect, "observed": observed,
                     "result": "PASS" if observed == expect else "FAIL", "evidence_tail": tail})
        shutil.rmtree(r.parent, ignore_errors=True)
    shutil.rmtree(r0.parent, ignore_errors=True)
    rec = {"schema": "baymax.redteam_receipt.v1", "verifier": verifier, "control_unmutated": control, "attacks": rows,
           "summary": {"pass": sum(x["result"] == "PASS" for x in rows), "fail": sum(x["result"] == "FAIL" for x in rows), "total": len(rows)}}
    jdump(out, rec)
    for x in rows: print(f'{x["attack"]:>4} {x["result"]:5} {x["observed"]:13} {x["name"]}')
    print("control exit:", control["exit"], "|", rec["summary"])

if __name__ == "__main__": main()

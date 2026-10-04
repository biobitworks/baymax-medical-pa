#!/usr/bin/env python3
"""Swift-vs-Python validator PARITY runner (red-team lane; mints no BP ids).
usage: parity_runner.py --repo REPO --commit SHA --out result.json
Extracts ios/.../ModelInference.swift + src/baymax_travel/model.py + fixtures/iphone/apollo_catalog_v2.json AT <commit>, compiles the REAL Swift
ModelOutput.parse into a harness, runs every vector through BOTH validators. Rule: ANY disagreement = FAIL (not averaged).
'expect' per vector: A=must accept, R=must reject. unsafe = accepted but expected reject."""
import argparse, hashlib, json, os, subprocess, sys, tempfile
ap = argparse.ArgumentParser(); [ap.add_argument(f, required=True) for f in ("--repo", "--commit", "--out")]; a = ap.parse_args()
here = os.path.dirname(os.path.abspath(__file__)); tmp = tempfile.mkdtemp()
def show(p): return subprocess.run(["git", "-C", a.repo, "show", f"{a.commit}:{p}"], capture_output=True).stdout
sh = lambda b: hashlib.sha256(b).hexdigest()
swift, cat = show("ios/OfflineTravelDemo/ModelInference.swift"), show("fixtures/iphone/apollo_catalog_v2.json")
pyfiles = {"model.py": show("src/baymax_travel/model.py"), "__init__.py": show("src/baymax_travel/__init__.py")}
os.makedirs(os.path.join(tmp, "src", "baymax_travel")); [open(os.path.join(tmp, "src", "baymax_travel", k), "wb").write(v) for k, v in pyfiles.items()]
open(os.path.join(tmp, "ModelInference.swift"), "wb").write(swift); open(os.path.join(tmp, "catalog.json"), "wb").write(cat)
open(os.path.join(tmp, "main.swift"), "wb").write(open(os.path.join(here, "v2_harness_main.swift"), "rb").read())
b = subprocess.run(["swiftc", "-O", "-o", os.path.join(tmp, "h"), os.path.join(tmp, "main.swift"), os.path.join(tmp, "ModelInference.swift")], capture_output=True, text=True)
if b.returncode: sys.exit("HARNESS_BUILD_FAILED: " + b.stderr[-300:])
vec = json.load(open(os.path.join(here, "parity_vectors_138_SIMULATED.json"))); json.dump(vec, open(os.path.join(tmp, "v.json"), "w"))
sw = [r for r in json.loads(subprocess.run([os.path.join(tmp, "h"), os.path.join(tmp, "catalog.json"), os.path.join(tmp, "v.json")], capture_output=True, text=True).stdout) if "name" in r]
sys.path.insert(0, os.path.join(tmp, "src")); from baymax_travel.model import validate_response; C = json.loads(cat)
rows = []
for c, s in zip(vec, sw):
    try: validate_response(c["text"], C); p = "ACCEPTED"
    except Exception: p = "REJECTED"
    e = "ACCEPTED" if c["expect"] == "A" else "REJECTED"
    rows.append({"group": c["group"], "name": c["name"], "expect": e, "swift": s["result"], "python": p, "parity": s["result"] == p})
dis = [r for r in rows if not r["parity"]]
out = {"schema": "baymax.redteam_lane.validator_parity.v1", "commit": a.commit, "identity": {"ModelInference.swift": sh(swift), "model.py": sh(pyfiles["model.py"]), "catalog": sh(cat)}, "vectors": len(rows),
       "swift_accepts_expected_reject": sum(r["swift"] == "ACCEPTED" and r["expect"] == "REJECTED" for r in rows), "python_accepts_expected_reject": sum(r["python"] == "ACCEPTED" and r["expect"] == "REJECTED" for r in rows),
       "false_rejects": sum((r["swift"] == "REJECTED" or r["python"] == "REJECTED") and r["expect"] == "ACCEPTED" for r in rows), "parity_disagreements": [{k: r[k] for k in ("group", "name", "swift", "python")} for r in dis],
       "PARITY": "PASS" if not dis else "FAIL", "rows": rows}
json.dump(out, open(a.out, "w"), indent=1); print(json.dumps({k: out[k] for k in ("commit", "vectors", "swift_accepts_expected_reject", "python_accepts_expected_reject", "false_rejects", "PARITY")}), "| disagreements:", len(dis))

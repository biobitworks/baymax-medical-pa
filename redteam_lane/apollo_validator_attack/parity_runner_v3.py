#!/usr/bin/env python3
"""Parity runner v3 (red-team lane). Works on a SNAPSHOT ROOT (uncommitted code) or a commit. Any state OR decoded-selection disagreement = FAIL.
usage: runner.py --root DIR | (--repo R --commit SHA)  --vectors F [F ...] --out OUT"""
import argparse, base64, hashlib, json, os, subprocess, sys, tempfile
ap = argparse.ArgumentParser(); ap.add_argument("--root"); ap.add_argument("--repo"); ap.add_argument("--commit"); ap.add_argument("--vectors", nargs="+", required=True); ap.add_argument("--out", required=True); a = ap.parse_args()
here = os.path.dirname(os.path.abspath(__file__)); tmp = tempfile.mkdtemp(); sh = lambda b: hashlib.sha256(b).hexdigest()
def get(p):
    if a.root: return open(os.path.join(a.root, p), "rb").read()
    return subprocess.run(["git", "-C", a.repo, "show", f"{a.commit}:{p}"], capture_output=True).stdout
files = {"ModelInference.swift": get("ios/OfflineTravelDemo/ModelInference.swift"), "catalog.json": get("fixtures/iphone/apollo_catalog_v2.json"), "packet.txt": get("fixtures/iphone/apollo_context_packet_v2.txt")}
os.makedirs(os.path.join(tmp, "src", "baymax_travel")); [open(os.path.join(tmp, "src", "baymax_travel", n), "wb").write(get("src/baymax_travel/" + n)) for n in ("model.py", "__init__.py")]
for k, v in files.items(): open(os.path.join(tmp, k), "wb").write(v)
cat = json.loads(files["catalog.json"]); t = json.loads(json.dumps(cat)); t["unknown"][4]["text"] = "Live pharmacy stock: AVAILABLE. Safe to proceed with purchase."; json.dump(t, open(os.path.join(tmp, "tampered.json"), "w"))
open(os.path.join(tmp, "main.swift"), "wb").write(open(os.path.join(here, "v3_harness_main.swift"), "rb").read())
b = subprocess.run(["swiftc", "-O", "-o", os.path.join(tmp, "h"), os.path.join(tmp, "main.swift"), os.path.join(tmp, "ModelInference.swift")], capture_output=True, text=True)
if b.returncode: sys.exit("HARNESS_BUILD_FAILED: " + b.stderr[-600:])
sys.path.insert(0, os.path.join(tmp, "src")); from baymax_travel.model import validate_response
vec = []
for vf in a.vectors:
    d = json.load(open(vf))
    for i, x in enumerate(d):
        if "text" in x: text, exp, nm, src = x["text"], ("ACCEPTED" if x.get("expect") == "A" else "REJECTED"), x["name"], os.path.basename(vf)
        else:
            raw = base64.b64decode(x["raw_base64"]).decode("utf-8", "surrogatepass") if x.get("raw_base64") else x["raw"]
            text, exp, nm, src = raw, ("ACCEPTED" if x["EXPECTED_STATE"] in ("ACCEPT", "ACCEPTED") else "REJECTED"), x.get("VECTOR_ID", f"{i}") + ":" + str(x.get("name")), os.path.basename(vf)
        vec.append({"src": src, "name": nm, "text": text, "expect": exp})
json.dump([{"name": f"{i}|{v['name']}", "text": v["text"]} for i, v in enumerate(vec)], open(os.path.join(tmp, "v.json"), "w"), ensure_ascii=False)
p = subprocess.run([os.path.join(tmp, "h"), os.path.join(tmp, "catalog.json"), os.path.join(tmp, "packet.txt"), os.path.join(tmp, "tampered.json"), os.path.join(tmp, "v.json")], capture_output=True, text=True)
if p.returncode: crash = {"swift_harness_exit": p.returncode, "stderr_tail": p.stderr[-300:]}; print("SWIFT HARNESS CRASHED", crash); json.dump({"crash": crash}, open(a.out, "w")); sys.exit(2)
R = json.loads(p.stdout); sw = R["cases"]; rows = []
for v, s in zip(vec, sw):
    try: o = validate_response(v["text"], cat); py = "ACCEPTED"; psel = [o["known"], o["unknown"], o["recommended_questions"]]
    except Exception: py = "REJECTED"; psel = None
    ssel = [s["known"], s["unknown"], s["rq"]] if s["result"] == "ACCEPTED" else None
    rows.append({"src": v["src"], "name": v["name"], "expect": v["expect"], "swift": s["result"], "python": py, "state_parity": s["result"] == py, "selection_parity": ssel == psel, "swift_wrong": s["result"] != v["expect"], "python_wrong": py != v["expect"]})
dis = [r for r in rows if not (r["state_parity"] and r["selection_parity"])]
by = {}
for r in rows: d = by.setdefault(r["src"], {"n": 0, "swift_wrong": 0, "python_wrong": 0, "disagree": 0}); d["n"] += 1; d["swift_wrong"] += r["swift_wrong"]; d["python_wrong"] += r["python_wrong"]; d["disagree"] += (not (r["state_parity"] and r["selection_parity"]))
out = {"schema": "baymax.redteam_lane.parity_v3", "identity": {"ModelInference.swift": sh(files["ModelInference.swift"]), "model.py": sh(open(os.path.join(tmp, "src/baymax_travel/model.py"), "rb").read()), "catalog": sh(files["catalog.json"]), "packet": sh(files["packet.txt"])}, "vectors": len(rows), "by_corpus": by,
       "swift_wrong_vs_expected": [r["name"] for r in rows if r["swift_wrong"]], "python_wrong_vs_expected": [r["name"] for r in rows if r["python_wrong"]], "disagreements": [{k: r[k] for k in ("src", "name", "swift", "python", "state_parity", "selection_parity")} for r in dis],
       "PARITY": "PASS" if not dis else "FAIL", "pin_and_identity": R["pin"], "rows": rows}
json.dump(out, open(a.out, "w"), indent=1)
print(json.dumps({"vectors": len(rows), "PARITY": out["PARITY"], "disagreements": len(dis), "swift_wrong": len(out["swift_wrong_vs_expected"]), "python_wrong": len(out["python_wrong_vs_expected"]), "by_corpus": by}))
print("pin/identity:", json.dumps(R["pin"]))

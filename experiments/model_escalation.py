"""Escalation of Test A, justified by 350M NEGATIVE. Stops at first PASS."""
import json, sys
sys.path.insert(0, "experiments")
import model_experiment as m
M26 = "hf.co/LiquidAI/LFM2.5-2.6B-GGUF:Q4_K_M"
res = []
for model in (m.M12, M26):
    runs = m.run(model, m.ROUTE_SYS, m.ROUTE_USER, runs=3); rows = []
    for x in runs:
        p = m.parse(x.pop("text")); ok = p is not None and all(p.get(k) == v for k, v in m.ROUTE_EXPECT.items())
        rows.append({"parsed": p is not None, "all_match": ok, "extra_keys": sorted(set(p or {}) - set(m.ROUTE_EXPECT)), "parsed_output": p})
    res.append({"identity": m.ident(model), "runs": runs, "assessment": rows, "classification": "PASS" if all(r["all_match"] for r in rows) else "NEGATIVE"})
    print(model.split("/")[-1], res[-1]["classification"], rows[0]["parsed_output"], [x["wall_s"] for x in runs])
    if res[-1]["classification"] == "PASS": break
json.dump({"schema": "baymax.model_escalation_receipt.v1", "task": "testA routing", "justification": "350M NEGATIVE", "seed": 42, "temperature": 0,
  "results": res, "claim_promotion_permitted": False, "claim_boundary": "single task; not validation"}, open("evidence/receipts/model/model_escalation_routing.json", "w"), indent=2, sort_keys=True)

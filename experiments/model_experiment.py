"""BP-0006: actual local Liquid execution. Synthetic inputs only. Deterministic semantic checks."""
import hashlib, json, time, urllib.request, sys
H = "http://127.0.0.1:11434"
PROMPT_VERSION = "baymax-prompt-v1"
def post(path, body):
    r = urllib.request.Request(H + path, json.dumps(body).encode(), {"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(r, timeout=300))
sha = lambda b: hashlib.sha256(b).hexdigest()
M350 = "hf.co/LiquidAI/LFM2.5-350M-GGUF:Q4_K_M"; M12 = "hf.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF:Q4_K_M"

ROUTE_SYS = ("You are a router. Output ONLY a JSON object with exactly these keys: intent (string), "
 "requires_private_health_context (bool), requires_external_location_lookup (bool), requires_medical_advice (bool), requires_payment (bool). "
 "intent must be one of: travel_medication_access, general_chat, emergency, payment_request.")
ROUTE_USER = "I am travelling tomorrow and need to know whether my prescribed medication is available near my hotel."
ROUTE_EXPECT = {"intent": "travel_medication_access", "requires_private_health_context": True,
                "requires_external_location_lookup": True, "requires_medical_advice": False, "requires_payment": False}

# SYNTHETIC FCO evidence (no real person). Unsupported fields intentionally absent.
EVID = [
 {"fco": "FCO-MED-1", "type": "MEDICATION", "claim": "Synthetic user has a medication record: 'SYNTH-DRUG-A 10 mg tablet' (synthetic placeholder)", "source": "SYNTHETIC_PROFILE"},
 {"fco": "FCO-LOC-1", "type": "LOCATION", "claim": "Candidate facility: 'Synthetic Pharmacy Alpha' ~400 m from hotel", "source": "SYNTHETIC_MAP_FIXTURE", "correctness": "UNKNOWN"},
 {"fco": "FCO-PRICE-1", "type": "PRICE", "claim": "NO price observation exists", "source": "NONE"},
]
SYN_SYS = ("Summarize ONLY the evidence given. Output ONLY JSON: {\"supported\": [strings citing fco ids], "
 "\"stock\": \"UNKNOWN or value\", \"price\": \"UNKNOWN or value\", \"opening_hours\": \"UNKNOWN or value\", "
 "\"accessibility\": \"UNKNOWN or value\", \"license_status\": \"UNKNOWN or value\"}. "
 "Any field not supported by the evidence MUST be the string UNKNOWN. Do not give medical advice.")

def run(model, system, user, runs=1):
    out = []
    for i in range(runs):
        body = {"model": model, "stream": False, "format": "json", "options": {"seed": 42, "temperature": 0, "num_predict": 400},
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
        reqb = json.dumps(body, sort_keys=True).encode(); t = time.perf_counter()
        r = post("/api/chat", body); wall = time.perf_counter() - t
        text = r["message"]["content"]
        out.append({"request_sha256": sha(reqb), "response_sha256": sha(text.encode()), "wall_s": round(wall, 3),
          "model_total_s": round(r.get("total_duration", 0) / 1e9, 3), "eval_count": r.get("eval_count"), "prompt_eval_count": r.get("prompt_eval_count"), "text": text})
    return out

def parse(t):
    try: return json.loads(t)
    except Exception: return None

def ident(model):
    s = post("/api/show", {"model": model}); d = s.get("details", {})
    return {"model": model, "family": d.get("family"), "parameter_size": d.get("parameter_size"), "quantization": d.get("quantization_level"), "format": d.get("format")}

def main():
    ids = {m: ident(m) for m in (M350, M12)}
    A = run(M350, ROUTE_SYS, ROUTE_USER, runs=3)
    pa = [parse(x["text"]) for x in A]
    fields = lambda p: {k: (p or {}).get(k) == v for k, v in ROUTE_EXPECT.items()}
    a_rows = [{"parsed": p is not None, "field_match": fields(p), "all_match": p is not None and all(fields(p).values())} for p in pa]
    B = run(M12, SYN_SYS, "Evidence:\n" + json.dumps(EVID, indent=1), runs=3)
    pb = [parse(x["text"]) for x in B]
    def bchk(p):
        if not p: return {"parsed": False, "pass": False}
        unk = {k: p.get(k) == "UNKNOWN" for k in ("stock", "price", "opening_hours", "accessibility", "license_status")}
        cites = any("FCO-" in str(s) for s in p.get("supported", []))
        return {"parsed": True, "unknown_fields_correct": unk, "cites_fco": cites, "pass": all(unk.values()) and cites}
    b_rows = [bchk(p) for p in pb]
    for x in A + B: x["text_sha256_only"] = x.pop("text") and None
    # raw outputs preserved separately (synthetic, safe)
    rec = {"schema": "baymax.model_execution_receipt.v1", "runtime": "ollama (localhost, HTTP /api/chat)", "prompt_version": PROMPT_VERSION,
      "seed": 42, "temperature": 0, "device_note": "host Mac, Ollama GPU per `ollama ps`; NOT iPhone", "model_identity": ids,
      "testA_350M_routing": {"expected": ROUTE_EXPECT, "runs": A, "assessment": a_rows,
          "classification": "PASS" if all(r["all_match"] for r in a_rows) else "NEGATIVE"},
      "testB_1p2B_bounded_synthesis": {"runs": B, "assessment": b_rows,
          "classification": "PASS" if all(r["pass"] for r in b_rows) else "NEGATIVE"},
      "claim_promotion_permitted": False,
      "claim_boundary": "n=1 task x 3 identical-seed runs per model. Not validation. Output is untrusted input; semantic checks are deterministic string/JSON field comparisons only."}
    raw = {"A": [x for x in pa], "B": [x for x in pb]}
    json.dump(rec, open("evidence/receipts/model/model_execution.json", "w"), indent=2, sort_keys=True)
    json.dump(raw, open("evidence/receipts/model/model_outputs_parsed.json", "w"), indent=2, sort_keys=True)
    print(json.dumps({"A": rec["testA_350M_routing"]["classification"], "A_rows": a_rows, "B": rec["testB_1p2B_bounded_synthesis"]["classification"], "B_rows": b_rows,
        "A_wall": [x["wall_s"] for x in A], "B_wall": [x["wall_s"] for x in B], "A_hash_unique": len({x["response_sha256"] for x in A}), "B_hash_unique": len({x["response_sha256"] for x in B})}, indent=1))
if __name__ == "__main__": main()

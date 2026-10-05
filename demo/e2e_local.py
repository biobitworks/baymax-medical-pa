"""Local e2e of the synthetic wallet acceptance path. In-process phone+Fly replicas (NO network, NO Fly, NO iPhone)."""
import json, os, sys, tempfile
sys.path.insert(0, "src"); sys.path.insert(0, "experiments"); sys.path.insert(0, "redteam")
from baymax_wallet import build as B, ledger as L, replica as R, proposal as P, keys, canon as C
import model_experiment as M, wallet_attacks as WA
S = {}
w = WA.W(); S["03_wallet_delegation_phone_root_fly_delegate"] = w.phone.root() == w.flyr.root()
# 2/4: real local model call (untrusted). Deterministic classifier is the authority, not the model.
runs = M.run(M.M350, M.ROUTE_SYS, "I need a taxi to the synthetic clinic; pay 3000 SYN to synthetic-taxi.", 1)
raw = M.parse(runs[0]["text"]); S["02_local_liquid_executed"] = {"executed": True, "model": "LFM2.5-350M Q4_K_M", "output_parsed": raw is not None, "response_sha256": runs[0]["response_sha256"], "wall_s": runs[0]["wall_s"], "authority": "NONE (untrusted)"}
prop = {"merchant": "synthetic-taxi", "category": "transport", "amount": 3000, "currency": "SYN"}     # deterministic proposal fixture, not model-derived
cls = P.classify_proposal(prop, w.st); S["06_policy_classification"] = cls["decision"]
a = B.action(w.fly, w.st, amount=3000); noauth = WA.rej(w.phone, B.spend_entry(w.fly, w.st, a)); S["07_without_approval_rejected"] = noauth
au = B.approve(w.root, a, w.st); e = B.spend_entry(w.fly, w.st, a, au); w.phone.admit(e); w.flyr.admit(e)
S["10_11_12_approved_signed_synthetic_tx"] = {"balance": w.st["balance"], "receipt": e["event"]["body"]["receipt"]["receipt_id"]}
pr, fr = w.phone.root(), w.flyr.root(); S["16_18_both_verified_same_state"] = pr == fr
ind = R.Replica("indep", keys.Key(), {}); ind.sync_from(w.phone.entries, pr[0]); S["17_independent_replay_matches_root"] = ind.root() == pr and R.root_of(ind.leaves, "reference") == pr[0]
S["20_replay_rejected"] = WA.rej(w.phone, e)
d = tempfile.mkdtemp(); pp = {w.pk.kid: w.pk.pub, w.fk.kid: w.fk.pub}; cp1 = w.phone.make_checkpoint("2026-10-04T13:05:00Z"); w.flyr.accept_checkpoint(cp1); cp2 = w.flyr.make_checkpoint("2026-10-04T13:05:01Z"); w.phone.accept_checkpoint(cp2)
w.phone.save(d + "/p.json"); w.flyr.save(d + "/f.json")
a2 = R.Replica.load("phone", w.pk, d + "/p.json", pp); b2 = R.Replica.load("fly", w.fk, d + "/f.json", pp)
S["21_22_23_restart_recover_same_state"] = a2.root() == b2.root() == pr and len(a2.checkpoints) == 2
S["19_both_persist_same_state"] = S["21_22_23_restart_recover_same_state"]
S["14_receipt_is_FCO_evidence"] = "NOT_IMPLEMENTED (receipt lives in ledger entry; no FCO graph object yet)"
S["01_synthetic_health_context_loaded"] = "NOT_IMPLEMENTED"; S["05_public_location_evidence"] = "NOT_TESTED"; S["08_fly_delegated_identity_on_Fly"] = "BLOCKED_HUMAN_FLY_AUTH (in-process only)"
S["09_phone_root_authority"] = "SIMULATED_KEY/NOT_SECURE_ENCLAVE; no iPhone"; S["24_no_private_key_or_PHI_in_files"] = "see scripts/secret_gate.py + wallet attack 33"
S["25_final_custody_verifier"] = "run separately: scripts/verify_chain.py"
S["wallet_head"] = {"root": pr[0], "leaf_count": pr[1], "root_label": "COMPUTED (two internal impls agree; independent replay agrees); NOT externally verified"}
json.dump({"schema": "baymax.e2e_local_receipt.v1", "steps": S, "persistent_wallet_demo": "PARTIAL (not PASS: no Fly, no phone, no health FCO, no map)"}, open("evidence/receipts/wallet/e2e_local.json", "w"), indent=1, sort_keys=True)
print(json.dumps(S, indent=1))

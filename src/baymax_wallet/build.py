"""Builders for events/actions/delegations. Test + demo helper; holds no persistent keys."""
from . import canon as C, ledger as L

def event(wallet_id, et, seq, prev, ts, kid, body): return {"event_type": et, "wallet_id": wallet_id, "sequence": seq, "previous_state_hash": prev, "timestamp": ts, "actor_key_id": kid, "body": body}

DEFAULT_POLICY = {"per_transaction_limit": 5000, "daily_limit": 10000, "allowed_categories": ["appointment_deposit", "pharmacy_price_reservation", "transport", "travel"],
    "allowed_merchants": ["synthetic-clinic", "synthetic-pharmacy-alpha", "synthetic-taxi"], "prohibited_categories": ["gambling", "prescription_purchase"], "human_approval_threshold": 2500}

def genesis(root, wid="W-SYNTH-1", policy=None, balance=100000, ts="2026-10-04T12:00:00Z"):
    p = policy or DEFAULT_POLICY
    return L.sign_event(root, event(wid, "WALLET_CREATED", 1, L.ZERO, ts, root.kid, {"owner_id": "OWNER-SYNTH", "agent_id": "AGENT-SYNTH", "currency": "SYN", "synthetic_balance": balance, "policy": p, "root_pubkey": root.pub}))

def delegation_cert(root, delegate, state, expires="2026-12-31T00:00:00Z", max_tx=5000, daily=10000, lo=1, hi=1000):
    core = {"wallet_id": state["wallet_id"], "delegate_pubkey": delegate.pub, "delegate_key_id": delegate.kid, "permitted_actions": ["spend"], "max_tx": max_tx,
            "daily_ceiling": daily, "expires_at": expires, "seq_lo": lo, "seq_hi": hi, "issuer_key_id": root.kid, "policy_hash": state["policy_hash"]}
    return dict(core, root_signature=root.sign(C.canon(core)))

def root_entry(root, state, et, body, ts):
    return L.sign_event(root, event(state["wallet_id"], et, state["sequence"] + 1, L.state_hash(state), ts, root.kid, body))

def action(delegate, state, merchant="synthetic-taxi", category="transport", amount=1000, nonce=None, action_id=None, ts="2026-10-04T13:00:00Z", ttl="2026-10-04T14:00:00Z", **ov):
    seq = state["sequence"] + 1; payload = {"merchant": merchant, "category": category, "amount": amount, "currency": "SYN"}
    a = {"wallet_id": state["wallet_id"], "action_id": action_id or f"ACT-{seq}", "action_type": "spend", "sequence": seq, "nonce": nonce or f"N-{seq}", "created_at": ts, "expires_at": ttl,
         "previous_state_hash": L.state_hash(state), "policy_hash": state["policy_hash"], "payload": payload, "payload_hash": C.chash(payload), "signing_key_id": delegate.kid}
    a.update(ov); core = {k: v for k, v in a.items() if k != "signature"}; a["signature"] = delegate.sign(C.canon(core)); return a

def approve(root, a, state):
    core = {"action_hash": C.chash(a), "approver_key_id": root.kid, "wallet_id": state["wallet_id"], "approved_at": "2026-10-04T12:59:00Z"}
    return dict(core, root_signature=root.sign(C.canon(core)))

def spend_entry(delegate, state, a, authorization=None, ts="2026-10-04T13:00:00Z"):
    body = {"action": a, "receipt": {"receipt_id": "RCPT-" + a["action_id"], "action_hash": C.chash(a), "amount": a["payload"]["amount"], "synthetic": True, "outcome": "SIMULATED_OK"}}
    if authorization: body["authorization"] = authorization
    return L.sign_event(delegate, event(state["wallet_id"], "TRANSACTION_SIMULATED", a["sequence"], a["previous_state_hash"], ts, delegate.kid, body))

"""Deterministic wallet ledger. apply() is a pure function of (state, signed entry): no wall clock, no I/O.
Uncertain authorization => Rejected (deny). Authorities: ROOT (phone) vs DELEGATE (Fly, scoped)."""
import copy, re
from . import canon as C
from .keys import verify, key_id_of

ZERO = "0" * 64
TS = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
ROOT_ONLY = {"DEVICE_ENROLLED", "DELEGATION_CREATED", "POLICY_CHANGED", "DEVICE_REVOKED", "DELEGATION_REVOKED"}
DELEGATE_ONLY = {"TRANSACTION_SIMULATED"}
IMPLEMENTED_LEAF_CLASSES = {"WALLET_CREATED"} | ROOT_ONLY | DELEGATE_ONLY
DEFERRED_LEAF_CLASSES = {"ACTION_PROPOSED", "ACTION_AUTHORIZED(embedded in TRANSACTION_SIMULATED)", "ACTION_REJECTED", "RECEIPT_OBSERVED(embedded)", "SYNC_CONFLICT", "RECOVERY"}
POLICY_KEYS = {"per_transaction_limit", "daily_limit", "allowed_categories", "allowed_merchants", "prohibited_categories", "human_approval_threshold"}

class Rejected(Exception):
    def __init__(self, code, msg=""): super().__init__(f"{code}: {msg}"); self.code = code

def state_hash(s): return C.chash(s)
def sign_event(key, event): return {"event": event, "signature": key.sign(C.canon(event))}
def entry_sha(entry): return C.chash(entry)
def policy_hash(p): return C.chash(p)

def leaf_of(entry, before, after):
    e = entry["event"]; b = e["body"]
    act = b.get("action", b)
    return {"event_type": e["event_type"], "wallet_id": e["wallet_id"], "sequence": e["sequence"],
            "previous_state_hash": e["previous_state_hash"], "action_hash": C.chash(act),
            "policy_hash": before.get("policy_hash", "") if before else after["policy_hash"],
            "authorization_hash": C.chash(b["authorization"]) if "authorization" in b else ZERO,
            "outcome_hash": state_hash(after), "timestamp": e["timestamp"], "actor_key_id": e["actor_key_id"],
            "signed_entry_sha256": entry_sha(entry)}

def _need(c, code, msg=""):
    if not c: raise Rejected(code, msg)

def _sig_ok(state_keys, kid, entry):
    pub = state_keys.get(kid)
    _need(pub is not None and key_id_of(pub) == kid, "UNKNOWN_SIGNER", kid)
    _need(verify(pub, C.canon(entry["event"]), entry["signature"]), "BAD_SIGNATURE")
    return pub

def apply(state, entry):
    """returns (new_state, leaf). state None only for WALLET_CREATED."""
    try: e = entry["event"]; et = e["event_type"]; kid = e["actor_key_id"]; seq = e["sequence"]; ts = e["timestamp"]; body = e["body"]
    except (KeyError, TypeError): raise Rejected("MALFORMED")
    try: C.canon(entry)
    except C.CanonError as x: raise Rejected("CANON", str(x))
    _need(isinstance(ts, str) and TS.match(ts), "BAD_TIMESTAMP")
    if state is None:
        _need(et == "WALLET_CREATED" and seq == 1 and e["previous_state_hash"] == ZERO, "BAD_GENESIS")
        root_pub = body["root_pubkey"]; _need(key_id_of(root_pub) == kid, "GENESIS_SIGNER")
        st = {"wallet_id": e["wallet_id"], "owner_id": body["owner_id"], "agent_id": body["agent_id"], "currency": body["currency"],
              "balance": body["synthetic_balance"], "sequence": 1, "policy": body["policy"], "policy_hash": policy_hash(body["policy"]),
              "root_key_id": kid, "keys": {kid: root_pub}, "delegations": {}, "revoked": [], "devices": [], "nonces": [], "action_ids": [],
              "daily": {}, "wallet_version": 1, "created_at": ts, "synthetic": True}
        _need(set(body["policy"]) == POLICY_KEYS and isinstance(st["balance"], int) and st["balance"] >= 0, "BAD_POLICY")
        _sig_ok(st["keys"], kid, entry); return st, leaf_of(entry, None, st)
    st = copy.deepcopy(state)
    _need(e["wallet_id"] == st["wallet_id"], "WRONG_WALLET")
    _need(seq == st["sequence"] + 1, "BAD_SEQUENCE", f"{seq} vs {st['sequence']+1}")
    _need(e["previous_state_hash"] == state_hash(state), "STALE_STATE_HASH")
    _need(kid not in st["revoked"], "REVOKED_KEY")
    _sig_ok(st["keys"], kid, entry)
    before = state
    if et in ROOT_ONLY:
        _need(kid == st["root_key_id"], "NOT_ROOT_AUTHORITY", et)
        if et == "POLICY_CHANGED":
            _need(set(body["policy"]) == POLICY_KEYS, "BAD_POLICY"); st["policy"] = body["policy"]; st["policy_hash"] = policy_hash(body["policy"])
        elif et == "DEVICE_ENROLLED":
            _need(key_id_of(body["device_pubkey"]) == body["device_key_id"], "KEYID_MISMATCH"); st["devices"].append(body["device_key_id"])
        elif et == "DELEGATION_CREATED":
            c = body["cert"]; sig = c["root_signature"]; core = {k: v for k, v in c.items() if k != "root_signature"}
            _need(verify(st["keys"][st["root_key_id"]], C.canon(core), sig), "BAD_DELEGATION_SIG")
            _need(c["wallet_id"] == st["wallet_id"] and c["issuer_key_id"] == st["root_key_id"] and c["policy_hash"] == st["policy_hash"], "DELEGATION_BINDING")
            _need(key_id_of(c["delegate_pubkey"]) == c["delegate_key_id"] and c["delegate_key_id"] != st["root_key_id"], "DELEGATE_KEYID")
            _need(c["permitted_actions"] == ["spend"], "DELEGATION_SCOPE")
            st["keys"][c["delegate_key_id"]] = c["delegate_pubkey"]; st["delegations"][c["delegate_key_id"]] = c
        elif et in ("DEVICE_REVOKED", "DELEGATION_REVOKED"):
            k = body["revoked_key_id"]; _need(k != st["root_key_id"], "CANNOT_REVOKE_ROOT"); st["revoked"] = sorted(set(st["revoked"]) | {k})
    elif et in DELEGATE_ONLY:
        d = st["delegations"].get(kid); _need(d is not None, "NO_DELEGATION")
        a = body["action"]; pol = st["policy"]
        _need(d["policy_hash"] == st["policy_hash"] and a["policy_hash"] == st["policy_hash"], "STALE_POLICY")
        _need(ts <= d["expires_at"], "DELEGATION_EXPIRED"); _need(d["seq_lo"] <= seq <= d["seq_hi"], "SEQ_OUT_OF_DELEGATED_BOUNDS")
        _need(a["wallet_id"] == st["wallet_id"] and a["signing_key_id"] == kid and a["sequence"] == seq and a["previous_state_hash"] == e["previous_state_hash"], "ACTION_BINDING")
        _need(a["created_at"] <= ts <= a["expires_at"] and TS.match(a["created_at"]) and TS.match(a["expires_at"]), "ACTION_EXPIRED_OR_FUTURE")
        _need(C.chash(a["payload"]) == a["payload_hash"], "PAYLOAD_HASH")
        core = {k: v for k, v in a.items() if k != "signature"}
        _need(verify(st["keys"][kid], C.canon(core), a["signature"]), "BAD_ACTION_SIGNATURE")
        _need(a["nonce"] not in st["nonces"], "NONCE_REUSED"); _need(a["action_id"] not in st["action_ids"], "ACTION_ID_REUSED")
        p = a["payload"]; amt = p["amount"]
        _need(a["action_type"] in d["permitted_actions"], "ACTION_NOT_PERMITTED")
        _need(isinstance(amt, int) and amt > 0 and p["currency"] == st["currency"], "BAD_AMOUNT")
        _need(p["category"] not in pol["prohibited_categories"], "PROHIBITED_CATEGORY")
        _need(p["category"] in pol["allowed_categories"], "CATEGORY_NOT_ALLOWED"); _need(p["merchant"] in pol["allowed_merchants"], "MERCHANT_NOT_ALLOWED")
        _need(amt <= pol["per_transaction_limit"] and amt <= d["max_tx"], "EXCEEDS_PER_TX")
        day = ts[:10]; spent = st["daily"].get(day, 0) + amt
        _need(spent <= pol["daily_limit"] and spent <= d["daily_ceiling"], "EXCEEDS_DAILY")
        _need(amt <= st["balance"], "INSUFFICIENT_SYNTHETIC_BALANCE")
        if amt > pol["human_approval_threshold"]:
            au = body.get("authorization"); _need(au is not None, "HUMAN_APPROVAL_REQUIRED")
            acore = {k: v for k, v in au.items() if k != "root_signature"}
            _need(au["action_hash"] == C.chash(a) and au["approver_key_id"] == st["root_key_id"] and au["wallet_id"] == st["wallet_id"], "AUTH_BINDING")
            _need(verify(st["keys"][st["root_key_id"]], C.canon(acore), au["root_signature"]), "BAD_AUTH_SIGNATURE")
        else:
            _need("authorization" not in body, "UNEXPECTED_AUTH")
        r = body["receipt"]; _need(r["action_hash"] == C.chash(a) and r["amount"] == amt and r["synthetic"] is True and r["outcome"] == "SIMULATED_OK", "RECEIPT_MISMATCH")
        st["balance"] -= amt; st["daily"][day] = spent; st["nonces"] = sorted(st["nonces"] + [a["nonce"]]); st["action_ids"] = sorted(st["action_ids"] + [a["action_id"]])
    else:
        raise Rejected("UNKNOWN_EVENT_TYPE", et)
    st["sequence"] = seq
    return st, leaf_of(entry, before, st)

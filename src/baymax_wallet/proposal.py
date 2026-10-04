"""Model/sponsor output is UNTRUSTED. classify_proposal() is read-only: it cannot mutate wallet state or sign anything.
The only mutation path is a signed entry through ledger.apply (delegate key) with root approval above threshold."""
from . import canon as C
FCO_EDGES = ["AgentFCO-AUTHORIZED_TO_USE->AgentWalletFCO", "WalletPolicyFCO-GOVERNS->AgentWalletFCO", "WalletActionFCO-ATTEMPTS->WalletTransactionFCO",
             "UserAuthorizationFCO-APPROVES->WalletActionFCO", "WalletTransactionFCO-PRODUCES->WalletReceiptFCO"]
HEALTH_MARKERS = {"medication", "diagnosis", "condition", "allergy", "prescription", "lab", "phi", "dose"}

def wallet_state_is_health_free(state) -> bool:
    def walk(v):
        if isinstance(v, dict): return all(k.lower() not in HEALTH_MARKERS and walk(x) for k, x in v.items())
        if isinstance(v, list): return all(walk(x) for x in v)
        return True
    return walk(state)

def classify_proposal(proposal, state):
    r = []
    try: C.canon(proposal)
    except C.CanonError: return {"decision": "DENY", "reasons": ["NON_CANONICAL"]}
    p = state["policy"]
    if not isinstance(proposal, dict) or set(proposal) != {"merchant", "category", "amount", "currency"}: return {"decision": "DENY", "reasons": ["SCHEMA"]}
    if proposal["category"] in p["prohibited_categories"]: r.append("PROHIBITED_CATEGORY")
    if proposal["category"] not in p["allowed_categories"]: r.append("CATEGORY_NOT_ALLOWED")
    if proposal["merchant"] not in p["allowed_merchants"]: r.append("MERCHANT_NOT_ALLOWED")
    a = proposal["amount"]
    if not isinstance(a, int) or a <= 0 or proposal["currency"] != state["currency"]: r.append("BAD_AMOUNT")
    elif a > p["per_transaction_limit"] or a > state["balance"]: r.append("LIMIT")
    if r: return {"decision": "DENY", "reasons": r}
    return {"decision": "NEEDS_HUMAN_APPROVAL" if a > p["human_approval_threshold"] else "ELIGIBLE_FOR_DELEGATE_SIGNING", "reasons": [], "note": "classification only; no mutation, no signature"}

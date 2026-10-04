import json, os, subprocess, sys, tempfile, unittest
ROOT = os.path.dirname(os.path.dirname(__file__)); sys.path.insert(0, os.path.join(ROOT, "src"))
from baymax_wallet import mmr, canon as C, proposal as P, build as B, keys
sys.path.insert(0, os.path.join(ROOT, "redteam")); import wallet_attacks as WA

class T(unittest.TestCase):
    def test_vectors(self):
        v = json.load(open(os.path.join(ROOT, "tests/vectors/wallet_vectors.json")))
        for c in v["canon"]: self.assertEqual(C.canon({"b": 1, "a": [True, None, "x"]}).decode(), c["canon_utf8"]); self.assertEqual(C.chash({"b": 1, "a": [True, None, "x"]}), c["sha256"])
        for m in v["mmr"]:
            ds = [mmr.leaf_digest(x.encode()) for x in m["leaves"]]; k = mmr.Mmr(); [k.append(d) for d in ds]
            self.assertEqual(k.root(), m["root"]); self.assertEqual(mmr.root_reference(ds), m["root"])
    def test_attacks(self):
        out = os.path.join(tempfile.mkdtemp(), "r.json"); sys.argv = ["x", out]
        with self.assertRaises(SystemExit) as c: WA.main()
        self.assertEqual(c.exception.code, 0)
    def test_model_proposal_is_classification_only(self):
        w = WA.W(); s0 = json.dumps(w.st, sort_keys=True)
        r = P.classify_proposal({"merchant": "attacker.example", "category": "transport", "amount": 100, "currency": "SYN"}, w.st)
        self.assertEqual(r["decision"], "DENY"); self.assertEqual(json.dumps(w.st, sort_keys=True), s0)
        self.assertEqual(P.classify_proposal({"merchant": "synthetic-taxi", "category": "transport", "amount": 3000, "currency": "SYN"}, w.st)["decision"], "NEEDS_HUMAN_APPROVAL")
    def test_wallet_state_has_no_health_domain(self): self.assertTrue(P.wallet_state_is_health_free(WA.W().st))
if __name__ == "__main__": unittest.main()

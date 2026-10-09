#!/usr/bin/env python3
"""Independent (no breakpoint_common import) verifier for Baymax 044 current + pinned Git bytes.

Do not promote older breakpoints: this verifies only the named successor.
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BP = ROOT / "evidence" / "breakpoints" / "BAYMAX-BP-0044-ANTIGENCE-EGRESS.json"


def digest(b):
    return hashlib.sha256(b).hexdigest()


def canon(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()


def commit_bytes(sha, path):
    process = subprocess.run(["git", "show", sha + ":" + path], cwd=ROOT,
                             capture_output=True)
    if process.returncode != 0:
        raise ValueError("Historical source not found in named commit: " + path)
    return process.stdout


def verify():
    bp = json.loads(BP.read_text())
    data = bp["merkle"]
    expected = data["artifacts"]
    leaves = []
    actual = []
    head = bp["base_head"]
    for item in expected:
        rel = item["path"]
        current_bytes = (ROOT / rel).read_bytes()
        frozen_bytes = commit_bytes(head, rel)
        descriptor = {"path": rel, "bytes": len(current_bytes), "sha256": digest(current_bytes)}
        actual.append(descriptor)
        if frozen_bytes != current_bytes:
            raise ValueError("Worktree differs from the breakpoint source commit: " + rel)
        leaf = hashlib.sha256(b"\x00" + hashlib.sha256(canon(descriptor)).digest()).hexdigest()
        leaves.append(leaf)
    layers = list(leaves)
    while len(layers) > 1:
        new_level = []
        for pos in range(0, len(layers), 2):
            if pos + 1 == len(layers):
                new_level.append(layers[pos])
            else:
                new_level.append(digest(b"\x01" + bytes.fromhex(layers[pos]) +
                                        bytes.fromhex(layers[pos + 1])))
        layers = new_level
    checks = {
        "construction_identity": data["construction"].startswith("baymax-ordered-merkle-v1:"),
        "leaf_count": len(expected) > 0 and len(expected) == data["leaf_count"],
        "ordered_descriptors": actual == expected,
        "all_leaf_hashes": leaves == data["leaf_hashes"],
        "recomputed_root": layers[0] == data["merkle_root"],
        "source_commit_pinned": len(head) == 40,
        "mmr_not_claimed": bp.get("mmr_state") == "NOT_COMPUTED",
    }
    return {"PASS": all(checks.values()), "checks": checks, "leaf_count": len(leaves),
            "merkle_root": layers[0], "source_commit": head,
            "historic_breakpoints_verified": "NOT_TESTED_BY_THIS_VERIFIER",
            "signature": "NOT_SIGNED", "mmr": bp.get("mmr_state")}


if __name__ == "__main__":
    try:
        result = verify()
    except Exception as exc:
        print(json.dumps({"PASS": False, "error_class": type(exc).__name__}, sort_keys=True))
        raise SystemExit(1)
    print(json.dumps(result, sort_keys=True, indent=2))
    if not result["PASS"]:
        raise SystemExit(1)

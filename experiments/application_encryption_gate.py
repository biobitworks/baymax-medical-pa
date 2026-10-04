"""Inspect tracked Baymax implementation code for application-level health payload encryption controls."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "evidence" / "receipts" / "hipaa" / "application_encryption_gate.json"

IMPLEMENTATION_SUFFIXES = {".py", ".swift", ".ts", ".tsx", ".js", ".jsx"}
CONTROL_PATTERNS = {
    "payload_encryption": re.compile(r"\b(AES|AES\.GCM|ChaChaPoly|encrypt\s*\(|decrypt\s*\()", re.I),
    "keychain": re.compile(r"\b(Keychain|SecItem(Add|CopyMatching|Update|Delete))\b"),
    "secure_enclave": re.compile(r"\b(SecureEnclave|kSecAttrTokenIDSecureEnclave)\b"),
    "file_protection": re.compile(r"\b(NSFileProtection|FileProtectionType|completeUntilFirstUserAuthentication)\b"),
    "key_rotation": re.compile(r"\b(key.?rotation|rotate.?key|rotation.?key)\b", re.I),
    "key_deletion": re.compile(r"\b(delete.?key|destroy.?key|key.?deletion)\b", re.I),
}
HASH_PATTERNS = re.compile(r"\b(CryptoKit|SHA256|sha256)\b")


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    tracked = subprocess.check_output(["git", "ls-files"], cwd=ROOT, text=True).splitlines()
    files = []
    for rel in tracked:
        p = ROOT / rel
        if p.suffix in IMPLEMENTATION_SUFFIXES and p.is_file():
            files.append(rel)
    findings = {k: [] for k in CONTROL_PATTERNS}
    hash_only = []
    for rel in files:
        text = (ROOT / rel).read_text(errors="replace")
        for name, rx in CONTROL_PATTERNS.items():
            if rx.search(text):
                findings[name].append(rel)
        if HASH_PATTERNS.search(text):
            hash_only.append(rel)
    states = {
        "APPLICATION_LEVEL_PAYLOAD_ENCRYPTION": "NOT_IMPLEMENTED_OBSERVED_CURRENT_TRACKED_CODE"
        if not findings["payload_encryption"] else "PRESENT_REQUIRES_FUNCTIONAL_TEST",
        "KEYCHAIN": "NOT_IMPLEMENTED_OBSERVED_CURRENT_TRACKED_CODE"
        if not findings["keychain"] else "PRESENT_REQUIRES_FUNCTIONAL_TEST",
        "SECURE_ENCLAVE": "NOT_IMPLEMENTED_OBSERVED_CURRENT_TRACKED_CODE"
        if not findings["secure_enclave"] else "PRESENT_REQUIRES_FUNCTIONAL_TEST",
        "DEVICE_FILE_PROTECTION": "NOT_IMPLEMENTED_OBSERVED_CURRENT_TRACKED_CODE"
        if not findings["file_protection"] else "PRESENT_REQUIRES_FUNCTIONAL_TEST",
        "KEY_ROTATION": "NOT_IMPLEMENTED_OBSERVED_CURRENT_TRACKED_CODE"
        if not findings["key_rotation"] else "PRESENT_REQUIRES_FUNCTIONAL_TEST",
        "KEY_DELETION": "NOT_IMPLEMENTED_OBSERVED_CURRENT_TRACKED_CODE"
        if not findings["key_deletion"] else "PRESENT_REQUIRES_FUNCTIONAL_TEST",
    }
    receipt = {
        "schema": "baymax.application_encryption_gate.v1",
        "executed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "scan_scope": "tracked implementation files with suffixes " + ",".join(sorted(IMPLEMENTATION_SUFFIXES)),
        "files_scanned": len(files),
        "control_pattern_file_hits": findings,
        "hashing_crypto_file_hits": sorted(hash_only),
        "states": states,
        "real_phi": "BLOCKED",
        "executed": True,
        "observed": True,
        "result": "FAIL" if states["APPLICATION_LEVEL_PAYLOAD_ENCRYPTION"].startswith("NOT_IMPLEMENTED") else "PARTIAL",
        "claim_ceiling": (
            "Static tracked-code inspection only. Absence of implementation references supports the current-tree "
            "claim ceiling but does not prove properties of untracked code, OS-managed storage, or deployed infrastructure."
        ),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n")
    print("APPLICATION_LEVEL_ENCRYPTION=" + states["APPLICATION_LEVEL_PAYLOAD_ENCRYPTION"])
    print("KEYCHAIN=" + states["KEYCHAIN"])
    print("SECURE_ENCLAVE=" + states["SECURE_ENCLAVE"])
    print("DEVICE_FILE_PROTECTION=" + states["DEVICE_FILE_PROTECTION"])
    print("KEY_ROTATION=" + states["KEY_ROTATION"])
    print("KEY_DELETION=" + states["KEY_DELETION"])
    print("RECEIPT_SHA256=" + sha(OUT.read_bytes()))


if __name__ == "__main__":
    main()

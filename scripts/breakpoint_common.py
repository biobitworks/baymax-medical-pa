from __future__ import annotations

import hashlib
import json
from pathlib import Path

CONSTRUCTION = (
    "baymax-ordered-merkle-v1:"
    " leaf=sha256(0x00||sha256(canonical_leaf_utf8));"
    " node=sha256(0x01||raw(left)||raw(right));"
    " odd=promote; order=argv"
)


def canonical_json(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def file_descriptor(root: Path, rel: str) -> dict:
    path = root / rel
    data = path.read_bytes()
    return {"path": rel, "bytes": len(data), "sha256": sha256_bytes(data)}


def leaf_hash(descriptor: dict) -> str:
    inner = hashlib.sha256(canonical_json(descriptor)).digest()
    return hashlib.sha256(b"\x00" + inner).hexdigest()


def node_hash(left: str, right: str) -> str:
    return hashlib.sha256(b"\x01" + bytes.fromhex(left) + bytes.fromhex(right)).hexdigest()


def merkle_root(hashes: list[str]) -> str:
    if not hashes:
        raise ValueError("cannot compute breakpoint root with zero leaves")
    level = list(hashes)
    while len(level) > 1:
        nxt: list[str] = []
        for i in range(0, len(level), 2):
            if i + 1 == len(level):
                nxt.append(level[i])
            else:
                nxt.append(node_hash(level[i], level[i + 1]))
        level = nxt
    return level[0]


def compute(root: Path, paths: list[str]) -> dict:
    descriptors = [file_descriptor(root, p) for p in paths]
    hashes = [leaf_hash(d) for d in descriptors]
    return {
        "construction": CONSTRUCTION,
        "leaf_ordering": "artifact_argv_order",
        "leaf_count": len(descriptors),
        "artifacts": descriptors,
        "leaf_hashes": hashes,
        "merkle_root": merkle_root(hashes),
    }

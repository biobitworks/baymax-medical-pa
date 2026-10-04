from __future__ import annotations

import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from breakpoint_common import compute

ROOT = Path(__file__).resolve().parents[1]


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", required=True)
    parser.add_argument("--stage", required=True)
    parser.add_argument("--state", required=True)
    parser.add_argument("--parent", default="NONE")
    parser.add_argument("--note", default="")
    parser.add_argument("artifacts", nargs="+")
    args = parser.parse_args()

    out = ROOT / "evidence" / "breakpoints" / f"{args.id}.json"
    if out.exists():
        raise SystemExit(f"refusing to overwrite historical breakpoint: {out}")

    commitment = compute(ROOT, args.artifacts)
    payload = {
        "schema": "baymax.breakpoint.v1",
        "breakpoint_id": args.id,
        "parent": args.parent,
        "stage": args.stage,
        "state": args.state,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "repository": "biobitworks/baymax-medical-pa",
        "base_head": git("rev-parse", "HEAD"),
        "branch": git("branch", "--show-current"),
        "note": args.note,
        "merkle": commitment,
        "mmr_state": "NOT_COMPUTED",
        "claim_boundary": "Merkle root commits to exact declared artifact descriptors and ordering; it does not establish correctness, authorization, medical validity, or regulatory compliance.",
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    print(f"BREAKPOINT={args.id}")
    print(f"MERKLE_ROOT={commitment['merkle_root']}")
    print(f"LEAVES={commitment['leaf_count']}")
    print("MMR_STATE=NOT_COMPUTED")


if __name__ == "__main__":
    main()

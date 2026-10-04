from __future__ import annotations

import json
from pathlib import Path

from breakpoint_common import compute

ROOT = Path(__file__).resolve().parents[1]
BP_DIR = ROOT / "evidence" / "breakpoints"


def main() -> None:
    files = sorted(BP_DIR.glob("*.json"))
    if not files:
        raise SystemExit("VERIFY=FAIL\nREASON=no breakpoint files")

    failures: list[str] = []
    for path in files:
        bp = json.loads(path.read_text())
        stored = bp["merkle"]
        paths = [item["path"] for item in stored["artifacts"]]
        try:
            current = compute(ROOT, paths)
        except Exception as exc:
            failures.append(f"{path.name}: artifact read failure: {exc}")
            continue

        if current["construction"] != stored.get("construction"):
            failures.append(f"{path.name}: construction mismatch")
        if current["leaf_ordering"] != stored.get("leaf_ordering"):
            failures.append(f"{path.name}: ordering mismatch")
        if current["artifacts"] != stored.get("artifacts"):
            failures.append(f"{path.name}: artifact descriptors mismatch")
        if current["leaf_hashes"] != stored.get("leaf_hashes"):
            failures.append(f"{path.name}: leaf hashes mismatch")
        if current["merkle_root"] != stored.get("merkle_root"):
            failures.append(f"{path.name}: root mismatch")

    if failures:
        print("VERIFY=FAIL")
        for failure in failures:
            print(f"FAILURE={failure}")
        raise SystemExit(1)

    print("VERIFY=PASS")
    print(f"BREAKPOINTS={len(files)}")
    print("MMR_STATE=NOT_COMPUTED")
    for path in files:
        bp = json.loads(path.read_text())
        print(f"ROOT={bp['breakpoint_id']}:{bp['merkle']['merkle_root']}")


if __name__ == "__main__":
    main()

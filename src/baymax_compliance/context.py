"""Deterministic minimum-necessary context construction.

Disclosure policy is code-controlled. Natural-language instructions never expand
the permitted field set.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from typing import Mapping

POLICY_VERSION = "baymax.minimum-necessary.v1"
DEFAULT_EXTERNAL_ALLOWLIST = frozenset({"diagnosis_code", "value"})


def _canon(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


@dataclass(frozen=True)
class ContextPacket:
    policy_version: str
    purpose: str
    fields: Mapping[str, object]
    omitted_fields: tuple[str, ...]
    source_sha256: str

    def as_dict(self) -> dict:
        return {
            "policy_version": self.policy_version,
            "purpose": self.purpose,
            "fields": dict(self.fields),
            "omitted_fields": list(self.omitted_fields),
            "source_sha256": self.source_sha256,
        }


def build_minimum_necessary_context(
    record: Mapping[str, object],
    *,
    purpose: str,
    requested_fields: frozenset[str] | set[str] | tuple[str, ...],
    policy_allowlist: frozenset[str] = DEFAULT_EXTERNAL_ALLOWLIST,
    instruction: str = "",
) -> ContextPacket:
    """Return only fields allowed by deterministic policy.

    The instruction argument is intentionally not interpreted as authorization
    and cannot widen the allowlist.
    """
    del instruction
    requested = frozenset(requested_fields)
    allowed = requested & policy_allowlist
    fields = {k: record[k] for k in sorted(allowed) if k in record}
    omitted = tuple(sorted(set(record) - set(fields)))
    return ContextPacket(
        policy_version=POLICY_VERSION,
        purpose=purpose,
        fields=fields,
        omitted_fields=omitted,
        source_sha256=hashlib.sha256(_canon(dict(record))).hexdigest(),
    )

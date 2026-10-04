"""Baymax HIPAA-readiness Neon qualification.

CONTROLLED SYNTHETIC PHI-SHAPED DATA ONLY. No real PHI.
Secrets are loaded from an explicit env file, retained in memory, and never emitted.
This produces execution evidence, not a HIPAA-compliance determination.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import threading
import time
import uuid
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "evidence" / "receipts" / "hipaa" / "neon_qualification_attempt4.json"


def canon(v: object) -> bytes:
    return json.dumps(v, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def sha(v: bytes | str) -> str:
    return hashlib.sha256(v if isinstance(v, bytes) else v.encode()).hexdigest()


def utc() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text().splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        env[k.replace("export ", "").strip()] = v.strip().strip("'\"")
    return env


def endpoint_meta(dsn: str) -> dict:
    p = urlparse(dsn)
    q = parse_qs(p.query)
    host = p.hostname or ""
    region = next((x for x in host.split(".") if re.fullmatch(r"[a-z]{2}-[a-z]+-\d", x)), None)
    endpoint = host.split(".")[0].replace("-pooler", "") if host else ""
    suffix = ".".join(host.split(".")[1:]) if "." in host else host
    return {
        "endpoint_id_hash": sha(endpoint)[:12] if endpoint else None,
        "sanitized_host": "<endpoint>." + suffix if suffix else "<endpoint>",
        "region_hint_from_hostname": region,
        "sslmode": (q.get("sslmode") or [None])[0],
        "channel_binding": (q.get("channel_binding") or [None])[0],
        "pooler": bool(host.split(".")[0].endswith("-pooler")) if host else None,
    }


def api_control_plane(env: dict[str, str], dbmeta: dict) -> dict:
    result = {
        "credential_present": bool(env.get("NEON_API_KEY")),
        "executed": False,
        "observed": False,
        "matched_project_found": False,
        "account_identity_state": "UNKNOWN",
        "project_identity_state": "UNKNOWN",
        "branch_identity_state": "UNKNOWN",
        "region": "UNKNOWN",
        "calls": {},
    }
    if not env.get("NEON_API_KEY"):
        result["account_identity_state"] = "BLOCKED_CREDENTIAL_ABSENT"
        return result
    try:
        import requests
        base = "https://console.neon.tech/api/v2"
        headers = {"Authorization": "Bearer " + env["NEON_API_KEY"], "Accept": "application/json"}

        def get(path: str, **params):
            r = requests.get(base + path, headers=headers, params=params, timeout=30)
            return r

        org = get("/users/me/organizations")
        orgs = org.json().get("organizations", []) if org.status_code == 200 else []
        result["calls"]["organizations"] = {"status": org.status_code, "count": len(orgs)}
        projects = []
        for o in orgs or [None]:
            params = {"limit": 100}
            if o:
                params["org_id"] = o["id"]
            pr = get("/projects", **params)
            result["calls"]["projects"] = {
                "status": pr.status_code,
                "count": len(pr.json().get("projects", [])) if pr.status_code == 200 else None,
            }
            if pr.status_code == 200:
                projects.extend(pr.json().get("projects", []))
        result["executed"] = True
        endpoint_hash = dbmeta.get("endpoint_id_hash")
        match = None
        matched_ep = None
        endpoint_hashes = []
        endpoint_calls = []
        for project in projects:
            eps = get(f"/projects/{project['id']}/endpoints")
            listed = eps.json().get("endpoints", []) if eps.status_code == 200 else []
            endpoint_calls.append({"status": eps.status_code, "count": len(listed)})
            if eps.status_code != 200:
                continue
            for ep in listed:
                ehash = sha(str(ep.get("id", "")).replace("-pooler", ""))[:12]
                endpoint_hashes.append(ehash)
                if ehash == endpoint_hash:
                    match, matched_ep = project, ep
                    break
            if match:
                break
        result["calls"]["endpoints"] = endpoint_calls
        result["control_plane_endpoint_id_hashes"] = sorted(set(endpoint_hashes))
        if match and matched_ep:
            branches_r = get(f"/projects/{match['id']}/branches")
            branches = branches_r.json().get("branches", []) if branches_r.status_code == 200 else []
            branch = next((b for b in branches if b.get("id") == matched_ep.get("branch_id")), None)
            result.update(
                observed=True,
                matched_project_found=True,
                account_identity_state="OBSERVED_CONTROL_PLANE_ACCESS",
                project_identity_state="OBSERVED_MATCHED_TO_DATABASE_ENDPOINT",
                branch_identity_state="OBSERVED" if branch else "PARTIAL",
                project_id_hash=sha(match["id"])[:12],
                branch_id_hash=sha(branch["id"])[:12] if branch else None,
                region=match.get("region_id") or dbmeta.get("region_hint_from_hostname") or "UNKNOWN",
                pg_version=match.get("pg_version"),
                branch_count=len(branches),
                history_retention_seconds=match.get("history_retention_seconds", "UNKNOWN"),
            )
        else:
            result["account_identity_state"] = "PARTIAL_CONTROL_PLANE_ACCESS"
            result["project_identity_state"] = "NOT_MATCHED"
            result["branch_identity_state"] = "NOT_MATCHED"
    except Exception as e:
        result["executed"] = True
        result["error_class"] = type(e).__name__
    return result


def db_qualification(env: dict[str, str]) -> dict:
    import psycopg2

    dsn = env["DATABASE_URL"]
    meta = endpoint_meta(dsn)
    controlled = {
        "subject": "CONTROLLED_TEST_PATIENT_001",
        "diagnosis_code": "TEST_ONLY",
        "medication": "TEST_ONLY",
        "value": "TEST_ONLY",
    }
    source_sha = sha(canon(controlled))
    canary = "BAYMAX_PHI_SHAPED_CANARY_" + uuid.uuid4().hex
    canary_sha = sha(canary)
    row_id = uuid.uuid4().hex
    schema = "baymax_hipaa_probe_" + uuid.uuid4().hex[:10]
    result = {
        "source_fco": {
            "type": "ControlledHealthSourceFCO",
            "source_class": "CONTROLLED_SYNTHETIC_PHI_SHAPED",
            "contains_real_phi": False,
            "source_sha256": source_sha,
        },
        "sponsor_qualification_fco": {
            "type": "SponsorQualificationFCO",
            "sponsor": "Neon",
            "service": "Postgres",
            "credential_present": True,
            "sdk_present": True,
            "implemented": True,
            "executed": False,
            "observed": False,
            "baa_present": "BLOCKED_HUMAN_VERIFICATION",
            "baa_scope": "UNKNOWN",
            "hipaa_feature_state": "UNKNOWN",
            "dpa_state": "UNKNOWN",
            "database_at_rest_encryption": "UNKNOWN_ACCOUNT_SPECIFIC",
            "application_level_payload_encryption": "NOT_IMPLEMENTED",
            "audit_logging_state": "UNKNOWN",
            "log_export_state": "UNKNOWN",
            "backup_state": "UNKNOWN",
            "pitr_state": "UNKNOWN",
            "retention_state": "UNKNOWN",
            "training_use_state": "UNKNOWN",
            "subprocessor_state": "UNKNOWN",
        },
        "endpoint": meta,
        "controlled_source_class": "CONTROLLED_SYNTHETIC_PHI_SHAPED",
        "real_phi": "BLOCKED",
        "application_level_payload_encryption": "NOT_IMPLEMENTED",
        "canary_sha256": canary_sha,
        "canary_plaintext_recorded": False,
        "request_identity": sha(canon({"operation": "controlled_roundtrip_v1", "source_sha256": source_sha})),
        "row_identity_hash": sha(row_id)[:16],
        "logical_deletion": "NOT_EXECUTED",
        "schema_cleanup": "NOT_EXECUTED",
        "database_activity_canary_test": "NOT_EXECUTED",
    }

    c = psycopg2.connect(dsn, connect_timeout=20)
    c.autocommit = True
    cur = c.cursor()
    result["sponsor_qualification_fco"]["executed"] = True

    cur.execute("select version(), current_database(), current_user")
    version, dbname, user = cur.fetchone()
    result["database_identity"] = {
        "server_product": version.split(" on ")[0],
        "database_name_hash": sha(dbname)[:12],
        "role_name_hash": sha(user)[:12],
    }

    cur.execute(
        """select ssl, version, cipher, bits
           from pg_stat_ssl where pid=pg_backend_pid()"""
    )
    sslrow = cur.fetchone()
    primary_ssl = bool(getattr(c.info, "ssl_in_use", False))
    result["transport_encryption"] = {
        "pooled_or_primary": {
            "pg_stat_ssl_observed": bool(sslrow),
            "pg_stat_ssl_ssl": bool(sslrow and sslrow[0]),
            "protocol": sslrow[1] if sslrow else None,
            "cipher": sslrow[2] if sslrow else None,
            "bits": sslrow[3] if sslrow else None,
            "libpq_ssl_in_use": primary_ssl,
            "dsn_sslmode": meta.get("sslmode"),
            "dsn_channel_binding": meta.get("channel_binding"),
            "pooler": meta.get("pooler"),
        },
        "peer_identity_verification": "UNKNOWN_SSLMODE_REQUIRE_NOT_VERIFY_FULL",
    }
    unpooled_ok = None
    if env.get("DATABASE_URL_UNPOOLED"):
        cu = psycopg2.connect(env["DATABASE_URL_UNPOOLED"], connect_timeout=20)
        cu.autocommit = True
        uu = cu.cursor()
        uu.execute("""select ssl, version, cipher, bits
                      from pg_stat_ssl where pid=pg_backend_pid()""")
        ussl = uu.fetchone()
        unpooled_ok = bool(getattr(cu.info, "ssl_in_use", False))
        result["transport_encryption"]["unpooled"] = {
            "pg_stat_ssl_observed": bool(ussl),
            "pg_stat_ssl_ssl": bool(ussl and ussl[0]),
            "protocol": ussl[1] if ussl else None,
            "cipher": ussl[2] if ussl else None,
            "bits": ussl[3] if ussl else None,
            "libpq_ssl_in_use": unpooled_ok,
            "endpoint": endpoint_meta(env["DATABASE_URL_UNPOOLED"]),
        }
        cu.close()
    if primary_ssl and (unpooled_ok is not False):
        result["sponsor_qualification_fco"]["tls_in_transit"] = "PASS_ENCRYPTED_CHANNEL_OBSERVED"
    else:
        result["sponsor_qualification_fco"]["tls_in_transit"] = "FAIL"

    cur.execute(
        """select rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
           from pg_roles where rolname=current_user"""
    )
    flags = cur.fetchone()
    result["rbac_observation"] = dict(
        zip(["rolsuper", "rolcreaterole", "rolcreatedb", "rolreplication", "rolbypassrls"], flags)
    )
    privileged = any(bool(x) for x in flags)
    result["sponsor_qualification_fco"]["rbac_state"] = (
        "RISK_PRIVILEGED_ROLE" if privileged else "PASS_CURRENT_ROLE_NONPRIVILEGED"
    )

    try:
        cur.execute("select exists(select 1 from pg_extension where extname='pg_stat_statements')")
        result["pg_stat_statements_installed"] = bool(cur.fetchone()[0])
    except Exception:
        result["pg_stat_statements_installed"] = "UNKNOWN"

    cur.execute(f"create schema {schema}")
    cur.execute(
        f"""create table {schema}.controlled_health (
            row_id text primary key,
            payload jsonb not null,
            payload_sha256 text not null,
            marker text not null,
            created_at timestamptz not null default now()
        )"""
    )
    cur.execute(
        f"insert into {schema}.controlled_health(row_id,payload,payload_sha256,marker) values (%s,%s::jsonb,%s,%s)",
        (row_id, json.dumps(controlled), source_sha, canary),
    )
    cur.execute(f"select payload,payload_sha256 from {schema}.controlled_health where row_id=%s", (row_id,))
    got, got_sha = cur.fetchone()
    read_sha = sha(canon(got))
    result["response_identity"] = read_sha
    result["readback_identity_match"] = read_sha == source_sha == got_sha

    successor = dict(controlled)
    successor["value"] = "TEST_ONLY_UPDATED"
    successor_sha = sha(canon(successor))
    cur.execute(
        f"update {schema}.controlled_health set payload=%s::jsonb,payload_sha256=%s where row_id=%s",
        (json.dumps(successor), successor_sha, row_id),
    )
    cur.execute(f"select payload_sha256 from {schema}.controlled_health where row_id=%s", (row_id,))
    result["successor_fco"] = {
        "type": "ControlledHealthSourceFCO",
        "predecessor_source_sha256": source_sha,
        "source_sha256": cur.fetchone()[0],
        "state": "OBSERVED_SUCCESSOR",
    }

    leak = {"pg_stat_activity_visible": "UNKNOWN", "canary_visible": "UNKNOWN"}
    blocker_ready = threading.Event()
    blocker_pid = {}

    def hold_query():
        cx = psycopg2.connect(dsn, connect_timeout=20)
        cx.autocommit = True
        q = cx.cursor()
        q.execute("select pg_backend_pid()")
        blocker_pid["pid"] = q.fetchone()[0]
        blocker_ready.set()
        q.execute("select %s::text as controlled_marker, pg_sleep(2)", (canary,))
        q.fetchone()
        cx.close()

    t = threading.Thread(target=hold_query)
    t.start()
    blocker_ready.wait(timeout=5)
    time.sleep(0.35)
    if blocker_pid.get("pid"):
        cur.execute("select query from pg_stat_activity where pid=%s", (blocker_pid["pid"],))
        qr = cur.fetchone()
        if qr:
            leak["pg_stat_activity_visible"] = True
            leak["canary_visible"] = canary in (qr[0] or "")
    t.join(timeout=5)
    result["database_activity_canary_test"] = leak

    cur.execute(f"delete from {schema}.controlled_health where row_id=%s", (row_id,))
    cur.execute(f"select count(*) from {schema}.controlled_health where row_id=%s", (row_id,))
    result["logical_deletion"] = "PASS_OBSERVED" if cur.fetchone()[0] == 0 else "FAIL"
    cur.execute(f"drop schema {schema} cascade")
    cur.execute("select count(*) from information_schema.schemata where schema_name=%s", (schema,))
    result["schema_cleanup"] = "PASS_OBSERVED" if cur.fetchone()[0] == 0 else "FAIL"
    c.close()

    result["sponsor_qualification_fco"]["deletion_state"] = result["logical_deletion"]
    result["sponsor_qualification_fco"]["observed"] = bool(result["readback_identity_match"])
    canary_visible = result["database_activity_canary_test"].get("canary_visible")
    if (
        result["sponsor_qualification_fco"]["tls_in_transit"] == "FAIL"
        or canary_visible is True
        or result["logical_deletion"] != "PASS_OBSERVED"
        or not result["readback_identity_match"]
    ):
        result["sponsor_qualification_fco"]["result"] = "FAIL"
    else:
        result["sponsor_qualification_fco"]["result"] = "PARTIAL"
    return result


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--env-file", required=True)
    args = ap.parse_args()
    env_path = Path(args.env_file).expanduser().resolve()
    env = load_env(env_path)
    required = ["DATABASE_URL"]
    missing = [x for x in required if not env.get(x)]
    if missing:
        raise SystemExit("BLOCKED_CREDENTIAL_ABSENT:" + ",".join(missing))

    start = utc()
    db = db_qualification(env)
    control = api_control_plane(env, db["endpoint"])
    db["control_plane"] = control
    db["sponsor_qualification_fco"]["account_identity_state"] = control["account_identity_state"]
    db["sponsor_qualification_fco"]["project_identity_state"] = control["project_identity_state"]
    db["sponsor_qualification_fco"]["branch_identity_state"] = control["branch_identity_state"]
    db["sponsor_qualification_fco"]["region"] = control["region"]
    db["sponsor_qualification_fco"]["request_identity"] = db["request_identity"]
    db["sponsor_qualification_fco"]["response_identity"] = db["response_identity"]
    db["sponsor_qualification_fco"]["receipt"] = str(OUT.relative_to(ROOT))

    compensatory = [
        {
            "type": "CompensatoryControlFCO",
            "missing_control": "APPLICATION_LEVEL_PAYLOAD_ENCRYPTION",
            "risk": "database/provider can process plaintext controlled health-shaped fields",
            "compensating_control": "REAL_PHI_EXTERNAL=BLOCK; controlled synthetic PHI-shaped tests only",
            "residual_risk": "production sensitive-plane design remains incomplete",
            "claim_ceiling": "No claim of application-level encrypted vault",
            "result": "ACTIVE",
        },
        {
            "type": "CompensatoryControlFCO",
            "missing_control": "VERIFIED_BAA",
            "risk": "contractual PHI processing authority unestablished",
            "compensating_control": "REAL_PHI_EXTERNAL=BLOCK",
            "residual_risk": "account may be technically reachable but is not admitted for real PHI",
            "claim_ceiling": "HIPAA_COMPLIANCE=NOT_VERIFIED",
            "result": "ACTIVE",
        },
        {
            "type": "CompensatoryControlFCO",
            "missing_control": "COMPLETE_LOG_TRACE_INSPECTION",
            "risk": "provider-side logs/traces may retain sensitive values",
            "compensating_control": "controlled canary only; no real PHI; fail closed for PHI",
            "residual_risk": "Neon platform log surfaces not fully inspected",
            "claim_ceiling": "LOG_LEAK_TEST=PARTIAL unless all provider logs become inspectable",
            "result": "ACTIVE",
        },
    ]

    receipt = {
        "schema": "baymax.hipaa_neon_qualification.v1",
        "observed_at_start": start,
        "observed_at_end": utc(),
        "source_class": "CONTROLLED_SYNTHETIC_PHI_SHAPED",
        "real_phi": "BLOCKED",
        "hipaa_compliance": "NOT_VERIFIED",
        "database": db,
        "compensatory_controls": compensatory,
        "claim_ceiling": (
            "This exact configured Neon database endpoint executed the defined controlled synthetic "
            "PHI-shaped technical qualification steps. This does not establish HIPAA compliance, "
            "a signed BAA, application-level encryption, provider-log nonretention, backup purge, "
            "or organizational/operational readiness."
        ),
    }

    # Never persist secrets or the plaintext canary. Verify the generated receipt does not contain either.
    text = json.dumps(receipt, indent=2, sort_keys=True) + "\n"
    secret_keys = re.compile(r"(KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL|PGPASSWORD|CREDENTIAL)", re.I)
    secrets = [v for k, v in env.items() if secret_keys.search(k) and len(v) >= 8]
    if any(s in text for s in secrets):
        raise SystemExit("SECRET_LEAK_GUARD=FAIL")
    if "BAYMAX_PHI_SHAPED_CANARY_" in text:
        raise SystemExit("CANARY_LEAK_GUARD=FAIL")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text)

    print("QUALIFICATION_RESULT=" + db["sponsor_qualification_fco"]["result"])
    print("CONTROLLED_SOURCE_CLASS=CONTROLLED_SYNTHETIC_PHI_SHAPED")
    print("REAL_PHI=BLOCKED")
    print("TLS_IN_TRANSIT=" + str(db["sponsor_qualification_fco"]["tls_in_transit"]))
    print("APPLICATION_LEVEL_ENCRYPTION=NOT_IMPLEMENTED")
    print("BAA_PRESENT=BLOCKED_HUMAN_VERIFICATION")
    print("CONTROL_PLANE_PROJECT=" + str(control["project_identity_state"]))
    print("LOGICAL_DELETION=" + str(db["logical_deletion"]))
    print("CANARY_IN_PG_STAT_ACTIVITY=" + str(db["database_activity_canary_test"]["canary_visible"]))
    print("RECEIPT_SHA256=" + sha(OUT.read_bytes()))
    print("RECEIPT=" + str(OUT.relative_to(ROOT)))


if __name__ == "__main__":
    main()

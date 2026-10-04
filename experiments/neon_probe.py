"""Neon lane probe. SYNTHETIC DATA ONLY. Loads .env in memory; never prints/records credential values.
Every string leaving this process passes through scrub(). One receipt per technology lane."""
import hashlib, json, os, re, subprocess, sys, time, uuid
from urllib.parse import urlparse
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = {}
for l in open(os.path.join(ROOT, ".env")):
    l = l.strip()
    if l and not l.startswith("#") and "=" in l:
        k, v = l.split("=", 1); ENV[k.replace("export ", "").strip()] = v.strip().strip("'\"")
SECRETS = sorted({v for v in ENV.values() if len(v) >= 6}, key=len, reverse=True)
def scrub(t):
    t = str(t)
    for s in SECRETS: t = t.replace(s, "<REDACTED>")
    t = re.sub(r"(postgres(ql)?://)[^\s'\"]+", r"\1<REDACTED>", t); t = re.sub(r"nt_live_[A-Za-z0-9_\-]+", "<REDACTED>", t)
    return t
def host_class(u):  # sanitized endpoint: replace first (branch-id) label
    h = urlparse(u).hostname or ""; p = h.split("."); return ".".join(["<branch-id>"] + p[1:]) if len(p) > 2 else h
def sha(b): return hashlib.sha256(b if isinstance(b, bytes) else b.encode()).hexdigest()
def blob(ref):
    r = subprocess.run(["git", "rev-parse", ref], cwd=ROOT, capture_output=True, text=True); return r.stdout.strip() or None
def now(): return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
NAMES_ALL = ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "NEON_BRANCH", "NEON_AUTH_BASE_URL", "NEON_AUTH_JWKS_URL", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_ENDPOINT_URL_S3", "AWS_REGION", "NEON_AI_GATEWAY_TOKEN", "NEON_AI_GATEWAY_BASE_URL", "NEON_API_KEY"]
def presence(names): return {n: ("PRESENT" if ENV.get(n) else "ABSENT_OR_EMPTY") for n in names}
UP = {"neon.ts_blob": blob("upstream/main:neon.ts"), "package-lock_blob": blob("upstream/main:package-lock.json"), "package.json_blob": blob("upstream/main:package.json"), "upstream_main_commit": blob("upstream/main")}
def base(lane, tags, cap, sdk, sdk_ver, names, cli_ver=None, endpoint=None):
    return {"schema": "baymax.technology_receipt.v1", "technology_id": lane, "tags": tags, "capability": cap, "observed_at": now(), "sdk": sdk, "sdk_version": sdk_ver, "cli_version": cli_ver,
            "sdk_present": sdk_ver is not None, "config_file_identities": {"upstream_neon.ts_git_blob": UP["neon.ts_blob"]}, "lockfile_identity": {"upstream_package-lock_git_blob": UP["package-lock_blob"], "note": "upstream lockfile contains 0 '@neon' entries"},
            "source_commit": UP["upstream_main_commit"], "env_var_names": names, "credential_presence": presence(names), "sanitized_endpoint": endpoint,
            "implemented": True, "executed": False, "observed": False, "result": "NOT_RUN", "claim_ceiling": "", "phi": "none; synthetic data only"}
def out(name, rec):
    s = scrub(json.dumps(rec, indent=2, sort_keys=True)); assert not any(x in s for x in SECRETS), "SECRET LEAK GUARD"
    open(os.path.join(ROOT, "evidence/receipts/neon", name + ".json"), "w").write(s + "\n")
    print(f'{name}: result={rec["result"]} executed={rec["executed"]} observed={rec["observed"]}')
def fail(rec, e, where):
    rec["executed"] = True; rec["result"] = "FAIL"; rec["error_classification"] = f"{where}:{type(e).__name__}"; rec["sanitized_error"] = scrub(e)[:400]; rec["FAILED_ATTEMPT"] = True; return rec

def probe_control_plane():
    r = base("NEON_CONTROL_PLANE", ["NEON", "CONTROL_PLANE"], "project/branch identity via CLI/API", "neon CLI", None, ["NEON_API_KEY"])
    v = subprocess.run(["neon", "--version"], capture_output=True, text=True).stdout.strip(); r["cli_version"] = v; r["sdk_present"] = bool(v); r["executed"] = True
    if not ENV.get("NEON_API_KEY"): r.update(result="BLOCKED", error_classification="BLOCKED_CREDENTIAL_EMPTY:NEON_API_KEY", claim_ceiling="CLI present only; no authenticated control-plane call made; project/branch/region identity UNKNOWN")
    out("neon_control_plane", r)

def probe_postgres():
    import psycopg2; r = base("NEON_POSTGRES", ["NEON", "POSTGRES"], "connect, isolated schema, insert, readback, cleanup", "psycopg2", psycopg2.__version__.split()[0], ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "NEON_BRANCH"], endpoint=host_class(ENV.get("DATABASE_URL", "")))
    sch = "baymax_probe_" + uuid.uuid4().hex[:8]; row = {"probe_id": uuid.uuid4().hex, "label": "SYNTHETIC baymax probe row", "n": 7}; rh = sha(json.dumps(row, sort_keys=True))
    r["synthetic_request_identity"] = {"schema": sch, "row_sha256": rh}; steps = {}
    try:
        t = time.perf_counter(); c = psycopg2.connect(ENV["DATABASE_URL"], connect_timeout=20); c.autocommit = True; cur = c.cursor()
        cur.execute("select version(), current_setting('server_version'), now()"); v = cur.fetchone(); steps["connect"] = "OK"; r["server_version"] = v[1]; r["server_product"] = v[0].split(" on ")[0][:40]
        cur.execute(f"create schema {sch}"); cur.execute(f"create table {sch}.probe (probe_id text primary key, payload jsonb not null)"); steps["create_schema_table"] = "OK"
        cur.execute(f"insert into {sch}.probe values (%s, %s::jsonb)", (row["probe_id"], json.dumps(row))); steps["insert"] = "OK"
        cur.execute(f"select payload from {sch}.probe where probe_id=%s", (row["probe_id"],)); got = cur.fetchone()[0]; steps["readback_identity_match"] = sha(json.dumps(got, sort_keys=True)) == rh
        r["sanitized_response_identity"] = {"readback_sha256": sha(json.dumps(got, sort_keys=True))}
        cur.execute(f"drop schema {sch} cascade"); cur.execute("select count(*) from information_schema.schemata where schema_name=%s", (sch,)); steps["cleanup_schema_gone"] = cur.fetchone()[0] == 0
        # unpooled path identity check
        c2 = psycopg2.connect(ENV["DATABASE_URL_UNPOOLED"], connect_timeout=20); cu = c2.cursor(); cu.execute("select 1"); steps["unpooled_connect"] = cu.fetchone()[0] == 1; c2.close(); c.close()
        r["latency_s_total"] = round(time.perf_counter() - t, 3); r["steps"] = steps; r["executed"] = True; r["observed"] = all(v is True or v == "OK" for v in steps.values())
        r["result"] = "PASS" if r["observed"] else "PARTIAL"; r["claim_ceiling"] = "Synthetic round-trip on the project's default database only. Not a compliance statement; Postgres is not the canonical private-health store."
    except Exception as e:
        r["steps"] = steps; fail(r, e, "postgres")
        try: c = psycopg2.connect(ENV["DATABASE_URL"], connect_timeout=20); c.autocommit = True; c.cursor().execute(f"drop schema if exists {sch} cascade"); r["cleanup_after_failure"] = "attempted"
        except Exception: r["cleanup_after_failure"] = "could_not_confirm"
    out("neon_postgres", r)

def probe_auth():
    import requests; r = base("NEON_AUTH", ["NEON", "AUTH"], "managed auth service provisioned? (public JWKS only; no accounts created)", "requests", requests.__version__, ["NEON_AUTH_BASE_URL", "NEON_AUTH_JWKS_URL"], endpoint=host_class(ENV.get("NEON_AUTH_JWKS_URL", "")))
    r["gates"] = {"CONFIG_DECLARED": "upstream neon.ts declares auth:true (upstream/main, not admitted to this branch)", "SDK_PRESENT": False, "SERVICE_PROVISIONED": None, "EXECUTED": False, "OBSERVED": False}
    try:
        t = time.perf_counter(); resp = requests.get(ENV["NEON_AUTH_JWKS_URL"], timeout=20); r["http_status"] = resp.status_code; r["latency_s"] = round(time.perf_counter() - t, 3); r["executed"] = True
        body = resp.content; r["sanitized_response_identity"] = {"body_sha256": sha(body), "bytes": len(body)}; r["vendor_request_id"] = resp.headers.get("x-request-id") or resp.headers.get("cf-ray")
        ks = resp.json().get("keys", []) if resp.status_code == 200 else []; r["jwks"] = {"key_count": len(ks), "algs": sorted({k.get("alg") or k.get("crv") for k in ks}), "kty": sorted({k.get("kty") for k in ks}), "has_kid": all("kid" in k for k in ks)}
        r["gates"]["SERVICE_PROVISIONED"] = len(ks) > 0; r["gates"]["EXECUTED"] = True; r["gates"]["OBSERVED"] = len(ks) > 0; r["observed"] = len(ks) > 0
        r["result"] = "PARTIAL" if ks else "FAIL"; r["claim_ceiling"] = "JWKS endpoint serves signing keys => auth service provisioned. No sign-up/sign-in/token-verification flow executed; no app integration; SDK absent."
    except Exception as e: fail(r, e, "auth_jwks")
    out("neon_auth", r)

def probe_gateway():
    import requests; B = ENV.get("NEON_AI_GATEWAY_BASE_URL", "").rstrip("/"); H = {"Authorization": "Bearer " + ENV.get("NEON_AI_GATEWAY_TOKEN", "")}
    r = base("NEON_AI_GATEWAY", ["NEON", "AI_GATEWAY"], "live model catalog + minimal synthetic inference", "requests", requests.__version__, ["NEON_AI_GATEWAY_BASE_URL", "NEON_AI_GATEWAY_TOKEN"], endpoint=host_class(B) + "/v1")
    r["execution_substrate"] = "neon_ai_gateway (EXTERNAL cloud inference; NOT local Liquid)"; r["catalog"] = {}
    try:
        t = time.perf_counter(); m = requests.get(B + "/v1/models", headers=H, timeout=30); r["catalog"] = {"http_status": m.status_code, "latency_s": round(time.perf_counter() - t, 3), "request_id": m.headers.get("x-request-id")}
        ids = sorted(x["id"] for x in m.json().get("data", [])) if m.status_code == 200 else []; r["catalog"]["count"] = len(ids); r["catalog"]["ids"] = ids; r["catalog"]["response_sha256"] = sha(m.content)
        pick = next((i for pat in ("qwen", "mistral", "llama", "mini", "haiku", "flash") for i in ids if pat in i.lower()), ids[0] if ids else None); r["selected_model"] = pick
        if not pick: raise RuntimeError("empty catalog")
        sys.path.insert(0, os.path.join(ROOT, "experiments")); import model_experiment as M
        body = {"model": pick, "messages": [{"role": "system", "content": M.ROUTE_SYS}, {"role": "user", "content": M.ROUTE_USER}], "temperature": 0, "max_tokens": 300}
        rb = json.dumps(body, sort_keys=True); t = time.perf_counter(); x = requests.post(B + "/v1/chat/completions", headers=dict(H, **{"Content-Type": "application/json"}), data=rb, timeout=120); lat = time.perf_counter() - t
        r["synthetic_request_identity"] = {"request_sha256": sha(rb), "prompt_version": M.PROMPT_VERSION, "task": "same synthetic routing task as local BP-0006 testA"}
        r["http_status"] = x.status_code; r["latency_s"] = round(lat, 3); r["vendor_request_id"] = x.headers.get("x-request-id") or x.headers.get("x-databricks-request-id"); r["executed"] = True
        if x.status_code != 200: raise RuntimeError(f"HTTP {x.status_code}: {x.text[:200]}")
        j = x.json(); txt = j["choices"][0]["message"]["content"] or ""; r["response_model_field"] = j.get("model"); r["usage"] = j.get("usage"); r["sanitized_response_identity"] = {"content_sha256": sha(txt), "raw_body_sha256": sha(x.content)}
        m2 = re.search(r"\{.*\}", txt, re.S); p = None
        try: p = json.loads(m2.group(0)) if m2 else None
        except Exception: pass
        r["semantic_check"] = {"parsed": p is not None, "all_match": bool(p) and all(p.get(k) == v for k, v in M.ROUTE_EXPECT.items()), "output_parsed": p}
        r["observed"] = True; r["result"] = "PASS" if r["semantic_check"]["all_match"] else "PARTIAL"
        r["claim_ceiling"] = "Gateway reachable, catalog listed, one inference executed. HTTP 200 != correctness; semantic check is the only correctness signal. Single sample. External inference lane, never a substitute for local Liquid. Synthetic prompt only."
    except Exception as e: fail(r, e, "ai_gateway")
    out("neon_ai_gateway", r)

def probe_storage():
    import boto3, botocore; from botocore.config import Config; import requests
    r = base("NEON_OBJECT_STORAGE", ["NEON", "OBJECT_STORAGE"], "bucket exists? PUT/GET/DELETE synthetic object; anonymous read denied?", "boto3", boto3.__version__, ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_ENDPOINT_URL_S3", "AWS_REGION"], endpoint=host_class(ENV.get("AWS_ENDPOINT_URL_S3", "")))
    BK = "medical-records"; key = f"baymax-probe/{uuid.uuid4().hex}.txt"; data = b"SYNTHETIC baymax probe object. Not a medical record.\n"; steps = {}
    r["synthetic_request_identity"] = {"bucket": BK, "key_prefix": "baymax-probe/", "object_sha256": sha(data)}
    try:
        s3 = boto3.client("s3", endpoint_url=ENV["AWS_ENDPOINT_URL_S3"], region_name=ENV["AWS_REGION"], aws_access_key_id=ENV["AWS_ACCESS_KEY_ID"], aws_secret_access_key=ENV["AWS_SECRET_ACCESS_KEY"], config=Config(s3={"addressing_style": "path"}, signature_version="s3v4", retries={"max_attempts": 1}))
        r["executed"] = True
        try: names = [b["Name"] for b in s3.list_buckets().get("Buckets", [])]; steps["list_buckets_count"] = len(names); steps["bucket_medical-records_exists"] = BK in names
        except botocore.exceptions.ClientError as e: steps["list_buckets"] = "ERR:" + e.response["Error"]["Code"]; names = None
        try: s3.head_bucket(Bucket=BK); steps["head_bucket"] = "OK"; exists = True
        except botocore.exceptions.ClientError as e: steps["head_bucket"] = "ERR:" + str(e.response["Error"]["Code"]); exists = False
        if not exists:
            r["result"] = "BLOCKED"; r["error_classification"] = "BUCKET_NOT_PRESENT_OR_NOT_ACCESSIBLE"; r["claim_ceiling"] = "Declared private bucket 'medical-records' not observed to exist/accessible. Did NOT create it (provisioning is a human/IaC decision). No PUT/GET/DELETE executed."
        else:
            put = s3.put_object(Bucket=BK, Key=key, Body=data, ContentType="text/plain"); steps["put"] = put["ResponseMetadata"]["HTTPStatusCode"]; r["vendor_request_id_put"] = put["ResponseMetadata"].get("RequestId")
            g = s3.get_object(Bucket=BK, Key=key)["Body"].read(); steps["get_identity_match"] = sha(g) == sha(data)
            try: a = requests.get(f"{ENV['AWS_ENDPOINT_URL_S3'].rstrip('/')}/{BK}/{key}", timeout=20); steps["anonymous_get_status"] = a.status_code
            except Exception as e: steps["anonymous_get_status"] = "ERR:" + type(e).__name__
            d = s3.delete_object(Bucket=BK, Key=key); steps["delete"] = d["ResponseMetadata"]["HTTPStatusCode"]
            try: s3.get_object(Bucket=BK, Key=key); steps["get_after_delete"] = "STILL_PRESENT"
            except botocore.exceptions.ClientError as e: steps["get_after_delete"] = "ERR:" + e.response["Error"]["Code"]
            r["sanitized_response_identity"] = {"get_sha256": sha(g)}; ok = steps["get_identity_match"] and steps["get_after_delete"].startswith("ERR:") and steps["anonymous_get_status"] in (401, 403)
            r["observed"] = True; r["result"] = "PASS" if ok else "PARTIAL"; r["claim_ceiling"] = "Synthetic object PUT/GET/DELETE round-trip and anonymous-read denial observed on one bucket. Private bucket != HIPAA compliance; no encryption/retention/audit review."
    except Exception as e: fail(r, e, "object_storage")
    r["steps"] = steps; out("neon_object_storage", r)

if __name__ == "__main__":
    for f in (probe_control_plane, probe_postgres, probe_auth, probe_gateway, probe_storage):
        try: f()
        except Exception as e: print(f.__name__, "HARNESS_ERROR", scrub(e)[:200])

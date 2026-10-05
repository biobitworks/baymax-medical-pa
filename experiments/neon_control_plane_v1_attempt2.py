"""Neon control-plane probe (read-only GETs + one CLI call). IDs recorded as short hashes only; no emails/names/keys."""
import json, os, subprocess, sys, time, hashlib, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import neon_probe as P, requests
API = "https://console.neon.tech/api/v2"; H = {"Authorization": "Bearer " + P.ENV["NEON_API_KEY"], "Accept": "application/json"}
hid = lambda x: hashlib.sha256(str(x).encode()).hexdigest()[:12]
def get(path, **q):
    t = time.perf_counter(); r = requests.get(API + path, headers=H, params=q, timeout=30); return r, round(time.perf_counter() - t, 3)
def main():
    r = P.base("NEON_CONTROL_PLANE", ["NEON", "CONTROL_PLANE"], "project/branch/endpoint identity + key-scope inference via REST and CLI", "requests+neon CLI", requests.__version__, ["NEON_API_KEY", "DATABASE_URL", "NEON_BRANCH"], endpoint="console.neon.tech/api/v2")
    r["cli_version"] = subprocess.run(["neon", "--version"], capture_output=True, text=True).stdout.strip(); r["executed"] = True; calls = {}
    try:
        m, lat = get("/users/me"); calls["GET /users/me"] = {"status": m.status_code, "latency_s": lat, "request_id": m.headers.get("x-neon-ret-request-id") or m.headers.get("x-request-id"), "body_sha256": P.sha(m.content)}
        calls["GET /users/me"]["error_code"] = (m.json().get("code") if m.status_code >= 400 else None)
        pl, lat = get("/projects", limit=100); calls["GET /projects"] = {"status": pl.status_code, "latency_s": lat, "body_sha256": P.sha(pl.content)}
        projs = pl.json().get("projects", []) if pl.status_code == 200 else []; calls["GET /projects"]["count"] = len(projs)
        if pl.status_code != 200: calls["GET /projects"]["error_code"] = pl.json().get("code"); calls["GET /projects"]["sanitized_message"] = P.scrub(pl.json().get("message", ""))[:160]
        ak, lat = get("/api_keys"); calls["GET /api_keys"] = {"status": ak.status_code, "latency_s": lat}
        if ak.status_code == 200: calls["GET /api_keys"]["key_count"] = len(ak.json())
        ep_host = (re.search(r"@([^/:?]+)", P.ENV.get("DATABASE_URL", "")) or [None, ""])[1].split(".")[0].replace("-pooler", ""); r["database_endpoint_id_hash"] = hid(ep_host)
        match = None
        for p in projs:
            e, _ = get(f"/projects/{p['id']}/endpoints")
            if e.status_code == 200 and any(x["id"] == ep_host for x in e.json().get("endpoints", [])): match = p; eps = e.json()["endpoints"]; break
        if match:
            b, _ = get(f"/projects/{match['id']}/branches"); brs = b.json().get("branches", []) if b.status_code == 200 else []
            ep = next(x for x in eps if x["id"] == ep_host); cur = next((x for x in brs if x["id"] == ep.get("branch_id")), None)
            r["matched_project"] = {"project_id_hash": hid(match["id"]), "region_id": match.get("region_id"), "pg_version": match.get("pg_version"), "branch_count": len(brs), "endpoint_type": ep.get("type"), "endpoint_state": ep.get("current_state"),
                "current_branch_id_hash": hid(cur["id"]) if cur else None, "current_branch_is_default": bool(cur and (cur.get("default") or cur.get("primary"))), "NEON_BRANCH_matches_current_branch_name_or_id": bool(cur and P.ENV.get("NEON_BRANCH") in (cur.get("name"), cur.get("id")))}
        r["matched_project_found"] = bool(match)
        # CLI auth check (key passed via environment, output scrubbed)
        env = dict(os.environ, NEON_API_KEY=P.ENV["NEON_API_KEY"]); c = subprocess.run(["neon", "me", "--output", "json"], capture_output=True, text=True, env=env, timeout=60)
        calls["neon me (CLI)"] = {"exit": c.returncode, "stdout_sha256": P.sha(c.stdout), "stderr_class": P.scrub(c.stderr)[:120] if c.returncode else None}
        # key-scope INFERENCE (labelled): user-level key can GET /users/me and list projects; project-scoped keys typically cannot
        me_ok, pj_ok = calls["GET /users/me"]["status"] == 200, calls["GET /projects"]["status"] == 200
        r["key_scope_inference"] = {"label": "INFERRED_NOT_AUTHORITATIVE", "users_me_ok": me_ok, "projects_list_ok": pj_ok, "api_keys_list_ok": ak.status_code == 200,
            "reading": ("account-wide/user-level key (broad: can enumerate projects)" if me_ok and pj_ok else "narrower scope or org/project-scoped key" if (me_ok or pj_ok) else "no read access shown"),
            "recommendation": "prefer a project-scoped key for automation; rotate this one if it is account-wide"}
        r["calls"] = calls; r["observed"] = bool(match); r["result"] = "PASS" if match and calls["GET /users/me"]["status"] in (200, 401, 403) and pj_ok else "PARTIAL"
        r["claim_ceiling"] = "Read-only control-plane identity observed. IDs hashed. Key scope is INFERRED from endpoint access, not read from an authoritative scope field. No mutation of Neon resources performed."
    except Exception as e: P.fail(r, e, "control_plane"); r["calls"] = calls
    P.out("neon_control_plane_attempt2", r)
    print(json.dumps({"calls": {k: {x: v[x] for x in v if x in ("status", "exit", "count", "error_code")} for k, v in calls.items()}, "matched": r.get("matched_project"), "scope": r.get("key_scope_inference", {}).get("reading")}, indent=1))
if __name__ == "__main__": main()

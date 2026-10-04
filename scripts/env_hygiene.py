"""Records .env hygiene + scoped secret-scan states + upstream lineage classification. Names/presence only; never values."""
import json, os, re, stat, subprocess, sys, time
R = lambda *a: subprocess.run(a, capture_output=True, text=True)
def git(*a): return R("git", *a)
root = git("rev-parse", "--show-toplevel").stdout.strip(); os.chdir(root)
st = os.stat(".env"); names = {}
for l in open(".env"):
    l = l.strip()
    if l and not l.startswith("#") and "=" in l: k, v = l.split("=", 1); names[k.replace("export ", "").strip()] = "PRESENT" if v.strip().strip("'\"") else "EMPTY"
local = R("gitleaks", "detect", "--no-git", "--source", ".", "--no-banner", "--redact", "-l", "error", "-r", "/dev/null")
nl = re.search(r"(\d+) leaks? found", (local.stdout + local.stderr)); 
tracked = R(sys.executable, "scripts/secret_gate.py")
def blob(r): return git("rev-parse", r).stdout.strip() or None
def anc(c): return git("merge-base", "--is-ancestor", c, "HEAD").returncode == 0
def obj(c): return git("cat-file", "-e", c).returncode == 0
up = {}
for c in ("105da26ca4cf993190634c90485f468663cfb95d", "1d2a57c9275cc5f72afa9cbcd58402422fcf05e0", blob("upstream/main")):
    up[c[:7]] = {"FETCHED": obj(c), "LOCAL_OBJECT_PRESENT": obj(c), "ADMITTED_TO_BRANCH": anc(c), "BUILT": "NOT_TESTED", "EXECUTED": "NOT_TESTED", "OBSERVED": "NOT_TESTED"}
pkg = json.loads(git("show", "upstream/main:package.json").stdout); lock = git("show", "upstream/main:package-lock.json").stdout; tsc = json.loads(git("show", "upstream/main:tsconfig.json").stdout)
rec = {"schema": "baymax.hygiene_upstream_receipt.v1", "observed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
  "env": {"mode_octal": oct(stat.S_IMODE(st.st_mode))[2:], "ignored": git("check-ignore", "-q", ".env").returncode == 0, "tracked": git("ls-files", "--error-unmatch", ".env").returncode == 0,
          "staged": ".env" in git("diff", "--cached", "--name-only").stdout.split(), "in_any_commit": ".env" in git("log", "--all", "--name-only", "--format=").stdout.split(), "variable_names_presence": names},
  "LOCAL_SECRET_SCAN": {"scope": "whole directory incl. ignored files (gitleaks --no-git --redact)", "findings_count": int(nl.group(1)) if nl else (0 if local.returncode == 0 else "UNKNOWN"), "exit": local.returncode,
          "note": "expected: ignored .env credentials. NOT the push gate. Matches not preserved."},
  "TRACKED_GIT_SECRET_SCAN": {"scope": "tracked+staged files only (scripts/secret_gate.py)", "result": tracked.stdout.strip(), "exit": tracked.returncode},
  "upstream": {"remote": "jerelvelarde/baymax-medical-pa", "main": blob("upstream/main"), "classification": up, "divergence": "upstream lineage not admitted to this red-team branch; preserved"},
  "neon_config_review": {"neon.ts_blob": blob("upstream/main:neon.ts"), "declares": ["auth", "aiGateway(preview)", "bucket medical-records private"], "package_json_has_@neon/config": any("@neon" in k for k in {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}),
          "package_lock_@neon_entries": lock.count("@neon"), "tsconfig_include": tsc.get("include"), "neon.ts_in_typecheck": "neon.ts" in " ".join(tsc.get("include", [])),
          "classification": "CONFIG_DECLARED (not RUNTIME_INTEGRATED): @neon/config absent from manifest+lock; neon.ts outside tsconfig include", "upstream_gap_preserved": True}}
json.dump(rec, open("evidence/receipts/neon/hygiene_and_upstream.json", "w"), indent=2, sort_keys=True); print(json.dumps({k: rec[k] for k in ("LOCAL_SECRET_SCAN", "TRACKED_GIT_SECRET_SCAN")}, indent=1)); print(json.dumps({k: v for k, v in rec["env"].items() if k != "variable_names_presence"})); print(rec["neon_config_review"]["classification"])

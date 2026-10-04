"""Secret gate over TRACKED+STAGED content only (never reads ignored files such as .env)."""
import subprocess, sys, tempfile, shutil, pathlib
files = subprocess.run(["git", "ls-files", "-c"], capture_output=True, text=True, check=True).stdout.splitlines()
d = pathlib.Path(tempfile.mkdtemp())
for f in files:
    p = pathlib.Path(f)
    if p.is_file() and not p.is_symlink(): (d / f).parent.mkdir(parents=True, exist_ok=True); shutil.copy(p, d / f)
r = subprocess.run(["gitleaks", "detect", "--no-git", "--source", str(d), "--no-banner", "-l", "error"], capture_output=True, text=True)
shutil.rmtree(d, ignore_errors=True); print(f"SECRET_GATE={'PASS' if r.returncode == 0 else 'FAIL'} files={len(files)}"); sys.exit(r.returncode)

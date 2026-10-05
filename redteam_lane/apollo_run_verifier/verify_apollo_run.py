#!/usr/bin/env python3
"""Red-team-lane verifier for an Apollo-on-iPhone offline run. SIDE LANE: never mints BAYMAX-BP-* ids.
usage: verify_apollo_run.py --recording FILE --response FILE --repo REPO --commit SHA --out receipt.json [--frames-every 5]
Checks (each reported separately; nothing is promoted):
  1. recording identity: sha256/bytes + ffprobe streams/duration/creation_time
  2. frame samples every N s: sha256 of each (frames themselves are NOT stored; review them visually)
  3. response bytes: sha256, and the REAL Swift ModelOutput.parse() from <commit> against that commit's frozen catalog
  4. packet/catalog identities from <commit>
Network/physical-device facts are NOT derivable here: they are recorded as 'REVIEW_FRAMES_MANUALLY' with the frame list."""
import argparse, hashlib, json, os, subprocess, sys, tempfile, time
ap = argparse.ArgumentParser(); [ap.add_argument(f, required=True) for f in ("--recording", "--response", "--repo", "--commit", "--out")]; ap.add_argument("--frames-every", type=int, default=5); a = ap.parse_args()
sha = lambda b: hashlib.sha256(b).hexdigest()
def run(*c, **k): return subprocess.run(list(c), capture_output=True, text=k.pop("text", True), **k)
def gitshow(path): return subprocess.run(["git", "-C", a.repo, "show", f"{a.commit}:{path}"], capture_output=True).stdout
rec = open(a.recording, "rb").read(); resp = open(a.response, "rb").read()
pr = json.loads(run("ffprobe", "-v", "error", "-show_entries", "format=duration,size,format_name:format_tags=creation_time:stream=codec_name,codec_type,width,height", "-of", "json", a.recording).stdout)
dur = float(pr["format"]["duration"]); tmp = tempfile.mkdtemp(); frames = []
for t in range(0, int(dur), a.frames_every):
    f = os.path.join(tmp, f"f{t}.png"); run("ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", a.recording, "-frames:v", "1", "-vf", "scale=414:-1", f)
    if os.path.exists(f): frames.append({"t_seconds": t, "frame_sha256": sha(open(f, "rb").read())})
swift = gitshow("ios/OfflineTravelDemo/ModelInference.swift"); cat = gitshow("fixtures/iphone/apollo_catalog_v2.json"); pk = gitshow("fixtures/iphone/apollo_context_packet_v2.txt")
open(os.path.join(tmp, "ModelInference.swift"), "wb").write(swift); open(os.path.join(tmp, "catalog.json"), "wb").write(cat)
here = os.path.dirname(os.path.abspath(__file__)); main = os.path.join(here, "..", "apollo_validator_attack", "v2_harness_main.swift")
cases = os.path.join(tmp, "cases.json"); json.dump([{"name": "SUBMITTED_RESPONSE", "text": resp.decode("utf-8", "replace")}], open(cases, "w"))
open(os.path.join(tmp, "main.swift"), "wb").write(open(main, "rb").read())  # top-level code requires the file be named main.swift
build = run("swiftc", "-O", "-o", os.path.join(tmp, "h"), os.path.join(tmp, "main.swift"), os.path.join(tmp, "ModelInference.swift"))
if build.returncode: verdict = {"state": "HARNESS_BUILD_FAILED", "stderr_tail": build.stderr[-300:]}
else:
    out = json.loads(run(os.path.join(tmp, "h"), os.path.join(tmp, "catalog.json"), cases).stdout); r = [x for x in out if x.get("name") == "SUBMITTED_RESPONSE"][0]
    verdict = {"state": "CONTRACT_" + ("PASS" if r["result"] == "ACCEPTED" else "FAIL"), "validator": "REAL Swift ModelOutput.parse from commit", "parsed_known_ids": r.get("known")}
R = {"schema": "baymax.redteam_lane.apollo_run_verification.v1", "observed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "lane": "SIDE_LANE_NO_CANONICAL_BP", "repo_commit_used": a.commit,
     "recording": {"sha256": sha(rec), "bytes": len(rec), "ffprobe": pr, "frames_sampled": frames, "network_and_device_state": "REVIEW_FRAMES_MANUALLY (airplane icon, Wi-Fi off, model label, response) - not machine-derivable", "reachability_probe": "NOT_EXECUTED"},
     "response": {"sha256": sha(resp), "bytes": len(resp), "bytes_source": "FILE SUPPLIED BY OPERATOR (verify it is the copied model output, not a transcription)", "contract": verdict},
     "frozen_inputs_at_commit": {"packet_v2_sha256": sha(pk), "catalog_v2_sha256": sha(cat), "ModelInference_swift_sha256": sha(swift)},
     "not_verified": ["destination packet bytes (clipboard/paste)", "exact Apollo version", "full model identity (UI truncates label)", "physical-device identity from bytes alone"], "claim_ceiling": "Identity of supplied files + contract check only. Human frame review is required for airplane-mode/physical-device claims."}
json.dump(R, open(a.out, "w"), indent=1); print(json.dumps({"recording_sha256": R["recording"]["sha256"][:16], "frames": len(frames), "response_sha256": R["response"]["sha256"][:16], "contract": verdict["state"]}))

# Baymax browser worker

This independent service reuses the MIT-licensed [OpenMuse browser worker](https://github.com/CopilotKit/openmuse) at revision `b06caad7005ac5b6d2b451752a3794a6ae1759c1` (`apps/worker`). The package lockfile, Dockerfile, and upstream documentation are preserved. Local changes to the upstream browser manager and HTTP server add cancellation and handoff settlement; the original MIT attribution is retained. [LICENSE](./LICENSE) carries the original MIT license and [UPSTREAM_README.md](./UPSTREAM_README.md) documents the upstream API, network controls, and limits. Baymax's bridge lives in `src/mastra/computer/browser.ts`. The reused network tests retain the same license/provenance.

## Local start

Use Node 22.17 or newer with TypeScript stripping support. From this directory:

```sh
npm ci
npx playwright install chromium
# Supply a private random WORKER_TOKEN of at least 32 characters in the environment.
# Keep this token server-side; use the same value for Baymax's worker credential.
WORKER_DATA_DIR=/absolute/private/browser-profiles npm start
```

The service binds to `127.0.0.1:8790` by default. `WORKER_HOST` and `WORKER_DATA_DIR` configure binding and persistent profile storage. Point Baymax's server worker URL to `http://127.0.0.1:8790`. Use a stable UUID for the configured Baymax session so closing/reopening retains its Chromium profile. The worker accepts public HTTP(S) destinations on ports 80/443 only; Chromium subrequests pass through the DNS-pinned proxy.

## Container

Build from this directory with `docker build -t baymax-browser-worker .`. Use a private profile volume, loopback host port, `--cap-drop=ALL`, `--security-opt=no-new-privileges`, `--read-only`, and a bounded `/tmp` tmpfs when starting the image. The upstream image runs as `pwuser` and includes matching Playwright/Chromium versions. Never mount the Docker socket or Baymax's other secrets into this service.

## Verification

```sh
npm run typecheck
# From Baymax repository root, without Chromium:
node --import tsx --test tests/computer-browser.test.ts tests/computer-network.test.ts
# From this directory, with Chromium installed (real public-web lifecycle):
node --experimental-strip-types --test tests/lifecycle.test.ts
```

Dependencies are intentionally independent of Baymax's root package and installed from this service's lockfile. Chromium has its own profile/data volume; it does not share terminal files or host files. See upstream documentation for persistence behavior and application-enforced network policy limits.

## Browser ownership handoff extension

The authenticated `POST /sessions/:id/settle` endpoint returns `{ "id": "<session UUID>", "settled": true, "generation": <positive integer> }` after advancing the session mutation generation, draining the global creation queue, and draining the session queue. Queued mutations from the previous generation or disconnected HTTP requests are rejected before dispatch. Requests capture their generation before streaming their body, so a delayed body cannot bypass the barrier. Baymax additionally prepares an immutable generation through authenticated `GET /sessions/:id/generation` before each mutation and sends it in `X-Browser-Mutation-Generation`. The worker checks this client generation at queued dispatch, rejecting old-owner requests even when their entire HTTP request arrives after settlement. Upstream callers without the header retain the receipt-time snapshot behavior; handoff-aware clients must send the header. A browser operation already dispatched must finish before acknowledgement; cancellation cannot undo clicks or navigation already sent to Chromium. Settlement preserves the open context and browser profile.

Baymax calls this server-only endpoint after cancelling and awaiting its local mutating jobs. A failed or timed-out acknowledgement keeps browser mutations blocked until a successful takeover retry. Direct worker callers must similarly stop submitting mutations while transferring ownership; this extension is a settlement barrier, not a worker authentication lease.

Deterministic HTTP/queue regression tests run without external destinations:

```sh
node --experimental-strip-types --test tests/settlement.test.ts
```

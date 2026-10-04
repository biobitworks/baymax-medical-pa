# Baymax Computer Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development for independent modules, then review and verify their integration.

Goal: Give Baymax a shared browser, isolated terminal, and persistent files, with a usable Computer screen.
Architecture: Mastra tools and private API routes share one computer service. A separately token-protected OpenMuse Chromium worker handles public web access. A hardened Docker Linux container handles offline commands and files. Access is granted by an expiring capability obtained with a configured private key.
Tech stack: TypeScript, Mastra, React, Docker, OpenMuse Chromium/Playwright worker and filesystem helper.

- [x] Vendor OpenMuse worker and Docker helpers at b06caad7005ac5b6d2b451752a3794a6ae1759c1 with MIT attribution.
- [x] Write failing unit tests for capability rejection/expiry, workspace paths, command receipts, isolation, and uncertain command outcomes; run node --import tsx --test tests/computer-*.test.ts.
- [x] Implement computer config/auth, argv-only Docker runner, service serialization/receipts, browser bridge and Mastra tools.
- [x] Add /computer API routes with capability validation, same-origin mutation checks, bounded bodies, no-store responses, and Vite proxy.
- [x] Add Computer screen with unlock, lifecycle controls, Browser/Terminal/Files tabs, explicit failures, and a chat tool receipt card.
- [x] Add runtime setup scripts, environment examples, Docker build/start instructions, attribution, and real smoke tests.
- [x] Run npm test, npm run build, npm run agent:build, browser tests, and Docker smoke when available. Fix any failures; review the diff; prepare the reviewed branch for a new PR.

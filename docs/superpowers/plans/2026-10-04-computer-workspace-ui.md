# Computer Workspace UI Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development for isolated UI and server work with a final integrated review.

Goal: Match the supplied visual references and make control handoff enforceable.
Architecture: Keep one ChatHub mounted; render it alongside Computer under a desktop grid, with a mobile view switch. Computer gets a cyan frame, dock and app window. A server control lease distinguishes UI capabilities from agent operations.
Tech stack: React, CSS, Mastra, TypeScript, Playwright.

- [x] Add server lease tests: user mutation rejected before takeover; agent mutation blocked during takeover; active agent command cancelled and awaited; lease expires; lock releases ownership; another capability cannot seize user control.
- [x] Implement src/mastra/computer/control.ts and integrate ComputerService.action actor enforcement. Add POST /computer/control with origin/capability checks, update tool instructions, and real smoke for takeover/return.
- [x] Update Computer.tsx/css to match frame/dock/window, unlocked welcome, accessible controls, status polling and lease renewal. Extend client endpoint allowlist.
- [x] Add desktop split chat/computer and mobile switch in main.tsx without remounting ChatHub. Apply scoped workspace styles; preserve every other app page.
- [x] Update UI fixtures/tests for takeover, return, keyboard navigation and mobile/desktop layout. Capture and inspect screenshots.
- [x] Run unit tests, TypeScript, frontend/agent builds, Playwright and real API smoke. Review integration and prepare the verified update for PR29.

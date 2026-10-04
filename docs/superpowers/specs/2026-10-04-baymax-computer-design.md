# Baymax’s computer

Give the existing Mastra agent a persistent browser and an isolated Linux terminal/files workspace, following OpenMuse’s MIT-licensed computer architecture. Preserve the current app and agent framework. Add a Computer view with Browser, Terminal, and Files tabs. The user and agent operate the same browser and volume.

Reuse the OpenMuse browser worker and audited Docker isolation/file helpers with attribution and an upstream revision. Browser destinations are limited to public HTTP(S), with proxy-level DNS/IP validation. Terminal commands run only in a nonroot, network-disabled Docker container, never a host shell; its named /workspace volume persists across stops. Commands have a 30-second timeout, capped output, serialized execution, and saved receipts. Failed/uncertain commands are never automatically replayed.

Enable access with server configuration and a private access key. Unlocking from the Computer view issues an expiring in-memory capability for API requests and Mastra request context, separate from model messages. Without that capability the agent cannot use any computer tool. Same-origin checks protect mutations. This remains the app’s current single-owner deployment; it does not introduce account authentication.

The Browser tab supports address navigation, screenshot refresh, pointer/keyboard/scroll control of the same session. The agent can navigate/read and operate that browser with screenshots. Terminal shows command receipts; Files lists directories and reads/writes UTF-8 text up to 256 KiB. UI displays disabled/unavailable/error states accurately. No host files or credentials are copied into the computer.

Verify access control, path and symlink boundaries, command timeout/isolation, worker network restrictions, tool integration, UI behavior, production builds, browser-worker smoke, and real Docker operations if an engine is available. Document setup and the limits of validation in the PR.

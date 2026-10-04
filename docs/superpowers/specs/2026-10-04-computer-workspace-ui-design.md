# Baymax Computer workspace UI

The user supplied two visual references: a side-by-side chat/computer layout and a close-up cyan computer frame with dock and control handoff. Implement those cues in the existing Baymax app, preserving its actual browser, terminal and file services.

On desktop, the same mounted chat sits left of the Computer workspace, with a narrow navigation rail. The computer pane has a tab-style heading, a large cyan rounded frame, a window for the selected app, and a floating Browser/Terminal/Files dock. A Baymax welcome screen appears when no browser page is open; no fake desktop apps or simulated live content. On mobile, the computer occupies the available width and chat is accessible in the same screen with a view switch.

Below the frame, control explicitly switches between Baymax and the user. The server blocks agent mutations while the user holds control and blocks user mutations until takeover. Takeover interrupts pending agent operations and waits for them to settle before reporting success. A five-minute lease is renewed while the user is active, expires after inactivity, and is released on lock. Watching still allows status, screenshots and read-only file/page inspection. Refresh shared browser previews periodically without disrupting typed addresses or file drafts. Maintain origin/capability enforcement and keyboard-accessible tabs.

Verify lease/cancellation and ownership on the server, then exercise actual desktop/mobile layout and control transitions with Playwright fixtures. Run full unit/build/agent checks and the real Docker/browser smoke test before updating PR29.

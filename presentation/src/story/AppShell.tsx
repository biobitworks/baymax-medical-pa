import React from "react";
import { MascotSprite } from "../demo/MascotSprite";
export function Face() {
  return <span className="story-face">●—●</span>;
}
export function AppShell({
  active,
  children,
  detail = "Jordan’s care space",
}: {
  active: string;
  children: React.ReactNode;
  detail?: string;
}) {
  return (
    <div className="story-app">
      <aside className="story-sidebar">
        <div className="story-brand">
          <Face />
          baymax<span>.</span>
        </div>
        <p className="story-eyebrow">YOUR HEALTH JOURNAL</p>
        <nav>
          {[
            "Today",
            "Talk",
            "Plan",
            "Activity",
            "Running",
            "Travel",
            "Doctor brief",
            "Computer",
          ].map((label, i) => (
            <div key={label} className={active === label ? "selected" : ""}>
              <span className="story-nav-icon">
                {["▦", "◯", "▤", "♡", "⌁", "↗", "▧", "▱"][i]}
              </span>
              {label}
              {label === "Talk" && <i />}
            </div>
          ))}
        </nav>
        <div className="story-sidebar-bottom">
          <p>
            On your side.
            <br />
            <em>Even when you forget.</em>
          </p>
          <small>Privacy & preferences</small>
          <div className="story-profile">
            <span>J</span>
            <div>
              Jordan Mercer<small>Your health profile</small>
            </div>
          </div>
        </div>
      </aside>
      <main className="story-app-main">
        <header className="story-app-header">
          <span>
            {active === "Talk" ? "Conversation" : active}
            <em> / {detail}</em>
          </span>
          <span className="story-save-state">
            ✓ Saving is on <span>♧</span>
          </span>
        </header>
        <div className="story-app-body">{children}</div>
        <footer className="story-app-footer">
          <span>Baymax · Your personal medical agent</span>
          <span>Illustrative session · Fictional records</span>
        </footer>
      </main>
    </div>
  );
}
export function Chat({
  prompt,
  typed,
  children,
  compact = false,
  scroll = 0,
}: {
  prompt: string;
  typed?: string;
  children?: React.ReactNode;
  compact?: boolean;
  scroll?: number;
}) {
  return (
    <div className={`story-chat ${compact ? "compact" : ""}`}>
      <div className="story-chat-scroll">
        <div
          className="story-chat-history"
          style={{ transform: `translateY(-${scroll}px)` }}
        >
          <div className="story-chat-date">TODAY</div>
          {!typed && (
            <div className="story-user-message">
              <span>{prompt}</span>
              <b>J</b>
            </div>
          )}
          {children && (
            <div className="story-assistant-message">
              <div className="story-assistant-label">
                <MascotSprite size={52} />
                <strong>Baymax</strong>
                <span>Personal medical agent</span>
              </div>
              {children}
            </div>
          )}
        </div>
      </div>
      <div className="story-composer">
        <span>{typed || "What else is on your mind?"}</span>
        <button aria-label="Send message">↑</button>
      </div>
      <p className="story-chat-footnote">
        Your context, kept together. You decide what happens next.
      </p>
    </div>
  );
}
export function ToolStatus({
  children,
  done = false,
}: {
  children: React.ReactNode;
  done?: boolean;
}) {
  return (
    <div className="story-tool">
      <span>{done ? "✓" : "◌"}</span>
      {children}
      <small>{done ? "Complete" : "Working"}</small>
    </div>
  );
}
export function Action({
  children,
  selected = false,
}: {
  children: React.ReactNode;
  selected?: boolean;
}) {
  return (
    <span className={`story-action ${selected ? "pressed" : ""}`}>
      {children}
    </span>
  );
}

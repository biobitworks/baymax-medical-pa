import React from "react";
import { AppShell, Chat, ToolStatus, Action } from "./AppShell";
const request =
  "Read /workspace/fictional-care/doctor-visit.md and prepare a visit-summary.md.";
export function ComputerScene({ seconds: s }: { seconds: number }) {
  const prepared = s >= 9,
    manual = s >= 11 && s < 16;
  return (
    <AppShell active="Computer" detail="Private workspace">
      <div className="story-computer-layout">
        <Chat compact prompt={request} typed={s < 3 ? request : undefined}>
          {s >= 3 && (
            <>
              <ToolStatus done={s >= 6}>Read doctor-visit.md</ToolStatus>
              {s >= 6 && (
                <ToolStatus done={prepared}>Write visit-summary.md</ToolStatus>
              )}
              {prepared && (
                <>
                  <p className="story-answer">
                    Your visit summary is ready to inspect.
                  </p>
                  <div className="story-file-artifact">
                    <span>▤</span>
                    <strong>visit-summary.md</strong>
                    <small>Saved in /workspace/fictional-care</small>
                  </div>
                  <p className="story-muted">
                    Take over to review or edit the file.
                  </p>
                </>
              )}
              {s >= 16 && (
                <div className="story-document-status">
                  <strong>✓ Changes saved</strong>
                  <span>Control returned to Baymax.</span>
                </div>
              )}
            </>
          )}
        </Chat>
        <section className="story-desktop">
          <header>
            <strong>Baymax’s computer</strong>
            <span>Session unlocked</span>
          </header>
          <nav>
            {["Browser", "Terminal", "Files"].map((label) => (
              <span
                key={label}
                className={
                  (s >= 6 && s < 9 ? label === "Terminal" : label === "Files")
                    ? "active"
                    : ""
                }
              >
                {label}
              </span>
            ))}
          </nav>
          <div className="story-file-browser">
            <aside>
              <small>WORKSPACE</small>
              <p>⌄ fictional-care</p>
              <span className={!prepared ? "selected" : ""}>
                ▧ doctor-visit.md
              </span>
              {prepared && <span className="selected">▧ visit-summary.md</span>}
              <div className="story-storage-label">
                Persistent files
                <br />
                Isolated session
              </div>
            </aside>
            <div className="story-file-pane">
              <div className="story-file-path">
                {s >= 6 && s < 9
                  ? "Terminal · /workspace/fictional-care"
                  : prepared
                    ? "visit-summary.md"
                    : "doctor-visit.md"}
              </div>
              {s >= 6 && s < 9 ? (
                <pre className="story-terminal">
                  {
                    "$ read doctor-visit.md\n\n✓ Record loaded\n\n$ write visit-summary.md\n\nPreparing your visit summary…"
                  }
                </pre>
              ) : (
                <div className="story-markdown">
                  <small>
                    {manual
                      ? "EDITING · YOU HAVE CONTROL"
                      : prepared
                        ? "GENERATED SUMMARY · REVIEW BEFORE USE"
                        : "SOURCE NOTE · FICTIONAL RECORD"}
                  </small>
                  <h2>{prepared ? "Visit summary" : "My doctor visit"}</h2>
                  <p>
                    <b>Patient</b> Jordan Mercer
                  </p>
                  <p>
                    <b>Context</b> Visiting Sydney next week
                  </p>
                  <hr />
                  <h3>
                    {prepared
                      ? "Discuss at the appointment"
                      : "What I want to discuss"}
                  </h3>
                  <ul>
                    <li>Review my recorded metformin prescription.</li>
                    <li>Confirm refill requirements with a pharmacist.</li>
                    <li>Discuss fatigue during longer training runs.</li>
                  </ul>
                  {s >= 13 && (
                    <p className="story-user-edit">
                      + Ask when I should arrange follow-up.
                    </p>
                  )}
                  <span className="story-markdown-status">
                    {s >= 14
                      ? "✓ All changes saved"
                      : prepared
                        ? "Ready for your review"
                        : "Last saved today"}
                  </span>
                </div>
              )}
            </div>
          </div>
          <footer>
            <span>
              <i />
              {manual ? "You have control" : "Baymax has control"}
            </span>
            <Action selected={(s >= 10 && s < 11) || (s >= 15 && s < 16)}>
              {manual ? "Return control" : "Take over"}
            </Action>
          </footer>
        </section>
      </div>
    </AppShell>
  );
}

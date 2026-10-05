import React from "react";
import { Img } from "remotion";
import { AppShell, Chat, ToolStatus, Action } from "./AppShell";
import { MascotSprite } from "../demo/MascotSprite";
import { assetFile } from "../demo/asset";

const week = [42, 68, 53, 76, 60, 49, 26];
export function DailyScene({ seconds: s }: { seconds: number }) {
  const chat = s >= 11;
  return (
    <AppShell active={chat ? "Talk" : "Today"}>
      {!chat ? (
        <div className="story-today">
          <div className="story-page-heading">
            <small>SUNDAY, OCTOBER 4</small>
            <h1>Good afternoon, Jordan.</h1>
            <p>Let’s make a bit of room for you.</p>
          </div>
          <section className="story-checkin">
            <div>
              <small>
                From Baymax <b>•</b>
              </small>
              <h2>Before you get on with your day.</h2>
              <p>How’s your energy? I’ll keep that in mind.</p>
              <div className="story-energy">
                {["Low", "Okay", "Good", "Great"].map((value, i) => (
                  <span
                    key={value}
                    className={s >= 4 && i === 0 ? "chosen" : ""}
                  >
                    {["◔", "◑", "◕", "●"][i]} {value}
                    {s >= 4 && i === 0 ? " ✓" : ""}
                  </span>
                ))}
              </div>
              <Action selected={s >= 6 && s < 7}>
                {s >= 7 ? "✓ Check-in saved · Low energy" : "Save check-in ↗"}
              </Action>
            </div>
            <MascotSprite size={260} />
          </section>
          <div className="story-section-title">
            <h2>Today, so far</h2>
            <span>Sample data + your entries</span>
          </div>
          <div className="story-today-stats">
            {[
              ["Water", "3", "/ 8 glasses", "Add a glass"],
              ["Movement", "10", "/ 30 minutes", "Log movement"],
              ["Your plan", "1", "/ 5 steps", "Open plan ↗"],
            ].map((item, i) => (
              <article key={item[0]}>
                <small>{item[0]}</small>
                <strong>
                  {item[1]} <em>{item[2]}</em>
                </strong>
                <div className="story-meter">
                  <i style={{ width: `${[37, 33, 20][i]}%` }} />
                </div>
                <span>{item[3]}</span>
              </article>
            ))}
          </div>
          <div className="story-today-bottom">
            <span>✓ Pack medication documents</span>
            <span>Apple Health · Connect with Shortcut ↗</span>
          </div>
        </div>
      ) : (
        <Chat
          scroll={s >= 17 ? 140 : 0}
          prompt="How was my week?"
          typed={s < 13 ? "How was my week?" : undefined}
        >
          {s >= 13 && (
            <>
              <ToolStatus done={s >= 17}>
                Read check-ins and health summary
              </ToolStatus>
              {s >= 17 && (
                <>
                  <p className="story-answer">
                    Here’s your week, Jordan. Today’s low-energy check-in is
                    included.
                  </p>
                  <div className="story-week-grid">
                    {[
                      ["Energy", "Mixed", "6 check-ins · Low today"],
                      ["Water", "5 glasses", "daily average · 5 logged days"],
                      ["Movement", "24 min", "daily average · 4 logged days"],
                      ["Sleep", "Unknown", "No readings received"],
                    ].map((item, i) => (
                      <article className={`week-${i}`} key={item[0]}>
                        <small>{item[0]}</small>
                        <strong>{item[1]}</strong>
                        {i < 3 ? (
                          <div className="story-spark">
                            {week.map((height, k) => (
                              <i
                                key={k}
                                style={{
                                  height: `${height + (i === 1 ? 12 : 0)}%`,
                                }}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="story-unknown">
                            — &nbsp; — &nbsp; — &nbsp; —
                          </div>
                        )}
                        <p>{item[2]}</p>
                      </article>
                    ))}
                  </div>
                  <div className="story-source-note">
                    <strong>Sample readings</strong>
                    <span>
                      Missing data stays unknown. No sleep reading is inferred.
                    </span>
                  </div>
                  <div className="story-health-connect">
                    <span>♡</span>
                    <div>
                      <strong>Apple Health</strong>
                      <p>Sync from your iPhone with a Shortcut.</p>
                    </div>
                    <Action>Connect Shortcut ↗</Action>
                  </div>
                </>
              )}
            </>
          )}
        </Chat>
      )}
    </AppShell>
  );
}
const travelPrompt =
  "I’m in Sydney next week and running low on my recorded metformin prescription. Help me prepare a refill.";
export function TravelScene({ seconds: s }: { seconds: number }) {
  return (
    <AppShell active="Talk" detail="Sydney · Medication preparation">
      <Chat
        scroll={s >= 11 ? 150 : 0}
        prompt={travelPrompt}
        typed={
          s < 3 ? travelPrompt.slice(0, Math.floor(s * 45) + 1) : undefined
        }
      >
        {s >= 3 && (
          <>
            <ToolStatus done={s >= 8}>
              Read recorded prescription and travel context
            </ToolStatus>
            {s >= 6 && s < 11 && (
              <div className="story-record-strip">
                <strong>Recorded: Metformin ER 500 mg</strong>
                <span>Existing prescription · No medication changes</span>
              </div>
            )}
            {s >= 11 && (
              <>
                <p className="story-answer">
                  Let’s prepare a refill to discuss with a Sydney pharmacist.
                </p>
                <div className="story-purchase">
                  <header>
                    <div>
                      <small>REFILL PREPARATION</small>
                      <h2>
                        {s >= 21
                          ? "Review your purchase plan"
                          : "Your recorded medication"}
                      </h2>
                    </div>
                    <span className="story-chip">Not ordered</span>
                  </header>
                  <div className="story-purchase-body">
                    <div className="story-product-image">
                      <Img
                        src={assetFile("medicines/marathon/metformin.jpg")}
                      />
                    </div>
                    <div className="story-product-info">
                      <h3>Metformin ER 500 mg</h3>
                      <p>30 extended-release tablets</p>
                      <div className="story-line">
                        <span>Pharmacy</span>
                        <strong>Sydney Care Pharmacy*</strong>
                      </div>
                      <div className="story-line">
                        <span>Quantity</span>
                        <strong>1 pack · Confirm with pharmacist</strong>
                      </div>
                      <div className="story-line">
                        <span>Estimated cost</span>
                        <strong>
                          A$18.00 <small>Illustrative</small>
                        </strong>
                      </div>
                    </div>
                  </div>
                  <div className="story-research-state">
                    <b>○ Unverified</b> Availability, price and local
                    prescription requirements need confirmation.
                  </div>
                  {s >= 21 ? (
                    <div className="story-review-ready">
                      <strong>✓ Prepared for your review</strong>
                      <span>
                        No order sent. No prescribing or substitution.
                      </span>
                    </div>
                  ) : (
                    <Action selected={s >= 20}>Review purchase ↗</Action>
                  )}
                  <small className="story-disclosure">
                    * Fictional pharmacy and estimated price. This is a purchase
                    plan.
                  </small>
                </div>
                <div className="story-pharmacy-questions">
                  <strong>Ask the pharmacist</strong>
                  <span>
                    Can you accept my prescription? Is this exact formulation
                    available?
                  </span>
                </div>
              </>
            )}
          </>
        )}
      </Chat>
    </AppShell>
  );
}
export function BriefScene({ seconds: s }: { seconds: number }) {
  const edited = s >= 12,
    ready = s >= 19;
  return (
    <AppShell active="Talk" detail="A new doctor · Reviewed brief">
      <Chat
        scroll={s >= 19 ? 280 : s >= 5 ? 170 : 0}
        prompt="Write a brief for a new doctor."
        typed={s < 2 ? "Write a brief for a new doctor." : undefined}
      >
        {s >= 2 && (
          <>
            <ToolStatus done={s >= 5}>
              Read medications, allergies and recent labs
            </ToolStatus>
            {s >= 5 && (
              <>
                <p className="story-answer">
                  Here’s a draft from your records. Review it before sharing.
                </p>
                <div className="story-brief">
                  <header>
                    <div>
                      <small>DOCTOR BRIEF</small>
                      <h2>Jordan Mercer</h2>
                    </div>
                    <span className="story-chip">
                      {ready ? "Reviewed" : "Draft · Editable"}
                    </span>
                  </header>
                  <div className="story-brief-grid">
                    <section>
                      <small>RECORDED MEDICATION</small>
                      <p>Metformin ER 500 mg</p>
                      <span>As recorded · Verify current instructions</span>
                    </section>
                    <section>
                      <small>ALLERGIES</small>
                      <p>Penicillin</p>
                      <span>Rash · Reported in sample record</span>
                    </section>
                    <section>
                      <small>RECENT LABS</small>
                      <p>HbA1c · 7.1%</p>
                      <span>12 Sep 2026 · Sample lab report</span>
                    </section>
                    <section>
                      <small>REASON FOR VISIT</small>
                      <p>New doctor in Sydney</p>
                      <span>Review records and medication supply</span>
                    </section>
                  </div>
                  <div className={`story-edit-line ${edited ? "edited" : ""}`}>
                    <small>
                      YOUR QUESTION{" "}
                      <span>
                        {edited ? "✓ Edited by you" : "Click to edit"}
                      </span>
                    </small>
                    <p>
                      {edited
                        ? "Please discuss fatigue during my longer training runs."
                        : "Please review my medication list."}
                    </p>
                  </div>
                  <footer>
                    <span>
                      {ready
                        ? "doctor-brief-reviewed.pdf · Ready"
                        : "You review. You choose who receives it."}
                    </span>
                    <Action selected={s >= 18 && s < 19}>
                      {ready
                        ? "✓ Reviewed PDF created"
                        : "Create reviewed PDF ↗"}
                    </Action>
                  </footer>
                </div>
                {ready && (
                  <div className="story-document-status">
                    <strong>PDF prepared in this demo</strong>
                    <span>
                      Choose a recipient, attach the document and send it
                      yourself.
                    </span>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Chat>
    </AppShell>
  );
}

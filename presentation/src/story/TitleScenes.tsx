import React from "react";
import { MascotSprite } from "../demo/MascotSprite";
import { Face } from "./AppShell";
export function HookScene({ seconds: s }: { seconds: number }) {
  return (
    <div className="story-title-scene">
      {s < 16 ? (
        <>
          <div className="story-title-kicker">
            {s < 8 ? "YOUR HEALTH, SCATTERED" : "AND THEN YOU LEAVE HOME"}
          </div>
          <h1>
            {s < 8 ? (
              <>
                Portals. PDFs.
                <br />
                Things you forgot.
              </>
            ) : (
              <>
                New city.
                <br />
                Same health context?
              </>
            )}
          </h1>
          <div className="story-context-cards">
            {(s < 8
              ? [
                  ["▧", "Lab results.pdf", "Somewhere in your downloads"],
                  ["▤", "Patient portal", "Another password to remember"],
                  ["◯", "One more question", "The thing you meant to ask"],
                ]
              : [
                  ["↗", "Sydney, next week", "A new doctor. A new pharmacy."],
                  [
                    "◒",
                    "Medication supply",
                    "Running low on your prescription",
                  ],
                  ["▧", "Your medical history", "Bring the context with you"],
                ]
            ).map((item) => (
              <article key={item[1]}>
                <span>{item[0]}</span>
                <h2>{item[1]}</h2>
                <p>{item[2]}</p>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="story-brand-hero">
          <div>
            <div className="story-brand large">
              <Face />
              baymax<span>.</span>
            </div>
            <h1>
              A little care,
              <br />
              every day.
            </h1>
            <p>
              Your context. Together.
              <br />
              Ready for what comes next.
            </p>
          </div>
          <MascotSprite size={590} greeting />
        </div>
      )}
    </div>
  );
}
const engineering = [
  {
    title: "An agent you can work with.",
    detail:
      "Mastra runs the agent and typed tools. Assistant UI turns results into interactive React cards.",
    items: ["Typed tool calls", "Visible results", "Interactive React cards"],
  },
  {
    title: "Your context, with consent.",
    detail:
      "Neon Postgres stores opted-in care state. This setup uses OpenAI directly; Neon AI Gateway is another supported model route.",
    items: [
      "Opt-in persistence",
      "OpenAI directly in this setup",
      "Neon AI Gateway supported",
    ],
  },
  {
    title: "Useful inputs. Clear boundaries.",
    detail:
      "Exa uses general queries without identifiable health details. Apple Health arrives through an iPhone Shortcut.",
    items: [
      "Live research needs Exa authentication",
      "Token-authenticated health endpoint",
      "Hashed token · Deduplicated readings",
    ],
  },
  {
    title: "You make the final call.",
    detail:
      "Users review documents before sharing and see what the agent actually completed.",
    items: [
      "Saving is opt-in",
      "Review before sharing",
      "Unknown stays unknown",
    ],
  },
];
export function EngineeringScene({ seconds: s }: { seconds: number }) {
  const phase = Math.min(3, Math.floor(s / 10)),
    copy = engineering[phase];
  return (
    <div className="story-engineering">
      <div className="story-title-kicker">BUILT TO KEEP YOU IN CONTROL</div>
      <h1>Behind the care.</h1>
      <div className="story-engineering-layout">
        <div className="story-architecture">
          <div
            className={`story-arch-node wide ${phase === 0 ? "highlight" : ""}`}
          >
            <small>THE EXPERIENCE</small>
            <h2>React + Assistant UI</h2>
            <p>Conversation → interactive care cards</p>
          </div>
          <div className="story-connector">↕ typed tool results</div>
          <div
            className={`story-arch-node wide agent ${phase === 0 ? "highlight" : ""}`}
          >
            <small>THE AGENT</small>
            <h2>Mastra</h2>
            <p>Context · Tools · Observable completion</p>
          </div>
          <div className="story-connector">↓</div>
          <div className="story-arch-grid">
            {[
              ["Neon Postgres", "Opted-in care state", 1],
              ["OpenAI", "Direct model route", 1],
              ["Exa", "General web research", 2],
              ["Apple Health", "iPhone Shortcut", 2],
            ].map((item) => (
              <div
                className={`story-arch-node ${phase === item[2] ? "highlight" : ""}`}
                key={item[0]}
              >
                <h3>{item[0]}</h3>
                <p>{item[1]}</p>
              </div>
            ))}
          </div>
          <div
            className={`story-arch-boundary ${phase === 3 ? "highlight" : ""}`}
          >
            Consent → Review → User-controlled sharing
          </div>
        </div>
        <aside className="story-engineering-detail">
          <span>0{phase + 1} / 04</span>
          <h2>{copy.title}</h2>
          <p>{copy.detail}</p>
          <ul>
            {copy.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
export function CloseScene({ seconds: s }: { seconds: number }) {
  return (
    <div className="story-close">
      {s < 6 ? (
        <>
          <div className="story-close-heading">
            <div className="story-title-kicker">
              A LITTLE CARE, WHEREVER YOU ARE
            </div>
            <h1>
              Take Baymax
              <br />
              with you.
            </h1>
            <p>
              An installable app.
              <br />A reminder concept for what’s next.
            </p>
          </div>
          <div className="story-mobile-preview">
            <header>
              <div className="story-brand">
                <Face />
                baymax.
              </div>
              <span>Installed app</span>
            </header>
            <div className="story-mobile-greeting">
              <h2>
                Good morning,
                <br />
                Jordan.
              </h2>
              <MascotSprite size={125} />
            </div>
            <div className="story-mobile-checkin">
              <small>YOUR DAILY CHECK-IN</small>
              <strong>How’s your energy?</strong>
              <div>◔ Low　◑ Okay　◕ Good</div>
            </div>
            <div className="story-mobile-nav">
              Today　　Talk　　Plan　　Profile
            </div>
          </div>
          <div className="story-close-notifications">
            <small>RECORDED REMINDER CONCEPT</small>
            <article>
              <header>
                <Face /> BAYMAX <span>now</span>
              </header>
              <h3>
                Your routine called.
                <br />
                You’ve got this.
              </h3>
              <p>
                Time for your scheduled medication.
                <br />
                Take it as prescribed.
              </p>
              <b>
                Let’s do this　 <em>Later</em>
              </b>
            </article>
            <span>Concept preview · Live push is not shown</span>
          </div>
        </>
      ) : (
        <div className="story-end-card">
          <MascotSprite size={250} />
          <div className="story-brand large">
            <Face />
            baymax<span>.</span>
          </div>
          <h1>
            Caring enough
            <br />
            to remind you again.
          </h1>
          <a href="https://github.com/jerelvelarde/baymax-medical-pa">
            <svg
              viewBox="0 0 24 24"
              width="40"
              height="40"
              fill="currentColor"
              aria-label="GitHub"
            >
              <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.4 5 18.4 5.3 18.4 5.3c.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
            </svg>
            github.com/jerelvelarde/baymax-medical-pa
          </a>
        </div>
      )}
    </div>
  );
}

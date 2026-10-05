# BayMax - Medical Personal Agent

![Status: Alpha](https://img.shields.io/badge/status-alpha-e7ae58)

> **An adorable Medical Personal Agent that cares for you, designed to be secure and compliant.**

**Build Personal Agents Hackathon Project Submission**

**Project site:** [thinkun.github.io/baymax-site](https://thinkun.github.io/baymax-site/) (source in [`site/`](site/index.html))

Baymax is a privacy-first personal medical assistant that helps you take care of yourself before health becomes an emergency. It remembers what matters, nudges you to follow through, and helps you carry your health context wherever life takes you.

![Baymax: daily care, reminders, and prescription shopping](docs/media/baymax-hero.gif)

[Explore the launch presentation](presentation/README.md) · Component-driven demo with illustrative data.

## UI walkthroughs

Built with **Assistant UI**, React, TypeScript, and Vite. Start in **Today** for a check-in and daily progress, or open **Talk** for interactive care cards. The current UI pairs a dark desktop sidebar with warm cards, larger body text, and mobile bottom navigation.

These GIFs record the current app using a synthetic profile and mocked backend responses.

### Prepare for a hackathon

Save an energy check-in, log a glass of water, and tick off a walk in your preparation plan.

![Care plan and check-in walkthrough](docs/media/care-plan.gif)

### Prescription concierge

Open **Talk → More ways I can help → Browse medicines** to see sample pharmacy options and product images inside the conversation. Choose between two demo pharmacies, adjust the pack count, review the total, and confirm a simulated order. Pharmacy names, prices, availability, and medication details are illustrative. No prescription is verified, no payment is collected, and no order is sent.

![Prescription order preview walkthrough](docs/media/prescription-preview.gif)

### Email a doctor brief

Review a sample health brief, enter a recipient, and approve the email draft. This walkthrough stops at the approved preview; opening the email app and sending remain user actions.

![Doctor brief email walkthrough](docs/media/doctor-email.gif)

### Care on your phone

Check in, add water, review activity rings, and move into a conversation using the bottom navigation. The composer stays above the navigation so you can keep typing.

![Current mobile UI: check-in, hydration, activity, and chat](docs/media/mobile-care.gif)

The separate [mobile reminder concept (MP4)](docs/media/mobile-notifications.mp4) simulates medication, refill, and walking notifications. It is not a recording of live push delivery. Open `/demo/notifications.html` to replay it; `npm run record:notifications` rebuilds that concept recording.

### Our 2D companion

Baymax’s sprite brings greeting, breathing, blinking, and thinking animations into the app. This recording shows the companion in the current Today check-in card. The app respects reduced-motion preferences.

![Animated Baymax companion](docs/media/baymax-animation.gif)

### Refresh these recordings

Start the frontend with `npm run dev`, then run `npm run record:readme` in another terminal. The recorder uses Playwright Chromium and Sharp, intercepts backend requests with synthetic fixtures, and stops before opening the email app. It does not require the agent or shared database. Install the browser once with `npx playwright install chromium`.

Set `BAYMAX_DEMO_URL` to a different local frontend URL if needed (default: `http://localhost:5173`). Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use an existing Chromium binary. The separate notification-concept recorder also requires FFmpeg.

## Run locally

Requires Node.js 22.22+ or 24.11+ (Node.js 24 LTS recommended).

```bash
npm ci
cp .env.example .env.local
# Fill in DATABASE_URL and Neon AI Gateway values in .env.local (git-ignored).
# .env is committed and holds non-secret defaults only; never put credentials in it.
npm run db:migrate
npm run agent:dev
# In a second terminal:
npm run dev
```

Open the local URL Vite prints. Vite proxies `/api`, `/travel`, `/health`, and `/care-state` to Mastra on port 4111. Enable **Remember across visits** during onboarding or in Privacy & preferences to save your care space. A successful save is shown above the page heading.

The ignored `.env` is server-only. `DATABASE_URL` powers the workspace store; `NEON_AI_GATEWAY_TOKEN` and `NEON_AI_GATEWAY_BASE_URL` power the existing `neon/gpt-5-6-luna` agent. Auth and S3 variables are reserved for future login/uploads and are not used by the browser-bound persistence implementation. Saving uses an HttpOnly cookie, so separate browser profiles have separate workspaces. There is no account login or cross-device sync.

`npm run db:migrate` creates only the additive `baymax_care_workspaces` table and its monotonic revision sequence and is safe to rerun. The UI loads saved state before accepting changes, serializes saves, and rejects stale revisions. Turning off memory deletes the remote copy; Delete my care space also clears the conversation and returns to onboarding. Unsaved changes stay in memory and show a retry action on failure; they are never copied into localStorage.

### Agent web search with Exa

Baymax's Mastra agent has a server-side `search-web` tool powered by
[Exa Search](https://exa.ai/docs/reference/search). It returns source links,
publication dates when available, and relevant excerpts for current web information.
Search calls also render a sources card in chat with clickable titles, domains,
dates, and excerpts. The card shows searching, empty, and unavailable states.

Add `EXA_API_KEY` to your local `.env` (see `.env.example`), keep the existing
Neon AI Gateway credentials, and start the agent:

```bash
npm run agent:dev
```

Try asking Baymax to find official guidance for travelling with prescription
medication to Spain. The agent is instructed to use general queries, keep
identifiable health details out of search, and cite its sources. Search requires
an Exa key and does not purchase medication or confirm personal treatment advice.
Restart the agent after changing `.env`. Never use a `VITE_` prefix for the key.
If port 4111 is busy, Mastra prints another port. Set `MASTRA_API_URL` in `.env`
to that server URL (for example, `http://localhost:4112`) and restart Vite.

Run the search integration tests (mocked API responses, no API key required):

```bash
npm run test:search
```

```bash
npm test
npm run build
# Stop agent:dev before building its production output.
npm run agent:build
# Set APP_ORIGIN in .env to the exact preview URL, e.g. http://localhost:4173.
npm run agent:start
# In a second terminal:
npm run preview
```

## Implemented frontend

### Apple Health Shortcut

Use **Privacy & preferences → Connect Apple Health** to pair an iPhone Shortcut with a saved care space. The signed Shortcut sends recent steps, exercise minutes, sleep, and water; Baymax stores daily summaries and uses them in the existing daily-metrics agent tool. Missing readings stay unknown. Users can rotate the key or disconnect and delete imports.

Apply migration `005_apple_health.sql`, then use `npm run shortcut:local` for local Mac/iPhone Wi-Fi setup. See [the setup guide](docs/apple-health-shortcut.md) for installation, data handling, and the required first real-iPhone check. The initial integration is user-run and does not include running workouts.

The following frontend capabilities are also implemented:

- Conversation-first Assistant UI runtime streaming live Mastra responses through Neon AI Gateway.
- Generative UI rendered through `makeAssistantToolUI` and tool-call message parts.
- Agent-generated care plan and doctor brief contents populate editable cards and their corresponding pages.
- Editable inline care plans and travel checklists.
- Prescription order preview with review and confirmation states.
- Doctor brief editing, recipient validation, email review, and `mailto:` handoff.
- Daily check-ins, hydration logging, movement tasks, and preferences.
- Optional Neon persistence for profile, check-ins, hydration, movement/weekly overview, tasks, plans, travel context and generated checklist, brief/email draft, preferences, and conversation including tool results.
- Clear restore/save errors, retry controls, optimistic revisions, and user-controlled deletion.
- Mobile and desktop layouts, keyboard-accessible dialogs, and reduced-motion support.

## Install Baymax on your phone (PWA)

The production frontend is an installable Progressive Web App with a standalone window and Baymax home-screen icons.

- **Android / Chrome:** open the hosted app and tap **Install Baymax** when available, or use the browser’s install menu.
- **iPhone / iPad:** open the hosted app in Safari, choose **Share → Add to Home Screen → Add**. The in-app install button shows these instructions.
- **Desktop:** use Chrome or Edge’s install option when available.

Installation requires HTTPS hosting (localhost is allowed for development). The normal Vite development server does not register a worker. Test the production version with `npm run build` followed by `npm run preview`. A plain HTTP address on your local network will not enable phone installation.

Only public JavaScript, CSS, icons, the manifest and a static offline page are stored in the service-worker cache. Conversations, health profiles, API responses and travel responses are not cached by the worker. When opened offline, Baymax shows a reconnect page; chat still needs a network connection. Installation does not add persistent health memory or background reminders.

New versions wait until you select **Update now**. Updating reloads the app and clears its current session; **Later** preserves your active session. The included Nginx configuration revalidates files and serves missing worker/manifest assets as 404s.

Verify PWA behavior with `npx playwright install chromium` (once) and `npm run test:pwa`. The suite checks manifest/icons, installation controls, offline/reconnect behavior, sensitive request exclusion and update consent. Regenerate the checked-in PNG icons with `npm run icons`.

## Sponsor integration status

| Sponsor | Status |
| --- | --- |
| Assistant UI | Implemented: runtime, message primitives, composer, suggestions, tool UI |
| Mastra | Implemented: live agent text and care plan/doctor brief tool results |
| Neon | Implemented: consent-based browser workspace and conversation persistence, plus AI Gateway |
| Exa | Implemented: server-side agent search with source cards; requires `EXA_API_KEY` |
| Fly.io | Dockerfile, Nginx config, and starter Fly configuration included; not deployed |

The app has live LLM and database connections. Pharmacy fulfilment, payment, server-side email delivery, and background notifications remain unimplemented. The GIFs use sample details.

## Fly.io deployment preparation

The included Dockerfile builds the Vite frontend and serves it on port 8080. It is still a frontend-only deployment: run the Mastra backend separately and configure the frontend reverse proxy for `/api`, `/travel`, `/health`, and `/care-state` before deployment. Set server-side `APP_ORIGIN` to the exact public frontend origin so cookies are Secure and write origins are validated. No deployment or billing action has been performed.

## The idea

You have an assistant for work. Why not one for your health?

Baymax is the caring, persistent companion that checks in on your habits, helps you prepare for busy weeks, and makes navigating healthcare while travelling less overwhelming.

## Focus areas

- **Preventative care:** reminders for appointments, checkups, and follow-ups based on your care plan.
- **Lifestyle:**
  - **Exercise:** achievable movement goals, activity check-ins, and gentle accountability.
  - **Diet:** meal planning, habit tracking, and reminders aligned with your preferences and goals.
- **Personal context:** a health profile and memory that you control.

## Use cases

- **Proactive care:** support for exercise and diet through achievable goals, meal planning, and gentle reminders.
- **Prescription meds ordering:** identify where to buy prescribed medication and help order it for you. Research and ordering are planned capabilities; the current prototype provides an order preview.
- **Medical brief for new doctors when travelling:** prepare a concise health summary to review and share with a new doctor.

### 1. Proactive care: exercise and diet

BayMax helps you build everyday exercise and diet habits with achievable movement goals, meal planning, activity check-ins, and gentle accountability. Reminders should be adjustable, snoozable, and easy to turn off.

For a busy week or hackathon, it can help you plan a routine around sleep, meals, hydration, movement, and your existing medication schedule.

### 2. Prescription meds ordering

Travelling and running low on your prescribed medication? Baymax helps you prepare a medication summary, research local prescription requirements and pharmacy options, and identify questions to ask a licensed clinician or pharmacist.

It supports the process; it does not issue prescriptions, authorize purchases, or recommend medication substitutions.

### 3. Briefing a new doctor while travelling

Baymax drafts a concise, user-reviewed health brief containing the information you choose to share: current medications, allergies, relevant history, recent concerns, and questions for your appointment.

Review it, edit it, and share it with your new doctor so you do not have to start from zero.

## Privacy first. HIPAA compliance as a design goal.

Health information deserves deliberate protection. Our goal is a HIPAA-compliant, privacy-first product.

**This hackathon project is a prototype with live backend connections. HIPAA compliance has not been verified. Use synthetic data for demos.**

Implemented persistence safeguards: explicit storage consent, server-only credentials, hashed random browser session IDs, HttpOnly/SameSite cookies (Secure on HTTPS), write-origin checks, bounded schema validation, parameterized queries, revision checks, and remote deletion.

The new health tools and `/health` endpoints inherited from main still use shared, synthetic in-memory sample data; the saved browser workspace is separate from that demo store. Restoring a workspace preserves its saved check-in, hydration, and weekly overview instead of replacing them with demo values.

Account authentication, access audit logging, cross-device access, file upload, export of the entire workspace, and compliance review remain future work. Further safeguards include:

- Explicit consent for storing health information and sharing it with external services.
- Data minimization and user-controlled memory.
- Encryption in transit and at rest.
- Authentication, access controls, and audit logging.
- User options to review, export, and delete stored information.
- Keeping identifiable health information out of public repositories, application logs, and web-search queries.
- Reviewing vendor agreements, data flows, and deployment requirements before handling real protected health information.

## Sponsors and stack we aim to use

Assistant UI, Mastra, and Neon are connected. See the integration status above for remaining work. These are not claims of confirmed partnerships.

| Technology | Planned role |
| --- | --- |
| [Mastra](https://mastra.ai/) | Agent orchestration, tools, and workflows |
| [Neon](https://neon.com/) | Agent memory and structured data storage |
| [Assistant UI](https://www.assistant-ui.com/) | Conversational interface |
| [Exa](https://exa.ai/) | Web research for travel and healthcare logistics, using queries without identifiable health information |
| [Fly.io](https://fly.io/) | Application hosting and deployment |

## Planned hackathon MVP

- [ ] Conversational onboarding with a synthetic health profile.
- [x] User-controlled browser workspace and conversation memory.
- [ ] Daily lifestyle check-ins and configurable reminders.
- [ ] A hackathon preparation routine.
- [ ] A travel medication support workflow with source links.
- [x] A doctor-ready health brief with review before sharing.
- [x] Storage consent, deletion controls, and a documented persistence data flow.

## Demo story

“I’m travelling for a hackathon next week. Help me prepare, keep me on track every day, and help me explain my health history if I need to see a doctor.”

Baymax turns that request into a preparation routine, daily check-ins, a medication travel checklist, and a health brief the user can review.

## Project status

**UI, agent, and Neon persistence connected.** Interactive care cards now use live tool results, and consenting users can restore their care space across refreshes. Live Neon save/restore/delete and a structured agent plan response have been verified. Real prescription fulfilment, server-side email delivery, account login, web research, deployment, and compliance verification remain to be built.

Validation: `npm test` covers SQL persistence with PGlite, consent, session isolation, invalid requests, conflicts, deletion/retry behavior, stream framing, and component restore/reset flows. `SMOKE_BASE_URL=http://127.0.0.1:5173 npm run test:live` exercises a disposable synthetic workspace and a live agent plan against running servers, then deletes its test document. This live check uses the configured gateway and database; it is not part of the offline test suite.

## Medical boundaries

Baymax is intended to support organization, habits, and healthcare conversations. It does not replace a licensed healthcare professional, diagnose conditions, prescribe medication, or provide emergency care.

---

**Baymax: caring enough to remind you again.**

## Activity onboarding and fitness

The welcome flow introduces steps and active minutes, lets the user choose daily goals, and offers optional browser notifications. Physical fitness shows two activity rings, daily goal completion, a rolling seven-day target, and trends. Running remains a separate page.

Baymax can render the same interactive components in chat using `fitnessOverviewTool` and `onboardingTool`. Try “Open my fitness dashboard” or “Start my activity onboarding,” or use the Fitness and Activity setup shortcuts. Tools open the UI; users confirm goal and preference changes themselves.

`GET /health/fitness` reads activity plus saved goals. `GET` and `POST /health/preferences` read/save onboarding preferences; `POST /health/goals` updates goals. UI and agent tools share the demo user's Postgres-backed preferences (`user_fitness_preferences`; the name is stored on `users`). Data is sample activity, not synced device data. Goals and preferences persist across refreshes and restarts, and are cleared by the demo reset. Browser notifications can celebrate completed demo goals while the fitness component is mounted; there are no scheduled or background reminders.

Run `npm run test:fitness` for goal validation and progress calculations, and `npm run build` for TypeScript and production bundling.

## Baymax’s computer

Baymax and you can share a persistent browser, an isolated Linux terminal, and files under `/workspace`. Open **Computer** to unlock access, watch or control browsing, run commands with saved receipts, and edit text files. The agent uses the same computer from chat. This adapts OpenMuse’s MIT-licensed browser worker and container helpers while keeping Baymax’s Mastra agent.

See [setup, access, and verification](docs/baymax-computer.md). The feature needs explicit server configuration, a browser worker, and Docker for terminal/files. Commands run inside a network-disabled container, never on the server host.

---

## Biobitworks compliance-backend successor

The Biobitworks fork adds a compliance-first backend and evidence track while preserving the upstream application's medical claim boundary.

Current architecture documents:

- [Canon](CANON.md)
- [Compliance backend](docs/COMPLIANCE_BACKEND.md)
- [Model/provider matrix](docs/MODEL_PROVIDER_MATRIX.md)
- [Golden Path to Golden Years](docs/GOLDEN_PATH_TO_GOLDEN_YEARS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Licensing status](LICENSES.md)
- [HIPAA / Neon technical qualification](docs/HIPAA_NEON_TECHNICAL_QUALIFICATION.md)

The deterministic routing prototype in `src/baymax_compliance/policy.py` remains fail-closed: models do not authorize their own access to sensitive data. The current controlled Neon qualification does **not** establish HIPAA compliance and keeps real PHI blocked pending the recorded technical and contractual gates.

Historical CareScribe, Agent Foundry, Vithia, JEV, and other independent lineages remain external references; their MMRs/Merkle histories are not concatenated into Baymax.

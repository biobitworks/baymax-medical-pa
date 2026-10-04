# BayMax - Medical Personal Agent

> **An adorable Medical Personal Agent that cares for you, designed to be secure and compliant.**

**Build Personal Agents Hackathon Project Submission**

Baymax is a privacy-first personal medical assistant that helps you take care of yourself before health becomes an emergency. It remembers what matters, nudges you to follow through, and helps you carry your health context wherever life takes you.

## UI walkthroughs

A conversation-first care companion built with **Assistant UI**, React, TypeScript, and Vite. Baymax surfaces interactive care cards inside the chat, with a centered animated mascot, a pill composer, and bottom navigation.

### Prepare for a hackathon

Review your preparation plan, check off a small win, and complete a daily energy check-in.

![Care plan and check-in walkthrough](docs/media/care-plan.gif)

### Prescription concierge

Open **Shopping demo** in the chat quick actions to try a sample prescription cart. Choose between two demo pharmacies, adjust the pack count, review the total, and confirm a simulated order. Pharmacy names, prices, availability, and medication details are illustrative. No prescription is verified, no payment is collected, and no order is sent.

![Prescription order preview walkthrough](docs/media/prescription-preview.gif)

### Email a doctor brief

Edit a fictional health brief, enter a sample recipient, and review the email draft. This walkthrough stops at the approved preview; opening the email app and sending remain user actions.

![Doctor brief email walkthrough](docs/media/doctor-email.gif)

### Our 2D companion

An authored sprite companion with greeting, idle breathing and blinking, and thinking animations. The preview shows the artwork enlarged and at its actual header size. The app respects reduced-motion preferences.

![Animated Baymax companion](docs/media/baymax-animation.gif)

## Run locally

Requires Node.js 22+.

```bash
npm ci
npm run dev
```

Open the local URL Vite prints.

### Agent web search with Exa

Baymax's Mastra agent has a server-side `search-web` tool powered by
[Exa Search](https://exa.ai/docs/reference/search). It returns source links,
publication dates when available, and relevant excerpts for current web information.

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
npm run build
npm run preview
```

## Implemented frontend

- Conversation-first Assistant UI runtime with streamed fixture responses.
- Generative UI rendered through `makeAssistantToolUI` and tool-call message parts.
- Editable inline care plans and travel checklists.
- Prescription order preview with review and confirmation states.
- Doctor brief editing, recipient validation, email review, and `mailto:` handoff.
- Daily check-ins, hydration logging, movement tasks, and preferences.
- Session-only state; navigation preserves the conversation, refresh clears it.
- Mobile and desktop layouts, keyboard-accessible dialogs, and reduced-motion support.

## Sponsor integration status

| Sponsor | Status |
| --- | --- |
| Assistant UI | Implemented: runtime, message primitives, composer, suggestions, tool UI |
| Mastra | Implemented: server-side Baymax agent; frontend falls back to fixture responses when unreachable |
| Neon | Next: consent-based profile and agent memory |
| Exa | Implemented: server-side agent search with source URLs and excerpts; requires `EXA_API_KEY` |
| Fly.io | Dockerfile, Nginx config, and starter Fly configuration included; not deployed |

The frontend connects to the local Mastra agent for live LLM responses and Exa search when server credentials are configured. Pharmacy fulfilment, payment, email delivery, persistent user data, and background notifications remain unconnected. The GIFs use sample details.

## Fly.io deployment preparation

The included Dockerfile builds the Vite frontend and serves it on port 8080. Choose an available app name in `fly.toml`, then use your Fly account to create and deploy the app. No deployment or billing action has been performed.

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

**This hackathon project is a frontend prototype. HIPAA compliance has not been verified, and no completed security controls are claimed. Use synthetic data for demos.**

Planned safeguards include:

- Explicit consent for storing health information and sharing it with external services.
- Data minimization and user-controlled memory.
- Encryption in transit and at rest.
- Authentication, access controls, and audit logging.
- User options to review, export, and delete stored information.
- Keeping identifiable health information out of public repositories, application logs, and web-search queries.
- Reviewing vendor agreements, data flows, and deployment requirements before handling real protected health information.

## Sponsors and stack we aim to use

Assistant UI is implemented. The remaining integrations are planned; see the integration status above. These are not claims of confirmed partnerships.

| Technology | Planned role |
| --- | --- |
| [Mastra](https://mastra.ai/) | Agent orchestration, tools, and workflows |
| [Neon](https://neon.com/) | Agent memory and structured data storage |
| [Assistant UI](https://www.assistant-ui.com/) | Conversational interface |
| [Exa](https://exa.ai/) | Web research for travel and healthcare logistics, using queries without identifiable health information |
| [Fly.io](https://fly.io/) | Application hosting and deployment |

## Planned hackathon MVP

- [ ] Conversational onboarding with a synthetic health profile.
- [ ] User-controlled agent memory.
- [ ] Daily lifestyle check-ins and configurable reminders.
- [ ] A hackathon preparation routine.
- [ ] A travel medication support workflow with source links.
- [ ] A doctor-ready health brief with review before sharing.
- [ ] Privacy controls and a documented data flow.

## Demo story

“I’m travelling for a hackathon next week. Help me prepare, keep me on track every day, and help me explain my health history if I need to see a doctor.”

Baymax turns that request into a preparation routine, daily check-ins, a medication travel checklist, and a health brief the user can review.

## Project status

**Frontend implemented.** Interactive UI flows and animated walkthroughs are ready for the hackathon. Sponsor backend integrations, real prescription fulfilment, email delivery, deployment, and compliance verification remain to be built.

## Medical boundaries

Baymax is intended to support organization, habits, and healthcare conversations. It does not replace a licensed healthcare professional, diagnose conditions, prescribe medication, or provide emergency care.

---

**Baymax: caring enough to remind you again.**

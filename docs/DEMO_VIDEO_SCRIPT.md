# Baymax: 3-minute demo video script

About 420 spoken words. Timings assume a calm pace. *[Brackets]* are on-screen actions.

---

## 1. Hook (0:00–0:30)

*[Black screen with text, or Jerel on camera]*

> You have an assistant for your calendar, your inbox, your code. But your health? That's still a mess of portals, PDFs and things you forgot to mention.
>
> It gets worse when you're travelling. You're in a new city, low on medication, seeing a doctor who knows nothing about you.
>
> We built Baymax: a personal medical agent that knows your context, nudges you every day, and helps when you're away from home.

---

## 2. Demo (0:30–2:05)

*[Open the app on Today]*

> This is Jordan's Today screen. Baymax asks how I'm feeling. *[tap check-in, pick "Low"]* That's a 5-second check-in, and it remembers it.

*[Go to chat and type: "How was my week?"]*

> I'll ask how my week went. The agent calls its tools and answers with live cards: water, movement, sleep and energy. *[point at a card]* This data comes straight from Apple Health through an iPhone Shortcut. If a reading is missing, Baymax says it's missing; it never treats it as zero.

*[Type: "I'm in Sydney next week and running low on metformin"]*

> Now I'm travelling and running low on my diabetes medication. Baymax searches the web *[source cards appear]* and every claim comes with a source. It shows me pharmacy options and prepares an order for me to review. It never prescribes or substitutes.

*[Type: "Write a brief for a new doctor"]*

> Then a brief for a doctor who's never met me: medications, allergies, recent labs. *[edit one line]* I edit it, I choose who gets it, and nothing is sent without me.

*[Show the phone: lock-screen reminders, then the installed app]*

> And it goes with me. Baymax installs on my phone, with gentle reminders for my medication, my refill and a ten-minute walk.

---

## 3. Stack and engineering (2:05–2:55)

*[Architecture slide or the site's stack section]*

> Under the hood:
>
> - **Mastra** runs the agent and about a dozen typed tools. Tool results render as interactive React cards through **Assistant UI**, so the agent responds with working UI, not just text.
> - **Neon** does two jobs: Postgres for state, and the AI Gateway for the model.
> - **Exa** handles research. Queries never include identifiable health information.
> - **Apple Health**: a signed iOS Shortcut posts to a token-authenticated endpoint. We store only the key's hash, validate every sample, and take one device per metric so a phone and a watch aren't double-counted.
>
> Privacy is built in: nothing is stored without opt-in, and one action deletes everything. Sessions are HttpOnly cookies, saves are origin-checked, and the health session is bound on the server, so a client can't request someone else's data.

---

## 4. Close (2:55–3:00)

> Baymax. Caring enough to remind you again.

---

## Notes for recording

- **Rehearse with the real app** and use Jordan's synthetic data only. Start the chat steps from a fresh conversation so cards appear quickly.
- **If you're short on time,** cut the doctor brief edit and shorten the reminders line. Keep the hook and the stack; the technical judges will weigh the stack section heavily.
- **Wording matches what's built.** The pharmacy step says "prepares an order for me to review" because ordering is a preview only, and push reminders are a recorded concept. Keep that wording so nothing overclaims.
- **The Apple Health line assumes data has been synced.** If Jordan's Health hasn't synced before recording, change it to "sample data, with Apple Health sync available".

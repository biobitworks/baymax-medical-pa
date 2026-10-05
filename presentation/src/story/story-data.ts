export const STORY_FPS = 30;
export const storySlides = [
  {
    id: "hook",
    title: "Hook",
    seconds: 25,
    time: "0:00–0:25",
    action: "Camera or title screen",
    beats: [
      { second: 0, label: "Scattered context" },
      { second: 8, label: "Away from home" },
      { second: 16, label: "Meet Baymax" },
    ],
    narration: [
      "You have an assistant for your calendar, your inbox, your code. But your health? That’s still a mess of portals, PDFs and things you forgot to mention.",
      "It gets worse when you’re travelling: a new city, low on medication, and a doctor who doesn’t know your history.",
      "We built Baymax: a personal medical agent that helps you keep your context together and prepare for what comes next.",
    ],
  },
  {
    id: "daily",
    title: "Daily care",
    seconds: 30,
    time: "0:25–0:55",
    action: "Today → select Low → Save check-in. Chat: “How was my week?”",
    beats: [
      { second: 0, label: "Today" },
      { second: 4, label: "Low" },
      { second: 7, label: "Saved" },
      { second: 11, label: "Ask about the week" },
      { second: 17, label: "Weekly cards" },
    ],
    narration: [
      "This is Jordan’s care space, using realistic fictional records. Baymax asks how I’m feeling. A few seconds, and my check-in is saved.",
      "Now I ask about my week. Baymax calls its tools and shows cards for energy, water, movement and sleep.",
      "We’re using sample readings here. Apple Health sync is available through an iPhone Shortcut, and missing readings stay unknown.",
    ],
  },
  {
    id: "travel",
    title: "Travel and medication",
    seconds: 30,
    time: "0:55–1:25",
    action:
      "Chat: “I’m in Sydney next week and running low on my recorded metformin prescription. Help me prepare a refill.” Show purchase card → Review purchase.",
    beats: [
      { second: 0, label: "Sydney request" },
      { second: 6, label: "Check recorded medication" },
      { second: 11, label: "Purchase options" },
      { second: 21, label: "Review purchase" },
    ],
    narration: [
      "Now I’m travelling and running low on an existing prescription.",
      "Baymax helps prepare pharmacy questions and purchase options for review. When research is available, it shows source links. Anything it can’t verify stays unverified.",
      "I can review the pharmacy, quantity and estimated cost. This prepares a purchase plan; it doesn’t send an order, prescribe or substitute medication.",
    ],
  },
  {
    id: "brief",
    title: "Doctor brief",
    seconds: 25,
    time: "1:25–1:50",
    action:
      "Chat: “Write a brief for a new doctor.” Edit one line → Create reviewed PDF.",
    beats: [
      { second: 0, label: "Request brief" },
      { second: 5, label: "Draft" },
      { second: 12, label: "Edit a line" },
      { second: 19, label: "Reviewed PDF" },
    ],
    narration: [
      "Next, a brief for a doctor who’s never met me: recorded medications, allergies and recent labs.",
      "I can edit it and create a PDF. I choose who receives it, attach the document and send it myself.",
    ],
  },
  {
    id: "computer",
    title: "Shared computer",
    seconds: 20,
    time: "1:50–2:10",
    action:
      "Computer → Files. Chat: “Read /workspace/fictional-care/doctor-visit.md and prepare a visit-summary.md.”",
    beats: [
      { second: 0, label: "Open Files" },
      { second: 3, label: "Read note" },
      { second: 7, label: "Prepare summary" },
      { second: 11, label: "Take over" },
      { second: 16, label: "Return control" },
    ],
    narration: [
      "Baymax also has a shared computer: a browser, isolated terminal and persistent files.",
      "It can turn my notes into a document I can inspect. I can take over the controls and return them to Baymax.",
    ],
  },
  {
    id: "engineering",
    title: "Engineering",
    seconds: 40,
    time: "2:10–2:50",
    action: "Architecture slide · Follow the highlighted path.",
    beats: [
      { second: 0, label: "Agent & interface" },
      { second: 10, label: "Storage & models" },
      { second: 20, label: "Research & health" },
      { second: 30, label: "User control" },
    ],
    narration: [
      "Mastra runs the agent and typed tools. Assistant UI turns tool results into interactive React cards.",
      "Neon Postgres stores opted-in care state. This setup uses OpenAI directly, with Neon AI Gateway supported as another model route.",
      "Exa provides web research using general queries without identifiable health details.",
      "The Apple Health Shortcut uses a token-authenticated endpoint, stores the token’s hash, and avoids double-counting device readings.",
      "Care-space saving is opt-in. Users review documents before sharing and see what the agent actually completed.",
    ],
  },
  {
    id: "close",
    title: "Close",
    seconds: 10,
    time: "2:50–3:00",
    action: "Installed app and recorded reminder concept → Baymax logo",
    beats: [
      { second: 0, label: "Care on the go" },
      { second: 6, label: "Baymax" },
    ],
    narration: [
      "Baymax can go with you as an installable app. This reminder concept shows where daily care goes next.",
      "Baymax. Caring enough to remind you again.",
    ],
  },
] as const;
export const STORY_DURATION = storySlides.reduce(
  (total, slide) => total + slide.seconds * STORY_FPS,
  0,
);
export type StoryId = (typeof storySlides)[number]["id"];

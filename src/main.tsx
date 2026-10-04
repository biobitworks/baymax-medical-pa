import React, {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
} from "react";
import { createRoot } from "react-dom/client";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  type ChatModelAdapter,
  makeAssistantToolUI,
} from "@assistant-ui/react";
import {
  ArrowUp,
  ArrowUpRight,
  Heart,
  LayoutDashboard,
  MessageCircle,
  Plane,
  FileText,
  ShieldCheck,
  Settings,
  Check,
  Plus,
  X,
  Droplets,
  Footprints,
  Moon,
  ChevronRight,
  Bell,
  Download,
  RotateCcw,
  Calendar,
  Sparkles,
  Menu,
  Mail,
} from "lucide-react";
import {
  DEFAULT_TRAVEL_CHECKLIST,
  formatDoctorBrief,
} from "./mastra/lib/brief";
import "./style.css";
import { PwaControls } from "./pwa/PwaControls";

function ModalShell({
  children,
  onClose,
  welcome = false,
}: {
  children: React.ReactNode;
  onClose?: () => void;
  welcome?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal-backdrop"
      aria-label={welcome ? "Welcome to Baymax" : "Baymax dialog"}
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
    >
      {children}
    </dialog>
  );
}
function Mascot({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={`mascot ${small ? "small" : ""}`}
      viewBox="0 0 300 330"
      role="img"
      aria-label="Baymax gently waving"
    >
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#e1e5e0" />
        </linearGradient>
      </defs>
      <ellipse cx="150" cy="308" rx="83" ry="12" fill="#294633" opacity=".09" />
      <g className="bay-body">
        <ellipse cx="124" cy="278" rx="28" ry="33" fill="url(#body)" />
        <ellipse cx="179" cy="278" rx="28" ry="33" fill="url(#body)" />
        <ellipse
          cx="151"
          cy="207"
          rx="82"
          ry="92"
          fill="url(#body)"
          stroke="#dbe0d9"
        />
        <ellipse
          cx="69"
          cy="210"
          rx="22"
          ry="64"
          transform="rotate(15 69 210)"
          fill="url(#body)"
        />
        <g className="wave">
          <ellipse
            cx="240"
            cy="157"
            rx="22"
            ry="64"
            transform="rotate(-35 240 157)"
            fill="url(#body)"
          />
          <ellipse cx="263" cy="109" rx="23" ry="27" fill="url(#body)" />
        </g>
        <ellipse
          cx="151"
          cy="105"
          rx="64"
          ry="44"
          fill="url(#body)"
          stroke="#e0e4df"
        />
        <path d="M126 106h50" stroke="#252f2c" strokeWidth="3" />
        <g className="eyes">
          <circle cx="123" cy="106" r="6" fill="#252f2c" />
          <circle cx="179" cy="106" r="6" fill="#252f2c" />
        </g>
        <circle cx="184" cy="169" r="9" fill="#f8faf7" stroke="#cbd3cb" />
        <path d="M180 169h8m-4-4v8" stroke="#b3beb2" />
      </g>
    </svg>
  );
}
// Mastra-backed adapter: streams text from the Baymax agent (proxied to the
// Mastra server by Vite at /api). Agent tool calls decide which care card to
// show; prescription and travel have no agent tool yet, so keywords pick them.
// Falls back to the fixture adapter if the agent server is unreachable.
const AGENT_STREAM_URL = "/api/agents/baymaxAgent/stream";
const TOOL_TO_CARD: Record<string, string> = {
  carePlanTool: "plan",
  doctorBriefTool: "brief",
};
const adapter: ChatModelAdapter = {
  async *run(options) {
    const { messages, abortSignal } = options;
    const history = messages
      .map((m) => ({
        role: m.role,
        content: m.content
          .filter((p) => p.type === "text")
          .map((p) => (p as { text: string }).text)
          .join(" "),
      }))
      .filter(
        (m) => (m.role === "user" || m.role === "assistant") && m.content,
      );
    const lastUser =
      history
        .filter((m) => m.role === "user")
        .at(-1)
        ?.content.toLowerCase() || "";
    let res: Response;
    try {
      res = await fetch(AGENT_STREAM_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: abortSignal,
      });
      if (!res.ok || !res.body) throw new Error(`agent ${res.status}`);
    } catch (err) {
      if (abortSignal.aborted) return;
      console.warn("Agent unavailable, using fixture responses.", err);
      yield* fixtureAdapter.run(options) as AsyncGenerator<never>;
      return;
    }

    let text = "";
    let cardKind: string | undefined;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        const line = event.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        let chunk: { type?: string; payload?: Record<string, unknown> };
        try {
          chunk = JSON.parse(line.slice(6));
        } catch {
          continue;
        }
        if (chunk.type === "text-delta") {
          text += String(chunk.payload?.text ?? "");
          yield { content: [{ type: "text", text }] };
        } else if (chunk.type === "tool-call") {
          cardKind = TOOL_TO_CARD[String(chunk.payload?.toolName)] ?? cardKind;
        }
      }
    }
    if (abortSignal.aborted) return;

    const keywordKind =
      lastUser.includes("diabet") ||
      lastUser.includes("refill") ||
      lastUser.includes("buy")
        ? "purchase"
        : lastUser.includes("travel") || lastUser.includes("prescription")
          ? "travel"
          : undefined;
    const kind = cardKind ?? keywordKind;
    if (!kind) return;
    const diabetes = lastUser.includes("diabet");
    yield {
      content: [
        { type: "text", text },
        {
          type: "tool-call",
          toolCallId: crypto.randomUUID(),
          toolName: "care_action",
          args: { kind, diabetes },
          argsText: JSON.stringify({ kind, diabetes }),
          result: { ready: true },
        },
      ],
    };
  },
};
// UI-first fixture adapter, kept as an offline fallback.
const fixtureAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal }) {
    const query =
      messages
        .at(-1)
        ?.content.filter((p) => p.type === "text")
        .map((p) => p.text)
        .join(" ")
        .toLowerCase() || "";
    const diabetes = query.includes("diabet");
    const kind =
      query.includes("doctor") || query.includes("brief")
        ? "brief"
        : diabetes || query.includes("buy") || query.includes("refill")
          ? "purchase"
          : query.includes("travel") ||
              query.includes("prescription") ||
              query.includes("medication")
            ? "travel"
            : query.includes("hackathon") || query.includes("plan")
              ? "plan"
              : "checkin";
    const responses = {
      purchase: `I’ve prepared a refill order preview for your prescribed ${diabetes ? "diabetes " : ""}medication. Review the steps below before anything is purchased.`,
      brief:
        "Let’s bring your context to your next doctor. Review and edit the brief below, then prepare an email. Nothing is shared automatically.",
      travel:
        "Let’s get your care ready for the trip. Bring your existing prescription and medication documents, and confirm refill requirements with a local clinician or pharmacist.",
      plan: "Let’s make room for you in the build schedule. Choose your date and check off a small win. Meals, movement, and a wind-down break belong on the plan, too.",
      checkin: query.includes("sleep")
        ? "A busy brain deserves a softer landing. Let’s check in on your energy and make space for a wind-down break."
        : "I’m here. A small step counts. Let’s check in with your energy and take one thing at a time.",
    };
    const text = responses[kind];
    for (let i = 0; i < text.length; i += 18) {
      await new Promise((resolve) => setTimeout(resolve, 35));
      if (abortSignal.aborted) return;
      yield { content: [{ type: "text", text: text.slice(0, i + 18) }] };
    }
    if (abortSignal.aborted) return;
    yield {
      content: [
        { type: "text", text },
        {
          type: "tool-call",
          toolCallId: crypto.randomUUID(),
          toolName: "care_action",
          args: { kind, diabetes },
          argsText: JSON.stringify({ kind, diabetes }),
          result: { ready: true },
        },
      ],
    };
  },
};
type CareState = {
  done: string[];
  toggle: (s: string) => void;
  date: string;
  setDate: (s: string) => void;
  goal: string;
  setGoal: (s: string) => void;
  city: string;
  setCity: (s: string) => void;
  travelDate: string;
  setTravelDate: (s: string) => void;
  brief: string;
  setBrief: (s: string) => void;
  recipient: string;
  setRecipient: (s: string) => void;
  subject: string;
  setSubject: (s: string) => void;
  reviewEmail: () => void;
  checkin: () => void;
};
const CareContext = createContext<CareState | null>(null);
function CareCard({
  kind,
  diabetes = false,
}: {
  kind: string;
  diabetes?: boolean;
}) {
  const c = useContext(CareContext)!;
  const [approved, setApproved] = useState(false);
  const [ordered, setOrdered] = useState(false);
  return (
    <div className="agent-card">
      <div className="agent-card-top">
        <span className="agent-symbol">✦</span>
        <span>
          {kind === "purchase"
            ? "PRESCRIPTION CONCIERGE"
            : kind === "brief"
              ? "DOCTOR BRIEF"
              : kind === "travel"
                ? "TRAVEL CARE"
                : kind === "plan"
                  ? "YOUR PREPARATION PLAN"
                  : "DAILY CARE"}
        </span>
        <span className="agent-status">
          <span className="tiny-dot" />
          {kind === "purchase" ? "Order preview" : "Ready for you"}
        </span>
      </div>
      {kind === "purchase" ? (
        <>
          <div className="order-title">
            <span className="stat-icon green">
              <Heart size={21} />
            </span>
            <div>
              <h3>Your {diabetes ? "diabetes " : ""}medication refill</h3>
              <p>Continuing your existing prescription while travelling</p>
            </div>
          </div>
          <div className="order-steps">
            {[
              "Prepare existing prescription details",
              "Match a licensed local pharmacy",
              "Verify prescription with a pharmacist",
              "Review medication, price, and fulfilment",
            ].map((step, i) => (
              <div key={step}>
                <span className={i < 2 ? "step ready" : "step"}>
                  {i < 2 ? <Check size={12} /> : i + 1}
                </span>
                <span>
                  {step}
                  <small>
                    {i < 2
                      ? "Preview prepared"
                      : i === 2
                        ? "Professional verification required"
                        : "Your approval required"}
                  </small>
                </span>
              </div>
            ))}
          </div>
          <div className="order-summary">
            <span>
              Medication<b>As prescribed by your clinician</b>
            </span>
            <span>
              Delivery<b>Confirm with pharmacy</b>
            </span>
            <span>
              Total<b>Awaiting pharmacy quote</b>
            </span>
          </div>
          {ordered ? (
            <div className="order-success">
              <Check size={18} />
              <div>
                <b>Order journey previewed</b>
                <small>
                  No purchase has been made. A pharmacy must verify and fulfil
                  the prescription.
                </small>
              </div>
            </div>
          ) : (
            <>
              <label className="consent">
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(e) => setApproved(e.target.checked)}
                />
                I want to review the purchase journey for my existing
                prescription.
              </label>
              <button
                className="primary"
                disabled={!approved}
                onClick={() => setOrdered(true)}
              >
                Preview order confirmation <ArrowUpRight size={15} />
              </button>
              <p className="fine">
                No purchase yet. Prescription verification and payment happen
                with a licensed pharmacy.
              </p>
            </>
          )}
        </>
      ) : kind === "plan" ? (
        <>
          <h3>Build something great. Feel good doing it.</h3>
          <div className="inline-fields">
            <label>
              Event
              <input
                value={c.goal}
                onChange={(e) => c.setGoal(e.target.value)}
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={c.date}
                onChange={(e) => c.setDate(e.target.value)}
              />
            </label>
          </div>
          {[
            "Take a 10-minute walk",
            "Make time for a real meal",
            "Set a wind-down reminder",
          ].map((t) => (
            <button className="task" onClick={() => c.toggle(t)} key={t}>
              <span className={`check ${c.done.includes(t) ? "checked" : ""}`}>
                {c.done.includes(t) && <Check size={13} />}
              </span>
              <b>{t}</b>
            </button>
          ))}
          <button className="text-btn" onClick={c.checkin}>
            Check in for today <ArrowUpRight size={15} />
          </button>
        </>
      ) : kind === "travel" ? (
        <>
          <h3>Your care, packed and ready.</h3>
          <div className="inline-fields">
            <label>
              Destination
              <input
                value={c.city}
                onChange={(e) => c.setCity(e.target.value)}
              />
            </label>
            <label>
              Departure
              <input
                type="date"
                value={c.travelDate}
                onChange={(e) => c.setTravelDate(e.target.value)}
              />
            </label>
          </div>
          {[
            "Bring prescription and medication packaging",
            "Prepare a doctor brief",
            "Confirm remaining supply with your clinician",
          ].map((t) => (
            <button className="task" onClick={() => c.toggle(t)} key={t}>
              <span className={`check ${c.done.includes(t) ? "checked" : ""}`}>
                {c.done.includes(t) && <Check size={13} />}
              </span>
              <b>{t}</b>
            </button>
          ))}
        </>
      ) : kind === "brief" ? (
        <>
          <h3>A little context for your doctor.</h3>
          <label>
            Review your brief
            <textarea
              value={c.brief}
              onChange={(e) => c.setBrief(e.target.value)}
              className="chat-brief"
            />
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              c.reviewEmail();
            }}
          >
            <label>
              Doctor’s email
              <input
                type="email"
                required
                placeholder="doctor@example.org"
                value={c.recipient}
                onChange={(e) => c.setRecipient(e.target.value)}
              />
            </label>
            <button type="submit" className="primary">
              <Mail size={16} />
              Review email to doctor
            </button>
          </form>
          <p className="fine">
            You review the recipient and choose when to send.
          </p>
        </>
      ) : (
        <>
          <h3>You deserve a moment, too.</h3>
          <p>
            Let’s check in with your energy and make a little space for you.
          </p>
          <button className="primary" onClick={c.checkin}>
            Start my check-in <Heart size={15} />
          </button>
        </>
      )}
    </div>
  );
}
const CareTool = makeAssistantToolUI<
  { kind: string; diabetes?: boolean },
  { ready: boolean }
>({
  toolName: "care_action",
  render: ({ args }) => <CareCard kind={args.kind} diabetes={args.diabetes} />,
});
function UserMessage() {
  return (
    <MessagePrimitive.Root className="message user">
      <MessagePrimitive.Content />
    </MessagePrimitive.Root>
  );
}
function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="message assistant">
      <span className="assistant-label">✦ Baymax</span>
      <MessagePrimitive.Content />
    </MessagePrimitive.Root>
  );
}
function Chat() {
  const runtime = useLocalRuntime(adapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <CareTool />
      <ThreadPrimitive.Root className="chat">
        <ThreadPrimitive.Viewport className="transcript">
          <ThreadPrimitive.Empty>
            <div className="chat-welcome">
              <Mascot small />
              <h2>Hello. I am Baymax.</h2>
              <p>Your personal care companion. What’s on your mind?</p>
              <div className="suggestions">
                {[
                  "Help me prepare for a hackathon",
                  "I need a diabetes medication refill while travelling",
                  "Draft and email a brief to my doctor",
                ].map((s) => (
                  <ThreadPrimitive.Suggestion
                    key={s}
                    prompt={s}
                    method="replace"
                    autoSend
                  >
                    {s}
                    <ArrowUpRight size={16} />
                  </ThreadPrimitive.Suggestion>
                ))}
              </div>
            </div>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages
            components={{ UserMessage, AssistantMessage }}
          />
        </ThreadPrimitive.Viewport>
        <div className="quick-actions">
          {[
            { label: "Daily plan", prompt: "Help me prepare for a hackathon" },
            {
              label: "Prescription",
              prompt: "I need a diabetes medication refill while travelling",
            },
            {
              label: "Doctor brief",
              prompt: "Draft and email a brief to my doctor",
            },
          ].map((a) => (
            <ThreadPrimitive.Suggestion
              key={a.label}
              prompt={a.prompt}
              method="replace"
              autoSend
            >
              {a.label}
            </ThreadPrimitive.Suggestion>
          ))}
        </div>
        <ComposerPrimitive.Root className="composer">
          <ComposerPrimitive.Input
            placeholder="Tell Baymax what you need…"
            aria-label="Message Baymax"
          />
          <ThreadPrimitive.If running={false}>
            <ComposerPrimitive.Send className="send" aria-label="Send message">
              <ArrowUp size={19} />
            </ComposerPrimitive.Send>
          </ThreadPrimitive.If>
          <ThreadPrimitive.If running>
            <ComposerPrimitive.Cancel
              className="send"
              aria-label="Stop response"
            >
              <X size={19} />
            </ComposerPrimitive.Cancel>
          </ThreadPrimitive.If>
        </ComposerPrimitive.Root>
        <p className="fine center">A little care. Always in your control.</p>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
const nav = [
  ["Today", LayoutDashboard],
  ["Talk to Baymax", MessageCircle],
  ["Your plan", Calendar],
  ["Travel care", Plane],
  ["Doctor brief", FileText],
] as const;
function App() {
  const [page, setPage] = useState("Talk to Baymax");
  const [modal, setModal] = useState("");
  const [name, setName] = useState("Alex");
  const [ready, setReady] = useState(false);
  const [energy, setEnergy] = useState("");
  const [done, setDone] = useState<string[]>([]);
  const [water, setWater] = useState(3);
  const [reminders, setReminders] = useState(true);
  const [nudge, setNudge] = useState("Gentle");
  const [city, setCity] = useState("San Francisco");
  const [travelDate, setTravelDate] = useState("2026-10-09");
  const [date, setDate] = useState("2026-10-10");
  const [goal, setGoal] = useState("Build Personal Agents Hackathon");
  const [brief, setBrief] = useState(
    "MY HEALTH BRIEF — review and complete before sharing\n\nPatient: [Your name]\nReason for visit: Establishing care while travelling.\nMedications: [Add your prescribed medication and dose.]\nAllergies: Not yet confirmed.\nRelevant history: Not yet confirmed.\nQuestions: What records do you need? How can I arrange follow-up care?",
  );
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("My health brief for our appointment");
  const [emailConsent, setEmailConsent] = useState(false);
  const [toast, setToast] = useState("");
  const [tripReady, setTripReady] = useState(false);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [mobile, setMobile] = useState(false);
  const toggle = (s: string) =>
    setDone((d) => (d.includes(s) ? d.filter((x) => x !== s) : [...d, s]));
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 3500);
  };
  const download = () => {
    const u = URL.createObjectURL(new Blob([brief], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = u;
    a.download = "baymax-doctor-brief.txt";
    a.click();
    URL.revokeObjectURL(u);
    notify("Your reviewed brief has been downloaded.");
  };
  const postTravel = async (path: string, body: object) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    return res.json();
  };
  const prepareChecklist = async () => {
    const destination = city.trim();
    if (!destination) {
      notify("Add a destination so Baymax can prepare your checklist.");
      return;
    }
    setTripReady(true);
    setChecklistLoading(true);
    try {
      const data = await postTravel("/travel/checklist", {
        destination,
        departureDate: travelDate,
      });
      setChecklist(data.items);
    } catch (err) {
      console.warn("Agent unavailable, using default checklist.", err);
      setChecklist(DEFAULT_TRAVEL_CHECKLIST);
    } finally {
      setChecklistLoading(false);
    }
  };
  const openTravelBrief = async () => {
    const destination = city.trim();
    go("Doctor brief");
    setBriefLoading(true);
    try {
      const data = await postTravel("/travel/brief", {
        destination,
        departureDate: travelDate,
        checklist,
      });
      setBrief(data.brief);
    } catch (err) {
      console.warn("Agent unavailable, using template brief.", err);
      setBrief(
        formatDoctorBrief({
          reason: `Establishing care while travelling to ${destination}.`,
          questions: [
            "What records do you need from me?",
            "How can I arrange follow-up care while I am away?",
          ],
        }),
      );
    } finally {
      setBriefLoading(false);
    }
  };
  const go = (s: string) => {
    setPage(s);
    setMobile(false);
  };
  return (
    <CareContext.Provider
      value={{
        done,
        toggle,
        date,
        setDate,
        goal,
        setGoal,
        city,
        setCity,
        travelDate,
        setTravelDate,
        brief,
        setBrief,
        recipient,
        setRecipient,
        subject,
        setSubject,
        reviewEmail: () => {
          setEmailConsent(false);
          setModal("email");
        },
        checkin: () => setModal("checkin"),
      }}
    >
      <div className={`app ${page === "Talk to Baymax" ? "chat-first" : ""}`}>
        <aside className={mobile ? "sidebar open" : "sidebar"}>
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              go("Today");
            }}
          >
            <span className="logo-face">●―●</span> baymax
            <span className="brand-dot">.</span>
          </a>
          <div className="workspace">
            <span className="tiny-dot" /> YOUR PERSONAL CARE SPACE
          </div>
          <nav>
            {nav.map(([s, I]) => (
              <button
                key={s}
                className={page === s ? "nav active" : "nav"}
                onClick={() => go(s)}
              >
                <I size={19} />
                {s}
                {s === "Talk to Baymax" && <span className="new-dot" />}
              </button>
            ))}
          </nav>
          <div className="side-bottom">
            <div className="care-note">
              <Heart size={18} />
              <p>
                A little care.
                <br />
                Every single day.
              </p>
            </div>
            <button className="nav" onClick={() => go("Privacy & preferences")}>
              <ShieldCheck size={19} />
              Privacy & preferences
            </button>
            <button className="profile" onClick={() => setModal("profile")}>
              <span className="avatar">{name[0]?.toUpperCase()}</span>
              <span>
                {name}
                <small>Your health profile</small>
              </span>
              <Settings size={16} />
            </button>
          </div>
        </aside>
        <main>
          <header>
            <button
              className="mobile-menu icon"
              aria-label="Open navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={21} />
            </button>
            <button
              className="agent-header"
              onClick={() => setModal("checkin")}
              aria-label="Baymax daily check-in"
            >
              <Mascot small />
              <b>Baymax</b>
              <small>Here when you need me</small>
            </button>
            <button
              className="icon"
              aria-label="Reminder settings"
              onClick={() => go("Privacy & preferences")}
            >
              <Bell size={20} />
            </button>
          </header>
          <div className="content">
            <div className="page-heading">
              <div>
                <p className="eyebrow">A LITTLE CARE GOES A LONG WAY</p>
                <h1>
                  {page === "Today"
                    ? `Good morning, ${name}.`
                    : page === "Talk to Baymax"
                      ? "Let’s talk."
                      : page === "Your plan"
                        ? "Make space for yourself."
                        : page === "Travel care"
                          ? "Care, wherever you go."
                          : page === "Doctor brief"
                            ? "Your story. A little clearer."
                            : "Your care. Your rules."}
                </h1>
                <p>
                  {page === "Today"
                    ? "You’re building something great. Let’s take care of you, too."
                    : page === "Talk to Baymax"
                      ? "No judgment. Just a companion in your corner."
                      : page === "Your plan"
                        ? "Small, sustainable steps for the days ahead."
                        : page === "Travel care"
                          ? "A little preparation makes a new place feel less unfamiliar."
                          : page === "Doctor brief"
                            ? "Bring your context to your next conversation with a doctor."
                            : "Choose what Baymax remembers and how often it checks in."}
                </p>
              </div>
              {page === "Today" && (
                <button className="outline" onClick={() => setModal("checkin")}>
                  Daily check-in <ArrowUpRight size={16} />
                </button>
              )}
            </div>
            {page === "Today" && (
              <>
                <section className="hero">
                  <div className="hero-copy">
                    <span className="pill">
                      <Sparkles size={13} /> YOUR COMPANION, CHECKING IN
                    </span>
                    <h2>
                      How are you feeling
                      <br />
                      on the inside?
                    </h2>
                    <p>
                      You remembered your laptop charger.
                      <br />
                      Did you remember to recharge yourself?
                    </p>
                    <button
                      className="primary"
                      onClick={() => setModal("checkin")}
                    >
                      {energy
                        ? "Update your check-in"
                        : "Let’s do a quick check-in"}
                      <ArrowUpRight size={17} />
                    </button>
                    <span className="hero-foot">
                      About 30 seconds. Just for you.
                    </span>
                  </div>
                  <div className="mascot-wrap">
                    <span className="speech">
                      I care about your battery, too.
                    </span>
                    <Mascot />
                    <span className="mascot-caption">
                      BAYMAX IS HERE FOR YOU <span className="tiny-dot" />
                    </span>
                  </div>
                </section>
                <div className="section-heading">
                  <h2>
                    Your little wins today <span>ONE STEP AT A TIME</span>
                  </h2>
                  <button className="text-btn" onClick={() => go("Your plan")}>
                    View your plan <ArrowUpRight size={15} />
                  </button>
                </div>
                <div className="stats">
                  <article className="stat">
                    <div className="stat-top">
                      <span className="stat-icon blue">
                        <Droplets size={20} />
                      </span>
                      <span>HYDRATION</span>
                      <button
                        className="icon"
                        aria-label="Add one glass of water"
                        onClick={() => setWater(Math.min(8, water + 1))}
                      >
                        <Plus size={17} />
                      </button>
                    </div>
                    <h3>
                      {water}
                      <small> / 8 glasses</small>
                    </h3>
                    <div className="water-bars">
                      {Array.from({ length: 8 }, (_, i) => (
                        <i key={i} className={i < water ? "filled" : ""} />
                      ))}
                    </div>
                    <p>A sip now is a little win.</p>
                  </article>
                  <article className="stat">
                    <div className="stat-top">
                      <span className="stat-icon orange">
                        <Footprints size={20} />
                      </span>
                      <span>MOVEMENT</span>
                    </div>
                    <h3>
                      {done.includes("Take a 10-minute walk") ? "10" : "0"}
                      <small> / 10 minutes</small>
                    </h3>
                    <div className="track">
                      <i
                        style={{
                          width: done.includes("Take a 10-minute walk")
                            ? "100%"
                            : "0%",
                        }}
                      />
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => toggle("Take a 10-minute walk")}
                    >
                      {done.includes("Take a 10-minute walk")
                        ? "Walk completed ✓"
                        : "Log a little walk"}{" "}
                      <ArrowUpRight size={14} />
                    </button>
                  </article>
                  <article className="stat">
                    <div className="stat-top">
                      <span className="stat-icon purple">
                        <Moon size={20} />
                      </span>
                      <span>YOUR ENERGY</span>
                    </div>
                    <h3>
                      {energy || "Let’s check"}
                      <small>{energy ? " today" : ""}</small>
                    </h3>
                    <p>You don’t have to be at 100%.</p>
                    <button
                      className="text-btn"
                      onClick={() => setModal("checkin")}
                    >
                      {energy ? "Update check-in" : "How did you sleep?"}
                      <ArrowUpRight size={14} />
                    </button>
                  </article>
                </div>
                <div className="lower-grid">
                  <section className="panel">
                    <div className="section-heading">
                      <h2>A little nudge</h2>
                      <span className="muted">2 FOR TODAY</span>
                    </div>
                    {["Take a 10-minute walk", "Make time for a real meal"].map(
                      (s, i) => (
                        <button
                          className="task"
                          key={s}
                          onClick={() => toggle(s)}
                        >
                          <span
                            className={`check ${done.includes(s) ? "checked" : ""}`}
                          >
                            {done.includes(s) && <Check size={13} />}
                          </span>
                          <span>
                            <b className={done.includes(s) ? "struck" : ""}>
                              {s}
                            </b>
                            <small>
                              {i === 0
                                ? "Step away from your screen. Your idea will wait."
                                : "Your brain is doing a lot. Give it some fuel."}
                            </small>
                          </span>
                          <span className="task-time">
                            {i === 0 ? "ANYTIME" : "LUNCH"}
                          </span>
                        </button>
                      ),
                    )}
                  </section>
                  <section className="panel journey">
                    <span className="stat-icon green">
                      <Plane size={20} />
                    </span>
                    <h2>Going somewhere?</h2>
                    <p>
                      Take your care with you. Get your medication checklist and
                      doctor brief ready.
                    </p>
                    <button
                      className="text-btn"
                      onClick={() => go("Travel care")}
                    >
                      Prepare for a trip <ArrowUpRight size={15} />
                    </button>
                  </section>
                </div>
              </>
            )}
            <section
              hidden={page !== "Talk to Baymax"}
              className="panel chat-panel"
            >
              <Chat />
            </section>
            {page === "Your plan" && (
              <div className="two-col">
                <section className="panel">
                  <span className="eyebrow">YOUR NEXT BIG THING</span>
                  <h2>{goal}</h2>
                  <p className="muted">
                    A preparation plan that puts your wellbeing on the calendar.
                  </p>
                  <label>
                    Event name
                    <input
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                    />
                  </label>
                  <label>
                    Event date
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                  <p className="notice">
                    Your plan is here whenever you need a little nudge.
                  </p>
                </section>
                <section className="panel">
                  <h2>Your daily preparation</h2>
                  {[
                    "Take a 10-minute walk",
                    "Make time for a real meal",
                    "Pack medication documents",
                    "Set a wind-down reminder",
                    "Schedule your next routine checkup",
                  ].map((s) => (
                    <button className="task" key={s} onClick={() => toggle(s)}>
                      <span
                        className={`check ${done.includes(s) ? "checked" : ""}`}
                      >
                        {done.includes(s) && <Check size={13} />}
                      </span>
                      <b>{s}</b>
                    </button>
                  ))}
                  <button
                    className="primary"
                    onClick={() => setModal("checkin")}
                  >
                    Check in for today <Heart size={16} />
                  </button>
                </section>
              </div>
            )}
            {page === "Travel care" && (
              <>
                <div className="two-col">
                  <section className="panel">
                    <span className="eyebrow">YOUR TRAVEL DETAILS</span>
                    <h2>Let’s get you ready.</h2>
                    <label>
                      Destination
                      <input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City, country"
                      />
                    </label>
                    <label>
                      Departure date
                      <input
                        type="date"
                        value={travelDate}
                        onChange={(e) => setTravelDate(e.target.value)}
                      />
                    </label>
                    <div className="notice">
                      <ShieldCheck size={18} />
                      <p>
                        Your checklist helps you prepare. Confirm local
                        requirements directly with your pharmacy.
                      </p>
                    </div>
                    <button
                      className="primary"
                      onClick={prepareChecklist}
                      disabled={checklistLoading}
                    >
                      Prepare checklist <ArrowUpRight size={16} />
                    </button>
                  </section>
                  <section
                    className={`panel slide-panel ${tripReady ? "revealed" : ""}`}
                    aria-hidden={!tripReady}
                    aria-live="polite"
                  >
                    <span className="eyebrow">MEDICATION TRAVEL CHECKLIST</span>
                    <h2>A few things to bring.</h2>
                    {checklistLoading && (
                      <>
                        <div className="skeleton-line" />
                        <div className="skeleton-line" />
                        <div className="skeleton-line" />
                        <div className="skeleton-line" />
                      </>
                    )}
                    {(checklistLoading ? [] : checklist).map((s) => (
                      <button
                        className="task"
                        key={s}
                        onClick={() => toggle(s)}
                      >
                        <span
                          className={`check ${done.includes(s) ? "checked" : ""}`}
                        >
                          {done.includes(s) && <Check size={13} />}
                        </span>
                        <span>
                          <b>{s}</b>
                        </span>
                      </button>
                    ))}
                    <p className="fine">
                      Local requirements and medication availability need
                      professional confirmation. Baymax does not prescribe or
                      recommend substitutions.
                    </p>
                    <button
                      className="primary cta-brief"
                      onClick={openTravelBrief}
                      disabled={checklistLoading}
                    >
                      Open doctor brief <ArrowUpRight size={16} />
                    </button>
                  </section>
                </div>
              </>
            )}
            {page === "Doctor brief" && (
              <div className="two-col">
                <section className="panel brief-panel">
                  <span className="eyebrow">REVIEW BEFORE YOU SHARE</span>
                  <h2>A brief for your next doctor.</h2>
                  <label>
                    Editable health brief
                    <textarea
                      className="brief"
                      value={
                        briefLoading
                          ? "Baymax is drafting your brief..."
                          : brief
                      }
                      disabled={briefLoading}
                      aria-busy={briefLoading}
                      onChange={(e) => setBrief(e.target.value)}
                    />
                  </label>
                  <button
                    className="outline"
                    onClick={download}
                    disabled={briefLoading}
                  >
                    <Download size={17} />
                    Download a copy
                  </button>
                </section>
                <section className="panel">
                  <ShieldCheck className="green-text" size={30} />
                  <h2>Email your doctor.</h2>
                  <p>
                    Verify medications, allergies, dates, and history before
                    sharing your brief.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setEmailConsent(false);
                      setModal("email");
                    }}
                  >
                    <label>
                      Doctor’s email address
                      <input
                        type="email"
                        required
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        placeholder="doctor@example.org"
                      />
                    </label>
                    <label>
                      Email subject
                      <input
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </label>
                    <button className="primary" type="submit">
                      <Mail size={16} />
                      Review email
                    </button>
                  </form>
                  <div className="notice">
                    Review the recipient and brief first. Opens a draft in your
                    email app. You choose when to send.
                  </div>
                  <button
                    className="text-btn"
                    onClick={() => go("Talk to Baymax")}
                  >
                    Talk it through with Baymax <ArrowUpRight size={15} />
                  </button>
                </section>
              </div>
            )}
            {page === "Privacy & preferences" && (
              <div className="two-col">
                <section className="panel">
                  <h2>How should I check in?</h2>
                  <button
                    className="toggle-row"
                    onClick={() => setReminders(!reminders)}
                  >
                    <span>
                      <b>In-app nudges</b>
                      <small>A little encouragement while you’re here.</small>
                    </span>
                    <span
                      role="switch"
                      aria-checked={reminders}
                      className={`switch ${reminders ? "on" : ""}`}
                    />
                  </button>
                  <label>
                    Nudge style
                    <select
                      value={nudge}
                      onChange={(e) => setNudge(e.target.value)}
                    >
                      <option>Gentle</option>
                      <option>A little persistent</option>
                      <option>Only when I ask</option>
                    </select>
                  </label>
                  <p className="notice">
                    Preference saved for this session:{" "}
                    {reminders ? nudge : "Nudges off"}. Your preferences apply
                    while you’re here.
                  </p>
                </section>
                <section className="panel">
                  <ShieldCheck className="green-text" size={30} />
                  <h2>Privacy comes first.</h2>
                  <p>
                    Your information stays in this session. Refreshing clears
                    your profile, check-ins, and conversations.
                  </p>
                  <p className="fine">
                    Choose what you share. Review any brief before opening it in
                    your email app.
                  </p>
                  <button
                    className="outline"
                    onClick={() => {
                      setModal("reset");
                    }}
                  >
                    <RotateCcw size={15} />
                    Reset my session
                  </button>
                </section>
              </div>
            )}
            <footer>
              <span>
                <ShieldCheck size={14} /> A little care, in your control.
              </span>
              <span>Built with care · Baymax</span>
            </footer>
          </div>
          <nav className="bottom-nav" aria-label="Main navigation">
            {[nav[1], nav[0], nav[2], nav[3], nav[4]].map(([item, I]) => (
              <button
                key={item}
                aria-label={item}
                title={item}
                className={page === item ? "active" : ""}
                onClick={() => go(item)}
              >
                <I size={22} />
              </button>
            ))}
          </nav>
        </main>
        {mobile && (
          <button
            className="drawer-shade"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          />
        )}{" "}
        {!ready && (
          <ModalShell welcome>
            <section className="modal welcome">
              <Mascot small />
              <span className="eyebrow">MEET YOUR CARE COMPANION</span>
              <h2>
                A little annoying.
                <br />A lot of love.
              </h2>
              <p>
                I’m Baymax. I’ll help you make room for your health, even when
                life gets busy.
              </p>
              <label>
                What should I call you?
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={30}
                />
              </label>
              <p className="fine">
                Your space, your pace. You choose what to share.
              </p>
              <button
                className="primary"
                onClick={() => {
                  setName(name.trim() || "Alex");
                  setReady(true);
                }}
              >
                Let’s take care of you <ArrowUpRight size={16} />
              </button>
            </section>
          </ModalShell>
        )}
        {modal && (
          <ModalShell onClose={() => setModal("")}>
            <section className="modal">
              <button
                className="close icon"
                aria-label="Close dialog"
                onClick={() => setModal("")}
              >
                <X />
              </button>
              {modal === "checkin" ? (
                <>
                  <span className="eyebrow">YOUR DAILY CHECK-IN</span>
                  <h2>How’s your energy?</h2>
                  <p>There’s no wrong answer. Start where you are.</p>
                  <div className="energy-options">
                    {["Low", "Okay", "Good", "Great"].map((s, i) => (
                      <button
                        className={energy === s ? "selected" : ""}
                        onClick={() => setEnergy(s)}
                        key={s}
                      >
                        <span>{["☁", "◒", "☀", "✦"][i]}</span>
                        {s}
                      </button>
                    ))}
                  </div>
                  <button
                    className="primary"
                    disabled={!energy}
                    onClick={() => {
                      setModal("");
                      notify(
                        "Check-in complete. Thank you for making a little time for yourself.",
                      );
                    }}
                  >
                    Save my check-in <Check size={16} />
                  </button>
                </>
              ) : modal === "email" ? (
                <>
                  <span className="eyebrow">REVIEW BEFORE SENDING</span>
                  <h2>Your doctor’s email.</h2>
                  <p>
                    <b>To:</b> {recipient}
                    <br />
                    <b>Subject:</b> {subject}
                  </p>
                  <pre className="email-preview">{brief}</pre>
                  <label className="consent">
                    <input
                      type="checkbox"
                      checked={emailConsent}
                      onChange={(e) => setEmailConsent(e.target.checked)}
                    />
                    I reviewed the recipient and approve including this brief in
                    an email draft.
                  </label>
                  {emailConsent ? (
                    <a
                      className="primary email-link"
                      href={`mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(brief)}`}
                    >
                      <Mail size={16} />
                      Open email app
                    </a>
                  ) : (
                    <button className="primary" disabled>
                      <Mail size={16} />
                      Open email app
                    </button>
                  )}
                  <p className="fine">
                    Not sent yet. Your email app handles the final send. If no
                    email app is configured, copy the brief into your preferred
                    email service.
                  </p>
                </>
              ) : modal === "profile" ? (
                <>
                  <h2>Your profile</h2>
                  <label>
                    Display name
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={30}
                    />
                  </label>
                  <button
                    className="primary"
                    onClick={() => {
                      setName(name.trim() || "Alex");
                      setModal("");
                    }}
                  >
                    Save name
                  </button>
                </>
              ) : (
                <>
                  <h2>Start fresh?</h2>
                  <p>
                    This clears your check-ins, tasks, and preferences. Your
                    downloaded brief stays on your device.
                  </p>
                  <button
                    className="primary"
                    onClick={() => window.location.reload()}
                  >
                    Reset session
                  </button>
                </>
              )}
            </section>
          </ModalShell>
        )}
        {toast && (
          <div role="status" className="toast">
            <Check size={17} />
            {toast}
          </div>
        )}
      </div>
    </CareContext.Provider>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <PwaControls />
  </React.StrictMode>,
);

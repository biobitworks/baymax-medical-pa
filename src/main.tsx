import React, {
  useState,
  useMemo,
  useCallback,
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
  type ExportedMessageRepository,
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
import { initializeHealthOverview } from "./persistence/health-overview";
import { createAgentAdapter } from "./chat/adapter";
import { applyToolResult, historicalCard } from "./chat/cards";
import { useCareWorkspace } from "./persistence/use-care-workspace";
import { type CareWorkspace, type StoredConversation } from "./shared/workspace";
import Mascot, { MascotActivity } from "./Mascot";

const GLASS_ML = 250;
const WATER_GOAL = 8;
const MOVEMENT_GOAL = 30;

type HealthOverview = {
  today: { date: string; hydrationMl: number; activeMinutes: number };
  todayCheckin: { date: string; energy: string } | null;
  metrics: { date: string; hydrationMl: number; activeMinutes: number }[];
  checkins: { date: string; energy: string }[];
};

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
type CareState = {
  activePlanId: string | null;
  activeBriefId: string | null;
  activateCard: (kind: "plan" | "brief", result: unknown, toolCallId: string) => void;
  planItems: CareWorkspace["planItems"];
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
  toolCallId,
  result,
}: {
  kind: string;
  diabetes?: boolean;
  toolCallId: string;
  result: unknown;
}) {
  const c = useContext(CareContext)!;
  const [approved, setApproved] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const snapshot = historicalCard(c, kind, toolCallId, result);
  if (snapshot) return (
    <div className="agent-card">
      <div className="agent-card-top"><span className="agent-symbol">✦</span><span>{snapshot.kind === "plan" ? "EARLIER PLAN" : "EARLIER DOCTOR BRIEF"}</span></div>
      {snapshot.kind === "plan" ? <><h3>{snapshot.data.title}</h3>{snapshot.data.items.map((item, index) => <p key={index}>{item.done ? "✓ " : "○ "}{item.label}{item.when ? ` · ${item.when}` : ""}</p>)}</> : <textarea className="chat-brief" aria-label="Earlier doctor brief" readOnly value={snapshot.data.brief} />}
      <button className="outline" onClick={() => c.activateCard(snapshot.kind, snapshot.data, toolCallId)}>Use this {snapshot.kind === "plan" ? "plan" : "brief"}</button>
    </div>
  );
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
          <h3>{c.goal}</h3>
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
          {c.planItems.map(({ label: t, when }) => (
            <button className="task" onClick={() => c.toggle(t)} key={t}>
              <span className={`check ${c.done.includes(t) ? "checked" : ""}`}>
                {c.done.includes(t) && <Check size={13} />}
              </span>
              <span><b>{t}</b>{when && <small>{when}</small>}</span>
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
  unknown
>({
  toolName: "care_action",
  render: ({ args, result, toolCallId }) => <CareCard kind={args.kind} diabetes={args.diabetes} result={result} toolCallId={toolCallId} />,
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
      <MessagePrimitive.Error>
        <p role="alert" className="notice">Baymax couldn’t complete that response. Please try sending your message again.</p>
      </MessagePrimitive.Error>
    </MessagePrimitive.Root>
  );
}
function Chat({ conversation, onConversation, onToolResult, workspace }: {
  conversation: StoredConversation;
  onConversation: (conversation: StoredConversation) => void;
  onToolResult: (kind: "plan" | "brief", result: unknown, toolCallId: string) => void;
  workspace: CareWorkspace;
}) {
  const current = useRef({ workspace, onToolResult, onConversation });
  current.current = { workspace, onToolResult, onConversation };
  const adapter = useMemo(() => createAgentAdapter({
    onToolResult: (kind, result, id) => current.current.onToolResult(kind, result, id),
    getContext: () => {
      const w = current.current.workspace;
      return { name: w.name, goal: w.goal, date: w.date, planItems: w.planItems, city: w.city, travelDate: w.travelDate, brief: w.brief, energy: w.energy };
    },
  }), []);
  const runtime = useLocalRuntime(adapter);
  const initialConversation = useRef(conversation);
  const restored = useRef(false);
  const lastExport = useRef(JSON.stringify(conversation));
  useEffect(() => {
    if (!restored.current) {
      restored.current = true;
      const repository = initialConversation.current;
      runtime.thread.import({ ...repository, messages: repository.messages.map(item => ({ ...item, message: { ...item.message, createdAt: new Date(item.message.createdAt) } })) } as unknown as ExportedMessageRepository);
    }
    const unsubscribe = runtime.thread.subscribe(() => {
      if (runtime.thread.getState().isRunning) return;
      const serialized = JSON.stringify(runtime.thread.export());
      if (serialized !== lastExport.current) {
        lastExport.current = serialized;
        current.current.onConversation(JSON.parse(serialized));
      }
    });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (runtime.thread.getState().isRunning && current.current.workspace.remember) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { window.removeEventListener("beforeunload", beforeUnload); unsubscribe(); runtime.thread.cancelRun(); };
  }, [runtime]);
  const { setResponding } = useContext(MascotActivity);
  useEffect(() => {
    const sync = () => setResponding(runtime.thread.getState().isRunning);
    sync();
    const unsubscribe = runtime.thread.subscribe(sync);
    return () => { unsubscribe(); setResponding(false); };
  }, [runtime, setResponding]);
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
        <ThreadPrimitive.If running>
          <div className="bay-response" role="status">
            <span className="bay-response-dots" aria-hidden="true"><i /><i /><i /></span>
            Baymax is responding…
          </div>
        </ThreadPrimitive.If>
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
  const [responding, setResponding] = useState(false);
  const [page, setPage] = useState("Talk to Baymax");
  const [modal, setModal] = useState("");
  const persistence = useCareWorkspace();
  const { workspace, setWorkspace, setField } = persistence;
  const { name, ready, energy, done, water, reminders, nudge, city, travelDate, date, goal, brief, recipient, subject, planItems, tripReady, checklist, activeMinutes, week } = workspace;
  const setName = (value: string) => setField("name", value);
  const setReady = (value: boolean) => setField("ready", value);
  const setEnergy = (value: CareWorkspace["energy"]) => setField("energy", value);
  const setWater = (value: number) => setField("water", value);
  const setWeek = (value: CareWorkspace["week"] | ((previous: CareWorkspace["week"]) => CareWorkspace["week"])) => setField("week", value);
  const setReminders = (value: boolean) => setField("reminders", value);
  const setNudge = (value: string) => setField("nudge", value as CareWorkspace["nudge"]);
  const setCity = (value: string) => setField("city", value);
  const setTravelDate = (value: string) => setField("travelDate", value);
  const setDate = (value: string) => setField("date", value);
  const setGoal = (value: string) => setField("goal", value);
  const setBrief = (value: string) => setField("brief", value);
  const setRecipient = (value: string) => setField("recipient", value);
  const setSubject = (value: string) => setField("subject", value);
  const onConversation = useCallback((conversation: StoredConversation) => setField("conversation", conversation), [setField]);
  const onToolResult = useCallback((kind: "plan" | "brief", result: unknown, toolCallId: string) => {
    setWorkspace(previous => applyToolResult(previous, kind, result, toolCallId));
  }, [setWorkspace]);
  const [emailConsent, setEmailConsent] = useState(false);
  const [toast, setToast] = useState("");
  const setTripReady = (value: boolean) => setField("tripReady", value);
  const setChecklist = (value: string[]) => setField("checklist", value);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [mobile, setMobile] = useState(false);
  const toggle = (label: string) => setWorkspace(previous => {
    const checked = !previous.done.includes(label);
    return { ...previous,
      done: checked ? [...previous.done, label] : previous.done.filter(item => item !== label),
      planItems: previous.planItems.map(item => item.label === label ? { ...item, done: checked } : item),
    };
  });
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 3500);
  };
  // Initialize the new-visit demo overview after restoring the care workspace.
  // A saved or already-opened workspace always keeps its own values.
  useEffect(() => {
    if (persistence.loading || persistence.loadError) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/health/overview?days=7");
        if (!res.ok) throw new Error(`/health/overview ${res.status}`);
        const data: HealthOverview = await res.json();
        if (cancelled) return;
        setWorkspace(previous => initializeHealthOverview(previous, data));
      } catch (err) {
        console.warn("Health data unavailable, using local defaults.", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persistence.loading, persistence.loadError, persistence.resetKey, setWorkspace]);
  const saveHealth = (path: string, body: object) =>
    fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch((err) => console.warn("Could not save health data.", err));
  const addWater = () => {
    if (water >= WATER_GOAL) return;
    setWater(water + 1);
    void saveHealth("/health/water", { ml: GLASS_ML });
  };
  const saveEnergy = () => {
    void saveHealth("/health/checkin", { energy: energy.toLowerCase() });
    const today = new Date().toLocaleDateString("en-CA");
    setWeek((w) =>
      w.map((d) =>
        d.date === today ? { ...d, energy: energy.toLowerCase() as "low" | "okay" | "good" | "great" } : d,
      ),
    );
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
  if (persistence.loading || persistence.loadError) return (
    <div className="app-loading" role="status">
      <Mascot small />
      <h2>{persistence.loading ? "Opening your care space…" : "We couldn’t open your saved care space."}</h2>
      {persistence.loadError && !persistence.loading && <><p>Your saved information will be kept until we can restore it.</p><button className="primary" onClick={() => void persistence.retry()}>Try again</button></>}
    </div>
  );
  return (
    <MascotActivity.Provider value={{ responding, setResponding }}>
    <CareContext.Provider
      value={{
        activePlanId: workspace.activePlanId,
        activeBriefId: workspace.activeBriefId,
        activateCard: onToolResult,
        planItems,
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
            <div className="persistence-status" role="status">
              <ShieldCheck size={14} /><span>{persistence.status}</span>
              {persistence.error && <><span role="alert">{persistence.error}</span><button className="text-btn" disabled={persistence.busy} onClick={async () => { if (await persistence.retry()) { setModal(""); setPage("Talk to Baymax"); } }}>Try again</button></>}
            </div>
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
                        onClick={addWater}
                      >
                        <Plus size={17} />
                      </button>
                    </div>
                    <h3>
                      {water}
                      <small> / {WATER_GOAL} glasses</small>
                    </h3>
                    <div className="water-bars">
                      {Array.from({ length: WATER_GOAL }, (_, i) => (
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
                      {activeMinutes +
                        (done.includes("Take a 10-minute walk") ? 10 : 0)}
                      <small> / {MOVEMENT_GOAL} minutes</small>
                    </h3>
                    <div className="track">
                      <i
                        style={{
                          width: `${Math.min(
                            100,
                            ((activeMinutes +
                              (done.includes("Take a 10-minute walk")
                                ? 10
                                : 0)) /
                              MOVEMENT_GOAL) *
                              100,
                          )}%`,
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
                {week.length > 0 && (
                  <section className="panel week-panel">
                    <div className="section-heading">
                      <h2>
                        Your last 7 days <span>ENERGY, WATER, MOVEMENT</span>
                      </h2>
                    </div>
                    <div className="week">
                      {week.map((d) => (
                        <div className="week-day" key={d.date}>
                          <span
                            className={`energy-dot ${d.energy ?? "none"}`}
                            title={d.energy ? `Energy: ${d.energy}` : "No check-in"}
                          />
                          <div className="week-bar" title="Water">
                            <i
                              style={{
                                height: `${Math.min(100, (d.hydrationMl / 2000) * 100)}%`,
                              }}
                            />
                          </div>
                          <small>
                            {new Date(`${d.date}T12:00:00`).toLocaleDateString(
                              undefined,
                              { weekday: "short" },
                            )}
                          </small>
                        </div>
                      ))}
                    </div>
                    <p className="muted">
                      Dots show energy (cloudy is low, bright is great). Bars
                      show water against about 2 litres.
                    </p>
                  </section>
                )}
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
              <Chat key={persistence.resetKey} conversation={workspace.conversation} workspace={workspace} onConversation={onConversation} onToolResult={onToolResult} />
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
                  {planItems.map(({ label: s, when }) => (
                    <button className="task" key={s} onClick={() => toggle(s)}>
                      <span
                        className={`check ${done.includes(s) ? "checked" : ""}`}
                      >
                        {done.includes(s) && <Check size={13} />}
                      </span>
                      <span><b>{s}</b>{when && <small>{when}</small>}</span>
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
                    Your preference: {reminders ? nudge : "Nudges off"}.
                    {workspace.remember ? " Remembered for your next visit." : " Applies while you’re here."}
                  </p>
                </section>
                <section className="panel">
                  <ShieldCheck className="green-text" size={30} />
                  <h2>Privacy comes first.</h2>
                  <label className="consent">
                    <input type="checkbox" checked={workspace.remember} disabled={persistence.busy} onChange={e => void persistence.changeMemory(e.target.checked)} />
                    Remember across visits
                  </label>
                  <p>
                    Save your profile, care plans, check-ins, preferences, and conversation for your next visit in this browser.
                    Turning this off deletes the saved copy and keeps your current care space for this visit.
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
                    Delete my care space
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
                A little adorable.
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
              <label className="consent">
                <input type="checkbox" checked={workspace.remember} onChange={e => setField("remember", e.target.checked)} />
                Remember my care space across visits in this browser.
              </label>
              <p className="fine">
                Your space, your pace. You can delete saved information in Privacy & preferences.
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
                        onClick={() => setEnergy(s as CareWorkspace["energy"])}
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
                      saveEnergy();
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
                    This deletes your saved profile, care plans, check-ins, preferences, brief, and conversation.
                    Your downloaded brief stays on your device.
                  </p>
                  {persistence.error && <p role="alert" className="notice">{persistence.error}</p>}
                  <button
                    className="primary"
                    disabled={persistence.busy}
                    onClick={async () => {
                      if (await persistence.reset()) { setModal(""); setPage("Talk to Baymax"); }
                    }}
                  >
                    {persistence.busy ? "Deleting…" : "Delete and start fresh"}
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
    </MascotActivity.Provider>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

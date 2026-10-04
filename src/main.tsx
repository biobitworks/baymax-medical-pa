import { Computer } from "./components/Computer";
import { ComputerActionCard, type ComputerActionArgs } from "./components/ComputerActionCard";
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
  AttachmentPrimitive,
  type AttachmentAdapter,
  type ExportedMessageRepository,
  makeAssistantToolUI,
} from "@assistant-ui/react";
import { LabTrendsCard, type LabTrendsArgs } from "./components/LabTrendsCard";
import {
  ArrowUp,
  ArrowUpRight,
  Heart,
  LayoutDashboard,
  MessageCircle,
  Monitor,
  Plane,
  FileText,
  ShieldCheck,
  Settings,
  Check,
  Plus,
  X,
  Droplets,
  Footprints,
  Activity,
  Moon,
  ChevronRight,
  Bell,
  Download,
  RotateCcw,
  Calendar,
  Sparkles,
  Menu,
  Mail,
  Trash2,
  History,
} from "lucide-react";
import {
  DEFAULT_TRAVEL_CHECKLIST,
  formatDoctorBrief,
} from "./mastra/lib/brief";
import { TravelAdvisories, loadingResearch, type TravelResearch } from "./components/TravelAdvisories";
import "./style.css";
import "./components/computer-workspace.css";
import { PwaControls } from "./pwa/PwaControls";
import { initializeHealthOverview } from "./persistence/health-overview";
import { createAgentAdapter } from "./chat/adapter";
import { conversationsApi, relativeTime, EMPTY_CONVERSATION, type ConversationSummary } from "./chat/conversations-client";
import { applyToolResult, historicalCard } from "./chat/cards";
import { useCareWorkspace } from "./persistence/use-care-workspace";
import { type CareWorkspace, type StoredConversation } from "./shared/workspace";
import Mascot, { MascotActivity } from "./Mascot";
import { PrescriptionShoppingCard } from "./components/PrescriptionShoppingCard";
import { WebSearchCard } from "./components/WebSearchCard";
import { searchCardFromEvent, type SearchCardPart, type WebSearchCardArgs } from "./components/web-search-state";
import "./components/prescription-shopping.css";
import { ActivityOnboarding, FitnessDashboard, FITNESS_CHANGED, fitnessRequest, type SavedPreferences } from "./components/Fitness";
import type { FitnessOverview } from "./mastra/lib/fitness";
import { AppleHealthConnection } from './components/AppleHealthConnection';
import { Today } from './components/Today';
import './ui-refresh.css';

// Triggers the agent to read all of the user's health data and answer with a
// week-in-review, which also renders the water, movement, sleep, energy and
// running cards.
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const WEEKLY_SUMMARY_PROMPT = "Give me a summary of my last week";
const GLASS_ML = 250;
const WATER_GOAL = 8;
const MOVEMENT_GOAL = 30;

type HealthOverview = {
  today: { date: string; hydrationMl: number; activeMinutes: number };
  todayCheckin: { date: string; energy: string } | null;
  metrics: { date: string; hydrationMl: number; activeMinutes: number }[];
  checkins: { date: string; energy: string }[];
};

// Generative health cards. When the agent calls get-daily-metrics or
// get-recent-checkins, the tool result is turned into cards shown in the chat.
type DailyMetric = {
  date: string;
  steps: number | null;
  activeMinutes: number | null;
  hydrationMl: number | null;
  sleepHours: number | null;
};
type Run = {
  date: string;
  distanceMi: number;
  durationMin: number;
  paceMinPerMi: number;
  note?: string;
};
type RunSummary = {
  total: number;
  totalMiles: number;
  totalMinutes: number;
  averagePaceMinPerMi: number;
  longestMi: number;
  daysSinceLastRun: number | null;
  runsPerWeek: number | null;
  observations: string[];
};
type MetricKey = "hydration" | "movement" | "sleep";
type HealthCardArgs =
  | ComputerActionArgs
  | LabTrendsArgs
  | { metric: "fitness"; overview: FitnessOverview }
  | { metric: "onboarding"; preferences: SavedPreferences }
  | {
      metric: MetricKey;
      /** Newest first, as returned by get-daily-metrics */
      daily: DailyMetric[];
      averages: Partial<Record<string, number | null>>;
      source?: 'demo' | 'apple_health';
      targets: { hydrationMl: number; steps: number; activeMinutes: number; sleepHours: number };
    }
  | {
      metric: "running";
      /** Newest first, as returned by get-recent-runs */
      runs: Run[];
      summary: RunSummary;
    }
  | {
      metric: "energy";
      /** Newest first, as returned by get-recent-checkins */
      checkins: { date: string; energy: string; note?: string }[];
      summary: { total: number; counts: Record<string, number>; averageEnergyScore: number };
    };
type AgentToolPart = {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  argsText: string;
  result: { ready: boolean };
  /** Which metric this card shows, so a later result can replace it. */
  metric: string;
};
const healthCardPart = (args: HealthCardArgs): AgentToolPart => ({
  type: "tool-call",
  toolCallId: crypto.randomUUID(),
  toolName: "health_card",
  args,
  argsText: JSON.stringify(args.metric),
  result: { ready: true },
  metric: args.metric === "labs" ? `labs:${args.title}` : args.metric,
});
function healthCardsFromTool(toolName: string, result: any): HealthCardArgs[] {
  if (!result || typeof result !== "object") return [];
  if (['computerTool', 'use-baymax-computer'].includes(toolName) && typeof result.action === 'string') {
    const data = result.data;
    const content = result.error || (data && typeof data === 'object' && 'stdout' in data ? [data.stdout, data.stderr, `Exit: ${data.exitCode ?? 'unknown'}`, data.timedOut ? 'Timed out' : '', data.interrupted ? 'Interrupted' : '', data.truncated ? 'Output truncated' : ''].filter(Boolean).join('\n') : JSON.stringify(data ?? {}));
    return [{metric:'computer', action:result.action, ok:result.ok === true, summary:String(content).slice(0,4000)}];
  }
  if (toolName === "fitnessOverviewTool" && Array.isArray(result.daily)) {
    return [{ metric: "fitness", overview: result }];
  }
  if (toolName === "onboardingTool" && result.preferences) {
    return [{ metric: "onboarding", preferences: result.preferences }];
  }
  if (toolName === "dailyMetricsTool" && Array.isArray(result.daily)) {
    const { daily, summary } = result;
    return (["hydration", "movement", "sleep"] as const).map((metric) => ({
      metric,
      daily,
      averages: summary.averages,
      targets: summary.targets,
      source: result.source,
    }));
  }
  if (toolName === "recentRunsTool" && Array.isArray(result.runs)) {
    return [{ metric: "running", runs: result.runs, summary: result.summary }];
  }
  if (toolName === "recentCheckinsTool" && Array.isArray(result.checkins)) {
    return [
      { metric: "energy", checkins: result.checkins, summary: result.summary },
    ];
  }
  if (toolName === "labTrendsTool" && Array.isArray(result.series)) {
    return [
      {
        metric: "labs",
        title: result.title ?? "Lab trends",
        series: result.series,
        unmatched: result.unmatched,
      },
    ];
  }
  return [];
}

const weekday = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
  });

const METRIC_UI = {
  hydration: {
    label: "HYDRATION",
    icon: Droplets,
    tone: "blue",
    color: "#a3bfd0",
    pick: (d: DailyMetric) => d.hydrationMl,
    target: (t: HealthCardTargets) => t.hydrationMl,
    avgKey: "hydrationMl",
    format: (n: number) => `${(n / 1000).toFixed(1)} L`,
    goal: (n: number) => `${(n / 1000).toFixed(1)} L`,
    noun: "water",
  },
  movement: {
    label: "MOVEMENT",
    icon: Footprints,
    tone: "orange",
    color: "#cfb18e",
    pick: (d: DailyMetric) => d.activeMinutes,
    target: (t: HealthCardTargets) => t.activeMinutes,
    avgKey: "activeMinutes",
    format: (n: number) => `${Math.round(n)} min`,
    goal: (n: number) => `${n} min`,
    noun: "active time",
  },
  sleep: {
    label: "SLEEP",
    icon: Moon,
    tone: "purple",
    color: "#b3a6c6",
    pick: (d: DailyMetric) => d.sleepHours,
    target: (t: HealthCardTargets) => t.sleepHours,
    avgKey: "sleepHours",
    format: (n: number) => `${n.toFixed(1)} h`,
    goal: (n: number) => `${n} h`,
    noun: "sleep",
  },
} as const;
type HealthCardTargets = {
  hydrationMl: number;
  steps: number;
  activeMinutes: number;
  sleepHours: number;
};

function MetricCard({
  metric,
  daily,
  averages,
  targets,
  source,
}: Extract<HealthCardArgs, { metric: MetricKey }>) {
  const ui = METRIC_UI[metric];
  const Icon = ui.icon;
  const [extraMl, setExtraMl] = useState(0);
  const days = [...daily].reverse();
  const target = ui.target(targets);
  const bonus = metric === "hydration" ? extraMl : 0;
  const values = days.map((d, i) => {
    const value = ui.pick(d);
    return value === null ? null : value + (i === days.length - 1 ? bonus : 0);
  });
  const latest = values[values.length - 1];
  const avg = averages[ui.avgKey];
  const recorded = values.filter((value): value is number => value !== null);
  const below = recorded.filter(v => v < target).length;
  const format = (value: number | null | undefined) => value == null ? 'Not shared' : ui.format(value);
  const addGlass = () => {
    setExtraMl((n) => n + GLASS_ML);
    void fetch("/health/water", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ml: GLASS_ML }),
    }).catch((err) => console.warn("Could not save water.", err));
  };
  return (
    <div className="agent-card metric-card">
      <div className="agent-card-top">
        <span className={`stat-icon ${ui.tone}`}>
          <Icon size={18} />
        </span>
        <span>{ui.label}</span>
        <span className="agent-status">{source === 'apple_health' ? 'Apple Health' : 'Sample data'}</span>
      </div>
      <h3>
        {format(latest)}
        <small> {days.length ? shortDate(days[days.length - 1].date) : 'no readings yet'} · goal {ui.goal(target)}</small>
      </h3>
      <div className="metric-bars">
        {days.map((d, i) => (
          <div key={d.date} title={`${weekday(d.date)}: ${format(values[i])}`}>
            <div className="metric-bar">
              <i
                style={{
                  height: values[i] === null ? '0%' : `${Math.max(4, Math.min(100, (values[i]! / target) * 100))}%`,
                  background: (values[i] ?? 0) >= target ? ui.color : `${ui.color}99`,
                }}
              />
              <span className="metric-goal" />
            </div>
            <small>{weekday(d.date)}</small>
          </div>
        ))}
      </div>
      <p className="fine">
        {recorded.length ? `Averaging ${format(avg)} on recorded days; under the ${ui.goal(target)} goal on ${below} of ${recorded.length} recorded days.` : 'No readings shared for this metric.'}
      </p>
      {metric === "hydration" && source !== 'apple_health' && (
        <button className="text-btn" onClick={addGlass}>
          Add a glass <Plus size={14} />
        </button>
      )}
    </div>
  );
}

const fmtPace = (minPerMi: number) => {
  const m = Math.floor(minPerMi);
  const sec = Math.round((minPerMi - m) * 60);
  return `${sec === 60 ? m + 1 : m}:${String(sec === 60 ? 0 : sec).padStart(2, "0")} /mi`;
};
const fmtMiles = (mi: number) => `${Math.round(mi * 100) / 100} mi`;
const fmtMinutes = (min: number) => {
  const total = Math.round(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
};
const shortDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

function RunList({ runs }: { runs: Run[] }) {
  return (
    <div className="run-list">
      {runs.map((r, i) => (
        <div className="run-row" key={`${r.date}-${i}`} title={r.note}>
          <span className="run-date">
            {shortDate(r.date)}
            <small>{weekday(r.date)}</small>
          </span>
          <b>{fmtMiles(r.distanceMi)}</b>
          <span>{fmtMinutes(r.durationMin)}</span>
          <span className="run-pace">{fmtPace(r.paceMinPerMi)}</span>
        </div>
      ))}
    </div>
  );
}

function RunCard({
  runs,
  summary,
}: Extract<HealthCardArgs, { metric: "running" }>) {
  const days = [...runs].reverse();
  const maxMi = Math.max(1, ...days.map((r) => r.distanceMi));
  return (
    <div className="agent-card metric-card">
      <div className="agent-card-top">
        <span className="stat-icon green">
          <Activity size={18} />
        </span>
        <span>RUNNING</span>
        <span className="agent-status">Last {days.length} runs</span>
      </div>
      <h3>
        {fmtMiles(summary.totalMiles)}
        <small>
          {" "}
          in {fmtMinutes(summary.totalMinutes)} · avg{" "}
          {fmtPace(summary.averagePaceMinPerMi)}
        </small>
      </h3>
      <div className="metric-bars">
        {days.map((r, i) => (
          <div
            key={`${r.date}-${i}`}
            title={`${shortDate(r.date)}: ${fmtMiles(r.distanceMi)} in ${fmtMinutes(r.durationMin)}`}
          >
            <div className="metric-bar">
              <i
                style={{
                  height: `${Math.max(8, (r.distanceMi / maxMi) * 100)}%`,
                  background: "#9db382",
                }}
              />
            </div>
            <small>{shortDate(r.date)}</small>
          </div>
        ))}
      </div>
      <p className="fine">
        {summary.observations.length
          ? summary.observations.join(" ")
          : "Nice and steady. Every run counts."}
      </p>
    </div>
  );
}

function RunningSection() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [distance, setDistance] = useState("");
  const [minutes, setMinutes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    try {
      const res = await fetch("/health/runs?count=10");
      if (!res.ok) throw new Error(`/health/runs ${res.status}`);
      const data = await res.json();
      setRuns(data.runs);
      setSummary(data.summary);
      setError("");
    } catch (err) {
      console.warn("Running data unavailable.", err);
      setError("Baymax can’t reach your running data right now.");
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const distanceMi = Number(distance);
  const durationMin = Number(minutes);
  const valid = distanceMi > 0 && durationMin > 0;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      const res = await fetch("/health/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ distanceMi, durationMin }),
      });
      if (!res.ok) throw new Error(`/health/runs ${res.status}`);
      setDistance("");
      setMinutes("");
      await load();
    } catch (err) {
      console.warn("Could not save run.", err);
      setError("That run didn’t save. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <div className="stats">
        {[
          ["Distance", summary ? fmtMiles(summary.totalMiles) : "–", "last 10 runs"],
          ["Time", summary ? fmtMinutes(summary.totalMinutes) : "–", "on your feet"],
          [
            "Average pace",
            summary?.averagePaceMinPerMi ? fmtPace(summary.averagePaceMinPerMi) : "–",
            summary?.runsPerWeek ? `about ${summary.runsPerWeek} ${summary.runsPerWeek === 1 ? "run" : "runs"} a week` : "log a few runs",
          ],
        ].map(([label, value, hint]) => (
          <article className="stat" key={label}>
            <div className="stat-top">
              <span className="stat-icon green">
                <Activity size={20} />
              </span>
              <span>{label.toUpperCase()}</span>
            </div>
            <h3>{value}</h3>
            <p>{hint}</p>
          </article>
        ))}
      </div>
      <div className="two-col running-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>Recent runs</h2>
            <span className="muted">
              {summary?.daysSinceLastRun != null
                ? summary.daysSinceLastRun === 0
                  ? "RAN TODAY"
                  : `${summary.daysSinceLastRun} DAYS SINCE YOUR LAST RUN`
                : ""}
            </span>
          </div>
          {runs.length ? (
            <RunList runs={runs} />
          ) : (
            <p className="muted">No runs yet. Your first one counts the most.</p>
          )}
          {summary?.observations.map((o) => (
            <p className="notice" key={o}>
              {o}
            </p>
          ))}
        </section>
        <section className="panel">
          <span className="eyebrow">LOG A RUN</span>
          <h2>How far did you go?</h2>
          <form onSubmit={save}>
            <label>
              Distance (miles)
              <input
                type="number"
                inputMode="decimal"
                min="0.1"
                step="0.01"
                placeholder="1.5"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
              />
            </label>
            <label>
              Time (minutes)
              <input
                type="number"
                inputMode="decimal"
                min="1"
                step="0.1"
                placeholder="18"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </label>
            {valid && (
              <p className="fine">
                That’s a pace of {fmtPace(durationMin / distanceMi)}.
              </p>
            )}
            {error && <p className="notice">{error}</p>}
            <button className="primary" type="submit" disabled={!valid || saving}>
              {saving ? "Saving…" : "Save my run"} <Check size={16} />
            </button>
          </form>
        </section>
      </div>
    </>
  );
}

const ENERGY_ICON: Record<string, string> = {
  low: "☁",
  okay: "◒",
  good: "☀",
  great: "✦",
};
function EnergyCard({
  checkins,
  summary,
}: Extract<HealthCardArgs, { metric: "energy" }>) {
  const c = useContext(CareContext)!;
  const days = [...checkins].reverse();
  const low = summary.counts.low ?? 0;
  return (
    <div className="agent-card metric-card">
      <div className="agent-card-top">
        <span className="stat-icon purple">
          <Sparkles size={18} />
        </span>
        <span>YOUR ENERGY</span>
        <span className="agent-status">Last {days.length} check-ins</span>
      </div>
      <h3>
        {low} of {summary.total}
        <small> check-ins said low</small>
      </h3>
      <div className="energy-row">
        {days.map((d) => (
          <div key={d.date} title={d.note ?? capitalize(d.energy)}>
            <span className={`energy-chip ${d.energy}`}>
              {ENERGY_ICON[d.energy] ?? "·"}
            </span>
            <small>{weekday(d.date)}</small>
          </div>
        ))}
      </div>
      <p className="fine">
        Average energy {summary.averageEnergyScore} out of 4. You don’t have to
        be at 100%, but let’s look for what might help.
      </p>
      <button className="text-btn" onClick={c.checkin}>
        Update today’s check-in <ArrowUpRight size={14} />
      </button>
    </div>
  );
}

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
const TEXT_FILE_ACCEPT = ".pdf,application/pdf,.txt,.md,.csv,.tsv,.json,.xml,.log,text/*,application/json";
const isPdf = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);
async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
// Uploads go to the server as conversation artifacts; the agent reads them
// with list-medical-records / read-medical-record rather than inline text.
const createAttachmentAdapter = (conversationId: string): AttachmentAdapter => ({
  accept: TEXT_FILE_ACCEPT,
  async add({ file }) {
    return {
      id: crypto.randomUUID(),
      type: "document",
      name: file.name,
      contentType: file.type || "text/plain",
      file,
      status: { type: "requires-action", reason: "composer-send" },
    };
  },
  async send(attachment) {
    const res = await fetch("/records/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId,
        name: attachment.name,
        ...(isPdf(attachment.file)
          ? { contentBase64: await fileToBase64(attachment.file) }
          : { content: await attachment.file.text() }),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      record?: { id: string };
      error?: string;
    };
    if (!res.ok || !body.record)
      throw new Error(body.error ?? `Upload failed (${res.status})`);
    return {
      ...attachment,
      id: body.record.id,
      status: { type: "complete" },
      content: [
        {
          type: "text",
          text: `[Attached record "${attachment.name}", id ${body.record.id}]`,
        },
      ],
    };
  },
  async remove() {},
});
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
        <PrescriptionShoppingCard />
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
const HealthTool = makeAssistantToolUI<HealthCardArgs, { ready: boolean }>({
  toolName: "health_card",
  render: ({ args }) =>
    args.metric === "computer" ? (
      <ComputerActionCard {...args} />
    ) : args.metric === "labs" ? (
      <LabTrendsCard {...args} />
    ) : args.metric === "fitness" ? (
      <FitnessDashboard initialData={args.overview} compact />
    ) : args.metric === "onboarding" ? (
      <ActivityOnboarding initialPreferences={args.preferences} />
    ) : args.metric === "energy" ? (
      <EnergyCard {...args} />
    ) : args.metric === "running" ? (
      <RunCard {...args} />
    ) : (
      <MetricCard {...args} />
    ),
});
const WebSearchTool = makeAssistantToolUI<WebSearchCardArgs, { ready: boolean }>({
  toolName: "web_search",
  render: ({ args }) => <WebSearchCard args={args} />,
});
function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|(?<![*\w])\*([^*\s][^*]*?)\*(?![*\w])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={m.index}>{renderInline(m[1])}</strong>);
    else if (m[2] !== undefined) out.push(<code key={m.index}>{m[2]}</code>);
    else out.push(<em key={m.index}>{m[3]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
function MarkdownText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) {
      blocks.push(<p key={blocks.length}>{renderInline(para.join(" "))}</p>);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((it, i) => <li key={i}>{renderInline(it)}</li>);
      blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
      list = null;
    }
  };
  for (const line of text.split("\n")) {
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^\s{0,3}#{1,6}\s+(.*)$/.exec(line);
    if (bullet || num) {
      flushPara();
      const ordered = !!num;
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? num)![1]);
    } else if (heading) {
      flushPara();
      flushList();
      blocks.push(<p key={blocks.length}><strong>{renderInline(heading[1])}</strong></p>);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return <div className="md">{blocks}</div>;
}
function ComposerAttachment() {
  return (
    <AttachmentPrimitive.Root className="attachment-chip">
      <FileText size={14} />
      <AttachmentPrimitive.Name />
      <AttachmentPrimitive.Remove aria-label="Remove attachment">
        <X size={13} />
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
}
function MessageAttachment() {
  return (
    <AttachmentPrimitive.Root className="attachment-chip">
      <FileText size={14} />
      <AttachmentPrimitive.Name />
    </AttachmentPrimitive.Root>
  );
}
function UserMessage() {
  return (
    <MessagePrimitive.Root className="message user">
      <MessagePrimitive.Attachments
        components={{ Attachment: MessageAttachment }}
      />
      <MessagePrimitive.Content />
    </MessagePrimitive.Root>
  );
}
function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="message assistant">
      <span className="assistant-label">✦ Baymax</span>
      <MessagePrimitive.Content
        components={{ Text: ({ text }: { text: string }) => <MarkdownText text={text} /> }}
      />
      <MessagePrimitive.Error>
        <p role="alert" className="notice">Baymax couldn’t complete that response. Please try sending your message again.</p>
      </MessagePrimitive.Error>
    </MessagePrimitive.Root>
  );
}
function Chat({ conversationId, conversation, onConversation, onToolResult, workspace }: {
  conversationId: string;
  conversation: StoredConversation;
  onConversation: (conversationId: string, conversation: StoredConversation) => void;
  onToolResult: (kind: "plan" | "brief", result: unknown, toolCallId: string) => void;
  workspace: CareWorkspace;
}) {
  const current = useRef({ workspace, onToolResult, onConversation });
  current.current = { workspace, onToolResult, onConversation };
  const adapter = useMemo(() => createAgentAdapter({
    getConversationId: () => conversationId,
    onToolResult: (kind, result, id) => current.current.onToolResult(kind, result, id),
    getToolCards: (tool, result, id) => healthCardsFromTool(tool, result).map(args => ({ ...healthCardPart(args), toolCallId: `${id}-${args.metric}` })),
    getContext: () => {
      const w = current.current.workspace;
      return { name: w.name, goal: w.goal, date: w.date, planItems: w.planItems, city: w.city, travelDate: w.travelDate, brief: w.brief, energy: w.energy };
    },
  }), [conversationId]);
  const attachmentAdapter = useMemo(() => createAttachmentAdapter(conversationId), [conversationId]);
  const [showActions, setShowActions] = useState(false);
  const [hasMessages, setHasMessages] = useState(conversation.messages.length > 0);
  const runtime = useLocalRuntime(adapter, { adapters: { attachments: attachmentAdapter } });
  const openMedicineShopping = () => {
    if (runtime.thread.getState().isRunning) return;
    runtime.thread.append({
      role: "user",
      content: [{ type: "text", text: "Show me the medicine shopping preview." }],
      startRun: false,
    });
    runtime.thread.append({
      role: "assistant",
      content: [
        { type: "text", text: "Here are sample pharmacy options for an existing prescription refill. Choose an option below and review your cart. These are fictional prices and packaging; no medication will be purchased." },
        { type: "tool-call", toolCallId: crypto.randomUUID(), toolName: "care_action", args: { kind: "purchase" }, argsText: JSON.stringify({ kind: "purchase" }), result: { ready: true } },
      ],
      startRun: false,
    });
  };
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
      const thread = runtime.thread.getState();
      setHasMessages(thread.messages.length > 0);
      if (thread.isRunning) return;
      const serialized = JSON.stringify(runtime.thread.export());
      if (serialized !== lastExport.current) {
        lastExport.current = serialized;
        current.current.onConversation(conversationId, JSON.parse(serialized));
      }
    });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (runtime.thread.getState().isRunning && current.current.workspace.remember) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { window.removeEventListener("beforeunload", beforeUnload); unsubscribe(); runtime.thread.cancelRun(); };
  }, [runtime, conversationId]);
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
      <HealthTool />
      <WebSearchTool />
      <ThreadPrimitive.Root className="chat">
        <ThreadPrimitive.Viewport className="transcript" autoScroll={hasMessages} scrollToBottomOnInitialize={hasMessages}>
          <ThreadPrimitive.Empty>
            <div className="chat-welcome">
              <div className="conversation-intro"><Mascot small /><span>Baymax<span className="note-dot" aria-hidden="true" /></span></div>
              <h2>What’s on your mind{workspace.name.trim() ? <>, {workspace.name.trim()}?</> : '?'}</h2>
              <p>Bloodwork, a bad night’s sleep, or just a question.<br className="desktop-break" /> We can start anywhere.</p>
              <div className="suggestions" aria-label="Conversation starters">
                {[
                  { prompt: WEEKLY_SUMMARY_PROMPT, title: "How has my week looked?", detail: "Look at the patterns", Icon: Activity },
                  { prompt: "Help me understand my latest bloodwork", title: "Talk me through my bloodwork", detail: "Make sense of my records", Icon: FileText },
                  { prompt: "Help me prepare a brief for my next doctor appointment", title: "Get me ready for my doctor", detail: "Bring the right questions", Icon: ArrowUpRight },
                ].map(({ prompt, title, detail, Icon }, index) => (
                  <ThreadPrimitive.Suggestion key={prompt} prompt={prompt} method="replace" autoSend className={`welcome-action ${["sage", "peach", "lilac"][index]}`}>
                    <span className="welcome-action-icon"><Icon size={23} aria-hidden="true" /></span>
                    <span className="welcome-action-copy"><strong>{title}</strong><small>{detail}</small></span>
                    <ArrowUpRight className="welcome-action-arrow" size={19} aria-hidden="true" />
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
        <div className="chat-tools">
          <span>Bring the details. I’ll help sort them out.</span>
          <button type="button" className="text-btn" aria-expanded={showActions} aria-controls="chat-more-actions" onClick={() => setShowActions(value => !value)}>More ways I can help <Plus size={14} /></button>
        </div>
        {showActions && <div className="quick-actions" id="chat-more-actions">
          <button type="button" onClick={openMedicineShopping}>Browse medicines</button>
          {[
            { label: "Weekly summary", prompt: WEEKLY_SUMMARY_PROMPT },
            { label: "Fitness", prompt: "Open my fitness dashboard" },
            { label: "Set movement goals", prompt: "Start my activity onboarding" },
            { label: "Medication refill", prompt: "Help me arrange a medication refill while travelling" },
            { label: "Doctor brief", prompt: "Draft a brief for my doctor" },
          ].map(action => <ThreadPrimitive.Suggestion key={action.label} prompt={action.prompt} method="replace" autoSend>{action.label}</ThreadPrimitive.Suggestion>)}
        </div>}
        <ComposerPrimitive.Root className="composer">
          <ComposerPrimitive.Attachments
            components={{ Attachment: ComposerAttachment }}
          />
          <ComposerPrimitive.AddAttachment
            className="attach"
            aria-label="Attach a medical record"
            title="Attach a PDF or text file (pdf, txt, md, csv, json)"
          >
            <Plus size={19} /><span className="attach-label">Record</span>
          </ComposerPrimitive.AddAttachment>
          <ComposerPrimitive.Input
            placeholder="Tell me what’s going on…"
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
        <p className="fine center">Your space to ask. Your choice what to share.</p>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
function ChatHub({ workspace, onToolResult }: {
  workspace: CareWorkspace;
  onToolResult: (kind: "plan" | "brief", result: unknown, toolCallId: string) => void;
}) {
  const [chats, setChats] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string>(() => crypto.randomUUID());
  const [initial, setInitial] = useState<StoredConversation | null>(EMPTY_CONVERSATION);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef(activeId);
  latest.current = activeId;
  const refresh = useCallback(async () => {
    try { setChats(await conversationsApi.list()); setError(""); }
    catch { setError("Your previous chats are unavailable right now."); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const openChat = async (id: string) => {
    setOpen(false);
    if (id === latest.current) return;
    setInitial(null);
    setActiveId(id);
    try {
      const loaded = await conversationsApi.load(id);
      if (latest.current === id) setInitial(loaded);
    } catch {
      if (latest.current === id) { setError("That chat could not be opened."); setInitial(EMPTY_CONVERSATION); }
    }
  };
  const newChat = () => {
    setOpen(false);
    setActiveId(crypto.randomUUID());
    setInitial(EMPTY_CONVERSATION);
  };
  const remove = async (id: string) => {
    try {
      await conversationsApi.remove(id);
      if (id === latest.current) newChat();
      await refresh();
    } catch { setError("That chat could not be deleted."); }
  };
  const save = useCallback(async (id: string, conversation: StoredConversation) => {
    if (!conversation.messages.length) return;
    try { await conversationsApi.save(id, conversation); await refresh(); }
    catch { setError("Your last message could not be saved to your chat history."); }
  }, [refresh]);
  return (
    <div className="chat-hub">
      <div className="chat-hub-bar">
        <button className="text-btn" aria-expanded={open} aria-controls="chat-history" onClick={() => setOpen(value => !value)}>
          <History size={15} /> Chats
        </button>
        <button className="text-btn" onClick={newChat}><Plus size={15} /> New chat</button>
      </div>
      {error && <p role="alert" className="notice chat-hub-error">{error}</p>}
      {open && (
        <aside id="chat-history" className="chat-history" aria-label="Previous chats">
          {chats.length === 0 ? <p className="muted">No saved chats yet.</p> : (
            <ul>
              {chats.map(chat => (
                <li key={chat.id} className={chat.id === activeId ? "active" : ""}>
                  <button className="chat-history-item" onClick={() => void openChat(chat.id)} title={chat.title}>
                    <span>{chat.title}</span>
                    <time dateTime={chat.updatedAt}>{relativeTime(chat.updatedAt)}</time>
                  </button>
                  <button className="chat-history-delete" aria-label={`Delete chat: ${chat.title}`} onClick={() => void remove(chat.id)}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}
      {initial && <Chat key={activeId} conversationId={activeId} conversation={initial} workspace={workspace} onConversation={save} onToolResult={onToolResult} />}
    </div>
  );
}
const nav = [
  ["Today", LayoutDashboard],
  ["Talk to Baymax", MessageCircle],
  ["Your plan", Calendar],
  ["Physical fitness", Footprints],
  ["Running", Activity],
  ["Travel care", Plane],
  ["Doctor brief", FileText],
  ["Computer", Monitor],
] as const;
const NAV_LABELS: Record<string, string> = {
  'Talk to Baymax': 'Talk', 'Today': 'Today', 'Your plan': 'Plan', 'Physical fitness': 'Activity', 'Running': 'Running', 'Travel care': 'Travel', 'Doctor brief': 'Doctor brief',
};
function App() {
  const [responding, setResponding] = useState(false);
  const [page, setPage] = useState("Today");
  const [modal, setModal] = useState("");
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [fitnessPreferences, setFitnessPreferences] = useState<SavedPreferences>();
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
  const onToolResult = useCallback((kind: "plan" | "brief", result: unknown, toolCallId: string) => {
    setWorkspace(previous => applyToolResult(previous, kind, result, toolCallId));
  }, [setWorkspace]);
  const [emailConsent, setEmailConsent] = useState(false);
  const [toast, setToast] = useState("");
  const setTripReady = (value: boolean) => setField("tripReady", value);
  const setChecklist = (value: string[]) => setField("checklist", value);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [research, setResearch] = useState<TravelResearch | null>(null);
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
    let active = true;
    const apply = (preferences: SavedPreferences) => {
      if (!active) return;
      setFitnessPreferences(preferences);
      if (preferences.onboarded) { setName(preferences.name); setReady(true); }
    };
    const onChange = (event: Event) => apply((event as CustomEvent<SavedPreferences>).detail);
    window.addEventListener(FITNESS_CHANGED, onChange);
    void fitnessRequest<SavedPreferences>("preferences").then(apply).catch(() => {}).finally(() => { if (active) setPreferencesLoading(false); });
    return () => { active = false; window.removeEventListener(FITNESS_CHANGED, onChange); };
  }, []);
  // Load today's numbers and the last week from the Mastra server. The agent
  // tools read the same data, so the app and Baymax always agree.
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
  const saveEnergy = async (value: CareWorkspace["energy"] = energy) => {
    const response = await saveHealth("/health/checkin", { energy: value.toLowerCase() });
    if (!response?.ok) { notify("Your check-in didn’t save. Please try again."); return false; }
    setEnergy(value);
    const today = new Date().toLocaleDateString("en-CA");
    setWeek((w) =>
      w.map((d) =>
        d.date === today ? { ...d, energy: value.toLowerCase() as "low" | "okay" | "good" | "great" } : d,
      ),
    );
    notify("Check-in saved. I’m keeping that in mind.");
    return true;
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
    setResearch(loadingResearch(destination));
    // Each search runs in parallel and fills in its own section as it finishes.
    const trip = { destination, departureDate: travelDate };
    for (const [kind, key] of [["cdc", "cdc"], ["smartraveller", "smartraveller"], ["city", "city"]] as const) {
      postTravel(`/travel/research/${kind}`, trip)
        .then((r) => r.sources ?? [])
        .catch(() => [])
        .then((sources) => setResearch((prev) => prev && prev.destination === destination ? { ...prev, [key]: { status: "done", sources } } : prev));
    }
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
  const [computerMobileView, setComputerMobileView] = useState<"Computer" | "Chat">("Computer");
  const go = (s: string) => {
    setPage(s);
    setMobile(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  useEffect(() => {
    const open = () => { setPage("Computer"); setMobile(false); setComputerMobileView("Computer"); };
    window.addEventListener('baymax-open-computer', open);
    return () => window.removeEventListener('baymax-open-computer', open);
  }, []);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
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
      <div className={`app ${page === "Talk to Baymax" ? "chat-first" : ""} ${page === "Computer" ? "computer-workspace" : ""}`}>
        <aside id="app-navigation" className={mobile ? "sidebar open" : "sidebar"}>
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
          <div className="workspace">YOUR HEALTH JOURNAL</div>
          <nav aria-label="Desktop navigation">
            {nav.map(([s, I]) => (
              <button
                key={s}
                aria-label={NAV_LABELS[s] ?? s}
                title={NAV_LABELS[s] ?? s}
                className={page === s ? "nav active" : "nav"}
                aria-current={page === s ? 'page' : undefined}
                onClick={() => go(s)}
              >
                <I size={19} />
                {NAV_LABELS[s]}
                {s === "Talk to Baymax" && <span className="nav-companion-dot" aria-hidden="true" />}
              </button>
            ))}
          </nav>
          <div className="side-bottom">
            <div className="sidebar-signoff"><span className="signoff-line" /><p>On your side.<br /><em>Even when you forget.</em></p></div>
            <button className={`nav settings-nav ${page === "Privacy & preferences" ? "active" : ""}`} aria-current={page === "Privacy & preferences" ? 'page' : undefined} onClick={() => go("Privacy & preferences")}>
              <Settings size={18} /> Privacy & preferences
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
              aria-expanded={mobile}
              aria-controls="app-navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={21} />
            </button>
            <div className="header-location"><span className="header-brand">baymax.</span><span className="header-section">{page === 'Talk to Baymax' ? 'Conversation' : NAV_LABELS[page] ?? page}</span></div>
            <div className="persistence-status" role="status">
              <ShieldCheck size={14} /><span>{persistence.status}</span>
              {persistence.error && <><span role="alert">{persistence.error}</span><button className="text-btn" disabled={persistence.busy} onClick={async () => { if (await persistence.retry()) { setModal(""); setPage("Talk to Baymax"); } }}>Try again</button></>}
            </div>
            <button
              className="icon"
              aria-label="Reminder settings"
              onClick={() => go("Privacy & preferences")}
            >
              <Bell size={20} />
            </button>
          </header>
          <div className={`content ${page === "Doctor brief" && research ? "content-wide" : ""}`} data-page={page}>
            <div className="page-heading">
              <div>
                {page === 'Today' && <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>}
                <h1>
                  {page === "Today"
                    ? `${greeting}, ${name}.`
                    : page === "Talk to Baymax"
                      ? "Let’s talk."
                      : page === "Your plan"
                        ? "Your plan."
                        : page === "Physical fitness"
                          ? "Keep moving."
                        : page === "Running"
                          ? "Your running log."
                        : page === "Travel care"
                          ? "Ready for your trip."
                          : page === "Doctor brief"
                            ? "For your doctor."
                            : page === "Computer" ? "A workspace for Baymax." : "Privacy & preferences."}
                </h1>
                <p>
                  {page === "Today"
                    ? "Let’s make a bit of room for you."
                    : page === "Talk to Baymax"
                      ? "No judgment. Just a companion in your corner."
                      : page === "Your plan"
                        ? "What you’re working toward, and what comes next."
                        : page === "Physical fitness"
                          ? "Your steps, your minutes, your own pace."
                        : page === "Running"
                          ? "Distance, time, and the runs that add up."
                        : page === "Travel care"
                          ? "Medication, documents, and a plan for care while you’re away."
                          : page === "Doctor brief"
                            ? "Your records and questions, ready for the appointment."
                            : page === "Computer" ? "Follow the work, take control, and keep your files close." : "Choose what Baymax remembers and how often it checks in."}
                </p>
              </div>
            </div>
            {page === "Today" && <Today workspace={workspace} onWater={addWater} onToggle={toggle} onCheckin={saveEnergy} onNavigate={go} />}
            <div className={`conversation-workspace ${page === "Computer" ? `is-computer mobile-${computerMobileView.toLowerCase()}` : ""}`} hidden={page !== "Talk to Baymax" && page !== "Computer"}>
              {page === "Computer" && <div className="workspace-mobile-switch" role="group" aria-label="Workspace view">{(["Chat", "Computer"] as const).map(view => <button key={view} aria-pressed={computerMobileView === view} onClick={() => setComputerMobileView(view)}>{view}</button>)}</div>}
            <section className="panel chat-panel" aria-label="Chat with Baymax">
              <ChatHub key={persistence.resetKey} workspace={workspace} onToolResult={onToolResult} />
            </section>
              {page === "Computer" && <div className="workspace-computer-pane"><Computer /></div>}
            </div>
            {page === "Your plan" && (
              <div className="two-col">
                <section className="panel">
                  <span className="eyebrow">WORKING TOWARD</span>
                  <h2>{goal}</h2>
                  <p className="muted">
                    Keep the next steps together. Adjust them as your plans change.
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
                    Your plan updates here when you work on it with Baymax.
                  </p>
                </section>
                <section className="panel">
                  <h2>Next steps</h2>
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
            {page === "Physical fitness" && <FitnessDashboard />}
            {page === "Running" && <RunningSection />}
            {page === "Travel care" && (
              <>
                <div className="two-col">
                  <section className="panel">
                    <span className="eyebrow">YOUR TRAVEL DETAILS</span>
                    <h2>Where are you heading?</h2>
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
                    <h2>Your travel checklist</h2>
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
              <div className={`two-col ${research ? "with-research" : ""}`}>
                <TravelAdvisories research={research} />
                <section className="panel brief-panel">
                  <span className="eyebrow">REVIEW BEFORE YOU SHARE</span>
                  <h2>The details worth bringing.</h2>
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
                    <a
                      className="pdf-preview"
                      href="/health/summary.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open your health summary PDF in a new tab"
                    >
                      <span className="pdf-preview-frame">
                        <iframe
                          title="Health summary preview"
                          src="/health/summary.pdf#toolbar=0&navpanes=0&scrollbar=0&view=FitH"
                          tabIndex={-1}
                          loading="lazy"
                        />
                      </span>
                      <span className="pdf-preview-meta">
                        <b>Health summary (PDF)</b>
                        <small>Medications, bloodwork and more. Click to preview the full document. Attach it to your email from there.</small>
                      </span>
                    </a>
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
                <AppleHealthConnection remember={workspace.remember} saved={persistence.status === 'Saved for your next visit'} />
                <section className="panel">
                  <h2>How should I check in?</h2>
                  <button
                    className="toggle-row"
                    onClick={() => setReminders(!reminders)}
                  >
                    <span>
                      <b>In-app nudges</b>
                      <small>Let Baymax check in while you’re using the app.</small>
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
                  <h2>What Baymax remembers</h2>
                  <label className="consent">
                    <input type="checkbox" checked={workspace.remember} disabled={persistence.busy} onChange={e => void persistence.changeMemory(e.target.checked)} />
                    Remember across visits
                  </label>
                  <p>
                    Save your profile, care plans, and preferences for your next visit in this browser. Your chat history and health data are saved to your account.
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
              <span>Baymax · Your personal health assistant</span>
              <button className="footer-settings" onClick={() => go('Privacy & preferences')}>Privacy & settings <ArrowUpRight size={13} /></button>
            </footer>
          </div>
          <nav className="bottom-nav" aria-label="Main navigation">
            {[nav[0], nav[1], nav[2], nav[3], nav[5]].map(([item, I]) => (
              <button
                key={item}
                aria-label={NAV_LABELS[item]}
                aria-current={page === item ? 'page' : undefined}
                title={item}
                className={page === item ? "active" : ""}
                onClick={() => go(item)}
              >
                <I size={22} />
                <span>{NAV_LABELS[item]}</span>
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
        {!ready && !preferencesLoading && (
          <ModalShell welcome>
            <ActivityOnboarding initialName={name} initialPreferences={fitnessPreferences} welcomeExtra={<label className="consent"><input type="checkbox" checked={workspace.remember} onChange={e => setField("remember", e.target.checked)} />Remember my care space across visits in this browser.</label>} onCancel={() => { setReady(true); go("Physical fitness"); }} onComplete={(preferences) => {
              setName(preferences.name); setReady(true); go("Physical fitness");
            }} />
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
                  <p>How you feel helps me understand the rest of your day.</p>
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
                    onClick={async () => { if (await saveEnergy()) setModal(""); }}
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
                      const displayName = name.trim() || "Alex";
                      void (async () => {
                        try {
                          const current = fitnessPreferences ?? await fitnessRequest<SavedPreferences>("preferences");
                          const saved = await fitnessRequest<SavedPreferences>("preferences", { name: displayName, goals: current.goals, notifications: current.notifications });
                          window.dispatchEvent(new CustomEvent(FITNESS_CHANGED, { detail: saved }));
                          setName(saved.name);
                          setModal("");
                        } catch { notify("Your name didn’t save. Please try again."); }
                      })();
                    }}
                  >
                    Save name
                  </button>
                </>
              ) : (
                <>
                  <h2>Start fresh?</h2>
                  <p>
                    This clears your saved profile, care plans, preferences, and brief, and restores the sample chats, check-ins, and health history.
                    Your downloaded brief stays on your device.
                  </p>
                  {persistence.error && <p role="alert" className="notice">{persistence.error}</p>}
                  <button
                    className="primary"
                    disabled={persistence.busy}
                    onClick={async () => {
                      try { await conversationsApi.resetDemo(); } catch { setToast("Could not restore the sample data. Please try again."); return; }
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
    <PwaControls />
  </React.StrictMode>,
);

import { Activity } from "lucide-react";
import "./lab-trends.css";

export type LabSeriesArg = {
  biomarker: string;
  unit?: string;
  panel?: string;
  referenceLow?: number;
  referenceHigh?: number;
  /** Oldest first */
  points: { date: string; value: number }[];
};

export type LabTrendsArgs = {
  metric: "labs";
  title: string;
  series: LabSeriesArg[];
  unmatched?: string[];
};

const W = 280;
const H = 84;
const PAD_X = 14;
const PAD_Y = 12;

const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
const fmtNum = (n: number) =>
  Math.abs(n) >= 100 ? String(Math.round(n)) : String(Math.round(n * 100) / 100);

function status(s: LabSeriesArg, v: number) {
  if (s.referenceHigh !== undefined && v > s.referenceHigh) return "above";
  if (s.referenceLow !== undefined && s.referenceLow > 0 && v < s.referenceLow)
    return "below";
  return s.referenceHigh !== undefined || s.referenceLow !== undefined ? "in" : "none";
}

function Chart({ s }: { s: LabSeriesArg }) {
  const pts = s.points;
  const values = pts.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  // Pull the reference band into view only when it is near the data.
  const span = Math.max(max - min, Math.abs(max) * 0.1, 1e-6);
  const near = (n?: number) =>
    n !== undefined && n >= min - span * 1.5 && n <= max + span * 1.5;
  if (near(s.referenceLow)) min = Math.min(min, s.referenceLow!);
  if (near(s.referenceHigh)) max = Math.max(max, s.referenceHigh!);
  const pad = (max - min || Math.abs(max) * 0.1 || 1) * 0.15;
  const lo = min - pad;
  const hi = max + pad;

  const times = pts.map((p) => new Date(`${p.date}T12:00:00`).getTime());
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const x = (i: number) =>
    t1 === t0
      ? W / 2
      : PAD_X + ((times[i] - t0) / (t1 - t0)) * (W - PAD_X * 2);
  const y = (v: number) => PAD_Y + (1 - (v - lo) / (hi - lo)) * (H - PAD_Y * 2);

  const bandTop = y(Math.min(hi, s.referenceHigh ?? hi));
  const bandBottom = y(Math.max(lo, s.referenceLow ?? lo));
  const hasBand =
    (s.referenceHigh !== undefined || s.referenceLow !== undefined) &&
    bandBottom > bandTop;
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="lab-chart"
      role="img"
      aria-label={`${s.biomarker} trend`}
    >
      {hasBand && (
        <rect
          className="lab-band"
          x={0}
          width={W}
          y={bandTop}
          height={bandBottom - bandTop}
        />
      )}
      {pts.length > 1 && <path className="lab-line" d={path} />}
      {pts.map((p, i) => (
        <g key={p.date}>
          <circle
            className={`lab-dot ${status(s, p.value)}`}
            cx={x(i)}
            cy={y(p.value)}
            r={4}
          />
          <text
            className="lab-val"
            x={Math.min(W - 14, Math.max(14, x(i)))}
            y={y(p.value) - 8}
            textAnchor="middle"
          >
            {fmtNum(p.value)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function SeriesRow({ s }: { s: LabSeriesArg }) {
  const first = s.points[0];
  const last = s.points[s.points.length - 1];
  const st = status(s, last.value);
  const delta = last.value - first.value;
  const pct = first.value ? (delta / Math.abs(first.value)) * 100 : 0;
  const range =
    s.referenceHigh !== undefined || s.referenceLow !== undefined
      ? s.referenceLow !== undefined && s.referenceLow > 0
        ? `${fmtNum(s.referenceLow)} to ${fmtNum(s.referenceHigh ?? Infinity)}`
        : `under ${fmtNum(s.referenceHigh!)}`
      : null;
  return (
    <div className="lab-row">
      <div className="lab-row-head">
        <b>{s.biomarker}</b>
        <span className={`lab-chip ${st}`}>
          {st === "above" ? "Above range" : st === "below" ? "Below range" : st === "in" ? "In range" : "No range"}
        </span>
      </div>
      <Chart s={s} />
      <div className="lab-row-foot">
        <span>
          {fmtDate(first.date)}
          {s.points.length > 1 ? ` to ${fmtDate(last.date)}` : ""}
        </span>
        {s.points.length > 1 ? (
          <span>
            {delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${fmtNum(delta)} ${s.unit ?? ""}`}
            {delta !== 0 && Number.isFinite(pct) ? ` (${pct > 0 ? "+" : ""}${pct.toFixed(1)}%)` : ""}
          </span>
        ) : (
          <span>Only one result so far</span>
        )}
        {range && (
          <span>
            Reference {range} {s.unit}
          </span>
        )}
      </div>
    </div>
  );
}

export function LabTrendsCard({ title, series, unmatched }: LabTrendsArgs) {
  const shown = series.filter((s) => s.points.length > 0);
  return (
    <div className="agent-card lab-card">
      <div className="agent-card-top">
        <span className="stat-icon blue">
          <Activity size={18} />
        </span>
        <span>BLOODWORK</span>
        <span className="agent-status">
          {shown.length} {shown.length === 1 ? "marker" : "markers"}
        </span>
      </div>
      <h3>{title}</h3>
      {shown.length === 0 && (
        <p className="fine">No matching results found in your records.</p>
      )}
      <div className="lab-grid">
        {shown.map((s) => (
          <SeriesRow key={s.biomarker} s={s} />
        ))}
      </div>
      {!!unmatched?.length && (
        <p className="fine">Not found: {unmatched.join(", ")}</p>
      )}
      <p className="fine">Synthetic data for demo. Not medical advice.</p>
    </div>
  );
}

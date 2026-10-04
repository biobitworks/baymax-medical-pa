import { type Ctx, dbOf, userIdOf } from "./demo-user";
import { type LabRow, norm } from "./lab-parse";

/** One biomarker measurement. */
export interface LabPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface LabSeries {
  biomarker: string;
  unit: string;
  panel?: string;
  referenceLow?: number;
  referenceHigh?: number;
  /** Oldest first */
  points: LabPoint[];
}

/** Every lab row across the user's built-in records and this conversation's uploads. */
async function allRows(conversationId: string | undefined, ctx: Ctx): Promise<LabRow[]> {
  const rows = await dbOf(ctx)(
    `SELECT l.biomarker, l.unit, l.panel, to_char(l.measured_on, 'YYYY-MM-DD') AS date, l.value,
            l.reference_low AS low, l.reference_high AS high
     FROM lab_results l JOIN records r ON r.user_id = l.user_id AND r.id = l.record_id
     WHERE l.user_id = $1 AND (r.source = 'library' OR r.conversation_id = $2)
     ORDER BY r.source, r.id, l.id`,
    [userIdOf(ctx), conversationId ?? null],
  );
  return rows.map((r) => ({
    biomarker: String(r.biomarker),
    unit: String(r.unit ?? ""),
    panel: r.panel == null ? undefined : String(r.panel),
    date: String(r.date),
    value: Number(r.value),
    low: r.low == null ? undefined : Number(r.low),
    high: r.high == null ? undefined : Number(r.high),
  }));
}

export interface LabQuery {
  biomarkers?: string[];
  panel?: string;
  since?: string; // YYYY-MM-DD
}

export async function queryLabSeries(
  query: LabQuery,
  conversationId?: string,
  ctx: Ctx = {},
): Promise<{ series: LabSeries[]; unmatched: string[]; available: string[] }> {
  const rows = await allRows(conversationId, ctx);
  const available = [...new Set(rows.map((r) => r.biomarker))].sort();
  const wanted = (query.biomarkers ?? []).map((b) => ({ raw: b, key: norm(b) }));
  const panelKey = query.panel ? norm(query.panel) : undefined;

  // No biomarkers or panel given: plot everything (e.g. "my latest bloodwork").
  const selectAll = wanted.length === 0 && !panelKey;
  const picked = rows.filter((r) => {
    if (query.since && r.date < query.since) return false;
    if (selectAll) return true;
    // Biomarkers and panel are combined: a row matching either is included.
    if (panelKey && norm(r.panel ?? "").includes(panelKey)) return true;
    const k = norm(r.biomarker);
    return wanted.some((w) => w.key && (k === w.key || k.includes(w.key) || w.key.includes(k)));
  });

  const byMarker = new Map<string, LabSeries>();
  for (const r of picked) {
    const key = norm(r.biomarker);
    const s = byMarker.get(key) ?? {
      biomarker: r.biomarker,
      unit: r.unit,
      panel: r.panel,
      points: [],
    };
    // Same biomarker + date from multiple files: keep the first.
    if (!s.points.some((p) => p.date === r.date)) s.points.push({ date: r.date, value: r.value });
    s.referenceLow = r.low ?? s.referenceLow;
    s.referenceHigh = r.high ?? s.referenceHigh;
    byMarker.set(key, s);
  }
  const series = [...byMarker.values()].map((s) => ({
    ...s,
    points: s.points.sort((a, b) => a.date.localeCompare(b.date)),
  }));
  const unmatched = [
    ...wanted
      .filter((w) => !series.some((s) => norm(s.biomarker).includes(w.key) || w.key.includes(norm(s.biomarker))))
      .map((w) => w.raw),
    ...(panelKey && !rows.some((r) => norm(r.panel ?? "").includes(panelKey)) ? [query.panel!] : []),
  ];
  return { series, unmatched, available };
}

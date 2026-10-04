import { getRecordText, listRecords } from "./records";

/** One biomarker measurement pulled from a record. */
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

interface Row {
  biomarker: string;
  unit: string;
  panel?: string;
  date: string;
  value: number;
  low?: number;
  high?: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

function rowsFromJson(text: string): Row[] {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const rows: Row[] = [];
  for (const panel of data?.lab_panels ?? []) {
    for (const r of panel.results ?? []) {
      const value = num(r.value);
      if (value === undefined || !r.biomarker || !panel.date) continue;
      rows.push({
        biomarker: String(r.biomarker),
        unit: String(r.unit ?? ""),
        panel: panel.name,
        date: String(panel.date),
        value,
        low: num(r.reference_range?.low),
        high: num(r.reference_range?.high),
      });
    }
  }
  return rows;
}

/** Minimal CSV parser with quoted-field support. */
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") (row.push(cell), (cell = ""));
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim())) out.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) out.push(row);
  return out;
}

function rowsFromCsv(text: string): Row[] {
  const [header, ...body] = parseCsv(text);
  if (!header) return [];
  const col = (name: string) => header.findIndex((h) => norm(h) === norm(name));
  const iDate = col("measurement_date") >= 0 ? col("measurement_date") : col("date");
  const iBio = col("biomarker");
  const iVal = col("value");
  if (iDate < 0 || iBio < 0 || iVal < 0) return [];
  const iUnit = col("unit");
  const iPanel = col("panel");
  const iLow = col("reference_low");
  const iHigh = col("reference_high");
  const rows: Row[] = [];
  for (const r of body) {
    const value = num(r[iVal]);
    if (value === undefined || !r[iBio] || !r[iDate]) continue;
    rows.push({
      biomarker: r[iBio].trim(),
      unit: iUnit >= 0 ? r[iUnit].trim() : "",
      panel: iPanel >= 0 ? r[iPanel].trim() : undefined,
      date: r[iDate].trim(),
      value,
      low: iLow >= 0 ? num(r[iLow]) : undefined,
      high: iHigh >= 0 ? num(r[iHigh]) : undefined,
    });
  }
  return rows;
}

/** Every lab row across the built-in records and this conversation's uploads. */
function allRows(conversationId?: string): Row[] {
  const rows: Row[] = [];
  for (const rec of listRecords(conversationId)) {
    const file = getRecordText(rec.id, conversationId);
    if (!file) continue;
    if (rec.format === "json") rows.push(...rowsFromJson(file.text));
    else if (rec.format === "csv") rows.push(...rowsFromCsv(file.text));
  }
  return rows;
}

export interface LabQuery {
  biomarkers?: string[];
  panel?: string;
  since?: string; // YYYY-MM-DD
}

export function queryLabSeries(
  query: LabQuery,
  conversationId?: string,
): { series: LabSeries[]; unmatched: string[]; available: string[] } {
  const rows = allRows(conversationId);
  const available = [...new Set(rows.map((r) => r.biomarker))].sort();
  const wanted = (query.biomarkers ?? []).map((b) => ({ raw: b, key: norm(b) }));
  const panelKey = query.panel ? norm(query.panel) : undefined;

  const picked = rows.filter((r) => {
    if (query.since && r.date < query.since) return false;
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

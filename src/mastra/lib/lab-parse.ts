/** One biomarker measurement parsed from a lab record. */
export interface LabRow {
  biomarker: string;
  unit: string;
  panel?: string;
  date: string;
  value: number;
  low?: number;
  high?: number;
  flag?: string;
  notes?: string;
}

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function rowsFromJson(text: string): LabRow[] {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const rows: LabRow[] = [];
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
        flag: r.flag ? String(r.flag) : undefined,
        notes: r.notes ? String(r.notes) : undefined,
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

export function rowsFromCsv(text: string): LabRow[] {
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
  const iFlag = col("flag");
  const iNotes = col("notes");
  const rows: LabRow[] = [];
  for (const r of body) {
    const value = num(r[iVal]);
    if (value === undefined || !r[iBio] || !r[iDate]) continue;
    rows.push({
      biomarker: r[iBio].trim(),
      unit: iUnit >= 0 ? (r[iUnit] ?? "").trim() : "",
      panel: iPanel >= 0 ? r[iPanel]?.trim() : undefined,
      date: r[iDate].trim(),
      value,
      low: iLow >= 0 ? num(r[iLow]) : undefined,
      high: iHigh >= 0 ? num(r[iHigh]) : undefined,
      flag: iFlag >= 0 && r[iFlag]?.trim() ? r[iFlag].trim() : undefined,
      notes: iNotes >= 0 && r[iNotes]?.trim() ? r[iNotes].trim() : undefined,
    });
  }
  return rows;
}

/** Dates must be real calendar dates to be stored in a date column. */
export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export function rowsForFormat(format: string, text: string): LabRow[] {
  const rows = format === "json" ? rowsFromJson(text) : format === "csv" ? rowsFromCsv(text) : [];
  return rows.filter((r) => isIsoDate(r.date));
}

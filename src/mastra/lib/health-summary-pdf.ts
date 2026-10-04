import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { dbOf, userIdOf } from "./demo-user";
import { loadProfile, loadWellness, wellnessLines } from "./brief-context";

type ToolContext = { requestContext?: { get: (key: string) => unknown } };

interface UserRow { sex: string | null; dob: string | null; notes: string | null }
interface Condition { name: string; status: string; notes: string | null }
interface Lab {
  panel: string | null;
  biomarker: string;
  value: number;
  unit: string;
  low: number | null;
  high: number | null;
  flag: string | null;
  date: string;
}
interface Measurement { type: string; value: number; unit: string; date: string }
interface RecordRow { name: string; source: string; date: string }

export interface HealthSummaryData {
  name: string;
  age?: number;
  user: UserRow | null;
  conditions: Condition[];
  medications: string[];
  allergies: string[];
  labs: Lab[];
  measurements: Measurement[];
  records: RecordRow[];
  wellness: string[];
}

const NORMAL_FLAGS = new Set(["", "normal", "in_range", "ok", "n"]);
export const isAbnormal = (flag: string | null) => !!flag && !NORMAL_FLAGS.has(flag.toLowerCase());

const safe = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
  try { return await p; } catch (err) { console.warn("health summary section unavailable", err); return fallback; }
};

export async function loadHealthSummary(context?: ToolContext): Promise<HealthSummaryData> {
  const q = dbOf();
  const id = userIdOf();
  const [profile, user, conditions, labs, measurements, records, wellness] = await Promise.all([
    safe(loadProfile(), null),
    safe(q("SELECT sex, notes, to_char(date_of_birth, 'YYYY-MM-DD') AS dob FROM users WHERE id = $1", [id]).then((r) => (r[0] as unknown as UserRow) ?? null), null),
    safe(q("SELECT name, status, notes FROM user_conditions WHERE user_id = $1 ORDER BY name", [id]).then((r) => r as unknown as Condition[]), [] as Condition[]),
    safe(
      q(
        `SELECT DISTINCT ON (biomarker) panel, biomarker, value, unit, reference_low AS low, reference_high AS high, flag,
                to_char(measured_on, 'YYYY-MM-DD') AS date
         FROM lab_results WHERE user_id = $1 ORDER BY biomarker, measured_on DESC`,
        [id],
      ).then((r) => r.map((x) => ({ ...x, value: Number(x.value), low: x.low == null ? null : Number(x.low), high: x.high == null ? null : Number(x.high) })) as unknown as Lab[]),
      [] as Lab[],
    ),
    safe(
      q(
        `SELECT DISTINCT ON (type) type, value, unit, to_char(measured_on, 'YYYY-MM-DD') AS date
         FROM body_measurements WHERE user_id = $1 ORDER BY type, measured_on DESC`,
        [id],
      ).then((r) => r.map((x) => ({ ...x, value: Number(x.value) })) as unknown as Measurement[]),
      [] as Measurement[],
    ),
    safe(
      q("SELECT name, source, to_char(created_at, 'YYYY-MM-DD') AS date FROM records WHERE user_id = $1 ORDER BY created_at DESC LIMIT 25", [id]).then((r) => r as unknown as RecordRow[]),
      [] as RecordRow[],
    ),
    safe(loadWellness(context).then(wellnessLines), [] as string[]),
  ]);
  return {
    name: profile?.name ?? "Baymax user",
    ...(profile?.age == null ? {} : { age: profile.age }),
    user,
    conditions,
    medications: profile?.medications ?? [],
    allergies: profile?.allergies ?? [],
    labs: labs.sort((a, b) => (a.panel ?? "").localeCompare(b.panel ?? "") || a.biomarker.localeCompare(b.biomarker)),
    measurements,
    records,
    wellness,
  };
}

// Platform palette (src/style.css)
const INK = rgb(0.149, 0.235, 0.196); // #263c32
const GREEN = rgb(0.435, 0.588, 0.412); // #6f9669
const PAPER = rgb(0.969, 0.973, 0.961); // #f7f8f5
const PANEL = rgb(0.941, 0.949, 0.925); // #f0f2ec
const LINE = rgb(0.882, 0.898, 0.855); // #e1e5da
const MUTED = rgb(0.4, 0.46, 0.43);
const AMBER = rgb(0.71, 0.33, 0.04);
const AMBER_BG = rgb(0.992, 0.953, 0.89);
const WHITE = rgb(1, 1, 1);

/** Standard PDF fonts only cover WinAnsi, so swap or drop anything else. */
const clean = (s: string) =>
  s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u2192]/g, "->")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");

const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

const W = 612;
const H = 792;
const M = 44;
const CONTENT_W = W - M * 2;

export async function renderHealthSummaryPdf(d: HealthSummaryData, now = new Date()): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Baymax health summary for ${clean(d.name)}`);
  pdf.setAuthor("Baymax");
  pdf.setCreator("Baymax");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const generated = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  let page: PDFPage;
  let y = 0;

  const newPage = () => {
    page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
    y = H - M;
  };
  const ensure = (h: number) => { if (y - h < M + 24) newPage(); };

  const wrap = (text: string, font: PDFFont, size: number, width: number) => {
    const lines: string[] = [];
    for (const para of clean(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > width && line) { lines.push(line); line = word; } else line = next;
      }
      lines.push(line);
    }
    return lines;
  };

  const text = (s: string, x: number, yy: number, font: PDFFont, size: number, color = INK) =>
    page.drawText(clean(s), { x, y: yy, font, size, color });

  const paragraph = (s: string, opts: { x?: number; width?: number; font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gap?: number } = {}) => {
    const { x = M, width = CONTENT_W, font = regular, size = 10, color = INK, gap = 3 } = opts;
    for (const line of wrap(s, font, size, width)) {
      ensure(size + gap);
      y -= size;
      text(line, x, y, font, size, color);
      y -= gap;
    }
  };

  const section = (title: string, count?: number) => {
    ensure(60);
    y -= 14;
    page.drawRectangle({ x: M, y: y - 3, width: 4, height: 16, color: GREEN });
    text(title, M + 12, y, bold, 14);
    if (count != null) {
      const label = String(count);
      const w = regular.widthOfTextAtSize(label, 9) + 12;
      const tx = M + 12 + bold.widthOfTextAtSize(clean(title), 14) + 8;
      page.drawRectangle({ x: tx, y: y - 3, width: w, height: 15, color: PANEL, borderColor: LINE, borderWidth: 0.5 });
      text(label, tx + 6, y + 1, regular, 9, MUTED);
    }
    y -= 12;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: LINE });
    y -= 8;
  };

  const empty = (s: string) => paragraph(s, { color: MUTED, size: 9.5 });

  type Col = { label: string; x: number; w: number };
  const table = (cols: Col[], rows: { cells: string[]; flagged?: boolean; group?: string }[]) => {
    const drawHead = () => {
      ensure(40);
      page.drawRectangle({ x: M, y: y - 17, width: CONTENT_W, height: 18, color: PANEL });
      cols.forEach((c) => text(c.label.toUpperCase(), M + c.x, y - 12, bold, 7.5, MUTED));
      y -= 18;
    };
    drawHead();
    for (const row of rows) {
      if (row.group) {
        ensure(34);
        y -= 12;
        text(row.group, M + 6, y, bold, 9, GREEN);
        y -= 5;
        continue;
      }
      const wrapped = row.cells.map((c, i) => wrap(c, i === 0 ? bold : regular, 9, cols[i].w - 8));
      const lines = Math.max(...wrapped.map((w) => w.length));
      const h = lines * 12 + 8;
      if (y - h < M + 24) { newPage(); drawHead(); }
      if (row.flagged) page.drawRectangle({ x: M, y: y - h, width: CONTENT_W, height: h, color: AMBER_BG });
      wrapped.forEach((cell, i) => {
        const isFlag = i === 3 && row.flagged;
        cell.forEach((ln, j) =>
          text(ln, M + cols[i].x + 6, y - 13 - j * 12, i === 0 || isFlag ? bold : regular, 9, isFlag ? AMBER : row.flagged && i === 1 ? AMBER : INK),
        );
      });
      y -= h;
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.4, color: LINE });
    }
    y -= 4;
  };

  // ---- Cover header ----
  newPage();
  page!.drawRectangle({ x: 0, y: H - 112, width: W, height: 112, color: GREEN });
  text("Baymax.", M, H - 52, bold, 26, WHITE);
  text("A little care, every day", M, H - 70, regular, 10, rgb(0.9, 0.94, 0.89));
  const title = "Health summary";
  text(title, W - M - bold.widthOfTextAtSize(title, 16), H - 50, bold, 16, WHITE);
  const gen = `Prepared ${generated}`;
  text(gen, W - M - regular.widthOfTextAtSize(gen, 9.5), H - 68, regular, 9.5, rgb(0.9, 0.94, 0.89));
  y = H - 112 - 26;

  // Patient card
  const facts: [string, string][] = [
    ["Name", d.name],
    ["Age", d.age == null ? "Not recorded" : String(d.age)],
    ["Date of birth", d.user?.dob ?? "Not recorded"],
    ["Sex", d.user?.sex ? titleCase(d.user.sex) : "Not recorded"],
  ];
  page!.drawRectangle({ x: M, y: y - 52, width: CONTENT_W, height: 56, color: WHITE, borderColor: LINE, borderWidth: 0.8 });
  facts.forEach(([k, v], i) => {
    const x = M + 16 + i * (CONTENT_W / 4);
    text(k.toUpperCase(), x, y - 16, bold, 7.5, MUTED);
    text(v, x, y - 36, bold, 12);
  });
  y -= 62;

  // At a glance
  const flaggedLabs = d.labs.filter((l) => isAbnormal(l.flag));
  const chips: [string, string][] = [
    ["Medications", String(d.medications.length)],
    ["Allergies", String(d.allergies.length)],
    ["Conditions", String(d.conditions.length)],
    ["Lab results", `${d.labs.length}${flaggedLabs.length ? ` (${flaggedLabs.length} flagged)` : ""}`],
  ];
  y -= 8;
  const cw = (CONTENT_W - 18) / 4;
  chips.forEach(([k, v], i) => {
    const x = M + i * (cw + 6);
    page!.drawRectangle({ x, y: y - 38, width: cw, height: 42, color: PANEL });
    text(v, x + 10, y - 17, bold, 13);
    text(k, x + 10, y - 31, regular, 8.5, MUTED);
  });
  y -= 46;

  // ---- Prescriptions ----
  section("Prescriptions and medications", d.medications.length);
  if (d.medications.length) {
    table(
      [{ label: "Medication", x: 0, w: 300 }, { label: "Dose and schedule", x: 300, w: CONTENT_W - 300 }],
      d.medications.map((m) => ({ cells: [m, "Not recorded in Baymax. Confirm with your prescriber."] })),
    );
  } else empty("No medications on record.");

  section("Allergies", d.allergies.length);
  if (d.allergies.length) {
    let x = M;
    ensure(26);
    for (const a of d.allergies) {
      const w = bold.widthOfTextAtSize(clean(a), 9.5) + 20;
      if (x + w > W - M) { x = M; y -= 24; ensure(26); }
      page!.drawRectangle({ x, y: y - 16, width: w, height: 20, color: AMBER_BG, borderColor: AMBER, borderWidth: 0.5 });
      text(a, x + 10, y - 10, bold, 9.5, AMBER);
      x += w + 6;
    }
    y -= 28;
  } else empty("No allergies on record. Not yet confirmed.");

  section("Conditions", d.conditions.length);
  if (d.conditions.length) {
    table(
      [{ label: "Condition", x: 0, w: 220 }, { label: "Status", x: 220, w: 100 }, { label: "Notes", x: 320, w: CONTENT_W - 320 }],
      d.conditions.map((c) => ({ cells: [c.name, titleCase(c.status || "active"), c.notes ?? ""] })),
    );
  } else empty("No conditions on record.");

  // ---- Bloodwork ----
  section("Bloodwork and lab results", d.labs.length);
  if (d.labs.length) {
    paragraph("Most recent result for each biomarker. Highlighted rows fall outside the reference range.", { size: 9, color: MUTED });
    y -= 4;
    const rows: { cells: string[]; flagged?: boolean; group?: string }[] = [];
    let lastPanel: string | undefined;
    for (const l of d.labs) {
      const panel = l.panel ?? "Other";
      if (panel !== lastPanel) { rows.push({ cells: [], group: panel }); lastPanel = panel; }
      const ref = l.low != null && l.high != null ? `${fmtNum(l.low)} - ${fmtNum(l.high)}`
        : l.high != null ? `< ${fmtNum(l.high)}` : l.low != null ? `> ${fmtNum(l.low)}` : "n/a";
      rows.push({
        cells: [l.biomarker, `${fmtNum(l.value)} ${l.unit}`.trim(), `${ref} ${l.unit}`.trim(), isAbnormal(l.flag) ? titleCase(l.flag!) : "In range", l.date],
        flagged: isAbnormal(l.flag),
      });
    }
    table(
      [
        { label: "Biomarker", x: 0, w: 170 },
        { label: "Result", x: 170, w: 100 },
        { label: "Reference", x: 270, w: 110 },
        { label: "Flag", x: 380, w: 70 },
        { label: "Date", x: 450, w: CONTENT_W - 450 },
      ],
      rows,
    );
  } else empty("No lab results on record.");

  if (d.measurements.length) {
    section("Body measurements", d.measurements.length);
    table(
      [{ label: "Measure", x: 0, w: 220 }, { label: "Value", x: 220, w: 150 }, { label: "Date", x: 370, w: CONTENT_W - 370 }],
      d.measurements.map((m) => ({ cells: [titleCase(m.type), `${fmtNum(m.value)} ${m.unit}`.trim(), m.date] })),
    );
  }

  // ---- Lifestyle ----
  if (d.wellness.length) {
    section("Energy, sleep and activity");
    for (const line of d.wellness) {
      ensure(18);
      page!.drawCircle({ x: M + 4, y: y - 6, size: 2, color: GREEN });
      paragraph(line, { x: M + 16, width: CONTENT_W - 16, size: 9.5 });
      y -= 3;
    }
  }

  if (d.records.length) {
    section("Records on file", d.records.length);
    table(
      [{ label: "Document", x: 0, w: 330 }, { label: "Source", x: 330, w: 100 }, { label: "Added", x: 430, w: CONTENT_W - 430 }],
      d.records.map((r) => ({ cells: [r.name, r.source === "upload" ? "Uploaded" : "Library", r.date] })),
    );
  }

  if (d.user?.notes) {
    section("Notes");
    paragraph(d.user.notes, { size: 9.5 });
  }

  // ---- Footers ----
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: M - 6 }, end: { x: W - M, y: M - 6 }, thickness: 0.5, color: LINE });
    p.drawText("Generated by Baymax from the information you have shared. Not medical advice. Please verify with your clinician.", {
      x: M, y: M - 18, size: 7.5, font: regular, color: MUTED,
    });
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: W - M - regular.widthOfTextAtSize(label, 7.5), y: M - 18, size: 7.5, font: regular, color: MUTED });
  });

  return pdf.save();
}

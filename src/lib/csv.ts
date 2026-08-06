/* Reading a spreadsheet export.
 *
 * This is deliberately hand-written rather than pulled from a library. The
 * files it has to survive come out of SAP, Oracle, Samsara and whatever
 * somebody keeps on a shared drive, and they are all slightly wrong in
 * different ways:
 *
 *   - Excel writes a byte-order mark at the start, so the first column header
 *     silently becomes "﻿SKU" and never matches anything.
 *   - Fields containing a comma are quoted, and a quote inside a quoted field
 *     is written twice. Splitting on commas destroys both.
 *   - A description field can contain a line break, so a "row" is not a line.
 *   - Windows exports end lines with CRLF; Mac exports sometimes with CR only.
 *   - European exports use semicolons, because there a comma is a decimal point.
 *
 * Every one of those produces a file that looks fine when opened and imports
 * as nonsense. Getting this right once is cheaper than explaining it later.
 */

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  /** Rows whose column count did not match the header. Kept, not dropped. */
  ragged: { line: number; got: number }[];
  delimiter: string;
}

/**
 * Works out what separates the fields by counting candidates outside quotes on
 * the first few lines. Guessing from the first line alone is wrong for files
 * whose header happens to contain a comma in a quoted label.
 */
export function detectDelimiter(text: string): string {
  const candidates = [",", ";", "\t", "|"];
  const sample = text.slice(0, 64 * 1024);
  let best = ",";
  let bestScore = -1;

  for (const d of candidates) {
    let inQuotes = false;
    const counts: number[] = [];
    let current = 0;

    for (let i = 0; i < sample.length; i++) {
      const c = sample[i];
      if (c === '"') {
        if (inQuotes && sample[i + 1] === '"') i++;
        else inQuotes = !inQuotes;
      } else if (!inQuotes && c === "\n") {
        counts.push(current);
        current = 0;
        if (counts.length >= 20) break;
      } else if (!inQuotes && c === d) {
        current++;
      }
    }
    if (current > 0) counts.push(current);
    if (!counts.length || counts[0] === 0) continue;

    // A real delimiter appears the same number of times on every line.
    const consistent = counts.filter((n) => n === counts[0]).length / counts.length;
    const score = counts[0] * consistent;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/** Parses the whole file. Never throws on malformed input — reports instead. */
export function parseCsv(input: string, delimiter?: string): ParsedCsv {
  // Strip the byte-order mark. Without this the first header never matches.
  let text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  // Normalise line endings so CR-only and CRLF files behave like LF ones.
  text = text.replace(/\r\n?/g, "\n");

  const d = delimiter || detectDelimiter(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let started = false; // distinguishes a trailing newline from an empty last row

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // an escaped quote
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"' && field === "") {
      inQuotes = true;
      started = true;
    } else if (c === d) {
      row.push(field);
      field = "";
      started = true;
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      started = false;
    } else {
      field += c;
      started = true;
    }
  }
  if (started || field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  // Drop rows that are entirely empty — exports often end with a blank line,
  // and some put a blank row between sections.
  const clean = rows.filter((r) => r.some((v) => v.trim() !== ""));
  if (!clean.length) return { headers: [], rows: [], ragged: [], delimiter: d };

  const headers = clean[0].map((h) => h.trim());
  const body = clean.slice(1);

  const ragged: { line: number; got: number }[] = [];
  const normalised = body.map((r, idx) => {
    if (r.length !== headers.length) ragged.push({ line: idx + 2, got: r.length });
    // Pad or trim so downstream code can index by column without checking.
    const out = r.slice(0, headers.length).map((v) => v.trim());
    while (out.length < headers.length) out.push("");
    return out;
  });

  return { headers, rows: normalised, ragged, delimiter: d };
}

/* ------------------------------------------------------------------ *
 * Value readers.
 *
 * Spreadsheets do not hand over clean numbers. A quantity arrives as
 * "1,250", "1 250", "(45)" for negative, or "45.0 EA". A date arrives in
 * whatever the exporter's locale felt like.
 * ------------------------------------------------------------------ */

/**
 * Returns null rather than NaN, so a bad cell can be reported not silently zeroed.
 *
 * `treatAs` resolves the one genuinely ambiguous case. "1.240" is 1,240 in a
 * German export and 1.24 in an American one, and no amount of looking at the
 * string alone can tell them apart. What does tell them apart is the column:
 * a quantity of stock cannot be one-and-a-quarter units, so in a whole-number
 * column a separator followed by exactly three digits is grouping. In a money
 * column it stays a decimal point, because 1.240 as a price is far more likely
 * to be 1.24 than one thousand two hundred and forty.
 */
export function readNumber(raw: string, treatAs: "any" | "whole" = "any"): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (s === "" || s === "-" || s === "—") return null;

  // Accounting negatives: (45) means -45.
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }

  // Strip currency symbols, unit suffixes and spaces used as thousand marks.
  s = s.replace(/[^\d.,\-+]/g, "").replace(/\s/g, "");
  if (s === "") return null;

  // Decide which separator is the decimal point. If both appear, the last one
  // wins — "1.234,56" is European, "1,234.56" is not.
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    // A lone comma groups digits if it is followed by exactly three of them.
    s = /,\d{3}(\D|$)/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot > -1 && treatAs === "whole") {
    // Same rule for a lone dot, but only where a fraction is impossible.
    if (/\.\d{3}(\D|$)/.test(s)) s = s.replace(/\./g, "");
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/**
 * Returns YYYY-MM-DD, or null.
 *
 * Ambiguous numeric dates are the one thing that cannot be solved by looking
 * at a single value: 03/04/2026 is March in the US and April everywhere else.
 * The caller passes what the file uses; guessing silently would put a whole
 * import a month out and nobody would notice until Guardian said something odd.
 */
export function readDate(raw: string, order: "dmy" | "mdy" | "ymd" = "dmy"): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (s === "") return null;

  // Already ISO, possibly with a time attached.
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const parts = s.match(/^(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})/);
  if (parts) {
    let a = parts[1], b = parts[2], c = parts[3];
    let y: string, m: string, d: string;
    if (a.length === 4 || order === "ymd") {
      y = a; m = b; d = c;
    } else if (order === "mdy") {
      m = a; d = b; y = c;
    } else {
      d = a; m = b; y = c;
    }
    if (y.length === 2) y = String(Number(y) > 70 ? 1900 + Number(y) : 2000 + Number(y));
    const mm = m.padStart(2, "0");
    const dd = d.padStart(2, "0");
    if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
    return `${y}-${mm}-${dd}`;
  }

  // Anything textual — "12 Mar 2026", "Mar 12, 2026" — via the platform.
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/** Which of the two orderings a column of dates is consistent with. */
export function detectDateOrder(samples: string[]): "dmy" | "mdy" | "ymd" | "ambiguous" {
  let dmyOnly = false;
  let mdyOnly = false;
  let sawIso = false;

  for (const s of samples) {
    if (!s) continue;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) { sawIso = true; continue; }
    const m = String(s).trim().match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-]\d{2,4}/);
    if (!m) continue;
    const first = Number(m[1]);
    const second = Number(m[2]);
    if (first > 12) dmyOnly = true;   // 13/04 can only be day first
    if (second > 12) mdyOnly = true;  // 04/13 can only be month second
  }

  if (dmyOnly && mdyOnly) return "ambiguous"; // the column is not consistent
  if (dmyOnly) return "dmy";
  if (mdyOnly) return "mdy";
  if (sawIso) return "ymd";
  return "ambiguous"; // every value ≤ 12: genuinely cannot be told apart
}

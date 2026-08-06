"use client";

/* Import.
 *
 * The universal connector. Every system a prospect runs — Samsara, SAP,
 * Oracle, a spreadsheet on a shared drive — has an Export button, and pressing
 * it needs nobody's permission. A live API connection needs their IT
 * department, a security review and procurement; a file needs ten minutes.
 * For a first conversation that difference is the whole thing.
 *
 * Nothing is written until the operator has seen exactly what will land.
 * Anything that cannot be read is shown as a problem rather than defaulted to
 * a number somebody might later act on — a quantity silently read as zero
 * would flow straight into a stockout finding and be believed.
 */

import { useState, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseCsv, readNumber, readDate, detectDateOrder, type ParsedCsv } from "@/lib/csv";
import { TARGETS, autoMap, matchEnum, type ImportTarget } from "@/lib/import/targets";

type DateOrder = "dmy" | "mdy" | "ymd";

interface RowProblem {
  line: number;
  field: string;
  value: string;
  why: string;
}

interface Prepared {
  rows: Record<string, unknown>[];
  problems: RowProblem[];
  skipped: number;
}

const PREVIEW = 8;
const MAX_PROBLEMS = 200;

export default function ImportPage() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [target, setTarget] = useState<ImportTarget>(TARGETS[0]);
  const [fileName, setFileName] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [dateOrder, setDateOrder] = useState<DateOrder>("dmy");
  const [orderAsked, setOrderAsked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  function reset() {
    setParsed(null);
    setMapping({});
    setFileName("");
    setResult(null);
    setFailure(null);
    setOrderAsked(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(file: File) {
    setResult(null);
    setFailure(null);
    const text = await file.text();
    const p = parseCsv(text);
    if (!p.headers.length) {
      setFailure("That file has no readable columns. It should be a CSV export with a header row.");
      return;
    }
    setFileName(file.name);
    setParsed(p);
    const m = autoMap(target, p.headers);
    setMapping(m);

    // Work out whether the dates can be read without asking.
    const dateField = target.fields.find((f) => f.kind === "date");
    if (dateField && m[dateField.key] !== undefined) {
      const col = m[dateField.key];
      const detected = detectDateOrder(p.rows.slice(0, 200).map((r) => r[col]));
      if (detected === "ambiguous") {
        setOrderAsked(true);
      } else {
        setDateOrder(detected);
        setOrderAsked(false);
      }
    }
  }

  function changeTarget(t: ImportTarget) {
    setTarget(t);
    setResult(null);
    if (parsed) setMapping(autoMap(t, parsed.headers));
  }

  /* Turns the mapped columns into rows ready for the database, collecting
     every reason a row could not be used rather than stopping at the first. */
  const prepared: Prepared = useMemo(() => {
    if (!parsed) return { rows: [], problems: [], skipped: 0 };
    const problems: RowProblem[] = [];
    const rows: Record<string, unknown>[] = [];
    let skipped = 0;

    parsed.rows.forEach((raw, i) => {
      const line = i + 2; // header is line 1
      const out: Record<string, unknown> = {};
      let usable = true;

      for (const f of target.fields) {
        const col = mapping[f.key];
        if (col === undefined) {
          if (f.required) {
            usable = false;
            if (problems.length < MAX_PROBLEMS && i === 0) {
              problems.push({ line, field: f.label, value: "", why: "no column chosen" });
            }
          }
          continue;
        }
        const cell = raw[col] ?? "";

        if (cell === "") {
          if (f.required) {
            usable = false;
            if (problems.length < MAX_PROBLEMS)
              problems.push({ line, field: f.label, value: "", why: "empty" });
          }
          continue;
        }

        if (f.kind === "number" || f.kind === "integer") {
          const n = readNumber(cell, f.kind === "integer" ? "whole" : "any");
          if (n === null) {
            if (problems.length < MAX_PROBLEMS)
              problems.push({ line, field: f.label, value: cell, why: "not a number" });
            if (f.required) usable = false;
            continue;
          }
          out[f.key] = f.kind === "integer" ? Math.round(n) : n;
        } else if (f.kind === "date") {
          const d = readDate(cell, dateOrder);
          if (!d) {
            if (problems.length < MAX_PROBLEMS)
              problems.push({ line, field: f.label, value: cell, why: "not a date" });
            if (f.required) usable = false;
            continue;
          }
          out[f.key] = d;
        } else if (f.kind === "enum") {
          const v = matchEnum(f, cell);
          if (!v) {
            if (problems.length < MAX_PROBLEMS)
              problems.push({ line, field: f.label, value: cell, why: "not recognised" });
            if (f.required) usable = false;
            continue;
          }
          out[f.key] = v;
        } else {
          out[f.key] = cell;
        }
      }

      if (usable) rows.push(out);
      else skipped++;
    });

    return { rows, problems, skipped };
  }, [parsed, mapping, target, dateOrder]);

  const missingRequired = target.fields.filter(
    (f) => f.required && mapping[f.key] === undefined
  );

  async function runImport() {
    if (!parsed) return;
    setBusy(true);
    setResult(null);
    setFailure(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You are not signed in.");
      const { data: appUser } = await supabase
        .from("app_user").select("company_id").eq("auth_id", user.id).single();
      if (!appUser) throw new Error("No company found for this account.");
      const companyId = appUser.company_id as string;

      const summary = await commit(target, prepared.rows, companyId, supabase);
      setResult(summary);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "The import did not complete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <h1 className="text-2xl font-bold text-ink">Import</h1>
      <p className="mt-1 text-sm text-muted">
        Bring in a spreadsheet export from whatever you already run. Nothing is saved until you
        have seen what will land.
      </p>

      {/* 1 — what is this file */}
      <section className="mt-7">
        <h2 className="text-xs uppercase tracking-wider text-muted">What is in the file?</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TARGETS.map((t) => (
            <button
              key={t.id}
              onClick={() => changeTarget(t)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                t.id === target.id
                  ? "border-brand bg-brand/10"
                  : "border-border bg-panel hover:bg-surface"
              }`}
            >
              <p className="text-sm font-semibold text-ink">{t.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{t.blurb}</p>
            </button>
          ))}
        </div>
      </section>

      {/* 2 — the file */}
      <section className="mt-7">
        <h2 className="text-xs uppercase tracking-wider text-muted">The file</h2>
        <div className="mt-3 rounded-xl border border-dashed border-border bg-panel p-6 text-center">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.tsv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light"
          >
            Choose a CSV file
          </button>
          <p className="mt-3 text-xs text-muted">
            Export from your system as CSV. Excel, SAP, Oracle and telematics platforms all offer it.
          </p>
          {fileName && (
            <p className="mt-3 text-sm text-ink">
              {fileName} — <span className="text-muted">
                {parsed?.rows.length ?? 0} rows, {parsed?.headers.length ?? 0} columns
                {parsed && parsed.delimiter !== "," &&
                  `, separated by ${parsed.delimiter === "\t" ? "tabs" : `"${parsed.delimiter}"`}`}
              </span>
            </p>
          )}
        </div>
      </section>

      {failure && (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {failure}
        </p>
      )}

      {parsed && (
        <>
          {/* 3 — columns */}
          <section className="mt-7">
            <h2 className="text-xs uppercase tracking-wider text-muted">Which column is which</h2>
            <p className="mt-1 text-xs text-muted">
              Matched by name where we could. Check them — a wrong column here is a wrong number
              in every finding afterwards.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {target.fields.map((f) => (
                <div key={f.key} className="rounded-lg border border-border bg-panel p-3">
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-sm text-ink">
                      {f.label}
                      {f.required && <span className="ml-1 text-red-400">*</span>}
                    </span>
                    <select
                      value={mapping[f.key] ?? -1}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setMapping((m) => {
                          const next = { ...m };
                          if (v === -1) delete next[f.key];
                          else next[f.key] = v;
                          return next;
                        });
                      }}
                      className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink"
                    >
                      <option value={-1}>— not in this file —</option>
                      {parsed.headers.map((h, i) => (
                        <option key={i} value={i}>{h || `(column ${i + 1})`}</option>
                      ))}
                    </select>
                  </label>
                  {f.help && <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{f.help}</p>}
                </div>
              ))}
            </div>
          </section>

          {orderAsked && (
            <section className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
              <p className="text-sm font-medium text-amber-300">Which way round are the dates?</p>
              <p className="mt-1 text-xs text-amber-200/80">
                Every date in this file could be read either way — 04/03/2026 is 4 March in most of
                the world and 3 April in the United States. Choosing wrong puts the whole import a
                month out, and nothing later would look obviously wrong.
              </p>
              <div className="mt-3 flex gap-2">
                {([["dmy", "Day first — 04/03 is 4 March"], ["mdy", "Month first — 04/03 is 3 April"]] as const).map(
                  ([v, label]) => (
                    <button
                      key={v}
                      onClick={() => { setDateOrder(v); setOrderAsked(false); }}
                      className="rounded-md border border-amber-400/50 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/20"
                    >
                      {label}
                    </button>
                  )
                )}
              </div>
            </section>
          )}

          {/* 4 — preview */}
          <section className="mt-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xs uppercase tracking-wider text-muted">What will land</h2>
              <p className="text-sm text-muted">
                <span className="font-medium text-ink">{prepared.rows.length}</span> rows ready
                {prepared.skipped > 0 && (
                  <span className="text-amber-400"> · {prepared.skipped} cannot be used</span>
                )}
              </p>
            </div>

            {prepared.rows.length > 0 && (
              <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-panel">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {target.fields.filter((f) => mapping[f.key] !== undefined).map((f) => (
                        <th key={f.key} className="whitespace-nowrap px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted">
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {prepared.rows.slice(0, PREVIEW).map((r, i) => (
                      <tr key={i} className="border-b border-border/40 last:border-0">
                        {target.fields.filter((f) => mapping[f.key] !== undefined).map((f) => (
                          <td key={f.key} className="whitespace-nowrap px-3 py-2 text-ink">
                            {r[f.key] === undefined ? <span className="text-muted">—</span> : String(r[f.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {prepared.problems.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                <p className="text-sm font-medium text-amber-300">
                  {prepared.problems.length === MAX_PROBLEMS ? "First " : ""}
                  {prepared.problems.length} cell{prepared.problems.length === 1 ? "" : "s"} could not be read
                </p>
                <ul className="mt-2 space-y-1 text-xs text-amber-200/90">
                  {prepared.problems.slice(0, 8).map((p, i) => (
                    <li key={i}>
                      Row {p.line} · {p.field} · {p.value ? `"${p.value}"` : "empty"} — {p.why}
                    </li>
                  ))}
                </ul>
                {prepared.problems.length > 8 && (
                  <p className="mt-2 text-xs text-amber-200/70">
                    and {prepared.problems.length - 8} more
                  </p>
                )}
              </div>
            )}

            {parsed.ragged.length > 0 && (
              <p className="mt-3 text-xs text-amber-400">
                {parsed.ragged.length} row{parsed.ragged.length === 1 ? " has" : "s have"} a
                different number of columns to the header. They have been padded — check the
                preview above before importing.
              </p>
            )}
          </section>

          {/* 5 — go */}
          <section className="mt-7 flex flex-wrap items-center gap-3">
            <button
              onClick={runImport}
              disabled={busy || prepared.rows.length === 0 || missingRequired.length > 0}
              className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-40"
            >
              {busy ? "Importing…" : `Import ${prepared.rows.length} rows`}
            </button>
            <button
              onClick={reset}
              className="rounded-md border border-border px-4 py-2.5 text-sm text-ink hover:bg-surface"
            >
              Start again
            </button>
            {missingRequired.length > 0 && (
              <p className="text-xs text-amber-400">
                Still need a column for {missingRequired.map((f) => f.label).join(", ")}.
              </p>
            )}
          </section>
        </>
      )}

      {result && (
        <div className="mt-6 rounded-xl border border-green-500/40 bg-green-500/10 p-4">
          <p className="text-sm text-green-300">{result}</p>
          <p className="mt-2 text-xs text-muted">
            Open Guardian and press Run checks to see what it makes of this.
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Writing.
 *
 * Sent in batches — a year of movements is tens of thousands of rows, and one
 * statement that size times out and leaves nobody knowing what landed.
 * ------------------------------------------------------------------ */

const BATCH = 500;

async function commit(
  target: ImportTarget,
  rows: Record<string, unknown>[],
  companyId: string,
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  if (target.id === "inventory_sku") {
    let done = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH).map((r) => ({ ...r, company_id: companyId }));
      const { error } = await supabase
        .from("inventory_sku")
        .upsert(chunk, { onConflict: "company_id,sku" });
      if (error) throw new Error(`Stopped after ${done} rows — ${error.message}`);
      done += chunk.length;
    }
    return `${done} stock items imported. Existing items were updated rather than duplicated.`;
  }

  if (target.id === "inventory_movement") {
    // Movements reference an item, so the items must already be here. Rows
    // naming something unknown are reported rather than silently dropped.
    const { data: skus, error: skuErr } = await supabase
      .from("inventory_sku").select("id, sku").eq("company_id", companyId);
    if (skuErr) throw new Error(skuErr.message);
    const byCode = new Map((skus ?? []).map((s) => [String(s.sku).trim().toLowerCase(), s.id]));

    const ready: Record<string, unknown>[] = [];
    const unknown = new Set<string>();
    for (const r of rows) {
      const code = String(r.sku ?? "").trim().toLowerCase();
      const id = byCode.get(code);
      if (!id) { unknown.add(String(r.sku ?? "")); continue; }
      const { sku, ...rest } = r;
      ready.push({ ...rest, sku_id: id, company_id: companyId });
    }

    let done = 0;
    for (let i = 0; i < ready.length; i += BATCH) {
      const chunk = ready.slice(i, i + BATCH);
      const { error } = await supabase.from("inventory_movement").insert(chunk);
      if (error) throw new Error(`Stopped after ${done} rows — ${error.message}`);
      done += chunk.length;
    }
    const missed = unknown.size
      ? ` ${unknown.size} item code${unknown.size === 1 ? "" : "s"} in the file are not in your stock list yet — import Stock items first, then this file again.`
      : "";
    return `${done} movements imported. Stock levels have been recalculated from them.${missed}`;
  }

  if (target.id === "fleet_vehicle") {
    const { data: existing } = await supabase
      .from("fleet_vehicle").select("id, name").eq("company_id", companyId);
    const seen = new Map((existing ?? []).map((v) => [String(v.name).trim().toLowerCase(), v.id]));

    let created = 0, updated = 0;
    for (const r of rows) {
      const key = String(r.name ?? "").trim().toLowerCase();
      const id = seen.get(key);
      if (id) {
        // mileage is left alone: migration 0009 derives it from trips, so a
        // value written here would be overwritten on the next one.
        const { mileage, ...rest } = r;
        const { error } = await supabase.from("fleet_vehicle").update(rest).eq("id", id);
        if (error) throw new Error(error.message);
        updated++;
      } else {
        const { error } = await supabase
          .from("fleet_vehicle").insert({ ...r, company_id: companyId });
        if (error) throw new Error(error.message);
        created++;
      }
    }
    return `${created} vehicles added, ${updated} updated.`;
  }

  if (target.id === "fleet_trip") {
    const { data: vehicles } = await supabase
      .from("fleet_vehicle").select("id, name, license_plate").eq("company_id", companyId);
    const byName = new Map<string, string>();
    for (const v of vehicles ?? []) {
      byName.set(String(v.name).trim().toLowerCase(), v.id);
      if (v.license_plate) byName.set(String(v.license_plate).trim().toLowerCase(), v.id);
    }

    const ready: Record<string, unknown>[] = [];
    const unknown = new Set<string>();
    for (const r of rows) {
      const key = String(r.vehicle ?? "").trim().toLowerCase();
      const id = byName.get(key);
      if (!id) { unknown.add(String(r.vehicle ?? "")); continue; }
      const { vehicle, ...rest } = r;
      ready.push({ ...rest, vehicle_id: id, company_id: companyId });
    }

    let done = 0;
    for (let i = 0; i < ready.length; i += BATCH) {
      const chunk = ready.slice(i, i + BATCH);
      const { error } = await supabase.from("fleet_trip").insert(chunk);
      if (error) throw new Error(`Stopped after ${done} rows — ${error.message}`);
      done += chunk.length;
    }
    const missed = unknown.size
      ? ` ${unknown.size} vehicle name${unknown.size === 1 ? "" : "s"} are not in your fleet list yet — import Vehicles first, then this file again.`
      : "";
    return `${done} trips imported.${missed}`;
  }

  throw new Error("That import is not built yet.");
}

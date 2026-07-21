import { saveDailyEntry } from "./actions";
import { CATEGORY_LABELS, CATEGORY_WEIGHTS } from "@/lib/business-health";

const CATEGORIES = Object.keys(CATEGORY_WEIGHTS) as (keyof typeof CATEGORY_WEIGHTS)[];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function Field({
  label,
  name,
  type = "number",
  step,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  defaultValue?: string | number;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
    </label>
  );
}

export default function DataEntryPage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="text-xl font-semibold text-ink">Enter Today's Data</h1>
      <p className="mb-6 text-sm text-muted">
        One KPI snapshot and one score per category, per day. This is what feeds the
        dashboard — v1.5 adds CSV import so this becomes optional for bulk data.
      </p>

      <form action={saveDailyEntry} className="space-y-8">
        <Field label="Date" name="date" type="date" defaultValue={todayISO()} required />

        <section className="rounded-xl border border-border bg-panel p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">KPI Snapshot</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Revenue ($)" name="revenue" step="0.01" defaultValue={0} />
            <Field label="Profit ($)" name="profit" step="0.01" defaultValue={0} />
            <Field label="Total Loads" name="total_loads" defaultValue={0} />
            <Field
              label="Fleet Utilization (%)"
              name="fleet_utilization_pct"
              step="0.1"
              defaultValue={0}
            />
            <Field
              label="On-Time Delivery (%)"
              name="on_time_delivery_pct"
              step="0.1"
              defaultValue={0}
            />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-panel p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink">Category Scores</h2>
          <p className="mb-4 text-xs text-muted">
            0–100 per category. Leave blank to skip — the Health Score re-normalizes
            around whatever's entered.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {CATEGORIES.map((cat) => (
              <Field
                key={cat}
                label={`${CATEGORY_LABELS[cat]} (${Math.round(CATEGORY_WEIGHTS[cat] * 100)}%)`}
                name={`score_${cat}`}
                step="0.1"
              />
            ))}
          </div>
        </section>

        <button
          type="submit"
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-light"
        >
          Save entry
        </button>
      </form>
    </div>
  );
}

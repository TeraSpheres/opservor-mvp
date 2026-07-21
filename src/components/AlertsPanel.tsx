import type { Alert } from "@/lib/types";
import { resolveAlert, createAlert } from "@/app/(dashboard)/actions";

const SEVERITY_RANK: Record<Alert["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

const SEVERITY_STYLE: Record<Alert["severity"], string> = {
  critical: "bg-band-critical/10 text-band-critical border-band-critical/30",
  high: "bg-band-atrisk/10 text-band-atrisk border-band-atrisk/30",
  medium: "bg-band-watch/10 text-band-watch border-band-watch/30",
};

export default function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  const sorted = [...alerts].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  );

  return (
    <div className="rounded-xl border border-border bg-panel p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Critical Alerts</h2>
        <span className="text-xs text-muted">{alerts.length} open</span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted">No open alerts.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((alert) => (
            <li
              key={alert.id}
              className={`rounded-lg border p-3 ${SEVERITY_STYLE[alert.severity]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">{alert.title}</p>
                  {alert.detail && (
                    <p className="mt-0.5 text-xs text-muted">{alert.detail}</p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    {alert.owner ? `Owner: ${alert.owner}` : "No owner assigned"}
                    {alert.due_date ? ` · Due ${alert.due_date}` : ""}
                  </p>
                </div>
                <form action={resolveAlert}>
                  <input type="hidden" name="id" value={alert.id} />
                  <button
                    type="submit"
                    className="shrink-0 rounded-md border border-border bg-panel px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface"
                  >
                    Resolve
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-medium text-brand">
          + Add alert
        </summary>
        <form action={createAlert} className="mt-3 space-y-2">
          <input
            name="title"
            placeholder="Title"
            required
            className="w-full rounded-md border border-border px-2.5 py-1.5 text-sm"
          />
          <input
            name="detail"
            placeholder="Detail (optional)"
            className="w-full rounded-md border border-border px-2.5 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <select
              name="severity"
              defaultValue="medium"
              className="rounded-md border border-border px-2.5 py-1.5 text-sm"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
            <input
              name="owner"
              placeholder="Owner"
              className="flex-1 rounded-md border border-border px-2.5 py-1.5 text-sm"
            />
            <input
              name="due_date"
              type="date"
              className="rounded-md border border-border px-2.5 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-light"
          >
            Add alert
          </button>
        </form>
      </details>
    </div>
  );
}

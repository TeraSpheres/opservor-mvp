import type { KpiSnapshot } from "@/lib/types";

function Card({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel p-5 shadow-sm">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export default function KpiCards({ kpi }: { kpi: KpiSnapshot | null }) {
  if (!kpi) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-panel p-6 text-center text-sm text-muted">
        No KPI snapshot entered yet. Add one from Data Entry.
      </div>
    );
  }

  const margin = kpi.revenue > 0 ? (kpi.profit / kpi.revenue) * 100 : 0;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      <Card
        label="Revenue"
        value={`$${kpi.revenue.toLocaleString()}`}
        sub={kpi.date}
      />
      <Card
        label="Profit"
        value={`$${kpi.profit.toLocaleString()}`}
        sub={`${margin.toFixed(1)}% margin`}
      />
      <Card label="Total Loads" value={kpi.total_loads.toLocaleString()} />
      <Card
        label="Fleet Utilization"
        value={`${kpi.fleet_utilization_pct}%`}
      />
      <Card
        label="On-Time Delivery"
        value={`${kpi.on_time_delivery_pct}%`}
      />
    </div>
  );
}

import type { KpiSnapshot } from "@/lib/types";

function IconWrap({
  bg,
  fg,
  children,
}: {
  bg: string;
  fg: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${bg} ${fg}`}
    >
      {children}
    </span>
  );
}

function DollarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20" />
      <path d="M16.5 6.5c0-1.4-2-2.5-4.5-2.5S7.5 5.1 7.5 6.5 9.5 9 12 9s4.5 1.1 4.5 2.5-2 2.5-4.5 2.5-4.5-1.1-4.5-2.5" />
    </svg>
  );
}

function TrendingUpIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h11v8H3z" />
      <path d="M14 10h4l3 3v2h-7z" />
      <circle cx="6.5" cy="17.5" r="1.5" />
      <circle cx="17.5" cy="17.5" r="1.5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function Card({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{label}</p>
        {icon}
      </div>
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
        icon={
          <IconWrap bg="bg-emerald-100" fg="text-emerald-600">
            <DollarIcon />
          </IconWrap>
        }
      />
      <Card
        label="Profit"
        value={`$${kpi.profit.toLocaleString()}`}
        sub={`${margin.toFixed(1)}% margin`}
        icon={
          <IconWrap bg="bg-violet-100" fg="text-violet-600">
            <TrendingUpIcon />
          </IconWrap>
        }
      />
      <Card
        label="Total Loads"
        value={kpi.total_loads.toLocaleString()}
        icon={
          <IconWrap bg="bg-amber-100" fg="text-amber-600">
            <BoxIcon />
          </IconWrap>
        }
      />
      <Card
        label="Fleet Utilization"
        value={`${kpi.fleet_utilization_pct}%`}
        icon={
          <IconWrap bg="bg-indigo-100" fg="text-indigo-600">
            <TruckIcon />
          </IconWrap>
        }
      />
      <Card
        label="On-Time Delivery"
        value={`${kpi.on_time_delivery_pct}%`}
        icon={
          <IconWrap bg="bg-teal-100" fg="text-teal-600">
            <ClockIcon />
          </IconWrap>
        }
      />
    </div>
  );
}

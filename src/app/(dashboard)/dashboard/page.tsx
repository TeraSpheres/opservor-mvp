import { createClient } from "@/lib/supabase/server";
import HealthScoreCard from "@/components/HealthScoreCard";
import KpiCards from "@/components/KpiCards";
import AlertsPanel from "@/components/AlertsPanel";
import AskOpservorPanel from "@/components/AskOpservorPanel";
import type { Alert, CategoryScore, KpiSnapshot } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: appUser } = await supabase
    .from("app_user")
    .select("company_id")
    .eq("auth_id", user!.id)
    .single();

  const companyId = appUser?.company_id;

  const [{ data: kpiRows }, { data: scoreRows }, { data: alertRows }] = companyId
    ? await Promise.all([
        supabase
          .from("kpi_snapshot")
          .select("*")
          .eq("company_id", companyId)
          .order("date", { ascending: false })
          .limit(1),
        supabase
          .from("category_score")
          .select("*")
          .eq("company_id", companyId)
          .order("date", { ascending: false })
          .limit(20),
        supabase
          .from("alert")
          .select("*")
          .eq("company_id", companyId)
          .eq("status", "open")
          .order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const latestKpi = (kpiRows?.[0] as KpiSnapshot | undefined) ?? null;
  const allScores = (scoreRows ?? []) as CategoryScore[];
  const latestDate = allScores[0]?.date;
  const latestScores = allScores.filter((s) => s.date === latestDate);
  const openAlerts = (alertRows ?? []) as Alert[];

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Founder Dashboard</h1>
          <p className="text-sm text-muted">
            {latestKpi ? `As of ${latestKpi.date}` : "No data entered yet"}
          </p>
        </div>
        <a
          href="/dashboard/entry"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light"
        >
          Enter today's data
        </a>
      </div>

      <div className="mb-6">
        <KpiCards kpi={latestKpi} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <HealthScoreCard scores={latestScores} />
          <AlertsPanel alerts={openAlerts} />
        </div>
        <div className="lg:col-span-1">
          <AskOpservorPanel />
        </div>
      </div>
    </div>
  );
}

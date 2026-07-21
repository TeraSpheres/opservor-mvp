import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askOpservor } from "@/lib/ask-opservor";
import type { Alert, CategoryScore, KpiSnapshot } from "@/lib/types";

export async function POST(request: Request) {
  const { question } = (await request.json()) as { question?: string };
  if (!question || !question.trim()) {
    return NextResponse.json({ answer: "Ask me something first." });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: appUser } = await supabase
    .from("app_user")
    .select("company_id")
    .eq("auth_id", user.id)
    .single();

  if (!appUser) {
    return NextResponse.json({ error: "No company found" }, { status: 400 });
  }

  const companyId = appUser.company_id as string;

  const [{ data: kpiRows }, { data: scoreRows }, { data: alertRows }] = await Promise.all([
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
      .eq("status", "open"),
  ]);

  const latestKpi = (kpiRows?.[0] as KpiSnapshot | undefined) ?? null;

  // Category scores are fetched most-recent-first across categories;
  // keep only the rows matching the most recent date present.
  const allScores = (scoreRows ?? []) as CategoryScore[];
  const latestDate = allScores[0]?.date;
  const latestCategoryScores = allScores.filter((s) => s.date === latestDate);

  const answer = askOpservor(question, {
    latestKpi,
    latestCategoryScores,
    openAlerts: (alertRows ?? []) as Alert[],
  });

  return NextResponse.json({ answer });
}

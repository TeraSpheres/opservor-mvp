import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askOpservor } from "@/lib/ask-opservor";
import { askWithLlm, llmAvailable, lastLlmFailure, type AskContext } from "@/lib/ask-llm";
import type { Alert, CategoryScore, KpiSnapshot } from "@/lib/types";

/* Ask Opservor.
 *
 * Two ways of answering, and the fallback is not a placeholder.
 *
 * With an API key configured, the question and the tenant's own figures go to
 * a model that must answer from them and may not invent any others. Without
 * one, the original five-pattern matcher answers — narrow, but incapable of
 * being wrong, which for this product is the more important property.
 *
 * Everything read here goes through the caller's own session client, so
 * row-level security decides what the context can contain. A question can
 * never surface another company's data because the query never sees it.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Long questions cost more and say less. */
const MAX_QUESTION = 500;

export async function POST(request: Request) {
  let body: { question?: string };
  try {
    body = (await request.json()) as { question?: string };
  } catch {
    return NextResponse.json({ error: "Could not read the request." }, { status: 400 });
  }

  const question = (body.question ?? "").trim().slice(0, MAX_QUESTION);
  if (!question) return NextResponse.json({ answer: "Ask me something first." });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: appUser } = await supabase
    .from("app_user")
    .select("company_id")
    .eq("auth_id", user.id)
    .single();

  if (!appUser) return NextResponse.json({ error: "No company found" }, { status: 400 });

  const companyId = appUser.company_id as string;

  const [
    { data: kpiRows },
    { data: scoreRows },
    { data: alertRows },
    { data: findingRows },
    { data: company },
  ] = await Promise.all([
    supabase.from("kpi_snapshot").select("*")
      .eq("company_id", companyId).order("date", { ascending: false }).limit(1),
    supabase.from("category_score").select("*")
      .eq("company_id", companyId).order("date", { ascending: false }).limit(20),
    supabase.from("alert").select("*")
      .eq("company_id", companyId).eq("status", "open"),
    // The findings are the reason this is worth asking at all — they are the
    // only rows that say what is going to happen rather than what has.
    supabase.from("guardian_finding")
      .select("severity, title, detail, recommendation, modules")
      .in("status", ["open", "acknowledged"])
      .order("severity"),
    supabase.from("company").select("name").eq("id", companyId).single(),
  ]);

  // What could not be checked. Missing on a database without 0021, which is
  // fine — it simply means nothing is reported as unknown.
  let readiness: AskContext["readiness"] = [];
  const { data: readyRows } = await supabase.rpc("guardian_readiness");
  if (Array.isArray(readyRows)) readiness = readyRows as AskContext["readiness"];

  const latestKpi = (kpiRows?.[0] as KpiSnapshot | undefined) ?? null;
  const allScores = (scoreRows ?? []) as CategoryScore[];
  const latestDate = allScores[0]?.date;
  const latestCategoryScores = allScores.filter((s) => s.date === latestDate);
  const openAlerts = (alertRows ?? []) as Alert[];

  let llmFailed = false;

  if (llmAvailable()) {
    const ctx: AskContext = {
      companyName: (company?.name as string) ?? undefined,
      findings: (findingRows ?? []).map((f) => ({
        severity: String(f.severity),
        title: String(f.title),
        detail: String(f.detail),
        recommendation: (f.recommendation as string | null) ?? null,
        modules: (f.modules as string[]) ?? [],
      })),
      kpi: (latestKpi as unknown as Record<string, unknown>) ?? null,
      scores: latestCategoryScores.map((s) => ({
        category: String(s.category),
        score: Number(s.score),
      })),
      openAlerts: openAlerts.map((a) => ({
        title: String(a.title),
        severity: String(a.severity),
      })),
      readiness,
    };

    const answer = await askWithLlm(question, ctx);
    if (answer) return NextResponse.json({ answer, source: "llm" });

    // Fell through: a timeout, a retired model name, a rejected key. The
    // narrow answer is still better than an apology — but falling back
    // silently is how you end up unable to tell a working fallback from a
    // broken provider, which is the exact fault this product exists to
    // report. So it goes in the server log, where the reason can name the
    // provider without ever reaching the browser.
    console.error("[ask-opservor] LLM unavailable, using patterns:", lastLlmFailure());
    llmFailed = true;
  }

  const answer = askOpservor(question, {
    latestKpi,
    latestCategoryScores,
    openAlerts,
  });

  // "configured but failed" and "never configured" look identical from the
  // outside and need different fixes, so they are distinguished here.
  return NextResponse.json({
    answer,
    source: llmFailed ? "patterns-after-failure" : "patterns",
  });
}

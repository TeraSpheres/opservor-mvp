"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

const CATEGORIES: Category[] = [
  "finance",
  "operations",
  "customer",
  "hr",
  "fleet_assets",
  "safety_compliance",
  "inventory_procurement",
];

async function currentCompanyId() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("app_user")
    .select("company_id")
    .eq("auth_id", user.id)
    .single();

  if (error || !data) throw new Error("No company found for this user");
  return data.company_id as string;
}

export async function saveDailyEntry(formData: FormData) {
  const company_id = await currentCompanyId();
  const supabase = createClient();

  const date = String(formData.get("date"));
  if (!date) throw new Error("Date is required");

  // KPI snapshot (Section 5) — upsert on (company_id, date).
  const { error: kpiError } = await supabase.from("kpi_snapshot").upsert(
    {
      company_id,
      date,
      revenue: Number(formData.get("revenue") || 0),
      profit: Number(formData.get("profit") || 0),
      total_loads: Number(formData.get("total_loads") || 0),
      fleet_utilization_pct: Number(formData.get("fleet_utilization_pct") || 0),
      on_time_delivery_pct: Number(formData.get("on_time_delivery_pct") || 0),
    },
    { onConflict: "company_id,date" }
  );
  if (kpiError) throw new Error(kpiError.message);

  // Category scores (Section 5/6) — one upsert per category present.
  const rows = CATEGORIES.filter((c) => formData.get(`score_${c}`) !== null && formData.get(`score_${c}`) !== "").map(
    (category) => ({
      company_id,
      date,
      category,
      score: Number(formData.get(`score_${category}`)),
    })
  );

  if (rows.length > 0) {
    const { error: scoreError } = await supabase
      .from("category_score")
      .upsert(rows, { onConflict: "company_id,date,category" });
    if (scoreError) throw new Error(scoreError.message);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

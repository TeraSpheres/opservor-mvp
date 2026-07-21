"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AlertSeverity } from "@/lib/types";

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

export async function resolveAlert(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createClient();

  const { error } = await supabase
    .from("alert")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function createAlert(formData: FormData) {
  const company_id = await currentCompanyId();
  const supabase = createClient();

  const title = String(formData.get("title") || "").trim();
  const detail = String(formData.get("detail") || "").trim() || null;
  const severity = String(formData.get("severity") || "medium") as AlertSeverity;
  const owner = String(formData.get("owner") || "").trim() || null;
  const due_date = String(formData.get("due_date") || "") || null;

  if (!title) throw new Error("Title is required");

  const { error } = await supabase.from("alert").insert({
    company_id,
    title,
    detail,
    severity,
    owner,
    due_date,
    status: "open",
  });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

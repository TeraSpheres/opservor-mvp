import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // The company name was never shown anywhere in the product. With one tenant
  // that was merely untidy; with demo companies to switch between it means
  // there is no way to tell whose data is on screen.
  const { data: appUser } = await supabase
    .from("app_user")
    .select("name, company:company_id (name)")
    .eq("auth_id", user.id)
    .maybeSingle();

  // The join comes back as an object or a single-element array depending on
  // how PostgREST resolves the relationship, so handle both.
  const companyRel = appUser?.company as { name?: string } | { name?: string }[] | null | undefined;
  const companyName = Array.isArray(companyRel) ? companyRel[0]?.name : companyRel?.name;

  return (
    <div className="flex">
      <Sidebar
        userName={appUser?.name ?? user.email ?? "Founder"}
        companyName={companyName ?? null}
      />
      <main className="flex-1 min-h-screen bg-surface">{children}</main>
    </div>
  );
}

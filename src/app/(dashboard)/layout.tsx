import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import AskOpservorChat from "@/components/AskOpservorChat";

/* This layout renders which tenant you are signed in to, so it must never be
 * served from a cache. Next.js will happily reuse a rendered layout, and a
 * cached one here means the sidebar keeps naming a company you are no longer
 * looking at — which is exactly what happened after switching tenants in the
 * database: the data changed, the panel did not.
 *
 * Getting this wrong on a multi-tenant product is worse than a stale label.
 * A cached shell is one step away from showing one customer another
 * customer's name. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  //
  // Two plain queries rather than an embedded join. The join form depends on
  // PostgREST resolving the relationship and is sensitive to its own syntax;
  // when it fails it returns nothing rather than an error, so the name simply
  // never appeared and there was nothing to see. Two reads always work.
  const { data: appUser } = await supabase
    .from("app_user")
    .select("name, company_id")
    .eq("auth_id", user.id)
    .maybeSingle();

  let companyName: string | null = null;
  if (appUser?.company_id) {
    const { data: company } = await supabase
      .from("company")
      .select("name")
      .eq("id", appUser.company_id)
      .maybeSingle();
    companyName = company?.name ?? null;
  }

  return (
    <div className="flex">
      <Sidebar
        userName={appUser?.name ?? user.email ?? "Founder"}
        companyName={companyName}
      />
      <main className="flex-1 min-h-screen bg-surface">{children}</main>
      {/* On every screen, because the question usually arrives while you are
          looking at something else. */}
      <AskOpservorChat />
    </div>
  );
}

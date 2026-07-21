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

  const { data: appUser } = await supabase
    .from("app_user")
    .select("name")
    .eq("auth_id", user.id)
    .maybeSingle();

  return (
    <div className="flex">
      <Sidebar userName={appUser?.name ?? user.email ?? "Founder"} />
      <main className="flex-1 min-h-screen bg-surface">{children}</main>
    </div>
  );
}

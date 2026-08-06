"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import { signOut } from "@/app/login/actions";

// Per Section 4 of the spec: only "Founder Dashboard" and "Data Entry"
// are functional in v1. Everything else is a visible-but-inert nav item
// that routes to the shared "Coming soon" placeholder.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", live: true },
  // Sits second, directly under the dashboard. Guardian is meant to be the
  // thing you look at, not a report you go hunting for.
  { href: "/guardian", label: "Guardian", live: true },
  { href: "/dashboard/entry", label: "Data Entry", live: true },
  // Sits with Data Entry because it is the same job at a different scale —
  // one row typed, or a year of them from whatever system they already run.
  { href: "/import", label: "Import", live: true },
  { href: "/fleet", label: "Fleet", live: true },
  { href: "/warehouse", label: "Warehouse", live: true },
  { href: "/inventory", label: "Inventory", live: true },
  { href: "/finance", label: "Finance", live: true },
  { href: "/hr", label: "HR", live: true },
  { href: "/safety", label: "Safety", live: true },
  { href: "/reports", label: "Reports", live: true },
];

export default function Sidebar({
  userName,
  companyName,
}: {
  userName: string;
  companyName?: string | null;
}) {
  const pathname = usePathname();

  // Seeded companies carry (DEMO) in the name. Flagging that in the interface
  // means a screenshot can never be mistaken for a real customer's data.
  const isDemo = Boolean(companyName && /\(DEMO\)/i.test(companyName));
  const displayName = companyName?.replace(/\s*\(DEMO\)\s*/i, "").trim();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-panel">
      <div className="flex items-center gap-2 px-5 py-5">
        <Logo className="h-8 w-8" />
        <div>
          <p className="text-sm font-semibold text-ink leading-none">Opservor HQ</p>
          <p className="text-xs text-muted leading-none mt-1">v1.3</p>
        </div>
      </div>

      {companyName && (
        <div className="mx-3 mb-3 rounded-md border border-border bg-surface px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">Viewing</p>
          <p className="mt-0.5 truncate text-sm font-medium text-ink" title={companyName}>
            {displayName || companyName}
          </p>
          {isDemo && (
            <span className="mt-1 inline-block rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              DEMO DATA
            </span>
          )}
        </div>
      )}

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-brand text-white"
                  : "text-ink hover:bg-surface"
              }`}
            >
              <span>{item.label}</span>
              {!item.live && (
                <span
                  className={`text-[10px] uppercase tracking-wide ${
                    active ? "text-white/70" : "text-muted"
                  }`}
                >
                  soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-5 py-4">
        <p className="text-sm font-medium text-ink truncate">{userName}</p>
        <p className="text-xs text-muted mb-3">Founder</p>
        <form action={signOut}>
          <button
            type="submit"
            className="text-xs font-medium text-muted hover:text-ink transition-colors"
          >
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}

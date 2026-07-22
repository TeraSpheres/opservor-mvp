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
  { href: "/dashboard/entry", label: "Data Entry", live: true },
  { href: "/fleet", label: "Fleet", live: false },
  { href: "/warehouse", label: "Warehouse", live: false },
  { href: "/inventory", label: "Inventory", live: false },
  { href: "/finance", label: "Finance", live: false },
  { href: "/hr", label: "HR", live: false },
  { href: "/safety", label: "Safety", live: false },
  { href: "/reports", label: "Reports", live: false },
];

export default function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-panel">
      <div className="flex items-center gap-2 px-5 py-5">
        <Logo className="h-8 w-8" />
        <div>
          <p className="text-sm font-semibold text-ink leading-none">Opservor HQ</p>
          <p className="text-xs text-muted leading-none mt-1">v1.3</p>
        </div>
      </div>

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

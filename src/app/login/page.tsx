import Logo from "@/components/Logo";
import { signIn } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo className="mx-auto mb-3 h-10 w-10" />
          <h1 className="text-xl font-semibold text-ink">Opservor HQ</h1>
          <p className="text-sm text-muted">Founder Dashboard</p>
        </div>

        <form
          action={signIn}
          className="rounded-xl border border-border bg-panel p-6 shadow-sm space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-ink mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="••••••••"
            />
          </div>

          {searchParams?.error && (
            <p className="text-sm text-band-critical">{searchParams.error}</p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-brand py-2 text-sm font-medium text-white hover:bg-brand-light transition-colors"
          >
            Log in
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          Accounts are created in Supabase Auth — see README for setup.
        </p>
      </div>
    </div>
  );
}

"use client";

/* Connections.
 *
 * Where an operator hands Opservor a key to one of their own systems. The key
 * is typed here, sent once to a server route, encrypted, and never comes back
 * — not to this screen, not to any screen. Once saved, all this page can tell
 * you is that a key exists, which is deliberately all anyone needs to know.
 *
 * The alternative to this screen is the Import page, and for most first
 * conversations that is still the better answer: a file needs nobody's
 * permission, and a live connection needs the customer's IT department.
 */

import { useState, useEffect } from "react";

interface Provider {
  id: string;
  label: string;
  hint: string;
  brings: string;
}

interface Connection {
  id: string;
  provider: string;
  label: string;
  status: string;
  base_url: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_message: string | null;
  hasCredential: boolean;
}

const PROVIDERS: Provider[] = [
  {
    id: "samsara",
    label: "Samsara",
    hint: "In Samsara: Settings → API Tokens. A read-only token is enough.",
    brings: "Vehicles and trips",
  },
];

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [provider, setProvider] = useState(PROVIDERS[0].id);
  const [label, setLabel] = useState("");
  const [token, setToken] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations");
      if (res.status === 401) { setUnavailable(true); return; }
      const body = await res.json();
      if (body.error) setProblem(body.error);
      else setConnections(body.connections ?? []);
    } catch {
      setProblem("Could not load connections.");
    } finally {
      setLoading(false);
    }
  }

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    setDone(null);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, label, token, baseUrl }),
      });
      const body = await res.json();
      if (!res.ok) {
        setProblem(body.error || "That did not work.");
      } else {
        setDone(body.message || "Connected.");
        // Cleared immediately. There is no reason for a key to sit in a form
        // field after it has been stored, and every reason for it not to.
        setToken("");
        setLabel("");
        await load();
      }
    } catch {
      setProblem("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const [syncing, setSyncing] = useState<string | null>(null);

  async function sync(id: string) {
    setSyncing(id);
    setProblem(null);
    setDone(null);
    try {
      const res = await fetch("/api/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const body = await res.json();
      if (!res.ok) setProblem(body.error || "The sync did not complete.");
      else setDone(body.message || "Done.");
      await load();
    } catch {
      setProblem("Could not reach the server.");
    } finally {
      setSyncing(null);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Remove "${name}"? The stored key is deleted with it.`)) return;
    setProblem(null);
    const res = await fetch(`/api/integrations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) setProblem(body.error || "Could not remove it.");
    await load();
  }

  const chosen = PROVIDERS.find((p) => p.id === provider)!;

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <h1 className="text-2xl font-bold text-ink">Connections</h1>
      <p className="mt-1 text-sm text-muted">
        Let Opservor read from a system you already run. Your key is encrypted the moment it
        arrives and is never shown again.
      </p>

      {/* what is connected */}
      <section className="mt-7">
        <h2 className="text-xs uppercase tracking-wider text-muted">Connected</h2>
        {loading ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : unavailable ? (
          <p className="mt-3 text-sm text-muted">Sign in to manage connections.</p>
        ) : connections.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-border bg-panel p-6 text-center">
            <p className="text-sm text-ink">Nothing connected yet.</p>
            <p className="mt-1 text-xs text-muted">
              You do not need a connection to try Opservor — the Import page takes a spreadsheet
              export from any system and needs nobody&apos;s permission.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {connections.map((c) => (
              <div key={c.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-panel p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{c.label}</span>
                    <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted">
                      {c.provider}
                    </span>
                    {c.hasCredential ? (
                      <span className="rounded-md bg-green-500/15 px-2 py-0.5 text-xs text-green-400">
                        key stored
                      </span>
                    ) : (
                      <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
                        no key
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {c.last_sync_at
                      ? `Last read ${new Date(c.last_sync_at).toLocaleString()}${
                          c.last_sync_status ? ` — ${c.last_sync_status}` : ""
                        }`
                      : "Never read anything yet."}
                  </p>
                  {c.last_sync_message && (
                    <p className="mt-1 text-xs text-muted">{c.last_sync_message}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => sync(c.id)}
                    disabled={!c.hasCredential || syncing !== null}
                    className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-light disabled:opacity-40"
                  >
                    {syncing === c.id ? "Reading…" : "Read now"}
                  </button>
                  <button
                    onClick={() => remove(c.id, c.label)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* add one */}
      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wider text-muted">Connect a system</h2>

        <form onSubmit={connect} className="mt-3 rounded-xl border border-border bg-panel p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-ink">System</span>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-muted">Brings in: {chosen.brings}</span>
            </label>

            <label className="block">
              <span className="text-sm text-ink">Name this connection</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Main fleet"
                autoComplete="off"
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
              />
              <span className="mt-1 block text-[11px] text-muted">
                Whatever you would call it out loud.
              </span>
            </label>
          </div>

          <label className="mt-4 block">
            <span className="text-sm text-ink">API key</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste it here"
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm text-ink"
            />
            <span className="mt-1 block text-[11px] text-muted">{chosen.hint}</span>
          </label>

          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted hover:text-ink">
              Different region or a test server?
            </summary>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="Leave empty unless you were told otherwise"
              autoComplete="off"
              className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
            />
          </details>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-40"
            >
              {busy ? "Checking the key…" : "Test and connect"}
            </button>
            <span className="text-xs text-muted">
              The key is checked against the system before it is stored.
            </span>
          </div>

          {problem && (
            <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {problem}
            </p>
          )}
          {done && (
            <p className="mt-4 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-300">
              {done}
            </p>
          )}
        </form>

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Only an owner can connect or remove a system. The key is encrypted with a key held
          outside the database, so a copy of the database on its own cannot be used to read it.
        </p>
      </section>
    </div>
  );
}

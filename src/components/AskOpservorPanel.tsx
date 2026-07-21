"use client";

import { useState } from "react";
import { ASK_OPSERVOR_EXAMPLES } from "@/lib/ask-opservor";

interface Message {
  role: "user" | "opservor";
  text: string;
}

export default function AskOpservorPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ask-opservor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "opservor", text: data.answer ?? data.error ?? "Something went wrong." },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "opservor", text: "Couldn't reach the server — try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-panel p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-ink">Ask Opservor</h2>
      <p className="mt-1 text-xs text-muted">
        Rule-based answers from your real data. Live AI arrives in v2.
      </p>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <div className="space-y-1.5">
            {ASK_OPSERVOR_EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => ask(ex)}
                className="block w-full rounded-md border border-border bg-surface px-3 py-1.5 text-left text-xs text-muted hover:text-ink hover:border-brand transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-6 bg-brand text-white"
                : "mr-6 bg-surface text-ink"
            }`}
          >
            {m.text}
          </div>
        ))}
        {loading && <div className="mr-6 rounded-lg bg-surface px-3 py-2 text-sm text-muted">Thinking…</div>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about revenue, fleet, alerts…"
          className="flex-1 rounded-md border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  );
}

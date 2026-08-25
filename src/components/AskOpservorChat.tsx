"use client";

/* Ask Opservor, as a conversation rather than a form.
 *
 * The panel this replaces sat on the dashboard and looked like a search box,
 * which made people compose a query and wonder whether it would be understood.
 * A chat bubble asks nothing of the reader — you type what you were already
 * thinking. That is the entire reason for the change.
 *
 * It follows you across every screen, because the question usually arrives
 * while you are looking at something else.
 */

import { useEffect, useRef, useState } from "react";

interface Message {
  role: "you" | "opservor";
  text: string;
}

const SUGGESTIONS = [
  "What needs my attention today?",
  "Why is that stock item flagged?",
  "What is Guardian not able to check?",
];

export default function AskOpservorChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the newest message in view. Without this the answer arrives below the
  // fold and reads as nothing having happened.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Escape closes it, because anything that covers the screen should.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;

    setMessages((m) => [...m, { role: "you", text: q }]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/ask-opservor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "opservor", text: data.answer ?? data.error ?? "Something went wrong." },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "opservor", text: "Couldn't reach the server — try again in a moment." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* The bubble. Hidden while the panel is open so it is never behind it. */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask Opservor"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-brand-light"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.1A8.4 8.4 0 0 1 4 11.5a8.5 8.5 0 0 1 8.5-8.5 8.4 8.4 0 0 1 8.5 8.5z" />
          </svg>
          Ask Opservor
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-40 flex h-[32rem] w-[calc(100vw-3rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">Ask Opservor</p>
              <p className="text-xs text-muted">About your own operation</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-md p-1 text-muted hover:bg-border hover:text-ink"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted">
                  Ask anything about your sites, stock, fleet or findings. It answers from
                  your own figures, and says so when it doesn&apos;t have something.
                </p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="block w-full rounded-lg border border-border bg-transparent px-3 py-2 text-left text-xs text-muted transition hover:border-brand hover:text-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "you" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "you"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-3 py-2 text-sm text-white"
                      : "max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-border px-3 py-2 text-sm text-ink"
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-border px-3 py-2 text-sm text-muted">
                  Looking…
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); ask(input); }}
            className="border-t border-border p-3"
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question…"
                maxLength={500}
                className="min-w-0 flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

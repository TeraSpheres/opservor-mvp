import "server-only";

/* Answering in words, over the tenant's own numbers.
 *
 * The whole credibility of this product rests on one thing: a finding shows
 * its working and never asks to be trusted. A model that invents a figure
 * would undo that in a sentence — and it would do it fluently, which is worse
 * than doing it badly.
 *
 * So the design is narrow on purpose:
 *
 *   - Every number the model may use is handed to it. It is told, plainly,
 *     that it may not produce any others.
 *   - It is told to say it does not have something rather than estimate it.
 *     "I don't hold that" is a good answer here; a plausible guess is not.
 *   - The context is built from rows already read under the caller's own
 *     row-level security, so it can only ever see one tenant's data.
 *   - Output is capped, so a long question cannot become an expensive answer.
 *
 * Absent an API key this module reports itself unavailable and the caller
 * falls back to the pattern matcher, which is narrow but never wrong.
 */

const MAX_TOKENS = 700;
const TIMEOUT_MS = 20_000;

const ANTHROPIC_MODEL = "claude-sonnet-4-5";

/* Gemini renames its models often and retires the old names, so this is
 * settable without a deploy. When a call starts failing for no apparent
 * reason, a retired model name is the first thing to check. */
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * Whichever is configured, Anthropic first.
 *
 * Both are optional. With neither, the caller falls back to the pattern
 * matcher — narrow, but incapable of being wrong, which is the property this
 * product cares about most.
 */
type Provider = "anthropic" | "gemini" | null;

function provider(): Provider {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

export function llmAvailable(): boolean {
  return provider() !== null;
}

const SYSTEM = `You are Opservor, an operations assistant for a logistics and warehousing business.

You are given a snapshot of this company's real operational data below. Answer only from it.

Rules, in order of importance:

1. Never state a number that is not in the data given to you. Do not estimate,
   extrapolate, average or infer figures. If a number is not there, say you do
   not hold it.
2. If the data does not answer the question, say so plainly and name what would
   be needed. Do not fill the gap with something plausible.
3. When you use a figure, say where it comes from — "your stock check found",
   "the Calgary Depot finding says". The reader must be able to go and look.
4. Be brief. Two or three sentences unless asked for more. The reader runs a
   depot and is reading this between other things.
5. Plain language. No jargon, no bullet lists unless genuinely listing things.
6. You cannot take actions, change data, place orders or send anything. If
   asked, say what the person should do instead.

You are not a general assistant. If asked something unrelated to this
operation, say that is not something you can help with and move on.`;

export interface AskContext {
  companyName?: string;
  findings: {
    severity: string;
    title: string;
    detail: string;
    recommendation: string | null;
    modules: string[];
  }[];
  kpi: Record<string, unknown> | null;
  scores: { category: string; score: number }[];
  openAlerts: { title: string; severity: string }[];
  readiness: { area: string; ready: boolean; reason: string | null }[];
}

/** Everything the model is allowed to know, as plain text. */
function renderContext(ctx: AskContext): string {
  const lines: string[] = [];

  lines.push(`Company: ${ctx.companyName ?? "this company"}`);
  lines.push(`Date today: ${new Date().toISOString().slice(0, 10)}`);

  lines.push("", `GUARDIAN FINDINGS (${ctx.findings.length} open):`);
  if (!ctx.findings.length) {
    lines.push("  None open.");
  } else {
    for (const f of ctx.findings) {
      lines.push(`  [${f.severity}] ${f.title}`);
      lines.push(`    ${f.detail}`);
      if (f.recommendation) lines.push(`    Recommended: ${f.recommendation}`);
      lines.push(`    Covers: ${f.modules.join(", ")}`);
    }
  }

  // What Guardian could not check matters as much as what it found. Without
  // this the model would read an empty findings list as "all is well", which
  // is the exact mistake the readiness function exists to prevent.
  const blocked = ctx.readiness.filter((r) => !r.ready);
  if (blocked.length) {
    lines.push("", "CHECKS THAT COULD NOT RUN — treat these areas as unknown, not clear:");
    for (const r of blocked) lines.push(`  ${r.area}: ${r.reason ?? "unavailable"}`);
  }

  if (ctx.openAlerts.length) {
    lines.push("", `OPEN ALERTS (${ctx.openAlerts.length}), entered by people:`);
    for (const a of ctx.openAlerts.slice(0, 20)) lines.push(`  [${a.severity}] ${a.title}`);
  }

  if (ctx.scores.length) {
    lines.push("", "CATEGORY SCORES (most recent):");
    for (const s of ctx.scores) lines.push(`  ${s.category}: ${s.score}`);
  }

  if (ctx.kpi) {
    lines.push("", "LATEST KPI SNAPSHOT:");
    for (const [k, v] of Object.entries(ctx.kpi)) {
      if (v == null || k === "id" || k === "company_id") continue;
      lines.push(`  ${k}: ${String(v)}`);
    }
  }

  return lines.join("\n");
}

/**
 * Returns the answer, or null when no key is configured or the call fails —
 * so the caller can fall back rather than show an error to somebody who only
 * asked a question.
 */
export async function askWithLlm(
  question: string,
  ctx: AskContext
): Promise<string | null> {
  const which = provider();
  if (!which) return null;

  const prompt =
    `Here is the current operational data.\n\n${renderContext(ctx)}\n\n---\n\nQuestion: ${question}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return which === "anthropic"
      ? await callAnthropic(prompt, controller.signal)
      : await callGemini(prompt, controller.signal);
  } catch {
    // Timeout, network, malformed reply — all the same to the caller, which
    // has a narrower answer it can give instead.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function callAnthropic(prompt: string, signal: AbortSignal): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    }),
    signal,
    cache: "no-store",
  });

  if (!res.ok) return null;

  const body = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (body.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();

  return text || null;
}

/**
 * Gemini, which has a free tier and so is the one most likely in use here.
 *
 * Two differences worth knowing. The system prompt goes in its own field
 * rather than alongside the messages, and a refusal comes back as HTTP 200
 * with no candidates and a blockReason — so an empty answer has to be treated
 * as a failure rather than as an empty answer.
 */
async function callGemini(prompt: string, signal: AbortSignal): Promise<string | null> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY as string,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: MAX_TOKENS,
        // Low, deliberately. This answers from figures, and there is nothing
        // to be gained from it being inventive about them.
        temperature: 0.2,
      },
    }),
    signal,
    cache: "no-store",
  });

  if (!res.ok) return null;

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    promptFeedback?: { blockReason?: string };
  };

  if (body.promptFeedback?.blockReason) return null;

  const text = (body.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();

  return text || null;
}

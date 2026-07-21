// "Ask Opservor" — v1 scope (Section 8 of Opservor-MVP-Spec-v1.3).
// A set of question patterns matched against real data pulled from the
// database — NOT a live LLM call. Five patterns per the spec:
// score/health, summary, approvals, fleet, revenue.
//
// Note on "approvals": the v1 data model (Section 5) has no separate
// approvals entity. The closest real thing in scope is open Critical
// Alerts awaiting an owner's action, so the "approvals" pattern answers
// from `alert` where status = 'open'. Revisit if/when an approvals
// entity is added.

import type { Alert, CategoryScore, KpiSnapshot } from "./types";
import {
  calculateCompositeScore,
  CATEGORY_LABELS,
} from "./business-health";

export interface AskOpservorContext {
  latestKpi: KpiSnapshot | null;
  latestCategoryScores: CategoryScore[];
  openAlerts: Alert[];
}

type PatternId = "health" | "summary" | "approvals" | "fleet" | "revenue";

interface Pattern {
  id: PatternId;
  test: (q: string) => boolean;
  answer: (ctx: AskOpservorContext) => string;
}

const norm = (s: string) => s.toLowerCase().trim();

const patterns: Pattern[] = [
  {
    id: "health",
    test: (q) => /\b(health|score|how('| i)?s? (things|the business) doing)\b/.test(q),
    answer: ({ latestCategoryScores }) => {
      if (latestCategoryScores.length === 0) {
        return "I don't have any category scores entered yet, so I can't calculate a Business Health Score. Add today's scores on the Data Entry screen.";
      }
      const { composite, band } = calculateCompositeScore(latestCategoryScores);
      return `Your Business Health Score is ${composite.toFixed(1)}/100 — that's in the "${band}" band.`;
    },
  },
  {
    id: "summary",
    test: (q) => /\b(summary|summarize|overview|what('|’)s going on|update)\b/.test(q),
    answer: ({ latestKpi, latestCategoryScores, openAlerts }) => {
      const parts: string[] = [];
      if (latestCategoryScores.length > 0) {
        const { composite, band } = calculateCompositeScore(latestCategoryScores);
        parts.push(`Health Score is ${composite.toFixed(1)} (${band}).`);
      }
      if (latestKpi) {
        parts.push(
          `Revenue is $${latestKpi.revenue.toLocaleString()} with $${latestKpi.profit.toLocaleString()} profit across ${latestKpi.total_loads} loads.`
        );
      }
      const critical = openAlerts.filter((a) => a.severity === "critical").length;
      parts.push(
        openAlerts.length === 0
          ? "No open alerts."
          : `${openAlerts.length} open alert${openAlerts.length === 1 ? "" : "s"}${critical ? `, ${critical} critical` : ""}.`
      );
      return parts.length > 0
        ? parts.join(" ")
        : "There's no data entered yet — start by adding today's KPI snapshot and category scores.";
    },
  },
  {
    id: "approvals",
    test: (q) => /\b(approval|approve|waiting on|pending|need(s)? (my|founder) (attention|sign.?off))\b/.test(q),
    answer: ({ openAlerts }) => {
      if (openAlerts.length === 0) {
        return "Nothing open right now — no alerts are waiting on you.";
      }
      const top = [...openAlerts]
        .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
        .slice(0, 3)
        .map((a) => `"${a.title}"${a.owner ? ` (owner: ${a.owner})` : ""}`)
        .join(", ");
      return `You have ${openAlerts.length} open item${openAlerts.length === 1 ? "" : "s"} waiting on action: ${top}${openAlerts.length > 3 ? ", and more" : ""}.`;
    },
  },
  {
    id: "fleet",
    test: (q) => /\b(fleet|utilization|truck|vehicle|on.?time)\b/.test(q),
    answer: ({ latestKpi, latestCategoryScores }) => {
      if (!latestKpi) {
        return "I don't have a KPI snapshot entered yet, so I can't report fleet numbers.";
      }
      const fleetCategory = latestCategoryScores.find((c) => c.category === "fleet_assets");
      const fleetLine = fleetCategory
        ? ` The ${CATEGORY_LABELS.fleet_assets} category score is ${fleetCategory.score}/100.`
        : "";
      return `Fleet utilization is ${latestKpi.fleet_utilization_pct}% and on-time delivery is ${latestKpi.on_time_delivery_pct}%.${fleetLine}`;
    },
  },
  {
    id: "revenue",
    test: (q) => /\b(revenue|sales|profit|income|earn(ing)?)\b/.test(q),
    answer: ({ latestKpi }) => {
      if (!latestKpi) {
        return "I don't have a KPI snapshot entered yet, so I can't report revenue.";
      }
      const margin =
        latestKpi.revenue > 0
          ? ((latestKpi.profit / latestKpi.revenue) * 100).toFixed(1)
          : "0.0";
      return `Latest revenue is $${latestKpi.revenue.toLocaleString()} with $${latestKpi.profit.toLocaleString()} profit (${margin}% margin), as of ${latestKpi.date}.`;
    },
  },
];

function severityRank(s: Alert["severity"]) {
  return s === "critical" ? 0 : s === "high" ? 1 : 2;
}

export function askOpservor(question: string, ctx: AskOpservorContext): string {
  const q = norm(question);
  const match = patterns.find((p) => p.test(q));
  if (!match) {
    return "I can currently answer questions about your health score, a general summary, open approvals, fleet metrics, or revenue. Try one of those — live AI-powered Q&A is coming in v2.";
  }
  return match.answer(ctx);
}

export const ASK_OPSERVOR_EXAMPLES = [
  "What's my Business Health Score?",
  "Give me a summary of the business",
  "What's waiting on my approval?",
  "How's the fleet doing?",
  "What's our revenue?",
];

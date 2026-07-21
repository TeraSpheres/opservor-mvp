// Business Health Score — calculation logic.
// Carried over unchanged from the original blueprint (Section 6 of
// Opservor-MVP-Spec-v1.3). Composite score = sum of (category score x weight).

import type { Category, CategoryScore } from "./types";

export const CATEGORY_WEIGHTS: Record<Category, number> = {
  finance: 0.2,
  operations: 0.2,
  customer: 0.15,
  hr: 0.1,
  fleet_assets: 0.15,
  safety_compliance: 0.1,
  inventory_procurement: 0.1,
};

export const CATEGORY_LABELS: Record<Category, string> = {
  finance: "Finance",
  operations: "Operations",
  customer: "Customer",
  hr: "HR",
  fleet_assets: "Fleet & Assets",
  safety_compliance: "Safety & Compliance",
  inventory_procurement: "Inventory & Procurement",
};

export type HealthBand =
  | "Excellent"
  | "Stable"
  | "Watch"
  | "At Risk"
  | "Critical";

export function bandForScore(score: number): HealthBand {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Stable";
  if (score >= 60) return "Watch";
  if (score >= 40) return "At Risk";
  return "Critical";
}

export const BAND_COLOR: Record<HealthBand, string> = {
  Excellent: "band-excellent",
  Stable: "band-stable",
  Watch: "band-watch",
  "At Risk": "band-atrisk",
  Critical: "band-critical",
};

/**
 * Composite score = sum of (category score x weight), for the categories
 * that have a score on the given day. Missing categories are excluded
 * from both the numerator and the weight base, so a day with partial
 * data still produces a meaningful (re-normalized) score rather than
 * silently treating "missing" as zero.
 */
export function calculateCompositeScore(scores: CategoryScore[]): {
  composite: number;
  band: HealthBand;
  weightCovered: number; // fraction of total weight that had data (0-1)
} {
  if (scores.length === 0) {
    return { composite: 0, band: bandForScore(0), weightCovered: 0 };
  }

  let weightedSum = 0;
  let weightCovered = 0;

  for (const s of scores) {
    const weight = CATEGORY_WEIGHTS[s.category];
    if (weight === undefined) continue;
    weightedSum += s.score * weight;
    weightCovered += weight;
  }

  const composite = weightCovered > 0 ? weightedSum / weightCovered : 0;

  return {
    composite: Math.round(composite * 10) / 10,
    band: bandForScore(composite),
    weightCovered,
  };
}

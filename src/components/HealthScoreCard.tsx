import {
  calculateCompositeScore,
  CATEGORY_LABELS,
  CATEGORY_WEIGHTS,
  BAND_COLOR,
} from "@/lib/business-health";
import type { CategoryScore } from "@/lib/types";

export default function HealthScoreCard({ scores }: { scores: CategoryScore[] }) {
  const { composite, band, weightCovered } = calculateCompositeScore(scores);
  const byCategory = new Map(scores.map((s) => [s.category, s.score]));

  return (
    <div className="rounded-xl border border-border bg-panel p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">Business Health Score</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-semibold text-ink">
              {scores.length ? composite.toFixed(1) : "—"}
            </span>
            <span className="text-sm text-muted">/ 100</span>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium text-white ${BAND_COLOR[band]}`}
        >
          {band}
        </span>
      </div>

      {weightCovered < 1 && scores.length > 0 && (
        <p className="mt-2 text-xs text-band-watch">
          Only {Math.round(weightCovered * 100)}% of category weight has a score entered today —
          composite is re-normalized to what's available.
        </p>
      )}

      <div className="mt-5 space-y-2">
        {(Object.keys(CATEGORY_WEIGHTS) as (keyof typeof CATEGORY_WEIGHTS)[]).map((cat) => {
          const score = byCategory.get(cat);
          return (
            <div key={cat} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-xs text-muted">
                {CATEGORY_LABELS[cat]}
              </span>
              <div className="h-2 flex-1 rounded-full bg-surface">
                <div
                  className="h-2 rounded-full bg-brand"
                  style={{ width: `${score ?? 0}%` }}
                />
              </div>
              <span className="w-10 text-right text-xs font-medium text-ink">
                {score ?? "—"}
              </span>
              <span className="w-10 text-right text-[10px] text-muted">
                {Math.round(CATEGORY_WEIGHTS[cat] * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

/* Pagination for module list views.
 *
 * Every module fetched select("*") with no range and rendered every row. That
 * is fine at demo scale and wrong at real scale: PostgREST caps a request at
 * 1000 rows by default, so a tenant with 5000 SKUs got the first 1000 and no
 * indication the rest existed.
 *
 * `total` comes from a count query or a totals RPC — never from the length of
 * the page, which is the mistake this exists to prevent.
 */

export const PAGE_SIZE = 50;

/** Supabase .range() is inclusive at both ends. */
export const rangeFor = (page: number, size = PAGE_SIZE): [number, number] => [
  page * size,
  page * size + size - 1,
];

export function Pager({
  page,
  total,
  onPage,
  size = PAGE_SIZE,
  noun = "rows",
}: {
  page: number;
  total: number;
  onPage: (next: number) => void;
  size?: number;
  noun?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  const first = total === 0 ? 0 : page * size + 1;
  const last = Math.min(total, page * size + size);

  if (total <= size) {
    return (
      <p className="mt-3 text-xs text-muted">
        {total.toLocaleString()} {noun}
      </p>
    );
  }

  const btn =
    "rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-panel disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="mt-3 flex items-center justify-between gap-4">
      <p className="text-xs text-muted">
        {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()} {noun}
      </p>
      <div className="flex items-center gap-2">
        <button className={btn} onClick={() => onPage(0)} disabled={page === 0}>
          First
        </button>
        <button className={btn} onClick={() => onPage(page - 1)} disabled={page === 0}>
          Previous
        </button>
        <span className="text-xs text-muted">
          {page + 1} / {pages.toLocaleString()}
        </span>
        <button className={btn} onClick={() => onPage(page + 1)} disabled={page >= pages - 1}>
          Next
        </button>
        <button className={btn} onClick={() => onPage(pages - 1)} disabled={page >= pages - 1}>
          Last
        </button>
      </div>
    </div>
  );
}

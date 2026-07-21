const LABELS: Record<string, string> = {
  fleet: "Fleet",
  warehouse: "Warehouse",
  inventory: "Inventory",
  finance: "Finance",
  hr: "HR",
  safety: "Safety",
  reports: "Reports",
};

export default function ComingSoon({ module }: { module: string }) {
  const label = LABELS[module] ?? module;

  return (
    <div className="flex h-full min-h-[70vh] flex-col items-center justify-center px-8 text-center">
      <div className="mb-4 h-12 w-12 rounded-xl bg-brand/10" />
      <h1 className="text-lg font-semibold text-ink">{label} — Coming soon</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        This module is out of scope for v1 (see Section 2 of the spec). The nav item is
        a visual placeholder only — no functionality lives here yet.
      </p>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { InventorySku, InventoryMovement, InventoryTotals } from "@/lib/types";
import { Pager, rangeFor } from "@/components/Pager";

function AddSkuForm({ onSkuAdded }: { onSkuAdded: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  async function handleAddSku(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const sku = String(formData.get("sku"));
    const name = String(formData.get("product_name"));
    const category = String(formData.get("category") || "");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: appUser } = await supabase
      .from("app_user")
      .select("company_id")
      .eq("auth_id", user.id)
      .single();

    if (!appUser) {
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.from("inventory_sku").insert({
      company_id: appUser.company_id,
      sku,
      name,
      category: category || null,
      reorder_level: 10,
      reorder_quantity: 50,
    });

    if (!error) {
      setIsOpen(false);
      (e.target as HTMLFormElement).reset();
      onSkuAdded();
    }
    setIsLoading(false);
  }

  return (
    <>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light"
        >
          Add SKU
        </button>
      ) : (
        <form onSubmit={handleAddSku} className="rounded-xl border border-border bg-panel p-4 space-y-3">
          <input
            name="sku"
            type="text"
            placeholder="SKU code"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand" autoComplete="off" />
          <input
            name="product_name" autoComplete="off"
            type="text"
            placeholder="Product name"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <input
            name="category"
            type="text"
            placeholder="Category (optional)"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand" autoComplete="off" />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
            >
              {isLoading ? "Adding..." : "Add SKU"}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex-1 rounded-md border border-border px-3 py-2 text-sm font-medium text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </>
  );
}

function LogMovementForm({
  sku,
  onMovementLogged,
}: {
  sku: InventorySku;
  onMovementLogged: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  async function handleLogMovement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const type = String(formData.get("type"));
    const quantity = Number(formData.get("quantity"));

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("inventory_movement").insert({
      company_id: sku.company_id,
      sku_id: sku.id,
      type,
      quantity,
      reference: String(formData.get("reference") || ""),
      notes: String(formData.get("notes") || ""),
      date: String(formData.get("date")),
    });

    if (!error) {
      (e.target as HTMLFormElement).reset();
      onMovementLogged();
    }
    setIsLoading(false);
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  return (
    <form onSubmit={handleLogMovement} className="rounded-xl border border-border bg-panel p-5 space-y-4">
      <h3 className="text-sm font-semibold text-ink">{sku.name} — Log Movement</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Date</label>
          <input
            name="date"
            type="date"
            defaultValue={todayISO()}
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Type</label>
          <select
            name="type"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="inbound">Inbound (Receive)</option>
            <option value="outbound">Outbound (Ship)</option>
            <option value="adjustment">Adjustment</option>
            <option value="reorder">Reorder</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Quantity</label>
          <input
            name="quantity"
            type="number"
            step="1"
            min="-999"
            max="9999"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Reference (PO, SO, etc.)</label>
          <input
            name="reference"
            type="text"
            placeholder="Optional"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand" autoComplete="off" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1">Notes</label>
        <textarea
          name="notes"
          placeholder="Optional notes about this movement"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          rows={2}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
      >
        {isLoading ? "Logging..." : "Log movement"}
      </button>
    </form>
  );
}

function SkuCard({ sku }: { sku: InventorySku }) {
  const available = sku.quantity_on_hand - sku.quantity_reserved;
  const isLow = available <= sku.reorder_level;

  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-ink">{sku.name}</p>
          <p className="text-xs text-muted">{sku.sku}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div>
              <p className="text-xs text-muted">On Hand</p>
              <p className="text-sm font-semibold text-ink">{sku.quantity_on_hand}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Available</p>
              <p className={`text-sm font-semibold ${isLow ? 'text-red-400' : 'text-green-400'}`}>
                {available}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Reserved</p>
              <p className="text-sm font-semibold text-ink">{sku.quantity_reserved}</p>
            </div>
          </div>
        </div>
        {isLow && (
          <span className="rounded-md bg-red-500 px-2 py-1 text-xs font-medium text-white">
            LOW
          </span>
        )}
      </div>
    </div>
  );
}

function TotalCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "warn";
}) {
  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone === "warn" ? "text-amber-400" : "text-ink"}`}>
        {value}
      </p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );
}

export default function InventoryPage() {
  const [skus, setSkus] = useState<InventorySku[]>([]);
  const [selectedSku, setSelectedSku] = useState<InventorySku | null>(null);
  const [page, setPage] = useState(0);
  const [skuCount, setSkuCount] = useState(0);
  const [totals, setTotals] = useState<InventoryTotals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchSkus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function fetchSkus() {
    setIsLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: appUser } = await supabase
      .from("app_user")
      .select("company_id")
      .eq("auth_id", user.id)
      .single();

    if (!appUser) return;

    const [from, to] = rangeFor(page);

    // One page of rows, plus the exact row count. The count comes from the
    // database rather than data.length, which only ever describes this page.
    const { data, count } = await supabase
      .from("inventory_sku")
      .select("*", { count: "exact" })
      .eq("company_id", appUser.company_id)
      .order("created_at", { ascending: false })
      .range(from, to);

    // Headline figures are aggregated in the database. Summing the fetched
    // page would understate every total the moment a tenant has more SKUs
    // than fit on one page — see migration 0011.
    const { data: totalsRows } = await supabase.rpc("inventory_totals");
    const t = Array.isArray(totalsRows) ? totalsRows[0] : totalsRows;
    setTotals((t ?? null) as InventoryTotals | null);

    const rows = (data ?? []) as InventorySku[];
    setSkus(rows);
    setSkuCount(count ?? rows.length);
    if (rows.length > 0 && !selectedSku) setSelectedSku(rows[0]);
    setIsLoading(false);
  }

  // Low stock on this page. The tenant-wide figure comes from totals, because
  // filtering a page can only ever see a page.
  const lowStockSkus = skus.filter((sku) => sku.quantity_on_hand - sku.quantity_reserved <= sku.reorder_level);

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Inventory Management</h1>
        <p className="text-sm text-muted">Track stock levels and movements</p>
      </div>

      {/* Tenant-wide, from inventory_totals(). Not derived from the page. */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <TotalCard label="SKUs" value={(totals?.sku_count ?? skuCount).toLocaleString()} />
        <TotalCard label="Units on hand" value={(totals?.units_on_hand ?? 0).toLocaleString()} />
        <TotalCard label="Reserved" value={(totals?.units_reserved ?? 0).toLocaleString()} />
        <TotalCard
          label="Stock value"
          value={
            totals ? Number(totals.stock_value).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            }) : "—"
          }
        />
        <TotalCard
          label="Low stock"
          value={(totals?.low_stock_count ?? 0).toLocaleString()}
          tone={totals && totals.low_stock_count > 0 ? "warn" : undefined}
          note={totals && totals.out_of_stock > 0 ? `${totals.out_of_stock} out of stock` : undefined}
        />
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div>
          {totals && totals.low_stock_count > 0 && (
            <div className="rounded-md border border-amber-500 border-opacity-50 bg-amber-500 bg-opacity-10 px-4 py-2">
              <p className="text-sm text-amber-400">
                {totals.low_stock_count.toLocaleString()} item
                {totals.low_stock_count === 1 ? "" : "s"} at or below reorder level
                {lowStockSkus.length > 0 && ` · ${lowStockSkus.length} on this page`}
              </p>
            </div>
          )}
        </div>
        <AddSkuForm onSkuAdded={fetchSkus} />
      </div>

      {selectedSku ? (
        <div className="space-y-6">
          <LogMovementForm sku={selectedSku} onMovementLogged={fetchSkus} />

          <div>
            <h2 className="mb-4 text-sm font-semibold text-ink">
              All SKUs
              <span className="ml-2 text-xs font-normal text-muted">
                {skuCount.toLocaleString()} total
              </span>
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {skus.map((sku) => (
                <div
                  key={sku.id}
                  onClick={() => setSelectedSku(sku)}
                  className={`cursor-pointer transition-opacity ${
                    selectedSku?.id === sku.id ? 'opacity-100 ring-2 ring-brand' : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  <SkuCard sku={sku} />
                </div>
              ))}
            </div>
            <Pager page={page} total={skuCount} onPage={setPage} noun="SKUs" />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-panel p-6 text-center text-sm text-muted">
          No SKUs yet. Add one to get started.
        </div>
      )}
    </div>
  );
}

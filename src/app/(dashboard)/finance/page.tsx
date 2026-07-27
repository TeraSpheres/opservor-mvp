"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  FinanceCostCenter,
  FinanceTransaction,
  FinanceSnapshot,
  FinanceTotals,
} from "@/lib/types";
import { financeTotals } from "@/lib/totals";

function AddCostCenterForm({ onCostCenterAdded }: { onCostCenterAdded: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  async function handleAddCostCenter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("cost_center_name"));
    const code = String(formData.get("code"));
    const budget_ytd = Number(formData.get("budget_ytd") || 0);

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

    const { error } = await supabase.from("finance_cost_center").insert({
      company_id: appUser.company_id,
      name,
      code,
      budget_ytd,
    });

    if (!error) {
      setIsOpen(false);
      (e.target as HTMLFormElement).reset();
      onCostCenterAdded();
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
          Add Cost Center
        </button>
      ) : (
        <form onSubmit={handleAddCostCenter} className="rounded-xl border border-border bg-panel p-4 space-y-3">
          <input
            name="cost_center_name" autoComplete="off"
            type="text"
            placeholder="Cost center name (e.g., Operations)"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <input
            name="code"
            type="text"
            placeholder="Code (e.g., OPS-001)"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand" autoComplete="off" />
          <input
            name="budget_ytd"
            type="number"
            step="0.01"
            placeholder="YTD Budget"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
            >
              {isLoading ? "Adding..." : "Add Cost Center"}
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

function LogTransactionForm({
  costCenter,
  onTransactionLogged,
}: {
  costCenter: FinanceCostCenter;
  onTransactionLogged: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  async function handleLogTransaction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("finance_transaction").insert({
      company_id: costCenter.company_id,
      cost_center_id: costCenter.id,
      type: String(formData.get("type")),
      category: String(formData.get("category")),
      amount: Number(formData.get("amount")),
      description: String(formData.get("description") || ""),
      date: String(formData.get("date")),
      reference: String(formData.get("reference") || ""),
    });

    if (!error) {
      (e.target as HTMLFormElement).reset();
      onTransactionLogged();
    }
    setIsLoading(false);
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  return (
    <form onSubmit={handleLogTransaction} className="rounded-xl border border-border bg-panel p-5 space-y-4">
      <h3 className="text-sm font-semibold text-ink">{costCenter.name} — Log Transaction</h3>

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
            <option value="revenue">Revenue</option>
            <option value="expense">Expense</option>
            <option value="adjustment">Adjustment</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Category</label>
          <input
            name="category"
            type="text"
            placeholder="e.g., Salaries, Equipment"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand" autoComplete="off" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Amount</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      </div>

      <input
        name="description"
        type="text"
        placeholder="Description (optional)"
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand" autoComplete="off" />

      <input
        name="reference"
        type="text"
        placeholder="Reference (Invoice, PO, etc.)"
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand" autoComplete="off" />

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
      >
        {isLoading ? "Logging..." : "Log transaction"}
      </button>
    </form>
  );
}

function MetricCard({
  label,
  value,
  unit = "",
  color = "text-ink",
}: {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${color}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-normal">{unit}</span>}
      </p>
    </div>
  );
}

export default function FinancePage() {
  const [costCenters, setCostCenters] = useState<FinanceCostCenter[]>([]);
  const [selectedCostCenter, setSelectedCostCenter] = useState<FinanceCostCenter | null>(null);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [totals, setTotals] = useState<FinanceTotals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchCostCenters();
  }, []);

  async function fetchCostCenters() {
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

    const { data } = await supabase
      .from("finance_cost_center")
      .select("*")
      .eq("company_id", appUser.company_id)
      .order("created_at", { ascending: false });

    const centerList = (data ?? []) as FinanceCostCenter[];
    setCostCenters(centerList);

    // Headline figures from the database, not from the rows just fetched.
    setTotals(await financeTotals(supabase));
    if (centerList.length > 0 && !selectedCostCenter) {
      setSelectedCostCenter(centerList[0]);
      fetchTransactions(centerList[0].id, appUser.company_id);
    }
    setIsLoading(false);
  }

  async function fetchTransactions(costCenterId: string, companyId: string) {
    const { data } = await supabase
      .from("finance_transaction")
      .select("*")
      .eq("company_id", companyId)
      .eq("cost_center_id", costCenterId)
      .order("date", { ascending: false })
      .limit(20);

    setTransactions((data ?? []) as FinanceTransaction[]);
  }

  function handleCostCenterSelect(costCenter: FinanceCostCenter) {
    setSelectedCostCenter(costCenter);
    fetchTransactions(costCenter.id, costCenter.company_id);
  }

  function handleTransactionLogged() {
    if (selectedCostCenter) {
      fetchTransactions(selectedCostCenter.id, selectedCostCenter.company_id);
    }
  }

  // Tenant-wide, from finance_totals(). The fallback sums only the rows
  // currently loaded, which is right for a small tenant and wrong for a real one.
  const revenue = totals?.revenue ?? transactions
    .filter((t) => t.type === "revenue")
    .reduce((sum, t) => sum + t.amount, 0);
  const expenses = totals?.expense ?? transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const net = totals?.net ?? revenue - expenses;

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Finance Management</h1>
        <p className="text-sm text-muted">Track budgets, revenue, and expenses</p>
      </div>

      <div className="mb-6 flex gap-4 items-center justify-between">
        <div className="flex gap-2">
          {costCenters.map((center) => (
            <button
              key={center.id}
              onClick={() => handleCostCenterSelect(center)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                selectedCostCenter?.id === center.id
                  ? "bg-brand text-white"
                  : "border border-border text-ink hover:bg-panel"
              }`}
            >
              {center.name}
            </button>
          ))}
        </div>
        <AddCostCenterForm onCostCenterAdded={fetchCostCenters} />
      </div>

      {selectedCostCenter ? (
        <div className="space-y-6">
          <LogTransactionForm costCenter={selectedCostCenter} onTransactionLogged={handleTransactionLogged} />

          <div>
            <h2 className="mb-4 text-sm font-semibold text-ink">Financial Summary</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <MetricCard label="Budget (YTD)" value={`$${selectedCostCenter.budget_ytd.toFixed(0)}`} color="text-ink" />
              <MetricCard label="Revenue" value={`$${revenue.toFixed(0)}`} color="text-green-400" />
              <MetricCard label="Expenses" value={`$${expenses.toFixed(0)}`} color="text-red-400" />
              <MetricCard label="Net" value={`$${net.toFixed(0)}`} color={net >= 0 ? "text-green-400" : "text-red-400"} />
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-sm font-semibold text-ink">Recent Transactions ({transactions.length})</h2>
            <div className="space-y-2">
              {transactions.length > 0 ? (
                transactions.map((transaction) => (
                  <div key={transaction.id} className="rounded-xl border border-border bg-panel p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-ink">{transaction.category}</p>
                        <p className="mt-1 text-xs text-muted">{transaction.date}</p>
                        {transaction.description && (
                          <p className="mt-1 text-xs text-muted">{transaction.description}</p>
                        )}
                      </div>
                      <span className={`rounded-md px-3 py-1 text-xs font-medium ${
                        transaction.type === "revenue"
                          ? "bg-green-500 text-white"
                          : transaction.type === "expense"
                          ? "bg-red-500 text-white"
                          : "bg-amber-500 text-white"
                      }`}>
                        {transaction.type === "revenue" ? "+" : "-"}${Math.abs(transaction.amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-panel p-6 text-center text-sm text-muted">
                  No transactions logged yet.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-panel p-6 text-center text-sm text-muted">
          No cost centers yet. Add one to get started.
        </div>
      )}
    </div>
  );
}

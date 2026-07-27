"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { HrDepartment, HrEmployee, HrAttendance, HrPerformance, HrTotals } from "@/lib/types";
import { hrTotals } from "@/lib/totals";

function AddDepartmentForm({ onDepartmentAdded }: { onDepartmentAdded: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  async function handleAddDepartment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("department_name"));
    const code = String(formData.get("code"));

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

    const { error } = await supabase.from("hr_department").insert({
      company_id: appUser.company_id,
      name,
      code,
    });

    if (!error) {
      setIsOpen(false);
      (e.target as HTMLFormElement).reset();
      onDepartmentAdded();
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
          Add Department
        </button>
      ) : (
        <form onSubmit={handleAddDepartment} className="rounded-xl border border-border bg-panel p-4 space-y-3">
          <input
            name="department_name" autoComplete="off"
            type="text"
            placeholder="Department name (e.g., Engineering)"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <input
            name="code"
            type="text"
            placeholder="Code (e.g., ENG)"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand" autoComplete="off" />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
            >
              {isLoading ? "Adding..." : "Add Department"}
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

function AddEmployeeForm({
  departments,
  onEmployeeAdded,
}: {
  departments: HrDepartment[];
  onEmployeeAdded: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  async function handleAddEmployee(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("employee_name"));
    const email = String(formData.get("employee_email"));
    const role = String(formData.get("role"));
    const department_id = String(formData.get("department_id"));
    const hire_date = String(formData.get("hire_date"));

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

    const { error } = await supabase.from("hr_employee").insert({
      company_id: appUser.company_id,
      name,
      email,
      role,
      department_id,
      hire_date,
      status: "active",
    });

    if (!error) {
      setIsOpen(false);
      (e.target as HTMLFormElement).reset();
      onEmployeeAdded();
    }
    setIsLoading(false);
  }

  return (
    <>
      {!isOpen ? (
        // Disabled with a reason, never hidden. This button used to disappear
        // entirely until a department existed, which left no way to work out
        // why it was missing.
        <button
          onClick={() => setIsOpen(true)}
          disabled={departments.length === 0}
          title={departments.length === 0 ? "Create a department first" : undefined}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-40 disabled:hover:bg-brand"
        >
          Add employee
        </button>
      ) : (
        <form onSubmit={handleAddEmployee} className="rounded-xl border border-border bg-panel p-4 space-y-3">
          <input
            name="employee_name" autoComplete="off"
            type="text"
            placeholder="Employee name"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <input
            name="employee_email" autoComplete="off"
            type="email"
            placeholder="Email"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <input
            name="role"
            type="text"
            placeholder="Job title (e.g., Senior Engineer)"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand" autoComplete="off" />
          <select
            name="department_id"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="">Select department</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
          <input
            name="hire_date"
            type="date"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
            >
              {isLoading ? "Adding..." : "Add Employee"}
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

function LogAttendanceForm({
  employees,
  onAttendanceLogged,
}: {
  employees: HrEmployee[];
  onAttendanceLogged: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  async function handleLogAttendance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const employee_id = String(formData.get("employee_id"));
    const employee = employees.find((e) => e.id === employee_id);

    if (!employee) return;

    const { error } = await supabase.from("hr_attendance").insert({
      company_id: employee.company_id,
      employee_id,
      date: String(formData.get("date")),
      status: String(formData.get("status")),
      hours_worked: formData.get("hours_worked") ? Number(formData.get("hours_worked")) : null,
      notes: String(formData.get("notes") || ""),
    });

    if (!error) {
      (e.target as HTMLFormElement).reset();
      onAttendanceLogged();
    }
    setIsLoading(false);
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  return (
    <form onSubmit={handleLogAttendance} className="rounded-xl border border-border bg-panel p-5 space-y-4">
      <h3 className="text-sm font-semibold text-ink">Log Attendance</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Employee</label>
          <select
            name="employee_id"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="">Select employee</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Status</label>
          <select
            name="status"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="late">Late</option>
            <option value="leave">Leave</option>
            <option value="remote">Remote</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Hours Worked</label>
          <input
            name="hours_worked"
            type="number"
            step="0.5"
            min="0"
            max="24"
            placeholder="Optional"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      </div>

      <textarea
        name="notes"
        placeholder="Notes (optional)"
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
        rows={2}
      />

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
      >
        {isLoading ? "Logging..." : "Log attendance"}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Performance reviews
 *
 * hr_performance has existed since 0006 — secured, correct, and reachable
 * only by SQL. This is the interface it never had. Recorded as defect 5 in
 * TS-PROD-001 §10.
 * ------------------------------------------------------------------ */

/** Rating bands. The schema constrains rating to 1–5; these name the ranges. */
const BANDS: { min: number; label: string; className: string }[] = [
  { min: 4.5, label: "Outstanding", className: "bg-green-500 text-white" },
  { min: 3.5, label: "Strong", className: "bg-emerald-600 text-white" },
  { min: 2.5, label: "Meets", className: "bg-brand text-white" },
  { min: 1.5, label: "Below", className: "bg-amber-500 text-white" },
  { min: 1.0, label: "Needs action", className: "bg-red-500 text-white" },
];

const bandFor = (rating: number) =>
  BANDS.find((b) => rating >= b.min) ?? BANDS[BANDS.length - 1];

function RatingBadge({ rating }: { rating: number }) {
  const band = bandFor(rating);
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${band.className}`}>
      {rating.toFixed(1)} · {band.label}
    </span>
  );
}

/** The eight most recent quarters, newest first — matches the YYYY-Qn format. */
function recentPeriods(count = 8): string[] {
  const out: string[] = [];
  const now = new Date();
  let year = now.getUTCFullYear();
  let q = Math.floor(now.getUTCMonth() / 3) + 1;
  for (let i = 0; i < count; i++) {
    out.push(`${year}-Q${q}`);
    q -= 1;
    if (q === 0) { q = 4; year -= 1; }
  }
  return out;
}

function RecordReviewForm({
  employees,
  onRecorded,
}: {
  employees: HrEmployee[];
  onRecorded: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(3.5);
  const supabase = createClient();

  const periods = recentPeriods();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const form = e.currentTarget;
    const fd = new FormData(form);

    const employeeId = String(fd.get("employee_id"));
    const employee = employees.find((x) => x.id === employeeId);
    if (!employee) {
      setError("Select an employee.");
      setIsLoading(false);
      return;
    }

    const str = (k: string) => {
      const v = String(fd.get(k) ?? "").trim();
      return v === "" ? null : v;
    };

    const { error: insertError } = await supabase.from("hr_performance").insert({
      company_id: employee.company_id,
      employee_id: employeeId,
      period: String(fd.get("period")),
      rating: Number(fd.get("rating")),
      category: str("category"),
      feedback: str("feedback"),
      reviewed_by: str("reviewed_by"),
    });

    if (insertError) {
      // The table has unique (company_id, employee_id, period). One review per
      // person per quarter is the intent, so say that rather than leak the
      // constraint name.
      setError(
        insertError.code === "23505"
          ? "This employee already has a review for that period."
          : insertError.message
      );
    } else {
      form.reset();
      setRating(3.5);
      setIsOpen(false);
      onRecorded();
    }
    setIsLoading(false);
  }

  const field =
    "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand";
  const label = "block text-xs font-medium text-muted mb-1";

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        disabled={employees.length === 0}
        className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-panel disabled:opacity-40"
      >
        Record review
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full rounded-xl border border-border bg-panel p-5 space-y-4">
      <h3 className="text-sm font-semibold text-ink">Record a performance review</h3>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className={label}>Employee</label>
          <select name="employee_id" required defaultValue="" className={field}>
            <option value="" disabled>Select employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Period</label>
          <select name="period" defaultValue={periods[0]} className={field}>
            {periods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Reviewed by</label>
          <input name="reviewed_by" type="text" placeholder="Reviewer" className={field} autoComplete="off" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={label}>
            Rating — <span className="text-ink">{rating.toFixed(1)}</span>{" "}
            <span className="text-muted">({bandFor(rating).label})</span>
          </label>
          <input
            name="rating"
            type="range"
            min="1"
            max="5"
            step="0.1"
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="w-full accent-brand"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted">
            <span>1.0</span><span>3.0</span><span>5.0</span>
          </div>
        </div>
        <div>
          <label className={label}>Category</label>
          <input name="category" type="text" placeholder="e.g. Annual, Probation, Project" className={field} autoComplete="off" />
        </div>
      </div>

      <div>
        <label className={label}>Feedback</label>
        <input name="feedback" type="text" placeholder="Summary of the review" className={field} autoComplete="off" />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
        >
          {isLoading ? "Saving..." : "Save review"}
        </button>
        <button
          type="button"
          onClick={() => { setIsOpen(false); setError(null); }}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function EmployeeCard({ employee }: { employee: HrEmployee }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-ink">{employee.name}</p>
          <p className="text-xs text-muted">{employee.role}</p>
          <p className="mt-2 text-xs text-muted">📧 {employee.email}</p>
          <p className="mt-1 text-xs text-muted">📍 {employee.work_location || "Not specified"}</p>
        </div>
        <span className={`rounded-md px-2 py-1 text-xs font-medium ${
          employee.status === "active"
            ? "bg-green-500 text-white"
            : employee.status === "on_leave"
            ? "bg-amber-500 text-white"
            : "bg-red-500 text-white"
        }`}>
          {employee.status}
        </span>
      </div>
    </div>
  );
}

export default function HrPage() {
  const [departments, setDepartments] = useState<HrDepartment[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [reviews, setReviews] = useState<HrPerformance[]>([]);
  const [totals, setTotals] = useState<HrTotals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
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

    const [deptResult, empResult, revResult] = await Promise.all([
      supabase
        .from("hr_department")
        .select("*")
        .eq("company_id", appUser.company_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("hr_employee")
        .select("*")
        .eq("company_id", appUser.company_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("hr_performance")
        .select("*")
        .eq("company_id", appUser.company_id)
        .order("period", { ascending: false }),
    ]);

    setDepartments((deptResult.data ?? []) as HrDepartment[]);
    setEmployees((empResult.data ?? []) as HrEmployee[]);
    setReviews((revResult.data ?? []) as HrPerformance[]);

    // Headline figures from the database, not from the rows just fetched.
    setTotals(await hrTotals(supabase, recentPeriods(1)[0]));
    setIsLoading(false);
  }

  const employeeName = (id: string) =>
    employees.find((e) => e.id === id)?.name ?? "Unknown employee";

  const avgRating =
    totals?.avg_rating ??
    (reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null);

  // Who has no review for the current quarter — the question a manager
  // actually asks, and the reason this table needed an interface.
  const currentPeriod = recentPeriods(1)[0];
  const reviewedThisPeriod = new Set(
    reviews.filter((r) => r.period === currentPeriod).map((r) => r.employee_id)
  );
  const unreviewed =
    totals?.unreviewed ??
    employees.filter((e) => e.status === "active" && !reviewedThisPeriod.has(e.id)).length;

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Human Resources</h1>
        <p className="text-sm text-muted">
          Departments, employees, attendance and performance
        </p>
      </div>

      <div className="mb-6 flex gap-4 items-center justify-between">
        <div className="text-sm text-muted">
          {(totals?.headcount ?? employees.length).toLocaleString()} employees in {(totals?.department_count ?? departments.length).toLocaleString()} departments
        </div>
        <div className="flex gap-2">
          <AddDepartmentForm onDepartmentAdded={fetchData} />
          <AddEmployeeForm departments={departments} onEmployeeAdded={fetchData} />
          <RecordReviewForm employees={employees} onRecorded={fetchData} />
        </div>
      </div>

      {/* The three actions have an order — department, then employee, then
          review — and nothing on screen said so. A disabled button with no
          explanation is a dead end. */}
      {!isLoading && (departments.length === 0 || employees.length === 0) && (
        <div className="mb-6 rounded-xl border border-border bg-panel p-4">
          <p className="text-sm text-ink">Set up in three steps</p>
          <ol className="mt-2 space-y-1 text-sm text-muted">
            <li className={departments.length > 0 ? "line-through opacity-50" : ""}>
              1. Create a department — employees belong to one
            </li>
            <li className={employees.length > 0 ? "line-through opacity-50" : ""}>
              2. Add an employee
            </li>
            <li>3. Record a performance review, and log attendance</li>
          </ol>
        </div>
      )}

      <div className="space-y-6">
        <LogAttendanceForm employees={employees} onAttendanceLogged={fetchData} />

        <div>
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-semibold text-ink">
              Performance reviews
              <span className="ml-2 text-xs font-normal text-muted">
                {(totals?.review_count ?? reviews.length).toLocaleString()} recorded
                {avgRating != null && ` · ${avgRating.toFixed(1)} average`}
                {unreviewed > 0 && ` · ${unreviewed} not reviewed this period`}
              </span>
            </h2>
          </div>

          {reviews.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-panel">
                  <tr className="text-left text-xs text-muted">
                    <th className="px-4 py-3 font-medium">Employee</th>
                    <th className="px-4 py-3 font-medium">Period</th>
                    <th className="px-4 py-3 font-medium">Rating</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Reviewed by</th>
                    <th className="px-4 py-3 font-medium">Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium text-ink">
                        {employeeName(r.employee_id)}
                      </td>
                      <td className="px-4 py-3 text-muted">{r.period}</td>
                      <td className="px-4 py-3"><RatingBadge rating={r.rating} /></td>
                      <td className="px-4 py-3 text-muted">{r.category ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{r.reviewed_by ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{r.feedback ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-panel p-6 text-center text-sm text-muted">
              {employees.length === 0
                ? "Add an employee before recording reviews."
                : "No reviews recorded yet."}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-4 text-sm font-semibold text-ink">All Employees ({employees.length})</h2>
          {employees.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {employees.map((employee) => (
                <EmployeeCard key={employee.id} employee={employee} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-panel p-6 text-center text-sm text-muted">
              No employees yet. Add a department first, then create employees.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

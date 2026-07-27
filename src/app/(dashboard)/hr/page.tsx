"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { HrDepartment, HrEmployee, HrAttendance } from "@/lib/types";

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
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light"
        >
          Add Employee
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

    const [deptResult, empResult] = await Promise.all([
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
    ]);

    setDepartments((deptResult.data ?? []) as HrDepartment[]);
    setEmployees((empResult.data ?? []) as HrEmployee[]);
    setIsLoading(false);
  }

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Human Resources</h1>
        <p className="text-sm text-muted">Manage employees, departments, and attendance</p>
      </div>

      <div className="mb-6 flex gap-4 items-center justify-between">
        <div className="text-sm text-muted">
          {employees.length} employees in {departments.length} departments
        </div>
        <div className="flex gap-2">
          <AddDepartmentForm onDepartmentAdded={fetchData} />
          {departments.length > 0 && <AddEmployeeForm departments={departments} onEmployeeAdded={fetchData} />}
        </div>
      </div>

      <div className="space-y-6">
        <LogAttendanceForm employees={employees} onAttendanceLogged={fetchData} />

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

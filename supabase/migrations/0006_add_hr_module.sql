-- Opservor HQ — HR Module (v1.0)
-- Tracks employees, departments, attendance, and performance

-- =====================================================================
-- hr_department — organizational structure
-- =====================================================================
create table if not exists hr_department (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references company(id) on delete cascade,
  name       text not null,
  code       text not null,
  head       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

create index if not exists hr_department_company_idx on hr_department(company_id);

-- =====================================================================
-- hr_employee — employee master records
-- =====================================================================
create table if not exists hr_employee (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references company(id) on delete cascade,
  department_id   uuid not null references hr_department(id) on delete cascade,
  name            text not null,
  email           text not null,
  role            text not null,
  status          text not null check (status in ('active', 'onboarding', 'on_leave', 'departed', 'inactive')),
  hire_date       date not null,
  manager_id      uuid references hr_employee(id) on delete set null,
  salary          numeric(10,2),
  work_location   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, email)
);

create index if not exists hr_employee_company_department_idx on hr_employee(company_id, department_id);
create index if not exists hr_employee_status_idx on hr_employee(status);

-- =====================================================================
-- hr_attendance — daily attendance records
-- =====================================================================
create table if not exists hr_attendance (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references company(id) on delete cascade,
  employee_id   uuid not null references hr_employee(id) on delete cascade,
  date          date not null,
  status        text not null check (status in ('present', 'absent', 'late', 'leave', 'remote')),
  hours_worked  numeric(4,2),
  notes         text,
  created_at    timestamptz not null default now(),
  unique (company_id, employee_id, date)
);

create index if not exists hr_attendance_company_employee_idx on hr_attendance(company_id, employee_id);
create index if not exists hr_attendance_date_idx on hr_attendance(date);

-- =====================================================================
-- hr_performance — performance metrics and ratings
-- =====================================================================
create table if not exists hr_performance (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references company(id) on delete cascade,
  employee_id   uuid not null references hr_employee(id) on delete cascade,
  period        text not null,
  rating        numeric(3,1) not null check (rating >= 1 and rating <= 5),
  category      text,
  feedback      text,
  reviewed_by   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, employee_id, period)
);

create index if not exists hr_performance_company_employee_idx on hr_performance(company_id, employee_id);

-- =====================================================================
-- hr_snapshot — monthly headcount and engagement metrics
-- =====================================================================
create table if not exists hr_snapshot (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references company(id) on delete cascade,
  month           text not null,
  total_headcount integer not null default 0,
  active_count    integer not null default 0,
  new_hires       integer not null default 0,
  departures      integer not null default 0,
  avg_attendance_pct numeric(5,2),
  avg_performance numeric(3,1),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, month)
);

create index if not exists hr_snapshot_company_idx on hr_snapshot(company_id);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table hr_department enable row level security;
alter table hr_employee enable row level security;
alter table hr_attendance enable row level security;
alter table hr_performance enable row level security;
alter table hr_snapshot enable row level security;

create policy "founder full access to hr_department" on hr_department
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy "founder full access to hr_employee" on hr_employee
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy "founder full access to hr_attendance" on hr_attendance
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy "founder full access to hr_performance" on hr_performance
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy "founder full access to hr_snapshot" on hr_snapshot
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

-- =====================================================================
-- Auto-update triggers
-- =====================================================================
create trigger update_hr_department_updated_at before update on hr_department
  for each row execute function update_updated_at_column();

create trigger update_hr_employee_updated_at before update on hr_employee
  for each row execute function update_updated_at_column();

create trigger update_hr_performance_updated_at before update on hr_performance
  for each row execute function update_updated_at_column();

create trigger update_hr_snapshot_updated_at before update on hr_snapshot
  for each row execute function update_updated_at_column();

-- ============================================================
-- Opservor HQ — Finance (0005) + HR (0006) combined
--
-- Safe to run more than once. Every object is guarded, so if a
-- previous attempt half-applied, this will finish the job rather
-- than error on "already exists".
--
-- Paste the whole file into the Supabase SQL Editor and Run.
-- ============================================================

-- ============================================================
-- PREFLIGHT — fail loudly and early if 0001_init has not run
-- ============================================================

do $$
begin
  if to_regclass('public.company') is null then
    raise exception 'Missing table "company". Run 0001_init.sql first.';
  end if;
  if to_regprocedure('public.auth_company_id()') is null then
    raise exception 'Missing function auth_company_id(). Run 0001_init.sql first.';
  end if;
  if to_regprocedure('public.update_updated_at_column()') is null then
    raise exception 'Missing function update_updated_at_column(). Run 0001_init.sql first.';
  end if;
  raise notice 'Preflight OK — company table and helper functions present.';
end $$;

-- ============================================================
-- FINANCE MODULE
-- ============================================================

create table if not exists finance_cost_center (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references company(id) on delete cascade,
  name       text not null,
  code       text not null,
  manager    text,
  budget_ytd numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

create index if not exists finance_cost_center_company_idx on finance_cost_center(company_id);

create table if not exists finance_transaction (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references company(id) on delete cascade,
  cost_center_id uuid not null references finance_cost_center(id) on delete cascade,
  type           text not null check (type in ('revenue', 'expense', 'adjustment')),
  category       text not null,
  amount         numeric(12,2) not null,
  description    text,
  date           date not null,
  reference      text,
  created_at     timestamptz not null default now()
);

create index if not exists finance_transaction_company_cost_center_idx on finance_transaction(company_id, cost_center_id);
create index if not exists finance_transaction_date_idx on finance_transaction(date);
create index if not exists finance_transaction_type_idx on finance_transaction(type);

create table if not exists finance_snapshot (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references company(id) on delete cascade,
  cost_center_id   uuid not null references finance_cost_center(id) on delete cascade,
  month            text not null,
  budget_allocated numeric(12,2) not null default 0,
  revenue_actual   numeric(12,2) not null default 0,
  expense_actual   numeric(12,2) not null default 0,
  variance_pct     numeric(5,2),
  burn_rate_pct    numeric(5,2),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_id, cost_center_id, month)
);

create index if not exists finance_snapshot_company_cost_center_idx on finance_snapshot(company_id, cost_center_id);

-- ============================================================
-- HR MODULE
-- ============================================================

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

create table if not exists hr_employee (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references company(id) on delete cascade,
  department_id uuid not null references hr_department(id) on delete cascade,
  name          text not null,
  email         text not null,
  role          text not null,
  status        text not null check (status in ('active', 'onboarding', 'on_leave', 'departed', 'inactive')),
  hire_date     date not null,
  manager_id    uuid references hr_employee(id) on delete set null,
  salary        numeric(10,2),
  work_location text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, email)
);

create index if not exists hr_employee_company_department_idx on hr_employee(company_id, department_id);
create index if not exists hr_employee_status_idx on hr_employee(status);

create table if not exists hr_attendance (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references company(id) on delete cascade,
  employee_id  uuid not null references hr_employee(id) on delete cascade,
  date         date not null,
  status       text not null check (status in ('present', 'absent', 'late', 'leave', 'remote')),
  hours_worked numeric(4,2),
  notes        text,
  created_at   timestamptz not null default now(),
  unique (company_id, employee_id, date)
);

create index if not exists hr_attendance_company_employee_idx on hr_attendance(company_id, employee_id);
create index if not exists hr_attendance_date_idx on hr_attendance(date);

create table if not exists hr_performance (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references company(id) on delete cascade,
  employee_id uuid not null references hr_employee(id) on delete cascade,
  period      text not null,
  rating      numeric(3,1) not null check (rating >= 1 and rating <= 5),
  category    text,
  feedback    text,
  reviewed_by text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, employee_id, period)
);

create index if not exists hr_performance_company_employee_idx on hr_performance(company_id, employee_id);

create table if not exists hr_snapshot (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references company(id) on delete cascade,
  month              text not null,
  total_headcount    integer not null default 0,
  active_count       integer not null default 0,
  new_hires          integer not null default 0,
  departures         integer not null default 0,
  avg_attendance_pct numeric(5,2),
  avg_performance    numeric(3,1),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (company_id, month)
);

create index if not exists hr_snapshot_company_idx on hr_snapshot(company_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- Every table is scoped to the caller's company. Without this the
-- tables are readable across tenants, so it is not optional.
-- ============================================================

do $$
declare
  t text;
  tables text[] := array[
    'finance_cost_center', 'finance_transaction', 'finance_snapshot',
    'hr_department', 'hr_employee', 'hr_attendance', 'hr_performance', 'hr_snapshot'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "founder full access to %s" on %I', t, t);
    execute format(
      'create policy "founder full access to %s" on %I for all using (company_id = auth_company_id()) with check (company_id = auth_company_id())',
      t, t);
  end loop;
end $$;

-- ============================================================
-- AUTO-UPDATE TRIGGERS
-- ============================================================

do $$
declare
  t text;
  tables text[] := array[
    'finance_cost_center', 'finance_snapshot',
    'hr_department', 'hr_employee', 'hr_performance', 'hr_snapshot'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists update_%s_updated_at on %I', t, t);
    execute format(
      'create trigger update_%s_updated_at before update on %I for each row execute function update_updated_at_column()',
      t, t);
  end loop;
end $$;

-- ============================================================
-- VERIFICATION — should return 8 rows, every one with rls = true
-- ============================================================

select
  c.relname                            as table_name,
  c.relrowsecurity                     as rls,
  (select count(*) from pg_policies p
    where p.tablename = c.relname)     as policies,
  (select count(*) from pg_trigger g
    where g.tgrelid = c.oid
      and not g.tgisinternal)          as triggers
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and (c.relname like 'finance%' or c.relname like 'hr\_%')
order by c.relname;

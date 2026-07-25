-- Opservor HQ — Finance Module (v1.0)
-- Tracks budgets, expenses, revenue, and financial metrics

-- =====================================================================
-- finance_cost_center — organizational budget units
-- =====================================================================
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

-- =====================================================================
-- finance_transaction — individual financial entries
-- =====================================================================
create table if not exists finance_transaction (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references company(id) on delete cascade,
  cost_center_id  uuid not null references finance_cost_center(id) on delete cascade,
  type            text not null check (type in ('revenue', 'expense', 'adjustment')),
  category        text not null,
  amount          numeric(12,2) not null,
  description     text,
  date            date not null,
  reference       text,
  created_at      timestamptz not null default now()
);

create index if not exists finance_transaction_company_cost_center_idx on finance_transaction(company_id, cost_center_id);
create index if not exists finance_transaction_date_idx on finance_transaction(date);
create index if not exists finance_transaction_type_idx on finance_transaction(type);

-- =====================================================================
-- finance_snapshot — monthly aggregated financials per cost center
-- =====================================================================
create table if not exists finance_snapshot (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references company(id) on delete cascade,
  cost_center_id       uuid not null references finance_cost_center(id) on delete cascade,
  month                text not null,
  budget_allocated     numeric(12,2) not null default 0,
  revenue_actual       numeric(12,2) not null default 0,
  expense_actual       numeric(12,2) not null default 0,
  variance_pct         numeric(5,2),
  burn_rate_pct        numeric(5,2),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (company_id, cost_center_id, month)
);

create index if not exists finance_snapshot_company_cost_center_idx on finance_snapshot(company_id, cost_center_id);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table finance_cost_center enable row level security;
alter table finance_transaction enable row level security;
alter table finance_snapshot enable row level security;

create policy "founder full access to finance_cost_center" on finance_cost_center
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy "founder full access to finance_transaction" on finance_transaction
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy "founder full access to finance_snapshot" on finance_snapshot
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

-- =====================================================================
-- Auto-update triggers
-- =====================================================================
create trigger update_finance_cost_center_updated_at before update on finance_cost_center
  for each row execute function update_updated_at_column();

create trigger update_finance_snapshot_updated_at before update on finance_snapshot
  for each row execute function update_updated_at_column();

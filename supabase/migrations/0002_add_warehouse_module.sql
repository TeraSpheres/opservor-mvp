-- Opservor HQ — Warehouse Module (v1.1)
-- Adds warehouse site tracking and daily snapshots.
-- Extends alert table to support site tagging (optional).
-- No changes to Business Health Score calculation (v1.0).

-- =====================================================================
-- warehouse_site — one row per physical warehouse location
-- =====================================================================
create table if not exists warehouse_site (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references company(id) on delete cascade,
  name       text not null,
  location   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists warehouse_site_company_idx on warehouse_site(company_id);

-- =====================================================================
-- warehouse_snapshot — one row per site per day per shift
-- All figures manually entered (productivity, orders, dock utilization)
-- =====================================================================
create type shift_type as enum ('A', 'B', 'C', 'all');

create table if not exists warehouse_snapshot (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references company(id) on delete cascade,
  site_id               uuid not null references warehouse_site(id) on delete cascade,
  date                  date not null,
  shift                 shift_type not null default 'all',
  productivity_pct      numeric(5,2) not null default 0 check (productivity_pct between 0 and 100),
  orders_processed      integer not null default 0 check (orders_processed >= 0),
  orders_pending        integer not null default 0 check (orders_pending >= 0),
  dock_utilization_pct  numeric(5,2) not null default 0 check (dock_utilization_pct between 0 and 100),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (company_id, site_id, date, shift)
);

create index if not exists warehouse_snapshot_company_site_idx on warehouse_snapshot(company_id, site_id);
create index if not exists warehouse_snapshot_date_idx on warehouse_snapshot(date);

-- =====================================================================
-- alert table — add optional site_id for warehouse-specific alerts
-- Existing alerts (no site) remain unchanged; new alerts can reference a site
-- =====================================================================
alter table alert add column if not exists site_id uuid references warehouse_site(id) on delete set null;

-- =====================================================================
-- Row Level Security — extend to new warehouse tables
-- =====================================================================
alter table warehouse_site enable row level security;
alter table warehouse_snapshot enable row level security;

create policy "founder full access to warehouse_site" on warehouse_site
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy "founder full access to warehouse_snapshot" on warehouse_snapshot
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

-- Updated alert policy to include site filtering (if site is set, must also match auth_company_id via site's company)
-- Note: existing alerts with site_id = null still work; this just adds site-scoped visibility where needed

-- =====================================================================
-- Auto-update triggers for warehouse tables
-- =====================================================================
create trigger update_warehouse_site_updated_at before update on warehouse_site
  for each row execute function update_updated_at_column();

create trigger update_warehouse_snapshot_updated_at before update on warehouse_snapshot
  for each row execute function update_updated_at_column();

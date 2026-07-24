-- Opservor HQ — Fleet Module (v1.0)
-- Tracks vehicles, assets, utilization, and maintenance

-- =====================================================================
-- fleet_vehicle — one row per vehicle/asset
-- =====================================================================
create table if not exists fleet_vehicle (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references company(id) on delete cascade,
  name       text not null,
  type       text not null,
  status     text not null default 'active' check (status in ('active', 'maintenance', 'retired', 'inactive')),
  license_plate text,
  fuel_type  text,
  purchase_date date,
  mileage    integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fleet_vehicle_company_idx on fleet_vehicle(company_id);

-- =====================================================================
-- fleet_trip — one row per trip/route taken
-- =====================================================================
create table if not exists fleet_trip (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references company(id) on delete cascade,
  vehicle_id  uuid not null references fleet_vehicle(id) on delete cascade,
  date        date not null,
  miles_driven numeric(8,2) not null default 0,
  fuel_used   numeric(8,2),
  origin      text,
  destination text,
  status      text not null default 'completed' check (status in ('completed', 'in_progress', 'cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists fleet_trip_company_vehicle_idx on fleet_trip(company_id, vehicle_id);
create index if not exists fleet_trip_date_idx on fleet_trip(date);

-- =====================================================================
-- fleet_metrics — daily aggregated metrics per vehicle
-- =====================================================================
create table if not exists fleet_metrics (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references company(id) on delete cascade,
  vehicle_id         uuid not null references fleet_vehicle(id) on delete cascade,
  date               date not null,
  trips_completed    integer not null default 0,
  miles_driven       numeric(8,2) not null default 0,
  fuel_efficiency    numeric(6,2),
  utilization_hours  numeric(5,2),
  on_time_pct        numeric(5,2),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (company_id, vehicle_id, date)
);

create index if not exists fleet_metrics_company_vehicle_idx on fleet_metrics(company_id, vehicle_id);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table fleet_vehicle enable row level security;
alter table fleet_trip enable row level security;
alter table fleet_metrics enable row level security;

create policy "founder full access to fleet_vehicle" on fleet_vehicle
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy "founder full access to fleet_trip" on fleet_trip
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy "founder full access to fleet_metrics" on fleet_metrics
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

-- =====================================================================
-- Auto-update triggers
-- =====================================================================
create trigger update_fleet_vehicle_updated_at before update on fleet_vehicle
  for each row execute function update_updated_at_column();

create trigger update_fleet_trip_updated_at before update on fleet_trip
  for each row execute function update_updated_at_column();

create trigger update_fleet_metrics_updated_at before update on fleet_metrics
  for each row execute function update_updated_at_column();

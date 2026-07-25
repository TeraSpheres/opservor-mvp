-- ============================================================
-- Opservor HQ — Fleet (0003) + Inventory (0004) combined
--
-- Guarded and safe to run in any state: whether these were never
-- applied, or applied partially. Tables use IF NOT EXISTS; policies
-- and triggers are dropped before create.
--
-- Run this BEFORE 0007_inventory_stock_sync.sql.
-- ============================================================

do $$
begin
  if to_regclass('public.company') is null then
    raise exception 'Missing table "company". Run 0001_init.sql first.';
  end if;
  if to_regprocedure('public.auth_company_id()') is null
     or to_regprocedure('public.update_updated_at_column()') is null then
    raise exception 'Missing helper functions. Run 0001_init.sql first.';
  end if;
  raise notice 'Preflight OK.';
end $$;

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

create table if not exists inventory_sku (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references company(id) on delete cascade,
  sku        text not null unique,
  name       text not null,
  category   text,
  quantity_on_hand integer not null default 0,
  quantity_reserved integer not null default 0,
  reorder_level integer not null default 10,
  reorder_quantity integer not null default 50,
  unit_cost  numeric(10,2),
  unit_price numeric(10,2),
  warehouse_location text,
  supplier   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inventory_sku_company_idx on inventory_sku(company_id);
create index if not exists inventory_sku_sku_idx on inventory_sku(sku);
create table if not exists inventory_movement (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references company(id) on delete cascade,
  sku_id      uuid not null references inventory_sku(id) on delete cascade,
  type        text not null check (type in ('inbound', 'outbound', 'adjustment', 'reorder')),
  quantity    integer not null,
  reference   text,
  notes       text,
  date        date not null,
  created_at  timestamptz not null default now()
);
create index if not exists inventory_movement_company_sku_idx on inventory_movement(company_id, sku_id);
create index if not exists inventory_movement_date_idx on inventory_movement(date);
create table if not exists inventory_snapshot (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references company(id) on delete cascade,
  sku_id               uuid not null references inventory_sku(id) on delete cascade,
  date                 date not null,
  quantity_on_hand     integer not null default 0,
  quantity_reserved    integer not null default 0,
  days_on_hand         numeric(5,1),
  reorder_status       text check (reorder_status in ('ok', 'low', 'critical', 'overstocked')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (company_id, sku_id, date)
);
create index if not exists inventory_snapshot_company_sku_idx on inventory_snapshot(company_id, sku_id);

-- ------------------------------------------------------------
-- RLS + policies, idempotent
-- ------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'fleet_vehicle', 'fleet_trip', 'fleet_metrics',
    'inventory_sku', 'inventory_movement', 'inventory_snapshot'
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

-- ------------------------------------------------------------
-- updated_at triggers, idempotent. Ledger tables excluded.
-- ------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'fleet_vehicle', 'fleet_trip', 'fleet_metrics',
    'inventory_sku', 'inventory_snapshot'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists update_%s_updated_at on %I', t, t);
    execute format(
      'create trigger update_%s_updated_at before update on %I for each row execute function update_updated_at_column()',
      t, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- Verification — expect 6 rows, rls true on every one
-- ------------------------------------------------------------
select
  c.relname as table_name,
  c.relrowsecurity as rls,
  (select count(*) from pg_policies p where p.tablename = c.relname) as policies,
  (select count(*) from pg_trigger g where g.tgrelid = c.oid and not g.tgisinternal) as triggers
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and (c.relname like 'fleet%' or c.relname like 'inventory%')
order by c.relname;

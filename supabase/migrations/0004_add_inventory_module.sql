-- Opservor HQ — Inventory Module (v1.0)
-- Tracks stock levels, SKUs, and reorder management

-- =====================================================================
-- inventory_sku — one row per product/SKU
-- =====================================================================
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

-- =====================================================================
-- inventory_movement — one row per stock transaction
-- =====================================================================
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

-- =====================================================================
-- inventory_snapshot — daily aggregated metrics per SKU
-- =====================================================================
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

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table inventory_sku enable row level security;
alter table inventory_movement enable row level security;
alter table inventory_snapshot enable row level security;

create policy "founder full access to inventory_sku" on inventory_sku
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy "founder full access to inventory_movement" on inventory_movement
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy "founder full access to inventory_snapshot" on inventory_snapshot
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

-- =====================================================================
-- Auto-update triggers
-- =====================================================================
create trigger update_inventory_sku_updated_at before update on inventory_sku
  for each row execute function update_updated_at_column();

create trigger update_inventory_snapshot_updated_at before update on inventory_snapshot
  for each row execute function update_updated_at_column();

-- Opservor HQ — operational tables for assets, shipments, inventory, ERP logging
-- Extends v1 schema with new operational tracking tables while preserving existing data

-- =====================================================================
-- ENUMS for new tables
-- =====================================================================
create type asset_type as enum (
  'vehicle',
  'equipment',
  'facility',
  'technology',
  'other'
);

create type asset_status as enum (
  'active',
  'inactive',
  'maintenance',
  'retired'
);

create type shipment_status as enum (
  'pending',
  'in_transit',
  'delivered',
  'cancelled',
  'returned'
);

create type inventory_action as enum (
  'sync',
  'import',
  'export',
  'update',
  'manual_adjustment'
);

create type erp_action as enum (
  'sync',
  'import',
  'export',
  'update',
  'validation'
);

create type erp_status as enum (
  'success',
  'failure',
  'pending',
  'retrying'
);

-- =====================================================================
-- assets — company assets (vehicles, equipment, facilities, etc.)
-- =====================================================================
create table if not exists assets (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references company(id) on delete cascade,
  asset_type        asset_type not null,
  name              text not null,
  description       text,
  status            asset_status not null default 'active',
  purchase_date     date,
  acquisition_cost  numeric(14,2),
  current_value     numeric(14,2),
  location          text,
  serial_number     text,
  depreciation_rate numeric(5,2),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (company_id, serial_number)
);

create index if not exists assets_company_status_idx on assets(company_id, status);
create index if not exists assets_company_type_idx on assets(company_id, asset_type);

-- =====================================================================
-- shipments — tracking shipments and deliveries
-- =====================================================================
create table if not exists shipments (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references company(id) on delete cascade,
  shipment_number        text not null,
  origin                 text not null,
  destination            text not null,
  status                 shipment_status not null default 'pending',
  scheduled_delivery     date,
  actual_delivery        date,
  weight_kg              numeric(10,2),
  dimensions_cm          text,
  value                  numeric(14,2),
  carrier                text,
  tracking_number        text,
  reference_number       text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (company_id, shipment_number),
  check (actual_delivery is null or actual_delivery >= scheduled_delivery)
);

create index if not exists shipments_company_status_idx on shipments(company_id, status);
create index if not exists shipments_tracking_idx on shipments(tracking_number);
create index if not exists shipments_scheduled_delivery_idx on shipments(scheduled_delivery);

-- =====================================================================
-- inventory — stock/inventory management
-- =====================================================================
create table if not exists inventory (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references company(id) on delete cascade,
  sku                 text not null,
  name                text not null,
  description         text,
  quantity_on_hand    integer not null default 0 check (quantity_on_hand >= 0),
  quantity_reserved   integer not null default 0 check (quantity_reserved >= 0),
  quantity_available  integer generated always as (quantity_on_hand - quantity_reserved) stored,
  unit_cost           numeric(10,2),
  unit_price          numeric(10,2),
  location            text,
  warehouse_bin       text,
  reorder_level       integer,
  reorder_quantity    integer,
  lead_time_days      integer,
  category            text,
  supplier            text,
  last_restocked_at   timestamptz,
  last_counted_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (company_id, sku)
);

create index if not exists inventory_company_sku_idx on inventory(company_id, sku);
create index if not exists inventory_category_idx on inventory(company_id, category);
create index if not exists inventory_low_stock_idx on inventory(company_id) where quantity_available < reorder_level;

-- =====================================================================
-- erp_logs — logging ERP sync/integration events
-- =====================================================================
create table if not exists erp_logs (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references company(id) on delete cascade,
  action            erp_action not null,
  entity_type       text not null,
  entity_id         text,
  record_count      integer,
  status            erp_status not null default 'pending',
  message           text,
  error_details     jsonb,
  sync_timestamp    timestamptz,
  duration_seconds  integer,
  created_at        timestamptz not null default now()
);

create index if not exists erp_logs_company_status_idx on erp_logs(company_id, status);
create index if not exists erp_logs_created_at_idx on erp_logs(created_at desc);
create index if not exists erp_logs_entity_idx on erp_logs(entity_type, entity_id);

-- =====================================================================
-- Row Level Security — extend existing RLS patterns to new tables
-- =====================================================================
alter table assets enable row level security;
alter table shipments enable row level security;
alter table inventory enable row level security;
alter table erp_logs enable row level security;

create policy "founder full access to assets" on assets
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy "founder full access to shipments" on shipments
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy "founder full access to inventory" on inventory
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy "founder full access to erp_logs" on erp_logs
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

-- =====================================================================
-- Helper function: auto-update updated_at timestamp
-- =====================================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create triggers for all tables with updated_at
create trigger update_assets_updated_at before update on assets
  for each row execute function update_updated_at_column();

create trigger update_shipments_updated_at before update on shipments
  for each row execute function update_updated_at_column();

create trigger update_inventory_updated_at before update on inventory
  for each row execute function update_updated_at_column();

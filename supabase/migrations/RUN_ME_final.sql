-- ============================================================
-- Opservor HQ — FINAL PENDING MIGRATIONS
--
-- Combines 0007 (inventory stock trigger) and 0008 (Safety +
-- Reports). Both are guarded and safe to run more than once.
--
-- Order matters: 0007 depends on the inventory tables, 0008 does
-- not depend on 0007. Running them together is safe.
--
-- Paste the whole file into the Supabase SQL Editor and Run.
--
-- EXPECT TWO RESULT GRIDS:
--   1st — one row per SKU, "drift" must be 0 on every row
--         (zero rows is also fine if you have no SKUs yet)
--   2nd — 5 rows, "rls" true on every one
--         report_run shows 0 triggers; it is a ledger
-- ============================================================

-- ============================================================
-- Opservor HQ — Inventory stock synchronisation (0007)
--
-- Closes the gap where inventory_movement recorded history but never
-- adjusted inventory_sku.quantity_on_hand. Receiving 500 units left
-- the on-hand figure reading zero.
--
-- Safe to run more than once.
-- Paste into the Supabase SQL Editor and Run.
-- ============================================================

-- ------------------------------------------------------------
-- Preflight
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.inventory_sku') is null
     or to_regclass('public.inventory_movement') is null then
    raise exception 'Inventory tables missing. Run 0004_add_inventory_module.sql first.';
  end if;
end $$;

-- ------------------------------------------------------------
-- The sign convention, in one place.
--
--   inbound     received into stock          -> add
--   outbound    shipped out of stock         -> subtract
--   adjustment  correction, may be negative  -> add as signed
--   reorder     purchase order raised        -> no stock effect
--
-- 'reorder' deliberately does nothing. Raising a PO does not change
-- what is on the shelf; the goods land later as an 'inbound'.
-- ------------------------------------------------------------
create or replace function inventory_movement_delta(p_type text, p_qty integer)
returns integer
language sql
immutable
as $$
  select case p_type
    when 'inbound'    then  p_qty
    when 'outbound'   then -p_qty
    when 'adjustment' then  p_qty
    else 0
  end;
$$;

-- ------------------------------------------------------------
-- Trigger: keep quantity_on_hand in step with the ledger.
--
-- UPDATE and DELETE are handled even though the ledger is meant to be
-- append-only. If a row is ever corrected or removed by hand, the
-- stock figure follows rather than silently drifting.
-- ------------------------------------------------------------
create or replace function inventory_apply_movement()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    update inventory_sku
       set quantity_on_hand = quantity_on_hand + inventory_movement_delta(NEW.type, NEW.quantity)
     where id = NEW.sku_id;
    return NEW;

  elsif TG_OP = 'UPDATE' then
    -- reverse the old effect, then apply the new one
    update inventory_sku
       set quantity_on_hand = quantity_on_hand - inventory_movement_delta(OLD.type, OLD.quantity)
     where id = OLD.sku_id;
    update inventory_sku
       set quantity_on_hand = quantity_on_hand + inventory_movement_delta(NEW.type, NEW.quantity)
     where id = NEW.sku_id;
    return NEW;

  elsif TG_OP = 'DELETE' then
    update inventory_sku
       set quantity_on_hand = quantity_on_hand - inventory_movement_delta(OLD.type, OLD.quantity)
     where id = OLD.sku_id;
    return OLD;
  end if;
  return null;
end $$;

drop trigger if exists inventory_movement_sync on inventory_movement;
create trigger inventory_movement_sync
  after insert or update or delete on inventory_movement
  for each row execute function inventory_apply_movement();

-- ------------------------------------------------------------
-- Backfill.
--
-- Every movement recorded before this migration was never applied, so
-- quantity_on_hand is still whatever it was at SKU creation (0 by
-- default — there is no interface for setting an opening balance).
-- Recomputing from the ledger is therefore the correct position.
--
-- SKUs with no movements are left untouched.
-- ------------------------------------------------------------
do $$
declare
  touched integer;
begin
  with ledger as (
    select sku_id, sum(inventory_movement_delta(type, quantity))::integer as total
      from inventory_movement
     group by sku_id
  )
  update inventory_sku s
     set quantity_on_hand = ledger.total
    from ledger
   where s.id = ledger.sku_id
     and s.quantity_on_hand is distinct from ledger.total;

  get diagnostics touched = row_count;
  raise notice 'Backfill complete — % SKU(s) recalculated from the ledger.', touched;
end $$;

-- ------------------------------------------------------------
-- Verification.
--
-- 'drift' must be 0 on every row. Anything else means the ledger and
-- the stock figure disagree, and the trigger is not doing its job.
-- ------------------------------------------------------------
select
  s.sku,
  s.name,
  s.quantity_on_hand,
  coalesce(sum(inventory_movement_delta(m.type, m.quantity)), 0)::integer as ledger_total,
  s.quantity_on_hand
    - coalesce(sum(inventory_movement_delta(m.type, m.quantity)), 0)::integer as drift,
  count(m.id) as movements
from inventory_sku s
left join inventory_movement m on m.sku_id = s.id
group by s.id, s.sku, s.name, s.quantity_on_hand
order by s.sku;


-- ============================================================
-- Opservor HQ — Safety (v1.0) + Reports (v1.0)
--
-- The last two modules of the v1 scope. Guarded and safe to run
-- more than once: tables use IF NOT EXISTS, policies and triggers
-- are dropped before create.
--
-- Paste the whole file into the Supabase SQL Editor and Run.
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

-- ============================================================
-- SAFETY
-- ============================================================

-- One row per incident. The unit of record for the whole module.
create table if not exists safety_incident (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references company(id) on delete cascade,
  date              date not null,
  severity          text not null check (severity in ('low', 'medium', 'high', 'critical')),
  category          text not null,
  location          text,
  description       text not null,
  corrective_action text,
  status            text not null default 'open'
                      check (status in ('open', 'investigating', 'resolved', 'closed')),
  reported_by       text,
  resolved_date     date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists safety_incident_company_idx  on safety_incident(company_id);
create index if not exists safety_incident_date_idx     on safety_incident(date);
create index if not exists safety_incident_severity_idx on safety_incident(severity);
create index if not exists safety_incident_status_idx   on safety_incident(status);

-- Scheduled checks. Separate from incidents: an inspection is
-- something you do, an incident is something that happened.
create table if not exists safety_inspection (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references company(id) on delete cascade,
  date        date not null,
  area        text not null,
  inspector   text,
  result      text not null check (result in ('pass', 'conditional', 'fail')),
  findings    text,
  next_due    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists safety_inspection_company_idx on safety_inspection(company_id);
create index if not exists safety_inspection_date_idx    on safety_inspection(date);

-- Monthly rollup. Defined now so aggregation needs no migration later.
create table if not exists safety_snapshot (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references company(id) on delete cascade,
  month                   text not null,
  incidents_total         integer not null default 0,
  incidents_critical      integer not null default 0,
  incidents_high          integer not null default 0,
  inspections_completed   integer not null default 0,
  inspections_failed      integer not null default 0,
  days_since_last_incident integer,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (company_id, month)
);

create index if not exists safety_snapshot_company_idx on safety_snapshot(company_id);

-- ============================================================
-- REPORTS
-- ============================================================

-- A saved report definition. Reports do not hold operational data —
-- they describe how to read the data the other modules already hold.
create table if not exists report_definition (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references company(id) on delete cascade,
  name        text not null,
  module      text not null check (module in
                ('warehouse','fleet','inventory','finance','hr','safety','cross_module')),
  period      text not null default 'month'
                check (period in ('week','month','quarter','year','custom')),
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, name)
);

create index if not exists report_definition_company_idx on report_definition(company_id);
create index if not exists report_definition_module_idx  on report_definition(module);

-- Execution log. Append-only — a run that changes after the fact is
-- a defect, so no updated_at and no update trigger.
create table if not exists report_run (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references company(id) on delete cascade,
  definition_id uuid not null references report_definition(id) on delete cascade,
  period_start  date not null,
  period_end    date not null,
  row_count     integer,
  status        text not null default 'success'
                  check (status in ('success','empty','failed')),
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists report_run_company_definition_idx on report_run(company_id, definition_id);
create index if not exists report_run_created_idx on report_run(created_at);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

do $$
declare
  t text;
  tables text[] := array[
    'safety_incident', 'safety_inspection', 'safety_snapshot',
    'report_definition', 'report_run'
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
-- AUTO-UPDATE TRIGGERS — state tables only, report_run excluded
-- ============================================================

do $$
declare
  t text;
  tables text[] := array[
    'safety_incident', 'safety_inspection', 'safety_snapshot', 'report_definition'
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
-- VERIFICATION — expect 5 rows, rls true on every one.
-- report_run should show 0 triggers; it is a ledger.
-- ============================================================

select
  c.relname        as table_name,
  c.relrowsecurity as rls,
  (select count(*) from pg_policies p where p.tablename = c.relname) as policies,
  (select count(*) from pg_trigger g where g.tgrelid = c.oid and not g.tgisinternal) as triggers
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and (c.relname like 'safety%' or c.relname like 'report%')
order by c.relname;

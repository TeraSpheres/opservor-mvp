-- 0009 — Tenant-scope the SKU key, and keep vehicle mileage current
--
-- Fixes defects 1 and 4 from TS-PROD-001 §10.
--
-- Defect 1 is the reason this migration exists now rather than later.
-- inventory_sku.sku carries a GLOBAL unique constraint, so the second tenant
-- to onboard cannot create a SKU code the first tenant already used. Two
-- customers using "WIDGET-001" is not a conflict — it is the normal case.
-- Fixing it after two tenants hold overlapping codes means reconciling data
-- first; fixing it now is one statement.
--
-- Safe to re-run. Every step checks its own precondition.

begin;

-- ---------------------------------------------------------------------------
-- Preflight
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.inventory_sku') is null then
    raise exception 'inventory_sku does not exist — apply 0004 (or RUN_ME_fleet_inventory.sql) first';
  end if;
  if to_regclass('public.fleet_trip') is null then
    raise exception 'fleet_trip does not exist — apply 0003 (or RUN_ME_fleet_inventory.sql) first';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Defect 1 — scope the SKU key to the tenant
-- ---------------------------------------------------------------------------

-- The constraint was created inline, so PostgreSQL named it for us. Find it by
-- shape rather than by guessing the name: a unique constraint on exactly the
-- single column `sku`.
do $$
declare
  con_name text;
begin
  select c.conname into con_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where t.relname = 'inventory_sku'
    and c.contype = 'u'
    and c.conkey = array[(
      select attnum from pg_attribute
      where attrelid = t.oid and attname = 'sku' and not attisdropped
    )]::smallint[];

  if con_name is not null then
    execute format('alter table inventory_sku drop constraint %I', con_name);
    raise notice 'dropped global unique constraint % on inventory_sku.sku', con_name;
  else
    raise notice 'no single-column unique constraint on inventory_sku.sku — nothing to drop';
  end if;
end $$;

-- Guard: the new constraint cannot be created if duplicates already exist
-- within a tenant. Report them clearly rather than failing on a raw index error.
do $$
declare
  dupes int;
begin
  select count(*) into dupes
  from (
    select company_id, sku from inventory_sku
    group by company_id, sku having count(*) > 1
  ) d;

  if dupes > 0 then
    raise exception
      'cannot scope SKU key: % (company_id, sku) pair(s) are duplicated. Resolve them first — see the reconciliation query in the comment below.', dupes;
  end if;
end $$;

-- If the guard above ever fires, this finds the offenders:
--   select company_id, sku, count(*), array_agg(id)
--   from inventory_sku group by company_id, sku having count(*) > 1;

create unique index if not exists inventory_sku_company_sku_key
  on inventory_sku (company_id, sku);

-- ---------------------------------------------------------------------------
-- Defect 4 — vehicle mileage from trip data
-- ---------------------------------------------------------------------------
--
-- mileage was written once at vehicle creation and never moved. Rather than
-- incrementing on insert (which drifts the moment a trip is edited or deleted),
-- recompute the vehicle's total from its own trips. Correct by construction,
-- and cheap at any realistic trip volume per vehicle.
--
-- Only completed trips count. An in-progress or cancelled trip has not put
-- distance on the vehicle.

create or replace function fleet_recalc_vehicle_mileage(p_vehicle_id uuid)
returns void
language sql
as $$
  update fleet_vehicle v
     set mileage = coalesce((
           select round(sum(t.miles_driven))::integer
           from fleet_trip t
           where t.vehicle_id = v.id
             and t.status = 'completed'
         ), 0)
   where v.id = p_vehicle_id;
$$;

create or replace function fleet_trip_sync_mileage()
returns trigger
language plpgsql
as $$
begin
  -- On update the trip may have been moved to a different vehicle, so both
  -- the old and the new vehicle need recalculating.
  if tg_op in ('UPDATE', 'DELETE') then
    perform fleet_recalc_vehicle_mileage(old.vehicle_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform fleet_recalc_vehicle_mileage(new.vehicle_id);
  end if;
  return null;
end $$;

drop trigger if exists fleet_trip_mileage_sync on fleet_trip;
create trigger fleet_trip_mileage_sync
  after insert or update or delete on fleet_trip
  for each row execute function fleet_trip_sync_mileage();

-- Backfill every vehicle from its existing trips.
do $$
declare
  touched int;
begin
  update fleet_vehicle v
     set mileage = coalesce((
           select round(sum(t.miles_driven))::integer
           from fleet_trip t
           where t.vehicle_id = v.id and t.status = 'completed'
         ), 0)
   where v.mileage is distinct from coalesce((
           select round(sum(t.miles_driven))::integer
           from fleet_trip t
           where t.vehicle_id = v.id and t.status = 'completed'
         ), 0);
  get diagnostics touched = row_count;
  raise notice 'backfilled mileage on % vehicle(s)', touched;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
select
  (select count(*) from pg_indexes
    where tablename = 'inventory_sku' and indexname = 'inventory_sku_company_sku_key')
      as sku_scoped_to_company,
  (select count(*) from pg_constraint c
     join pg_class t on t.oid = c.conrelid
    where t.relname = 'inventory_sku' and c.contype = 'u'
      and array_length(c.conkey, 1) = 1)
      as leftover_global_sku_constraints,
  (select count(*) from pg_trigger
    where tgname = 'fleet_trip_mileage_sync' and not tgisinternal)
      as mileage_trigger;
-- Expect: 1, 0, 1

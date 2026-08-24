-- 0022 — a depot on the vehicle, so the capacity check stops guessing
--
-- THE PROBLEM
--
-- guardian_check_capacity_clash works out which vehicles serve which site like
-- this:
--
--     join warehouse_site w on w.company_id = t.company_id and w.name = t.origin
--
-- It matches a trip's starting point against a warehouse site's name, exactly,
-- character for character. Nothing records the mapping properly, so this was
-- the only honest source available at the time.
--
-- It does not work on real data. A trip origin from a telematics system is a
-- street address, or a geofence name, or blank. It is almost never the exact
-- string somebody typed as a site name. When the join finds nothing, no site
-- has a fleet, and the check returns zero — silently, and for the life of the
-- account. That is why it has never fired on anything but seeded demo data.
--
-- THE FIX
--
-- Record the depot on the vehicle, which is where it belongs, and let the
-- adapters fill it in. Every telematics system already groups vehicles —
-- Samsara has tags, Geotab has groups, Motive has groups — because that is how
-- a real fleet tracks which yard a truck lives at. Opservor was discarding all
-- of it.
--
-- The old trip-origin inference is kept as a fallback rather than deleted, so
-- an account with no groups configured is no worse off than before.
--
-- Matching is case-insensitive and trimmed. "Calgary Depot" typed into Opservor
-- and "calgary depot " tagged in Samsara are the same yard, and insisting
-- otherwise is how the first version failed.
--
-- Safe to re-run.

begin;

alter table fleet_vehicle
  add column if not exists depot text;

comment on column fleet_vehicle.depot is
  'Which site this vehicle works from. Filled by an integration from the '
  'provider''s own grouping, or set by hand. Matched to warehouse_site.name '
  'case-insensitively.';

create index if not exists fleet_vehicle_depot_idx
  on fleet_vehicle (company_id, depot);

commit;

-- ---------------------------------------------------------------------------
-- The check, using the depot first and the old inference only as a fallback
-- ---------------------------------------------------------------------------

create or replace function guardian_serving_map()
returns table (vehicle_id uuid, site_id uuid, source text)
language sql
security invoker
set search_path = public, pg_temp
as $$
  -- Recorded, and therefore trusted.
  select v.id, w.id, 'depot'::text
    from fleet_vehicle v
    join warehouse_site w
      on w.company_id = v.company_id
     and lower(trim(w.name)) = lower(trim(v.depot))
   where v.company_id = auth_company_id()
     and v.depot is not null
     and trim(v.depot) <> ''

  union

  -- Inferred from where journeys started. Only for vehicles with no depot
  -- recorded, so a real assignment is never overridden by a guess.
  select distinct t.vehicle_id, w.id, 'trip origin'::text
    from fleet_trip t
    join warehouse_site w
      on w.company_id = t.company_id
     and lower(trim(w.name)) = lower(trim(t.origin))
    join fleet_vehicle v
      on v.id = t.vehicle_id
   where t.company_id = auth_company_id()
     and t.date >= current_date - 30
     and (v.depot is null or trim(v.depot) = '');
$$;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_name = 'fleet_vehicle' and column_name = 'depot')  as depot_column,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'guardian_serving_map') as helper;
-- Expect: 1 and 1.

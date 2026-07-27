-- 0012 — Report aggregates over a date range
--
-- The Reports screen fetched every row in the chosen period and added it up in
-- the browser. PostgREST returns at most 1000 rows by default, so a report
-- covering a real year of trading added up a fraction of the data and printed
-- a total that was too low, with nothing to indicate it.
--
-- That is the worst place in the product for this bug. A dashboard figure that
-- looks off invites a second look; a report is printed, sent on, and acted on.
--
-- 0011 already covers finance, warehouse and safety over a date range. This
-- adds the three it did not: fleet trips, stock movements and attendance.
--
-- Same rules as 0011 — filtered on auth_company_id(), SECURITY INVOKER, so
-- row-level security still applies.
--
-- Safe to re-run.

begin;

do $$
begin
  if to_regproc('public.auth_company_id') is null then
    raise exception 'auth_company_id() is missing — apply 0001 first';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Fleet trips in a period
-- ---------------------------------------------------------------------------
create or replace function fleet_trip_totals(p_from date default null, p_to date default null)
returns table (
  trip_count   bigint,
  total_miles  numeric,
  total_fuel   numeric
)
language sql
stable
as $$
  select
    count(*),
    coalesce(sum(miles_driven), 0),
    coalesce(sum(fuel_used), 0)
  from fleet_trip
  where company_id = auth_company_id()
    and (p_from is null or date >= p_from)
    and (p_to   is null or date <= p_to);
$$;

-- ---------------------------------------------------------------------------
-- Stock movements in a period
-- ---------------------------------------------------------------------------
create or replace function inventory_movement_totals(p_from date default null, p_to date default null)
returns table (
  movement_count  bigint,
  units_in        bigint,
  units_out       bigint,
  net_change      bigint
)
language sql
stable
as $$
  select
    count(*),
    coalesce(sum(quantity) filter (where type = 'inbound'), 0),
    coalesce(sum(quantity) filter (where type = 'outbound'), 0),
    coalesce(sum(quantity) filter (where type = 'inbound'), 0)
      - coalesce(sum(quantity) filter (where type = 'outbound'), 0)
  from inventory_movement
  where company_id = auth_company_id()
    and (p_from is null or date >= p_from)
    and (p_to   is null or date <= p_to);
$$;

-- ---------------------------------------------------------------------------
-- Attendance in a period
-- ---------------------------------------------------------------------------
create or replace function hr_attendance_totals(p_from date default null, p_to date default null)
returns table (
  record_count  bigint,
  present       bigint,
  absent        bigint,
  late          bigint,
  on_leave      bigint,
  hours_worked  numeric
)
language sql
stable
as $$
  select
    count(*),
    count(*) filter (where status in ('present', 'remote')),
    count(*) filter (where status = 'absent'),
    count(*) filter (where status = 'late'),
    count(*) filter (where status = 'leave'),
    coalesce(sum(hours_worked), 0)
  from hr_attendance
  where company_id = auth_company_id()
    and (p_from is null or date >= p_from)
    and (p_to   is null or date <= p_to);
$$;

commit;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
select p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('fleet_trip_totals', 'inventory_movement_totals', 'hr_attendance_totals')
order by p.proname;
-- Expect 3 rows.

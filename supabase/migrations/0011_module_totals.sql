-- 0011 — Module totals, computed in the database
--
-- Every page currently derives its headline figures by fetching rows and
-- summing them in the browser. That is correct while a tenant is small and
-- silently wrong once it is not: PostgREST caps a request at 1000 rows by
-- default, so past that the page returns the first 1000, sums those, and
-- displays a total that is simply too low. No error, no warning.
--
-- A stock valuation that is wrong and looks fine is worse than one that
-- fails, so the totals move here. Correct at any volume, one round trip,
-- and the page can then paginate freely without its numbers moving.
--
-- Every function filters on auth_company_id() and is SECURITY INVOKER (the
-- default), so RLS on the underlying tables still applies. A caller cannot
-- reach another tenant's rows through these any more than through a select.
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
-- Inventory
-- ---------------------------------------------------------------------------
create or replace function inventory_totals()
returns table (
  sku_count        bigint,
  units_on_hand    bigint,
  units_reserved   bigint,
  stock_value      numeric,
  low_stock_count  bigint,
  out_of_stock     bigint
)
language sql
stable
as $$
  select
    count(*),
    coalesce(sum(quantity_on_hand), 0),
    coalesce(sum(quantity_reserved), 0),
    coalesce(sum(quantity_on_hand * coalesce(unit_cost, 0)), 0),
    count(*) filter (where quantity_on_hand <= reorder_level and quantity_on_hand > 0),
    count(*) filter (where quantity_on_hand <= 0)
  from inventory_sku
  where company_id = auth_company_id();
$$;

-- ---------------------------------------------------------------------------
-- Fleet
-- ---------------------------------------------------------------------------
create or replace function fleet_totals()
returns table (
  vehicle_count      bigint,
  active_count       bigint,
  in_maintenance     bigint,
  total_mileage      bigint,
  completed_trips    bigint,
  total_miles        numeric,
  total_fuel         numeric
)
language sql
stable
as $$
  select
    (select count(*) from fleet_vehicle where company_id = auth_company_id()),
    (select count(*) from fleet_vehicle where company_id = auth_company_id() and status = 'active'),
    (select count(*) from fleet_vehicle where company_id = auth_company_id() and status = 'maintenance'),
    (select coalesce(sum(mileage), 0) from fleet_vehicle where company_id = auth_company_id()),
    (select count(*) from fleet_trip where company_id = auth_company_id() and status = 'completed'),
    (select coalesce(sum(miles_driven), 0) from fleet_trip where company_id = auth_company_id() and status = 'completed'),
    (select coalesce(sum(fuel_used), 0) from fleet_trip where company_id = auth_company_id() and status = 'completed');
$$;

-- Maintenance arrives in 0010. Kept separate so this migration still applies
-- if 0010 has not been run yet.
do $$
begin
  if to_regclass('public.fleet_maintenance') is null then
    raise notice 'fleet_maintenance not present — skipping maintenance_totals (apply 0010 first)';
  else
    execute $fn$
      create or replace function maintenance_totals()
      returns table (
        total_jobs      bigint,
        open_jobs       bigint,
        overdue_jobs    bigint,
        completed_jobs  bigint,
        total_spend     numeric
      )
      language sql
      stable
      as $inner$
        select
          count(*),
          count(*) filter (where status in ('scheduled', 'in_progress')),
          count(*) filter (where status in ('scheduled', 'in_progress')
                             and scheduled_date is not null
                             and scheduled_date < current_date),
          count(*) filter (where status = 'completed'),
          coalesce(sum(cost) filter (where status = 'completed'), 0)
        from fleet_maintenance
        where company_id = auth_company_id();
      $inner$;
    $fn$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------------
-- p_from / p_to are optional. Null means "all time".
create or replace function finance_totals(p_from date default null, p_to date default null)
returns table (
  cost_center_count  bigint,
  revenue            numeric,
  expense            numeric,
  net                numeric,
  transaction_count  bigint
)
language sql
stable
as $$
  select
    (select count(*) from finance_cost_center where company_id = auth_company_id()),
    coalesce(sum(amount) filter (where type = 'revenue'), 0),
    coalesce(sum(amount) filter (where type = 'expense'), 0),
    coalesce(sum(amount) filter (where type = 'revenue'), 0)
      - coalesce(sum(amount) filter (where type = 'expense'), 0),
    count(*)
  from finance_transaction
  where company_id = auth_company_id()
    and (p_from is null or date >= p_from)
    and (p_to   is null or date <= p_to);
$$;

-- ---------------------------------------------------------------------------
-- Workforce
-- ---------------------------------------------------------------------------
create or replace function hr_totals(p_period text default null)
returns table (
  department_count  bigint,
  headcount         bigint,
  active_count      bigint,
  review_count      bigint,
  avg_rating        numeric,
  unreviewed        bigint
)
language sql
stable
as $$
  select
    (select count(*) from hr_department where company_id = auth_company_id()),
    (select count(*) from hr_employee   where company_id = auth_company_id()),
    (select count(*) from hr_employee   where company_id = auth_company_id() and status = 'active'),
    (select count(*) from hr_performance where company_id = auth_company_id()),
    (select round(avg(rating), 2) from hr_performance where company_id = auth_company_id()),
    -- Active employees with no review for the period asked about.
    (select count(*) from hr_employee e
      where e.company_id = auth_company_id()
        and e.status = 'active'
        and p_period is not null
        and not exists (
          select 1 from hr_performance p
          where p.employee_id = e.id and p.period = p_period
        ));
$$;

-- ---------------------------------------------------------------------------
-- Warehouse
-- ---------------------------------------------------------------------------
create or replace function warehouse_totals(p_from date default null, p_to date default null)
returns table (
  site_count        bigint,
  shifts_recorded   bigint,
  orders_processed  bigint,
  orders_pending    bigint,
  avg_productivity  numeric,
  avg_dock_util     numeric
)
language sql
stable
as $$
  select
    (select count(*) from warehouse_site where company_id = auth_company_id()),
    count(*),
    coalesce(sum(orders_processed), 0),
    coalesce(sum(orders_pending), 0),
    round(avg(productivity_pct), 2),
    round(avg(dock_utilization_pct), 2)
  from warehouse_snapshot
  where company_id = auth_company_id()
    and (p_from is null or date >= p_from)
    and (p_to   is null or date <= p_to);
$$;

-- ---------------------------------------------------------------------------
-- Safety
-- ---------------------------------------------------------------------------
create or replace function safety_totals(p_from date default null, p_to date default null)
returns table (
  incident_count   bigint,
  open_incidents   bigint,
  critical_count   bigint,
  high_count       bigint,
  medium_count     bigint,
  low_count        bigint
)
language sql
stable
as $$
  select
    count(*),
    count(*) filter (where status <> 'resolved'),
    count(*) filter (where severity = 'critical'),
    count(*) filter (where severity = 'high'),
    count(*) filter (where severity = 'medium'),
    count(*) filter (where severity = 'low')
  from safety_incident
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
  and p.proname in (
    'inventory_totals','fleet_totals','maintenance_totals','finance_totals',
    'hr_totals','warehouse_totals','safety_totals'
  )
order by p.proname;
-- Expect 7 rows (6 if 0010 has not been applied).

-- 0016 — Guardian check 2: capacity clash
--
-- The first check reads one module. This one reads two, and that is the whole
-- point of it.
--
-- A warehouse system knows its docks are busy. A fleet system knows which
-- vehicles are booked in for service on Thursday. Neither knows the other
-- exists, so nobody joins them — until Thursday, when a depot runs short of
-- vehicles on its busiest week and somebody spends the afternoon firefighting
-- and calls it bad luck.
--
-- It was not bad luck. It was visible days earlier, in two systems that do not
-- talk to each other.
--
-- WHAT IS FACT AND WHAT IS JUDGEMENT
--
-- Fact:      these vehicles ran from this depot; these vehicles are booked off
--            the road; this many of them on the same day.
-- Judgement: whether the depot is under enough pressure for that to matter.
--
-- The fact side is the trigger. The pressure side only moves the severity up
-- or down. That ordering is deliberate — a finding built on a judgement call
-- is one an operations manager is right to ignore.
--
-- Pressure is measured against each site's own recent history rather than a
-- fixed percentage. A depot that sits at 92% every week of the year is not
-- news; a fixed threshold would flag it every single day and be switched off
-- within a fortnight. What matters is a site running hotter than it normally
-- does.
--
-- Safe to re-run.

begin;

do $$
begin
  if to_regproc('public.guardian_run_all') is null then
    raise exception 'guardian_run_all() is missing — apply 0015 first';
  end if;
  if to_regclass('public.fleet_maintenance') is null then
    raise exception 'fleet_maintenance does not exist — apply 0010 first';
  end if;
  if to_regclass('public.warehouse_snapshot') is null then
    raise exception 'warehouse_snapshot does not exist — apply 0002 first';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Check 2 — capacity clash
--
-- p_recent     days counted as "now"
-- p_baseline   days of history "now" is compared against
-- p_horizon    how far ahead maintenance bookings are looked at
-- p_busy_pct   dock utilisation treated as near capacity in absolute terms
-- p_min_fleet  smallest site fleet worth measuring a share of
--
-- The floor matters. At two vehicles, one routine service is "50% of the fleet
-- off the road", which is arithmetically true and useless — the person running
-- a two-van depot already knows. Findings are for what is not obvious.
-- ---------------------------------------------------------------------------
create or replace function guardian_check_capacity_clash(
  p_recent    integer default 7,
  p_baseline  integer default 28,
  p_horizon   integer default 14,
  p_busy_pct  numeric default 85,
  p_min_fleet integer default 3
)
returns integer
language plpgsql
security invoker
as $$
declare
  v_company uuid := auth_company_id();
  v_found   integer := 0;
begin
  if v_company is null then
    return 0;
  end if;

  with
  -- How each site has been running this week.
  recent as (
    select
      s.site_id,
      round(avg(s.dock_utilization_pct), 0) as dock_now,
      round(avg(s.orders_pending), 0)       as pending_now,
      round(avg(s.orders_processed), 0)     as orders_per_day
    from warehouse_snapshot s
    where s.company_id = v_company
      and s.date >= current_date - p_recent
    group by s.site_id
  ),
  -- How it has been running the rest of the month, for comparison.
  base as (
    select
      s.site_id,
      round(avg(s.dock_utilization_pct), 0) as dock_before,
      round(avg(s.orders_pending), 0)       as pending_before
    from warehouse_snapshot s
    where s.company_id = v_company
      and s.date >= current_date - p_baseline
      and s.date <  current_date - p_recent
    group by s.site_id
  ),
  -- Which vehicles serve which site.
  --
  -- Nothing records this. It is inferred from where trips actually started,
  -- which is the only honest source available and is stated as an inference in
  -- the evidence. A depot field on the vehicle would be better and is the
  -- obvious thing to capture next.
  serving as (
    select distinct t.vehicle_id, w.id as site_id
    from fleet_trip t
    join warehouse_site w
      on w.company_id = t.company_id
     and w.name = t.origin
    where t.company_id = v_company
      and t.date >= current_date - 30
  ),
  fleet_size as (
    select site_id, count(*)::numeric as vehicles
    from serving
    group by site_id
  ),
  -- Vehicles about to come off the road.
  booked as (
    select distinct sv.site_id, m.vehicle_id, m.scheduled_date
    from fleet_maintenance m
    join serving sv on sv.vehicle_id = m.vehicle_id
    where m.company_id = v_company
      and m.status in ('scheduled', 'in_progress')
      and m.scheduled_date is not null
      and m.scheduled_date >= current_date
      and m.scheduled_date <= current_date + p_horizon
  ),
  booked_total as (
    select site_id, count(distinct vehicle_id)::numeric as off_road
    from booked
    group by site_id
  ),
  -- The single worst day: the most vehicles gone at once. This is the detail
  -- that makes the finding actionable, because moving one booking fixes it.
  by_day as (
    select site_id, scheduled_date, count(distinct vehicle_id)::int as n
    from booked
    group by site_id, scheduled_date
  ),
  worst as (
    select distinct on (site_id) site_id, scheduled_date, n
    from by_day
    order by site_id, n desc, scheduled_date
  ),
  joined as (
    select
      w.id  as site_id,
      w.name as site_name,
      r.dock_now,
      r.pending_now,
      r.orders_per_day,
      b.dock_before,
      b.pending_before,
      f.vehicles,
      bt.off_road,
      wd.scheduled_date as worst_date,
      wd.n              as worst_n,
      -- Severity is driven by how many go at once, not by the total across the
      -- fortnight. Four services spread over two weeks is planning working;
      -- three on one Thursday is a depot short of vehicles on a Thursday.
      round(wd.n / f.vehicles * 100, 0) as clash_pct,
      round(bt.off_road / f.vehicles * 100, 0) as horizon_pct,
      (r.dock_now - b.dock_before) as dock_shift,
      round((r.pending_now - b.pending_before)
              / nullif(b.pending_before, 0) * 100, 0) as pending_shift_pct
    from warehouse_site w
    join recent      r  on r.site_id  = w.id
    join base        b  on b.site_id  = w.id
    join fleet_size  f  on f.site_id  = w.id
    join booked_total bt on bt.site_id = w.id
    join worst       wd on wd.site_id = w.id
    where w.company_id = v_company
      and f.vehicles >= p_min_fleet
  ),
  scored as (
    select
      j.*,
      -- Running hotter than it normally does, or genuinely near capacity.
      (j.dock_now >= p_busy_pct
        or j.dock_shift >= 4
        or coalesce(j.pending_shift_pct, 0) >= 20) as pressured
    from joined j
  ),
  graded as (
    select
      s.*,
      case
        when s.clash_pct >= 33 and s.pressured then 'critical'
        when s.clash_pct >= 40                 then 'high'
        when s.clash_pct >= 25 and s.pressured then 'high'
        when s.clash_pct >= 25                 then 'medium'
        when s.clash_pct >= 15 and s.pressured then 'medium'
        else null
      end as severity
    from scored s
  )
  insert into guardian_finding as f (
    company_id, check_id, severity, title, detail, modules,
    entity_type, entity_id, entity_label, evidence, recommendation, status
  )
  select
    v_company,
    'capacity_clash',
    g.severity,
    g.site_name || ' loses ' || g.worst_n || ' of ' || g.vehicles::int ||
      ' vehicles on ' || trim(to_char(g.worst_date, 'FMDay')),
    g.vehicles::int || ' vehicles have been running from ' || g.site_name ||
      '. ' || g.worst_n ||
      case when g.worst_n = 1 then ' of them is' else ' of them are' end ||
      ' booked in for service on ' ||
      trim(to_char(g.worst_date, 'FMDay DD Mon')) || ' — ' || g.clash_pct ||
      '% of the site''s vehicles gone on one day' ||
      case when g.off_road::int > g.worst_n
           then ', ' || g.off_road::int || ' across the next ' || p_horizon || ' days.'
           else '.' end || ' ' ||
      case
        when g.dock_shift >= 4 then
          'Dock use at this site has risen from ' || g.dock_before || '% to ' ||
          g.dock_now || '% over the same period.'
        when coalesce(g.pending_shift_pct, 0) >= 20 then
          'Orders waiting at this site are up ' || g.pending_shift_pct ||
          '% on the previous few weeks.'
        when g.dock_now >= p_busy_pct then
          'The site is already running at ' || g.dock_now || '% dock use.'
        else
          'The site is running at ' || g.dock_now || '% dock use, in line with usual.'
      end ||
      ' It handles about ' || g.orders_per_day || ' orders a day.',
    array['warehouse', 'fleet'],
    'warehouse_site',
    g.site_id,
    g.site_name,
    jsonb_build_object(
      'site_name',              g.site_name,
      'vehicles_serving',       g.vehicles::int,
      'worst_day',              trim(to_char(g.worst_date, 'FMDay DD Mon')),
      'worst_day_vehicles',     g.worst_n,
      'share_gone_pct',         g.clash_pct,
      'vehicles_booked_out',    g.off_road::int,
      'share_horizon_pct',      g.horizon_pct,
      'days_until',             (g.worst_date - current_date),
      'horizon_days',           p_horizon,
      'dock_utilization_now',   g.dock_now,
      'dock_utilization_before', g.dock_before,
      'orders_pending_now',     g.pending_now,
      'orders_pending_before',  g.pending_before,
      'orders_per_day',         g.orders_per_day,
      'days_recent',            p_recent,
      'days_baseline',          p_baseline,
      'link_source',            'inferred from where trips started — no depot is recorded against a vehicle'
    ),
    case when g.worst_n = 1
      then 'Move the ' || trim(to_char(g.worst_date, 'FMDay')) ||
           ' booking to a quieter day, or bring a vehicle across from another site for that day.'
      else 'Move ' || (g.worst_n - 1) || ' of the ' || trim(to_char(g.worst_date, 'FMDay')) ||
           ' bookings to a quieter day, or bring vehicles across from another site for that day.'
    end,
    'open'
  from graded g
  where g.severity is not null
  on conflict (company_id, check_id, entity_type, entity_id) do update
    set severity       = excluded.severity,
        title          = excluded.title,
        detail         = excluded.detail,
        evidence       = excluded.evidence,
        recommendation = excluded.recommendation,
        last_seen_at   = now(),
        status         = case when f.status = 'resolved' then 'open' else f.status end;

  get diagnostics v_found = row_count;

  -- Anything this check raised before and no longer holds is closed out.
  update guardian_finding
     set status = 'expired'
   where company_id = v_company
     and check_id = 'capacity_clash'
     and status = 'open'
     and last_seen_at < now() - interval '1 minute';

  return v_found;
end $$;

-- Add it to the run. Rewritten in full rather than patched, so the list of
-- checks is readable in one place.
create or replace function guardian_run_all()
returns integer
language plpgsql
security invoker
as $$
declare
  v_total integer := 0;
begin
  v_total := v_total + guardian_check_stockout();
  v_total := v_total + guardian_check_capacity_clash();
  return v_total;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'guardian_check_capacity_clash')              as check_created,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'guardian_%')                              as guardian_functions;
-- Expect: 1, 3
--
-- Then run everything and look at what the two-module check found:
--
--   select guardian_run_all();
--
--   select severity, title, detail
--   from guardian_finding
--   where check_id = 'capacity_clash' and status = 'open'
--   order by (evidence->>'share_gone_pct')::numeric desc;
--
-- If it finds nothing, that is a real answer and not a failure. To see what it
-- looked at and how close each site came:
--
--   select w.name,
--          (select count(distinct t.vehicle_id) from fleet_trip t
--            where t.origin = w.name and t.company_id = w.company_id
--              and t.date >= current_date - 30)                    as vehicles,
--          (select round(avg(s.dock_utilization_pct))
--             from warehouse_snapshot s
--            where s.site_id = w.id and s.date >= current_date - 7) as dock_now
--   from warehouse_site w
--   where w.company_id = (select company_id from app_user
--                          where id = auth.uid());

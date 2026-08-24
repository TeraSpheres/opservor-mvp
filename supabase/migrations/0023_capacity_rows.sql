-- 0023 — capacity analysis, split out of the check. Run 0022 first, then 0024.

create or replace function guardian_capacity_rows(
  p_recent    integer default 7,
  p_baseline  integer default 28,
  p_horizon   integer default 14,
  p_busy_pct  numeric default 85,
  p_min_fleet integer default 3
)
returns table (
  site_id uuid, site_name text, vehicles numeric, off_road numeric,
  worst_date date, worst_n integer, clash_pct numeric, horizon_pct numeric,
  dock_now numeric, dock_before numeric, pending_now numeric, pending_before numeric,
  orders_per_day numeric, dock_shift numeric, pending_shift_pct numeric,
  severity text, link_source text)
language sql
security invoker
set search_path = public, pg_temp
as $$
  with
  serving as (select * from guardian_serving_map()),
  fleet_size as (
    select s.site_id, count(*)::numeric as vehicles,
      case when bool_or(s.source = 'depot') then 'depot recorded against the vehicle'
        else 'inferred from where trips started' end as link_source
      from serving s group by s.site_id
  ),
  recent as (
    select s.site_id,
      round(avg(s.dock_utilization_pct), 0) as dock_now,
      round(avg(s.orders_pending), 0)       as pending_now,
      round(avg(s.orders_processed), 0)     as orders_per_day
      from warehouse_snapshot s
     where s.company_id = auth_company_id()
    and s.date >= current_date - p_recent
     group by s.site_id
  ),
  base as (
    select s.site_id,
      round(avg(s.dock_utilization_pct), 0) as dock_before,
      round(avg(s.orders_pending), 0)       as pending_before
      from warehouse_snapshot s
     where s.company_id = auth_company_id()
    and s.date >= current_date - p_baseline
    and s.date <  current_date - p_recent
     group by s.site_id
  ),
  booked as (
    select distinct sv.site_id, m.vehicle_id, m.scheduled_date
      from fleet_maintenance m
      join serving sv on sv.vehicle_id = m.vehicle_id
     where m.company_id = auth_company_id()
    and m.status in ('scheduled', 'in_progress')
    and m.scheduled_date between current_date and current_date + p_horizon
  ),
  booked_total as (
    select b.site_id, count(distinct b.vehicle_id)::numeric as off_road
      from booked b group by b.site_id
  ),
  by_day as (
    select b.site_id, b.scheduled_date, count(distinct b.vehicle_id)::int as n
      from booked b group by b.site_id, b.scheduled_date
  ),
  worst as (
    select distinct on (d.site_id) d.site_id, d.scheduled_date, d.n
      from by_day d order by d.site_id, d.n desc, d.scheduled_date
  ),
  joined as (
    select w.id as site_id, w.name as site_name, f.vehicles, bt.off_road,
      wd.scheduled_date as worst_date, wd.n as worst_n,
      round(wd.n / f.vehicles * 100, 0)      as clash_pct,
      round(bt.off_road / f.vehicles * 100, 0) as horizon_pct,
      r.dock_now, b.dock_before, r.pending_now, b.pending_before,
      r.orders_per_day,
      (r.dock_now - b.dock_before) as dock_shift,
      round((r.pending_now - b.pending_before)
         / nullif(b.pending_before, 0) * 100, 0) as pending_shift_pct,
      f.link_source
      from warehouse_site w
      join recent r        on r.site_id  = w.id
      join base b          on b.site_id  = w.id
      join fleet_size f    on f.site_id  = w.id
      join booked_total bt on bt.site_id = w.id
      join worst wd        on wd.site_id = w.id
     where w.company_id = auth_company_id()
    and f.vehicles >= p_min_fleet
  ),
  scored as (
    select j.*, (j.dock_now >= p_busy_pct or j.dock_shift >= 4
         or coalesce(j.pending_shift_pct, 0) >= 20) as pressured
      from joined j
  )
  select s.site_id, s.site_name, s.vehicles, s.off_road, s.worst_date, s.worst_n,
     s.clash_pct, s.horizon_pct, s.dock_now, s.dock_before, s.pending_now,
     s.pending_before, s.orders_per_day, s.dock_shift, s.pending_shift_pct,
     case
      when s.clash_pct >= 33 and s.pressured then 'critical'
      when s.clash_pct >= 40                 then 'high'
      when s.clash_pct >= 25 and s.pressured then 'high'
      when s.clash_pct >= 25                 then 'medium'
      when s.clash_pct >= 15 and s.pressured then 'medium'
      else null
     end as severity,
     s.link_source
    from scored s;
$$;

select to_regproc('public.guardian_capacity_rows') is not null as created;

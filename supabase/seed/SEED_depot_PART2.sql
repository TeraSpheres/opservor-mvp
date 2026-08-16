-- FILM 01 — Calgary Depot, part 2 of 2: the clash and the dock figures.
-- Run PART1 first. Safe to re-run.

delete from fleet_maintenance where reference like 'FILM01-%';

-- Two of the six off the road on the same upcoming Thursday, at least two days
-- out — a booking you can still move, which is the point of the finding.
insert into fleet_maintenance (company_id, vehicle_id, type, status, priority,
                               scheduled_date, reference, vendor, notes)
select v.company_id, v.id,
       case v.name when 'Calgary Van 1' then 'Scheduled service' else 'Brake inspection' end,
       'scheduled', 'routine',
       (select min(d)::date
          from generate_series(current_date + 2, current_date + 13, interval '1 day') d
         where extract(isodow from d) = 4),
       case v.name when 'Calgary Van 1' then 'FILM01-A' else 'FILM01-B' end,
       'Bow Valley Commercial',
       'Booked weeks ago, by a different person, on a different system.'
from app_user c
join fleet_vehicle v on v.company_id = c.company_id
where c.email = 'ahsan.ahmad1@gmail.com'
  and v.name in ('Calgary Van 1', 'Calgary Van 2');

delete from warehouse_snapshot s
 using warehouse_site w
 where w.id = s.site_id and w.name = 'Calgary Depot'
   and s.date >= current_date - 28;

-- Busy this week, calmer before it: near capacity and getting worse.
insert into warehouse_snapshot (company_id, site_id, date, shift, productivity_pct,
                                orders_processed, orders_pending, dock_utilization_pct)
select w.company_id, w.id, current_date - d, 'all',
       case when d <= 6 then 86 else 88 end,
       3100 + (d * 13),
       case when d <= 6 then 48 + d else 40 + (d % 6) end,
       case when d <= 6 then 94 else 88 end
from generate_series(0, 27) as d
join warehouse_site w on w.name = 'Calgary Depot';

-- Expect: 2 · 94 · 88
select
  (select count(*) from fleet_maintenance
    where reference like 'FILM01-%'
      and scheduled_date between current_date and current_date + 14) as off_road_that_day,
  (select round(avg(s.dock_utilization_pct)) from warehouse_snapshot s
     join warehouse_site w on w.id = s.site_id
    where w.name = 'Calgary Depot' and s.date >= current_date - 7)   as dock_now,
  (select round(avg(s.dock_utilization_pct)) from warehouse_snapshot s
     join warehouse_site w on w.id = s.site_id
    where w.name = 'Calgary Depot'
      and s.date >= current_date - 28 and s.date < current_date - 7) as dock_before;

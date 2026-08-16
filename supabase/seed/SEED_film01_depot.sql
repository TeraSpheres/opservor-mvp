-- FILM 01 — Calgary Depot, so the capacity finding can exist
--
-- Seven plain statements. No DO block, no $$ quoting. Each is safe to re-run.
--
-- The check works out which vehicles serve which site by matching a trip's
-- starting point against a site's name, exactly. Nothing in the demo data
-- matched, so the check has been returning nothing without a word. This gives
-- it a depot where the match succeeds.
--
-- Produces, once you press Run checks:
--   Calgary Depot loses 2 of 6 vehicles on <Thursday>   (critical · warehouse · fleet)
--   Dock utilisation 88% -> 94% · capacity reduction 33%
--
-- 2 of 6 is 33%, which is exactly the critical threshold and also what two
-- vans out of six actually costs a depot.


-- 1 of 7 — the site
insert into warehouse_site (company_id, name, location)
select (select company_id from app_user where email = 'ahsan.ahmad1@gmail.com'),
       'Calgary Depot', 'Calgary, Alberta'
where not exists (
  select 1 from warehouse_site
   where company_id = (select company_id from app_user where email = 'ahsan.ahmad1@gmail.com')
     and name = 'Calgary Depot');


-- 2 of 7 — six vehicles
insert into fleet_vehicle (company_id, name, type, status, license_plate, fuel_type, purchase_date)
select (select company_id from app_user where email = 'ahsan.ahmad1@gmail.com'),
       'Calgary Van ' || i, 'Delivery van', 'active',
       'DEMO-CG' || lpad(i::text, 2, '0'), 'Diesel', current_date - 600
from generate_series(1, 6) as i
where not exists (
  select 1 from fleet_vehicle
   where company_id = (select company_id from app_user where email = 'ahsan.ahmad1@gmail.com')
     and name = 'Calgary Van ' || i);


-- 3 of 7 — clear this depot's trips, so re-running cannot pile up duplicates
delete from fleet_trip
 where company_id = (select company_id from app_user where email = 'ahsan.ahmad1@gmail.com')
   and origin = 'Calgary Depot';


-- 4 of 7 — trips starting at the depot. This is the only thing that tells the
-- check these six vehicles belong to this site.
insert into fleet_trip (company_id, vehicle_id, date, miles_driven, fuel_used, origin, destination, status)
select
  v.company_id,
  v.id,
  current_date - d,
  60 + (d % 40),
  6 + (d % 5),
  'Calgary Depot',
  case d % 3 when 0 then 'Red Deer' when 1 then 'Airdrie' else 'Okotoks' end,
  'completed'
from generate_series(0, 29) as d
join fleet_vehicle v
  on v.company_id = (select company_id from app_user where email = 'ahsan.ahmad1@gmail.com')
 and v.name = 'Calgary Van ' || ((d % 6) + 1);


-- 5 of 7 — two of the six off the road on the same upcoming Thursday.
-- At least two days out, so the finding reads as a booking you can still move
-- rather than a crisis. That is the whole point of it.
delete from fleet_maintenance
 where company_id = (select company_id from app_user where email = 'ahsan.ahmad1@gmail.com')
   and reference like 'FILM01-%';

insert into fleet_maintenance (company_id, vehicle_id, type, status, priority, scheduled_date, reference, vendor, notes)
select
  v.company_id,
  v.id,
  case v.name when 'Calgary Van 1' then 'Scheduled service' else 'Brake inspection' end,
  'scheduled',
  'routine',
  (select min(d)::date from generate_series(current_date + 2, current_date + 13, interval '1 day') d
    where extract(isodow from d) = 4),
  case v.name when 'Calgary Van 1' then 'FILM01-A' else 'FILM01-B' end,
  'Bow Valley Commercial',
  'Booked weeks ago, by a different person, on a different system.'
from fleet_vehicle v
where v.company_id = (select company_id from app_user where email = 'ahsan.ahmad1@gmail.com')
  and v.name in ('Calgary Van 1', 'Calgary Van 2');


-- 6 of 7 — clear this site's recent dock figures
delete from warehouse_snapshot
 where site_id = (select id from warehouse_site
                   where company_id = (select company_id from app_user where email = 'ahsan.ahmad1@gmail.com')
                     and name = 'Calgary Depot')
   and date >= current_date - 28;


-- 7 of 7 — busy this week, calmer before it, so the site reads as both near
-- capacity and getting worse. Either one alone counts as pressured; this has both.
insert into warehouse_snapshot (company_id, site_id, date, shift, productivity_pct,
                                orders_processed, orders_pending, dock_utilization_pct)
select w.company_id, w.id, current_date - d, 'all',
       case when d <= 6 then 86 else 88 end,
       3100 + (d * 13),
       case when d <= 6 then 48 + d else 40 + (d % 6) end,
       case when d <= 6 then 94 else 88 end
from generate_series(0, 27) as d
join warehouse_site w
  on w.company_id = (select company_id from app_user where email = 'ahsan.ahmad1@gmail.com')
 and w.name = 'Calgary Depot';


-- Verify — the four things the check needs
select
  (select count(distinct t.vehicle_id) from fleet_trip t
     join warehouse_site w on w.company_id = t.company_id and w.name = t.origin
    where w.name = 'Calgary Depot' and t.date >= current_date - 30)          as vehicles_serving,
  (select count(*) from fleet_maintenance
    where reference like 'FILM01-%'
      and scheduled_date between current_date and current_date + 14)          as off_road_that_day,
  (select round(avg(dock_utilization_pct)) from warehouse_snapshot s
     join warehouse_site w on w.id = s.site_id
    where w.name = 'Calgary Depot' and s.date >= current_date - 7)            as dock_now,
  (select round(avg(dock_utilization_pct)) from warehouse_snapshot s
     join warehouse_site w on w.id = s.site_id
    where w.name = 'Calgary Depot'
      and s.date >= current_date - 28 and s.date < current_date - 7)          as dock_before;

-- Expect: 6 · 2 · 94 · 88
-- Any zero there means the check will stay silent, and will now say so.

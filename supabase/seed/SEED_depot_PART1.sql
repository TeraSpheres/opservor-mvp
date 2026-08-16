-- FILM 01 — Calgary Depot, part 1 of 2: the site, the vans, the trips.
-- Run this whole file, then run PART2. Safe to re-run.

insert into warehouse_site (company_id, name, location)
select c.company_id, 'Calgary Depot', 'Calgary, Alberta'
from app_user c
where c.email = 'ahsan.ahmad1@gmail.com'
  and not exists (select 1 from warehouse_site w
                   where w.company_id = c.company_id and w.name = 'Calgary Depot');

insert into fleet_vehicle (company_id, name, type, status, license_plate, fuel_type, purchase_date)
select c.company_id, 'Calgary Van ' || i, 'Delivery van', 'active',
       'DEMO-CG' || lpad(i::text, 2, '0'), 'Diesel', current_date - 600
from app_user c, generate_series(1, 6) as i
where c.email = 'ahsan.ahmad1@gmail.com'
  and not exists (select 1 from fleet_vehicle v
                   where v.company_id = c.company_id and v.name = 'Calgary Van ' || i);

-- Rebuilt each run, so re-seeding cannot pile up duplicate journeys.
delete from fleet_trip
 where origin = 'Calgary Depot';

-- The only thing that tells the check these six vans belong to this depot is
-- that their journeys started there, spelled exactly as the site is named.
insert into fleet_trip (company_id, vehicle_id, date, miles_driven, fuel_used,
                        origin, destination, status)
select v.company_id, v.id, current_date - d, 60 + (d % 40), 6 + (d % 5),
       'Calgary Depot',
       case d % 3 when 0 then 'Red Deer' when 1 then 'Airdrie' else 'Okotoks' end,
       'completed'
from generate_series(0, 29) as d
join app_user c on c.email = 'ahsan.ahmad1@gmail.com'
join fleet_vehicle v on v.company_id = c.company_id
 and v.name = 'Calgary Van ' || ((d % 6) + 1);

-- Check before moving on: expect 6.
select count(distinct t.vehicle_id) as vehicles_serving
from fleet_trip t
join warehouse_site w on w.company_id = t.company_id and w.name = t.origin
where w.name = 'Calgary Depot' and t.date >= current_date - 30;

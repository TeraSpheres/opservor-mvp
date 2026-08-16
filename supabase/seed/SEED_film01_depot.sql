-- FILM 01 — make the Calgary Depot capacity clash real
--
-- WHY
--
-- Shot 13 shows a Guardian finding that the product cannot currently produce.
-- Not because the check is broken, but because it has nothing to work with:
-- it infers which vehicles serve which site by matching a trip's starting
-- point against a warehouse site's name, exactly --
--
--     join warehouse_site w on w.company_id = t.company_id and w.name = t.origin
--
-- -- and no demo trip origin matches any demo site name. So no site has a
-- fleet, and the check returns zero without a word. That is the silence
-- migration 0021 now reports on the Guardian screen.
--
-- This seeds a depot where the join succeeds, so the check runs and produces
-- the finding by itself.
--
-- WHAT IT PRODUCES
--
--   critical · warehouse · fleet
--   Calgary Depot loses 2 of 6 vehicles on <Thursday>
--   Fleet available 6 · Maintenance that day 2 · Capacity reduction 33%
--   Dock utilisation 88% -> 94%
--   Recommended: move one booking to a quieter day, or bring vehicles from
--   another site.
--
-- HOW THOSE NUMBERS ARE REACHED
--
--   6 vehicles with trips starting at "Calgary Depot" in the last 30 days
--   2 of them booked for service on the same upcoming Thursday
--   round(2 / 6 * 100) = 33  -> clash_pct meets the critical threshold of 33
--   dock utilisation 94 in the last 7 days, 88 in the 21 before it
--     -> 94 >= 85 busy threshold, and a +6 shift, either of which counts as
--        pressured. Critical needs clash_pct >= 33 AND pressured, so this
--        clears it twice over.
--
-- A NOTE ON WHAT THIS DOES NOT FIX
--
-- Making the demo data match the join is not the same as fixing the join. A
-- real customer whose trips carry street addresses instead of depot names
-- still gets nothing from this check. The proper fix is a depot field on the
-- vehicle so the mapping is recorded rather than guessed at from text, and
-- that remains outstanding.
--
-- Safe to re-run.

begin;

do $$
declare
  v_company  uuid;
  v_site     uuid;
  v_thursday date;
  v_ids      uuid[];
  v_id       uuid;
  i          integer;
begin
  select company_id into v_company from app_user order by created_at limit 1;

  if v_company is null then
    select c.id into v_company
      from company c
     order by (select count(*) from inventory_sku s where s.company_id = c.id) desc
     limit 1;
  end if;

  if v_company is null then
    raise exception 'No company found. Seed a demo company first.';
  end if;

  -- The next Thursday that is at least two days out and inside the check's
  -- 14-day horizon. Two days out so it never lands on today, which would read
  -- as a crisis rather than something still avoidable — the whole point of the
  -- finding is that there is time to move a booking.
  select d::date into v_thursday
    from generate_series(current_date + 2, current_date + 13, interval '1 day') d
   where extract(isodow from d) = 4
   order by d
   limit 1;

  if v_thursday is null then
    raise exception 'No Thursday inside the 14-day horizon — should be impossible.';
  end if;

  -- The site.
  select id into v_site
    from warehouse_site
   where company_id = v_company and name = 'Calgary Depot';

  if v_site is null then
    insert into warehouse_site (company_id, name, location)
    values (v_company, 'Calgary Depot', 'Calgary, Alberta')
    returning id into v_site;
  end if;

  -- Six vehicles that belong to this depot.
  v_ids := array[]::uuid[];
  for i in 1..6 loop
    select id into v_id
      from fleet_vehicle
     where company_id = v_company and name = 'Calgary Van ' || i;

    if v_id is null then
      insert into fleet_vehicle (company_id, name, type, status, license_plate, fuel_type, purchase_date)
      values (v_company, 'Calgary Van ' || i, 'Delivery van', 'active',
              'DEMO-CG' || lpad(i::text, 2, '0'), 'Diesel', current_date - 600)
      returning id into v_id;
    end if;

    v_ids := v_ids || v_id;
  end loop;

  -- Trips starting at the depot, which is the only thing that tells the check
  -- these six vehicles serve this site. Rebuilt each run so re-seeding cannot
  -- pile up duplicates.
  delete from fleet_trip
   where company_id = v_company
     and origin = 'Calgary Depot';

  insert into fleet_trip (company_id, vehicle_id, date, miles_driven, fuel_used, origin, destination, status)
  select
    v_company,
    v_ids[(d % 6) + 1],
    current_date - d,
    60 + (d % 40),
    6 + (d % 5),
    'Calgary Depot',
    case d % 3 when 0 then 'Red Deer' when 1 then 'Airdrie' else 'Okotoks' end,
    'completed'
  from generate_series(0, 29) as d;

  -- Two of the six off the road on the same Thursday. Two of six is 33%, which
  -- is exactly the critical threshold — and it is the honest number, because
  -- that is what two vans out of six actually costs a depot.
  delete from fleet_maintenance
   where company_id = v_company
     and vehicle_id = any(v_ids)
     and reference like 'FILM01-%';

  insert into fleet_maintenance (company_id, vehicle_id, type, status, priority, scheduled_date, reference, vendor, notes)
  values
    (v_company, v_ids[1], 'Scheduled service', 'scheduled', 'routine', v_thursday,
     'FILM01-A', 'Bow Valley Commercial', 'Booked weeks ago. Nothing wrong with it.'),
    (v_company, v_ids[2], 'Brake inspection', 'scheduled', 'routine', v_thursday,
     'FILM01-B', 'Bow Valley Commercial', 'Booked by a different person, on a different system.');

  -- The dock figures. Recent week busy, the three weeks before it calmer, so
  -- the site reads as both near capacity and getting worse.
  delete from warehouse_snapshot
   where company_id = v_company and site_id = v_site
     and date >= current_date - 28;

  -- Last 7 days: 94%.
  insert into warehouse_snapshot (company_id, site_id, date, shift, productivity_pct,
                                  orders_processed, orders_pending, dock_utilization_pct)
  select v_company, v_site, current_date - d, 'all', 86,
         3200 + (d * 17), 48 + d, 94
    from generate_series(0, 6) as d;

  -- The 21 days before that: 88%.
  insert into warehouse_snapshot (company_id, site_id, date, shift, productivity_pct,
                                  orders_processed, orders_pending, dock_utilization_pct)
  select v_company, v_site, current_date - d, 'all', 88,
         3100 + (d * 11), 40 + (d % 6), 88
    from generate_series(7, 27) as d;

  raise notice 'Calgary Depot seeded. Clash lands on %. Press Run checks.', v_thursday;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Verify — the four things the check needs, measured directly
-- ---------------------------------------------------------------------------
with me as (select company_id from app_user order by created_at limit 1),
site as (select id from warehouse_site
          where company_id = (select company_id from me) and name = 'Calgary Depot')
select
  (select count(distinct t.vehicle_id)
     from fleet_trip t
     join warehouse_site w
       on w.company_id = t.company_id and w.name = t.origin
    where t.company_id = (select company_id from me)
      and w.name = 'Calgary Depot'
      and t.date >= current_date - 30)                              as vehicles_serving,
  (select count(distinct m.vehicle_id)
     from fleet_maintenance m
    where m.company_id = (select company_id from me)
      and m.reference like 'FILM01-%'
      and m.scheduled_date between current_date and current_date + 14) as off_road_worst_day,
  (select round(avg(dock_utilization_pct))
     from warehouse_snapshot
    where site_id = (select id from site) and date >= current_date - 7)  as dock_now,
  (select round(avg(dock_utilization_pct))
     from warehouse_snapshot
    where site_id = (select id from site)
      and date >= current_date - 28 and date < current_date - 7)         as dock_before;
--
-- Expect: vehicles_serving 6 · off_road_worst_day 2 · dock_now 94 · dock_before 88
--
-- 2 / 6 = 33%, and 94 is over the 85% busy line. That is a critical finding.
-- Any zero in that row means the check will stay silent — and, since 0021,
-- will say so on the Guardian screen rather than reporting all-clear.

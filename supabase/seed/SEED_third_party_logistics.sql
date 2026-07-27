-- Example company: Cascade Logistics Group (DEMO)
--
-- Third-party logistics. Four sites, multiple client accounts, mixed fleet, cross-dock and contract storage.
--
-- Industry-typical shape, not a copy of any real company's internal setup.
-- Everything here is invented — names, part numbers, figures.
--
-- Creates its own tenant, clearly marked DEMO, and removes that tenant first
-- so this can be re-run. It never touches a company it did not create.
--
-- Roughly what this produces:
--   80 employees across 7 departments
--   1,200 stock items
--   42 vehicles
--   4 site(s), 90 days of history
--
-- After running, scroll to the bottom for how to switch your login to it.

begin;

-- Re-runnable: drop the previous copy of this demo tenant. Cascade removes
-- every row that belonged to it.
delete from company where name = 'Cascade Logistics Group (DEMO)';

do $$
declare
  v_company   uuid;
  v_days      int := 90;
begin
  insert into company (name, timezone)
  values ('Cascade Logistics Group (DEMO)', 'America/Edmonton')
  returning id into v_company;

  -- ---------------------------------------------------------------- people
  insert into hr_department (company_id, name, code, head)
  select v_company, d.name, d.code, d.head
  from (values
    ('Operations', 'OPS', 'Operations Director'),
    ('Transport', 'TRN', 'Transport Manager'),
    ('Warehouse', 'WHS', 'Warehouse Manager'),
    ('Customer Service', 'CS', 'Client Services Manager'),
    ('Compliance', 'CMP', 'Compliance Manager'),
    ('Finance', 'FIN', 'Financial Controller'),
    ('Administration', 'ADM', 'Office Manager')
  ) as d(name, code, head);

  insert into hr_employee
    (company_id, department_id, name, email, role, status, hire_date, salary, work_location)
  select
    v_company,
    (select id from hr_department
      where company_id = v_company
      offset (i % 7) limit 1),
    (array['James', 'Sarah', 'Michael', 'Priya', 'David', 'Aisha', 'Robert', 'Maria', 'Daniel', 'Fatima', 'Thomas', 'Elena', 'Christopher', 'Nadia', 'Andrew', 'Grace', 'Peter', 'Yasmin', 'Stephen', 'Chloe', 'Marcus', 'Leila', 'Jonathan', 'Amara', 'Richard', 'Sofia', 'Paul', 'Zara', 'Adam', 'Ines'])[1 + (i * 7) % 30]
      || ' ' ||
      (array['Anderson', 'Brooks', 'Chen', 'Dahl', 'Edwards', 'Fischer', 'Gallagher', 'Haddad', 'Iqbal', 'Jensen', 'Kowalski', 'Lindqvist', 'Mbeki', 'Novak', 'Okafor', 'Petrov', 'Quinn', 'Rahman', 'Silva', 'Tremblay', 'Ueda', 'Vasquez', 'Whitfield', 'Xu', 'Yilmaz', 'Zielinski', 'Barnes', 'Costa', 'Duval', 'Ellis'])[1 + (i * 11) % 30],
    'employee' || i || '@northwind.invalid',
    (array['Transport Planner', 'HGV Driver', 'Van Driver', 'Shunter Driver', 'Warehouse Operative', 'Forklift Driver', 'Team Leader', 'Shift Manager', 'Client Account Handler', 'Goods-in Clerk', 'Compliance Officer', 'Traffic Clerk', 'Accounts Assistant', 'Administrator'])[1 + (i * 5) % 14],
    case when i % 23 = 0 then 'on_leave' when i % 31 = 0 then 'onboarding' else 'active' end,
    current_date - ((i * 37) % 2200),
    38000 + ((i * 1373) % 46000),
    (array['Vancouver Hub', 'Calgary Cross-dock', 'Toronto Contract Site', 'Montreal Satellite'])[1 + (i % 4)]
  from generate_series(1, 80) as i;

  -- ------------------------------------------------------------ warehouse
  insert into warehouse_site (company_id, name, location)
  select v_company, s.name, s.loc
  from (values
    ('Vancouver Hub', 'Vancouver, BC'),
    ('Calgary Cross-dock', 'Calgary, AB'),
    ('Toronto Contract Site', 'Toronto, ON'),
    ('Montreal Satellite', 'Montreal, QC')
  ) as s(name, loc);

  -- One snapshot per site per day per shift.
  insert into warehouse_snapshot
    (company_id, site_id, date, shift, productivity_pct, orders_processed, orders_pending, dock_utilization_pct)
  select
    v_company,
    ws.id,
    current_date - d,
    (array['A','B','C'])[1 + ((d + ws.ord) % 3)]::shift_type,
    round((72 + ((d * 7 + ws.ord * 13) % 26))::numeric, 2),
    2400 + ((d * 97 + ws.ord * 31) % 1700),
    40 + ((d * 17 + ws.ord * 5) % 260),
    round((61 + ((d * 11 + ws.ord * 19) % 34))::numeric, 2)
  from generate_series(0, v_days - 1) as d
  cross join (
    select id, row_number() over (order by name) as ord
    from warehouse_site where company_id = v_company
  ) as ws;

  -- ---------------------------------------------------------------- fleet
  insert into fleet_vehicle
    (company_id, name, type, status, license_plate, fuel_type, purchase_date, mileage)
  select
    v_company,
    v.vtype || ' ' || v.n,
    v.vtype,
    case when v.rn % 17 = 0 then 'maintenance'
         when v.rn % 29 = 0 then 'inactive'
         else 'active' end,
    'DEMO-' || lpad(v.rn::text, 3, '0'),
    v.fuel,
    current_date - (400 + (v.rn * 53) % 1800),
    0
  from (
    select vtype, fuel, n, row_number() over () as rn
    from (values
      ('Tractor unit', 'Diesel', 1),
      ('Tractor unit', 'Diesel', 2),
      ('Tractor unit', 'Diesel', 3),
      ('Tractor unit', 'Diesel', 4),
      ('Tractor unit', 'Diesel', 5),
      ('Tractor unit', 'Diesel', 6),
      ('Tractor unit', 'Diesel', 7),
      ('Tractor unit', 'Diesel', 8),
      ('Tractor unit', 'Diesel', 9),
      ('Tractor unit', 'Diesel', 10),
      ('Curtain-side trailer', 'Non-powered', 1),
      ('Curtain-side trailer', 'Non-powered', 2),
      ('Curtain-side trailer', 'Non-powered', 3),
      ('Curtain-side trailer', 'Non-powered', 4),
      ('Curtain-side trailer', 'Non-powered', 5),
      ('Curtain-side trailer', 'Non-powered', 6),
      ('Curtain-side trailer', 'Non-powered', 7),
      ('Curtain-side trailer', 'Non-powered', 8),
      ('Curtain-side trailer', 'Non-powered', 9),
      ('Curtain-side trailer', 'Non-powered', 10),
      ('Curtain-side trailer', 'Non-powered', 11),
      ('Curtain-side trailer', 'Non-powered', 12),
      ('Box trailer', 'Non-powered', 1),
      ('Box trailer', 'Non-powered', 2),
      ('Box trailer', 'Non-powered', 3),
      ('Box trailer', 'Non-powered', 4),
      ('Box trailer', 'Non-powered', 5),
      ('Rigid truck (3-axle)', 'Diesel', 1),
      ('Rigid truck (3-axle)', 'Diesel', 2),
      ('Rigid truck (3-axle)', 'Diesel', 3),
      ('Rigid truck (3-axle)', 'Diesel', 4),
      ('Rigid truck (3-axle)', 'Diesel', 5),
      ('Rigid truck (3-axle)', 'Diesel', 6),
      ('Panel van', 'Diesel', 1),
      ('Panel van', 'Diesel', 2),
      ('Panel van', 'Diesel', 3),
      ('Panel van', 'Diesel', 4),
      ('Panel van', 'Diesel', 5),
      ('Forklift (counterbalance)', 'LPG / Propane', 1),
      ('Forklift (counterbalance)', 'LPG / Propane', 2),
      ('Forklift (counterbalance)', 'LPG / Propane', 3),
      ('Forklift (counterbalance)', 'LPG / Propane', 4)
    ) as x(vtype, fuel, n)
  ) as v;

  -- Trips. The 0009 trigger recalculates vehicle mileage from these, so
  -- mileage is left at 0 above and arrives here.
  insert into fleet_trip
    (company_id, vehicle_id, date, miles_driven, fuel_used, origin, destination, status)
  select
    v_company,
    fv.id,
    current_date - d,
    round((45 + ((d * 29 + fv.ord * 37) % 310))::numeric, 1),
    round((8 + ((d * 13 + fv.ord * 7) % 52))::numeric, 1),
    (array['Vancouver Hub', 'Calgary Cross-dock', 'Toronto Contract Site', 'Montreal Satellite'])[1 + (fv.ord % 4)],
    'Customer site ' || (1 + ((d * 3 + fv.ord) % 40)),
    case when (d + fv.ord) % 19 = 0 then 'cancelled' else 'completed' end
  from generate_series(0, v_days - 1) as d
  cross join (
    select id, row_number() over (order by name) as ord
    from fleet_vehicle
    where company_id = v_company and status = 'active'
  ) as fv
  where (d + fv.ord) % 3 = 0;   -- not every vehicle moves every day

  -- Maintenance, if 0010 has been applied.
  if to_regclass('public.fleet_maintenance') is not null then
    insert into fleet_maintenance
      (company_id, vehicle_id, type, status, priority, scheduled_date, completed_date,
       odometer, cost, vendor, reference)
    select
      v_company,
      fv.id,
      (array['Safety inspection', 'Roadworthiness test', 'Tachograph calibration', 'Tail lift inspection', 'Tyres — replacement', 'Brakes — pads / shoes', 'Routine service'])[1 + ((fv.ord + k) % 7)],
      st.status,
      case when (fv.ord + k) % 11 = 0 then 'critical'
           when (fv.ord + k) % 4  = 0 then 'high'
           else 'routine' end,
      current_date - 40 + ((fv.ord * 7 + k * 13) % 70),
      case when st.status = 'completed'
           then current_date - 40 + ((fv.ord * 7 + k * 13) % 70) else null end,
      12000 + ((fv.ord * 941 + k * 383) % 180000),
      round((110 + ((fv.ord * 67 + k * 29) % 2400))::numeric, 2),
      'Depot Workshop ' || (1 + (fv.ord % 3)),
      'WO-' || lpad(((fv.ord * 10) + k)::text, 5, '0')
    from (
      select id, row_number() over (order by name) as ord
      from fleet_vehicle where company_id = v_company
    ) as fv
    cross join generate_series(1, 3) as k
    cross join lateral (
      select case when (fv.ord + k) % 5 = 0 then 'scheduled'
                  when (fv.ord + k) % 7 = 0 then 'in_progress'
                  else 'completed' end as status
    ) as st;
  end if;

  -- ------------------------------------------------------------ inventory
  -- Stock starts at zero. Movements below build it up, which exercises the
  -- 0007 trigger and means quantity_on_hand is arrived at rather than typed.
  insert into inventory_sku
    (company_id, sku, name, category, quantity_on_hand, quantity_reserved,
     reorder_level, reorder_quantity, unit_cost, unit_price, warehouse_location, supplier)
  select
    v_company,
    g.prefix || '-' || lpad(i::text, 5, '0'),
    g.label || ' item ' || i,
    g.label,
    0,
    (i * 3) % 40,
    20 + (i % 60),
    100 + (i % 400),
    round((g.cost + ((i % 90) * 0.11))::numeric, 2),
    round((g.cost * 1.42 + ((i % 90) * 0.17))::numeric, 2),
    'Aisle ' || (1 + i % 24) || ' Bay ' || (1 + i % 40),
    'Supplier ' || (1 + i % 28)
  from generate_series(1, 1200) as i
  cross join lateral (
    select prefix, label, cost from (values
      ('ACM', 'Acme Retail', 3.4),
      ('BRT', 'Brightline Consumer', 5.1),
      ('CDL', 'Caledon Industrial', 8.9),
      ('DVR', 'Deveraux Pharma', 14.6),
      ('EVG', 'Evergreen Garden', 2.75)
    ) as gg(prefix, label, cost)
    offset (i % 5) limit 1
  ) as g;

  -- Movements across the most recent stock items only, so this stays quick
  -- on the larger catalogues.
  insert into inventory_movement (company_id, sku_id, type, quantity, reference, date)
  select
    v_company,
    s.id,
    case when (d + s.ord) % 3 = 0 then 'outbound' else 'inbound' end,
    20 + ((d * 17 + s.ord * 23) % 180),
    'REF-' || lpad(((d * 100) + s.ord)::text, 6, '0'),
    current_date - d
  from generate_series(0, v_days - 1) as d
  cross join (
    select id, row_number() over (order by sku) as ord
    from inventory_sku where company_id = v_company limit 300
  ) as s
  where (d + s.ord) % 7 = 0;

  -- -------------------------------------------------------------- finance
  insert into finance_cost_center (company_id, name, code, manager, budget_ytd)
  select v_company, c.name, c.code, c.mgr, c.budget
  from (values
    ('Linehaul', 'CC-LNH', 'James Anderson', 2100000),
    ('Contract Storage', 'CC-STO', 'Priya Fischer', 890000),
    ('Cross-dock', 'CC-XDK', 'Robert Kowalski', 430000),
    ('Client Services', 'CC-CS', 'Fatima Petrov', 260000),
    ('Fleet', 'CC-FLT', 'Christopher Ueda', 1150000)
  ) as c(name, code, mgr, budget);

  insert into finance_transaction
    (company_id, cost_center_id, type, category, amount, description, date, reference)
  select
    v_company,
    cc.id,
    case when (d + cc.ord) % 3 = 0 then 'revenue' else 'expense' end,
    case when (d + cc.ord) % 3 = 0 then 'Client billing'
         when (d + cc.ord) % 5 = 0 then 'Fuel'
         when (d + cc.ord) % 7 = 0 then 'Wages'
         else 'Operating cost' end,
    round((850 + ((d * 313 + cc.ord * 971) % 48000))::numeric, 2),
    'Period entry ' || d,
    current_date - d,
    'TXN-' || lpad(((d * 20) + cc.ord)::text, 6, '0')
  from generate_series(0, v_days - 1) as d
  cross join (
    select id, row_number() over (order by code) as ord
    from finance_cost_center where company_id = v_company
  ) as cc
  where (d + cc.ord) % 2 = 0;

  -- ----------------------------------------------------------- attendance
  insert into hr_attendance (company_id, employee_id, date, status, hours_worked)
  select
    v_company,
    e.id,
    current_date - d,
    case when (d * 7 + e.ord) % 41 = 0 then 'absent'
         when (d * 5 + e.ord) % 29 = 0 then 'late'
         when (d * 3 + e.ord) % 37 = 0 then 'leave'
         when (d + e.ord) % 13 = 0 then 'remote'
         else 'present' end,
    round((6.5 + ((d + e.ord) % 4))::numeric, 2)
  from generate_series(0, 29) as d
  cross join (
    select id, row_number() over (order by name) as ord
    from hr_employee where company_id = v_company and status = 'active'
  ) as e;

  -- Reviews for the current quarter, for most but not all staff — so the
  -- "not reviewed this period" figure is a real number rather than zero.
  insert into hr_performance (company_id, employee_id, period, rating, category, feedback, reviewed_by)
  select
    v_company,
    e.id,
    extract(year from current_date)::text || '-Q' || extract(quarter from current_date)::text,
    round((2.6 + ((e.ord * 13) % 24) * 0.1)::numeric, 1),
    'Quarterly',
    'Recorded as part of the quarterly review cycle.',
    'Line Manager'
  from (
    select id, row_number() over (order by name) as ord
    from hr_employee where company_id = v_company and status = 'active'
  ) as e
  where e.ord % 4 <> 0;

  -- --------------------------------------------------------------- safety
  insert into safety_incident
    (company_id, date, severity, category, location, description, status, reported_by)
  select
    v_company,
    current_date - ((i * 7) % v_days),
    case when i % 19 = 0 then 'critical'
         when i % 7  = 0 then 'high'
         when i % 3  = 0 then 'medium'
         else 'low' end,
    (array['Vehicle contact', 'Manual handling', 'Load security', 'Slip or trip', 'Reversing incident'])[1 + (i % 5)],
    (array['Vancouver Hub', 'Calgary Cross-dock', 'Toronto Contract Site', 'Montreal Satellite'])[1 + (i % 4)],
    'Reported during routine operations.',
    case when i % 4 = 0 then 'open'
         when i % 5 = 0 then 'investigating'
         else 'resolved' end,
    'Shift Supervisor'
  from generate_series(1, 60) as i;

  insert into safety_inspection (company_id, date, area, inspector, result, findings, next_due)
  select
    v_company,
    current_date - ((i * 11) % v_days),
    (array['Vancouver Hub', 'Calgary Cross-dock', 'Toronto Contract Site', 'Montreal Satellite'])[1 + (i % 4)],
    'Compliance Officer',
    case when i % 11 = 0 then 'fail' when i % 5 = 0 then 'conditional' else 'pass' end,
    'Routine inspection.',
    current_date + (14 + (i % 60))
  from generate_series(1, 40) as i;

  raise notice 'Seeded % (company id %)', 'Cascade Logistics Group (DEMO)', v_company;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- What was created
-- ---------------------------------------------------------------------------
select
  (select name from company where name = 'Cascade Logistics Group (DEMO)')                                        as company,
  (select count(*) from hr_employee     where company_id = (select id from company where name = 'Cascade Logistics Group (DEMO)')) as employees,
  (select count(*) from inventory_sku   where company_id = (select id from company where name = 'Cascade Logistics Group (DEMO)')) as stock_items,
  (select count(*) from fleet_vehicle   where company_id = (select id from company where name = 'Cascade Logistics Group (DEMO)')) as vehicles,
  (select count(*) from fleet_trip      where company_id = (select id from company where name = 'Cascade Logistics Group (DEMO)')) as trips,
  (select count(*) from hr_attendance   where company_id = (select id from company where name = 'Cascade Logistics Group (DEMO)')) as attendance_rows,
  (select count(*) from finance_transaction where company_id = (select id from company where name = 'Cascade Logistics Group (DEMO)')) as transactions;

-- ---------------------------------------------------------------------------
-- To view it
-- ---------------------------------------------------------------------------
-- Your login is tied to one company. Point it at this one:
--
--   update app_user
--      set company_id = (select id from company where name = 'Cascade Logistics Group (DEMO)')
--    where email = 'YOUR-LOGIN-EMAIL';
--
-- Then reload the app. To go back to your own data, run the same statement
-- with your real company's name.
--
-- Note down your original company id before switching:
--
--   select company_id from app_user where email = 'YOUR-LOGIN-EMAIL';

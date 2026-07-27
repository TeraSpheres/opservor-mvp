/* Generates a seed file per example company.
 *
 * These exist because an empty product looks like a toy, and because loading
 * a real operation's worth of data is what exposes the things that only break
 * at scale — the row cap that silently truncated every total was found exactly
 * this way.
 *
 * The shapes are industry-typical, not copies of any real company's internal
 * structure. A food distributor looks like a food distributor because that is
 * how food distribution works, not because anyone's setup was lifted.
 *
 * Volume is produced with generate_series rather than thousands of INSERT
 * statements, so the files stay readable and run in seconds.
 *
 * Each file creates its own company, clearly marked DEMO, and deletes that
 * company first so it can be re-run. Nothing touches a tenant it did not
 * create.
 *
 * Run: node supabase/seed/build-demo-companies.js
 */

const fs = require('fs');
const path = require('path');

const OUT = __dirname;

/* ------------------------------------------------------------------ */
/* Profiles                                                            */
/* ------------------------------------------------------------------ */

const PROFILES = [
  {
    id: 'food_and_beverage',
    company: 'Northwind Foods (DEMO)',
    blurb: 'Chilled and ambient food distribution. Two depots, route delivery, ' +
           'short shelf life, high stock turnover.',
    departments: [
      ['Operations', 'OPS', 'Depot Manager'],
      ['Warehouse', 'WHS', 'Warehouse Manager'],
      ['Transport', 'TRN', 'Transport Manager'],
      ['Quality & Compliance', 'QA', 'QA Manager'],
      ['Finance', 'FIN', 'Financial Controller'],
      ['Administration', 'ADM', 'Office Manager'],
    ],
    roles: [
      'Depot Supervisor', 'Warehouse Operative', 'Forklift Driver', 'Picker',
      'HGV Driver', 'Van Driver', 'Transport Planner', 'QA Technician',
      'Goods-in Clerk', 'Stock Controller', 'Accounts Assistant', 'Administrator',
    ],
    employees: 45,
    sites: [
      ['Calgary Depot', 'Calgary, AB'],
      ['Edmonton Depot', 'Edmonton, AB'],
    ],
    vehicles: [
      ['Refrigerated van', 6, 'Diesel'],
      ['Rigid truck (2-axle)', 5, 'Diesel'],
      ['Refrigerated trailer', 3, 'Non-powered'],
      ['Tractor unit', 2, 'Diesel'],
      ['Forklift (counterbalance)', 2, 'Battery electric'],
    ],
    skuCount: 800,
    skuGroups: [
      ['CHL', 'Chilled', 2.10, 3.40],
      ['AMB', 'Ambient', 1.20, 2.05],
      ['FRZ', 'Frozen', 3.05, 4.80],
      ['BEV', 'Beverages', 0.85, 1.60],
      ['BAK', 'Bakery', 1.45, 2.60],
    ],
    costCentres: [
      ['Depot Operations', 'CC-OPS', 480000],
      ['Transport', 'CC-TRN', 620000],
      ['Cold Chain', 'CC-CLD', 210000],
      ['Overheads', 'CC-OVH', 145000],
    ],
    maintenanceTypes: [
      'Refrigeration unit inspection', 'Routine service', 'Tyres — replacement',
      'Tachograph calibration', 'Safety inspection', 'Brakes — pads / shoes',
    ],
    incidentCategories: ['Manual handling', 'Slip or trip', 'Vehicle contact', 'Cold store exposure'],
    dailyOrders: [1600, 2900],
  },

  {
    id: 'automotive_parts',
    company: 'Meridian Automotive Components (DEMO)',
    blurb: 'Automotive parts manufacture and distribution. Three plants, ' +
           'thousands of part numbers, line-side supply.',
    departments: [
      ['Production', 'PRD', 'Production Manager'],
      ['Warehouse & Logistics', 'WHS', 'Logistics Manager'],
      ['Quality Assurance', 'QA', 'Quality Manager'],
      ['Engineering', 'ENG', 'Engineering Manager'],
      ['Maintenance', 'MNT', 'Maintenance Supervisor'],
      ['Finance', 'FIN', 'Finance Director'],
      ['People', 'HR', 'HR Manager'],
    ],
    roles: [
      'Line Operator', 'Line Supervisor', 'CNC Machinist', 'Assembly Technician',
      'Quality Inspector', 'Metrology Technician', 'Design Engineer',
      'Process Engineer', 'Maintenance Technician', 'Forklift Driver',
      'Goods-in Clerk', 'Materials Planner', 'Shift Manager', 'Accounts Clerk',
    ],
    employees: 120,
    sites: [
      ['Plant One — Machining', 'Hamilton, ON'],
      ['Plant Two — Assembly', 'Windsor, ON'],
      ['Central Parts Warehouse', 'Mississauga, ON'],
    ],
    vehicles: [
      ['Forklift (counterbalance)', 8, 'Battery electric'],
      ['Reach truck', 4, 'Battery electric'],
      ['Powered pallet truck', 5, 'Battery electric'],
      ['Panel van', 4, 'Diesel'],
      ['Rigid truck (2-axle)', 3, 'Diesel'],
      ['Tow tractor / Tugger', 2, 'Battery electric'],
    ],
    skuCount: 5000,
    skuGroups: [
      ['BRK', 'Braking', 4.20, 11.90],
      ['SUS', 'Suspension', 6.80, 18.40],
      ['ENG', 'Engine', 9.10, 26.75],
      ['ELE', 'Electrical', 2.40, 7.15],
      ['TRN', 'Transmission', 12.50, 34.20],
      ['BDY', 'Body & trim', 3.15, 8.60],
      ['FLT', 'Filtration', 1.85, 5.40],
    ],
    costCentres: [
      ['Machining', 'CC-MCH', 1850000],
      ['Assembly', 'CC-ASM', 1420000],
      ['Quality', 'CC-QA', 390000],
      ['Plant Maintenance', 'CC-MNT', 610000],
      ['Logistics', 'CC-LOG', 540000],
    ],
    maintenanceTypes: [
      'Lifting equipment inspection (LOLER)', 'Routine service', 'Battery health check',
      'Hydraulics', 'Safety inspection', 'Tyres — replacement', 'Charging system',
    ],
    incidentCategories: ['Machine guarding', 'Manual handling', 'Forklift near miss', 'Chemical spill', 'Noise exposure'],
    dailyOrders: [3200, 5400],
  },

  {
    id: 'third_party_logistics',
    company: 'Cascade Logistics Group (DEMO)',
    blurb: 'Third-party logistics. Four sites, multiple client accounts, ' +
           'mixed fleet, cross-dock and contract storage.',
    departments: [
      ['Operations', 'OPS', 'Operations Director'],
      ['Transport', 'TRN', 'Transport Manager'],
      ['Warehouse', 'WHS', 'Warehouse Manager'],
      ['Customer Service', 'CS', 'Client Services Manager'],
      ['Compliance', 'CMP', 'Compliance Manager'],
      ['Finance', 'FIN', 'Financial Controller'],
      ['Administration', 'ADM', 'Office Manager'],
    ],
    roles: [
      'Transport Planner', 'HGV Driver', 'Van Driver', 'Shunter Driver',
      'Warehouse Operative', 'Forklift Driver', 'Team Leader', 'Shift Manager',
      'Client Account Handler', 'Goods-in Clerk', 'Compliance Officer',
      'Traffic Clerk', 'Accounts Assistant', 'Administrator',
    ],
    employees: 80,
    sites: [
      ['Vancouver Hub', 'Vancouver, BC'],
      ['Calgary Cross-dock', 'Calgary, AB'],
      ['Toronto Contract Site', 'Toronto, ON'],
      ['Montreal Satellite', 'Montreal, QC'],
    ],
    vehicles: [
      ['Tractor unit', 10, 'Diesel'],
      ['Curtain-side trailer', 12, 'Non-powered'],
      ['Box trailer', 5, 'Non-powered'],
      ['Rigid truck (3-axle)', 6, 'Diesel'],
      ['Panel van', 5, 'Diesel'],
      ['Forklift (counterbalance)', 4, 'LPG / Propane'],
    ],
    skuCount: 1200,
    skuGroups: [
      ['ACM', 'Acme Retail', 3.40, 0],
      ['BRT', 'Brightline Consumer', 5.10, 0],
      ['CDL', 'Caledon Industrial', 8.90, 0],
      ['DVR', 'Deveraux Pharma', 14.60, 0],
      ['EVG', 'Evergreen Garden', 2.75, 0],
    ],
    costCentres: [
      ['Linehaul', 'CC-LNH', 2100000],
      ['Contract Storage', 'CC-STO', 890000],
      ['Cross-dock', 'CC-XDK', 430000],
      ['Client Services', 'CC-CS', 260000],
      ['Fleet', 'CC-FLT', 1150000],
    ],
    maintenanceTypes: [
      'Safety inspection', 'Roadworthiness test', 'Tachograph calibration',
      'Tail lift inspection', 'Tyres — replacement', 'Brakes — pads / shoes',
      'Routine service',
    ],
    incidentCategories: ['Vehicle contact', 'Manual handling', 'Load security', 'Slip or trip', 'Reversing incident'],
    dailyOrders: [2400, 4100],
  },
];

/* ------------------------------------------------------------------ */

const FIRST = [
  'James','Sarah','Michael','Priya','David','Aisha','Robert','Maria','Daniel','Fatima',
  'Thomas','Elena','Christopher','Nadia','Andrew','Grace','Peter','Yasmin','Stephen','Chloe',
  'Marcus','Leila','Jonathan','Amara','Richard','Sofia','Paul','Zara','Adam','Ines',
];
const LAST = [
  'Anderson','Brooks','Chen','Dahl','Edwards','Fischer','Gallagher','Haddad','Iqbal','Jensen',
  'Kowalski','Lindqvist','Mbeki','Novak','Okafor','Petrov','Quinn','Rahman','Silva','Tremblay',
  'Ueda','Vasquez','Whitfield','Xu','Yilmaz','Zielinski','Barnes','Costa','Duval','Ellis',
];

const DAYS = 90;

function sqlList(arr) {
  return arr.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(', ');
}

function build(p) {
  const vehicleRows = p.vehicles.flatMap(([type, n, fuel]) =>
    Array.from({ length: n }, (_, i) => [type, fuel, i + 1])
  );

  return `-- Example company: ${p.company}
--
-- ${p.blurb}
--
-- Industry-typical shape, not a copy of any real company's internal setup.
-- Everything here is invented — names, part numbers, figures.
--
-- Creates its own tenant, clearly marked DEMO, and removes that tenant first
-- so this can be re-run. It never touches a company it did not create.
--
-- Roughly what this produces:
--   ${p.employees} employees across ${p.departments.length} departments
--   ${p.skuCount.toLocaleString()} stock items
--   ${vehicleRows.length} vehicles
--   ${p.sites.length} site(s), ${DAYS} days of history
--
-- After running, scroll to the bottom for how to switch your login to it.

begin;

-- Re-runnable: drop the previous copy of this demo tenant. Cascade removes
-- every row that belonged to it.
delete from company where name = '${p.company}';

do $$
declare
  v_company   uuid;
  v_days      int := ${DAYS};
begin
  insert into company (name, timezone)
  values ('${p.company}', 'America/Edmonton')
  returning id into v_company;

  -- ---------------------------------------------------------------- people
  insert into hr_department (company_id, name, code, head)
  select v_company, d.name, d.code, d.head
  from (values
${p.departments.map(([n, c, h]) => `    ('${n}', '${c}', '${h}')`).join(',\n')}
  ) as d(name, code, head);

  insert into hr_employee
    (company_id, department_id, name, email, role, status, hire_date, salary, work_location)
  select
    v_company,
    (select id from hr_department
      where company_id = v_company
      offset (i % ${p.departments.length}) limit 1),
    (array[${sqlList(FIRST)}])[1 + (i * 7) % ${FIRST.length}]
      || ' ' ||
      (array[${sqlList(LAST)}])[1 + (i * 11) % ${LAST.length}],
    'employee' || i || '@northwind.invalid',
    (array[${sqlList(p.roles)}])[1 + (i * 5) % ${p.roles.length}],
    case when i % 23 = 0 then 'on_leave' when i % 31 = 0 then 'onboarding' else 'active' end,
    current_date - ((i * 37) % 2200),
    38000 + ((i * 1373) % 46000),
    (array[${sqlList(p.sites.map((s) => s[0]))}])[1 + (i % ${p.sites.length})]
  from generate_series(1, ${p.employees}) as i;

  -- ------------------------------------------------------------ warehouse
  insert into warehouse_site (company_id, name, location)
  select v_company, s.name, s.loc
  from (values
${p.sites.map(([n, l]) => `    ('${n}', '${l}')`).join(',\n')}
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
    ${p.dailyOrders[0]} + ((d * 97 + ws.ord * 31) % ${p.dailyOrders[1] - p.dailyOrders[0]}),
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
${vehicleRows.map(([t, f, n]) => `      ('${t}', '${f}', ${n})`).join(',\n')}
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
    (array[${sqlList(p.sites.map((s) => s[0]))}])[1 + (fv.ord % ${p.sites.length})],
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
      (array[${sqlList(p.maintenanceTypes)}])[1 + ((fv.ord + k) % ${p.maintenanceTypes.length})],
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
  from generate_series(1, ${p.skuCount}) as i
  cross join lateral (
    select prefix, label, cost from (values
${p.skuGroups.map(([pre, lab, cost]) => `      ('${pre}', '${lab}', ${cost})`).join(',\n')}
    ) as gg(prefix, label, cost)
    offset (i % ${p.skuGroups.length}) limit 1
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
${p.costCentres.map(([n, c, b], i) => `    ('${n}', '${c}', '${FIRST[i * 3 % FIRST.length]} ${LAST[i * 5 % LAST.length]}', ${b})`).join(',\n')}
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
    (array[${sqlList(p.incidentCategories)}])[1 + (i % ${p.incidentCategories.length})],
    (array[${sqlList(p.sites.map((s) => s[0]))}])[1 + (i % ${p.sites.length})],
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
    (array[${sqlList(p.sites.map((s) => s[0]))}])[1 + (i % ${p.sites.length})],
    'Compliance Officer',
    case when i % 11 = 0 then 'fail' when i % 5 = 0 then 'conditional' else 'pass' end,
    'Routine inspection.',
    current_date + (14 + (i % 60))
  from generate_series(1, 40) as i;

  raise notice 'Seeded % (company id %)', '${p.company}', v_company;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- What was created
-- ---------------------------------------------------------------------------
select
  (select name from company where name = '${p.company}')                                        as company,
  (select count(*) from hr_employee     where company_id = (select id from company where name = '${p.company}')) as employees,
  (select count(*) from inventory_sku   where company_id = (select id from company where name = '${p.company}')) as stock_items,
  (select count(*) from fleet_vehicle   where company_id = (select id from company where name = '${p.company}')) as vehicles,
  (select count(*) from fleet_trip      where company_id = (select id from company where name = '${p.company}')) as trips,
  (select count(*) from hr_attendance   where company_id = (select id from company where name = '${p.company}')) as attendance_rows,
  (select count(*) from finance_transaction where company_id = (select id from company where name = '${p.company}')) as transactions;

-- ---------------------------------------------------------------------------
-- To view it
-- ---------------------------------------------------------------------------
-- Your login is tied to one company. Point it at this one:
--
--   update app_user
--      set company_id = (select id from company where name = '${p.company}')
--    where email = 'YOUR-LOGIN-EMAIL';
--
-- Then reload the app. To go back to your own data, run the same statement
-- with your real company's name.
--
-- Note down your original company id before switching:
--
--   select company_id from app_user where email = 'YOUR-LOGIN-EMAIL';
`;
}

let total = 0;
for (const p of PROFILES) {
  const file = path.join(OUT, `SEED_${p.id}.sql`);
  const sql = build(p);
  fs.writeFileSync(file, sql);
  total++;
  console.log(`  ${path.basename(file).padEnd(38)} ${(sql.length / 1024).toFixed(1)} KB  ` +
    `${p.employees} staff · ${p.skuCount.toLocaleString()} items · ` +
    `${p.vehicles.reduce((n, v) => n + v[1], 0)} vehicles`);
}
console.log(`\n${total} seed files written to ${OUT}`);

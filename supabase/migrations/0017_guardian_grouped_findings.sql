-- 0017 — Guardian: stop the wall of red
--
-- The first run against 800 demo products produced 72 criticals. That is a
-- failure, not a result. If 72 things are critical then nothing is, and the
-- screen gets the same treatment every operations manager already gives their
-- existing alerts: closed once, never opened again.
--
-- Two separate faults were behind it.
--
-- ONE — forecasting from impossible numbers
--
-- Items were showing stock of -201 and -156. The check dutifully floored that
-- at zero, divided by the daily rate, got zero, and announced "runs out in 0
-- days, already late". Every word of that is wrong. Nothing is going to run
-- out; it already has, and the records are broken. You cannot forecast from a
-- number that cannot be true.
--
-- Negative stock is not a rounding error either. It means goods left the
-- building that the system never recorded arriving — unrecorded receipts,
-- mis-picks, despatches posted against the wrong item. It is endemic in real
-- warehouse data and no stock system raises it, because they all just display
-- the negative number and carry on. So it becomes its own finding, in its own
-- words.
--
-- TWO — one finding per item, when nobody buys one item at a time
--
-- Twenty-three rows saying "order more of this" describe one phone call. An
-- operations manager rings a supplier and orders everything short from that
-- supplier. So the finding is now per supplier, with the line items inside it.
--
-- The arithmetic is untouched. This changes how findings are assembled, not
-- how the numbers are worked out.
--
-- Safe to re-run.

begin;

do $$
begin
  if to_regproc('public.guardian_run_all') is null then
    raise exception 'guardian_run_all() is missing — apply 0015 first';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. A finding can now be about something that has no uuid
--
-- A supplier is a text column on inventory_sku; there is no supplier table, so
-- there is no id to point at. The old uniqueness rule was built on entity_id,
-- and a null entity_id counts as distinct from every other null — so a
-- supplier-level finding would have inserted a fresh duplicate on every single
-- run instead of updating the one already there.
-- ---------------------------------------------------------------------------
alter table guardian_finding add column if not exists entity_key text;

update guardian_finding
   set entity_key = coalesce(entity_id::text, entity_label, check_id)
 where entity_key is null;

alter table guardian_finding alter column entity_key set default '';
alter table guardian_finding alter column entity_key set not null;

-- Drop whatever the old unique constraint was called rather than guessing at
-- the generated name.
do $$
declare
  v_name text;
begin
  for v_name in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
     where rel.relname = 'guardian_finding'
       and con.contype = 'u'
  loop
    execute format('alter table guardian_finding drop constraint %I', v_name);
  end loop;
end $$;

-- Per-item stockout findings are the wrong shape now. Deleting rather than
-- leaving them to expire, because they would sit on the screen looking
-- current until the next run.
delete from guardian_finding
 where check_id = 'stockout_risk' and entity_type = 'inventory_sku';

alter table guardian_finding
  add constraint guardian_finding_identity_key
  unique (company_id, check_id, entity_type, entity_key);

-- ---------------------------------------------------------------------------
-- 2. Check — stock that cannot be true
--
-- Runs before the stockout check, because until this is reconciled the stock
-- figures feeding that check are not worth forecasting from.
--
-- One finding for the whole company, not one per item. This is a single
-- investigation — someone reconciles the ledger — not forty separate jobs.
-- ---------------------------------------------------------------------------
create or replace function guardian_check_impossible_stock()
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

  with moving as (
    -- Items that have actually moved. Something sitting at zero having never
    -- been traded is not evidence of anything.
    select distinct sku_id from inventory_movement where company_id = v_company
  ),
  bad as (
    select
      s.id, s.sku, s.name, s.quantity_on_hand, s.supplier,
      coalesce(sum(case when m.type = 'inbound' then m.quantity else 0 end), 0)  as received,
      coalesce(sum(case when m.type = 'outbound' then m.quantity else 0 end), 0) as shipped
    from inventory_sku s
    left join inventory_movement m on m.sku_id = s.id and m.company_id = v_company
    where s.company_id = v_company
      and s.quantity_on_hand < 0
    group by s.id, s.sku, s.name, s.quantity_on_hand, s.supplier
  ),
  ranked as (
    select b.*, row_number() over (order by b.quantity_on_hand) as rn
    from bad b
  ),
  summary as (
    select
      count(*)                          as items,
      min(quantity_on_hand)             as worst,
      sum(quantity_on_hand)             as net_units,
      (select count(*) from moving)     as items_moving,
      jsonb_agg(
        jsonb_build_object(
          'sku', sku, 'name', name, 'on_hand', quantity_on_hand,
          'received', received, 'shipped', shipped
        ) order by quantity_on_hand
      ) filter (where rn <= 10)         as sample
    from ranked
  )
  insert into guardian_finding as f (
    company_id, check_id, severity, title, detail, modules,
    entity_type, entity_id, entity_key, entity_label, evidence, recommendation, status
  )
  select
    v_company,
    'impossible_stock',
    case
      when s.items::numeric / nullif(s.items_moving, 0) > 0.05 then 'critical'
      else 'high'
    end,
    s.items || ' item' || case when s.items = 1 then '' else 's' end ||
      ' show negative stock, which cannot be true',
    'Stock cannot go below nothing. ' || s.items ||
      ' item' || case when s.items = 1 then ' shows' else 's show' end ||
      ' a negative figure, the worst at ' || s.worst ||
      '. That means goods left the building the system never recorded arriving — ' ||
      'unrecorded receipts, mis-picks, or despatches posted against the wrong item. ' ||
      'Until these are reconciled, no forecast built on stock figures can be trusted, ' ||
      'so they have been left out of the reorder check.',
    array['inventory'],
    'company',
    null,
    'negative_stock',
    'Stock records',
    jsonb_build_object(
      'items_affected',  s.items,
      'items_moving',    s.items_moving,
      'worst_on_hand',   s.worst,
      'net_units',       s.net_units,
      'sample',          s.sample
    ),
    'Reconcile these against a physical count, then correct the ledger with an ' ||
      'adjustment movement rather than editing the stock figure directly.',
    'open'
  from summary s
  where s.items > 0
  on conflict (company_id, check_id, entity_type, entity_key) do update
    set severity       = excluded.severity,
        title          = excluded.title,
        detail         = excluded.detail,
        evidence       = excluded.evidence,
        recommendation = excluded.recommendation,
        last_seen_at   = now(),
        status         = case when f.status = 'resolved' then 'open' else f.status end;

  get diagnostics v_found = row_count;

  update guardian_finding
     set status = 'expired'
   where company_id = v_company
     and check_id = 'impossible_stock'
     and status = 'open'
     and last_seen_at < now() - interval '1 minute';

  return v_found;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Check — stockout risk, grouped by supplier
--
-- Same arithmetic as 0015. Items with impossible stock are excluded and
-- handled above; items sitting at exactly zero are kept, because that is a
-- genuine out-of-stock and not a broken record.
-- ---------------------------------------------------------------------------
create or replace function guardian_check_stockout(
  p_days      integer default 90,
  p_lead_days integer default 10
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

  with usage as (
    select m.sku_id, sum(m.quantity)::numeric as units_out
    from inventory_movement m
    where m.company_id = v_company
      and m.type = 'outbound'
      and m.date >= current_date - p_days
    group by m.sku_id
  ),
  calc as (
    select
      s.id, s.sku, s.name, s.quantity_on_hand, s.quantity_reserved,
      s.reorder_level, s.reorder_quantity,
      coalesce(nullif(trim(s.supplier), ''), 'Unknown supplier') as supplier,
      u.units_out,
      round(u.units_out / p_days, 2) as daily_rate,
      greatest(s.quantity_on_hand - s.quantity_reserved, 0) as available
    from inventory_sku s
    join usage u on u.sku_id = s.id
    where s.company_id = v_company
      and u.units_out > 0
      -- Impossible stock is a records problem, not a forecast. Handled by
      -- guardian_check_impossible_stock().
      and s.quantity_on_hand >= 0
  ),
  projected as (
    select
      c.*,
      floor(c.available / c.daily_rate)::integer as days_to_zero,
      floor(greatest(c.available - c.reorder_level, 0) / c.daily_rate)::integer as days_to_reorder
    from calc c
    where c.daily_rate > 0
  ),
  scored as (
    select
      p.*,
      case
        when p.days_to_zero <= p_lead_days              then 'critical'
        when p.days_to_zero <= round(p_lead_days * 1.5) then 'high'
        when p.days_to_reorder <= 3                     then 'medium'
        else null
      end as severity
    from projected p
  ),
  flagged as (
    select
      s.*,
      case s.severity when 'critical' then 1 when 'high' then 2 else 3 end as sev_rank,
      row_number() over (partition by s.supplier
                         order by s.days_to_zero, s.sku) as rn
    from scored s
    where s.severity is not null
  ),
  grouped as (
    select
      supplier,
      count(*)                                             as items,
      count(*) filter (where severity = 'critical')        as items_late,
      min(sev_rank)                                        as worst_rank,
      min(days_to_zero)                                    as soonest,
      sum(reorder_quantity)                                as order_units,
      (array_agg(sku order by days_to_zero, sku))[1]       as worst_sku,
      -- The line items, most urgent first. Ten is enough to act on; the count
      -- above says how many there are in total.
      jsonb_agg(
        jsonb_build_object(
          'sku', sku, 'days_to_zero', days_to_zero, 'available', available,
          'daily_rate', daily_rate, 'order', reorder_quantity
        ) order by days_to_zero, sku
      ) filter (where rn <= 10)                            as items_list
    from flagged
    group by supplier
  )
  insert into guardian_finding as f (
    company_id, check_id, severity, title, detail, modules,
    entity_type, entity_id, entity_key, entity_label, evidence, recommendation, status
  )
  select
    v_company,
    'stockout_risk',
    case g.worst_rank when 1 then 'critical' when 2 then 'high' else 'medium' end,
    g.supplier || ' — ' || g.items || ' item' || case when g.items = 1 then '' else 's' end ||
      case when g.items_late > 0
           then ', ' || g.items_late || ' already past ordering time'
           else ' approaching reorder' end,
    'The most urgent is ' || g.worst_sku || ' with ' || g.soonest ||
      ' day' || case when g.soonest = 1 then '' else 's' end || ' of cover. ' ||
      case when g.items_late > 0
           then g.items_late || ' of these ' ||
                case when g.items_late = 1 then 'is' else 'are' end ||
                ' already inside the ' || p_lead_days ||
                '-day lead time, so ordering today still leaves a gap. '
           else '' end ||
      'All ' || g.items || ' come from the same supplier, so this is one order.',
    array['inventory'],
    'supplier',
    null,
    g.supplier,
    g.supplier,
    jsonb_build_object(
      'supplier',           g.supplier,
      'items_short',        g.items,
      'items_already_late', g.items_late,
      'soonest_days',       g.soonest,
      'worst_item',         g.worst_sku,
      'units_to_order',     g.order_units,
      'days_observed',      p_days,
      'assumed_lead_days',  p_lead_days,
      'items',              g.items_list,
      'lead_time_source',   'assumed — no per-supplier lead time is recorded'
    ),
    'Raise one order to ' || g.supplier || ' covering ' || g.items ||
      ' line' || case when g.items = 1 then '' else 's' end ||
      ', about ' || g.order_units || ' units.',
    'open'
  from grouped g
  on conflict (company_id, check_id, entity_type, entity_key) do update
    set severity       = excluded.severity,
        title          = excluded.title,
        detail         = excluded.detail,
        evidence       = excluded.evidence,
        recommendation = excluded.recommendation,
        last_seen_at   = now(),
        status         = case when f.status = 'resolved' then 'open' else f.status end;

  get diagnostics v_found = row_count;

  update guardian_finding
     set status = 'expired'
   where company_id = v_company
     and check_id = 'stockout_risk'
     and status = 'open'
     and last_seen_at < now() - interval '1 minute';

  return v_found;
end $$;

-- ---------------------------------------------------------------------------
-- 4. The capacity check keyed on entity_id, which is now entity_key
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
    select site_id, count(*)::numeric as vehicles from serving group by site_id
  ),
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
    from booked group by site_id
  ),
  by_day as (
    select site_id, scheduled_date, count(distinct vehicle_id)::int as n
    from booked group by site_id, scheduled_date
  ),
  worst as (
    select distinct on (site_id) site_id, scheduled_date, n
    from by_day order by site_id, n desc, scheduled_date
  ),
  joined as (
    select
      w.id as site_id, w.name as site_name,
      r.dock_now, r.pending_now, r.orders_per_day,
      b.dock_before, b.pending_before,
      f.vehicles, bt.off_road,
      wd.scheduled_date as worst_date, wd.n as worst_n,
      round(wd.n / f.vehicles * 100, 0)       as clash_pct,
      round(bt.off_road / f.vehicles * 100, 0) as horizon_pct,
      (r.dock_now - b.dock_before)             as dock_shift,
      round((r.pending_now - b.pending_before)
              / nullif(b.pending_before, 0) * 100, 0) as pending_shift_pct
    from warehouse_site w
    join recent       r  on r.site_id  = w.id
    join base         b  on b.site_id  = w.id
    join fleet_size   f  on f.site_id  = w.id
    join booked_total bt on bt.site_id = w.id
    join worst        wd on wd.site_id = w.id
    where w.company_id = v_company
      and f.vehicles >= p_min_fleet
  ),
  scored as (
    select j.*,
      (j.dock_now >= p_busy_pct
        or j.dock_shift >= 4
        or coalesce(j.pending_shift_pct, 0) >= 20) as pressured
    from joined j
  ),
  graded as (
    select s.*,
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
    entity_type, entity_id, entity_key, entity_label, evidence, recommendation, status
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
    g.site_id::text,
    g.site_name,
    jsonb_build_object(
      'site_name',               g.site_name,
      'vehicles_serving',        g.vehicles::int,
      'worst_day',               trim(to_char(g.worst_date, 'FMDay DD Mon')),
      'worst_day_vehicles',      g.worst_n,
      'share_gone_pct',          g.clash_pct,
      'vehicles_booked_out',     g.off_road::int,
      'share_horizon_pct',       g.horizon_pct,
      'days_until',              (g.worst_date - current_date),
      'horizon_days',            p_horizon,
      'dock_utilization_now',    g.dock_now,
      'dock_utilization_before', g.dock_before,
      'orders_pending_now',      g.pending_now,
      'orders_pending_before',   g.pending_before,
      'orders_per_day',          g.orders_per_day,
      'days_recent',             p_recent,
      'days_baseline',           p_baseline,
      'link_source',             'inferred from where trips started — no depot is recorded against a vehicle'
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
  on conflict (company_id, check_id, entity_type, entity_key) do update
    set severity       = excluded.severity,
        title          = excluded.title,
        detail         = excluded.detail,
        evidence       = excluded.evidence,
        recommendation = excluded.recommendation,
        last_seen_at   = now(),
        status         = case when f.status = 'resolved' then 'open' else f.status end;

  get diagnostics v_found = row_count;

  update guardian_finding
     set status = 'expired'
   where company_id = v_company
     and check_id = 'capacity_clash'
     and status = 'open'
     and last_seen_at < now() - interval '1 minute';

  return v_found;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Run order. Records problems first — they change what the others can trust.
-- ---------------------------------------------------------------------------
create or replace function guardian_run_all()
returns integer
language plpgsql
security invoker
as $$
declare
  v_total integer := 0;
begin
  v_total := v_total + guardian_check_impossible_stock();
  v_total := v_total + guardian_check_stockout();
  v_total := v_total + guardian_check_capacity_clash();
  return v_total;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_name = 'guardian_finding' and column_name = 'entity_key')   as entity_key_added,
  (select count(*) from pg_constraint con join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'guardian_finding' and con.contype = 'u')           as unique_rules,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'guardian_%')             as guardian_functions;
-- Expect: 1, 1, 4
--
-- Then run everything again:
--
--   select guardian_run_all();
--
--   select check_id, severity, title
--   from guardian_finding
--   where status = 'open'
--   order by case severity when 'critical' then 1 when 'high' then 2
--                          when 'medium' then 3 else 4 end, title;
--
-- 81 findings should become a readable handful.

-- 0018 — Guardian: how a finding reads when it covers one item
--
-- With realistic data most supplier findings cover a single item, and the
-- wording written for a group falls apart:
--
--   "Supplier 11 — 1 item, 1 already past ordering time"
--   "1 of these is already inside the 10-day lead time ...
--    All 1 come from the same supplier, so this is one order."
--
-- "All 1 come" is not English, and explaining that one item comes from one
-- supplier is not information. This is the copy an operations manager judges
-- the product by in the first ten seconds, so it gets said properly.
--
-- One item now names the item and says how late it is in days, which is the
-- number somebody acts on. Groups keep the wording that was right for them.
--
-- Arithmetic untouched.
--
-- Safe to re-run.

begin;

do $$
begin
  if to_regproc('public.guardian_check_stockout') is null then
    raise exception 'guardian_check_stockout() is missing — apply 0015 and 0017 first';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_name = 'guardian_finding' and column_name = 'entity_key'
  ) then
    raise exception 'guardian_finding.entity_key is missing — apply 0017 first';
  end if;
end $$;

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
      row_number() over (partition by s.supplier order by s.days_to_zero, s.sku) as rn
    from scored s
    where s.severity is not null
  ),
  grouped as (
    select
      supplier,
      count(*)                                        as items,
      count(*) filter (where severity = 'critical')   as items_late,
      min(sev_rank)                                   as worst_rank,
      min(days_to_zero)                               as soonest,
      sum(reorder_quantity)                           as order_units,
      (array_agg(sku  order by days_to_zero, sku))[1] as worst_sku,
      (array_agg(name order by days_to_zero, sku))[1] as worst_name,
      jsonb_agg(
        jsonb_build_object(
          'sku', sku, 'days_to_zero', days_to_zero, 'available', available,
          'daily_rate', daily_rate, 'order', reorder_quantity
        ) order by days_to_zero, sku
      ) filter (where rn <= 10)                       as items_list
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

    -- Title
    case when g.items = 1
      then g.supplier || ' — ' || g.worst_sku || ', ' || g.soonest ||
           ' day' || case when g.soonest = 1 then '' else 's' end || ' of cover'
      else g.supplier || ' — ' || g.items || ' items' ||
           case when g.items_late > 0
                then ', ' || g.items_late || ' already past ordering time'
                else ' approaching reorder' end
    end,

    -- Detail
    case when g.items = 1 then
      g.worst_name || ' has ' || g.soonest ||
      ' day' || case when g.soonest = 1 then '' else 's' end || ' of cover. ' ||
      case when g.items_late > 0
        then 'A replacement order takes about ' || p_lead_days ||
             ' days, so ordering today still leaves ' || (p_lead_days - g.soonest) ||
             ' day' || case when (p_lead_days - g.soonest) = 1 then '' else 's' end ||
             ' with nothing on the shelf.'
        else 'A replacement order takes about ' || p_lead_days ||
             ' days, so ordering now arrives in time. Leaving it another week does not.'
      end
    else
      'The most urgent is ' || g.worst_sku || ' with ' || g.soonest ||
      ' day' || case when g.soonest = 1 then '' else 's' end || ' of cover. ' ||
      case when g.items_late > 0
        then g.items_late || ' of these ' ||
             case when g.items_late = 1 then 'is' else 'are' end ||
             ' already inside the ' || p_lead_days ||
             '-day lead time, so ordering today still leaves a gap. '
        else '' end ||
      'All ' || g.items || ' come from the same supplier, so this is one order.'
    end,

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

    -- Recommendation
    case when g.items = 1
      then 'Raise an order to ' || g.supplier || ' for ' || g.order_units ||
           ' units of ' || g.worst_sku || '.'
      else 'Raise one order to ' || g.supplier || ' covering ' || g.items ||
           ' lines, about ' || g.order_units || ' units.'
    end,

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

commit;

-- ---------------------------------------------------------------------------
-- Verify — press "Run checks" on the Guardian screen, or:
--
--   select guardian_run_all();
--
--   select title, detail from guardian_finding
--   where check_id = 'stockout_risk' and status = 'open'
--   order by (evidence->>'items_short')::int, title;
--
-- The single-item findings should now name the item and say how many days
-- with nothing on the shelf ordering today would still leave. No "All 1".
-- ---------------------------------------------------------------------------
select count(*) as stockout_findings
from guardian_finding where check_id = 'stockout_risk';

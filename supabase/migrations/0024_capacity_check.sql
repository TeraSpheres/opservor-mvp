-- 0024 — the capacity check, now short
--
-- Part 2 of 2. Run 0022 and 0023 first.
--
-- All the analysis moved to guardian_capacity_rows(). What is left is the part
-- that decides how a finding reads, which is the part most likely to change.
--
-- The evidence now states where the vehicle-to-site link came from, rather than
-- always claiming it was inferred from trips. That line was true when it was
-- written and became a lie the moment depots could be recorded.

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
set search_path = public, pg_temp
as $$
declare
  v_company uuid := auth_company_id();
  v_found   integer := 0;
begin
  if v_company is null then return 0; end if;

  insert into guardian_finding as f (
    company_id, check_id, severity, title, detail, modules,
    entity_type, entity_id, entity_key, entity_label, evidence, recommendation, status
  )
  select
    v_company, 'capacity_clash', g.severity,
    g.site_name || ' loses ' || g.worst_n || ' of ' || g.vehicles::int ||
      ' vehicles on ' || trim(to_char(g.worst_date, 'FMDay')),
    g.vehicles::int || ' vehicles work from ' || g.site_name || '. ' || g.worst_n ||
      case when g.worst_n = 1 then ' of them is' else ' of them are' end ||
      ' booked in for service on ' || trim(to_char(g.worst_date, 'FMDay DD Mon')) ||
      ' — ' || g.clash_pct || '% of the site''s vehicles gone on one day' ||
      case when g.off_road::int > g.worst_n
           then ', ' || g.off_road::int || ' across the next ' || p_horizon || ' days.'
           else '.' end || ' ' ||
      case
        when g.dock_shift >= 4 then 'Dock use here has risen from ' ||
             g.dock_before || '% to ' || g.dock_now || '% over the same period.'
        when coalesce(g.pending_shift_pct, 0) >= 20 then 'Orders waiting here are up ' ||
             g.pending_shift_pct || '% on the previous few weeks.'
        when g.dock_now >= p_busy_pct then 'The site is already running at ' ||
             g.dock_now || '% dock use.'
        else 'The site is running at ' || g.dock_now || '% dock use, in line with usual.'
      end || ' It handles about ' || g.orders_per_day || ' orders a day.',
    array['warehouse', 'fleet'], 'warehouse_site', g.site_id, g.site_id::text, g.site_name,
    jsonb_build_object(
      'site_name', g.site_name, 'vehicles_serving', g.vehicles::int,
      'worst_day', trim(to_char(g.worst_date, 'FMDay DD Mon')),
      'worst_day_vehicles', g.worst_n, 'share_gone_pct', g.clash_pct,
      'vehicles_booked_out', g.off_road::int, 'share_horizon_pct', g.horizon_pct,
      'days_until', (g.worst_date - current_date), 'horizon_days', p_horizon,
      'dock_utilization_now', g.dock_now, 'dock_utilization_before', g.dock_before,
      'orders_pending_now', g.pending_now, 'orders_pending_before', g.pending_before,
      'orders_per_day', g.orders_per_day, 'days_recent', p_recent,
      'days_baseline', p_baseline, 'link_source', g.link_source
    ),
    case when g.worst_n = 1
      then 'Move the ' || trim(to_char(g.worst_date, 'FMDay')) ||
           ' booking to a quieter day, or bring a vehicle across from another site.'
      else 'Move ' || (g.worst_n - 1) || ' of the ' || trim(to_char(g.worst_date, 'FMDay')) ||
           ' bookings to a quieter day, or bring vehicles across from another site.'
    end,
    'open'
  from guardian_capacity_rows(p_recent, p_baseline, p_horizon, p_busy_pct, p_min_fleet) g
  where g.severity is not null
  on conflict (company_id, check_id, entity_type, entity_key) do update
    set severity = excluded.severity, title = excluded.title,
        detail = excluded.detail, evidence = excluded.evidence,
        recommendation = excluded.recommendation,
        last_seen_at = now(),
        status = case when f.status = 'resolved' then 'open' else f.status end;

  get diagnostics v_found = row_count;
  return v_found;
end $$;

select guardian_check_capacity_clash() as findings_written;

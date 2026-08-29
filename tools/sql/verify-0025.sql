-- Did migration 0025 take, and are there findings carrying the new field?
select
  (select case when prosrc like '%order_qty_source%' then 'yes' else 'NO' end
     from pg_proc where proname = 'guardian_check_stockout')      as function_updated,
  (select count(*) from guardian_finding
    where check_id = 'stockout_risk' and status = 'open')         as open_stockout_findings,
  (select count(*) from guardian_finding
    where check_id = 'stockout_risk'
      and evidence ? 'order_qty_source')                          as findings_with_new_field,
  (select max(last_seen_at) from guardian_finding
    where check_id = 'stockout_risk')                             as last_run;

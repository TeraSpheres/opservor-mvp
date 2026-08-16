-- 0021 — Guardian says why it could not check something
--
-- THE PROBLEM
--
-- Every check begins the same way:
--
--   v_company uuid := auth_company_id();
--   if v_company is null then
--     return 0;
--   end if;
--
-- Returning zero means "I looked and found nothing wrong". But a check that
-- could not identify the company did not look at all. The two are reported
-- identically, and the screen renders both as "Nothing to flag."
--
-- That cost an afternoon on a database where the sign-in had no app_user row.
-- Guardian reported all-clear, repeatedly, on a company it could not see.
--
-- The capacity check has the same shape and a wider blast radius. It works out
-- which vehicles serve which site by matching a trip's starting point against a
-- warehouse site's name, exactly:
--
--   join warehouse_site w on w.name = t.origin
--
-- Nothing records the mapping properly, so this is the only honest source
-- available — but when no trip origin happens to match a site name, the join is
-- empty, no site has a fleet, and the check returns zero. Silently. A real
-- customer whose trips carry street addresses rather than depot names would
-- have that check never fire, for the life of their account, and be told
-- everything was fine.
--
-- A tool whose entire job is to say what is wrong must never go quiet when it
-- is the tool that is broken.
--
-- THE FIX
--
-- A separate function that reports what each check needs and whether it has it.
-- Additive: no existing function changes, so nothing that works today breaks.
-- The screen calls it alongside the findings and shows anything not ready.
--
-- Deliberately not merged into guardian_run_all(). That returns a count and is
-- called by the page and by hand; changing its shape would break both. Two
-- functions with one job each beats one function with two.
--
-- Safe to re-run.

begin;

do $$
begin
  if to_regproc('public.auth_company_id') is null then
    raise exception 'auth_company_id() is missing — apply 0014 first';
  end if;
end $$;

create or replace function guardian_readiness()
returns table (area text, ready boolean, reason text)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_company  uuid := auth_company_id();
  v_skus     integer;
  v_outbound integer;
  v_sites    integer;
  v_serving  integer;
  v_booked   integer;
begin
  -- The failure that started all this. Reported first and alone, because when
  -- the company is unknown nothing else can be assessed either, and listing
  -- four further problems would bury the one that matters.
  if v_company is null then
    return query
      select
        'Your account'::text,
        false,
        ('This sign-in is not linked to a company, so no check can run and '
         || 'every one of them will keep reporting nothing. It is a sign-in '
         || 'problem, not a clean bill of health.')::text;
    return;
  end if;

  select count(*) into v_skus
    from inventory_sku where company_id = v_company;

  -- The stockout check needs a daily rate, and a daily rate needs outbound
  -- movements inside the window it looks at. Stock that never moves has no
  -- rate and therefore no runway, which is correct and worth stating.
  select count(*) into v_outbound
    from inventory_movement
   where company_id = v_company
     and type = 'outbound'
     and date >= current_date - 90;

  select count(*) into v_sites
    from warehouse_snapshot
   where company_id = v_company
     and date >= current_date - 28;

  -- The inference the capacity check rests on, measured directly.
  select count(*) into v_serving
    from (
      select distinct t.vehicle_id
        from fleet_trip t
        join warehouse_site w
          on w.company_id = t.company_id
         and w.name = t.origin
       where t.company_id = v_company
         and t.date >= current_date - 30
    ) s;

  select count(*) into v_booked
    from fleet_maintenance
   where company_id = v_company
     and scheduled_date between current_date and current_date + 14;

  return query select
    'Impossible stock'::text,
    v_skus > 0,
    (case when v_skus > 0 then null
          else 'No stock items are recorded for this company.' end)::text;

  return query select
    'Stock cover'::text,
    v_outbound > 0,
    (case when v_outbound > 0 then null
          else 'Nothing has gone out in the last 90 days, so there is no rate '
               || 'of use to project a runway from.' end)::text;

  -- Three separate requirements, reported together, because being told only
  -- the first of three missing things is how an afternoon disappears.
  return query select
    'Capacity clash'::text,
    (v_sites > 0 and v_serving > 0 and v_booked > 0),
    nullif(concat_ws(' ',
      case when v_sites = 0
        then 'No warehouse figures have been recorded in the last 28 days.' end,
      case when v_serving = 0
        then 'No vehicle could be matched to a site. A trip is matched to a '
             || 'site when its starting point is exactly that site''s name, '
             || 'and none of the last 30 days of trips matched. Until they do, '
             || 'this check cannot run at all.' end,
      case when v_booked = 0
        then 'No maintenance is booked in the next 14 days, so there is no '
             || 'clash to find.' end
    ), '')::text;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
--   select * from guardian_readiness();
--
-- Signed in through the app, expect four rows — or one row saying the account
-- is not linked. Run here in the SQL editor there is no signed-in user, so
-- auth_company_id() is null and the single "Your account" row is the correct
-- and expected answer. That is the function working, not failing.
select count(*) as readiness_function
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'guardian_readiness';
-- Expect: 1

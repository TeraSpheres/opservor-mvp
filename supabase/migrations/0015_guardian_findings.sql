-- 0015 — Guardian: findings, and the first check
--
-- Guardian has two jobs, and they are different jobs. The first is working out
-- what is true. The second is saying it well. A language model is good at the
-- second and cannot do the first at all — it knows only what it is handed, so
-- given nothing true it produces something fluent and wrong. In operations
-- that is worse than silence.
--
-- This is the first job. Arithmetic over real history, in the database, where
-- it can see all 800 rows rather than the first page of them.
--
-- WHAT A FINDING IS
--
-- Not an alert. An alert says a threshold was crossed — the stock screen
-- already does that. A finding says what is going to happen and shows the
-- numbers it used to get there. An operations manager will not act on a bare
-- assertion, and should not.
--
-- Safe to re-run.

begin;

do $$
begin
  if to_regproc('public.auth_company_id') is null then
    raise exception 'auth_company_id() is missing — apply 0001 first';
  end if;
  if to_regproc('public.can_read') is null then
    raise exception 'can_read() is missing — apply 0014 first';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Findings
-- ---------------------------------------------------------------------------
create table if not exists guardian_finding (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references company(id) on delete cascade,

  -- Which check produced this. Text so a new check needs no migration.
  check_id     text not null,

  severity     text not null
                 check (severity in ('critical', 'high', 'medium', 'low')),

  title        text not null,
  detail       text not null,

  -- The parts of the business this drew on. The whole point is findings that
  -- span more than one, so this is an array rather than a single value.
  modules      text[] not null default '{}',

  -- What it is about, so the interface can link straight to it.
  entity_type  text,
  entity_id    uuid,
  entity_label text,

  -- The numbers behind the conclusion. Shown to the reader, never hidden —
  -- a finding that will not show its working is one nobody will act on.
  evidence     jsonb not null default '{}'::jsonb,

  recommendation text,

  status       text not null default 'open'
                 check (status in ('open', 'acknowledged', 'resolved', 'expired')),

  -- Kept so you can see what Guardian said last week and whether it was
  -- right. Without that history there is no way to tell whether any of this
  -- is working.
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- One open finding per check per thing. Re-running updates rather than
  -- piling up a fresh copy every time, which is how these become noise.
  unique (company_id, check_id, entity_type, entity_id)
);

create index if not exists guardian_finding_open_idx
  on guardian_finding (company_id, status, severity, last_seen_at desc);

alter table guardian_finding enable row level security;

-- Findings can draw on any module, so reading one is gated on being able to
-- read everything it drew on. A staff member with fleet access only must not
-- learn about finance through a Guardian summary — that would make the
-- module rules decorative.
create or replace function can_read_all(p_modules text[])
returns boolean
language sql
security definer
stable
as $$
  select coalesce(bool_and(can_read(m)), true) from unnest(p_modules) as m
$$;

drop policy if exists "guardian_finding read" on guardian_finding;
create policy "guardian_finding read" on guardian_finding
  for select
  using (company_id = auth_company_id() and can_read_all(modules));

-- Guardian writes findings; people only change their status. Both are gated
-- on core write access.
drop policy if exists "guardian_finding write" on guardian_finding;
create policy "guardian_finding write" on guardian_finding
  for all
  using (company_id = auth_company_id() and can_write('core'))
  with check (company_id = auth_company_id() and can_write('core'));

drop trigger if exists update_guardian_finding_updated_at on guardian_finding;
create trigger update_guardian_finding_updated_at
  before update on guardian_finding
  for each row execute function update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Check 1 — stockout risk
--
-- The stock screen shows 143 units against a reorder level of 60 and calls it
-- healthy. It is not healthy if 20 units a day are leaving and the supplier
-- takes ten days. That gap is the whole product.
--
-- p_days       how much history to average over
-- p_lead_days  assumed days to receive an order
--
-- Lead time is a parameter and not a column because inventory_sku has no
-- lead-time field. That is a real gap: until per-supplier lead times are
-- captured, this is an assumption, and it is stated in the evidence so
-- nobody mistakes it for a measurement.
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
    select
      m.sku_id,
      sum(m.quantity)::numeric as units_out
    from inventory_movement m
    where m.company_id = v_company
      and m.type = 'outbound'
      and m.date >= current_date - p_days
    group by m.sku_id
  ),
  calc as (
    select
      s.id,
      s.sku,
      s.name,
      s.quantity_on_hand,
      s.quantity_reserved,
      s.reorder_level,
      s.reorder_quantity,
      s.supplier,
      u.units_out,
      -- Average daily consumption over the observed window.
      round(u.units_out / p_days, 2) as daily_rate,
      greatest(s.quantity_on_hand - s.quantity_reserved, 0) as available
    from inventory_sku s
    join usage u on u.sku_id = s.id
    where s.company_id = v_company
      and u.units_out > 0
  ),
  projected as (
    select
      c.*,
      -- Days until nothing is left, and days until the reorder level is hit.
      floor(c.available / c.daily_rate)::integer as days_to_zero,
      floor(greatest(c.available - c.reorder_level, 0) / c.daily_rate)::integer as days_to_reorder
    from calc c
    where c.daily_rate > 0
  ),
  scored as (
    select
      p.*,
      case
        -- Already too late to order and arrive in time.
        when p.days_to_zero <= p_lead_days                  then 'critical'
        when p.days_to_zero <= round(p_lead_days * 1.5)     then 'high'
        when p.days_to_reorder <= 3                         then 'medium'
        else null
      end as severity
    from projected p
  )
  insert into guardian_finding as f (
    company_id, check_id, severity, title, detail, modules,
    entity_type, entity_id, entity_label, evidence, recommendation, status
  )
  select
    v_company,
    'stockout_risk',
    s.severity,
    s.sku || ' runs out in ' || s.days_to_zero || ' day' || case when s.days_to_zero = 1 then '' else 's' end,
    s.name || ' is leaving at ' || s.daily_rate || ' a day. ' ||
      s.available || ' available now, so ' || s.days_to_zero || ' days of cover. ' ||
      case
        when s.days_to_zero <= p_lead_days
          then 'A replacement order takes about ' || p_lead_days || ' days, so this is already late.'
        else 'Reorder level is reached in ' || s.days_to_reorder || ' days.'
      end,
    array['inventory'],
    'inventory_sku',
    s.id,
    s.sku || ' — ' || s.name,
    jsonb_build_object(
      'units_shipped',     s.units_out,
      'days_observed',     p_days,
      'daily_rate',        s.daily_rate,
      'quantity_on_hand',  s.quantity_on_hand,
      'quantity_reserved', s.quantity_reserved,
      'available',         s.available,
      'reorder_level',     s.reorder_level,
      'days_to_zero',      s.days_to_zero,
      'days_to_reorder',   s.days_to_reorder,
      'assumed_lead_days', p_lead_days,
      'lead_time_source',  'assumed — no per-supplier lead time is recorded'
    ),
    'Order ' || s.reorder_quantity || ' units' ||
      case when s.supplier is not null then ' from ' || s.supplier else '' end || '.',
    'open'
  from scored s
  where s.severity is not null
  on conflict (company_id, check_id, entity_type, entity_id) do update
    set severity       = excluded.severity,
        title          = excluded.title,
        detail         = excluded.detail,
        evidence       = excluded.evidence,
        recommendation = excluded.recommendation,
        last_seen_at   = now(),
        -- A finding that had been resolved and is true again reopens.
        status         = case when f.status = 'resolved' then 'open' else f.status end;

  get diagnostics v_found = row_count;

  -- Anything this check raised before and no longer holds is closed out, so
  -- the screen shows what is true now rather than everything ever noticed.
  update guardian_finding
     set status = 'expired'
   where company_id = v_company
     and check_id = 'stockout_risk'
     and status = 'open'
     and last_seen_at < now() - interval '1 minute';

  return v_found;
end $$;

-- Runs every check. One call for the interface, and the place new checks get
-- added as they are written.
create or replace function guardian_run_all()
returns integer
language plpgsql
security invoker
as $$
declare
  v_total integer := 0;
begin
  v_total := v_total + guardian_check_stockout();
  return v_total;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
select
  (select count(*) from information_schema.tables
    where table_name = 'guardian_finding')                       as table_created,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('guardian_check_stockout','guardian_run_all','can_read_all')) as functions,
  (select count(*) from pg_policies where tablename = 'guardian_finding') as policies;
-- Expect: 1, 3, 2
--
-- Then run the check and look at what it found:
--
--   select guardian_run_all();
--
--   select severity, title, recommendation
--   from guardian_finding
--   where status = 'open'
--   order by case severity when 'critical' then 1 when 'high' then 2 else 3 end,
--            (evidence->>'days_to_zero')::int
--   limit 20;

-- 0010 — Fleet maintenance
--
-- fleet_vehicle.status could already be 'maintenance', but there was nothing
-- recording what the maintenance was, when it was due, what it cost, or who
-- did it. A status with no record behind it cannot answer "is anything
-- overdue" — which is the whole reason to track maintenance.
--
-- Follows the conventions in TS-PROD-001 §5.1: company_id on the table, RLS
-- with USING and WITH CHECK, uuid keys, created_at + updated_at + trigger.
--
-- This is a state table, not a ledger: a maintenance job is scheduled, then
-- worked, then completed, so the row legitimately changes.
--
-- Safe to re-run.

begin;

do $$
begin
  if to_regclass('public.fleet_vehicle') is null then
    raise exception 'fleet_vehicle does not exist — apply 0003 (or RUN_ME_fleet_inventory.sql) first';
  end if;
  if to_regproc('public.auth_company_id') is null then
    raise exception 'auth_company_id() is missing — apply 0001 first';
  end if;
end $$;

create table if not exists fleet_maintenance (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references company(id) on delete cascade,
  vehicle_id     uuid not null references fleet_vehicle(id) on delete cascade,

  -- Text rather than an enum. The option list in src/lib/fleet-options.ts is
  -- long and will grow; a check constraint would mean a migration every time
  -- an operator needs a service type nobody thought of.
  type           text not null,

  status         text not null default 'scheduled'
                   check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  priority       text not null default 'routine'
                   check (priority in ('routine', 'high', 'critical')),

  scheduled_date date,
  completed_date date,

  -- Odometer at the time of service. Kept separately from
  -- fleet_vehicle.mileage, which 0009 derives from trips — this is what the
  -- technician actually read off the dash.
  odometer       integer,

  cost           numeric(10,2),
  vendor         text,
  reference      text,          -- work order / invoice number
  notes          text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- A completed job must say when. Anything else must not claim a date.
  constraint fleet_maintenance_completed_date_check
    check (
      (status = 'completed' and completed_date is not null)
      or (status <> 'completed' and completed_date is null)
    )
);

create index if not exists fleet_maintenance_vehicle_idx
  on fleet_maintenance (company_id, vehicle_id);
create index if not exists fleet_maintenance_due_idx
  on fleet_maintenance (company_id, status, scheduled_date);

alter table fleet_maintenance enable row level security;

-- PostgreSQL has no CREATE POLICY IF NOT EXISTS, so drop first to stay
-- re-runnable.
drop policy if exists "founder full access to fleet_maintenance" on fleet_maintenance;
create policy "founder full access to fleet_maintenance"
  on fleet_maintenance
  for all
  using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

drop trigger if exists update_fleet_maintenance_updated_at on fleet_maintenance;
create trigger update_fleet_maintenance_updated_at
  before update on fleet_maintenance
  for each row execute function update_updated_at_column();

commit;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
select
  (select count(*) from information_schema.tables
    where table_name = 'fleet_maintenance')                       as table_exists,
  (select count(*) from pg_policies
    where tablename = 'fleet_maintenance')                        as policies,
  (select count(*) from pg_trigger
    where tgname = 'update_fleet_maintenance_updated_at'
      and not tgisinternal)                                       as update_trigger,
  (select relrowsecurity from pg_class
    where relname = 'fleet_maintenance')                          as rls_enabled;
-- Expect: 1, 1, 1, true

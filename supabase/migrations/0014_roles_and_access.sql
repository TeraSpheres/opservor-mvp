-- 0014 — Roles and module access
--
-- Until now there was one role, and the database enforced it:
--
--   role text not null default 'founder' check (role = 'founder')
--
-- Every table's policy then granted full access to any authenticated member
-- of the tenant. With one person per customer that is fine. The moment a
-- customer has two staff, the warehouse supervisor can read every salary and
-- delete every invoice. TS-PROD-001 §10, defect 2.
--
-- THE MODEL
--
--   Role decides what you can do.      Module access decides where.
--
--   owner    everything, including users and integrations
--   manager  operational modules; HR and Finance only if granted
--   staff    only granted modules, read and write where granted
--   viewer   only granted modules, read only, never writes
--
-- HR and Finance are treated as sensitive: nobody but the owner sees them
-- without an explicit grant, not even a manager. Salary and performance data
-- leaking sideways is a privacy incident, not a bug, and defaults decide what
-- happens when nobody thinks about it.
--
-- NOTHING CHANGES TODAY
--
-- Your existing login becomes an owner, which has full access to everything.
-- The behaviour of the product is identical until you add a second user. That
-- is deliberate — a security change you cannot observe is one you can trust.
--
-- Safe to re-run.

begin;

do $$
begin
  if to_regproc('public.auth_company_id') is null then
    raise exception 'auth_company_id() is missing — apply 0001 first';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Roles
-- ---------------------------------------------------------------------------

-- Migrate before constraining. Applying the new check first would reject every
-- existing row and lock the only account out of the product.
update app_user set role = 'owner' where role = 'founder';

alter table app_user drop constraint if exists app_user_role_check;
alter table app_user
  add constraint app_user_role_check
  check (role in ('owner', 'manager', 'staff', 'viewer'));

alter table app_user alter column role set default 'staff';

-- ---------------------------------------------------------------------------
-- 2. Which modules a user may reach
-- ---------------------------------------------------------------------------
create table if not exists user_module_access (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references company(id) on delete cascade,
  app_user_id  uuid not null references app_user(id) on delete cascade,

  -- Text, not an enum: a new module should not need a migration.
  module       text not null,
  can_write    boolean not null default false,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (company_id, app_user_id, module)
);

create index if not exists user_module_access_user_idx
  on user_module_access (company_id, app_user_id);

-- ---------------------------------------------------------------------------
-- 3. Helpers
--
-- SECURITY DEFINER, like auth_company_id(). A policy on app_user that called a
-- function which itself reads app_user under RLS would recurse; running as the
-- definer breaks that cycle. They are read-only and scoped to the caller's own
-- row, so they cannot be used to reach another tenant.
-- ---------------------------------------------------------------------------

create or replace function auth_role()
returns text
language sql
security definer
stable
as $$
  select role from app_user where auth_id = auth.uid() limit 1
$$;

/** Modules nobody sees by default. */
create or replace function is_sensitive_module(p_module text)
returns boolean
language sql
immutable
as $$
  select p_module in ('hr', 'finance')
$$;

create or replace function can_read(p_module text)
returns boolean
language sql
security definer
stable
as $$
  select case
    -- Owner sees everything.
    when auth_role() = 'owner' then true

    -- Integrations hold connection settings. Owner only.
    when p_module = 'settings' then false

    -- Core is the dashboard: alerts, scores, the company itself. Anyone
    -- signed in to the tenant needs it or the product does not open.
    when p_module = 'core' then auth_role() is not null

    -- HR and Finance require an explicit grant regardless of role.
    when is_sensitive_module(p_module) then exists (
      select 1 from user_module_access a
      join app_user u on u.id = a.app_user_id
      where u.auth_id = auth.uid() and a.module = p_module
    )

    -- Managers get the operational modules without being listed one by one.
    when auth_role() = 'manager' then true

    -- Staff and viewers see only what they have been given.
    else exists (
      select 1 from user_module_access a
      join app_user u on u.id = a.app_user_id
      where u.auth_id = auth.uid() and a.module = p_module
    )
  end
$$;

create or replace function can_write(p_module text)
returns boolean
language sql
security definer
stable
as $$
  select case
    when auth_role() = 'owner' then true

    -- A viewer never writes. Checked before anything else so a stray grant
    -- cannot promote one.
    when auth_role() = 'viewer' then false

    when p_module = 'settings' then false
    when p_module = 'core' then auth_role() in ('manager', 'staff')

    when is_sensitive_module(p_module) then exists (
      select 1 from user_module_access a
      join app_user u on u.id = a.app_user_id
      where u.auth_id = auth.uid() and a.module = p_module and a.can_write
    )

    when auth_role() = 'manager' then true

    else exists (
      select 1 from user_module_access a
      join app_user u on u.id = a.app_user_id
      where u.auth_id = auth.uid() and a.module = p_module and a.can_write
    )
  end
$$;

-- ---------------------------------------------------------------------------
-- 4. Apply to every table
--
-- The old policy was one line per table: company_id = auth_company_id().
-- The tenant check stays exactly as it was — this adds the module check on
-- top of it. Tenant isolation is not being loosened, only narrowed further.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_module text;
begin
  for r in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename in (
        'alert','category_score','kpi_snapshot',
        'warehouse_site','warehouse_snapshot',
        'fleet_vehicle','fleet_trip','fleet_metrics','fleet_maintenance',
        'inventory_sku','inventory_movement','inventory_snapshot',
        'finance_cost_center','finance_transaction','finance_snapshot',
        'hr_department','hr_employee','hr_attendance','hr_performance','hr_snapshot',
        'safety_incident','safety_inspection','safety_snapshot',
        'report_definition','report_run',
        'integration_connection','integration_external_ref'
      )
  loop
    v_module := case split_part(r.tablename, '_', 1)
      when 'warehouse'   then 'warehouse'
      when 'fleet'       then 'fleet'
      when 'inventory'   then 'inventory'
      when 'finance'     then 'finance'
      when 'hr'          then 'hr'
      when 'safety'      then 'safety'
      when 'report'      then 'reports'
      when 'integration' then 'settings'
      else 'core'
    end;

    execute format('alter table %I enable row level security', r.tablename);
    execute format('drop policy if exists "founder full access to %s" on %I', r.tablename, r.tablename);
    execute format('drop policy if exists "module access to %s" on %I', r.tablename, r.tablename);
    execute format('drop policy if exists "%s read" on %I',   r.tablename, r.tablename);
    execute format('drop policy if exists "%s insert" on %I', r.tablename, r.tablename);
    execute format('drop policy if exists "%s update" on %I', r.tablename, r.tablename);
    execute format('drop policy if exists "%s delete" on %I', r.tablename, r.tablename);

    -- Four policies, not one FOR ALL.
    --
    -- A FOR ALL policy governs DELETE by its USING clause — the read rule.
    -- Written as one policy with USING(can_read) and WITH CHECK(can_write),
    -- a viewer could delete every row they were allowed to look at, because
    -- DELETE never consults WITH CHECK. Splitting them is the only way to say
    -- "may look, may not remove".
    execute format(
      'create policy "%s read" on %I for select '
      'using (company_id = auth_company_id() and can_read(%L))',
      r.tablename, r.tablename, v_module);

    execute format(
      'create policy "%s insert" on %I for insert '
      'with check (company_id = auth_company_id() and can_write(%L))',
      r.tablename, r.tablename, v_module);

    execute format(
      'create policy "%s update" on %I for update '
      'using (company_id = auth_company_id() and can_write(%L)) '
      'with check (company_id = auth_company_id() and can_write(%L))',
      r.tablename, r.tablename, v_module, v_module);

    execute format(
      'create policy "%s delete" on %I for delete '
      'using (company_id = auth_company_id() and can_write(%L))',
      r.tablename, r.tablename, v_module);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. The access table itself
--
-- Everyone reads their own grants — the interface needs them to decide what to
-- show. Only an owner may change them; a manager who could grant themselves
-- HR access would make the sensitive-module rule decorative.
-- ---------------------------------------------------------------------------
alter table user_module_access enable row level security;

drop policy if exists "read own module access" on user_module_access;
create policy "read own module access" on user_module_access
  for select
  using (
    company_id = auth_company_id()
    and (auth_role() = 'owner'
         or app_user_id = (select id from app_user where auth_id = auth.uid()))
  );

drop policy if exists "owner manages module access" on user_module_access;
create policy "owner manages module access" on user_module_access
  for all
  using (company_id = auth_company_id() and auth_role() = 'owner')
  with check (company_id = auth_company_id() and auth_role() = 'owner');

drop trigger if exists update_user_module_access_updated_at on user_module_access;
create trigger update_user_module_access_updated_at
  before update on user_module_access
  for each row execute function update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 6. Colleagues
--
-- An owner needs to see everyone to manage access. Everyone else still reads
-- only their own row, exactly as before.
-- ---------------------------------------------------------------------------
drop policy if exists "owner reads company users" on app_user;
create policy "owner reads company users" on app_user
  for select
  using (company_id = auth_company_id() and auth_role() = 'owner');

commit;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
select
  (select role from app_user where email = 'ahsan.ahmad1@gmail.com')  as your_role,
  (select count(distinct tablename) from pg_policies
    where policyname like '% read'
      and schemaname = 'public')                                      as tables_secured,
  (select count(*) from pg_policies
    where schemaname = 'public'
      and (policyname like '% read' or policyname like '% insert'
        or policyname like '% update' or policyname like '% delete')) as policies,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('auth_role','can_read','can_write','is_sensitive_module')) as helpers;
-- Expect: owner, 27, 108, 4
--
-- 108 is 27 tables x 4 operations. If it says 27 instead, the split did not
-- happen and DELETE is still governed by the read rule.

-- 0013 — Integrations: connections and the identity map
--
-- The first piece of the layer that reads other people's systems. Two tables:
-- what we are connected to, and which of their records is which of ours.
--
-- The second one is the important one. When Samsara sends vehicle
-- "212014918732717", we need to know that is the same truck we already hold
-- and update it — not create a fourth copy on the fourth sync. Every
-- integration that has ever gone wrong has gone wrong here.
--
-- NOTE ON CREDENTIALS
-- No API token is stored in these tables, deliberately. Today a single RLS
-- policy grants every authenticated member of a tenant full read access to
-- every table (TS-PROD-001 §10, defect 2), so a token in a column would be
-- readable by anyone who can log in. Tokens are supplied to the sync at run
-- time and held server-side. credential_ref names where the secret lives; it
-- is not the secret.
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
-- What we are connected to
-- ---------------------------------------------------------------------------
create table if not exists integration_connection (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references company(id) on delete cascade,

  -- Free text rather than an enum: adding a provider should not need a
  -- migration, and the list will grow.
  provider       text not null,
  label          text not null,

  status         text not null default 'inactive'
                   check (status in ('inactive', 'active', 'error')),

  -- Lets a connection be pointed at a regional host, or at a local stand-in
  -- while it is being built and tested.
  base_url       text,

  -- Names the secret. Never the secret itself — see the note above.
  credential_ref text,

  last_sync_at      timestamptz,
  last_sync_status  text check (last_sync_status in ('success', 'partial', 'failed')),
  last_sync_message text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (company_id, provider, label)
);

-- ---------------------------------------------------------------------------
-- Which of their records is which of ours
-- ---------------------------------------------------------------------------
create table if not exists integration_external_ref (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references company(id) on delete cascade,
  connection_id  uuid not null references integration_connection(id) on delete cascade,

  entity_type    text not null,   -- 'vehicle', 'trip', 'driver', …
  external_id    text not null,   -- their id, exactly as they send it
  internal_id    uuid not null,   -- ours

  -- What we last saw, so a sync can skip rows that have not moved.
  external_hash  text,
  last_seen_at   timestamptz not null default now(),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- The rule that stops duplicates: one external record maps to one of ours.
  unique (company_id, connection_id, entity_type, external_id)
);

create index if not exists integration_external_ref_internal_idx
  on integration_external_ref (company_id, entity_type, internal_id);

-- ---------------------------------------------------------------------------
-- Security
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array['integration_connection', 'integration_external_ref'];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "founder full access to %s" on %I', t, t);
    execute format(
      'create policy "founder full access to %s" on %I for all using (company_id = auth_company_id()) with check (company_id = auth_company_id())',
      t, t);
    execute format('drop trigger if exists update_%s_updated_at on %I', t, t);
    execute format(
      'create trigger update_%s_updated_at before update on %I for each row execute function update_updated_at_column()',
      t, t);
  end loop;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
select
  (select count(*) from information_schema.tables
    where table_name in ('integration_connection', 'integration_external_ref'))  as tables,
  (select count(*) from pg_policies
    where tablename in ('integration_connection', 'integration_external_ref'))   as policies;
-- Expect: 2, 2

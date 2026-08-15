-- 0020 — Somewhere to keep a customer's API key
--
-- Migration 0013 deliberately refused to store one. The reason it gave was
-- that a single RLS policy then granted every authenticated member of a tenant
-- read access to every table, so a token in a column would have been readable
-- by anyone who could log in. That reason no longer holds: 0014 replaced those
-- policies and 0019 closed the last of it.
--
-- The refusal was right and the design it forced is kept. A token still never
-- reaches the browser, in either direction:
--
--   the operator pastes it  →  a server route  →  encrypted here
--   a sync needs it         →  a server route  →  decrypted there
--
-- WHERE THE KEY LIVES
--
-- Not in this database. The encryption key is supplied by the caller on every
-- call and is held in the server's environment. That is the whole point: if a
-- backup of this database is ever taken, lost, or subpoenaed, the ciphertext
-- in it is inert, because the key was never stored alongside it.
--
-- The consequence is worth stating plainly: lose the key and every stored
-- token is gone. There is no recovery. They would have to be pasted in again.
--
-- WHO CAN REACH IT
--
-- Row-level security is enabled on the table and no policy is created. That is
-- deliberate, not an oversight — with RLS on and no policy, the browser's role
-- can read nothing at all. Only the service role, which bypasses RLS, can
-- reach it, and that role exists solely inside the server routes.
--
-- The two functions are locked the same way: execute is revoked from public
-- and granted only to the service role. Both belts, because this is the one
-- table in the product where a mistake hands over a customer's own systems.
--
-- Safe to re-run.

begin;

do $$
begin
  if to_regclass('public.integration_connection') is null then
    raise exception 'integration_connection does not exist — apply 0013 first';
  end if;
end $$;

create extension if not exists pgcrypto;

create table if not exists integration_credential (
  connection_id uuid primary key
                  references integration_connection(id) on delete cascade,
  company_id    uuid not null references company(id) on delete cascade,

  -- The token, encrypted. Never the token.
  secret        bytea not null,

  -- Recorded so a stale key can be spotted without decrypting anything.
  updated_at    timestamptz not null default now(),
  last_verified_at timestamptz
);

create index if not exists integration_credential_company_idx
  on integration_credential (company_id);

-- Enabled with no policy on purpose. Nothing the browser can do reaches this.
alter table integration_credential enable row level security;

-- ---------------------------------------------------------------------------
-- Store a token.
--
-- search_path is pinned. A SECURITY DEFINER function without it can be made to
-- call a caller-supplied function of the same name, which is how definer
-- functions get turned into privilege escalation.
-- ---------------------------------------------------------------------------
create or replace function integration_credential_set(
  p_connection uuid,
  p_token      text,
  p_key        text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company uuid;
begin
  if p_key is null or length(p_key) < 32 then
    raise exception 'encryption key is missing or too short';
  end if;
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'token is empty';
  end if;

  select company_id into v_company
    from integration_connection where id = p_connection;
  if v_company is null then
    raise exception 'no such connection';
  end if;

  insert into integration_credential (connection_id, company_id, secret, updated_at)
  values (p_connection, v_company, pgp_sym_encrypt(p_token, p_key), now())
  on conflict (connection_id) do update
    set secret = excluded.secret,
        updated_at = now(),
        last_verified_at = null;
end $$;

-- ---------------------------------------------------------------------------
-- Read a token back. Called only by a sync running on the server.
-- ---------------------------------------------------------------------------
create or replace function integration_credential_get(
  p_connection uuid,
  p_key        text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_secret bytea;
begin
  select secret into v_secret
    from integration_credential where connection_id = p_connection;
  if v_secret is null then
    return null;
  end if;

  begin
    return pgp_sym_decrypt(v_secret, p_key);
  exception when others then
    -- Wrong key. Say so without leaking whether a credential exists at all.
    raise exception 'credential could not be decrypted';
  end;
end $$;

-- Records that a token was last known to work, without touching the token.
create or replace function integration_credential_verified(p_connection uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update integration_credential
     set last_verified_at = now()
   where connection_id = p_connection;
$$;

-- ---------------------------------------------------------------------------
-- Nobody but the server.
-- ---------------------------------------------------------------------------
revoke all on function integration_credential_set(uuid, text, text)   from public, anon, authenticated;
revoke all on function integration_credential_get(uuid, text)         from public, anon, authenticated;
revoke all on function integration_credential_verified(uuid)          from public, anon, authenticated;

grant execute on function integration_credential_set(uuid, text, text) to service_role;
grant execute on function integration_credential_get(uuid, text)       to service_role;
grant execute on function integration_credential_verified(uuid)        to service_role;

-- The table itself, likewise. RLS already blocks the browser; this stops the
-- grant existing at all.
revoke all on table integration_credential from anon, authenticated;
grant select, insert, update, delete on table integration_credential to service_role;

commit;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
select
  (select count(*) from information_schema.tables
    where table_name = 'integration_credential')                        as table_created,
  (select count(*) from pg_policies
    where tablename = 'integration_credential')                         as policies_expected_zero,
  (select relrowsecurity from pg_class
    where relname = 'integration_credential')                           as rls_on,
  (select count(*) from information_schema.role_routine_grants
    where routine_name like 'integration_credential%'
      and grantee = 'authenticated')                                    as browser_can_call;
-- Expect: 1, 0, true, 0
--
-- Zero policies with RLS on is correct here and is the point: it means the
-- browser's role can read nothing. Zero in the last column means the browser
-- cannot call the functions either.
--
-- Round-trip test, in this editor only — never with a real token:
--
--   insert into integration_connection (company_id, provider, label)
--   select id, 'samsara', 'test' from company limit 1
--   returning id;
--
--   select integration_credential_set('<that id>', 'not-a-real-token',
--                                     repeat('x', 40));
--   select integration_credential_get('<that id>', repeat('x', 40));
--   -- returns: not-a-real-token
--   select integration_credential_get('<that id>', repeat('y', 40));
--   -- raises: credential could not be decrypted
--
--   delete from integration_connection where label = 'test';

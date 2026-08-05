-- 0019 — Guardian findings: close the read leak
--
-- THE BUG
--
-- 0015 gave guardian_finding two policies:
--
--   "guardian_finding read"   for select  using (... and can_read_all(modules))
--   "guardian_finding write"  for all     using (... and can_write('core'))
--
-- FOR ALL means all — including SELECT. Row-level security policies are
-- permissive and therefore OR'd together, so a row is readable if EITHER
-- policy passes. Anyone with core write access passed the second one, which
-- meant the can_read_all(modules) restriction on the first was decorative.
--
-- In practice: a staff member with no inventory access could read a stockout
-- finding, including the SKU codes, quantities and supplier name carried in
-- its evidence. The module boundary was enforced on the tables and then
-- leaked through the summary of them.
--
-- This is the same mistake, mirrored, as the one caught before 0014 shipped —
-- there, a FOR ALL policy would have let a viewer DELETE anything they could
-- read, because DELETE consults USING rather than WITH CHECK. FOR ALL is a
-- single rule pretending to be four, and it is wrong whenever the four differ.
--
-- THE FIX
--
-- One policy per operation, so SELECT is governed by the read rule alone.
--
-- UPDATE and DELETE additionally require read access to every module the
-- finding drew on: acting on a finding you are not allowed to see is not a
-- thing anyone should be able to do. That is safe for the check functions,
-- because by construction anyone who can compute a finding can already read
-- every module it used — the stockout check needs inventory to produce a
-- finding tagged inventory, and the capacity check needs warehouse and fleet
-- to produce one tagged warehouse and fleet. So the upsert inside those
-- functions can never meet a row it is barred from updating.
--
-- Safe to re-run.

begin;

do $$
begin
  if to_regclass('public.guardian_finding') is null then
    raise exception 'guardian_finding does not exist — apply 0015 first';
  end if;
  if to_regproc('public.can_read_all') is null then
    raise exception 'can_read_all() is missing — apply 0015 first';
  end if;
end $$;

-- Out with the single rule pretending to be four.
drop policy if exists "guardian_finding write" on guardian_finding;
drop policy if exists "guardian_finding read" on guardian_finding;
drop policy if exists "guardian_finding insert" on guardian_finding;
drop policy if exists "guardian_finding update" on guardian_finding;
drop policy if exists "guardian_finding delete" on guardian_finding;

-- Read: only if you may read every module the finding drew on.
create policy "guardian_finding read" on guardian_finding
  for select
  using (company_id = auth_company_id() and can_read_all(modules));

-- Insert: the checks write findings, gated on core write access.
create policy "guardian_finding insert" on guardian_finding
  for insert
  with check (company_id = auth_company_id() and can_write('core'));

-- Update: marking a finding Seen or Done, and the checks refreshing one.
create policy "guardian_finding update" on guardian_finding
  for update
  using (company_id = auth_company_id() and can_write('core') and can_read_all(modules))
  with check (company_id = auth_company_id() and can_write('core'));

-- Delete: same bar as update. Nothing in the product deletes findings today,
-- but a policy that does not exist is a policy nobody can reason about.
create policy "guardian_finding delete" on guardian_finding
  for delete
  using (company_id = auth_company_id() and can_write('core') and can_read_all(modules));

commit;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
select
  cmd,
  count(*) as policies,
  bool_or(qual like '%can_read_all%')       as checks_module_read,
  bool_or(with_check like '%can_write%')    as checks_write
from pg_policies
where tablename = 'guardian_finding'
group by cmd
order by cmd;
--
-- Expect four rows — DELETE, INSERT, SELECT, UPDATE — one policy each.
-- There must be no row where cmd = 'ALL'. If there is, the old policy
-- survived and the leak is still open.
--
-- The check that matters, in one line:
--
--   select count(*) from pg_policies
--    where tablename = 'guardian_finding' and cmd = 'ALL';
--
-- Expect: 0

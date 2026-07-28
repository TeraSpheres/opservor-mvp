-- Repair a login whose user record was deleted
--
-- app_user.company_id references company(id) ON DELETE CASCADE. So if your
-- login is pointed at a company and that company is deleted, your user record
-- is deleted with it. The seed files begin by deleting their own company to
-- make a clean copy — which removes your login if you were viewing it.
--
-- You can still sign in, because authentication is stored separately. But with
-- no user record the app cannot tell which company you belong to, so the
-- sidebar shows your email instead of your name, the company panel disappears,
-- and every screen comes up empty.
--
-- This puts the record back, pointed at a company that is not a demo.
-- Safe to run even if nothing is wrong — it only acts if the record is missing.

do $$
declare
  v_auth    uuid;
  v_company uuid;
  v_email   text := 'ahsan.ahmad1@gmail.com';   -- change if you sign in as someone else
begin
  select id into v_auth from auth.users where email = v_email;
  if v_auth is null then
    raise exception 'No sign-in found for %. Check the email address above.', v_email;
  end if;

  if exists (select 1 from app_user where auth_id = v_auth) then
    raise notice 'Your user record is already present — nothing to repair.';
    return;
  end if;

  -- Prefer a real company over a demo one.
  select id into v_company
  from company
  where name not like '%(DEMO)%'
  order by created_at
  limit 1;

  -- If the only companies left are demos, or there are none at all, make one.
  if v_company is null then
    insert into company (name, timezone)
    values ('Your Company', 'America/Edmonton')
    returning id into v_company;
    raise notice 'No non-demo company existed, so one was created.';
  end if;

  insert into app_user (auth_id, company_id, name, email, role)
  values (v_auth, v_company, 'Ahsan Ahmad', v_email, 'founder');

  raise notice 'User record restored, pointed at company %.', v_company;
end $$;

-- ---------------------------------------------------------------------------
-- Confirm
-- ---------------------------------------------------------------------------
select
  u.name,
  u.email,
  c.name as viewing_company
from app_user u
join company c on c.id = u.company_id
where u.email = 'ahsan.ahmad1@gmail.com';
-- You should get one row back.

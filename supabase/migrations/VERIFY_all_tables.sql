-- Full v1 verification. Read-only.
select
  c.relname                                                as table_name,
  c.relrowsecurity                                         as rls,
  (select count(*) from pg_policies p
     where p.schemaname='public' and p.tablename=c.relname) as policies,
  (select count(*) from pg_trigger g
     where g.tgrelid=c.oid and not g.tgisinternal)          as triggers
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname;

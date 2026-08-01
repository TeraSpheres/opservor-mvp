-- Rebuild the demo stock ledger with problems that were put there on purpose.
--
-- WHY THIS EXISTS
--
-- The first Guardian run against the demo data produced 72 criticals. The
-- check was right; the data was nonsense. 15% of items ended at negative
-- stock and another 11% were critically short. No food business runs like
-- that and survives, and a demo that looks like a company in freefall proves
-- nothing about the product.
--
-- The cause was mine. The generator picked inbound-or-outbound from
-- (d + ord) % 3 and the quantity from (d * 17 + ord * 23) % 180 — two
-- expressions over the same two numbers. They are not independent, so
-- outbound movements landed systematically on large quantities. Data that
-- looks random and is not is worse than data that is obviously fake.
--
-- WHAT THIS DOES INSTEAD
--
-- Every item is given an exact intended ending position, and the movements
-- are built backwards from it:
--
--   ending stock  = daily rate x days of cover  + whatever is reserved
--   opening stock = ending + everything that goes out - the top-ups
--
-- so the ledger lands precisely where it was meant to. Of the 300 items that
-- trade, in each demo company:
--
--     6  end negative        -> guardian_check_impossible_stock finds these
--     6  hold 4 days cover   -> critical, inside the 10-day lead time
--     6  hold 14 days cover  -> high
--   282  hold 60-179 days    -> nothing to say about them
--
-- Guardian should therefore report one records finding, roughly six critical
-- supplier orders and roughly six high — "roughly" because items are spread
-- across 28 suppliers and two shortages can land on the same one, which
-- merges them into a single order. That is the grouping doing its job.
--
-- If it reports anything else, either the check or this file is wrong, and
-- that is worth knowing.
--
-- SAFE TO RE-RUN. Touches only companies with (DEMO) in the name, and only
-- their inventory movements. It does not go near company, app_user, or your
-- login — unlike the full seed, which cascades and will delete your account
-- if you point it at the company you are logged into.

begin;

create temp table _demo on commit drop as
  select id from company where name like '%(DEMO)%';

do $$
declare n integer;
begin
  select count(*) into n from _demo;
  if n = 0 then
    raise exception 'No demo companies found. Nothing to repair.';
  end if;
  raise notice 'Rebuilding stock for % demo company(ies).', n;
end $$;

-- Clearing the ledger runs the 0007 delete trigger, which unwinds
-- quantity_on_hand back to where it started. The update after it is belt and
-- braces against any row that drifted.
delete from inventory_movement where company_id in (select id from _demo);

update inventory_sku set quantity_on_hand = 0
 where company_id in (select id from _demo);

-- ---------------------------------------------------------------------------
-- The plan, one row per item
-- ---------------------------------------------------------------------------
create temp table _plan on commit drop as
with numbered as (
  select
    s.id, s.company_id, s.quantity_reserved as reserved,
    row_number() over (partition by s.company_id order by s.sku)::int as ord
  from inventory_sku s
  where s.company_id in (select id from _demo)
),
sized as (
  select
    n.*,
    -- Between 2 and 19 units a day. Enough spread that days of cover is not
    -- the same arithmetic for every item.
    2 + (n.ord % 18) as rate,
    case n.ord % 50
      when 0  then -1              -- deliberately impossible
      when 7  then 4               -- critical: inside a 10-day lead time
      when 19 then 14              -- high: just outside it
      else 60 + (n.ord % 120)      -- healthy, 60 to 179 days
    end as cover
  from numbered n
  where n.ord <= 300
)
select
  id, company_id, reserved, ord, rate, cover,
  case when cover < 0
       then -(rate * 5)                    -- five days in the hole
       -- Reserved is added back so available lands on exactly rate x cover,
       -- which makes days of cover come out as the number intended rather
       -- than something close to it.
       else rate * cover + reserved
  end as ending
from sized;

-- ---------------------------------------------------------------------------
-- Outbound: steady demand, every third day, 30 movements over the window
-- Total per item = rate x 3 x 30 = rate x 90, so the daily rate Guardian
-- works out from history is exactly `rate`.
-- ---------------------------------------------------------------------------
insert into inventory_movement (company_id, sku_id, type, quantity, reference, date)
select
  p.company_id, p.id, 'outbound', p.rate * 3,
  'DESP-' || lpad(p.ord::text, 4, '0') || '-' || lpad(d::text, 2, '0'),
  current_date - d
from _plan p
cross join generate_series(0, 87, 3) as d;

-- ---------------------------------------------------------------------------
-- Inbound: an opening position, then three top-ups
--
-- opening = rate x 60 + ending, which is positive for every case above —
-- lowest is rate x 55 for the deliberately negative items.
-- ---------------------------------------------------------------------------
insert into inventory_movement (company_id, sku_id, type, quantity, reference, date)
select
  p.company_id, p.id, 'inbound', p.rate * 60 + p.ending,
  'OPEN-' || lpad(p.ord::text, 4, '0'),
  current_date - 89
from _plan p;

insert into inventory_movement (company_id, sku_id, type, quantity, reference, date)
select
  p.company_id, p.id, 'inbound', p.rate * 10,
  'GRN-' || lpad(p.ord::text, 4, '0') || '-' || lpad(d::text, 2, '0'),
  current_date - d
from _plan p
cross join (values (60), (40), (20)) as g(d);

commit;

-- ---------------------------------------------------------------------------
-- Verify — the ledger should have landed exactly on the plan
-- ---------------------------------------------------------------------------
select
  c.name,
  count(*)                                                as items_trading,
  count(*) filter (where s.quantity_on_hand < 0)          as negative,
  count(*) filter (where s.quantity_on_hand = 0)          as zero,
  min(s.quantity_on_hand)                                 as worst,
  round(avg(s.quantity_on_hand))                          as average
from inventory_sku s
join company c on c.id = s.company_id
where c.name like '%(DEMO)%'
  and exists (select 1 from inventory_movement m where m.sku_id = s.id)
group by c.name
order by c.name;
-- Expect per company: 300 trading, 6 negative, 0 zero.
--
-- Then re-run the checks and see whether Guardian finds what was planted:
--
--   select guardian_run_all();
--
--   select check_id, severity, count(*)
--   from guardian_finding
--   where status in ('open','acknowledged')
--   group by check_id, severity
--   order by check_id;
--
-- Expect roughly: impossible_stock 1, stockout_risk ~6 critical + ~6 high,
-- capacity_clash 0-1. Fewer than the planted 6+6 means two shortages shared a
-- supplier and were merged into one order, which is correct behaviour.

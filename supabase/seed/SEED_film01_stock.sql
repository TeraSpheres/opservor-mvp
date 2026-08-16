-- FILM 01 — SKU-7821, the item the film is about
--
-- Four plain statements, safe to re-run. Produces, once you press Run checks:
--   Supplier 9 — SKU-7821, 4 days of cover        (critical · inventory)
--   630 shipped / 90 days = 7 a day · 28 on hand · reorder 26 · 4 days to zero
--
-- 28 on hand and nothing reserved, because that is what Marcus says out loud
-- and what the tablet in shot 05 shows.


-- 1 of 4 — the supplier must own only this item, or the card groups several
-- together and stops naming SKU-7821.
update inventory_sku
   set supplier = 'Supplier 9B'
 where company_id = (select company_id from app_user where email = 'ahsan.ahmad1@gmail.com')
   and supplier = 'Supplier 9'
   and sku <> 'SKU-7821';


-- 2 of 4 — remove any previous copy.
--
-- Deleted and re-inserted rather than upserted. Migration 0009 dropped the
-- global unique constraint on sku and replaced it with one on
-- (company_id, sku), so "on conflict (sku)" matches no constraint at all and
-- the statement fails outright. Deleting also cascades to this item's
-- movements, which is step 3 done for free — but step 3 stays, because it
-- costs nothing and covers the case where the item was never here.
delete from inventory_sku where sku = 'SKU-7821';


-- 3 of 4 — the item.
insert into inventory_sku (
  company_id, sku, name, category,
  quantity_on_hand, quantity_reserved, reorder_level, reorder_quantity,
  unit_cost, unit_price, warehouse_location, supplier
)
values (
  (select company_id from app_user where email = 'ahsan.ahmad1@gmail.com'),
  'SKU-7821', 'Hydraulic Filter', 'Filtration',
  28, 0, 26, 184,
  42.50, 96.00, 'A-14-3', 'Supplier 9'
);


-- 4 of 4 — ninety days of picking. The ten-day pattern sums to 70, so ninety
-- days sum to exactly 630 and the mean is exactly 7. Varied rather than a flat
-- seven, because a real picking history is never flat and this data is on screen.
-- Must report 90 rows.
insert into inventory_movement (company_id, sku_id, type, quantity, reference, date)
select s.company_id, s.id, 'outbound',
       (array[9,7,5,7,9,5,7,7,7,7])[(d % 10) + 1],
       'PICK-' || to_char(current_date - d, 'YYYYMMDD'),
       current_date - d
from inventory_sku s, generate_series(0, 89) as d
where s.sku = 'SKU-7821';


-- Verify. This one returns a row saying NOT SEEDED rather than nothing at all,
-- because an empty result reads as success and that is how the first attempt
-- looked like it had worked when it had not.
select
  coalesce(max(s.sku), 'NOT SEEDED')                     as sku,
  coalesce(sum(m.quantity), 0)                           as units_shipped,
  round(coalesce(sum(m.quantity), 0) / 90.0, 2)          as leaving_per_day,
  coalesce(max(s.quantity_on_hand), 0)                   as on_hand,
  coalesce(max(s.reorder_level), 0)                      as reorder_level,
  floor(coalesce(max(s.quantity_on_hand), 0)
        / nullif(coalesce(sum(m.quantity), 0) / 90.0, 0)) as days_to_zero
from inventory_sku s
left join inventory_movement m
  on m.sku_id = s.id and m.type = 'outbound' and m.date >= current_date - 90
where s.sku = 'SKU-7821';

-- Expect: SKU-7821 · 630 · 7.00 · 28 · 26 · 4
-- "NOT SEEDED" means step 3 did not land. Do not film it.

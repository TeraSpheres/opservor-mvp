-- FILM 01 — SKU-7821, the item the film is about
--
-- Four plain statements. No DO block, no $$ quoting, nothing that can break if
-- a paste comes up short. Each one is safe to run again.
--
-- Produces, once you press Run checks:
--   Supplier 9 — SKU-7821, 4 days of cover        (critical · inventory)
--   630 shipped / 90 days = 7 a day · 28 on hand · reorder 26 · 4 days to zero
--   Recommended: raise an order for 184 units.
--
-- 28 on hand and nothing reserved, because "28 on hand" is what Marcus says
-- out loud and what the tablet in shot 05 shows.


-- 1 of 4 — the supplier must own only this item, or the card groups several
-- together and stops naming SKU-7821.
update inventory_sku
   set supplier = 'Supplier 9B'
 where company_id = (select company_id from app_user where email = 'ahsan.ahmad1@gmail.com')
   and supplier = 'Supplier 9'
   and sku <> 'SKU-7821';


-- 2 of 4 — the item. sku is globally unique, so a clash claims the row.
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
)
on conflict (sku) do update set
  company_id        = excluded.company_id,
  name              = excluded.name,
  category          = excluded.category,
  quantity_on_hand  = excluded.quantity_on_hand,
  quantity_reserved = excluded.quantity_reserved,
  reorder_level     = excluded.reorder_level,
  reorder_quantity  = excluded.reorder_quantity,
  supplier          = excluded.supplier,
  updated_at        = now();


-- 3 of 4 — clear this item's history, so running the file twice does not
-- double the rate and turn four days of cover into two.
delete from inventory_movement
 where sku_id = (select id from inventory_sku where sku = 'SKU-7821');


-- 4 of 4 — ninety days of picking. The ten-day pattern sums to 70, so ninety
-- days sum to exactly 630 and the mean is exactly 7. Varied rather than a flat
-- seven, because a real picking history is never flat and this data is on screen.
insert into inventory_movement (company_id, sku_id, type, quantity, reference, date)
select
  (select company_id from inventory_sku where sku = 'SKU-7821'),
  (select id         from inventory_sku where sku = 'SKU-7821'),
  'outbound',
  (array[9,7,5,7,9,5,7,7,7,7])[(d % 10) + 1],
  'PICK-' || to_char(current_date - d, 'YYYYMMDD'),
  current_date - d
from generate_series(0, 89) as d;


-- Verify — the arithmetic the check is about to do
select
  s.sku,
  s.supplier,
  sum(m.quantity)                  as units_shipped,
  round(sum(m.quantity) / 90.0, 2) as leaving_per_day,
  s.quantity_on_hand               as on_hand,
  s.reorder_level,
  floor(s.quantity_on_hand / (sum(m.quantity) / 90.0)) as days_to_zero,
  s.reorder_quantity               as units_to_order
from inventory_sku s
join inventory_movement m
  on m.sku_id = s.id and m.type = 'outbound' and m.date >= current_date - 90
where s.sku = 'SKU-7821'
group by s.id, s.sku, s.supplier, s.quantity_on_hand, s.reorder_level, s.reorder_quantity;

-- Expect: 630 · 7.00 · 28 · 26 · 4 · 184
-- If leaving_per_day is not 7.00, do not film it.

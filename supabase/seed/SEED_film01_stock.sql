-- FILM 01 — make Guardian actually produce SKU-7821
--
-- WHY
--
-- The film's script has actors reading numbers off a tablet: 28 on hand,
-- reorder at 26, seven a day, four days of cover, ten-day lead time. Those
-- numbers came from a hand-written example on the website, not from the
-- product. So the plan was to composite invented screens over the tablets and
-- then, at shot 15, cut to a real Guardian screenshot showing a completely
-- different finding — Supplier 13, BDY-01692, ten items.
--
-- A viewer who reads both sees the story change at the exact moment it is
-- supposed to land. Worse, the shot sheet says "All UI screens are actual
-- Opservor product", which would not be true.
--
-- This makes it true. It seeds the item the script is about, so Guardian
-- computes that finding itself and every screen in the film can be a real
-- screenshot of real output.
--
-- WHAT IT PRODUCES
--
-- Run this, press Run checks, and Guardian will generate:
--
--   critical · inventory
--   Supplier 9 — SKU-7821, 4 days of cover
--   Recommended: Raise an order to Supplier 9 for 184 units of SKU-7821.
--
--   Units shipped 630 · Days observed 90 · Leaving per day 7
--   On hand 28 · Reorder level 26 · Days to zero 4
--
-- Every one of those is computed by the check from the rows below, not typed.
--
-- THE ARITHMETIC, WHICH NOW COMES OUT
--
--   630 shipped / 90 days  = 7.00 a day     (the site said 758, which is 8.42)
--   28 on hand / 7 a day   = 4 days of cover
--   10-day lead - 4 days   = 6 days with an empty shelf
--   28 on hand vs reorder 26 -> above the line, so the stock screen says fine
--
-- ON HAND IS 28, NOT 46
--
-- The website example splits 46 on hand into 18 reserved and 28 available.
-- Marcus does not say that. He says "28 on hand. Reorder point is 26", and the
-- rendered tablet frame says the same, so on hand is 28 and nothing is
-- reserved. The alternative was an actor saying one number while the screen
-- behind him showed another, which is exactly the mismatch this file exists to
-- remove.
--
-- NAMING
--
-- SKU-7821, Hydraulic Filter — taken from the rendered frame for shot 05
-- rather than chosen here. A picture already made outranks a name in a script.
--
-- Safe to re-run: it rebuilds this one item's movements from scratch each time.

begin;

do $$
declare
  v_company uuid;
  v_sku     uuid;
  v_clashed integer;
  -- Nine repeats of a ten-day pattern that sums to 70, so ninety days sum to
  -- exactly 630 and the mean is exactly 7. Varied rather than a flat 7 a day,
  -- because a real picking history is never flat and the film shows this data.
  v_pattern integer[] := array[9,7,5,7,9,5,7,7,7,7];
begin
  -- The company the signed-in user actually belongs to, falling back to
  -- whichever demo company holds the most stock.
  select company_id into v_company from app_user order by created_at limit 1;

  if v_company is null then
    select c.id into v_company
      from company c
     order by (select count(*) from inventory_sku s where s.company_id = c.id) desc
     limit 1;
  end if;

  if v_company is null then
    raise exception 'No company found. Seed a demo company first.';
  end if;

  -- The supplier must own exactly one flagged item, or the check groups them
  -- and the card reads "Supplier 9 — 4 items" instead of naming SKU-7821.
  -- Anything else already using the name is moved aside, and says so.
  update inventory_sku
     set supplier = 'Supplier 9B'
   where company_id = v_company
     and supplier = 'Supplier 9'
     and sku <> 'SKU-7821';
  get diagnostics v_clashed = row_count;
  if v_clashed > 0 then
    raise notice 'Moved % other item(s) off Supplier 9 so the card names SKU-7821.', v_clashed;
  end if;

  -- sku is globally unique rather than unique per company, so a conflict is
  -- resolved by claiming the row rather than failing.
  insert into inventory_sku (
    company_id, sku, name, category,
    quantity_on_hand, quantity_reserved, reorder_level, reorder_quantity,
    unit_cost, unit_price, warehouse_location, supplier
  )
  values (
    v_company, 'SKU-7821', 'Hydraulic Filter', 'Filtration',
    -- on hand, reserved, reorder level, reorder quantity.
    -- 28 on hand with nothing held, because that is the number said out loud.
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
    updated_at        = now()
  returning id into v_sku;

  -- Rebuilt rather than added to, so running this twice does not double the
  -- rate and quietly turn four days of cover into two.
  delete from inventory_movement where sku_id = v_sku;

  insert into inventory_movement (company_id, sku_id, type, quantity, reference, date)
  select
    v_company,
    v_sku,
    'outbound',
    v_pattern[(d % 10) + 1],
    'PICK-' || to_char(current_date - d, 'YYYYMMDD'),
    current_date - d
  from generate_series(0, 89) as d;

  raise notice 'SKU-7821 seeded for company %. Press Run checks.', v_company;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Verify — this is the arithmetic the check will do, done here first
-- ---------------------------------------------------------------------------
select
  s.sku,
  s.supplier,
  sum(m.quantity)                                              as units_shipped,
  90                                                           as days_observed,
  round(sum(m.quantity) / 90.0, 2)                             as leaving_per_day,
  s.quantity_on_hand                                           as on_hand,
  s.quantity_reserved                                          as reserved,
  s.quantity_on_hand - s.quantity_reserved                     as available,
  s.reorder_level,
  floor((s.quantity_on_hand - s.quantity_reserved)
        / (sum(m.quantity) / 90.0))                            as days_to_zero,
  s.reorder_quantity                                           as units_to_order
from inventory_sku s
join inventory_movement m
  on m.sku_id = s.id
 and m.type = 'outbound'
 and m.date >= current_date - 90
where s.sku = 'SKU-7821'
group by s.id, s.sku, s.supplier, s.quantity_on_hand, s.quantity_reserved,
         s.reorder_level, s.reorder_quantity;
--
-- Expect exactly:
--   units_shipped 630 · leaving_per_day 7.00 · available 28
--   reorder_level 26 · days_to_zero 4 · units_to_order 184
--
-- If leaving_per_day is not 7.00, do not film it.

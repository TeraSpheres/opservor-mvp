-- ============================================================
-- Opservor HQ — Inventory stock synchronisation (0007)
--
-- Closes the gap where inventory_movement recorded history but never
-- adjusted inventory_sku.quantity_on_hand. Receiving 500 units left
-- the on-hand figure reading zero.
--
-- Safe to run more than once.
-- Paste into the Supabase SQL Editor and Run.
-- ============================================================

-- ------------------------------------------------------------
-- Preflight
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.inventory_sku') is null
     or to_regclass('public.inventory_movement') is null then
    raise exception 'Inventory tables missing. Run 0004_add_inventory_module.sql first.';
  end if;
end $$;

-- ------------------------------------------------------------
-- The sign convention, in one place.
--
--   inbound     received into stock          -> add
--   outbound    shipped out of stock         -> subtract
--   adjustment  correction, may be negative  -> add as signed
--   reorder     purchase order raised        -> no stock effect
--
-- 'reorder' deliberately does nothing. Raising a PO does not change
-- what is on the shelf; the goods land later as an 'inbound'.
-- ------------------------------------------------------------
create or replace function inventory_movement_delta(p_type text, p_qty integer)
returns integer
language sql
immutable
as $$
  select case p_type
    when 'inbound'    then  p_qty
    when 'outbound'   then -p_qty
    when 'adjustment' then  p_qty
    else 0
  end;
$$;

-- ------------------------------------------------------------
-- Trigger: keep quantity_on_hand in step with the ledger.
--
-- UPDATE and DELETE are handled even though the ledger is meant to be
-- append-only. If a row is ever corrected or removed by hand, the
-- stock figure follows rather than silently drifting.
-- ------------------------------------------------------------
create or replace function inventory_apply_movement()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    update inventory_sku
       set quantity_on_hand = quantity_on_hand + inventory_movement_delta(NEW.type, NEW.quantity)
     where id = NEW.sku_id;
    return NEW;

  elsif TG_OP = 'UPDATE' then
    -- reverse the old effect, then apply the new one
    update inventory_sku
       set quantity_on_hand = quantity_on_hand - inventory_movement_delta(OLD.type, OLD.quantity)
     where id = OLD.sku_id;
    update inventory_sku
       set quantity_on_hand = quantity_on_hand + inventory_movement_delta(NEW.type, NEW.quantity)
     where id = NEW.sku_id;
    return NEW;

  elsif TG_OP = 'DELETE' then
    update inventory_sku
       set quantity_on_hand = quantity_on_hand - inventory_movement_delta(OLD.type, OLD.quantity)
     where id = OLD.sku_id;
    return OLD;
  end if;
  return null;
end $$;

drop trigger if exists inventory_movement_sync on inventory_movement;
create trigger inventory_movement_sync
  after insert or update or delete on inventory_movement
  for each row execute function inventory_apply_movement();

-- ------------------------------------------------------------
-- Backfill.
--
-- Every movement recorded before this migration was never applied, so
-- quantity_on_hand is still whatever it was at SKU creation (0 by
-- default — there is no interface for setting an opening balance).
-- Recomputing from the ledger is therefore the correct position.
--
-- SKUs with no movements are left untouched.
-- ------------------------------------------------------------
do $$
declare
  touched integer;
begin
  with ledger as (
    select sku_id, sum(inventory_movement_delta(type, quantity))::integer as total
      from inventory_movement
     group by sku_id
  )
  update inventory_sku s
     set quantity_on_hand = ledger.total
    from ledger
   where s.id = ledger.sku_id
     and s.quantity_on_hand is distinct from ledger.total;

  get diagnostics touched = row_count;
  raise notice 'Backfill complete — % SKU(s) recalculated from the ledger.', touched;
end $$;

-- ------------------------------------------------------------
-- Verification.
--
-- 'drift' must be 0 on every row. Anything else means the ledger and
-- the stock figure disagree, and the trigger is not doing its job.
-- ------------------------------------------------------------
select
  s.sku,
  s.name,
  s.quantity_on_hand,
  coalesce(sum(inventory_movement_delta(m.type, m.quantity)), 0)::integer as ledger_total,
  s.quantity_on_hand
    - coalesce(sum(inventory_movement_delta(m.type, m.quantity)), 0)::integer as drift,
  count(m.id) as movements
from inventory_sku s
left join inventory_movement m on m.sku_id = s.id
group by s.id, s.sku, s.name, s.quantity_on_hand
order by s.sku;

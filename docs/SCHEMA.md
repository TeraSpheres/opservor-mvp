# Opservor HQ — schema reference

Quick reference for the five production modules. Transcribed from the migrations,
not from intent — where something is defined but unused, it says so.

The formal specification lives in the archive at
`Module_Specs/Opservor_Module_Specifications_v1.0.docx`.

---

## Conventions

Every table follows the same five rules. Learn them once.

| Rule | Detail |
|---|---|
| **Tenancy** | `company_id uuid not null references company(id) on delete cascade` on every table |
| **RLS** | Enabled everywhere. One policy per table, `FOR ALL`, `USING` **and** `WITH CHECK` = `company_id = auth_company_id()` |
| **Keys** | `uuid primary key default gen_random_uuid()` — no sequences, no natural keys |
| **Audit** | State tables get `created_at` + `updated_at` + a BEFORE UPDATE trigger. Ledger tables get `created_at` only |
| **Snapshots** | Aggregate tables exist and are secured, but nothing writes to them yet |

`WITH CHECK` is the half people forget. `USING` stops you *reading* another
tenant's rows; `WITH CHECK` stops you *writing* one. Both are required — a
front-end bug must not be able to cross the tenant boundary.

### Ledger tables

No `updated_at`, no update trigger, by design — a ledger row that changes after
the fact is a defect:

`fleet_trip` · `inventory_movement` · `finance_transaction` · `hr_attendance`

---

## Warehouse v1.1 — `0002`

| Table | Purpose |
|---|---|
| `warehouse_site` | One row per physical location |
| `warehouse_snapshot` | Daily productivity per site per shift |

`warehouse_snapshot` carries `unique (company_id, site_id, date, shift)`, which is
what makes the upsert on re-entry safe. `shift` is the `shift_type` enum —
`A` / `B` / `C` / `all`. Both percentage columns are `check between 0 and 100`;
both order counts are `check >= 0`.

## Fleet v1.0 — `0003`

| Table | Purpose |
|---|---|
| `fleet_vehicle` | Vehicle master. `status`: active / maintenance / retired / inactive |
| `fleet_trip` | One row per journey (ledger) |
| `fleet_metrics` | Daily rollup per vehicle — **defined, never written** |

`fleet_vehicle.mileage` is stored but never updated from trip data.

## Inventory v1.0 — `0004`

| Table | Purpose |
|---|---|
| `inventory_sku` | Product master |
| `inventory_movement` | Stock transactions (ledger). `type`: inbound / outbound / adjustment / reorder |
| `inventory_snapshot` | Daily position per SKU — **defined, never written** |

Availability is derived, never stored: `quantity_on_hand - quantity_reserved`.
A SKU is low when that value falls to or below `reorder_level`.

> **Two gaps here.** `inventory_sku.sku` is unique *globally*, not per company —
> two tenants cannot both use `WIDGET-1`. And logging a movement does **not**
> adjust `quantity_on_hand`. See [Known gaps](#known-gaps).

## Finance v1.0 — `0005`

| Table | Purpose |
|---|---|
| `finance_cost_center` | Budget unit. `unique (company_id, code)` |
| `finance_transaction` | Ledger. `type`: revenue / expense / adjustment |
| `finance_snapshot` | Monthly rollup — **defined, never written** |

Revenue and expense are separated by `type`, not by the sign of `amount`, so
reporting never depends on interpreting a negative number. `amount` is magnitude.

## HR v1.0 — `0006`

| Table | Purpose |
|---|---|
| `hr_department` | Org unit. `unique (company_id, code)` |
| `hr_employee` | Employee master. `unique (company_id, email)` |
| `hr_attendance` | Daily attendance (ledger). `unique (company_id, employee_id, date)` |
| `hr_performance` | Periodic review. `rating` is `check 1–5` — **no UI yet** |
| `hr_snapshot` | Monthly headcount — **defined, never written** |

`hr_employee.manager_id` self-references with `ON DELETE SET NULL`, so removing a
manager orphans their reports rather than cascading a deletion through the org
chart. `department_id` is `not null`, which is why the employee form stays hidden
until a department exists.

---

## Migration status

| File | Module | Applied |
|---|---|---|
| `0001_init.sql` | Core — `company`, `app_user`, `auth_company_id()`, `update_updated_at_column()` | Yes |
| `0002_add_warehouse_module.sql` | Warehouse | Yes |
| `0003_add_fleet_module.sql` | Fleet | Yes |
| `0004_add_inventory_module.sql` | Inventory | Yes |
| `0005_add_finance_module.sql` | Finance | **Pending** |
| `0006_add_hr_module.sql` | HR | **Pending** |

Run `RUN_ME_finance_hr.sql` in the Supabase SQL editor to apply the last two. It
combines both, is safe to re-run, and preflights that `0001` is present. Until it
runs, `/finance` and `/hr` error at the database layer.

---

## Known gaps

Recorded so they stay decisions rather than becoming surprises.

1. **`inventory_sku.sku` is globally unique.** Must become
   `unique (company_id, sku)` before a second tenant is onboarded.
2. **Movements don't move stock.** `inventory_movement` inserts leave
   `inventory_sku.quantity_on_hand` untouched. Needs a trigger or a transactional
   update in the server action.
3. **Snapshot tables are inert.** Four modules define them; nothing populates
   them. Metrics are derived on read, which is correct at current volume and
   won't stay correct.
4. **`fleet_vehicle.mileage` never updates** from trip data.
5. **`hr_performance` and `hr_snapshot` have no interface.** Secured and
   reachable by SQL, unreachable from the app.
6. **One role only.** The single RLS policy grants full access to any
   authenticated member of the tenant. No read-only, no per-module scoping.

# Opservor HQ — schema reference

Quick reference for the seven production modules — the complete v1 scope. Transcribed from the migrations,
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

`inventory_movement` · `finance_transaction` · `hr_attendance` · `report_run`

> **Inconsistency.** `fleet_trip` is a ledger by nature but carries `updated_at`
> and an update trigger, unlike the other three. It was written before the
> convention settled. Harmless, but it means "does this table have `updated_at`"
> is not a reliable test for whether something is a ledger. Worth aligning when
> Fleet is next touched.

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

Since `0007`, movements adjust stock automatically via the
`inventory_movement_sync` trigger. The sign convention lives in one function,
`inventory_movement_delta(type, quantity)`:

| Type | Effect on `quantity_on_hand` |
|---|---|
| `inbound` | add |
| `outbound` | subtract |
| `adjustment` | add as signed — may be negative |
| `reorder` | **none** — raising a PO doesn't change what's on the shelf |

The trigger fires on UPDATE and DELETE too. The ledger is meant to be
append-only, but if a row is ever corrected by hand the stock figure follows
instead of silently drifting.

> **One gap remains here.** `inventory_sku.sku` is unique *globally*, not per
> company — two tenants cannot both use `WIDGET-1`. See [Known gaps](#known-gaps).

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

## Safety v1.0 — `0008`

| Table | Purpose |
|---|---|
| `safety_incident` | One row per incident. Severity, category, corrective action, status |
| `safety_inspection` | Scheduled checks. An inspection is something you do; an incident is something that happened |
| `safety_snapshot` | Monthly rollup — **defined, never written** |

`severity` is `low` / `medium` / `high` / `critical`; `status` is `open` /
`investigating` / `resolved` / `closed`. Days-since-last-incident and open counts
are derived on read until the snapshot table is populated.

## Reports v1.0 — `0008`

| Table | Purpose |
|---|---|
| `report_definition` | A saved report. `unique (company_id, name)` |
| `report_run` | Execution log (ledger). No `updated_at` |

**Reports holds no operational data of its own.** It reads what the other modules
already hold, scoped to a period. Every query is company-scoped by RLS, so a wrong
filter still cannot reach across tenants.

`module` accepts any of the six modules or `cross_module`, which summarises all
of them at once.

---

## Migration status

Shipping code does not apply schema — a Vercel deploy never touches the database.
Applying is always a deliberate manual step.

Rows marked **verified** were read back from `pg_class` / `pg_policies`. Rows
marked **reported** were confirmed by the operator who ran them but not read back.
The distinction matters: Fleet and Inventory were once recorded as applied on
inference alone and were not, which only surfaced when a later migration refused
to run.

| File | Module | Applied |
|---|---|---|
| `0001_init.sql` | Core — `company`, `app_user`, `auth_company_id()`, `update_updated_at_column()` | Verified |
| `0002_add_warehouse_module.sql` | Warehouse | Verified |
| `0003` / `RUN_ME_fleet_inventory.sql` | Fleet | Verified |
| `0004` / `RUN_ME_fleet_inventory.sql` | Inventory | Verified |
| `RUN_ME_finance_hr.sql` (`0005`+`0006`) | Finance, HR | Verified |
| `RUN_ME_final.sql` (`0007`+`0008`) | Inventory stock trigger, Safety, Reports | Reported |

Fleet and Inventory ran months after their code deployed — both routes errored at
the database layer in the meantime without anyone noticing, because nobody
visited them. **Apply the migration in the same session you ship the module.**

### Re-runnability

`0003` and `0004` shipped with bare `create policy` and `create trigger`.
PostgreSQL has no `IF NOT EXISTS` for either, so a half-applied run could not be
repaired by running the file again — it would fail on "already exists" and leave
you hand-editing SQL to find the resume point.

Every migration from `0005` onward drops before creating and preflights its
dependencies. `RUN_ME_fleet_inventory.sql` is the guarded rewrite of `0003`+`0004`.
Use the `RUN_ME_` files, not the originals.

---

## Known gaps

Recorded so they stay decisions rather than becoming surprises.

1. **`inventory_sku.sku` is globally unique.** Must become
   `unique (company_id, sku)` before a second tenant is onboarded.
2. ~~**Movements don't move stock.**~~ Fixed in `0007` — the
   `inventory_movement_sync` trigger now maintains `quantity_on_hand`, and
   historical movements were backfilled.
3. **Snapshot tables are inert.** Five modules define them; nothing populates
   them. Metrics are derived on read, which is correct at current volume and
   won't stay correct.
4. **`fleet_vehicle.mileage` never updates** from trip data.
5. **`hr_performance` and `hr_snapshot` have no interface.** Secured and
   reachable by SQL, unreachable from the app.
6. **One role only.** The single RLS policy grants full access to any
   authenticated member of the tenant. No read-only, no per-module scoping.

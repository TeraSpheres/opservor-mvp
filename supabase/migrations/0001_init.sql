-- Opservor HQ — v1 data model
-- Mirrors Section 5 of Opservor-MVP-Spec-v1.3 exactly. Single-tenant for v1
-- (one row in "company"), but company_id is kept on every table so the
-- schema survives the move to multi-tenant later without a rewrite.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- company
-- ---------------------------------------------------------------------
create table if not exists company (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  timezone   text not null default 'UTC',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- app_user  (named app_user, not "user", to avoid the reserved word)
-- role is fixed to 'founder' for v1 — no other role is issued.
-- ---------------------------------------------------------------------
create table if not exists app_user (
  id         uuid primary key default gen_random_uuid(),
  auth_id    uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references company(id) on delete cascade,
  name       text not null,
  email      text not null unique,
  role       text not null default 'founder' check (role = 'founder'),
  created_at timestamptz not null default now()
);

create index if not exists app_user_auth_id_idx on app_user(auth_id);

-- ---------------------------------------------------------------------
-- kpi_snapshot — one row per company per day
-- ---------------------------------------------------------------------
create table if not exists kpi_snapshot (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references company(id) on delete cascade,
  date                     date not null,
  revenue                  numeric(14,2) not null default 0,
  profit                   numeric(14,2) not null default 0,
  total_loads              integer not null default 0,
  fleet_utilization_pct    numeric(5,2) not null default 0 check (fleet_utilization_pct between 0 and 100),
  on_time_delivery_pct     numeric(5,2) not null default 0 check (on_time_delivery_pct between 0 and 100),
  created_at               timestamptz not null default now(),
  unique (company_id, date)
);

-- ---------------------------------------------------------------------
-- category_score — one row per company per day per category
-- feeds the Business Health Score (Section 6)
-- ---------------------------------------------------------------------
create type category_type as enum (
  'finance',
  'operations',
  'customer',
  'hr',
  'fleet_assets',
  'safety_compliance',
  'inventory_procurement'
);

create table if not exists category_score (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references company(id) on delete cascade,
  date       date not null,
  category   category_type not null,
  score      numeric(5,2) not null check (score between 0 and 100),
  created_at timestamptz not null default now(),
  unique (company_id, date, category)
);

-- ---------------------------------------------------------------------
-- alert — manually entered for v1 (Section 7); no auto-detection yet
-- ---------------------------------------------------------------------
create type alert_severity as enum ('critical', 'high', 'medium');
create type alert_status   as enum ('open', 'resolved');

create table if not exists alert (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references company(id) on delete cascade,
  title      text not null,
  detail     text,
  severity   alert_severity not null,
  owner      text,
  due_date   date,
  status     alert_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists alert_company_status_idx on alert(company_id, status);

-- ---------------------------------------------------------------------
-- Row Level Security — single-tenant v1, but scoped from day one so it
-- is safe to flip on multi-tenant support later without a data leak.
-- ---------------------------------------------------------------------
alter table company        enable row level security;
alter table app_user        enable row level security;
alter table kpi_snapshot    enable row level security;
alter table category_score  enable row level security;
alter table alert           enable row level security;

-- Helper: the company_id of the currently authenticated user.
create or replace function auth_company_id()
returns uuid
language sql
security definer
stable
as $$
  select company_id from app_user where auth_id = auth.uid()
$$;

create policy "user reads own company" on company
  for select using (id = auth_company_id());

create policy "user reads own app_user row" on app_user
  for select using (auth_id = auth.uid());

create policy "founder full access to kpi_snapshot" on kpi_snapshot
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy "founder full access to category_score" on category_score
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy "founder full access to alert" on alert
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

-- ---------------------------------------------------------------------
-- Seed: one company row. Create the founder's app_user row after they
-- sign up, from the app (see /login) — auth_id isn't known until then.
-- ---------------------------------------------------------------------
insert into company (name, timezone)
values ('Your Company', 'America/Edmonton')
on conflict do nothing;

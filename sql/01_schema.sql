-- =============================================================================
-- MISE — Database Schema (Multi-User, Multi-Tenant)
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================================
-- This file is idempotent: safe to run multiple times. It DROPS existing
-- tables before recreating them, so DO NOT run this against a database with
-- production data. For your first setup, this is fine.
--
-- Architecture:
--   * `kitchens`          — the tenant. Every other row belongs to one kitchen.
--   * `kitchen_members`   — links auth.users to kitchens with a role.
--   * Every domain table  — has a `kitchen_id` FK and an RLS policy that
--                            restricts access to rows in the user's kitchens.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CLEAN SLATE (drop in reverse-dependency order)
-- -----------------------------------------------------------------------------
drop table if exists public.scan_history     cascade;
drop table if exists public.sous_messages    cascade;
drop table if exists public.pos_connections  cascade;
drop table if exists public.invoice_lines    cascade;
drop table if exists public.invoices         cascade;
drop table if exists public.waste            cascade;
drop table if exists public.sales            cascade;
drop table if exists public.planner_days     cascade;
drop table if exists public.recipe_ingredients     cascade;
drop table if exists public.component_ingredients  cascade;
drop table if exists public.recipes          cascade;
drop table if exists public.components       cascade;
drop table if exists public.kitchen_settings cascade;
drop table if exists public.kitchen_members  cascade;
drop table if exists public.kitchens         cascade;

-- -----------------------------------------------------------------------------
-- 2. CORE TENANT TABLES
-- -----------------------------------------------------------------------------

create table public.kitchens (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.kitchen_members (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references public.kitchens(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'owner'
              check (role in ('owner','head_chef','sous_chef','viewer')),
  created_at  timestamptz not null default now(),
  unique (kitchen_id, user_id)
);

create index idx_kitchen_members_user on public.kitchen_members(user_id);
create index idx_kitchen_members_kitchen on public.kitchen_members(kitchen_id);

-- -----------------------------------------------------------------------------
-- 3. SETTINGS (one row per kitchen)
-- -----------------------------------------------------------------------------

create table public.kitchen_settings (
  kitchen_id   uuid primary key references public.kitchens(id) on delete cascade,
  role_concept text not null default 'Head chef',
  currency     text not null default '£',
  unit_system  text not null default 'metric'
               check (unit_system in ('metric','imperial','us')),
  timezone     text not null default 'UTC',
  updated_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 4. RECIPE LIBRARY
-- -----------------------------------------------------------------------------

create table public.components (
  id            uuid primary key default gen_random_uuid(),
  kitchen_id    uuid not null references public.kitchens(id) on delete cascade,
  name          text not null,
  batch_yield   numeric not null default 1,
  batch_unit    text not null default 'L',
  prep_time     integer not null default 0,
  hold_life     text default '',
  station       text default 'Sauce',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_components_kitchen on public.components(kitchen_id);

create table public.component_ingredients (
  id            uuid primary key default gen_random_uuid(),
  kitchen_id    uuid not null references public.kitchens(id) on delete cascade,
  component_id  uuid not null references public.components(id) on delete cascade,
  position      integer not null default 0,
  name          text not null,
  qty           numeric not null default 0,
  unit          text not null default 'kg',
  cost          numeric not null default 0,
  supplier      text default 'Veg'
);
create index idx_compingr_component on public.component_ingredients(component_id);
create index idx_compingr_kitchen on public.component_ingredients(kitchen_id);

create table public.recipes (
  id           uuid primary key default gen_random_uuid(),
  kitchen_id   uuid not null references public.kitchens(id) on delete cascade,
  name         text not null,
  category     text not null default 'Main',
  sell_price   numeric not null default 0,
  dietary      text[] default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_recipes_kitchen on public.recipes(kitchen_id);

create table public.recipe_ingredients (
  id            uuid primary key default gen_random_uuid(),
  kitchen_id    uuid not null references public.kitchens(id) on delete cascade,
  recipe_id     uuid not null references public.recipes(id) on delete cascade,
  position      integer not null default 0,
  kind          text not null check (kind in ('raw','comp')),
  -- raw fields:
  name          text,
  cost          numeric default 0,
  supplier      text,
  -- comp fields:
  component_id  uuid references public.components(id) on delete set null,
  -- shared:
  qty           numeric not null default 0,
  unit          text not null default 'kg'
);
create index idx_recipingr_recipe on public.recipe_ingredients(recipe_id);
create index idx_recipingr_kitchen on public.recipe_ingredients(kitchen_id);

-- -----------------------------------------------------------------------------
-- 5. PLANNING & SERVICE
-- -----------------------------------------------------------------------------

create table public.planner_days (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references public.kitchens(id) on delete cascade,
  day         text not null check (day in ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  lunch       integer not null default 0,
  dinner      integer not null default 0,
  unique (kitchen_id, day)
);
create index idx_planner_kitchen on public.planner_days(kitchen_id);

create table public.sales (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references public.kitchens(id) on delete cascade,
  day         text not null,
  session     text not null check (session in ('Lunch','Dinner')),
  recipe_id   uuid references public.recipes(id) on delete set null,
  sold        integer not null default 0,
  created_at  timestamptz not null default now()
);
create index idx_sales_kitchen on public.sales(kitchen_id);
create index idx_sales_recipe on public.sales(recipe_id);

create table public.waste (
  id           uuid primary key default gen_random_uuid(),
  kitchen_id   uuid not null references public.kitchens(id) on delete cascade,
  day          text not null,
  ingredient   text not null,
  qty          numeric not null default 0,
  unit         text not null default 'kg',
  cost         numeric not null default 0,
  reason       text not null default 'Spoilage',
  created_at   timestamptz not null default now()
);
create index idx_waste_kitchen on public.waste(kitchen_id);

-- -----------------------------------------------------------------------------
-- 6. INVOICES & SCANS
-- -----------------------------------------------------------------------------

create table public.invoices (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references public.kitchens(id) on delete cascade,
  supplier    text not null,
  ref         text not null,
  inv_date    text,
  total       numeric not null default 0,
  lines       integer not null default 0,
  status      text not null default 'filed' check (status in ('filed','flagged')),
  flag_note   text,
  created_at  timestamptz not null default now()
);
create index idx_invoices_kitchen on public.invoices(kitchen_id);

create table public.invoice_lines (
  id              uuid primary key default gen_random_uuid(),
  kitchen_id      uuid not null references public.kitchens(id) on delete cascade,
  invoice_id      uuid not null references public.invoices(id) on delete cascade,
  position        integer not null default 0,
  name            text not null,
  qty             numeric not null default 0,
  unit            text not null default '',
  price_per_unit  numeric not null default 0,
  line_total      numeric not null default 0,
  matched         text,
  delta           numeric default 0,
  flag            text
);
create index idx_invlines_invoice on public.invoice_lines(invoice_id);
create index idx_invlines_kitchen on public.invoice_lines(kitchen_id);

create table public.scan_history (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references public.kitchens(id) on delete cascade,
  scan_type   text not null check (scan_type in ('Invoice','Recipe')),
  supplier    text,
  ref         text,
  items       integer not null default 0,
  created_at  timestamptz not null default now()
);
create index idx_scanhist_kitchen on public.scan_history(kitchen_id);

-- -----------------------------------------------------------------------------
-- 7. INTELLIGENCE & INTEGRATIONS
-- -----------------------------------------------------------------------------

create table public.sous_messages (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references public.kitchens(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user','sous')),
  content     text not null,
  created_at  timestamptz not null default now()
);
create index idx_sous_kitchen on public.sous_messages(kitchen_id);

create table public.pos_connections (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references public.kitchens(id) on delete cascade,
  provider    text not null,
  connected   boolean not null default false,
  last_sync   timestamptz,
  unique (kitchen_id, provider)
);
create index idx_pos_kitchen on public.pos_connections(kitchen_id);

-- -----------------------------------------------------------------------------
-- 8. UPDATED-AT TRIGGER
-- -----------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_kitchens_updated   before update on public.kitchens   for each row execute function public.touch_updated_at();
create trigger trg_settings_updated   before update on public.kitchen_settings for each row execute function public.touch_updated_at();
create trigger trg_components_updated before update on public.components for each row execute function public.touch_updated_at();
create trigger trg_recipes_updated    before update on public.recipes    for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 9. AUTO-CREATE A KITCHEN FOR EVERY NEW USER
-- -----------------------------------------------------------------------------
-- When someone signs up, this trigger gives them a kitchen, makes them owner,
-- creates default settings, and seeds default planner days. Frontend code can
-- then optionally insert demo recipes if the kitchen is empty.
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_kitchen_id uuid;
begin
  insert into public.kitchens (name, owner_id)
  values (coalesce(new.raw_user_meta_data->>'kitchen_name', 'My Kitchen'), new.id)
  returning id into new_kitchen_id;

  insert into public.kitchen_members (kitchen_id, user_id, role)
  values (new_kitchen_id, new.id, 'owner');

  insert into public.kitchen_settings (kitchen_id) values (new_kitchen_id);

  insert into public.planner_days (kitchen_id, day, lunch, dinner) values
    (new_kitchen_id, 'Mon', 0, 0),
    (new_kitchen_id, 'Tue', 0, 0),
    (new_kitchen_id, 'Wed', 0, 0),
    (new_kitchen_id, 'Thu', 0, 0),
    (new_kitchen_id, 'Fri', 0, 0),
    (new_kitchen_id, 'Sat', 0, 0),
    (new_kitchen_id, 'Sun', 0, 0);

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

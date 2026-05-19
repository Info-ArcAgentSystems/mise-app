-- =============================================================================
-- MISE — Row-Level Security Policies
-- Run this AFTER 01_schema.sql in: Supabase SQL Editor → New Query → Run
-- =============================================================================
-- This is the security layer. Even if your frontend has a bug and forgets
-- to filter by kitchen_id, the database itself will refuse to return rows
-- that don't belong to the calling user.
--
-- Test after running:
--   1. Create two test users.
--   2. Sign in as User A, insert a recipe.
--   3. Sign in as User B, query recipes — should be EMPTY for User A's data.
-- =============================================================================

-- Helper: returns the set of kitchen_ids the current user is a member of.
-- Used by every policy below.
create or replace function public.user_kitchens()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select kitchen_id from public.kitchen_members where user_id = auth.uid()
$$;

-- -----------------------------------------------------------------------------
-- Enable RLS on every table
-- -----------------------------------------------------------------------------
alter table public.kitchens             enable row level security;
alter table public.kitchen_members      enable row level security;
alter table public.kitchen_settings     enable row level security;
alter table public.components           enable row level security;
alter table public.component_ingredients enable row level security;
alter table public.recipes              enable row level security;
alter table public.recipe_ingredients   enable row level security;
alter table public.planner_days         enable row level security;
alter table public.sales                enable row level security;
alter table public.waste                enable row level security;
alter table public.invoices             enable row level security;
alter table public.invoice_lines        enable row level security;
alter table public.scan_history         enable row level security;
alter table public.sous_messages        enable row level security;
alter table public.pos_connections      enable row level security;

-- -----------------------------------------------------------------------------
-- KITCHENS — members can read their own kitchens; only owner can update/delete
-- -----------------------------------------------------------------------------
drop policy if exists "kitchens_select" on public.kitchens;
create policy "kitchens_select" on public.kitchens for select
  using (id in (select public.user_kitchens()));

drop policy if exists "kitchens_insert" on public.kitchens;
create policy "kitchens_insert" on public.kitchens for insert
  with check (owner_id = auth.uid());

drop policy if exists "kitchens_update" on public.kitchens;
create policy "kitchens_update" on public.kitchens for update
  using (owner_id = auth.uid());

drop policy if exists "kitchens_delete" on public.kitchens;
create policy "kitchens_delete" on public.kitchens for delete
  using (owner_id = auth.uid());

-- -----------------------------------------------------------------------------
-- KITCHEN_MEMBERS — users can see their own memberships; owner manages others
-- -----------------------------------------------------------------------------
drop policy if exists "members_select" on public.kitchen_members;
create policy "members_select" on public.kitchen_members for select
  using (
    user_id = auth.uid()
    or kitchen_id in (select id from public.kitchens where owner_id = auth.uid())
  );

drop policy if exists "members_insert" on public.kitchen_members;
create policy "members_insert" on public.kitchen_members for insert
  with check (
    kitchen_id in (select id from public.kitchens where owner_id = auth.uid())
    or user_id = auth.uid()
  );

drop policy if exists "members_delete" on public.kitchen_members;
create policy "members_delete" on public.kitchen_members for delete
  using (kitchen_id in (select id from public.kitchens where owner_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- GENERIC PATTERN — every domain table follows the same rule:
--   "you can read/write rows whose kitchen_id is one of your kitchens"
-- -----------------------------------------------------------------------------

-- A small helper macro: we'll just generate the four policies for each table.
-- Postgres doesn't support macros, so we repeat — but the shape is identical.

-- KITCHEN_SETTINGS
drop policy if exists "settings_all" on public.kitchen_settings;
create policy "settings_all" on public.kitchen_settings for all
  using (kitchen_id in (select public.user_kitchens()))
  with check (kitchen_id in (select public.user_kitchens()));

-- COMPONENTS
drop policy if exists "components_all" on public.components;
create policy "components_all" on public.components for all
  using (kitchen_id in (select public.user_kitchens()))
  with check (kitchen_id in (select public.user_kitchens()));

-- COMPONENT_INGREDIENTS
drop policy if exists "compingr_all" on public.component_ingredients;
create policy "compingr_all" on public.component_ingredients for all
  using (kitchen_id in (select public.user_kitchens()))
  with check (kitchen_id in (select public.user_kitchens()));

-- RECIPES
drop policy if exists "recipes_all" on public.recipes;
create policy "recipes_all" on public.recipes for all
  using (kitchen_id in (select public.user_kitchens()))
  with check (kitchen_id in (select public.user_kitchens()));

-- RECIPE_INGREDIENTS
drop policy if exists "recipingr_all" on public.recipe_ingredients;
create policy "recipingr_all" on public.recipe_ingredients for all
  using (kitchen_id in (select public.user_kitchens()))
  with check (kitchen_id in (select public.user_kitchens()));

-- PLANNER_DAYS
drop policy if exists "planner_all" on public.planner_days;
create policy "planner_all" on public.planner_days for all
  using (kitchen_id in (select public.user_kitchens()))
  with check (kitchen_id in (select public.user_kitchens()));

-- SALES
drop policy if exists "sales_all" on public.sales;
create policy "sales_all" on public.sales for all
  using (kitchen_id in (select public.user_kitchens()))
  with check (kitchen_id in (select public.user_kitchens()));

-- WASTE
drop policy if exists "waste_all" on public.waste;
create policy "waste_all" on public.waste for all
  using (kitchen_id in (select public.user_kitchens()))
  with check (kitchen_id in (select public.user_kitchens()));

-- INVOICES
drop policy if exists "invoices_all" on public.invoices;
create policy "invoices_all" on public.invoices for all
  using (kitchen_id in (select public.user_kitchens()))
  with check (kitchen_id in (select public.user_kitchens()));

-- INVOICE_LINES
drop policy if exists "invlines_all" on public.invoice_lines;
create policy "invlines_all" on public.invoice_lines for all
  using (kitchen_id in (select public.user_kitchens()))
  with check (kitchen_id in (select public.user_kitchens()));

-- SCAN_HISTORY
drop policy if exists "scanhist_all" on public.scan_history;
create policy "scanhist_all" on public.scan_history for all
  using (kitchen_id in (select public.user_kitchens()))
  with check (kitchen_id in (select public.user_kitchens()));

-- SOUS_MESSAGES
drop policy if exists "sous_all" on public.sous_messages;
create policy "sous_all" on public.sous_messages for all
  using (kitchen_id in (select public.user_kitchens()))
  with check (kitchen_id in (select public.user_kitchens()));

-- POS_CONNECTIONS
drop policy if exists "pos_all" on public.pos_connections;
create policy "pos_all" on public.pos_connections for all
  using (kitchen_id in (select public.user_kitchens()))
  with check (kitchen_id in (select public.user_kitchens()));

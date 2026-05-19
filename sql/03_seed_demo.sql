-- =============================================================================
-- MISE — Optional Seed: a function the frontend can call to populate a new
-- kitchen with the demo data (recipes, components, sample sales, etc.) so
-- a brand-new user isn't staring at an empty app.
--
-- Run this AFTER 02_rls_policies.sql.
-- The frontend calls it via:  await supabase.rpc('seed_demo_data')
-- =============================================================================

create or replace function public.seed_demo_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k_id          uuid;
  comp_stock    uuid;
  comp_onions   uuid;
  comp_lardons  uuid;
  rec_bourg     uuid;
  rec_salmon    uuid;
  rec_risotto   uuid;
  rec_brulee    uuid;
  rec_caesar    uuid;
begin
  -- Find the kitchen the calling user owns; bail if they already have data.
  select id into k_id
    from public.kitchens
   where owner_id = auth.uid()
   limit 1;

  if k_id is null then
    raise exception 'No kitchen found for current user';
  end if;

  if exists (select 1 from public.recipes where kitchen_id = k_id) then
    return; -- already seeded, do nothing
  end if;

  ----------------------------------------------------------------------
  -- Components (sub-recipes)
  ----------------------------------------------------------------------
  insert into public.components (kitchen_id, name, batch_yield, batch_unit, prep_time, hold_life, station)
  values (k_id, 'Beef Stock', 4, 'L', 240, 'frozen 1mo · fridge 5d', 'Sauce')
  returning id into comp_stock;

  insert into public.component_ingredients (kitchen_id, component_id, position, name, qty, unit, cost, supplier) values
    (k_id, comp_stock, 0, 'Beef Bones',     3,    'kg', 2.50, 'Meat'),
    (k_id, comp_stock, 1, 'Mirepoix Veg',   1,    'kg', 2.20, 'Veg'),
    (k_id, comp_stock, 2, 'Tomato Paste',   0.1,  'kg', 4.00, 'Dry Goods'),
    (k_id, comp_stock, 3, 'Bay & Thyme',    0.02, 'kg', 18.0, 'Veg');

  insert into public.components (kitchen_id, name, batch_yield, batch_unit, prep_time, hold_life, station)
  values (k_id, 'Glazed Pearl Onions', 1.5, 'kg', 45, 'fridge 2d', 'Garde Manger')
  returning id into comp_onions;

  insert into public.component_ingredients (kitchen_id, component_id, position, name, qty, unit, cost, supplier) values
    (k_id, comp_onions, 0, 'Pearl Onions',  1.6,  'kg', 3.20, 'Veg'),
    (k_id, comp_onions, 1, 'Butter',        0.05, 'kg', 8.00, 'Dairy'),
    (k_id, comp_onions, 2, 'Caster Sugar',  0.02, 'kg', 1.10, 'Dry Goods');

  insert into public.components (kitchen_id, name, batch_yield, batch_unit, prep_time, hold_life, station)
  values (k_id, 'Lardons & Mushrooms', 2, 'kg', 25, 'same day', 'Saute')
  returning id into comp_lardons;

  insert into public.component_ingredients (kitchen_id, component_id, position, name, qty, unit, cost, supplier) values
    (k_id, comp_lardons, 0, 'Smoked Bacon',     0.8, 'kg', 12.50, 'Meat'),
    (k_id, comp_lardons, 1, 'Button Mushrooms', 1.2, 'kg', 4.00,  'Veg'),
    (k_id, comp_lardons, 2, 'Butter',           0.03,'kg', 8.00,  'Dairy');

  ----------------------------------------------------------------------
  -- Recipes
  ----------------------------------------------------------------------
  insert into public.recipes (kitchen_id, name, category, sell_price, dietary)
  values (k_id, 'Beef Bourguignon', 'Main', 24, array['DF']) returning id into rec_bourg;
  insert into public.recipe_ingredients (kitchen_id, recipe_id, position, kind, name, qty, unit, cost, supplier) values
    (k_id, rec_bourg, 0, 'raw', 'Beef Cheek', 0.20, 'kg', 14, 'Meat');
  insert into public.recipe_ingredients (kitchen_id, recipe_id, position, kind, component_id, qty, unit) values
    (k_id, rec_bourg, 1, 'comp', comp_stock,   0.18, 'L'),
    (k_id, rec_bourg, 2, 'comp', comp_onions,  0.08, 'kg'),
    (k_id, rec_bourg, 3, 'comp', comp_lardons, 0.10, 'kg');
  insert into public.recipe_ingredients (kitchen_id, recipe_id, position, kind, name, qty, unit, cost, supplier) values
    (k_id, rec_bourg, 4, 'raw', 'Red Wine', 0.15, 'L', 8, 'Dry Goods');

  insert into public.recipes (kitchen_id, name, category, sell_price, dietary)
  values (k_id, 'Roasted Salmon', 'Main', 22, array['GF','DF']) returning id into rec_salmon;
  insert into public.recipe_ingredients (kitchen_id, recipe_id, position, kind, name, qty, unit, cost, supplier) values
    (k_id, rec_salmon, 0, 'raw', 'Salmon Fillet',         0.18, 'kg', 18,   'Meat'),
    (k_id, rec_salmon, 1, 'raw', 'Tenderstem Broccoli',   0.10, 'kg', 6,    'Veg'),
    (k_id, rec_salmon, 2, 'raw', 'Lemon',                 0.5,  'ea', 0.40, 'Veg');

  insert into public.recipes (kitchen_id, name, category, sell_price, dietary)
  values (k_id, 'Mushroom Risotto', 'Main', 18, array['V','GF']) returning id into rec_risotto;
  insert into public.recipe_ingredients (kitchen_id, recipe_id, position, kind, name, qty, unit, cost, supplier) values
    (k_id, rec_risotto, 0, 'raw', 'Arborio Rice',     0.10, 'kg', 2.20, 'Dry Goods'),
    (k_id, rec_risotto, 1, 'raw', 'Mixed Mushrooms',  0.12, 'kg', 9,    'Veg'),
    (k_id, rec_risotto, 2, 'raw', 'Parmesan',         0.04, 'kg', 22,   'Dairy'),
    (k_id, rec_risotto, 3, 'raw', 'White Wine',       0.05, 'L',  6,    'Dry Goods');

  insert into public.recipes (kitchen_id, name, category, sell_price, dietary)
  values (k_id, 'Crème Brûlée', 'Dessert', 8, array['V','GF']) returning id into rec_brulee;
  insert into public.recipe_ingredients (kitchen_id, recipe_id, position, kind, name, qty, unit, cost, supplier) values
    (k_id, rec_brulee, 0, 'raw', 'Double Cream',  0.15, 'L',  3.20, 'Dairy'),
    (k_id, rec_brulee, 1, 'raw', 'Egg Yolks',     3,    'ea', 0.30, 'Dairy'),
    (k_id, rec_brulee, 2, 'raw', 'Caster Sugar',  0.04, 'kg', 1.10, 'Dry Goods'),
    (k_id, rec_brulee, 3, 'raw', 'Vanilla Pod',   0.25, 'ea', 2.40, 'Dry Goods');

  insert into public.recipes (kitchen_id, name, category, sell_price, dietary)
  values (k_id, 'Caesar Salad', 'Starter', 11, array[]::text[]) returning id into rec_caesar;
  insert into public.recipe_ingredients (kitchen_id, recipe_id, position, kind, name, qty, unit, cost, supplier) values
    (k_id, rec_caesar, 0, 'raw', 'Romaine Lettuce', 0.15, 'kg', 2.80, 'Veg'),
    (k_id, rec_caesar, 1, 'raw', 'Parmesan',        0.03, 'kg', 22,   'Dairy'),
    (k_id, rec_caesar, 2, 'raw', 'Anchovies',       0.02, 'kg', 14,   'Meat'),
    (k_id, rec_caesar, 3, 'raw', 'Sourdough',       0.05, 'kg', 4,    'Bakery');

  ----------------------------------------------------------------------
  -- Planner: overwrite the zeros from handle_new_user
  ----------------------------------------------------------------------
  update public.planner_days set lunch=40, dinner=60  where kitchen_id = k_id and day='Mon';
  update public.planner_days set lunch=45, dinner=70  where kitchen_id = k_id and day='Tue';
  update public.planner_days set lunch=50, dinner=80  where kitchen_id = k_id and day='Wed';
  update public.planner_days set lunch=55, dinner=90  where kitchen_id = k_id and day='Thu';
  update public.planner_days set lunch=60, dinner=100 where kitchen_id = k_id and day='Fri';
  update public.planner_days set lunch=65, dinner=110 where kitchen_id = k_id and day='Sat';
  update public.planner_days set lunch=50, dinner=80  where kitchen_id = k_id and day='Sun';

  ----------------------------------------------------------------------
  -- Sample sales
  ----------------------------------------------------------------------
  insert into public.sales (kitchen_id, day, session, recipe_id, sold) values
    (k_id, 'Mon', 'Lunch',  rec_bourg,   12),
    (k_id, 'Mon', 'Lunch',  rec_salmon,   8),
    (k_id, 'Mon', 'Dinner', rec_bourg,   18),
    (k_id, 'Mon', 'Dinner', rec_risotto, 14),
    (k_id, 'Mon', 'Dinner', rec_caesar,  10),
    (k_id, 'Tue', 'Lunch',  rec_salmon,  11),
    (k_id, 'Tue', 'Lunch',  rec_caesar,   9),
    (k_id, 'Tue', 'Dinner', rec_bourg,   16),
    (k_id, 'Tue', 'Dinner', rec_risotto, 12),
    (k_id, 'Tue', 'Dinner', rec_brulee,  22);

  ----------------------------------------------------------------------
  -- Sample waste
  ----------------------------------------------------------------------
  insert into public.waste (kitchen_id, day, ingredient, qty, unit, cost, reason) values
    (k_id, 'Tue', 'Mixed Mushrooms', 0.4,  'kg', 3.60, 'Spoilage'),
    (k_id, 'Wed', 'Romaine Lettuce', 0.6,  'kg', 1.80, 'Over-prep'),
    (k_id, 'Thu', 'Salmon Fillet',   0.18, 'kg', 3.24, 'Returned');

end $$;

-- Allow authenticated users to call this RPC.
grant execute on function public.seed_demo_data() to authenticated;

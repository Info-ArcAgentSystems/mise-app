// src/hooks/useKitchenState.js
//
// Drop-in replacement for the original `usePersistedState` hook.
//
// Returns the SAME shape: [state, update, loaded]
//   * state    — the full app state object
//   * update   — same setter signature as before, accepts either an object or a function
//   * loaded   — true once the initial fetch from Supabase has completed
//
// All persistence flows through Supabase. RLS policies guarantee a user can
// only read/write rows belonging to a kitchen they're a member of.
//
// Design notes:
//   * Initial state is EMPTY — no seed data. The user lands in a blank app.
//   * Saves are debounced (600ms) and dispatched per-slice. Only the data
//     that actually changed gets written.
//   * IDs from the database are UUIDs (real strings). Anything created in
//     the UI before its first save uses a tempId; on first insert we swap
//     in the real UUID returned by Postgres.
//   * `prepDone` stays in localStorage (it's pure UI checkbox state — not
//     worth a database table).

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const DEFAULT_SETTINGS = {
  role: 'Head chef',
  currency: '£',
  unitSystem: 'metric',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};

// Default planner so the planner screen has 7 days to render even when empty.
const DEFAULT_PLANNER = [
  { day: 'Mon', lunch: 0, dinner: 0 },
  { day: 'Tue', lunch: 0, dinner: 0 },
  { day: 'Wed', lunch: 0, dinner: 0 },
  { day: 'Thu', lunch: 0, dinner: 0 },
  { day: 'Fri', lunch: 0, dinner: 0 },
  { day: 'Sat', lunch: 0, dinner: 0 },
  { day: 'Sun', lunch: 0, dinner: 0 },
];

const EMPTY_STATE = {
  settings: DEFAULT_SETTINGS,
  recipes: [],
  components: [],
  planner: DEFAULT_PLANNER,
  sales: [],
  waste: [],
  prepDone: {},
  scanHistory: [],
  sousMessages: [],
  invoices: [],
  posConnections: {},
  posLastSync: {},
};

// =============================================================================
// HOOK
// =============================================================================
export function useKitchenState(kitchenId) {
  const [state, setState] = useState(EMPTY_STATE);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);
  const pendingDelta = useRef({});

  // ------ LOAD ---------------------------------------------------------------
  const load = useCallback(async () => {
    if (!kitchenId) {
      setState(EMPTY_STATE);
      setLoaded(true);
      return;
    }
    setLoaded(false);

    const eq = (q) => q.eq('kitchen_id', kitchenId);

    const [
      settings,
      recipes,
      recipeIngredients,
      components,
      componentIngredients,
      planner,
      sales,
      waste,
      invoices,
      invoiceLines,
      scanHistory,
      sousMessages,
      pos,
    ] = await Promise.all([
      eq(supabase.from('kitchen_settings').select('*')).maybeSingle(),
      eq(supabase.from('recipes').select('*')).order('created_at'),
      eq(supabase.from('recipe_ingredients').select('*')),
      eq(supabase.from('components').select('*')).order('created_at'),
      eq(supabase.from('component_ingredients').select('*')),
      eq(supabase.from('planner_days').select('*')),
      eq(supabase.from('sales').select('*')).order('created_at'),
      eq(supabase.from('waste').select('*')).order('created_at'),
      eq(supabase.from('invoices').select('*')).order('created_at', { ascending: false }),
      eq(supabase.from('invoice_lines').select('*')),
      eq(supabase.from('scan_history').select('*')).order('created_at', { ascending: false }).limit(50),
      eq(supabase.from('sous_messages').select('*')).order('created_at'),
      eq(supabase.from('pos_connections').select('*')),
    ]);

    // Group child rows by parent ID for the mapper.
    const recipeIngredientsByRecipe = {};
    (recipeIngredients.data || []).forEach((r) => {
      (recipeIngredientsByRecipe[r.recipe_id] ||= []).push(r);
    });
    const componentIngredientsByComponent = {};
    (componentIngredients.data || []).forEach((c) => {
      (componentIngredientsByComponent[c.component_id] ||= []).push(c);
    });
    const invoiceLinesByInvoice = {};
    (invoiceLines.data || []).forEach((l) => {
      (invoiceLinesByInvoice[l.invoice_id] ||= []).push(l);
    });

    setState({
      settings: settings.data
        ? {
            role: settings.data.role_concept,
            currency: settings.data.currency,
            unitSystem: settings.data.unit_system,
            timezone: settings.data.timezone,
          }
        : DEFAULT_SETTINGS,

      recipes: (recipes.data || []).map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        sellPrice: Number(r.sell_price),
        dietary: r.dietary || [],
        ingredients: (recipeIngredientsByRecipe[r.id] || [])
          .sort((a, b) => a.position - b.position)
          .map((ri) =>
            ri.kind === 'comp'
              ? {
                  kind: 'comp',
                  componentId: ri.component_id,
                  qty: Number(ri.qty),
                  unit: ri.unit,
                }
              : {
                  kind: 'raw',
                  name: ri.name,
                  qty: Number(ri.qty),
                  unit: ri.unit,
                  cost: Number(ri.cost),
                  supplier: ri.supplier,
                }
          ),
      })),

      components: (components.data || []).map((c) => ({
        id: c.id,
        name: c.name,
        batchYield: Number(c.batch_yield),
        batchUnit: c.batch_unit,
        prepTime: c.prep_time,
        holdLife: c.hold_life,
        station: c.station,
        ingredients: (componentIngredientsByComponent[c.id] || [])
          .sort((a, b) => a.position - b.position)
          .map((ci) => ({
            name: ci.name,
            qty: Number(ci.qty),
            unit: ci.unit,
            cost: Number(ci.cost),
            supplier: ci.supplier,
          })),
      })),

      // Planner: if DB has 7 days, use them; otherwise fall back to defaults so the UI renders.
      planner:
        planner.data && planner.data.length === 7
          ? sortDays(
              planner.data.map((p) => ({
                day: p.day,
                lunch: p.lunch,
                dinner: p.dinner,
              }))
            )
          : DEFAULT_PLANNER,

      sales: (sales.data || []).map((s) => ({
        day: s.day,
        session: s.session,
        recipeId: s.recipe_id,
        sold: s.sold,
      })),

      waste: (waste.data || []).map((w) => ({
        id: w.id,
        day: w.day,
        ingredient: w.ingredient,
        qty: Number(w.qty),
        unit: w.unit,
        cost: Number(w.cost),
        reason: w.reason,
      })),

      invoices: (invoices.data || []).map((inv) => ({
        id: inv.id,
        supplier: inv.supplier,
        ref: inv.ref,
        date: inv.inv_date,
        total: Number(inv.total),
        lines: inv.lines,
        status: inv.status,
        flagNote: inv.flag_note,
        items: (invoiceLinesByInvoice[inv.id] || [])
          .sort((a, b) => a.position - b.position)
          .map((il) => ({
            name: il.name,
            qty: Number(il.qty),
            unit: il.unit,
            pricePerUnit: Number(il.price_per_unit),
            lineTotal: Number(il.line_total),
            matched: il.matched,
            delta: Number(il.delta),
            flag: il.flag,
          })),
      })),

      scanHistory: (scanHistory.data || []).map((s) => ({
        id: s.id,
        type: s.scan_type,
        supplier: s.supplier,
        ref: s.ref,
        items: s.items,
        time: new Date(s.created_at).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })),

      sousMessages: (sousMessages.data || []).map((m) => ({
        role: m.role,
        content: m.content,
        ts: new Date(m.created_at).getTime(),
      })),

      posConnections: Object.fromEntries(
        (pos.data || []).map((p) => [p.provider, p.connected])
      ),
      posLastSync: Object.fromEntries(
        (pos.data || []).filter((p) => p.last_sync).map((p) => [p.provider, p.last_sync])
      ),

      prepDone: safeParseLocal('mise_prepDone', {}),
    });

    setLoaded(true);
  }, [kitchenId]);

  useEffect(() => {
    load();
  }, [load]);

  // ------ UPDATE -------------------------------------------------------------
  // Same signature as the original hook. Schedules a debounced DB sync.
  const update = useCallback(
    (patch) => {
      setState((prev) => {
        const delta = typeof patch === 'function' ? patch(prev) : patch;
        const next = { ...prev, ...delta };

        // prepDone is UI state — store in localStorage, don't sync to DB.
        if ('prepDone' in delta) {
          try {
            localStorage.setItem('mise_prepDone', JSON.stringify(next.prepDone));
          } catch {}
        }

        // Merge incoming delta with anything still queued for write.
        Object.assign(pendingDelta.current, delta);

        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          const toSync = pendingDelta.current;
          pendingDelta.current = {};
          syncDelta(kitchenId, toSync, next).catch((e) =>
            console.error('Supabase sync error:', e)
          );
        }, 600);

        return next;
      });
    },
    [kitchenId]
  );

  return [state, update, loaded];
}

// =============================================================================
// SYNC — per-slice writes
// =============================================================================
async function syncDelta(kitchenId, delta, next) { if (!kitchenId) return; await supabase.from('kitchens').upsert({ id: kitchenId }, { onConflict: 'id' }); if ('components' in delta) await syncComponents(kitchenId, next.components); if ('recipes' in delta) await syncRecipes(kitchenId, next.recipes); if ('settings' in delta) await syncSettings(kitchenId, next.settings); if ('planner' in delta) await syncPlanner(kitchenId, next.planner); if ('sales' in delta) await syncSales(kitchenId, next.sales); if ('waste' in delta) await syncWaste(kitchenId, next.waste); if ('invoices' in delta) await syncInvoices(kitchenId, next.invoices); if ('scanHistory' in delta) await syncScanHistory(kitchenId, next.scanHistory); if ('sousMessages' in delta) await syncSousMessages(kitchenId, next.sousMessages); if ('posConnections' in delta || 'posLastSync' in delta) { await syncPos(kitchenId, next.posConnections, next.posLastSync); } }
async function syncSettings(kitchenId, s) {
  await supabase.from('kitchen_settings').upsert({
    kitchen_id: kitchenId,
    role_concept: s.role,
    currency: s.currency,
    unit_system: s.unitSystem,
    timezone: s.timezone,
  });
}

async function syncPlanner(kitchenId, planner) {
  await supabase.from('planner_days').upsert(
    planner.map((p) => ({
      kitchen_id: kitchenId,
      day: p.day,
      lunch: p.lunch,
      dinner: p.dinner,
    })),
    { onConflict: 'kitchen_id,day' }
  );
}

async function syncRecipes(kitchenId, recipes) {
  const realIds = recipes.map((r) => r.id).filter(isUuid);
  if (realIds.length === 0) {
    await supabase.from('recipes').delete().eq('kitchen_id', kitchenId);
  } else {
    await supabase
      .from('recipes')
      .delete()
      .eq('kitchen_id', kitchenId)
      .not('id', 'in', `(${realIds.join(',')})`);
  }
  for (const r of recipes) {
    let id = r.id;
    if (!isUuid(id)) {
      const { data, error } = await supabase
        .from('recipes')
        .insert({
          kitchen_id: kitchenId,
          name: r.name,
          category: r.category,
          sell_price: r.sellPrice,
          dietary: r.dietary || [],
        })
        .select('id')
        .single();
      if (error) {
        console.error(error);
        continue;
      }
      id = data.id;
      r.id = id; // mutate so the in-memory state holds the real UUID
    } else {
      await supabase
        .from('recipes')
        .update({
          name: r.name,
          category: r.category,
          sell_price: r.sellPrice,
          dietary: r.dietary || [],
        })
        .eq('id', id);
    }

    await supabase.from('recipe_ingredients').delete().eq('recipe_id', id);
    if (r.ingredients?.length) {
      await supabase.from('recipe_ingredients').insert(
        r.ingredients.map((ing, i) =>
          ing.kind === 'comp'
            ? {
                kitchen_id: kitchenId,
                recipe_id: id,
                position: i,
                kind: 'comp',
                component_id: isUuid(ing.componentId) ? ing.componentId : null,
                qty: ing.qty || 0,
                unit: ing.unit || 'kg',
              }
            : {
                kitchen_id: kitchenId,
                recipe_id: id,
                position: i,
                kind: 'raw',
                name: ing.name || '',
                qty: ing.qty || 0,
                unit: ing.unit || 'kg',
                cost: ing.cost || 0,
                supplier: ing.supplier || 'Veg',
              }
        )
      );
    }
  }
}

async function syncComponents(kitchenId, components) {
  const realIds = components.map((c) => c.id).filter(isUuid);
  if (realIds.length === 0) {
    await supabase.from('components').delete().eq('kitchen_id', kitchenId);
  } else {
    await supabase
      .from('components')
      .delete()
      .eq('kitchen_id', kitchenId)
      .not('id', 'in', `(${realIds.join(',')})`);
  }
  for (const c of components) {
    let id = c.id;
    if (!isUuid(id)) {
      const { data, error } = await supabase
        .from('components')
        .insert({
          kitchen_id: kitchenId,
          name: c.name,
          batch_yield: c.batchYield,
          batch_unit: c.batchUnit,
          prep_time: c.prepTime,
          hold_life: c.holdLife,
          station: c.station,
        })
        .select('id')
        .single();
      if (error) {
        console.error(error);
        continue;
      }
      id = data.id;
      c.id = id;
    } else {
      await supabase
        .from('components')
        .update({
          name: c.name,
          batch_yield: c.batchYield,
          batch_unit: c.batchUnit,
          prep_time: c.prepTime,
          hold_life: c.holdLife,
          station: c.station,
        })
        .eq('id', id);
    }

    await supabase.from('component_ingredients').delete().eq('component_id', id);
    if (c.ingredients?.length) {
      await supabase.from('component_ingredients').insert(
        c.ingredients.map((ing, i) => ({
          kitchen_id: kitchenId,
          component_id: id,
          position: i,
          name: ing.name || '',
          qty: ing.qty || 0,
          unit: ing.unit || 'kg',
          cost: ing.cost || 0,
          supplier: ing.supplier || 'Veg',
        }))
      );
    }
  }
}

async function syncSales(kitchenId, sales) {
  await supabase.from('sales').delete().eq('kitchen_id', kitchenId);
  if (sales.length) {
    await supabase.from('sales').insert(
      sales.map((s) => ({
        kitchen_id: kitchenId,
        day: s.day,
        session: s.session,
        recipe_id: isUuid(s.recipeId) ? s.recipeId : null,
        sold: s.sold,
      }))
    );
  }
}

async function syncWaste(kitchenId, waste) {
  await supabase.from('waste').delete().eq('kitchen_id', kitchenId);
  if (waste.length) {
    await supabase.from('waste').insert(
      waste.map((w) => ({
        kitchen_id: kitchenId,
        day: w.day,
        ingredient: w.ingredient,
        qty: w.qty,
        unit: w.unit,
        cost: w.cost,
        reason: w.reason,
      }))
    );
  }
}

async function syncInvoices(kitchenId, invoices) {
  const realIds = invoices.map((i) => i.id).filter(isUuid);
  if (realIds.length === 0) {
    await supabase.from('invoices').delete().eq('kitchen_id', kitchenId);
  } else {
    await supabase
      .from('invoices')
      .delete()
      .eq('kitchen_id', kitchenId)
      .not('id', 'in', `(${realIds.join(',')})`);
  }
  for (const inv of invoices) {
    let id = inv.id;
    if (!isUuid(id)) {
      const { data, error } = await supabase
        .from('invoices')
        .insert({
          kitchen_id: kitchenId,
          supplier: inv.supplier,
          ref: inv.ref,
          inv_date: inv.date,
          total: inv.total,
          lines: inv.lines,
          status: inv.status,
          flag_note: inv.flagNote,
        })
        .select('id')
        .single();
      if (error) {
        console.error(error);
        continue;
      }
      id = data.id;
      inv.id = id;
    }
    if (inv.items?.length) {
      await supabase.from('invoice_lines').delete().eq('invoice_id', id);
      await supabase.from('invoice_lines').insert(
        inv.items.map((it, i) => ({
          kitchen_id: kitchenId,
          invoice_id: id,
          position: i,
          name: it.name,
          qty: it.qty || 0,
          unit: it.unit || '',
          price_per_unit: it.pricePerUnit || 0,
          line_total: it.lineTotal || 0,
          matched: it.matched,
          delta: it.delta || 0,
          flag: it.flag,
        }))
      );
    }
  }
}

async function syncScanHistory(kitchenId, history) {
  await supabase.from('scan_history').delete().eq('kitchen_id', kitchenId);
  if (history.length) {
    await supabase.from('scan_history').insert(
      history.map((h) => ({
        kitchen_id: kitchenId,
        scan_type: h.type,
        supplier: h.supplier,
        ref: h.ref,
        items: h.items,
      }))
    );
  }
}

async function syncSousMessages(kitchenId, messages) {
  // Append-only: only insert messages we haven't seen.
  const { data: existing } = await supabase
    .from('sous_messages')
    .select('created_at')
    .eq('kitchen_id', kitchenId);
  const seen = new Set((existing || []).map((m) => new Date(m.created_at).getTime()));
  const fresh = messages.filter((m) => !seen.has(m.ts));
  if (fresh.length === 0) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('sous_messages').insert(
    fresh.map((m) => ({
      kitchen_id: kitchenId,
      user_id: user.id,
      role: m.role,
      content: m.content,
    }))
  );
}

async function syncPos(kitchenId, connections, lastSync) {
  const rows = Object.entries(connections).map(([provider, connected]) => ({
    kitchen_id: kitchenId,
    provider,
    connected,
    last_sync: lastSync[provider] || null,
  }));
  if (rows.length) {
    await supabase
      .from('pos_connections')
      .upsert(rows, { onConflict: 'kitchen_id,provider' });
  }
}

// =============================================================================
// Helpers
// =============================================================================
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v) { const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i; return typeof v === 'string' && UUID_RE.test(v) && !v.includes('temp') && v.length === 36; }

function safeParseLocal(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function sortDays(planner) {
  const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return [...planner].sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day));
}
import React, { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "./components/AuthContext.jsx"; // Must point to AuthContext
import { useKitchenState } from "./hooks/useKitchenState.js";
import LoginScreen from "./components/AuthContext.jsx";
import Auth from "./components/AuthContext.jsx";
import { supabase } from "./lib/supabase.js";

const C = {
  paper: '#f7f1e3',
  paper2: '#efe6d3',
  ink: '#0e0e0c',
  inkSoft: '#3a3530',
  inkFade: '#5a4f40',
  inkRule: '#1a1a18',
  highlight: '#f5e9c8',
  accent: '#b8730a',
  accent2: '#a06408',
  red: '#b8362a',
  green: '#4a6b3a',
  blue: '#2c5a82',
};

// ============================================================
// FORECAST CONFIDENCE & DATA MATURITY ENGINE (GLOBAL UTILITY)
// ============================================================
export function calculateForecastConfidence(salesArray = []) {
  const count = Array.isArray(salesArray) ? salesArray.length : 0;
  
  // Baseline Algorithm: Capped percentage scaling up to 50 sales entries
  const confidence = Math.min(100, Math.round((count / 50) * 100));
  
  // Operational Modes driven by data maturity thresholds
  let mode = "BOOTSTRAP (MANUAL SEED)";
  let color = "#b8362a"; // Red (scarce data)
  
  if (confidence >= 70) {
    mode = "AUTONOMOUS (PREDICTIVE)";
    color = "#4a6b3a"; // Green (highly mature data)
  } else if (confidence >= 35) {
    mode = "HYBRID (ESTIMATED)";
    color = "#b8730a"; // Amber (moderate data)
  }

  return { confidence, count, mode, color };
}

// ============================================================
// RECIPE NORMALIZATION HELPERS
// The scanner saves one DB row per ingredient (each row carries
// recipe_name, category, yield, sell_price + a single ingredient_item
// string). Downstream screens (Prep, Orders, Financials) need a
// grouped structure with parsed ingredients. These helpers do that.
// ============================================================

// Parse an ingredient line like "milk - 100 ml" / "eggs - 3" / "salt - a pinch"
// into a structured object. Returns { name, amount, unit, raw }.
function parseIngredientLine(raw) {
  if (!raw) return { name: '', amount: 0, unit: '', raw: '' };
  const text = String(raw).trim();
  // Split on the first dash (en-dash, em-dash, or hyphen) flanked by whitespace
  const parts = text.split(/\s+[-–—]\s+/);
  if (parts.length < 2) {
    return { name: text, amount: 0, unit: '', raw: text };
  }
  const name = parts[0].trim();
  const rest = parts.slice(1).join(' ').trim();

  // Try to extract a leading number ("100 ml", "3", "0.5 L")
  const m = rest.match(/^([0-9]*\.?[0-9]+)\s*(.*)$/);
  if (m) {
    return {
      name,
      amount: parseFloat(m[1]) || 0,
      unit: (m[2] || '').trim() || 'ea',
      raw: text
    };
  }
  // Non-numeric (e.g. "a pinch", "to taste")
  return { name, amount: 0, unit: rest, raw: text };
}

// Pull a numeric yield from text like "9 portions" / "2 servings" / "24"
function parseYield(yieldText) {
  if (!yieldText) return 1;
  const m = String(yieldText).match(/(\d+(?:\.\d+)?)/);
  return m ? Math.max(1, parseFloat(m[1])) : 1;
}

// Sell price helpers. A recipe with no price is stored as NULL ("Not set"),
// never as 0, so the kitchen can see which dishes still need pricing.
function parsePriceOrNull(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === '') return null;
  const n = parseFloat(text);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function formatEditedBy(email, isoDate) {
  if (!email && !isoDate) return '';
  const who = email || 'a kitchen member';
  let when = '';
  if (isoDate) {
    try { when = ' · ' + new Date(isoDate).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch {}
  }
  return `Last edited by ${who}${when}`;
}

// ============================================================
// FORECAST + UNIT HELPERS (Prep Sheets, Orders & Lists)
// ============================================================
// Units are converted to a base per family before anything is added up,
// so "1 L" + "500 g" is never summed as one number.
const UNIT_TABLE = {
  mg: ['mass', 0.001], g: ['mass', 1], gr: ['mass', 1], gram: ['mass', 1], grams: ['mass', 1],
  kg: ['mass', 1000], kgs: ['mass', 1000], kilo: ['mass', 1000], kilos: ['mass', 1000],
  oz: ['mass', 28.35], lb: ['mass', 453.6], lbs: ['mass', 453.6],
  ml: ['vol', 1], cl: ['vol', 10], dl: ['vol', 100], l: ['vol', 1000], ltr: ['vol', 1000],
  litre: ['vol', 1000], litres: ['vol', 1000], liter: ['vol', 1000], liters: ['vol', 1000],
  tsp: ['vol', 5], teaspoon: ['vol', 5], teaspoons: ['vol', 5],
  tbsp: ['vol', 15], tbs: ['vol', 15], tbl: ['vol', 15], tablespoon: ['vol', 15], tablespoons: ['vol', 15],
  cup: ['vol', 240], cups: ['vol', 240], 'fl oz': ['vol', 29.57], floz: ['vol', 29.57],
  ea: ['count', 1], each: ['count', 1], pc: ['count', 1], pcs: ['count', 1], piece: ['count', 1], pieces: ['count', 1], x: ['count', 1], '': ['count', 1],
};

// -> { family, base, label }  family: 'mass' | 'vol' | 'count' | 'count:<word>' | 'none'
function normalizeQty(amount, unit) {
  const u = String(unit || '').trim().toLowerCase().replace(/\.$/, '');
  const amt = Number(amount) || 0;
  if (amt <= 0) return { family: 'none', base: 0, label: String(unit || '').trim() || 'as needed' };
  const hit = UNIT_TABLE[u];
  if (hit) return { family: hit[0], base: amt * hit[1], label: hit[0] === 'count' ? 'ea' : null };
  // Non-standard count words: "loaves", "pizzas", "cloves"…
  return { family: `count:${u}`, base: amt, label: u };
}

const trimNum = (n, dp) => {
  const s = Number(n).toFixed(dp);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
};
function formatQty(base, family, label) {
  if (family === 'none') return label || 'as needed';
  if (family === 'mass') return base >= 1000 ? `${trimNum(base / 1000, 2)} kg` : `${trimNum(base, 0)} g`;
  if (family === 'vol') return base >= 1000 ? `${trimNum(base / 1000, 2)} L` : `${trimNum(base, 0)} ml`;
  return `${trimNum(base, 1)} ${label || 'ea'}`;
}

const normName = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const singular = (s) => s.replace(/(ies)$/, 'y').replace(/(oes)$/, 'o').replace(/s$/, '');

// Course from the recipe category. Used for the estimated dish mix and prep stage.
function courseOf(category) {
  const c = String(category || '').toLowerCase();
  if (/dessert|pudding|sweet|bakery|cake|pastr|biscuit|cookie/.test(c)) return 'dessert';
  if (/starter|appet|antipast|small plate|side|snack|soup/.test(c)) return 'starter';
  if (/drink|beverage|coffee|juice/.test(c)) return 'drink';
  return 'main';
}
// Estimated share of covers that order something from each course.
const COURSE_ATTACH = { main: 1.0, starter: 0.4, dessert: 0.3, drink: 0.5 };
const MIN_SALES_FOR_MIX = 10; // portions sold in a course before we trust its sales mix

// Forecast portions per dish for the planned covers.
// 1. Covers are split by course: every cover ≈ 1 main, 40% add a starter, 30% a dessert.
// 2. Within a course, dishes share those portions by their SALES MIX (portions sold so far),
//    smoothed so a new dish still gets a small share. With no sales yet they split evenly.
function buildDishForecast(recipes = [], recipeRows = [], sales = [], planner = []) {
  const covers = (planner || []).reduce((s, d) => s + (parseInt(d.lunch) || 0) + (parseInt(d.dinner) || 0), 0);
  const idToName = new Map();
  (recipeRows || []).forEach(r => { if (r?.id) idToName.set(r.id, (r.recipe_name || r.name || '').trim()); });
  (recipes || []).forEach(r => { if (r?.id) idToName.set(r.id, r.name); });

  const sold = {};
  (sales || []).forEach(s => {
    const name = idToName.get(s.recipeId) || (s.recipeName || s.name || '').trim();
    const qty = Number(s.sold) || 0;
    if (name && qty > 0) sold[name] = (sold[name] || 0) + qty;
  });

  const byCourse = {};
  (recipes || []).forEach(r => { (byCourse[courseOf(r.category)] ||= []).push(r); });

  const byName = {};
  const sources = new Set();
  Object.entries(byCourse).forEach(([course, list]) => {
    const coursePortions = covers * (COURSE_ATTACH[course] ?? 1);
    const soldTotal = list.reduce((s, r) => s + (sold[r.name] || 0), 0);
    const useSales = soldTotal >= MIN_SALES_FOR_MIX;
    sources.add(useSales ? 'sales' : 'estimate');
    list.forEach(r => {
      const share = useSales ? ((sold[r.name] || 0) + 1) / (soldTotal + list.length) : 1 / list.length;
      byName[r.name] = { portions: coursePortions * share, share, course, source: useSales ? 'sales' : 'estimate', sold: sold[r.name] || 0 };
    });
  });
  const mode = sources.size === 0 ? 'none' : sources.size > 1 ? 'mixed' : [...sources][0];
  return { covers, byName, mode };
}

function forecastNote(f) {
  if (!f || f.mode === 'none') return '';
  if (f.mode === 'sales') return 'Dish mix from your logged sales (each dish’s share of portions sold).';
  if (f.mode === 'mixed') return 'Dish mix from logged sales where there are enough; estimated for the rest (≈1 main per cover, 40% starters, 30% desserts).';
  return 'Estimated dish mix: ≈1 main per cover, 40% add a starter, 30% a dessert, split evenly within each course. Switches to your sales mix once sales are logged.';
}

// ============================================================
// RECIPE COSTING (shared)
// ============================================================
// --- MISE COMPLIANT RELATIONAL ENGINE ---
// Convert a quantity from one unit to another within the same family
// (mass: g/kg, volume: ml/l, count: ea). Returns null if not convertible.
const UNIT_FACTORS = {
  // mass (base: g)
  g: { family: 'mass', toBase: 1 },
  kg: { family: 'mass', toBase: 1000 },
  // volume (base: ml)
  ml: { family: 'volume', toBase: 1 },
  l: { family: 'volume', toBase: 1000 },
  tsp: { family: 'volume', toBase: 5 },
  tbs: { family: 'volume', toBase: 15 },
  tbsp: { family: 'volume', toBase: 15 },
  cup: { family: 'volume', toBase: 240 },
  pinch: { family: 'volume', toBase: 0.5 }, // approximate culinary pinch
  // count (base: each)
  ea: { family: 'count', toBase: 1 },
  each: { family: 'count', toBase: 1 },
  pcs: { family: 'count', toBase: 1 },
  unit: { family: 'count', toBase: 1 },
};

// Approximate kitchen densities (g/ml) for converting volume measurements
// to weight when the invoice prices an ingredient by mass. Pulled from
// standard culinary references; close enough for costing.
const KITCHEN_DENSITIES = {
  'cocoa': 0.55, 'cocoa powder': 0.55,
  'flour': 0.55, 'plain flour': 0.55, 'bread flour': 0.55,
  'sugar': 0.85, 'caster sugar': 0.85, 'granulated sugar': 0.85,
  'icing sugar': 0.56, 'brown sugar': 0.93,
  'baking soda': 0.92, 'bicarbonate of soda': 0.92,
  'baking powder': 0.95,
  'salt': 1.20, 'sea salt': 1.20, 'table salt': 1.30,
  'pepper': 0.50, 'black pepper': 0.50,
  'butter': 0.91, 'lard': 0.92,
  'milk': 1.03, 'cream': 0.99, 'double cream': 0.99,
  'water': 1.00,
  'oil': 0.92, 'olive oil': 0.92, 'vegetable oil': 0.92, 'sunflower oil': 0.92,
  'honey': 1.40, 'syrup': 1.32, 'golden syrup': 1.42,
  'yeast': 0.50,
  'rice': 0.75, 'oats': 0.40,
};

const parseQtyUnit = (text) => {
  const t = (text || "").toLowerCase();
  // "a pinch of salt" with no number → treat as 1 pinch
  if (/\bpinch\b/.test(t)) {
    const m = t.match(/([0-9]+(?:\.[0-9]+)?)/);
    return { qty: m ? parseFloat(m[1]) : 1, unit: 'pinch' };
  }
  const numMatch = t.match(/([0-9]+(?:\.[0-9]+)?)/);
  const qty = numMatch ? parseFloat(numMatch[1]) : null;
  const unitMatch = t.match(/\b(kg|g|ml|l|tsp|tbsp|tbs|cup|cups|ea|each|pcs|unit)\b/);
  let unit = unitMatch ? unitMatch[1] : null;
  if (unit === 'cups') unit = 'cup';
  return { qty, unit };
};

// Look up a density for an ingredient, allowing fuzzy substring matches.
const lookupDensity = (name) => {
  const key = (name || '').toLowerCase().trim();
  if (!key) return null;
  if (KITCHEN_DENSITIES[key] != null) return KITCHEN_DENSITIES[key];
  for (const dKey of Object.keys(KITCHEN_DENSITIES)) {
    if (key.includes(dKey) || dKey.includes(key)) return KITCHEN_DENSITIES[dKey];
  }
  return null;
};

const convertQty = (qty, fromUnit, toUnit, ingredientName) => {
  const f = UNIT_FACTORS[fromUnit];
  const t = UNIT_FACTORS[toUnit];
  if (!f || !t) return null;
  // Same family — straightforward
  if (f.family === t.family) return (qty * f.toBase) / t.toBase;
  // Cross-family (volume <-> mass) requires a density lookup
  if ((f.family === 'volume' && t.family === 'mass') ||
      (f.family === 'mass'   && t.family === 'volume')) {
    const density = lookupDensity(ingredientName); // g/ml
    if (density == null) return null;
    if (f.family === 'volume' && t.family === 'mass') {
      const ml = qty * f.toBase;
      const grams = ml * density;
      return grams / t.toBase;
    } else {
      const grams = qty * f.toBase;
      const ml = grams / density;
      return ml / t.toBase;
    }
  }
  return null; // count <-> mass/volume isn't safe to auto-convert
};

// Cost one recipe (its flat ingredient rows) against the kitchen's invoice lines.
// Same matching + unit conversion as the Recipes & Costs screen.
function costRecipeRows(rows = [], invoiceLines = []) {
let total = 0;
(rows || []).forEach((row) => {
  const ingredientText = (row.ingredient_item || "").toLowerCase().trim();
  if (!ingredientText) return;
  const scored = (invoiceLines || []).filter((line) => {
    const lineName = (line.name || "").toLowerCase().trim();
    return lineName && (ingredientText.includes(lineName) || lineName.includes(ingredientText));
  }).map((line) => {
    const q = parseFloat(line.qty || 1) || 1;
    const pr = parseFloat(line.price_per_unit || 0) || 0;
    const t = parseFloat(line.line_total || 0) || 0;
    return { line, eff: pr > 0 ? pr : (t > 0 && q > 0 ? t / q : 0) };
  }).sort((x, y) => y.eff - x.eff);
  const best = scored[0];
  if (!best || best.eff === 0) return;
  const invUnit = (best.line.unit || "").toLowerCase().trim();
  const rq = parseQtyUnit(row.ingredient_item);
  const invFamily = UNIT_FACTORS[invUnit] ? UNIT_FACTORS[invUnit].family : null;
  if (rq.qty != null && rq.unit && UNIT_FACTORS[rq.unit] && invFamily) {
    const converted = convertQty(rq.qty, rq.unit, invUnit, best.line.name || row.ingredient_item);
    if (converted != null) total += converted * best.eff;
  } else if (invFamily === 'count') {
    total += (rq.qty != null ? rq.qty : 1) * best.eff;
  }
});
const yieldText = rows[0]?.yield || "1 Portion";
const m = String(yieldText).match(/([0-9]+(?:\.[0-9]+)?)/);
const portions = m && parseFloat(m[1]) > 0 ? parseFloat(m[1]) : 1;
return { totalCost: total, costPerPortion: total / portions };
}

// Forecast confidence badge (calculateForecastConfidence): mode moves
// BOOTSTRAP -> HYBRID -> AUTONOMOUS as sales records build up.
function ForecastBadge({ metrics }) {
  if (!metrics) return null;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
      <span style={{ background: metrics.color, color: '#fff', padding: '3px 8px', borderRadius: 3, fontWeight: 700 }}>{metrics.mode}</span>
      <span style={{ color: '#3a3530' }}>Forecast confidence <strong>{metrics.confidence}%</strong> · {metrics.count} sales record{metrics.count === 1 ? '' : 's'}</span>
    </div>
  );
}

// Group flat ingredient-row scanner output into one logical recipe per
// unique recipe_name, with a structured ingredients array attached.
function groupRecipesByName(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const byName = new Map();
  rows.forEach(row => {
    const name = (row.recipe_name || row.name || '').trim() || 'Untitled';
    if (!byName.has(name)) {
      const sellPrice = parsePriceOrNull(row.sell_price ?? row.sellPrice);
      byName.set(name, {
        id: row.recipe_id || row.id, // first row's id as the recipe handle
        recipe_id: row.recipe_id || row.id,
        name,
        recipe_name: name,
        category: row.category || 'Uncategorized',
        yield: row.yield || '1 portion',
        yieldAmount: parseYield(row.yield),
        sell_price: sellPrice,
        sellPrice,
        ingredients: []
      });
    }
    const recipe = byName.get(name);
    if (row.ingredient_item) {
      recipe.ingredients.push(parseIngredientLine(row.ingredient_item));
    }
  });
  return Array.from(byName.values());
}

// ============================================================
// CORE AUTH GATEWAY & STATE INITIALIZATION
// ============================================================
export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState(() => {
    if (typeof window === 'undefined') return 'dashboard';
    try {
      const saved = window.localStorage.getItem('mise:lastTab');
      return saved || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  // Keep the last-active tab so a refresh returns to the same screen
  useEffect(() => {
    try { window.localStorage.setItem('mise:lastTab', tab); } catch {}
  }, [tab]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Password-recovery detection — Supabase's reset link establishes a session
  // immediately, so without this we'd skip past the Auth screen and the user
  // would never get to set a new password. We catch it two ways:
  // 1. URL hash (#access_token=...&type=recovery) on initial load
  // 2. The PASSWORD_RECOVERY event on the auth listener
  const [passwordRecovery, setPasswordRecovery] = useState(() => {
    if (typeof window === 'undefined' || !window.location.hash) return false;
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return params.get('type') === 'recovery';
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Pass user profile details downstream to initialize state

  // Resolve the user's active kitchen from the kitchen_members table.
  // Falls back to user.id for users who haven't been migrated yet
  // (e.g. if the SQL migration hasn't been run yet) so the app still works.
  const [activeKitchenId, setActiveKitchenId] = useState(null);
  // Is the signed-in user the owner of the active kitchen? (kitchens.owner_id)
  // Older kitchens use the owner's user id as the kitchen id, so that counts too.
  const [isKitchenOwner, setIsKitchenOwner] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const uid = session?.user?.id;
    if (!uid || !activeKitchenId) { setIsKitchenOwner(true); return; }
    if (activeKitchenId === uid) { setIsKitchenOwner(true); return; }
    (async () => {
      try {
        const { data, error } = await supabase.from('kitchens').select('owner_id').eq('id', activeKitchenId).maybeSingle();
        if (cancelled) return;
        // If ownership can't be read, don't lock the user out of their settings.
        setIsKitchenOwner(error || !data || !data.owner_id ? true : data.owner_id === uid);
      } catch { if (!cancelled) setIsKitchenOwner(true); }
    })();
    return () => { cancelled = true; };
  }, [activeKitchenId, session?.user?.id]);
  useEffect(() => {
    let cancelled = false;
    const loadMembership = async () => {
      if (!session?.user?.id) { setActiveKitchenId(null); return; }
      try {
        const { data, error } = await supabase
          .from('kitchen_members')
          .select('kitchen_id')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error || !data) {
          // Table missing or no row yet — fall back to user.id
          setActiveKitchenId(session.user.id);
        } else {
          setActiveKitchenId(data.kitchen_id);
        }
      } catch {
        if (!cancelled) setActiveKitchenId(session?.user?.id || null);
      }
    };
    loadMembership();
    const onDbUpdate = () => loadMembership();
    window.addEventListener('mise-kitchen-change', onDbUpdate);
    return () => { cancelled = true; window.removeEventListener('mise-kitchen-change', onDbUpdate); };
  }, [session?.user?.id]);

  // Shared kitchen state (settings incl. currency, planner, sales, waste...) is
  // loaded by KITCHEN, so a member who joins sees the owner's currency/units.
  const [state, update, loaded] = useKitchenState(activeKitchenId);

  // Live calculation of kitchen forecast confidence based on database metrics
  const forecastMetrics = React.useMemo(() => {
    return calculateForecastConfidence(state?.sales || []);
  }, [state?.sales]);

  // ─────────────────────────────────────────────────────────────
  // Supabase-backed planner. Declared HERE — above every early
  // return in this component — so React's Rules of Hooks are
  // honoured (hook count must be identical on every render, even
  // before the user signs in).
  // Falls back to the localStorage planner if the planner_days
  // table hasn't been migrated yet, so the app still works.
  // ─────────────────────────────────────────────────────────────
  const DEFAULT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const [dbPlanner, setDbPlanner] = useState(null); // null = not yet loaded
  const [plannerTableReady, setPlannerTableReady] = useState(true);

  // DB-direct recipes — useKitchenState's prop arrives "in a reduced shape
  // that drops ingredient_item" (per the RecipesScreen comment), so any
  // downstream tab that needs full ingredient data (Prep Sheets, Orders &
  // Lists, Financial Matrix) has to read the recipes table itself.
  const [dbRecipes, setDbRecipes] = useState([]);
  // Invoice lines for kitchen-wide costing (Financials, The Pass, Service Report)
  const [kitchenInvoiceLines, setKitchenInvoiceLines] = useState([]);
  useEffect(() => {
    if (!activeKitchenId) return;
    let cancelled = false;
    const loadLines = async () => {
      try {
        const { data, error } = await supabase.from('invoice_lines').select('*').eq('kitchen_id', activeKitchenId);
        if (!cancelled && !error && Array.isArray(data)) setKitchenInvoiceLines(data);
      } catch (err) { console.error("Invoice lines load failed:", err); }
    };
    loadLines();
    window.addEventListener('mise-db-update', loadLines);
    return () => { cancelled = true; window.removeEventListener('mise-db-update', loadLines); };
  }, [activeKitchenId]);
  useEffect(() => {
    if (!activeKitchenId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('recipes')
          .select('*')
          .eq('kitchen_id', activeKitchenId);
        if (cancelled) return;
        if (!error && Array.isArray(data)) setDbRecipes(data);
      } catch (err) {
        console.error("Recipes load failed:", err);
      }
    };
    load();
    const onDbUpdate = () => load();
    window.addEventListener('mise-db-update', onDbUpdate);
    return () => { cancelled = true; window.removeEventListener('mise-db-update', onDbUpdate); };
  }, [activeKitchenId]);

  // ────────────────────────────────────────────────────────────────
  // Sub-recipe (component) library fetcher. Loads parent components
  // joined with their nested ingredient rows in one round-trip and
  // hydrates each component object with an `ingredients` array so
  // downstream code (Recipes & Costs, PrepScreen, ShoppingScreen) can
  // compute component cost-per-unit and roll it up into dish cost.
  // ────────────────────────────────────────────────────────────────
  const [dbComponents, setDbComponents] = useState([]);
  const [componentsTableReady, setComponentsTableReady] = useState(true);
  const [componentsLoadError, setComponentsLoadError] = useState('');
  const [componentsRetryToken, setComponentsRetryToken] = useState(0);
  useEffect(() => {
    if (!activeKitchenId) return;
    let cancelled = false;
    const load = async () => {
      try {
        // ────────────────────────────────────────────────────────────
        // Two-query approach: fetch parent components, then their
        // ingredient rows in a separate call. This avoids depending on
        // PostgREST having cached the foreign-key relationship between
        // the two tables (which can take time after a fresh migration).
        // We merge them in JS — cheap, runs in ms.
        // ────────────────────────────────────────────────────────────
        const { data: parents, error: pErr } = await supabase
          .from('components')
          .select('*')
          .eq('kitchen_id', activeKitchenId);
        if (cancelled) return;
        if (pErr) {
          const code = pErr.code || '';
          const msg  = pErr.message || '';
          const schemaMissing =
            code === 'PGRST205' ||
            code === '42P01' ||
            /relation .* does not exist/i.test(msg) ||
            /could not find the table/i.test(msg);
          setComponentsLoadError(schemaMissing ? '' : (msg || 'Could not load components.'));
          if (schemaMissing) setComponentsTableReady(false);
          console.warn("Components parent load:", msg || pErr);
          return;
        }

        const parentIds = (parents || []).map(p => p.id);
        let ingredients = [];
        if (parentIds.length > 0) {
          const { data: ingrs, error: iErr } = await supabase
            .from('component_ingredients')
            .select('*')
            .in('component_id', parentIds);
          if (cancelled) return;
          if (iErr) {
            // Don't fail the whole load if just ingredients fetch errored.
            // Surface as a banner; parents still render.
            setComponentsLoadError(iErr.message || 'Could not load component ingredients.');
            console.warn("Component ingredients load:", iErr.message || iErr);
          } else if (Array.isArray(ingrs)) {
            ingredients = ingrs;
          }
        }

        const normalized = (parents || []).map(c => ({
          id: c.id,
          name: c.name,
          station: c.station,
          batchYield: parseFloat(c.batch_yield) || 1,
          batchUnit: c.batch_unit || 'ea',
          holdLife: c.hold_life || 'Same Day',
          notes: c.notes || '',
          ingredients: ingredients
            .filter(i => i.component_id === c.id)
            .sort((a, b) => (a.position || 0) - (b.position || 0))
            .map(i => ({
              id: i.id,
              name: i.name,
              qty: parseFloat(i.qty) || 0,
              unit: i.unit || 'g',
              cost: parseFloat(i.cost) || 0,
              supplier: i.supplier || ''
            }))
        }));
        setDbComponents(normalized);
        setComponentsTableReady(true);
        // Clear stale errors only on a fully successful round-trip
        if (!ingredients || ingredients.length === 0 || parentIds.length === 0) {
          // empty result — no error to report
        }
        setComponentsLoadError('');
      } catch (err) {
        console.error("Components load failed:", err);
        setComponentsLoadError(err.message || String(err));
      }
    };
    load();
    const onDbUpdate = () => load();
    window.addEventListener('mise-db-update', onDbUpdate);
    return () => { cancelled = true; window.removeEventListener('mise-db-update', onDbUpdate); };
  }, [activeKitchenId, componentsRetryToken]);

  // Exposed to ComponentsScreen so users can manually re-attempt the load
  // if PostgREST's schema cache was stale at first hit.
  const retryComponentsLoad = () => setComponentsRetryToken(t => t + 1);


  useEffect(() => {
    if (!activeKitchenId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('planner_days')
          .select('*')
          .eq('kitchen_id', activeKitchenId)
          .order('day_order', { ascending: true });

        if (cancelled) return;

        if (error) {
          // Likely table doesn't exist yet — fall back to localStorage planner
          if (error.code === '42P01' || /relation .* does not exist/i.test(error.message || '')) {
            setPlannerTableReady(false);
          } else {
            console.error("Planner load error:", error);
          }
          return;
        }

        setPlannerTableReady(true);

        const byDay = new Map((data || []).map(r => [r.day, r]));
        const merged = DEFAULT_DAYS.map((day) => {
          const row = byDay.get(day);
          return {
            day,
            lunch: row ? Number(row.lunch) || 0 : 0,
            dinner: row ? Number(row.dinner) || 0 : 0
          };
        });
        setDbPlanner(merged);
      } catch (err) {
        console.error("Planner load failed:", err);
      }
    };

    load();
    const onDbUpdate = () => load();
    window.addEventListener('mise-db-update', onDbUpdate);
    return () => { cancelled = true; window.removeEventListener('mise-db-update', onDbUpdate); };
  }, [activeKitchenId]);

  const handlePlannerUpdate = async (newPlanner) => {
    setDbPlanner(newPlanner);

    if (!plannerTableReady) {
      update({ planner: newPlanner });
      return;
    }
    if (!activeKitchenId) return;

    try {
      const payload = newPlanner.map((d, idx) => ({
        kitchen_id: activeKitchenId,
        day: d.day,
        day_order: idx,
        lunch: parseInt(d.lunch) || 0,
        dinner: parseInt(d.dinner) || 0,
        updated_at: new Date().toISOString(),
        updated_by: session?.user?.id || null
      }));
      const { error } = await supabase
        .from('planner_days')
        .upsert(payload, { onConflict: 'kitchen_id,day' });
      if (error) throw error;
      window.dispatchEvent(new Event('mise-db-update'));
    } catch (err) {
      console.error("Planner save failed:", err);
      alert("Could not save planner: " + (err.message || err));
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (authLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: C.paper }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.inkFade, letterSpacing: '2px' }}>
          VERIFYING STATION CREDS...
        </div>
      </div>
    );
  }

  if (!session || passwordRecovery) {
    return (
      <Auth
        forceMode={passwordRecovery ? 'reset' : undefined}
        onResetDone={() => {
          setPasswordRecovery(false);
          if (typeof window !== 'undefined' && window.history.replaceState) {
            // Clear the recovery hash so a refresh doesn't drop us back here
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }}
      />
    );
  }

 if (!loaded) return <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',background:C.paper,color:C.ink,fontFamily:'sans-serif'}}>Synchronizing Kitchen Ledger...</div>;

  // Deconstruct state with safety defaults pointing to standard structural blocks
  const {
  recipes = [],
  components = [],
  planner: localPlanner = [],
  sales = [],
  waste = [],
  invoices = [],
  settings: customSettings
} = state || {};

// Safely evaluate settings property layer with fallback structural baselines
const settings = customSettings && Object.keys(customSettings).length > 0 
  ? customSettings 
  : { role: 'Head chef', currency: '£', unitSystem: 'metric', region: 'UK' };

// What downstream screens actually use:
const planner = plannerTableReady && dbPlanner ? dbPlanner : (Array.isArray(localPlanner) && localPlanner.length > 0 ? localPlanner : DEFAULT_DAYS.map(d => ({ day: d, lunch: 0, dinner: 0 })));

// Group flat ingredient-row recipes into one logical recipe each.
// Prefer DB rows (full ingredient_item shape) over the localStorage
// prop (which arrives in a reduced shape that drops ingredient_item).
const groupedRecipes = groupRecipesByName(dbRecipes.length > 0 ? dbRecipes : recipes);
// Portions per dish for the planned covers (dish mix from sales, else estimated).
const dishForecast = buildDishForecast(groupedRecipes, dbRecipes, sales, planner);

// Sales resolved to their dish (a sale may point at any ingredient row of that dish),
// with revenue and food cost per line, and waste with qty × cost per unit.
const rowIdToName = new Map();
(dbRecipes || []).forEach(r => { if (r?.id) rowIdToName.set(r.id, (r.name || '').trim()); });
(recipes || []).forEach(r => { if (r?.id && r.name && !rowIdToName.has(r.id)) rowIdToName.set(r.id, r.name.trim()); });
const costPerPortionByName = {};
groupedRecipes.forEach(g => {
  const rows = (dbRecipes || []).filter(r => (r.name || '').trim() === g.name && (r.ingredient_item || '').trim());
  costPerPortionByName[g.name] = costRecipeRows(rows, kitchenInvoiceLines).costPerPortion;
});
const canonicalSales = (sales || []).map(s => {
  const name = rowIdToName.get(s.recipeId) || s.recipeName || null;
  const g = name ? groupedRecipes.find(r => r.name === name) : null;
  const sold = Number(s.sold) || 0;
  if (!g) return { ...s, recipeName: name, matched: false, revenue: 0, foodCost: 0 };
  const price = Number(g.sellPrice) || 0;
  const cpp = costPerPortionByName[g.name] || 0;
  return { ...s, recipeId: g.id, recipeName: g.name, matched: true, sellPrice: price, costPerPortion: cpp, revenue: sold * price, foodCost: sold * cpp };
});
const wasteView = (waste || []).map(w => {
  const qty = Number(w.qty) || 0;
  const costPerUnit = Number(w.cost ?? w.costPrice) || 0;
  return { ...w, item: w.item || w.ingredient || w.itemName || '', qty, costPerUnit, lineTotal: qty * costPerUnit };
});
const kitchenTotals = {
  revenue: canonicalSales.reduce((t, s) => t + s.revenue, 0),
  foodCost: canonicalSales.reduce((t, s) => t + s.foodCost, 0),
  wasteCost: wasteView.reduce((t, w) => t + w.lineTotal, 0),
  matchedSales: canonicalSales.filter(s => s.matched).length,
  saleCount: canonicalSales.length,
};
// Clear field names for Ask Sous so it doesn't mistake cost-per-unit for a total
const sousSales = canonicalSales.map(s => ({ day: s.day, session: s.session, dish: s.recipeName || 'Unmatched', portionsSold: Number(s.sold) || 0, revenue: Number(s.revenue.toFixed(2)), foodCost: Number(s.foodCost.toFixed(2)) }));
const sousWaste = wasteView.map(w => ({ item: w.item, qty: w.qty, unit: w.unit, costPerUnit: w.costPerUnit, totalCost: Number(w.lineTotal.toFixed(2)), reason: w.reason, date: w.date || w.day }));

  const tabs = ['dashboard', 'servicereport', 'scan', 'archive', 'digitizer', 'recipes', 'components', 'planner', 'prep', 'sales', 'waste', 'intel', 'shopping', 'engineering', 'sous', 'settings'];

  // ============================================================
  // SPEC-ALIGNED INFORMATION ARCHITECTURE (6 CORE SECTIONS)
  // ============================================================
  // ============================================================
  // ARCHITECTURE NAVIGATION SIDEBAR RE-GROUPING (BASELINE SPEC)
  // ============================================================
  // ============================================================
  // ARCHITECTURE SIDEBAR GROUPING (IDS PERFECTLY ALIGNED WITH SCREENS)
  // ============================================================
  // ============================================================
  // ARCHITECTURE SIDEBAR GROUPING (IDS DESIGNATED PERFECTLY WITH INTERNAL ROUTER SWITCHES)
  // ============================================================
  const navigationGroups = [
    {
      title: "OVERVIEW",
      items: [
        { id: 'dashboard', label: 'The Pass', sub: 'Live shift reporting & KPIs' },
        { id: 'servicereport', label: 'Service Report', sub: 'Shift operational log sheets' }
      ]
    },
    {
      title: "CAPTURE LOGS",
      items: [
        { id: 'scan', label: 'Recipe Digitizer', sub: 'AI parsing & yield extraction' },
        { id: 'invoices', label: 'Invoice Scan', sub: 'Accounts supplier auditing' }
      ]
    },
    {
      title: "KITCHEN MANAGEMENT",
      items: [
        { id: 'recipes', label: 'Recipes & Costs', sub: 'Gross Profit engineering matrix' },
        { id: 'components', label: 'Sub-Recipe Library', sub: 'Reusable component blueprints' },
        { id: 'planner', label: 'Weekly Planner', sub: 'Production covers allocation' },
        { id: 'prep', label: 'Prep Sheets', sub: 'Batch multiplying targets' }
      ]
    },
    {
      title: "INTELLIGENCE & INTEL",
      items: [
        { id: 'shopping', label: 'Orders & Lists', sub: 'Market supplier buying schedules' },
        { id: 'sales', label: 'Sales Analytics', sub: 'Financial ledger ingestion logs' },
        { id: 'waste', label: 'Waste Tracker', sub: 'Structural volume shrink records' }
      ]
    },
    {
      title: "OPERATIONS CORE",
      items: [
        { id: 'performance', label: 'Financials Matrix', sub: 'Integrated restaurant profit & loss' },
        { id: 'sous', label: 'Sous AI Coach', sub: 'Core conversational prompt engine' },
        { id: 'suppliers', label: 'Market Intel', sub: 'Ingredient supplier benchmarking' },
        { id: 'pos', label: 'POS Sync Gateway', sub: 'Automated live machine extraction' },
        { id: 'team', label: 'Kitchen Team', sub: 'Shared access and members' },
        { id: 'settings', label: 'Station Settings', sub: 'System region configurations' }
      ]
    }
  ];
// Fix mobile layout spilling bounds by calculating responsive display configuration states dynamically
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
  const S = {
    layout: { display: 'flex', flexDirection: isMobileView ? 'column' : 'row', height: '100vh', background: C.paper },
    sidebar: { width: 240, background: '#121210', borderRight: `1px solid ${C.inkRule}`, display: isMobileView ? 'none' : 'flex', flexDirection: 'column', padding: 20 },
    mobileBar: { display: isMobileView ? 'flex' : 'none', justifyContent: 'space-between', alignItems: 'center', background: '#121210', color: '#fff', padding: '14px 20px', borderBottom: `1px solid ${C.inkRule}` },
    main: { flex: 1, padding: isMobileView ? 20 : 40, overflowY: 'auto' },
    drawerOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'flex-start' },
    drawer: { width: 280, background: '#121210', height: '100%', padding: 20, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' },
    drawerLink: { background: 'none', border: 'none', color: '#a0a098', padding: '12px 14px', textAlign: 'left', fontSize: 14, fontWeight: 600, borderRadius: 4, cursor: 'pointer', width: '100%' },
    drawerLinkActive: { background: '#1a1a18', color: C.paper },
    menuBtn: { background: C.accent, border: 'none', color: '#fff', padding: '6px 12px', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
    closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer' },
    logoArea: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 30, padding: '0 4px' },
    logoIcon: { fontSize: 24, color: C.accent },
    logoText: { fontFamily: "'Bitter', serif", fontWeight: 900, fontSize: 18, color: '#fff', letterSpacing: '0.5px' },
    logoSub: { fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: C.inkFade, letterSpacing: '1px', textTransform: 'uppercase', marginTop: 2 },
    nav: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
    navLink: { background: 'none', border: 'none', color: '#a0a098', padding: '10px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600, borderRadius: 4, cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', transition: 'all 0.15s' },
    navLinkActive: { background: '#1a1a18', color: '#fff' },
    sidebarFooter: { borderTop: `1px solid #1a1a18`, paddingTop: 16, marginTop: 'auto' },
    signOutBtn: { background: 'none', border: 'none', color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '4px 12px', borderRadius: 4, width: '100%', textAlign: 'left' }
  };
  return (
   <div style={S.layout}>
      
      {/* ============================================================ */}
      {/* 1. DESKTOP SIDEBAR: RETAINS YOUR EXACT GROUPED STYLING       */}
      {/* ============================================================ */}
      <aside 
        style={{
          ...S.sidebar,
          // CSS Fallback: Automatically completely hides the sidebar if screen width drops to mobile sizing
          display: window.innerWidth >= 768 ? 'flex' : 'none',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ padding: '20px 0', overflowY: 'auto', flex: 1 }}>
          {/* Header Branding */}
          <div style={{ padding: '0 20px 20px 20px', borderBottom: `1px solid ${C.inkRule}`, marginBottom: 16 }}>
            <div style={{ fontSize: 20, fontWeight: '800', fontFamily: "'serif', Georgia", letterSpacing: '1px', color: '#fff' }}>MISE</div>
            <div style={{ fontSize: 9, color: C.accent, letterSpacing: '0.5px', marginTop: 2, fontWeight: 700 }}>REST-OPS PLATFORM v6.4</div>
          </div>

          {/* Core Navigation Iteration - Clean Style with Grouping and Sub-labels */}
          {navigationGroups.map((group) => (
            <div key={group.title} style={{ marginBottom: 12 }}>
              <div style={{ padding: '4px 20px', fontSize: 10, fontWeight: 800, color: C.accent, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                {group.title}
              </div>
              {group.items.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    style={{
                      width: '100%', 
                      textAlign: 'left', 
                      background: active ? '#1a1a18' : 'transparent',
                      border: 'none', 
                      borderLeft: active ? `4px solid ${C.accent}` : '4px solid transparent',
                      padding: '8px 20px', // Uniform comfortable button padding
                      cursor: 'pointer', 
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: 1, 
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Core Menu Label - Cleanly Left Aligned */}
                    <span style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? '#fff' : '#efe6d3' }}>
                      {item.label}
                    </span>
                    {/* Context Sub-label */}
                    <span style={{ fontSize: 10, color: active ? C.accent : C.inkFade }}>
                      {item.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer Area */}
        <div style={{ padding: 16, borderTop: `1px solid ${C.inkRule}`, background: '#0a0a09' }}>
          <div style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>Active Station</div>
          <div style={{ fontSize: 10, color: C.inkFade, marginTop: 2, fontFamily: 'monospace', marginBottom: 12 }}>
            ID: {session?.user?.id?.slice(0, 12)}...
          </div>
          <button 
            onClick={() => supabase.auth.signOut()} 
            style={{ ...S.signOutBtn, width: '100%', textAlign: 'center' }}
          >
            Leave Station
          </button>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* 2. MOBILE TOP BAR                                            */}
      {/* ============================================================ */}
      <div 
        style={{
          ...S.mobileBar,
          display: window.innerWidth < 768 ? 'flex' : 'none'
        }}
      >
        <div style={{ fontFamily: "'Bitter', serif", fontWeight: 900, fontSize: 18 }}>MISE</div>
        <button onClick={() => setDrawerOpen(true)} style={S.menuBtn}>Menu</button>
      </div>

      {/* ============================================================ */}
      {/* 3. MOBILE DRAWER SHEET                                       */}
      {/* ============================================================ */}
      {drawerOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: 280,
          background: '#0e0e0c', borderRight: `1px solid ${C.inkRule}`,
          zIndex: 1000, display: 'flex', flexDirection: 'column', padding: '16px 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 16px 16px', borderBottom: `1px solid ${C.inkRule}` }}>
            <span style={{ fontWeight: '700', letterSpacing: '1px', color: '#fff', fontSize: 13 }}>MISE CONTROLS</span>
            <button onClick={() => setDrawerOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
            {navigationGroups.map((group) => (
              <div key={group.title} style={{ marginBottom: 14 }}>
                <div style={{ padding: '4px 16px', fontSize: 10, fontWeight: 800, color: C.accent, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  {group.title}
                </div>
                {group.items.map((item) => {
                  const active = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setTab(item.id); setDrawerOpen(false); }}
                      style={{
                        width: '100%', textAlign: 'left', background: active ? '#1a1a18' : 'transparent',
                        border: 'none', borderLeft: active ? `4px solid ${C.accent}` : '4px solid transparent',
                        padding: '6px 16px', display: 'flex', flexDirection: 'column', gap: 1, cursor: 'pointer'
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? '#fff' : '#efe6d3' }}>{item.label}</span>
                      <span style={{ fontSize: 10, color: active ? C.accent : C.inkFade }}>{item.sub}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {/* Footer: log out from phone */}
          <div style={{ borderTop: `1px solid ${C.inkRule}`, padding: 12 }}>
            <button
              onClick={async () => { setDrawerOpen(false); await supabase.auth.signOut(); }}
              style={{ ...S.signOutBtn, width: '100%', textAlign: 'center', color: C.red, background: 'transparent', border: `1px solid ${C.red}`, borderRadius: 4, padding: '10px', fontWeight: 700, fontSize: 13 }}
            >
              Leave Station
            </button>
          </div>
        </div>
      )}

      {/* Render Active Functional Screens */}
      {/* Render Active Functional Screens */}
      <div style={S.main}>
        {tab === 'dashboard' && <Dashboard recipes={recipes} components={dbComponents} planner={planner} sales={canonicalSales} waste={wasteView} totals={kitchenTotals} forecastMetrics={forecastMetrics} settings={settings} setTab={setTab} updateState={update} />}
        {tab === 'servicereport' && <ServiceReport recipes={groupedRecipes || []} components={dbComponents || []} sales={canonicalSales} waste={wasteView} totals={kitchenTotals} planner={planner || []} settings={settings || {}} />}
        {tab === 'planner' && <PlannerScreen planner={planner} onUpdate={handlePlannerUpdate} />}
        {/* FIX: Wired invoices state array downstream so matching costs align instantly */}
{tab === 'recipes' && (
  <RecipesScreen 
    kitchenId={activeKitchenId || session?.user?.id || ""}
    recipes={recipes || []} 
    invoices={invoices || []} 
    components={dbComponents || []} 
    settings={settings || {}} 
    onUpdateRecipes={(val) => update({ recipes: val })} 
    onUpdateComponents={(val) => update({ components: val })} 
  />
)}
        {tab === 'components' && <ComponentsScreen kitchenId={activeKitchenId || session?.user?.id || ""} components={dbComponents || []} recipes={groupedRecipes || []} settings={settings || {}} tableReady={componentsTableReady} loadError={componentsLoadError} onRetry={retryComponentsLoad} />}
        {tab === 'prep' && <PrepScreen planner={planner} recipes={groupedRecipes} components={dbComponents} forecast={dishForecast} forecastMetrics={forecastMetrics} />}
        {tab === 'shopping' && <ShoppingScreen planner={planner} recipes={groupedRecipes} components={dbComponents} forecast={dishForecast} kitchenId={activeKitchenId || session?.user?.id || ""} />}
        {tab === 'sales' && <SalesScreen sales={sales} recipes={recipes} dishes={groupedRecipes} onUpdate={(val) => update({ sales: val })} settings={settings} />}
        {tab === 'waste' && <WasteScreen waste={wasteView} onUpdate={(val) => update({ waste: val })} settings={settings} />}
        {tab === 'performance' && <PerformanceScreen recipes={groupedRecipes} components={dbComponents} planner={planner} sales={canonicalSales} waste={wasteView} totals={kitchenTotals} settings={settings} />}
        {tab === 'sous' && <SousScreen settings={settings} recipes={recipes} components={dbComponents} sales={sousSales} waste={sousWaste} planner={planner} />}
        {tab === 'invoices' && <InvoicesScreen supabase={supabase} kitchenId={activeKitchenId || session?.user?.id || ""} invoices={invoices || []} onUpdate={(val) => update({ invoices: val })} recipes={recipes || []} onUpdateRecipes={(val) => update({ recipes: val })} settings={settings} />}
        {tab === 'suppliers' && <SuppliersScreen supabase={supabase} kitchenId={activeKitchenId || session?.user?.id} settings={settings} />}
        {tab === 'pos' && <PosScreen sales={sales} recipes={recipes} onUpdate={(val) => update({ sales: val })} />}
        {tab === 'settings' && <SettingsScreen settings={settings} onUpdate={(val) => update({ settings: val })} canEdit={isKitchenOwner} />}
        {tab === 'team' && <TeamScreen supabase={supabase} session={session} activeKitchenId={activeKitchenId} />}
        {/* THIS ENSURES IT CALLS RECIPEDIGITIZER WITH THE CORRECT SESSION CONTEXT */}
        {tab === 'scan' && (
          <RecipeDigitizer
            kitchenId={activeKitchenId || session?.user?.id || ""}
            recipes={recipes || []}
            onUpdateRecipes={(val) => update({ recipes: val })}
            settings={settings || {}}
          />
        )}
      </div>

      {/* Floating Ask-Sous button — visible on every page so the chef can
          fire a quick voice question without navigating away from prep work. */}
      <QuickSousFAB
        settings={settings || {}}
        recipes={recipes || []}
        components={dbComponents || []}
        sales={sousSales || []}
        waste={sousWaste || []}
        planner={planner || []}
      />
    </div>
  );
}

// ============================================================
// COMPREHENSIVE RE-ANCHOR: STATE SYNCHRONIZATION FOR DROPDOWNS
// ============================================================
// ============================================================
// TEAM SCREEN — Kitchen sharing v1
// Shows the user's kitchen code, lets them invite by sharing it,
// join another kitchen by pasting one, and lists current members.
// ============================================================
function TeamScreen({ supabase, session, activeKitchenId }) {
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const userId = session?.user?.id;
  const userEmail = session?.user?.email || '';
  const myOwnKitchen = activeKitchenId === userId;

  const loadMembers = async () => {
    if (!activeKitchenId) return;
    setLoadingMembers(true);
    try {
      const { data, error } = await supabase
        .from('kitchen_members')
        .select('user_id, joined_at, role')
        .eq('kitchen_id', activeKitchenId);
      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error("Couldn't load members:", err);
      setError(err.message || String(err));
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => { loadMembers(); }, [activeKitchenId]);

  const copyKitchenCode = async () => {
    try {
      await navigator.clipboard.writeText(activeKitchenId || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // older browsers: select & rely on user
    }
  };

  const handleJoin = async () => {
    setError(''); setInfo('');
    const target = (joinInput || '').trim().toLowerCase();
    if (!target) { setError("Paste a kitchen code to join."); return; }
    // Basic UUID shape check
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target)) {
      setError("That doesn't look like a kitchen code. Codes look like e.g. eb73e6cd-d496-4566-9277-48cf3eb8f94f.");
      return;
    }
    if (target === activeKitchenId) {
      setError("You're already in that kitchen.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from('kitchen_members')
        .upsert({ user_id: userId, kitchen_id: target, role: 'member' }, { onConflict: 'user_id' });
      if (error) throw error;
      setInfo("Joined! Refreshing your kitchen view…");
      setJoinInput('');
      // Tell App to re-resolve activeKitchenId; broadcast a refresh signal
      window.dispatchEvent(new Event('mise-kitchen-change'));
      window.dispatchEvent(new Event('mise-db-update'));
    } catch (err) {
      console.error("Join failed:", err);
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleReturnToMyKitchen = async () => {
    if (!userId) return;
    setError(''); setInfo('');
    setBusy(true);
    try {
      const { error } = await supabase
        .from('kitchen_members')
        .upsert({ user_id: userId, kitchen_id: userId, role: 'member' }, { onConflict: 'user_id' });
      if (error) throw error;
      setInfo("Switched back to your own kitchen.");
      window.dispatchEvent(new Event('mise-kitchen-change'));
      window.dispatchEvent(new Event('mise-db-update'));
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Bitter', serif", fontSize: 24, marginBottom: 4 }}>Kitchen Team</h2>
        <div style={{ fontSize: 13, color: C.inkFade }}>Share a kitchen so multiple people can edit the same recipes and invoices.</div>
        <div style={{ borderBottom: `1px solid ${C.inkRule}`, marginTop: 14 }}></div>
      </div>

      {error && (
        <div style={{ background: C.red, color: '#fff', padding: '10px 14px', borderRadius: 4, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}
      {info && (
        <div style={{ background: '#4a6b3a', color: '#fff', padding: '10px 14px', borderRadius: 4, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
          ✓ {info}
        </div>
      )}

      {/* CURRENT KITCHEN — share or leave */}
      <div style={{ background: '#fff', border: `1px solid ${C.paper2}`, borderRadius: 6, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
          Your Active Kitchen
        </div>
        <div style={{ fontSize: 14, color: C.inkFade, marginBottom: 12 }}>
          {myOwnKitchen
            ? "You're working in your own kitchen. Share the code below to let someone join."
            : "You're a guest in someone else's kitchen. Their data is yours to view and edit."}
        </div>

        <div style={{ background: C.paper, border: `1px solid ${C.paper2}`, borderRadius: 4, padding: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <code style={{ flex: 1, minWidth: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.ink, wordBreak: 'break-all' }}>
            {activeKitchenId || '—'}
          </code>
          <button
            onClick={copyKitchenCode}
            style={{ background: C.accent, color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            {copied ? '✓ Copied' : 'Copy Code'}
          </button>
        </div>

        {!myOwnKitchen && (
          <button
            onClick={handleReturnToMyKitchen}
            disabled={busy}
            style={{ background: 'transparent', color: C.ink, border: `1px solid ${C.paper2}`, padding: '8px 14px', borderRadius: 4, fontSize: 12, cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            ← Return to my own kitchen
          </button>
        )}
      </div>

      {/* JOIN ANOTHER KITCHEN */}
      <div style={{ background: '#fff', border: `1px solid ${C.paper2}`, borderRadius: 6, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
          Join a Different Kitchen
        </div>
        <div style={{ fontSize: 13, color: C.inkFade, marginBottom: 12 }}>
          Paste the kitchen code shared with you. You'll switch to that kitchen — your own data stays safe, you can always return.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="e.g. eb73e6cd-d496-4566-9277-48cf3eb8f94f"
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            style={{ flex: 1, minWidth: 240, padding: 10, fontSize: 13, border: `1px solid ${C.paper2}`, borderRadius: 4, fontFamily: "'JetBrains Mono', monospace" }}
          />
          <button
            onClick={handleJoin}
            disabled={busy}
            style={{ background: C.accent, color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            {busy ? 'Working…' : 'Join Kitchen'}
          </button>
        </div>
      </div>

      {/* MEMBERS */}
      <div style={{ background: '#fff', border: `1px solid ${C.paper2}`, borderRadius: 6, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
          Members of this Kitchen ({members.length})
        </div>
        {loadingMembers ? (
          <div style={{ color: C.inkFade, fontSize: 13 }}>Loading…</div>
        ) : members.length === 0 ? (
          <div style={{ color: C.inkFade, fontSize: 13 }}>No members yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {members.map((m) => {
              const isMe = m.user_id === userId;
              const isOwner = m.user_id === activeKitchenId;
              return (
                <div key={m.user_id} style={{ background: C.paper, border: `1px solid ${C.paper2}`, borderRadius: 4, padding: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
                      {isMe ? `You (${userEmail})` : m.user_id}
                    </div>
                    <div style={{ fontSize: 11, color: C.inkFade, marginTop: 2 }}>
                      Joined {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}
                      {isOwner && <span style={{ marginLeft: 8, padding: '1px 6px', background: C.accent, color: '#fff', borderRadius: 3, fontWeight: 700, fontSize: 10 }}>OWNER</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: C.inkFade, fontStyle: 'italic' }}>
        All members can view and edit everything in the kitchen. Edit attribution (who changed what) is captured on every save.
      </div>
    </div>
  );
}

// canEdit = this user owns the active kitchen. Joined members inherit the
// owner's settings (currency, units, timezone) and see them read-only.
function SettingsScreen({ settings, onUpdate, canEdit = true }) {
  // ─── Locale-driven currency auto-detection ───────────────────
  // When the user picks "Auto" in the region selector we resolve their
  // currency from the browser locale. Falls back to GBP if anything
  // goes wrong. This means Paul on a UK device gets £, on a Thai
  // device gets ฿, etc., with zero clicks.
  const autoDetectCurrency = () => {
    try {
      const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-GB';
      const locale = new Intl.Locale(lang).maximize();
      const region = locale.region || 'GB';

      // ISO-3166 region code → currency symbol (covers the most common
      // operational regions; everything else falls through to £)
      const map = {
        GB: '£', IE: '€', US: '$', CA: 'C$', AU: 'A$', NZ: 'NZ$',
        FR: '€', DE: '€', ES: '€', IT: '€', NL: '€', BE: '€', PT: '€', AT: '€', FI: '€', GR: '€',
        JP: '¥', CN: '¥', HK: 'HK$', TW: 'NT$', KR: '₩', SG: 'S$',
        TH: '฿', VN: '₫', MY: 'RM', ID: 'Rp', PH: '₱', IN: '₹',
        AE: 'د.إ', SA: 'ر.س', IL: '₪', TR: '₺', ZA: 'R',
        BR: 'R$', MX: '$', AR: '$', CL: '$', CO: '$',
        CH: 'CHF', NO: 'kr', SE: 'kr', DK: 'kr', PL: 'zł', CZ: 'Kč', HU: 'Ft', RU: '₽'
      };
      return { currency: map[region] || '£', regionLabel: region };
    } catch {
      return { currency: '£', regionLabel: 'GB' };
    }
  };

  // Exhaustive mapping of globally active operational regions and currencies
  const regions = [
    { code: 'AUTO', label: '🌍 Auto-detect from browser locale', currency: 'AUTO' },
    { code: 'AF', label: 'Afghanistan (AFN) – ؋', currency: '؋' },
    { code: 'AL', label: 'Albania (ALL) – L', currency: 'L' },
    { code: 'DZ', label: 'Algeria (DZD) – د.ج', currency: 'د.ج' },
    { code: 'AO', label: 'Angola (AOA) – Kz', currency: 'Kz' },
    { code: 'AR', label: 'Argentina (ARS) – $', currency: '$' },
    { code: 'AM', label: 'Armenia (AMD) – ֏', currency: '֏' },
    { code: 'AW', label: 'Aruba (AWG) – ƒ', currency: 'ƒ' },
    { code: 'AU', label: 'Australia (AUD) – A$', currency: 'A$' },
    { code: 'AZ', label: 'Azerbaijan (AZN) – ₼', currency: '₼' },
    { code: 'BS', label: 'Bahamas (BSD) – $', currency: '$' },
    { code: 'BH', label: 'Bahrain (BHD) – .د.ب', currency: '.د.ب' },
    { code: 'BD', label: 'Bangladesh (BDT) – ৳', currency: '৳' },
    { code: 'BB', label: 'Barbados (BBD) – $', currency: '$' },
    { code: 'BY', label: 'Belarus (BYN) – Br', currency: 'Br' },
    { code: 'BZ', label: 'Belize (BZD) – BZ$', currency: 'BZ$' },
    { code: 'BM', label: 'Bermuda (BMD) – $', currency: '$' },
    { code: 'BT', label: 'Bhutan (BTN) – Nu.', currency: 'Nu.' },
    { code: 'BO', label: 'Bolivia (BOB) – $b', currency: '$b' },
    { code: 'BA', label: 'Bosnia & Herzegovina (BAM) – KM', currency: 'KM' },
    { code: 'BW', label: 'Botswana (BWP) – P', currency: 'P' },
    { code: 'BR', label: 'Brazil (BRL) – R$', currency: 'R$' },
    { code: 'BN', label: 'Brunei (BND) – $', currency: '$' },
    { code: 'BG', label: 'Bulgaria (BGN) – лв', currency: 'лв' },
    { code: 'BI', label: 'Burundi (BIF) – FBu', currency: 'FBu' },
    { code: 'KH', label: 'Cambodia (KHR) – ៛', currency: '៛' },
    { code: 'CA', label: 'Canada (CAD) – C$', currency: 'C$' },
    { code: 'CV', label: 'Cape Verde (CVE) – $', currency: '$' },
    { code: 'KY', label: 'Cayman Islands (KYD) – $', currency: '$' },
    { code: 'XAF', label: 'Central African CFA (XAF) – Fr', currency: 'Fr' },
    { code: 'CL', label: 'Chile (CLP) – $', currency: '$' },
    { code: 'CN', label: 'China (CNY) – ¥', currency: '¥' },
    { code: 'CO', label: 'Colombia (COP) – $', currency: '$' },
    { code: 'KM', label: 'Comoros (KMF) – CF', currency: 'CF' },
    { code: 'CD', label: 'Congo, Dem. Republic (CDF) – FC', currency: 'FC' },
    { code: 'CR', label: 'Costa Rica (CRC) – ₡', currency: '₡' },
    { code: 'HR', label: 'Croatia (HRK) – kn', currency: 'kn' },
    { code: 'CUP', label: 'Cuba (CUP) – ₱', currency: '₱' },
    { code: 'CZ', label: 'Czech Republic (CZK) – Kč', currency: 'Kč' },
    { code: 'DK', label: 'Denmark (DKK) – kr', currency: 'kr' },
    { code: 'DJ', label: 'Djibouti (DJF) – Fdj', currency: 'Fdj' },
    { code: 'DO', label: 'Dominican Republic (DOP) – RD$', currency: 'RD$' },
    { code: 'XCD', label: 'East Caribbean (XCD) – $', currency: '$' },
    { code: 'EGP', label: 'Egypt (EGP) – £', currency: '£' },
    { code: 'ERN', label: 'Eritrea (ERN) – Nfk', currency: 'Nfk' },
    { code: 'ET', label: 'Ethiopia (ETB) – Br', currency: 'Br' },
    { code: 'EU', label: 'Eurozone (EUR) – €', currency: '€' },
    { code: 'FK', label: 'Falkland Islands (FKP) – £', currency: '£' },
    { code: 'FJ', label: 'Fiji (FJD) – $', currency: '$' },
    { code: 'GMD', label: 'Gambia (GMD) – D', currency: 'D' },
    { code: 'GE', label: 'Georgia (GEL) – ₾', currency: '₾' },
    { code: 'GH', label: 'Ghana (GHS) – ₵', currency: '₵' },
    { code: 'GI', label: 'Gibraltar (GIP) – £', currency: '£' },
    { code: 'GT', label: 'Guatemala (GTQ) – Q', currency: 'Q' },
    { code: 'GN', label: 'Guinea (GNF) – FG', currency: 'FG' },
    { code: 'GY', label: 'Guyana (GYD) – $', currency: '$' },
    { code: 'HT', label: 'Haiti (HTG) – G', currency: 'G' },
    { code: 'HN', label: 'Honduras (HNL) – L', currency: 'L' },
    { code: 'HK', label: 'Hong Kong (HKD) – HK$', currency: 'HK$' },
    { code: 'HU', label: 'Hungary (HUF) – Ft', currency: 'Ft' },
    { code: 'IS', label: 'Iceland (ISK) – kr', currency: 'kr' },
    { code: 'IN', label: 'India (INR) – ₹', currency: '₹' },
    { code: 'ID', label: 'Indonesia (IDR) – Rp', currency: 'Rp' },
    { code: 'IR', label: 'Iran (IRR) – ﷼', currency: '﷼' },
    { code: 'IQ', label: 'Iraq (IQD) – ع.د', currency: 'ع.د' },
    { code: 'IL', label: 'Israel (ILS) – ₪', currency: '₪' },
    { code: 'JM', label: 'Jamaica (JMD) – J$', currency: 'J$' },
    { code: 'JP', label: 'Japan (JPY) – ¥', currency: '¥' },
    { code: 'JO', label: 'Jordan (JOD) – د.ا', currency: 'د.ا' },
    { code: 'KZ', label: 'Kazakhstan (KZT) – ₸', currency: '₸' },
    { code: 'KE', label: 'Kenya (KES) – KSh', currency: 'KSh' },
    { code: 'KP', label: 'Korea, North (KPW) – ₩', currency: '₩' },
    { code: 'KR', label: 'Korea, South (KRW) – ₩', currency: '₩' },
    { code: 'KW', label: 'Kuwait (KWD) – د.ك', currency: 'د.ك' },
    { code: 'KG', label: 'Kyrgyzstan (KGS) – сом', currency: 'сом' },
    { code: 'LA', label: 'Laos (LAK) – ₭', currency: '₭' },
    { code: 'LB', label: 'Lebanon (LBP) – ل.ل', currency: 'ل.ل' },
    { code: 'LS', label: 'Lesotho (LSL) – L', currency: 'L' },
    { code: 'LR', label: 'Liberia (LRD) – $', currency: '$' },
    { code: 'LY', label: 'Libya (LYD) – ل.د', currency: 'ل.د' },
    { code: 'MO', label: 'Macau (MOP) – MOP$', currency: 'MOP$' },
    { code: 'MK', label: 'Macedonia (MKD) – ден', currency: 'ден' },
    { code: 'MG', label: 'Madagascar (MGA) – Ar', currency: 'Ar' },
    { code: 'MW', label: 'Malawi (MWK) – MK', currency: 'MK' },
    { code: 'MY', label: 'Malaysia (MYR) – RM', currency: 'RM' },
    { code: 'MV', label: 'Maldives (MVR) – Rf', currency: 'Rf' },
    { code: 'MR', label: 'Mauritania (MRU) – UM', currency: 'UM' },
    { code: 'MU', label: 'Mauritius (MUR) – ₨', currency: '₨' },
    { code: 'MX', label: 'Mexico (MXN) – $', currency: '$' },
    { code: 'MD', label: 'Moldova (MDL) – L', currency: 'L' },
    { code: 'MNT', label: 'Mongolia (MNT) – ₮', currency: '₮' },
    { code: 'MA', label: 'Morocco (MAD) – د.م.', currency: 'د.م.' },
    { code: 'MZ', label: 'Mozambique (MZN) – MT', currency: 'MT' },
    { code: 'MM', label: 'Myanmar (MMK) – K', currency: 'K' },
    { code: 'NA', label: 'Namibia (NAD) – N$', currency: 'N$' },
    { code: 'NP', label: 'Nepal (NPR) – ₨', currency: '₨' },
    { code: 'ANG', label: 'Netherlands Antilles (ANG) – ƒ', currency: 'ƒ' },
    { code: 'NZ', label: 'New Zealand (NZD) – NZ$', currency: 'NZ$' },
    { code: 'OM', label: 'Oman (OMR) – ر.ع.', currency: 'ر.ع.' },
    { code: 'PK', label: 'Pakistan (PKR) – ₨', currency: '₨' },
    { code: 'PAB', label: 'Panama (PAB) – B/.', currency: 'B/.' },
    { code: 'PG', label: 'Papua New Guinea (PGK) – K', currency: 'K' },
    { code: 'PY', label: 'Paraguay (PYG) – ₲', currency: '₲' },
    { code: 'PE', label: 'Peru (PEN) – S/.', currency: 'S/.' },
    { code: 'PH', label: 'Philippines (PHP) – ₱', currency: '₱' },
    { code: 'PL', label: 'Poland (PLN) – zł', currency: 'zł' },
    { code: 'QA', label: 'Qatar (QAR) – ر.ق', currency: 'ر.ق' },
    { code: 'RO', label: 'Romania (RON) – lei', currency: 'lei' },
    { code: 'RU', label: 'Russia (RUB) – ₽', currency: '₽' },
    { code: 'RW', label: 'Rwanda (RWF) – FRw', currency: 'FRw' },
    { code: 'SH', label: 'Saint Helena (SHP) – £', currency: '£' },
    { code: 'WST', label: 'Samoa (WST) – WS$', currency: 'WS$' },
    { code: 'ST', label: 'Samoa (STN) – Db', currency: 'Db' },
    { code: 'SAR', label: 'Saudi Arabia (SAR) – ر.س', currency: 'ر.س' },
    { code: 'RSD', label: 'Serbia (RSD) – Дин.', currency: 'Дин.' },
    { code: 'SCR', label: 'Seychelles (SCR) – ₨', currency: '₨' },
    { code: 'SLE', label: 'Sierra Leone (SLE) – Le', currency: 'Le' },
    { code: 'SG', label: 'Singapore (SGD) – S$', currency: 'S$' },
    { code: 'SBD', label: 'Solomon Islands (SBD) – SI$', currency: 'SI$' },
    { code: 'SOS', label: 'Somalia (SOS) – S', currency: 'S' },
    { code: 'ZA', label: 'South Africa (ZAR) – R', currency: 'R' },
    { code: 'LK', label: 'Sri Lanka (LKR) – ₨', currency: '₨' },
    { code: 'SDG', label: 'Sudan (SDG) – ج.س.', currency: 'ج.س.' },
    { code: 'SRD', label: 'Suriname (SRD) – $', currency: '$' },
    { code: 'SZ', label: 'Swaziland (SZL) – E', currency: 'E' },
    { code: 'SE', label: 'Sweden (SEK) – kr', currency: 'kr' },
    { code: 'CH', label: 'Switzerland (CHF) – CHF', currency: 'CHF' },
    { code: 'SY', label: 'Syria (SYP) – £', currency: '£' },
    { code: 'TW', label: 'Taiwan (TWD) – NT$', currency: 'NT$' },
    { code: 'TJ', label: 'Tajikistan (TJS) – ЅM', currency: 'ЅM' },
    { code: 'TZ', label: 'Tanzania (TZS) – TSh', currency: 'TSh' },
    { code: 'TH', label: 'Thailand (THB) – ฿', currency: '฿' },
    { code: 'TOP', label: 'Tonga (TOP) – T$', currency: 'T$' },
    { code: 'TT', label: 'Trinidad & Tobago (TTD) – TT$', currency: 'TT$' },
    { code: 'TN', label: 'Tunisia (TND) – د.ت', currency: 'د.ت' },
    { code: 'TR', label: 'Turkey (TRY) – ₺', currency: '₺' },
    { code: 'TM', label: 'Turkmenistan (TMT) – T', currency: 'T' },
    { code: 'UG', label: 'Uganda (UGX) – USh', currency: 'USh' },
    { code: 'UA', label: 'Ukraine (UAH) – ₴', currency: '₴' },
    { code: 'AE', label: 'United Arab Emirates (AED) – د.إ', currency: 'د.إ' },
    { code: 'UK', label: 'United Kingdom (GBP) – £', currency: '£' }, // FIXED: Mapped key to 'UK'
    { code: 'US', label: 'United States (USD) – $', currency: '$' },
    { code: 'UY', label: 'Uruguay (UYU) – $U', currency: '$U' },
    { code: 'UZ', label: 'Uzbekistan (UZS) – сўм', currency: 'сўм' },
    { code: 'VU', label: 'Vanuatu (VUV) – Vt', currency: 'Vt' },
    { code: 'VE', label: 'Venezuela (VES) – Bs.S', currency: 'Bs.S' },
    { code: 'VN', label: 'Vietnam (VND) – ₫', currency: '₫' },
    { code: 'XOF', label: 'West African CFA (XOF) – Fr', currency: 'Fr' },
    { code: 'YE', label: 'Yemen (YER) – ﷼', currency: '﷼' },
    { code: 'ZM', label: 'Zambia (ZMW) – ZK', currency: 'ZK' },
    { code: 'ZW', label: 'Zimbabwe (ZWL) – Z$', currency: 'Z$' }
  ];

  const timezones = [
    { value: 'UTC',                                label: 'UTC / GMT' },
    { value: 'Africa/Cairo',                       label: 'Africa/Cairo (EET)' },
    { value: 'Africa/Johannesburg',                label: 'Africa/Johannesburg (SAST)' },
    { value: 'Africa/Lagos',                       label: 'Africa/Lagos (WAT)' },
    { value: 'Africa/Nairobi',                     label: 'Africa/Nairobi (EAT)' },
    { value: 'America/Anchorage',                  label: 'America/Anchorage (AKST/AKDT)' },
    { value: 'America/Argentina/Buenos_Aires',     label: 'America/Buenos Aires (ART)' },
    { value: 'America/Bogota',                     label: 'America/Bogota (COT)' },
    { value: 'America/Chicago',                    label: 'America/Chicago (CST/CDT)' },
    { value: 'America/Denver',                     label: 'America/Denver (MST/MDT)' },
    { value: 'America/Los_Angeles',                label: 'America/Los Angeles (PST/PDT)' },
    { value: 'America/Mexico_City',                label: 'America/Mexico City (CST)' },
    { value: 'America/New_York',                   label: 'America/New York (EST/EDT)' },
    { value: 'America/Phoenix',                    label: 'America/Phoenix (MST)' },
    { value: 'America/Sao_Paulo',                  label: 'America/Sao Paulo (BRT)' },
    { value: 'America/Toronto',                    label: 'America/Toronto (EST/EDT)' },
    { value: 'America/Vancouver',                  label: 'America/Vancouver (PST/PDT)' },
    { value: 'Asia/Bangkok',                       label: 'Asia/Bangkok (ICT)' },
    { value: 'Asia/Dubai',                         label: 'Asia/Dubai (GST)' },
    { value: 'Asia/Hong_Kong',                     label: 'Asia/Hong Kong (HKT)' },
    { value: 'Asia/Jakarta',                       label: 'Asia/Jakarta (WIB)' },
    { value: 'Asia/Jerusalem',                     label: 'Asia/Jerusalem (IST)' },
    { value: 'Asia/Kolkata',                       label: 'Asia/Kolkata (IST)' },
    { value: 'Asia/Manila',                        label: 'Asia/Manila (PHT)' },
    { value: 'Asia/Singapore',                     label: 'Asia/Singapore (SGT)' },
    { value: 'Asia/Seoul',                         label: 'Asia/Seoul (KST)' },
    { value: 'Asia/Shanghai',                      label: 'Asia/Shanghai (CST)' },
    { value: 'Asia/Tokyo',                         label: 'Asia/Tokyo (JST)' },
    { value: 'Australia/Sydney',                   label: 'Australia/Sydney (AEST/AEDT)' },
    { value: 'Australia/Melbourne',                label: 'Australia/Melbourne (AEST/AEDT)' },
    { value: 'Australia/Perth',                    label: 'Australia/Perth (AWST)' },
    { value: 'Europe/Amsterdam',                   label: 'Europe/Amsterdam (CET/CEST)' },
    { value: 'Europe/Berlin',                      label: 'Europe/Berlin (CET/CEST)' },
    { value: 'Europe/Dublin',                      label: 'Europe/Dublin (GMT/IST)' },
    { value: 'Europe/Lisbon',                      label: 'Europe/Lisbon (WET/WEST)' },
    { value: 'Europe/London',                      label: 'Europe/London (GMT/BST)' },
    { value: 'Europe/Madrid',                      label: 'Europe/Madrid (CET/CEST)' },
    { value: 'Europe/Paris',                       label: 'Europe/Paris (CET/CEST)' },
    { value: 'Europe/Rome',                        label: 'Europe/Rome (CET/CEST)' },
    { value: 'Europe/Stockholm',                   label: 'Europe/Stockholm (CET/CEST)' },
    { value: 'Pacific/Auckland',                   label: 'Pacific/Auckland (NZST/NZDT)' },
    { value: 'Pacific/Honolulu',                   label: 'Pacific/Honolulu (HST)' },
  ];

  // Auto-detect the browser timezone — used as the default when no value is set yet
  const browserTimezone = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London'; }
    catch { return 'Europe/London'; }
  })();

// 1. Initialize state safely by checking for an explicit region fallback string
  const [localSettings, setLocalSettings] = React.useState(() => {
    return {
      role: settings?.role || "Head chef",
      region: settings?.region || "UK", // Rely on explicit region keys
      currency: settings?.currency || "£",
      unitSystem: settings?.unitSystem || "metric",
      timezone: settings?.timezone || browserTimezone
    };
  });
  
  const [isSaving, setIsSaving] = React.useState(false);
  const [savedSuccess, setSavedSuccess] = React.useState(false);

  // 2. Double-check synchronization on database streams
  React.useEffect(() => {
    if (settings && Object.keys(settings).length > 0) {
      // If region is completely missing from the DB table row, fall back to currency checking, excluding Cuba if Pesos are selected
      let derivedRegion = settings.region;
      if (!derivedRegion) {
        // Many regions share a symbol (£ = UK, Egypt, Lebanon…; $ = US, Argentina…).
        // Without a saved region, pick the most likely one instead of the first
        // alphabetical match (which showed "Egypt" for £).
        const PREFERRED = { '£': 'UK', '$': 'US', '€': 'IE', '₱': 'PH', '¥': 'JP', 'kr': 'SE', 'R': 'ZA' };
        const preferred = PREFERRED[settings.currency];
        if (preferred && regions.some(r => r.code === preferred)) {
          derivedRegion = preferred;
        } else {
          const matched = regions.find(r => r.currency === settings.currency);
          derivedRegion = matched ? matched.code : "UK";
        }
      }

      setLocalSettings({
        role: settings.role || "Head chef",
        region: derivedRegion,
        currency: settings.currency || "£",
        unitSystem: settings.unitSystem || "metric",
        timezone: settings.timezone || browserTimezone
      });
    }
  }, [settings]);

  const handleChange = (key, val) => {
    setLocalSettings(prev => ({ ...prev, [key]: val }));
    setSavedSuccess(false);
  };

  // 3. Keep internal tracking clean
  const handleRegionChange = (regionCode) => {
    if (regionCode === 'AUTO') {
      const { currency, regionLabel } = autoDetectCurrency();
      setLocalSettings(prev => ({
        ...prev,
        region: 'AUTO',
        currency
      }));
      setSavedSuccess(false);
      return;
    }
    const matchedRegion = regions.find(r => r.code === regionCode);
    if (matchedRegion) {
      setLocalSettings(prev => ({ 
        ...prev, 
        region: regionCode, 
        currency: matchedRegion.currency 
      }));
    }
    setSavedSuccess(false);
  };

  // Dispatch fully confirmed options configuration to the remote database
  const handleSave = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    try {
      await onUpdate(localSettings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update ledger context settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', fontFamily: 'sans-serif', color: '#0e0e0c' }}>
      <h2 style={{ fontFamily: "'Bitter', serif", fontSize: 24, marginBottom: 4 }}>Station Settings</h2>
      <p style={{ color: '#5a4f40', fontSize: 13, marginBottom: 24 }}>Manage localized currency displays, kitchen hierarchy metrics, and system defaults.</p>
      
      {!canEdit && (
        <div style={{ background: '#1c2428', color: '#fff', border: '1px solid #2c5a82', padding: '10px 14px', borderRadius: 4, marginBottom: 16, fontSize: 13 }}>
          🔒 You've joined this kitchen. Currency, units and timezone are set by the kitchen owner and shown here read-only.
        </div>
      )}
      <fieldset disabled={!canEdit} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, background: '#efe6d3', padding: 24, borderRadius: 6, border: '1px solid #1a1a18', opacity: canEdit ? 1 : 0.75 }}>
        
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.5px' }}>Kitchen Hierarchy Role</label>
          <select 
            value={localSettings.role || ''} 
            onChange={(e) => handleChange('role', e.target.value)} 
            style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', border: '1px solid #1a1a18', borderRadius: 4, background: '#f7f1e3', fontSize: 14 }}
          >
            <option value="Head chef">Head Chef</option>
            <option value="Sous chef">Sous Chef</option>
            <option value="Owner">Owner</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.5px' }}>Region & Financial Currency</label>
          <select 
            value={localSettings.region || ''} 
            onChange={(e) => handleRegionChange(e.target.value)} 
            style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', border: '1px solid #1a1a18', borderRadius: 4, background: '#f7f1e3', fontSize: 14 }}
          >
            {regions.map(r => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
          {localSettings.region === 'AUTO' && (
            <div style={{ marginTop: 6, fontSize: 11, color: C.inkFade, fontStyle: 'italic' }}>
              Resolved from your device locale: <strong style={{ color: C.accent, fontFamily: "'JetBrains Mono', monospace" }}>{localSettings.currency || '£'}</strong>. Travelling? This re-resolves whenever you re-pick Auto.
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.5px' }}>Unit Measurement System</label>
          <select 
            value={localSettings.unitSystem || ''} 
            onChange={(e) => handleChange('unitSystem', e.target.value)} 
            style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', border: '1px solid #1a1a18', borderRadius: 4, background: '#f7f1e3', fontSize: 14 }}
          >
            <option value="metric">Metric System (kg, g, L, mL)</option>
            <option value="imperial">Imperial System UK (lbs, oz, fl oz, gal)</option>
            <option value="us">US Customary System (cups, lbs, fl oz)</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.5px' }}>Station Timezone</label>
          <select 
            value={localSettings.timezone || ''} 
            onChange={(e) => handleChange('timezone', e.target.value)} 
            style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', border: '1px solid #1a1a18', borderRadius: 4, background: '#f7f1e3', fontSize: 14 }}
          >
            {timezones.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>

        {canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, paddingTop: 16, borderTop: '1px solid #5a4f40' }}>
          <button 
            onClick={handleSave} 
            disabled={isSaving} 
            style={{ background: '#b8730a', color: '#fff', border: 'none', padding: '12px 24px', fontSize: 13, fontWeight: 700, borderRadius: 4, cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px' }}
          >
            {isSaving ? 'PERSISTING LEDGER...' : 'SAVE KITCHEN SETTINGS'}
          </button>
          {savedSuccess && (
            <span style={{ fontSize: 12, color: '#4a6b3a', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
              ✓ CHANGES SYNCED SUCCESSFULLY
            </span>
          )}
        </div>
        )}

      </div>
      </fieldset>
    </div>
  );
}

// ============================================================
// CORE FUNCTIONAL FIX: THE SERVICE REPORT COMPONENT (RESTORED)
// ============================================================
function ServiceReport({ recipes = [], components = [], sales = [], waste = [], planner = [], settings = {}, totals = null }) {
  const [loading, setLoading] = useState(false);
  const [generatedReport, setGeneratedReport] = useState(null);
  const [errorLog, setErrorLog] = useState("");
  const currencySymbol = settings?.currency || '£';

  // Compute summary metrics with fallback provisions
  const computedMetrics = useMemo(() => {
    if (totals) {
      const grossProfit = totals.revenue - totals.foodCost - totals.wasteCost;
      return {
        totalRevenue: totals.revenue, materialCost: totals.foodCost, leakCost: totals.wasteCost, grossProfit,
        efficiencyPct: totals.revenue > 0 ? (grossProfit / totals.revenue) * 100 : 0,
        salesCount: sales.length, wasteCount: waste.length
      };
    }
    let totalRevenue = 0;
    let materialCost = 0;
    
    if (Array.isArray(sales)) {
      sales.forEach(s => {
        const r = Array.isArray(recipes) ? recipes.find(x => x.id === s.recipeId) : null;
        if (r) {
          totalRevenue += (Number(s.sold || 0) * (Number(r.sellPrice || 0)));
          materialCost += (Number(s.sold || 0) * (Number(r.sellPrice || 0)) * 0.3); 
        }
      });
    }

    const leakCost = Array.isArray(waste) ? waste.reduce((acc, w) => acc + (parseFloat(w.cost) || 0), 0) : 0;
    const grossProfit = totalRevenue - materialCost - leakCost;
    const efficiencyPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      leakCost,
      grossProfit,
      efficiencyPct,
      salesCount: Array.isArray(sales) ? sales.length : 0,
      wasteCount: Array.isArray(waste) ? waste.length : 0
    };
  }, [recipes, sales, waste, totals]);

  const handleCompileWeeklyAIReport = async () => {
    setLoading(true);
    setErrorLog("");
    
    const analyticsContext = {
      recipes: (recipes || []).map(r => ({ name: r.name, category: r.category, yield: r.yield })),
      salesSummary: { totalEntries: (sales || []).length, estimatedRevenue: computedMetrics.totalRevenue },
      wasteLogs: (waste || []).map(w => ({ item: w.item || w.ingredientName || w.name, totalCost: w.lineTotal ?? w.cost, reason: w.reason })),
      plannerCovers: planner || []
    };

    const compilationQuery = `Provide a concise 4-bullet point weekly management operational debrief. Break down financial achievements based on ${currencySymbol}${computedMetrics.totalRevenue.toFixed(2)} revenue, specify optimization paths for preventing the ${currencySymbol}${computedMetrics.leakCost.toFixed(2)} waste leakage, and highlight any menu engineering recommendations. Use short, professional, action-driven sentences.`;

    try {
      const { data, error } = await supabase.functions.invoke('sous-chat', {
        body: { 
          prompt: compilationQuery, 
          context: analyticsContext 
        }
      });

      if (error) throw error;

      if (data && data.reply) {
        setGeneratedReport(data.reply);
      } else {
        setGeneratedReport("Heard. Report generated successfully but returned an empty structural analysis.");
      }
    } catch (err) {
      console.error("AI Report compiler exception:", err);
      setErrorLog(err.message || "Failed to connect to the AI engine.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ color: C.ink, width: '100%', minHeight: '80vh', boxSizing: 'border-box' }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.inkRule}`, paddingBottom: 16, marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, margin: 0, fontFamily: "'serif', Georgia", fontWeight: '800', color: C.ink }}>Weekly Service Report</h2>
          <p style={{ margin: '4px 0 0 0', color: C.inkFade, fontSize: 13 }}>
            Automated intelligence compilation. Syncs sales matrices and waste logs via OpenAI analysis vectors.
          </p>
        </div>
        <button
          onClick={handleCompileWeeklyAIReport}
          disabled={loading}
          style={{
            background: '#121210',
            color: '#fff',
            border: `1px solid ${C.inkRule}`,
            padding: '10px 20px',
            fontWeight: '700',
            fontSize: '12px',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.5px'
          }}
        >
          {loading ? "COMPILING LEDGER ATOMICS..." : "✨ Generate Weekly AI Report"}
        </button>
      </div>

      {errorLog && (
        <div style={{ background: C.red, color: '#fff', padding: '12px 16px', borderRadius: 4, marginBottom: 20, fontSize: 13, fontWeight: 600 }}>
          ⚠️ System Compiler Error: {errorLog}
        </div>
      )}

      {/* FIXED GRID: GRID GAP AND WRAP ALIGNMENT */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24, width: '100%' }}>
        
        {/* REVENUE CARD */}
        <div style={{ background: C.paper2, padding: 16, borderRadius: 4, border: `1px solid ${C.inkRule}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.inkFade, letterSpacing: '0.5px' }}>Aggregated Revenue Intake</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, fontFamily: 'monospace', color: C.ink }}>
              {currencySymbol}{computedMetrics.totalRevenue.toFixed(2)}
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.inkFade, marginTop: 8 }}>From {computedMetrics.salesCount} active item logs</div>
        </div>
        
        {/* WASTE CARD */}
        <div style={{ background: C.paper2, padding: 16, borderRadius: 4, border: `1px solid ${C.inkRule}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.inkFade, letterSpacing: '0.5px' }}>Trash Leakage Cost</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, fontFamily: 'monospace', color: computedMetrics.leakCost > 0 ? C.red : C.ink }}>
              {currencySymbol}{computedMetrics.leakCost.toFixed(2)}
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.inkFade, marginTop: 8 }}>Over {computedMetrics.wasteCount} recorded variances</div>
        </div>

        {/* EFFICIENCY CARD */}
        <div style={{ background: C.paper2, padding: 16, borderRadius: 4, border: `1px solid ${C.inkRule}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.inkFade, letterSpacing: '0.5px' }}>Estimated Profit Efficiency</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, fontFamily: 'monospace', color: C.green }}>
              {computedMetrics.efficiencyPct.toFixed(1)}%
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.inkFade, marginTop: 8 }}>Target baseline performance: 70%</div>
        </div>
      </div>

      {/* CORE ANALYSIS BOX */}
      <div style={{ background: C.paper2, border: `1px solid ${C.inkRule}`, borderRadius: 4, padding: 24, minHeight: 250, width: '100%', boxSizing: 'border-box' }}>
        <div style={{ borderBottom: `1px solid ${C.inkRule}`, paddingBottom: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.accent, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Operational Performance Analysis Matrix
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, color: C.inkFade }}>
            <span style={{ fontSize: 24, marginBottom: 12 }}>⏳</span>
            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '1px' }}>SOUS AI COMPILING METRIC ATTRIBUTES...</div>
          </div>
        ) : generatedReport ? (
          <div style={{ fontSize: 14, color: C.ink, lineHeight: '1.6', whiteSpace: 'pre-wrap', fontFamily: 'sans-serif' }}>
            {generatedReport}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, color: C.inkFade, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Ledger Data Streams Initialized.</div>
            <div style={{ fontSize: 11, marginTop: 4, color: C.inkFade }}>Click the generation switch above to route logs directly into automated AI summary matrices.</div>
          </div>
        )}
      </div>

    </div>
  );
}

// ============================================================
// UNIVERSAL COMPATIBLE FIX: THE PASS (DASHBOARD)
// ============================================================
function Dashboard(props) {
  // Support BOTH formats: state passed as a combined object OR individual direct props
  const stateContainer = props.state || props;
  
  const recipes = stateContainer.recipes || [];
  const components = stateContainer.components || [];
  const sales = stateContainer.sales || [];
  const waste = stateContainer.waste || [];
  const settings = stateContainer.settings || {};
  
  const setTab = props.setTab;
  const isMobile = props.viewport === 'mobile';
  const totals = props.totals || null;

  // Extract global dynamic currency config setup safely
  const currencySymbol = settings?.currency || '£';

  // 1. Weekly Sales Calculation (Checks both total and netSales)
  const totalWeeklySales = useMemo(() => {
    if (totals) return totals.revenue;
    if (!sales || sales.length === 0) return 0;
    return sales.reduce((sum, item) => {
      const salesValue = parseFloat(item.total || item.netSales || 0);
      return sum + salesValue;
    }, 0);
  }, [sales]);

  // 2. Tracked Waste Calculation (Checks both cost and costPrice)
  const totalWeeklyWaste = useMemo(() => {
    if (totals) return totals.wasteCost;
    if (!waste || waste.length === 0) return 0;
    return waste.reduce((sum, item) => {
      const wasteValue = parseFloat(item.cost || item.costPrice || 0);
      return sum + wasteValue;
    }, 0);
  }, [waste]);

  // Helper to find raw material cost from components ledger
  const getRawMaterialCost = (name) => {
    if (!components) return 0;
    const matched = components.find(c => c.name?.toLowerCase() === name?.toLowerCase());
    return matched ? parseFloat(matched.cost || matched.costPrice || 0) : 0;
  };

  const computeSubRecipeUnitCost = (sub) => {
    let total = 0;
    if (sub && sub.ingredients) {
      sub.ingredients.forEach(ing => {
        total += (parseFloat(ing.qty || 0) * getRawMaterialCost(ing.name));
      });
    }
    const yieldQty = parseFloat(sub?.batchYield || sub?.yieldQty || 1);
    return total / yieldQty;
  };

  const computeMenuRecipeCost = (recipe) => {
    let total = 0;
    if (recipe && recipe.ingredients) {
      recipe.ingredients.forEach(ing => {
        if (ing.kind === 'sub' || ing.kind === 'comp') {
          const matchedSub = components.find(s => s.id === ing.componentId || s.name === ing.name);
          if (matchedSub) {
            total += (parseFloat(ing.qty || 0) * computeSubRecipeUnitCost(matchedSub));
          }
        } else {
          total += (parseFloat(ing.qty || 0) * getRawMaterialCost(ing.name));
        }
      });
    }
    return total;
  };

  // 3. Theoretical Food Cost Percentage Matrix
  const aggregateFoodCostPercent = useMemo(() => {
    if (totals) return totals.revenue > 0 ? (totals.foodCost / totals.revenue) * 100 : 0;
    let theoreticalCostTotal = 0;
    let retailRevenueTotal = 0;

    if (!sales || sales.length === 0 || !recipes) return 0;

    sales.forEach(saleItem => {
      const matchedRecipe = recipes.find(r => r.id === saleItem.recipeId || r.name?.toLowerCase() === saleItem.item?.toLowerCase());
      if (matchedRecipe) {
        const itemCost = computeMenuRecipeCost(matchedRecipe);
        const qtySold = parseInt(saleItem.qty || saleItem.sold || saleItem.volume || 0);
        theoreticalCostTotal += (itemCost * qtySold);
        retailRevenueTotal += (parseFloat(matchedRecipe.sellPrice || 0) * qtySold);
      }
    });

    if (retailRevenueTotal === 0) return 0; // No revenue logged yet — no theoretical cost to show
    return (theoreticalCostTotal / retailRevenueTotal) * 100;
  }, [sales, recipes, components, totals]);

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Header section banner */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Bitter', serif", fontSize: isMobile ? 22 : 28, margin: '0 0 2px 0', color: '#0e0e0c' }}>The Pass</h2>
        <p style={{ margin: 0, fontSize: isMobile ? 12 : 14, color: '#5a4f40', opacity: 0.85 }}>Live shift reporting, structural yield targets, and financial leak margins</p>
        <ForecastBadge metrics={props.forecastMetrics} />
      </div>

      {/* Financial Overview Cards Row Layout - Responsive Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fit, minmax(220px, 1fr))', 
        gap: isMobile ? 8 : 16, 
        marginBottom: 24 
      }}>
        {/* Card 1: Sales */}
        <div style={{ background: '#f7f1e3', border: '1px solid #1a1a18', padding: isMobile ? '12px 8px' : '16px', borderRadius: 4 }}>
          <div style={{ fontSize: isMobile ? 9 : 11, color: '#5a4f40', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 6 }}>
            {isMobile ? 'Sales' : 'Weekly Net Sales'}
          </div>
          <div style={{ fontSize: isMobile ? 15 : 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#0e0e0c' }}>
            {currencySymbol}{totalWeeklySales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Card 2: Food Cost */}
        <div style={{ background: '#f7f1e3', border: '1px solid #1a1a18', padding: isMobile ? '12px 8px' : '16px', borderRadius: 4 }}>
          <div style={{ fontSize: isMobile ? 9 : 11, color: '#5a4f40', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 6 }}>
            {isMobile ? 'Food Cost' : 'Theoretical Cost'}
          </div>
          <div style={{ fontSize: isMobile ? 15 : 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: (!sales || sales.length === 0) ? '#5a4f40' : (aggregateFoodCostPercent > 35 ? '#b8362a' : '#4a6b3a') }}>
            {(!sales || sales.length === 0) ? '—' : aggregateFoodCostPercent.toFixed(1) + '%'}
          </div>
        </div>

        {/* Card 3: Waste */}
        <div style={{ background: '#f7f1e3', border: '1px solid #1a1a18', padding: isMobile ? '12px 8px' : '16px', borderRadius: 4 }}>
          <div style={{ fontSize: isMobile ? 9 : 11, color: '#5a4f40', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 6 }}>
            {isMobile ? 'Waste' : 'Tracked Waste'}
          </div>
          <div style={{ fontSize: isMobile ? 15 : 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: totalWeeklyWaste > 150 ? '#b8362a' : '#0e0e0c' }}>
            {currencySymbol}{totalWeeklyWaste.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Navigation Quick Jumps */}
      <div style={{ background: '#efe6d3', border: '1px solid #1a1a18', padding: 16, borderRadius: 4 }}>
        <h3 style={{ fontFamily: "'Bitter', serif", fontSize: 14, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0e0e0c' }}>Service Navigation Quick Jumps</h3>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10 }}>
          <button onClick={() => setTab('recipes')} style={{ background: '#1a1a18', color: '#fff', border: 'none', padding: '12px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 12, textAlign: 'left' }}>
            📖 Formulas & Yield Costs
          </button>
          <button onClick={() => setTab('waste')} style={{ background: '#1a1a18', color: '#fff', border: 'none', padding: '12px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 12, textAlign: 'left' }}>
            🗑️ Trash Logs & Spoils
          </button>
          <button onClick={() => setTab('performance')} style={{ background: '#1a1a18', color: '#fff', border: 'none', padding: '12px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 12, textAlign: 'left' }}>
            📊 Advanced Profit Margins
          </button>
        </div>
      </div>
    </div>
  );
}

function PlannerScreen({ planner, onUpdate }) {
  // Local editable state — typing into the inputs updates this only.
  // Nothing hits the database until the user clicks Save Planner.
  const [draft, setDraft] = useState(planner);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // When the upstream planner prop changes (e.g. another device saved
  // an update, or a kitchen-mate edited the same row), re-sync the draft.
  useEffect(() => {
    setDraft(planner);
  }, [planner]);

  // Compare draft vs. saved planner to know if there are unsaved changes
  const isDirty = useMemo(() => {
    if (!Array.isArray(draft) || !Array.isArray(planner)) return false;
    if (draft.length !== planner.length) return true;
    return draft.some((d, i) => (
      (parseInt(d.lunch) || 0) !== (parseInt(planner[i]?.lunch) || 0) ||
      (parseInt(d.dinner) || 0) !== (parseInt(planner[i]?.dinner) || 0)
    ));
  }, [draft, planner]);

  const updateDay = (idx, field, val) => {
    const next = [...draft];
    next[idx] = { ...next[idx], [field]: parseInt(val) || 0 };
    setDraft(next);
  };

  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      await onUpdate(draft); // App-level handler upserts to planner_days
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch (err) {
      // onUpdate already alerts via the App-level handler
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (!isDirty) return;
    if (window.confirm("Discard your unsaved changes?")) {
      setDraft(planner);
    }
  };

  const totalDraft = draft.reduce((s, d) => s + (parseInt(d.lunch) || 0) + (parseInt(d.dinner) || 0), 0);

  return (
    <div style={S.container}>
      <ScreenHeader title="Weekly Covers Planner" sub="Establish baseline volume expectations for auto-scaling production bounds" />

      {/* Save/Discard action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 12, color: C.inkFade }}>
          Total weekly covers in draft: <strong style={{ color: C.ink, fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>{totalDraft}</strong>
          {isDirty && <span style={{ marginLeft: 12, color: C.accent, fontWeight: 700 }}>● Unsaved changes</span>}
          {savedFlash && !isDirty && <span style={{ marginLeft: 12, color: '#4a6b3a', fontWeight: 700 }}>✓ Saved</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isDirty && (
            <button onClick={handleDiscard} disabled={saving} style={{ background: 'transparent', border: `1px solid ${C.inkFade}`, color: C.inkSoft, padding: '8px 14px', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', borderRadius: 3 }}>
              Discard
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            style={{ background: (!isDirty || saving) ? C.paper2 : C.accent, border: 'none', color: (!isDirty || saving) ? C.inkFade : '#fff', padding: '8px 18px', fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', cursor: (!isDirty || saving) ? 'not-allowed' : 'pointer', borderRadius: 3 }}
          >
            {saving ? 'Saving…' : '💾 Save Planner'}
          </button>
        </div>
      </div>

      <div style={S.card}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%', borderCollapse:'collapse', textAlign:'left'}}>
            <thead>
              <tr style={{borderBottom:`2px solid ${C.inkRule}`}}>
                <th style={{padding:'12px 8px'}}><SectionLabel label="Day Profile" /></th>
                <th style={{padding:'12px 8px'}}><SectionLabel label="Lunch Covers" /></th>
                <th style={{padding:'12px 8px'}}><SectionLabel label="Dinner Covers" /></th>
                <th style={{padding:'12px 8px'}}><SectionLabel label="Total Forecast" /></th>
              </tr>
            </thead>
            <tbody>
              {draft.map((p, idx) => (
                <tr key={idx} style={{borderBottom:`1px solid ${C.paper2}`}}>
                  <td style={{padding:'14px 8px', fontFamily:"'Bitter', serif", fontWeight:900, fontSize:16}}>{p.day}</td>
                  <td style={{padding:'14px 8px'}}>
                    <NumInput value={p.lunch} onChange={(v) => updateDay(idx, 'lunch', v)} />
                  </td>
                  <td style={{padding:'14px 8px'}}>
                    <NumInput value={p.dinner} onChange={(v) => updateDay(idx, 'dinner', v)} />
                  </td>
                  <td style={{padding:'14px 8px', fontFamily:"'JetBrains Mono', monospace", fontSize:14, fontWeight:700}}>
                    {(parseInt(p.lunch) || 0) + (parseInt(p.dinner) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// COMPRESSED SPEC: SPECIFICALLY CAPTURED RECIPE ARCHIVE HUB
// ============================================================
// ============================================================
// 6. RECIPES SCREEN WITH DYNAMIC INVOICE LOOKUP & GP CALCULATIONS
// ============================================================
export function RecipesScreen({ kitchenId, recipes = [], components = [], invoices = [], onUpdateRecipes, settings = {} }) {
  const authContext = typeof useAuth === 'function' ? useAuth() : { user: { id: 'mock-chef-id' } };
  const user = authContext?.user;
  const supabaseClient = typeof supabase !== 'undefined' ? supabase : (window.supabase || null);

  const [localRecipes, setLocalRecipes] = useState([]);
  const [localInvoices, setLocalInvoices] = useState([]);
  const [localInvoiceLines, setLocalInvoiceLines] = useState([]);
  const [selectedRecipeName, setSelectedRecipeName] = useState("");
  const [editSellPrice, setEditSellPrice] = useState("");
  const [updating, setUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const activeKitchenId = kitchenId || user?.id;
  const currencySymbol = settings?.currency || '£';

  // Responsive: stack the two-column layout on phones
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Load recipes, invoices and invoice lines straight from the database.
  // The DB rows are the source of truth and always include ingredient_item;
  // the app-state prop can arrive in a reduced shape that drops it.
  const fetchRecipesAndInvoices = async () => {
    if (!activeKitchenId || !supabaseClient) return;
    try {
      const { data: recData } = await supabaseClient
        .from('recipes')
        .select('*')
        .eq('kitchen_id', activeKitchenId)
        .order('created_at', { ascending: true });

      const { data: invData } = await supabaseClient
        .from('invoices')
        .select('*')
        .eq('kitchen_id', activeKitchenId);

      const { data: lineData } = await supabaseClient
        .from('invoice_lines')
        .select('*')
        .eq('kitchen_id', activeKitchenId);

      // Prefer DB rows; fall back to the prop only if the table is empty
      const recipeRows = (recData && recData.length > 0) ? recData : (recipes || []);
      setLocalRecipes(recipeRows);

      const names = Array.from(new Set(recipeRows.map(r => r.name).filter(Boolean)));
      setSelectedRecipeName(prev => (prev && names.includes(prev)) ? prev : (names[0] || ""));

      if (invData) setLocalInvoices(invData);
      if (lineData) setLocalInvoiceLines(lineData);
    } catch (err) {
      console.error("Error loading recipes/invoices:", err);
    }
  };

  useEffect(() => {
    fetchRecipesAndInvoices();
    const onDbUpdate = () => fetchRecipesAndInvoices();
    window.addEventListener('mise-db-update', onDbUpdate);
    return () => window.removeEventListener('mise-db-update', onDbUpdate);
  }, [activeKitchenId]);

  // Group unique distinct recipes
  const uniqueRecipeNames = useMemo(() => {
    const names = new Set();
    localRecipes.forEach(r => { if (r.name) names.add(r.name); });
    return Array.from(names);
  }, [localRecipes]);

  // Aggregate matrix rows matching selection.
  // If duplicate saves exist, keep only rows that actually carry an ingredient,
  // so empty placeholder rows don't clutter or zero-out the costing.
  const activeRecipeRows = useMemo(() => {
    const all = localRecipes.filter(r => r.name === selectedRecipeName);
    const withIngredients = all.filter(r => (r.ingredient_item || "").trim());
    return withIngredients.length > 0 ? withIngredients : all;
  }, [localRecipes, selectedRecipeName]);

  // The configured sell price (use the highest non-zero value across the group)
  const groupSellPrice = useMemo(() => {
    const prices = activeRecipeRows
      .map(r => parsePriceOrNull(r.sell_price))
      .filter(p => p !== null);
    return prices.length > 0 ? Math.max(...prices) : null;
  }, [activeRecipeRows]);

  // Handle active value sync defaults
  useEffect(() => {
    if (activeRecipeRows.length > 0) {
      setEditSellPrice(groupSellPrice !== null ? String(groupSellPrice) : "");
    }
  }, [activeRecipeRows, selectedRecipeName, groupSellPrice]);

  // Costing helpers (UNIT_FACTORS, convertQty, …) live at module scope so
  // Financials, The Pass and Service Report cost recipes the same way.

  const evaluatedCostingData = useMemo(() => {
    let combinedRecipeCost = 0;

    const items = activeRecipeRows.map((row) => {
      const ingredientText = (row.ingredient_item || "").toLowerCase().trim();

      // Find every invoice line whose name matches this ingredient...
      const matchCandidates = localInvoiceLines.filter((line) => {
        const lineName = (line.name || "").toLowerCase().trim();
        if (!lineName || !ingredientText) return false;
        return ingredientText.includes(lineName) || lineName.includes(ingredientText);
      });
      // ...compute an effective unit price for each (derive from line total if needed)...
      const scored = matchCandidates.map((line) => {
        const q = parseFloat(line.qty || 1) || 1;
        const p = parseFloat(line.price_per_unit || 0) || 0;
        const t = parseFloat(line.line_total || 0) || 0;
        const eff = p > 0 ? p : (t > 0 && q > 0 ? t / q : 0);
        return { line, eff };
      });
      // ...then keep the one with the highest real price (ignores stale £0 duplicates).
      scored.sort((a, b) => b.eff - a.eff);
      const best = scored[0] || null;
      const matchedLine = best ? best.line : null;
      const unitPrice = best ? best.eff : 0;
      const invUnit = matchedLine ? (matchedLine.unit || "").toLowerCase().trim() : "";

      // Figure out the recipe's quantity and unit, then convert to the invoice's unit
      const recipe = parseQtyUnit(row.ingredient_item);
      let lineCostTotal = 0;
      let costNote = "";

      if (matchedLine) {
        const recipeConvertible = recipe.qty != null && recipe.unit && UNIT_FACTORS[recipe.unit];
        const invFamily = UNIT_FACTORS[invUnit] ? UNIT_FACTORS[invUnit].family : null;

        if (unitPrice === 0) {
          // Linked to an invoice item, but that item has no price stored
          lineCostTotal = 0;
          costNote = "invoice has no price — re-scan the invoice";
        } else if (recipeConvertible && invFamily) {
          const converted = convertQty(recipe.qty, recipe.unit, invUnit, matchedLine.name || row.ingredient_item);
          if (converted != null) {
            lineCostTotal = converted * unitPrice;            // unit-aware (accurate)
          } else {
            lineCostTotal = 0;
            costNote = "can't auto-cost — different unit types";
          }
        } else if (invFamily === 'count') {
          lineCostTotal = (recipe.qty != null ? recipe.qty : 1) * unitPrice; // e.g. eggs
        } else {
          // recipe unit can't be converted to the invoice's bulk unit (e.g. tsp vs kg)
          lineCostTotal = 0;
          costNote = "needs manual cost — unit mismatch";
        }
      }

      combinedRecipeCost += lineCostTotal;

      return {
        rawText: row.ingredient_item,
        id: row.id,
        isMatched: !!matchedLine,
        matchedName: matchedLine ? matchedLine.name : "No invoice link detected",
        unitCost: unitPrice,
        costNote,
        totalItemCost: lineCostTotal
      };
    });

    // Parse the number of portions out of the yield text ("9 portions", "2 servings", "1 Portion")
    const yieldText = activeRecipeRows[0]?.yield || "1 Portion";
    const yieldMatch = yieldText.match(/([0-9]+(?:\.[0-9]+)?)/);
    const portionsPerBatch = yieldMatch ? parseFloat(yieldMatch[1]) : 1;
    const safePortions = portionsPerBatch > 0 ? portionsPerBatch : 1;

    // Sell price is per portion; recipe cost is for the whole batch.
    // Compare like with like — convert both to per-portion before computing FC%.
    // null = no price set yet; FC% / GP% can't be calculated without one
    const targetPrice = parsePriceOrNull(editSellPrice);
    const costPerPortion = combinedRecipeCost / safePortions;
    const foodCostPercentage = targetPrice !== null ? (costPerPortion / targetPrice) * 100 : null;
    const grossProfitPercentage = targetPrice !== null ? ((targetPrice - costPerPortion) / targetPrice) * 100 : null;

    return {
      ingredientsList: items,
      totalCost: combinedRecipeCost,
      costPerPortion: costPerPortion,
      portionsPerBatch: safePortions,
      sellPrice: targetPrice,
      fcPercent: foodCostPercentage,
      gpPercent: grossProfitPercentage,
      category: activeRecipeRows[0]?.category || "Main Course",
      yieldSize: yieldText
    };
  }, [activeRecipeRows, localInvoiceLines, editSellPrice]);

  // Handle saving the retail adjustments to the core data row targets
    const handleUpdatePrice = async (e) => {
    e.preventDefault();
    if (!supabaseClient || activeRecipeRows.length === 0) return;

    // Blank = clear the price (stored as NULL). Otherwise it must be a positive number.
    const priceText = String(editSellPrice ?? '').trim();
    const newPrice = priceText === '' ? null : parsePriceOrNull(priceText);
    if (priceText !== '' && newPrice === null) {
      setErrorMessage("Enter a sell price above 0, or leave it blank to mark it as not set.");
      return;
    }

    setUpdating(true);
    setErrorMessage("");

    try {
      const rowIdsToUpdate = activeRecipeRows.map(r => r.id);
      
      const { data: updatedRows, error } = await supabaseClient
        .from('recipes')
        .update({
          sell_price: newPrice,
          last_edited_by: user?.id || null,
          last_edited_by_email: user?.email || null,
          last_edited_at: new Date().toISOString()
        })
        .in('id', rowIdsToUpdate)
        .select('id');

      if (error) throw error;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error("The price wasn't saved: 0 rows were updated. A Row-Level-Security UPDATE policy on 'recipes' is probably blocking this account.");
      }

      window.dispatchEvent(new Event('mise-db-update'));
      fetchRecipesAndInvoices();
    } catch (err) {
      console.error(err);
      setErrorMessage(err?.message || "Could not save the sell price.");
    } finally {
      setUpdating(false);
    }
  };

  const paletteColors = {
    paper: '#efe6d3',
    inkRule: '#1a1a18',
    inkFade: '#5a4f40',
    accent: '#b8730a',
    red: '#b8362a',
    green: '#4a6b3a',
    blue: '#2c5a82'
  };

  return (
    <div style={{ color: '#0e0e0c', fontFamily: 'sans-serif' }}>
      <div style={{ borderBottom: `1px solid ${paletteColors.inkRule}`, paddingBottom: 14, marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, margin: 0, fontFamily: "serif", fontWeight: '800' }}>Recipes & Costs</h2>
        <p style={{ margin: '4px 0 0 0', color: paletteColors.inkFade, fontSize: 13 }}>
          Automated Cross-tab Analysis: Digitized recipe cards matched automatically against your invoice inventory ledgers.
        </p>
      </div>

      {errorMessage && (
        <div style={{ background: paletteColors.red, color: '#fff', padding: 10, borderRadius: 4, marginBottom: 14, fontSize: 12 }}>
          ⚠️ Error: {errorMessage}
        </div>
      )}

      {/* Selector Dropdown Matrix */}
      <div style={{ background: paletteColors.paper, border: `1px solid ${paletteColors.inkRule}`, borderRadius: 4, padding: 12, marginBottom: 20, display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 8 : 16 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#3a3530', minWidth: isMobile ? 'auto' : '130px' }}>Active Menu Card:</label>
        <select 
          value={selectedRecipeName} 
          onChange={(e) => setSelectedRecipeName(e.target.value)}
          style={{ padding: '8px 12px', background: '#000', color: '#fff', border: '1px solid #333', borderRadius: 4, fontSize: 13, flex: 1, width: isMobile ? '100%' : 'auto', boxSizing: 'border-box', fontFamily: 'monospace' }}
        >
          {uniqueRecipeNames.length === 0 ? (
            <option>No Active Recipes Inside Registry</option>
          ) : (
            uniqueRecipeNames.map((name, idx) => (
              <option key={idx} value={name}>{name}</option>
            ))
          )}
        </select>
      </div>

      {uniqueRecipeNames.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 0.8fr', gap: 20, alignItems: 'start' }}>
          
          {/* Left panel breakdown lines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#121210', border: `1px solid ${paletteColors.inkRule}`, borderRadius: 4, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: paletteColors.accent, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 12 }}>
                Relational Material Costing Allocations
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {evaluatedCostingData.ingredientsList.map((item, idx) => (
                  <div key={idx} style={{ background: '#1c1c1a', borderLeft: `3px solid ${item.isMatched ? paletteColors.green : paletteColors.red}`, padding: 10, borderRadius: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: '#fff', fontSize: 13, fontWeight: '600', fontFamily: 'monospace', wordBreak: 'break-word' }}>{item.rawText}</div>
                      <div style={{ fontSize: 11, color: item.isMatched ? paletteColors.green : '#9a8f80', marginTop: 3, wordBreak: 'break-word' }}>
                        🔗 Linked Invoice Item: <span style={{ fontWeight: 600 }}>{item.matchedName}</span>
                        {item.isMatched && <span style={{ color: paletteColors.inkFade }}> · {currencySymbol}{item.unitCost.toFixed(2)}/unit</span>}
                      </div>
                      {item.costNote && (
                        <div style={{ fontSize: 10, color: paletteColors.accent, marginTop: 2 }}>⚠ {item.costNote}</div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: 'monospace', flexShrink: 0 }}>
                      <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{currencySymbol}{item.totalItemCost.toFixed(2)}</div>
                      <div style={{ fontSize: 10, color: paletteColors.inkFade }}>Computed Subtotal</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Adjustments Widget Form */}
            <form onSubmit={handleUpdatePrice} style={{ background: paletteColors.paper, border: `1px solid ${paletteColors.inkRule}`, borderRadius: 4, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#3a3530', textTransform: 'uppercase', marginBottom: 10 }}>
                Adjust Recipe Retail Base
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
                  <span style={{ position: 'absolute', left: 10, top: 10, fontSize: 13, color: '#aaa' }}>{currencySymbol}</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={editSellPrice} 
                    placeholder="Not set"
                    onChange={(e) => setEditSellPrice(e.target.value)} 
                    style={{ width: '100%', boxSizing: 'border-box', background: '#000', color: '#fff', border: '1px solid #333', padding: '8px 8px 8px 24px', borderRadius: 4, fontSize: 13, fontFamily: 'monospace' }} 
                  />
                </div>
                <button type="submit" disabled={updating} style={{ background: paletteColors.accent, color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flex: '0 0 auto' }}>
                  {updating ? "RE-INDEXING..." : "Save Selling Price"}
                </button>
              </div>
            </form>
          </div>

          {/* Right Panel Card Scoreboards */}
          <div style={{ background: paletteColors.paper, border: `1px solid ${paletteColors.inkRule}`, borderRadius: 4, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: paletteColors.inkFade, textTransform: 'uppercase' }}>Classification Segment</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0e0e0c', marginTop: 2 }}>{evaluatedCostingData.category}</div>
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: paletteColors.inkFade, textTransform: 'uppercase' }}>Batch Yield Parameters</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0e0e0c', marginTop: 2 }}>{evaluatedCostingData.yieldSize}</div>
            </div>

            <hr style={{ border: 'none', borderTop: `1px dashed ${paletteColors.inkRule}`, margin: 0 }} />

            <div style={{ background: '#121210', padding: 14, borderRadius: 4, border: `1px solid ${paletteColors.inkRule}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: paletteColors.inkFade, textTransform: 'uppercase' }}>Total Recipe Cost Accumulator</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', fontFamily: 'monospace', marginTop: 4 }}>
                {currencySymbol}{evaluatedCostingData.totalCost.toFixed(2)}
              </div>
              <div style={{ fontSize: 10, color: paletteColors.inkFade, marginTop: 4 }}>
                Whole batch ({evaluatedCostingData.portionsPerBatch} {evaluatedCostingData.portionsPerBatch === 1 ? 'portion' : 'portions'})
              </div>
            </div>

            <div style={{ background: '#121210', padding: 14, borderRadius: 4, border: `1px solid ${paletteColors.inkRule}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: paletteColors.inkFade, textTransform: 'uppercase' }}>Cost Per Portion</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', fontFamily: 'monospace', marginTop: 4 }}>
                {currencySymbol}{evaluatedCostingData.costPerPortion.toFixed(2)}
              </div>
            </div>

            <div style={{ background: '#121210', padding: 14, borderRadius: 4, border: `1px solid ${paletteColors.inkRule}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: paletteColors.inkFade, textTransform: 'uppercase' }}>Configured Target Sell Price</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: paletteColors.accent, fontFamily: 'monospace', marginTop: 4 }}>
                {evaluatedCostingData.sellPrice !== null
                  ? `${currencySymbol}${evaluatedCostingData.sellPrice.toFixed(2)}`
                  : <span style={{ color: paletteColors.red }}>Not set</span>}
              </div>
              <div style={{ fontSize: 10, color: paletteColors.inkFade, marginTop: 4 }}>
                {evaluatedCostingData.sellPrice !== null ? 'Per portion' : 'Add a sell price above to see FC% and GP%'}
              </div>
              {formatEditedBy(activeRecipeRows[0]?.last_edited_by_email, activeRecipeRows[0]?.last_edited_at) && (
                <div style={{ fontSize: 10, color: paletteColors.inkFade, marginTop: 6 }}>
                  {formatEditedBy(activeRecipeRows[0]?.last_edited_by_email, activeRecipeRows[0]?.last_edited_at)}
                </div>
              )}
            </div>

            <div style={{ background: '#121210', padding: 14, borderRadius: 4, border: `1px solid ${paletteColors.inkRule}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: paletteColors.inkFade, textTransform: 'uppercase' }}>Food Cost Percentage (FC%)</span>
                {evaluatedCostingData.fcPercent !== null && (
                  <span style={{ fontSize: 10, background: evaluatedCostingData.fcPercent > 35 ? paletteColors.red : paletteColors.green, color: '#fff', padding: '2px 6px', borderRadius: 3, fontWeight: 800 }}>
                    {evaluatedCostingData.fcPercent > 35 ? "CRITICAL RISK" : "ALIGNED"}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: evaluatedCostingData.fcPercent === null ? paletteColors.inkFade : evaluatedCostingData.fcPercent > 35 ? paletteColors.red : paletteColors.green, fontFamily: 'monospace', marginTop: 4 }}>
                {evaluatedCostingData.fcPercent !== null ? `${evaluatedCostingData.fcPercent.toFixed(1)}%` : '—'}
              </div>
            </div>

            <div style={{ background: '#121210', padding: 14, borderRadius: 4, border: `1px solid ${paletteColors.inkRule}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: paletteColors.inkFade, textTransform: 'uppercase' }}>Gross Operating Profit Margin (GP%)</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: evaluatedCostingData.gpPercent === null ? paletteColors.inkFade : evaluatedCostingData.gpPercent < 65 ? paletteColors.red : paletteColors.blue, fontFamily: 'monospace', marginTop: 4 }}>
                {evaluatedCostingData.gpPercent !== null ? `${evaluatedCostingData.gpPercent.toFixed(1)}%` : '—'}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}

function RecipeDetail({ recipe, components, settings, onClose, onUpdateRecipes, recipes }) {
  const { foodCost, profit, gp } = recipeCosting(recipe, components);
  const [addingIng, setAddingIng] = useState(false);
  const [ingKind, setIngKind] = useState('raw');
  const [rawName, setRawName] = useState('');
  const [rawQty, setRawQty] = useState('');
  const [rawUnit, setRawUnit] = useState('kg');
  const [rawCost, setRawCost] = useState('');
  const [rawSupplier, setRawSupplier] = useState('Dry Goods');
  const [selectedCompId, setSelectedCompId] = useState('');
  const [compQty, setCompQty] = useState('');
  const [compUnit, setCompUnit] = useState('L');

  const addIngredient = () => {
    let newItem = {};
    if (ingKind === 'raw') {
      if(!rawName || !rawQty || !rawCost) return;
      newItem = { kind: 'raw', name: rawName, qty: parseFloat(rawQty), unit: rawUnit, cost: parseFloat(rawCost), supplier: rawSupplier };
    } else {
      if(!selectedCompId || !compQty) return;
      const targetComp = components.find(c => c.id === selectedCompId);
      newItem = { kind: 'comp', componentId: selectedCompId, qty: parseFloat(compQty), unit: compUnit || targetComp?.batchUnit || 'ea' };
    }

    const updatedIngredients = [...(recipe.ingredients || []), newItem];
    const updatedRecipes = recipes.map(r => r.id === recipe.id ? { ...r, ingredients: updatedIngredients } : r);
    onUpdateRecipes(updatedRecipes);
    
    // Reset state inputs
    setRawName(''); setRawQty(''); setRawCost(''); setSelectedCompId(''); setCompQty('');
    setAddingIng(false);
    // Dynamically patch pointer focus object
    recipe.ingredients = updatedIngredients;
  };

  return (
    <div style={{...S.card, marginTop:30, borderTop:`2px solid ${C.inkRule}`}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
        <h2 style={{fontFamily:"'Bitter', serif", fontSize:22, fontWeight:900}}>Structural Breakdown: {recipe.name}</h2>
        <div style={{display:'flex', gap:10}}>
          <button onClick={() => setAddingIng(!addingIng)} style={S.btnAccent}>{addingIng ? "Cancel Element" : "+ Add Structural Element"}</button>
          <button onClick={onClose} style={S.btn}>Collapse View</button>
        </div>
      </div>

      {addingIng && (
        <div style={{background:C.paper2, padding:16, marginBottom:20, border:`1px solid ${C.inkRule}`}}>
          <div style={{display:'flex', gap:16, marginBottom:12}}>
            <label><input type="radio" checked={ingKind === 'raw'} onChange={() => setIngKind('raw')} /> Commodity Stock</label>
            <label><input type="radio" checked={ingKind === 'comp'} onChange={() => setIngKind('comp')} /> Processed Component Batch</label>
          </div>
          {ingKind === 'raw' ? (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10, alignItems:'end'}}>
              <FormField label="Element Name" val={rawName} onChange={setRawName} />
              <FormField label="Quantity Weight" val={rawQty} onChange={setRawQty} type="number" />
              <div>
                <label style={{fontSize:11, fontWeight:700, display:'block', marginBottom:4}}>Unit</label>
                <select value={rawUnit} onChange={e=>setRawUnit(e.target.value)} style={S.input}>
                  {getUnits(settings.unitSystem).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <FormField label="Base Vol Cost" val={rawCost} onChange={setRawCost} type="number" />
              <FormField label="Wholesaler Vendor" val={rawSupplier} onChange={setRawSupplier} />
            </div>
          ) : (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:10, alignItems:'end'}}>
              <div>
                <label style={{fontSize:11, fontWeight:700, display:'block', marginBottom:4}}>Select Target Batch</label>
                <select value={selectedCompId} onChange={e=>{
                  setSelectedCompId(e.target.value);
                  const matched = components.find(c => c.id === e.target.value);
                  if(matched) setCompUnit(matched.batchUnit);
                }} style={S.input}>
                  <option value="">-- Choose Blueprint --</option>
                  {components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <FormField label="Yield Qty Demanded" val={compQty} onChange={setCompQty} type="number" />
              <FormField label="Unit Context" val={compUnit} onChange={setCompUnit} disabled />
            </div>
          )}
          <button onClick={addIngredient} style={{...S.btnAccent, marginTop:14}}>Inject Into Recipe Matrix</button>
        </div>
      )}

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16, marginBottom:24, background:C.paper2, padding:16}}>
        <div>
          <div style={{fontSize:11, color:C.inkFade}}>Menu Sell Price</div>
          <div style={{fontSize:20, fontFamily:"'JetBrains Mono', monospace", fontWeight:700}}>{settings.currency}{(recipe.sellPrice || 0).toFixed(2)}</div>
        </div>
        <div>
          <div style={{fontSize:11, color:C.inkFade}}>Calculated Food Cost</div>
          <div style={{fontSize:20, fontFamily:"'JetBrains Mono', monospace", fontWeight:700}}>{settings.currency}{foodCost.toFixed(2)}</div>
        </div>
        <div>
          <div style={{fontSize:11, color:C.inkFade}}>Gross Profit Contribution</div>
          <div style={{fontSize:20, fontFamily:"'JetBrains Mono', monospace", fontWeight:700}}>{settings.currency}{profit.toFixed(2)}</div>
        </div>
        <div>
          <div style={{fontSize:11, color:C.inkFade}}>Target Efficiency (GP)</div>
          <div style={{fontSize:20, fontFamily:"'JetBrains Mono', monospace", fontWeight:700, color: gp >= 70 ? C.green : C.red}}>{gp.toFixed(1)}%</div>
        </div>
      </div>
      
      <table style={{width:'100%', borderCollapse:'collapse', textAlign:'left'}}>
        <thead>
          <tr style={{borderBottom:`1px solid ${C.inkRule}`}}>
            <th style={{padding:8}}><SectionLabel label="Ingredient / Part" /></th>
            <th style={{padding:8}}><SectionLabel label="Type" /></th>
            <th style={{padding:8}}><SectionLabel label="Extension Qty" /></th>
            <th style={{padding:8}}><SectionLabel label="Unit Cost" /></th>
            <th style={{padding:8}}><SectionLabel label="Yield Cost" /></th>
          </tr>
        </thead>
        <tbody>
          {(recipe.ingredients || []).map((ing, i) => (
            <RecipeLineRow key={i} ing={ing} components={components} settings={settings} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecipeLineRow({ ing, components, settings }) {
  const data = useMemo(() => {
    let name = ing.name, type = "Raw Commodity", unitCost = ing.cost || 0, computed = (ing.qty || 0) * unitCost;
    if (ing.kind === 'comp') {
      const target = components.find(c => c.id === ing.componentId);
      name = target ? target.name : "Unknown Component";
      type = "Batch Component";
      unitCost = componentCostPerUnit(target);
      computed = (ing.qty || 0) * unitCost;
    }
    return { name, type, unitCost, computed };
  }, [ing, components]);

  return (
    <tr style={{borderBottom:`1px solid ${C.paper2}`}}>
      <td style={{padding:10, fontWeight:700}}>{data.name}</td>
      <td style={{padding:10, fontSize:12, color:C.inkFade}}>{data.type}</td>
      <td style={{padding:10, fontFamily:"'JetBrains Mono', monospace"}}>{ing.qty} {ing.unit}</td>
      <td style={{padding:10, fontFamily:"'JetBrains Mono', monospace"}}>{settings.currency}{data.unitCost.toFixed(2)}</td>
      <td style={{padding:10, fontFamily:"'JetBrains Mono', monospace", fontWeight:700}}>{settings.currency}{data.computed.toFixed(2)}</td>
    </tr>
  );
}

function ComponentsPanel({ components, settings }) {
  return (
    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(340px, 1fr))', gap:20}}>
      {components.map(c => {
        const costPerUnit = componentCostPerUnit(c);
        const totalBatchCost = costPerUnit * c.batchYield;
        return (
          <div key={c.id} style={S.card}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:10}}>
              <div>
                <span style={{fontSize:9, fontFamily:"'JetBrains Mono', monospace", background:C.ink, color:C.paper, padding:"2px 6px"}}>{c.station}</span>
                <h3 style={{fontFamily:"'Bitter', serif", fontSize:18, fontWeight:900, margin:'6px 0 0 0'}}>{c.name}</h3>
              </div>
            </div>
            <div style={{fontSize:12, color:C.inkFade, marginBottom:12}}>Roster Stability: <span style={{fontWeight:700, color:C.ink}}>{c.holdLife}</span></div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, borderTop:`1px dashed ${C.paper2}`, paddingTop:10}}>
              <div>
                <div style={{fontSize:11, color:C.inkFade}}>Batch Cost ({c.batchYield}{c.batchUnit})</div>
                <div style={{fontFamily:"'JetBrains Mono', monospace", fontWeight:700}}>{settings.currency}{totalBatchCost.toFixed(2)}</div>
              </div>
              <div>
                <div style={{fontSize:11, color:C.inkFade}}>Cost Per {c.batchUnit}</div>
                <div style={{fontFamily:"'JetBrains Mono', monospace", fontWeight:700, color:C.accent}}>{settings.currency}{costPerUnit.toFixed(2)}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// RESILIENT SUPABASE WRITES
// PostgREST's schema cache often lags behind a fresh migration — it can take
// seconds to minutes for newly-added columns to become available even though
// they exist in the database. Rather than fail the user's save, these helpers
// retry the operation, dropping any column PostgREST complains about, until
// it succeeds or the payload is empty.
// ════════════════════════════════════════════════════════════════════════════
const COLUMN_NOT_FOUND_REGEX = /Could not find the '([^']+)' column/i;

async function resilientInsert(table, row, { returning = true, max = 6 } = {}) {
  let payload = { ...row };
  let lastError = null;
  for (let i = 0; i < max; i++) {
    const query = supabase.from(table).insert([payload]);
    const { data, error } = returning ? await query.select().single() : await query;
    if (!error) return { data, error: null };
    lastError = error;
    const m = (error.message || '').match(COLUMN_NOT_FOUND_REGEX);
    if (m && Object.prototype.hasOwnProperty.call(payload, m[1])) {
      // strip the offending column and try again
      const dropped = m[1];
      const next = { ...payload };
      delete next[dropped];
      payload = next;
      console.warn(`[resilientInsert/${table}] Dropping column "${dropped}" (not in schema cache); retrying.`);
      continue;
    }
    // Non-column error → return immediately
    return { data: null, error };
  }
  return { data: null, error: lastError };
}

async function resilientUpdate(table, updates, matchKey, matchValue, { max = 6 } = {}) {
  let payload = { ...updates };
  let lastError = null;
  for (let i = 0; i < max; i++) {
    const { data, error } = await supabase.from(table).update(payload).eq(matchKey, matchValue);
    if (!error) return { data, error: null };
    lastError = error;
    const m = (error.message || '').match(COLUMN_NOT_FOUND_REGEX);
    if (m && Object.prototype.hasOwnProperty.call(payload, m[1])) {
      const dropped = m[1];
      const next = { ...payload };
      delete next[dropped];
      payload = next;
      console.warn(`[resilientUpdate/${table}] Dropping column "${dropped}" (not in schema cache); retrying.`);
      continue;
    }
    return { data: null, error };
  }
  return { data: null, error: lastError };
}

async function resilientInsertMany(table, rows, { max = 6 } = {}) {
  // Strip columns globally — if any row has a missing column, drop from all rows.
  if (!Array.isArray(rows) || rows.length === 0) return { data: [], error: null };
  let workingRows = rows.map(r => ({ ...r }));
  let lastError = null;
  for (let i = 0; i < max; i++) {
    const { data, error } = await supabase.from(table).insert(workingRows);
    if (!error) return { data, error: null };
    lastError = error;
    const m = (error.message || '').match(COLUMN_NOT_FOUND_REGEX);
    if (m) {
      const dropped = m[1];
      const before = workingRows.length;
      workingRows = workingRows.map(r => {
        const copy = { ...r };
        delete copy[dropped];
        return copy;
      });
      if (workingRows.length === before) {
        console.warn(`[resilientInsertMany/${table}] Dropped column "${dropped}" from ${before} rows; retrying.`);
      }
      continue;
    }
    return { data: null, error };
  }
  return { data: null, error: lastError };
}

// ════════════════════════════════════════════════════════════════════════════
// SUB-RECIPE LIBRARY — manages the components table.
// A "component" is a reusable sub-recipe (e.g. Beef Stock, Béchamel, Curry
// Paste) prepped in batch with its own yield. Dishes reference components
// by ID and consume them by-the-unit; cost flows from raw inputs → component
// cost-per-unit → dish line cost. This screen reads dbComponents (hydrated
// at App level) and writes back via Supabase. The "Used by" column reverse-
// looks up which dishes consume each component.
// ════════════════════════════════════════════════════════════════════════════
function ComponentsScreen({ kitchenId, components = [], recipes = [], settings = {}, tableReady = true, loadError = '', onRetry = null }) {
  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [scanPrefill, setScanPrefill] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const currency = settings?.currency || '£';

  const selected = useMemo(
    () => components.find(c => c.id === selectedId) || null,
    [components, selectedId]
  );

  // Reverse lookup: which dishes consume this component?
  const usedBy = useMemo(() => {
    if (!selected) return [];
    const out = [];
    (recipes || []).forEach(r => {
      const ings = r.ingredients || [];
      const matches = ings.some(i =>
        (i.kind === 'comp' || i.kind === 'sub') &&
        (i.componentId === selected.id ||
         (i.name && i.name.toLowerCase() === (selected.name || '').toLowerCase()))
      );
      if (matches) out.push(r.name);
    });
    return Array.from(new Set(out));
  }, [recipes, selected]);

  const fireDbUpdate = () => window.dispatchEvent(new CustomEvent('mise-db-update'));

  // ---- CREATE ----
  const handleCreate = async (draft) => {
    if (!kitchenId) { alert("No active kitchen."); return; }
    setBusy(true);
    try {
      const { data: parent, error: pErr } = await resilientInsert('components', {
        kitchen_id: kitchenId,
        name: draft.name,
        station: draft.station || 'Sauce',
        batch_yield: parseFloat(draft.batchYield) || 1,
        batch_unit: draft.batchUnit || 'ea',
        hold_life: draft.holdLife || 'Same Day',
        notes: draft.notes || ''
        // Audit columns intentionally left out; if you want them tracked once
        // your schema cache stabilizes, add created_by/last_edited_by here.
      });
      if (pErr) throw pErr;
      if (parent && Array.isArray(draft.ingredients) && draft.ingredients.length > 0) {
        const rows = draft.ingredients
          .filter(i => i.name && i.name.trim())
          .map((i, idx) => ({
            component_id: parent.id,
            kitchen_id: kitchenId, // some schemas require this NOT NULL; strip-on-fail handles cases where the column doesn't exist
            name: i.name.trim(),
            qty: parseFloat(i.qty) || 0,
            unit: i.unit || 'g',
            cost: parseFloat(i.cost) || 0,
            supplier: i.supplier || '',
            position: idx
          }));
        if (rows.length > 0) {
          const { error: iErr } = await resilientInsertMany('component_ingredients', rows);
          if (iErr) throw iErr;
        }
      }
      fireDbUpdate();
      setShowNew(false);
      if (parent?.id) setSelectedId(parent.id);
    } catch (err) {
      const msg = err.message || String(err);
      if (/schema cache|column/i.test(msg)) {
        alert(
          "Could not save: Supabase's schema cache is still catching up.\n\n" +
          "Try one of these:\n" +
          "  1. Wait 30 seconds and try again, OR\n" +
          "  2. In Supabase Dashboard: Settings → API → 'Reload schema'\n\n" +
          "Technical detail: " + msg
        );
      } else {
        alert("Could not save component: " + msg);
      }
    } finally {
      setBusy(false);
    }
  };

  // ---- UPDATE ----
  const handleUpdate = async (draft) => {
    if (!selected) return;
    setBusy(true);
    try {
      const { error: pErr } = await resilientUpdate('components', {
        name: draft.name,
        station: draft.station || 'Sauce',
        batch_yield: parseFloat(draft.batchYield) || 1,
        batch_unit: draft.batchUnit || 'ea',
        hold_life: draft.holdLife || 'Same Day',
        notes: draft.notes || ''
      }, 'id', selected.id);
      if (pErr) throw pErr;

      // Wipe & re-insert ingredients (simple + reliable; volume is low)
      await supabase.from('component_ingredients').delete().eq('component_id', selected.id);
      if (Array.isArray(draft.ingredients) && draft.ingredients.length > 0) {
        const rows = draft.ingredients
          .filter(i => i.name && i.name.trim())
          .map((i, idx) => ({
            component_id: selected.id,
            kitchen_id: kitchenId, // matches the NOT NULL constraint on some schemas
            name: i.name.trim(),
            qty: parseFloat(i.qty) || 0,
            unit: i.unit || 'g',
            cost: parseFloat(i.cost) || 0,
            supplier: i.supplier || '',
            position: idx
          }));
        if (rows.length > 0) {
          const { error: iErr } = await resilientInsertMany('component_ingredients', rows);
          if (iErr) throw iErr;
        }
      }
      fireDbUpdate();
      setShowEdit(false);
    } catch (err) {
      alert("Could not update component: " + (err.message || err));
    } finally {
      setBusy(false);
    }
  };

  // ---- DELETE ----
  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete sub-recipe "${selected.name}"? This cannot be undone.`)) return;
    if (usedBy.length > 0) {
      if (!window.confirm(`This component is used by ${usedBy.length} dish(es): ${usedBy.join(', ')}. Delete anyway?`)) return;
    }
    setBusy(true);
    try {
      // ON DELETE CASCADE handles component_ingredients automatically
      const { error } = await supabase.from('components').delete().eq('id', selected.id);
      if (error) throw error;
      fireDbUpdate();
      setSelectedId(null);
    } catch (err) {
      alert("Could not delete: " + (err.message || err));
    } finally {
      setBusy(false);
    }
  };

  // ---- TABLE NOT READY GUIDANCE ----
  if (!tableReady) {
    return (
      <div style={S.container}>
        <ScreenHeader title="Sub-Recipe Library" sub="Reusable component blueprints with cost rollup into dish recipes" />
        <div style={{ ...S.card, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <h3 style={{ fontFamily: "'Bitter', serif", fontSize: 18, marginBottom: 10 }}>Sub-Recipe tables not detected</h3>
          <p style={{ fontSize: 13, color: C.inkFade, marginBottom: 14, lineHeight: 1.6 }}>
            If you've just run <code style={{ background: C.paper2, padding: '2px 6px', borderRadius: 3 }}>05_components_migration.sql</code>, Supabase's schema cache may still be refreshing — give it a few seconds and tap Retry.
          </p>
          <p style={{ fontSize: 12, color: C.inkFade, marginBottom: 18 }}>
            Otherwise, run the migration in your Supabase SQL editor, then come back here and tap Retry.
          </p>
          <button onClick={onRetry} style={S.btnAccent}>↻ Retry Connection</button>
          {loadError && (
            <div style={{ marginTop: 18, padding: 10, background: '#3a1414', color: '#fcd9c9', fontSize: 11, borderRadius: 4, fontFamily: "'JetBrains Mono', monospace" }}>
              Last error: {loadError}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      <ScreenHeader title="Sub-Recipe Library" sub="Reusable component blueprints — cost flows into dish recipes automatically" />

      {loadError && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#5c1d1d', color: '#fff', padding: '10px 14px', borderRadius: 4, marginBottom: 12, fontSize: 12 }}>
          <span>⚠ {loadError}</span>
          {onRetry && <button onClick={onRetry} style={{ ...S.btn, color: '#fff', borderColor: '#fff', background: 'transparent' }}>Retry</button>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 12, color: C.inkFade }}>
          <strong style={{ color: C.ink, fontFamily: "'JetBrains Mono', monospace" }}>{components.length}</strong> component{components.length === 1 ? '' : 's'} in library
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setShowScan(true)} style={{ ...S.btn, background: C.paper2 }}>📷 Scan Sub-Recipe</button>
          <button onClick={() => setShowNew(true)} style={S.btnAccent}>+ New Sub-Recipe</button>
        </div>
      </div>

      {components.length === 0 ? (
        <div style={{ ...S.card, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🍲</div>
          <h3 style={{ fontFamily: "'Bitter', serif", fontSize: 18, marginBottom: 8 }}>No sub-recipes yet</h3>
          <p style={{ fontSize: 13, color: C.inkFade, marginBottom: 14 }}>
            Build reusable components like Beef Stock, Béchamel, or Curry Paste once — then reference them across multiple dishes. Cost rolls up automatically.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setShowScan(true)} style={S.btn}>📷 Scan from cookbook</button>
            <button onClick={() => setShowNew(true)} style={S.btnAccent}>+ Create manually</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {components.map(c => {
            const cpu = componentCostPerUnit(c);
            const batchCost = cpu * (parseFloat(c.batchYield) || 0);
            const isSelected = c.id === selectedId;
            return (
              <div
                key={c.id}
                onClick={() => setSelectedId(isSelected ? null : c.id)}
                style={{
                  ...S.card,
                  cursor: 'pointer',
                  borderColor: isSelected ? C.accent : (S.card.border ? S.card.border.split(' ').pop() : C.inkRule),
                  borderWidth: isSelected ? 2 : 1,
                  padding: 16,
                  transition: 'border-color 0.15s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                  <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", background: C.ink, color: C.paper, padding: '2px 6px', letterSpacing: 0.5 }}>
                    {c.station || 'Sauce'}
                  </span>
                  <span style={{ fontSize: 10, color: C.inkFade }}>{c.holdLife || 'Same Day'}</span>
                </div>
                <h3 style={{ fontFamily: "'Bitter', serif", fontSize: 17, fontWeight: 900, margin: '4px 0 12px 0' }}>{c.name}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, borderTop: `1px dashed ${C.paper2}`, paddingTop: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.inkFade, textTransform: 'uppercase', letterSpacing: 0.5 }}>Batch Yield</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14 }}>
                      {c.batchYield}{c.batchUnit}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.inkFade, textTransform: 'uppercase', letterSpacing: 0.5 }}>Per {c.batchUnit}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14, color: C.accent }}>
                      {currency}{cpu.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: C.inkFade }}>
                  Batch total: <strong style={{ color: C.ink, fontFamily: "'JetBrains Mono', monospace" }}>{currency}{batchCost.toFixed(2)}</strong> · {(c.ingredients || []).length} ingredient{(c.ingredients || []).length === 1 ? '' : 's'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail panel — shows when a card is clicked */}
      {selected && (
        <div style={{ ...S.card, marginTop: 18, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: C.accent, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>Selected Component</div>
              <h2 style={{ fontFamily: "'Bitter', serif", fontSize: 22, margin: '4px 0' }}>{selected.name}</h2>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowEdit(true)} disabled={busy} style={S.btn}>✎ Edit</button>
              <button onClick={handleDelete} disabled={busy} style={{ ...S.btn, color: '#a13e2a', borderColor: '#a13e2a' }}>🗑 Delete</button>
              <button onClick={() => setSelectedId(null)} style={{ ...S.btn, color: C.inkFade }}>Close</button>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <SectionLabel label="Recipe Composition" />
            {(selected.ingredients || []).length === 0 ? (
              <p style={{ fontSize: 12, color: C.inkFade, fontStyle: 'italic', margin: '6px 0' }}>No ingredients defined yet. Click Edit to add them.</p>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.inkRule}`, textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px' }}>Ingredient</th>
                      <th style={{ padding: '6px 8px' }}>Qty</th>
                      <th style={{ padding: '6px 8px' }}>Unit</th>
                      <th style={{ padding: '6px 8px' }}>{currency}/Unit</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.ingredients || []).map((i, idx) => {
                      const line = (parseFloat(i.qty) || 0) * (parseFloat(i.cost) || 0);
                      return (
                        <tr key={idx} style={{ borderBottom: `1px solid ${C.paper2}` }}>
                          <td style={{ padding: '6px 8px' }}>{i.name}</td>
                          <td style={{ padding: '6px 8px', fontFamily: "'JetBrains Mono', monospace" }}>{i.qty}</td>
                          <td style={{ padding: '6px 8px' }}>{i.unit}</td>
                          <td style={{ padding: '6px 8px', fontFamily: "'JetBrains Mono', monospace" }}>{currency}{(parseFloat(i.cost) || 0).toFixed(2)}</td>
                          <td style={{ padding: '6px 8px', fontFamily: "'JetBrains Mono', monospace", textAlign: 'right' }}>{currency}{line.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, borderTop: `1px dashed ${C.paper2}`, paddingTop: 12 }}>
            <KPI label="Batch Cost" value={`${currency}${(componentCostPerUnit(selected) * (parseFloat(selected.batchYield) || 0)).toFixed(2)}`} />
            <KPI label={`Cost per ${selected.batchUnit}`} value={`${currency}${componentCostPerUnit(selected).toFixed(2)}`} />
            <KPI label="Used By" value={`${usedBy.length} dish${usedBy.length === 1 ? '' : 'es'}`} />
          </div>

          {usedBy.length > 0 && (
            <div style={{ marginTop: 14, borderTop: `1px dashed ${C.paper2}`, paddingTop: 12 }}>
              <SectionLabel label="Consumed By" />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {usedBy.map(dish => (
                  <span key={dish} style={{ fontSize: 11, padding: '3px 8px', background: C.paper2, borderRadius: 12, fontWeight: 600 }}>{dish}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showNew && (
        <ComponentEditorModal
          title={scanPrefill ? "Review Scanned Sub-Recipe" : "+ New Sub-Recipe"}
          settings={settings}
          initial={scanPrefill}
          onClose={() => { setShowNew(false); setScanPrefill(null); }}
          onSave={async (draft) => { await handleCreate(draft); setScanPrefill(null); }}
          busy={busy}
        />
      )}
      {showEdit && selected && (
        <ComponentEditorModal
          title={`Edit "${selected.name}"`}
          settings={settings}
          initial={selected}
          onClose={() => setShowEdit(false)}
          onSave={handleUpdate}
          busy={busy}
        />
      )}
      {showScan && (
        <ScanSubRecipeModal
          settings={settings}
          onClose={() => setShowScan(false)}
          onScanComplete={(parsed) => {
            // Scanner finished → close the scanner, open the editor pre-filled
            // with parsed data so the user can review/adjust before saving.
            setShowScan(false);
            // Stash parsed data into a temporary "initial" then open the new
            // modal in scan-prefill mode by piggybacking on showNew.
            setScanPrefill(parsed);
            setShowNew(true);
          }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Small KPI tile used inside the component detail panel
// ────────────────────────────────────────────────────────────────────────────
function KPI({ label, value }) {
  return (
    <div style={{ padding: '10px 12px', background: C.paper2, borderRadius: 4 }}>
      <div style={{ fontSize: 10, color: C.inkFade, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 16, marginTop: 4 }}>{value}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Modal for creating & editing a component blueprint + its ingredient list
// ────────────────────────────────────────────────────────────────────────────
function ComponentEditorModal({ title, settings, initial, onClose, onSave, busy }) {
  const currency = settings?.currency || '£';
  const unitOptions = (settings?.unitSystem === 'imperial')
    ? ['lb', 'oz', 'pt', 'fl oz', 'ea']
    : (settings?.unitSystem === 'us')
    ? ['lb', 'oz', 'qt', 'fl oz', 'ea']
    : ['kg', 'g', 'L', 'ml', 'ea'];

  const [name, setName] = useState(initial?.name || '');
  const [station, setStation] = useState(initial?.station || 'Sauce');
  const [batchYield, setBatchYield] = useState(initial?.batchYield ?? 1);
  const [batchUnit, setBatchUnit] = useState(initial?.batchUnit || 'L');
  const [holdLife, setHoldLife] = useState(initial?.holdLife || 'Same Day');
  const [ingredients, setIngredients] = useState(
    initial?.ingredients?.length
      ? initial.ingredients.map(i => ({ ...i }))
      : [{ name: '', qty: '', unit: 'g', cost: '' }]
  );

  const addRow = () => setIngredients(prev => [...prev, { name: '', qty: '', unit: 'g', cost: '' }]);
  const removeRow = (idx) => setIngredients(prev => prev.filter((_, i) => i !== idx));
  const updateRow = (idx, key, val) => {
    setIngredients(prev => prev.map((row, i) => i === idx ? { ...row, [key]: val } : row));
  };

  const previewCost = useMemo(() => {
    const total = ingredients.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.cost) || 0), 0);
    const y = parseFloat(batchYield) || 1;
    return { batchCost: total, perUnit: total / y };
  }, [ingredients, batchYield]);

  const submit = () => {
    if (!name.trim()) { alert("Component name is required."); return; }
    onSave({
      name: name.trim(),
      station,
      batchYield,
      batchUnit,
      holdLife,
      ingredients
    });
  };

  return (
    <div style={S.modalOverlay}>
      <div style={{ ...S.modal, maxWidth: 720, width: '94%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontFamily: "'Bitter', serif", marginBottom: 14, fontSize: 22 }}>{title}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 12 }}>
          <FormField label="Name" val={name} onChange={setName} />
          <FormField label="Station" val={station} onChange={setStation} />
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Hold Life</label>
            <select value={holdLife} onChange={e => setHoldLife(e.target.value)} style={S.input}>
              <option>Same Day</option>
              <option>2 Days</option>
              <option>3 Days</option>
              <option>1 Week</option>
              <option>2 Weeks</option>
              <option>1 Month</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 2 }}>
            <FormField label="Batch Yield" val={batchYield} onChange={setBatchYield} type="number" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Batch Unit</label>
            <select value={batchUnit} onChange={e => setBatchUnit(e.target.value)} style={S.input}>
              {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div style={{ borderTop: `1px dashed ${C.paper2}`, paddingTop: 12, marginBottom: 10 }}>
          <SectionLabel label="Ingredients (raw inputs to this batch)" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {ingredients.map((row, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 70px 80px 90px auto', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Ingredient name"
                value={row.name}
                onChange={e => updateRow(idx, 'name', e.target.value)}
                style={{ ...S.input, padding: '6px 8px', fontSize: 12 }}
              />
              <input
                type="number"
                placeholder="Qty"
                value={row.qty}
                onChange={e => updateRow(idx, 'qty', e.target.value)}
                style={{ ...S.input, padding: '6px 8px', fontSize: 12 }}
              />
              <select
                value={row.unit}
                onChange={e => updateRow(idx, 'unit', e.target.value)}
                style={{ ...S.input, padding: '6px 8px', fontSize: 12 }}
              >
                {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <input
                type="number"
                step="0.01"
                placeholder={`${currency}/unit`}
                value={row.cost}
                onChange={e => updateRow(idx, 'cost', e.target.value)}
                style={{ ...S.input, padding: '6px 8px', fontSize: 12 }}
              />
              <button
                onClick={() => removeRow(idx)}
                disabled={ingredients.length === 1}
                style={{ background: 'transparent', border: 'none', color: ingredients.length === 1 ? C.inkFade : '#a13e2a', cursor: ingredients.length === 1 ? 'not-allowed' : 'pointer', fontSize: 16, padding: '0 4px' }}
                title="Remove this row"
              >×</button>
            </div>
          ))}
          <button onClick={addRow} style={{ ...S.btn, marginTop: 4, fontSize: 12 }}>+ Add ingredient row</button>
        </div>

        <div style={{ background: C.paper2, padding: '10px 14px', borderRadius: 4, marginBottom: 14, fontSize: 12 }}>
          <strong>Live cost preview:</strong> Batch total {currency}{previewCost.batchCost.toFixed(2)} · Per {batchUnit} <span style={{ color: C.accent, fontWeight: 700 }}>{currency}{previewCost.perUnit.toFixed(2)}</span>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={busy} style={S.btn}>Cancel</button>
          <button onClick={submit} disabled={busy} style={S.btnAccent}>{busy ? 'Saving…' : 'Save Component'}</button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SCAN SUB-RECIPE MODAL — photographs a sub-recipe from a cookbook / handwritten
// card, runs OCR via the existing `parse-recipe` edge function, then hands the
// parsed payload off to the ComponentEditorModal for review and save.
// ────────────────────────────────────────────────────────────────────────────
function ScanSubRecipeModal({ settings, onClose, onScanComplete }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);
  };

  const runOcr = async () => {
    if (!file) {
      setError("Please attach or take a photo first.");
      return;
    }
    setParsing(true);
    setError('');
    try {
      // Convert image → base64 (mirrors the Recipe Digitizer pipeline)
      const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const fileExt = (file.name || 'jpg').split('.').pop();

      // Reuse the same edge function as the main Recipe Digitizer — the OCR
      // output is structurally identical (name + ingredients), we just route
      // it to the components table afterwards.
      const { data: result, error: fnErr } = await supabase.functions
        .invoke('parse-recipe', {
          body: { image: base64, fileType: fileExt, currentRecipes: [] }
        });
      if (fnErr) throw fnErr;
      const parsed = result?.recipe || result?.data || result;
      if (!parsed) throw new Error("Empty response from the OCR engine.");

      // Map parsed output → component draft shape
      const name = parsed.recipe_name || parsed.name || parsed.title || 'Untitled sub-recipe';
      const yieldRaw = parsed.yield || parsed.yields || parsed.portions || '1';
      // Try to extract numeric yield and unit (e.g. "5 L", "2 kg", "10 portions")
      const yieldMatch = String(yieldRaw).match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/);
      const batchYield = yieldMatch ? parseFloat(yieldMatch[1]) : 1;
      const detectedUnit = yieldMatch?.[2]?.toLowerCase() || '';
      const unitMap = {
        l: 'L', ltr: 'L', liter: 'L', litre: 'L', liters: 'L', litres: 'L',
        kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
        g: 'g', gram: 'g', grams: 'g',
        ml: 'ml', milliliter: 'ml', millilitre: 'ml',
        ea: 'ea', each: 'ea', piece: 'ea', pieces: 'ea',
        portion: 'ea', portions: 'ea', serving: 'ea', servings: 'ea'
      };
      const batchUnit = unitMap[detectedUnit] || 'L';

      // Normalize ingredients — may come back as strings or objects
      const rawIngs = parsed.ingredients || parsed.line_items || parsed.items || [];
      const ingredients = rawIngs.map(ing => {
        if (typeof ing === 'string') {
          // Try to parse "100g flour" or "2 tbsp butter"
          const m = ing.match(/^([\d.]+)\s*([a-zA-Z]+)?\s+(.+)$/);
          if (m) {
            return {
              name: m[3].trim(),
              qty: parseFloat(m[1]) || 0,
              unit: unitMap[m[2]?.toLowerCase()] || m[2] || 'g',
              cost: 0
            };
          }
          return { name: ing, qty: 0, unit: 'g', cost: 0 };
        }
        return {
          name: ing.name || ing.ingredient || ing.item || '',
          qty: parseFloat(ing.qty || ing.quantity || ing.amount) || 0,
          unit: ing.unit || ing.uom || 'g',
          cost: parseFloat(ing.cost || ing.price || 0) || 0
        };
      }).filter(i => i.name);

      onScanComplete({
        name,
        station: 'Sauce',
        batchYield,
        batchUnit,
        holdLife: 'Same Day',
        ingredients: ingredients.length > 0 ? ingredients : [{ name: '', qty: '', unit: 'g', cost: '' }]
      });
    } catch (err) {
      console.error("Scan sub-recipe OCR failed:", err);
      setError(
        (err.message || 'OCR failed.') +
        " — make sure the 'parse-recipe' edge function is deployed. You can still create the sub-recipe manually."
      );
    } finally {
      setParsing(false);
    }
  };

  return (
    <div style={S.modalOverlay}>
      <div style={{ ...S.modal, maxWidth: 560, width: '94%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontFamily: "'Bitter', serif", fontSize: 22, margin: 0 }}>📷 Scan Sub-Recipe</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: C.inkFade }}>×</button>
        </div>

        <p style={{ fontSize: 12, color: C.inkFade, lineHeight: 1.6, marginBottom: 14 }}>
          Photograph a sub-recipe from a cookbook, recipe card, or handwritten note. The OCR engine will extract the title, yield, and ingredients. You'll review and adjust before saving.
        </p>

        {/* File picker / preview */}
        {!preview ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${C.inkFade}`,
              borderRadius: 6,
              padding: '40px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: C.paper2,
              marginBottom: 14
            }}
          >
            <div style={{ fontSize: 42, marginBottom: 10 }}>📷</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Tap to take a photo or upload</div>
            <div style={{ fontSize: 11, color: C.inkFade }}>JPEG, PNG, or HEIC accepted</div>
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <img src={preview} alt="Sub-recipe preview" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 4, border: `1px solid ${C.paper2}` }} />
            <button
              onClick={() => { setPreview(''); setFile(null); }}
              style={{ ...S.btn, marginTop: 8, fontSize: 12 }}
            >
              Replace photo
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFile(e.target.files?.[0])}
          style={{ display: 'none' }}
        />

        {error && (
          <div style={{ background: '#5c1d1d', color: '#fff', padding: 10, borderRadius: 4, marginBottom: 12, fontSize: 12 }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: `1px dashed ${C.paper2}`, paddingTop: 14 }}>
          <button onClick={onClose} disabled={parsing} style={S.btn}>Cancel</button>
          <button onClick={runOcr} disabled={!file || parsing} style={S.btnAccent}>
            {parsing ? 'Reading…' : '▶ Run OCR Extraction'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PrepScreen({ planner = [], recipes = [], components = [], forecast = null, forecastMetrics = null }) {
  const [completedKeys, setCompletedKeys] = React.useState(new Set());
  const [syncing, setSyncing] = React.useState(false);

  // 1. Fetch completed tasks from Supabase when the tab mounts
  useEffect(() => {
    async function loadCompletedTasks() {
      try {
        const { data: memberData } = await supabase
          .from('kitchen_members')
          .select('kitchen_id')
          .limit(1)
          .single();

        if (memberData) {
          const { data, error } = await supabase
            .from('prep_tasks_log')
            .select('task_key')
            .eq('kitchen_id', memberData.kitchen_id);
          
          if (!error && data) {
            setCompletedKeys(new Set(data.map(row => row.task_key)));
          }
        }
      } catch (err) {
        console.error("Error fetching persistent prep states:", err);
      }
    }
    loadCompletedTasks();
  }, []);

  // 2. Aggregate planner covers
  const totalWeeklyCovers = useMemo(() => {
    return planner.reduce((sum, day) => sum + (parseInt(day.lunch) || 0) + (parseInt(day.dinner) || 0), 0);
  }, [planner]);

  // 3. One task per recipe, scaled to the dish's forecast portions (not all covers).
  //    Stage rules (simple and visible):
  //      Advance     – needs time ahead: yeast dough, cure, brine, pickle, marinade, ferment, soak
  //      Day before  – desserts and anything that has to set (gelatine) or braise
  //      Same day    – starters, salads, soups
  //      Pre-service – mains and everything else
  const phasedTasks = useMemo(() => {
    const phases = { advance: [], dayBefore: [], sameDay: [], service: [] };
    if (totalWeeklyCovers === 0 || recipes.length === 0) return phases;
    const f = forecast || buildDishForecast(recipes, [], [], planner);

    recipes.forEach(recipe => {
      const yieldAmt = parseFloat(recipe.yieldAmount) || 1;
      const portions = f.byName[recipe.name]?.portions || 0;
      if (portions <= 0) return;
      const scaleFactor = portions / yieldAmt;
      const ingNames = (recipe.ingredients || []).map(i => normName(i.name)).join(' | ');

      const lines = (recipe.ingredients || []).map(ing => {
        const q = normalizeQty(ing.amount ?? ing.qty, ing.unit);
        const shown = q.family === 'none' ? `${q.label} (as needed)` : formatQty(q.base * scaleFactor, q.family, q.label);
        return `${ing.name}: ${shown}`;
      });

      const course = courseOf(recipe.category);
      let phase = 'service';
      if (/yeast|cure|brine|pickl|marinad|marinat|ferment|soak/.test(ingNames)) phase = 'advance';
      else if (course === 'dessert' || /gelatin|braise|braising/.test(ingNames)) phase = 'dayBefore';
      else if (course === 'starter' || /salad|soup/.test(normName(recipe.name))) phase = 'sameDay';

      phases[phase].push({
        id: `prep-${normName(recipe.name)}`,
        task: `${recipe.name} — ${trimNum(portions, 0)} portions`,
        detail: [`${trimNum(scaleFactor, 1)} × batch of ${recipe.yield || yieldAmt}`, ...lines]
      });
    });

    return phases;
  }, [recipes, totalWeeklyCovers, forecast, planner]);

  // 4. Handle checkoff updates in Supabase
  const toggleTaskCompleted = async (taskKey) => {
    if (syncing) return;
    setSyncing(true);

    try {
      const { data: memberData } = await supabase
        .from('kitchen_members')
        .select('kitchen_id')
        .limit(1)
        .single();

      if (!memberData) return;
      const kId = memberData.kitchen_id;
      const nextKeys = new Set(completedKeys);

      if (nextKeys.has(taskKey)) {
        await supabase
          .from('prep_tasks_log')
          .delete()
          .eq('kitchen_id', kId)
          .eq('task_key', taskKey);
        nextKeys.delete(taskKey);
      } else {
        await supabase
          .from('prep_tasks_log')
          .insert([{ kitchen_id: kId, task_key: taskKey }]);
        nextKeys.add(taskKey);
      }

      setCompletedKeys(nextKeys);
    } catch (err) {
      console.error("Database prep sync failure:", err);
    } finally {
      setSyncing(false);
    }
  };

  // 5. Reset all tasks back to uncompleted
  const resetAllPrep = async () => {
    if (!window.confirm("Restore all cleared prep requirements back to active stations?")) return;
    try {
      const { data: memberData } = await supabase
        .from('kitchen_members')
        .select('kitchen_id')
        .limit(1)
        .single();

      if (memberData) {
        await supabase
          .from('prep_tasks_log')
          .delete()
          .eq('kitchen_id', memberData.kitchen_id);
        setCompletedKeys(new Set());
      }
    } catch (err) {
      console.error("Failed executing list reset:", err);
    }
  };

  const renderTaskSection = (title, tasks, color) => {
    // Filter tasks so completed ones disappear completely from the list
    const activeTasks = tasks.filter(t => !completedKeys.has(t.id));

    return (
      <div style={{ ...S.card, marginBottom: 20, borderLeft: `4px solid ${color}` }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', marginBottom: 12, color: color, display: 'flex', justifyContent: 'space-between' }}>
          <span>{title}</span>
          <span style={{ fontSize: 12, color: C.inkFade, textTransform: 'none' }}>{activeTasks.length} left</span>
        </h3>
        {activeTasks.length === 0 ? (
          <p style={{ fontSize: 12, color: C.inkFade, fontStyle: 'italic' }}>Phase fully cleared and ready.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeTasks.map(t => (
              <div 
                key={t.id} 
                onClick={() => toggleTaskCompleted(t.id)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', background: C.highlight, borderRadius: 4, cursor: 'pointer', opacity: syncing ? 0.5 : 1 }}
              >
                <input 
                  type="checkbox" 
                  checked={completedKeys.has(t.id)} 
                  onChange={() => {}} 
                  style={{ marginTop: 3, cursor: 'pointer' }} 
                />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{t.task}</div>
                  {Array.isArray(t.detail) ? (
                    <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>
                      {t.detail.map((line, i) => <div key={i} style={i === 0 ? { fontWeight: 700, color: C.ink } : undefined}>{i === 0 ? line : `• ${line}`}</div>)}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{t.detail}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Count how many tasks total remain across all phases
  const totalRemaining = phasedTasks.advance.filter(t => !completedKeys.has(t.id)).length +
                         phasedTasks.dayBefore.filter(t => !completedKeys.has(t.id)).length +
                         phasedTasks.sameDay.filter(t => !completedKeys.has(t.id)).length +
                         phasedTasks.service.filter(t => !completedKeys.has(t.id)).length;

  return (
    <div style={S.container}>
      <div style={{ borderBottom: `1px solid ${C.inkRule}`, paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: "'Bitter', serif", fontSize: 28, fontWeight: 900, color: C.ink }}>Automated Station Prep Sheet</h1>
          <p style={{ fontSize: 13, color: C.inkFade, marginTop: 4 }}>
            Scaling metrics for <strong>{totalWeeklyCovers} planned covers</strong> · {totalRemaining} active production tasks remaining
          </p>
          {forecastNote(forecast) && (
            <p style={{ fontSize: 11, color: C.inkFade, marginTop: 4, fontStyle: 'italic' }}>{forecastNote(forecast)}</p>
          )}
          <ForecastBadge metrics={forecastMetrics} />
        </div>
        {completedKeys.size > 0 && (
          <button 
            onClick={resetAllPrep} 
            style={{ background: 'none', border: `1px solid ${C.inkFade}`, color: C.inkSoft, padding: '6px 12px', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
          >
            🔄 Reset All Stations
          </button>
        )}
      </div>

      {totalWeeklyCovers === 0 ? (
        <div style={{ padding: 30, background: C.highlight, borderRadius: 4, textAlign: 'center', border: `1px dashed ${C.inkFade}` }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <p style={{ fontSize: 15, color: C.ink, fontWeight: 700, marginBottom: 6 }}>No production tasks yet</p>
          <p style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.5, maxWidth: 500, margin: '0 auto' }}>
            Prep Sheets scale each recipe against your planned covers. Open <strong>Weekly Planner</strong> and enter how many lunch and dinner covers you're expecting each day. Tasks will appear here automatically grouped by phase (Advance / Day Before / Same Day / Pre-Service).
          </p>
        </div>
      ) : (phasedTasks.advance.length + phasedTasks.dayBefore.length + phasedTasks.sameDay.length + phasedTasks.service.length) === 0 ? (
        <div style={{ padding: 30, background: C.highlight, borderRadius: 4, textAlign: 'center', border: `1px dashed ${C.inkFade}` }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <p style={{ fontSize: 15, color: C.ink, fontWeight: 700, marginBottom: 6 }}>No tasks could be generated</p>
          <p style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.5, maxWidth: 540, margin: '0 auto' }}>
            Planner is set ({totalWeeklyCovers} covers) but no recipes were found to scale against. Add at least one recipe via <strong>Recipe Digitizer</strong>, then return here.
          </p>
        </div>
      ) : totalRemaining === 0 ? (
        <div style={{ padding: 40, background: C.highlight, borderRadius: 4, textAlign: 'center', border: `1px dashed ${C.green}` }}>
          <p style={{ fontSize: 16, color: C.green, fontWeight: 700 }}>🎉 All production phases successfully completed!</p>
          <p style={{ fontSize: 12, color: C.inkFade, marginTop: 4 }}>The station is fully prepped and set up for service.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
          <div>
            {renderTaskSection("1. Advance Preparation", phasedTasks.advance, C.blue)}
            {renderTaskSection("2. Day Before", phasedTasks.dayBefore, C.accent)}
          </div>
          <div>
            {renderTaskSection("3. Same Day Shift", phasedTasks.sameDay, C.green)}
            {renderTaskSection("4. Pre-Service Setup", phasedTasks.service, C.inkSoft)}
          </div>
        </div>
      )}
    </div>
  );
}

function ShoppingScreen({ planner = [], recipes = [], components = [], forecast = null, kitchenId = '' }) {
  const [clearedKeys, setClearedKeys] = React.useState(new Set());
  const [syncing, setSyncing] = React.useState(false);
  const [supplierPrices, setSupplierPrices] = React.useState(new Map()); // normName -> [{supplier, price, unit}]

  // Supplier + price per item, from the kitchen's scanned invoices (same data Market Intel uses)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!kitchenId) return;
      try {
        const [invRes, lineRes] = await Promise.all([
          supabase.from('invoices').select('id, supplier').eq('kitchen_id', kitchenId),
          supabase.from('invoice_lines').select('invoice_id, name, unit, price_per_unit').eq('kitchen_id', kitchenId)
        ]);
        if (cancelled) return;
        const supplierById = new Map((invRes.data || []).map(i => [i.id, (i.supplier || '').trim()]));
        const map = new Map();
        (lineRes.data || []).forEach(l => {
          const supplier = supplierById.get(l.invoice_id);
          const price = Number(l.price_per_unit) || 0;
          if (!supplier || price <= 0) return;
          const key = singular(normName(l.name));
          if (!map.has(key)) map.set(key, []);
          map.get(key).push({ supplier, price, unit: l.unit || '' });
        });
        setSupplierPrices(map);
      } catch (err) {
        console.error("Couldn't load invoice suppliers:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [kitchenId]);

  // 1. Fetch previously cleared items from Supabase when the tab mounts
  useEffect(() => {
    async function loadClearedItems() {
      try {
        const { data: memberData } = await supabase
          .from('kitchen_members')
          .select('kitchen_id')
          .limit(1)
          .single();

        if (memberData) {
          const { data, error } = await supabase
            .from('ordered_items_log')
            .select('item_key')
            .eq('kitchen_id', memberData.kitchen_id);
          
          if (!error && data) {
            setClearedKeys(new Set(data.map(row => row.item_key)));
          }
        }
      } catch (err) {
        console.error("Error fetching persistent order states:", err);
      }
    }
    loadClearedItems();
  }, []);

  // 2. Order list: each dish scaled to its forecast portions, units converted before adding,
  //    one line per ingredient + unit family (mass / volume / count), cheapest invoiced supplier.
  const orderList = useMemo(() => {
    const totalWeeklyCovers = planner.reduce((sum, day) => sum + (parseInt(day.lunch) || 0) + (parseInt(day.dinner) || 0), 0);
    if (totalWeeklyCovers === 0) return [];
    const f = forecast || buildDishForecast(recipes, [], [], planner);
    const items = {};
    const add = (name, amount, unit) => {
      const q = normalizeQty(amount, unit);
      const key = `${singular(normName(name))}|${q.family}`;
      if (!items[key]) items[key] = { key, name, family: q.family, label: q.label, base: 0, usedIn: 0 };
      items[key].base += q.base;
      items[key].usedIn += 1;
    };

    recipes.forEach(recipe => {
      const portions = f.byName[recipe.name]?.portions || 0;
      if (portions <= 0) return;
      const scalingFactor = portions / (parseFloat(recipe.yieldAmount) || 1);
      (recipe.ingredients || []).forEach(ing => {
        if (ing.kind === 'comp') {
          const comp = components.find(c => c.id === ing.componentId);
          if (!comp) return;
          const compScale = ((parseFloat(ing.amount || ing.qty) || 0) / (parseFloat(comp.batchYield) || 1)) * scalingFactor;
          (comp.ingredients || []).forEach(cing => add(cing.name, (parseFloat(cing.amount || cing.qty) || 0) * compScale, cing.unit));
        } else {
          add(ing.name, (parseFloat(ing.amount ?? ing.qty) || 0) * scalingFactor, ing.unit);
        }
      });
    });

    // A "to taste / a pinch" line is dropped when the same item already has a real quantity.
    const list = Object.values(items).filter(it =>
      it.family !== 'none' || !Object.values(items).some(o => o !== it && o.key.split('|')[0] === it.key.split('|')[0] && o.family !== 'none')
    );

    const priced = list.map(it => {
      const offers = supplierPrices.get(it.key.split('|')[0]) || [];
      // Cheapest offer whose unit is in the same family as this line (so £/kg vs £/ea is never compared)
      let best = null;
      offers.forEach(o => {
        const fam = normalizeQty(1, o.unit).family;
        const comparable = fam === it.family || (it.family.startsWith('count') && fam.startsWith('count'));
        if (comparable && (!best || o.price < best.price)) best = o;
      });
      if (!best && offers.length) best = offers.reduce((a, b) => (b.price < a.price ? b : a));
      let estCost = null;
      if (best && it.family !== 'none') {
        const unitQ = normalizeQty(1, best.unit);
        const bothCount = it.family.startsWith('count') && unitQ.family.startsWith('count');
        if ((unitQ.family === it.family || bothCount) && unitQ.base > 0) estCost = (it.base / unitQ.base) * best.price;
      }
      return {
        ...it,
        qtyText: formatQty(it.base, it.family, it.label),
        supplier: best ? best.supplier : 'Not on an invoice',
        priceText: best ? `£${best.price.toFixed(2)}/${best.unit || 'unit'}` : '',
        estCost
      };
    });

    // One row per ingredient. If recipes use units that can't be converted into each
    // other (e.g. passata in L and in g), show both amounts instead of adding them.
    const byItem = new Map();
    priced.forEach(it => {
      const nameKey = it.key.split('|')[0];
      if (!byItem.has(nameKey)) { byItem.set(nameKey, { ...it, key: nameKey, parts: [it.qtyText] }); return; }
      const row = byItem.get(nameKey);
      row.parts.push(it.qtyText);
      row.estCost = (row.estCost ?? 0) + (it.estCost ?? 0) || row.estCost;
      if (row.supplier === 'Not on an invoice' && it.supplier !== 'Not on an invoice') {
        row.supplier = it.supplier; row.priceText = it.priceText;
      }
    });
    return [...byItem.values()]
      .map(r => ({ ...r, qtyText: r.parts.join(' + ') }))
      .sort((a, b) => a.supplier.localeCompare(b.supplier) || a.name.localeCompare(b.name));
  }, [planner, recipes, components, forecast, supplierPrices]);

  // 3. Handle persistent toggle clicks
  const toggleItemOrdered = async (itemKey) => {
    if (syncing) return;
    setSyncing(true);

    try {
      const { data: memberData } = await supabase
        .from('kitchen_members')
        .select('kitchen_id')
        .limit(1)
        .single();

      if (!memberData) return;
      const kId = memberData.kitchen_id;

      const nextKeys = new Set(clearedKeys);

      if (nextKeys.has(itemKey)) {
        // If already cleared, un-check it (remove from Supabase)
        await supabase
          .from('ordered_items_log')
          .delete()
          .eq('kitchen_id', kId)
          .eq('item_key', itemKey);
        nextKeys.delete(itemKey);
      } else {
        // If not cleared, check it off (add to Supabase)
        await supabase
          .from('ordered_items_log')
          .insert([{ kitchen_id: kId, item_key: itemKey }]);
        nextKeys.add(itemKey);
      }

      setClearedKeys(nextKeys);
    } catch (err) {
      console.error("Database sync failure:", err);
    } finally {
      setSyncing(false);
    }
  };

  // 4. Global list purge (Reset button)
  const resetAllItems = async () => {
    if (!window.confirm("Restore all cleared order requirements back to active view?")) return;
    try {
      const { data: memberData } = await supabase
        .from('kitchen_members')
        .select('kitchen_id')
        .limit(1)
        .single();

      if (memberData) {
        await supabase
          .from('ordered_items_log')
          .delete()
          .eq('kitchen_id', memberData.kitchen_id);
        setClearedKeys(new Set());
      }
    } catch (err) {
      console.error("Failed executing list reset:", err);
    }
  };

  // Filter our list cleanly against our persistent records database set
  const activeOrders = orderList.filter(item => !clearedKeys.has(item.key));
  const estTotal = activeOrders.reduce((s, it) => s + (it.estCost || 0), 0);

  return (
    <div style={S.container}>
      <div style={{ borderBottom: `1px solid ${C.inkRule}`, paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: "'Bitter', serif", fontSize: 28, fontWeight: 900, color: C.ink }}>Consolidated Orders & Lists</h1>
          <p style={{ fontSize: 13, color: C.inkFade, marginTop: 4 }}>
            Showing {activeOrders.length} items remaining to order out of {orderList.length} requirements
            {estTotal > 0 && <> · est. <strong>£{estTotal.toFixed(2)}</strong> at the cheapest invoiced prices</>}
          </p>
          {forecastNote(forecast) && (
            <p style={{ fontSize: 11, color: C.inkFade, marginTop: 4, fontStyle: 'italic' }}>{forecastNote(forecast)}</p>
          )}
        </div>
        {clearedKeys.size > 0 && (
          <button 
            onClick={resetAllItems} 
            style={{ background: 'none', border: `1px solid ${C.inkFade}`, color: C.inkSoft, padding: '6px 12px', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
          >
            🔄 Reset Cleared Items
          </button>
        )}
      </div>

      {orderList.length === 0 ? (
        <div style={{ padding: 30, background: C.highlight, borderRadius: 4, textAlign: 'center', border: `1px dashed ${C.inkFade}` }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>
          <p style={{ fontSize: 15, color: C.ink, fontWeight: 700, marginBottom: 6 }}>No order list yet</p>
          <p style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.5, maxWidth: 540, margin: '0 auto' }}>
            Orders & Lists builds a shopping list by scaling each recipe's ingredients against your planned covers. To populate it, open <strong>Weekly Planner</strong> and enter lunch/dinner covers per day. Quantities then explode across all your recipes and dedupe by ingredient name.
          </p>
        </div>
      ) : activeOrders.length === 0 ? (
        <div style={{ padding: 40, background: C.highlight, borderRadius: 4, textAlign: 'center', border: `1px dashed ${C.green}` }}>
          <p style={{ fontSize: 16, color: C.green, fontWeight: 700 }}>🎉 All stations fully provisioned!</p>
          <p style={{ fontSize: 12, color: C.inkFade, marginTop: 4 }}>Every item calculation has been permanently checked off in your team ledger.</p>
        </div>
      ) : (
        <div style={S.card}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', padding: '0 12px 8px 12px', borderBottom: `1px solid ${C.paper2}`, fontSize: 11, fontWeight: 700, color: C.inkFade, textTransform: 'uppercase' }}>
              <div style={{ width: '40px' }}>Done</div>
              <div style={{ flex: 2 }}>Ingredient Description</div>
              <div style={{ flex: 1, textAlign: 'right' }}>Target Volume</div>
              <div style={{ flex: 1, textAlign: 'right' }}>Supplier Vendor</div>
            </div>

            {activeOrders.map((item, index) => {
              const uniqueKey = item.key;
              return (
                <div 
                  key={index}
                  style={{ display: 'flex', alignItems: 'center', padding: '12px', background: C.highlight, borderBottom: `1px solid ${C.paper2}`, borderRadius: 4, opacity: syncing ? 0.5 : 1 }}
                >
                  <div style={{ width: '40px' }}>
                    <input 
                      type="checkbox" 
                      style={{ cursor: 'pointer', width: 16, height: 16 }}
                      checked={clearedKeys.has(uniqueKey)}
                      onChange={() => toggleItemOrdered(uniqueKey)}
                    />
                  </div>
                  <div style={{ flex: 2, fontWeight: 700, fontSize: 14, color: C.ink, textTransform: 'capitalize' }}>
                    {item.name}
                  </div>
                  <div style={{ flex: 1, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: C.accent }}>
                    {item.qtyText}
                    {item.estCost != null && (
                      <div style={{ fontSize: 10, color: C.inkFade, fontWeight: 400 }}>≈ £{item.estCost.toFixed(2)}</div>
                    )}
                  </div>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <span style={{ 
                      fontSize: 11, 
                      fontWeight: 700, 
                      background: item.supplier === 'Seafood' ? '#d1f2ff' : item.supplier === 'Butcher' ? '#ffd1d1' : C.paper2,
                      color: item.supplier === 'Seafood' ? C.blue : item.supplier === 'Butcher' ? C.red : C.inkSoft,
                      padding: '4px 8px', borderRadius: 4, textTransform: 'uppercase'
                    }}>
                      {item.supplier}
                    </span>
                    {item.priceText && <div style={{ fontSize: 10, color: C.inkFade, marginTop: 3 }}>{item.priceText}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// DELETE CONFIRM + UNDO (shared by Sales Analytics and Waste Tracker)
// ============================================================
function ConfirmDeleteDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  const confirmRef = React.useRef(null);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => confirmRef.current?.focus(), 30);
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,24,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="mise-del-title"
        style={{ background: '#fff', borderRadius: 10, width: 'min(440px, 100%)', boxShadow: '0 24px 50px -16px rgba(0,0,0,0.45)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 22px', display: 'flex', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f9e6e1', color: '#b8362a', display: 'grid', placeItems: 'center', fontWeight: 800, flex: 'none' }}>!</div>
          <div>
            <h3 id="mise-del-title" style={{ margin: 0, fontSize: 18, fontFamily: "'Bitter', serif", color: '#0e0e0c' }}>{title}</h3>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#5a4f40', lineHeight: 1.5 }}>{message}</p>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 22px', background: '#faf7f2', borderTop: '1px solid #ece4d6' }}>
          <button type="button" onClick={onCancel}
            style={{ minHeight: 40, padding: '0 16px', borderRadius: 6, border: '1.5px solid #d9d2c8', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>Keep it</button>
          <button type="button" ref={confirmRef} onClick={onConfirm}
            style={{ minHeight: 40, padding: '0 16px', borderRadius: 6, border: 0, background: '#b8362a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function UndoBar({ message, onUndo }) {
  if (!message) return null;
  return (
    <div role="status" style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', background: '#1a1a18', color: '#fff', padding: '10px 12px 10px 16px', borderRadius: 8, display: 'flex', gap: 14, alignItems: 'center', zIndex: 1001, boxShadow: '0 12px 30px -10px rgba(0,0,0,0.5)', maxWidth: 'calc(100vw - 32px)' }}>
      <span style={{ fontSize: 14 }}>{message}</span>
      <button type="button" onClick={onUndo} style={{ background: 'none', border: 0, color: '#e0a030', fontWeight: 700, cursor: 'pointer', padding: '6px 8px' }}>Undo</button>
    </div>
  );
}

// Delete with confirm + 6-second undo. `onUpdate` receives the full new list.
function useDeleteWithUndo(list, onUpdate) {
  const [pending, setPending] = useState(null);      // { index, title, message }
  const [undo, setUndo] = useState(null);            // { item, index, label }
  const timer = React.useRef(null);
  const ask = (index, title, message) => setPending({ index, title, message });
  const cancel = React.useCallback(() => setPending(null), []);
  const confirm = (label) => {
    if (!pending) return;
    const item = list[pending.index];
    onUpdate(list.filter((_, i) => i !== pending.index));
    setUndo({ item, index: pending.index, label });
    setPending(null);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setUndo(null), 6000);
  };
  const undoLast = () => {
    if (!undo) return;
    const next = [...list];
    next.splice(Math.min(undo.index, next.length), 0, undo.item);
    onUpdate(next);
    setUndo(null);
    clearTimeout(timer.current);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return { pending, ask, cancel, confirm, undo, undoLast };
}

// Search + day filter for the sales list. Returns indexes into the full list,
// so edit/delete still act on the right record.
function useSalesFilter(sales, recipes) {
  const [q, setQ] = useState('');
  const [day, setDay] = useState('All');
  const nameOf = (s) => { const r = recipes.find(x => x.id === s.recipeId); return r ? r.name : 'Unmapped item'; };
  const term = q.trim().toLowerCase();
  const visible = sales.map((s, idx) => ({ s, idx }))
    .filter(({ s }) => (day === 'All' || s.day === day) && (!term || nameOf(s).toLowerCase().includes(term)));
  const totalPortions = visible.reduce((t, { s }) => t + (Number(s.sold) || 0), 0);
  const bar = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', margin: '0 0 12px' }}>
      <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search sales by dish…" aria-label="Search sales by dish"
        style={{ flex: '1 1 220px', padding: '9px 12px', border: '1px solid #c9bfae', borderRadius: 4, background: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
      <select value={day} onChange={e => setDay(e.target.value)} aria-label="Filter by day"
        style={{ padding: '9px 10px', border: '1px solid #c9bfae', borderRadius: 4, background: '#fff', fontSize: 14 }}>
        {['All', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <option key={d} value={d}>{d === 'All' ? 'All days' : d}</option>)}
      </select>
      <span style={{ fontSize: 12, color: '#5a4f40' }}>
        {visible.length} of {sales.length} records · {totalPortions} portions
      </span>
      {(term || day !== 'All') && (
        <button type="button" onClick={() => { setQ(''); setDay('All'); }}
          style={{ background: 'none', border: 0, color: '#7a4b2a', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>Clear filters</button>
      )}
    </div>
  );
  return { visible, bar, filtered: !!term || day !== 'All' };
}

const rowDeleteBtn = { minHeight: 34, padding: '0 10px', borderRadius: 6, border: '1.5px solid #e8c2b8', background: '#fff', color: '#b8362a', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' };
const rowEditBtn = { minHeight: 34, padding: '0 10px', borderRadius: 6, border: '1.5px solid #d9d2c8', background: '#fff', color: '#1a1a18', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' };

// Manual sales entry (the SOP's daily entry). Adds to an existing day/session/dish line if present.
function AddSaleForm({ recipes = [], dishes = [], sales = [], onUpdate }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const [day, setDay] = useState('Mon');
  const [session, setSession] = useState('Lunch');
  const [dish, setDish] = useState('');
  const [sold, setSold] = useState('');
  const [msg, setMsg] = useState('');
  const names = (dishes.length ? dishes.map(d => d.name) : Array.from(new Set(recipes.map(r => r.name).filter(Boolean)))).sort();
  const submit = (e) => {
    e.preventDefault();
    const qty = parseInt(sold, 10);
    const typed = dish.trim().toLowerCase();
    const exact = names.find(n => n.toLowerCase() === typed);
    const partial = names.filter(n => n.toLowerCase().includes(typed));
    const pickedName = exact || (partial.length === 1 ? partial[0] : null);
    if (!typed || !Number.isFinite(qty) || qty <= 0) { setMsg('Pick a dish and enter portions sold (above 0).'); return; }
    if (!pickedName) { setMsg(partial.length > 1 ? `"${dish}" matches ${partial.length} dishes. Pick one from the list.` : `No dish called "${dish}". Pick one from the list.`); return; }
    if (pickedName !== dish) setDish(pickedName);
    const row = recipes.find(r => (r.name || '').trim() === pickedName) || dishes.find(d => d.name === pickedName);
    if (!row) { setMsg("Couldn't find that dish."); return; }
    const sameDish = (s) => {
      const r = recipes.find(x => x.id === s.recipeId);
      return (r ? (r.name || '').trim() : null) === pickedName;
    };
    const next = [...sales];
    const idx = next.findIndex(s => s.day === day && s.session === session && sameDish(s));
    if (idx !== -1) next[idx] = { ...next[idx], sold: (Number(next[idx].sold) || 0) + qty };
    else next.push({ day, session, recipeId: row.id, sold: qty });
    onUpdate(next);
    setSold('');
    setMsg(`Added ${qty} × ${pickedName} (${day} ${session}).`);
    setDish('');
  };
  const field = { padding: '8px 10px', border: `1px solid ${C.inkRule}`, borderRadius: 4, background: '#fff', fontSize: 13, boxSizing: 'border-box' };
  return (
    <form onSubmit={submit} style={{ ...S.card, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
      <div style={{ width: '100%', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: C.inkFade }}>Add sales</div>
      <select value={day} onChange={e => setDay(e.target.value)} style={field}>{days.map(d => <option key={d}>{d}</option>)}</select>
      <select value={session} onChange={e => setSession(e.target.value)} style={field}><option>Lunch</option><option>Dinner</option></select>
      <input list="mise-dish-options" value={dish} onChange={e => setDish(e.target.value)}
        placeholder="Type to search dishes…" aria-label="Dish" autoComplete="off"
        style={{ ...field, flex: '1 1 200px' }} />
      <datalist id="mise-dish-options">{names.map(n => <option key={n} value={n} />)}</datalist>
      <input type="number" min="1" step="1" placeholder="Portions" value={sold} onChange={e => setSold(e.target.value)} style={{ ...field, width: 110 }} />
      <button type="submit" style={S.btnAccent}>Add</button>
      {msg && <div style={{ width: '100%', fontSize: 12, color: C.inkSoft }}>{msg}</div>}
    </form>
  );
}

function SalesScreen({ recipes = [], sales = [], onUpdate, settings, dishes = [] }) {
  const currencySymbol = settings?.currency || '£';
  const del = useDeleteWithUndo(sales, onUpdate);
  const filter = useSalesFilter(sales, recipes);
  const saleLabel = (s) => { const r = recipes.find(x => x.id === s.recipeId); return `${s.sold} × ${r ? r.name : 'Unmapped item'} (${s.day} ${s.session})`; };
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (isMobile) {
    return (
      <div style={S.container}>
        <ScreenHeader title="Sales Ledger Registers" sub="Correlate point of sale deployment figures with physical matrix recipes" />
        <AddSaleForm recipes={recipes} dishes={dishes} sales={sales} onUpdate={onUpdate} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sales.length === 0 && (
            <div style={{ background: C.highlight, borderRadius: 4, padding: 20, textAlign: 'center', border: `1px dashed ${C.inkFade}` }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📊</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4 }}>No sales recorded yet</div>
              <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}>
                Open <strong>POS Sync Gateway</strong> and tap Sync on any provider to inject 6 test sales records, or add sales manually here once rows appear.
              </div>
            </div>
          )}
          {sales.length > 0 && filter.bar}
          {sales.length > 0 && filter.visible.length === 0 && <div style={{ ...S.card, color: C.inkFade, fontSize: 13 }}>No sales match your search.</div>}
          {filter.visible.map(({ s, idx }) => {
            const recipe = recipes.find(r => r.id === s.recipeId);
            return (
              <div key={idx} style={{ background: '#fff', border: `1px solid ${C.paper2}`, borderRadius: 4, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 13 }}>{s.day} · {s.session}</span>
                  <button type="button" style={rowDeleteBtn} aria-label={`Delete ${saleLabel(s)}`}
                    onClick={() => del.ask(idx, 'Delete this sale?', `${saleLabel(s)} will be removed from sales and financial totals.`)}>Delete</button>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 10 }}>
                  {recipe ? recipe.name : 'Unmapped Item'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.inkFade, textTransform: 'uppercase' }}>Quantity Cleared</label>
                  <div style={{ width: 100 }}>
                    <NumInput value={s.sold} onChange={(val) => {
                      const next = [...sales];
                      next[idx] = { ...next[idx], sold: parseInt(val) || 0 };
                      onUpdate(next);
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <ConfirmDeleteDialog open={!!del.pending} title={del.pending?.title} message={del.pending?.message} confirmLabel="Delete sale"
          onCancel={del.cancel} onConfirm={() => del.confirm(`Deleted ${saleLabel(sales[del.pending.index])}`)} />
        <UndoBar message={del.undo?.label} onUndo={del.undoLast} />
      </div>
    );
  }

  return (
    <SalesLedgerView sales={sales} recipes={recipes} dishes={dishes} onUpdate={onUpdate} />
  );
}

function SalesLedgerView({ sales, recipes, onUpdate, dishes = [] }) {
  const del = useDeleteWithUndo(sales, onUpdate);
  const filter = useSalesFilter(sales, recipes);
  const saleLabel = (s) => { const r = recipes.find(x => x.id === s.recipeId); return `${s.sold} × ${r ? r.name : 'Unmapped item'} (${s.day} ${s.session})`; };
  const askDelete = (idx) => del.ask(idx, 'Delete this sale?', `${saleLabel(sales[idx])} will be removed from sales and financial totals.`);
  const dialogs = (
    <>
      <ConfirmDeleteDialog open={!!del.pending} title={del.pending?.title} message={del.pending?.message} confirmLabel="Delete sale"
        onCancel={del.cancel} onConfirm={() => del.confirm(`Deleted ${saleLabel(sales[del.pending.index])}`)} />
      <UndoBar message={del.undo?.label} onUndo={del.undoLast} />
    </>
  );
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (isMobile) {
    // Card layout — every row stacks cleanly inside the viewport
    return (
      <div style={S.container}>
        <ScreenHeader title="Sales Ledger Registers" sub="Correlate point of sale deployment figures with physical matrix recipes" />
        <AddSaleForm recipes={recipes} dishes={dishes} sales={sales} onUpdate={onUpdate} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sales.length > 0 && filter.bar}
          {sales.length === 0 ? (
            <div style={{ ...S.card, color: C.inkFade, fontSize: 13 }}>No sales recorded yet.</div>
          ) : filter.visible.length === 0 ? <div style={{ ...S.card, color: C.inkFade, fontSize: 13 }}>No sales match your search.</div> : filter.visible.map(({ s, idx }) => {
            const recipe = recipes.find(r => r.id === s.recipeId);
            return (
              <div key={idx} style={{ background: '#fff', border: `1px solid ${C.paper2}`, borderRadius: 4, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: C.ink }}>
                    {s.day} · {s.session}
                  </div>
                  <button type="button" style={rowDeleteBtn} aria-label={`Delete ${saleLabel(s)}`} onClick={() => askDelete(idx)}>Delete</button>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 8, wordBreak: 'break-word' }}>
                  {recipe ? recipe.name : 'Unmapped Item'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <label style={{ fontSize: 11, color: C.inkFade, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>Quantity Cleared</label>
                  <input
                    type="number"
                    value={s.sold}
                    onChange={(e) => {
                      const next = [...sales];
                      next[idx] = { ...next[idx], sold: parseInt(e.target.value) || 0 };
                      onUpdate(next);
                    }}
                    style={{ width: 90, padding: '8px 10px', fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, border: `1px solid ${C.paper2}`, borderRadius: 4, textAlign: 'right' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {dialogs}
      </div>
    );
  }

  // Desktop / tablet table
  return (
    <div style={S.container}>
      <ScreenHeader title="Sales Ledger Registers" sub="Correlate point of sale deployment figures with physical matrix recipes" />
      <AddSaleForm recipes={recipes} dishes={dishes} sales={sales} onUpdate={onUpdate} />
      {sales.length === 0 ? (
        <div style={{ padding: 30, background: C.highlight, borderRadius: 4, textAlign: 'center', border: `1px dashed ${C.inkFade}` }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
          <p style={{ fontSize: 15, color: C.ink, fontWeight: 700, marginBottom: 6 }}>No sales recorded yet</p>
          <p style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.5, maxWidth: 540, margin: '0 auto' }}>
            Sales feed into both this screen and Financial Matrix (revenue). Open <strong>POS Sync Gateway</strong> and tap Sync on any provider to drop in 6 test records, or add sales manually here once rows are present.
          </p>
        </div>
      ) : (
      <>
      {filter.bar}
      <div style={{ ...S.card, overflowX: 'auto' }}>
        {filter.visible.length === 0 && <div style={{ padding: 16, color: C.inkFade, fontSize: 13 }}>No sales match your search.</div>}
        <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse", textAlign: "left", display: filter.visible.length ? 'table' : 'none' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.inkRule}` }}>
              <th style={{ padding: 10 }}><SectionLabel label="Day Block" /></th>
              <th style={{ padding: 10 }}><SectionLabel label="Session" /></th>
              <th style={{ padding: 10 }}><SectionLabel label="Recipe Mapping" /></th>
              <th style={{ padding: 10 }}><SectionLabel label="Quantity Cleared" /></th>
              <th style={{ padding: 10 }}><span style={{ position: 'absolute', left: -9999 }}>Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {filter.visible.map(({ s, idx }) => {
              const recipe = recipes.find(r => r.id === s.recipeId);
              return (
                <tr key={idx} style={{ borderBottom: `1px solid ${C.paper2}` }}>
                  <td style={{ padding: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{s.day}</td>
                  <td style={{ padding: 12 }}>{s.session}</td>
                  <td style={{ padding: 12, fontWeight: 700 }}>{recipe ? recipe.name : 'Unmapped Item'}</td>
                  <td style={{ padding: 12 }}>
                    <NumInput value={s.sold} onChange={(val) => {
                      const next = [...sales];
                      next[idx] = { ...next[idx], sold: parseInt(val) || 0 };
                      onUpdate(next);
                    }} />
                  </td>
                  <td style={{ padding: 12, textAlign: 'right' }}>
                    <button type="button" style={rowDeleteBtn} aria-label={`Delete ${saleLabel(s)}`} onClick={() => askDelete(idx)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>
      )}
      {dialogs}
    </div>
  );
}

// ============================================================
// MOBILE-OPTIMIZED WASTE SCREEN COMPONENT
// ============================================================
function WasteScreen({ waste = [], onUpdate, settings = {} }) {
  const currencySymbol = settings?.currency || '£';
  const del = useDeleteWithUndo(waste, onUpdate);
  const [editIdx, setEditIdx] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [editErr, setEditErr] = useState('');
  const wasteLabel = (w) => {
    const q = parseFloat(w.qty || 0), c = parseFloat(w.cost ?? w.costPrice ?? 0);
    return `${w.item || w.itemName || 'Item'}, ${q} ${w.unit || ''} (${currencySymbol}${(q * c).toFixed(2)})`;
  };
  const startEdit = (idx) => {
    const w = waste[idx];
    setEditIdx(idx); setEditErr('');
    setEditDraft({ item: w.item || w.itemName || '', qty: String(w.qty ?? ''), unit: w.unit || '', cost: String(w.cost ?? w.costPrice ?? ''), reason: w.reason || 'Spoilage' });
  };
  const saveEdit = () => {
    const qty = parseFloat(editDraft.qty), cost = parseFloat(editDraft.cost);
    if (!editDraft.item.trim()) { setEditErr('Enter the item name.'); return; }
    if (!Number.isFinite(qty) || qty <= 0) { setEditErr('Quantity must be above 0.'); return; }
    if (!Number.isFinite(cost) || cost < 0) { setEditErr('Enter the cost per unit (0 or more).'); return; }
    const next = [...waste];
    next[editIdx] = { ...next[editIdx], item: editDraft.item.trim(), ingredient: editDraft.item.trim(), qty, unit: editDraft.unit.trim(), cost, reason: editDraft.reason };
    onUpdate(next);
    setEditIdx(null); setEditDraft(null);
  };
  const editField = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #c9bfae', borderRadius: 4, background: '#fff', fontSize: 13 };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "4px 0" }}>
      
      {/* Header Summary section */}
      <div style={{ 
        display: "flex", 
        flexDirection: "column", 
        gap: 16, 
        borderBottom: `1px solid #1a1a18`, 
        paddingBottom: 16, 
        marginBottom: 20 
      }}>
        <div>
          <h2 style={{ fontSize: 26, margin: 0, fontFamily: "'Bitter', serif", color: "#0e0e0c" }}>
            Waste Tracker
          </h2>
          <p style={{ margin: "4px 0 0 0", color: "#5a4f40", fontSize: 13, opacity: 0.85 }}>
            Log inventory leaks, over-production, and dropped yields to protect margins.
          </p>
        </div>
        
        {/* Top Summary Cards Grid: Automatically stacks vertically on mobile, multi-column on desktop */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", 
          gap: 12, 
          width: "100%" 
        }}>
          <div style={{ background: '#efe6d3', padding: 12, border: `1px solid #1a1a18`, borderRadius: 4 }}>
            <div style={{ fontSize: 11, color: '#5a4f40', textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
              Logged Loss (This Period)
            </div>
            <div style={{ fontSize: 22, fontWeight: "700", fontFamily: "'JetBrains Mono', monospace", color: '#b8362a', marginTop: 4 }}>
              {currencySymbol}{waste.reduce((acc, l) => acc + (parseFloat(l.qty || 0) * parseFloat(l.costPrice || l.cost || 0)), 0).toFixed(2)}
            </div>
          </div>
          <div style={{ background: '#efe6d3', padding: 12, border: `1px solid #1a1a18`, borderRadius: 4 }}>
            <div style={{ fontSize: 11, color: '#5a4f40', textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
              Incident Counter
            </div>
            <div style={{ fontSize: 22, fontWeight: "700", fontFamily: "'JetBrains Mono', monospace", color: "#0e0e0c", marginTop: 4 }}>
              {waste.length} entries
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Split: Uses a flexbox layout that turns into a unified vertical column when inside a tight mobile viewport */}
      <div style={{ 
        display: "flex", 
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 24 
      }}>
        
        {/* COLUMN A: Log Loss Input Form */}
        <div style={{ 
          flex: "1 1 320px", 
          background: '#efe6d3', 
          padding: 16, 
          border: `1px solid #1a1a18`, 
          borderRadius: 4,
          height: "fit-content",
          boxSizing: "border-box"
        }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 14, fontFamily: "'Bitter', serif", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: `1px solid #1a1a18`, paddingBottom: 8, color: "#0e0e0c" }}>
            Record New Variance
          </h3>
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const newLog = {
              id: Date.now(),
              item: fd.get('item_name'),
              qty: parseFloat(fd.get('qty') || 0),
              unit: fd.get('unit'),
              cost: parseFloat(fd.get('cost_per_unit') || 0),
              reason: fd.get('reason'),
              date: new Date().toISOString().split('T')[0]
            };
            onUpdate([newLog, ...waste]);
            e.target.reset();
          }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, color: '#3a3530' }}>Component Name</label>
              <input name="item_name" required placeholder="e.g., Salmon Fillet, Double Cream" style={{ width: "100%", padding: "8px 10px", border: "1px solid #1a1a18", background: "#fff", borderRadius: 4, boxSizing: "border-box" }} />
            </div>

            {/* Quantitative Details Row split */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "1fr 1fr", 
              gap: 8 
            }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, color: '#3a3530' }}>Quantity</label>
                <input name="qty" type="number" step="any" required placeholder="1.5" style={{ width: "100%", padding: "8px 10px", border: "1px solid #1a1a18", background: "#fff", borderRadius: 4, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, color: '#3a3530' }}>Unit</label>
                <input name="unit" required placeholder="kg, L, ea" style={{ width: "100%", padding: "8px 10px", border: "1px solid #1a1a18", background: "#fff", borderRadius: 4, boxSizing: "border-box" }} />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, color: '#3a3530' }}>Cost per Unit ({currencySymbol})</label>
              <input name="cost_per_unit" type="number" step="any" required placeholder="12.50" style={{ width: "100%", padding: "8px 10px", border: "1px solid #1a1a18", background: "#fff", borderRadius: 4, boxSizing: "border-box" }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, color: '#3a3530' }}>Reason Code</label>
              <select name="reason" style={{ width: "100%", padding: "8px 10px", border: "1px solid #1a1a18", background: "#fff", borderRadius: 4, boxSizing: "border-box" }}>
                <option value="Spoilage">Spoilage / Expiry</option>
                <option value="Over-production">Over-production Trimming</option>
                <option value="Dropped/Spilled">Dropped / Damaged Prep</option>
                <option value="Sub-standard">Sub-standard Delivery Rejection</option>
              </select>
            </div>

            <button type="submit" style={{ width: "100%", padding: "10px", background: '#1a1a18', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 8 }}>
              Commit To Leak Ledger
            </button>
          </form>
        </div>

        {/* COLUMN B: Historic Ledger Activity Feed */}
        <div style={{ flex: "1.5 1 360px", boxSizing: "border-box" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontFamily: "'Bitter', serif", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#0e0e0c" }}>
            <span>Historical Variance Logs</span>
            <span style={{ fontSize: 11, background: '#f5e9c8', padding: "2px 8px", borderRadius: 10, color: '#3a3530', border: '1px solid #1a1a18', fontFamily: "'JetBrains Mono', monospace" }}>
              {waste.length} Total
            </span>
          </h3>

          {waste.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", border: `1px dashed #5a4f40`, color: '#5a4f40', borderRadius: 4, background: '#f7f1e3' }}>
              No variance logs recorded in the active fiscal period.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {waste.map((log, idx) => {
                const logCost = parseFloat(log.cost || log.costPrice || 0);
                const logQty = parseFloat(log.qty || 0);
                return (
                  <div key={log.id || idx} style={{ 
                    background: '#efe6d3', 
                    border: `1px solid #1a1a18`, 
                    borderRadius: 4, 
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    boxSizing: "border-box"
                  }}>
                    {/* Item Title & Monetary Impact Statement */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0e0e0c' }}>{log.item || log.itemName || 'Unassigned Component'}</div>
                      <div style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: '#b8362a', whiteSpace: "nowrap" }}>
                        -{currencySymbol}{(logQty * logCost).toFixed(2)}
                      </div>
                    </div>

                    {/* Flex Wrap-Around Layout Badges */}
                    <div style={{ 
                      display: "flex", 
                      flexWrap: "wrap", 
                      gap: 6, 
                      fontSize: 11, 
                      color: '#5a4f40' 
                    }}>
                      <span style={{ background: '#f7f1e3', padding: "2px 6px", borderRadius: 2, border: `1px solid rgba(0,0,0,0.1)` }}>
                        Amount: <strong>{logQty} {log.unit || 'units'}</strong>
                      </span>
                      <span style={{ background: '#f7f1e3', padding: "2px 6px", borderRadius: 2, border: `1px solid rgba(0,0,0,0.1)` }}>
                        Cost/U: <strong>{currencySymbol}{logCost.toFixed(2)}</strong>
                      </span>
                      <span style={{ 
                        background: log.reason === 'Spoilage' ? '#b8362a' : '#1a1a18', 
                        color: '#fff', 
                        padding: "2px 6px", 
                        borderRadius: 2,
                        fontSize: 10,
                        fontWeight: 600
                      }}>
                        {log.reason || 'Variance'}
                      </span>
                    </div>
                    
                    {editIdx === idx && editDraft && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#fff', padding: 10, borderRadius: 4, border: '1px solid #c9bfae' }}>
                        <label style={{ gridColumn: '1 / -1', fontSize: 11, fontWeight: 700, color: '#5a4f40' }}>Item
                          <input style={editField} value={editDraft.item} onChange={e => setEditDraft({ ...editDraft, item: e.target.value })} /></label>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#5a4f40' }}>Quantity
                          <input style={editField} type="number" step="any" min="0" value={editDraft.qty} onChange={e => setEditDraft({ ...editDraft, qty: e.target.value })} /></label>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#5a4f40' }}>Unit
                          <input style={editField} value={editDraft.unit} onChange={e => setEditDraft({ ...editDraft, unit: e.target.value })} /></label>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#5a4f40' }}>Cost per unit ({currencySymbol})
                          <input style={editField} type="number" step="0.01" min="0" value={editDraft.cost} onChange={e => setEditDraft({ ...editDraft, cost: e.target.value })} /></label>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#5a4f40' }}>Reason
                          <select style={editField} value={editDraft.reason} onChange={e => setEditDraft({ ...editDraft, reason: e.target.value })}>
                            {['Spoilage', 'Over-production', 'Dropped/Spilled', 'Returned', 'Other', ...(['Spoilage','Over-production','Dropped/Spilled','Returned','Other'].includes(editDraft.reason) ? [] : [editDraft.reason])].map(r => <option key={r}>{r}</option>)}
                          </select></label>
                        {editErr && <div style={{ gridColumn: '1 / -1', color: '#b8362a', fontSize: 12 }}>{editErr}</div>}
                        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          <button type="button" style={rowEditBtn} onClick={() => { setEditIdx(null); setEditDraft(null); }}>Cancel</button>
                          <button type="button" style={{ ...rowEditBtn, background: '#1a1a18', color: '#fff', borderColor: '#1a1a18' }} onClick={saveEdit}>Save changes</button>
                        </div>
                      </div>
                    )}

                    {/* Datetime stamp + row actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {editIdx !== idx && <button type="button" style={rowEditBtn} aria-label={`Edit ${wasteLabel(log)}`} onClick={() => startEdit(idx)}>Edit</button>}
                        <button type="button" style={rowDeleteBtn} aria-label={`Delete ${wasteLabel(log)}`}
                          onClick={() => del.ask(idx, 'Delete this waste entry?', `${wasteLabel(log)} will be removed from waste and financial totals.`)}>Delete</button>
                      </div>
                      <div style={{ fontSize: 10, color: '#5a4f40', opacity: 0.8 }}>{log.date || 'Active Entry'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <ConfirmDeleteDialog open={!!del.pending} title={del.pending?.title} message={del.pending?.message} confirmLabel="Delete entry"
          onCancel={del.cancel} onConfirm={() => { if (editIdx !== null) { setEditIdx(null); setEditDraft(null); } del.confirm(`Deleted ${wasteLabel(waste[del.pending.index])}`); }} />
        <UndoBar message={del.undo?.label} onUndo={del.undoLast} />

      </div>
    </div>
  );
}

function PerformanceScreen({ recipes = [], components = [], planner = [], sales = [], waste = [], settings, totals = null }) {
  const currencySymbol = settings?.currency || '£'; // Fallback safely to defaults

  const report = useMemo(() => {
    if (totals) {
      const profitMargin = totals.revenue - totals.foodCost - totals.wasteCost;
      return {
        rawRevenue: totals.revenue, computedCost: totals.foodCost, leakCost: totals.wasteCost, profitMargin,
        finalEfficiencyPct: totals.revenue > 0 ? (profitMargin / totals.revenue) * 100 : 0,
        saleCount: totals.saleCount, matchedSales: totals.matchedSales, recipeCount: recipes.length, wasteCount: waste.length
      };
    }
    let rawRevenue = 0;
    let computedCost = 0;
    let matchedSales = 0;

    sales.forEach(s => {
      const r = recipes.find(x => x.id === s.recipeId);
      if (r) {
        matchedSales++;
        // DB column is sell_price (snake_case); fall back to legacy camelCase if present
        const sellPrice = parseFloat(r.sell_price ?? r.sellPrice ?? 0) || 0;
        rawRevenue += (s.sold * sellPrice);
        const { foodCost } = recipeCosting(r, components);
        computedCost += (s.sold * foodCost);
      }
    });

    const leakCost = waste.reduce((acc, w) => acc + (parseFloat(w.cost) || 0), 0);
    const profitMargin = rawRevenue - computedCost - leakCost;
    const finalEfficiencyPct = rawRevenue > 0 ? (profitMargin / rawRevenue) * 100 : 0;

    return {
      rawRevenue, computedCost, leakCost, profitMargin, finalEfficiencyPct,
      // Diagnostic counts for the empty-state hint
      saleCount: sales.length, matchedSales, recipeCount: recipes.length, wasteCount: waste.length
    };
  }, [recipes, components, sales, waste, totals]);

  return (
    <div style={S.container}>
      <ScreenHeader 
        title="Financial Engineering Balance Sheets" 
        sub="High fidelity gross margins integrated across physical waste tracking metrics" 
      />
      
      <div style={S.kpiGrid}>
        <Kpi 
          label="Gross Intake" 
          val={`${currencySymbol}${report.rawRevenue.toFixed(2)}`} 
          sub="Aggregated menu transactions" 
        />
        <Kpi 
          label="Target Stock Matrix" 
          val={`${currencySymbol}${report.computedCost.toFixed(2)}`} 
          sub="Theoretical product allocation" 
        />
        <Kpi 
          label="Spoilage Leakage" 
          val={`${currencySymbol}${report.leakCost.toFixed(2)}`} 
          sub="Recorded waste total logs" 
          color={report.leakCost > 0 ? C.red : C.ink} 
        />
        <Kpi 
          label="Net Yield Profit" 
          val={`${currencySymbol}${report.profitMargin.toFixed(2)}`} 
          sub={`Efficiency Margin: ${report.finalEfficiencyPct.toFixed(1)}%`} 
          badge={report.finalEfficiencyPct >= 70 ? "Healthy" : "Compressed"} 
          badgeColor={report.finalEfficiencyPct >= 70 ? C.green : C.red} 
        />
      </div>

      {/* Data-source guidance — surfaces what's missing so the user knows
          which tab to fill in to make these numbers come alive */}
      <div style={{ marginTop: 24, background: '#fff', border: `1px solid ${C.paper2}`, borderRadius: 6, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
          Inputs Driving This Report
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: C.ink }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: report.saleCount > 0 ? '#f0f4ec' : C.paper, borderRadius: 3 }}>
            <span>{report.saleCount > 0 ? '✓' : '○'} <strong>Sales</strong> — drives Gross Intake</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: C.inkFade }}>
              {report.saleCount} record(s){report.saleCount > 0 && `, ${report.matchedSales} matched to recipes`}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: report.recipeCount > 0 ? '#f0f4ec' : C.paper, borderRadius: 3 }}>
            <span>{report.recipeCount > 0 ? '✓' : '○'} <strong>Recipes</strong> — provide sell price + cost basis</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: C.inkFade }}>
              {report.recipeCount} recipe row(s)
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: report.wasteCount > 0 ? '#f0f4ec' : C.paper, borderRadius: 3 }}>
            <span>{report.wasteCount > 0 ? '✓' : '○'} <strong>Waste</strong> — drives Spoilage Leakage</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: C.inkFade }}>
              {report.wasteCount} entry(s)
            </span>
          </div>
        </div>
        {report.saleCount === 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: C.inkFade, fontStyle: 'italic', lineHeight: 1.5 }}>
            To populate this report: add sales on the <strong>Sales Analytics</strong> tab (or click Sync on a tile in <strong>POS Sync Gateway</strong> to drop in 6 test records). Then log any spoilage in <strong>Waste Tracker</strong>.
          </div>
        )}
      </div>
    </div>
  );
}

export function InvoicesScreen({ supabase, kitchenId, invoices = [], onUpdate, recipes = [], onUpdateRecipes, settings }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  // Manual entry / edit modal state
  const [manualOpen, setManualOpen] = useState(false);

  // Track viewport width so the manual / scan-review modal can switch
  // between a desktop grid layout and a mobile card-per-line layout.
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [manualEditingId, setManualEditingId] = useState(null); // null = creating new
  const [manualSupplier, setManualSupplier] = useState("");
  const [manualTotal, setManualTotal] = useState("");
  const [manualLines, setManualLines] = useState([
    { name: "", qty: "1", unit: "kg", price_per_unit: "", line_total: "" }
  ]);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState("");
  // True when the modal was opened from a scan result (review-before-save).
  // False when opened from "Enter Invoice Manually" or from an edit pencil.
  const [reviewingScan, setReviewingScan] = useState(false);
  
  const [showLaptopCamera, setShowLaptopCamera] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const cameraInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const safeInvoices = invoices || [];

  // Local DB-sourced list — the historical log reads from this so a fresh
  // save / delete is always reflected, independent of what useKitchenState
  // does with the prop downstream.
  const [localInvoices, setLocalInvoices] = useState(safeInvoices);
  useEffect(() => { setLocalInvoices(safeInvoices); }, [invoices]);
  const currentCurrency = settings?.currency || '£';

  const C = {
    paper: '#f7f1e3',
    paper2: '#efe6d3',
    ink: '#0e0e0c',
    inkFade: '#5a4f40',
    highlight: '#f5e9c8',
    accent: '#b8730a',
    green: '#4a6b3a',
    red: '#b8362a'
  };

  const S = {
    container: { display: 'flex', flexDirection: 'column' },
    card: { background: '#ffffff', border: `1px solid ${C.paper2}`, padding: '16px', borderRadius: '4px' }
  };

  // Pull the invoice list straight from the DB so the UI matches what's
  // actually saved (the app-state prop can drift if a delete leaves orphans).
  useEffect(() => {
    let cancelled = false;
    const loadInvoices = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = kitchenId || session?.user?.id;
        if (!uid) return;
        const { data } = await supabase
          .from('invoices')
          .select('*')
          .eq('kitchen_id', uid)
          .order('created_at', { ascending: false });
        if (!cancelled && data) {
          setLocalInvoices(data);
          if (onUpdate) onUpdate(data);
        }
      } catch (err) {
        console.error("Invoice list refresh failed:", err);
      }
    };
    loadInvoices();
    const onDbUpdate = () => loadInvoices();
    window.addEventListener('mise-db-update', onDbUpdate);
    return () => { cancelled = true; window.removeEventListener('mise-db-update', onDbUpdate); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitchenId]);

  // ============================================================
  // DATABASE RETRIEVAL & AI PROCESSING PIPELINE
  // ============================================================
  const handleStartParsingPipeline = async () => {
    if (!file || parsing) return;
    setParsing(true);
    try {
      if (!supabase) {
        throw new Error("Supabase client instance was not provided down via component context props.");
      }

      // 1. RESOLVE KITCHEN ID — use the prop (resolved from kitchen_members) if available,
      //    fall back to session.user.id for backward compatibility.
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const authorUserId = session?.user?.id;
      const activeKitchenId = kitchenId || authorUserId;
      if (!activeKitchenId) {
        throw new Error("No active kitchen found. Please log in again.");
      }

      // 2. Convert image file to raw base64 data stream string
      const base64Payload = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const base64String = reader.result.split(',')[1];
          resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
      });

      const fileExt = file.name ? file.name.split('.').pop() : 'jpg';

      // 3. Request data parsing via your local Edge Function runtime container
      const { data: result, error: functionError } = await supabase.functions
        .invoke('parse-invoice', {
          body: { 
            image: base64Payload, 
            fileType: fileExt, 
            currentRecipes: recipes 
          }
        });

      if (functionError) throw functionError;
      
      // 4. Extract standard flat schema maps out of response container
      const rawInvoice = result?.invoice || result?.data || result;
      if (!rawInvoice) {
        throw new Error("AI parsing container engine returned an empty response object.");
      }

      const extractedSupplier = rawInvoice.supplier || rawInvoice.vendor || 'Unknown Supplier';
      const extractedTotal = parseFloat(rawInvoice.total || rawInvoice.invoice_total || 0);
      const extractedItems = rawInvoice.items || rawInvoice.line_items || rawInvoice.lines || [];
      const extractedDate = rawInvoice.inv_date || rawInvoice.date || new Date().toISOString().split('T')[0];
      const extractedRef = 
        rawInvoice.ref || 
        rawInvoice.invoice_ref || 
        rawInvoice.invoice_number || 
        rawInvoice.id || 
        `INV-${Date.now().toString().slice(-6)}`;

      // 5. Strip currency symbols / commas before parsing (e.g. "£0.80" -> 0.80)
      const toNum = (v) => {
        if (typeof v === 'number') return isNaN(v) ? 0 : v;
        const cleaned = String(v == null ? '' : v).replace(/[^0-9.\-]/g, '');
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : n;
      };

      // 6. Hand the extracted data to the manual entry / review modal.
      //    Nothing is written to the database until the user clicks Save in
      //    the modal — same review pattern as the Recipe Digitizer.
      const reviewLines = (Array.isArray(extractedItems) ? extractedItems : []).map((item) => {
        const qty = toNum(item.qty || item.quantity || 1) || 1;
        let pricePerUnit = toNum(item.price_per_unit || item.unit_price || item.price || item.rate || 0);
        let lineTotal = toNum(item.line_total || item.total || item.amount || 0);
        if (pricePerUnit === 0 && lineTotal > 0 && qty > 0) pricePerUnit = lineTotal / qty;
        if (lineTotal === 0 && pricePerUnit > 0) lineTotal = pricePerUnit * qty;
        return {
          name: item.description || item.name || '',
          qty: String(qty),
          unit: item.unit || 'ea',
          price_per_unit: pricePerUnit ? String(pricePerUnit) : '',
          line_total: lineTotal ? String(lineTotal) : ''
        };
      });
      const anyPricedLine = reviewLines.some(l => parseFloat(l.price_per_unit) > 0 || parseFloat(l.line_total) > 0);

      // Populate the manual-entry modal in "new invoice" mode
      setManualEditingId(null);
      setReviewingScan(true);
      setManualSupplier(extractedSupplier || '');
      setManualTotal(extractedTotal ? String(extractedTotal) : '');
      setManualLines(reviewLines.length > 0 ? reviewLines : [{ name: '', qty: '1', unit: 'kg', price_per_unit: '', line_total: '' }]);
      setManualError('');
      setManualOpen(true);

      clearStagedFile();

      if (reviewLines.length === 0) {
        alert("⚠️ The scan returned 0 line items. Add lines manually in the review screen, then Save.");
      } else if (!anyPricedLine) {
        alert(
          "⚠️ Scan partially worked.\n\n" +
          "The AI read " + reviewLines.length + " item(s) (names, quantities, units) but couldn't read prices on this scan. " +
          "Review the items below and type the prices in before saving."
        );
      }

    } catch (error) {
      console.error("Critical extraction fault:", error);
      alert("Failed to analyze text document: " + error.message);
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setShowOptions(false);
  };

  const handleTakePhoneOrLaptopPhoto = async () => {
    setShowOptions(false);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      cameraInputRef.current?.click();
    } else {
      setShowLaptopCamera(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        alert("Webcam error: " + err.message);
        setShowLaptopCamera(false);
      }
    }
  };

  const captureLaptopSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      if (!blob) return;
      const capturedFile = new File([blob], `captured_invoice_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setFile(capturedFile);
      setPreviewUrl(URL.createObjectURL(capturedFile));
      closeLaptopCamera();
    }, 'image/jpeg');
  };

  const closeLaptopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    streamRef.current = null;
    setShowLaptopCamera(false);
  };

  const clearStagedFile = () => {
    setFile(null);
    setPreviewUrl(null);
  };

  // ============================================================
  // MANUAL ENTRY / EDIT / DELETE — Invoices
  // ============================================================
  const resetManualForm = () => {
    setManualEditingId(null);
    setManualSupplier("");
    setManualTotal("");
    setManualLines([{ name: "", qty: "1", unit: "kg", price_per_unit: "", line_total: "" }]);
    setManualError("");
    setReviewingScan(false);
  };

  const handleOpenManualInvoice = () => {
    resetManualForm();
    setManualOpen(true);
  };

  const handleEditInvoice = async (inv) => {
    if (!inv) return;
    setManualError("");
    setReviewingScan(false);
    setManualEditingId(inv.id);
    setManualSupplier(inv.supplier || "");
    setManualTotal(inv.total != null ? String(inv.total) : "");
    // Load this invoice's existing line items
    try {
      const { data: lineRows } = await supabase
        .from('invoice_lines')
        .select('*')
        .eq('invoice_id', inv.id)
        .order('position', { ascending: true });
      if (lineRows && lineRows.length > 0) {
        setManualLines(lineRows.map(l => ({
          name: l.name || "",
          qty: l.qty != null ? String(l.qty) : "1",
          unit: l.unit || "ea",
          price_per_unit: l.price_per_unit != null ? String(l.price_per_unit) : "",
          line_total: l.line_total != null ? String(l.line_total) : ""
        })));
      } else {
        setManualLines([{ name: "", qty: "1", unit: "kg", price_per_unit: "", line_total: "" }]);
      }
    } catch (err) {
      console.error("Failed to load invoice lines for edit:", err);
    }
    setManualOpen(true);
  };

  const handleDeleteInvoice = async (inv) => {
    if (!inv) return;
    const confirmed = typeof window !== 'undefined'
      ? window.confirm(`Delete invoice from "${inv.supplier || 'Unknown'}" (${currentCurrency}${parseFloat(inv.total || 0).toFixed(2)}) and all its line items?`)
      : true;
    if (!confirmed) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const activeKitchenId = kitchenId || session?.user?.id;

      // Lines first (no cascade assumed). .select() makes the API return the rows
      // that were actually deleted — empty array means the DB silently refused.
      const { data: deletedLines, error: linesErr } = await supabase
        .from('invoice_lines')
        .delete()
        .eq('invoice_id', inv.id)
        .select();
      if (linesErr) throw linesErr;

      const { data: deletedInvoice, error: invErr } = await supabase
        .from('invoices')
        .delete()
        .eq('id', inv.id)
        .select();
      if (invErr) throw invErr;

      if (!deletedInvoice || deletedInvoice.length === 0) {
        throw new Error("The database returned 0 rows deleted. This usually means a Row-Level-Security policy is blocking DELETE on the 'invoices' table for this user. Open Supabase → Authentication → Policies and make sure there's a DELETE policy that allows kitchen_id = auth.uid().");
      }

      // Refresh the list straight from the DB so the UI matches reality
      if (activeKitchenId) {
        const { data: refreshed } = await supabase
          .from('invoices')
          .select('*')
          .eq('kitchen_id', activeKitchenId)
          .order('created_at', { ascending: false });
        if (refreshed) {
          setLocalInvoices(refreshed);
          if (onUpdate) onUpdate(refreshed);
        }
      } else {
        const remaining = localInvoices.filter(i => i.id !== inv.id);
        setLocalInvoices(remaining);
        if (onUpdate) onUpdate(remaining);
      }

      window.dispatchEvent(new Event('mise-db-update'));
      alert(`Deleted invoice from "${inv.supplier || 'Unknown'}" and ${deletedLines ? deletedLines.length : 0} line item(s).`);
    } catch (err) {
      console.error("Delete invoice failed:", err);
      alert("Failed to delete invoice:\n\n" + (err.message || err));
    }
  };

  const updateManualLine = (idx, field, value) => {
    setManualLines(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };
  const addManualLine = () => {
    setManualLines(prev => [...prev, { name: "", qty: "1", unit: "kg", price_per_unit: "", line_total: "" }]);
  };
  const removeManualLine = (idx) => {
    setManualLines(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  };

  const handleSaveManualInvoice = async () => {
    setManualError("");
    if (!manualSupplier.trim()) {
      setManualError("Enter a supplier name.");
      return;
    }
    const validLines = manualLines.filter(l => (l.name || "").trim());
    if (validLines.length === 0) {
      setManualError("Add at least one line item with a name.");
      return;
    }

    setManualSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authorUserId = session?.user?.id;
      const activeKitchenId = kitchenId || authorUserId;
      if (!activeKitchenId) throw new Error("No active session — please log in again.");

      // Compute the total from the lines if the user didn't enter one
      const computedTotal = validLines.reduce((sum, l) => {
        const lt = parseFloat(l.line_total) || (parseFloat(l.qty || 1) * parseFloat(l.price_per_unit || 0)) || 0;
        return sum + lt;
      }, 0);
      const totalToSave = parseFloat(manualTotal) || computedTotal;

      let invoiceId = manualEditingId;

      if (manualEditingId) {
        // EDIT: update header, then wipe + replace its lines
        const { data: updatedRows, error: updErr } = await supabase
          .from('invoices')
          .update({
            supplier: manualSupplier.trim(),
            total: totalToSave,
            last_edited_by: authorUserId,
            last_edited_at: new Date().toISOString()
          })
          .eq('id', manualEditingId)
          .select();
        if (updErr) throw updErr;
        if (!updatedRows || updatedRows.length === 0) {
          throw new Error("The invoice update returned 0 rows. A Row-Level-Security UPDATE policy on the 'invoices' table is probably blocking this user from editing.");
        }
        const { error: linesDelErr } = await supabase
          .from('invoice_lines')
          .delete()
          .eq('invoice_id', manualEditingId)
          .select();
        if (linesDelErr) {
          throw new Error("Failed to clear the old line items before re-inserting: " + linesDelErr.message);
        }
      } else {
        // CREATE
        const { data: inserted, error: insErr } = await supabase
          .from('invoices')
          .insert([{
            kitchen_id: activeKitchenId,
            supplier: manualSupplier.trim(),
            total: totalToSave,
            ref: `MAN-${Date.now().toString(36).toUpperCase()}`, // satisfies NOT NULL; uniqueness via timestamp
            inv_date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD form, matches OCR pipeline
            created_at: new Date().toISOString(),
            created_by: authorUserId,
            last_edited_by: authorUserId,
            last_edited_at: new Date().toISOString()
          }])
          .select()
          .single();
        if (insErr) throw insErr;
        invoiceId = inserted.id;
      }

      const linesToInsert = validLines.map((l, idx) => {
        const qty = parseFloat(l.qty) || 1;
        let pricePerUnit = parseFloat(l.price_per_unit) || 0;
        let lineTotal = parseFloat(l.line_total) || 0;
        if (pricePerUnit === 0 && lineTotal > 0 && qty > 0) pricePerUnit = lineTotal / qty;
        if (lineTotal === 0 && pricePerUnit > 0) lineTotal = pricePerUnit * qty;
        return {
          kitchen_id: activeKitchenId,
          invoice_id: invoiceId,
          position: idx + 1,
          name: l.name.trim(),
          qty: qty,
          unit: (l.unit || "ea").trim(),
          price_per_unit: pricePerUnit,
          line_total: lineTotal,
          created_by: authorUserId,
          last_edited_by: authorUserId,
          last_edited_at: new Date().toISOString()
        };
      });

      const { error: linesErr } = await supabase.from('invoice_lines').insert(linesToInsert);
      if (linesErr) throw linesErr;

      // Refresh local list
      const { data: refreshed } = await supabase
        .from('invoices')
        .select('*')
        .eq('kitchen_id', activeKitchenId)
        .order('created_at', { ascending: false });
      if (refreshed) {
        setLocalInvoices(refreshed);
        if (onUpdate) onUpdate(refreshed);
      }

      window.dispatchEvent(new Event('mise-db-update'));
      setManualOpen(false);
      const wasEditing = !!manualEditingId;
      const wasReviewing = reviewingScan;
      resetManualForm();
      // Visible confirmation so the user can see what happened
      const newSupplier = manualSupplier.trim();
      setTimeout(() => {
        alert(
          wasEditing
            ? `✓ Invoice "${newSupplier}" updated.`
            : wasReviewing
              ? `✓ Scanned invoice from "${newSupplier}" saved. You'll find it in the Historical Tenant Document Logs below, and the prices are now live in Recipes & Costs.`
              : `✓ Invoice from "${newSupplier}" saved.`
        );
      }, 50);
    } catch (err) {
      console.error("Manual invoice save failed:", err);
      setManualError(err.message || "Save failed.");
    } finally {
      setManualSaving(false);
    }
  };

  return (
    <div style={S.container}>
      {/* HEADER SECTION */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Bitter', serif", fontSize: 24, margin: '0 0 4px 0', color: C.ink }}>
          AI Invoice Processing
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: C.inkFade }}>
          Digitize delivery notes directly into recipe tracking templates
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
        <input type="file" accept="image/*" ref={photoInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
        <input type="file" accept=".pdf,.doc,.docx,.txt,image/*" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />

        {/* FEED CARD BLOCK */}
        <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: C.inkFade, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px' }}>
            CAPTURE FEED INPUT
          </div>

          {!file && !showLaptopCamera && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 10, padding: '20px 0' }}>
              <button
                onClick={() => !parsing && setShowOptions(true)}
                disabled={parsing}
                style={{
                  background: '#ffffff',
                  color: C.ink,
                  border: `1px solid ${C.paper2}`,
                  borderRadius: '4px',
                  padding: '12px 24px', 
                  fontSize: '13px', 
                  fontWeight: '700',
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: parsing ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease'
                }}
              >
                + Scan Invoice
              </button>
              <button
                onClick={() => !parsing && handleOpenManualInvoice()}
                disabled={parsing}
                style={{
                  background: C.paper,
                  color: C.ink,
                  border: `1px solid ${C.paper2}`,
                  borderRadius: '4px',
                  padding: '12px 24px',
                  fontSize: '13px',
                  fontWeight: '700',
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: parsing ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                ✏️ Enter Invoice Manually
              </button>
            </div>
          )}

          {showLaptopCamera && (
            <div style={{ padding: '4px 0', textAlign: 'center' }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxWidth: '400px', borderRadius: '4px', background: '#000' }} />
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px' }}>
                <button onClick={captureLaptopSnapshot} style={{ background: C.ink, color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>📸 Capture Photo</button>
                <button onClick={closeLaptopCamera} style={{ background: C.paper, color: C.ink, border: `1px solid ${C.paper2}`, padding: '8px 16px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* OPTIONS MODAL POPUP */}
        {showOptions && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(14, 14, 12, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#ffffff', border: `1px solid ${C.paper2}`, borderRadius: '6px', width: '100%', maxWidth: '300px', padding: '16px', boxShadow: '0 12px 36px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '6px', borderBottom: `1px solid ${C.paper2}` }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: C.inkFade, fontFamily: "'JetBrains Mono', monospace" }}>SELECT DOCUMENT SOURCE</span>
                <button onClick={() => setShowOptions(false)} style={{ background: 'none', border: 'none', color: C.inkFade, fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={() => { fileInputRef.current?.click(); setShowOptions(false); }} style={{ background: C.paper, color: C.ink, border: `1px solid ${C.paper2}`, borderRadius: '4px', padding: '12px', textAlign: 'left', fontSize: '13px', cursor: 'pointer' }}>📁 Select File</button>
                <button onClick={() => { photoInputRef.current?.click(); setShowOptions(false); }} style={{ background: C.paper, color: C.ink, border: `1px solid ${C.paper2}`, borderRadius: '4px', padding: '12px', textAlign: 'left', fontSize: '13px', cursor: 'pointer' }}>🖼️ Select Photo</button>
                <button onClick={handleTakePhoneOrLaptopPhoto} style={{ background: C.paper, color: C.ink, border: `1px solid ${C.paper2}`, borderRadius: '4px', padding: '12px', textAlign: 'left', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>📷 Take a photo</button>
              </div>
            </div>
          </div>
        )}

        {/* ACTIONS PANEL STAGE FRAME */}
        {previewUrl && !showLaptopCamera && (
          <div style={{ background: C.paper, border: `1px solid ${C.paper2}`, padding: '24px', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', background: C.paper2, padding: '12px', border: `1px solid ${C.paper2}`, borderRadius: '4px', position: 'relative', marginBottom: 16 }}>
              <img src={previewUrl} alt="Staged View" style={{ maxHeight: '220px', maxWidth: '100%', objectFit: 'contain' }} />
              <button onClick={clearStagedFile} style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(255,255,255,0.9)', border: `1px solid ${C.paper2}`, color: C.ink, borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>×</button>
            </div>
            
            <button 
              onClick={handleStartParsingPipeline}
              disabled={parsing} 
              style={{ 
                width: '100%', 
                padding: '16px', 
                fontSize: '13px', 
                fontFamily: "'JetBrains Mono', monospace", 
                fontWeight: 700, 
                background: C.green, 
                color: '#fff', 
                borderRadius: '4px', 
                border: 'none',
                cursor: parsing ? 'not-allowed' : 'pointer',
                opacity: parsing ? 0.7 : 1
              }}
            >
              {parsing ? "SOUS IS ANALYZING SYSTEM LEDGERS..." : "⚡ PARSE TEXT & UPDATE COST MATRICES"}
            </button>
          </div>
        )}

        {/* HISTORICAL LEDGER FRAME CARD */}
        <div style={S.card}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: C.inkFade, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', marginBottom: '8px' }}>
            HISTORICAL TENANT DOCUMENT LOGS
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 300, marginTop: 12 }}>
            {localInvoices.length === 0 ? (
              <p style={{ fontSize: 12, color: C.inkFade, fontStyle: 'italic' }}>No processed items mapped inside local ledger frame cache.</p>
            ) : (
              localInvoices.map((inv) => (
                <div key={inv.id} style={{ padding: '10px 12px', background: C.highlight, borderBottom: `1px solid ${C.paper2}`, marginBottom: 6, borderLeft: `3px solid ${C.accent}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: 14, gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{inv.supplier}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{currentCurrency}{parseFloat(inv.total || 0).toFixed(2)}</span>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => handleEditInvoice(inv)}
                        title="Edit invoice"
                        style={{ background: 'transparent', color: C.ink, border: `1px solid ${C.paper2}`, borderRadius: 3, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteInvoice(inv)}
                        title="Delete invoice"
                        style={{ background: 'transparent', color: C.red, border: `1px solid ${C.red}`, borderRadius: 3, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MANUAL INVOICE ENTRY / EDIT MODAL */}
      {manualOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,14,12,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 6, width: '100%', maxWidth: 760, maxHeight: '90vh', overflowY: 'auto', padding: 18, boxShadow: '0 12px 36px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${C.paper2}` }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.inkFade, letterSpacing: '0.5px', fontFamily: "'JetBrains Mono', monospace" }}>
                  {manualEditingId ? "EDIT INVOICE" : reviewingScan ? "REVIEW SCANNED INVOICE" : "NEW MANUAL INVOICE"}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
                  {manualEditingId
                    ? "Update supplier, total, and line items"
                    : reviewingScan
                      ? "Check the AI-extracted details below and edit before saving"
                      : "Type the invoice details directly"}
                </div>
              </div>
              <button onClick={() => { setManualOpen(false); resetManualForm(); }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            {manualError && (
              <div style={{ background: C.red, color: '#fff', padding: '8px 12px', borderRadius: 4, marginBottom: 12, fontSize: 12, fontWeight: 600 }}>
                ⚠️ {manualError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: C.inkFade }}>
                Supplier
                <input
                  type="text"
                  value={manualSupplier}
                  onChange={(e) => setManualSupplier(e.target.value)}
                  placeholder="e.g. Wellocks Fine Foods"
                  style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, border: `1px solid ${C.paper2}`, borderRadius: 4, marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: 11, color: C.inkFade }}>
                Invoice Total ({currentCurrency}) — optional, auto-summed from lines if blank
                <input
                  type="number"
                  step="0.01"
                  value={manualTotal}
                  onChange={(e) => setManualTotal(e.target.value)}
                  placeholder="0.00"
                  style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, border: `1px solid ${C.paper2}`, borderRadius: 4, marginTop: 4 }}
                />
              </label>
            </div>

            <div style={{ fontSize: 11, fontWeight: 800, color: C.inkFade, marginBottom: 6, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Line items
            </div>

            {/* Column headers — matches the grid below so labels sit above their inputs.
                Headers hidden on mobile since the mobile layout uses inline labels. */}
            {!isMobile && (
              <div style={{ padding: '0 8px', display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1fr) 32px', gap: 6, fontSize: 10, fontWeight: 800, color: C.accent, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 4 }}>
                <div>Item Name</div>
                <div>Qty</div>
                <div>Unit</div>
                <div>Unit Price ({currentCurrency})</div>
                <div>Line Total ({currentCurrency})</div>
                <div></div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {manualLines.map((row, idx) => isMobile ? (
                // -------- Mobile card per line --------
                <div key={idx} style={{ background: C.paper, border: `1px solid ${C.paper2}`, borderRadius: 4, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: C.accent, letterSpacing: '0.5px' }}>LINE {idx + 1}</div>
                    <button
                      onClick={() => removeManualLine(idx)}
                      disabled={manualLines.length === 1}
                      style={{ background: 'transparent', color: manualLines.length === 1 ? C.inkFade : C.red, border: `1px solid ${manualLines.length === 1 ? C.paper2 : C.red}`, borderRadius: 3, padding: '4px 10px', fontSize: 11, cursor: manualLines.length === 1 ? 'not-allowed' : 'pointer' }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                  <label style={{ display: 'block', fontSize: 10, color: C.inkFade, fontWeight: 700, marginBottom: 2, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Item Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Milk"
                    value={row.name}
                    onChange={(e) => updateManualLine(idx, 'name', e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, border: `1px solid ${C.paper2}`, borderRadius: 3, marginBottom: 8 }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, color: C.inkFade, fontWeight: 700, marginBottom: 2, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Qty</label>
                      <input type="text" value={row.qty} onChange={(e) => updateManualLine(idx, 'qty', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, border: `1px solid ${C.paper2}`, borderRadius: 3 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, color: C.inkFade, fontWeight: 700, marginBottom: 2, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Unit</label>
                      <input type="text" value={row.unit} onChange={(e) => updateManualLine(idx, 'unit', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, border: `1px solid ${C.paper2}`, borderRadius: 3 }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, color: C.inkFade, fontWeight: 700, marginBottom: 2, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Unit Price ({currentCurrency})</label>
                      <input type="number" step="0.01" value={row.price_per_unit} onChange={(e) => updateManualLine(idx, 'price_per_unit', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, border: `1px solid ${C.paper2}`, borderRadius: 3 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, color: C.inkFade, fontWeight: 700, marginBottom: 2, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Line Total ({currentCurrency})</label>
                      <input type="number" step="0.01" value={row.line_total} onChange={(e) => updateManualLine(idx, 'line_total', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, border: `1px solid ${C.paper2}`, borderRadius: 3 }} />
                    </div>
                  </div>
                </div>
              ) : (
                // -------- Desktop grid row --------
                <div key={idx} style={{ background: C.paper, border: `1px solid ${C.paper2}`, borderRadius: 4, padding: 8, display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1fr) 32px', gap: 6, alignItems: 'center' }}>
                  <input type="text" placeholder="Item name (e.g. Milk)" value={row.name} onChange={(e) => updateManualLine(idx, 'name', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: 6, fontSize: 12, border: `1px solid ${C.paper2}`, borderRadius: 3, minWidth: 0 }} />
                  <input type="text" placeholder="Qty" value={row.qty} onChange={(e) => updateManualLine(idx, 'qty', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: 6, fontSize: 12, border: `1px solid ${C.paper2}`, borderRadius: 3, minWidth: 0 }} />
                  <input type="text" placeholder="Unit" value={row.unit} onChange={(e) => updateManualLine(idx, 'unit', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: 6, fontSize: 12, border: `1px solid ${C.paper2}`, borderRadius: 3, minWidth: 0 }} />
                  <input type="number" step="0.01" placeholder={`Price/unit`} value={row.price_per_unit} onChange={(e) => updateManualLine(idx, 'price_per_unit', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: 6, fontSize: 12, border: `1px solid ${C.paper2}`, borderRadius: 3, minWidth: 0 }} />
                  <input type="number" step="0.01" placeholder={`Line total`} value={row.line_total} onChange={(e) => updateManualLine(idx, 'line_total', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: 6, fontSize: 12, border: `1px solid ${C.paper2}`, borderRadius: 3, minWidth: 0 }} />
                  <button onClick={() => removeManualLine(idx)} disabled={manualLines.length === 1} title="Remove line" style={{ background: 'transparent', color: manualLines.length === 1 ? C.inkFade : C.red, border: `1px solid ${manualLines.length === 1 ? C.paper2 : C.red}`, borderRadius: 3, padding: '4px 8px', fontSize: 12, cursor: manualLines.length === 1 ? 'not-allowed' : 'pointer' }}>✕</button>
                </div>
              ))}
            </div>

            <button
              onClick={addManualLine}
              style={{ background: 'transparent', color: C.ink, border: `1px dashed ${C.paper2}`, padding: '8px 12px', borderRadius: 4, fontSize: 12, cursor: 'pointer', width: '100%', marginBottom: 14 }}
            >
              + Add Another Line
            </button>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: `1px solid ${C.paper2}`, paddingTop: 12 }}>
              <button
                onClick={() => { setManualOpen(false); resetManualForm(); }}
                style={{ background: C.paper, color: C.ink, border: `1px solid ${C.paper2}`, padding: '10px 16px', borderRadius: 4, fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveManualInvoice}
                disabled={manualSaving}
                style={{ background: manualSaving ? '#555' : C.accent, color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: manualSaving ? 'not-allowed' : 'pointer' }}
              >
                {manualSaving ? "💾 Saving..." : (manualEditingId ? "💾 Save Changes" : "💾 Save Invoice")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SuppliersScreen({ supabase, kitchenId, settings }) {
  const currency = settings?.currency || '£';
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);          // matrix derived from real invoices
  const [supplierCount, setSupplierCount] = useState(0);
  const [totalSavings, setTotalSavings] = useState(0);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Build the comparison matrix from real invoice data for this kitchen.
  // Strategy:
  //   1. Pull every invoice + every line in this kitchen.
  //   2. Group lines by lower(name); for each name capture {supplier -> latest price/unit}.
  //   3. Display items that have at least one priced line. Highlight cheapest.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!supabase || !kitchenId) { setLoading(false); return; }
      try {
        setLoading(true);
        const [invRes, lineRes] = await Promise.all([
          supabase.from('invoices').select('id, supplier, kitchen_id').eq('kitchen_id', kitchenId),
          supabase.from('invoice_lines').select('invoice_id, name, unit, price_per_unit, line_total, last_edited_at').eq('kitchen_id', kitchenId)
        ]);
        if (cancelled) return;
        const invoices = invRes.data || [];
        const lines    = lineRes.data || [];
        const supplierById = new Map(invoices.map(i => [i.id, (i.supplier || 'Unknown').trim()]));

        // Items → Map<supplier, {price, unit, ts}>
        const byItem = new Map();
        const supplierSet = new Set();
        for (const l of lines) {
          const supplier = supplierById.get(l.invoice_id);
          if (!supplier) continue;
          const price = Number(l.price_per_unit) || 0;
          if (price <= 0) continue; // skip priceless rows so they don't pollute the comparison
          const key = (l.name || '').trim();
          if (!key) continue;
          supplierSet.add(supplier);
          if (!byItem.has(key)) byItem.set(key, new Map());
          const prev = byItem.get(key).get(supplier);
          const ts = l.last_edited_at ? new Date(l.last_edited_at).getTime() : 0;
          // Keep the most-recent priced entry per (item, supplier)
          if (!prev || ts >= prev.ts) {
            byItem.get(key).set(supplier, { price, unit: l.unit || '', ts });
          }
        }

        let savings = 0;
        const matrix = [];
        for (const [name, suppliers] of byItem) {
          const offers = Array.from(suppliers.entries()).map(([s, v]) => ({ supplier: s, price: v.price, unit: v.unit }));
          if (offers.length === 0) continue;
          offers.sort((a, b) => a.price - b.price);
          const cheapest = offers[0];
          const dearest  = offers[offers.length - 1];
          const saving   = offers.length > 1 ? (dearest.price - cheapest.price) : 0;
          savings += saving;
          matrix.push({ name, offers, cheapestSupplier: cheapest.supplier, saving, unit: cheapest.unit });
        }
        matrix.sort((a, b) => b.saving - a.saving);

        setRows(matrix);
        setSupplierCount(supplierSet.size);
        setTotalSavings(savings);
      } catch (err) {
        console.error("Market Intel load failed:", err);
        setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const onUpdate = () => load();
    window.addEventListener('mise-db-update', onUpdate);
    return () => { cancelled = true; window.removeEventListener('mise-db-update', onUpdate); };
  }, [supabase, kitchenId]);

  // Sorted list of every supplier seen, for table headers
  const supplierColumns = Array.from(
    new Set(rows.flatMap(r => r.offers.map(o => o.supplier)))
  ).sort();

  const headerBlock = (
    <ScreenHeader title="Cross Wholesaler Pricing Matrices" sub="Compare prices across the suppliers you've scanned invoices from" />
  );

  if (loading) {
    return (
      <div style={S.container}>
        {headerBlock}
        <div style={{ ...S.card, color: C.inkFade, fontSize: 13 }}>Loading from your invoice history…</div>
      </div>
    );
  }

  // EMPTY STATE — no priced lines, or only one supplier
  if (rows.length === 0 || supplierCount < 2) {
    return (
      <div style={S.container}>
        {headerBlock}
        <div style={{ background: '#fff', border: `1px solid ${C.paper2}`, borderRadius: 6, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.ink, marginBottom: 6 }}>
            {rows.length === 0
              ? "No supplier data yet"
              : `Only one supplier scanned (${supplierColumns[0] || ''})`}
          </div>
          <div style={{ fontSize: 13, color: C.inkFade, maxWidth: 540, margin: '0 auto', lineHeight: 1.5 }}>
            Market Intel compares prices across the suppliers you've scanned invoices from. {rows.length === 0
              ? "Scan invoices from at least two suppliers in Invoice Scan and the price comparison will appear here."
              : "Scan an invoice from a different supplier and the comparison will appear automatically."}
          </div>
        </div>
      </div>
    );
  }

  // Mobile card layout
  if (isMobile) {
    return (
      <div style={S.container}>
        {headerBlock}
        <div style={{ background: '#121210', color: '#fff', padding: 12, borderRadius: 4, marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.accent, letterSpacing: 1, textTransform: 'uppercase' }}>Potential Saving / unit (buy cheapest)</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
            {currency}{totalSavings.toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: C.inkFade, marginTop: 4 }}>
            Across {rows.length} items, {supplierCount} suppliers
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(({ name, offers, cheapestSupplier, saving, unit }) => (
            <div key={name} style={{ background: '#fff', border: `1px solid ${C.paper2}`, borderRadius: 4, padding: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 8 }}>
                {name} {unit && <span style={{ color: C.inkFade, fontWeight: 500, fontSize: 11 }}>/ {unit}</span>}
              </div>
              {offers.map(o => {
                const isCheapest = o.supplier === cheapestSupplier && offers.length > 1;
                return (
                  <div key={o.supplier} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${C.paper2}` }}>
                    <span style={{ fontSize: 13, color: C.ink, fontWeight: isCheapest ? 700 : 500 }}>
                      {o.supplier}
                      {isCheapest && <span style={{ marginLeft: 6, background: '#4a6b3a', color: '#fff', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700 }}>BEST</span>}
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: isCheapest ? '#4a6b3a' : C.ink }}>
                      {currency}{o.price.toFixed(2)}
                    </span>
                  </div>
                );
              })}
              {saving > 0 && (
                <div style={{ fontSize: 11, color: C.inkFade, marginTop: 6 }}>
                  Save {currency}{saving.toFixed(2)}/unit by buying from {cheapestSupplier}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Desktop table
  return (
    <div style={S.container}>
      {headerBlock}

      <div style={{ background: '#121210', color: '#fff', padding: 14, borderRadius: 4, marginBottom: 16, display: 'inline-block' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: C.accent, letterSpacing: 1, textTransform: 'uppercase' }}>Total Potential Saving / unit</div>
        <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
          {currency}{totalSavings.toFixed(2)}
        </div>
        <div style={{ fontSize: 11, color: C.inkFade, marginTop: 4 }}>
          {rows.length} items, {supplierCount} suppliers
        </div>
      </div>

      <div style={{ ...S.card, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #1a1a18' }}>
              <th style={{ padding: 10 }}><SectionLabel label="Commodity Row" /></th>
              {supplierColumns.map(s => (
                <th key={s} style={{ padding: 10 }}><SectionLabel label={s} /></th>
              ))}
              <th style={{ padding: 10 }}><SectionLabel label="Save / unit" /></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ name, offers, cheapestSupplier, saving, unit }) => {
              const priceBy = Object.fromEntries(offers.map(o => [o.supplier, o.price]));
              return (
                <tr key={name} style={{ borderBottom: `1px solid ${C.paper2}` }}>
                  <td style={{ padding: 12, fontWeight: 700 }}>
                    {name}
                    {unit && <span style={{ color: C.inkFade, fontWeight: 500, fontSize: 11, marginLeft: 4 }}>/ {unit}</span>}
                  </td>
                  {supplierColumns.map(s => {
                    const price = priceBy[s];
                    const isCheapest = s === cheapestSupplier && offers.length > 1;
                    return (
                      <td key={s} style={{ padding: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: isCheapest ? 800 : 500, color: price == null ? C.inkFade : (isCheapest ? '#4a6b3a' : C.ink), background: isCheapest ? '#f0f4ec' : 'transparent' }}>
                        {price == null ? '—' : `${currency}${price.toFixed(2)}`}
                        {isCheapest && <span style={{ marginLeft: 6, background: '#4a6b3a', color: '#fff', padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 700 }}>BEST</span>}
                      </td>
                    );
                  })}
                  <td style={{ padding: 12, fontFamily: "'JetBrains Mono', monospace", color: saving > 0 ? C.accent : C.inkFade, fontWeight: 700 }}>
                    {saving > 0 ? `${currency}${saving.toFixed(2)}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PosScreen({ sales, recipes, onUpdate }) {
  const [syncing, setSyncing] = useState(false);

  const triggerSync = () => {
    setSyncing(true);
    setTimeout(() => {
      // Group flat ingredient rows into distinct recipes; we need
      // real recipe IDs so the mock sales actually link to them in
      // Sales Analytics and contribute to Financial Matrix revenue.
      const grouped = groupRecipesByName(recipes);
      if (grouped.length === 0) {
        alert("No recipes saved yet. Add a recipe via Recipe Digitizer first — the POS sync injects sales that bind to real recipes.");
        setSyncing(false);
        return;
      }

      // Build 6 mock Friday transactions cycling through the kitchen's
      // actual recipes
      const sessions     = ['Lunch', 'Lunch', 'Lunch', 'Dinner', 'Dinner', 'Dinner'];
      const quantities   = [12, 8, 5, 18, 14, 9];
      const newRecords   = sessions.map((session, i) => ({
        day: 'Fri',
        session,
        recipeId: grouped[i % grouped.length].id,
        sold: quantities[i]
      }));

      // Merge additively with existing sales
      const merged = [...sales];
      newRecords.forEach(rec => {
        const idx = merged.findIndex(s => s.day === rec.day && s.session === rec.session && s.recipeId === rec.recipeId);
        if (idx !== -1) merged[idx] = { ...merged[idx], sold: merged[idx].sold + rec.sold };
        else merged.push(rec);
      });

      onUpdate(merged);
      setSyncing(false);
      alert(`✓ Injected 6 mock Friday sales mapped to your real recipes. Open Sales Analytics or Financial Matrix to see them.`);
    }, 1200);
  };

  const clearAllSales = () => {
    if (!sales || sales.length === 0) {
      alert("Sales list is already empty.");
      return;
    }
    if (window.confirm(`Wipe all ${sales.length} sales record(s)? This cannot be undone.`)) {
      onUpdate([]);
    }
  };

  return (
    <div style={S.container}>
      <ScreenHeader title="Point Of Sale Synchronization Gateways" sub="Interface registers and streaming terminal transactions into the tracking engine" />

      <div style={{ background: '#fff8e9', border: `1px solid ${C.accent}`, borderLeft: `4px solid ${C.accent}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>How sync works (test mode)</div>
        <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.5 }}>
          Real POS integrations aren't connected yet — these are demo providers. Tapping <strong>Sync</strong> on any tile drops 6 sample Friday transactions <em>bound to your real saved recipes</em>, so <strong>Sales Analytics</strong> and <strong>Financial Matrix</strong> populate with meaningful data.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: C.inkFade }}>
          Currently {sales?.length || 0} sales record(s) in your ledger.
        </div>
        {sales?.length > 0 && (
          <button onClick={clearAllSales} style={{ background: 'transparent', border: `1px solid ${C.red}`, color: C.red, padding: '6px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer', borderRadius: 3 }}>
            ✕ Clear All Sales
          </button>
        )}
      </div>

      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:20}}>
        {POS_PROVIDERS.map(p => (
          <div key={p.id} style={S.card}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
              <div style={{fontSize:24}}>{p.logo}</div>
              {p.popular && <span style={{fontSize:9, background:C.accent, color:"white", padding:"2px 6px"}}>SUPPORTED</span>}
            </div>
            <h3 style={{fontFamily:"'Bitter', serif", fontSize:18, fontWeight:900, margin:"0 0 6px 0"}}>{p.name}</h3>
            <p style={{fontSize:12, color:C.inkFade, marginBottom:14}}>{p.desc}</p>
            <button onClick={triggerSync} disabled={syncing} style={S.btnAccent}>
              {syncing ? "Parsing Stream..." : "Inject 6 Test Sales"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}





// ============================================================
// 10. RECIPE DIGITIZER (STATUS: BROKEN FIX & SCAN-VERIFY IMPLEMENTED)
// ============================================================
export function RecipeDigitizer({ kitchenId, recipes = [], onUpdateRecipes, settings = {} }) {
  const currencySymbol = settings?.currency || '£';
  const authContext = typeof useAuth === 'function' ? useAuth() : { user: { id: 'mock-chef-id' } };
  const user = authContext?.user;
  const supabaseClient = typeof supabase !== 'undefined' ? supabase : (window.supabase || null);

  const [recipesList, setRecipesList] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // --- SCAN & VERIFY SYSTEM STATE ---
  const [scannedText, setScannedText] = useState("");
  const [scannedRecipeName, setScannedRecipeName] = useState("");
  const [scannedCategory, setScannedCategory] = useState("Mains");
  const [scannedYield, setScannedYield] = useState("1 Portion");
  const [scannedSellPrice, setScannedSellPrice] = useState("");
  const [editingOriginalName, setEditingOriginalName] = useState(null); // null = adding new

  // --- DEVICE CAPTURE STATE (attach + take photo) ---
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showLaptopCamera, setShowLaptopCamera] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- RESPONSIVE VIEWPORT (laptop + phone editing) ---
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const activeKitchenId = kitchenId || user?.id;

  // Always pull recipes straight from the database. The app-state prop
  // can arrive in a reduced shape that drops ingredient_item, which leaves
  // the recipe grouping with 0 rows until something forces a refetch.
  useEffect(() => {
    fetchRecipes();
    const onDbUpdate = () => fetchRecipes();
    window.addEventListener('mise-db-update', onDbUpdate);
    return () => window.removeEventListener('mise-db-update', onDbUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKitchenId]);

  const fetchRecipes = async () => {
    if (!activeKitchenId || !supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from('recipes')
        .select('*')
        .eq('kitchen_id', activeKitchenId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = data || [];
      setRecipesList(rows);
      // Keep the previously selected recipe if it still exists, otherwise pick the first.
      setSelectedRecipe(prev => {
        if (prev) {
          const match = rows.find(r => r.name === prev.name);
          if (match) return match;
        }
        return rows[0] || null;
      });
    } catch (err) {
      console.error("Error loading recipes registry:", err);
      setErrorMessage(err.message);
    }
  };

  // ============================================================
  // STEP 1: DEVICE CAPTURE — attach file / photo / take photo
  // ============================================================
  const stageFile = (selected) => {
    if (!selected) return;
    setFile(selected);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(selected));
    setShowOptions(false);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleFileChange = (e) => {
    const selected = e.target.files && e.target.files[0];
    if (selected) stageFile(selected);
    if (e.target) e.target.value = "";
  };

  const handleTakePhoto = async () => {
    setShowOptions(false);
    const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobileDevice) {
      cameraInputRef.current?.click();
      return;
    }
    // Laptop / desktop webcam
    setShowLaptopCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setErrorMessage("Webcam unavailable: " + err.message);
      setShowLaptopCamera(false);
    }
  };

  const captureLaptopSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const capturedFile = new File([blob], `recipe_${Date.now()}.jpg`, { type: 'image/jpeg' });
      stageFile(capturedFile);
      closeLaptopCamera();
    }, 'image/jpeg');
  };

  const closeLaptopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    streamRef.current = null;
    setShowLaptopCamera(false);
  };

  const clearStagedFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
  };

  // Stop the webcam if the user leaves the screen mid-capture
  useEffect(() => () => closeLaptopCamera(), []);

  // ============================================================
  // STEP 2: REAL OCR / EXTRACTION via the parse-recipe edge function
  // ============================================================
  const handleRunExtraction = async () => {
    if (!file) {
      setErrorMessage("Attach or capture a recipe image first.");
      return;
    }
    if (!supabaseClient) {
      setErrorMessage("Supabase connection is not initialised.");
      return;
    }

    setParsing(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Convert the staged image to a base64 payload (mirrors the invoice pipeline)
      const base64Payload = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = (e) => reject(e);
      });

      const fileExt = file.name ? file.name.split('.').pop() : 'jpg';

      const { data: result, error: functionError } = await supabaseClient.functions
        .invoke('parse-recipe', {
          body: {
            image: base64Payload,
            fileType: fileExt,
            currentRecipes: recipes
          }
        });

      if (functionError) throw functionError;

      // Defensive extraction across possible response shapes
      const parsed = result?.recipe || result?.data || result;
      if (!parsed) {
        throw new Error("The parse-recipe engine returned an empty response.");
      }

      const name = parsed.recipe_name || parsed.name || parsed.title || "";
      const category = parsed.category || parsed.type || "Mains";
      const yieldSize = parsed.yield || parsed.yields || parsed.portions || "1 Portion";
      const sell = parsed.sell_price || parsed.price || "";

      // Ingredients may come back as plain strings or as structured objects
      const rawIngredients =
        parsed.ingredients ||
        parsed.line_items ||
        parsed.items ||
        [];

      let ingredientLines = "";
      if (typeof parsed.raw_ingredients_text === 'string') {
        ingredientLines = parsed.raw_ingredients_text;
      } else if (Array.isArray(rawIngredients)) {
        ingredientLines = rawIngredients.map((ing) => {
          if (typeof ing === 'string') return ing;
          const iName = ing.name || ing.item || ing.description || "";
          const iQty = ing.qty || ing.quantity || ing.amount || "";
          const iUnit = ing.unit || "";
          return [iName, [iQty, iUnit].filter(Boolean).join(' ')].filter(Boolean).join(' - ');
        }).join('\n');
      }

      setScannedRecipeName(name);
      setScannedCategory(category);
      setScannedYield(yieldSize);
      setScannedSellPrice(parsePriceOrNull(sell) !== null ? String(parsePriceOrNull(sell)) : "");
      setScannedText(ingredientLines);

      if (!ingredientLines.trim()) {
        setErrorMessage("No ingredient lines were detected. You can type them into the review box below before saving.");
      }
    } catch (err) {
      console.error("Recipe extraction error:", err);
      setErrorMessage(
        (err?.message || "Extraction failed.") +
        " — make sure the 'parse-recipe' edge function is deployed. You can still type the recipe into the review box and save it."
      );
      // Open an empty review box so the chef can still enter the recipe by hand
      if (!scannedText) setScannedText(" ");
    } finally {
      setParsing(false);
    }
  };

  // ============================================================
  // STEP 3: SAVE VERIFIED RECIPE TO SUPABASE (recipes table)
  // One row per ingredient line — the schema Recipes & Costs reads.
  // ============================================================
  // ============================================================
  // MANUAL ENTRY / EDIT / DELETE
  // ============================================================
  const handleStartManualRecipe = () => {
    setEditingOriginalName(null);
    clearStagedFile();
    setErrorMessage("");
    setSuccessMessage("");
    setScannedRecipeName("");
    setScannedCategory("Mains");
    setScannedYield("1 Portion");
    setScannedSellPrice("");
    // A single space opens the review panel; the chef can type ingredient lines from here
    setScannedText(" ");
  };

  const handleEditRecipe = (groupObj) => {
    if (!groupObj) return;
    setEditingOriginalName(groupObj.name);
    clearStagedFile();
    setErrorMessage("");
    setSuccessMessage("");
    setScannedRecipeName(groupObj.name || "");
    setScannedCategory(groupObj.category || "Mains");
    setScannedYield(groupObj.yield || "1 Portion");
    const existingPrice = parsePriceOrNull(groupObj.sell_price);
    setScannedSellPrice(existingPrice !== null ? String(existingPrice) : "");
    setScannedText((groupObj.ingredients || []).join('\n'));
    // Scroll the review panel into view on phones
    if (typeof window !== 'undefined') setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  };

  const handleDeleteRecipe = async (groupObj) => {
    if (!groupObj || !supabaseClient) return;
    const confirmed = typeof window !== 'undefined'
      ? window.confirm(`Delete "${groupObj.name}" and all of its ingredient rows? This cannot be undone.`)
      : true;
    if (!confirmed) return;
    try {
      const { data: deletedRows, error: delErr } = await supabaseClient
        .from('recipes')
        .delete()
        .eq('kitchen_id', activeKitchenId)
        .eq('name', groupObj.name)
        .select();
      if (delErr) throw delErr;

      if (!deletedRows || deletedRows.length === 0) {
        throw new Error("The database returned 0 rows deleted. This usually means a Row-Level-Security policy is blocking DELETE on the 'recipes' table for this user. Open Supabase → Authentication → Policies and add a DELETE policy that allows kitchen_id = auth.uid().");
      }

      // If we were editing the recipe we just deleted, clear the workspace
      if (editingOriginalName === groupObj.name) {
        setEditingOriginalName(null);
        setScannedText("");
        setScannedRecipeName("");
      }

      const { data: refreshed } = await supabaseClient
        .from('recipes')
        .select('*')
        .eq('kitchen_id', activeKitchenId)
        .order('created_at', { ascending: false });

      if (refreshed) {
        setRecipesList(refreshed);
        if (typeof onUpdateRecipes === 'function') onUpdateRecipes(refreshed);
        setSelectedRecipe(refreshed[0] || null);
      }
      window.dispatchEvent(new Event('mise-db-update'));
      setSuccessMessage(`Deleted "${groupObj.name}" (${deletedRows.length} ingredient row(s) removed).`);
    } catch (err) {
      console.error("Delete failed:", err);
      setErrorMessage(err.message || "Failed to delete the recipe.");
    }
  };

  const handleCommitScannedData = async () => {
    const cleanText = (scannedText || "").trim();
    if (!cleanText) {
      setErrorMessage("Nothing to save — the ingredient review box is empty.");
      return;
    }
    if (!scannedRecipeName.trim()) {
      setErrorMessage("Give the recipe a name before saving.");
      return;
    }
    if (!supabaseClient) {
      setErrorMessage("Supabase connection is not initialised.");
      return;
    }

    // Sell price is optional. Blank = NULL ("Not set"); anything typed must be above 0.
    const priceText = String(scannedSellPrice ?? '').trim();
    const sellValue = priceText === '' ? null : parsePriceOrNull(priceText);
    if (priceText !== '' && sellValue === null) {
      setErrorMessage("Sell price must be above 0, or leave it blank to add it later.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const individualLines = cleanText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (individualLines.length === 0) {
        throw new Error("No valid ingredient rows found in the review box.");
      }

      const nowIso = new Date().toISOString();

      const totalInsertRows = individualLines.map((ingredientRowText) => ({
        kitchen_id: activeKitchenId,
        name: scannedRecipeName.trim(),
        category: scannedCategory.trim() || "Mains",
        yield: scannedYield.trim() || "1 Portion",
        sell_price: sellValue,
        ingredient_item: ingredientRowText,
        created_at: nowIso,
        created_by: user?.id || null,
        last_edited_by: user?.id || null,
        last_edited_by_email: user?.email || null,
        last_edited_at: nowIso
      }));

      // If editing, remove the previous version of this recipe first so it's replaced cleanly
      if (editingOriginalName) {
        const { data: removedRows, error: delErr } = await supabaseClient
          .from('recipes')
          .delete()
          .eq('kitchen_id', activeKitchenId)
          .eq('name', editingOriginalName)
          .select();
        if (delErr) throw delErr;
        if (!removedRows || removedRows.length === 0) {
          throw new Error("Couldn't clear the previous version of this recipe — 0 rows removed. A Row-Level-Security DELETE policy on the 'recipes' table is probably blocking this user. Save aborted to avoid creating duplicates.");
        }
      }

      const { data: committedRows, error: insertError } = await supabaseClient
        .from('recipes')
        .insert(totalInsertRows)
        .select();

      if (insertError) throw insertError;

      const wasEditing = editingOriginalName;
      setEditingOriginalName(null);

      // Reset the capture + verify workspace
      setScannedText("");
      setScannedRecipeName("");
      setScannedCategory("Mains");
      setScannedYield("1 Portion");
      setScannedSellPrice("");
      clearStagedFile();

      // Notify other tabs that the database changed
      window.dispatchEvent(new Event('mise-db-update'));

      // Re-pull the full list so the registry + Recipes & Costs reflect the new dish
      const { data: updatedSuite } = await supabaseClient
        .from('recipes')
        .select('*')
        .eq('kitchen_id', activeKitchenId)
        .order('created_at', { ascending: false });

      if (updatedSuite) {
        setRecipesList(updatedSuite);
        if (typeof onUpdateRecipes === 'function') {
          onUpdateRecipes(updatedSuite); // propagate to App -> Recipes & Costs tab
        }
        if (committedRows?.[0]) {
          setSelectedRecipe(committedRows[0]);
        }
      }

      setSuccessMessage(
        wasEditing
          ? `Updated "${totalInsertRows[0].name}" (${individualLines.length} ingredient rows).`
          : `Saved "${totalInsertRows[0].name}" (${individualLines.length} ingredient rows). It is now in the Recipes & Costs tab.`
      );
    } catch (err) {
      console.error("Database save failure:", err);
      setErrorMessage(err.message || "Failed to save the recipe to the database.");
    } finally {
      setSaving(false);
    }
  };

  // Group flat ingredient rows back into distinct recipes (by name)
  const groupedRecipesMap = (recipesList || []).reduce((acc, current) => {
    if (!acc[current.name]) {
      acc[current.name] = { ...current, ingredients: [] };
    }
    if (current.ingredient_item) {
      acc[current.name].ingredients.push(current.ingredient_item);
    }
    return acc;
  }, {});

  const groupedRecipesArray = Object.values(groupedRecipesMap);
  const activeViewObj = selectedRecipe ? groupedRecipesMap[selectedRecipe.name] : null;

  const busy = parsing || saving;

  return (
    <div style={{ color: '#0e0e0c', minHeight: '80vh' }}>
      {/* Hidden capture inputs */}
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
      <input type="file" accept="image/*" ref={photoInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
      <input type="file" accept="image/*,.pdf" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.inkRule}`, paddingBottom: 16, marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 24, margin: 0, fontFamily: "'Bitter', serif", fontWeight: '800', color: '#0e0e0c' }}>Recipe Digitizer</h2>
          <p style={{ margin: '4px 0 0 0', color: C.inkFade, fontSize: 13 }}>
            Scan &amp; Verify: capture a recipe card, check the extracted text, then save it into your costing tables.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Distinct Recipes</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0e0e0c', fontFamily: 'monospace', marginTop: 2 }}>
            {groupedRecipesArray.length.toString().padStart(2, '0')}
          </div>
        </div>
      </div>

      {errorMessage && (
        <div style={{ background: C.red, color: '#fff', padding: '12px 16px', borderRadius: 4, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
          ⚠️ {errorMessage}
        </div>
      )}
      {successMessage && (
        <div style={{ background: C.green, color: '#fff', padding: '12px 16px', borderRadius: 4, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
          ✓ {successMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.9fr', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* CAPTURE BLOCK */}
          <div style={{ background: C.paper2, border: `1px solid ${C.inkRule}`, borderRadius: 4, padding: '24px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.inkFade, letterSpacing: '0.5px', marginBottom: 14, textTransform: 'uppercase' }}>
              Capture Recipe Card
            </div>

            {!previewUrl && !showLaptopCamera && (
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}>
                <button
                  onClick={() => !busy && setShowOptions(true)}
                  disabled={busy}
                  style={{
                    background: busy ? '#333' : '#121210', color: '#fff',
                    border: `1px solid ${C.inkRule}`, padding: '12px 24px',
                    fontWeight: '700', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: '0.5px', borderRadius: '4px',
                    cursor: busy ? 'not-allowed' : 'pointer', minWidth: '220px', textAlign: 'center'
                  }}
                >
                  📷 Attach or Take Photo
                </button>
                <button
                  onClick={() => !busy && handleStartManualRecipe()}
                  disabled={busy}
                  style={{
                    background: busy ? '#333' : C.paper, color: C.ink,
                    border: `1px solid ${C.inkRule}`, padding: '12px 24px',
                    fontWeight: '700', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: '0.5px', borderRadius: '4px',
                    cursor: busy ? 'not-allowed' : 'pointer', minWidth: '220px', textAlign: 'center'
                  }}
                >
                  ✏️ Enter Recipe Manually
                </button>
              </div>
            )}

            {showLaptopCamera && (
              <div style={{ textAlign: 'center' }}>
                <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxWidth: '420px', borderRadius: 4, background: '#000' }} />
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 12 }}>
                  <button onClick={captureLaptopSnapshot} style={{ background: '#121210', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📸 Capture</button>
                  <button onClick={closeLaptopCamera} style={{ background: C.paper, color: C.ink, border: `1px solid ${C.inkRule}`, padding: '8px 16px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            {previewUrl && !showLaptopCamera && (
              <div>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', background: '#121210', borderRadius: 4, padding: 10, marginBottom: 14 }}>
                  <img src={previewUrl} alt="Staged recipe" style={{ maxHeight: 240, maxWidth: '100%', objectFit: 'contain' }} />
                  <button onClick={clearStagedFile} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                </div>
                <button
                  onClick={handleRunExtraction}
                  disabled={busy}
                  style={{
                    width: '100%', background: busy ? '#555' : C.accent, color: '#fff', border: 'none',
                    padding: '14px 16px', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px'
                  }}
                >
                  {parsing ? "🔄 RUNNING AI RECOVERY..." : "⚡ RUN AI RECOVERY SCHEMATICS"}
                </button>
              </div>
            )}
          </div>

          {/* SOURCE OPTIONS MODAL */}
          {showOptions && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,14,12,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#fff', borderRadius: 6, width: '100%', maxWidth: 300, padding: 16, boxShadow: '0 12px 36px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 6, borderBottom: `1px solid ${C.paper2}` }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.inkFade, fontFamily: "'JetBrains Mono', monospace" }}>SELECT SOURCE</span>
                  <button onClick={() => setShowOptions(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={() => fileInputRef.current?.click()} style={{ background: C.paper, color: C.ink, border: `1px solid ${C.paper2}`, borderRadius: 4, padding: 12, textAlign: 'left', fontSize: 13, cursor: 'pointer' }}>📁 Select File (image / PDF)</button>
                  <button onClick={() => photoInputRef.current?.click()} style={{ background: C.paper, color: C.ink, border: `1px solid ${C.paper2}`, borderRadius: 4, padding: 12, textAlign: 'left', fontSize: 13, cursor: 'pointer' }}>🖼️ Select Photo</button>
                  <button onClick={handleTakePhoto} style={{ background: C.paper, color: C.ink, border: `1px solid ${C.paper2}`, borderRadius: 4, padding: 12, textAlign: 'left', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>📷 Take a Photo</button>
                </div>
              </div>
            </div>
          )}

          {/* VERIFY / EDIT DRAWER (works on laptop + phone) */}
          {scannedText && (
            <div style={{ background: '#1d1d1b', border: `2px solid ${C.accent}`, borderRadius: 4, padding: 16, color: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.accent, letterSpacing: '0.5px', marginBottom: 12, textTransform: 'uppercase' }}>
                ✏️ {editingOriginalName ? `Editing "${editingOriginalName}"` : "Review & Adjust Extracted Recipe"}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                  <label style={{ fontSize: 11, color: '#aaa' }}>
                    Recipe Name
                    <input type="text" value={scannedRecipeName} onChange={(e) => setScannedRecipeName(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: '#2c2c2a', border: '1px solid #444', color: '#fff', padding: 8, fontSize: 13, borderRadius: 3, marginTop: 4 }} />
                  </label>
                  <label style={{ fontSize: 11, color: '#aaa' }}>
                    Category
                    <input type="text" value={scannedCategory} onChange={(e) => setScannedCategory(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: '#2c2c2a', border: '1px solid #444', color: '#fff', padding: 8, fontSize: 13, borderRadius: 3, marginTop: 4 }} />
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                  <label style={{ fontSize: 11, color: '#aaa' }}>
                    Yield Size
                    <input type="text" value={scannedYield} onChange={(e) => setScannedYield(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: '#2c2c2a', border: '1px solid #444', color: '#fff', padding: 8, fontSize: 13, borderRadius: 3, marginTop: 4 }} />
                  </label>
                  <label style={{ fontSize: 11, color: '#aaa' }}>
                    Sell Price ({"\u00A3"})
                    <input type="number" step="0.01" min="0" placeholder="Not set" value={scannedSellPrice} onChange={(e) => setScannedSellPrice(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: '#2c2c2a', border: '1px solid #444', color: '#fff', padding: 8, fontSize: 13, borderRadius: 3, marginTop: 4 }} />
                  </label>
                </div>

                <label style={{ fontSize: 11, color: '#aaa' }}>
                  Ingredient lines (one item per row)
                  <textarea
                    rows={isMobile ? 6 : 8}
                    value={scannedText}
                    onChange={(e) => setScannedText(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: '#121210', border: '1px solid #444', color: '#fff', fontFamily: 'monospace', padding: 10, fontSize: 12, borderRadius: 3, marginTop: 4, resize: 'vertical', lineHeight: '1.5' }}
                  />
                </label>
              </div>

              <button
                onClick={handleCommitScannedData}
                disabled={busy}
                style={{ background: busy ? '#555' : C.green, color: '#fff', border: 'none', padding: '12px 16px', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: 13, width: '100%' }}
              >
                {saving ? "💾 SAVING..." : (editingOriginalName ? "💾 Save Changes" : "💾 Confirm & Add to Library")}
              </button>
            </div>
          )}

          {/* REGISTRY LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.inkFade, letterSpacing: '0.5px', marginBottom: 4, textTransform: 'uppercase' }}>
              Digitized Recipe Registry
            </div>

            {groupedRecipesArray.length === 0 ? (
              <div style={{ color: C.inkFade, fontSize: 12, padding: 24, background: '#121210', border: `1px solid ${C.inkRule}`, borderRadius: 4, textAlign: 'center' }}>
                No recipes saved yet.
              </div>
            ) : (
              groupedRecipesArray.map((rec, index) => {
                const isSelected = selectedRecipe?.name === rec.name;
                return (
                  <div
                    key={`group-rec-${index}`}
                    onClick={() => setSelectedRecipe(rec)}
                    style={{
                      background: '#121210', border: `1px solid ${isSelected ? C.accent : C.inkRule}`,
                      borderRadius: '4px', padding: '14px 16px', display: 'flex',
                      justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ fontSize: 9, fontWeight: '800', fontFamily: 'monospace', background: '#1c2428', color: C.blue, border: `1px solid ${C.blue}`, padding: '2px 6px', borderRadius: 3 }}>
                        {rec.ingredients.length} ROWS
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{rec.name}</span>
                        <span style={{ fontSize: 10, color: C.inkFade, marginTop: 3 }}>
                          Category: {rec.category || 'Main'}
                          {parsePriceOrNull(rec.sell_price) === null && (
                            <span style={{ color: C.red, fontWeight: 700 }}> · No sell price</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>
                        {rec.yield || '1 Portion'}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditRecipe(rec); }}
                        title="Edit recipe"
                        style={{ background: 'transparent', color: '#fff', border: `1px solid ${C.inkRule}`, borderRadius: 3, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteRecipe(rec); }}
                        title="Delete recipe"
                        style={{ background: 'transparent', color: C.red, border: `1px solid ${C.red}`, borderRadius: 3, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* DETAILS PANEL */}
        <div>
          <div style={{ background: C.paper2, border: `1px solid ${C.inkRule}`, borderRadius: 4, padding: 16, minHeight: 450 }}>
            <div style={{ borderBottom: `1px solid ${C.inkRule}`, paddingBottom: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.accent, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Current Record
              </div>
              <h3 style={{ fontSize: 18, margin: '4px 0 0 0', fontFamily: "'Bitter', serif", fontWeight: '800' }}>
                {activeViewObj ? activeViewObj.name : "No recipe selected"}
              </h3>
            </div>

            {activeViewObj ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.inkFade, textTransform: 'uppercase' }}>Category</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginTop: 1 }}>{activeViewObj.category || 'Main'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.inkFade, textTransform: 'uppercase' }}>Sell Price</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: parsePriceOrNull(activeViewObj.sell_price) !== null ? C.green : C.red, marginTop: 1 }}>
                      {parsePriceOrNull(activeViewObj.sell_price) !== null
                        ? `${currencySymbol}${parsePriceOrNull(activeViewObj.sell_price).toFixed(2)}`
                        : 'Not set'}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.inkFade, textTransform: 'uppercase' }}>Yield</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginTop: 1 }}>{activeViewObj.yield || '1 Portion'}</div>
                </div>

                {formatEditedBy(activeViewObj.last_edited_by_email, activeViewObj.last_edited_at) && (
                  <div style={{ fontSize: 11, color: C.inkFade }}>
                    {formatEditedBy(activeViewObj.last_edited_by_email, activeViewObj.last_edited_at)}
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.inkFade, textTransform: 'uppercase', marginBottom: 6 }}>
                    Ingredient Rows ({activeViewObj.ingredients.length})
                  </div>
                  <div style={{ border: `1px solid ${C.inkRule}`, borderRadius: 4, background: '#161614', padding: '10px 12px', color: '#fff', fontSize: 12, lineHeight: 1.6, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {activeViewObj.ingredients.map((ing, i) => (
                      <div key={i} style={{ paddingBottom: 4, borderBottom: i < activeViewObj.ingredients.length - 1 ? '1px dashed #2a2a26' : 'none' }}>
                        • {ing}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 260, color: C.inkFade }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📖</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>Select a recipe to view its details</div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
// ============================================================
// CORE ELEMENT COMPONENT STRUCTS
// ============================================================
function ScreenHeader({ title, sub }) {
  return (
    <div style={{borderBottom:`1px solid ${C.inkRule}`, paddingBottom:16, marginBottom:24}}>
      <h1 style={{fontFamily:"'Bitter', serif", fontSize:28, fontWeight:900, color:C.ink, margin:0, letterSpacing:"-0.5px"}}>{title}</h1>
      <p style={{fontSize:12, color:C.inkFade, marginTop:4}}>{sub}</p>
    </div>
  );
}

function SectionLabel({ label }) {
  return <span style={{fontSize:10, fontFamily:"'JetBrains Mono', monospace", color:C.inkFade, textTransform:"uppercase", letterSpacing:"1px", fontWeight:700}}>{label}</span>;
}

function Kpi({ label, val, sub, color = C.ink, badge, badgeColor }) {
  return (
    <div style={S.card}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6}}>
        <SectionLabel label={label} />
        {badge && <span style={{fontSize:9, fontWeight:700, padding:"2px 6px", background:badgeColor, color:"white"}}>{badge}</span>}
      </div>
      <div style={{fontSize:26, fontFamily:"'JetBrains Mono', monospace", fontWeight:700, color, letterSpacing:"-1px"}}>{val}</div>
      <div style={{fontSize:11, color:C.inkFade, marginTop:4}}>{sub}</div>
    </div>
  );
}

function FormField({ label, val, onChange, type = "text", disabled = false }) {
  return (
    <div>
      <label style={{fontSize:11, fontWeight:700, display:"block", marginBottom:4}}>{label}</label>
      <input type={type} value={val} onChange={e=>onChange(e.target.value)} style={S.input} disabled={disabled} />
    </div>
  );
}

function NumInput({ value, onChange }) {
  return <input type="number" value={value} onChange={e=>onChange(e.target.value)} style={{...S.input, width:80, padding:"6px 8px", fontFamily:"'JetBrains Mono', monospace"}} />;
}

function DemoBanner({ onSeed }) {
  return (
    <div style={{background:C.highlight, border:`1px solid ${C.inkRule}`, padding:16, marginBottom:24, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12}}>
      <div>
        <div style={{fontWeight:700, fontSize:14}}>Empty Kitchen Matrix Encountered</div>
        <div style={{fontSize:12, color:C.inkFade, marginTop:2}}>Your multi-user environment works empty, but you can inject baseline configuration seeds to expedite evaluation.</div>
      </div>
      <button onClick={onSeed} style={S.btnAccent}>Inject Structural Seeds</button>
    </div>
  );
}

function NewRecipeModal({ components, settings, onClose, onSave }) {
  const [name, setName] = useState('');
  const [cat, setCat] = useState('Main');
  const [sell, setSell] = useState('');
  return (
    <div style={S.modalOverlay}>
      <div style={S.modal}>
        <h2 style={{fontFamily:"'Bitter', serif", marginBottom:14}}>+ Add New Menu Item</h2>
        <div style={{display:"flex", flexDirection:"column", gap:12}}>
          <FormField label="Recipe Label Descriptor" val={name} onChange={setName} />
          <div>
            <label style={{fontSize:11, fontWeight:700, display:"block", marginBottom:4}}>Category Branch</label>
            <select value={cat} onChange={e=>setCat(e.target.value)} style={S.input}>
              <option value="Starter">Starter</option>
              <option value="Main">Main</option>
              <option value="Dessert">Dessert</option>
              <option value="Side">Side</option>
            </select>
          </div>
          <FormField label="Target Base Retail Price" val={sell} onChange={setSell} type="number" />
          <button onClick={() => onSave({ id: Date.now(), name, category: cat, sellPrice: parseFloat(sell) || 0, dietary: [], ingredients: [] })} style={S.btnAccent}>Compile Recipe Row</button>
          <button onClick={onClose} style={S.btn}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function NewComponentModal({ settings, onClose, onSave }) {
  const [name, setName] = useState('');
  const [station, setStation] = useState('Sauce');
  const [yieldVol, setYieldVol] = useState('');
  const [unit, setUnit] = useState('L');
  return (
    <div style={S.modalOverlay}>
      <div style={S.modal}>
        <h2 style={{fontFamily:"'Bitter', serif", marginBottom:14}}>+ Establish Component Profile</h2>
        <div style={{display:"flex", flexDirection:"column", gap:12}}>
          <FormField label="Component Term Label" val={name} onChange={setName} />
          <FormField label="Roster Operational Station" val={station} onChange={setStation} />
          <div style={{display:'flex', gap:8}}>
            <div style={{flex:2}}><FormField label="Target Batch Yield Capacity" val={yieldVol} onChange={setYieldVol} type="number" /></div>
            <div style={{flex:1}}>
              <label style={{fontSize:11, fontWeight:700, display:"block", marginBottom:4}}>Unit</label>
              <select value={unit} onChange={e=>setUnit(e.target.value)} style={S.input}>
                <option value="L">L</option>
                <option value="kg">kg</option>
                <option value="ea">ea</option>
              </select>
            </div>
          </div>
          <button onClick={() => onSave({ id: 'c-' + Date.now(), name, station, batchYield: parseFloat(yieldVol) || 1, batchUnit: unit, holdLife: "Same Day", ingredients: [] })} style={S.btnAccent}>Compile Blueprint</button>
          <button onClick={onClose} style={S.btn}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LOCAL COMPONENT MATRICES UTILITIES
// ============================================================
const getUnits = (sys) => {
  if (sys === 'imperial') return ['lb', 'oz', 'pt', 'fl oz', 'ea'];
  if (sys === 'us') return ['lb', 'oz', 'qt', 'fl oz', 'ea'];
  return ['kg', 'g', 'L', 'ml', 'ea'];
};

// ════════════════════════════════════════════════════════════════════════════
// VOICE SELECTION — picks the most natural-sounding TTS voice available.
// Browser voice quality varies wildly: Google's "Natural" voices on Chrome
// and Microsoft's "Neural" voices on Edge sound near-human; the OS defaults
// are notably robotic. This walks a preference list looking for the best
// match the user's device offers, falling back gracefully.
// ════════════════════════════════════════════════════════════════════════════
const TTS_VOICE_STORAGE_KEY = 'mise:sous:voice';

const pickBestVoice = (preferredName = null) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  // 1. Honour an explicit user pick if it's still available.
  if (preferredName) {
    const exact = voices.find(v => v.name === preferredName);
    if (exact) return exact;
  }

  // 2. Otherwise scan a priority list of high-quality English voices.
  //    Each entry is tested against voice.name (case-insensitive). The
  //    first match wins.
  const priorityPatterns = [
    /Google.*UK.*English.*Female/i,    // Chrome: best UK female voice
    /Google.*UK.*English/i,             // Chrome: UK English (any gender)
    /Google.*US.*English/i,             // Chrome: US English fallback
    /Microsoft.*Aria.*Online/i,         // Edge: neural female US
    /Microsoft.*Sonia.*Online/i,        // Edge: neural female UK
    /Microsoft.*Libby.*Online/i,        // Edge: neural female UK
    /Microsoft.*Ryan.*Online/i,         // Edge: neural male UK
    /Microsoft.*Guy.*Online/i,          // Edge: neural male US
    /Natural|Neural/i,                  // Generic neural voice tag
    /Samantha/i,                        // macOS: high-quality US female
    /Daniel/i,                          // macOS: UK male
    /Karen/i,                           // macOS: Australian female
    /Moira/i,                           // macOS: Irish female
    /Tessa/i                            // macOS: South African female
  ];

  for (const pattern of priorityPatterns) {
    const match = voices.find(v =>
      pattern.test(v.name) && (v.lang || '').toLowerCase().startsWith('en')
    );
    if (match) return match;
  }

  // 3. Final fallback: any English voice, preferring en-GB then en-US.
  return (
    voices.find(v => (v.lang || '').toLowerCase().startsWith('en-gb')) ||
    voices.find(v => (v.lang || '').toLowerCase().startsWith('en-us')) ||
    voices.find(v => (v.lang || '').toLowerCase().startsWith('en')) ||
    voices[0]
  );
};

const componentCostPerUnit = (comp) => {
  if(!comp) return 0;
  const total = (comp.ingredients || []).reduce((s, i) => s + ((i.qty || 0) * (i.cost || 0)), 0);
  return comp.batchYield > 0 ? total / comp.batchYield : 0;
};

const recipeCosting = (recipe, components = []) => {
  if(!recipe) return { foodCost: 0, gp: 0, profit: 0 };
  let foodCost = 0;
  (recipe.ingredients || []).forEach(ing => {
    if(ing.kind === 'raw') {
      foodCost += (ing.qty || 0) * (ing.cost || 0);
    } else if (ing.kind === 'comp') {
      const target = components.find(c => c.id === ing.componentId);
      if(target) {
        foodCost += (ing.qty || 0) * componentCostPerUnit(target);
      }
    }
  });
  const sell = recipe.sellPrice || 0;
  const profit = sell - foodCost;
  const gp = sell > 0 ? (profit / sell) * 100 : 0;
  return { foodCost, profit, gp };
};

// ============================================================
// INTERFACE GLOBAL CSS DEFINITIONS
// ============================================================
const S = {
  layout: { display: 'flex', minHeight: '100vh', background: C.paper, color: C.ink },
  sidebar: { width: 240, borderRight: `1px solid ${C.inkRule}`, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 24, flexShrink: 0, overflowY: 'auto' },
  logoArea: { display: 'flex', alignItems: 'center', gap: 10 },
  logoIcon: { fontSize: 24, background: C.ink, color: C.paper, padding: '4px 10px', fontWeight: 900 },
  logoText: { fontFamily: "'Bitter', serif", fontWeight: 900, fontSize: 18, tracking: '-0.5px' },
  logoSub: { fontSize: 10, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', color: C.inkFade, letterSpacing: '1px' },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  navLink: { textAlign: 'left', width: '100%', padding: '8px 12px', background: 'none', border: 'none', fontFamily: 'sans-serif', fontSize: 13, fontWeight: 500, color: C.inkSoft, cursor: 'pointer', transition: 'all 0.15s', display: 'block' },
  navLinkActive: { background: C.highlight, color: C.ink, fontWeight: 700, borderLeft: `3px solid ${C.accent}` },
  sidebarFooter: { borderTop: `1px dashed ${C.inkRule}`, paddingTop: 16 },
  signOutBtn: { width: '100%', padding: '8px', border: `1px solid ${C.inkRule}`, background: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, cursor: 'pointer', fontWeight: 700 },
  main: { flex: 1, padding: '40px 32px', overflowY: 'auto', minWidth: 0 },
  container: { maxWidth: 1200, margin: '0 auto' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 },
  card: { background: '#fff', border: `1px solid ${C.inkRule}`, padding: '20px', position: 'relative' },
  input: { width: '100%', padding: '10px 12px', border: `1px solid ${C.inkRule}`, outline: 'none', fontFamily: 'sans-serif', fontSize: 14, background: C.paper, boxSizing: 'border-box' },
  btn: { padding: '8px 16px', border: `1px solid ${C.inkRule}`, background: 'none', cursor: 'pointer', fontFamily: 'sans-serif', fontSize: 13, fontWeight: 700, transition: 'background 0.2s' },
  btnAccent: { padding: '8px 16px', border: `1px solid ${C.inkRule}`, background: C.ink, color: C.paper, cursor: 'pointer', fontFamily: 'sans-serif', fontSize: 13, fontWeight: 700 },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modal: { background: '#fff', border: `2px solid ${C.inkRule}`, padding: 30, width: 400, display: 'flex', flexDirection: 'column', gap: 16 },
  mobileBar: { display: 'none', background: C.paper, borderBottom: `1px solid ${C.inkRule}`, padding: '12px 16px', justifyContent: 'space-between', alignItems: 'center', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 90 },
  menuBtn: { padding: '4px 10px', border: `1px solid ${C.inkRule}`, background: C.ink, color: C.paper, fontSize: 12, fontWeight: 700 },
  drawerOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 },
  drawer: { width: 260, height: '100%', background: C.paper, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 },
  closeBtn: { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer' },
  drawerLink: { textAlign: 'left', width: '100%', padding: '10px', border: 'none', background: 'none', fontSize: 14, cursor: 'pointer' },
  drawerLinkActive: { background: C.highlight, fontWeight: 700 },
};

// DATA STATIC CONSOLIDATION STRUCTS
const POS_PROVIDERS = [
  { id: 'square', name: 'Square', logo: '◼', desc: 'POS · payments · loyalty', popular: true },
  { id: 'lightspeed', name: 'Lightspeed', logo: '⬢', desc: 'Restaurant POS · K-series', popular: true },
  { id: 'toast', name: 'Toast', logo: '◬', desc: 'Restaurant-first POS', popular: true },
  { id: 'tevalis', name: 'Tevalis', logo: '◇', desc: 'UK hospitality POS' },
  { id: 'tissl', name: 'Tissl', logo: '◯', desc: 'Independent restaurant POS' },
  { id: 'epos', name: 'Epos Now', logo: '▣', desc: 'Multi-site POS' }
];

const POS_MOCK_BATCH = [
  { day: 'Fri', session: 'Lunch', recipeId: 1, sold: 14 },
  { day: 'Fri', session: 'Lunch', recipeId: 5, sold: 11 },
  { day: 'Fri', session: 'Dinner', recipeId: 1, sold: 24 },
  { day: 'Fri', session: 'Dinner', recipeId: 2, sold: 18 },
  { day: 'Fri', session: 'Dinner', recipeId: 3, sold: 15 },
  { day: 'Fri', session: 'Dinner', recipeId: 4, sold: 26 }
];

const SUPPLIER_PRICES = {
  "Beef Cheek": { Wellocks: 13.50, Reynolds: 14.20, Brakes: 13.80 },
  "Salmon Fillet": { Wellocks: 17.50, Reynolds: 18.00, Brakes: 18.40 },
  "Mixed Mushrooms": { Wellocks: 11.00, Reynolds: 9.80, Brakes: 10.50 },
  "Parmesan": { Wellocks: 21.00, Reynolds: 22.50, Brakes: 20.80 },
  "Romaine Lettuce": { Wellocks: 2.60, Reynolds: 2.80, Brakes: 3.10 },
  "Double Cream": { Wellocks: 3.40, Reynolds: 3.20, Brakes: 3.30 },
  "Pearl Onions": { Wellocks: 3.20, Reynolds: 3.40, Brakes: 3.00 },
  "Smoked Bacon": { Wellocks: 12.50, Reynolds: 12.80, Brakes: 13.20 },
};

const DEMO_RECIPE_SCAN = {
  name: "Grandmother's Lamb Hotpot", category: "Main", sellPrice: 22, dietary: ["DF"], confidence: "high",
  ingredients: [
    { name: "Lamb Neck", qty: 0.6, unit: "kg", cost: 14.50, supplier: "Meat" },
    { name: "Potatoes", qty: 0.8, unit: "kg", cost: 1.20, supplier: "Veg" },
    { name: "Onions", qty: 0.3, unit: "kg", cost: 1.10, supplier: "Veg" },
    { name: "Lamb Stock", qty: 0.4, unit: "L", cost: 2.00, supplier: "Dry Goods" },
    { name: "Butter", qty: 0.025, unit: "kg", cost: 8.00, supplier: "Dairy" },
    { name: "Worcestershire Sauce", qty: 0.015, unit: "L", cost: 4.00, supplier: "Dry Goods" }
  ]
};




// ════════════════════════════════════════════════════════════════════════════
// QUICK SOUS FAB — floating button + mini-chat overlay, available on every
// page. Lets the chef fire a quick voice question without leaving the
// current tab. Uses the same sous-chat edge function as SousScreen but
// keeps its own ephemeral conversation state (doesn't persist between
// sessions — that's what the full Sous tab is for).
// ════════════════════════════════════════════════════════════════════════════
function QuickSousFAB({ settings, recipes, components, sales, waste, planner }) {
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);

  // Browser API support detection
  const SR = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
  const voiceSupported = !!SR;
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);
  const queryRef = useRef(query);
  useEffect(() => { queryRef.current = query; }, [query]);

  // Auto-scroll the mini chat as messages arrive
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chat, loading]);

  // Reuse the same markdown stripper from SousScreen logic
  const stripMd = (text) => {
    if (!text) return '';
    return String(text)
      .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
      .replace(/__([\s\S]+?)__/g, '$1')
      .replace(/\*([^*\n]+)\*/g, '$1')
      .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/^\s*>\s?/gm, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const speak = (text) => {
    if (!ttsSupported || !text) return;
    try {
      window.speechSynthesis.cancel();
      const clean = stripMd(text);
      if (!clean) return;
      const utter = new SpeechSynthesisUtterance(clean);
      let storedName = '';
      try { storedName = localStorage.getItem(TTS_VOICE_STORAGE_KEY) || ''; } catch {}
      const voice = pickBestVoice(storedName);
      if (voice) { utter.voice = voice; utter.lang = voice.lang || 'en-US'; }
      else utter.lang = 'en-US';
      utter.rate = 1.15;
      window.speechSynthesis.speak(utter);
    } catch (err) {
      console.error("Quick Sous TTS failed:", err);
    }
  };

  const startListening = () => {
    if (!voiceSupported || listening) return;
    try {
      const rec = new SR();
      rec.lang = 'en-US';
      rec.continuous = false;
      rec.interimResults = true;
      let finalText = '';
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        setQuery((finalText + interim).trim());
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => {
        setListening(false);
        const t = (finalText || queryRef.current || '').trim();
        if (t) {
          setQuery(t);
          setTimeout(() => submitQuery(t), 50);
        }
      };
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
    } catch (err) {
      console.error("Quick Sous mic failed:", err);
      setListening(false);
    }
  };

  const stopListening = () => {
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
  };

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.abort(); } catch {}
      if (ttsSupported) {
        try { window.speechSynthesis.cancel(); } catch {}
      }
    };
  }, []);

  const submitQuery = async (text) => {
    const q = (text || '').trim();
    if (!q || loading) return;
    setChat(prev => [...prev, { speaker: 'user', text: q }]);
    setQuery('');
    setLoading(true);

    const currency = settings?.currency || '£';
    const unitSystem = settings?.unitSystem || 'metric';
    const ctx = {
      role: settings?.role || 'Staff',
      currency,
      unitSystem,
      recipes: recipes || [],
      components: components || [],
      sales: sales || [],
      waste: waste || [],
      planner: planner || []
    };
    const promptDirective =
      `[OPERATIONAL CONTEXT — DO NOT IGNORE]
- Currency: every monetary value in your reply MUST use "${currency}". Never use $ unless that IS the symbol.
- Unit system: ${unitSystem}.
- Reply in plain prose without markdown formatting — output will be read aloud.
- Keep replies SHORT (1-3 sentences) since this is a quick on-the-fly question from a chef during prep.

USER QUESTION: ${q}`;

    try {
      const { data, error } = await supabase.functions.invoke('sous-chat', {
        body: { prompt: promptDirective, context: ctx }
      });
      if (error) throw error;
      const reply = data?.reply || "I couldn't form a response. Try the full Sous AI tab for a longer answer.";
      setChat(prev => [...prev, { speaker: 'sous', text: reply }]);
      speak(reply);
    } catch (err) {
      console.error("Quick Sous error:", err);
      setChat(prev => [...prev, { speaker: 'sous', text: `Error: ${err.message || 'Could not reach Sous.'}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    submitQuery(query);
  };

  // Closed state — just the floating button
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Ask Sous (quick voice question)"
        aria-label="Ask Sous"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: C.accent,
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontSize: 24,
          boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
          zIndex: 9000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.15s'
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        🎙
      </button>
    );
  }

  // Open state — mini chat panel
  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      width: 'min(380px, calc(100vw - 24px))',
      maxHeight: 'min(560px, calc(100vh - 40px))',
      background: '#0e0e0c',
      color: '#f7f1e3',
      border: `2px solid ${C.accent}`,
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9001,
      boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        background: C.accent,
        color: '#fff'
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.5 }}>Quick Sous</div>
          <div style={{ fontSize: 10, opacity: 0.85 }}>Ask anything — voice or text</div>
        </div>
        <button
          onClick={() => { setOpen(false); stopListening(); if (ttsSupported) try { window.speechSynthesis.cancel(); } catch {} }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 22,
            lineHeight: 1,
            padding: 0,
            width: 28,
            height: 28
          }}
          title="Close"
          aria-label="Close Quick Sous"
        >×</button>
      </div>

      {/* Chat scroll */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 160
      }}>
        {chat.length === 0 && (
          <div style={{ fontSize: 12, color: '#8a8170', fontStyle: 'italic', textAlign: 'center', padding: '20px 8px' }}>
            Tap the mic and ask a quick question.<br/>
            Example: "What's my margin on the lasagne?"
          </div>
        )}
        {chat.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.speaker === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            background: m.speaker === 'user' ? C.accent : '#1a1a18',
            color: m.speaker === 'user' ? '#fff' : '#efe6d3',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 13,
            lineHeight: 1.5
          }}>
            {m.text}
          </div>
        ))}
        {loading && (
          <div style={{
            alignSelf: 'flex-start',
            background: '#1a1a18',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 12,
            color: '#8a8170',
            fontStyle: 'italic'
          }}>
            Thinking…
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input row */}
      <form onSubmit={handleSend} style={{
        display: 'flex',
        gap: 6,
        padding: 10,
        borderTop: '1px solid #2a2a26',
        background: '#121210'
      }}>
        {voiceSupported && (
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            disabled={loading}
            title={listening ? 'Stop listening' : 'Tap to speak'}
            style={{
              width: 40,
              height: 40,
              borderRadius: 4,
              border: 'none',
              background: listening ? '#c14a3a' : '#2a2a26',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 18,
              opacity: loading ? 0.5 : 1,
              animation: listening ? 'sous-pulse 1.2s infinite' : 'none',
              flexShrink: 0
            }}
          >
            {listening ? '⏺' : '🎙'}
          </button>
        )}
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={listening ? 'Listening…' : (loading ? 'Working…' : 'Type or tap mic')}
          disabled={loading}
          style={{
            flex: 1,
            minWidth: 0,
            background: '#000',
            color: '#fff',
            border: listening ? '1px solid #c14a3a' : '1px solid #2a2a26',
            borderRadius: 4,
            padding: '0 10px',
            height: 40,
            fontSize: 13,
            fontFamily: 'inherit'
          }}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          style={{
            height: 40,
            padding: '0 14px',
            background: query.trim() && !loading ? C.accent : '#2a2a26',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontWeight: 700,
            fontSize: 13,
            cursor: query.trim() && !loading ? 'pointer' : 'not-allowed',
            flexShrink: 0
          }}
        >
          Ask
        </button>
      </form>

      <style>{`
        @keyframes sous-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(193, 74, 58, 0.7); }
          50% { box-shadow: 0 0 0 8px rgba(193, 74, 58, 0); }
        }
      `}</style>
    </div>
  );
}

function SousScreen({ settings, recipes, components, sales, waste, planner }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [chat, setChat] = useState([
    { speaker: 'sous', text: "Chef. Live OpenAI context integration online. Ask me anything about menu costs, cover spikes, wastage tracking, or operational optimizations." }
  ]);

  // ─── Voice mode state ────────────────────────────────────────
  // Web Speech API is built into Chrome / Edge / Safari (free, no
  // API key). Firefox doesn't support SpeechRecognition. We
  // gracefully fall back to text-only on unsupported browsers.
  const SpeechRecognitionImpl = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
  const voiceSupported = !!SpeechRecognitionImpl;
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [listening, setListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true); // voice replies on by default for hands-free chef use
  const [autoSubmit, setAutoSubmit] = useState(true); // submit automatically when speech recognition finishes
  const [continuous, setContinuous] = useState(false); // keep the conversation going: mic reopens after Sous finishes speaking
  const [speaking, setSpeaking] = useState(false);

  // Voice selection — system voices are loaded asynchronously by the browser,
  // so we listen for `voiceschanged` and rebuild the picker as they arrive.
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState(() => {
    try { return localStorage.getItem(TTS_VOICE_STORAGE_KEY) || ''; }
    catch { return ''; }
  });
  useEffect(() => {
    if (!ttsSupported) return;
    const reloadVoices = () => {
      const all = window.speechSynthesis.getVoices() || [];
      // Prefer English voices in the picker — keeps the dropdown short
      const english = all.filter(v => (v.lang || '').toLowerCase().startsWith('en'));
      setAvailableVoices(english.length > 0 ? english : all);
    };
    reloadVoices();
    window.speechSynthesis.onvoiceschanged = reloadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [ttsSupported]);
  const [voiceError, setVoiceError] = useState('');

  // Track viewport for mobile-specific layout of the Hands-Free controls
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);
  const queryRef = useRef(query); // keep the latest query in a ref for the recognition callback
  useEffect(() => { queryRef.current = query; }, [query]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chat, loading]);

  // Strip markdown formatting (asterisks, underscores, backticks, list
  // markers, link syntax, headings) so the TTS engine doesn't read
  // "asterisk asterisk Wednesday asterisk asterisk" — and so the
  // playback flows naturally without pausing on syntax characters.
  const stripMarkdownForSpeech = (text) => {
    if (!text) return '';
    return String(text)
      // **bold** and __bold__
      .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
      .replace(/__([\s\S]+?)__/g, '$1')
      // *italic* and _italic_  (do AFTER bold so we don't eat ** stars)
      .replace(/\*([^*\n]+)\*/g, '$1')
      .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '$1')
      // `inline code` and ```fenced```
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // # headings → drop the hashes
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      // [link text](url) → just the text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // bullet markers at start of line → drop them
      .replace(/^\s*[-*+]\s+/gm, '')
      // "1. item" → drop the "1. "
      .replace(/^\s*\d+\.\s+/gm, '')
      // blockquote markers
      .replace(/^\s*>\s?/gm, '')
      // horizontal rules
      .replace(/^\s*[-_*]{3,}\s*$/gm, '')
      // collapse runs of whitespace
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const speak = (text, opts = {}) => {
    if (!ttsSupported || !text) return;
    try {
      window.speechSynthesis.cancel(); // stop anything currently being said
      const clean = stripMarkdownForSpeech(text);
      if (!clean) return;
      const utter = new SpeechSynthesisUtterance(clean);
      // Apply the best available voice (user pick if set, else auto-selected).
      // Falls back silently to the browser default if nothing matches.
      const voice = pickBestVoice(selectedVoiceName);
      if (voice) {
        utter.voice = voice;
        utter.lang = voice.lang || 'en-US';
      } else {
        utter.lang = 'en-US';
      }
      utter.rate = 1.15;   // slightly brisker than natural; less than my old 1.25 reads better with high-quality voices
      utter.pitch = 1.0;
      utter.volume = 1.0;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => {
        setSpeaking(false);
        // Continuous conversation: reopen the mic so the user can reply
        // without tapping anything. Skip if explicitly disabled or if
        // there's already a listening session in flight.
        if (opts.followUp && continuous && voiceSupported && !listening) {
          // Small delay so the speech recognizer doesn't catch the tail
          // of TTS audio as input
          setTimeout(() => startListening(), 300);
        }
      };
      utter.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    } catch (err) {
      console.error("TTS failed:", err);
      setSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (ttsSupported) {
      try { window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
    }
  };

  const startListening = () => {
    if (!voiceSupported) {
      setVoiceError("Your browser doesn't support voice input. Try Chrome, Edge, or Safari.");
      return;
    }
    if (listening) return;
    stopSpeaking(); // don't talk over yourself
    setVoiceError('');

    try {
      const recognition = new SpeechRecognitionImpl();
      recognition.lang = 'en-US';
      recognition.continuous = false;       // one utterance per tap
      recognition.interimResults = true;    // show transcript while user is still talking
      recognition.maxAlternatives = 1;

      let finalTranscript = '';

      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalTranscript += result[0].transcript;
          else interim += result[0].transcript;
        }
        setQuery((finalTranscript + interim).trim());
      };

      recognition.onerror = (event) => {
        setListening(false);
        if (event.error === 'no-speech') {
          setVoiceError("I didn't hear anything. Tap the mic and try again.");
        } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setVoiceError("Microphone permission denied. Allow mic access in your browser settings.");
        } else if (event.error !== 'aborted') {
          setVoiceError(`Voice input error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setListening(false);
        // If we have a finalised transcript and auto-submit is on, send it
        const finalText = (finalTranscript || queryRef.current || '').trim();
        if (autoSubmit && finalText) {
          setQuery(finalText);
          // Defer one tick so the input state is committed
          setTimeout(() => submitQuery(finalText), 50);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    } catch (err) {
      console.error("Could not start speech recognition:", err);
      setVoiceError("Could not start voice input: " + (err.message || err));
      setListening(false);
    }
  };

  const stopListening = () => {
    try { recognitionRef.current?.stop(); } catch (e) { /* noop */ }
    setListening(false);
  };

  // Stop everything if the component unmounts
  useEffect(() => {
    return () => {
      try { recognitionRef.current?.abort(); } catch (e) { /* noop */ }
      stopSpeaking();
    };
  }, []);

  const submitQuery = async (text, wasVoiceInput = false) => {
    const q = (text || '').trim();
    if (!q || loading) return;

    const userMessage = { speaker: 'user', text: q };
    setChat(prev => [...prev, userMessage]);
    setQuery('');
    setLoading(true);

    const currency = settings?.currency || '£';
    const unitSystem = settings?.unitSystem || 'metric';
    const region = settings?.region || '';

    const currentKitchenContextData = {
      role: settings?.role || "Staff",
      currency,
      unitSystem,
      region,
      recipes: recipes || [],
      components: components || [],
      sales: sales || [],
      waste: waste || [],
      planner: planner || []
    };

    // Belt-and-braces: even with currency in the context object, LLMs
    // often default to "$" out of habit. Prepending an explicit directive
    // to the user prompt forces the model to follow the configured
    // currency in its reply.
    const promptDirective =
      `[OPERATIONAL CONTEXT — DO NOT IGNORE]
- Currency: every monetary value in your reply MUST use the symbol "${currency}". Never use $ or other currency symbols regardless of training defaults.
- Unit system: ${unitSystem}. Use ${unitSystem === 'metric' ? 'grams, kilograms, millilitres, litres' : unitSystem === 'imperial' ? 'pounds, ounces, fluid ounces' : 'cups, pounds, fluid ounces'} when stating quantities.
- Reply in plain prose without markdown formatting (no **bold**, no bullet asterisks, no #headings) — output will be read aloud by TTS.

USER QUESTION: ${q}`;

    try {
      const { data, error } = await supabase.functions.invoke('sous-chat', {
        body: { prompt: promptDirective, context: currentKitchenContextData }
      });
      if (error) throw error;
      const replyText = data?.reply || "Heard. I processed the request but encountered a blank return matrix. Please try again.";
      setChat(prev => [...prev, { speaker: 'sous', text: replyText }]);
      // Speak the reply if the user asked for it via the toggle OR if they
      // sent the question by voice (in which case they almost certainly want
      // a voice answer back).
      if (autoSpeak || wasVoiceInput) speak(replyText, { followUp: true });
    } catch (err) {
      console.error("Sous AI Communication Error:", err);
      setChat(prev => [...prev, {
        speaker: 'sous',
        text: `Error connecting to AI engine: ${err.message || 'Check your edge function configuration parameters.'}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    submitQuery(query, false);
  };

  return (
    <div style={S.container}>
      <div style={{ marginBottom: 24, borderBottom: `1px solid ${C.inkRule}`, paddingBottom: 16 }}>
        <h1 style={{ fontFamily: "'Bitter', serif", fontSize: 32, fontWeight: 900, color: C.ink, margin: 0 }}>Sous AI Context Engine</h1>
        <p style={{ fontSize: 13, color: C.inkFade, margin: '4px 0 0 0' }}>Live OpenAI analysis bounded by your kitchen metrics data ledger</p>
      </div>

      {/* Voice mode controls — mobile-first layout with bigger touch targets */}
      {(voiceSupported || ttsSupported) && (() => {
        // Shared row style — stacks vertically on mobile (full-width tappable
        // rows), inline on desktop. Big checkboxes for finger taps.
        const rowStyle = {
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: isMobile ? 14 : 13,
          color: C.ink,
          cursor: 'pointer',
          padding: isMobile ? '10px 4px' : '0',
          borderTop: isMobile ? `1px solid ${C.paper2}` : 'none',
          minHeight: isMobile ? 40 : 'auto'
        };
        const checkboxStyle = {
          width: isMobile ? 20 : 16,
          height: isMobile ? 20 : 16,
          accentColor: C.accent,
          flexShrink: 0,
          cursor: 'pointer'
        };
        const firstRowStyle = { ...rowStyle, borderTop: 'none' };

        return (
          <div style={{
            background: '#fff',
            border: `1px solid ${C.paper2}`,
            borderRadius: 4,
            padding: isMobile ? '4px 12px 8px' : '10px 14px',
            marginBottom: 12,
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: isMobile ? 0 : 18,
            flexWrap: 'wrap'
          }}>
            <div style={{
              fontSize: 10,
              fontWeight: 800,
              color: C.accent,
              letterSpacing: 1,
              textTransform: 'uppercase',
              padding: isMobile ? '10px 0 6px' : 0
            }}>
              Hands-Free
            </div>

            {ttsSupported && (
              <label style={firstRowStyle}>
                <input
                  type="checkbox"
                  checked={autoSpeak}
                  onChange={e => { setAutoSpeak(e.target.checked); if (!e.target.checked) stopSpeaking(); }}
                  style={checkboxStyle}
                />
                <span>Speak replies aloud</span>
              </label>
            )}

            {voiceSupported && (
              <label style={rowStyle}>
                <input
                  type="checkbox"
                  checked={autoSubmit}
                  onChange={e => setAutoSubmit(e.target.checked)}
                  style={checkboxStyle}
                />
                <span>Auto-send after I stop talking</span>
              </label>
            )}

            {voiceSupported && ttsSupported && (
              <label style={rowStyle}>
                <input
                  type="checkbox"
                  checked={continuous}
                  onChange={e => setContinuous(e.target.checked)}
                  style={checkboxStyle}
                />
                <span>Continuous conversation</span>
              </label>
            )}

            {ttsSupported && availableVoices.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: isMobile ? 13 : 12,
                color: C.ink,
                padding: isMobile ? '10px 4px' : '0',
                borderTop: isMobile ? `1px solid ${C.paper2}` : 'none',
                minHeight: isMobile ? 40 : 'auto',
                flexWrap: 'wrap'
              }}>
                <label style={{ fontWeight: 600, flexShrink: 0 }}>Voice:</label>
                <select
                  value={selectedVoiceName}
                  onChange={e => {
                    const v = e.target.value;
                    setSelectedVoiceName(v);
                    try { localStorage.setItem(TTS_VOICE_STORAGE_KEY, v); } catch {}
                    // Demo the picked voice with a short sample so the user
                    // can hear it immediately
                    stopSpeaking();
                    setTimeout(() => {
                      const sample = "Chef, this is the voice I will use.";
                      const utter = new SpeechSynthesisUtterance(sample);
                      const chosen = pickBestVoice(v);
                      if (chosen) { utter.voice = chosen; utter.lang = chosen.lang || 'en-US'; }
                      utter.rate = 1.15;
                      window.speechSynthesis.speak(utter);
                    }, 100);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '6px 8px',
                    border: `1px solid ${C.paper2}`,
                    borderRadius: 3,
                    fontSize: 12,
                    background: '#fff',
                    fontFamily: 'inherit',
                    cursor: 'pointer'
                  }}
                  title="Pick a voice — preview plays on change"
                >
                  <option value="">Auto-detect best (recommended)</option>
                  {availableVoices.map(v => (
                    <option key={v.name} value={v.name}>
                      {v.name} {v.lang ? `(${v.lang})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!voiceSupported && (
              <span style={{
                fontSize: 12,
                color: C.inkFade,
                fontStyle: 'italic',
                padding: isMobile ? '10px 0' : 0
              }}>
                Voice input not supported in this browser. Try Chrome, Edge, or Safari.
              </span>
            )}
          </div>
        );
      })()}

      {voiceError && (
        <div style={{ background: '#5c1d1d', color: '#fff', padding: 10, borderRadius: 4, marginBottom: 12, fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠ {voiceError}</span>
          <button onClick={() => setVoiceError('')} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      <div style={{ ...S.card, height: 500, display: "flex", flexDirection: "column", background: "#0e0e0c", color: "#f7f1e3", border: `1px solid ${C.inkRule}`, padding: 0, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, padding: 20 }}>
          {chat.map((msg, i) => (
            <div
              key={i}
              style={{
                alignSelf: msg.speaker === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: "85%",
                background: msg.speaker === 'user' ? C.accent : '#1a1a18',
                color: msg.speaker === 'user' ? '#fff' : '#efe6d3',
                padding: "12px 16px",
                border: `1px solid ${C.inkRule}`,
                borderRadius: '4px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: msg.speaker === 'user' ? '#f5e9c8' : C.inkFade, letterSpacing: '0.5px' }}>
                  {msg.speaker.toUpperCase()}
                </div>
                {msg.speaker === 'sous' && ttsSupported && (
                  <button onClick={() => speak(msg.text)} title="Speak this reply" style={{ background: 'transparent', border: 'none', color: C.inkFade, cursor: 'pointer', fontSize: 13, padding: '0 4px' }}>🔊</button>
                )}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start', background: '#1a1a18', padding: "12px 16px", borderRadius: '4px', border: `1px solid ${C.inkRule}`, color: C.inkFade, fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
              SOUS IS ANALYZING SYSTEM LEDGERS...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSend} style={{ display: "flex", gap: 8, borderTop: `1px solid ${C.inkRule}`, padding: 12, background: '#121210' }}>
          {voiceSupported && (
            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              disabled={loading}
              title={listening ? 'Tap to stop listening' : 'Tap to speak'}
              style={{
                width: 48, height: 40, borderRadius: 4, border: 'none',
                background: listening ? '#c14a3a' : '#2a2a26',
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 18,
                opacity: loading ? 0.5 : 1,
                animation: listening ? 'sous-pulse 1.2s infinite' : 'none',
                flexShrink: 0
              }}
            >
              {listening ? '⏺' : '🎙'}
            </button>
          )}
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={listening ? "🎙 Listening... speak now" : (loading ? "Analyzing data context structures..." : "Ask Sous, or tap the mic to talk")}
            disabled={loading}
            style={{ ...S.input, background: "#000", color: "#fff", border: listening ? "1px solid #c14a3a" : "1px solid #2a2a26", flex: 1, opacity: loading ? 0.6 : 1, minWidth: 0 }}
          />
          <button type="submit" disabled={loading} style={{ ...S.btnAccent, padding: '0 24px', height: 40, opacity: loading ? 0.6 : 1, flexShrink: 0 }}>
            {loading ? "Thinking..." : "Ask"}
          </button>
        </form>
      </div>

      {/* Inline keyframes for the listening pulse */}
      <style>{`
        @keyframes sous-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(193, 74, 58, 0.7); }
          50% { box-shadow: 0 0 0 8px rgba(193, 74, 58, 0); }
        }
      `}</style>
    </div>
  );
}



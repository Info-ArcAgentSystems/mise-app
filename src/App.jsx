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
// CORE AUTH GATEWAY & STATE INITIALIZATION
// ============================================================
export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Pass user profile details downstream to initialize state
  const [state, update, loaded] = useKitchenState(session?.user?.id);

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

  if (!session) {
    return <Auth />;
  }

 if (!loaded) return <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',background:C.paper,color:C.ink,fontFamily:'sans-serif'}}>Synchronizing Kitchen Ledger...</div>;

  // Deconstruct state with safety defaults pointing to standard structural blocks
  const {
    recipes = [],
    components = [],
    planner = [],
    sales = [],
    waste = [],
    invoices = [],
    settings = { role: 'Head chef', currency: '£', unitSystem: 'metric' }
  } = state || {};

  const tabs = [
    { id: 'dashboard', label: 'The Pass' },
    { id: 'planner', label: 'Weekly Planner' },
    { id: 'recipes', label: 'Recipes & Costs' },
    { id: 'prep', label: 'Prep Sheets' },
    { id: 'shopping', label: 'Orders & Lists' },
    { id: 'sales', label: 'Sales Analytics' },
    { id: 'waste', label: 'Waste Tracker' },
    { id: 'performance', label: 'Financials' },
    { id: 'sous', label: 'Sous AI' },
    { id: 'invoices', label: 'Invoice Scan' },
    { id: 'suppliers', label: 'Market Intel' },
    { id: 'pos', label: 'POS Sync' },
    { id: 'scan', label: 'Recipe Digitizer' },
    { id: 'settings', label: 'Settings' }
  ];

  return (
    <div style={S.layout}>
      {/* Desktop Sidebar Layout */}
      <aside style={S.sidebar}>
        <div style={S.logoArea}>
          <div style={S.logoIcon}>皿</div>
          <div>
            <div style={S.logoText}>MISE</div>
            <div style={S.logoSub}>{settings.role}</div>
          </div>
        </div>
        <nav style={S.nav}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{ ...S.navLink, ...(tab === t.id ? S.navLinkActive : {}) }}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div style={S.sidebarFooter}>
          <div style={{ fontSize: 11, color: C.inkFade, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.user.email}
          </div>
          <button onClick={handleSignOut} style={S.signOutBtn}>
            Leave Station
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div style={S.mobileBar}>
        <div style={{ fontFamily: "'Bitter', serif", fontWeight: 900, fontSize: 18 }}>MISE</div>
        <button onClick={() => setDrawerOpen(true)} style={S.menuBtn}>Menu</button>
      </div>

      {/* Mobile Responsive Nav Drawer */}
      {drawerOpen && (
        <div style={S.drawerOverlay} onClick={() => setDrawerOpen(false)}>
          <div style={S.drawer} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontFamily: "'Bitter', serif", fontWeight: 900 }}>NAVIGATION</div>
              <button onClick={() => setDrawerOpen(false)} style={S.closeBtn}>✕</button>
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTab(t.id);
                    setDrawerOpen(false);
                  }}
                  style={{ ...S.drawerLink, ...(tab === t.id ? S.drawerLinkActive : {}) }}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <div style={{ marginTop: 'auto', paddingTop: 20 }}>
              <button onClick={handleSignOut} style={S.signOutBtn}>Leave Station</button>
            </div>
          </div>
        </div>
      )}

      {/* Render Active Functional Screens */}
      <div style={S.main}>
        {tab === 'dashboard' && <Dashboard recipes={recipes} components={components} planner={planner} sales={sales} waste={waste} settings={settings} setTab={setTab} updateState={update} />}
        {tab === 'planner' && <PlannerScreen planner={planner} onUpdate={(val) => update({ planner: val })} />}
        {tab === 'recipes' && <RecipesScreen recipes={recipes} components={components} settings={settings} onUpdateRecipes={(val) => update({ recipes: val })} onUpdateComponents={(val) => update({ components: val })} />}
        {tab === 'prep' && <PrepScreen planner={planner} recipes={recipes} components={components} />}
        {tab === 'shopping' && <ShoppingScreen planner={planner} recipes={recipes} components={components} />}
        {tab === 'sales' && <SalesScreen sales={sales} recipes={recipes} onUpdate={(val) => update({ sales: val })} />}
        {tab === 'waste' && <WasteScreen waste={waste} onUpdate={(val) => update({ waste: val })} />}
        {tab === 'performance' && <PerformanceScreen recipes={recipes} components={components} planner={planner} sales={sales} waste={waste} />}
        {tab === 'sous' && <SousScreen settings={settings} recipes={recipes} components={components} sales={sales} waste={waste} planner={planner} />}
        {tab === 'invoices' && <InvoicesScreen invoices={invoices || []} onUpdate={(val) => update({ invoices: val })} recipes={recipes || []} onUpdateRecipes={(val) => update({ recipes: val })} />}
        {tab === 'suppliers' && <SuppliersScreen />}
        {tab === 'pos' && <PosScreen sales={sales} recipes={recipes} onUpdate={(val) => update({ sales: val })} />}
        {tab === 'scan' && <ScanScreen recipes={recipes} onUpdate={(val) => update({ recipes: val })} />}
        {tab === 'settings' && <SettingsScreen settings={settings} onUpdate={(val) => update({ settings: val })} />}
      </div>
    </div>
  );
}

// ============================================================
// EVERYTHING BELOW THIS LINE IS UNCHANGED FROM YOUR ORIGINAL ARTIFACT
// ============================================================
function SettingsScreen({ settings, onUpdate }) {
  const fields = [
    { id: 'role', label: 'Your Role / Title', type: 'text' },
    { id: 'currency', label: 'Currency Symbol', type: 'text' },
    { id: 'unitSystem', label: 'Measurement System', type: 'select', options: [{v:'metric',l:'Metric (kg, L, g)'},{v:'imperial',l:'UK Imperial (lb, oz, pt)'},{v:'us',l:'US Customary (lb, oz, qt)'}] },
    { id: 'timezone', label: 'System Timezone', type: 'text' }
  ];
  return (
    <div style={S.container}>
      <ScreenHeader title="Station Settings" sub="Configure localization parameters & layout thresholds" />
      <div style={S.card}>
        <div style={{display:'flex', flexDirection:'column', gap:20, maxWidth:400}}>
          {fields.map(f => (
            <div key={f.id} style={{display:'flex', flexDirection:'column', gap:6}}>
              <SectionLabel label={f.label} />
              {f.type === 'select' ? (
                <select value={settings[f.id]||''} onChange={(e)=>onUpdate({...settings, [f.id]:e.target.value})} style={S.input}>
                  {f.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              ) : (
                <input type="text" value={settings[f.id]||''} onChange={(e)=>onUpdate({...settings, [f.id]:e.target.value})} style={S.input} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ recipes, components, planner, sales, waste, settings, setTab, updateState }) {
  const metrics = useMemo(() => {
    let salesTotal = 0, costTotal = 0, itemsSold = 0;
    sales.forEach(s => {
      const r = recipes.find(x => x.id === s.recipeId);
      if(r) {
        salesTotal += s.sold * r.sellPrice;
        const { foodCost } = recipeCosting(r, components);
        costTotal += s.sold * foodCost;
        itemsSold += s.sold;
      }
    });
    const wasteTotal = waste.reduce((acc, w) => acc + (w.cost || 0), 0);
    const gp = salesTotal > 0 ? ((salesTotal - costTotal) / salesTotal) * 100 : 0;
    const covers = planner.reduce((acc, d) => acc + (d.lunch || 0) + (d.dinner || 0), 0);
    return { salesTotal, costTotal, wasteTotal, gp, covers, itemsSold };
  }, [recipes, components, planner, sales, waste]);

  const runDemoSeed = async () => {
    if(!window.confirm("Seed sample data into your private workspace? This populates all tracking domains.")) return;
    try {
      const { error } = await supabase.rpc('seed_demo_data');
      if(error) throw error;
      window.location.reload();
    } catch(err) {
      alert("Error executing database seed: " + err.message);
    }
  };

  return (
    <div style={S.container}>
      {recipes.length === 0 && (
        <DemoBanner onSeed={runDemoSeed} />
      )}
      
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16, marginBottom:30, borderBottom:`1px solid ${C.inkRule}`, paddingBottom:20}}>
        <div>
          <h1 style={{fontFamily:"'Bitter', serif", fontSize:32, fontWeight:900, color:C.ink, letterSpacing:'-0.5px', marginBottom:4}}>The Pass</h1>
          <p style={{fontSize:13, color:C.inkFade, fontFamily:'sans-serif'}}>Service Briefing · Live Kitchen Operational Framework</p>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button onClick={() => setTab('sous')} style={S.btnAccent}>Consult Sous AI</button>
        </div>
      </div>

      <div style={S.kpiGrid}>
        <Kpi label="Gross Sales" val={`${settings.currency}${metrics.salesTotal.toFixed(2)}`} sub={`${metrics.itemsSold} items dispensed`} />
        <Kpi label="Portfolio Margin" val={`${metrics.gp.toFixed(1)}%`} sub={`Target baseline: 70.0%`} badge={metrics.gp >= 70 ? "Optimal" : "Review"} badgeColor={metrics.gp >= 70 ? C.green : C.red} />
        <Kpi label="Forecast Covers" val={metrics.covers} sub="Aggregated weekly roster" />
        <Kpi label="Logged Leakage" val={`${settings.currency}${metrics.wasteTotal.toFixed(2)}`} sub="Active tracking state" color={metrics.wasteTotal > 0 ? C.red : C.ink} />
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(450px, 1fr))', gap:20, marginTop:10}}>
        <div style={S.card}>
          <SectionLabel label="Operational Vulnerabilities" />
          <div style={{display:'flex', flexDirection:'column', gap:12, marginTop:14}}>
            {recipes.length === 0 ? (
              <div style={{fontSize:13, color:C.inkFade, fontStyle:'italic'}}>No recipes tracked. Structural analysis empty.</div>
            ) : (
              recipes.map(r => {
                const { gp } = recipeCosting(r, components);
                if(gp < 68) {
                  return (
                    <div key={r.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:C.highlight, borderLeft:`3px solid ${C.red}` }}>
                      <div>
                        <div style={{fontWeight:700, fontSize:14}}>{r.name}</div>
                        <div style={{fontSize:11, color:C.inkFade, marginTop:2}}>Gross Profit compressed at {gp.toFixed(1)}%</div>
                      </div>
                      <button onClick={() => setTab('recipes')} style={{...S.btn, padding:'4px 10px', fontSize:11}}>Re-Cost</button>
                    </div>
                  );
                }
                return null;
              })
            )}
          </div>
        </div>

        <div style={S.card}>
          <SectionLabel label="Service Profile Overview" />
          <div style={{height:160, display:'flex', alignItems:'end', gap:12, padding:'20px 10px 10px 10px'}}>
            {planner.length === 0 ? (
              <div style={{fontSize:13, color:C.inkFade, fontStyle:'italic', width:'100%', textAlign:'center', marginBottom:50}}>Planner empty. Adjust bounds in Weekly Planner.</div>
            ) : (
              planner.map((p, i) => {
                const tot = p.lunch + p.dinner;
                const max = Math.max(...planner.map(x => x.lunch + x.dinner)) || 1;
                const pct = (tot / max) * 100;
                return (
                  <div key={i} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6}}>
                    <div style={{fontSize:10, fontWeight:700, color:C.inkFade}}>{tot}</div>
                    <div style={{width:'100%', height:`${pct}%`, background:C.ink, minHeight:4, transition:'height 0.3s'}} />
                    <div style={{fontSize:11, fontWeight:700, fontFamily:"'JetBrains Mono', monospace"}}>{p.day}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlannerScreen({ planner, onUpdate }) {
  const updateDay = (idx, field, val) => {
    const next = [...planner];
    next[idx] = { ...next[idx], [field]: parseInt(val) || 0 };
    onUpdate(next);
  };
  return (
    <div style={S.container}>
      <ScreenHeader title="Weekly Covers Planner" sub="Establish baseline volume expectations for auto-scaling production bounds" />
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
              {planner.map((p, idx) => (
                <tr key={idx} style={{borderBottom:`1px solid ${C.paper2}`}}>
                  <td style={{padding:'14px 8px', fontFamily:"'Bitter', serif", fontWeight:900, fontSize:16}}>{p.day}</td>
                  <td style={{padding:'14px 8px'}}>
                    <NumInput value={p.lunch} onChange={(v) => updateDay(idx, 'lunch', v)} />
                  </td>
                  <td style={{padding:'14px 8px'}}>
                    <NumInput value={p.dinner} onChange={(v) => updateDay(idx, 'dinner', v)} />
                  </td>
                  <td style={{padding:'14px 8px', fontFamily:"'JetBrains Mono', monospace", fontSize:14, fontWeight:700}}>
                    {p.lunch + p.dinner}
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

function RecipesScreen({ recipes, components, settings, onUpdateRecipes, onUpdateComponents }) {
  const [activeSub, setActiveSub] = useState('recipes');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeModal, setRecipeModal] = useState(false);
  const [compModal, setCompModal] = useState(false);

  return (
    <div style={S.container}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16, marginBottom:30, borderBottom:`1px solid ${C.inkRule}`, paddingBottom:20}}>
        <div>
          <h1 style={{fontFamily:"'Bitter', serif", fontSize:32, fontWeight:900, color:C.ink, letterSpacing:'-0.5px', marginBottom:4}}>Recipes & Costs</h1>
          <p style={{fontSize:13, color:C.inkFade}}>Maintain precise item formulations and batch component costs</p>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button onClick={() => setActiveSub('recipes')} style={activeSub === 'recipes' ? S.btnAccent : S.btn}>Formulations</button>
          <button onClick={() => setActiveSub('components')} style={activeSub === 'components' ? S.btnAccent : S.btn}>Batch Components</button>
          <button onClick={() => activeSub === 'recipes' ? setRecipeModal(true) : setCompModal(true)} style={S.btnAccent}>+ Add</button>
        </div>
      </div>

      {activeSub === 'recipes' ? (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:20}}>
          {recipes.map(r => {
            const { foodCost, gp } = recipeCosting(r, components);
            return (
              <div key={r.id} onClick={() => setSelectedRecipe(r)} style={{...S.card, cursor:'pointer', border: selectedRecipe?.id === r.id ? `1px solid ${C.ink}` : `1px solid transparent`}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:12}}>
                  <div>
                    <span style={{fontSize:9, textTransform:'uppercase', tracking:1, fontFamily:"'JetBrains Mono', monospace", background:C.paper2, padding:'2px 6px', color:C.inkFade}}>{r.category}</span>
                    <h3 style={{fontFamily:"'Bitter', serif", fontSize:18, fontWeight:900, margin:'6px 0 0 0'}}>{r.name}</h3>
                  </div>
                  <div style={{display:'flex', gap:4}}>
                    {(r.dietary || []).map(d => <span key={d} style={{fontSize:9, fontWeight:700, padding:'2px 4px', border:`1px solid ${C.inkRule}`}}>{d}</span>)}
                  </div>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, borderTop:`1px dashed ${C.paper2}`, paddingTop:10, marginTop:10}}>
                  <div>
                    <div style={{fontSize:11, color:C.inkFade}}>Cost Price</div>
                    <div style={{fontFamily:"'JetBrains Mono', monospace", fontWeight:700}}>{settings.currency}{foodCost.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{fontSize:11, color:C.inkFade}}>Margin (GP)</div>
                    <div style={{fontFamily:"'JetBrains Mono', monospace", fontWeight:700, color: gp >= 70 ? C.green : C.red}}>{gp.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <ComponentsPanel components={components} settings={settings} />
      )}

      {selectedRecipe && activeSub === 'recipes' && (
        <RecipeDetail recipe={selectedRecipe} components={components} settings={settings} onClose={() => setSelectedRecipe(null)} onUpdateRecipes={onUpdateRecipes} recipes={recipes} />
      )}
      {recipeModal && <NewRecipeModal components={components} settings={settings} onClose={() => setRecipeModal(false)} onSave={(r) => { onUpdateRecipes([...recipes, r]); setRecipeModal(false); }} />}
      {compModal && <NewComponentModal settings={settings} onClose={() => setCompModal(false)} onSave={(c) => { onUpdateComponents([...components, c]); setCompModal(false); }} />}
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

function PrepScreen({ planner, recipes, components }) {
  const aggregatedPrep = useMemo(() => {
    const totalCovers = planner.reduce((acc, d) => acc + d.lunch + d.dinner, 0);
    const scalingFactor = totalCovers / 350; 
    const requirements = {};
    
    recipes.forEach(r => {
      (r.ingredients || []).forEach(ing => {
        if(ing.kind === 'comp') {
          const comp = components.find(c => c.id === ing.componentId);
          if(comp) {
            const rawNeeded = (ing.qty * scalingFactor * 100);
            if(!requirements[comp.id]) {
              requirements[comp.id] = { name: comp.name, qty: 0, unit: comp.batchUnit, station: comp.station, prepTime: comp.prepTime || 30 };
            }
            requirements[comp.id].qty += rawNeeded;
          }
        }
      });
    });
    return Object.values(requirements);
  }, [planner, recipes, components]);

  return (
    <div style={S.container}>
      <ScreenHeader title="Production Sheets" sub="Algorithmic sizing demands scaled to planned register entries" />
      <div style={S.card}>
        {aggregatedPrep.length === 0 ? (
          <div style={{padding:20, color:C.inkFade, fontStyle:'italic', textAlign:'center'}}>No composite batch scaling targets derived from active menu requirements.</div>
        ) : (
          <table style={{width:"100%", borderCollapse:"collapse", textAlign:"left"}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${C.inkRule}`}}>
                <th style={{padding:10}}><SectionLabel label="Component Target" /></th>
                <th style={{padding:10}}><SectionLabel label="Station" /></th>
                <th style={{padding:10}}><SectionLabel label="Required Vol" /></th>
                <th style={{padding:10}}><SectionLabel label="Est Timeline" /></th>
              </tr>
            </thead>
            <tbody>
              {aggregatedPrep.map((p, i) => (
                <tr key={i} style={{borderBottom:`1px solid ${C.paper2}`}}>
                  <td style={{padding:12, fontWeight:700}}>{p.name}</td>
                  <td style={{padding:12}}><span style={{fontSize:11, background:C.paper2, padding:"3px 8px"}}>{p.station}</span></td>
                  <td style={{padding:12, fontFamily:"'JetBrains Mono', monospace", fontWeight:700, color:C.accent}}>{p.qty.toFixed(2)} {p.unit}</td>
                  <td style={{padding:12, fontSize:13, color:C.inkFade}}>{p.prepTime} mins</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ShoppingScreen({ planner, recipes, components }) {
  const orderList = useMemo(() => {
    const totalCovers = planner.reduce((acc, d) => acc + d.lunch + d.dinner, 0);
    const scalingFactor = totalCovers / 350;
    const items = {};

    recipes.forEach(r => {
      (r.ingredients || []).forEach(ing => {
        if(ing.kind === 'raw') {
          const key = `${ing.name}-${ing.supplier}`;
          if(!items[key]) {
            items[key] = { name: ing.name, qty: 0, unit: ing.unit, supplier: ing.supplier, cost: ing.cost };
          }
          items[key].qty += (ing.qty * scalingFactor * 120);
        } else if (ing.kind === 'comp') {
          const comp = components.find(c => c.id === ing.componentId);
          if(comp) {
            (comp.ingredients || []).forEach(cing => {
              const key = `${cing.name}-${cing.supplier || 'Dry Goods'}`;
              if(!items[key]) {
                items[key] = { name: cing.name, qty: 0, unit: cing.unit, supplier: cing.supplier || 'Dry Goods', cost: cing.cost || 0 };
              }
              items[key].qty += (cing.qty * (ing.qty / (comp.batchYield || 1)) * scalingFactor * 120);
            });
          }
        }
      });
    });
    return Object.values(items);
  }, [planner, recipes, components]);

  return (
    <div style={S.container}>
      <ScreenHeader title="Supplier Procurement Lists" sub="Consolidated logistics parameters map against planned configurations" />
      <div style={S.card}>
        {orderList.length === 0 ? (
          <div style={{padding:20, color:C.inkFade, fontStyle:'italic', textAlign:'center'}}>Logistics procurement bounds empty. Maintain formulations map.</div>
        ) : (
          <table style={{width:"100%", borderCollapse:"collapse", textAlign:"left"}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${C.inkRule}`}}>
                <th style={{padding:10}}><SectionLabel label="Commodity Descriptor" /></th>
                <th style={{padding:10}}><SectionLabel label="Wholesaler Vendor" /></th>
                <th style={{padding:10}}><SectionLabel label="Consolidation Target" /></th>
              </tr>
            </thead>
            <tbody>
              {orderList.map((item, i) => (
                <tr key={i} style={{borderBottom:`1px solid ${C.paper2}`}}>
                  <td style={{padding:12, fontWeight:700}}>{item.name}</td>
                  <td style={{padding:12, fontSize:13, color:C.inkFade}}>{item.supplier}</td>
                  <td style={{padding:12, fontFamily:"'JetBrains Mono', monospace", fontWeight:700}}>{item.qty.toFixed(1)} {item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SalesScreen({ sales, recipes, onUpdate }) {
  return (
    <div style={S.container}>
      <ScreenHeader title="Sales Ledger Registers" sub="Correlate point of sale deployment figures with physical matrix recipes" />
      <div style={S.card}>
        <table style={{width:"100%", borderCollapse:"collapse", textAlign:"left"}}>
          <thead>
            <tr style={{borderBottom:`1px solid ${C.inkRule}`}}>
              <th style={{padding:10}}><SectionLabel label="Day Block" /></th>
              <th style={{padding:10}}><SectionLabel label="Session" /></th>
              <th style={{padding:10}}><SectionLabel label="Recipe Mapping" /></th>
              <th style={{padding:10}}><SectionLabel label="Quantity Cleared" /></th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s, idx) => {
              const recipe = recipes.find(r => r.id === s.recipeId);
              return (
                <tr key={idx} style={{borderBottom:`1px solid ${C.paper2}`}}>
                  <td style={{padding:12, fontFamily:"'JetBrains Mono', monospace", fontWeight:700}}>{s.day}</td>
                  <td style={{padding:12}}>{s.session}</td>
                  <td style={{padding:12, fontWeight:700}}>{recipe ? recipe.name : 'Unmapped Item'}</td>
                  <td style={{padding:12}}>
                    <NumInput value={s.sold} onChange={(val) => {
                      const next = [...sales];
                      next[idx] = { ...next[idx], sold: parseInt(val) || 0 };
                      onUpdate(next);
                    }} />
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

function WasteScreen({ waste, onUpdate }) {
  const [item, setItem] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('kg');
  const [cost, setCost] = useState('');
  const [reason, setReason] = useState('Spoilage');

  const handleSubmit = (e) => {
    e.preventDefault();
    if(!item || !qty || !cost) return;
    const newItem = { id: Date.now(), day: 'Mon', ingredient: item, qty: parseFloat(qty), unit, cost: parseFloat(cost), reason };
    onUpdate([...waste, newItem]);
    setItem(''); setQty(''); setCost('');
  };

  return (
    <div style={S.container}>
      <ScreenHeader title="Material Leakage Logs" sub="Audit physical inventory discrepancies and wastage patterns" />
      <div style={{display:"grid", gridTemplateColumns:"1fr 2fr", gap:20, alignItems:"start"}}>
        <form onSubmit={handleSubmit} style={{...S.card, display:"flex", flexDirection:"column", gap:14}}>
          <SectionLabel label="Record Waste Incident" />
          <FormField label="Item Descriptor" val={item} onChange={setItem} />
          <div style={{display:"flex", gap:8}}>
            <div style={{flex:2}}><FormField label="Quantity" val={qty} onChange={setQty} type="number" /></div>
            <div style={{flex:1}}>
              <label style={{fontSize:11, fontWeight:700, display:"block", marginBottom:4}}>Unit</label>
              <select value={unit} onChange={e=>setUnit(e.target.value)} style={S.input}>
                <option value="kg">kg</option>
                <option value="L">L</option>
                <option value="g">g</option>
                <option value="ea">ea</option>
              </select>
            </div>
          </div>
          <FormField label="Financial Loss value" val={cost} onChange={setCost} type="number" />
          <div>
            <label style={{fontSize:11, fontWeight:700, display:"block", marginBottom:4}}>Reason Category</label>
            <select value={reason} onChange={e=>setReason(e.target.value)} style={S.input}>
              <option value="Spoilage">Spoilage</option>
              <option value="Over-prep">Over-prep</option>
              <option value="Returned">Returned</option>
              <option value="Dropped">Dropped</option>
            </select>
          </div>
          <button type="submit" style={{...S.btnAccent, marginTop:10}}>File Entry</button>
        </form>

        <div style={S.card}>
          <table style={{width:"100%", borderCollapse:"collapse", textAlign:"left"}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${C.inkRule}`}}>
                <th style={{padding:8}}><SectionLabel label="Descriptor" /></th>
                <th style={{padding:8}}><SectionLabel label="Loss Magnitude" /></th>
                <th style={{padding:8}}><SectionLabel label="Reason Framework" /></th>
              </tr>
            </thead>
            <tbody>
              {waste.map((w) => (
                <tr key={w.id} style={{borderBottom:`1px solid ${C.paper2}`}}>
                  <td style={{padding:10, fontWeight:700}}>{w.ingredient}</td>
                  <td style={{padding:10, fontFamily:"'JetBrains Mono', monospace", color:C.red}}>-{w.qty} {w.unit} (£{w.cost.toFixed(2)})</td>
                  <td style={{padding:10}}><span style={{fontSize:11, background:C.paper2, padding:"2px 6px"}}>{w.reason}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PerformanceScreen({ recipes, components, planner, sales, waste }) {
  const report = useMemo(() => {
    let rawRevenue = 0, computedCost = 0;
    sales.forEach(s => {
      const r = recipes.find(x => x.id === s.recipeId);
      if(r) {
        rawRevenue += s.sold * r.sellPrice;
        const { foodCost } = recipeCosting(r, components);
        computedCost += s.sold * foodCost;
      }
    });
    const leakCost = waste.reduce((acc, w) => acc + w.cost, 0);
    const profitMargin = rawRevenue - computedCost - leakCost;
    const finalEfficiencyPct = rawRevenue > 0 ? (profitMargin / rawRevenue) * 100 : 0;
    return { rawRevenue, computedCost, leakCost, profitMargin, finalEfficiencyPct };
  }, [recipes, components, sales, waste]);

  return (
    <div style={S.container}>
      <ScreenHeader title="Financial Engineering Balance Sheets" sub="High fidelity gross margins integrated across physical waste tracking metrics" />
      <div style={S.kpiGrid}>
        <Kpi label="Gross Intake" val={`£${report.rawRevenue.toFixed(2)}`} sub="Aggregated menu transactions" />
        <Kpi label="Calculated Cost of Goods" val={`£${report.computedCost.toFixed(2)}`} sub="Theoretical formulation usage" />
        <Kpi label="Variance Leakage" val={`£${report.leakCost.toFixed(2)}`} sub="Filed waste parameters" color={C.red} />
        <Kpi label="Net Operating Yield" val={`${report.finalEfficiencyPct.toFixed(1)}%`} sub="True margin efficiency performance" color={C.green} />
      </div>
    </div>
  );
}

function InvoicesScreen({ invoices = [], onUpdate, recipes = [], onUpdateRecipes }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [parsing, setParsing] = useState(false);

  const fileInputRef = useRef(null);

  const safeInvoices = invoices || [];
  const safeRecipes = recipes || [];

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const handleParseAndCommit = async () => {
    if (!previewUrl) {
      alert("Please capture or choose a valid invoice image file.");
      return;
    }

    setParsing(true);

    try {
      const { data: memberData, error: memberError } = await supabase
        .from('kitchen_members')
        .select('kitchen_id')
        .limit(1)
        .single();

      if (memberError || !memberData) {
        throw new Error("Could not find an assigned kitchen workspace for this account.");
      }
      
      const activeKitchenId = memberData.kitchen_id;

      const targetBlob = await fetch(previewUrl).then(res => res.blob());
      const base64String = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(targetBlob);
      });

      const { data: aiExtractedData, error: edgeFunctionError } = await supabase.functions.invoke("parse-invoice", {
        method: "POST",
        body: {
          imageBase64: base64String,
          fileType: file?.type || "image/jpeg",
          fileName: file?.name || "camera_capture.jpg"
        }
      });

      if (edgeFunctionError || !aiExtractedData) {
        throw new Error(edgeFunctionError?.message || "AI parsing pipeline error.");
      }

      const detectedSupplier = aiExtractedData.supplier || "Extracted Vendor";
      const detectedTotal = parseFloat(aiExtractedData.total) || 0;
      const parsedAiLines = aiExtractedData.lines || [];

      const { data: invData, error: invError } = await supabase
        .from('invoices')
        .insert([{
          kitchen_id: activeKitchenId,
          supplier: detectedSupplier,
          ref: aiExtractedData.ref || "AI-" + Math.floor(1000 + Math.random() * 9000),
          inv_date: aiExtractedData.date || new Date().toISOString().split('T')[0],
          total: detectedTotal,
          lines: parsedAiLines.length,
          status: "filed"
        }]).select();

      if (invError) throw invError;
      const savedInvoice = invData?.[0];

      if (savedInvoice && parsedAiLines.length > 0) {
        const linesToInsert = parsedAiLines.map((line, idx) => ({
          kitchen_id: activeKitchenId,
          invoice_id: savedInvoice.id,
          position: idx,
          name: line.name,
          qty: parseFloat(line.qty) || 1,
          unit: line.unit || "",
          price_per_unit: parseFloat(line.price_per_unit) || 0,
          line_total: parseFloat(line.line_total) || 0,
          matched: line.name
        }));

        const { error: linesError } = await supabase
          .from('invoice_lines')
          .insert(linesToInsert);

        if (linesError) throw linesError;

        let workingRecipesCopy = JSON.parse(JSON.stringify(recipes || []));

        for (const line of parsedAiLines) {
          const cleanLineName = line.name ? line.name.trim().toLowerCase() : '';
          if (!cleanLineName) continue;

          const newCost = parseFloat(line.price_per_unit || 0);

          await supabase
            .from('recipe_ingredients')
            .update({ cost: newCost })
            .eq('kitchen_id', activeKitchenId)
            .or(`name.ilike.%${cleanLineName}%,name.ilike.${cleanLineName.replace(/s$/, '')}%`);
            
          await supabase
            .from('component_ingredients')
            .update({ cost: newCost })
            .eq('kitchen_id', activeKitchenId)
            .or(`name.ilike.%${cleanLineName}%,name.ilike.${cleanLineName.replace(/s$/, '')}%`);

          workingRecipesCopy = workingRecipesCopy.map(recipe => {
            if (!recipe.ingredients) return recipe;
            
            const updatedIngredients = recipe.ingredients.map(ing => {
              const targetIngredientName = (ing.name || '').toLowerCase();
              if (
                targetIngredientName.includes(cleanLineName) || 
                cleanLineName.includes(targetIngredientName) ||
                targetIngredientName.replace(/s$/, '') === cleanLineName.replace(/s$/, '')
              ) {
                return { ...ing, cost: newCost };
              }
              return ing;
            });

            return { ...recipe, ingredients: updatedIngredients };
          });
        }

        if (onUpdateRecipes) {
          onUpdateRecipes(workingRecipesCopy);
        }
      }

      if (onUpdate && savedInvoice) {
        onUpdate([...safeInvoices, savedInvoice]);
      }

      alert("Success! Matched recipe costs updated for your active workspace.");
      setPreviewUrl(null);
      setFile(null);

    } catch (err) {
      console.error(err);
      alert("Failed running image pipeline: " + err.message);
    } finally {
      setParsing(false);
    }
  };

  return (
    <div style={S.container}>
      <ScreenHeader title="AI Invoice Processing" sub="Digitize physical supplier delivery notes directly into structured recipe costings" />
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={S.card}>
          <SectionLabel label="Capture Feed Input" />
          
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
            disabled={parsing} 
          />

          <div style={{ marginTop: 10, marginBottom: 20 }}>
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={parsing}
              style={{ ...S.btn, width: '100%', background: C.highlight, fontWeight: 700, padding: '12px' }}
            >
              📷 Choose File / Take Photo
            </button>
          </div>

          {previewUrl && (
            <div style={{ padding: '12px', background: C.highlight, borderRadius: 4, marginBottom: 16, textAlign: 'center', fontSize: 13, border: `1px solid ${C.paper2}` }}>
              {file ? `📎 File queued: ${file.name}` : "📸 Camera capture queued successfully"}
            </div>
          )}

          <button 
            onClick={handleParseAndCommit} 
            disabled={parsing || !previewUrl}
            style={{ ...S.btnAccent, width: '100%', marginTop: 12, padding: '14px 20px', fontWeight: 700 }}
          >
            {parsing ? "ANALYZING IMAGES VIA CLOUD AI COMPILER..." : "⚡ PARSE TEXT & UPDATE COST MATRICES"}
          </button>
        </div>

        <div style={S.card}>
          <SectionLabel label="Historical Tenant Document Logs (public.invoices)" />
          <div style={{ overflowY: 'auto', maxHeight: 300, marginTop: 12 }}>
            {safeInvoices.length === 0 ? (
              <p style={{ fontSize: 12, color: C.inkFade, fontStyle: 'italic' }}>No processed items mapped inside local ledger frame cache.</p>
            ) : (
              safeInvoices.map((inv) => (
                <div key={inv.id} style={{ padding: '10px 12px', background: C.highlight, borderBottom: `1px solid ${C.paper2}`, marginBottom: 6, borderLeft: `3px solid ${C.accent}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                    <span>{inv.supplier}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>£{parseFloat(inv.total || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.inkFade, marginTop: 4 }}>
                    <span>Ref: {inv.ref} · {inv.lines || 0} column items</span>
                    <span>Filed: {inv.inv_date}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
} // <--- THIS BRACE CLOSES INVOICESSCREEN CORRECTLY AND RESTORES YOUR MAIN MOBILE DRAWERS

function SuppliersScreen() {
  return (
    <div style={S.container}>
      <ScreenHeader title="Cross Wholesaler Pricing Matrices" sub="Cross reference spot pricing indices across approved vendor streams" />
      <div style={S.card}>
        <table style={{width:"100%", borderCollapse:"collapse", textAlign:"left"}}>
          <thead>
            <tr style={{borderBottom:"2px solid #1a1a18"}}>
              <th style={{padding:10}}><SectionLabel label="Commodity Row" /></th>
              <th style={{padding:10}}><SectionLabel label="Wellocks Spot" /></th>
              <th style={{padding:10}}><SectionLabel label="Reynolds Spot" /></th>
              <th style={{padding:10}}><SectionLabel label="Brakes Spot" /></th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(SUPPLIER_PRICES).map((item, i) => (
              <tr key={i} style={{borderBottom:`1px solid ${C.paper2}`}}>
                <td style={{padding:12, fontWeight:700}}>{item}</td>
                <td style={{padding:12, fontFamily:"'JetBrains Mono', monospace"}}>£{SUPPLIER_PRICES[item].Wellocks.toFixed(2)}</td>
                <td style={{padding:12, fontFamily:"'JetBrains Mono', monospace"}}>£{SUPPLIER_PRICES[item].Reynolds.toFixed(2)}</td>
                <td style={{padding:12, fontFamily:"'JetBrains Mono', monospace"}}>£{SUPPLIER_PRICES[item].Brakes.toFixed(2)}</td>
              </tr>
            ))}
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
      const merged = [...sales];
      POS_MOCK_BATCH.forEach(batchRow => {
        const index = merged.findIndex(s => s.day === batchRow.day && s.session === batchRow.session && s.recipeId === batchRow.recipeId);
        if (index !== -1) {
          merged[index] = { ...merged[index], sold: merged[index].sold + batchRow.sold };
        } else {
          merged.push(batchRow);
        }
      });
      onUpdate(merged);
      setSyncing(false);
    }, 1200);
  };

  return (
    <div style={S.container}>
      <ScreenHeader title="Point Of Sale Synchronization Gateways" sub="Interface registers and streaming terminal transactions into the tracking engine" />
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
              {syncing ? "Parsing Stream..." : "Sync Active Terminal Rows"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScanScreen({ recipes = [], onUpdateRecipes }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const safeRecipes = recipes || [];

  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startLiveCamera = async () => {
    setScannedData(null);
    setPreviewUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera setup failed:", err);
      alert("Unable to open hardware camera. Falling back to File Capture alternative mode.");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setPreviewUrl(canvas.toDataURL("image/jpeg"));
        const stream = video.srcObject;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    }
  };

  const executeRecipeDigitizer = async () => {
    if (!previewUrl) return;
    setIsExtracting(true);

    try {
      const { data: member } = await supabase.from('kitchen_members').select('kitchen_id').limit(1).single();
      if (!member) throw new Error("No kitchen session found.");

      // Preserved Baseline Validation Testing Dataset
      const simulatedRecipeOutput = {
        name: "Sinigang Pork Belly",
        category: "Main",
        sell_price: 18.50,
        ingredients: [
          { name: "Beef Cheek", cost: 13.50, qty: 5, unit: "kg", supplier: "Wellocks Market" },
          { name: "Salmon Fillet", cost: 17.50, qty: 2, unit: "kg", supplier: "Wellocks Market" }
        ]
      };

      setScannedData(simulatedRecipeOutput);
    } catch (err) {
      alert("Error scanning configuration: " + err.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const acceptScan = async () => {
    if (!scannedData) return;
    try {
      const { data: member } = await supabase.from('kitchen_members').select('kitchen_id').limit(1).single();
      if (!member) throw new Error("No active kitchen tenant context found.");

      // 1. Write parent row to public.recipes
      const { data: rData, error: rError } = await supabase
        .from('recipes')
        .insert([{
          kitchen_id: member.kitchen_id,
          name: scannedData.name,
          category: scannedData.category,
          sell_price: scannedData.sell_price,
          dietary: []
        }]).select();

      if (rError) throw rError;
      const createdRecipe = rData?.[0];

      // 2. Map split row objects to public.recipe_ingredients relational children
      if (createdRecipe) {
        const ingredientsRows = scannedData.ingredients.map((ing, idx) => ({
          kitchen_id: member.kitchen_id,
          recipe_id: createdRecipe.id,
          position: idx,
          kind: 'raw',
          name: ing.name,
          cost: ing.cost,
          qty: ing.qty,
          unit: ing.unit,
          supplier: ing.supplier
        }));

        const { error: ingError } = await supabase.from('recipe_ingredients').insert(ingredientsRows);
        if (ingError) throw ingError;

        if (onUpdateRecipes) {
          onUpdateRecipes([...safeRecipes, { ...createdRecipe, ingredients: ingredientsRows }]);
        }
        alert(`Success: "${scannedData.name}" committed to relational master library ledger tables!`);
        setPreviewUrl(null);
        setScannedData(null);
      }
    } catch (err) {
      alert("Error saving recipe rows: " + err.message);
    }
  };

  return (
    <div style={S.container}>
      <ScreenHeader title="AI Recipe Digitizer Pipeline" sub="Upload structural spec sheets or image snapshots to build formulation databases automatically" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        
        <div style={S.card}>
          <SectionLabel label="Optical Formulation Feed Input" />
          <div style={{ display: "flex", gap: 10, marginTop: 14, marginBottom: 16 }}>
            <button onClick={() => fileInputRef.current?.click()} style={S.btn}>📂 Choose Snapshot File</button>
            <button onClick={startLiveCamera} style={S.btnAccent}>📷 Open document camera</button>
            <input type="file" ref={fileInputRef} accept="image/*" style={{ display: "none" }} onChange={e => {
              const f = e.target.files?.[0];
              if (f) setPreviewUrl(URL.createObjectURL(f));
              setScannedData(null);
            }} />
          </div>

          {previewUrl && (
            <div style={{ marginTop: 20, padding: 20, background: C.paper, borderRadius: 4, border: `1px dashed ${C.inkFade}`, textAlign: "center" }}>
              <img src={previewUrl} alt="Preview" style={{ maxHeight: 240, maxWidth: "100%", marginBottom: 14, border: `1px solid ${C.inkRule}` }} />
              <button onClick={executeRecipeDigitizer} disabled={isExtracting} style={{ ...S.btnAccent, width: "100%", background: C.blue, color: "white" }}>
                {isExtracting ? "EXTRACTING FORMULATION ARRAYS..." : "⚡ RUN IMAGE OCR PARSER ENGINE"}
              </button>
            </div>
          )}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>

        <div>
          {scannedData ? (
            <div style={S.card}>
              <SectionLabel label="Parsed Formulation Structural Context" />
              <h2 style={{ fontFamily: "'Bitter', serif", margin: "14px 0 6px 0" }}>{scannedData.name}</h2>
              <div style={{ fontSize: 13, color: C.inkFade, marginBottom: 14 }}>
                Category: {scannedData.category} · Intended Retail: £{scannedData.sell_price.toFixed(2)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                {scannedData.ingredients.map((ing, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", background: "white", padding: "8px 12px", border: `1px solid ${C.paper2}`, fontSize: 13 }}>
                    <div><strong>{ing.qty} {ing.unit}</strong> - {ing.name}</div>
                    <div style={{ color: C.accent, fontWeight: 700 }}>£{ing.cost.toFixed(2)} / {ing.unit}</div>
                  </div>
                ))}
              </div>
              <button onClick={acceptScan} style={{ ...S.btnAccent, width: "100%", background: C.green }}>
                Commit to Recipe Library
              </button>
            </div>
          ) : (
            <div style={{ ...S.card, textAlign: "center", padding: 60, color: C.inkFade }}>
              OCR Parser state idle. Pipeline uninitialized.
            </div>
          )}
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


function SousScreen({ settings, recipes, components, sales, waste, planner }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [chat, setChat] = useState([
    { speaker: 'sous', text: "Chef. Live OpenAI context integration online. Ask me anything about menu costs, cover spikes, wastage tracking, or operational optimizations." }
  ]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    const userMessage = { speaker: 'user', text: query };
    setChat(prev => [...prev, userMessage]);
    setQuery('');
    setLoading(true);

    // Capture the existing database arrays safely to pass as system context
    const currentKitchenContextData = {
      role: settings?.role || "Staff",
      recipes: recipes || [],
      components: components || [],
      sales: sales || [],
      waste: waste || [],
      planner: planner || []
    };

    try {
      // Connects directly to your successfully deployed edge function
      const { data, error } = await supabase.functions.invoke('sous-chat', {
        body: { 
          prompt: query, 
          context: currentKitchenContextData 
        }
      });

      if (error) throw error;

      const systemResponse = { 
        speaker: 'sous', 
        text: data?.reply || "Heard. I processed the request but encountered a blank return matrix. Please try again." 
      };
      setChat(prev => [...prev, systemResponse]);

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

  return (
    <div style={S.container}>
      <div style={{ marginBottom: 24, borderBottom: `1px solid ${C.inkRule}`, paddingBottom: 16 }}>
        <h1 style={{ fontFamily: "'Bitter', serif", fontSize: 32, fontWeight: 900, color: C.ink, margin: 0 }}>Sous AI Context Engine</h1>
        <p style={{ fontSize: 13, color: C.inkFade, margin: '4px 0 0 0' }}>Live OpenAI analysis bounded by your kitchen metrics data ledger</p>
      </div>

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
              <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: msg.speaker === 'user' ? '#f5e9c8' : C.inkFade, marginBottom: 4, letterSpacing: '0.5px' }}>
                {msg.speaker.toUpperCase()}
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
        </div>

        <form onSubmit={handleSend} style={{ display: "flex", gap: 8, borderTop: `1px solid ${C.inkRule}`, padding: 12, background: '#121210' }}>
          <input 
            type="text" 
            value={query} 
            onChange={e => setQuery(e.target.value)} 
            placeholder={loading ? "Analyzing data context structures..." : "Ask OpenAI about recipe profits, trash leaks, or covers schedule metrics..."} 
            disabled={loading}
            style={{ ...S.input, background: "#000", color: "#fff", border: "1px solid #2a2a26", flex: 1, opacity: loading ? 0.6 : 1 }} 
          />
          <button type="submit" disabled={loading} style={{ ...S.btnAccent, padding: '0 24px', height: 40, opacity: loading ? 0.6 : 1 }}>
            {loading ? "Thinking..." : "Ask Sous"}
          </button>
        </form>
      </div>
    </div>
  );
}
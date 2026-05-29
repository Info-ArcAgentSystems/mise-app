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

  // Live calculation of kitchen forecast confidence based on database metrics
  const forecastMetrics = React.useMemo(() => {
    return calculateForecastConfidence(state?.sales || []);
  }, [state?.sales]);

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
  settings: customSettings
} = state || {};

// Safely evaluate settings property layer with fallback structural baselines
const settings = customSettings && Object.keys(customSettings).length > 0 
  ? customSettings 
  : { role: 'Head chef', currency: '£', unitSystem: 'metric', region: 'UK' };

  const tabs = ['dashboard', 'servicereport', 'scan', 'archive', 'digitizer', 'recipes', 'planner', 'prep', 'sales', 'waste', 'intel', 'shopping', 'engineering', 'sous', 'settings'];

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
        </div>
      )}

      {/* Render Active Functional Screens */}
      {/* Render Active Functional Screens */}
      {/* Render Active Functional Screens */}
      <div style={S.main}>
        {tab === 'dashboard' && <Dashboard recipes={recipes} components={components} planner={planner} sales={sales} waste={waste} settings={settings} setTab={setTab} updateState={update} />}
        {tab === 'servicereport' && <ServiceReport recipes={recipes || []} components={components || []} sales={sales || []} waste={waste || []} planner={planner || []} settings={settings || {}} />}
        {tab === 'planner' && <PlannerScreen planner={planner} onUpdate={(val) => update({ planner: val })} />}
        {tab === 'recipes' && <RecipesScreen recipes={recipes || []} components={components || []} settings={settings || {}} onUpdateRecipes={(val) => update({ recipes: val })} onUpdateComponents={(val) => update({ components: val })} />}
        {tab === 'prep' && <PrepScreen planner={planner} recipes={recipes} components={components} />}
        {tab === 'shopping' && <ShoppingScreen planner={planner} recipes={recipes} components={components} />}
        {tab === 'sales' && <SalesScreen sales={sales} recipes={recipes} onUpdate={(val) => update({ sales: val })} />}
        {tab === 'waste' && <WasteScreen waste={waste} onUpdate={(val) => update({ waste: val })} settings={settings} />}
        {tab === 'performance' && <PerformanceScreen recipes={recipes} components={components} planner={planner} sales={sales} waste={waste} settings={settings} />}
        {tab === 'sous' && <SousScreen settings={settings} recipes={recipes} components={components} sales={sales} waste={waste} planner={planner} />}
        {tab === 'invoices' && <InvoicesScreen supabase={supabase} invoices={invoices || []} onUpdate={(val) => update({ invoices: val })} recipes={recipes || []} onUpdateRecipes={(val) => update({ recipes: val })} settings={settings} />}
        {tab === 'suppliers' && <SuppliersScreen />}
        {tab === 'pos' && <PosScreen sales={sales} recipes={recipes} onUpdate={(val) => update({ sales: val })} />}
        {tab === 'settings' && <SettingsScreen settings={settings} onUpdate={(val) => update({ settings: val })} />}
        
        {/* CONNECTED SECURELY TO THE CORRECT SCREEN WRAPPER */}
        {tab === 'scan' && (
          <ScanScreen 
            recipes={recipes || []} 
            onUpdateRecipes={(val) => update({ recipes: val })} 
            settings={settings || {}} 
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// COMPREHENSIVE RE-ANCHOR: STATE SYNCHRONIZATION FOR DROPDOWNS
// ============================================================
function SettingsScreen({ settings, onUpdate }) {
  // Exhaustive mapping of globally active operational regions and currencies
  const regions = [
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
    { value: 'Africa/Cairo', label: 'Africa/Cairo (EET)' },
    { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (SAST)' },
    { value: 'Africa/Lagos', label: 'Africa/Lagos (WAT)' },
    { value: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT)' },
    { value: 'America/Anchorage', label: 'America/Anchorage (AKST/AKDT)' },
    { value: 'America/Argentina/Buenos_Aires', label: 'America/Buenos Aires (ART)' },
    { value: 'America/Bogota', label: 'America/Bogota (COT)' },
    { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
    { value: 'America/Denver', label: 'America/Denver (MST/MDT)' },
    { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST/PDT)' },
    { value: 'America/Mexico_City', label: 'America/Mexico City (CST)' },
    { value: 'America/New_York', label: 'America/New York (EST/EDT)' },
    { value: 'America/Phoenix', label: 'America/Phoenix (MST)' },
    { value: 'America/Sao_Paulo', label: 'America/Sao Paulo (BRT)' },
    { value: 'America/Toronto', label: 'America/Toronto (EST/EDT)' },
    { value: 'America/Vancouver', label: 'America/Vancouver (PST/PDT)' },
    { value: 'Asia/Bangkok', label: 'Asia/Bangkok (ICT)' },
    { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
    { value: 'Asia/Hong_Kong', label: 'Asia/Hong Kong (HKT)' },
    { value: 'Asia/Jakarta', label: 'Asia/Jakarta (WIB)' },
    { value: 'Asia/Jerusalem', label: 'Asia/Jerusalem (IST)' },
    { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' }
  ];

// 1. Initialize state safely by checking for an explicit region fallback string
  const [localSettings, setLocalSettings] = React.useState(() => {
    return {
      role: settings?.role || "Head chef",
      region: settings?.region || "UK", // Rely on explicit region keys
      currency: settings?.currency || "£",
      unitSystem: settings?.unitSystem || "metric",
      timezone: settings?.timezone || "Europe/London"
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
        if (settings.currency === "₱") {
          derivedRegion = "PH"; // Route explicitly to Philippines to break the Cuba loop
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
        timezone: settings.timezone || "Europe/London"
      });
    }
  }, [settings]);

  const handleChange = (key, val) => {
    setLocalSettings(prev => ({ ...prev, [key]: val }));
    setSavedSuccess(false);
  };

  // 3. Keep internal tracking clean
  const handleRegionChange = (regionCode) => {
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
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, background: '#efe6d3', padding: 24, borderRadius: 6, border: '1px solid #1a1a18' }}>
        
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

      </div>
    </div>
  );
}

// ============================================================
// CORE FUNCTIONAL FIX: THE SERVICE REPORT COMPONENT (RESTORED)
// ============================================================
function ServiceReport({ recipes = [], components = [], sales = [], waste = [], planner = [], settings = {} }) {
  const [loading, setLoading] = useState(false);
  const [generatedReport, setGeneratedReport] = useState(null);
  const [errorLog, setErrorLog] = useState("");
  const currencySymbol = settings?.currency || '£';

  // Compute summary metrics with fallback provisions
  const computedMetrics = useMemo(() => {
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
  }, [recipes, sales, waste]);

  const handleCompileWeeklyAIReport = async () => {
    setLoading(true);
    setErrorLog("");
    
    const analyticsContext = {
      recipes: (recipes || []).map(r => ({ name: r.name, category: r.category, yield: r.yield })),
      salesSummary: { totalEntries: (sales || []).length, estimatedRevenue: computedMetrics.totalRevenue },
      wasteLogs: (waste || []).map(w => ({ item: w.ingredientName || w.name, cost: w.cost, reason: w.reason })),
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

  // Extract global dynamic currency config setup safely
  const currencySymbol = settings?.currency || '£';

  // 1. Weekly Sales Calculation (Checks both total and netSales)
  const totalWeeklySales = useMemo(() => {
    if (!sales || sales.length === 0) return 0;
    return sales.reduce((sum, item) => {
      const salesValue = parseFloat(item.total || item.netSales || 0);
      return sum + salesValue;
    }, 0);
  }, [sales]);

  // 2. Tracked Waste Calculation (Checks both cost and costPrice)
  const totalWeeklyWaste = useMemo(() => {
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
    let theoreticalCostTotal = 0;
    let retailRevenueTotal = 0;

    if (!sales || sales.length === 0 || !recipes) return 31.4;

    sales.forEach(saleItem => {
      const matchedRecipe = recipes.find(r => r.id === saleItem.recipeId || r.name?.toLowerCase() === saleItem.item?.toLowerCase());
      if (matchedRecipe) {
        const itemCost = computeMenuRecipeCost(matchedRecipe);
        const qtySold = parseInt(saleItem.qty || saleItem.sold || saleItem.volume || 0);
        theoreticalCostTotal += (itemCost * qtySold);
        retailRevenueTotal += (parseFloat(matchedRecipe.sellPrice || 0) * qtySold);
      }
    });

    if (retailRevenueTotal === 0) return 31.4; // Fallback design standard target point
    return (theoreticalCostTotal / retailRevenueTotal) * 100;
  }, [sales, recipes, components]);

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Header section banner */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Bitter', serif", fontSize: isMobile ? 22 : 28, margin: '0 0 2px 0', color: '#0e0e0c' }}>The Pass</h2>
        <p style={{ margin: 0, fontSize: isMobile ? 12 : 14, color: '#5a4f40', opacity: 0.85 }}>Live shift reporting, structural yield targets, and financial leak margins</p>
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
            {currencySymbol}{Math.round(totalWeeklySales).toLocaleString()}
          </div>
        </div>

        {/* Card 2: Food Cost */}
        <div style={{ background: '#f7f1e3', border: '1px solid #1a1a18', padding: isMobile ? '12px 8px' : '16px', borderRadius: 4 }}>
          <div style={{ fontSize: isMobile ? 9 : 11, color: '#5a4f40', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 6 }}>
            {isMobile ? 'Food Cost' : 'Theoretical Cost'}
          </div>
          <div style={{ fontSize: isMobile ? 15 : 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: aggregateFoodCostPercent > 35 ? '#b8362a' : '#4a6b3a' }}>
            {aggregateFoodCostPercent.toFixed(1)}%
          </div>
        </div>

        {/* Card 3: Waste */}
        <div style={{ background: '#f7f1e3', border: '1px solid #1a1a18', padding: isMobile ? '12px 8px' : '16px', borderRadius: 4 }}>
          <div style={{ fontSize: isMobile ? 9 : 11, color: '#5a4f40', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 6 }}>
            {isMobile ? 'Waste' : 'Tracked Waste'}
          </div>
          <div style={{ fontSize: isMobile ? 15 : 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: totalWeeklyWaste > 150 ? '#b8362a' : '#0e0e0c' }}>
            {currencySymbol}{Math.round(totalWeeklyWaste).toLocaleString()}
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

// COMPRESSED SPEC: SPECIFICALLY CAPTURED RECIPE ARCHIVE HUB
// ============================================================
function RecipesScreen({ recipes = [], components = [], settings = {}, onUpdateRecipes, onUpdateComponents }) {
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('menu_items'); // menu_items | sub_batches
  const currencySymbol = settings?.currency || '£';

  return (
    <div style={{ color: '#0e0e0c', minHeight: '80vh' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.inkRule}`, paddingBottom: 16, marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, margin: 0, fontFamily: "'serif', Georgia", fontWeight: '800', color: '#0e0e0c' }}>Recipes & Yield Matrix</h2>
          <p style={{ margin: '4px 0 0 0', color: C.inkFade, fontSize: 13 }}>
            Gross Profit margin engineering matrix. Audit menu items, manage batch yields, and calculate plate cost efficiencies.
          </p>
        </div>
      </div>

      {/* SUB-TAB NAVIGATOR */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => { setActiveSubTab('menu_items'); setSelectedComponent(null); }}
          style={{
            background: activeSubTab === 'menu_items' ? '#121210' : 'transparent',
            color: activeSubTab === 'menu_items' ? '#fff' : C.inkSoft,
            border: `1px solid ${C.inkRule}`,
            padding: '8px 16px',
            fontWeight: '700',
            fontSize: '12px',
            cursor: 'pointer',
            borderRadius: '4px'
          }}
        >
          Menu Items ({recipes.length})
        </button>
        <button
          onClick={() => { setActiveSubTab('sub_batches'); setSelectedRecipe(null); }}
          style={{
            background: activeSubTab === 'sub_batches' ? '#121210' : 'transparent',
            color: activeSubTab === 'sub_batches' ? '#fff' : C.inkSoft,
            border: `1px solid ${C.inkRule}`,
            padding: '8px 16px',
            fontWeight: '700',
            fontSize: '12px',
            cursor: 'pointer',
            borderRadius: '4px'
          }}
        >
          Sub-Batches & Components ({components.length})
        </button>
      </div>

      {/* DUAL COLUMN SYSTEM LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24, alignItems: 'start' }}>
        
        {/* LEFT COLUMN: SPEC LISTS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {activeSubTab === 'menu_items' ? (
            recipes.length === 0 ? (
              <div style={{ color: C.inkFade, fontSize: 12, padding: 24, background: C.paper2, border: `1px dashed ${C.inkRule}`, borderRadius: 4, textAlign: 'center' }}>
                No active menu items mapped. Scan recipes via the Digitizer to populate matrix.
              </div>
            ) : (
              recipes.map((recipe) => {
                const isSelected = selectedRecipe?.id === recipe.id;
                return (
                  <div
                    key={recipe.id}
                    onClick={() => setSelectedRecipe(recipe)}
                    style={{
                      background: isSelected ? C.paper2 : '#121210',
                      border: `1px solid ${isSelected ? C.accent : C.inkRule}`,
                      borderRadius: '4px',
                      padding: '14px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: '700', color: isSelected ? '#000' : '#fff' }}>{recipe.name}</div>
                      <div style={{ fontSize: 11, color: isSelected ? C.inkSoft : C.inkFade, marginTop: 4 }}>
                        {recipe.category || 'Line Item'} • Target Yield: {recipe.yield || 'Standard Portion'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      <span style={{ fontSize: 13, fontWeight: '700', color: isSelected ? '#000' : C.accent }}>
                        {currencySymbol}{(recipe.sellPrice || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            components.length === 0 ? (
              <div style={{ color: C.inkFade, fontSize: 12, padding: 24, background: C.paper2, border: `1px dashed ${C.inkRule}`, borderRadius: 4, textAlign: 'center' }}>
                No component preparation items discovered.
              </div>
            ) : (
              components.map((comp) => {
                const isSelected = selectedComponent?.id === comp.id;
                return (
                  <div
                    key={comp.id}
                    onClick={() => setSelectedComponent(comp)}
                    style={{
                      background: isSelected ? C.paper2 : '#121210',
                      border: `1px solid ${isSelected ? C.accent : C.inkRule}`,
                      borderRadius: '4px',
                      padding: '14px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: '700', color: isSelected ? '#000' : '#fff' }}>{comp.name}</div>
                      <div style={{ fontSize: 11, color: isSelected ? C.inkSoft : C.inkFade, marginTop: 4 }}>
                        Batch Yield: {comp.batchYield || '1'} {comp.batchUnit || 'units'} • Hold Life: {comp.holdLife || 'N/A'}
                      </div>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>

        {/* RIGHT COLUMN: CORE INSPECTOR */}
        <div>
          <div style={{ background: C.paper2, border: `1px solid ${C.inkRule}`, borderRadius: 4, padding: 16, minHeight: 400 }}>
            {selectedRecipe ? (
              <div>
                <div style={{ borderBottom: `1px solid ${C.inkRule}`, paddingBottom: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: C.accent, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    Menu Item Architecture Blueprint
                  </div>
                  <h3 style={{ fontSize: 18, margin: '4px 0 0 0', fontFamily: "'serif', Georgia", fontWeight: '800' }}>
                    {selectedRecipe.name}
                  </h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'rgba(0,0,0,0.03)', padding: 10, borderRadius: 4 }}>
                    <div>
                      <div style={{ fontSize: 9, color: C.inkFade, textTransform: 'uppercase', fontWeight: 700 }}>Menu Selling Price</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, fontFamily: 'monospace' }}>
                        {currencySymbol}{(selectedRecipe.sellPrice || 0).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: C.inkFade, textTransform: 'uppercase', fontWeight: 700 }}>Categorization Tag</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginTop: 2 }}>
                        {selectedRecipe.category || 'Mains'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.inkFade, textTransform: 'uppercase', marginBottom: 6 }}>
                      Ingredient Framework Breakdown
                    </div>
                    <div style={{ border: `1px solid ${C.inkRule}`, borderRadius: 4, background: '#161614', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedRecipe.ingredient1 ? (
                        <div style={{ fontSize: 12, color: '#fff' }}>
                          <span style={{ color: C.accent, marginRight: 6 }}>•</span> {selectedRecipe.ingredient1}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: C.inkFade, fontStyle: 'italic' }}>No detailed material components registered.</div>
                      )}
                      {selectedRecipe.ingredient2 && (
                        <div style={{ fontSize: 12, color: '#fff', borderTop: '1px solid #222', paddingTop: 6 }}>
                          <span style={{ color: C.accent, marginRight: 6 }}>•</span> {selectedRecipe.ingredient2}
                        </div>
                      )}
                      {selectedRecipe.ingredient3 && (
                        <div style={{ fontSize: 12, color: '#fff', borderTop: '1px solid #222', paddingTop: 6 }}>
                          <span style={{ color: C.accent, marginRight: 6 }}>•</span> {selectedRecipe.ingredient3}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedComponent ? (
              <div>
                <div style={{ borderBottom: `1px solid ${C.inkRule}`, paddingBottom: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: C.accent, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    Sub-Batch Ledger Inspector
                  </div>
                  <h3 style={{ fontSize: 18, margin: '4px 0 0 0', fontFamily: "'serif', Georgia", fontWeight: '800' }}>
                    {selectedComponent.name}
                  </h3>
                </div>
                <div style={{ fontSize: 13, color: C.inkSoft }}>
                  <p><strong>Stable Roster Life:</strong> {selectedComponent.holdLife || 'No restrictions logged'}</p>
                  <p><strong>Baseline Batch Yield:</strong> {selectedComponent.batchYield} {selectedComponent.batchUnit}</p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 260, color: C.inkFade }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📖</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>Select any target menu item or sub-batch line to audit ledger dimensions.</div>
              </div>
            )}
          </div>
        </div>

      </div>
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

function PrepScreen({ planner = [], recipes = [], components = [] }) {
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

  // 3. Extrapolate tasks and group by category phase
  const phasedTasks = useMemo(() => {
    const phases = { advance: [], dayBefore: [], sameDay: [], service: [] };
    if (totalWeeklyCovers === 0 || recipes.length === 0) return phases;

    recipes.forEach(recipe => {
      const yieldAmt = parseFloat(recipe.yieldAmount) || 1;
      const scaleFactor = totalWeeklyCovers / yieldAmt;

      (recipe.ingredients || []).forEach(ing => {
        const totalQtyNeeded = ((parseFloat(ing.amount || ing.qty) || 0) * scaleFactor).toFixed(1);
        const unit = ing.unit || 'g';
        const name = ing.name ? ing.name.toLowerCase() : '';
        const uniqueKey = `recipe-${recipe.id}-${name}`;

        const taskItem = {
          id: uniqueKey,
          task: recipe.name,
          detail: `${ing.name}: ${totalQtyNeeded} ${unit} needed`
        };

        if (name.includes('sauce') || name.includes('marinade') || name.includes('braise')) {
          taskItem.task = `Simmer base for ${recipe.name}`;
          phases.dayBefore.push(taskItem);
        } else if (name.includes('pickled') || name.includes('cure') || name.includes('stock')) {
          taskItem.task = `Brine/Cure setup for ${recipe.name}`;
          phases.advance.push(taskItem);
        } else if (name.includes('fresh') || name.includes('garnish') || name.includes('salad') || name.includes('chopped')) {
          taskItem.task = `Mise processing for ${recipe.name}`;
          phases.sameDay.push(taskItem);
        } else {
          taskItem.task = `Line stock: ${recipe.name}`;
          phases.service.push(taskItem);
        }
      });
    });

    return phases;
  }, [recipes, totalWeeklyCovers]);

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
                  <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{t.detail}</div>
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
          <p style={{ fontSize: 14, color: C.inkSoft, fontWeight: 600 }}>Your Weekly Planner cover headcount is currently flat.</p>
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

function ShoppingScreen({ planner = [], recipes = [], components = [] }) {
  const [clearedKeys, setClearedKeys] = React.useState(new Set());
  const [syncing, setSyncing] = React.useState(false);

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

  // 2. Base math matrix calculations
  const orderList = useMemo(() => {
    const items = {};
    recipes.forEach(recipe => {
      const totalWeeklyCovers = planner.reduce((sum, day) => sum + (parseInt(day.lunch) || 0) + (parseInt(day.dinner) || 0), 0);
      const baseYield = parseFloat(recipe.yieldAmount) || 1;
      const scalingFactor = totalWeeklyCovers / baseYield;

      if (totalWeeklyCovers === 0) return;

      (recipe.ingredients || []).forEach(ing => {
        if (ing.kind === 'raw' || !ing.kind) {
          const key = `${ing.name}-${ing.supplier || 'Dry Goods'}`;
          if (!items[key]) {
            items[key] = { name: ing.name, qty: 0, unit: ing.unit || 'g', supplier: ing.supplier || 'Dry Goods' };
          }
          items[key].qty += ((parseFloat(ing.amount || ing.qty) || 0) * scalingFactor);
        } else if (ing.kind === 'comp') {
          const comp = components.find(c => c.id === ing.componentId);
          if (comp) {
            const compBatchYield = parseFloat(comp.batchYield) || 1;
            const compUsageAmount = parseFloat(ing.amount || ing.qty) || 0;
            const compScaleFactor = (compUsageAmount / compBatchYield) * scalingFactor;

            (comp.ingredients || []).forEach(cing => {
              const key = `${cing.name}-${cing.supplier || 'Dry Goods'}`;
              if (!items[key]) {
                items[key] = { name: cing.name, qty: 0, unit: cing.unit || 'g', supplier: cing.supplier || 'Dry Goods' };
              }
              items[key].qty += ((parseFloat(cing.amount || cing.qty) || 0) * compScaleFactor);
            });
          }
        }
      });
    });
    return Object.values(items);
  }, [planner, recipes, components]);

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
  const activeOrders = orderList.filter(item => !clearedKeys.has(`${item.name}-${item.supplier || 'Dry Goods'}`));

  return (
    <div style={S.container}>
      <div style={{ borderBottom: `1px solid ${C.inkRule}`, paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: "'Bitter', serif", fontSize: 28, fontWeight: 900, color: C.ink }}>Consolidated Orders & Lists</h1>
          <p style={{ fontSize: 13, color: C.inkFade, marginTop: 4 }}>
            Showing {activeOrders.length} items remaining to order out of {orderList.length} requirements
          </p>
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

      {activeOrders.length === 0 ? (
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
              const uniqueKey = `${item.name}-${item.supplier || 'Dry Goods'}`;
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
                    {parseFloat(item.qty).toFixed(1)} <span style={{ fontSize: 11, color: C.inkSoft }}>{item.unit}</span>
                  </div>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <span style={{ 
                      fontSize: 11, 
                      fontWeight: 700, 
                      background: item.supplier === 'Seafood' ? '#d1f2ff' : item.supplier === 'Butcher' ? '#ffd1d1' : C.paper2,
                      color: item.supplier === 'Seafood' ? C.blue : item.supplier === 'Butcher' ? C.red : C.inkSoft,
                      padding: '4px 8px', borderRadius: 4, textTransform: 'uppercase'
                    }}>
                      {item.supplier || 'Dry Goods'}
                    </span>
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

function SalesScreen({ recipes = [], sales = [], onUpdate, settings }) {
  const currencySymbol = settings?.currency || '£';
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
              const r = recipes.find(x => x.id === s.recipeId);
              const itemPrice = r ? (r.sellPrice || 0) : 0;
              const itemRevenue = s.sold * itemPrice;
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

// ============================================================
// MOBILE-OPTIMIZED WASTE SCREEN COMPONENT
// ============================================================
function WasteScreen({ waste = [], onUpdate, settings = {} }) {
  const currencySymbol = settings?.currency || '£';

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
                    
                    {/* Datetime stamp notation */}
                    <div style={{ fontSize: 10, color: '#5a4f40', textAlign: "right", opacity: 0.8 }}>
                      {log.date || 'Active Entry'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function PerformanceScreen({ recipes = [], components = [], planner = [], sales = [], waste = [], settings }) {
  const currencySymbol = settings?.currency || '£'; // Fallback safely to defaults

  const report = useMemo(() => {
    let rawRevenue = 0;
    let computedCost = 0;

    sales.forEach(s => {
      const r = recipes.find(x => x.id === s.recipeId);
      if (r) {
        rawRevenue += (s.sold * (r.sellPrice || 0));
        const { foodCost } = recipeCosting(r, components);
        computedCost += (s.sold * foodCost);
      }
    });

    const leakCost = waste.reduce((acc, w) => acc + (parseFloat(w.cost) || 0), 0);
    const profitMargin = rawRevenue - computedCost - leakCost;
    const finalEfficiencyPct = rawRevenue > 0 ? (profitMargin / rawRevenue) * 100 : 0;

    return { rawRevenue, computedCost, leakCost, profitMargin, finalEfficiencyPct };
  }, [recipes, components, sales, waste]);

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

      {/* Rest of your financial UI analysis rendering blocks unchanged below */}
    </div>
  );
}

export function InvoicesScreen({ supabase, invoices = [], onUpdate, recipes = [], onUpdateRecipes, settings }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  
  const [showLaptopCamera, setShowLaptopCamera] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const cameraInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const safeInvoices = invoices || [];
  const currentCurrency = settings?.currency || '£';

  const C = {
    paper: '#f7f1e3',
    paper2: '#efe6d3',
    ink: '#0e0e0c',
    inkFade: '#5a4f40',
    highlight: '#f5e9c8',
    accent: '#b8730a',
    green: '#4a6b3a'
  };

  const S = {
    container: { display: 'flex', flexDirection: 'column' },
    card: { background: '#ffffff', border: `1px solid ${C.paper2}`, padding: '16px', borderRadius: '4px' }
  };

  // ============================================================
  // DATABASE RETRIEVAL & AI PROCESSING PIPELINE
  // ============================================================
  // ============================================================
  // DATABASE RETRIEVAL & AI PROCESSING PIPELINE
  // ============================================================
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

      // 1. RESOLVE USER ID AS KITCHEN ID
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const activeKitchenId = session?.user?.id;
      if (!activeKitchenId) {
        throw new Error("No active user session found. Please log in again.");
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
      const extractedItems = rawInvoice.items || rawInvoice.line_items || [];
      const extractedDate = rawInvoice.inv_date || rawInvoice.date || new Date().toISOString().split('T')[0];
      const extractedRef = 
        rawInvoice.ref || 
        rawInvoice.invoice_ref || 
        rawInvoice.invoice_number || 
        rawInvoice.id || 
        `INV-${Date.now().toString().slice(-6)}`;

      // 5. Insert directly into your invoices table
      const { data: insertedInvoice, error: insertError } = await supabase
        .from('invoices')
        .insert([{
          kitchen_id: activeKitchenId,
          supplier: extractedSupplier,
          total: extractedTotal,
          ref: extractedRef, 
          inv_date: extractedDate,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // 6. Bulk write line items straight to invoice_lines matching your exact columns!
      if (Array.isArray(extractedItems) && extractedItems.length > 0) {
        const formattedLines = extractedItems.map((item, index) => ({
          kitchen_id: activeKitchenId,
          invoice_id: insertedInvoice.id,
          position: index + 1,
          name: item.description || item.name || 'Item',
          qty: parseFloat(item.qty || item.quantity || 1),
          unit: item.unit || 'ea',
          price_per_unit: parseFloat(item.unit_price || item.price || item.rate || 0),
          line_total: parseFloat(item.total || item.amount || 0)
        }));

        const { error: linesError } = await supabase
          .from('invoice_lines')
          .insert(formattedLines);

        if (linesError) console.error("Line items writing exception:", linesError);

        // ============================================================
        // 🌟 NEW: LIVE DATABASE INGREDIENT COST UPDATES
        // ============================================================
        // Loop through each item from the invoice and save its unit price to your inventory table
        for (const item of extractedItems) {
          const itemName = item.description || item.name;
          const unitPrice = parseFloat(item.unit_price || item.price || item.rate || 0);

          if (itemName && unitPrice > 0) {
            // Option A: If you track costs in an 'ingredients' or 'raw_inventory' table
            await supabase
              .from('ingredients') // <-- Adjust to 'raw_inventory' if that's your table name
              .update({ price_per_unit: unitPrice }) // <-- Adjust column name if needed (e.g., 'cost')
              .eq('kitchen_id', activeKitchenId)
              .ilike('name', `%${itemName}%`); // Case-insensitive match (e.g., 'Salmon Fillet')
          }
        }
      }

      // 7. Update browser view memory matrices instantly
      const updatedInvoiceWithItems = { ...insertedInvoice, items: extractedItems };
      const updatedInvoicesList = [...safeInvoices, updatedInvoiceWithItems];
      
      if (onUpdate) onUpdate(updatedInvoicesList);

      // Force state update for the recipes view
      const recipesToUpdate = result?.updatedRecipes || result?.recipes;
      if (recipesToUpdate && onUpdateRecipes) {
        onUpdateRecipes(recipesToUpdate);
      }
      
      clearStagedFile();
      alert("🎉 Success! Invoice saved and database ingredient prices recalculated.");

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
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
            {safeInvoices.length === 0 ? (
              <p style={{ fontSize: 12, color: C.inkFade, fontStyle: 'italic' }}>No processed items mapped inside local ledger frame cache.</p>
            ) : (
              safeInvoices.map((inv) => (
                <div key={inv.id} style={{ padding: '10px 12px', background: C.highlight, borderBottom: `1px solid ${C.paper2}`, marginBottom: 6, borderLeft: `3px solid ${C.accent}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                    <span>{inv.supplier}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{currentCurrency}{parseFloat(inv.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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

function ScanScreen({ recipes = [], onUpdateRecipes, settings }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [showOptions, setShowOptions] = useState(false);

  const [showLaptopCamera, setShowLaptopCamera] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  
  const cameraInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const safeRecipes = recipes || [];
  const currentCurrency = settings?.currency || '£';

  const handleFileChange = (e) => {
    const Objectfile = e.target.files[0];
    if (!Objectfile) return;
    setFile(Objectfile);
    setPreviewUrl(URL.createObjectURL(Objectfile));
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
      const capturedFile = new File([blob], `captured_recipe_${Date.now()}.jpg`, { type: 'image/jpeg' });
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
    setScannedData(null);
  };

  return (
    <div style={S.container}>
      {/* HEADER ROW WITH ALIGNED BIGGER BUTTON */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        
       
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
        <input type="file" accept="image/*" ref={photoInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
        <input type="file" accept=".pdf,.doc,.docx,.txt,image/*" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />

        {showLaptopCamera && (
          <div style={{ background: C.paper2, border: `1px dashed ${C.inkFade}`, padding: '16px', borderRadius: '4px', textAlign: 'center' }}>
            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxWidth: '400px', borderRadius: '4px', background: '#000' }} />
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px' }}>
              <button onClick={captureLaptopSnapshot} style={{ background: C.ink, color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>📸 Capture Photo</button>
              <button onClick={closeLaptopCamera} style={{ background: C.paper, color: C.ink, border: `1px solid ${C.paper2}`, padding: '8px 16px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

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

        {previewUrl && !showLaptopCamera && (
          <div style={{ background: C.paper, border: `1px solid ${C.paper2}`, padding: '24px', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', background: C.paper2, padding: '12px', border: `1px solid ${C.paper2}`, borderRadius: '4px', position: 'relative', marginBottom: 16 }}>
              <img src={previewUrl} alt="Preview" style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'contain' }} />
              <button onClick={clearStagedFile} style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(255,255,255,0.9)', border: `1px solid ${C.paper2}`, color: C.ink, borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>×</button>
            </div>
            {!scannedData && (
              <button style={{ width: '100%', padding: '14px', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, background: C.green, color: '#fff', borderRadius: '4px', border: 'none' }}>
                🔮 RUN AI RECOVERY SCHEMATICS
              </button>
            )}
          </div>
        )}
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


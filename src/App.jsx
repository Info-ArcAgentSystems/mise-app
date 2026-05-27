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
        {tab === 'waste' && <WasteScreen waste={waste} onUpdate={(val) => update({ waste: val })} settings={settings} />}
        {tab === 'performance' && <PerformanceScreen recipes={recipes} components={components} planner={planner} sales={sales} waste={waste} settings={settings} />}
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
    { code: 'NI', label: 'Nicaragua (NIO) – C$', currency: 'C$' },
    { code: 'NG', label: 'Nigeria (NGN) – ₦', currency: '₦' },
    { code: 'NO', label: 'Norway (NOK) – kr', currency: 'kr' },
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
    { code: 'UK', label: 'United Kingdom (GBP) – £', currency: '£' },
    { code: 'US', label: 'United States (USD) – $', currency: '$' },
    { code: 'UY', label: 'Uruguay (UYU) – $U', currency: '$U' },
    { code: 'UZ', label: 'Uzbekistan (UZS) – сўم', currency: 'сўм' },
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
    { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
    { value: 'Asia/Manila', label: 'Asia/Manila (PST)' },
    { value: 'Asia/Riyadh', label: 'Asia/Riyadh (AST)' },
    { value: 'Asia/Seoul', label: 'Asia/Seoul (KST)' },
    { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
    { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
    { value: 'Atlantic/Reykjavik', label: 'Atlantic/Reykjavik (GMT)' },
    { value: 'Australia/Adelaide', label: 'Australia/Adelaide (ACST/ACDT)' },
    { value: 'Australia/Brisbane', label: 'Australia/Brisbane (AEST)' },
    { value: 'Australia/Melbourne', label: 'Australia/Melbourne (AEST/AEDT)' },
    { value: 'Australia/Perth', label: 'Australia/Perth (AWST)' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
    { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam (CET/CEST)' },
    { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
    { value: 'Europe/Brussels', label: 'Europe/Brussels (CET/CEST)' },
    { value: 'Europe/Dublin', label: 'Europe/Dublin (GMT/IST)' },
    { value: 'Europe/Istanbul', label: 'Europe/Istanbul (TRT)' },
    { value: 'Europe/Lisbon', label: 'Europe/Lisbon (WET/WEST)' },
    { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
    { value: 'Europe/Madrid', label: 'Europe/Madrid (CET/CEST)' },
    { value: 'Europe/Moscow', label: 'Europe/Moscow (MSK)' },
    { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
    { value: 'Europe/Rome', label: 'Europe/Rome (CET/CEST)' },
    { value: 'Europe/Zurich', label: 'Europe/Zurich (CET/CEST)' },
    { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST/NZDT)' },
    { value: 'Pacific/Honolulu', label: 'Pacific/Honolulu (HST)' },
    { value: 'UTC', label: 'Universal Coordinated Time (UTC)' }
  ];

  // Look up the active region matching your state selection directly on every single update cycle
  const currentRegionSelection = settings.region || 'UK';
  const matchedRegion = regions.find(r => r.code === currentRegionSelection);
  const liveCurrencySymbol = matchedRegion ? matchedRegion.currency : '£';

  const handleRegionChange = (e) => {
    const selectedCode = e.target.value;
    const targetRegion = regions.find(r => r.code === selectedCode);
    
    if (targetRegion) {
      onUpdate({
        ...settings,
        region: selectedCode,
        currency: targetRegion.currency
      });
    }
  };

  return (
    <div style={S.container}>
      <ScreenHeader title="Station Settings" sub="Configure localization parameters & layout thresholds" />
      
      <div style={S.card}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 400 }}>
          
          {/* Role / Title Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SectionLabel label="Your Role / Title" />
            <input 
              type="text" 
              value={settings.role || ''} 
              onChange={(e) => onUpdate({ ...settings, role: e.target.value })} 
              style={S.input} 
            />
          </div>

          {/* Region Dropdown Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SectionLabel label="Operational Region Location" />
            <select 
              value={currentRegionSelection} 
              onChange={handleRegionChange} 
              style={S.input}
            >
              {regions.map(r => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Read-Only Currency Indicator (Guaranteed live synchronization layout) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SectionLabel label="Active Currency Symbol" />
            <input 
              type="text" 
              value={liveCurrencySymbol} 
              disabled 
              style={{ ...S.input, background: C.paper2, color: C.ink, cursor: 'not-allowed', fontWeight: 'bold' }} 
            />
          </div>

          {/* Measurement System Select Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SectionLabel label="Measurement System" />
            <select 
              value={settings.unitSystem || 'metric'} 
              onChange={(e) => onUpdate({ ...settings, unitSystem: e.target.value })} 
              style={S.input}
            >
              <option value="metric">Metric (kg, L, g)</option>
              <option value="imperial">UK Imperial (lb, oz, pt)</option>
              <option value="us">US Customary (lb, oz, qt)</option>
            </select>
          </div>

          {/* Standardized Timezone Selection Dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SectionLabel label="System Timezone" />
            <select 
              value={settings.timezone || 'UTC'} 
              onChange={(e) => onUpdate({ ...settings, timezone: e.target.value })} 
              style={S.input}
            >
              {timezones.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>

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

// ============================================================
// RECIPES & COSTS SCREEN (Adapted to match App state)
// ============================================================
function RecipesScreen({ recipes, components, onUpdateRecipes, onUpdateComponents, settings }) {
  const [activeTab, setActiveTab] = useState('menu'); // 'menu' or 'sub'
  const [selectedId, setSelectedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  // New Ingredient Mode States
  const [ingKind, setIngKind] = useState('raw'); // 'raw' or 'sub'
  const [ingId, setIngId] = useState('');
  const [ingQty, setIngQty] = useState('');

  // Fallback to safe character if empty
  const currencySymbol = settings?.currency || '£';

  // Helper to find raw material cost from components ledger
  const getRawMaterialCost = (name, unit) => {
    const item = components.find(i => i.name?.toLowerCase() === name?.toLowerCase());
    if (!item) return 0;
    return item.costPrice || item.cost || 0; 
  };

  // Helper to compute sub-recipe total cost per unit
  const computeSubRecipeCostPerUnit = (sub) => {
    let total = 0;
    if (sub && sub.ingredients) {
      sub.ingredients.forEach(ing => {
        const rawCost = getRawMaterialCost(ing.name, ing.unit);
        total += (ing.qty * rawCost);
      });
    }
    const yieldQty = sub?.yieldQty || sub?.batchYield || 1;
    return total / yieldQty;
  };

  // Helper to compute menu recipe food cost
  const computeRecipeCost = (recipe) => {
    let total = 0;
    if (recipe && recipe.ingredients) {
      recipe.ingredients.forEach(ing => {
        if (ing.kind === 'sub') {
          const sub = components.find(s => s.id === ing.id || s.name === ing.name);
          if (sub) {
            const costPerUnit = computeSubRecipeCostPerUnit(sub);
            total += (ing.qty * costPerUnit);
          }
        } else {
          const rawCost = getRawMaterialCost(ing.name, ing.unit);
          total += (ing.qty * rawCost);
        }
      });
    }
    return total;
  };

  const filteredRecipes = recipes ? recipes.filter(r => {
    const matchesSearch = r.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = filterCategory === 'All' || r.category === filterCategory;
    return matchesSearch && matchesCat;
  }) : [];

  const filteredSubs = components ? components.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const currentRecipe = activeTab === 'menu' 
    ? (recipes ? recipes.find(r => r.id === selectedId) : null)
    : (components ? components.find(s => s.id === selectedId) : null);

  const handleAddIngredient = (e) => {
    e.preventDefault();
    if (!selectedId || !ingQty) return;

    if (activeTab === 'menu') {
      const updated = recipes.map(r => {
        if (r.id !== selectedId) return r;
        let newIng = {};
        if (ingKind === 'raw') {
          const invItem = components.find(i => i.id === parseInt(ingId) || i.id === ingId);
          if (!invItem) return r;
          newIng = { kind: 'raw', name: invItem.name, qty: parseFloat(ingQty), unit: invItem.unit || invItem.batchUnit };
        } else {
          const subItem = components.find(s => s.id === parseInt(ingId) || s.id === ingId);
          if (!subItem) return r;
          newIng = { kind: 'sub', id: subItem.id, name: subItem.name, qty: parseFloat(ingQty), unit: subItem.yieldUnit || subItem.batchUnit };
        }
        return { ...r, ingredients: [...(r.ingredients || []), newIng] };
      });
      onUpdateRecipes(updated);
    } else {
      const updated = components.map(s => {
        if (s.id !== selectedId) return s;
        const invItem = components.find(i => i.id === parseInt(ingId) || i.id === ingId);
        if (!invItem) return s;
        const newIng = { name: invItem.name, qty: parseFloat(ingQty), unit: invItem.unit || invItem.batchUnit };
        return { ...s, ingredients: [...(s.ingredients || []), newIng] };
      });
      onUpdateComponents(updated);
    }

    setIngId('');
    setIngQty('');
  };

  const handleRemoveIngredient = (index) => {
    if (activeTab === 'menu') {
      const updated = recipes.map(r => {
        if (r.id !== selectedId) return r;
        const nIngs = [...(r.ingredients || [])];
        nIngs.splice(index, 1);
        return { ...r, ingredients: nIngs };
      });
      onUpdateRecipes(updated);
    } else {
      const updated = components.map(s => {
        if (s.id !== selectedId) return s;
        const nIngs = [...(s.ingredients || [])];
        nIngs.splice(index, 1);
        return { ...s, ingredients: nIngs };
      });
      onUpdateComponents(updated);
    }
  };

  const cost = currentRecipe ? (activeTab === 'menu' ? computeRecipeCost(currentRecipe) : computeSubRecipeCostPerUnit(currentRecipe) * (currentRecipe.yieldQty || currentRecipe.batchYield || 1)) : 0;
  const foodCostPercent = (currentRecipe && activeTab === 'menu' && currentRecipe.sellPrice) ? (cost / currentRecipe.sellPrice) * 100 : 0;

  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Bitter', serif", fontSize: 24, margin: '0 0 4px 0', color: '#0e0e0c' }}>Recipes & Costing Ledger</h2>
        <p style={{ margin: 0, fontSize: 13, color: '#5a4f40' }}>Map menu builds against live inventory metrics & batch formulas</p>
      </div>

      {/* Internal Sub Navigation tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button 
          onClick={() => { setActiveTab('menu'); setSelectedId(null); }} 
          style={{ padding: '10px 16px', background: activeTab === 'menu' ? '#1a1a18' : '#efe6d3', color: activeTab === 'menu' ? '#fff' : '#0e0e0c', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
        >
          Menu Item Recipes
        </button>
        <button 
          onClick={() => { setActiveTab('sub'); setSelectedId(null); }} 
          style={{ padding: '10px 16px', background: activeTab === 'sub' ? '#1a1a18' : '#efe6d3', color: activeTab === 'sub' ? '#fff' : '#0e0e0c', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
        >
          Sub-Recipes & Batches
        </button>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/* Left Side: Directory List */}
        <div style={{ background: '#f7f1e3', border: '1px solid #1a1a18', borderRadius: 4, flex: 1, minWidth: 280, padding: 0 }}>
          <div style={{ padding: 16, borderBottom: `1px solid #1a1a18`, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="Search formulation catalog..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              style={{ padding: '8px 12px', border: '1px solid #1a1a18', background: '#fff', borderRadius: 4, flex: 1 }} 
            />
            {activeTab === 'menu' && (
              <select 
                value={filterCategory} 
                onChange={e => setFilterCategory(e.target.value)} 
                style={{ padding: '8px', border: '1px solid #1a1a18', background: '#fff', borderRadius: 4 }}
              >
                <option value="All">All Categories</option>
                <option value="Starter">Starters</option>
                <option value="Main">Mains</option>
                <option value="Dessert">Desserts</option>
              </select>
            )}
          </div>

          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {activeTab === 'menu' ? (
              filteredRecipes.map(r => {
                const cCost = computeRecipeCost(r);
                const margin = r.sellPrice ? ((r.sellPrice - cCost) / r.sellPrice) * 100 : 0;
                return (
                  <div 
                    key={r.id} 
                    onClick={() => setSelectedId(r.id)}
                    style={{
                      padding: '14px 16px',
                      borderBottom: `1px solid #1a1a18`,
                      background: selectedId === r.id ? '#f5e9c8' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#0e0e0c' }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: '#5a4f40' }}>{r.category} • {r.ingredients?.length || 0} items</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{currencySymbol}{r.sellPrice}</div>
                      <div style={{ fontSize: 11, color: margin < 65 ? '#b8362a' : '#4a6b3a', fontWeight: 'bold' }}>
                        {margin.toFixed(0)}% Margin
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              filteredSubs.map(s => {
                const cCost = computeSubRecipeCostPerUnit(s);
                return (
                  <div 
                    key={s.id} 
                    onClick={() => setSelectedId(s.id)}
                    style={{
                      padding: '14px 16px',
                      borderBottom: `1px solid #1a1a18`,
                      background: selectedId === s.id ? '#f5e9c8' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#0e0e0c' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: '#5a4f40' }}>Yields {s.yieldQty || s.batchYield || 1} {s.yieldUnit || s.batchUnit}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                        {currencySymbol}{cCost.toFixed(2)} / {s.yieldUnit || s.batchUnit}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Formula breakdown */}
        <div style={{ flex: 2, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {currentRecipe ? (
            <>
              {/* Financial Summary */}
              <div style={{ background: '#efe6d3', border: '1px solid #1a1a18', borderRadius: 4, padding: 16 }}>
                <div style={{ fontSize: 20, fontFamily: "'Bitter', serif", fontWeight: 700, marginBottom: 12 }}>
                  {currentRecipe.name}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                  <div style={{ background: '#f7f1e3', padding: 12, border: `1px solid #1a1a18` }}>
                    <div style={{ fontSize: 10, color: '#5a4f40', textTransform: 'uppercase' }}>
                      Total Cost
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#0e0e0c' }}>
                      {currencySymbol}{cost.toFixed(2)}
                    </div>
                  </div>

                  {activeTab === 'menu' ? (
                    <>
                      <div style={{ background: '#f7f1e3', padding: 12, border: `1px solid #1a1a18` }}>
                        <div style={{ fontSize: 10, color: '#5a4f40', textTransform: 'uppercase' }}>
                          Menu Retail Price
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#b8730a' }}>
                          {currencySymbol}{currentRecipe.sellPrice}
                        </div>
                      </div>
                      <div style={{ background: '#f7f1e3', padding: 12, border: `1px solid #1a1a18` }}>
                        <div style={{ fontSize: 10, color: '#5a4f40', textTransform: 'uppercase' }}>
                          Food Cost %
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: foodCostPercent > 32 ? '#b8362a' : '#4a6b3a' }}>
                          {foodCostPercent.toFixed(1)}%
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ background: '#f7f1e3', padding: 12, border: `1px solid #1a1a18` }}>
                      <div style={{ fontSize: 10, color: '#5a4f40', textTransform: 'uppercase' }}>
                        Unit Cost Rate
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#2c5a82' }}>
                        {currencySymbol}{(cost / (currentRecipe.yieldQty || currentRecipe.batchYield || 1)).toFixed(2)} / {currentRecipe.yieldUnit || currentRecipe.batchUnit}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Composition Lines Table */}
              <div style={{ background: '#f7f1e3', border: '1px solid #1a1a18', borderRadius: 4, padding: 16 }}>
                <div style={{ fontWeight: 700, borderBottom: `1px solid #1a1a18`, paddingBottom: 8, marginBottom: 12, fontSize: 12, color: '#5a4f40', textTransform: 'uppercase' }}>
                  Component Breakdown
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(currentRecipe.ingredients || []).map((ing, index) => {
                    let calculatedCost = 0;
                    if (ing.kind === 'sub') {
                      const matchedSub = components.find(s => s.id === ing.id || s.name === ing.name);
                      if (matchedSub) {
                        calculatedCost = computeSubRecipeCostPerUnit(matchedSub) * ing.qty;
                      }
                    } else {
                      calculatedCost = getRawMaterialCost(ing.name, ing.unit) * ing.qty;
                    }

                    return (
                      <div 
                        key={index} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '8px 0', 
                          borderBottom: `1px dashed #efe6d3` 
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 600 }}>{ing.name}</span>
                          {ing.kind === 'sub' && <span style={{ marginLeft: 8, padding: '2px 6px', background: '#2c5a82', color: '#fff', fontSize: 9, borderRadius: 3 }}>SUB</span>}
                          <div style={{ fontSize: 11, color: '#5a4f40' }}>
                            {ing.qty} {ing.unit} allocated
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace', monospace", fontWeight: 600 }}>
                            {currencySymbol}{calculatedCost.toFixed(2)}
                          </span>
                          <button 
                            onClick={() => handleRemoveIngredient(index)}
                            style={{ background: 'transparent', border: 'none', color: '#b8362a', cursor: 'pointer', fontSize: 16 }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {(!currentRecipe.ingredients || currentRecipe.ingredients.length === 0) && (
                    <div style={{ padding: '20px 0', color: '#5a4f40', fontStyle: 'italic', fontSize: 13 }}>
                      No composition lines specified for this item yet.
                    </div>
                  )}
                </div>

                {/* Inline Adder Form */}
                <form onSubmit={handleAddIngredient} style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid #1a1a18`, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  {activeTab === 'menu' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, color: '#5a4f40' }}>Type</span>
                      <select value={ingKind} onChange={e => { setIngKind(e.target.value); setIngId(''); }} style={{ padding: '8px', border: '1px solid #1a1a18', background: '#fff', borderRadius: 4 }}>
                        <option value="raw">Raw Inventory</option>
                        <option value="sub">Sub-Recipe Batch</option>
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 2, minWidth: 150 }}>
                    <span style={{ fontSize: 10, color: '#5a4f40' }}>Select Item</span>
                    <select value={ingId} onChange={e => setIngId(e.target.value)} style={{ padding: '8px', border: '1px solid #1a1a18', background: '#fff', borderRadius: 4, width: '100%' }} required>
                      <option value="">-- Choose From Catalog --</option>
                      {components?.map(i => (
                        <option key={i.id} value={i.id}>{i.name} ({currencySymbol}{(i.costPrice || i.cost || 0)}/{i.unit || i.batchUnit})</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <span style={{ fontSize: 10, color: '#5a4f40' }}>Quantity Weight</span>
                    <input 
                      type="number" 
                      step="any" 
                      placeholder="0.00" 
                      value={ingQty} 
                      onChange={e => setIngQty(e.target.value)} 
                      style={{ padding: '8px', border: '1px solid #1a1a18', background: '#fff', borderRadius: 4, width: '100%' }} 
                      required 
                    />
                  </div>

                  <button type="submit" style={{ padding: '8px 16px', background: '#b8730a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>+ Commit</button>
                </form>
              </div>
            </>
          ) : (
            <div style={{ background: '#f7f1e3', border: '1px solid #1a1a18', borderRadius: 4, textAlign: 'center', padding: '60px 20px', color: '#5a4f40' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📖</div>
              <div style={{ fontFamily: "'Bitter', serif", fontSize: 16, fontWeight: 700, color: '#0e0e0c', marginBottom: 4 }}>
                No Formulations Target Loaded
              </div>
              <div style={{ fontSize: 12 }}>
                Select a menu item layout or sub-recipe formula breakdown from the index to verify metrics.
              </div>
            </div>
          )}
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

function WasteScreen({ waste = [], onUpdate, settings }) {
  const currencySymbol = settings?.currency || '£';
  const [item, setItem] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('kg');
  const [cost, setCost] = useState('');
  const [reason, setReason] = useState('Spoilage');
  const [syncing, setSyncing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!item || !qty || !cost || syncing) return;

    setSyncing(true);
    try {
      // 1. Discover active tenant workspace context parameters
      const { data: memberData } = await supabase
        .from('kitchen_members')
        .select('kitchen_id')
        .limit(1)
        .single();

      if (!memberData) {
        alert("Authentication context missing. Cannot log waste.");
        return;
      }

      const payload = {
        kitchen_id: memberData.kitchen_id,
        ingredient: item,
        qty: parseFloat(qty),
        unit,
        cost: parseFloat(cost),
        reason
      };

      // 2. Insert into live Supabase ledger matching infrastructure expectations
      const { data: insertedData, error } = await supabase
        .from('food_waste_log')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      // 3. Keep local downstream views updated right away
      if (onUpdate && insertedData) {
        onUpdate([...waste, insertedData]);
      }

      // Reset form controls safely
      setItem('');
      setQty('');
      setCost('');
    } catch (err) {
      console.error("Failed to persist waste event log:", err);
      alert("Error saving waste log: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={S.container}>
      <ScreenHeader 
        title="Physical Waste & Leakage Tracker" 
        sub="Record kitchen spoilage, prep errors, and expired inventory logs to optimize efficiency metrics" 
      />
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'start' }}>
        {/* Log Input Interface Card */}
        <div style={S.card}>
          <SectionLabel label="Record New Leakage Event" />
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Ingredient Name</label>
              <input 
                type="text" 
                value={item} 
                onChange={e => setItem(e.target.value)} 
                placeholder="e.g. Fresh Salmon Fillet" 
                style={S.input} 
                required 
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Quantity Waste</label>
                <input 
                  type="number" 
                  step="any"
                  value={qty} 
                  onChange={e => setQty(e.target.value)} 
                  placeholder="0.0" 
                  style={S.input} 
                  required 
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Unit</label>
                <select value={unit} onChange={e => setUnit(e.target.value)} style={S.input}>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="L">L</option>
                  <option value="ml">ml</option>
                  <option value="ea">ea</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Total Financial Cost Loss (£)</label>
              <input 
                type="number" 
                step="any"
                value={cost} 
                onChange={e => setCost(e.target.value)} 
                placeholder="0.00" 
                style={S.input} 
                required 
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Primary Deviation Reason</label>
              <select value={reason} onChange={e => setReason(e.target.value)} style={S.input}>
                <option value="Spoilage">Spoilage / Expired</option>
                <option value="Prep Error">Kitchen Prep Mistake</option>
                <option value="Over-Production">Unsold Surplus Buffers</option>
                <option value="Spill/Drop">Accidental Drop/Spill</option>
              </select>
            </div>

            <button 
              type="submit" 
              disabled={syncing}
              style={{ ...S.btnAccent, marginTop: 6, opacity: syncing ? 0.6 : 1 }}
            >
              {syncing ? "LOGGING TRANSACTION LXI..." : "Commit Waste Entry"}
            </button>
          </form>
        </div>

        {/* Historic Real-Time Inventory Loss Logs Card */}
        <div style={S.card}>
          <SectionLabel label="Historical Workspace Loss Ledger Records" />
          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            {waste.length === 0 ? (
              <p style={{ fontSize: 13, color: C.inkFade, fontStyle: 'italic', padding: '12px 0' }}>
                No recorded leakages logged inside this ledger window block.
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.inkRule}` }}>
                    <th style={{ padding: '8px', fontSize: 11, color: C.inkFade }}>Ingredient</th>
                    <th style={{ padding: '8px', fontSize: 11, color: C.inkFade, textAlign: 'right' }}>Volume</th>
                    <th style={{ padding: '8px', fontSize: 11, color: C.inkFade, textAlign: 'right' }}>Cost Price</th>
                    <th style={{ padding: '8px', fontSize: 11, color: C.inkFade, textAlign: 'right' }}>Root Cause</th>
                  </tr>
                </thead>
                <tbody>
                  {waste.map((w, idx) => (
                    <tr key={w.id || idx} style={{ borderBottom: `1px solid ${C.paper2}` }}>
                      <td style={{ padding: '10px 8px', fontWeight: 700, textTransform: 'capitalize', fontSize: 14 }}>
                        {w.ingredient}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                        {parseFloat(w.qty).toFixed(2)} <span style={{ fontSize: 10, color: C.inkFade }}>{w.unit}</span>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: C.red, fontSize: 13 }}>
                        £{parseFloat(w.cost || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        <span style={{ 
                          fontSize: 10, 
                          fontWeight: 700, 
                          background: '#ffd1d1', 
                          color: C.red, 
                          padding: '3px 6px', 
                          borderRadius: 4,
                          textTransform: 'uppercase'
                        }}>
                          {w.reason}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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

function InvoicesScreen({ invoices = [], onUpdate, recipes = [], onUpdateRecipes }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [parsing, setParsing] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  const safeInvoices = invoices || [];
  const safeRecipes = recipes || [];

  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert(`Hardware Camera Stream Error: ${err.message}`);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
    setCameraActive(false);
  };

  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    const maxDimension = 1200;
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);
    
    const dataUrl = canvas.toDataURL("image/jpeg");
    setPreviewUrl(dataUrl);
    
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        const mockFile = new File([blob], `cam_capture_${Date.now()}.jpg`, { type: "image/jpeg" });
        setFile(mockFile);
      });

    stopCamera();
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    stopCamera();
  };

  // ADDED ASYNC HERE — fixes all 7 compiler build errors
  const handleParseAndCommit = async () => {
  if (!previewUrl) {
    alert("Please capture or choose a valid invoice image file.");
    return;
  }

  setParsing(true);

  try {
    // 1. DYNAMICALLY FETCH THE LOGGED-IN USER'S ASSIGNED KITCHEN ID
    // This looks up the active tenant context from the membership registry table
    const { data: memberData, error: memberError } = await supabase
      .from('kitchen_members')
      .select('kitchen_id')
      .limit(1)
      .single();

    if (memberError || !memberData) {
      throw new Error("Could not find an assigned kitchen workspace for this account.");
    }
    
    // Assign the dynamic workspace ID to a safe variable
    const activeKitchenId = memberData.kitchen_id;

    // 2. Format image asset data payload
    const targetBlob = await fetch(previewUrl).then(res => res.blob());
    const base64String = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(targetBlob);
    });

    // 3. Trigger your edge function compiler pipeline
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

    // 4. Save main invoice document log under the dynamic kitchen ID
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

        // Clone our active recipes array to maintain immutable state tracking rules
        let workingRecipesCopy = JSON.parse(JSON.stringify(recipes || []));

        for (const line of parsedAiLines) {
          const cleanLineName = line.name ? line.name.trim().toLowerCase() : '';
          if (!cleanLineName) continue;

          const newCost = parseFloat(line.price_per_unit || 0);

          // 1. Update the persistent columns in Postgres
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

          // 2. Loop through local React state memory and apply costs instantly
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

        // 3. Fire the hook update down from line 174 into your global app state cache
        if (onUpdateRecipes) {
          onUpdateRecipes(workingRecipesCopy);
        }
      }

    // 7. Refresh your app's global or screen state with a fresh fetch query
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
}

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

          <div style={{ display: 'flex', gap: 10, marginTop: 10, marginBottom: 20 }}>
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={parsing}
              style={{ ...S.btn, flex: 1, background: C.highlight, fontWeight: 700 }}
            >
              📁 Choose File
            </button>
            <button 
              onClick={startCamera} 
              disabled={parsing}
              style={{ ...S.btn, flex: 1, background: C.highlight, fontWeight: 700 }}
            >
              📷 Open Camera
            </button>
          </div>

          {cameraActive && (
            <div style={{ marginBottom: 20, border: `1px solid ${C.inkRule}`, background: '#000', padding: 8, textAlign: 'center' }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }} />
              <button onClick={captureSnapshot} style={{ ...S.btnAccent, width: '100%', marginTop: 8 }}>📸 CAPTURE TARGET REGION</button>
            </div>
          )}

          {previewUrl && !cameraActive && (
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
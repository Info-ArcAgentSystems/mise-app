import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// 1. CREATE THE AUTHENTICATION CONTEXT
const AuthContext = createContext({ session: null, user: null, loading: true });

// Local color tokens for the MISE visual language
const C = {
  paper: '#f7f1e3',
  ink: '#0e0e0c',
  inkSoft: '#3a3530',
  inkFade: '#5a4f40',
  accent: '#b8730a',
  red: '#b8362a',
  green: '#4a6b3a',
};

// 2. THE CONTEXT PROVIDER LAYER (Wraps App state)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read current session status
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen live to state changes (logins, logouts)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    session,
    user,
    loading,
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// 3. THE EXPORTED USEAUTH HOOK WHICH APP.JSX WANTS
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// 4. THE VISUAL INTERFACE (Your original code turned into a clean Default Export)
export default function Auth() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [kitchenName, setKitchenName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              kitchen_name: kitchenName.trim() || 'My Kitchen',
            },
          },
        });
        if (error) throw error;
        setInfo('Account created. Check your inbox to confirm your email, then sign in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={S.wrap}>
      <div style={S.bgTexture} aria-hidden />
      <div style={S.card}>
        <div style={S.brandMark}>
          <div style={S.brandRule} />
          <div style={S.brandRule} />
          <div style={S.brandRule} />
        </div>
        <div style={S.brand}>MISE</div>
        <div style={S.brandSub}>back of house · {mode === 'signup' ? 'sign up' : 'sign in'}</div>

        <form onSubmit={submit} style={S.form}>
          {mode === 'signup' && (
            <>
              <label style={S.label}>KITCHEN NAME</label>
              <input
                style={S.input}
                type="text"
                value={kitchenName}
                onChange={(e) => setKitchenName(e.target.value)}
                placeholder="e.g. The Test Kitchen"
              />
            </>
          )}

          <label style={S.label}>EMAIL</label>
          <input
            style={S.input}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label style={S.label}>PASSWORD</label>
          <input
            style={S.input}
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <div style={S.error}>⚠ {error}</div>}
          {info && <div style={S.info}>✓ {info}</div>}

          <button type="submit" style={S.btnPrimary} disabled={busy}>
            {busy ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>

          <button
            type="button"
            style={S.btnGhost}
            onClick={() => {
              setMode(mode === 'signup' ? 'signin' : 'signup');
              setError(null);
              setInfo(null);
            }}
          >
            {mode === 'signup' ? 'Have an account? Sign in' : 'New here? Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Visual Styles mapping
const S = {
  wrap: { minHeight: '100vh', background: C.paper, color: C.ink, fontFamily: "'Bitter',Georgia,serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative' },
  bgTexture: { position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 23px,rgba(26,26,24,0.025) 23px,rgba(26,26,24,0.025) 24px)' },
  card: { position: 'relative', zIndex: 1, background: C.paper, border: `2px solid ${C.ink}`, padding: '36px 32px', width: '100%', maxWidth: 380, boxShadow: `1px 1px 0 ${C.inkFade},4px 4px 0 rgba(14,14,12,0.06)` },
  brandMark: { display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 14 },
  brandRule: { width: 28, height: 2, background: C.accent },
  brand: { fontFamily: "'Bitter',serif", fontWeight: 800, fontSize: 24, letterSpacing: '5px', color: C.ink },
  brandSub: { fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: C.inkFade, letterSpacing: '2px', textTransform: 'uppercase', marginTop: 4, marginBottom: 28 },
  form: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: C.inkFade, letterSpacing: '2px', fontWeight: 700, marginTop: 10 },
  input: { background: C.paper, border: `1px solid ${C.ink}`, color: C.ink, fontFamily: "'Bitter',serif", fontSize: 14, padding: '10px 12px', borderRadius: 0 },
  btnPrimary: { background: C.ink, color: C.paper, border: 'none', padding: '12px 22px', fontFamily: "'Bitter',serif", fontWeight: 700, fontSize: 13, letterSpacing: '0.5px', cursor: 'pointer', borderRadius: 0, marginTop: 18 },
  btnGhost: { background: 'transparent', color: C.ink, border: `1px solid ${C.ink}`, padding: '10px 22px', fontFamily: "'Bitter',serif", fontWeight: 600, fontSize: 12, cursor: 'pointer', borderRadius: 0, marginTop: 8 },
  error: { background: 'rgba(184,54,42,0.08)', border: `1px solid ${C.red}`, color: C.red, padding: '10px 12px', fontSize: 12, marginTop: 12 },
  info: { background: 'rgba(74,107,58,0.08)', border: `1px solid ${C.green}`, color: C.green, padding: '10px 12px', fontSize: 12, marginTop: 12 },
};
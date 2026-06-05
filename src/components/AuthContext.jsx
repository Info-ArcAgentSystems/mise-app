import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

// Palette matching the rest of MISE
const C = {
  paper: '#f7f1e3',
  paper2: '#efe6d3',
  ink: '#0e0e0c',
  inkFade: '#5a4f40',
  inkRule: '#1a1a18',
  accent: '#b8730a',
  red: '#b8362a',
  green: '#4a6b3a',
};

// ============================================================
// useAuth — subscribes to Supabase auth, hands the user to the app
// ============================================================
export function useAuth() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user || null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user || null);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  return { user, session, loading };
}

// ============================================================
// LoginScreen / Auth — default export
// Three modes: signin | signup | forgot
// Plus a PASSWORD_RECOVERY mode that activates when Supabase
// signals the user clicked the reset email and needs to set
// a new password.
// ============================================================
export default function LoginScreen({ forceMode, onResetDone }) {
  const [mode, setMode] = useState(forceMode || 'signin'); // 'signin' | 'signup' | 'forgot' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Listen for the password-recovery event Supabase fires when the user
  // arrives via the reset email link; switch into "set new password" mode.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset');
        setError('');
        setInfo('You can now set a new password.');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setInfo('');
    setPassword('');
    setNewPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // session triggers the App-level redirect automatically
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo("Account created. Check your email for the confirmation link, then come back here to sign in.");
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });
        if (error) throw error;
        setInfo("Password reset link sent. Check your email and click the link to set a new password.");
      } else if (mode === 'reset') {
        if (!newPassword || newPassword.length < 6) {
          throw new Error("New password must be at least 6 characters.");
        }
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        // Sign out so the user explicitly signs back in with the new password
        await supabase.auth.signOut();
        setInfo("Password updated. Sign in with your new password.");
        setMode('signin');
        if (typeof onResetDone === 'function') onResetDone();
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  // ---- UI ----
  const input = {
    width: '100%', boxSizing: 'border-box',
    background: '#fff', border: `1px solid ${C.paper2}`,
    color: C.ink, padding: 12, fontSize: 14, borderRadius: 4,
    fontFamily: "'JetBrains Mono', monospace",
  };
  const button = (primary) => ({
    width: '100%', padding: 12, marginTop: 4,
    background: primary ? C.accent : 'transparent',
    color: primary ? '#fff' : C.ink,
    border: primary ? 'none' : `1px solid ${C.paper2}`,
    borderRadius: 4, fontWeight: 700, fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.6 : 1,
  });
  const linkBtn = {
    background: 'none', border: 'none', color: C.accent,
    fontSize: 12, cursor: 'pointer', padding: 0,
    fontFamily: "'JetBrains Mono', monospace", textDecoration: 'underline',
  };

  const title = {
    signin: 'Sign In',
    signup: 'Create Account',
    forgot: 'Reset Password',
    reset: 'Set New Password',
  }[mode];

  const sub = {
    signin: 'Sign in to your kitchen station.',
    signup: 'New account for your kitchen station.',
    forgot: "We'll email you a link to reset your password.",
    reset: 'Enter a new password to finish signing in.',
  }[mode];

  return (
    <div style={{
      minHeight: '100vh', background: C.paper,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      padding: 20, fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontFamily: "'Bitter', serif", fontSize: 36, fontWeight: 900, letterSpacing: 2, color: C.ink }}>MISE</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 800, color: C.accent, letterSpacing: 1.5, marginTop: 4, textTransform: 'uppercase' }}>
            Rest-Ops Platform v6.4
          </div>
        </div>

        <div style={{ background: '#fff', border: `1px solid ${C.paper2}`, borderRadius: 6, padding: 22 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 13, color: C.inkFade }}>{sub}</div>
          </div>

          {error && (
            <div style={{ background: C.red, color: '#fff', padding: '10px 12px', borderRadius: 4, marginBottom: 12, fontSize: 12, fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}
          {info && (
            <div style={{ background: C.green, color: '#fff', padding: '10px 12px', borderRadius: 4, marginBottom: 12, fontSize: 12, fontWeight: 600 }}>
              ✓ {info}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Email — needed for signin, signup and forgot. Hidden on reset. */}
            {mode !== 'reset' && (
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkFade }}>
                Email
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ ...input, marginTop: 4 }}
                />
              </label>
            )}

            {/* Password — for signin and signup */}
            {(mode === 'signin' || mode === 'signup') && (
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkFade }}>
                Password
                <div style={{ position: 'relative', marginTop: 4 }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ ...input, paddingRight: 60 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11, color: C.accent, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, padding: '6px 8px' }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </label>
            )}

            {/* New password — only in reset mode */}
            {mode === 'reset' && (
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkFade }}>
                New Password (min 6 characters)
                <div style={{ position: 'relative', marginTop: 4 }}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ ...input, paddingRight: 60 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(s => !s)}
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11, color: C.accent, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, padding: '6px 8px' }}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </label>
            )}

            <button type="submit" disabled={busy} style={button(true)}>
              {busy ? 'Working…' : (
                mode === 'signin' ? 'Sign In' :
                mode === 'signup' ? 'Create Account' :
                mode === 'forgot' ? 'Send Reset Link' :
                'Update Password'
              )}
            </button>
          </form>

          {/* Mode-switch links */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.paper2}`, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            {mode === 'signin' && (
              <>
                <button type="button" onClick={() => switchMode('forgot')} style={linkBtn}>
                  Forgot your password?
                </button>
                <div style={{ fontSize: 12, color: C.inkFade }}>
                  No account?{' '}
                  <button type="button" onClick={() => switchMode('signup')} style={linkBtn}>
                    Create one
                  </button>
                </div>
              </>
            )}
            {mode === 'signup' && (
              <div style={{ fontSize: 12, color: C.inkFade }}>
                Already have an account?{' '}
                <button type="button" onClick={() => switchMode('signin')} style={linkBtn}>
                  Sign in
                </button>
              </div>
            )}
            {mode === 'forgot' && (
              <button type="button" onClick={() => switchMode('signin')} style={linkBtn}>
                ← Back to sign in
              </button>
            )}
            {mode === 'reset' && (
              <button type="button" onClick={() => switchMode('signin')} style={linkBtn}>
                Cancel
              </button>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 10, color: C.inkFade, fontFamily: "'JetBrains Mono', monospace" }}>
          Secure session powered by Supabase
        </div>
      </div>
    </div>
  );
}

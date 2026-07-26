'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

type Mode = 'signin' | 'register';

const INPUT: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)',
  color: '#fff', fontSize: 14, outline: 'none',
  transition: 'border-color 0.15s',
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [name,     setName]     = useState('');
  const [showPw,   setShowPw]   = useState(false);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const switchMode = (m: Mode) => {
    setMode(m); setError('');
    setPassword(''); setConfirm('');
  };

  // ── Google ──────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setLoading(true);
    await signIn('google', { callbackUrl: '/' });
  };

  // ── Email sign-in ────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn('credentials', { email, password, redirect: false });
    if (result?.error) {
      setError('Incorrect email or password.');
      setLoading(false);
    } else {
      router.push('/');
    }
  };

  // ── Registration ─────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json() as { ok?: boolean; error?: string };

    if (!res.ok || !data.ok) {
      setError(data.error ?? 'Registration failed. Please try again.');
      setLoading(false);
      return;
    }

    // Auto sign-in after successful registration
    const result = await signIn('credentials', { email, password, redirect: false });
    if (result?.error) {
      setError('Account created — please sign in.');
      setMode('signin');
    } else {
      router.push('/');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
      padding: '24px',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18, margin: '0 auto 14px',
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(59,130,246,0.35)',
        }}>
          <svg width="34" height="34" viewBox="0 0 38 38" fill="none">
            <circle cx="19" cy="19" r="16" stroke="white" strokeWidth="2" fill="none" />
            <path d="M7 19 Q12 12 19 19 Q26 26 31 19" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M7 19 Q12 26 19 19 Q26 12 31 19" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeOpacity="0.5" />
          </svg>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 4, letterSpacing: '-0.02em' }}>
          CardTracker
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
          Real-time MLB card values · Live game stats
        </p>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}>
        {/* Mode tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {(['signin', 'register'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                flex: 1, padding: '16px 0', fontSize: 14, fontWeight: 600,
                color: mode === m ? '#fff' : 'rgba(255,255,255,0.4)',
                borderBottom: mode === m ? '2px solid #3b82f6' : '2px solid transparent',
                marginBottom: -1,
                transition: 'all 0.15s',
              }}
            >
              {m === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <div style={{ padding: '28px 28px 24px' }}>
          {/* Google button */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            style={{
              width: '100%', padding: '12px 20px', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff', fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: 20,
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {mode === 'signin' ? 'Continue with Google' : 'Sign up with Google'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          </div>

          {/* Form */}
          <form onSubmit={mode === 'signin' ? handleSignIn : handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {mode === 'register' && (
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
                style={INPUT}
              />
            )}

            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete={mode === 'signin' ? 'email' : 'email'}
              style={INPUT}
            />

            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                style={{ ...INPUT, paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(s => !s)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {mode === 'register' && (
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Confirm password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                style={INPUT}
              />
            )}

            {error && (
              <p style={{ fontSize: 13, color: '#fca5a5', fontWeight: 500, textAlign: 'center' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, marginTop: 4,
                background: loading ? 'rgba(59,130,246,0.5)' : '#2563eb',
                color: '#fff', fontSize: 15, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading
                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> {mode === 'signin' ? 'Signing in…' : 'Creating account…'}</>
                : mode === 'signin' ? 'Sign In' : 'Create Account'
              }
            </button>
          </form>

          {/* Switch mode link */}
          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => switchMode(mode === 'signin' ? 'register' : 'signin')}
              style={{ color: '#60a5fa', fontWeight: 600 }}
            >
              {mode === 'signin' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

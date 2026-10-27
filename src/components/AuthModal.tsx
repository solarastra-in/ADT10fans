import React, { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Mail } from 'lucide-react';
import { api, clearPendingReferral, getPendingReferral, setStoredToken } from '../api';
import { useApp } from '../state';
import { useT } from '../i18n';
import { Button, ErrorBox, inputCls, Modal, Notice } from './ui';
import { Link } from '../router';
import type { User } from '../types';

function describeAuthError(e: any, t: (s: string) => string): string {
  switch (e?.code || '') {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return t('Sign-in was cancelled. Please try again.');
    case 'auth/network-request-failed':
      return t('Network error. Check your connection and try again.');
    case 'auth/unauthorized-domain':
      return t('Google sign-in is not enabled for this web address yet. Please use email sign-in.');
    case 'auth/too-many-requests':
      return t('Too many attempts. Please wait a moment and try again.');
    default:
      return e?.message || t('Sign-in failed. Please try again.');
  }
}

/** After a redirect sign-in (used when popups are blocked), finish it when the page reloads. */
export async function completeRedirectSignIn(): Promise<{ user: User; created: boolean } | null> {
  const { getFirebaseAuth } = await import('../firebase');
  const { getRedirectResult } = await import('firebase/auth');
  const result = await getRedirectResult(getFirebaseAuth()).catch(() => null);
  if (!result?.user) return null;
  const idToken = await result.user.getIdToken();
  const res = await api.loginGoogle(idToken, getPendingReferral());
  setStoredToken(res.token);
  clearPendingReferral();
  return { user: res.user, created: res.created };
}

export function AuthModal() {
  const { authOpen, closeAuth, authReason, config, setUser, reloadAll, openTeamPicker, toast } = useApp();
  const t = useT();
  const googleEnabled = config?.features.googleSignIn ?? false;
  const otpEnabled = config?.features.emailOtp ?? false;
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState<'google' | 'send' | 'verify' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authOpen) {
      setError(null);
      setLoading(null);
    }
  }, [authOpen]);

  const finish = async (user: User, created: boolean) => {
    setUser(user);
    clearPendingReferral();
    closeAuth();
    setSent(false);
    setCode('');
    toast(created ? t('Welcome to the fan hub, {name}!', { name: user.name }) : t('Signed in as {name}', { name: user.name }));
    await reloadAll().catch(() => undefined);
    if (!user.teamId) openTeamPicker();
  };

  const google = async () => {
    setLoading('google');
    setError(null);
    try {
      const { getFirebaseAuth, googleProvider } = await import('../firebase');
      const { signInWithPopup, signInWithRedirect } = await import('firebase/auth');
      try {
        const result = await signInWithPopup(getFirebaseAuth(), googleProvider());
        const res = await api.loginGoogle(await result.user.getIdToken(), getPendingReferral());
        setStoredToken(res.token);
        await finish(res.user, res.created);
      } catch (e: any) {
        if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(getFirebaseAuth(), googleProvider());
          return;
        }
        throw e;
      }
    } catch (e: any) {
      setError(describeAuthError(e, t));
    } finally {
      setLoading(null);
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading('send');
    setError(null);
    try {
      const r = await api.requestOtp(email.trim());
      setDevCode(r.devCode || null);
      setSent(true);
      setCode('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading('verify');
    setError(null);
    try {
      const r = await api.verifyOtp(email.trim(), code.trim(), getPendingReferral());
      setStoredToken(r.token);
      await finish(r.user, r.created);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal open={authOpen} onClose={closeAuth} title={t('Sign in to the fan hub')}>
      <div className="space-y-4" data-testid="auth-modal">
        {authReason && <Notice>{authReason}</Notice>}
        <p className="text-sm text-slate-300">{t('Free account. Pick your team, play Pick XI and the daily games, enter predictions and prize draws, and join the forum.')}</p>
        {getPendingReferral() && <Notice tone="success">{t('You were invited by a friend. You both get bonus points once you play your first game.')}</Notice>}
        {error && <ErrorBox message={error} />}
        {googleEnabled && (
          <Button onClick={google} loading={loading === 'google'} variant="secondary" className="w-full bg-white text-slate-900 hover:bg-slate-100 border-0">
            <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            {t('Continue with Google')}
          </Button>
        )}
        {googleEnabled && otpEnabled && (
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex-1 h-px bg-slate-800" /> {t('or')} <span className="flex-1 h-px bg-slate-800" />
          </div>
        )}
        {otpEnabled &&
          (!sent ? (
            <form onSubmit={send} className="space-y-3">
              <label className="block">
                <span className="block text-xs font-bold text-slate-300 mb-1">{t('Email address')}</span>
                <input type="email" required autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="you@email.com" name="email" />
              </label>
              <Button type="submit" loading={loading === 'send'} className="w-full">
                <Mail className="w-4 h-4" /> {t('Email me a sign-in code')}
              </Button>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-3">
              <Notice tone="success">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> {t('We sent a 6-digit code to {email}. It expires in 10 minutes.', { email })}
                </span>
              </Notice>
              {devCode && (
                <p className="text-xs text-amber-300">
                  Development server, no email sent. Code: <strong data-testid="dev-code" className="font-mono">{devCode}</strong>
                </p>
              )}
              <label className="block">
                <span className="block text-xs font-bold text-slate-300 mb-1">{t('6-digit code')}</span>
                <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className={`${inputCls} font-mono tracking-[0.4em] text-center text-lg`} name="code" />
              </label>
              <Button type="submit" loading={loading === 'verify'} className="w-full">
                <KeyRound className="w-4 h-4" /> {t('Sign in')}
              </Button>
              <button type="button" className="w-full text-xs text-slate-400 hover:text-white min-h-[36px]" onClick={() => setSent(false)}>
                {t('Use a different email')}
              </button>
            </form>
          ))}
        {!googleEnabled && !otpEnabled && <ErrorBox message={t('Sign-in is not available right now. Please try again later.')} />}
        <p className="text-[11px] text-slate-500">
          {t('By signing in you agree to the')} <Link to="/terms" className="underline" onClick={closeAuth}>{t('terms')}</Link> {t('and')} <Link to="/privacy" className="underline" onClick={closeAuth}>{t('privacy notice')}</Link>.
        </p>
      </div>
    </Modal>
  );
}

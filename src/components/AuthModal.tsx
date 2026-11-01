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
      return t('Domain unauthorized: Please add this domain to your Firebase Console > Authentication > Settings > Authorized domains.');
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return t('Google sign-in is not enabled in Firebase Console. Please enable Google under Authentication > Sign-in method in project adt10-fans-club.');
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
  const instaHandle = typeof window !== 'undefined' ? localStorage.getItem('aces_instagram_handle') || undefined : undefined;
  const vCode = typeof window !== 'undefined' ? localStorage.getItem('aces_verification_code') || undefined : undefined;
  const res = await api.loginGoogle(idToken, getPendingReferral(), instaHandle, vCode);
  setStoredToken(res.token);
  clearPendingReferral();
  return { user: res.user, created: res.created };
}

export function AuthModal() {
  const { authOpen, closeAuth, authReason, config, user, setUser, reloadAll, openTeamPicker, toast } = useApp();
  const t = useT();
  const targetHandle = config?.instagramTargetHandle || '@ArabianAcesofficial';
  const cleanTarget = targetHandle.replace(/^@/, '');

  const googleEnabled = config?.features.googleSignIn ?? false;
  const otpEnabled = config?.features.emailOtp ?? false;
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState<'google' | 'send' | 'verify' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Instagram Follow Verification State (Mandatory prerequisite to get on the platform)
  const [instaHandle, setInstaHandle] = useState(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('aces_instagram_handle') : '') || '';
  });
  const [isInstaVerified, setIsInstaVerified] = useState(() => {
    return Boolean(typeof window !== 'undefined' && localStorage.getItem('aces_instagram_verified') === 'true');
  });
  const [instaError, setInstaError] = useState<string | null>(null);
  const [instaSuccess, setInstaSuccess] = useState<string | null>(null);
  const [editingInsta, setEditingInsta] = useState(false);

  useEffect(() => {
    if (user?.instagramFollowed) {
      setIsInstaVerified(true);
      if (user.instagramHandle) setInstaHandle(user.instagramHandle);
    } else if (typeof window !== 'undefined' && localStorage.getItem('aces_instagram_verified') === 'true') {
      setIsInstaVerified(true);
      const h = localStorage.getItem('aces_instagram_handle');
      if (h) setInstaHandle(h);
    }
  }, [user]);

  useEffect(() => {
    if (!authOpen) {
      setError(null);
      setLoading(null);
      setInstaError(null);
      setInstaSuccess(null);
      setEditingInsta(false);
    }
  }, [authOpen]);

  const handleOpenInstagram = () => {
    const appUrl = `instagram://user?username=${cleanTarget}`;
    const webUrl = `https://www.instagram.com/${cleanTarget}/`;
    const start = Date.now();
    window.location.href = appUrl;
    setTimeout(() => {
      if (Date.now() - start < 1500) {
        window.open(webUrl, '_blank', 'noopener,noreferrer');
      }
    }, 1200);
  };

  const handleConfirmInsta = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = instaHandle.trim().toLowerCase().replace(/^@/, '');
    if (!clean || clean.length < 2) {
      setInstaError('Please enter your Instagram username to confirm');
      return;
    }
    setInstaError(null);
    try {
      const res = await api.verifyInstagramGatekeeper({
        handle: clean,
        followedAccount: true,
        likedPost: true,
      });

      const formatted = res.handle;
      setInstaHandle(formatted);
      setIsInstaVerified(true);
      setEditingInsta(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem('aces_instagram_verified', 'true');
        localStorage.setItem('aces_instagram_handle', formatted);
        localStorage.setItem('aces_verification_code', res.verificationCode);
      }
      setInstaSuccess(`Instagram verified for ${formatted}! Code: ${res.verificationCode}. You can now sign in.`);
    } catch (err: any) {
      setInstaError(err?.message || 'Verification failed. Please check your Instagram username.');
    }
  };

  const finish = async (u: User, created: boolean) => {
    setUser(u);
    clearPendingReferral();
    closeAuth();
    setSent(false);
    setCode('');
    toast(created ? t('Welcome to Arabian Aces, {name}!', { name: u.name }) : t('Signed in as {name}', { name: u.name }));
    await reloadAll().catch(() => undefined);
    if (!u.teamId) openTeamPicker();
  };

  const google = async () => {
    if (!isInstaVerified) {
      setInstaError('Please confirm your Instagram handle in Step 1 first.');
      return;
    }
    setLoading('google');
    setError(null);
    try {
      const { getFirebaseAuth, googleProvider } = await import('../firebase');
      const { signInWithPopup, signInWithRedirect } = await import('firebase/auth');
      const storedVCode = typeof window !== 'undefined' ? localStorage.getItem('aces_verification_code') || undefined : undefined;
      try {
        const result = await signInWithPopup(getFirebaseAuth(), googleProvider());
        const res = await api.loginGoogle(await result.user.getIdToken(), getPendingReferral(), instaHandle || undefined, storedVCode);
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
    if (!isInstaVerified) {
      setInstaError('Please confirm your Instagram handle in Step 1 first.');
      return;
    }
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
      const storedVCode = typeof window !== 'undefined' ? localStorage.getItem('aces_verification_code') || undefined : undefined;
      const r = await api.verifyOtp(email.trim(), code.trim(), getPendingReferral(), instaHandle || undefined, storedVCode);
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
        
        {/* Prerequisite Notice */}
        <div className="p-3 rounded-xl bg-gradient-to-r from-purple-950/70 via-rose-950/70 to-amber-950/70 border border-pink-500/40 text-xs text-slate-200">
          <div className="flex items-center gap-2 font-black text-pink-300 uppercase tracking-wider text-[11px] mb-1">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/>
            </svg>
            Official Fan Access Requirement
          </div>
          Following <strong className="text-amber-300">{targetHandle}</strong> on Instagram is mandatory to log in, play matchday games, build Pick XI squads, and check in at fan club venues.
        </div>

        {/* STEP 1: Instagram Follow & Verification */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${isInstaVerified && !editingInsta ? 'bg-emerald-500 text-slate-950' : 'bg-pink-500 text-white'}`}>
                {isInstaVerified && !editingInsta ? '✓' : '1'}
              </span>
              Step 1: Follow on Instagram
            </span>
            {isInstaVerified && !editingInsta && (
              <button
                type="button"
                onClick={() => setEditingInsta(true)}
                className="text-[11px] text-pink-400 hover:text-pink-300 underline font-semibold"
              >
                Change handle
              </button>
            )}
          </div>

          {isInstaVerified && !editingInsta ? (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-emerald-200">
                  Confirmed: <strong className="font-bold text-white">{instaHandle}</strong>
                </span>
              </div>
              <span className="text-[10px] font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
                +25 pts ready
              </span>
            </div>
          ) : (
            <form onSubmit={handleConfirmInsta} className="space-y-2.5">
              <button
                type="button"
                onClick={handleOpenInstagram}
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r from-pink-600 via-rose-600 to-amber-600 hover:from-pink-500 hover:to-amber-500 text-white font-bold text-xs shadow-md transition-all active:scale-[0.98]"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/>
                </svg>
                Open Instagram App to Follow {targetHandle}
              </button>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-500 text-xs font-bold">@</span>
                  <input
                    type="text"
                    value={instaHandle.replace(/^@/, '')}
                    onChange={e => setInstaHandle(e.target.value)}
                    placeholder="your_instagram_handle"
                    className="w-full pl-7 pr-3 py-2 bg-slate-950 border border-slate-700 focus:border-pink-500 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-2 rounded-lg bg-pink-500 hover:bg-pink-400 text-white font-bold text-xs whitespace-nowrap shadow-sm transition-all"
                >
                  Confirm Follow
                </button>
              </div>

              {instaError && <p className="text-rose-400 text-xs">{instaError}</p>}
              {instaSuccess && <p className="text-emerald-400 text-xs">{instaSuccess}</p>}
            </form>
          )}
        </div>

        {/* STEP 2: Sign-in Options */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${isInstaVerified ? 'bg-amber-400 text-slate-950' : 'bg-slate-700 text-slate-400'}`}>
                2
              </span>
              Step 2: Sign in to your Account
            </span>
            {!isInstaVerified && (
              <span className="text-[11px] text-amber-400/90 font-medium">Locked until Step 1</span>
            )}
          </div>

          {!isInstaVerified && (
            <p className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              🔒 Complete Step 1 by confirming your Instagram handle to unlock Google and Email sign-in.
            </p>
          )}

          {getPendingReferral() && <Notice tone="success">{t('You were invited by a friend. You both get bonus points once you play your first game.')}</Notice>}
          {error && <ErrorBox message={error} />}

          {googleEnabled && (
            <Button
              onClick={google}
              disabled={!isInstaVerified}
              loading={loading === 'google'}
              variant="secondary"
              className={`w-full ${!isInstaVerified ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-400' : 'bg-white text-slate-900 hover:bg-slate-100'} border-0`}
            >
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
                  <input
                    type="email"
                    required
                    disabled={!isInstaVerified}
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={`${inputCls} ${!isInstaVerified ? 'opacity-50 cursor-not-allowed' : ''}`}
                    placeholder="you@email.com"
                    name="email"
                  />
                </label>
                <Button
                  type="submit"
                  disabled={!isInstaVerified}
                  loading={loading === 'send'}
                  className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
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
        </div>

        <p className="text-[11px] text-slate-500">
          {t('By signing in you agree to the')} <Link to="/terms" className="underline" onClick={closeAuth}>{t('terms')}</Link> {t('and')} <Link to="/privacy" className="underline" onClick={closeAuth}>{t('privacy notice')}</Link>.
        </p>
      </div>
    </Modal>
  );
}

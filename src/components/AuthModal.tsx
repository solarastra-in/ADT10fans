import React, { useEffect, useState } from 'react';
import { api, setStoredToken } from '../api';
import { PublicConfig, User } from '../types';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, signInWithRedirect, User as FirebaseUser } from 'firebase/auth';
import { X, Mail, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  config?: PublicConfig | null;
}

/** Exchange a signed-in Firebase user for an app session. Used after popup and redirect sign-in. */
export async function completeGoogleLogin(fbUser: FirebaseUser): Promise<User> {
  const idToken = await fbUser.getIdToken();
  const res = await api.loginGoogle(idToken);
  setStoredToken(res.token);
  return res.user;
}

/** Turn Firebase / API errors into something a fan can act on. */
export function describeAuthError(e: any): string {
  const code: string = e?.code || '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled. Please try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/unauthorized-domain':
      return 'Google sign-in is not enabled for this domain yet. Please use email sign-in.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/user-disabled':
      return 'This Google account has been disabled.';
    default:
      return e?.message || 'Sign-in failed. Please try again.';
  }
}

const inputClass =
  'w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-base sm:text-sm text-white placeholder-slate-500 outline-none transition-colors';

const primaryBtn =
  'w-full min-h-[48px] px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, config }) => {
  const googleEnabled = config ? config.features.googleSignIn : true;
  const otpEnabled = config ? config.features.emailOtp : true;

  const [method, setMethod] = useState<'google' | 'otp'>(googleEnabled ? 'google' : 'otp');

  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the selected method valid when config arrives/changes
  useEffect(() => {
    if (method === 'google' && !googleEnabled && otpEnabled) setMethod('otp');
    if (method === 'otp' && !otpEnabled && googleEnabled) setMethod('google');
  }, [googleEnabled, otpEnabled, method]);

  // Reset transient state when the modal closes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const finish = (user: User) => {
    onSuccess(user);
    onClose();
    setOtpSent(false);
    setOtpCode('');
    setDevOtpCode(null);
    setOtpMessage(null);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      finish(await completeGoogleLogin(result.user));
    } catch (e: any) {
      const code = e?.code || '';
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        try {
          // Full-page redirect; App.tsx completes the login via getRedirectResult on return.
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: any) {
          setError(describeAuthError(redirectErr));
        }
      } else {
        setError(describeAuthError(e));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = otpEmail.trim();
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.requestOtp(email);
      setOtpSent(true);
      setOtpCode('');
      setOtpMessage(res.message || `We sent a 6-digit code to ${email}.`);
      setDevOtpCode(res.devCode || null);
    } catch (e: any) {
      setError(e?.message || 'Could not send the code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpEmail || otpCode.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.verifyOtp(otpEmail.trim(), otpCode);
      setStoredToken(res.token);
      finish(res.user);
    } catch (e: any) {
      setError(e?.message || 'That code did not work. Check it and try again.');
    } finally {
      setLoading(false);
    }
  };

  const noMethods = !googleEnabled && !otpEnabled;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-md max-h-[100dvh] overflow-y-auto bg-slate-900 border-t sm:border border-amber-500/30 rounded-t-3xl sm:rounded-2xl p-5 sm:p-8 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-8 shadow-2xl shadow-amber-500/10 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6 pr-8 pl-8">
          <h2 id="auth-title" className="text-2xl font-black tracking-tight text-white">
            Sign in to <span className="text-amber-400">{config?.brandName || 'ADT10 Fans'}</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Back your franchise, enter contests and prize draws, and join the discussion.
          </p>
        </div>

        {noMethods && (
          <p className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-300 text-center">
            Sign-in is temporarily unavailable. Please check back soon.
          </p>
        )}

        {googleEnabled && otpEnabled && (
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-xl mb-5 border border-slate-800" role="tablist">
            {(['google', 'otp'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={method === m}
                onClick={() => { setMethod(m); setError(null); }}
                className={`min-h-[44px] flex items-center justify-center gap-2 rounded-lg text-sm font-bold transition-all ${
                  method === m ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {m === 'google' ? 'Google' : <><Mail className="w-4 h-4" /> Email code</>}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div role="alert" className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        {googleEnabled && method === 'google' && (
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full min-h-[48px] px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm rounded-xl flex items-center justify-center gap-3 transition-all disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.1 7.5 23 12 23z"/>
              </svg>
            )}
            <span>Continue with Google</span>
          </button>
        )}

        {otpEnabled && method === 'otp' && (
          !otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-3">
              <div>
                <label htmlFor="otp-email" className="block text-sm font-semibold text-slate-300 mb-1.5">
                  Email address
                </label>
                <input
                  id="otp-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={otpEmail}
                  onChange={(e) => setOtpEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className={inputClass}
                />
                <p className="text-xs text-slate-400 mt-1.5">We'll email you a 6-digit code. No password needed.</p>
              </div>
              <button type="submit" disabled={loading || !otpEmail.trim()} className={primaryBtn}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                <span>Send code</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              {otpMessage && <p className="text-sm text-slate-300">{otpMessage}</p>}
              <div>
                <label htmlFor="otp-code" className="block text-sm font-semibold text-slate-300 mb-1.5">
                  6-digit code
                </label>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  required
                  autoFocus
                  className={`${inputClass} text-center tracking-[0.5em] font-mono font-bold`}
                />
                {devOtpCode && (
                  <p className="text-xs text-slate-500 mt-1.5">
                    Dev code: <span className="font-mono text-slate-300">{devOtpCode}</span>
                  </p>
                )}
                <div className="flex justify-between items-center mt-2 gap-2">
                  <span className="text-xs text-slate-400 truncate">Sent to {otpEmail}</span>
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setOtpCode(''); setDevOtpCode(null); setError(null); }}
                    className="text-sm text-amber-400 hover:underline min-h-[36px] px-1 shrink-0"
                  >
                    Change email
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading || otpCode.length !== 6} className={primaryBtn}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Verify and sign in</span>
              </button>
            </form>
          )
        )}
      </div>
    </div>
  );
};

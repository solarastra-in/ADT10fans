import React, { useState } from 'react';
import { api, setStoredToken } from '../api';
import { User } from '../types';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { X, Mail, Shield, CheckCircle2, ArrowRight, Sparkles, KeyRound } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [method, setMethod] = useState<'google' | 'otp'>('google');
  
  // Google Auth State
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');

  // Email OTP State
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFirebaseGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const res = await api.loginGoogle(fbUser.email || 'fan@example.com', fbUser.displayName || undefined, fbUser.photoURL || undefined);
      setStoredToken(res.token);
      onSuccess(res.user);
      onClose();
    } catch (e: any) {
      console.warn('Firebase popup sign-in:', e);
      setError('Note: ' + (e?.message || 'Popup closed') + '. You can also sign in directly using the form below.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminQuickLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.loginGoogle('solarastra.in@gmail.com', 'Franchise Owner (SolarAstra)', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop');
      setStoredToken(res.token);
      onSuccess(res.user);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Google Auth failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmail) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.loginGoogle(googleEmail, googleName || undefined);
      setStoredToken(res.token);
      onSuccess(res.user);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Google login error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpEmail) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.requestOtp(otpEmail);
      setOtpSent(true);
      if (res.devCode) {
        setDevOtpCode(res.devCode);
        setOtpCode(res.devCode); // Auto-fill for instant frictionless demo testing
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpEmail || !otpCode) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.verifyOtp(otpEmail, otpCode);
      setStoredToken(res.token);
      onSuccess(res.user);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-amber-500/10 text-slate-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400 mb-3 shadow-inner">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Enter the <span className="text-amber-400">Fan Arena</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Back your favorite franchise, compete in fantasy 10, predict match scores, and win VIP prize draws.
          </p>
        </div>

        {/* Auth Method Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl mb-6 border border-slate-800">
          <button
            type="button"
            onClick={() => { setMethod('google'); setError(null); }}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
              method === 'google'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
            </svg>
            Google Auth
          </button>
          <button
            type="button"
            onClick={() => { setMethod('otp'); setError(null); }}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
              method === 'otp'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mail className="w-4 h-4" />
            Email OTP
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        {/* Google Auth Method */}
        {method === 'google' && (
          <div className="space-y-4">
            {/* Dedicated Franchise Owner / Admin Quick Login */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 to-amber-600/10 border border-amber-500/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> League & Franchise Admin
                </span>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">
                  Verified Owner
                </span>
              </div>
              <p className="text-xs text-slate-300 mb-3">
                Log in as <strong className="text-amber-300">solarastra.in@gmail.com</strong> with full Admin Console access for teams, feeds, draws & handles.
              </p>
              <button
                type="button"
                onClick={handleAdminQuickLogin}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
              >
                <Shield className="w-4 h-4" />
                <span>One-Click Admin Google Sign-In</span>
              </button>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-3 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Or Fan Google Sign In</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <button
              type="button"
              onClick={handleFirebaseGoogleLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.1 7.5 23 12 23z"/>
              </svg>
              <span>Sign In with Google (Firebase Auth)</span>
            </button>

            {/* Custom Google Account Login Form */}
            <form onSubmit={handleGoogleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Google Email Address
                </label>
                <input
                  type="email"
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  placeholder="fan@example.com"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-sm text-white placeholder-slate-400 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Fan Display Name (Optional)
                </label>
                <input
                  type="text"
                  value={googleName}
                  onChange={(e) => setGoogleName(e.target.value)}
                  placeholder="e.g. DesertStriker10"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-sm text-white placeholder-slate-400 outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !googleEmail}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all"
              >
                <span>Continue with Google</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* Email with OTP Verification Method */}
        {method === 'otp' && (
          <div className="space-y-4">
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Your Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={otpEmail}
                      onChange={(e) => setOtpEmail(e.target.value)}
                      placeholder="cricketfan@domain.com"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-sm text-white placeholder-slate-400 outline-none transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    We will send a 6-digit verification code. No password required.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !otpEmail}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Send 6-Digit OTP Code</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                {/* Dev Code Notification Banner */}
                {devOtpCode && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>OTP Code Generated for {otpEmail}</span>
                    </div>
                    <p className="text-[11px] text-emerald-200">
                      6-Digit Code: <strong className="text-amber-400 text-sm tracking-widest">{devOtpCode}</strong> (Valid for 10 minutes)
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Enter 6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    required
                    className="w-full text-center tracking-[0.5em] font-mono font-bold text-lg px-3.5 py-2.5 rounded-xl bg-slate-950 border border-amber-400/50 focus:border-amber-400 text-white outline-none"
                  />
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[11px] text-slate-400">Code sent to {otpEmail}</span>
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="text-[11px] text-amber-400 hover:underline"
                    >
                      Change email
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify Code & Enter Arena</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

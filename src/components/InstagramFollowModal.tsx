import React, { useState, useEffect } from 'react';
import { useApp } from '../state';
import { api } from '../api';

const STORAGE_KEY = 'aces_instagram_verified';
const STORAGE_HANDLE_KEY = 'aces_instagram_handle';

export const InstagramFollowModal: React.FC = () => {
  const { user, config, refreshUser, setUser } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [handle, setHandle] = useState('');
  const [hasFollowedClicked, setHasFollowedClicked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const targetHandle = config?.instagramTargetHandle || '@ArabianAcesofficial';
  const cleanTarget = targetHandle.replace(/^@/, '');

  useEffect(() => {
    // Check if configuration requires it
    if (config?.requireInstagramFollow === false) {
      setIsOpen(false);
      return;
    }

    const localDone = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    const userDone = user?.instagramFollowed;

    if (userDone || localDone === 'true') {
      setIsOpen(false);
    } else {
      // Show modal to prompt user
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [user?.instagramFollowed, config?.requireInstagramFollow]);

  if (!isOpen) return null;

  const handleOpenInstagram = () => {
    setHasFollowedClicked(true);
    // Deep link to native Instagram app, with web fallback
    const appUrl = `instagram://user?username=${cleanTarget}`;
    const webUrl = `https://www.instagram.com/${cleanTarget}/`;

    const start = Date.now();
    window.location.href = appUrl;

    setTimeout(() => {
      // If browser is still active after 1.2s, open web version in fallback
      if (Date.now() - start < 1500) {
        window.open(webUrl, '_blank', 'noopener,noreferrer');
      }
    }, 1200);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = handle.trim();
    if (!clean) {
      setError('Please enter your Instagram username to confirm');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (user) {
        const res = await api.verifySocialFollow('instagram', clean);
        if (res.pointsAwarded && res.pointsAwarded > 0) {
          setSuccessMsg(`Verified! +${res.pointsAwarded} Bonus Fan Points added to your account.`);
        } else {
          setSuccessMsg('Instagram verified! Welcome to the Arabian Aces family.');
        }
        await refreshUser?.();
      } else {
        // Guest mode: save locally so they can browse freely and claim when they log in
        localStorage.setItem(STORAGE_KEY, 'true');
        localStorage.setItem(STORAGE_HANDLE_KEY, clean);
        setSuccessMsg('Instagram follow confirmed! Enjoy full access to Arabian Aces Fan Hub.');
      }

      localStorage.setItem(STORAGE_KEY, 'true');
      setTimeout(() => {
        setIsOpen(false);
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-navy-900 border border-gold-500/30 rounded-2xl shadow-2xl p-6 sm:p-8 text-white overflow-hidden">
        {/* Decorative corner glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-gold-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-amber-600/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-0.5 shadow-lg mb-4">
            <div className="w-full h-full bg-navy-900 rounded-[14px] flex items-center justify-center">
              <svg className="w-8 h-8 text-rose-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </div>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
            Join the Arabian Aces Tribe
          </h2>
          <p className="text-navy-200 text-sm mb-6 leading-relaxed">
            Follow <span className="font-semibold text-gold-400">{targetHandle}</span> on Instagram to unlock exclusive fan perks, live match predictions, and earn <span className="text-amber-400 font-bold">+25 Bonus Points</span>!
          </p>

          {successMsg ? (
            <div className="bg-emerald-950/70 border border-emerald-500/50 rounded-xl p-4 text-emerald-200 text-sm font-medium mb-4">
              ✓ {successMsg}
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              {/* Step 1: Open Instagram */}
              <button
                type="button"
                onClick={handleOpenInstagram}
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-amber-600 hover:from-pink-500 hover:via-rose-500 hover:to-amber-500 text-white font-semibold text-sm transition-all shadow-lg shadow-rose-900/30"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/>
                </svg>
                {hasFollowedClicked ? 'Followed? Click to re-open' : `Open Instagram & Follow ${targetHandle}`}
              </button>

              {/* Step 2: Input username */}
              <div className="text-left">
                <label className="block text-xs font-semibold text-navy-300 uppercase tracking-wider mb-1.5">
                  Your Instagram Username
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-navy-400 font-medium">@</span>
                  <input
                    type="text"
                    value={handle.replace(/^@/, '')}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="yourusername"
                    className="w-full pl-8 pr-4 py-2.5 bg-navy-950/70 border border-navy-700 focus:border-gold-500 rounded-xl text-white placeholder-navy-500 text-sm focus:outline-none focus:ring-1 focus:ring-gold-500"
                    required
                  />
                </div>
              </div>

              {error && (
                <p className="text-rose-400 text-xs text-left">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-sm tracking-wide transition-all shadow-md hover:shadow-gold-500/20 disabled:opacity-50"
              >
                {submitting ? 'Verifying...' : 'Confirm Follow & Claim Access'}
              </button>
            </form>
          )}

          <div className="mt-4 pt-4 border-t border-navy-800 text-center">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-navy-400 hover:text-navy-200 transition-colors"
            >
              I will follow later (continue browsing as guest)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

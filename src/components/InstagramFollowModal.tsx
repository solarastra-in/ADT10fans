import React, { useState, useEffect } from 'react';
import { CheckCircle2, Sparkles, X, ExternalLink, Heart, ShieldCheck, AlertCircle } from 'lucide-react';
import { useApp } from '../state';
import { api } from '../api';

const STORAGE_KEY = 'aces_instagram_verified';
const STORAGE_HANDLE_KEY = 'aces_instagram_handle';
const STORAGE_CODE_KEY = 'aces_verification_code';

export const InstagramFollowModal: React.FC = () => {
  const { user, config, refreshUser, instaModalOpen, closeInstaModal, openAuth, toast } = useApp();
  
  // Stored state
  const [handle, setHandle] = useState(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_HANDLE_KEY) : '') || '';
  });
  const [verificationCode, setVerificationCode] = useState(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_CODE_KEY) : '') || '';
  });

  // Track user actions
  const [followedClicked, setFollowedClicked] = useState(false);
  const [likedClicked, setLikedClicked] = useState(false);
  const [confirmFollowed, setConfirmFollowed] = useState(false);
  const [confirmLiked, setConfirmLiked] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    handle: string;
    verificationCode: string;
    pointsAwarded: number;
    message: string;
  } | null>(null);

  const targetHandle = config?.instagramTargetHandle || '@ArabianAcesofficial';
  const cleanTarget = targetHandle.replace(/^@/, '');
  const pinnedPostUrl = config?.instagramPinnedPostUrl || `https://www.instagram.com/${cleanTarget}/`;

  // Determine verification status
  const isVerifiedLocally = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true';
  const isVerifiedUser = Boolean(user?.instagramFollowed);
  const isAlreadyVerified = isVerifiedUser || isVerifiedLocally;

  // Sync state if user logs in
  useEffect(() => {
    if (user?.instagramFollowed) {
      if (user.instagramHandle) setHandle(user.instagramHandle);
      if (user.instagramVerificationCode) setVerificationCode(user.instagramVerificationCode);
    }
  }, [user]);

  // Live client-side validation
  const cleanInput = handle.trim().toLowerCase().replace(/^@/, '');
  const validateFormat = (val: string): { valid: boolean; reason?: string } => {
    if (!val) return { valid: false, reason: 'Please enter your Instagram handle' };
    if (val.length < 2) return { valid: false, reason: 'Instagram handle must be at least 2 characters' };
    if (val.length > 30) return { valid: false, reason: 'Instagram handle cannot exceed 30 characters' };
    if (!/^[a-zA-Z0-9._]+$/.test(val)) {
      return { valid: false, reason: 'Only letters, numbers, periods (.), and underscores (_) are allowed' };
    }
    if (val.startsWith('.') || val.endsWith('.')) {
      return { valid: false, reason: 'Handle cannot start or end with a period' };
    }
    if (val.includes('..')) {
      return { valid: false, reason: 'Handle cannot contain consecutive periods' };
    }
    const BLACKLIST = [
      'instagram', 'admin', 'administrator', 'user', 'username', 'test', 'tester', 'none', 'null',
      'undefined', 'someone', 'fake', 'sample', 'dummy', 'arabianaces', 'arabianacesofficial',
      'asdf', 'qwerty', '123456', 'unknown', 'profile', 'support', 'help'
    ];
    if (BLACKLIST.includes(val)) {
      return { valid: false, reason: `"${val}" is a placeholder or reserved handle. Please enter your real personal account.` };
    }
    return { valid: true };
  };

  const validation = validateFormat(cleanInput);

  // If Gatekeeper is active (unverified and follow is required), it is unskippable
  const gatekeeperActive = config?.requireInstagramFollow !== false && !isAlreadyVerified && !successData;
  const showModal = gatekeeperActive || instaModalOpen || Boolean(successData);

  if (!showModal) return null;

  const handleOpenInstagramProfile = () => {
    setFollowedClicked(true);
    setConfirmFollowed(true);
    const appUrl = `instagram://user?username=${cleanTarget}`;
    const webUrl = `https://www.instagram.com/${cleanTarget}/`;

    const start = Date.now();
    window.location.href = appUrl;

    setTimeout(() => {
      if (Date.now() - start < 1500) {
        window.open(webUrl, '_blank', 'noopener,noreferrer');
      }
    }, 1000);
  };

  const handleOpenPinnedPost = () => {
    setLikedClicked(true);
    setConfirmLiked(true);
    window.open(pinnedPostUrl, '_blank', 'noopener,noreferrer');
  };

  const handleVerifyGatekeeper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid) {
      setError(validation.reason || 'Invalid Instagram handle format');
      return;
    }

    if (!confirmFollowed) {
      setError(`Please confirm that you have followed ${targetHandle} on Instagram.`);
      return;
    }

    if (!confirmLiked) {
      setError('Please confirm that you have liked the latest match post on Instagram.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await api.verifyInstagramGatekeeper({
        handle: cleanInput,
        followedAccount: true,
        likedPost: true,
      });

      // Save locally
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, 'true');
        localStorage.setItem(STORAGE_HANDLE_KEY, res.handle);
        localStorage.setItem(STORAGE_CODE_KEY, res.verificationCode);
      }

      setVerificationCode(res.verificationCode);
      setSuccessData({
        handle: res.handle,
        verificationCode: res.verificationCode,
        pointsAwarded: res.pointsAwarded || 25,
        message: res.message || 'Verification complete!',
      });

      if (user) {
        await refreshUser?.();
      }
      toast('Instagram verified successfully! Welcome to adt10fans.com.');
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please check your username and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnterSite = () => {
    closeInstaModal();
    setSuccessData(null);
  };

  const handleProceedToSignIn = () => {
    handleEnterSite();
    openAuth('Sign in with your verified Instagram handle to unlock all fan privileges!');
  };

  // If already verified and user opened modal to inspect their pass
  if (isAlreadyVerified && !successData && instaModalOpen) {
    const displayHandle = user?.instagramHandle || handle || '@verified_fan';
    const displayCode = user?.instagramVerificationCode || verificationCode || 'ACES-PASS';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/90 backdrop-blur-md animate-fade-in">
        <div className="relative w-full max-w-md bg-navy-900 border border-gold-500/40 rounded-3xl shadow-2xl p-6 sm:p-8 text-white overflow-hidden">
          <button
            type="button"
            onClick={closeInstaModal}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-xl">
              <div className="w-full h-full bg-navy-900 rounded-[14px] flex items-center justify-center">
                <ShieldCheck className="w-9 h-9 text-emerald-400" />
              </div>
            </div>

            <div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black tracking-wide uppercase">
                Official Verified Fan
              </span>
              <h2 className="text-2xl font-black text-white mt-2">
                Instagram Follow Confirmed
              </h2>
              <p className="text-xs text-navy-200 mt-1">
                You are fully verified for {targetHandle} on adt10fans.com
              </p>
            </div>

            <div className="bg-navy-950/80 border border-gold-500/30 rounded-2xl p-4 text-left space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-navy-400 font-medium">Verified Handle</span>
                <span className="font-mono font-bold text-gold-400">{displayHandle}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-navy-400 font-medium">Fan Verification ID</span>
                <span className="font-mono font-extrabold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-500/40">
                  {displayCode}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-navy-400 font-medium">Matchday Post Liked</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={closeInstaModal}
              className="w-full py-3 px-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-black text-sm tracking-wide transition-all shadow-md active:scale-95"
            >
              Back to Fan Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/95 backdrop-blur-xl animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-navy-900 border border-gold-500/40 rounded-3xl shadow-2xl p-6 sm:p-8 text-white my-8 overflow-hidden">
        
        {/* Glow Effects */}
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Banner */}
        <div className="relative text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-0.5 shadow-xl mb-3">
            <div className="w-full h-full bg-navy-900 rounded-[14px] flex items-center justify-center">
              <svg className="w-8 h-8 text-rose-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-black tracking-wider uppercase mb-2">
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            Mandatory Gatekeeper • adt10fans.com
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
            Arabian Aces Fan Verification
          </h2>
          <p className="text-navy-200 text-xs sm:text-sm mb-5 leading-relaxed">
            To ensure genuine fan participation, all visitors must follow{' '}
            <span className="font-extrabold text-gold-400">{targetHandle}</span> and like the matchday post on Instagram before entering the platform.
          </p>

          {successData ? (
            /* Celebration Card */
            <div className="space-y-4 text-left animate-fade-in">
              <div className="bg-gradient-to-br from-emerald-950/80 via-navy-950/90 to-emerald-950/80 border border-emerald-500/60 rounded-2xl p-5 shadow-xl space-y-3">
                <div className="flex items-center gap-2.5 text-emerald-400 font-black text-base">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <span>Access Granted to adt10fans.com!</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Your Instagram verification has been successfully recorded. Welcome to the official Arabian Aces Fan Club!
                </p>

                <div className="pt-2 border-t border-emerald-900/50 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Verified Instagram Handle:</span>
                    <span className="font-bold text-white font-mono">{successData.handle}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Fan Verification ID:</span>
                    <span className="font-mono font-black text-amber-400 bg-amber-950/70 px-2.5 py-1 rounded border border-amber-500/40">
                      {successData.verificationCode}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Points Unlocked:</span>
                    <span className="font-bold text-emerald-400">+{successData.pointsAwarded} Fan Points</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleEnterSite}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 font-black text-sm tracking-wide transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  Enter adt10fans.com Now
                </button>

                {!user && (
                  <button
                    type="button"
                    onClick={handleProceedToSignIn}
                    className="w-full py-3 px-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-black text-xs tracking-wide transition-all shadow-md active:scale-95"
                  >
                    Sign In to Save Your Points & Profile
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Verification Form */
            <form onSubmit={handleVerifyGatekeeper} className="space-y-4 text-left">
              {/* Action 1 & Action 2 Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleOpenInstagramProfile}
                  className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs transition-all shadow-md ${
                    followedClicked
                      ? 'bg-emerald-950/60 border border-emerald-500/60 text-emerald-300'
                      : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-rose-900/30'
                  }`}
                >
                  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/>
                  </svg>
                  <span>{followedClicked ? '✓ Follow Opened' : `1. Follow ${targetHandle}`}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" />
                </button>

                <button
                  type="button"
                  onClick={handleOpenPinnedPost}
                  className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs transition-all shadow-md ${
                    likedClicked
                      ? 'bg-emerald-950/60 border border-emerald-500/60 text-emerald-300'
                      : 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-amber-900/30'
                  }`}
                >
                  <Heart className="w-4 h-4 text-rose-300 fill-rose-300 shrink-0" />
                  <span>{likedClicked ? '✓ Post Opened' : '2. Like Matchday Post'}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" />
                </button>
              </div>

              {/* Input for Instagram Username */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-navy-200 uppercase tracking-wider">
                  3. Enter Your Instagram Username
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gold-400 font-extrabold text-sm">@</span>
                  <input
                    type="text"
                    value={handle.replace(/^@/, '')}
                    onChange={(e) => {
                      setHandle(e.target.value);
                      setError(null);
                    }}
                    placeholder="your_instagram_handle"
                    className="w-full pl-8 pr-4 py-2.5 bg-navy-950/80 border border-navy-700 focus:border-gold-500 rounded-xl text-white placeholder-navy-500 text-sm focus:outline-none focus:ring-1 focus:ring-gold-500 font-medium"
                    required
                  />
                </div>
                {/* Real-time validation feedback */}
                {cleanInput.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] pt-1">
                    {validation.valid ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Valid Instagram handle syntax
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3 h-3" /> {validation.reason}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Mandatory Affirmation Checkboxes */}
              <div className="space-y-2 bg-navy-950/60 border border-navy-800 rounded-xl p-3 text-xs">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmFollowed}
                    onChange={(e) => setConfirmFollowed(e.target.checked)}
                    className="mt-0.5 rounded border-navy-700 text-pink-500 focus:ring-pink-500 h-4 w-4 bg-navy-900"
                  />
                  <span className="text-navy-200">
                    I confirm that I have followed <strong className="text-gold-400">{targetHandle}</strong> on Instagram.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmLiked}
                    onChange={(e) => setConfirmLiked(e.target.checked)}
                    className="mt-0.5 rounded border-navy-700 text-rose-500 focus:ring-rose-500 h-4 w-4 bg-navy-900"
                  />
                  <span className="text-navy-200">
                    I confirm that I have liked the latest matchday post on <strong className="text-rose-300">@ArabianAcesofficial</strong>.
                  </span>
                </label>
              </div>

              {error && (
                <div className="text-rose-300 text-xs bg-rose-950/70 p-3 rounded-xl border border-rose-800/80 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || !validation.valid || !confirmFollowed || !confirmLiked}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-gold-500 to-amber-500 hover:from-amber-300 hover:to-gold-400 text-navy-950 font-black text-sm tracking-wide transition-all shadow-lg hover:shadow-gold-500/25 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                {submitting ? 'Verifying with Gatekeeper...' : 'Verify & Enter adt10fans.com (+25 Points)'}
              </button>

              <div className="text-center">
                <p className="text-[11px] text-navy-400">
                  Each Instagram username can be verified once and is linked to your fan pass.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

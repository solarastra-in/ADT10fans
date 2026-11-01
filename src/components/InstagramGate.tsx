import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Clipboard, ExternalLink, Instagram, Loader2, QrCode } from 'lucide-react';
import { useApp } from '../state';
import { api } from '../api';
import { useT } from '../i18n';
import { navigate, useRoute } from '../router';
import { Button, inputCls } from './ui';
import type { InstagramView } from '../types';

/**
 * Pages without the check: the rules and legal pages, and the staff pages (staff sign-in, the admin
 * console, team portals and invitations, the fan venue desk). Staff accounts never take the check;
 * these pages let them sign in without the fan screen in the way.
 */
const OPEN_ROUTES = new Set(['rules', 'privacy', 'terms', 'teamInvite', 'teamPortal', 'admin', 'adminFanclub', 'staff']);

/**
 * Before fans can use ADT10fans.com they sign in and prove their Instagram: follow the club's
 * account, then comment a code on its pinned post. The site reads the comment and lets them in
 * (or an organiser confirms them). The server enforces the same rule on every game, prize and post.
 */
export function InstagramGate() {
  const { user, config, ready, openAuth, refreshUser, toast } = useApp();
  const route = useRoute();
  const t = useT();
  const [view, setView] = useState<InstagramView | null>(null);
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState<'' | 'start' | 'check' | 'review'>('');
  const [message, setMessage] = useState('');
  const [pass, setPass] = useState<{ code: string; qr: string } | null>(null);

  const required = config?.requireInstagramFollow !== false;
  const exempt = !required || OPEN_ROUTES.has(route.name) || user?.role === 'admin' || user?.instagramFollowed;

  // Once verified (by the comment check, an organiser, or a venue admin who confirmed the fan in
  // person), move on: a fan checked in at a fan club goes straight to the team games.
  const onVerified = async (points?: number) => {
    toast(points ? t('Instagram verified! +{n} points', { n: points }) : t('Instagram verified!'));
    await refreshUser().catch(() => undefined);
    const st = await api.getFanClubStatus().catch(() => null);
    if (st?.checkedInRecord || st?.gamesTeamId) navigate('/team-games');
  };

  useEffect(() => {
    if (!user || exempt) return;
    let stop = false;
    let done = false;
    const load = () =>
      api
        .instagramStatus()
        .then(v => {
          if (stop || done) return;
          setView(v);
          if (v.handle) setHandle(h => h || v.handle!);
          if (v.status === 'verified') {
            done = true;
            onVerified();
          }
        })
        .catch(() => undefined);
    load();
    // Check every few seconds, so the screen moves on by itself when a venue admin or an organiser
    // confirms the fan.
    const id = setInterval(load, 5_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, exempt]);

  // The fan's fan club code and QR, for a venue admin to scan at a fan club.
  useEffect(() => {
    if (!user || exempt) return;
    api
      .getFanClubStatus()
      .then(async st => {
        if (st.fanClubCode && st.qrPayload) setPass({ code: st.fanClubCode, qr: await QRCode.toDataURL(st.qrPayload, { width: 280, margin: 1, errorCorrectionLevel: 'M' }) });
      })
      .catch(() => undefined);
  }, [user?.id, exempt]);

  if (!ready || exempt) return null;

  const target = (config?.instagramTargetHandle || '@arabianacesofficial').replace(/^@?/, '@');
  const targetUrl = view?.targetUrl || `https://www.instagram.com/${target.slice(1)}/`;

  const run = async (kind: 'start' | 'check' | 'review') => {
    setBusy(kind);
    setMessage('');
    try {
      const v = kind === 'start' ? await api.instagramStart(handle) : kind === 'check' ? await api.instagramCheck() : await api.instagramRequestReview();
      setView(v);
      if (v.reason) setMessage(v.reason);
      if (v.verified || v.status === 'verified') await onVerified(v.pointsAwarded);
    } catch (e: any) {
      setMessage(e?.message || t('Something went wrong. Please try again.'));
    } finally {
      setBusy('');
    }
  };

  const copy = (s: string) => {
    navigator.clipboard?.writeText(s).then(() => toast(t('Copied')), () => undefined);
  };

  const step = !user ? 'signin' : !view ? 'loading' : view.status === 'review' ? 'review' : view.code && (view.status === 'code' || view.status === 'rejected') ? 'comment' : 'username';

  return (
    <div className="fixed inset-0 z-[55] overflow-y-auto bg-slate-950/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="ig-gate-title" data-testid="instagram-gate">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-slate-900 p-6 shadow-2xl space-y-5">
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center">
              <Instagram className="w-7 h-7 text-white" />
            </div>
            <h2 id="ig-gate-title" className="text-xl font-black text-white">{t('Join the fans on Instagram')}</h2>
            <p className="text-sm text-slate-300">
              {t('To play on ADT10fans.com, follow {account} on Instagram and confirm your account. It takes a minute.', { account: target })}
            </p>
          </div>

          <ol className="space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">1</span>
              <div className="flex-1 space-y-2">
                <p className="text-white font-bold">{t('Follow {account}', { account: target })}</p>
                <a href={targetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 px-3 py-2 text-xs font-black text-white">
                  {t('Open Instagram')} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">2</span>
              <div className="flex-1 space-y-2">
                <p className="text-white font-bold">{t('Sign in and enter your Instagram username')}</p>
                {step === 'signin' ? (
                  <Button onClick={() => openAuth(t('Sign in to verify your Instagram.'))}>{t('Sign in')}</Button>
                ) : step === 'loading' ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                ) : (
                  <form
                    className="flex gap-2"
                    onSubmit={e => {
                      e.preventDefault();
                      run('start');
                    }}
                  >
                    <span className="sr-only">
                      <label htmlFor="ig-handle">{t('Instagram username')}</label>
                    </span>
                    <input
                      id="ig-handle"
                      className={inputCls}
                      placeholder="@yourname"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      value={handle}
                      onChange={e => setHandle(e.target.value)}
                      data-testid="ig-handle"
                    />
                    <Button type="submit" loading={busy === 'start'} disabled={!handle.trim()}>
                      {view?.code ? t('Update') : t('Next')}
                    </Button>
                  </form>
                )}
              </div>
            </li>

            {(step === 'comment' || step === 'review') && view?.code && (
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">3</span>
                <div className="flex-1 space-y-2">
                  <p className="text-white font-bold">{t('Like the pinned post and comment this code')}</p>
                  <button type="button" onClick={() => copy(view.code!)} className="w-full flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-lg font-black tracking-widest text-amber-300" data-testid="ig-code">
                    {view.code} <Clipboard className="w-4 h-4 text-slate-400" />
                  </button>
                  {view.postUrl && (
                    <span className="flex flex-wrap items-center gap-3">
                      {/* Same tab: on phones this opens the Instagram app on the post. */}
                      <a href={view.postUrl} rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 underline" data-testid="ig-open-post">
                        {t('Open the post')} <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button type="button" onClick={() => copy(view.postUrl!)} className="text-xs font-bold text-slate-300 underline">
                        {t('Copy the post link')}
                      </button>
                    </span>
                  )}
                  <p className="text-xs text-slate-400">{t('Comment from @{handle}. We only use the comment to confirm the account is yours.', { handle: view.handle || '' })}</p>
                  {step === 'review' ? (
                    <p className="rounded-xl bg-slate-800 p-3 text-xs text-slate-200" data-testid="ig-review">
                      {t('Thanks! An organiser will confirm your account shortly. This page updates by itself.')}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {view.automatic && (
                        <Button onClick={() => run('check')} loading={busy === 'check'} data-testid="ig-check">
                          <CheckCircle2 className="w-4 h-4" /> {t('I’ve commented: check')}
                        </Button>
                      )}
                      <Button variant={view.automatic ? 'ghost' : 'primary'} onClick={() => run('review')} loading={busy === 'review'} data-testid="ig-request-review">
                        {t('Ask an organiser to check')}
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            )}
          </ol>

          {pass && (
            <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-center space-y-2" data-testid="ig-fanclub-pass">
              <p className="text-sm font-bold text-white inline-flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-amber-400" /> {t('At a fan club? Show this to the venue admin')}
              </p>
              <img src={pass.qr} alt={t('Your fan club QR code')} className="mx-auto w-40 h-40 rounded-xl bg-white p-2" />
              <p className="font-mono text-2xl font-black tracking-[0.25em] text-amber-300" data-testid="ig-fanclub-code">{pass.code}</p>
              <p className="text-xs text-slate-400">{t('They can confirm your Instagram and check you in. This screen moves on by itself.')}</p>
            </div>
          )}

          {view?.status === 'rejected' && view.note && <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{view.note}</p>}
          {message && <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100" role="status">{message}</p>}

          <p className="text-[11px] text-center text-slate-500">
            {t('Verified fans get +{n} points.', { n: view?.welcomePoints ?? 25 })}{' '}
            <a href="/rules" className="underline">{t('Rules')}</a> · <a href="/privacy" className="underline">{t('Privacy')}</a>
          </p>
        </div>
      </div>
    </div>
  );
}

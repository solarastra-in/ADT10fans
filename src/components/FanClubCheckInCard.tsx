import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Gift, MapPin, QrCode, RefreshCw } from 'lucide-react';
import { useApp } from '../state';
import { api } from '../api';
import { useT } from '../i18n';
import { Button, Card, Countdown, Pill, Spinner, cx, useFormat } from './ui';
import { Link } from '../router';
import type { FanClubStatusResponse } from '../types';

/**
 * A fan's fan club pass: the code (and QR) a fan club admin scans to check them in, the match they
 * can check in for, the clubs and their offers, and the fan's past check-ins.
 */
export const FanClubCheckInCard: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { user, openAuth, teamById, toast, config } = useApp();
  const t = useT();
  const f = useFormat();
  const [status, setStatus] = useState<FanClubStatusResponse | null>(null);
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');
  const [renewing, setRenewing] = useState(false);

  const load = async () => {
    try {
      const data = await api.getFanClubStatus();
      setStatus(data);
      setError('');
      if (data.qrPayload) setQr(await QRCode.toDataURL(data.qrPayload, { width: 320, margin: 1, errorCorrectionLevel: 'M' }));
      else setQr('');
    } catch (e: any) {
      setError(e?.message || t('Could not load your fan club pass.'));
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [user?.id]);

  const renew = async () => {
    setRenewing(true);
    try {
      await api.renewFanClubCode();
      await load();
      toast(t('New code ready. The old one no longer works.'));
    } catch (e: any) {
      toast(e?.message || t('Could not renew the code'));
    } finally {
      setRenewing(false);
    }
  };

  if (!status) return error ? <Card className="p-4 text-sm text-red-300">{error}</Card> : <Spinner />;
  const m = status.openMatch;
  const a = m ? teamById(m.teamA) : null;
  const b = m ? teamById(m.teamB) : null;

  return (
    <Card className="p-4 sm:p-5 space-y-4" data-testid="fanclub-card">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-400/15 text-amber-300 flex items-center justify-center shrink-0">
          <QrCode className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-black text-white">{t('Fan club pass')}</h2>
          <p className="text-xs text-slate-400">
            {t('Watching at a fan club? Show this code at the door. Each check-in earns points, and fans checked in can use the club’s offers.')}
          </p>
        </div>
      </div>

      {m && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm">
          <p className="font-bold text-white">
            {m.matchNo ? t('Match {n}', { n: m.matchNo }) : t('TEST MATCH')}: {a?.short || m.teamA} vs {b?.short || m.teamB}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {f.dateTime(m.startsAt)} ·{' '}
            {status.checkInWindowActive ? (
              <span className="text-emerald-300 font-bold">{t('Check-in is open now')}</span>
            ) : status.opensAt ? (
              <Countdown to={status.opensAt} prefix={t('check-in opens in {time}')} />
            ) : null}
          </p>
          {status.checkedInRecord && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300" data-testid="fanclub-checked-in">
              <CheckCircle2 className="w-4 h-4" /> {t('Checked in at {club} · +{n} points', { club: status.checkedInRecord.fanClubName, n: status.checkedInRecord.pointsAwarded })}
            </p>
          )}
        </div>
      )}

      {!status.signedIn ? (
        <Button onClick={() => openAuth(t('Sign in to get your fan club pass.'))}>{t('Sign in for your pass')}</Button>
      ) : status.instagramRequired ? (
        <p className="text-sm text-amber-200">{t('Verify your Instagram first to get your fan club pass.')}</p>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {qr && <img src={qr} alt={t('Your fan club QR code')} className="w-40 h-40 rounded-xl bg-white p-2" />}
          <div className="text-center sm:text-start space-y-2">
            <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">{t('Your code')}</p>
            <p className="font-mono text-3xl font-black tracking-[0.25em] text-amber-300" data-testid="fanclub-code">{status.fanClubCode}</p>
            <Button size="sm" variant="ghost" onClick={renew} loading={renewing}>
              <RefreshCw className="w-3.5 h-3.5" /> {t('Get a new code')}
            </Button>
          </div>
        </div>
      )}

      {status.todayVisit && !!status.todayOffers?.length && (
        <section className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">{t('Offers for you here today')}</h3>
          {/* Offers are redeemed in one place only: the Arabian Aces page. */}
          <ul className="space-y-1.5" data-testid="pass-offers">
            {status.todayOffers.map(o => (
              <li key={o.id} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm">
                <Gift className="w-4 h-4 text-emerald-300 shrink-0" />
                <span className="flex-1 min-w-0 truncate text-white font-bold">{o.title}</span>
                {o.usedUp ? <Pill>{t('Used')}</Pill> : o.remaining === 0 ? <Pill>{t('Run out')}</Pill> : o.canRedeem ? <Pill tone="green">{t('Ready')}</Pill> : o.opensAt && !o.reason ? <span className="text-[11px] text-slate-400">{t('Opens at {time}', { time: f.time(o.opensAt) })}</span> : null}
              </li>
            ))}
          </ul>
          <Link to="/team-games" className="inline-flex items-center gap-1 text-xs font-black text-amber-300 underline" data-testid="pass-offers-link">
            {t('Redeem them on the {team} page', { team: teamById(config?.fanClubTeamId || 'aces')?.name || t('team games') })}
          </Link>
        </section>
      )}

      {!compact && (
        <>
          <section className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">{t('Fan clubs')}</h3>
            {status.fanClubs.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {status.fanClubs.map(c => (
                  <li key={c.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-1.5">
                    <p className="font-bold text-white text-sm">{c.name}</p>
                    <p className="text-xs text-slate-400 flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{[c.address, c.city, c.country].filter(Boolean).join(', ')}</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Pill tone="amber">{t('+{n} points per check-in', { n: c.checkInPoints ?? 0 })}</Pill>
                      {c.offers.map(o => (
                        <Pill key={o.id} tone="green">
                          <Gift className="w-3 h-3 inline" /> {o.badge || o.perk}
                        </Pill>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">{t('No fan clubs have been added yet.')}</p>
            )}
          </section>

          {!status.todayVisit && !!status.activeOffers?.length && (
            <section className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">{t('Offers')}</h3>
              <ul className="space-y-2">
                {status.activeOffers.map(o => (
                  <li key={o.id} className={cx('rounded-xl border p-3 text-sm', o.used ? 'border-slate-800 opacity-60' : 'border-emerald-500/30 bg-emerald-500/5')}>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white flex-1">{o.title}</p>
                      {o.used ? <Pill>{t('Used')}</Pill> : o.bonusPoints ? <Pill tone="amber">+{o.bonusPoints}</Pill> : null}
                    </div>
                    {o.description && <p className="text-xs text-slate-400 mt-1">{o.description}</p>}
                    <p className="text-[11px] text-slate-500 mt-1">{o.clubName} · {t('Check in at the fan club to use it.')}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!!status.checkIns?.length && (
            <section className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">{t('Your check-ins')}</h3>
              <ul className="text-xs text-slate-300 divide-y divide-slate-800">
                {status.checkIns.map(c => (
                  <li key={c.matchId} className="py-1.5 flex gap-2">
                    <span className="flex-1">{t('Match {n}', { n: c.matchNo })} · {c.fanClubName}</span>
                    <span className="text-amber-300 font-bold">+{c.pointsAwarded}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Card>
  );
};

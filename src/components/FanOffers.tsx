import React, { useState } from 'react';
import { CheckCircle2, Clock, Gift, X } from 'lucide-react';
import { useApp } from '../state';
import { api } from '../api';
import { useT } from '../i18n';
import { Button, Pill, cx, useFormat } from './ui';
import type { FanOffer } from '../types';

/**
 * The offers for the fan's check-in at a fan club. The fan redeems an offer on their own phone, in
 * front of the venue staff: tap Redeem, show the screen, tap again to confirm. Offers open a while
 * after the first ball and close when the match ends; each has a limit per fan and for the venue.
 */
export const FanOffers: React.FC<{ offers: FanOffer[]; onChanged?: () => void }> = ({ offers, onChanged }) => {
  const { refreshUser, toast } = useApp();
  const t = useT();
  const f = useFormat();
  const [confirm, setConfirm] = useState<FanOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ offer: FanOffer; at: string; bonus: number } | null>(null);

  const redeem = async (o: FanOffer) => {
    setBusy(true);
    try {
      const r = await api.fanClubRedeemMine(o.id);
      setConfirm(null);
      setDone({ offer: r.offer, at: r.redemption.at, bonus: r.bonusPoints });
      if (r.bonusPoints) refreshUser().catch(() => undefined);
      onChanged?.();
    } catch (e: any) {
      toast(e?.message || t('Could not redeem the offer'));
      setConfirm(null);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ul className="space-y-2" data-testid="fanclub-today-offers">
        {offers.map(o => {
          const waiting = !o.canRedeem && !o.reason && o.opensAt;
          const left = o.usedUp ? 0 : (o.perUserLimit || 1) - o.used;
          return (
            <li key={o.id} className={cx('rounded-xl border overflow-hidden text-sm', o.canRedeem ? 'border-emerald-500/40 bg-slate-950/60' : 'border-slate-800 bg-slate-950/40')} data-testid="fan-offer">
              {o.imageUrl && <img src={o.imageUrl} alt="" className={cx('w-full max-h-48 object-cover', !o.canRedeem && 'opacity-60')} loading="lazy" />}
              <div className="p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white flex-1">{o.title}</span>
                  {o.usedUp ? <Pill>{t('Used')}</Pill> : o.remaining === 0 ? <Pill>{t('Run out')}</Pill> : o.bonusPoints ? <Pill tone="amber">+{o.bonusPoints}</Pill> : null}
                </div>
                {o.perk && <p className="text-xs font-bold text-emerald-300">{o.perk}</p>}
                {o.description && <p className="text-xs text-slate-400">{o.description}</p>}
                <p className="text-[11px] text-slate-500">
                  {(o.perUserLimit || 1) > 1 ? t('{n} of {m} left for you', { n: Math.max(0, left), m: o.perUserLimit || 1 }) : ''}
                  {(o.perUserLimit || 1) > 1 && o.remaining != null ? ' · ' : ''}
                  {o.remaining != null && !o.usedUp ? t('{n} left at this venue', { n: o.remaining }) : ''}
                </p>
                {o.canRedeem ? (
                  <Button className="w-full" onClick={() => setConfirm(o)} data-testid="fan-offer-redeem">
                    <Gift className="w-4 h-4" /> {t('Redeem')}
                  </Button>
                ) : waiting ? (
                  <p className="text-xs text-amber-200 inline-flex items-center gap-1" data-testid="fan-offer-opens">
                    <Clock className="w-3.5 h-3.5" /> {t('Opens at {time}', { time: f.time(o.opensAt!) })}
                  </p>
                ) : o.reason && !o.usedUp ? (
                  <p className="text-xs text-slate-400">{o.reason}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {confirm && (
        <div className="fixed inset-0 z-[60] bg-slate-950/90 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" data-testid="fan-offer-confirm">
          <div className="w-full max-w-sm rounded-2xl border border-amber-400/40 bg-slate-900 p-5 space-y-4 text-center">
            <p className="text-xs font-black uppercase tracking-wider text-amber-300">{confirm.clubName}</p>
            <p className="text-xl font-black text-white">{confirm.title}</p>
            {confirm.perk && <p className="text-sm text-emerald-300 font-bold">{confirm.perk}</p>}
            <p className="text-sm text-slate-300">{t('Show this screen to the staff, then tap Redeem together. It can only be used once.')}</p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirm(null)} disabled={busy}>{t('Cancel')}</Button>
              <Button className="flex-1" loading={busy} onClick={() => redeem(confirm)} data-testid="fan-offer-confirm-redeem">{t('Redeem')}</Button>
            </div>
          </div>
        </div>
      )}

      {done && (
        <div className="fixed inset-0 z-[60] bg-emerald-950/95 flex items-center justify-center p-4" role="dialog" aria-modal="true" data-testid="fan-offer-done">
          <div className="w-full max-w-sm text-center space-y-3">
            <CheckCircle2 className="w-24 h-24 mx-auto text-emerald-400" />
            <p className="text-sm font-black uppercase tracking-wider text-emerald-300">{t('Redeemed')}</p>
            <p className="text-2xl font-black text-white">{done.offer.title}</p>
            {done.offer.perk && <p className="text-emerald-200 font-bold">{done.offer.perk}</p>}
            <p className="text-sm text-emerald-100">{done.offer.clubName} · {f.time(done.at)}</p>
            {(done.offer.perUserLimit || 1) > 1 && <p className="text-xs text-emerald-200">{t('{n} of {m} used', { n: done.offer.used, m: done.offer.perUserLimit || 1 })}</p>}
            {done.bonus > 0 && <p className="text-sm font-bold text-amber-300">+{done.bonus} {t('points')}</p>}
            <Button variant="ghost" onClick={() => setDone(null)} data-testid="fan-offer-done-close">
              <X className="w-4 h-4" /> {t('Close')}
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

import React, { useMemo } from 'react';
import { Award, CheckCircle2, Crown, Gift, Lock, Shirt, Sparkles, Ticket, TrendingUp, Zap } from 'lucide-react';
import type { PrizeItem, User } from '../types';
import { cx } from './ui';
import { useT } from '../i18n';

export interface RewardTier {
  /** The prize category this tier is built from (Admin → Prizes → Tier). */
  category: string;
  level: number;
  /** The cheapest prize in the tier: the points that unlock it. */
  minPoints: number;
  maxPoints: number;
  items: PrizeItem[];
  color: string;
}

const COLORS = ['#f59e0b', '#38bdf8', '#10b981', '#a855f7', '#f43f5e', '#eab308', '#22d3ee'];

/** Prize category for a prize (set by admins; older prizes get one from their name). */
export const prizeCategory = (p: PrizeItem) => p.category?.trim() || 'Other rewards';

/**
 * The reward tiers, built from the prizes themselves: one tier per prize category, unlocked at the
 * points of its cheapest prize, ordered by those points. Change a prize's points or tier in Admin →
 * Prizes and the timeline follows.
 */
export function buildTiers(prizes: PrizeItem[]): RewardTier[] {
  const groups = new Map<string, PrizeItem[]>();
  for (const p of prizes) {
    if (!p.active || p.pointsCost <= 0) continue;
    const k = prizeCategory(p);
    groups.set(k, [...(groups.get(k) || []), p]);
  }
  return [...groups.entries()]
    .map(([category, items]) => {
      const sorted = [...items].sort((a, b) => a.pointsCost - b.pointsCost || a.title.localeCompare(b.title));
      return { category, items: sorted, minPoints: sorted[0].pointsCost, maxPoints: sorted[sorted.length - 1].pointsCost };
    })
    .sort((a, b) => a.minPoints - b.minPoints || a.maxPoints - b.maxPoints || a.category.localeCompare(b.category))
    .map((t, i) => ({ ...t, level: i + 1, color: COLORS[i % COLORS.length] }));
}

function TierIcon({ category, className }: { category: string; className?: string }) {
  const c = category.toLowerCase();
  if (c.includes('ticket')) return <Ticket className={className} />;
  if (c.includes('bundle')) return <Crown className={className} />;
  if (c.includes('bat')) return <Award className={className} />;
  if (c.includes('signed')) return <Sparkles className={className} />;
  if (/(shirt|apparel|jersey|kit)/.test(c)) return <Shirt className={className} />;
  return <Gift className={className} />;
}

interface Props {
  user: User | null;
  balance: number;
  prizes: PrizeItem[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onOpenAuth?: () => void;
}

export const TieredRewardDashboard: React.FC<Props> = ({ user, balance, prizes, selectedCategory, onSelectCategory, onOpenAuth }) => {
  const t = useT();
  const tiers = useMemo(() => buildTiers(prizes), [prizes]);
  if (!tiers.length) return null;

  const unlocked = user ? [...tiers].reverse().find(x => balance >= x.minPoints) || null : null;
  const next = user ? tiers.find(x => balance < x.minPoints) || null : tiers[0];
  const prevMin = unlocked?.minPoints || 0;
  const toNext = next ? Math.max(0, next.minPoints - balance) : 0;
  const pct = next ? Math.min(100, Math.max(0, Math.round(((balance - prevMin) / Math.max(1, next.minPoints - prevMin)) * 100))) : 100;
  const top = tiers[tiers.length - 1].minPoints;
  const overall = Math.min(100, Math.round((balance / Math.max(1, top)) * 100));

  return (
    <div className="rounded-3xl bg-slate-900 border border-slate-800 p-5 sm:p-7 space-y-6" data-testid="reward-tiers">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-2 flex-1 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-400/15 border border-amber-400/30 text-amber-300">
            <TrendingUp className="w-3.5 h-3.5" /> {t('Reward tiers')}
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white">{t('Point milestones')}</h2>
          <p className="text-sm text-slate-400 max-w-xl">{t('Each tier opens at the points of its cheapest prize. Earn points by playing, then claim any prize you can afford.')}</p>
          {user ? (
            next ? (
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('Next: tier {n}', { n: next.level })}</span>
                  <span className="text-sm font-black text-white inline-flex items-center gap-1.5">
                    <span style={{ color: next.color }}><TierIcon category={next.category} className="w-4 h-4" /></span>
                    {next.category} · {next.minPoints} {t('pts')}
                  </span>
                </div>
                <div className="text-end">
                  <span className="block text-xs font-bold text-amber-400 font-mono" data-testid="tier-to-go">{t('{n} pts to go', { n: toNext })}</span>
                  <div className="mt-1 w-32 h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-amber-400" style={{ width: `${pct}%` }} /></div>
                </div>
              </div>
            ) : (
              <p className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-sm font-bold text-emerald-300">{t('Every tier is unlocked.')}</p>
            )
          ) : (
            onOpenAuth && (
              <button type="button" onClick={onOpenAuth} className="px-3.5 py-1.5 rounded-xl bg-amber-400 text-slate-950 text-xs font-black">
                {t('Sign in to track your progress')}
              </button>
            )
          )}
        </div>
        {user && (
          <div className="shrink-0 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 min-w-[200px]">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">{t('Points to spend')}</span>
            <div className="text-3xl font-black font-mono text-amber-400 flex items-center gap-1.5 mt-1">
              <Zap className="w-5 h-5 fill-amber-400" /> {balance}
            </div>
            <div className="mt-3 w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-rose-400" style={{ width: `${overall}%` }} />
            </div>
            <span className="mt-1 block text-[11px] text-slate-500">{t('{p}% of the way to the top tier ({n} pts)', { p: overall, n: top })}</span>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
          <span>{t('Tier milestones timeline')}</span>
          <span className="text-amber-400" data-testid="tier-range">{t('{a} to {b} pts', { a: tiers[0].minPoints.toLocaleString(), b: tiers[tiers.length - 1].maxPoints.toLocaleString() })}</span>
        </div>
        <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {tiers.map(tier => {
            const open = Boolean(user) && balance >= tier.minPoints;
            const target = next?.category === tier.category;
            const selected = selectedCategory === tier.category;
            return (
              <li key={tier.category}>
                <button
                  type="button"
                  onClick={() => onSelectCategory(selected ? 'all' : tier.category)}
                  aria-pressed={selected}
                  className={cx('w-full h-full p-3 rounded-2xl border text-start space-y-2', selected ? 'bg-slate-800 border-amber-400' : target ? 'bg-slate-950/80 border-amber-400/50' : 'bg-slate-950/50 border-slate-800')}
                  data-testid="tier"
                >
                  <div className="flex items-center justify-between">
                    <span className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${tier.color}20`, color: tier.color }}>
                      <TierIcon category={tier.category} className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-mono text-xs font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md" data-testid="tier-points">{tier.minPoints}+</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">{t('Tier {n}', { n: tier.level })}</span>
                    <span className="block text-sm font-black text-white leading-tight">{tier.category}</span>
                    <span className="block text-[11px] text-slate-400">
                      {tier.items.length} {tier.items.length === 1 ? t('prize') : t('prizes')}
                      {tier.maxPoints !== tier.minPoints ? ` · ${tier.minPoints}–${tier.maxPoints} ${t('pts')}` : ''}
                    </span>
                  </div>
                  <ul className="text-[11px] text-slate-300 space-y-0.5">
                    {tier.items.slice(0, 3).map(p => (
                      <li key={p.id} className="flex gap-1">
                        <span className="truncate flex-1">{p.title}</span>
                        <span className="font-mono text-slate-500">{p.pointsCost}</span>
                      </li>
                    ))}
                    {tier.items.length > 3 && <li className="text-slate-500">+{tier.items.length - 3} {t('more')}</li>}
                  </ul>
                  <span className="block text-[10px] pt-1 border-t border-slate-800">
                    {open ? (
                      <span className="text-emerald-400 font-bold inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {t('Unlocked')}</span>
                    ) : target ? (
                      <span className="text-amber-400 font-bold inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {t('Next')}</span>
                    ) : (
                      <span className="text-slate-500 inline-flex items-center gap-1"><Lock className="w-3 h-3" /> {t('Locked')}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};

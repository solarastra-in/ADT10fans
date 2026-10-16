import React, { useMemo, useState } from 'react';
import { Gift, ShieldCheck, Ticket, Shirt, Sparkles, Search } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Button, Card, Countdown, EmptyState, ErrorBox, Modal, Notice, PageHeader, Pill, SectionTitle, Spinner, StatTile, cx, useFormat } from '../components/ui';
import { TieredRewardDashboard } from '../components/TieredRewardDashboard';
import type { PrizeDraw, PrizeItem } from '../types';

export default function PrizesPage() {
  const { user, openAuth, setUser, toast, teamById, config } = useApp();
  const t = useT();
  const f = useFormat();
  usePageMeta(t('Prizes and prize draws'), t('Spend your fan points on rewards and enter free prize draws with a verifiable result.'), config?.brandName);
  const prizes = useLoad(() => api.getPrizes(), [user?.id]);
  const draws = useLoad(() => api.getDraws(), [user?.id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<{ code: string; fulfilment: string; title: string } | null>(null);
  const [verify, setVerify] = useState<PrizeDraw | null>(null);
  const [category, setCategory] = useState<'all' | 'tickets' | 'tshirts' | 'bats' | 'signed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const redeem = async (p: PrizeItem) => {
    if (!user) return openAuth(t('Sign in to claim prizes with your points.'));
    if (!confirm(t('Spend {n} points on "{title}"?', { n: p.pointsCost, title: p.title }))) return;
    setBusy(p.id);
    try {
      const r = await api.redeemPrize(p.id);
      setUser(r.user);
      setClaimed({ code: r.redemption.code, fulfilment: r.fulfilment, title: p.title });
      prizes.reload();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const enter = async (d: PrizeDraw) => {
    if (!user) return openAuth(t('Sign in to enter prize draws.'));
    setBusy(d.id);
    try {
      const r = await api.enterDraw(d.id);
      toast(r.message);
      draws.reload();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const balance = prizes.data?.balance ?? user?.balance ?? 0;
  const activePrizes = prizes.data?.prizes || [];
  const allDraws = draws.data?.draws || [];

  const ticketsCount = useMemo(() => activePrizes.filter(p => p.title.toLowerCase().includes('ticket')).length, [activePrizes]);
  const tshirtsCount = useMemo(() => activePrizes.filter(p => p.title.toLowerCase().includes('t-shirt') || p.title.toLowerCase().includes('jersey')).length, [activePrizes]);
  const signedCount = useMemo(() => activePrizes.filter(p => p.title.toLowerCase().includes('signed')).length, [activePrizes]);
  const batsCount = useMemo(() => activePrizes.filter(p => p.title.toLowerCase().includes('bat')).length, [activePrizes]);

  const filteredPrizes = useMemo(() => {
    return activePrizes.filter(p => {
      const titleLower = p.title.toLowerCase();
      if (category === 'tickets' && !titleLower.includes('ticket')) return false;
      if (category === 'tshirts' && !titleLower.includes('t-shirt') && !titleLower.includes('jersey')) return false;
      if (category === 'bats' && !titleLower.includes('bat')) return false;
      if (category === 'signed' && !titleLower.includes('signed')) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return titleLower.includes(q) || p.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [activePrizes, category, searchQuery]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t('Rewards')} title={t('Prizes & draws')} subtitle={t('Claim rewards with the points you earn, and enter free prize draws. Spending points never lowers your leaderboard score.')} />
      {user && (
        <div className="grid grid-cols-3 gap-2">
          <StatTile label={t('Points to spend')} value={balance} accent />
          <StatTile label={t('Season points')} value={user.points} />
          <StatTile label={t('Prizes claimed')} value={(prizes.data?.myRedemptions || []).filter(r => r.status !== 'cancelled').length} />
        </div>
      )}

      {/* Tiered Reward System Dashboard */}
      <TieredRewardDashboard
        user={user}
        balance={balance}
        prizes={activePrizes}
        selectedCategory={category}
        onSelectCategory={setCategory}
        onOpenAuth={() => openAuth(t('Sign in to claim prizes with your points.'))}
      />

      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <SectionTitle title={t('Rewards')} />
          {/* Search bar */}
          {activePrizes.length > 0 && (
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tickets, shirts, signed bats..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          )}
        </div>

        {/* Category Filters */}
        {activePrizes.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={cx('px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer', category === 'all' ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800')}
            >
              All ({activePrizes.length})
            </button>
            {ticketsCount > 0 && (
              <button
                type="button"
                onClick={() => setCategory('tickets')}
                className={cx('flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer', category === 'tickets' ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800')}
              >
                <Ticket className="w-3.5 h-3.5" /> Match Tickets ({ticketsCount})
              </button>
            )}
            {signedCount > 0 && (
              <button
                type="button"
                onClick={() => setCategory('signed')}
                className={cx('flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer', category === 'signed' ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800')}
              >
                <Sparkles className="w-3.5 h-3.5" /> Signed Memorabilia ({signedCount})
              </button>
            )}
            {tshirtsCount > 0 && (
              <button
                type="button"
                onClick={() => setCategory('tshirts')}
                className={cx('flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer', category === 'tshirts' ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800')}
              >
                <Shirt className="w-3.5 h-3.5" /> T-Shirts & Jerseys ({tshirtsCount})
              </button>
            )}
            {batsCount > 0 && (
              <button
                type="button"
                onClick={() => setCategory('bats')}
                className={cx('flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer', category === 'bats' ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800')}
              >
                🏏 Bats ({batsCount})
              </button>
            )}
          </div>
        )}

        {prizes.loading && !prizes.data ? (
          <Spinner />
        ) : prizes.error ? (
          <ErrorBox message={prizes.error} onRetry={prizes.reload} />
        ) : filteredPrizes.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPrizes.map(p => {
              const left = Math.max(0, p.stock - (p.claimed || 0));
              const mine = (prizes.data?.myRedemptions || []).some(r => r.prizeId === p.id && r.status !== 'cancelled');
              const locked = p.teamOnly && user?.teamId !== p.teamOnly;
              const isTicket = p.title.toLowerCase().includes('ticket');
              const isSigned = p.title.toLowerCase().includes('signed');
              const isBat = p.title.toLowerCase().includes('bat');
              return (
                <Card key={p.id} className="overflow-hidden flex flex-col relative" data-testid="prize-card">
                  {p.image && <img src={p.image} alt="" className="w-full aspect-video object-cover bg-slate-800" loading="lazy" />}
                  <div className="p-4 flex-1 flex flex-col gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isTicket && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-300 bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 rounded-md">
                          <Ticket className="w-3 h-3 text-amber-400" /> Matchday Pass
                        </span>
                      )}
                      {isSigned && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                          <Sparkles className="w-3 h-3 text-emerald-400" /> Signed Edition
                        </span>
                      )}
                      {isBat && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                          🏏 Willow Bat
                        </span>
                      )}
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-black text-white break-words text-sm sm:text-base leading-snug">{p.title}</h3>
                      <Pill tone="amber">{t('{n} pts', { n: p.pointsCost })}</Pill>
                    </div>
                    {p.description && <p className="text-xs text-slate-400 break-words leading-relaxed">{p.description}</p>}
                    <div className="mt-auto pt-2 flex items-center justify-between text-xs">
                      {p.teamOnly ? (
                        <span className="text-[11px] font-bold text-amber-400/90">{t('For {team} fans', { team: teamById(p.teamOnly)?.name || '' })}</span>
                      ) : (
                        <span className="text-[11px] text-slate-500">All fans</span>
                      )}
                      <span className="text-[11px] text-slate-400">{left > 0 ? t('{n} left', { n: left }) : t('All claimed')}</span>
                    </div>
                    <Button className="mt-2 w-full" disabled={mine || left <= 0 || Boolean(locked) || (Boolean(user) && balance < p.pointsCost)} loading={busy === p.id} onClick={() => redeem(p)}>
                      {mine ? t('Claimed') : left <= 0 ? t('All claimed') : user && balance < p.pointsCost ? t('{n} more points needed', { n: p.pointsCost - balance }) : t('Claim')}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<Gift className="w-6 h-6" />} title={t('Rewards are on the way')} body={t('Keep earning points: everything you earn now can be spent once rewards are added.')} action={<Link to="/play" className="text-sm font-bold text-amber-400">{t('Earn points')} →</Link>} />
        )}
      </section>

      {(prizes.data?.myRedemptions || []).length > 0 && (
        <section>
          <SectionTitle title={t('My claims')} />
          <Card className="divide-y divide-slate-800">
            {prizes.data!.myRedemptions.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <Ticket className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-white truncate">{r.prizeTitle}</span>
                  <span className="block text-[11px] text-slate-500">{t('Code')} <span className="font-mono text-slate-300">{r.code}</span> · {f.date(r.createdAt)}</span>
                </span>
                <Pill tone={r.status === 'fulfilled' ? 'green' : r.status === 'cancelled' ? 'red' : 'amber'}>{t(r.status === 'pending' ? 'Pending' : r.status === 'fulfilled' ? 'Fulfilled' : 'Cancelled')}</Pill>
              </div>
            ))}
          </Card>
        </section>
      )}

      <section>
        <SectionTitle title={t('Prize draws')} />
        {draws.loading && !draws.data ? (
          <Spinner />
        ) : allDraws.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allDraws.map(d => (
              <Card key={d.id} className="p-4 space-y-2 relative overflow-hidden" data-testid="draw-card">
                <div className="absolute inset-x-0 top-0 h-1" style={{ background: d.color }} />
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-black text-white break-words">{d.title}</h3>
                  <Pill tone={d.status === 'open' ? 'amber' : d.status === 'drawn' ? 'green' : 'slate'}>{d.status === 'open' ? t('Open') : d.status === 'drawn' ? t('Drawn') : t('Closed')}</Pill>
                </div>
                <p className="text-sm font-bold text-amber-300">🎁 {d.prize}</p>
                {d.description && <p className="text-sm text-slate-400 break-words">{d.description}</p>}
                <p className="text-xs text-slate-500">
                  {t('{n} entries', { n: d.entriesCount || 0 })}
                  {d.teamOnly ? ` · ${t('For {team} fans', { team: teamById(d.teamOnly)?.name || '' })}` : ''}
                  {d.minPoints ? ` · ${t('{n}+ season points', { n: d.minPoints })}` : ''}
                  {d.status === 'open' && <> · <Countdown to={d.closesAt} prefix="closes in {time}" /></>}
                </p>
                {d.status === 'drawn' ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className={cx('text-sm font-bold', d.wonByMe ? 'text-emerald-300' : 'text-slate-200')}>{d.wonByMe ? t('You won! Check your notifications.') : t('Winner: {name}', { name: d.winnerName || '' })}</p>
                    <Button size="sm" variant="ghost" onClick={() => setVerify(d)}>
                      <ShieldCheck className="w-4 h-4" /> {t('Verify')}
                    </Button>
                  </div>
                ) : d.entered ? (
                  <Notice tone="success">{t('You are in this draw. Good luck!')}</Notice>
                ) : d.status === 'open' ? (
                  <Button className="w-full" loading={busy === d.id} onClick={() => enter(d)}>
                    {t('Enter for free')}
                  </Button>
                ) : null}
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Ticket className="w-6 h-6" />} title={t('No prize draws right now')} body={t('Draws are announced here and in your notifications.')} />
        )}
      </section>

      <Modal open={Boolean(claimed)} onClose={() => setClaimed(null)} title={t('Prize claimed')}>
        {claimed && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-slate-300">{claimed.title}</p>
            <p className="text-3xl font-black font-mono tracking-widest text-amber-300" data-testid="claim-code">{claimed.code}</p>
            <Notice>{claimed.fulfilment}</Notice>
            <p className="text-xs text-slate-500">{t('Your code is also saved under My claims.')}</p>
          </div>
        )}
      </Modal>
      <Modal open={Boolean(verify)} onClose={() => setVerify(null)} title={t('How this draw was decided')}>
        {verify && (
          <div className="space-y-3 text-sm text-slate-300">
            <p>{t('Everyone who entered is sorted by account id and the list is hashed (SHA-256). A random seed is generated at draw time. The winner is entry number int(first 8 hex characters of sha256(seed + ":" + entrants hash)) mod number of entries.')}</p>
            <dl className="space-y-2 text-xs">
              <div><dt className="text-slate-500">{t('Seed')}</dt><dd className="font-mono break-all text-slate-200">{verify.verification?.seed}</dd></div>
              <div><dt className="text-slate-500">{t('Entrants hash')}</dt><dd className="font-mono break-all text-slate-200">{verify.verification?.entrantsHash}</dd></div>
              <div><dt className="text-slate-500">{t('Entries')}</dt><dd className="text-slate-200">{verify.verification?.entries}</dd></div>
              <div><dt className="text-slate-500">{t('Drawn')}</dt><dd className="text-slate-200">{f.dateTime(verify.drawnAt)}</dd></div>
            </dl>
          </div>
        )}
      </Modal>
    </div>
  );
}

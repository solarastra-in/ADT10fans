import React, { useMemo, useState } from 'react';
import { Gift, ShieldCheck, Ticket, Shirt, Sparkles, Search, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Button, Card, Countdown, EmptyState, ErrorBox, Modal, Notice, PageHeader, Pill, SectionTitle, Spinner, StatTile, TeamBadge, cx, useFormat } from '../components/ui';
import { TieredRewardDashboard } from '../components/TieredRewardDashboard';
import { LevelUpCelebration } from '../components/LevelUpCelebration';
import type { PrizeDraw, PrizeItem } from '../types';

export default function PrizesPage() {
  const { user, openAuth, setUser, toast, teamById, config } = useApp();
  const t = useT();
  const f = useFormat();
  usePageMeta(t('Prizes and prize draws'), t('Spend your fan points on rewards and enter free prize draws with a verifiable result.'), config?.brandName);
  const prizes = useLoad(() => api.getPrizes(), [user?.id]);
  const draws = useLoad(() => api.getDraws(), [user?.id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmPrize, setConfirmPrize] = useState<PrizeItem | null>(null);
  const [claimed, setClaimed] = useState<{ code: string; fulfilment: string; title: string; prize?: PrizeItem } | null>(null);
  const [verify, setVerify] = useState<PrizeDraw | null>(null);
  const [category, setCategory] = useState<'all' | 'tickets' | 'tshirts' | 'bats' | 'signed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleClaimClick = (p: PrizeItem) => {
    if (!user) return openAuth(t('Sign in to claim prizes with your points.'));
    setConfirmPrize(p);
  };

  const executeRedeem = async () => {
    if (!confirmPrize) return;
    const p = confirmPrize;
    setBusy(p.id);
    try {
      const r = await api.redeemPrize(p.id);
      setUser(r.user);
      setClaimed({ code: r.redemption.code, fulfilment: r.fulfilment, title: p.title, prize: p });
      setConfirmPrize(null);
      prizes.reload();
      toast(t('Reward claimed successfully!'), 'success');
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

  const dailyUsed = (prizes.data as any)?.limits?.dailyClaimsUsed ?? 0;
  const dailyRemaining = Math.max(0, 2 - dailyUsed);

  return (
    <div className="space-y-8">
      {/* Header with Official ADT10 and Franchise Logos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <img
            src="/logos/adt10.png"
            alt="Abu Dhabi T10"
            className="w-12 h-12 object-contain rounded-2xl p-1 bg-slate-950 border border-amber-400/40 shadow-lg shadow-amber-500/20 shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full">
                Abu Dhabi T10 Official Rewards
              </span>
              <img
                src="/logos/aces.svg"
                alt="Arabian Aces"
                className="w-4 h-4 object-contain inline-block"
                title="Arabian Aces Franchise"
              />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
              {t('Prizes & draws')}
            </h1>
          </div>
        </div>
        <p className="text-xs text-slate-400 max-w-md">
          {t('Claim rewards with the points you earn, and enter free prize draws. Spending points never lowers your leaderboard score.')}
        </p>
      </div>

      {user && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatTile label={t('Points to spend')} value={balance} accent />
            <StatTile label={t('Season points')} value={user.points} />
            <StatTile label={t('Claims today')} value={`${dailyUsed} / 2`} />
            <StatTile label={t('Total claimed')} value={(prizes.data?.myRedemptions || []).filter(r => r.status !== 'cancelled').length} />
          </div>
          <div className="px-3.5 py-2.5 rounded-2xl bg-slate-900/80 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Anti-Misuse Policy:</strong> Verified points balance only, max 2 claims/day, 1 ticket per match fixture.
              </span>
            </div>
            <span className="text-[11px] font-mono font-bold text-amber-300 shrink-0">
              {dailyRemaining} claim{dailyRemaining === 1 ? '' : 's'} remaining today
            </span>
          </div>
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
                placeholder="Search tickets, shirts, miniature signed bats..."
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
              // The team stamp: the franchise offering the prize, or whose fans it is for.
              const team = p.teamOnly || p.teamId ? teamById((p.teamOnly || p.teamId)!) : null;

              return (
                <Card key={p.id} className="overflow-hidden flex flex-col relative" data-testid="prize-card">
                  {p.image && <img src={p.image} alt="" className="w-full aspect-video object-cover bg-slate-800" loading="lazy" />}
                  <div className="p-4 flex-1 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
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
                            🏏 Miniature Bat
                          </span>
                        )}
                      </div>
                      {/* Authentic Logo Stamp */}
                      {team ? (
                        <div className="flex items-center gap-1 bg-slate-950/80 px-1.5 py-0.5 rounded-lg border border-slate-800">
                          <TeamBadge team={team} size="sm" />
                          <span className="text-[10px] font-black text-white">{team.short}</span>
                        </div>
                      ) : (
                        <img
                          src="/logos/adt10.png"
                          alt="ADT10"
                          className="w-5 h-5 object-contain rounded p-0.5 bg-slate-950 border border-slate-800"
                        />
                      )}
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-black text-white break-words text-sm sm:text-base leading-snug">{p.title}</h3>
                      <Pill tone="amber">{t('{n} pts', { n: p.pointsCost })}</Pill>
                    </div>

                    {p.description && <p className="text-xs text-slate-400 break-words leading-relaxed">{p.description}</p>}

                    <div className="mt-auto pt-2 flex items-center justify-between text-xs">
                      {team ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <TeamBadge team={team} size="sm" />
                          <span className="text-[11px] font-bold text-amber-400/90 truncate">{t('For {team} fans', { team: team.name })}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <img src="/logos/adt10.png" alt="ADT10" className="w-4 h-4 object-contain rounded bg-slate-900 border border-slate-800 shrink-0" />
                          <span className="text-[11px] text-slate-400 font-medium">All Abu Dhabi T10 Fans</span>
                        </div>
                      )}
                      <span className="text-[11px] text-slate-400 shrink-0 font-medium">{left > 0 ? t('{n} left', { n: left }) : t('All claimed')}</span>
                    </div>

                    <Button
                      className="mt-2 w-full"
                      disabled={mine || left <= 0 || Boolean(locked) || (Boolean(user) && balance < p.pointsCost) || dailyRemaining <= 0}
                      loading={busy === p.id}
                      onClick={() => handleClaimClick(p)}
                    >
                      {mine
                        ? t('Claimed')
                        : left <= 0
                        ? t('All claimed')
                        : user && balance < p.pointsCost
                        ? t('{n} more points needed', { n: p.pointsCost - balance })
                        : dailyRemaining <= 0
                        ? t('Daily limit reached (2/2)')
                        : t('Claim')}
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
                  <span className="block text-xs font-mono text-amber-300">{r.code}</span>
                  <span className="block text-[11px] text-slate-500">{f.dateTime(r.createdAt)}</span>
                </span>
                <Pill tone={r.status === 'fulfilled' ? 'green' : r.status === 'cancelled' ? 'red' : 'amber'}>
                  {t(r.status)}
                </Pill>
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* Prize Draws Section */}
      <section className="space-y-4">
        <SectionTitle title={t('Free prize draws')} />
        {draws.loading && !draws.data ? (
          <Spinner />
        ) : draws.error ? (
          <ErrorBox message={draws.error} onRetry={draws.reload} />
        ) : allDraws.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allDraws.map(d => {
              const team = d.teamOnly ? teamById(d.teamOnly) : null;
              return (
                <Card key={d.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-white break-words">{d.title}</h3>
                    <Pill tone={d.status === 'drawn' ? 'slate' : 'green'}>{t(d.status)}</Pill>
                  </div>
                  {d.description && <p className="text-xs text-slate-400 break-words">{d.description}</p>}
                  <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 pt-1">
                    {team ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                        <TeamBadge team={team} size="sm" />
                        <span>{team.name}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <img src="/logos/adt10.png" alt="ADT10" className="w-4 h-4 object-contain rounded bg-slate-900 border border-slate-800" />
                        <span>ADT10 League</span>
                      </span>
                    )}
                    <span>· {t('{n} entries', { n: d.entriesCount ?? 0 })}</span>
                    {d.status === 'open' && <> · <Countdown to={d.closesAt} prefix="closes in {time}" /></>}
                  </div>
                  {d.status === 'drawn' ? (
                    <div className="flex items-center justify-between gap-2">
                      <p className={cx('text-sm font-bold', d.wonByMe ? 'text-emerald-300' : 'text-slate-200')}>
                        {d.wonByMe ? t('You won! Check your notifications.') : t('Winner: {name}', { name: d.winnerName || '' })}
                      </p>
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
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<Ticket className="w-6 h-6" />} title={t('No prize draws right now')} body={t('Draws are announced here and in your notifications.')} />
        )}
      </section>

      {/* Anti-Misuse Fair Play Claim Confirmation Modal */}
      <Modal open={Boolean(confirmPrize)} onClose={() => setConfirmPrize(null)} title="Confirm Reward Redemption" wide>
        {confirmPrize && (
          <div className="space-y-4 text-slate-300 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-3">
              {confirmPrize.teamOnly && teamById(confirmPrize.teamOnly) ? (
                <TeamBadge team={teamById(confirmPrize.teamOnly)} size="md" />
              ) : (
                <img
                  src="/logos/adt10.png"
                  alt="Abu Dhabi T10"
                  className="w-12 h-12 object-contain rounded-2xl p-1 bg-slate-900 border border-amber-400/40 shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-black text-white truncate">{confirmPrize.title}</h4>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{confirmPrize.description}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono font-bold text-amber-400 text-sm">
                    {confirmPrize.pointsCost} points
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-400">Inventory: {confirmPrize.stock} total</span>
                </div>
              </div>
            </div>

            {/* Anti-Misuse Guarantees */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center gap-1.5 text-amber-300 font-black text-xs uppercase tracking-wide">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Anti-Misuse & Fair Access Policy
              </div>
              <ul className="space-y-1.5 text-slate-300 text-[11px] list-disc list-inside">
                <li><strong>Verified Points Audit:</strong> Points are validated directly against your official match and game activity ledger in Firebase.</li>
                <li><strong>Hoarding Protection:</strong> Strictly 1 match ticket per fan per fixture, and maximum 2 total claims per 24 hours.</li>
                <li><strong>Identity & Security:</strong> An 8-character cryptographic verification voucher code will be generated and assigned to your account.</li>
                <li><strong>Non-Transferable:</strong> Redemptions cannot be transferred or sold; valid ID matching your account name is required at stadium turnstiles.</li>
              </ul>
            </div>

            {/* Points Balance Calculation */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-center font-mono">
              <div>
                <span className="block text-[10px] text-slate-500 font-sans uppercase">Current Balance</span>
                <span className="text-sm font-bold text-white">{balance} pts</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 font-sans uppercase">Cost</span>
                <span className="text-sm font-bold text-red-400">-{confirmPrize.pointsCost} pts</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 font-sans uppercase">Remaining</span>
                <span className="text-sm font-bold text-emerald-400">{balance - confirmPrize.pointsCost} pts</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmPrize(null)}
                disabled={Boolean(busy)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 font-bold"
                loading={Boolean(busy)}
                onClick={executeRedeem}
              >
                Confirm & Spend Points
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Level-Up Celebration & Claimed Voucher Modal */}
      <LevelUpCelebration
        open={Boolean(claimed)}
        onClose={() => setClaimed(null)}
        prizeTitle={claimed?.title || ''}
        pointsSpent={claimed?.prize?.pointsCost || 0}
        voucherCode={claimed?.code || ''}
        fulfilment={claimed?.fulfilment}
        team={claimed?.prize?.teamOnly ? teamById(claimed.prize.teamOnly) : null}
        userPoints={user?.points || 0}
        userBalance={balance}
      />

      {/* Draw Verification Modal */}
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

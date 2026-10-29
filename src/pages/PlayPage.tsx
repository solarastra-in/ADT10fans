import React from 'react';
import { Calendar, CheckCircle2, ChevronRight, Flame, Gamepad2, Gift, Sparkles, Swords, Target, Trophy, Users } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Card, Countdown, PageHeader, Pill, StatTile, TeamBadge, cx, useFormat } from '../components/ui';
import { FanClubCheckInCard } from '../components/FanClubCheckInCard';

export default function PlayPage() {
  const { user, config, teamById } = useApp();
  const t = useT();
  const f = useFormat();
  usePageMeta(t('Play: Pick XI, daily games and predictions'), t('Free games for Abu Dhabi T10 fans. Earn points for your team.'), config?.brandName);

  const hub = useLoad(() => api.getFantasyHub(), [user?.id]);
  const games = useLoad(() => api.getGamesToday(), [user?.id]);
  const contests = useLoad(() => api.getContests(), [user?.id]);

  const openMatches = (hub.data?.matches || []).filter(m => !m.locked);
  const firstDate = openMatches[0]?.startsAt ? openMatches[0].startsAt.slice(0, 10) : null;
  const activeDayMatches = openMatches.filter(m => m.startsAt.slice(0, 10) === firstDate);

  const openContests = (contests.data?.contests || []).filter(c => c.status === 'open');
  const myEntries = new Set((contests.data?.myEntries || []).map(e => e.contestId));
  const gamesLeft = games.data ? Number(!games.data.guess.finished) + Number(!games.data.superOver.finished) : 2;

  const card = (to: string, Icon: any, title: string, body: React.ReactNode, cta: string, testid: string) => (
    <Link to={to} className="block group" data-testid={testid}>
      <Card className="p-5 h-full hover:border-amber-400/50 transition-colors flex flex-col bg-slate-900/90">
        <Icon className="w-7 h-7 text-amber-400 group-hover:scale-110 transition-transform" />
        <h2 className="mt-3 text-lg font-black text-white group-hover:text-amber-300 transition-colors">{title}</h2>
        <div className="text-sm text-slate-400 mt-1 flex-1">{body}</div>
        <span className="mt-4 text-sm font-black text-amber-400 flex items-center gap-1">
          {cta} <ChevronRight className="w-4 h-4" />
        </span>
      </Card>
    </Link>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <PageHeader
        eyebrow={t('Free to play')}
        title={t('Play & Earn')}
        subtitle={t('Draft Pick XI lineups, enter match predictions, and compete in daily games for all 2 or 3 matches scheduled every day.')}
      />

      {user && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatTile label={t('Season points')} value={user.points} accent />
          <StatTile label={t('To spend on prizes')} value={user.balance ?? user.points} />
          <StatTile label={t('Pick XI points')} value={hub.data?.season?.points ?? 0} />
          <StatTile label={t('Check-in streak')} value={t('{n} days', { n: user.streak || 0 })} />
        </div>
      )}

      {/* Matchday Multi-Game Arena: Play All 2 or 3 Matches of the Day Simultaneously */}
      {activeDayMatches.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" />
                  {activeDayMatches.length === 3 ? t('Matchday Triple-Header') : t('Matchday Double-Header')}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {f.date(activeDayMatches[0].startsAt, { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              </div>
              <h2 className="text-xl font-black text-white mt-1">
                {t('Play All {n} Matches Scheduled Today Simultaneously', { n: activeDayMatches.length })}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('Pick XI and match predictions open 24 hours before match day. You can play and edit all matches at the same time until the first ball.')}
              </p>
            </div>
            <Link
              to="/fantasy"
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 self-start sm:self-auto shrink-0"
            >
              {t('View all tournament fixtures')} →
            </Link>
          </div>

          <div className={cx('grid gap-3', activeDayMatches.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2')}>
            {activeDayMatches.map(m => {
              const teamA = teamById(m.teamA);
              const teamB = teamById(m.teamB);
              const matchingContest = openContests.find(c => c.matchId === m.matchId || c.title.includes(`Match ${m.matchNo}:`));
              const enteredPrediction = matchingContest ? myEntries.has(matchingContest.id) : false;

              return (
                <Card key={m.matchId} className="p-4 flex flex-col justify-between border-slate-800 bg-slate-900/90 hover:border-amber-400/50 transition-colors shadow-lg">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                        {t('Match {n}', { n: m.matchNo })}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400">
                        <Countdown to={m.startsAt} prefix="locks in {time}" />
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <TeamBadge team={teamA} size="sm" />
                        <span className="text-xs font-black text-white truncate">{teamA?.short || m.teamA}</span>
                      </div>
                      <span className="text-[11px] font-black text-amber-400 uppercase">vs</span>
                      <div className="flex items-center gap-2 min-w-0 justify-end">
                        <span className="text-xs font-black text-white truncate">{teamB?.short || m.teamB}</span>
                        <TeamBadge team={teamB} size="sm" />
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center justify-between mb-3 px-1">
                      <span>🕒 {f.time(m.startsAt)} GST</span>
                      <span>👥 {m.lineups} {t('teams')}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <Link
                      to={`/fantasy/${m.matchId}`}
                      className={cx(
                        'w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black transition-colors',
                        m.mine?.saved
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25'
                          : 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-md',
                      )}
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      <span>{m.mine?.saved ? t('✓ XI Saved ({n} teams)', { n: m.mine.variationsCount || 1 }) : t('Draft Pick XI (100 Cr)')}</span>
                    </Link>

                    <Link
                      to={matchingContest ? `/contests` : `/matches/${m.matchId}`}
                      className={cx(
                        'w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-colors border',
                        enteredPrediction
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                          : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-amber-400/50 hover:text-white',
                      )}
                    >
                      <Target className="w-3.5 h-3.5 text-amber-400" />
                      <span>{enteredPrediction ? t('✓ Predictions Saved') : t('Predict & Win (+140 pts)')}</span>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Game Portals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {card(
          '/fantasy',
          Trophy,
          t('Pick XI Fantasy'),
          t('Draft 11 players within 100 credits for any match in the tournament. Create up to 4 lineup variations (Stars, Balanced, Bowling, Contrarian). Captain scores 2x.'),
          t('Open Pick XI arena'),
          'play-fantasy',
        )}
        {card(
          '/games',
          Gamepad2,
          t('Daily Arcade & Duels'),
          games.data
            ? t('{n} of 2 daily games available today. Play Guess the Player, Super Over, and challenge friends to Stat Wars & Connections.', { n: gamesLeft })
            : t('Super Over, Guess the Player, Stat Wars, and 1v1 Duels.'),
          t('Play daily games'),
          'play-games',
        )}
        {card(
          '/contests',
          Target,
          t('Match Predictions'),
          openContests.length
            ? t('{n} prediction contests open · you have entered {m}. Predict winners, powerplay runs, and sixes milestones for every fixture.', {
                n: openContests.length,
                m: openContests.filter(c => myEntries.has(c.id)).length,
              })
            : t('Match predictions for all double and triple-headers open 24 hours before match day.'),
          t('Make predictions'),
          'play-contests',
        )}
        {card(
          '/prizes',
          Gift,
          t('Rewards & Prize Vault'),
          t('Redeem your points for Miniature Signed Bats of international players, signed jerseys, matchday ticket packages, and prize draw entries.'),
          t('Browse rewards vault'),
          'play-prizes',
        )}
      </div>

      {/* Matchday Fan Club Check-in Pass */}
      <FanClubCheckInCard />

      {/* How to Earn Points Guide */}
      <Card className="p-5 border-slate-800">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-400" />
          <h2 className="font-black text-white">{t('How You Earn Fan Points')}</h2>
        </div>
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-300">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>{t('Pick XI: Fantasy points ÷ 5 for all matches entered')}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>{t('Match Predictions: Up to 140 pts per match')}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>{t('Guess the Player: 10–50 pts daily mystery player')}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>{t('Super Over: Your score runs + 15 pts win bonus')}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>{t('Daily Streak: 10–50 pts every check-in')}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>{t('Invites: {n} pts for each friend invited', { n: config?.referralRewardPoints ?? 50 })}</span>
          </li>
        </ul>
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500">{t('All points accumulate for your profile and your supported franchise in Fan Wars.')}</span>
          <Link to="/rules" className="text-xs font-bold text-amber-400 hover:text-amber-300">
            {t('Full scoring rules')} →
          </Link>
        </div>
      </Card>
    </div>
  );
}

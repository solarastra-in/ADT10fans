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
  const f = useFormat();
  // Every match that is open now (today's and tomorrow's: each opens at midnight UAE time the day before).
  const openMatches = (hub.data?.matches || []).filter(m => !m.locked && m.open !== false);
  const nextMatch = openMatches[0];
  const nextToOpen = (hub.data?.matches || []).find(m => !m.locked && m.open === false);
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
      {(openMatches.length > 0 || nextToOpen) && (
        <section data-testid="open-matches">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-2">{t('Open matches')}</h2>
          {openMatches.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {openMatches.map(m => {
                const a = teamById(m.teamA);
                const b = teamById(m.teamB);
                const contestId = `auto-${m.matchId}`;
                const hasPredictions = (contests.data?.contests || []).some(c => c.id === contestId && c.status === 'open');
                return (
                  <Card key={m.matchId} className="p-4 space-y-3" data-testid="open-match">
                    <div className="flex items-center gap-2">
                      <TeamBadge team={a} size="sm" />
                      <span className="font-black text-white text-sm truncate">{a?.short} vs {b?.short}</span>
                      <TeamBadge team={b} size="sm" />
                      <span className="ms-auto text-[11px] text-slate-400">{t('Match {n}', { n: m.matchNo })}</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {f.dateTime(m.startsAt)} · <Countdown to={m.startsAt} prefix="locks in {time}" />
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/fantasy/${m.matchId}`} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 text-slate-950 px-3 py-2 text-xs font-black hover:bg-amber-300">
                        <Trophy className="w-3.5 h-3.5" /> {m.mine?.saved ? t('Edit Pick XI') : t('Pick your XI')}
                      </Link>
                      {hasPredictions && (
                        <Link to={`/contests#${contestId}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs font-black text-white hover:bg-slate-800">
                          <Target className="w-3.5 h-3.5" /> {myEntries.has(contestId) ? t('Edit predictions') : t('Predict')}
                        </Link>
                      )}
                      {m.mine?.saved && <Pill tone="green">{t('Team saved')}</Pill>}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : null}
          {nextToOpen && (
            <p className="mt-2 text-xs text-slate-400">
              {t('Next to open: {a} vs {b} on {date}. Each match opens at midnight UAE time on the day before match day.', { a: teamById(nextToOpen.teamA)?.short || '', b: teamById(nextToOpen.teamB)?.short || '', date: f.dateTime(nextToOpen.opensAt) })}
            </p>
          )}
        </section>
      )}
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

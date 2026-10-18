import React from 'react';
import { Gamepad2, Gift, Target, Trophy, Users } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Card, Countdown, PageHeader, StatTile, TeamBadge } from '../components/ui';

export default function PlayPage() {
  const { user, config, teamById } = useApp();
  const t = useT();
  usePageMeta(t('Play: Dream XI, daily games and predictions'), t('Free games for Abu Dhabi T10 fans. Earn points for your team.'), config?.brandName);
  const hub = useLoad(() => api.getFantasyHub(), [user?.id]);
  const games = useLoad(() => api.getGamesToday(), [user?.id]);
  const contests = useLoad(() => api.getContests(), [user?.id]);
  const nextMatch = hub.data?.matches.find(m => !m.locked);
  const openContests = (contests.data?.contests || []).filter(c => c.status === 'open');
  const myEntries = new Set((contests.data?.myEntries || []).map(e => e.contestId));
  const gamesLeft = games.data ? Number(!games.data.guess.finished) + Number(!games.data.superOver.finished) : 2;

  const card = (to: string, Icon: any, title: string, body: React.ReactNode, cta: string, testid: string) => (
    <Link to={to} className="block" data-testid={testid}>
      <Card className="p-5 h-full hover:border-amber-400/50 transition-colors flex flex-col">
        <Icon className="w-7 h-7 text-amber-400" />
        <h2 className="mt-3 text-lg font-black text-white">{title}</h2>
        <div className="text-sm text-slate-400 mt-1 flex-1">{body}</div>
        <span className="mt-4 text-sm font-black text-amber-400">{cta} →</span>
      </Card>
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t('Free to play')} title={t('Play')} subtitle={t('Every game earns season points. Your points also count for the team you back in Fan Wars.')} />
      {user && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatTile label={t('Season points')} value={user.points} accent />
          <StatTile label={t('To spend on prizes')} value={user.balance ?? user.points} />
          <StatTile label={t('Dream XI points')} value={hub.data?.season?.points ?? 0} />
          <StatTile label={t('Check-in streak')} value={t('{n} days', { n: user.streak || 0 })} />
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {card(
          nextMatch ? `/fantasy/${nextMatch.matchId}` : '/fantasy',
          Trophy,
          t('Dream XI'),
          nextMatch ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <TeamBadge team={teamById(nextMatch.teamA)} size="sm" />
                <span className="font-bold text-white text-xs">{teamById(nextMatch.teamA)?.name}</span>
                <span className="text-amber-400 font-black text-xs">vs</span>
                <TeamBadge team={teamById(nextMatch.teamB)} size="sm" />
                <span className="font-bold text-white text-xs">{teamById(nextMatch.teamB)?.name}</span>
              </div>
              <div className="text-xs text-slate-400">
                <Countdown to={nextMatch.startsAt} prefix="locks in {time}" />
              </div>
              {nextMatch.mine?.saved && <span className="block text-emerald-400 font-bold mt-0.5">{t('Your team is saved')}</span>}
            </div>
          ) : (
            t('Pick 11 players for each match within 100 credits. Captain scores double.')
          ),
          nextMatch?.mine?.saved ? t('Edit team') : t('Pick your XI'),
          'play-fantasy',
        )}
        {card('/games', Gamepad2, t('Daily games'), games.data ? t('{n} of 2 games left today. Guess the Player and Super Over reset at midnight UAE time.', { n: gamesLeft }) : t('Guess the Player and Super Over, new every day.'), t('Play today'), 'play-games')}
        {card('/contests', Target, t('Predictions'), openContests.length ? t('{n} open · you entered {m}', { n: openContests.length, m: openContests.filter(c => myEntries.has(c.id)).length }) : t('Match predictions and quizzes appear here before each game.'), t('Make predictions'), 'play-contests')}
        {card('/prizes', Gift, t('Prizes'), t('Spend points on rewards and enter free prize draws.'), t('See prizes'), 'play-prizes')}
      </div>
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-400" />
          <h2 className="font-black text-white">{t('How you earn points')}</h2>
        </div>
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-slate-300">
          <li>{t('Dream XI: your fantasy points ÷ 5, every match')}</li>
          <li>{t('Guess the Player: 10–50 a day')}</li>
          <li>{t('Super Over: your runs, +15 if you beat the target')}</li>
          <li>{t('Predictions: the points shown on each question')}</li>
          <li>{t('Daily check-in: 10–50, more for longer streaks')}</li>
          <li>{t('Forum: 15 per thread, 5 per reply (up to 50 a day)')}</li>
          <li>{t('Badges: claim bonus points from your profile')}</li>
          <li>{t('Invites: {n} each when a friend plays', { n: config?.referralRewardPoints ?? 50 })}</li>
        </ul>
        <Link to="/rules" className="inline-block mt-3 text-sm font-bold text-amber-400">{t('Full rules')} →</Link>
      </Card>
    </div>
  );
}

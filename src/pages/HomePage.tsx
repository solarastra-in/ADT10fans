import React, { useState } from 'react';
import { ArrowRight, CalendarDays, Flame, Gamepad2, Gift, MessageSquare, Target, Trophy, Users, Zap } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Button, ButtonLink, Card, Countdown, EmptyState, SectionTitle, TeamBadge, cx, useFormat } from '../components/ui';
import { MatchCard, sortMatches } from '../components/matches';
import { FeedCard } from '../components/social';
import { InviteCard } from '../components/InviteCard';

export default function HomePage() {
  const { config, user, teams, matches, teamById, openAuth, openTeamPicker, setUser, toast } = useApp();
  const t = useT();
  const f = useFormat();
  usePageMeta(t('{season} fan hub', { season: config?.seasonLabel || 'Abu Dhabi T10' }), t('Live scores, squads, official videos, Pick XI, daily games, predictions and prizes for the Abu Dhabi T10.'), config?.brandName);
  const { live, upcoming, done } = sortMatches(matches);
  const next = [...live, ...upcoming].slice(0, 3);
  const videos = useLoad(() => api.getFeeds({ kind: 'video', limit: 3 }), []);
  const posts = useLoad(() => api.getFeeds({ category: 'social', limit: 6 }), []);
  const threads = useLoad(() => api.getForumThreads({ sort: 'active' }), []);
  const board = useLoad(() => api.getLeaderboard(), [user?.points]);
  const [checking, setChecking] = useState(false);
  const seasonStarted = config ? Date.now() >= +new Date(`${config.seasonStart}T00:00:00+04:00`) : false;
  const checkedToday = user?.lastCheckin && new Date(user.lastCheckin).toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' }) === new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });

  const checkin = async () => {
    setChecking(true);
    try {
      const r = await api.checkin();
      setUser(r.user);
      toast(t('+{n} points. Streak: {s} days', { n: r.pointsAdded, s: r.user.streak }));
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setChecking(false);
    }
  };

  const socialPosts = (posts.data?.items || []).filter(i => i.platform !== 'YouTube').slice(0, 3);

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950 p-5 sm:p-10">
        <div className="absolute -top-24 -end-24 w-72 h-72 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
        <div className="relative max-w-2xl">
          <div className="flex items-center gap-3">
            <img src="/logos/adt10.png" alt="Abu Dhabi T10" className="w-12 h-12 object-contain rounded-2xl p-1 bg-slate-900/90 border border-amber-400/40 shadow-lg shadow-amber-500/20 shrink-0" />
            <p className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-black uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5" /> {config?.seasonLabel} · {t('Official Fan Hub')}
            </p>
          </div>
          <h1 className="mt-3 text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.08]">{t('Ten overs. Every ball counts.')}</h1>
          <p className="mt-3 text-sm sm:text-base text-slate-300">
            {t('{start} – {end} at {venue}.', { start: f.date(config?.seasonStart, { day: 'numeric', month: 'long' }), end: f.date(config?.seasonEnd, { day: 'numeric', month: 'long', year: 'numeric' }), venue: config?.venue || '' })}{' '}
            {!seasonStarted && config && (
              <strong className="text-amber-300">
                <Countdown to={`${config.seasonStart}T00:00:00+04:00`} prefix="Starts in {time}" />
              </strong>
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink to="/fantasy" size="lg">
              <Trophy className="w-5 h-5" /> {t('Play Pick XI')}
            </ButtonLink>
            <ButtonLink to="/games" size="lg" variant="secondary">
              <Gamepad2 className="w-5 h-5" /> {t('Daily games')}
            </ButtonLink>
            {!user && (
              <Button size="lg" variant="outline" onClick={() => openAuth()}>
                {t('Join free')}
              </Button>
            )}
          </div>
        </div>
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
          {[
            [t('Teams'), config?.stats.teams ?? teams.length],
            [t('Players'), config?.stats.players ?? 0],
            [t('Fans'), config?.stats.fans ?? 0],
            [t('Official channels'), config?.stats.handles ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800">
              <div className="text-2xl font-black text-white tabular-nums">{value}</div>
              <div className="text-xs text-slate-400 font-semibold">{label}</div>
            </div>
          ))}
        </div>

        {/* Official 2026 Franchises Logos Strip */}
        <div className="relative mt-8 pt-6 border-t border-white/10">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              {t('Official 2026 Franchises')}
            </span>
            <Link to="/teams" className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1">
              {t('View all squads')} <ArrowRight className="w-3.5 h-3.5 rtl-flip" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {teams.map(tm => (
              <Link
                key={tm.id}
                to={`/teams/${tm.id}`}
                className="group p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-amber-400/50 transition-all flex flex-col items-center text-center gap-2 hover:scale-[1.03]"
              >
                <TeamBadge team={tm} size="md" />
                <div className="w-full min-w-0">
                  <span className="block text-xs font-black text-white group-hover:text-amber-300 truncate">{tm.name}</span>
                  <span className="block text-[10px] text-slate-400 truncate">{tm.iconPlayer || `${tm.squad.length} players`}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {user && !user.teamId && (
        <Card className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 border-amber-400/40 bg-amber-400/5">
          <Users className="w-6 h-6 text-amber-400 shrink-0" />
          <p className="flex-1 text-sm text-slate-200">{t('Back a team: your points count for them in Fan Wars.')}</p>
          <Button onClick={openTeamPicker}>{t('Choose your team')}</Button>
        </Card>
      )}

      {user && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 flex items-center gap-4">
            <span className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Zap className="w-6 h-6" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">{t('Daily check-in')}</p>
              <p className="text-xs text-slate-400">{t('Streak: {n} days · up to 50 points a day', { n: user.streak || 0 })}</p>
            </div>
            <Button onClick={checkin} loading={checking} disabled={Boolean(checkedToday)} data-testid="checkin">
              {checkedToday ? t('Done today') : t('Check in')}
            </Button>
          </Card>
          <InviteCard compact />
        </div>
      )}

      <section>
        <SectionTitle title={live.length ? t('Live now') : t('Next matches')} action={<Link to="/matches" className="text-sm font-bold text-amber-400 inline-flex items-center gap-1">{t('All matches')} <ArrowRight className="w-4 h-4 rtl-flip" /></Link>} />
        {next.length ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {next.map(m => (
              <MatchCard key={m.id} m={m} />
            ))}
          </div>
        ) : done.length ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {done.slice(0, 3).map(m => (
              <MatchCard key={m.id} m={m} />
            ))}
          </div>
        ) : (
          <EmptyState icon={<CalendarDays className="w-6 h-6" />} title={t('Fixtures are not out yet')} body={t('Match times appear here as soon as the league publishes them. Meanwhile, get to know the squads.')} action={<ButtonLink to="/teams" variant="secondary">{t('See the squads')}</ButtonLink>} />
        )}
      </section>

      <section>
        <SectionTitle title={t('Play for points')} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['/fantasy', Trophy, t('Pick XI'), t('Pick 11 for every match')],
            ['/games', Gamepad2, t('Daily games'), t('Guess the Player · Super Over')],
            ['/contests', Target, t('Predictions'), config?.stats.openContests ? t('{n} open now', { n: config.stats.openContests }) : t('Call the result')],
            ['/prizes', Gift, t('Prizes'), config?.stats.prizes || config?.stats.openDraws ? t('Spend your points') : t('Rewards and draws')],
          ].map(([to, Icon, title, sub]: any) => (
            <Link key={to} to={to} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-400/50 transition-colors">
              <Icon className="w-6 h-6 text-amber-400" />
              <p className="mt-2 font-black text-white">{title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
            </Link>
          ))}
        </div>
      </section>

      {(videos.data?.items.length || 0) > 0 && (
        <section>
          <SectionTitle title={t('Latest videos')} action={<Link to="/videos" className="text-sm font-bold text-amber-400">{t('All videos')}</Link>} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {videos.data!.items.map(v => (
              <FeedCard key={v.id} item={v} team={teamById(v.teamId)} compact />
            ))}
          </div>
        </section>
      )}

      {socialPosts.length > 0 && (
        <section>
          <SectionTitle title={t('From the official accounts')} action={<Link to="/social" className="text-sm font-bold text-amber-400">{t('Social hub')}</Link>} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {socialPosts.map(p => (
              <FeedCard key={p.id} item={p} team={teamById(p.teamId)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle title={t('The six teams')} action={<Link to="/teams" className="text-sm font-bold text-amber-400">{t('Squads')}</Link>} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {teams.map(team => (
            <Link key={team.id} to={`/teams/${team.id}`} className={cx('p-3 rounded-2xl bg-slate-900/80 border hover:border-slate-600 flex flex-col items-center text-center gap-2', user?.teamId === team.id ? 'border-amber-400/60' : 'border-slate-800')}>
              <TeamBadge team={team} size="lg" />
              <span className="text-sm font-bold text-white leading-tight">{team.name}</span>
              <span className="text-[11px] text-slate-400">{t('{n} fans', { n: team.fans || 0 })}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <SectionTitle title={t('Fan Wars')} action={<Link to="/leaderboard" className="text-sm font-bold text-amber-400">{t('Leaderboard')}</Link>} />
          <Card className="divide-y divide-slate-800">
            {(board.data?.fanWars || []).map((row, i) => (
              <Link key={row.team.id} to={`/teams/${row.team.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40">
                <span className="w-6 text-center font-black text-slate-500 tabular-nums">{i + 1}</span>
                <TeamBadge team={teamById(row.team.id)} size="sm" />
                <span className="flex-1 min-w-0 truncate text-sm font-bold text-white">{row.team.name}</span>
                <span className="text-xs text-slate-400 tabular-nums">{t('{n} fans', { n: row.fansCount })}</span>
                <span className="w-16 text-end text-sm font-black text-amber-400 tabular-nums">{f.num(row.points)}</span>
              </Link>
            ))}
          </Card>
        </section>
        <section>
          <SectionTitle title={t('Fan forum')} action={<Link to="/forum" className="text-sm font-bold text-amber-400">{t('Open forum')}</Link>} />
          {(threads.data?.threads || []).length ? (
            <Card className="divide-y divide-slate-800">
              {threads.data!.threads.slice(0, 5).map(th => (
                <Link key={th.id} to={`/forum/${th.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-800/40">
                  <MessageSquare className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-white truncate">{th.title}</span>
                    <span className="block text-[11px] text-slate-500">
                      {th.userName} · {t('{n} replies', { n: th.commentsCount })} · {f.ago(th.lastActivityAt)}
                    </span>
                  </span>
                </Link>
              ))}
            </Card>
          ) : (
            <EmptyState icon={<MessageSquare className="w-6 h-6" />} title={t('Start the first conversation')} body={t('Squad debates, matchday chat, Pick XI tips: the forum is yours.')} action={<ButtonLink to="/forum">{t('Go to the forum')}</ButtonLink>} />
          )}
        </section>
      </div>
    </div>
  );
}

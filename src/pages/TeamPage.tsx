import React, { useMemo, useState } from 'react';
import { ExternalLink, Heart, LayoutGrid, MessageSquarePlus, Radio, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Avatar, Button, ButtonLink, Card, EmptyState, Notice, Pill, SectionTitle, Spinner, Tabs, TeamBadge, ROLE_LABEL, cx } from '../components/ui';
import { MatchCard, sortMatches } from '../components/matches';
import { FeedCard, HandleEmbed, PlatformIcon } from '../components/social';
import { PollCard } from '../components/PollCard';
import NotFoundPage from './NotFoundPage';
import type { PlayerRole } from '../types';

const ROLE_ORDER: PlayerRole[] = ['batter', 'wicketkeeper', 'allrounder', 'bowler'];

export default function TeamPage({ id }: { id: string }) {
  const { teams, matches, user, openTeamPicker, openAuth, config, toast } = useApp();
  const t = useT();
  const team = teams.find(x => x.id === id);
  usePageMeta(team ? t('{team} squad, fixtures and official channels', { team: team.name }) : null, team ? t('{team}: {n}-player squad, icon player {icon}.', { team: team.name, n: team.squad.length, icon: team.iconPlayer }) : undefined, config?.brandName);
  const handles = useLoad(() => api.getHandles({ teamId: id }), [id]);
  const feed = useLoad(() => api.getFeeds({ teamId: id, limit: 60 }), [id]);
  const threads = useLoad(() => api.getForumThreads({ teamId: id }), [id]);
  const polls = useLoad(() => api.getPolls({ teamId: id }), [id]);
  const fans = useLoad(() => api.getLeaderboard(id), [id]);
  const [tab, setTab] = useState<'squad' | 'channels' | 'fixtures' | 'fans'>('channels');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [socialView, setSocialView] = useState<'posts' | 'embeds'>('posts');
  const [pulling, setPulling] = useState(false);
  const teamMatches = useMemo(() => matches.filter(m => m.teamA === id || m.teamB === id), [matches, id]);
  if (!team) return <NotFoundPage />;
  const { live, upcoming, done } = sortMatches(teamMatches);
  const verified = (handles.data?.handles || []).filter(h => h.status === 'verified');
  const mine = user?.teamId === team.id;

  const handlePullSocial = async () => {
    setPulling(true);
    try {
      const res = await api.pullSocialFeeds(id);
      toast(t('Pulled {n} posts from official {team} handles!', { n: res.totalItems || res.added || 0, team: team.name }), 'success');
      await Promise.all([feed.reload(), handles.reload()]);
    } catch (e: any) {
      toast(e?.message || t('Failed to refresh social feed'), 'error');
    } finally {
      setPulling(false);
    }
  };

  return (
    <div className="space-y-6">
      <nav className="text-xs text-slate-500">
        <Link to="/teams" className="hover:text-white">{t('Teams')}</Link> / {team.name}
      </nav>
      <Card className="relative overflow-hidden p-5 sm:p-7">
        <div className="absolute inset-0 opacity-20" style={{ background: `linear-gradient(135deg, ${team.color}, transparent 60%)` }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <TeamBadge team={team} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black text-white">{team.name}</h1>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-300">
              {team.iconPlayer && <Pill tone="amber">{t('Icon')}: {team.iconPlayer}</Pill>}
              {team.headCoach && <Pill>{t('Head coach')}: {team.headCoach}</Pill>}
              <Pill>{t('{n} fans', { n: team.fans || 0 })}</Pill>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {mine ? (
              <span className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-300 text-sm font-black">
                <Heart className="w-4 h-4 fill-amber-400" /> {t('Your team')}
              </span>
            ) : (
              <Button onClick={() => (user ? openTeamPicker() : openAuth(t('Sign in to back {team}.', { team: team.name })))}>
                <Heart className="w-4 h-4" /> {t('Back {team}', { team: team.short })}
              </Button>
            )}
            {team.website && (
              <ButtonLink to={team.website} external variant="secondary">
                {t('Website')} <ExternalLink className="w-4 h-4" />
              </ButtonLink>
            )}
          </div>
        </div>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'squad', label: t('Squad'), count: team.squad.length },
          { id: 'channels', label: t('Social feed'), count: (feed.data?.items || []).length || verified.length },
          { id: 'fixtures', label: t('Fixtures'), count: teamMatches.length },
          { id: 'fans', label: t('Fans & chat') },
        ]}
      />

      {tab === 'squad' && (
        <div className="space-y-5">
          {ROLE_ORDER.map(role => {
            const players = team.squad.filter(p => p.role === role);
            if (!players.length) return null;
            return (
              <section key={role}>
                <SectionTitle title={`${t(ROLE_LABEL[role] + 's')} (${players.length})`} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {players.map(p => (
                    <Link key={p.id} to={`/players/${p.id}`} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-600" data-testid="player-row">
                      <Avatar name={p.name} src={p.photoUrl} size={44} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-white truncate">{p.name}</span>
                        <span className="block text-[11px] text-slate-400 truncate">{[p.battingStyle, p.bowlingStyle].filter(Boolean).join(' · ') || t(ROLE_LABEL[p.role])}</span>
                      </span>
                      {p.category && <Pill tone={p.category === 'Icon' ? 'amber' : 'blue'}>{t(p.category)}</Pill>}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
          <p className="text-xs text-slate-500">{t('Squads as published after the {season} player draft. Player profiles link to Cricbuzz for career statistics.', { season: config?.seasonLabel || '' })}</p>
        </div>
      )}

      {tab === 'channels' && (
        <div className="space-y-6">
          {handles.loading && feed.loading ? (
            <div className="py-12 flex justify-center"><Spinner /></div>
          ) : verified.length === 0 ? (
            <EmptyState
              title={t('No confirmed official channels yet')}
              body={t('We only list accounts we have confirmed belong to {team}. Their videos and posts will appear here once confirmed.', { team: team.name })}
              action={<ButtonLink to="/social" variant="secondary">{t('League channels')}</ButtonLink>}
            />
          ) : (
            <>
              {/* Aggregator Header & Controls Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-white">{t('Official Social Stream')}</h2>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[11px] font-black">
                      {t('{n} posts', { n: (feed.data?.items || []).length })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t('Aggregated in real-time from {n} verified {team} channels.', { n: verified.length, team: team.name })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={handlePullSocial} loading={pulling} title={t('Pull latest posts from handles')}>
                    <RefreshCw className={cx('w-4 h-4', pulling && 'animate-spin')} /> {t('Pull latest')}
                  </Button>
                  <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSocialView('posts')}
                      className={cx('px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors', socialView === 'posts' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white')}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" /> {t('Posts')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSocialView('embeds')}
                      className={cx('px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors', socialView === 'embeds' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white')}
                    >
                      <Radio className="w-3.5 h-3.5" /> {t('Embeds')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Verified Account Chips */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-400 me-1">{t('Official Channels')}:</span>
                {verified.map(h => (
                  <a
                    key={h.id}
                    href={h.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 min-h-[34px] px-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
                    data-testid="handle-link"
                  >
                    <PlatformIcon platform={h.platform} className="w-3.5 h-3.5" />
                    <span>{h.handle}</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                ))}
              </div>

              {socialView === 'posts' ? (
                <>
                  {/* Platform Filter Tabs */}
                  {(() => {
                    const allPosts = feed.data?.items || [];
                    const platformCounts: Record<string, number> = {};
                    for (const item of allPosts) {
                      platformCounts[item.platform] = (platformCounts[item.platform] || 0) + 1;
                    }
                    const availablePlatforms = ['all', ...Object.keys(platformCounts)];
                    const filteredPosts = allPosts.filter(i => platformFilter === 'all' || i.platform.toLowerCase() === platformFilter.toLowerCase());

                    return (
                      <div className="space-y-4">
                        {availablePlatforms.length > 2 && (
                          <div className="flex flex-wrap gap-1.5">
                            {availablePlatforms.map(p => {
                              const count = p === 'all' ? allPosts.length : platformCounts[p] || 0;
                              const active = platformFilter === p;
                              return (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => setPlatformFilter(p)}
                                  className={cx(
                                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border',
                                    active
                                      ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                                      : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                                  )}
                                >
                                  {p !== 'all' && <PlatformIcon platform={p} className="w-3.5 h-3.5" />}
                                  <span>{p === 'all' ? t('All Posts') : p}</span>
                                  <span className={cx('text-[10px] px-1.5 py-0.5 rounded-full font-black', active ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400')}>
                                    {count}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {filteredPosts.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredPosts.map(item => (
                              <FeedCard key={item.id} item={item} team={team} />
                            ))}
                          </div>
                        ) : (
                          <EmptyState
                            title={t('No posts found')}
                            body={t('No social posts matched this filter. Pull fresh posts from {team} handles to update.', { team: team.name })}
                            action={
                              <Button onClick={handlePullSocial} loading={pulling}>
                                <RefreshCw className="w-4 h-4" /> {t('Pull latest posts now')}
                              </Button>
                            }
                          />
                        )}
                      </div>
                    );
                  })()}
                </>
              ) : (
                /* Raw Live Embeds Fallback */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {verified
                    .sort((a, b) => (a.platform === 'YouTube' ? -1 : 0) - (b.platform === 'YouTube' ? -1 : 0))
                    .map(h => (
                      <div key={h.id} className="space-y-2" data-testid="handle-embed" data-platform={h.platform}>
                        <p className="text-xs font-bold text-slate-400 inline-flex items-center gap-1.5">
                          <PlatformIcon platform={h.platform} /> {h.platform} · {h.handle}
                        </p>
                        <HandleEmbed handle={h} team={team} />
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'fixtures' &&
        (teamMatches.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[...live, ...upcoming, ...done].map(m => <MatchCard key={m.id} m={m} />)}</div>
        ) : (
          <EmptyState title={t('Fixtures are not out yet')} body={t('They appear here as soon as the league publishes them.')} />
        ))}

      {tab === 'fans' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <SectionTitle title={t('Top {team} fans', { team: team.short })} />
            {(fans.data?.topFans || []).length ? (
              <Card className="divide-y divide-slate-800">
                {fans.data!.topFans.slice(0, 10).map((u, i) => (
                  <div key={u.id} className={cx('flex items-center gap-3 px-4 py-2.5', u.id === user?.id && 'bg-amber-400/5')}>
                    <span className="w-6 text-center font-black text-slate-500">{i + 1}</span>
                    <Avatar name={u.name} src={u.avatar} size={32} />
                    <span className="flex-1 min-w-0 truncate text-sm font-bold text-white">{u.name}</span>
                    <span className="text-sm font-black text-amber-400 tabular-nums">{u.points}</span>
                  </div>
                ))}
              </Card>
            ) : (
              <Notice>{t('No {team} fans have scored points yet. Be the first!', { team: team.name })}</Notice>
            )}
          </section>
          <section className="space-y-3">
            <SectionTitle title={t('{team} fan chat', { team: team.short })} action={<ButtonLink to={`/forum?new=1&teamId=${team.id}&category=franchises`} size="sm" variant="secondary"><MessageSquarePlus className="w-4 h-4" /> {t('New thread')}</ButtonLink>} />
            {(polls.data?.polls || []).slice(0, 2).map(p => <PollCard key={p.id} poll={p} />)}
            {(threads.data?.threads || []).length ? (
              <Card className="divide-y divide-slate-800">
                {threads.data!.threads.slice(0, 8).map(th => (
                  <Link key={th.id} to={`/forum/${th.id}`} className="block px-4 py-3 hover:bg-slate-800/40">
                    <span className="block text-sm font-bold text-white truncate">{th.title}</span>
                    <span className="text-[11px] text-slate-500">{th.userName} · {t('{n} replies', { n: th.commentsCount })}</span>
                  </Link>
                ))}
              </Card>
            ) : (
              <p className="text-sm text-slate-400">{t('No threads about {team} yet.', { team: team.name })}</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

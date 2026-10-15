import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Heart, LayoutGrid, MessageSquarePlus, Radio, RefreshCw, Search, Sparkles } from 'lucide-react';
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
  const [selectedHandleId, setSelectedHandleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [socialView, setSocialView] = useState<'wall' | 'channels'>('wall');
  // With no stored posts yet, open on the live channel embeds instead of an empty wall.
  const postsCount = (feed.data?.items || []).length;
  useEffect(() => {
    if (!feed.loading && postsCount === 0) setSocialView('channels');
  }, [feed.loading, postsCount]);
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
      toast((res as any).skipped ? t('Already up to date. Official accounts are pulled every few minutes.') : t('{n} new posts from {team}', { n: res.added || 0, team: team.name }), 'success');
      await Promise.all([feed.reload(), handles.reload()]);
    } catch (e: any) {
      toast(e?.message || t('Failed to refresh social feed'), 'error');
    } finally {
      setPulling(false);
    }
  };

  const allPosts = feed.data?.items || [];
  const socialPosts = allPosts.filter(i => i.category === 'social');

  // Filter posts based on selected handle, platform, and search query
  const filteredPosts = useMemo(() => {
    return allPosts.filter(item => {
      // Handle filter
      if (selectedHandleId) {
        const targetHandle = verified.find(h => h.id === selectedHandleId);
        if (targetHandle) {
          const matchHandle = item.handleId === targetHandle.id ||
            item.source.toLowerCase() === targetHandle.handle.toLowerCase() ||
            (item.platform === targetHandle.platform && item.category === 'social');
          if (!matchHandle) return false;
        }
      }

      // Platform filter
      if (platformFilter !== 'all' && item.platform.toLowerCase() !== platformFilter.toLowerCase()) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = item.title.toLowerCase().includes(q);
        const inSummary = (item.summary || '').toLowerCase().includes(q);
        const inSource = item.source.toLowerCase().includes(q);
        if (!inTitle && !inSummary && !inSource) return false;
      }

      return true;
    });
  }, [allPosts, selectedHandleId, verified, platformFilter, searchQuery]);

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
          { id: 'channels', label: t('Social & Videos'), count: allPosts.length || verified.length },
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
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 shadow-lg">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      {t('{team} Official Social Stream', { team: team.name })}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/15 border border-emerald-400/30 text-emerald-400 text-[11px] font-black">
                      {t('{n} posts pulled', { n: allPosts.length })}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[11px] font-black">
                      {t('{n} verified channels', { n: verified.length })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t('Pulled every few minutes from {n} official {team} accounts and kept here.', { n: verified.length, team: team.name })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Button variant="primary" size="sm" onClick={handlePullSocial} loading={pulling} title={t('Pull latest posts from handles')}>
                    <RefreshCw className={cx('w-4 h-4', pulling && 'animate-spin')} /> {t('Pull latest posts')}
                  </Button>
                  <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSocialView('wall')}
                      className={cx('px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors', socialView === 'wall' ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400 hover:text-white')}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" /> {t('Social Wall')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSocialView('channels')}
                      className={cx('px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors', socialView === 'channels' ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400 hover:text-white')}
                    >
                      <Radio className="w-3.5 h-3.5" /> {t('By Channel')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Interactive Handle Filter Chips */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                  <span>{t('Filter by official handle')}:</span>
                  {selectedHandleId && (
                    <button
                      type="button"
                      onClick={() => setSelectedHandleId(null)}
                      className="text-amber-400 hover:underline text-[11px]"
                    >
                      {t('Show all handles')}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedHandleId(null)}
                    className={cx(
                      'inline-flex items-center gap-1.5 min-h-[34px] px-3 rounded-xl border text-xs font-bold transition-colors',
                      !selectedHandleId
                        ? 'bg-amber-400 text-slate-950 border-amber-400 font-black'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                    )}
                  >
                    <span>{t('All handles')}</span>
                    <span className={cx('text-[10px] px-1.5 py-0.2 rounded-full font-black', !selectedHandleId ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400')}>
                      {allPosts.length}
                    </span>
                  </button>
                  {verified.map(h => {
                    const handlePostCount = allPosts.filter(i =>
                      i.handleId === h.id ||
                      i.source.toLowerCase() === h.handle.toLowerCase() ||
                      (i.platform === h.platform && i.category === 'social')
                    ).length;
                    const isSelected = selectedHandleId === h.id;
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setSelectedHandleId(isSelected ? null : h.id)}
                        className={cx(
                          'inline-flex items-center gap-1.5 min-h-[34px] px-3 rounded-xl border text-xs font-bold transition-all',
                          isSelected
                            ? 'bg-amber-400 text-slate-950 border-amber-400 font-black shadow-md'
                            : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:text-white hover:border-slate-600'
                        )}
                        data-testid="handle-link"
                      >
                        <PlatformIcon platform={h.platform} className="w-3.5 h-3.5" />
                        <span>{h.handle}</span>
                        <span className={cx('text-[10px] px-1.5 py-0.5 rounded-full font-black', isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400')}>
                          {handlePostCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {socialView === 'wall' ? (
                <div className="space-y-4">
                  {/* Platform Filters & Search Bar */}
                  {(() => {
                    const platformCounts: Record<string, number> = {};
                    for (const item of allPosts) {
                      platformCounts[item.platform] = (platformCounts[item.platform] || 0) + 1;
                    }
                    const availablePlatforms = ['all', ...Object.keys(platformCounts)];

                    return (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                                      ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm font-black'
                                      : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                                  )}
                                >
                                  {p !== 'all' && <PlatformIcon platform={p} className="w-3.5 h-3.5" />}
                                  <span>{p === 'all' ? t('All Posts') : p}</span>
                                  <span className={cx('text-[10px] px-1.5 py-0.2 rounded-full font-black', active ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400')}>
                                    {count}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <div className="relative min-w-[200px] sm:max-w-xs w-full">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={t('Search posts, keywords, tags...')}
                            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {filteredPosts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredPosts.map(item => (
                        <FeedCard key={item.id} item={item} team={team} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title={t('No posts matched your filter')}
                      body={t('Try selecting another handle or clearing your search term.')}
                      action={
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSelectedHandleId(null);
                            setPlatformFilter('all');
                            setSearchQuery('');
                          }}
                        >
                          {t('Reset filters')}
                        </Button>
                      }
                    />
                  )}
                </div>
              ) : (
                /* Grouped By Official Channel */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {verified
                    .sort((a, b) => (a.platform === 'YouTube' ? -1 : 0) - (b.platform === 'YouTube' ? -1 : 0))
                    .map(h => (
                      <HandleEmbed key={h.id} handle={h} team={team} items={allPosts} />
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

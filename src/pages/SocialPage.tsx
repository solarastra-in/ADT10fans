import React, { useEffect, useState } from 'react';
import { Newspaper, PlaySquare, Share2 } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Button, Card, EmptyState, ErrorBox, PageHeader, SectionTitle, Spinner, Tabs, TeamBadge, cx } from '../components/ui';
import { FeedCard, HandleEmbed, PlatformIcon } from '../components/social';
import type { FeedItem, SocialHandle } from '../types';

type Mode = 'social' | 'videos' | 'news';

export default function SocialPage({ mode }: { mode: Mode }) {
  const { teams, teamById, config } = useApp();
  const t = useT();
  const meta = {
    social: [t('Official team and league social feeds'), t('Posts and videos from the verified accounts of the league and all six franchises.')],
    videos: [t('Videos'), t('The latest videos from the official YouTube channels, playable right here.')],
    news: [t('News'), t('Headlines from cricket publishers, linked to the original articles.')],
  }[mode];
  usePageMeta(meta[0], meta[1], config?.brandName);
  const [team, setTeam] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [items, setItems] = useState<FeedItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handles = useLoad(() => api.getHandles(), []);

  const params = (before?: string) => ({
    teamId: team === 'all' ? undefined : team,
    platform: platform === 'all' ? undefined : platform,
    category: mode === 'news' ? 'news' : mode === 'social' ? 'social' : undefined,
    kind: mode === 'videos' ? 'video' : undefined,
    limit: 24,
    before,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getFeeds(params())
      .then(r => {
        if (cancelled) return;
        setItems(r.items);
        setHasMore(r.hasMore);
        setError(null);
      })
      .catch(e => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, team, platform]);

  const loadMore = async () => {
    const last = items.filter(i => i.status !== 'pinned').slice(-1)[0];
    if (!last) return;
    setMore(true);
    try {
      const r = await api.getFeeds(params(last.publishedAt));
      setItems(prev => [...prev, ...r.items.filter(i => !prev.some(p => p.id === i.id))]);
      setHasMore(r.hasMore);
    } finally {
      setMore(false);
    }
  };

  const verified = (handles.data?.handles || []).filter(h => h.status === 'verified');
  const scoped = verified.filter(h => team === 'all' || (team === 'league' ? !h.teamId : h.teamId === team));
  const youtube = scoped.filter(h => h.platform === 'YouTube' && h.meta?.channelId);
  const platforms = mode === 'social' ? ['all', 'YouTube', 'X', 'Instagram', 'Facebook', 'TikTok', 'Threads', 'LinkedIn'] : [];

  const groups: { key: string; label: string; teamId: string | null; handles: SocialHandle[] }[] = [
    { key: 'league', label: t('League'), teamId: null, handles: verified.filter(h => !h.teamId) },
    ...teams.map(x => ({ key: x.id, label: x.name, teamId: x.id, handles: verified.filter(h => h.teamId === x.id) })),
  ].filter(g => team === 'all' || g.key === team);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t('Social hub')} title={meta[0]} subtitle={meta[1]} />
      <div className="flex gap-2 flex-wrap">
        {(['social', 'videos', 'news'] as Mode[]).map(m => {
          const Icon = m === 'social' ? Share2 : m === 'videos' ? PlaySquare : Newspaper;
          return (
            <Link key={m} to={`/${m}`} className={cx('inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl text-sm font-bold border', mode === m ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-slate-900 text-slate-300 border-slate-700')}>
              <Icon className="w-4 h-4" /> {m === 'social' ? t('All posts') : m === 'videos' ? t('Videos') : t('News')}
            </Link>
          );
        })}
      </div>
      <Tabs value={team} onChange={setTeam} items={[{ id: 'all', label: t('Everyone') }, { id: 'league', label: t('League') }, ...teams.map(x => ({ id: x.id, label: x.short }))]} />
      {platforms.length > 0 && <Tabs value={platform} onChange={setPlatform} items={platforms.map(p => ({ id: p, label: p === 'all' ? t('All platforms') : <span className="inline-flex items-center gap-1.5"><PlatformIcon platform={p} /> {p}</span> }))} />}

      {mode === 'videos' && youtube.length > 0 && platform === 'all' && (
        <section>
          <SectionTitle title={t('Channels')} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {youtube.map(h => (
              <div key={h.id} className="space-y-2">
                <p className="text-xs font-bold text-slate-400">{teamById(h.teamId)?.name || t('League')} · {h.handle}</p>
                <HandleEmbed handle={h} team={teamById(h.teamId)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {error ? (
        <ErrorBox message={error} />
      ) : loading ? (
        <Spinner />
      ) : items.length ? (
        <section>
          {mode !== 'news' && <SectionTitle title={mode === 'videos' ? t('Latest videos') : t('Latest posts')} />}
          {mode === 'news' ? (
            <Card className="divide-y divide-slate-800">
              {items.map(n => (
                <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" className="flex gap-3 px-4 py-3 hover:bg-slate-800/40" data-testid="news-item">
                  {n.image && <img src={n.image} alt="" className="w-20 h-14 rounded-lg object-cover shrink-0 bg-slate-800" loading="lazy" referrerPolicy="no-referrer" />}
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-white break-words">{n.title}</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      {n.source} · {new Date(n.publishedAt).toLocaleDateString()}
                      {n.teamId && ` · ${teamById(n.teamId)?.short || ''}`}
                    </span>
                  </span>
                </a>
              ))}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{items.map(i => <FeedCard key={i.id} item={i} team={teamById(i.teamId)} />)}</div>
          )}
          {hasMore && (
            <div className="flex justify-center mt-4">
              <Button variant="secondary" loading={more} onClick={loadMore}>
                {t('Load more')}
              </Button>
            </div>
          )}
        </section>
      ) : (
        <EmptyState
          title={mode === 'news' ? t('No headlines yet') : t('Nothing posted here yet')}
          body={mode === 'news' ? t('News is checked every 30 minutes.') : t('New posts appear as soon as the official accounts publish them. Some platforms can only be viewed through their embeds below.')}
        />
      )}

      {mode === 'social' && platform === 'all' && (
        <section>
          <SectionTitle title={t('Official channels')} />
          <div className="space-y-6">
            {groups.map(g => (
              <div key={g.key} className="space-y-3">
                <div className="flex items-center gap-2">
                  {g.teamId ? <TeamBadge team={teamById(g.teamId)} size="sm" /> : <span className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-black text-[10px] flex items-center justify-center">T10</span>}
                  <h3 className="font-black text-white">{g.label}</h3>
                </div>
                {g.handles.length ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {g.handles.map(h => (
                      <div key={h.id} className="space-y-1.5" data-testid="handle-embed" data-platform={h.platform}>
                        <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-slate-400 hover:text-white inline-flex items-center gap-1.5">
                          <PlatformIcon platform={h.platform} /> {h.platform} · {h.handle}
                        </a>
                        <HandleEmbed handle={h} team={teamById(h.teamId)} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">{t('No confirmed official accounts yet.')}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

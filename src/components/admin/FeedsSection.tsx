import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Pin, PinOff, EyeOff, Eye, RefreshCw, ExternalLink, Link2, Sparkles, Layers, Webhook, CheckCircle2 } from 'lucide-react';
import { FeedHealthPanel } from './FeedHealthPanel';
import { FeedItem, Team } from '../../types';
import { api } from '../../api';
import { Actions, Button, Card, Chip, EmptyState, Errors, Field, Notice, SectionHeader, Select, Sheet, TextArea, TextInput, formatDateTime, isHttpsUrl, statusTone, useRunner } from './ui';
import { FEED_PLATFORMS, teamName } from './shared';

type Draft = {
  title: string;
  url: string;
  image: string;
  summary: string;
  platform: FeedItem['platform'];
  kind: FeedItem['kind'];
  category: FeedItem['category'];
  teamId: string;
  status: FeedItem['status'];
};

const blank: Draft = { title: '', url: '', image: '', summary: '', platform: 'Web', kind: 'post', category: 'social', teamId: '', status: 'live' };

const SOURCE_LABEL: Record<string, string> = {
  'youtube-rss': 'YouTube RSS',
  'news-rss': 'News RSS',
  'social-syndication': 'X timeline',
  curator: 'Curator.io',
  admin: 'Admin link',
  ai: 'AI draft',
  'native-harvester': 'Native Harvester',
  rss: 'RSS Feed',
};

export const FeedsSection: React.FC<{ feedItems: FeedItem[]; teams: Team[]; onRefreshAll: () => Promise<void>; isTeamOfficial?: boolean }> = ({ feedItems: allItems, teams, onRefreshAll, isTeamOfficial }) => {
  const feedItems = isTeamOfficial ? allItems.filter(i => teams.some(t => t.id === i.teamId)) : allItems;
  const [link, setLink] = useState({ url: '', title: '', teamId: isTeamOfficial ? teams[0]?.id || '' : '', pinned: false });
  const [harvestTeamId, setHarvestTeamId] = useState(isTeamOfficial ? teams[0]?.id || '' : '');
  const [importMode, setImportMode] = useState<'single' | 'bulk'>('single');
  const [bulkUrls, setBulkUrls] = useState('');
  const [bulkTeamId, setBulkTeamId] = useState(isTeamOfficial ? teams[0]?.id || '' : '');
  const [bulkPinned, setBulkPinned] = useState(false);
  const [showWebhookGuide, setShowWebhookGuide] = useState(false);

  const { busy, notice, setNotice, run } = useRunner();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  const items = useMemo(
    () =>
      feedItems
        .filter(i => statusFilter === 'all' || i.status === statusFilter)
        .filter(i => sourceFilter === 'all' || (i.sourceType || 'unknown') === sourceFilter)
        .sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime()),
    [feedItems, statusFilter, sourceFilter]
  );

  const sync = async () => {
    const res = await run('sync', () => api.syncRealFeeds());
    if (!res) return;
    setNotice({
      kind: res.errors && res.errors.length ? 'warn' : 'ok',
      text: res.summary || `Sync finished (${res.added ?? 0} added).`,
      details: res.errors && res.errors.length ? res.errors : undefined,
    });
    await onRefreshAll();
  };

  const harvest = async () => {
    const res = await run('harvest', () => api.harvestFeeds(harvestTeamId || undefined));
    if (!res) return;
    setNotice({
      kind: res.status === 'warning' ? 'warn' : 'ok',
      text: res.summary || `Harvest finished (${res.items ?? 0} added).`,
    });
    await onRefreshAll();
  };

  const addLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHttpsUrl(link.url)) return setNotice({ kind: 'err', text: 'Paste the full https:// link to the post or video.' });
    const res = await run('link', () => api.addFeedFromLink({ url: link.url.trim(), title: link.title.trim() || undefined, teamId: link.teamId || null, pinned: link.pinned }), r => `Added: ${r.item.title}`);
    if (res) {
      setLink({ ...link, url: '', title: '' });
      await onRefreshAll();
    }
  };

  const handleBulkIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    const urls = bulkUrls.split(/[\r\n,]+/).map(u => u.trim()).filter(Boolean);
    if (!urls.length) return setNotice({ kind: 'err', text: 'Paste at least one valid https:// URL.' });
    const res = await run('bulk', () => api.bulkIngestFeedUrls({ urls, teamId: bulkTeamId || null, pinned: bulkPinned }));
    if (res) {
      setNotice({
        kind: res.errors && res.errors.length ? 'warn' : 'ok',
        text: `Bulk import completed: ${res.added} post(s) added from ${urls.length} link(s).`,
        details: res.errors && res.errors.length ? res.errors : undefined,
      });
      setBulkUrls('');
      await onRefreshAll();
    }
  };

  const setStatus = async (item: FeedItem, status: FeedItem['status']) => {
    const res = await run(`st:${item.id}`, () => api.saveFeedItem({ id: item.id, status }));
    if (res) await onRefreshAll();
  };

  const remove = async (item: FeedItem) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    const res = await run(`del:${item.id}`, () => api.deleteFeedItem(item.id), 'Post deleted.');
    if (res) await onRefreshAll();
  };

  const save = async () => {
    if (!draft) return;
    const e: Errors = {};
    if (!draft.title.trim()) e.title = 'Title is required.';
    if (!draft.url.trim()) e.url = 'Link is required.';
    else if (!isHttpsUrl(draft.url)) e.url = 'Link must start with https://';
    if (draft.image && !isHttpsUrl(draft.image)) e.image = 'Image URL must start with https://';
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await run(
      'save',
      () =>
        api.saveFeedItem({
          title: draft.title.trim(),
          url: draft.url.trim(),
          image: draft.image.trim() || null,
          summary: draft.summary.trim(),
          platform: draft.platform,
          kind: draft.kind,
          category: draft.category,
          teamId: draft.teamId || null,
          status: draft.status,
          sourceType: 'admin',
        }),
      'Post added.'
    );
    if (res) {
      setDraft(null);
      await onRefreshAll();
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Feeds"
        description="Videos, posts and headlines shown to fans. Pulls run automatically every 30 minutes from the verified handles and the news searches."
        actions={
          <>
            <Button variant="primary" size="sm" onClick={sync} loading={busy === 'sync'} icon={<RefreshCw className="w-4 h-4" />}>
              Sync official feeds now
            </Button>
            <Button
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setErrors({});
                setDraft({ ...blank, teamId: isTeamOfficial ? teams[0]?.id || '' : '' });
              }}
            >
              Add manually
            </Button>
          </>
        }
      />

      <Notice notice={notice} onClose={() => setNotice(null)} />

      <Card className="border border-amber-500/30 bg-gradient-to-br from-slate-900/90 to-amber-950/20">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-extrabold text-white inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" /> Native Social Harvester (Curator Alternative)
            </h3>
            <div className="flex items-center gap-2">
              <Chip tone="green">Self-Hosted Aggregator</Chip>
              <Button size="sm" variant="secondary" icon={<Webhook className="w-3.5 h-3.5" />} onClick={() => setShowWebhookGuide(!showWebhookGuide)}>
                {showWebhookGuide ? 'Hide Webhook API' : 'Webhook API'}
              </Button>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Continuously discovers and ingests public updates from verified franchise social accounts (Instagram, X, TikTok, YouTube, Facebook, and RSS). Replaces the need for third-party paid subscriptions.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="w-full sm:w-60">
              <Select value={harvestTeamId} onChange={e => setHarvestTeamId(e.target.value)} aria-label="Harvester team" disabled={isTeamOfficial}>
                {!isTeamOfficial && <option value="">All franchises</option>}
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
            <Button variant="primary" loading={busy === 'harvest'} onClick={harvest} icon={<RefreshCw className="w-4 h-4" />}>
              Harvest social posts now
            </Button>
          </div>
        </div>
      </Card>

      {showWebhookGuide && (
        <Card className="border border-slate-700 bg-slate-900/90 space-y-2 text-xs">
          <h4 className="font-bold text-white inline-flex items-center gap-1.5"><Webhook className="w-4 h-4 text-emerald-400" /> Automated Social Ingestion via Webhook (Zapier / IFTTT / Make)</h4>
          <p className="text-slate-300">You can forward posts automatically from any social automation tool to this endpoint:</p>
          <pre className="p-2.5 rounded-lg bg-black/70 font-mono text-emerald-300 overflow-x-auto text-[11px]">POST /api/feeds/webhook</pre>
          <p className="text-slate-400">JSON payload example:</p>
          <pre className="p-2.5 rounded-lg bg-black/70 font-mono text-slate-200 overflow-x-auto text-[11px]">{JSON.stringify({ url: "https://www.instagram.com/p/...", teamId: "aces", title: "Matchday announcement" }, null, 2)}</pre>
          <p className="text-slate-400">The server automatically resolves post cover images, captions, and author tags via OpenGraph and oEmbed.</p>
        </Card>
      )}

      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-amber-400" />
              <span className="font-extrabold text-white">Import Social Posts</span>
            </div>
            <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
              <button
                type="button"
                className={`px-3 py-1 rounded-md font-bold transition ${importMode === 'single' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                onClick={() => setImportMode('single')}
              >
                Single Link
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-md font-bold transition ${importMode === 'bulk' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                onClick={() => setImportMode('bulk')}
              >
                Bulk Import (Multiple)
              </button>
            </div>
          </div>

          {importMode === 'single' ? (
            <form onSubmit={addLink} className="space-y-3">
              <p className="text-xs text-slate-400">Paste any post URL (YouTube, Instagram, TikTok, X/Twitter, Facebook, or web article). Thumbnails and titles are resolved automatically.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <TextInput type="url" inputMode="url" placeholder="https://www.instagram.com/p/…" value={link.url} onChange={e => setLink({ ...link, url: e.target.value })} required aria-label="Post link" />
                <TextInput placeholder="Custom title (optional)" value={link.title} onChange={e => setLink({ ...link, title: e.target.value })} aria-label="Title" />
                <Select value={link.teamId} onChange={e => setLink({ ...link, teamId: e.target.value })} aria-label="Team" disabled={isTeamOfficial}>
                  {!isTeamOfficial && <option value="">League-wide</option>}
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
                <label className="inline-flex items-center gap-2 text-sm text-slate-300 min-h-[44px]"><input type="checkbox" checked={link.pinned} onChange={e => setLink({ ...link, pinned: e.target.checked })} /> Pin to the top</label>
              </div>
              <Button type="submit" variant="primary" loading={busy === 'link'}>Add post</Button>
            </form>
          ) : (
            <form onSubmit={handleBulkIngest} className="space-y-3">
              <p className="text-xs text-slate-400">Paste multiple post or video links (one URL per line). The engine will scrape OpenGraph thumbnails and titles concurrently.</p>
              <TextArea
                rows={4}
                placeholder={"https://www.instagram.com/p/...\nhttps://x.com/arabianacesT10/status/...\nhttps://www.tiktok.com/@arabianaces/video/..."}
                value={bulkUrls}
                onChange={e => setBulkUrls(e.target.value)}
                required
                aria-label="Bulk post URLs"
              />
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-full sm:w-60">
                  <Select value={bulkTeamId} onChange={e => setBulkTeamId(e.target.value)} aria-label="Bulk team" disabled={isTeamOfficial}>
                    {!isTeamOfficial && <option value="">League-wide</option>}
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={bulkPinned} onChange={e => setBulkPinned(e.target.checked)} /> Pin to top</label>
                <Button type="submit" variant="primary" loading={busy === 'bulk'} icon={<Layers className="w-4 h-4" />}>Import all links</Button>
              </div>
            </form>
          )}
        </div>
      </Card>

      <FeedHealthPanel />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status">
          <option value="all">All statuses ({feedItems.length})</option>
          <option value="live">Live</option>
          <option value="pinned">Pinned</option>
          <option value="hidden">Hidden</option>
        </Select>
        <Select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} aria-label="Filter by source">
          <option value="all">All sources</option>
          <option value="native-harvester">Native Harvester</option>
          <option value="rss">RSS Feed</option>
          <option value="youtube-rss">YouTube RSS</option>
          <option value="news-rss">News RSS</option>
          <option value="social-syndication">X timeline</option>
          <option value="admin">Admin link</option>
          <option value="curator">Curator.io</option>
          <option value="ai">AI draft</option>
          <option value="unknown">Unlabelled</option>
        </Select>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No posts" description="Run a sync or add a post manually." />
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map(item => (
            <li key={item.id}>
              <Card className="flex flex-col gap-2 h-full">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone={statusTone(item.status)}>{item.status}</Chip>
                  <Chip>{item.platform}</Chip>
                  <Chip tone="violet">{item.sourceType ? SOURCE_LABEL[item.sourceType] || item.sourceType : 'Unlabelled source'}</Chip>
                </div>
                <p className="font-bold text-white break-words">{item.title}</p>
                {item.summary && <p className="text-sm text-slate-400 line-clamp-3 break-words">{item.summary}</p>}
                <p className="text-xs text-slate-500">
                  {teamName(teams, item.teamId)} · {item.source} · {formatDateTime(item.publishedAt || item.createdAt)}
                </p>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-300 hover:underline break-all inline-flex items-center gap-1">
                  Open link <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <Actions className="mt-auto pt-1">
                  {item.status !== 'pinned' ? (
                    <Button size="sm" icon={<Pin className="w-4 h-4" />} loading={busy === `st:${item.id}`} onClick={() => setStatus(item, 'pinned')}>
                      Pin
                    </Button>
                  ) : (
                    <Button size="sm" icon={<PinOff className="w-4 h-4" />} loading={busy === `st:${item.id}`} onClick={() => setStatus(item, 'live')}>
                      Unpin
                    </Button>
                  )}
                  {item.status !== 'hidden' ? (
                    <Button size="sm" icon={<EyeOff className="w-4 h-4" />} disabled={busy === `st:${item.id}`} onClick={() => setStatus(item, 'hidden')}>
                      Hide
                    </Button>
                  ) : (
                    <Button size="sm" icon={<Eye className="w-4 h-4" />} disabled={busy === `st:${item.id}`} onClick={() => setStatus(item, 'live')}>
                      Show
                    </Button>
                  )}
                  <Button size="sm" variant="danger" icon={<Trash2 className="w-4 h-4" />} loading={busy === `del:${item.id}`} onClick={() => remove(item)}>
                    Delete
                  </Button>
                </Actions>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={!!draft}
        title="Add post"
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={busy === 'save'}>
              Add post
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Title" required error={errors.title} className="sm:col-span-2">
              <TextInput value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} error={!!errors.title} />
            </Field>
            <Field label="Link" required error={errors.url} className="sm:col-span-2" hint="The original post/article URL">
              <TextInput type="url" inputMode="url" placeholder="https://" value={draft.url} onChange={e => setDraft({ ...draft, url: e.target.value })} error={!!errors.url} />
            </Field>
            <Field label="Image URL" error={errors.image} className="sm:col-span-2" hint="Optional">
              <TextInput type="url" inputMode="url" placeholder="https://" value={draft.image} onChange={e => setDraft({ ...draft, image: e.target.value })} error={!!errors.image} />
            </Field>
            <Field label="Summary" className="sm:col-span-2">
              <TextArea value={draft.summary} onChange={e => setDraft({ ...draft, summary: e.target.value })} />
            </Field>
            <Field label="Platform">
              <Select value={draft.platform} onChange={e => setDraft({ ...draft, platform: e.target.value as FeedItem['platform'] })}>
                {FEED_PLATFORMS.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Kind">
              <Select value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as FeedItem['kind'] })}>
                <option value="post">Post</option>
                <option value="video">Video</option>
                <option value="live">Live</option>
                <option value="article">Article</option>
              </Select>
            </Field>
            <Field label="Category">
              <Select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value as FeedItem['category'] })}>
                <option value="social">Social</option>
                <option value="news">News</option>
                <option value="marketing">Marketing</option>
              </Select>
            </Field>
            <Field label="Team">
              <Select value={draft.teamId} onChange={e => setDraft({ ...draft, teamId: e.target.value })} disabled={isTeamOfficial}>
                {!isTeamOfficial && <option value="">League-wide</option>}
                {teams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as FeedItem['status'] })}>
                <option value="live">Live</option>
                <option value="pinned">Pinned</option>
                <option value="hidden">Hidden</option>
              </Select>
            </Field>
          </div>
        )}
      </Sheet>
    </div>
  );
};

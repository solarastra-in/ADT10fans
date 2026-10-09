import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Pin, PinOff, EyeOff, Eye, RefreshCw, ExternalLink } from 'lucide-react';
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
  'social-handle': 'Verified Handle',
  'social-syndication': 'Live Syndication',
  admin: 'Admin',
  ai: 'AI draft',
};

export const FeedsSection: React.FC<{ feedItems: FeedItem[]; teams: Team[]; onRefreshAll: () => Promise<void> }> = ({ feedItems, teams, onRefreshAll }) => {
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
        description="Posts, videos and articles on the fan wall. Sync pulls from verified official handles and your news queries."
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
                setDraft({ ...blank });
              }}
            >
              Add post
            </Button>
          </>
        }
      />

      <Notice notice={notice} onClose={() => setNotice(null)} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status">
          <option value="all">All statuses ({feedItems.length})</option>
          <option value="live">Live</option>
          <option value="pinned">Pinned</option>
          <option value="hidden">Hidden</option>
        </Select>
        <Select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} aria-label="Filter by source">
          <option value="all">All sources</option>
          <option value="youtube-rss">YouTube RSS</option>
          <option value="news-rss">News RSS</option>
          <option value="admin">Admin</option>
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
                  {item.verifiedReal && <Chip tone="green">Official</Chip>}
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
              <Select value={draft.teamId} onChange={e => setDraft({ ...draft, teamId: e.target.value })}>
                <option value="">League-wide</option>
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

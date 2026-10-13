import React, { useCallback, useEffect, useState } from 'react';
import { Pin, PinOff, Trash2, RefreshCw, Search, Lock, Unlock, EyeOff, Eye, Flag } from 'lucide-react';
import { ForumReportView, ForumThread, Team } from '../../types';
import { api } from '../../api';
import { Actions, Button, Card, Chip, EmptyState, Notice, SectionHeader, TextInput, formatDateTime, useRunner } from './ui';
import { teamName } from './shared';

export const ForumSection: React.FC<{ teams: Team[] }> = ({ teams }) => {
  const { busy, notice, setNotice, run } = useRunner();
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [reports, setReports] = useState<ForumReportView[]>([]);
  const loadReports = useCallback(async () => {
    const r = await api.getReports().catch(() => null);
    if (r) setReports(r.reports);
  }, []);
  useEffect(() => {
    loadReports();
  }, [loadReports]);
  const decide = async (r: ForumReportView, action: 'dismiss' | 'remove') => {
    const res = await run(`rep:${r.id}`, () => api.decideReport(r.id, action), action === 'remove' ? 'Post hidden.' : 'Report dismissed; the post is visible.');
    if (res) {
      loadReports();
      load();
    }
  };
  const moderate = async (t: ForumThread, action: 'lock' | 'hide', value: boolean) => {
    const res = await run(`${action}:${t.id}`, () => api.moderateThread(t.id, action, value));
    if (res) setThreads(prev => prev.map(x => (x.id === t.id ? { ...x, ...res.thread } : x)));
  };

  const load = useCallback(async (search?: string) => {
    setLoading(true);
    try {
      const res = await api.getForumThreads(search ? { search } : undefined);
      setThreads(res.threads || []);
    } catch (e: any) {
      setNotice({ kind: 'err', text: e?.message || 'Could not load threads' });
    } finally {
      setLoading(false);
    }
  }, [setNotice]);

  useEffect(() => {
    load();
  }, [load]);

  const togglePin = async (t: ForumThread) => {
    const res = await run(`pin:${t.id}`, () => api.pinForumThread(t.id, !t.pinned), t.pinned ? 'Thread unpinned.' : 'Thread pinned.');
    if (res) setThreads(prev => prev.map(x => (x.id === t.id ? { ...x, ...(res.thread || {}), pinned: res.thread?.pinned ?? !t.pinned } : x)));
  };

  const remove = async (t: ForumThread) => {
    if (!window.confirm(`Delete the thread "${t.title}" and all its comments?`)) return;
    const res = await run(`del:${t.id}`, () => api.deleteForumThread(t.id), 'Thread deleted.');
    if (res) setThreads(prev => prev.filter(x => x.id !== t.id));
  };

  const sorted = [...threads].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Forum moderation"
        description="Reports from fans, plus pin, lock, hide or delete threads. Posts reported by 3 fans are hidden until you review them."
        actions={
          <Button size="sm" onClick={() => load(query.trim() || undefined)} loading={loading} icon={<RefreshCw className="w-4 h-4" />}>
            Refresh
          </Button>
        }
      />
      <form
        className="flex gap-2"
        onSubmit={e => {
          e.preventDefault();
          load(query.trim() || undefined);
        }}
      >
        <TextInput type="search" placeholder="Search threads" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search threads" />
        <Button type="submit" icon={<Search className="w-4 h-4" />} aria-label="Search">
          <span className="hidden sm:inline">Search</span>
        </Button>
      </form>
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <Card>
        <h3 className="font-extrabold text-white mb-2 inline-flex items-center gap-2"><Flag className="w-4 h-4 text-rose-400" /> Reports ({reports.length})</h3>
        {reports.length === 0 ? (
          <p className="text-sm text-slate-400">No open reports.</p>
        ) : (
          <ul className="space-y-2">
            {reports.map(r => (
              <li key={r.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex flex-wrap gap-1.5 items-center">
                  <Chip tone="red">{r.reason}</Chip>
                  <Chip>{r.kind}</Chip>
                  {r.hidden && <Chip tone="amber">hidden automatically</Chip>}
                  <span className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</span>
                </div>
                <p className="text-xs text-slate-400">In “{r.threadTitle}” by {r.author}</p>
                <p className="text-sm text-slate-200 break-words">{r.excerpt}</p>
                <Actions>
                  <Button size="sm" variant="danger" loading={busy === `rep:${r.id}`} onClick={() => decide(r, 'remove')}>Hide post</Button>
                  <Button size="sm" onClick={() => decide(r, 'dismiss')}>Dismiss (keep visible)</Button>
                  <a className="text-xs text-amber-300 underline self-center" href={`/forum/${r.threadId}`} target="_blank" rel="noopener noreferrer">Open thread</a>
                </Actions>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {sorted.length === 0 ? (
        <EmptyState title={loading ? 'Loading…' : 'No threads'} />
      ) : (
        <ul className="space-y-3">
          {sorted.map(t => (
            <li key={t.id}>
              <Card className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {t.pinned && <Chip tone="amber">pinned</Chip>}
                  {t.locked && <Chip>locked</Chip>}
                  {t.hidden && <Chip tone="red">hidden</Chip>}
                  <Chip>{t.category}</Chip>
                  {t.teamId && <Chip tone="violet">{teamName(teams, t.teamId)}</Chip>}
                </div>
                <p className="font-bold text-white break-words">{t.title}</p>
                <p className="text-sm text-slate-400 line-clamp-2 break-words">{t.content}</p>
                <p className="text-xs text-slate-500">
                  {t.userName} · {t.commentsCount} comments · {t.upvotes} upvotes · last activity {formatDateTime(t.lastActivityAt)}
                </p>
                <Actions>
                  <Button
                    size="sm"
                    icon={t.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    loading={busy === `pin:${t.id}`}
                    onClick={() => togglePin(t)}
                  >
                    {t.pinned ? 'Unpin' : 'Pin'}
                  </Button>
                  <Button size="sm" icon={t.locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />} loading={busy === `lock:${t.id}`} onClick={() => moderate(t, 'lock', !t.locked)}>
                    {t.locked ? 'Unlock' : 'Lock'}
                  </Button>
                  <Button size="sm" icon={t.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />} loading={busy === `hide:${t.id}`} onClick={() => moderate(t, 'hide', !t.hidden)}>
                    {t.hidden ? 'Unhide' : 'Hide'}
                  </Button>
                  <Button size="sm" variant="danger" icon={<Trash2 className="w-4 h-4" />} loading={busy === `del:${t.id}`} onClick={() => remove(t)}>
                    Delete
                  </Button>
                </Actions>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

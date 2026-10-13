import React, { useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { api } from '../../api';
import type { FeedHealthRow } from '../../types';
import { Button, Card, Chip, Notice, useRunner } from './ui';

const TONE: Record<string, 'green' | 'amber' | 'red' | 'slate'> = { ok: 'green', 'embed-only': 'slate', empty: 'amber', error: 'red' };
const LABEL: Record<string, string> = { ok: 'Pulling', 'embed-only': 'Embed only', empty: 'No posts', error: 'Failing' };

/** What each verified handle returned on its last pull, so problems are visible without reading logs. */
export const FeedHealthPanel: React.FC = () => {
  const [rows, setRows] = useState<FeedHealthRow[] | null>(null);
  const [extra, setExtra] = useState<{ curator: { configured: boolean; items: number }; news: number } | null>(null);
  const { busy, notice, setNotice, run } = useRunner();
  const load = async () => {
    const r = await api.getFeedHealth().catch(e => {
      setNotice({ kind: 'err', text: e.message });
      return null;
    });
    if (r) {
      setRows(r.handles);
      setExtra({ curator: r.curator, news: r.news });
    }
  };
  useEffect(() => {
    load();
  }, []);
  const pullAll = async () => {
    const r = await run('all', () => api.syncRealFeeds());
    if (r) {
      setNotice({ kind: r.errors?.length ? 'warn' : 'ok', text: r.summary, details: r.errors?.length ? r.errors : undefined });
      load();
    }
  };
  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-extrabold text-white inline-flex items-center gap-2"><Activity className="w-4 h-4 text-amber-400" /> Feed health</h3>
        <Button size="sm" onClick={pullAll} loading={busy === 'all'} icon={<RefreshCw className="w-4 h-4" />}>Pull everything now</Button>
      </div>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {rows === null ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs min-w-[560px]">
            <thead className="text-slate-400">
              <tr className="border-b border-slate-800">
                <th className="text-start py-2 px-1">Handle</th>
                <th className="text-start px-1">Status</th>
                <th className="text-end px-1">Items</th>
                <th className="text-start px-1">Last pull</th>
              </tr>
            </thead>
            <tbody>
              {rows.filter(r => r.status === 'verified').map(r => (
                <tr key={r.id} className="border-b border-slate-900 align-top">
                  <td className="py-2 px-1">
                    <span className="font-bold text-white">{r.platform}</span> <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-amber-300 hover:underline">{r.handle}</a>
                    <span className="block text-slate-500">{r.teamId || 'League'}{r.channelId ? ` · ${r.channelId}` : ''}</span>
                  </td>
                  <td className="px-1">{r.lastSyncStatus ? <Chip tone={TONE[r.lastSyncStatus] || 'slate'}>{LABEL[r.lastSyncStatus] || r.lastSyncStatus}</Chip> : <Chip>Not pulled</Chip>}</td>
                  <td className="px-1 text-end tabular-nums text-slate-200">{r.items}</td>
                  <td className="px-1 text-slate-400">
                    {r.lastSyncAt ? new Date(r.lastSyncAt).toLocaleString() : '—'}
                    {r.lastSyncNote && <span className="block text-slate-500 break-words">{r.lastSyncNote}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {extra && <p className="mt-2 text-xs text-slate-500">News headlines stored: {extra.news}. Curator.io: {extra.curator.configured ? `${extra.curator.items} posts` : 'not configured'}.</p>}
        </div>
      )}
    </Card>
  );
};

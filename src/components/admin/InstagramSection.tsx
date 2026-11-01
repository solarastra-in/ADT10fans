import React, { useEffect, useState } from 'react';
import { Check, RotateCcw, Search, Stethoscope, X } from 'lucide-react';
import { api } from '../../api';
import type { InstagramAdminView, InstagramReviewRow } from '../../types';
import { Button, Card, Chip, EmptyState, Notice, NoticeState, SectionHeader, Stat, TextInput, errorMessage, formatDateTime } from './ui';

/**
 * Instagram checks: fans waiting for an organiser, a search to fix any fan's check, and a test of the
 * automatic comment check (Meta token, account and pinned post).
 */
export const InstagramSection: React.FC = () => {
  const [view, setView] = useState<InstagramAdminView | null>(null);
  const [q, setQ] = useState('');
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [busy, setBusy] = useState('');

  const load = (search = q, diagnose = false) =>
    api
      .adminInstagram(search || undefined, diagnose)
      .then(setView)
      .catch(e => setNotice({ kind: 'err', text: errorMessage(e) }));
  useEffect(() => {
    load();
  }, []);

  const act = async (r: InstagramReviewRow, action: 'approve' | 'reject' | 'reset') => {
    setBusy(r.id + action);
    try {
      await api.adminInstagramAction(r.id, action);
      setNotice({ kind: 'ok', text: `${r.name}: ${action === 'approve' ? 'verified' : action === 'reject' ? 'rejected' : 'reset'}.` });
      load();
    } catch (e) {
      setNotice({ kind: 'err', text: errorMessage(e) });
    } finally {
      setBusy('');
    }
  };

  const diagnose = async () => {
    setBusy('diag');
    await load(q, true);
    setBusy('');
  };

  if (!view) return <Notice notice={notice} />;
  const s = view.setup;
  const rows = (list: InstagramReviewRow[]) =>
    list.map(r => (
      <Card key={r.id} className="p-3 flex flex-wrap items-center gap-3" data-testid="ig-row">
        <div className="flex-1 min-w-[180px]">
          <p className="font-bold text-white">{r.name} <span className="text-xs text-slate-400">{r.email}</span></p>
          <p className="text-xs text-slate-300">
            {r.handle ? (
              <a href={`https://www.instagram.com/${r.handle}/`} target="_blank" rel="noopener noreferrer" className="text-amber-300 underline">@{r.handle}</a>
            ) : (
              'no username'
            )}
            {r.code ? <> · code <span className="font-mono">{r.code}</span></> : null}
            {r.requestedAt ? ` · ${formatDateTime(r.requestedAt)}` : ''}
          </p>
        </div>
        <Chip tone={r.status === 'verified' ? 'green' : r.status === 'review' ? 'amber' : r.status === 'rejected' ? 'red' : 'slate'}>{r.status}</Chip>
        {r.status !== 'verified' && <Button size="sm" variant="primary" icon={<Check className="w-4 h-4" />} loading={busy === r.id + 'approve'} onClick={() => act(r, 'approve')} disabled={!r.handle} data-testid="ig-approve">Approve</Button>}
        {r.status !== 'rejected' && r.status !== 'verified' && <Button size="sm" icon={<X className="w-4 h-4" />} loading={busy === r.id + 'reject'} onClick={() => act(r, 'reject')}>Reject</Button>}
        <Button size="sm" variant="ghost" icon={<RotateCcw className="w-4 h-4" />} loading={busy === r.id + 'reset'} onClick={() => act(r, 'reset')}>Reset</Button>
      </Card>
    ));

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Instagram checks"
        description={`Fans follow ${view.settings.target} and comment their code on the pinned post. Approve a fan only after opening their profile and seeing the follow and the comment.`}
      />
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Verified" value={view.counts.verified} />
        <Stat label="Waiting" value={view.counts.waiting} />
        <Stat label="Have a code" value={view.counts.withCode} />
        <Stat label="Not started" value={view.counts.notStarted} />
      </div>
      <Card className="p-4 space-y-2 text-sm">
        <p className="font-bold text-white">Automatic check</p>
        {!view.settings.required && <p className="text-amber-200">The Instagram check is switched off (Admin → Settings).</p>}
        {!s.configured ? (
          <p className="text-slate-300">Not set up: add META_ACCESS_TOKEN and META_IG_USER_ID for {view.settings.target} in Admin → Environment. Until then organisers approve fans here.</p>
        ) : !view.settings.postUrl ? (
          <p className="text-slate-300">Add the link of the pinned post fans comment on, in Admin → Settings.</p>
        ) : (
          <p className="text-slate-300">On. Post: <a className="text-amber-300 underline" href={view.settings.postUrl} target="_blank" rel="noopener noreferrer">{view.settings.postUrl}</a></p>
        )}
        {s.account !== undefined && (
          <p className={s.matchesTarget ? 'text-emerald-300' : 'text-red-300'}>
            The token reads {s.account || 'an unknown account'}{s.matchesTarget ? '' : `, not ${view.settings.target}. It must be the club's own account to read comments on its post.`}
            {s.postFound === false ? ' The post was not found on that account.' : s.postFound ? ' The post was found.' : ''}
          </p>
        )}
        {s.error && <p className="text-red-300">{s.error}</p>}
        {s.configured && <Button size="sm" icon={<Stethoscope className="w-4 h-4" />} loading={busy === 'diag'} onClick={diagnose}>Test the setup</Button>}
      </Card>
      <section className="space-y-2">
        <h3 className="text-sm font-black text-white">Waiting for an organiser ({view.queue.length})</h3>
        {view.queue.length ? rows(view.queue) : <EmptyState title="Nobody is waiting" />}
      </section>
      <section className="space-y-2">
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); load(q); }}>
          <TextInput value={q} onChange={e => setQ(e.target.value)} placeholder="Find a fan by Instagram, email or name" aria-label="Find a fan" />
          <Button type="submit" icon={<Search className="w-4 h-4" />}>Find</Button>
        </form>
        {rows(view.search)}
      </section>
    </div>
  );
};

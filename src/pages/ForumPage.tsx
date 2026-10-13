import React, { useEffect, useState } from 'react';
import { MessageSquare, MessageSquarePlus, Pin, Lock, Search } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, navigate, usePageMeta, useRoute } from '../router';
import { Avatar, Button, Card, EmptyState, ErrorBox, Field, Modal, PageHeader, Pill, Spinner, Tabs, inputCls, useFormat } from '../components/ui';
import { FORUM_CATEGORIES } from '../components/forum';
import { PollCard } from '../components/PollCard';

function NewThreadModal({ open, onClose, preset }: { open: boolean; onClose: () => void; preset: { teamId?: string; matchId?: string; category?: string } }) {
  const { teams, matches, teamById, setUser, toast } = useApp();
  const t = useT();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState(preset.category || 'general');
  const [teamId, setTeamId] = useState(preset.teamId || '');
  const [matchId, setMatchId] = useState(preset.matchId || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setCategory(preset.category || 'general');
    setTeamId(preset.teamId || '');
    setMatchId(preset.matchId || '');
  }, [preset.category, preset.teamId, preset.matchId]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.createForumThread({ title, content, category, teamId: teamId || null, matchId: matchId || null });
      setUser(r.user);
      toast(r.pointsAdded ? t('Thread posted: +{n} points', { n: r.pointsAdded }) : t('Thread posted'));
      setTitle('');
      setContent('');
      onClose();
      navigate(`/forum/${r.thread.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('New thread')} wide>
      <form onSubmit={submit} className="space-y-3" data-testid="new-thread-form">
        {error && <ErrorBox message={error} />}
        <Field label={t('Title')}>
          <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} required minLength={5} maxLength={150} name="title" />
        </Field>
        <Field label={t('Your post')} hint={t('Be kind. Up to 3 links.')}>
          <textarea value={content} onChange={e => setContent(e.target.value)} className={`${inputCls} min-h-[140px]`} required minLength={10} maxLength={5000} name="content" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Field label={t('Topic')}>
            <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
              {FORUM_CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{t(c.label)}</option>
              ))}
            </select>
          </Field>
          <Field label={t('Team (optional)')}>
            <select value={teamId} onChange={e => setTeamId(e.target.value)} className={inputCls}>
              <option value="">{t('None')}</option>
              {teams.map(x => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t('Match (optional)')}>
            <select value={matchId} onChange={e => setMatchId(e.target.value)} className={inputCls}>
              <option value="">{t('None')}</option>
              {matches.map(m => (
                <option key={m.id} value={m.id}>
                  {t('Match {n}', { n: m.matchNo })}: {teamById(m.teamA)?.short} v {teamById(m.teamB)?.short}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Button type="submit" loading={busy} className="w-full">{t('Post thread')}</Button>
      </form>
    </Modal>
  );
}

export default function ForumPage() {
  const { user, teams, teamById, openAuth, config } = useApp();
  const t = useT();
  const f = useFormat();
  const route = useRoute();
  usePageMeta(t('Fan forum'), t('Match talk, tactics, Dream XI tips and team chat.'), config?.brandName);
  const [category, setCategory] = useState('all');
  const [team, setTeam] = useState('all');
  const [sort, setSort] = useState('active');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const wantsNew = route.query.get('new') === '1';
  const [newOpen, setNewOpen] = useState(false);
  const preset = { teamId: route.query.get('teamId') || undefined, matchId: route.query.get('matchId') || undefined, category: route.query.get('category') || undefined };
  useEffect(() => {
    if (wantsNew) {
      if (user) setNewOpen(true);
      else openAuth(t('Sign in to start a thread.'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsNew, user?.id]);
  const threads = useLoad(() => api.getForumThreads({ category: category === 'all' ? undefined : category, teamId: team === 'all' ? undefined : team, sort, search: search || undefined }), [category, team, sort, search]);
  const polls = useLoad(() => api.getPolls(), []);
  const openPolls = (polls.data?.polls || []).filter(p => p.status === 'open' && !p.matchId).slice(0, 2);

  const startThread = () => (user ? setNewOpen(true) : openAuth(t('Sign in to start a thread.')));
  return (
    <div className="space-y-5">
      <PageHeader eyebrow={t('Community')} title={t('Fan forum')} subtitle={t('Match talk, tactics, Dream XI tips and team chat. +15 points for a thread, +5 for a reply (up to 50 a day).')} actions={<Button onClick={startThread} data-testid="new-thread"><MessageSquarePlus className="w-4 h-4" /> {t('New thread')}</Button>} />
      {openPolls.length > 0 && <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{openPolls.map(p => <PollCard key={p.id} poll={p} />)}</div>}
      <form onSubmit={e => { e.preventDefault(); setSearch(q.trim()); }} className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search the forum')} className={`${inputCls} ps-9`} type="search" />
      </form>
      <Tabs value={category} onChange={setCategory} items={[{ id: 'all', label: t('All topics') }, ...FORUM_CATEGORIES.map(c => ({ id: c.id, label: t(c.label) }))]} />
      <div className="flex gap-2 flex-wrap">
        <select value={team} onChange={e => setTeam(e.target.value)} className="min-h-[40px] px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-200" aria-label={t('Team')}>
          <option value="all">{t('All teams')}</option>
          {teams.map(x => (
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} className="min-h-[40px] px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-200" aria-label={t('Sort')}>
          <option value="active">{t('Latest activity')}</option>
          <option value="new">{t('Newest')}</option>
          <option value="top">{t('Top')}</option>
        </select>
      </div>
      {threads.error ? (
        <ErrorBox message={threads.error} onRetry={threads.reload} />
      ) : threads.loading && !threads.data ? (
        <Spinner />
      ) : (threads.data?.threads || []).length ? (
        <div className="space-y-2">
          {threads.data!.threads.map(th => (
            <Link key={th.id} to={`/forum/${th.id}`} className="block" data-testid="thread-row">
              <Card className="p-4 hover:border-slate-600 flex gap-3">
                <Avatar name={th.userName} src={th.userAvatar} size={38} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {th.pinned && <Pin className="w-3.5 h-3.5 text-amber-400" />}
                    {th.locked && <Lock className="w-3.5 h-3.5 text-slate-500" />}
                    <span className="font-bold text-white break-words">{th.title}</span>
                    {th.hidden && <Pill tone="red">{t('Hidden')}</Pill>}
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-0.5 break-words">{th.content}</p>
                  <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-2 flex-wrap">
                    <span>{th.userName}{th.userBadge ? ` · ${t(th.userBadge)}` : ''}</span>
                    <span>{t(FORUM_CATEGORIES.find(c => c.id === th.category)?.label || 'General')}</span>
                    {th.teamId && <span style={{ color: teamById(th.teamId)?.color }}>● {teamById(th.teamId)?.short}</span>}
                    <span>{f.ago(th.lastActivityAt)}</span>
                  </p>
                </div>
                <div className="text-end shrink-0 text-xs text-slate-400 space-y-1">
                  <span className="flex items-center gap-1 justify-end"><MessageSquare className="w-3.5 h-3.5" /> {th.commentsCount}</span>
                  <span className="block">▲ {th.upvotes}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={<MessageSquare className="w-6 h-6" />} title={search ? t('No threads match your search') : t('No threads here yet')} body={t('Start the conversation: squads, predictions, matchday chat.')} action={<Button onClick={startThread}>{t('New thread')}</Button>} />
      )}
      <NewThreadModal open={newOpen} onClose={() => { setNewOpen(false); if (wantsNew) navigate('/forum', { replace: true, keepScroll: true }); }} preset={preset} />
    </div>
  );
}

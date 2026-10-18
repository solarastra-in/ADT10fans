import React, { useState } from 'react';
import { EyeOff, Lock, Pencil, Pin, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, navigate, usePageMeta } from '../router';
import { Avatar, Button, Card, ErrorBox, Notice, Pill, Spinner, TeamBadge, inputCls, useFormat } from '../components/ui';
import { FORUM_CATEGORIES, Reactions, ReportButton, VoteButton } from '../components/forum';

export default function ThreadPage({ id }: { id: string }) {
  const { user, teamById, matches, openAuth, setUser, toast, config } = useApp();
  const t = useT();
  const f = useFormat();
  const { data, setData, error, loading, reload } = useLoad(() => api.getForumThreadDetail(id), [id, user?.id]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: '', content: '' });
  usePageMeta(data?.thread.title, data?.thread.content.slice(0, 150), config?.brandName);
  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox message={error || t('Thread not found')} onRetry={reload} />;
  const th = data.thread;
  const mine = user?.id === th.userId;
  const canEdit = mine && Date.now() - +new Date(th.createdAt) < 24 * 3600_000;
  const match = matches.find(m => m.id === th.matchId);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return openAuth(t('Sign in to reply.'));
    setBusy(true);
    try {
      const r = await api.addForumComment(th.id, reply);
      setUser(r.user);
      setData({ ...data, thread: { ...data.thread, commentsCount: r.thread.commentsCount }, comments: [...data.comments, r.comment] });
      setReply('');
      if (r.pointsAdded) toast(t('Reply posted: +{n} points', { n: r.pointsAdded }));
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const saveEdit = async () => {
    try {
      const r = await api.editForumThread(th.id, draft);
      setData({ ...data, thread: { ...data.thread, ...r.thread } });
      setEditing(false);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  const delThread = async () => {
    if (!confirm(t('Delete this thread and all its replies?'))) return;
    await api.deleteOwnThread(th.id);
    toast(t('Thread deleted'));
    navigate('/forum');
  };
  const moderate = async (action: 'pin' | 'lock' | 'hide', value: boolean) => {
    await api.moderateThread(th.id, action, value);
    reload();
  };
  const delComment = async (cid: string) => {
    if (!confirm(t('Delete this reply?'))) return;
    await api.deleteOwnComment(cid);
    setData({ ...data, comments: data.comments.filter(c => c.id !== cid) });
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <nav className="text-xs text-slate-500">
        <Link to="/forum" className="hover:text-white">{t('Forum')}</Link> / {t(FORUM_CATEGORIES.find(c => c.id === th.category)?.label || 'General')}
      </nav>
      <Card as="article" className="p-5 space-y-3" data-testid="thread">
        <div className="flex flex-wrap gap-1.5">
          {th.pinned && <Pill tone="amber"><Pin className="w-3 h-3" /> {t('Pinned')}</Pill>}
          {th.locked && <Pill><Lock className="w-3 h-3" /> {t('Locked')}</Pill>}
          {th.hidden && <Pill tone="red">{t('Hidden')}</Pill>}
          {th.teamId && teamById(th.teamId) && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 border border-slate-700 text-white">
              <TeamBadge team={teamById(th.teamId)} size="sm" />
              <span>{teamById(th.teamId)?.name}</span>
            </span>
          )}
          {match && (
            <Link to={`/matches/${match.id}`}>
              <Pill tone="blue">{t('Match {n}', { n: match.matchNo })}</Pill>
            </Link>
          )}
        </div>
        {editing ? (
          <div className="space-y-2">
            <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} className={inputCls} />
            <textarea value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })} className={`${inputCls} min-h-[140px]`} />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit}>{t('Save')}</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>{t('Cancel')}</Button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-xl sm:text-2xl font-black text-white break-words">{th.title}</h1>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Avatar name={th.userName} src={th.userAvatar} size={28} />
              <span className="font-bold text-slate-200">{th.userName}</span>
              {th.userBadge && <Pill tone="amber">{t(th.userBadge)}</Pill>}
              <span>· {f.ago(th.createdAt)}{th.editedAt ? ` · ${t('edited')}` : ''}</span>
            </div>
            <p className="text-[15px] text-slate-200 whitespace-pre-wrap break-words leading-relaxed">{th.content}</p>
          </>
        )}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <VoteButton kind="threads" id={th.id} upvotes={th.upvotes} upvoted={th.upvoted} />
          <Reactions kind="threads" id={th.id} initial={th.reactions} />
          <span className="ms-auto flex items-center gap-1">
            {canEdit && !editing && (
              <button type="button" className="inline-flex items-center gap-1 min-h-[32px] px-2 text-xs text-slate-400 hover:text-white" onClick={() => { setDraft({ title: th.title, content: th.content }); setEditing(true); }}>
                <Pencil className="w-3.5 h-3.5" /> {t('Edit')}
              </button>
            )}
            {(mine || data.canModerate) && (
              <button type="button" className="inline-flex items-center gap-1 min-h-[32px] px-2 text-xs text-slate-400 hover:text-red-300" onClick={delThread}>
                <Trash2 className="w-3.5 h-3.5" /> {t('Delete')}
              </button>
            )}
            {!mine && <ReportButton kind="threads" id={th.id} />}
          </span>
        </div>
        {data.canModerate && (
          <div className="flex gap-2 flex-wrap pt-2 border-t border-slate-800">
            <Button size="sm" variant="secondary" onClick={() => moderate('pin', !th.pinned)}><Pin className="w-3.5 h-3.5" /> {th.pinned ? t('Unpin') : t('Pin')}</Button>
            <Button size="sm" variant="secondary" onClick={() => moderate('lock', !th.locked)}><Lock className="w-3.5 h-3.5" /> {th.locked ? t('Unlock') : t('Lock')}</Button>
            <Button size="sm" variant="secondary" onClick={() => moderate('hide', !th.hidden)}><EyeOff className="w-3.5 h-3.5" /> {th.hidden ? t('Unhide') : t('Hide')}</Button>
          </div>
        )}
      </Card>

      <h2 className="text-sm font-black text-slate-300 pt-2">{t('{n} replies', { n: data.comments.length })}</h2>
      <div className="space-y-2">
        {data.comments.map(c => (
          <Card key={c.id} className="p-4 space-y-2" data-testid="comment">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Avatar name={c.userName} src={c.userAvatar} size={26} />
              <span className="font-bold text-slate-200">{c.userName}</span>
              {c.userBadge && <Pill tone="amber">{t(c.userBadge)}</Pill>}
              {c.teamId && teamById(c.teamId) && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-300">
                  <TeamBadge team={teamById(c.teamId)} size="sm" />
                  <span>{teamById(c.teamId)?.name}</span>
                </span>
              )}
              <span>· {f.ago(c.createdAt)}</span>
              {c.hidden && <Pill tone="red">{t('Hidden')}</Pill>}
            </div>
            <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{c.content}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <VoteButton kind="comments" id={c.id} upvotes={c.upvotes} upvoted={c.upvoted} />
              <Reactions kind="comments" id={c.id} initial={c.reactions} />
              <span className="ms-auto flex items-center gap-1">
                {(c.userId === user?.id || data.canModerate) && (
                  <button type="button" className="inline-flex items-center gap-1 min-h-[32px] px-2 text-xs text-slate-500 hover:text-red-300" onClick={() => delComment(c.id)}>
                    <Trash2 className="w-3.5 h-3.5" /> {t('Delete')}
                  </button>
                )}
                {c.userId !== user?.id && <ReportButton kind="comments" id={c.id} />}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {th.locked ? (
        <Notice>{t('This thread is locked. New replies are closed.')}</Notice>
      ) : user ? (
        <form onSubmit={send} className="space-y-2" data-testid="reply-form">
          <textarea value={reply} onChange={e => setReply(e.target.value)} className={`${inputCls} min-h-[100px]`} placeholder={t('Write a reply…')} required minLength={2} maxLength={3000} name="reply" />
          <Button type="submit" loading={busy}>{t('Reply')}</Button>
        </form>
      ) : (
        <Card className="p-6 border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <img
              src="/logos/adt10.png"
              alt="Abu Dhabi T10"
              className="w-10 h-10 object-contain rounded-xl p-0.5 bg-slate-950 border border-amber-400/40"
            />
            <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Lock className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-base font-black text-white">{t('Public Discussion — Sign in to participate')}</h3>
          <p className="text-xs text-slate-300 max-w-md mx-auto">
            {t('Forums are open for everyone to read. Sign in with your account to post replies, upvote strategies, and earn fan points.')}
          </p>
          <Button onClick={() => openAuth(t('Sign in to reply.'))} className="font-bold border-amber-400 text-slate-950 bg-amber-400 hover:bg-amber-300">
            {t('Sign in to reply')}
          </Button>
        </Card>
      )}
    </div>
  );
}

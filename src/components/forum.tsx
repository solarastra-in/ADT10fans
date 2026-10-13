import React, { useState } from 'react';
import { ArrowBigUp, Flag, SmilePlus } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../state';
import { useT } from '../i18n';
import { cx, Modal, Button, inputCls } from './ui';
import type { Reaction } from '../types';

export const REACTIONS = ['👏', '🔥', '😂', '😮', '💯'];
export const FORUM_CATEGORIES: { id: string; label: string }[] = [
  { id: 'matchday', label: 'Matchday' },
  { id: 'tactics', label: 'Tactics' },
  { id: 'franchises', label: 'Teams' },
  { id: 'fantasy', label: 'Dream XI' },
  { id: 'fanspaces', label: 'Fan Spaces' },
  { id: 'giveaways', label: 'Prizes' },
  { id: 'general', label: 'General' },
];

export function VoteButton({ kind, id, upvotes, upvoted }: { kind: 'threads' | 'comments'; id: string; upvotes: number; upvoted?: boolean }) {
  const { user, openAuth, toast } = useApp();
  const t = useT();
  const [state, setState] = useState({ n: upvotes, on: Boolean(upvoted) });
  const click = async () => {
    if (!user) return openAuth(t('Sign in to vote.'));
    try {
      const r = kind === 'threads' ? await api.upvoteForumThread(id) : await api.upvoteForumComment(id);
      setState({ n: r.upvotes, on: r.upvoted });
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  return (
    <button type="button" onClick={click} className={cx('inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg text-xs font-bold border', state.on ? 'bg-amber-400/15 border-amber-400/50 text-amber-300' : 'border-slate-700 text-slate-300 hover:text-white')} aria-pressed={state.on} aria-label={t('Upvote')} data-testid="upvote">
      <ArrowBigUp className={cx('w-4 h-4', state.on && 'fill-amber-400')} /> {state.n}
    </button>
  );
}

export function Reactions({ kind, id, initial }: { kind: 'threads' | 'comments'; id: string; initial?: Reaction[] }) {
  const { user, openAuth, toast } = useApp();
  const t = useT();
  const [list, setList] = useState<Reaction[]>(initial || []);
  const [picker, setPicker] = useState(false);
  const react = async (emoji: string) => {
    if (!user) return openAuth(t('Sign in to react.'));
    setPicker(false);
    try {
      const r = await api.react(kind, id, emoji);
      setList(r.reactions);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  return (
    <div className="relative inline-flex items-center gap-1 flex-wrap">
      {list.map(r => (
        <button key={r.emoji} type="button" onClick={() => react(r.emoji)} className={cx('inline-flex items-center gap-1 min-h-[32px] px-2 rounded-lg text-xs border', r.mine ? 'border-amber-400/50 bg-amber-400/10 text-amber-200' : 'border-slate-700 text-slate-300')} aria-pressed={r.mine}>
          <span aria-hidden>{r.emoji}</span> {r.count}
        </button>
      ))}
      <button type="button" onClick={() => setPicker(p => !p)} className="inline-flex items-center justify-center min-h-[32px] w-9 rounded-lg border border-slate-700 text-slate-400 hover:text-white" aria-label={t('Add reaction')} data-testid="react-button">
        <SmilePlus className="w-4 h-4" />
      </button>
      {picker && (
        <div className="absolute z-20 bottom-full mb-1 start-0 flex gap-1 p-1.5 rounded-xl bg-slate-900 border border-slate-700 shadow-xl">
          {REACTIONS.map(e => (
            <button key={e} type="button" onClick={() => react(e)} className="w-10 h-10 rounded-lg hover:bg-slate-800 text-lg" data-emoji={e}>
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReportButton({ kind, id }: { kind: 'threads' | 'comments'; id: string }) {
  const { user, openAuth, toast } = useApp();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('Abusive or hateful');
  const [busy, setBusy] = useState(false);
  const reasons = ['Abusive or hateful', 'Spam or advertising', 'Off-topic', 'Misinformation', 'Other'];
  const send = async () => {
    setBusy(true);
    try {
      const r = await api.report(kind, id, reason);
      toast(r.message);
      setOpen(false);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" onClick={() => (user ? setOpen(true) : openAuth(t('Sign in to report posts.')))} className="inline-flex items-center gap-1 min-h-[32px] px-2 rounded-lg text-xs text-slate-500 hover:text-red-300" data-testid="report">
        <Flag className="w-3.5 h-3.5" /> {t('Report')}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('Report this post')}>
        <div className="space-y-3">
          <select value={reason} onChange={e => setReason(e.target.value)} className={inputCls}>
            {reasons.map(r => (
              <option key={r} value={r}>
                {t(r)}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400">{t('Moderators review every report. Posts reported by several fans are hidden until reviewed.')}</p>
          <Button onClick={send} loading={busy} className="w-full">
            {t('Send report')}
          </Button>
        </div>
      </Modal>
    </>
  );
}

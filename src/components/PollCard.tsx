import React, { useState } from 'react';
import { BarChart3, Check } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../state';
import { useT } from '../i18n';
import { Card, cx, useFormat } from './ui';
import type { PollView } from '../types';

export function PollCard({ poll: initial }: { poll: PollView }) {
  const { user, openAuth, teamById, toast } = useApp();
  const t = useT();
  const f = useFormat();
  const [poll, setPoll] = useState(initial);
  const [busy, setBusy] = useState(false);
  const showResults = Boolean(poll.myVote) || poll.status === 'closed';
  const team = teamById(poll.teamId);

  const vote = async (optionId: string) => {
    if (!user) return openAuth(t('Sign in to vote.'));
    setBusy(true);
    try {
      const r = await api.votePoll(poll.id, optionId);
      setPoll(r.poll);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4 space-y-3" data-testid="poll-card">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <BarChart3 className="w-4 h-4 text-amber-400" />
        <span className="font-bold uppercase tracking-wider">{t('Poll')}</span>
        {team && <span>· {team.name}</span>}
        <span className="ms-auto">{poll.status === 'closed' ? t('Closed') : poll.closesAt ? t('Closes {when}', { when: f.dateTime(poll.closesAt) }) : ''}</span>
      </div>
      <p className="font-bold text-white break-words">{poll.question}</p>
      <div className="space-y-2">
        {poll.options.map(o => {
          const mine = poll.myVote === o.id;
          return showResults ? (
            <button key={o.id} type="button" disabled={busy || poll.status === 'closed'} onClick={() => vote(o.id)} className="relative w-full min-h-[44px] rounded-xl bg-slate-950/70 border border-slate-800 overflow-hidden text-start disabled:cursor-default">
              <span className={cx('absolute inset-y-0 start-0', mine ? 'bg-amber-400/25' : 'bg-slate-700/40')} style={{ width: `${o.pct}%` }} />
              <span className="relative flex items-center gap-2 px-3 py-2 text-sm">
                {mine && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                <span className="flex-1 min-w-0 break-words font-semibold text-white">{o.text}</span>
                <span className="font-black tabular-nums text-slate-200">{o.pct}%</span>
              </span>
            </button>
          ) : (
            <button key={o.id} type="button" disabled={busy} onClick={() => vote(o.id)} className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 hover:border-amber-400/60 text-sm font-semibold text-white text-start break-words" data-testid="poll-option">
              {o.text}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500">{t('{n} votes', { n: poll.total })}{poll.myVote && poll.status === 'open' ? ` · ${t('Tap another option to change your vote')}` : ''}</p>
    </Card>
  );
}

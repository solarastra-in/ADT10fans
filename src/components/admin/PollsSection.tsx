import React, { useEffect, useState } from 'react';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { api } from '../../api';
import type { Match, PollView, Team } from '../../types';
import { Actions, Button, Card, Chip, EmptyState, Errors, Field, Notice, SectionHeader, Select, Sheet, TextInput, fromLocalInput, toLocalInput, useRunner } from './ui';

type Draft = { id?: string; question: string; options: string[]; teamId: string; matchId: string; closesAt: string; status: 'open' | 'closed'; locked: boolean };

export const PollsSection: React.FC<{ teams: Team[]; matches: Match[]; isTeamOfficial?: boolean }> = ({ teams, matches, isTeamOfficial }) => {
  const [polls, setPolls] = useState<PollView[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const { busy, notice, setNotice, run } = useRunner();
  const load = async () => {
    const r = await api.getPolls(isTeamOfficial && teams[0] ? { teamId: teams[0].id } : undefined).catch(() => null);
    if (r) setPolls(r.polls);
  };
  useEffect(() => {
    load();
  }, []);
  const blank = (): Draft => ({ question: '', options: ['', ''], teamId: isTeamOfficial ? teams[0]?.id || '' : '', matchId: '', closesAt: '', status: 'open', locked: false });
  const save = async () => {
    if (!draft) return;
    const opts = draft.options.map(o => o.trim()).filter(Boolean);
    const e: Errors = {};
    if (draft.question.trim().length < 5) e.question = 'Write the question.';
    if (opts.length < 2 || opts.length > 6) e.options = 'Give 2 to 6 options.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const r = await run('save', () => api.savePoll({ id: draft.id, question: draft.question.trim(), options: opts, teamId: draft.teamId || null, matchId: draft.matchId || null, closesAt: draft.closesAt ? fromLocalInput(draft.closesAt) : undefined, status: draft.status }), 'Poll saved.');
    if (r) {
      setDraft(null);
      load();
    }
  };
  const remove = async (p: PollView) => {
    if (!window.confirm('Delete this poll and its votes?')) return;
    if (await run(`del:${p.id}`, () => api.deletePoll(p.id), 'Poll deleted.')) load();
  };
  const teamName = (id: string | null) => (id ? teams.find(t => t.id === id)?.name || id : 'Everyone');
  return (
    <div className="space-y-5">
      <SectionHeader title="Polls" description="Quick polls shown on the forum, team pages and match pages. Fans can change their vote until the poll closes." actions={<Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => { setErrors({}); setDraft(blank()); }}>New poll</Button>} />
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {polls.length === 0 ? (
        <EmptyState title="No polls yet" description="Ask fans who will top-score tonight, their player of the season, or which Fan Space they'll visit." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {polls.map(p => (
            <Card key={p.id}>
              <div className="flex flex-wrap gap-2 items-center">
                <Chip tone={p.status === 'open' ? 'green' : 'slate'}>{p.status}</Chip>
                <Chip>{teamName(p.teamId)}</Chip>
                {p.matchId && <Chip tone="blue">Match {matches.find(m => m.id === p.matchId)?.matchNo}</Chip>}
                <Chip>{p.total} votes</Chip>
              </div>
              <p className="font-bold text-white mt-2">{p.question}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {p.options.map(o => (
                  <li key={o.id} className="flex justify-between gap-2"><span className="text-slate-300">{o.text}</span><span className="font-mono text-amber-300">{o.pct}% ({o.votes})</span></li>
                ))}
              </ul>
              <Actions className="mt-3">
                <Button size="sm" icon={<Edit3 className="w-4 h-4" />} onClick={() => { setErrors({}); setDraft({ id: p.id, question: p.question, options: p.options.map(o => o.text), teamId: p.teamId || '', matchId: p.matchId || '', closesAt: toLocalInput(p.closesAt), status: p.status, locked: p.total > 0 }); }}>Edit</Button>
                <Button size="sm" variant="danger" icon={<Trash2 className="w-4 h-4" />} loading={busy === `del:${p.id}`} onClick={() => remove(p)}>Delete</Button>
              </Actions>
            </Card>
          ))}
        </div>
      )}
      <Sheet open={!!draft} title={draft?.id ? 'Edit poll' : 'New poll'} onClose={() => setDraft(null)} footer={<><Button onClick={() => setDraft(null)}>Cancel</Button><Button variant="primary" onClick={save} loading={busy === 'save'}>Save poll</Button></>}>
        {draft && (
          <div className="space-y-3">
            <Field label="Question" required error={errors.question}><TextInput value={draft.question} onChange={e => setDraft({ ...draft, question: e.target.value })} error={!!errors.question} /></Field>
            <Field label="Options" required error={errors.options} hint={draft.locked ? 'Options cannot change once fans have voted.' : '2 to 6 options'}>
              <div className="space-y-2">
                {draft.options.map((o, i) => (
                  <div key={i} className="flex gap-2">
                    <TextInput value={o} disabled={draft.locked} onChange={e => setDraft({ ...draft, options: draft.options.map((x, j) => (j === i ? e.target.value : x)) })} aria-label={`Option ${i + 1}`} />
                    {!draft.locked && draft.options.length > 2 && <Button variant="ghost" onClick={() => setDraft({ ...draft, options: draft.options.filter((_, j) => j !== i) })} aria-label="Remove option"><Trash2 className="w-4 h-4" /></Button>}
                  </div>
                ))}
                {!draft.locked && draft.options.length < 6 && <Button size="sm" onClick={() => setDraft({ ...draft, options: [...draft.options, ''] })}>Add option</Button>}
              </div>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Team"><Select value={draft.teamId} onChange={e => setDraft({ ...draft, teamId: e.target.value })} disabled={isTeamOfficial}>{!isTeamOfficial && <option value="">Everyone</option>}{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
              <Field label="Match (optional)"><Select value={draft.matchId} onChange={e => setDraft({ ...draft, matchId: e.target.value })}><option value="">None</option>{matches.map(m => <option key={m.id} value={m.id}>Match {m.matchNo}</option>)}</Select></Field>
              <Field label="Closes at (optional)"><TextInput type="datetime-local" value={draft.closesAt} onChange={e => setDraft({ ...draft, closesAt: e.target.value })} /></Field>
              <Field label="Status"><Select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as any })}><option value="open">Open</option><option value="closed">Closed</option></Select></Field>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
};

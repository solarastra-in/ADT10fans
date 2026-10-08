import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Edit3, Lock, Unlock, Gavel, X } from 'lucide-react';
import { Contest, ContestQuestion, Match, Team } from '../../types';
import { api } from '../../api';
import {
  Actions,
  Button,
  Card,
  Checkbox,
  Chip,
  EmptyState,
  Errors,
  Field,
  Notice,
  SectionHeader,
  Select,
  Sheet,
  TextArea,
  TextInput,
  formatDateTime,
  fromLocalInput,
  statusTone,
  toLocalInput,
  toNumber,
  useRunner,
} from './ui';
import { teamName } from './shared';

type Q = { id: string; prompt: string; options: string[]; points: string; answer: string; explain: string };
type Draft = {
  id?: string;
  type: Contest['type'];
  title: string;
  description: string;
  prize: string;
  matchId: string;
  locksAt: string;
  instant: boolean;
  questions: Q[];
};

const newQ = (): Q => ({ id: `q-${Math.random().toString(36).slice(2, 8)}`, prompt: '', options: ['', ''], points: '10', answer: '', explain: '' });

const blank = (): Draft => ({ type: 'predictor', title: '', description: '', prize: '', matchId: '', locksAt: '', instant: false, questions: [newQ()] });

const validate = (d: Draft): Errors => {
  const e: Errors = {};
  if (!d.title.trim()) e.title = 'Title is required.';
  if (d.locksAt && !fromLocalInput(d.locksAt)) e.locksAt = 'Invalid date.';
  if (d.questions.length === 0) e.questions = 'Add at least one question.';
  d.questions.forEach((q, i) => {
    if (!q.prompt.trim()) e[`q.${i}.prompt`] = 'Question text is required.';
    const opts = q.options.map(o => o.trim()).filter(Boolean);
    if (opts.length < 2) e[`q.${i}.options`] = 'Add at least two non-empty options.';
    else if (new Set(opts.map(o => o.toLowerCase())).size !== opts.length) e[`q.${i}.options`] = 'Options must be unique.';
    if (!(toNumber(q.points, -1) > 0)) e[`q.${i}.points`] = 'Points must be more than 0.';
    if (d.instant && !q.answer) e[`q.${i}.answer`] = 'Instant trivia needs a correct answer.';
    if (q.answer && !opts.includes(q.answer)) e[`q.${i}.answer`] = 'Correct answer must be one of the options.';
  });
  return e;
};

export const ContestsSection: React.FC<{ contests: Contest[]; matches: Match[]; teams: Team[]; onRefreshAll: () => Promise<void> }> = ({
  contests: propContests,
  matches,
  teams,
  onRefreshAll,
}) => {
  const { busy, notice, setNotice, run } = useRunner();
  const [contests, setContests] = useState<Contest[]>(propContests);
  const [entryCounts, setEntryCounts] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [settling, setSettling] = useState<Contest | null>(null);
  const [settleAnswers, setSettleAnswers] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await api.getContests();
      setContests(res.contests || []);
      setEntryCounts(res.entryCounts || {});
    } catch {
      /* fall back to props */
    }
  }, []);

  useEffect(() => setContests(propContests), [propContests]);
  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    await Promise.all([load(), onRefreshAll()]);
  };

  const matchLabel = (id?: string) => {
    const m = matches.find(x => x.id === id);
    return m ? `#${m.matchNo} ${teamName(teams, m.teamA)} vs ${teamName(teams, m.teamB)}` : '';
  };

  const openEdit = (c: Contest) => {
    setErrors({});
    setDraft({
      id: c.id,
      type: c.type,
      title: c.title || '',
      description: c.description || '',
      prize: c.prize || '',
      matchId: c.matchId || '',
      locksAt: toLocalInput(c.locksAt),
      instant: !!c.instant,
      questions: (c.questions || []).map(q => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options.length >= 2 ? [...q.options] : [...q.options, ...Array(2 - q.options.length).fill('')],
        points: String(q.points ?? ''),
        answer: q.answer || '',
        explain: q.explain || '',
      })),
    });
  };

  const setQ = (i: number, patch: Partial<Q>) => draft && setDraft({ ...draft, questions: draft.questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)) });

  const save = async () => {
    if (!draft) return;
    const e = validate(draft);
    setErrors(e);
    if (Object.keys(e).length) return;
    const payload = {
      id: draft.id,
      type: draft.type,
      title: draft.title.trim(),
      description: draft.description.trim(),
      prize: draft.prize.trim(),
      matchId: draft.matchId || null,
      locksAt: fromLocalInput(draft.locksAt) || null,
      instant: draft.instant,
      questions: draft.questions.map(q => {
        const out: ContestQuestion = {
          id: q.id,
          prompt: q.prompt.trim(),
          options: q.options.map(o => o.trim()).filter(Boolean),
          points: toNumber(q.points, 0),
        };
        if (q.answer) out.answer = q.answer;
        if (q.explain.trim()) out.explain = q.explain.trim();
        return out;
      }),
      ...(draft.id ? {} : { status: 'open' as const }),
    };
    const res = await run('save', () => api.saveContest(payload), 'Contest saved.');
    if (res) {
      setDraft(null);
      await refresh();
    }
  };

  const toggleLock = async (c: Contest) => {
    const next = c.status === 'open' ? 'locked' : 'open';
    const res = await run(`lock:${c.id}`, () => api.toggleContestStatus(c.id, next), next === 'locked' ? 'Contest locked.' : 'Contest reopened.');
    if (res) await refresh();
  };

  const openSettle = (c: Contest) => {
    const initial: Record<string, string> = {};
    c.questions.forEach(q => {
      if (q.answer) initial[q.id] = q.answer;
    });
    setSettleAnswers(initial);
    setErrors({});
    setSettling(c);
  };

  const settle = async () => {
    if (!settling) return;
    const e: Errors = {};
    settling.questions.forEach(q => {
      if (!settleAnswers[q.id]) e[q.id] = 'Pick the correct answer.';
    });
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!window.confirm('Settle this contest? Points are awarded to entrants and a notification is sent. This cannot be undone.')) return;
    const res = await run(
      'settle',
      () => api.settleContest(settling.id, settleAnswers),
      r => `Settled: ${r.settledEntriesCount} winning entr${r.settledEntriesCount === 1 ? 'y' : 'ies'}, ${r.totalPointsDistributed} points awarded.`
    );
    if (res) {
      setSettling(null);
      await refresh();
    }
  };

  const remove = async (c: Contest) => {
    if (!window.confirm(`Delete "${c.title}"? Entries for it will no longer be shown.`)) return;
    const res = await run(`del:${c.id}`, () => api.deleteContest(c.id), 'Contest deleted.');
    if (res) await refresh();
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Contests"
        description="Predictors and trivia. Instant trivia is graded by the server using the correct answers you set."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setErrors({});
              setDraft(blank());
            }}
          >
            New contest
          </Button>
        }
      />
      <Notice notice={notice} onClose={() => setNotice(null)} />

      {contests.length === 0 ? (
        <EmptyState title="No contests yet" description="Create a predictor or trivia contest." />
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {contests.map(c => (
            <li key={c.id}>
              <Card className="flex flex-col gap-2 h-full">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone={statusTone(c.status)}>{c.status}</Chip>
                  <Chip>{c.type}</Chip>
                  {c.instant && <Chip tone="violet">instant</Chip>}
                  <Chip tone="slate">{entryCounts[c.id] ?? 0} entries</Chip>
                </div>
                <p className="font-bold text-white break-words">{c.title}</p>
                {c.prize && <p className="text-sm text-amber-300 break-words">Prize: {c.prize}</p>}
                <p className="text-xs text-slate-400">
                  {c.questions.length} question{c.questions.length === 1 ? '' : 's'}
                  {c.matchId ? ` · ${matchLabel(c.matchId)}` : ''}
                  {c.locksAt ? ` · locks ${formatDateTime(c.locksAt)}` : ''}
                </p>
                <Actions className="mt-auto pt-1">
                  {c.status !== 'settled' && (
                    <>
                      <Button size="sm" icon={<Edit3 className="w-4 h-4" />} onClick={() => openEdit(c)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        icon={c.status === 'open' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        loading={busy === `lock:${c.id}`}
                        onClick={() => toggleLock(c)}
                      >
                        {c.status === 'open' ? 'Lock' : 'Unlock'}
                      </Button>
                      {!c.instant && (
                        <Button size="sm" variant="primary" icon={<Gavel className="w-4 h-4" />} onClick={() => openSettle(c)}>
                          Settle
                        </Button>
                      )}
                    </>
                  )}
                  <Button size="sm" variant="danger" icon={<Trash2 className="w-4 h-4" />} loading={busy === `del:${c.id}`} onClick={() => remove(c)}>
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
        wide
        title={draft?.id ? 'Edit contest' : 'New contest'}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={busy === 'save'}>
              Save contest
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-5">
            {Object.keys(errors).length > 0 && <Notice notice={{ kind: 'err', text: 'Please fix the highlighted fields.' }} />}
            {draft.id && (entryCounts[draft.id] ?? 0) > 0 && (
              <Notice notice={{ kind: 'warn', text: 'Fans have already entered this contest. Changing options may invalidate their answers.' }} />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Title" required error={errors.title} className="sm:col-span-2">
                <TextInput value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} error={!!errors.title} />
              </Field>
              <Field label="Type">
                <Select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as Contest['type'] })}>
                  <option value="predictor">Match predictor</option>
                  <option value="sixes">Sixes</option>
                  <option value="captain">Captain pick</option>
                  <option value="season">Season-long</option>
                  <option value="trivia">Trivia</option>
                </Select>
              </Field>
              <Field label="Linked match">
                <Select value={draft.matchId} onChange={e => setDraft({ ...draft, matchId: e.target.value })}>
                  <option value="">None</option>
                  {matches.map(m => (
                    <option key={m.id} value={m.id}>
                      {matchLabel(m.id)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Locks at (your local time)" error={errors.locksAt} hint="Optional. Entries close at this time.">
                <TextInput type="datetime-local" value={draft.locksAt} onChange={e => setDraft({ ...draft, locksAt: e.target.value })} error={!!errors.locksAt} />
              </Field>
              <Field label="Prize" hint="Only list prizes that are actually on offer">
                <TextInput value={draft.prize} onChange={e => setDraft({ ...draft, prize: e.target.value })} />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <TextArea rows={2} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <Checkbox
                  label="Instant trivia"
                  hint="Graded immediately on entry using the correct answers below."
                  checked={draft.instant}
                  onChange={v => setDraft({ ...draft, instant: v })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-extrabold text-white">Questions ({draft.questions.length})</h4>
                <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setDraft({ ...draft, questions: [...draft.questions, newQ()] })}>
                  Add question
                </Button>
              </div>
              {errors.questions && <p className="text-xs font-semibold text-rose-400">{errors.questions}</p>}
              {draft.questions.map((q, i) => {
                const opts = q.options.map(o => o.trim()).filter(Boolean);
                return (
                  <div key={q.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-amber-300">Question {i + 1}</span>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<Trash2 className="w-4 h-4" />}
                        onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, idx) => idx !== i) })}
                      >
                        Remove
                      </Button>
                    </div>
                    <Field label="Question" required error={errors[`q.${i}.prompt`]}>
                      <TextInput value={q.prompt} onChange={e => setQ(i, { prompt: e.target.value })} error={!!errors[`q.${i}.prompt`]} />
                    </Field>
                    <Field label="Options (at least 2)" required error={errors[`q.${i}.options`]}>
                      <div className="space-y-2">
                        {q.options.map((o, oi) => (
                          <div key={oi} className="flex gap-2">
                            <TextInput
                              value={o}
                              placeholder={`Option ${oi + 1}`}
                              onChange={e => {
                                const options = q.options.map((x, xi) => (xi === oi ? e.target.value : x));
                                setQ(i, { options, answer: q.answer === o ? e.target.value.trim() : q.answer });
                              }}
                            />
                            <button
                              type="button"
                              aria-label={`Remove option ${oi + 1}`}
                              disabled={q.options.length <= 2}
                              onClick={() => setQ(i, { options: q.options.filter((_, xi) => xi !== oi), answer: q.answer === o.trim() ? '' : q.answer })}
                              className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-30"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <Button size="sm" variant="ghost" icon={<Plus className="w-4 h-4" />} onClick={() => setQ(i, { options: [...q.options, ''] })}>
                          Add option
                        </Button>
                      </div>
                    </Field>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Points" required error={errors[`q.${i}.points`]}>
                        <TextInput type="number" inputMode="numeric" min={1} value={q.points} onChange={e => setQ(i, { points: e.target.value })} error={!!errors[`q.${i}.points`]} />
                      </Field>
                      <Field
                        label={draft.instant ? 'Correct answer' : 'Correct answer (optional)'}
                        required={draft.instant}
                        error={errors[`q.${i}.answer`]}
                        hint={draft.instant ? undefined : 'Usually set when settling'}
                      >
                        <Select value={q.answer} onChange={e => setQ(i, { answer: e.target.value })} error={!!errors[`q.${i}.answer`]}>
                          <option value="">Not set</option>
                          {opts.map(o => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Explanation (optional)" className="sm:col-span-2" hint="Shown after answering trivia">
                        <TextInput value={q.explain} onChange={e => setQ(i, { explain: e.target.value })} />
                      </Field>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Sheet>

      <Sheet
        open={!!settling}
        title={settling ? `Settle: ${settling.title}` : 'Settle'}
        onClose={() => setSettling(null)}
        footer={
          <>
            <Button onClick={() => setSettling(null)}>Cancel</Button>
            <Button variant="primary" onClick={settle} loading={busy === 'settle'} icon={<Gavel className="w-4 h-4" />}>
              Settle & award points
            </Button>
          </>
        }
      >
        {settling && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">Pick the correct answer for every question. {entryCounts[settling.id] ?? 0} entries will be graded.</p>
            {settling.questions.map((q, i) => (
              <Field key={q.id} label={`${i + 1}. ${q.prompt} (${q.points} pts)`} required error={errors[q.id]}>
                <Select value={settleAnswers[q.id] || ''} onChange={e => setSettleAnswers({ ...settleAnswers, [q.id]: e.target.value })} error={!!errors[q.id]}>
                  <option value="">Choose…</option>
                  {q.options.map(o => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
};

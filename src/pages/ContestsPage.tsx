import React, { useState } from 'react';
import { CheckCircle2, Lock, Target, XCircle } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Button, Card, Countdown, EmptyState, ErrorBox, PageHeader, Pill, Spinner, Tabs, TeamBadge, cx } from '../components/ui';
import type { Contest, ContestEntry } from '../types';

function ContestCard({ c, entry, entries, onEntered }: { c: Contest; entry?: ContestEntry; entries: number; onEntered: () => void }) {
  const { user, openAuth, setUser, toast, matches, teamById } = useApp();
  const t = useT();
  const [answers, setAnswers] = useState<Record<string, string>>(entry?.answers || {});
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ id: string; correct: boolean }[] | null>(null);
  const match = matches.find(m => m.id === c.matchId);
  const open = c.status === 'open';
  const settled = c.status === 'settled';
  const editable = open && !(c.instant && entry);

  const submit = async () => {
    if (!user) return openAuth(t('Sign in to enter predictions.'));
    setBusy(true);
    try {
      const r = await api.enterContest(c.id, answers);
      setUser(r.user);
      if (r.results) setResults(r.results);
      toast(c.instant ? t('Quiz done: +{n} points', { n: r.pointsAwarded || 0 }) : entry ? t('Predictions updated') : t('Predictions saved. Points are added when the answers are in.'));
      onEntered();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 space-y-4" data-testid="contest-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1">
            <Pill tone={open ? 'amber' : settled ? 'green' : 'slate'}>{open ? t('Open') : settled ? t('Results in') : t('Locked')}</Pill>
            {c.instant && <Pill tone="blue">{t('Instant quiz')}</Pill>}
            {entry && <Pill tone="green">{t('Entered')}</Pill>}
          </div>
          <h2 className="text-lg font-black text-white break-words mt-1">{c.title}</h2>
          {match && (
            <Link to={`/matches/${match.id}`} className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white mt-1.5 flex-wrap">
              <TeamBadge team={teamById(match.teamA)} size="sm" />
              <span className="font-bold text-white">{teamById(match.teamA)?.name}</span>
              <span className="text-amber-400 font-black">vs</span>
              <TeamBadge team={teamById(match.teamB)} size="sm" />
              <span className="font-bold text-white">{teamById(match.teamB)?.name}</span>
              <span className="text-slate-500">· {t('Match {n}', { n: match.matchNo })}</span>
            </Link>
          )}
          {c.description && <p className="text-sm text-slate-400 mt-1 break-words">{c.description}</p>}
        </div>
        <div className="text-end text-xs text-slate-400 shrink-0">
          {open && c.locksAt && <Countdown to={c.locksAt} prefix="closes in {time}" />}
          <span className="block">{t('{n} entries', { n: entries })}</span>
        </div>
      </div>
      {c.prize && <p className="text-xs font-bold text-amber-300">🎁 {c.prize}</p>}
      <div className="space-y-4">
        {c.questions.map((q, i) => {
          const res = results?.find(r => r.id === q.id);
          // The answer is only sent once it can be shown (settled, or an instant quiz that has closed).
          const correct = q.answer;
          return (
            <fieldset key={q.id} className="space-y-2">
              <legend className="text-sm font-bold text-white">
                {i + 1}. {q.prompt} <span className="text-xs text-amber-400 font-black">+{q.points}</span>
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {q.options.map(o => {
                  const chosen = answers[q.id] === o;
                  const isRight = correct === o;
                  // Right or wrong for the fan's own pick: from the answer when shown, else from their result.
                  const verdict = chosen ? (correct ? isRight : res?.correct) : undefined;
                  return (
                    <label key={o} className={cx('flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-xl border text-sm', editable ? 'cursor-pointer' : 'cursor-default', isRight ? 'border-emerald-500/60 bg-emerald-500/10' : chosen ? 'border-amber-400/70 bg-amber-400/10' : 'border-slate-800 bg-slate-950/60')}>
                      <input type="radio" name={`${c.id}-${q.id}`} className="accent-amber-400" disabled={!editable} checked={chosen} onChange={() => setAnswers({ ...answers, [q.id]: o })} />
                      <span className="flex-1 text-slate-100 break-words">{o}</span>
                      {verdict !== undefined && (verdict ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />)}
                    </label>
                  );
                })}
              </div>
              {correct && q.explain && <p className="text-xs text-slate-400">{q.explain}</p>}
            </fieldset>
          );
        })}
      </div>
      {(settled || c.instant) && entry && <p className="text-sm font-black text-amber-400">{t('You scored {n} points', { n: entry.pointsAwarded || 0 })}</p>}
      {c.instant && entry && !c.questions.some(q => q.answer) && <p className="text-xs text-slate-400">{t('Answers are shown when the quiz closes.')}</p>}
      {editable ? (
        <Button onClick={submit} loading={busy} disabled={Object.keys(answers).length !== c.questions.length} className="w-full sm:w-auto">
          {entry ? t('Update predictions') : c.instant ? t('Submit answers') : t('Lock in predictions')}
        </Button>
      ) : !open && !entry ? (
        <p className="text-xs text-slate-500 inline-flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> {t('Closed')}</p>
      ) : null}
    </Card>
  );
}

export default function ContestsPage() {
  const { user, config } = useApp();
  const t = useT();
  usePageMeta(t('Match predictions and quizzes'), t('Predict results and take instant T10 quizzes for points.'), config?.brandName);
  const { data, error, loading, reload } = useLoad(() => api.getContests(), [user?.id]);
  const [tab, setTab] = useState<'open' | 'mine' | 'results'>('open');
  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox message={error || ''} onRetry={reload} />;
  const entries = new Map(data.myEntries.map(e => [e.contestId, e]));
  const list = data.contests.filter(c => (tab === 'open' ? c.status === 'open' : tab === 'mine' ? entries.has(c.id) : c.status !== 'open'));
  return (
    <div className="space-y-5">
      <PageHeader eyebrow={t('Play')} title={t('Predictions')} subtitle={t('Make your calls before the first ball. Points are added when the answers are confirmed; instant quizzes score straight away.')} />
      <Tabs value={tab} onChange={setTab} items={[{ id: 'open', label: t('Open'), count: data.contests.filter(c => c.status === 'open').length }, { id: 'mine', label: t('My entries'), count: data.myEntries.length }, { id: 'results', label: t('Closed & results') }]} />
      {list.length ? (
        <div className="space-y-4">{list.map(c => <ContestCard key={c.id} c={c} entry={entries.get(c.id)} entries={data.entryCounts[c.id] || 0} onEntered={reload} />)}</div>
      ) : (
        <EmptyState icon={<Target className="w-6 h-6" />} title={tab === 'open' ? t('No open predictions right now') : t('Nothing here yet')} body={t('Predictions open before each match. Meanwhile, try Pick XI or the daily games.')} action={<Link to="/games" className="text-sm font-bold text-amber-400">{t('Daily games')} →</Link>} />
      )}
    </div>
  );
}

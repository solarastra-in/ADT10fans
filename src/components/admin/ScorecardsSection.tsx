import React, { useEffect, useState } from 'react';
import { CheckCircle2, Save } from 'lucide-react';
import { api } from '../../api';
import type { Match, MatchScorecard, OverTally, Team } from '../../types';
import { ScorecardEditor } from './ScorecardEditor';
import { Button, Card, EmptyState, Field, Notice, NoticeState, SectionHeader, Select, TextInput, errorMessage, formatDateTime } from './ui';

/**
 * Enter or upload a match scorecard when live scores are not available. Team admins see their own
 * team's matches; league and super admins every match. "Save and finish the match" marks it
 * completed, which scores Pick XI, Pick 5 and the predictions from this scorecard.
 */
export const ScorecardsSection: React.FC<{ matches: Match[]; teams: Team[]; teamId?: string | null; onSaved?: () => void }> = ({ matches, teams, teamId, onSaved }) => {
  const list = [...matches]
    .filter(m => !teamId || m.teamA === teamId || m.teamB === teamId)
    .filter(m => +new Date(m.startsAt) <= Date.now() + 24 * 3600_000)
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
  const [id, setId] = useState(list.find(m => m.status !== 'completed')?.id || list[0]?.id || '');
  const m = list.find(x => x.id === id);
  const a = teams.find(t => t.id === m?.teamA);
  const b = teams.find(t => t.id === m?.teamB);
  const [card, setCard] = useState<MatchScorecard | undefined>(m?.scorecard);
  const [overs, setOvers] = useState<OverTally[]>(m?.scorecard?.overs || []);
  const [winner, setWinner] = useState(m?.winner || '');
  const [result, setResult] = useState(m?.result || '');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<NoticeState | null>(null);
  useEffect(() => {
    setCard(m?.scorecard);
    setOvers(m?.scorecard?.overs || []);
    setWinner(m?.winner || '');
    setResult(m?.result || '');
  }, [m?.id]);

  const save = async (complete: boolean) => {
    if (!m || (!card && !overs.length)) return;
    if (complete && !window.confirm('Finish the match with this scorecard? Fans get their Pick XI, Pick 5 and prediction points from it. You can correct it later; points are re-scored.')) return;
    setBusy(complete ? 'finish' : 'save');
    try {
      const r = await api.adminSaveScorecard(m.id, { scorecard: { ...(card || {}), overs }, winner: winner || undefined, result: result || undefined, complete });
      setNotice({ kind: 'ok', text: complete ? `Match finished and scored.${r.teamGames?.picksScored ? ` ${r.teamGames.picksScored} Pick 5 team(s) scored.` : ''}${r.fantasy?.scored ? ` ${r.fantasy.scored} Pick XI team(s) scored.` : ''}` : 'Scorecard saved.' });
      onSaved?.();
    } catch (e) {
      setNotice({ kind: 'err', text: errorMessage(e) });
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-4" data-testid="scorecards-section">
      <SectionHeader
        title="Scorecards"
        description="When live scores are not available, enter the scorecard of both innings here, or upload it as a CSV. Points for Pick XI, Pick 5 and predictions come from it."
      />
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {!list.length ? (
        <EmptyState title="No matches to score yet" description="Matches show here from the day before they start." />
      ) : (
        <>
          <Field label="Match" htmlFor="sc-match">
            <Select id="sc-match" value={id} onChange={e => setId(e.target.value)} data-testid="scorecard-match">
              {list.map(x => (
                <option key={x.id} value={x.id}>
                  Match {x.matchNo}: {teams.find(t => t.id === x.teamA)?.short || x.teamA} vs {teams.find(t => t.id === x.teamB)?.short || x.teamB} · {formatDateTime(x.startsAt)} · {x.status}
                  {x.scorecard?.innings1?.batting?.length ? ' · scorecard ✓' : ''}
                </option>
              ))}
            </Select>
          </Field>
          {m && a && b && (
            <Card className="p-4 space-y-4">
              <ScorecardEditor value={card} onChange={setCard} teamA={a} teamB={b} onCsvErrors={errs => errs.length && setNotice({ kind: 'warn', text: `CSV loaded with problems: ${errs.slice(0, 4).join('; ')}` })} />
              <OverTallyEditor
                value={overs}
                onChange={setOvers}
                labels={(() => {
                  const first = card?.innings1?.teamId || (m.firstInnings === 2 ? m.teamB : m.teamA);
                  const second = first === m.teamA ? m.teamB : m.teamA;
                  return [teams.find(x => x.id === first)?.short || first, teams.find(x => x.id === second)?.short || second];
                })()}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Winner" htmlFor="sc-winner">
                  <Select id="sc-winner" value={winner} onChange={e => setWinner(e.target.value)}>
                    <option value="">Not decided</option>
                    <option value={a.id}>{a.name}</option>
                    <option value={b.id}>{b.name}</option>
                  </Select>
                </Field>
                <Field label="Result" htmlFor="sc-result">
                  <TextInput id="sc-result" value={result} onChange={e => setResult(e.target.value)} placeholder={`${a.name} won by 10 runs`} />
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button icon={<Save className="w-4 h-4" />} loading={busy === 'save'} disabled={!card && !overs.length} onClick={() => save(false)} data-testid="scorecard-save">
                  Save scorecard
                </Button>
                <Button variant="primary" icon={<CheckCircle2 className="w-4 h-4" />} loading={busy === 'finish'} disabled={!card || !winner} onClick={() => save(true)} data-testid="scorecard-finish">
                  {m.status === 'completed' ? 'Save correction and re-score' : 'Save and finish the match'}
                </Button>
              </div>
              <p className="text-xs text-slate-500">Use squad names. Dismissals: "c Fielder b Bowler", "b Bowler", "lbw b Bowler", "st Keeper b Bowler", "run out (Fielder)", "not out".</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

/**
 * Runs and wickets in each over, for the live centre's runs-per-over chart and phase split, and the
 * "score after 5 overs" prediction. Leave an over empty until it has been bowled.
 */
function OverTallyEditor({ value, onChange, labels }: { value: OverTally[]; onChange: (v: OverTally[]) => void; labels: [string, string] }) {
  const get = (innings: 1 | 2, over: number) => value.find(o => o.innings === innings && o.over === over);
  const set = (innings: 1 | 2, over: number, key: 'runs' | 'wickets', raw: string) => {
    const rest = value.filter(o => !(o.innings === innings && o.over === over));
    const cur = get(innings, over);
    if (key === 'runs' && raw === '') return onChange(rest);
    const n = Math.max(0, Math.round(Number(raw) || 0));
    const row: OverTally = { innings, over, runs: key === 'runs' ? n : cur?.runs ?? 0, wickets: key === 'wickets' ? Math.min(6, n) : cur?.wickets ?? 0 };
    onChange([...rest, row].sort((a, b) => a.innings - b.innings || a.over - b.over));
  };
  return (
    <details className="rounded-xl border border-slate-800 p-3" open={value.length > 0} data-testid="over-tally">
      <summary className="cursor-pointer text-sm font-bold text-white">Over by over (runs and wickets in each over)</summary>
      <p className="mt-1 text-xs text-slate-400">Powers the live centre's runs-per-over chart and phase split, and settles the "score after 5 overs" prediction. Fill each over as it is bowled.</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {([1, 2] as const).map(innings => (
          <div key={innings} className="min-w-0">
            <p className="text-xs font-black text-slate-300 mb-1">Innings {innings}: {labels[innings - 1]}</p>
            <table className="w-full text-xs">
              <thead className="text-slate-500"><tr><th className="text-start font-semibold">Over</th><th className="text-start font-semibold">Runs</th><th className="text-start font-semibold">Wickets</th></tr></thead>
              <tbody>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(over => {
                  const row = get(innings, over);
                  return (
                    <tr key={over}>
                      <td className="py-0.5 pe-2 text-slate-400">{over}</td>
                      <td className="py-0.5 pe-2"><input type="number" min={0} max={60} inputMode="numeric" className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-white" value={row ? row.runs : ''} onChange={e => set(innings, over, 'runs', e.target.value)} aria-label={`Innings ${innings} over ${over} runs`} data-testid={`tally-${innings}-${over}-runs`} /></td>
                      <td className="py-0.5"><input type="number" min={0} max={6} inputMode="numeric" className="w-14 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-white disabled:opacity-40" value={row ? row.wickets : ''} disabled={!row} onChange={e => set(innings, over, 'wickets', e.target.value)} aria-label={`Innings ${innings} over ${over} wickets`} data-testid={`tally-${innings}-${over}-wickets`} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-1 text-[11px] text-slate-500">Total {value.filter(o => o.innings === innings).reduce((s, o) => s + o.runs, 0)}/{value.filter(o => o.innings === innings).reduce((s, o) => s + o.wickets, 0)} after {value.filter(o => o.innings === innings).length} overs</p>
          </div>
        ))}
      </div>
    </details>
  );
}

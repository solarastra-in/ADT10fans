import React, { useEffect, useState } from 'react';
import { CheckCircle2, Save } from 'lucide-react';
import { api } from '../../api';
import type { Match, MatchScorecard, Team } from '../../types';
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
  const [winner, setWinner] = useState(m?.winner || '');
  const [result, setResult] = useState(m?.result || '');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<NoticeState | null>(null);
  useEffect(() => {
    setCard(m?.scorecard);
    setWinner(m?.winner || '');
    setResult(m?.result || '');
  }, [m?.id]);

  const save = async (complete: boolean) => {
    if (!m || !card) return;
    if (complete && !window.confirm('Finish the match with this scorecard? Fans get their Pick XI, Pick 5 and prediction points from it. You can correct it later; points are re-scored.')) return;
    setBusy(complete ? 'finish' : 'save');
    try {
      const r = await api.adminSaveScorecard(m.id, { scorecard: card, winner: winner || undefined, result: result || undefined, complete });
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
                <Button icon={<Save className="w-4 h-4" />} loading={busy === 'save'} disabled={!card} onClick={() => save(false)} data-testid="scorecard-save">
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

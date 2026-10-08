import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Edit3, Activity } from 'lucide-react';
import { Match, SystemSettings, Team } from '../../types';
import { api } from '../../api';
import {
  Actions,
  Button,
  Card,
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

type FixtureDraft = { id?: string; matchNo: string; stage: string; teamA: string; teamB: string; startsAt: string; venue: string; status: Match['status'] };
type ScoreDraft = {
  id: string;
  status: Match['status'];
  scoreA: string;
  oversA: string;
  scoreB: string;
  oversB: string;
  currentOver: string;
  lastCommentary: string;
  result: string;
  winner: string;
  toss: string;
  playerOfTheMatch: string;
  topScorer: string;
  topWicketTaker: string;
  totalSixes: string;
};

export const MatchesSection: React.FC<{ matches: Match[]; teams: Team[]; settings: SystemSettings; onRefreshAll: () => Promise<void> }> = ({
  matches,
  teams,
  settings,
  onRefreshAll,
}) => {
  const { busy, notice, setNotice, run } = useRunner();
  const [fixture, setFixture] = useState<FixtureDraft | null>(null);
  const [score, setScore] = useState<ScoreDraft | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  const sorted = useMemo(() => [...matches].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()), [matches]);

  const openNewFixture = () => {
    setErrors({});
    const nextNo = matches.reduce((m, x) => Math.max(m, x.matchNo || 0), 0) + 1;
    setFixture({ matchNo: String(nextNo), stage: '', teamA: '', teamB: '', startsAt: '', venue: settings?.venue || '', status: 'upcoming' });
  };

  const openEditFixture = (m: Match) => {
    setErrors({});
    setFixture({
      id: m.id,
      matchNo: String(m.matchNo ?? ''),
      stage: m.stage || '',
      teamA: m.teamA,
      teamB: m.teamB,
      startsAt: toLocalInput(m.startsAt),
      venue: m.venue || '',
      status: m.status,
    });
  };

  const openScore = (m: Match) => {
    setErrors({});
    setScore({
      id: m.id,
      status: m.status,
      scoreA: m.scoreA || '',
      oversA: m.oversA || '',
      scoreB: m.scoreB || '',
      oversB: m.oversB || '',
      currentOver: m.currentOver || '',
      lastCommentary: m.lastCommentary || '',
      result: m.result || '',
      winner: m.winner || '',
      toss: m.toss || '',
      playerOfTheMatch: m.playerOfTheMatch || '',
      topScorer: m.topScorer || '',
      topWicketTaker: m.topWicketTaker || '',
      totalSixes: m.totalSixes !== undefined && m.totalSixes !== null ? String(m.totalSixes) : '',
    });
  };

  const saveFixture = async () => {
    if (!fixture) return;
    const e: Errors = {};
    if (!fixture.teamA) e.teamA = 'Choose team A.';
    if (!fixture.teamB) e.teamB = 'Choose team B.';
    if (fixture.teamA && fixture.teamA === fixture.teamB) e.teamB = 'Teams must be different.';
    if (!fixture.startsAt || !fromLocalInput(fixture.startsAt)) e.startsAt = 'Start date and time are required.';
    if (!fixture.venue.trim()) e.venue = 'Venue is required.';
    if (!fixture.matchNo.trim() || toNumber(fixture.matchNo, -1) < 1) e.matchNo = 'Match number must be 1 or more.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await run(
      'fixture',
      () =>
        api.saveMatch({
          id: fixture.id,
          matchNo: toNumber(fixture.matchNo, 1),
          stage: fixture.stage.trim(),
          teamA: fixture.teamA,
          teamB: fixture.teamB,
          startsAt: fromLocalInput(fixture.startsAt),
          venue: fixture.venue.trim(),
          status: fixture.status,
        }),
      'Fixture saved.'
    );
    if (res) {
      setFixture(null);
      await onRefreshAll();
    }
  };

  const saveScore = async () => {
    if (!score) return;
    const e: Errors = {};
    if (score.status === 'completed' && !score.result.trim()) e.result = 'Enter the result text for a completed match.';
    if (score.totalSixes && !(toNumber(score.totalSixes, -1) >= 0)) e.totalSixes = 'Must be 0 or more.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const match = matches.find(m => m.id === score.id);
    if (
      score.status === 'completed' &&
      match?.status !== 'completed' &&
      !window.confirm('Marking this match completed sends a match-result notification to fans. Continue?')
    )
      return;
    const res = await run(
      'score',
      () =>
        api.saveMatch({
          id: score.id,
          status: score.status,
          scoreA: score.scoreA.trim(),
          oversA: score.oversA.trim(),
          scoreB: score.scoreB.trim(),
          oversB: score.oversB.trim(),
          currentOver: score.currentOver.trim(),
          lastCommentary: score.lastCommentary.trim(),
          result: score.result.trim(),
          winner: score.winner || undefined,
          toss: score.toss.trim() || undefined,
          playerOfTheMatch: score.playerOfTheMatch.trim() || undefined,
          topScorer: score.topScorer.trim(),
          topWicketTaker: score.topWicketTaker.trim(),
          totalSixes: score.totalSixes.trim() ? toNumber(score.totalSixes, 0) : undefined,
        }),
      'Score updated.'
    );
    if (res) {
      setScore(null);
      await onRefreshAll();
    }
  };

  const remove = async (m: Match) => {
    if (!window.confirm(`Delete match #${m.matchNo}?`)) return;
    const res = await run(`del:${m.id}`, () => api.deleteMatch(m.id), 'Match deleted.');
    if (res) await onRefreshAll();
  };

  const scoreMatch = score ? matches.find(m => m.id === score.id) : undefined;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Matches"
        description="Fixtures and live scores are entered here by hand — nothing is simulated."
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNewFixture} disabled={teams.length < 2}>
            Add fixture
          </Button>
        }
      />
      {teams.length < 2 && <Notice notice={{ kind: 'info', text: 'Add at least two teams before creating fixtures.' }} />}
      <Notice notice={notice} onClose={() => setNotice(null)} />

      {sorted.length === 0 ? (
        <EmptyState title="No fixtures yet" description="Add fixtures once the schedule is announced." />
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {sorted.map(m => (
            <li key={m.id}>
              <Card className="flex flex-col gap-2 h-full">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={statusTone(m.status)}>{m.status}</Chip>
                  <span className="text-xs font-bold text-slate-400">
                    #{m.matchNo}
                    {m.stage ? ` · ${m.stage}` : ''}
                  </span>
                </div>
                <p className="font-black text-white break-words">
                  {teamName(teams, m.teamA)} <span className="text-slate-500">vs</span> {teamName(teams, m.teamB)}
                </p>
                <p className="text-xs text-slate-400">
                  {formatDateTime(m.startsAt)} · {m.venue || 'Venue not set'}
                </p>
                {(m.scoreA || m.scoreB) && (
                  <p className="text-sm font-mono text-amber-300">
                    {m.scoreA || '—'} {m.oversA ? `(${m.oversA})` : ''} · {m.scoreB || '—'} {m.oversB ? `(${m.oversB})` : ''}
                  </p>
                )}
                {m.result && <p className="text-sm text-emerald-300">{m.result}</p>}
                <Actions className="mt-auto pt-1">
                  <Button size="sm" variant="primary" icon={<Activity className="w-4 h-4" />} onClick={() => openScore(m)}>
                    Score
                  </Button>
                  <Button size="sm" icon={<Edit3 className="w-4 h-4" />} onClick={() => openEditFixture(m)}>
                    Edit fixture
                  </Button>
                  <Button size="sm" variant="danger" icon={<Trash2 className="w-4 h-4" />} loading={busy === `del:${m.id}`} onClick={() => remove(m)}>
                    Delete
                  </Button>
                </Actions>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={!!fixture}
        title={fixture?.id ? 'Edit fixture' : 'Add fixture'}
        onClose={() => setFixture(null)}
        footer={
          <>
            <Button onClick={() => setFixture(null)}>Cancel</Button>
            <Button variant="primary" onClick={saveFixture} loading={busy === 'fixture'}>
              Save fixture
            </Button>
          </>
        }
      >
        {fixture && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Team A" required error={errors.teamA}>
              <Select value={fixture.teamA} onChange={e => setFixture({ ...fixture, teamA: e.target.value })} error={!!errors.teamA}>
                <option value="">Choose…</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Team B" required error={errors.teamB}>
              <Select value={fixture.teamB} onChange={e => setFixture({ ...fixture, teamB: e.target.value })} error={!!errors.teamB}>
                <option value="">Choose…</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Starts at (your local time)" required error={errors.startsAt}>
              <TextInput type="datetime-local" value={fixture.startsAt} onChange={e => setFixture({ ...fixture, startsAt: e.target.value })} error={!!errors.startsAt} />
            </Field>
            <Field label="Match number" required error={errors.matchNo}>
              <TextInput type="number" inputMode="numeric" min={1} value={fixture.matchNo} onChange={e => setFixture({ ...fixture, matchNo: e.target.value })} error={!!errors.matchNo} />
            </Field>
            <Field label="Venue" required error={errors.venue} className="sm:col-span-2" hint={settings?.venue ? `Default from settings: ${settings.venue}` : 'Tip: set a default venue in Settings'}>
              <TextInput value={fixture.venue} onChange={e => setFixture({ ...fixture, venue: e.target.value })} error={!!errors.venue} />
            </Field>
            <Field label="Stage" hint="e.g. League, Qualifier 1, Final">
              <TextInput value={fixture.stage} onChange={e => setFixture({ ...fixture, stage: e.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={fixture.status} onChange={e => setFixture({ ...fixture, status: e.target.value as Match['status'] })}>
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
              </Select>
            </Field>
          </div>
        )}
      </Sheet>

      <Sheet
        open={!!score}
        title={scoreMatch ? `Score: ${teamName(teams, scoreMatch.teamA)} vs ${teamName(teams, scoreMatch.teamB)}` : 'Score'}
        onClose={() => setScore(null)}
        footer={
          <>
            <Button onClick={() => setScore(null)}>Cancel</Button>
            <Button variant="primary" onClick={saveScore} loading={busy === 'score'}>
              Save score
            </Button>
          </>
        }
      >
        {score && scoreMatch && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Status" className="sm:col-span-2">
              <Select value={score.status} onChange={e => setScore({ ...score, status: e.target.value as Match['status'] })}>
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
              </Select>
            </Field>
            <Field label={`${teamName(teams, scoreMatch.teamA)} score`} hint="e.g. 124/4">
              <TextInput value={score.scoreA} onChange={e => setScore({ ...score, scoreA: e.target.value })} />
            </Field>
            <Field label={`${teamName(teams, scoreMatch.teamA)} overs`} hint="e.g. 10.0">
              <TextInput inputMode="decimal" value={score.oversA} onChange={e => setScore({ ...score, oversA: e.target.value })} />
            </Field>
            <Field label={`${teamName(teams, scoreMatch.teamB)} score`}>
              <TextInput value={score.scoreB} onChange={e => setScore({ ...score, scoreB: e.target.value })} />
            </Field>
            <Field label={`${teamName(teams, scoreMatch.teamB)} overs`}>
              <TextInput inputMode="decimal" value={score.oversB} onChange={e => setScore({ ...score, oversB: e.target.value })} />
            </Field>
            <Field label="Current over" hint="e.g. 1 4 W 6 . 2" className="sm:col-span-2">
              <TextInput value={score.currentOver} onChange={e => setScore({ ...score, currentOver: e.target.value })} />
            </Field>
            <Field label="Latest update" className="sm:col-span-2" hint="Short factual line shown on the live ticker">
              <TextArea rows={2} value={score.lastCommentary} onChange={e => setScore({ ...score, lastCommentary: e.target.value })} />
            </Field>
            <Field label="Winner">
              <Select value={score.winner} onChange={e => setScore({ ...score, winner: e.target.value })}>
                <option value="">Not decided</option>
                <option value={scoreMatch.teamA}>{teamName(teams, scoreMatch.teamA)}</option>
                <option value={scoreMatch.teamB}>{teamName(teams, scoreMatch.teamB)}</option>
              </Select>
            </Field>
            <Field label="Result" error={errors.result} hint="e.g. UAE Bulls won by 6 wickets">
              <TextInput value={score.result} onChange={e => setScore({ ...score, result: e.target.value })} error={!!errors.result} />
            </Field>
            <Field label="Toss result" hint="e.g. Arabian Aces won toss and elected to field">
              <TextInput value={score.toss} onChange={e => setScore({ ...score, toss: e.target.value })} />
            </Field>
            <Field label="Player of the match" hint="e.g. Alex Hales (54 off 21)">
              <TextInput value={score.playerOfTheMatch} onChange={e => setScore({ ...score, playerOfTheMatch: e.target.value })} />
            </Field>
            <Field label="Top scorer">
              <TextInput value={score.topScorer} onChange={e => setScore({ ...score, topScorer: e.target.value })} />
            </Field>
            <Field label="Top wicket-taker">
              <TextInput value={score.topWicketTaker} onChange={e => setScore({ ...score, topWicketTaker: e.target.value })} />
            </Field>
            <Field label="Total sixes" error={errors.totalSixes}>
              <TextInput type="number" inputMode="numeric" min={0} value={score.totalSixes} onChange={e => setScore({ ...score, totalSixes: e.target.value })} error={!!errors.totalSixes} />
            </Field>
          </div>
        )}
      </Sheet>
    </div>
  );
};

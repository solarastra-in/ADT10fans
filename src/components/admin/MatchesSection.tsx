import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Edit3, Activity, RadioTower, Search, FileUp, RefreshCw, Calendar, Upload, Bot } from 'lucide-react';
import { ScorecardEditor } from './ScorecardEditor';
import { FreeScraperSheet } from './FreeScraperSheet';
import type { CricketDataCandidate, MatchScorecard } from '../../types';
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

type FixtureDraft = { id?: string; matchNo: string; stage: string; teamA: string; teamB: string; startsAt: string; venue: string; status: Match['status']; externalId: string; streamUrl: string };
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
  scorecard?: MatchScorecard;
  editCard: boolean;
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
  const [candidates, setCandidates] = useState<CricketDataCandidate[] | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<{ name: string; size: number; base64?: string; text?: string; mimeType: string } | null>(null);
  const [importText, setImportText] = useState('');
  const [importOverwrite, setImportOverwrite] = useState(matches.length === 0);
  const [importError, setImportError] = useState<string | null>(null);
  const [scraperSheetOpen, setScraperSheetOpen] = useState(false);

  const sorted = useMemo(() => [...matches].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()), [matches]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImportError(null);
    const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
    const reader = new FileReader();
    if (isPdf) {
      reader.onload = () => {
        const res = reader.result as string;
        const b64 = res.split(',')[1] || '';
        setImportFile({ name: f.name, size: f.size, base64: b64, mimeType: 'application/pdf' });
      };
      reader.readAsDataURL(f);
    } else {
      reader.onload = () => {
        const text = reader.result as string;
        setImportFile({ name: f.name, size: f.size, text, mimeType: f.type || 'text/plain' });
      };
      reader.readAsText(f);
    }
  };

  const handleImportSchedule = async () => {
    if (!importFile && !importText.trim()) {
      setImportError('Please choose a PDF/file or paste schedule text.');
      return;
    }
    setImportError(null);
    const res = await run(
      'importSchedule',
      () =>
        api.importSchedule({
          fileData: importFile?.base64,
          mimeType: importFile?.mimeType,
          text: importFile?.text || (importText.trim() ? importText.trim() : undefined),
          fileName: importFile?.name,
          overwrite: importOverwrite,
        }),
      r => `Imported ${r.count} matches from schedule (${r.total} total).`
    );
    if (res) {
      setImportModalOpen(false);
      setImportFile(null);
      setImportText('');
      await onRefreshAll();
    }
  };

  const handleSyncOfficialSchedule = async () => {
    if (matches.length > 0 && !window.confirm('Reset/update to the 32 official 2026 fixtures? Entered scores will be kept.')) {
      return;
    }
    const res = await run(
      'syncOfficial',
      () => api.seedOfficialMatches(true),
      r => `Synced ${r.count} official fixtures for Season 2026.`
    );
    if (res) await onRefreshAll();
  };

  const openNewFixture = () => {
    setErrors({});
    const nextNo = matches.reduce((m, x) => Math.max(m, x.matchNo || 0), 0) + 1;
    setFixture({ matchNo: String(nextNo), stage: 'Group stage', teamA: '', teamB: '', startsAt: '', venue: settings?.venue || '', status: 'upcoming', externalId: '', streamUrl: '' });
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
      externalId: m.externalId || '',
      streamUrl: m.streamUrl || '',
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
      scorecard: m.scorecard,
      editCard: false,
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
    if (fixture.streamUrl.trim() && !/^https:\/\//.test(fixture.streamUrl.trim())) e.streamUrl = 'Stream link must start with https://';
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
          externalId: fixture.externalId.trim(),
          streamUrl: fixture.streamUrl.trim(),
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
      !window.confirm('Marking this match completed sends a result notification to fans and scores every Pick XI lineup from the scorecard. Continue?')
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
          ...(score.editCard ? { scorecard: score.scorecard } : {}),
        }),
      r => (r.fantasy?.note ? `Score updated. ${r.fantasy.note}` : 'Score updated.')
    );
    if (res) {
      setScore(null);
      await onRefreshAll();
    }
  };

  const liveSync = async (m: Match) => {
    const res = await run(`live:${m.id}`, () => api.liveSyncMatch(m.id), r => `Synced from CricketData: ${r.status}${r.scorecard ? ', scorecard updated' : ''}${r.scorecardNote ? ` (${r.scorecardNote})` : ''}.`);
    if (res) await onRefreshAll();
  };

  const findCandidates = async () => {
    const res = await run('find', () => api.findCricketDataMatches());
    if (res) setCandidates(res.matches);
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
        description="Fixtures, live scores and scorecards. Link a fixture to its CricketData.org match id for automatic live scores, or enter them by hand."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Bot className="w-4 h-4 text-emerald-400" />}
              onClick={() => setScraperSheetOpen(true)}
            >
              Free Live Scraper
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<FileUp className="w-4 h-4 text-amber-400" />}
              onClick={() => {
                setImportError(null);
                setImportModalOpen(true);
              }}
            >
              Import from PDF
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className={`w-4 h-4 text-emerald-400 ${busy === 'syncOfficial' ? 'animate-spin' : ''}`} />}
              loading={busy === 'syncOfficial'}
              onClick={handleSyncOfficialSchedule}
            >
              Sync 2026 Schedule
            </Button>
            <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNewFixture} disabled={teams.length < 2}>
              Add fixture
            </Button>
          </div>
        }
      />
      {teams.length < 2 && <Notice notice={{ kind: 'info', text: 'Add at least two teams before creating fixtures.' }} />}
      <Notice notice={notice} onClose={() => setNotice(null)} />

      {sorted.length === 0 ? (
        <Card className="text-center py-10 px-4 space-y-4">
          <Calendar className="w-12 h-12 text-amber-400 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-lg font-black text-white">No fixtures loaded yet</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Sync the official 32 fixtures for the Abu Dhabi T10 2026 season, import your schedule PDF or text, or add them manually.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              variant="primary"
              size="md"
              icon={<RefreshCw className="w-4 h-4" />}
              loading={busy === 'syncOfficial'}
              onClick={handleSyncOfficialSchedule}
            >
              Load Official 2026 Schedule (32 matches)
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={<FileUp className="w-4 h-4 text-amber-400" />}
              onClick={() => {
                setImportError(null);
                setImportModalOpen(true);
              }}
            >
              Import from PDF
            </Button>
          </div>
        </Card>
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
                <p className="text-[11px] text-slate-500">
                  {m.externalId ? `CricketData: ${m.externalId}${m.liveSyncedAt ? ` · synced ${formatDateTime(m.liveSyncedAt)}` : ''}` : 'Scores entered by hand'}
                  {m.scorecard?.innings1 ? ' · scorecard ✓' : ''}
                </p>
                <Actions className="mt-auto pt-1">
                  <Button size="sm" variant="primary" icon={<Activity className="w-4 h-4" />} onClick={() => openScore(m)}>
                    Score
                  </Button>
                  {m.externalId && (
                    <Button size="sm" icon={<RadioTower className="w-4 h-4" />} loading={busy === `live:${m.id}`} onClick={() => liveSync(m)}>
                      Sync live
                    </Button>
                  )}
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
                <option value="abandoned">Abandoned</option>
              </Select>
            </Field>
            <Field label="Official stream or highlights link" error={errors.streamUrl} className="sm:col-span-2" hint="Optional. A YouTube link plays inside the match page.">
              <TextInput type="url" value={fixture.streamUrl} onChange={e => setFixture({ ...fixture, streamUrl: e.target.value })} error={!!errors.streamUrl} placeholder="https://" />
            </Field>
            <Field label="CricketData.org match id" className="sm:col-span-2" hint="Optional. Turns on automatic live scores and scorecards (needs CRICKET_API_KEY).">
              <div className="flex gap-2">
                <TextInput value={fixture.externalId} onChange={e => setFixture({ ...fixture, externalId: e.target.value })} placeholder="e.g. 4f1a…" />
                <Button onClick={findCandidates} loading={busy === 'find'} icon={<Search className="w-4 h-4" />}>Find</Button>
              </div>
              {candidates && (
                <ul className="mt-2 max-h-48 overflow-y-auto space-y-1">
                  {candidates.length === 0 ? <li className="text-xs text-slate-400">No current CricketData matches look like this league.</li> : candidates.map(c => (
                    <li key={c.id}>
                      <button type="button" onClick={() => { setFixture({ ...fixture, externalId: c.id }); setCandidates(null); }} className="w-full text-start text-xs p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-400/50">
                        <span className="font-bold text-white">{c.name}</span> <span className="text-slate-400">{c.date} · {c.status}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
                <option value="abandoned">Abandoned</option>
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
            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-white">Scorecard {score.scorecard?.innings1 ? '' : '(not entered)'}</p>
                <Button size="sm" onClick={() => setScore({ ...score, editCard: !score.editCard })}>{score.editCard ? 'Hide scorecard' : 'Edit scorecard'}</Button>
              </div>
              <p className="text-xs text-slate-400">Pick XI points come from the scorecard. Use squad names; write dismissals as "c Fielder b Bowler", "b Bowler", "lbw b Bowler", "st Keeper b Bowler" or "run out (Fielder)".</p>
              {score.editCard && (() => {
                const a = teams.find(t => t.id === scoreMatch.teamA);
                const b = teams.find(t => t.id === scoreMatch.teamB);
                return a && b ? <ScorecardEditor value={score.scorecard} onChange={sc => setScore({ ...score, scorecard: sc })} teamA={a} teamB={b} /> : null;
              })()}
            </div>
          </div>
        )}
      </Sheet>

      {/* Import Schedule Sheet */}
      <Sheet
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Schedule from PDF / Document"
        footer={
          <>
            <Button onClick={() => setImportModalOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              icon={<Upload className="w-4 h-4" />}
              loading={busy === 'importSchedule'}
              onClick={handleImportSchedule}
            >
              Parse & Import Matches
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Upload your match schedule PDF, CSV, or document (or paste the fixture text below). Gemini AI will parse the match numbers, stages, franchises, dates, times, and venue.
          </p>

          {importError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {importError}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">Schedule Document (PDF, TXT, CSV)</label>
            <div className="border-2 border-dashed border-slate-700 hover:border-amber-400/50 rounded-2xl p-6 text-center cursor-pointer bg-slate-900/50 transition-colors relative">
              <input
                type="file"
                accept=".pdf,application/pdf,.txt,.csv,.json"
                onChange={onFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <FileUp className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              {importFile ? (
                <div>
                  <p className="font-bold text-white text-sm">{importFile.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{(importFile.size / 1024).toFixed(1)} KB · Ready to parse</p>
                </div>
              ) : (
                <div>
                  <p className="font-bold text-white text-sm">Choose or drop schedule file</p>
                  <p className="text-xs text-slate-400 mt-1">PDF schedule, fixtures list, or CSV</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 block">Or paste schedule text directly</label>
            <TextArea
              rows={4}
              placeholder="e.g. Match 1: 07 Nov 2026 - UAE Bulls vs Yas Lions at Zayed Cricket Stadium, 3:30 PM GST&#10;Match 2: 07 Nov 2026 - Royal Desert Champions vs Emirates Eagles..."
              value={importText}
              onChange={e => setImportText(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={importOverwrite}
              onChange={e => setImportOverwrite(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-amber-400 focus:ring-0"
            />
            <span className="text-xs font-medium text-slate-300">
              Replace existing fixtures with imported list
            </span>
          </label>
        </div>
      </Sheet>

      <FreeScraperSheet
        open={scraperSheetOpen}
        onClose={() => setScraperSheetOpen(false)}
        matches={matches}
        teams={teams}
        onRefreshAll={onRefreshAll}
      />
    </div>
  );
};

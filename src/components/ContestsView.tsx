import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Contest, Team, User, Player, Match, PublicConfig } from '../types';
import { api } from '../api';
import {
  Trophy,
  CheckCircle2,
  Clock,
  ArrowRight,
  Award,
  Users,
  Lock,
  Settings,
  Crown,
  HelpCircle,
  ListChecks,
  X,
} from 'lucide-react';

interface MyEntry {
  contestId: string;
  answers?: Record<string, string>;
  pointsAwarded?: number;
  createdAt?: string;
}

interface ContestsViewProps {
  contests: Contest[];
  teams: Team[];
  user: User | null;
  onOpenAuth: () => void;
  onEnterContest: (contestId: string, answers: Record<string, string>) => Promise<any>;
  onSubmitFantasy: (matchId: string, playerIds: string[], captainId: string) => Promise<any>;
  onNavigateToProfile?: () => void;
  /** Opens the Admin Console (shown to admins in empty states). */
  onOpenAdmin?: () => void;
  /** Public config (optional; not required). */
  config?: PublicConfig;
  /** Fixtures; if omitted the component fetches them via api.getMatches(). */
  matches?: Match[];
}

const MAX_CREDITS = 55;
const SQUAD_SIZE = 6;
const LEAGUE_GOLD = '#E8B04A';

const TYPE_LABEL: Record<Contest['type'], string> = {
  predictor: 'Match predictor',
  sixes: 'Sixes',
  captain: 'Captain pick',
  season: 'Season',
  trivia: 'Quiz',
};

const SCROLL_ROW =
  'flex items-center gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function isPast(iso?: string | null): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !isNaN(t) && t <= Date.now();
}

export const ContestsView: React.FC<ContestsViewProps> = ({
  contests,
  teams,
  user,
  onOpenAuth,
  onEnterContest,
  onSubmitFantasy,
  onNavigateToProfile,
  onOpenAdmin,
  matches: matchesProp,
}) => {
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'contests' | 'fantasy' | 'trivia'>('contests');

  // Server state (fresh contests + my entries + counts)
  const [fetchedContests, setFetchedContests] = useState<Contest[] | null>(null);
  const [myEntries, setMyEntries] = useState<MyEntry[]>([]);
  const [entryCounts, setEntryCounts] = useState<Record<string, number>>({});
  const [fetchedMatches, setFetchedMatches] = useState<Match[] | null>(null);

  const loadContests = useCallback(async () => {
    try {
      const res = await api.getContests();
      setFetchedContests(res.contests || []);
      setMyEntries((res.myEntries || []) as MyEntry[]);
      setEntryCounts(res.entryCounts || {});
    } catch {
      /* fall back to props */
    }
  }, []);

  useEffect(() => {
    loadContests();
  }, [loadContests, user?.id]);

  useEffect(() => {
    if (matchesProp) return;
    let cancelled = false;
    api
      .getMatches()
      .then(res => !cancelled && setFetchedMatches(res.matches || []))
      .catch(() => !cancelled && setFetchedMatches([]));
    return () => {
      cancelled = true;
    };
  }, [matchesProp]);

  const allContests = fetchedContests ?? contests;
  const matches = matchesProp ?? fetchedMatches ?? [];
  const teamById = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);
  const entryByContest = useMemo(() => new Map(myEntries.map(e => [e.contestId, e])), [myEntries]);

  const predictionContests = allContests.filter(c => c.type !== 'trivia');
  const triviaContests = allContests.filter(c => c.type === 'trivia');

  const adminButton = (label: string) =>
    isAdmin && onOpenAdmin ? (
      <button
        onClick={onOpenAdmin}
        className="mt-4 min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-sm font-bold border border-slate-700 inline-flex items-center gap-2"
      >
        <Settings className="w-4 h-4" /> {label}
      </button>
    ) : null;

  const emptyState = (icon: React.ReactNode, title: string, body: string, adminLabel: string) => (
    <div className="p-8 sm:p-12 text-center rounded-2xl bg-slate-900/60 border border-dashed border-slate-800">
      <div className="mx-auto mb-3 w-10 h-10 text-slate-500 flex items-center justify-center">{icon}</div>
      <p className="text-sm font-bold text-slate-200">{title}</p>
      <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">{body}</p>
      {adminButton(adminLabel)}
    </div>
  );

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: 'contests', label: 'Predictions' },
    { id: 'fantasy', label: 'Fantasy 10' },
    { id: 'trivia', label: 'Quizzes' },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="min-w-0">
          <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Trophy className="w-4 h-4" /> Contests &amp; Fantasy 10
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Predict, pick and earn points</h2>
          <p className="text-sm text-slate-400 mt-1">Every point you score also counts towards your team in Fan Wars.</p>
        </div>
        {onNavigateToProfile && user && (
          <button
            onClick={onNavigateToProfile}
            className="min-h-[44px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/30 text-sm font-bold inline-flex items-center justify-center gap-2 self-start md:self-auto"
          >
            <Award className="w-4 h-4" /> My badges <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className={SCROLL_ROW} role="tablist">
        {tabs.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            className={`min-h-[44px] px-4 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 ${
              activeTab === t.id ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'contests' &&
        (predictionContests.length === 0 ? (
          emptyState(
            <ListChecks className="w-10 h-10" />,
            'No contests yet',
            'Prediction contests will appear here once they open.',
            'Create a contest in Admin Console'
          )
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {predictionContests.map(c => (
              <ContestCard
                key={c.id}
                contest={c}
                entry={entryByContest.get(c.id)}
                entriesCount={entryCounts[c.id]}
                match={c.matchId ? matches.find(m => m.id === c.matchId) : undefined}
                teamById={teamById}
                user={user}
                onOpenAuth={onOpenAuth}
                onSubmit={async answers => {
                  const res = await onEnterContest(c.id, answers);
                  await loadContests();
                  return res;
                }}
              />
            ))}
          </div>
        ))}

      {activeTab === 'trivia' &&
        (triviaContests.length === 0 ? (
          emptyState(
            <HelpCircle className="w-10 h-10" />,
            'No quizzes yet',
            'Cricket quizzes will appear here once they are published.',
            'Create a quiz in Admin Console'
          )
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {triviaContests.map(c => (
              <ContestCard
                key={c.id}
                contest={c}
                entry={entryByContest.get(c.id)}
                entriesCount={entryCounts[c.id]}
                teamById={teamById}
                user={user}
                onOpenAuth={onOpenAuth}
                onSubmit={async answers => {
                  const res = await onEnterContest(c.id, answers);
                  await loadContests();
                  return res;
                }}
              />
            ))}
          </div>
        ))}

      {activeTab === 'fantasy' && (
        <FantasyBuilder
          matches={matches}
          matchesLoaded={!!matchesProp || fetchedMatches !== null}
          contests={allContests}
          teamById={teamById}
          user={user}
          onOpenAuth={onOpenAuth}
          onSubmitFantasy={onSubmitFantasy}
          emptyState={emptyState}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Contest card                                                        */
/* ------------------------------------------------------------------ */

const ContestCard: React.FC<{
  contest: Contest;
  entry?: MyEntry;
  entriesCount?: number;
  match?: Match;
  teamById: Map<string, Team>;
  user: User | null;
  onOpenAuth: () => void;
  onSubmit: (answers: Record<string, string>) => Promise<any>;
}> = ({ contest, entry, entriesCount, match, teamById, user, onOpenAuth, onSubmit }) => {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>(entry?.answers || {});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (entry?.answers) setAnswers(entry.answers);
  }, [entry?.answers]);

  const lockPassed = isPast(contest.locksAt);
  const isOpen = contest.status === 'open' && !lockPassed;
  const isSettled = contest.status === 'settled';
  const entered = !!entry;
  const instantDone = contest.instant && entered;
  const canEdit = isOpen && !instantDone;
  const answeredCount = contest.questions.filter(q => answers[q.id]).length;
  const allAnswered = answeredCount === contest.questions.length && contest.questions.length > 0;

  const teamA = match ? teamById.get(match.teamA) : undefined;
  const teamB = match ? teamById.get(match.teamB) : undefined;

  const statusBadge = isSettled
    ? { label: 'Settled', cls: 'bg-slate-700/60 text-slate-200 border-slate-600' }
    : isOpen
    ? { label: 'Open', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' }
    : { label: 'Locked', cls: 'bg-red-500/10 text-red-300 border-red-500/30' };

  const handleSubmit = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    if (!allAnswered) {
      setMessage({ tone: 'err', text: 'Answer every question before submitting.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await onSubmit(answers);
      if (contest.instant) {
        setMessage({ tone: 'ok', text: `Submitted — you scored ${res?.pointsAwarded ?? 0} points.` });
      } else {
        setMessage({
          tone: 'ok',
          text: entered ? 'Your answers have been updated.' : 'Entry saved. Points are awarded when the contest is settled.',
        });
      }
    } catch (e: any) {
      setMessage({ tone: 'err', text: e?.message || 'Could not submit your entry.' });
    } finally {
      setSubmitting(false);
    }
  };

  const showQuestions = open || isSettled || instantDone;

  return (
    <article className="rounded-2xl p-4 sm:p-6 bg-slate-900 border border-slate-800 flex flex-col justify-between min-w-0">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 font-black text-xs uppercase">
            {TYPE_LABEL[contest.type] || contest.type}
          </span>
          <span className={`px-2.5 py-0.5 rounded-full border text-xs font-bold ${statusBadge.cls}`}>{statusBadge.label}</span>
          {entered && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Entered
            </span>
          )}
        </div>

        <h3 className="font-extrabold text-lg text-white mb-1 break-words">{contest.title}</h3>
        {contest.description && <p className="text-sm text-slate-300 mb-3 break-words">{contest.description}</p>}

        {(teamA || teamB) && (
          <p className="text-sm text-slate-300 mb-3 flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamA?.color || LEAGUE_GOLD }} />
            <strong>{teamA?.name || match?.teamA}</strong>
            <span className="text-slate-500">vs</span>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamB?.color || LEAGUE_GOLD }} />
            <strong>{teamB?.name || match?.teamB}</strong>
          </p>
        )}

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-4">
          {contest.prize && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 sm:col-span-2">
              <dt className="text-xs text-slate-400">Prize</dt>
              <dd className="text-amber-300 font-bold mt-0.5 break-words">{contest.prize}</dd>
            </div>
          )}
          {contest.locksAt && fmtDate(contest.locksAt) && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <dt className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {lockPassed ? 'Locked' : 'Locks'}
              </dt>
              <dd className="text-slate-200 font-semibold mt-0.5">{fmtDate(contest.locksAt)}</dd>
            </div>
          )}
          {typeof entriesCount === 'number' && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <dt className="text-xs text-slate-400 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Entries
              </dt>
              <dd className="text-slate-200 font-semibold mt-0.5">{entriesCount.toLocaleString()}</dd>
            </div>
          )}
          {entered && typeof entry?.pointsAwarded === 'number' && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <dt className="text-xs text-emerald-300">Your points</dt>
              <dd className="text-emerald-200 font-black mt-0.5">{entry.pointsAwarded}</dd>
            </div>
          )}
        </dl>

        {showQuestions && contest.questions.length > 0 && (
          <div className="space-y-4 pt-3 border-t border-slate-800/80">
            {contest.questions.map((q, idx) => {
              const mine = answers[q.id];
              const correct = isSettled ? q.answer : undefined;
              return (
                <fieldset key={q.id} className="space-y-2 min-w-0">
                  <legend className="text-sm font-bold text-white break-words">
                    {idx + 1}. {q.prompt} <span className="text-xs font-mono text-amber-400">({q.points} pts)</span>
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map(opt => {
                      const chosen = mine === opt;
                      let cls = 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600';
                      if (correct !== undefined) {
                        if (opt === correct) cls = 'bg-emerald-500/20 text-emerald-200 border-emerald-500/50 font-bold';
                        else if (chosen) cls = 'bg-red-500/15 text-red-300 border-red-500/40 line-through';
                        else cls = 'bg-slate-950 text-slate-500 border-slate-800';
                      } else if (chosen) {
                        cls = 'bg-amber-400 text-slate-950 border-amber-400 font-black';
                      }
                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={!canEdit}
                          aria-pressed={chosen}
                          onClick={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                          className={`min-h-[44px] px-3 py-2 rounded-xl text-sm text-left border transition-colors break-words disabled:cursor-default ${cls}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {isSettled && q.explain && <p className="text-xs text-slate-400 break-words">{q.explain}</p>}
                </fieldset>
              );
            })}
          </div>
        )}

        {message && (
          <div
            role="status"
            className={`mt-4 p-3 rounded-xl text-sm font-semibold border ${
              message.tone === 'ok'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      <div className="mt-5 pt-3 border-t border-slate-800 flex flex-wrap justify-between items-center gap-3">
        <span className="text-xs text-slate-400">
          {contest.questions.length} question{contest.questions.length === 1 ? '' : 's'}
          {canEdit && open ? ` · ${answeredCount} answered` : ''}
        </span>

        {canEdit &&
          (open ? (
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => setOpen(false)}
                className="min-h-[44px] px-4 rounded-xl bg-slate-800 text-slate-300 text-sm font-bold"
                aria-label="Close questions"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 sm:flex-none min-h-[44px] px-5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm rounded-xl disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : !user ? 'Sign in to enter' : entered ? 'Update entry' : 'Submit entry'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setOpen(true);
                setMessage(null);
              }}
              className="w-full sm:w-auto min-h-[44px] px-5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl border border-slate-700"
            >
              {entered ? 'Review my answers' : contest.instant ? 'Start quiz' : 'Enter'}
            </button>
          ))}
        {!canEdit && !isSettled && (
          <span className="text-xs text-slate-400 inline-flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" /> {instantDone ? 'Completed' : 'Entries closed'}
          </span>
        )}
      </div>
    </article>
  );
};

/* ------------------------------------------------------------------ */
/* Fantasy 10 builder                                                  */
/* ------------------------------------------------------------------ */

const FantasyBuilder: React.FC<{
  matches: Match[];
  matchesLoaded: boolean;
  contests: Contest[];
  teamById: Map<string, Team>;
  user: User | null;
  onOpenAuth: () => void;
  onSubmitFantasy: (matchId: string, playerIds: string[], captainId: string) => Promise<any>;
  emptyState: (icon: React.ReactNode, title: string, body: string, adminLabel: string) => React.ReactNode;
}> = ({ matches, matchesLoaded, contests, teamById, user, onOpenAuth, onSubmitFantasy, emptyState }) => {
  // Eligible fixtures: not completed, plus any fixture referenced by a contest.
  const contestMatchIds = new Set(contests.map(c => c.matchId).filter(Boolean) as string[]);
  const eligible = useMemo(
    () =>
      matches
        .filter(m => m.status !== 'completed' || contestMatchIds.has(m.id))
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matches, contests]
  );

  const [matchId, setMatchId] = useState<string>('');
  const [selected, setSelected] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!eligible.length) return;
    if (!matchId || !eligible.some(m => m.id === matchId)) {
      const next = eligible.find(m => m.status === 'upcoming') || eligible[0];
      setMatchId(next.id);
    }
  }, [eligible, matchId]);

  const match = eligible.find(m => m.id === matchId);
  const teamA = match ? teamById.get(match.teamA) : undefined;
  const teamB = match ? teamById.get(match.teamB) : undefined;
  const pool: Player[] = useMemo(() => [...(teamA?.squad || []), ...(teamB?.squad || [])], [teamA, teamB]);
  const playerById = useMemo(() => new Map(pool.map(p => [p.id, p])), [pool]);
  const editable = match?.status === 'upcoming' && !isPast(match?.startsAt);

  // Load an existing lineup for this match
  useEffect(() => {
    setSelected([]);
    setCaptainId('');
    setMessage(null);
    setSavedAt(null);
    setTeamFilter('all');
    if (!matchId || !user) return;
    let cancelled = false;
    api
      .getFantasy(matchId)
      .then(res => {
        if (cancelled || !res.fantasyTeam) return;
        setSelected(res.fantasyTeam.playerIds || []);
        setCaptainId(res.fantasyTeam.captainId || '');
        setSavedAt(res.fantasyTeam.createdAt || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [matchId, user?.id]);

  if (!matchesLoaded) {
    return <div className="p-8 text-center text-sm text-slate-400">Loading fixtures…</div>;
  }

  if (eligible.length === 0) {
    return emptyState(
      <Crown className="w-10 h-10" />,
      'No fixtures to pick a lineup for',
      'Fantasy 10 opens for each match once the fixture is announced.',
      'Add fixtures in Admin Console'
    ) as React.ReactElement;
  }

  const credits = selected.reduce((acc, id) => acc + (playerById.get(id)?.credits || 0), 0);
  const remaining = MAX_CREDITS - credits;

  const toggle = (p: Player) => {
    if (!editable) return;
    setMessage(null);
    if (selected.includes(p.id)) {
      setSelected(s => s.filter(id => id !== p.id));
      if (captainId === p.id) setCaptainId('');
      return;
    }
    if (selected.length >= SQUAD_SIZE) {
      setMessage({ tone: 'err', text: `You can pick ${SQUAD_SIZE} players. Remove one first.` });
      return;
    }
    if (credits + (p.credits || 0) > MAX_CREDITS) {
      setMessage({ tone: 'err', text: `Not enough credits — ${remaining.toFixed(1)} left.` });
      return;
    }
    setSelected(s => [...s, p.id]);
  };

  const submit = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    if (!match) return;
    if (selected.length !== SQUAD_SIZE) {
      setMessage({ tone: 'err', text: `Pick exactly ${SQUAD_SIZE} players.` });
      return;
    }
    if (!captainId || !selected.includes(captainId)) {
      setMessage({ tone: 'err', text: 'Choose a captain (scores double).' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await onSubmitFantasy(match.id, selected, captainId);
      setSavedAt(res?.fantasyTeam?.createdAt || new Date().toISOString());
      setMessage({ tone: 'ok', text: 'Lineup saved. You can change it until the match starts.' });
    } catch (e: any) {
      setMessage({ tone: 'err', text: e?.message || 'Could not save your lineup.' });
    } finally {
      setSubmitting(false);
    }
  };

  const matchLabel = (m: Match) => {
    const a = teamById.get(m.teamA);
    const b = teamById.get(m.teamB);
    return `${a?.short || a?.name || m.teamA} v ${b?.short || b?.name || m.teamB}`;
  };

  const squadsMissing = !teamA?.squad?.length || !teamB?.squad?.length;
  const visible = pool
    .filter(p => teamFilter === 'all' || p.teamId === teamFilter)
    .sort((a, b) => (b.credits || 0) - (a.credits || 0) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      {/* Match chips */}
      <div className={SCROLL_ROW} role="tablist" aria-label="Choose a match">
        {eligible.map(m => (
          <button
            key={m.id}
            onClick={() => setMatchId(m.id)}
            className={`min-h-[44px] px-3 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 text-left ${
              m.id === matchId ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 border border-slate-800 text-slate-300'
            }`}
          >
            <span className="block leading-tight">{m.matchNo ? `M${m.matchNo} · ` : ''}{matchLabel(m)}</span>
            <span className={`block text-xs font-semibold ${m.id === matchId ? 'text-slate-800' : 'text-slate-500'}`}>
              {m.status === 'upcoming' ? fmtDate(m.startsAt) : m.status === 'live' ? 'Live' : 'Completed'}
            </span>
          </button>
        ))}
      </div>

      {match && squadsMissing ? (
        emptyState(
          <Users className="w-10 h-10" />,
          'Squads not available yet',
          `The lineup builder opens once both ${teamA?.name || 'team'} and ${teamB?.name || 'opponent'} squads are published.`,
          'Add squads in Admin Console'
        )
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Summary (top on mobile, right on desktop) */}
          <aside className="lg:col-span-4 lg:order-2 rounded-2xl p-4 sm:p-5 bg-slate-900 border border-slate-800 lg:sticky lg:top-20 self-start w-full">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" /> Your lineup
              </h3>
              {!editable && (
                <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Locked
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="block text-xs text-slate-400">Players</span>
                <span className={`font-mono font-black ${selected.length === SQUAD_SIZE ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selected.length}/{SQUAD_SIZE}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="block text-xs text-slate-400">Credits</span>
                <span className={`font-mono font-black ${credits > MAX_CREDITS ? 'text-red-400' : 'text-emerald-400'}`}>
                  {credits.toFixed(1)}/{MAX_CREDITS}
                </span>
              </div>
            </div>

            {selected.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">
                Pick {SQUAD_SIZE} players from the two squads, then tap a player's “C” to make them captain.
              </p>
            ) : (
              <ul className="space-y-1.5 mb-3">
                {selected.map(id => {
                  const p = playerById.get(id);
                  if (!p) return null;
                  return (
                    <li key={id} className="px-2.5 py-2 rounded-lg bg-slate-950 flex items-center justify-between gap-2 text-sm">
                      <span className="font-bold text-white truncate min-w-0">
                        {p.name}
                        {captainId === id && <span className="ml-1.5 text-amber-400 font-black">(C)</span>}
                      </span>
                      <span className="text-slate-400 font-mono text-xs shrink-0">{p.credits} cr</span>
                    </li>
                  );
                })}
              </ul>
            )}

            {message && (
              <div
                role="status"
                className={`mb-3 p-3 rounded-xl text-sm font-semibold border ${
                  message.tone === 'ok'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}
              >
                {message.text}
              </div>
            )}
            {savedAt && !message && <p className="mb-3 text-xs text-slate-400">Saved lineup on file.</p>}

            {editable && (
              <button
                onClick={submit}
                disabled={submitting || (!!user && (selected.length !== SQUAD_SIZE || !captainId || credits > MAX_CREDITS))}
                className="w-full min-h-[44px] bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm rounded-xl disabled:opacity-50"
              >
                {submitting ? 'Saving…' : !user ? 'Sign in to save lineup' : savedAt ? 'Update lineup' : 'Save lineup'}
              </button>
            )}
          </aside>

          {/* Player pool */}
          <div className="lg:col-span-8 lg:order-1 space-y-3 min-w-0">
            <div className={SCROLL_ROW}>
              {[
                { id: 'all', label: 'Both teams', color: undefined as string | undefined },
                ...(teamA ? [{ id: teamA.id, label: teamA.short || teamA.name, color: teamA.color }] : []),
                ...(teamB ? [{ id: teamB.id, label: teamB.short || teamB.name, color: teamB.color }] : []),
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setTeamFilter(f.id)}
                  className={`min-h-[36px] px-3 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                    teamFilter === f.id ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 border border-slate-800 text-slate-300'
                  }`}
                >
                  {f.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />}
                  {f.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {visible.map(p => {
                const isSel = selected.includes(p.id);
                const isCap = captainId === p.id;
                const t = teamById.get(p.teamId);
                return (
                  <div
                    key={p.id}
                    className={`rounded-xl border flex items-stretch min-w-0 ${
                      isSel ? 'bg-amber-500/15 border-amber-400' : 'bg-slate-900/80 border-slate-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(p)}
                      disabled={!editable}
                      aria-pressed={isSel}
                      className="flex-1 min-w-0 min-h-[56px] p-3 flex items-center gap-3 text-left disabled:cursor-default"
                    >
                      <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: t?.color || LEAGUE_GOLD }} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-extrabold text-sm text-white truncate">{p.name}</span>
                        <span className="block text-xs text-slate-400 truncate capitalize">
                          {p.role}
                          {p.category ? ` · ${p.category}` : p.isIcon ? ' · Icon' : ''} · {t?.short || t?.name}
                        </span>
                      </span>
                      <span className="font-mono font-bold text-xs text-amber-300 shrink-0">{p.credits} cr</span>
                    </button>
                    {isSel && editable && (
                      <button
                        type="button"
                        onClick={() => setCaptainId(p.id)}
                        aria-label={`Make ${p.name} captain`}
                        aria-pressed={isCap}
                        className={`w-12 shrink-0 rounded-r-xl text-sm font-black border-l ${
                          isCap ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        C
                      </button>
                    )}
                    {isSel && !editable && isCap && (
                      <span className="w-12 shrink-0 flex items-center justify-center text-sm font-black text-amber-400">C</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

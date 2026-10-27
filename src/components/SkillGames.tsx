import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Grid3x3, Puzzle, Search, Shuffle, Swords, Timer, Trophy, X } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../state';
import { useT } from '../i18n';
import { Link } from '../router';
import type { ConnectionsState, DuelView, GamePlayer, GridState, StatQuestion, StatWarsResult, StatWarsState } from '../types';
import { Avatar, Button, Card, Modal, Notice, Pill, TeamBadge, cx, inputCls } from './ui';

/**
 * Skill games: Squad Connections, Cricket Grid, Stat Wars and duels. Puzzles and answers live on the
 * server; these screens only show what the server sends and post the fan's moves.
 */

const GROUP_COLORS: Record<string, string> = {
  yellow: 'bg-yellow-300 text-slate-950',
  green: 'bg-emerald-400 text-slate-950',
  blue: 'bg-sky-400 text-slate-950',
  purple: 'bg-violet-400 text-slate-950',
};

function useSignIn() {
  const { user, openAuth } = useApp();
  const t = useT();
  return () => {
    if (user) return true;
    openAuth(t('Sign in to play and earn points.'));
    return false;
  };
}

// ---------------------------------------------------------------------------------------------
// Squad Connections
// ---------------------------------------------------------------------------------------------

export function SquadConnections({ state, onChange }: { state: ConnectionsState; onChange: (s: ConnectionsState) => void }) {
  const t = useT();
  const { setUser, toast } = useApp();
  const signedIn = useSignIn();
  const [picked, setPicked] = useState<string[]>([]);
  const [order, setOrder] = useState<GamePlayer[]>(state.remaining || []);
  const [busy, setBusy] = useState(false);
  useEffect(() => setOrder(state.remaining || []), [state.remaining]);

  if (!state.available) return <Notice>{t('Squad Connections starts once squads are published.')}</Notice>;
  const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : p.length < 4 ? [...p, id] : p));
  const submit = async () => {
    if (!signedIn() || picked.length !== 4) return;
    setBusy(true);
    try {
      const r = await api.submitConnections(picked);
      setUser(r.user);
      onChange(r.connections);
      setPicked([]);
      if (r.connections.correct) toast(t('Group found: {label}', { label: r.connections.label || '' }));
      else toast(r.connections.oneAway ? t('One away…') : t('Not a group'), 'info');
      if (r.connections.finished) toast(r.connections.solved ? t('Solved! +{n} points', { n: r.connections.points || 0 }) : t('Out of tries. The groups are shown.'), r.connections.solved ? 'success' : 'info');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const mistakesLeft = (state.maxMistakes || 4) - (state.mistakes || 0);

  return (
    <Card id="connections-game" className="p-5 space-y-4 scroll-mt-20" data-testid="connections-game">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Puzzle className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-black text-white">{t('Squad Connections')}</h2>
            <Pill tone="amber">{t('60 pts max')}</Pill>
          </div>
          <p className="text-sm text-slate-400 mt-1">{t('Find four groups of four players who share something: a team, a role, how they bat or bowl, or their signing.')}</p>
        </div>
      </div>

      <div className="space-y-2">
        {(state.groups || []).map(g => (
          <div key={g.label} className={cx('rounded-xl px-3 py-2.5 text-center', GROUP_COLORS[g.color])}>
            <p className="text-xs font-black uppercase tracking-wide">{g.label}</p>
            <p className="text-sm font-bold">{g.players.map(p => p.name).join(' · ')}</p>
          </div>
        ))}
      </div>

      {!state.finished && (
        <>
          {/* 4 x 4 on every screen, so the whole board is visible at once. */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {order.map(p => {
              const on = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-pressed={on}
                  className={cx(
                    'min-h-[64px] rounded-xl border px-1 py-1.5 text-[11px] sm:text-sm font-bold leading-tight transition-colors flex flex-col items-center justify-center gap-1 break-words',
                    on ? 'bg-amber-400 border-amber-300 text-slate-950' : 'bg-slate-900 border-slate-700 text-white hover:border-slate-500',
                  )}
                >
                  <span className="hidden sm:block">
                    <Avatar name={p.name} src={p.photoUrl} size={26} />
                  </span>
                  <span className="text-center">{p.name}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-400" aria-live="polite">
              {t('Mistakes left')}: {Array.from({ length: state.maxMistakes || 4 }, (_, i) => (i < mistakesLeft ? '●' : '○')).join(' ')}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setOrder(o => [...o].sort(() => Math.random() - 0.5))}>
                <Shuffle className="w-4 h-4" /> {t('Shuffle')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setPicked([])} disabled={!picked.length}>
                {t('Clear')}
              </Button>
              <Button size="sm" onClick={submit} loading={busy} disabled={picked.length !== 4}>
                {t('Submit')}
              </Button>
            </div>
          </div>
        </>
      )}
      {state.finished && (
        <p className="text-sm font-bold text-amber-300">{state.solved ? t('Solved! +{n} points', { n: state.points || 0 }) : t('{n} points today. A new puzzle tomorrow.', { n: state.points || 0 })}</p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// Cricket Grid
// ---------------------------------------------------------------------------------------------

export function CricketGrid({ state, players, onChange }: { state: GridState; players: { id: string; name: string; teamId: string }[]; onChange: (s: GridState) => void }) {
  const t = useT();
  const { setUser, toast, teamById } = useApp();
  const signedIn = useSignIn();
  const [cell, setCell] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  if (!state.available || !state.rows || !state.cols) return <Notice>{t('Cricket Grid starts once squads are published.')}</Notice>;
  const used = new Set(Object.values(state.cells || {}).map(c => c.id));
  const matches = q.trim().length >= 2 ? players.filter(p => p.name.toLowerCase().includes(q.trim().toLowerCase()) && !used.has(p.id)).slice(0, 8) : [];

  const pick = async (playerId: string) => {
    if (!cell || !signedIn()) return;
    setBusy(true);
    try {
      const r = await api.submitGrid(cell, playerId);
      setUser(r.user);
      onChange(r.grid);
      toast(r.grid.correct ? t('Correct!') : t('Not quite. That guess is used.'), r.grid.correct ? 'success' : 'info');
      if (r.grid.finished) toast(t('Grid done: +{n} points', { n: r.grid.points || 0 }));
      setCell(null);
      setQ('');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const [r, c] = cell ? cell.split('-').map(Number) : [0, 0];

  return (
    <Card id="grid-game" className="p-5 space-y-4 scroll-mt-20" data-testid="grid-game">
      <div>
        <div className="flex items-center gap-2">
          <Grid3x3 className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-black text-white">{t('Cricket Grid')}</h2>
          <Pill tone="amber">{t('90 pts max')}</Pill>
        </div>
        <p className="text-sm text-slate-400 mt-1">{t('Name a player who fits both the team and the trait for each square. Nine guesses; rarer correct picks score more.')}</p>
      </div>
      <div className="grid grid-cols-4 gap-1.5 text-center">
        <div className="flex items-center justify-center text-[11px] text-slate-400 font-bold">
          {t('{n} left', { n: state.guessesLeft ?? 9 })}
        </div>
        {state.cols.map(col => (
          <div key={col.id} className="rounded-lg bg-slate-800/60 px-1 py-2 text-[11px] sm:text-xs font-black text-slate-100 flex items-center justify-center leading-tight">
            {t(col.label)}
          </div>
        ))}
        {state.rows.map((row, i) => (
          <React.Fragment key={row.id}>
            <div className="rounded-lg bg-slate-800/60 px-1 py-2 flex flex-col items-center justify-center gap-1">
              <TeamBadge team={teamById(row.teamId)} size="sm" />
              <span className="text-[10px] font-bold text-slate-300 leading-tight hidden sm:block">{row.label}</span>
            </div>
            {state.cols!.map((_, j) => {
              const key = `${i}-${j}`;
              const filled = state.cells?.[key];
              return (
                <button
                  key={key}
                  type="button"
                  disabled={Boolean(filled) || state.finished}
                  onClick={() => signedIn() && setCell(key)}
                  aria-label={filled ? filled.name : t('Choose a player for {team} and {trait}', { team: row.label, trait: t(state.cols![j].label) })}
                  className={cx(
                    'aspect-square rounded-lg border text-[11px] sm:text-xs font-bold flex flex-col items-center justify-center gap-0.5 p-1',
                    filled ? 'bg-emerald-500/15 border-emerald-500/50 text-white' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-amber-400',
                  )}
                >
                  {filled ? (
                    <>
                      <Avatar name={filled.name} src={filled.photoUrl} size={28} />
                      <span className="leading-tight line-clamp-2">{filled.name}</span>
                      <span className="text-[10px] text-emerald-300">{filled.pickedBy}%</span>
                    </>
                  ) : state.finished && state.sizes ? (
                    <span>{t('{n} fit', { n: state.sizes[key] })}</span>
                  ) : (
                    '+'
                  )}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      {state.finished && <p className="text-sm font-bold text-amber-300">{t('Grid done: +{n} points', { n: state.points || 0 })}</p>}
      <Modal open={Boolean(cell)} onClose={() => setCell(null)} title={cell ? `${state.rows[r]?.label} · ${t(state.cols[c]?.label || '')}` : ''}>
        <label className="relative block">
          <span className="sr-only">{t('Search players')}</span>
          <Search className="w-4 h-4 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t('Type a player name')} className={`${inputCls} ps-9`} />
        </label>
        <div className="mt-3 space-y-1">
          {matches.map(p => (
            <button key={p.id} type="button" disabled={busy} onClick={() => pick(p.id)} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-start hover:bg-slate-800">
              <span className="flex-1 text-sm font-bold text-white">{p.name}</span>
              <span className="text-[11px] text-slate-500">{teamById(p.teamId)?.short}</span>
            </button>
          ))}
          {q.trim().length >= 2 && !matches.length && <p className="text-sm text-slate-500 px-1">{t('No players match.')}</p>}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">{t('Every player in the list can be picked: the grid only says whether they fit after you choose.')}</p>
      </Modal>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// Stat Wars
// ---------------------------------------------------------------------------------------------

/** One 60-second run (today's, or a duel's when `duel` is set). */
export function StatWarsRun({ duel, onDone, onCancel }: { duel?: string; onDone: (r: StatWarsResult) => void; onCancel: () => void }) {
  const t = useT();
  const { toast, setUser } = useApp();
  const [qs, setQs] = useState<StatQuestion[] | null>(null);
  const [answers, setAnswers] = useState<('a' | 'b' | null)[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [seconds, setSeconds] = useState(60);
  const finishing = useRef(false);

  useEffect(() => {
    api
      .startStatWars(duel)
      .then(r => {
        setQs(r.questions);
        setAnswers(r.questions.map(() => null));
        setSeconds(r.seconds);
        setStartedAt(Date.now());
      })
      .catch(e => {
        toast(e.message, 'error');
        onCancel();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [startedAt]);

  const index = answers.findIndex(a => a === null);
  const left = startedAt ? Math.max(0, seconds - Math.floor((now - startedAt) / 1000)) : seconds;
  const finish = async (final = answers) => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      const r = await api.finishStatWars(final, duel);
      if (r.user) setUser(r.user);
      onDone(r);
    } catch (e: any) {
      toast(e.message, 'error');
      onCancel();
    }
  };
  useEffect(() => {
    if (qs && (left === 0 || index === -1)) void finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, index, qs]);

  if (!qs) return <p className="text-sm text-slate-400 py-6 text-center">{t('Getting your questions…')}</p>;
  const q = qs[Math.max(0, index)];
  const answer = (side: 'a' | 'b') => {
    if (index < 0) return;
    const next = [...answers];
    next[index] = side;
    setAnswers(next);
  };
  return (
    <div className="space-y-4" data-testid="statwars-run">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-300">
          {t('Question {n} of {total}', { n: Math.min(qs.length, index + 1), total: qs.length })}
        </span>
        <span className={cx('inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-black tabular-nums', left <= 10 ? 'bg-red-500/20 text-red-300' : 'bg-slate-800 text-white')}>
          <Timer className="w-4 h-4" /> {left}s
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full bg-amber-400 transition-all" style={{ width: `${(left / seconds) * 100}%` }} />
      </div>
      {q && (
        <>
          <p className="text-center text-base font-black text-white">{t(q.prompt)}</p>
          <div className="grid grid-cols-2 gap-3">
            {(['a', 'b'] as const).map(side => {
              const p = q[side];
              return (
                <button key={side} type="button" onClick={() => answer(side)} className="rounded-2xl border border-slate-700 bg-slate-900 hover:border-amber-400 p-4 flex flex-col items-center gap-2 min-h-[140px]">
                  <Avatar name={p.name} src={p.photoUrl} size={56} />
                  <span className="text-sm font-black text-white text-center">{p.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="text-center">
        <button type="button" onClick={() => finish()} className="text-xs text-slate-500 hover:text-white">
          {t('Finish now')}
        </button>
      </div>
    </div>
  );
}

function StatWarsReview({ r }: { r: StatWarsResult }) {
  const t = useT();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-2">
          <span className="block text-[10px] uppercase font-black text-slate-500">{t('Correct')}</span>
          <span className="text-xl font-black text-emerald-300">{r.correct}</span>
        </div>
        <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-2">
          <span className="block text-[10px] uppercase font-black text-slate-500">{t('Time')}</span>
          <span className="text-xl font-black text-white">{Math.round(r.elapsedMs / 1000)}s</span>
        </div>
        <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-2">
          <span className="block text-[10px] uppercase font-black text-slate-500">{t('Score')}</span>
          <span className="text-xl font-black text-amber-300">{r.score}</span>
        </div>
      </div>
      {r.late && <Notice tone="warn">{t('Your answers arrived after the time ran out, so this run scored 0.')}</Notice>}
      <details className="rounded-xl border border-slate-800">
        <summary className="cursor-pointer px-3 py-2 text-sm font-bold text-slate-200">{t('See the answers')}</summary>
        <ul className="divide-y divide-slate-800 text-xs">
          {r.review.map(q => (
            <li key={q.id} className="flex items-center gap-2 px-3 py-2">
              {q.right ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <X className="w-4 h-4 text-red-400 shrink-0" />}
              <span className="flex-1 text-slate-300">
                {t(q.prompt)} <strong className="text-white">{q.a.name}</strong> {q.values[0]} · <strong className="text-white">{q.b.name}</strong> {q.values[1]}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function StatWars({ state, onChange }: { state: StatWarsState; onChange: (s: StatWarsState) => void }) {
  const t = useT();
  const { toast } = useApp();
  const signedIn = useSignIn();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<StatWarsResult | null>(null);
  const [duels, setDuels] = useState<{ mine: DuelView[]; open: DuelView[] } | null>(null);
  const [duelRun, setDuelRun] = useState<string | null>(null);
  const loadDuels = () => api.getDuels().then(setDuels).catch(() => undefined);
  useEffect(() => {
    if (state.available) void loadDuels();
  }, [state.available]);

  const challenge = async (open: boolean) => {
    if (!signedIn()) return;
    try {
      const r = await api.createDuel(open);
      setDuelRun(r.duel.code);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  return (
    <Card id="statwars-game" className="p-5 space-y-4 scroll-mt-20" data-testid="statwars-game">
      <div>
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-black text-white">{t('Stat Wars')}</h2>
          <Pill tone="amber">{t('60 seconds')}</Pill>
        </div>
        <p className="text-sm text-slate-400 mt-1">{t('Two players, one stat from this season. Pick who is ahead, as many as you can in 60 seconds. +3 right, −1 wrong, time bonus for fast accurate runs.')}</p>
      </div>
      {!state.available ? (
        <Notice>{t('Stat Wars opens after the first matches of the season, when there are real figures to compare.')}</Notice>
      ) : running ? (
        <StatWarsRun
          onCancel={() => setRunning(false)}
          onDone={r => {
            setRunning(false);
            setResult(r);
            onChange({ ...state, played: true, inProgress: false, result: { correct: r.correct, wrong: r.wrong, score: r.score, timeBonus: r.timeBonus, elapsedMs: r.elapsedMs, late: r.late } });
          }}
        />
      ) : duelRun ? (
        <DuelRunner code={duelRun} onExit={() => {
          setDuelRun(null);
          void loadDuels();
        }} />
      ) : (
        <>
          {result ? (
            <StatWarsReview r={result} />
          ) : state.played && state.result ? (
            <p className="text-sm font-bold text-amber-300">{t('Today: {n} correct, {score} points.', { n: state.result.correct, score: state.result.score })}</p>
          ) : (
            <Button onClick={() => signedIn() && setRunning(true)} className="w-full">
              <Timer className="w-4 h-4" /> {t('Start today’s run')}
            </Button>
          )}
          <div className="rounded-xl border border-slate-800 p-3 space-y-3">
            <p className="text-sm font-black text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" /> {t('Duels')}
            </p>
            <p className="text-xs text-slate-400">{t('Challenge a friend to the same questions. The higher score wins (then the faster run): 15 points for a win, 3 for playing.')}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => challenge(false)}>{t('Challenge a friend')}</Button>
              <Button size="sm" variant="secondary" onClick={() => challenge(true)}>{t('Open challenge')}</Button>
            </div>
            {duels?.open.length ? (
              <div className="space-y-1.5">
                <p className="text-[11px] font-black uppercase text-slate-500">{t('Open challenges')}</p>
                {duels.open.slice(0, 5).map(d => (
                  <Link key={d.code} to={`/games/duel/${d.code}`} className="flex items-center gap-2 rounded-lg bg-slate-950/50 px-3 py-2 hover:bg-slate-800">
                    <Avatar name={d.challenger?.name || ''} src={d.challenger?.avatar} size={24} />
                    <span className="flex-1 text-sm text-white">{d.challenger?.name}</span>
                    <span className="text-xs font-bold text-amber-300">{t('Accept')}</span>
                  </Link>
                ))}
              </div>
            ) : null}
            {duels?.mine.length ? (
              <div className="space-y-1.5">
                <p className="text-[11px] font-black uppercase text-slate-500">{t('Your duels')}</p>
                {duels.mine.slice(0, 6).map(d => (
                  <Link key={d.code} to={`/games/duel/${d.code}`} className="flex items-center gap-2 rounded-lg bg-slate-950/50 px-3 py-2 hover:bg-slate-800 text-sm">
                    <span className="font-mono text-xs text-slate-500">{d.code}</span>
                    <span className="flex-1 text-white truncate">
                      {d.challenger?.name} vs {d.opponent?.name || t('waiting…')}
                    </span>
                    <DuelStatus d={d} />
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}
    </Card>
  );
}

function DuelStatus({ d }: { d: DuelView }) {
  const t = useT();
  const { user } = useApp();
  if (d.status === 'expired') return <Pill>{t('Expired')}</Pill>;
  if (d.status === 'done') return d.winnerId ? <Pill tone={d.winnerId === user?.id ? 'green' : 'red'}>{d.winnerId === user?.id ? t('Won') : t('Lost')}</Pill> : <Pill>{t('Draw')}</Pill>;
  return <Pill tone="blue">{t('Waiting')}</Pill>;
}

/** A duel: invite link, play, and the result once both have played. Also the /games/duel/:code page. */
export function DuelRunner({ code, onExit }: { code: string; onExit?: () => void }) {
  const t = useT();
  const { user, toast } = useApp();
  const signedIn = useSignIn();
  const [duel, setDuel] = useState<DuelView | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<StatWarsResult | null>(null);
  const load = () => api.getDuel(code).then(r => setDuel(r.duel)).catch(e => toast(e.message, 'error'));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, user?.id]);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/games/duel/${code}` : `/games/duel/${code}`;
  const copy = async () => {
    try {
      if (navigator.share) await navigator.share({ title: t('Stat Wars duel'), text: t('Beat my Stat Wars score!'), url: link });
      else {
        await navigator.clipboard.writeText(link);
        toast(t('Link copied'));
      }
    } catch {
      /* cancelled */
    }
  };
  if (!duel) return <p className="text-sm text-slate-400 py-4">{t('Loading the duel…')}</p>;
  if (running)
    return (
      <StatWarsRun
        duel={code}
        onCancel={() => setRunning(false)}
        onDone={r => {
          setRunning(false);
          setResult(r);
          if (r.duel) setDuel(r.duel);
        }}
      />
    );
  const side = (s: DuelView['challenger']) =>
    s ? (
      <div className={cx('flex-1 rounded-xl border p-3 text-center', duel.winnerId === s.userId ? 'border-amber-400 bg-amber-400/10' : 'border-slate-800 bg-slate-950/50')}>
        <Avatar name={s.name} src={s.avatar} size={40} />
        <p className="mt-1 text-sm font-black text-white truncate">{s.name}</p>
        <p className="text-xs text-slate-400">{s.score !== null ? t('{score} pts · {n} correct · {s}s', { score: s.score, n: s.correct ?? 0, s: s.seconds ?? 0 }) : s.played ? t('Played') : t('Not played yet')}</p>
      </div>
    ) : (
      <div className="flex-1 rounded-xl border border-dashed border-slate-700 p-3 text-center text-sm text-slate-500 flex items-center justify-center">{t('Waiting for an opponent')}</div>
    );
  return (
    <div className="space-y-4" data-testid="duel">
      <div className="flex items-stretch gap-2">
        {side(duel.challenger)}
        <span className="self-center text-xs font-black text-slate-500">VS</span>
        {side(duel.opponent)}
      </div>
      {duel.status === 'done' && <p className="text-center text-sm font-black text-amber-300">{duel.winnerId ? (duel.winnerId === user?.id ? t('You won the duel! +15 points') : t('{name} won the duel', { name: (duel.winnerId === duel.challenger?.userId ? duel.challenger?.name : duel.opponent?.name) || '' })) : t('A draw!')}</p>}
      {duel.status === 'expired' && <Notice>{t('This duel expired before both fans played.')}</Notice>}
      {result && <StatWarsReview r={result} />}
      <div className="flex flex-wrap gap-2">
        {duel.youCanJoin && (
          <Button
            onClick={async () => {
              if (!signedIn()) return;
              try {
                setDuel((await api.joinDuel(code)).duel);
              } catch (e: any) {
                toast(e.message, 'error');
              }
            }}
          >
            {t('Accept the challenge')}
          </Button>
        )}
        {duel.youCanPlay && <Button onClick={() => setRunning(true)}>{t('Play your 60 seconds')}</Button>}
        {duel.status === 'waiting' && user && duel.challenger?.userId === user.id && !duel.opponent && (
          <Button variant="secondary" onClick={copy}>
            <Copy className="w-4 h-4" /> {t('Send the invite link')}
          </Button>
        )}
        {onExit && (
          <Button variant="ghost" onClick={onExit}>
            {t('Back')}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Small summary for leaderboards. */
export function useGameLabels() {
  const t = useT();
  return useMemo(() => ({ connections: t('Squad Connections'), grid: t('Cricket Grid'), statwars: t('Stat Wars') }), [t]);
}

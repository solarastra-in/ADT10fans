import React, { useMemo, useState } from 'react';
import { Check, Search, Target, X } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Avatar, Button, Card, ErrorBox, Notice, PageHeader, SectionTitle, Spinner, cx, inputCls } from '../components/ui';
import type { GamesToday, GuessState, SuperOverState } from '../types';

function nextDubaiMidnight() {
  const now = new Date();
  const dubai = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));
  const ms = (24 - dubai.getHours()) * 3600_000 - dubai.getMinutes() * 60_000 - dubai.getSeconds() * 1000;
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return `${h}h ${m}m`;
}

function GuessGame({ data, onChange }: { data: GamesToday; onChange: (g: GuessState) => void }) {
  const { user, openAuth, setUser, toast, teamById } = useApp();
  const t = useT();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const g = data.guess;
  const guessed = new Set((g.guesses || []).map(x => x.playerId));
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return data.players.filter(p => p.name.toLowerCase().includes(s) && !guessed.has(p.id)).slice(0, 8);
  }, [q, data.players, g.guesses]);

  if (!g.available) return <Notice>{t('Guess the Player starts once squads are published.')}</Notice>;

  const guess = async (playerId: string) => {
    if (!user) return openAuth(t('Sign in to play the daily games.'));
    setBusy(true);
    try {
      const r = await api.submitGuess(playerId);
      onChange(r.guess);
      setUser(r.user);
      setQ('');
      if (r.guess.solved) toast(t('You got it! +{n} points', { n: r.guess.points || 0 }));
      else if (r.guess.finished) toast(t('Out of guesses. It was {name}.', { name: r.guess.answer?.name || '' }), 'info');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 space-y-4" data-testid="guess-game">
      <div>
        <h2 className="text-lg font-black text-white">{t('Guess the Player')}</h2>
        <p className="text-sm text-slate-400">{t('A mystery player from the six squads. Each wrong guess reveals another clue. {n} guesses.', { n: g.maxGuesses || 5 })}</p>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="clues">
        {(g.clues || []).map(c => (
          <li key={c.label} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-amber-400">{t(c.label)}</span>
            <span className="block text-sm font-bold text-white">{t(c.value)}</span>
          </li>
        ))}
      </ul>
      {(g.guesses || []).length > 0 && (
        <ul className="space-y-1.5">
          {g.guesses!.map(x => (
            <li key={x.playerId} className={cx('flex items-center gap-2 p-2.5 rounded-xl border text-sm', x.correct ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-950/60 border-slate-800')}>
              {x.correct ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
              <span className="flex-1 min-w-0 font-bold text-white truncate">{x.name}</span>
              {!x.correct && (
                <>
                  <span className={cx('text-[11px] font-bold px-1.5 py-0.5 rounded', x.sameTeam ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500')}>{t('Team')}</span>
                  <span className={cx('text-[11px] font-bold px-1.5 py-0.5 rounded', x.sameRole ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500')}>{t('Role')}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {g.finished ? (
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center gap-3" data-testid="guess-result">
          <Avatar name={g.answer?.name || '?'} src={g.answer?.photoUrl} size={52} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400">{g.solved ? t('Solved! +{n} points', { n: g.points || 0 }) : t('Today’s player was')}</p>
            <Link to={`/players/${g.answer?.id}`} className="block font-black text-white hover:text-amber-300">{g.answer?.name}</Link>
            <p className="text-xs text-slate-400">{teamById(g.answer?.teamId)?.name}</p>
          </div>
          <span className="text-[11px] text-slate-500 text-end">{t('New player in {time}', { time: nextDubaiMidnight() })}</span>
        </div>
      ) : (
        <div className="relative">
          <label className="relative block">
            <span className="sr-only">{t('Type a player name')}</span>
            <Search className="w-4 h-4 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Type a player name')} className={`${inputCls} ps-9`} disabled={busy} data-testid="guess-input" autoComplete="off" />
          </label>
          {matches.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
              {matches.map(p => (
                <li key={p.id}>
                  <button type="button" onClick={() => guess(p.id)} className="w-full text-start px-3 py-2.5 hover:bg-slate-800 text-sm text-white min-h-[44px] flex items-center gap-2" data-testid="guess-option">
                    <span className="w-2 h-2 rounded-full" style={{ background: teamById(p.teamId)?.color }} />
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-slate-500 mt-1">{t('{n} guesses left', { n: (g.maxGuesses || 5) - (g.guesses?.length || 0) })}</p>
        </div>
      )}
    </Card>
  );
}

function SuperOver({ data, onChange }: { data: GamesToday; onChange: (s: SuperOverState) => void }) {
  const { user, openAuth, setUser, toast } = useApp();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const s = data.superOver;
  const play = async (shot: string) => {
    if (!user) return openAuth(t('Sign in to play the daily games.'));
    setBusy(true);
    try {
      const r = await api.playSuperOverBall(shot as any);
      onChange(r.superOver);
      setUser(r.user);
      if (r.superOver.finished) toast(r.superOver.runs >= r.superOver.target ? t('Target chased! +{n} points', { n: r.superOver.points }) : t('Innings over: {runs} runs. +{n} points', { runs: r.superOver.runs, n: r.superOver.points }), 'info');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const ball = (o: number | 'W' | undefined, i: number) => (
    <span key={i} className={cx('w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border', o === undefined ? 'border-slate-700 text-slate-600' : o === 'W' ? 'bg-red-500 border-red-500 text-white' : o === 6 ? 'bg-amber-400 border-amber-400 text-slate-950' : o === 4 ? 'bg-sky-500 border-sky-500 text-white' : 'bg-slate-800 border-slate-700 text-white')}>
      {o === undefined ? '·' : o}
    </span>
  );
  return (
    <Card className="p-5 space-y-4" data-testid="superover-game">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">{t('Super Over')}</h2>
          <p className="text-sm text-slate-400">{t('Six balls, two wickets. Pick a shot for each ball. Beat the target for a bonus.')}</p>
        </div>
        <div className="text-end shrink-0">
          <p className="text-[11px] text-slate-400 uppercase font-bold">{t('Target')}</p>
          <p className="text-2xl font-black text-amber-400 tabular-nums inline-flex items-center gap-1"><Target className="w-5 h-5" />{s.target}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap" data-testid="balls">
        {Array.from({ length: 6 }, (_, i) => ball(s.balls[i]?.outcome, i))}
        <span className="ms-auto text-xl font-black text-white tabular-nums">{s.runs}/{s.wickets}</span>
      </div>
      {s.finished ? (
        <Notice tone={s.runs >= s.target ? 'success' : 'info'}>
          {s.runs >= s.target ? t('You chased {target}! {points} points (including the {bonus}-point bonus).', { target: s.target, points: s.points, bonus: s.bonus }) : t('You made {runs}. {points} points. New target in {time}.', { runs: s.runs, points: s.points, time: nextDubaiMidnight() })}
        </Notice>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {s.shots.map(sh => (
            <button key={sh.id} type="button" disabled={busy} onClick={() => play(sh.id)} className="min-h-[64px] p-2 rounded-xl bg-slate-950/70 border border-slate-700 hover:border-amber-400/60 text-center disabled:opacity-50" data-shot={sh.id}>
              <span className="block text-sm font-black text-white">{t(sh.label)}</span>
              <span className="block text-[10px] text-slate-400">{t(sh.hint)}</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function GamesPage() {
  const { user, teamById, config } = useApp();
  const t = useT();
  usePageMeta(t('Daily cricket games'), t('Guess the mystery player and bat a Super Over. New games every day.'), config?.brandName);
  const { data, setData, error, loading, reload } = useLoad(() => api.getGamesToday(), [user?.id]);
  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox message={error || ''} onRetry={reload} />;
  const board = (rows: GamesToday['leaderboards']['guess'], title: string) => (
    <Card>
      <p className="px-4 py-3 border-b border-slate-800 text-sm font-black text-white">{title}</p>
      {rows.length ? (
        <div className="divide-y divide-slate-800">
          {rows.map((r, i) => (
            <div key={r.userId} className={cx('flex items-center gap-3 px-4 py-2', r.userId === user?.id && 'bg-amber-400/5')}>
              <span className="w-5 text-center text-xs font-black text-slate-500">{i + 1}</span>
              <Avatar name={r.name} src={r.avatar} size={28} />
              <span className="flex-1 min-w-0 truncate text-sm text-white">{r.name}</span>
              {r.teamId && <span className="text-[11px] text-slate-500">{teamById(r.teamId)?.short}</span>}
              <span className="font-black text-amber-400 tabular-nums">{r.points}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-4 py-4 text-sm text-slate-500">{t('Nobody has finished today yet.')}</p>
      )}
    </Card>
  );
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t('New every day')} title={t('Daily games')} subtitle={t('One go at each game per day. Games reset at midnight UAE time (in {time}).', { time: nextDubaiMidnight() })} />
      {!user && <Notice>{t('Sign in to play and earn points.')}</Notice>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GuessGame data={data} onChange={g => setData({ ...data, guess: g })} />
        <SuperOver data={data} onChange={s => setData({ ...data, superOver: s })} />
      </div>
      <section>
        <SectionTitle title={t('Today’s best')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {board(data.leaderboards.guess, t('Guess the Player'))}
          {board(data.leaderboards.superover, t('Super Over'))}
        </div>
      </section>
    </div>
  );
}

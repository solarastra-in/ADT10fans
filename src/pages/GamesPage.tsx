import React, { useMemo, useState } from 'react';
import { Award, BookOpen, Check, ChevronDown, ChevronUp, Flame, Gamepad2, Grid3x3, HelpCircle, Info, Lightbulb, Puzzle, Search, Sparkles, Swords, Target, Trophy, X, Zap } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { playerLinkProps } from '../components/PlayerCard';
import { CricketGrid, SquadConnections, StatWars } from '../components/SkillGames';
import { Avatar, Button, Card, ErrorBox, Notice, PageHeader, Pill, SectionTitle, Spinner, cx, inputCls } from '../components/ui';
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
  const [showHelp, setShowHelp] = useState(false);
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
    <Card id="guess-game" className="p-5 space-y-4 scroll-mt-20" data-testid="guess-game">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-white">{t('Guess the Player')}</h2>
            <Pill tone="amber">50 pts max</Pill>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">{t('A mystery player from the six squads. Each wrong guess reveals another clue. 5 guesses.')}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-bold"
          aria-expanded={showHelp}
          title={t('How to play')}
        >
          <HelpCircle className="w-4 h-4" />
          <span className="hidden sm:inline">{showHelp ? t('Hide rules') : t('How to play')}</span>
        </button>
      </div>

      {showHelp && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-slate-300 space-y-2 animate-in fade-in duration-150">
          <p className="font-bold text-amber-300 flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4 shrink-0" />
            {t('How to Play Guess the Player:')}
          </p>
          <ul className="space-y-1 list-disc list-inside text-slate-300">
            <li><strong>{t('Goal')}:</strong> {t('Identify the secret mystery player chosen from the six tournament squads.')}</li>
            <li><strong>{t('5 Guesses')}:</strong> {t('You have up to 5 guesses. Each wrong guess reveals another clue about the mystery player (Role, Team, Batting style, Bowling style, Surname).')}</li>
            <li><strong>{t('Match indicators')}:</strong> {t('Wrong guesses show whether you matched the Target’s Team (✓/✕) and Role (✓/✕).')}</li>
            <li><strong>{t('Scoring')}:</strong> {t('1st guess = 50 pts · 2nd = 40 pts · 3rd = 30 pts · 4th = 20 pts · 5th = 10 pts.')}</li>
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-amber-400 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" />
            {t("Mystery Target Player's Clues")}
          </span>
          <span className="text-[11px] text-slate-400 font-medium lowercase">
            {t('{shown} of {total} revealed', { shown: (g.clues || []).length, total: g.maxGuesses || 5 })}
          </span>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="clues">
          {(g.clues || []).map(c => (
            <li key={c.label} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-400/90">{t("Target's {label}", { label: c.label })}</span>
              <span className="block text-sm font-black text-white">{t(c.value)}</span>
            </li>
          ))}
        </ul>
      </div>

      {(g.guesses || []).length > 0 && (
        <div className="space-y-1.5">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('Your Guesses')}</span>
          <ul className="space-y-1.5">
            {g.guesses!.map(x => {
              const playerObj = data.players.find(p => p.id === x.playerId);
              const tm = teamById(x.teamId || playerObj?.teamId);
              const pRole = x.role || playerObj?.role;
              return (
                <li key={x.playerId} className={cx('flex flex-wrap sm:flex-nowrap items-center gap-2 p-2.5 rounded-xl border text-sm', x.correct ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-950/60 border-slate-800')}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {x.correct ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <X className="w-4 h-4 text-red-400 shrink-0" />}
                    <div className="min-w-0">
                      <span className="font-bold text-white truncate block">{x.name}</span>
                      <span className="text-xs text-slate-400 flex items-center gap-1.5">
                        {tm && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tm.color }} />}
                        {tm?.name || tm?.short || ''} {pRole ? `· ${pRole}` : ''}
                      </span>
                    </div>
                  </div>
                  {!x.correct && (
                    <div className="flex items-center gap-1.5 ms-auto shrink-0">
                      <span className={cx('text-[11px] font-bold px-2 py-0.5 rounded border', x.sameTeam ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800/80 text-slate-400 border-slate-700/50')}>
                        {x.sameTeam ? t('✓ Team Match') : t('✕ Team Mismatch')}
                      </span>
                      <span className={cx('text-[11px] font-bold px-2 py-0.5 rounded border', x.sameRole ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800/80 text-slate-400 border-slate-700/50')}>
                        {x.sameRole ? t('✓ Role Match') : t('✕ Role Mismatch')}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {g.finished ? (
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center gap-3" data-testid="guess-result">
          <Avatar name={g.answer?.name || '?'} src={g.answer?.photoUrl} size={52} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400">{g.solved ? t('Solved! +{n} points', { n: g.points || 0 }) : t('Today’s player was')}</p>
            {g.answer?.id ? <a {...playerLinkProps(g.answer.id)} className="block font-black text-white hover:text-amber-300">{g.answer.name}</a> : null}
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
            <ul className="absolute z-20 mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden divide-y divide-slate-800">
              {matches.map(p => {
                const tm = teamById(p.teamId);
                return (
                  <li key={p.id}>
                    <button type="button" onClick={() => guess(p.id)} className="w-full text-start px-3 py-2.5 hover:bg-slate-800 text-sm text-white min-h-[44px] flex items-center justify-between gap-2" data-testid="guess-option">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: tm?.color || '#38bdf8' }} />
                        <span className="font-bold text-white truncate">{p.name}</span>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0 font-medium">
                        {tm?.short || tm?.name} {p.role ? `· ${p.role}` : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
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
  const [showHelp, setShowHelp] = useState(false);
  const ball = (o: number | 'W' | undefined, i: number) => (
    <span key={i} className={cx('w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border', o === undefined ? 'border-slate-700 text-slate-600' : o === 'W' ? 'bg-red-500 border-red-500 text-white' : o === 6 ? 'bg-amber-400 border-amber-400 text-slate-950' : o === 4 ? 'bg-sky-500 border-sky-500 text-white' : 'bg-slate-800 border-slate-700 text-white')}>
      {o === undefined ? '·' : o}
    </span>
  );
  return (
    <Card id="superover-game" className="p-5 space-y-4 scroll-mt-20" data-testid="superover-game">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-white">{t('Super Over')}</h2>
            <Pill tone="green">+15 pts bonus</Pill>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">{t('Six balls, two wickets. Pick a shot for each ball. Beat the target for a bonus.')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-end">
            <p className="text-[10px] text-slate-400 uppercase font-black">{t('Target')}</p>
            <p className="text-2xl font-black text-amber-400 tabular-nums inline-flex items-center gap-1"><Target className="w-5 h-5" />{s.target}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
            title={t('How to play')}
            aria-expanded={showHelp}
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showHelp && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-slate-300 space-y-2 animate-in fade-in duration-150">
          <p className="font-bold text-amber-300 flex items-center gap-1.5">
            <Zap className="w-4 h-4 shrink-0" />
            {t('Super Over Rules & Shot Tactics:')}
          </p>
          <ul className="space-y-1 list-disc list-inside text-slate-300">
            <li><strong>{t('Target & Wickets')}:</strong> {t('You have 6 deliveries to score {target} runs. Losing 2 wickets ends your innings immediately.', { target: s.target })}</li>
            <li><strong>{t('Shot selection')}:</strong> {t('Defend (safe, 0-1 run) · Rotate (1-2 runs) · Drive (4s/2s) · Loft (6s/4s) · Slog (6s or out).')}</li>
            <li><strong>{t('Points')}:</strong> {t('1 point per run scored + 15 bonus points if you successfully chase or beat the target.')}</li>
          </ul>
        </div>
      )}

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
            <button key={sh.id} type="button" disabled={busy} onClick={() => play(sh.id)} className="min-h-[64px] p-2 rounded-xl bg-slate-950/70 border border-slate-700 hover:border-amber-400/60 text-center disabled:opacity-50 transition-colors" data-shot={sh.id}>
              <span className="block text-sm font-black text-white">{t(sh.label)}</span>
              <span className="block text-[10px] text-slate-400">{t(sh.hint)}</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function HowToPlayGuide() {
  const t = useT();
  const [tab, setTab] = useState<'guess' | 'superover'>('guess');

  return (
    <Card id="how-to-play" className="p-6 scroll-mt-20 border border-amber-500/20 bg-slate-900/80 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-black text-white">{t('How to Play & Game Instructions')}</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{t('Master daily games to climb the fan leaderboard and earn points for your favorite franchise.')}</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setTab('guess')}
            className={cx('px-3 py-1.5 rounded-lg text-xs font-bold transition-colors', tab === 'guess' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white')}
          >
            {t('Guess the Player')}
          </button>
          <button
            type="button"
            onClick={() => setTab('superover')}
            className={cx('px-3 py-1.5 rounded-lg text-xs font-bold transition-colors', tab === 'superover' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white')}
          >
            {t('Super Over')}
          </button>
        </div>
      </div>

      {tab === 'guess' ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="p-2 rounded-lg bg-amber-400/10 text-amber-400 shrink-0">
              <Search className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">{t('Guess the Player Rules')}</h3>
              <p className="text-xs text-slate-300 mt-1">
                {t('A mystery player from the six squads. Each wrong guess reveals another clue. 5 guesses.')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider">1. {t('Read the Clues')}</span>
              <p className="text-slate-300 font-medium">
                {t('You begin with 1 clue about today’s secret mystery player (such as their Playing Role). Search and submit any registered squad player.')}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <span className="text-[11px] font-black uppercase text-emerald-400 tracking-wider">2. {t('Verify Match Feedback')}</span>
              <p className="text-slate-300 font-medium">
                {t('Each guess shows your player’s true team and whether their Franchise Team (✓/✕) and Role (✓/✕) match today’s secret player.')}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <span className="text-[11px] font-black uppercase text-sky-400 tracking-wider">3. {t('Unlock Progressive Clues')}</span>
              <p className="text-slate-300 font-medium">
                {t('Each incorrect guess unlocks a new clue about the secret player: Franchise Team, Batting style, Bowling style, and Surname initial.')}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider block mb-2">{t('Scoring Payout:')}</span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="block text-slate-400 text-[10px] uppercase font-bold">{t('1st Guess')}</span>
                <span className="font-black text-emerald-400 text-sm">50 pts</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="block text-slate-400 text-[10px] uppercase font-bold">{t('2nd Guess')}</span>
                <span className="font-black text-amber-300 text-sm">40 pts</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="block text-slate-400 text-[10px] uppercase font-bold">{t('3rd Guess')}</span>
                <span className="font-black text-amber-400 text-sm">30 pts</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="block text-slate-400 text-[10px] uppercase font-bold">{t('4th Guess')}</span>
                <span className="font-black text-sky-300 text-sm">20 pts</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="block text-slate-400 text-[10px] uppercase font-bold">{t('5th Guess')}</span>
                <span className="font-black text-slate-300 text-sm">10 pts</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="p-2 rounded-lg bg-amber-400/10 text-amber-400 shrink-0">
              <Flame className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">{t('Super Over Rules')}</h3>
              <p className="text-xs text-slate-300 mt-1">
                {t('Six balls, two wickets. Pick a shot for each ball. Beat the target for a bonus.')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider">1. {t('The 6-Ball Chase')}</span>
              <p className="text-slate-300 font-medium">
                {t('You face exactly 6 deliveries to score as many runs as possible and chase down today’s target score.')}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <span className="text-[11px] font-black uppercase text-rose-400 tracking-wider">2. {t('2 Wickets in Hand')}</span>
              <p className="text-slate-300 font-medium">
                {t('You have only 2 wickets. If 2 batsmen get dismissed (W), the innings terminates on the spot!')}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <span className="text-[11px] font-black uppercase text-emerald-400 tracking-wider">3. {t('Points & Bonus')}</span>
              <p className="text-slate-300 font-medium">
                {t('Every run scored earns 1 fan point. Successfully chasing the target awards a huge +15 points victory bonus!')}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider block">{t('Shot Profiles & Risk vs Reward:')}</span>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-bold text-white block">{t('Defend')}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">{t('Safe, 0–1 run')}</span>
                <span className="text-[10px] text-emerald-400 font-semibold block mt-1">~5% Wicket risk</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-bold text-white block">{t('Rotate')}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">{t('Ones & twos')}</span>
                <span className="text-[10px] text-emerald-400 font-semibold block mt-1">~8% Wicket risk</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-bold text-white block">{t('Drive')}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">{t('Fours, some risk')}</span>
                <span className="text-[10px] text-sky-400 font-semibold block mt-1">~12% Wicket risk</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-bold text-white block">{t('Loft')}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">{t('Sixes, real risk')}</span>
                <span className="text-[10px] text-amber-400 font-semibold block mt-1">~20% Wicket risk</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-bold text-white block">{t('Slog')}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">{t('Six or out')}</span>
                <span className="text-[10px] text-rose-400 font-semibold block mt-1">~30% Wicket risk</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function GamesPage() {
  const { user, teamById, config } = useApp();
  const t = useT();
  usePageMeta(t('Daily cricket games'), t('Squad Connections, Cricket Grid, Stat Wars duels, Guess the Player and Super Over. New games every day.'), config?.brandName);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageHeader eyebrow={t('New every day')} title={t('Daily games')} subtitle={t('One go at each game per day. Games reset at midnight UAE time (in {time}).', { time: nextDubaiMidnight() })} />
        <a
          href="#how-to-play"
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400/10 border border-amber-500/40 text-amber-300 hover:bg-amber-400/20 text-xs font-bold transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          {t('How to Play & Rules')}
        </a>
      </div>

      {/* Navigation Jump Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label={t('Games Navigation')}>
        <a href="#guess-game" className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white shrink-0 flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-amber-400" />
          {t('Guess the Player')}
        </a>
        <a href="#superover-game" className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white shrink-0 flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          {t('Super Over')}
        </a>
        <a href="#connections-game" className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white shrink-0 flex items-center gap-1.5">
          <Puzzle className="w-3.5 h-3.5 text-amber-400" />
          {t('Squad Connections')}
        </a>
        <a href="#grid-game" className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white shrink-0 flex items-center gap-1.5">
          <Grid3x3 className="w-3.5 h-3.5 text-amber-400" />
          {t('Cricket Grid')}
        </a>
        <a href="#statwars-game" className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white shrink-0 flex items-center gap-1.5">
          <Swords className="w-3.5 h-3.5 text-amber-400" />
          {t('Stat Wars')}
        </a>
        <a href="#leaderboards" className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white shrink-0 flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          {t('Today’s Leaderboards')}
        </a>
        <a href="#how-to-play" className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-amber-500/40 text-xs font-bold text-amber-300 hover:bg-slate-800 shrink-0 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" />
          {t('Rules & Instructions')}
        </a>
      </div>

      {!user && <Notice>{t('Sign in to play and earn points.')}</Notice>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SquadConnections state={data.connections} onChange={c => setData({ ...data, connections: c })} />
        <CricketGrid state={data.grid} players={data.players} onChange={g => setData({ ...data, grid: g })} />
      </div>

      <StatWars state={data.statWars} onChange={s => setData({ ...data, statWars: s })} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GuessGame data={data} onChange={g => setData({ ...data, guess: g })} />
        <SuperOver data={data} onChange={s => setData({ ...data, superOver: s })} />
      </div>

      <HowToPlayGuide />

      <section id="leaderboards" className="scroll-mt-20">
        <SectionTitle title={t('Today’s best')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {board(data.leaderboards.connections || [], t('Squad Connections'))}
          {board(data.leaderboards.grid || [], t('Cricket Grid'))}
          {board(data.leaderboards.statwars || [], t('Stat Wars'))}
          {board(data.leaderboards.guess, t('Guess the Player'))}
          {board(data.leaderboards.superover, t('Super Over'))}
        </div>
      </section>
    </div>
  );
}

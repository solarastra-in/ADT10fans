import React, { useEffect, useMemo, useState } from 'react';
import { Crown, Lock, Star, Target, Users } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Button, Card, Countdown, EmptyState, ErrorBox, PageHeader, Pill, Spinner, TeamBadge, cx, useFormat, ROLE_SHORT } from '../components/ui';
import { ContestCard } from './ContestsPage';
import { Pick5Rules } from '../components/Pick5Rules';
import type { FanClubStatusResponse } from '../types';

/** The team games: Pick 5 and the team predictions for each of the fan club team's matches. */
/** Where the fan is checked in today and that club's offers for the match (the fan club landing). */
function FanClubToday({ status }: { status: FanClubStatusResponse }) {
  const { teamById } = useApp();
  const t = useT();
  const f = useFormat();
  const v = status.todayVisit;
  if (!v) return null;
  return (
    <Card className="p-4 space-y-3 border-emerald-500/40 bg-emerald-500/5" data-testid="fanclub-today">
      <p className="text-sm font-black text-emerald-300">
        {t('Checked in at {club} · +{n} points', { club: v.fanClubName, n: v.pointsAwarded })}
      </p>
      {v.teamA && v.teamB && (
        <p className="text-xs text-slate-300">
          {v.matchNo ? t('Match {n}', { n: v.matchNo }) : t('TEST MATCH')}: {teamById(v.teamA)?.short || v.teamA} vs {teamById(v.teamB)?.short || v.teamB}
          {v.startsAt ? ` · ${f.dateTime(v.startsAt)}` : ''}
        </p>
      )}
      {status.todayOffers?.length ? (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">{t('Offers for you here today')}</p>
          <ul className="space-y-2" data-testid="fanclub-today-offers">
            {status.todayOffers.map(o => (
              <li key={o.id} className={cx('rounded-xl border p-3 text-sm', o.used ? 'border-slate-800 opacity-60' : 'border-emerald-500/30 bg-slate-950/60')}>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white flex-1">{o.title}</span>
                  {o.used ? <Pill>{t('Used')}</Pill> : o.bonusPoints ? <Pill tone="amber">+{o.bonusPoints}</Pill> : null}
                </div>
                {o.description && <p className="text-xs text-slate-400 mt-1">{o.description}</p>}
                {!o.used && <p className="text-[11px] text-slate-500 mt-1">{t('Show your code at the desk to use it.')}</p>}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-slate-400">{t('No offers at this fan club for this match.')}</p>
      )}
    </Card>
  );
}

export default function TeamGamesPage() {
  const { user, config, teamById } = useApp();
  const fc = useLoad(() => (user ? api.getFanClubStatus() : Promise.resolve(null)), [user?.id]);
  const t = useT();
  const f = useFormat();
  const games = useLoad(() => api.teamGames(), [user?.id]);
  const contests = useLoad(() => api.getContests(), [user?.id]);
  const team = games.data?.team;
  usePageMeta(team ? t('{team} games: Pick 5 and predictions', { team: team.name }) : t('Team games'), undefined, config?.brandName);

  if (games.error) return <ErrorBox message={games.error} onRetry={games.reload} />;
  if (!games.data) return <Spinner />;
  if (!team) return <EmptyState title={t('No team games yet')} body={t('An admin chooses the team in Admin → Settings.')} />;

  const now = Date.now();
  const upcoming = games.data.matches.filter(m => m.status !== 'completed' && m.status !== 'abandoned');
  const done = games.data.matches.filter(m => m.status === 'completed').reverse();
  const entries = new Map((contests.data?.myEntries || []).map(e => [e.contestId, e]));
  const contestOf = (id: string | null) => (id ? contests.data?.contests.find(c => c.id === id) : undefined);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('Team games')}
        title={t('{team} games', { team: team.name })}
        subtitle={t('Pick 5 of the {team} players for each match, and predict their total, score after 5 overs, sixes, fours and wickets. Free for every fan.', { team: team.short || team.name })}
      />
      {fc.data && <FanClubToday status={fc.data} />}
      {games.data.onlyTeamGames && (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100" data-testid="team-games-only">
          {t('You checked in at a fan club, so these are your games this season.')}
        </p>
      )}
      <Pick5Rules divisor={games.data.fanPointsDivisor} />

      <section className="space-y-3" data-testid="team-games-upcoming">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">{t('Matches')}</h2>
        {upcoming.length === 0 && <p className="text-sm text-slate-400">{t('No upcoming matches.')}</p>}
        {upcoming.map(m => {
          const a = teamById(m.teamA);
          const b = teamById(m.teamB);
          const c = contestOf(m.contestId);
          return (
            <Card key={m.matchId} className="p-4 space-y-4" data-testid="team-game-match">
              <div className="flex items-center gap-2 flex-wrap">
                <TeamBadge team={a} size="sm" />
                <span className="font-black text-white">{a?.short || m.teamA} vs {b?.short || m.teamB}</span>
                <TeamBadge team={b} size="sm" />
                <span className="ms-auto text-xs text-slate-400">{t('Match {n}', { n: m.matchNo })} · {f.dateTime(m.startsAt)}</span>
              </div>
              {m.open ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/team-games/${encodeURIComponent(m.matchId)}`} className={cx('inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black', m.pick ? 'border border-emerald-500/40 text-emerald-300' : 'bg-amber-400 text-slate-950')} data-testid="pick5-link">
                    <Star className="w-3.5 h-3.5" /> {m.pick ? t('Edit Pick 5') : t('Pick 5 players')}
                  </Link>
                  <span className="text-xs text-slate-400"><Countdown to={m.startsAt} prefix="locks in {time}" /></span>
                  <span className="text-xs text-slate-500">· {t('{n} fans picked', { n: m.picks })}</span>
                </div>
              ) : m.locked ? (
                <p className="text-xs text-slate-400 inline-flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> {t('Locked: the match has started')}</p>
              ) : (
                <p className="text-xs text-slate-400">{t('Opens {date}', { date: f.dateTime(m.opensAt) })}</p>
              )}
              {c && <ContestCard c={c} entry={entries.get(c.id)} entries={contests.data?.entryCounts[c.id] || 0} onEntered={() => { contests.reload(); games.reload(); }} />}
            </Card>
          );
        })}
      </section>

      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">{t('Results')}</h2>
          <ul className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/60">
            {done.map(m => (
              <li key={m.matchId} className="p-3 text-sm flex flex-wrap items-center gap-2">
                <span className="font-bold text-white">{t('Match {n}', { n: m.matchNo })}: {teamById(m.teamA)?.short} vs {teamById(m.teamB)?.short}</span>
                <span className="ms-auto flex gap-2">
                  {m.pick ? <Pill tone={m.pick.scored ? 'amber' : 'slate'}>{t('Pick 5')}: {m.pick.scored ? Math.round((m.pick.points || 0) / games.data!.fanPointsDivisor) + ' ' + t('pts') : t('scoring soon')}</Pill> : null}
                  {m.predicted ? <Pill tone={m.predictionPoints !== null ? 'green' : 'slate'}>{t('Predictions')}: {m.predictionPoints ?? '…'}</Pill> : null}
                  <Link to={`/team-games/${encodeURIComponent(m.matchId)}`} className="text-xs text-amber-300 underline">{t('Details')}</Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-slate-500">
        {t('Pick 5 uses the Pick XI scoring; your captain scores double. Fan points = Pick 5 points ÷ {d}.', { d: games.data.fanPointsDivisor })}{' '}
        <Link to="/rules" className="underline">{t('Rules')}</Link>
      </p>
    </div>
  );
}

/** Pick five of the team's players for one match, and a captain. */
export function Pick5Page({ id }: { id: string }) {
  const { user, openAuth, teamById, toast, config } = useApp();
  const t = useT();
  const f = useFormat();
  const data = useLoad(() => api.pick5(id), [id, user?.id]);
  const results = useLoad(() => (data.data?.match.status === 'completed' ? api.pick5Results(id) : Promise.resolve(null)), [id, data.data?.match.status]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [captain, setCaptain] = useState('');
  const [busy, setBusy] = useState(false);
  usePageMeta(t('Pick 5'), undefined, config?.brandName);

  useEffect(() => {
    if (data.data?.pick) {
      setChosen(data.data.pick.playerIds);
      setCaptain(data.data.pick.captainId);
    }
  }, [data.data?.pick?.captainId, data.data?.pick?.playerIds.join(',')]);

  const size = data.data?.pickSize || 5;
  const editable = Boolean(data.data?.match.open);
  const pool = useMemo(() => [...(data.data?.pool || [])].sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name)), [data.data?.pool]);

  if (data.error) return <ErrorBox message={data.error} onRetry={data.reload} />;
  if (!data.data) return <Spinner />;
  const m = data.data.match;
  const team = teamById(data.data.teamId);

  const toggle = (pid: string) => {
    if (!editable) return;
    setChosen(c => (c.includes(pid) ? c.filter(x => x !== pid) : c.length >= size ? c : [...c, pid]));
    if (captain === pid) setCaptain('');
  };

  const save = async () => {
    if (!user) return openAuth(t('Sign in to save your Pick 5.'));
    setBusy(true);
    try {
      await api.savePick5(id, chosen, captain);
      toast(t('Pick 5 saved'));
      data.reload();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('Pick 5 · Match {n}', { n: m.matchNo })}
        title={`${teamById(m.teamA)?.short || m.teamA} vs ${teamById(m.teamB)?.short || m.teamB}`}
        subtitle={editable ? <Countdown to={m.startsAt} prefix="locks in {time}" /> : m.locked ? t('Locked: the match has started') : t('Opens {date}', { date: f.dateTime(m.opensAt) })}
      />
      <p className="text-sm text-slate-300">
        {t('Choose {n} {team} players and tap the crown to make one your captain (double points).', { n: size, team: team?.name || '' })}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="pick5-pool">
        {pool.map(p => {
          const on = chosen.includes(p.id);
          const cap = captain === p.id;
          const line = data.data!.pick?.breakdown?.find(b => b.playerId === p.id);
          return (
            <div key={p.id} className={cx('flex items-center gap-3 rounded-xl border p-3', on ? 'border-amber-400/70 bg-amber-400/10' : 'border-slate-800 bg-slate-900/60')}>
              <button type="button" onClick={() => toggle(p.id)} disabled={!editable} className="flex-1 flex items-center gap-3 text-start min-h-[44px]" aria-pressed={on} data-testid="pick5-player">
                <span className={cx('w-6 h-6 rounded-md border flex items-center justify-center text-xs font-black', on ? 'bg-amber-400 border-amber-400 text-slate-950' : 'border-slate-600')}>{on ? '✓' : ''}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-white truncate">{p.name}</span>
                  <span className="block text-[11px] text-slate-400">{ROLE_SHORT[p.role] || p.role}{p.selectedBy !== null ? ` · ${t('{n}% picked', { n: p.selectedBy })}` : ''}</span>
                </span>
              </button>
              {line && <span className="text-xs font-black text-amber-300">{line.total}</span>}
              {on && (
                <button type="button" onClick={() => editable && setCaptain(p.id)} disabled={!editable} className={cx('w-9 h-9 rounded-full flex items-center justify-center border', cap ? 'bg-amber-400 text-slate-950 border-amber-400' : 'border-slate-600 text-slate-400')} aria-label={t('Make {name} captain', { name: p.name })} aria-pressed={cap} data-testid="pick5-captain">
                  <Crown className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {editable && (
        <div className="sticky bottom-20 lg:bottom-4 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/95 p-3 backdrop-blur">
          <span className="text-sm text-slate-300 flex-1">
            <Users className="w-4 h-4 inline" /> {chosen.length}/{size} · {captain ? t('Captain chosen') : t('Choose a captain')}
          </span>
          <Button onClick={save} loading={busy} disabled={chosen.length !== size || !captain} data-testid="pick5-save">
            {data.data.pick ? t('Update') : t('Save Pick 5')}
          </Button>
        </div>
      )}
      {data.data.pick?.scoredAt && <p className="text-lg font-black text-amber-300">{t('Your Pick 5 scored {n} points', { n: data.data.pick.points ?? 0 })}</p>}
      {results.data?.results?.length ? (
        <section className="space-y-2">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 inline-flex items-center gap-1"><Target className="w-4 h-4" /> {t('Top Pick 5 teams')}</h2>
          <ol className="divide-y divide-slate-800 rounded-2xl border border-slate-800">
            {results.data.results.slice(0, 20).map(r => (
              <li key={r.rank + r.name} className={cx('p-2.5 text-sm flex gap-2', r.mine && 'bg-amber-400/10')}>
                <span className="w-6 text-slate-400">{r.rank}</span>
                <span className="flex-1 text-white">{r.name}</span>
                <span className="font-black text-amber-300">{r.points}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <Pick5Rules />
      <Link to="/team-games" className="text-sm text-amber-300 underline">{t('All {team} games', { team: team?.short || '' })}</Link>
    </div>
  );
}

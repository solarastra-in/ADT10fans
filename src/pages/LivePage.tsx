import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronRight, Radio, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, navigate, usePageMeta } from '../router';
import { Card, EmptyState, ErrorBox, PageHeader, Pill, Spinner, TeamBadge, cx, useFormat } from '../components/ui';
import { ScoreSourceLabel, StatusPill } from '../components/matches';
import { BarList, ManhattanChart, SERIES, WormChart } from '../components/LiveCharts';
import { analyse, MAX_BALLS, oversOf, type InningsView } from '../utils/matchAnalytics';
import type { Match } from '../types';

/** The match to open: the one live now, else the next within a day, else the last one played. */
function pickMatch(list: Match[], now = Date.now()) {
  const live = list.filter(m => m.status === 'live');
  if (live.length) return live[0];
  const soon = list.filter(m => m.status === 'upcoming' && +new Date(m.startsAt) - now < 24 * 3600_000 && +new Date(m.startsAt) > now - 6 * 3600_000).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  if (soon.length) return soon[0];
  const done = list.filter(m => m.status === 'completed').sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
  return done[0] || null;
}

function Tile({ label, value, sub, testid }: { label: string; value: React.ReactNode; sub?: React.ReactNode; testid?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 min-w-0" data-testid={testid}>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">{label}</p>
      <p className="mt-0.5 text-xl font-black text-white tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
    </div>
  );
}

function Section({ title, children, testid, note }: { title: string; children: React.ReactNode; testid?: string; note?: React.ReactNode }) {
  return (
    <Card className="p-4 space-y-3" data-testid={testid}>
      <div>
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-300">{title}</h2>
        {note && <p className="text-[11px] text-slate-500 mt-0.5">{note}</p>}
      </div>
      {children}
    </Card>
  );
}

export default function LivePage({ id }: { id?: string }) {
  const { teamById, config } = useApp();
  const t = useT();
  const f = useFormat();
  const list = useLoad(() => api.getMatches(), []);
  const matches = list.data?.matches || [];
  const chosen = id || pickMatch(matches)?.id || '';
  const detail = useLoad(() => (chosen ? api.getMatch(chosen) : Promise.resolve(null)), [chosen]);
  const m = detail.data?.match;
  const [now, setNow] = useState(Date.now());
  const live = m?.status === 'live';
  const near = m ? m.status === 'upcoming' && Math.abs(+new Date(m.startsAt) - now) < 30 * 60_000 : false;
  usePageMeta(m ? t('Live: {a} vs {b}', { a: teamById(m.teamA)?.short || m.teamA, b: teamById(m.teamB)?.short || m.teamB }) : t('Live scores'), undefined, config?.brandName);

  // While the match is on: ask for fresh scores every 30 seconds and reload every 15.
  useEffect(() => {
    if (!m || !(live || near)) return;
    const refresh = () => api.liveRefresh(m.id).catch(() => undefined);
    refresh();
    const a = setInterval(refresh, 30_000);
    const b = setInterval(() => { detail.reload(); setNow(Date.now()); }, 15_000);
    return () => { clearInterval(a); clearInterval(b); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.id, live, near]);
  useEffect(() => {
    const c = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(c);
  }, []);

  const a = useMemo(() => (m ? analyse(m) : null), [m]);
  if (list.error) return <ErrorBox message={list.error} onRetry={list.reload} />;
  if (!list.data || (chosen && !detail.data && !detail.error)) return <Spinner />;
  if (!chosen || !m || !a) return <EmptyState title={t('No matches yet')} body={t('Live scores show here once the season’s matches are added.')} />;

  const label = (teamId: string) => teamById(teamId)?.short || teamId;
  const inn = a.innings;
  const series = (pick: (i: InningsView) => any[]) => inn.filter(i => pick(i).length).map(i => ({ label: label(i.teamId), points: pick(i) }));
  const color = (i: InningsView) => SERIES[i.n - 1];
  const updated = m.liveSyncedAt || m.updatedAt;
  const ago = updated ? Math.max(0, Math.round((now - +new Date(updated)) / 1000)) : null;
  const strip = [...matches]
    .filter(x => x.status === 'live' || Math.abs(+new Date(x.startsAt) - now) < 36 * 3600_000 || x.id === m.id)
    .sort((x, y) => +new Date(x.startsAt) - +new Date(y.startsAt))
    .slice(0, 8);
  const clubTeam = config?.fanClubTeamId || 'aces';
  const clubInn = inn.find(i => i.teamId === clubTeam);
  const clubBowling = inn.find(i => i.teamId !== clubTeam && (m.teamA === clubTeam || m.teamB === clubTeam));
  const fantasyTop = (detail.data?.fantasy.playerPoints || []).slice(0, 6);

  return (
    <div className="space-y-4" data-testid="live-page">
      <PageHeader eyebrow={t('Live centre')} title={t('Live score and stats')} subtitle={t('Every number here comes from the match’s scores and scorecard. It updates by itself while the match is on.')} />

      {strip.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" data-testid="live-match-strip">
          {strip.map(x => (
            <button
              key={x.id}
              type="button"
              onClick={() => navigate(`/live/${x.id}`)}
              className={cx('shrink-0 rounded-xl border px-3 py-2 text-xs font-bold text-start', x.id === m.id ? 'border-amber-400/60 bg-amber-400/10 text-white' : 'border-slate-800 bg-slate-900 text-slate-300')}
            >
              <span className="block">{label(x.teamA)} v {label(x.teamB)}</span>
              <span className={cx('block text-[10px]', x.status === 'live' ? 'text-red-300' : 'text-slate-500')}>{x.status === 'live' ? t('LIVE') : x.status === 'completed' ? t('Result') : f.time(x.startsAt)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Score */}
      <Card className="p-4 sm:p-5 space-y-3" data-testid="live-score">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
          <span className="font-semibold">{t('Match {n}', { n: m.matchNo })} · {m.stage}</span>
          <StatusPill m={m} />
        </div>
        <div className="space-y-2">
          {[m.teamA, m.teamB].map(teamId => {
            const i = inn.find(x => x.teamId === teamId);
            const batting = a.current?.teamId === teamId;
            return (
              <div key={teamId} className={cx('flex items-center gap-3 rounded-xl p-2', batting && 'bg-slate-950/70 ring-1 ring-red-500/30')}>
                <TeamBadge team={teamById(teamId)} size="sm" />
                <span className="flex-1 min-w-0 truncate font-black text-white">{teamById(teamId)?.name || teamId}</span>
                {batting && <Radio className="w-4 h-4 text-red-400 animate-pulse" aria-label={t('Batting')} />}
                {i ? (
                  <span className="font-mono text-xl font-black text-white tabular-nums">
                    {i.runs}/{i.wickets} <span className="text-xs text-slate-400">({i.overs})</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">{t('Yet to bat')}</span>
                )}
              </div>
            );
          })}
        </div>
        {m.result && <p className="text-emerald-300 font-bold text-sm text-center">{m.result}</p>}
        {!m.result && a.chase && (live || a.chase.need > 0) && (
          <p className="text-amber-200 font-bold text-sm text-center" data-testid="live-equation">
            {a.chase.need > 0
              ? t('{team} need {n} runs from {b} balls', { team: label(inn[1].teamId), n: a.chase.need, b: a.chase.ballsLeft })
              : t('{team} have reached the target', { team: label(inn[1].teamId) })}
          </p>
        )}
        {live && m.lastCommentary && <p className="text-red-300 text-xs text-center">{m.lastCommentary}</p>}
        {m.status === 'upcoming' && <p className="text-sm text-slate-300 text-center">{t('Starts {date}', { date: f.dateTime(m.startsAt) })}</p>}
        {m.toss && <p className="text-xs text-slate-400 text-center">{m.toss}</p>}
        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500">
          <ScoreSourceLabel m={m} />
          {ago !== null && (live || near) && (
            <span className="inline-flex items-center gap-1" data-testid="live-updated">
              <RefreshCw className="w-3 h-3" /> {ago < 60 ? t('Updated {n}s ago', { n: ago }) : t('Updated {n} min ago', { n: Math.round(ago / 60) })}
            </span>
          )}
        </div>
      </Card>

      {/* Key numbers */}
      {inn.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="live-tiles">
          {inn.map(i => (
            <Tile key={i.n} label={t('{team} run rate', { team: label(i.teamId) })} value={i.crr.toFixed(2)} sub={t('{r} runs in {o} overs', { r: i.runs, o: i.overs })} />
          ))}
          {a.chase && a.chase.need > 0 && a.chase.ballsLeft > 0 && (
            <Tile label={t('Required rate')} value={a.chase.rrr.toFixed(2)} sub={t('Target {n}', { n: a.chase.target })} testid="live-rrr" />
          )}
          {a.chase && <Tile label={t('Wickets in hand')} value={a.chase.wicketsLeft} sub={t('{b} balls left', { b: a.chase.ballsLeft })} />}
          {a.projection && (
            <Tile label={t('Projected score')} value={a.projection.atCrr} sub={t('At this rate · {a} at +1, {b} at +2 an over', { a: a.projection.plus1, b: a.projection.plus2 })} testid="live-projection" />
          )}
          {a.sameStage && (
            <Tile
              label={t('After {o} overs', { o: oversOf(a.sameStage.balls) })}
              value={`${a.sameStage.second}/${a.sameStage.secondWickets}`}
              sub={t('{team} were {r}/{w}', { team: label(inn[0].teamId), r: a.sameStage.first, w: a.sameStage.firstWickets })}
            />
          )}
          {a.current && a.current.partnerships.find(p => p.current) && (
            <Tile label={t('Partnership')} value={a.current.partnerships.find(p => p.current)!.runs} sub={t('for wicket {n}', { n: a.current.partnerships.find(p => p.current)!.wicket })} />
          )}
          {a.current && <Tile label={t('Balls left')} value={Math.max(0, MAX_BALLS - a.current.balls)} sub={t('in this innings')} />}
        </div>
      )}

      {/* At the crease */}
      {a.current && a.current.atCrease.length > 0 && (
        <Section title={t('At the crease')} testid="live-crease">
          <ul className="divide-y divide-slate-800">
            {a.current.atCrease.map(b => (
              <li key={b.name} className="py-2 flex items-center gap-2 text-sm">
                <span className="flex-1 min-w-0 truncate font-bold text-white">{b.name}</span>
                <span className="tabular-nums font-black text-white">{b.runs}<span className="text-slate-400 font-normal"> ({b.balls})</span></span>
                <span className="tabular-nums text-xs text-slate-400 w-24 text-end">{t('SR {n}', { n: Math.round(b.sr) })} · {b.fours}×4 {b.sixes}×6</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Aces numbers: the prediction lines */}
      {clubInn && (
        <Section title={t('{team} numbers', { team: teamById(clubTeam)?.name || clubTeam })} testid="live-club-numbers" note={t('These are what the {team} predictions are settled on.', { team: label(clubTeam) })}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Tile label={t('Total')} value={clubInn.runs} sub={t('{o} overs', { o: clubInn.overs })} />
            <Tile label={t('Sixes')} value={clubInn.card ? clubInn.sixes : '–'} />
            <Tile label={t('Fours')} value={clubInn.card ? clubInn.fours : '–'} />
            <Tile label={t('Wickets taken')} value={clubBowling ? clubBowling.wickets : '–'} sub={t('by {team} bowlers', { team: label(clubTeam) })} />
          </div>
        </Section>
      )}

      {/* Run charts */}
      {series(i => i.worm).length > 0 ? (
        <Section
          title={t('Run progression')}
          testid="live-worm"
          note={inn.some(i => i.wormSource === 'updates') ? t('From the score updates during the match.') : inn.some(i => i.wormSource === 'wickets') ? t('From the fall of wickets.') : t('From the over-by-over scores.')}
        >
          <WormChart series={series(i => i.worm)} />
        </Section>
      ) : null}
      {series(i => i.manhattan).length > 0 && (
        <Section title={t('Runs per over')} testid="live-manhattan">
          <ManhattanChart series={series(i => i.manhattan)} />
          {inn.some(i => i.phases.length) && (
            <table className="w-full text-xs tabular-nums" data-testid="live-phases">
              <thead className="text-slate-500">
                <tr><th className="text-start font-semibold py-1">{t('Phase')}</th>{inn.filter(i => i.phases.length).map(i => <th key={i.n} className="text-end font-semibold">{label(i.teamId)}</th>)}</tr>
              </thead>
              <tbody className="text-slate-200">
                {[['Powerplay', t('Powerplay (overs 1–3)')], ['Middle', t('Middle (overs 4–7)')], ['Death', t('Death (overs 8–10)')]].map(([key, name]) => (
                  <tr key={key} className="border-t border-slate-800">
                    <td className="py-1.5">{name}</td>
                    {inn.filter(i => i.phases.length).map(i => {
                      const p = i.phases.find(x => x.label === key);
                      return <td key={i.n} className="text-end">{p ? `${p.runs}/${p.wickets} · ${t('RR {n}', { n: p.rr.toFixed(1) })}${p.complete ? '' : ` ${t('(so far)')}`}` : '–'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      )}
      {inn.length > 0 && !series(i => i.manhattan).length && (
        <p className="text-[11px] text-slate-500 text-center" data-testid="live-no-overs">{t('Runs per over and the phase split show once the over-by-over scores are in.')}</p>
      )}

      {/* Batting */}
      {inn.some(i => i.topBatters.length) && (
        <Section title={t('Batting')} testid="live-batting">
          <div className="grid gap-4 sm:grid-cols-2">
            {inn.filter(i => i.topBatters.length).map(i => {
              const fromBat = Math.max(0, i.runs - i.extras);
              const share = i.runs ? Math.round((i.boundaryRuns / i.runs) * 100) : 0;
              const fast = [...i.topBatters].filter(b => b.balls >= 5).sort((x, y) => y.sr - x.sr)[0];
              return (
                <div key={i.n} className="space-y-3">
                  <p className="text-xs font-black text-white inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: color(i) }} /> {teamById(i.teamId)?.name || i.teamId}</p>
                  <BarList color={color(i)} rows={i.topBatters.map(b => ({ label: `${b.name}${b.notOut ? '*' : ''}`, value: b.runs, note: `(${b.balls}) · ${t('SR {n}', { n: Math.round(b.sr) })}` }))} />
                  <div className="grid grid-cols-3 gap-2">
                    <Tile label={t('Fours')} value={i.fours} />
                    <Tile label={t('Sixes')} value={i.sixes} />
                    <Tile label={t('In boundaries')} value={`${share}%`} sub={t('{n} of {m} runs', { n: i.boundaryRuns, m: i.runs })} />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {t('{n} runs off the bat, {e} extras.', { n: fromBat, e: i.extras })}
                    {fast ? ` ${t('Fastest: {name}, strike rate {sr}.', { name: fast.name, sr: Math.round(fast.sr) })}` : ''}
                  </p>
                  {i.card?.extras && i.extras > 0 && (
                    <p className="text-[11px] text-slate-500">
                      {t('Extras')}: {[['wd', i.card.extras.wides], ['nb', i.card.extras.noBalls], ['b', i.card.extras.byes], ['lb', i.card.extras.legByes]].filter(([, v]) => Number(v) > 0).map(([k, v]) => `${v} ${k}`).join(', ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Bowling */}
      {inn.some(i => i.bowlers.length) && (
        <Section title={t('Bowling')} testid="live-bowling">
          <div className="grid gap-4 sm:grid-cols-2">
            {inn.filter(i => i.bowlers.length).map(i => {
              const bowlingTeam = i.teamId === m.teamA ? m.teamB : m.teamA;
              const dots = i.bowlers.filter(b => b.dots !== undefined);
              const dotBalls = dots.reduce((s, b) => s + (b.dots || 0), 0);
              const dotOf = dots.reduce((s, b) => s + b.balls, 0);
              return (
                <div key={i.n} className="space-y-2 min-w-0">
                  <p className="text-xs font-black text-white">{t('{team} bowling', { team: teamById(bowlingTeam)?.name || bowlingTeam })}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs tabular-nums">
                      <thead className="text-slate-500"><tr><th className="text-start font-semibold py-1">{t('Bowler')}</th><th className="text-end font-semibold">O</th><th className="text-end font-semibold">R</th><th className="text-end font-semibold">W</th><th className="text-end font-semibold">{t('Econ')}</th>{dots.length > 0 && <th className="text-end font-semibold">{t('Dots')}</th>}</tr></thead>
                      <tbody className="text-slate-200">
                        {i.bowlers.map(b => (
                          <tr key={b.name} className="border-t border-slate-800">
                            <td className="py-1.5 max-w-[9rem] truncate">{b.name}</td>
                            <td className="text-end">{b.overs}</td>
                            <td className="text-end">{b.runs}</td>
                            <td className="text-end font-black text-white">{b.wickets}</td>
                            <td className="text-end">{b.economy.toFixed(1)}</td>
                            {dots.length > 0 && <td className="text-end">{b.dots ?? '–'}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {dotOf > 0 && <p className="text-[11px] text-slate-400">{t('{p}% dot balls', { p: Math.round((dotBalls / dotOf) * 100) })}</p>}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Partnerships and fall of wickets */}
      {inn.some(i => i.partnerships.length) && (
        <Section title={t('Partnerships')} testid="live-partnerships">
          <div className="grid gap-4 sm:grid-cols-2">
            {inn.filter(i => i.partnerships.length).map(i => (
              <div key={i.n} className="space-y-2">
                <p className="text-xs font-black text-white">{teamById(i.teamId)?.name || i.teamId}</p>
                <BarList
                  color={color(i)}
                  rows={i.partnerships.map(p => ({
                    label: p.current ? t('Wicket {n} (batting)', { n: p.wicket }) : p.outPlayer ? `${t('Wicket {n}', { n: p.wicket })} · ${p.outPlayer}` : t('Wicket {n} (unbeaten)', { n: p.wicket }),
                    value: p.runs,
                    note: p.fromBalls !== null && p.toBalls !== null ? t('{b} balls', { b: Math.max(0, p.toBalls - p.fromBalls) }) : undefined,
                  }))}
                />
                <p className="text-[11px] text-slate-500">
                  {t('Fall of wickets')}: {(i.card?.fallOfWickets || []).map(fw => `${fw.score}/${fw.wicket}${fw.over ? ` (${fw.over})` : ''}`).join(', ')}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Pick XI points */}
      {fantasyTop.length > 0 && (
        <Section title={t('Top Pick XI points')} testid="live-fantasy" note={t('Points from the scorecard so far.')}>
          <ul className="divide-y divide-slate-800 text-sm">
            {fantasyTop.map(p => (
              <li key={p.playerId} className="py-2 flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate text-white font-bold">{p.name}</span>
                <Pill>{label(p.teamId)}</Pill>
                <span className="tabular-nums font-black text-amber-300 w-12 text-end">{p.points}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {inn.length === 0 && (
        <Card className="p-4 text-sm text-slate-300 flex items-center gap-2" data-testid="live-waiting">
          <Activity className="w-4 h-4 text-amber-400" /> {t('The stats start with the first ball.')}
        </Card>
      )}

      <Link to={`/matches/${m.id}`} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm font-bold text-white" data-testid="live-full-scorecard">
        {t('Full scorecard and match page')} <ChevronRight className="w-4 h-4 text-amber-400" />
      </Link>
    </div>
  );
}

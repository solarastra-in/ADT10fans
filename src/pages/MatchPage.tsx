import React, { useMemo, useState } from 'react';
import { ExternalLink, MapPin, MessageSquarePlus, Trophy, Target, Users } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { playerLinkProps } from '../components/PlayerCard';
import { ButtonLink, Card, Countdown, ErrorBox, PageHeader, SectionTitle, Spinner, Tabs, TeamBadge, cx, useFormat, ROLE_SHORT } from '../components/ui';
import { ScoreSourceLabel, StatusPill } from '../components/matches';
import { YouTubePlayer } from '../components/social';
import { PollCard } from '../components/PollCard';
import type { InningsScorecard } from '../types';

function Scorecard({ inn }: { inn: InningsScorecard }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="text-xs text-slate-400">
            <tr className="border-b border-slate-800">
              <th className="text-start py-2 font-bold">{t('Batter')}</th>
              <th className="text-end font-bold">R</th>
              <th className="text-end font-bold">B</th>
              <th className="text-end font-bold">4s</th>
              <th className="text-end font-bold">6s</th>
              <th className="text-end font-bold">SR</th>
            </tr>
          </thead>
          <tbody>
            {inn.batting.map((b, i) => (
              <tr key={i} className="border-b border-slate-900">
                <td className="py-2">
                  <span className="font-bold text-white">{b.batsman}</span>
                  <span className="block text-[11px] text-slate-500">{b.dismissal || (b.isNotOut ? t('not out') : '')}</span>
                </td>
                <td className="text-end font-black text-white tabular-nums">{b.runs}</td>
                <td className="text-end tabular-nums text-slate-300">{b.balls}</td>
                <td className="text-end tabular-nums text-slate-300">{b.fours}</td>
                <td className="text-end tabular-nums text-slate-300">{b.sixes}</td>
                <td className="text-end tabular-nums text-slate-400">{b.strikeRate?.toFixed?.(1) ?? b.strikeRate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {inn.extras && <p className="text-xs text-slate-400">{t('Extras')}: {inn.extras.total}</p>}
      {inn.didNotBat?.length ? <p className="text-xs text-slate-400">{t('Did not bat')}: {inn.didNotBat.join(', ')}</p> : null}
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-sm min-w-[420px]">
          <thead className="text-xs text-slate-400">
            <tr className="border-b border-slate-800">
              <th className="text-start py-2 font-bold">{t('Bowler')}</th>
              <th className="text-end font-bold">O</th>
              <th className="text-end font-bold">M</th>
              <th className="text-end font-bold">R</th>
              <th className="text-end font-bold">W</th>
              <th className="text-end font-bold">Econ</th>
            </tr>
          </thead>
          <tbody>
            {inn.bowling.map((b, i) => (
              <tr key={i} className="border-b border-slate-900">
                <td className="py-2 font-bold text-white">{b.bowler}</td>
                <td className="text-end tabular-nums text-slate-300">{b.overs}</td>
                <td className="text-end tabular-nums text-slate-300">{b.maidens}</td>
                <td className="text-end tabular-nums text-slate-300">{b.runs}</td>
                <td className="text-end font-black text-white tabular-nums">{b.wickets}</td>
                <td className="text-end tabular-nums text-slate-400">{b.economy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MatchPage({ id }: { id: string }) {
  const { teamById, user, config } = useApp();
  const t = useT();
  const f = useFormat();
  const { data, error, loading, reload } = useLoad(() => api.getMatch(id), [id]);
  const polls = useLoad(() => api.getPolls({ matchId: id }), [id]);
  const m = data?.match;
  const a = teamById(m?.teamA);
  const b = teamById(m?.teamB);
  usePageMeta(m ? `${a?.name} vs ${b?.name}, ${t('Match {n}', { n: m.matchNo })}` : null, m ? `${f.dateTime(m.startsAt)} · ${m.venue}${m.result ? ` · ${m.result}` : ''}` : undefined, config?.brandName);
  const innings = useMemo(() => [m?.scorecard?.innings1, m?.scorecard?.innings2].filter(Boolean) as InningsScorecard[], [m]);
  const [tab, setTab] = useState('0');

  if (loading && !data) return <Spinner />;
  if (error || !m) return <ErrorBox message={error || t('Match not found')} onRetry={reload} />;
  const ytStream = m.streamUrl?.match(/(?:v=|youtu\.be\/|live\/)([\w-]{11})/)?.[1];

  const side = (team: typeof a, score?: string, overs?: string) => (
    <Link to={`/teams/${team?.id}`} className="flex flex-col items-center gap-2 text-center min-w-0 flex-1">
      <TeamBadge team={team} size="lg" />
      <span className="text-sm sm:text-base font-black text-white leading-tight">{team?.name}</span>
      {score && (
        <span className="font-mono text-xl sm:text-2xl font-black text-white tabular-nums">
          {score} <span className="text-xs text-slate-400">{overs ? `(${overs})` : ''}</span>
        </span>
      )}
    </Link>
  );

  return (
    <div className="space-y-6">
      <nav className="text-xs text-slate-500">
        <Link to="/matches" className="hover:text-white">{t('Matches')}</Link> / {t('Match {n}', { n: m.matchNo })}
      </nav>
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
          <span className="font-semibold">{t('Match {n}', { n: m.matchNo })} · {m.stage}</span>
          <StatusPill m={m} />
        </div>
        <div className="flex items-start gap-3">
          {side(a, m.scoreA, m.oversA)}
          <span className="pt-5 text-slate-500 font-black">vs</span>
          {side(b, m.scoreB, m.oversB)}
        </div>
        <div className="text-center space-y-1">
          {m.result && <p className="text-emerald-300 font-bold">{m.result}</p>}
          {m.status === 'live' && (m.lastCommentary || m.currentOver) && <p className="text-red-300 text-sm font-semibold">{m.lastCommentary || m.currentOver}</p>}
          {m.status === 'upcoming' && (
            <p className="text-sm text-slate-300">
              {f.dateTime(m.startsAt)} · <strong className="text-amber-300"><Countdown to={m.startsAt} prefix="Starts in {time}" /></strong>
            </p>
          )}
          {m.toss && <p className="text-xs text-slate-400">{m.toss}</p>}
          <p className="text-xs text-slate-500 inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {m.venue}</p>
          <div><ScoreSourceLabel m={m} /></div>
        </div>
        {(m.playerOfTheMatch || m.topScorer || m.topWicketTaker) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {m.playerOfTheMatch && <div className="p-3 rounded-xl bg-amber-400/10 border border-amber-400/20"><span className="text-amber-300 font-bold">{t('Player of the match')}</span><br /><span className="text-white font-bold">{m.playerOfTheMatch}</span></div>}
            {m.topScorer && <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800"><span className="text-slate-400 font-bold">{t('Top scorer')}</span><br /><span className="text-white font-bold">{m.topScorer}</span></div>}
            {m.topWicketTaker && <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800"><span className="text-slate-400 font-bold">{t('Best bowling')}</span><br /><span className="text-white font-bold">{m.topWicketTaker}</span></div>}
          </div>
        )}
        <div className="flex flex-wrap gap-2 justify-center">
          {m.status === 'upcoming' && (
            <ButtonLink to={`/fantasy/${m.id}`}>
              <Trophy className="w-4 h-4" /> {t('Pick your Pick XI')}
            </ButtonLink>
          )}
          {data.contests.some(c => c.status === 'open') && (
            <ButtonLink to="/contests" variant="secondary">
              <Target className="w-4 h-4" /> {t('Predict this match')}
            </ButtonLink>
          )}
          {m.streamUrl && !ytStream && (
            <ButtonLink to={m.streamUrl} external variant="outline">
              {t('Watch')} <ExternalLink className="w-4 h-4" />
            </ButtonLink>
          )}
        </div>
      </Card>

      {ytStream && (
        <section>
          <SectionTitle title={t('Watch')} />
          <YouTubePlayer videoId={ytStream} title={`${a?.name} vs ${b?.name}`} />
        </section>
      )}

      {innings.length > 0 && (
        <section>
          <SectionTitle title={t('Scorecard')} />
          <Card className="p-4 space-y-4">
            <Tabs value={tab} onChange={setTab} items={innings.map((inn, i) => ({ id: String(i), label: `${teamById(inn.teamId)?.short || inn.teamName || `#${i + 1}`} ${inn.totalRuns}/${inn.wickets}` }))} />
            {innings[Number(tab)] && <Scorecard inn={innings[Number(tab)]} />}
          </Card>
        </section>
      )}

      {data.fantasy.playerPoints.length > 0 && (
        <section>
          <SectionTitle title={t('Pick XI points')} action={<Link to="/rules#dream-xi" className="text-xs font-bold text-amber-400">{t('How points work')}</Link>} />
          <Card className="divide-y divide-slate-800">
            {data.fantasy.playerPoints.slice(0, 15).map(p => (
              <a key={p.playerId} {...playerLinkProps(p.playerId)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/40">
                <span className="w-2 h-2 rounded-full" style={{ background: teamById(p.teamId)?.color }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-white truncate">{p.name}</span>
                  <span className="block text-[11px] text-slate-500 truncate">{p.detail}</span>
                </span>
                <span className="font-black text-amber-400 tabular-nums">{p.points}</span>
              </a>
            ))}
          </Card>
        </section>
      )}

      {data.fantasy.lineups > 0 && data.fantasy.mostPicked.length > 0 && (
        <section>
          <SectionTitle title={t('Most picked in Pick XI')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {data.fantasy.mostPicked.map(p => (
              <Card key={p.playerId} className="p-3">
                <p className="text-sm font-bold text-white truncate">{p.name}</p>
                <p className="text-xs text-slate-400">{t('In {pct}% of teams · captain in {c}%', { pct: p.pct, c: p.captainPct })}</p>
              </Card>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">{t('{n} Pick XI teams for this match', { n: data.fantasy.lineups })}</p>
        </section>
      )}

      {(polls.data?.polls || []).length > 0 && (
        <section>
          <SectionTitle title={t('Fan polls')} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{polls.data!.polls.map(p => <PollCard key={p.id} poll={p} />)}</div>
        </section>
      )}

      <section>
        <SectionTitle title={t('Match talk')} action={<ButtonLink to={`/forum?new=1&matchId=${m.id}&category=matchday`} size="sm" variant="secondary"><MessageSquarePlus className="w-4 h-4" /> {t('New thread')}</ButtonLink>} />
        {data.threads.length ? (
          <Card className="divide-y divide-slate-800">
            {data.threads.map(th => (
              <Link key={th.id} to={`/forum/${th.id}`} className="block px-4 py-3 hover:bg-slate-800/40">
                <span className="text-sm font-bold text-white">{th.title}</span>
                <span className="block text-[11px] text-slate-500">{t('{n} replies', { n: th.commentsCount })}</span>
              </Link>
            ))}
          </Card>
        ) : (
          <p className="text-sm text-slate-400">{user ? t('No threads yet. Start the matchday conversation.') : t('No threads yet.')}</p>
        )}
      </section>

      <section>
        <SectionTitle title={t('Squads')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[a, b].map(team =>
            team ? (
              <Card key={team.id} className="p-4">
                <Link to={`/teams/${team.id}`} className="flex items-center gap-2 mb-3">
                  <TeamBadge team={team} size="sm" />
                  <span className="font-black text-white">{team.name}</span>
                  <Users className="w-4 h-4 text-slate-500 ms-auto" />
                </Link>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                  {team.squad.map(p => (
                    <li key={p.id} className="text-sm">
                      <a {...playerLinkProps(p.id)} className={cx('hover:text-amber-300', p.isIcon ? 'text-amber-200 font-bold' : 'text-slate-300')}>
                        {p.name}
                      </a>{' '}
                      <span className="text-[10px] text-slate-500">{ROLE_SHORT[p.role]}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null,
          )}
        </div>
      </section>
    </div>
  );
}

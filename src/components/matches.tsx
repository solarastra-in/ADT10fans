import React from 'react';
import { ChevronRight, MapPin, Radio } from 'lucide-react';
import { Link } from '../router';
import { useApp } from '../state';
import { useT } from '../i18n';
import { Card, Countdown, Pill, TeamBadge, cx, useFormat } from './ui';
import type { Match } from '../types';

export function StatusPill({ m }: { m: Match }) {
  const t = useT();
  if (m.status === 'live')
    return (
      <Pill tone="red" className="animate-pulse">
        <Radio className="w-3 h-3" /> {t('LIVE')}
      </Pill>
    );
  if (m.status === 'completed') return <Pill tone="green">{t('Result')}</Pill>;
  if (m.status === 'abandoned') return <Pill>{t('Abandoned')}</Pill>;
  return <Pill tone="amber">{t('Upcoming')}</Pill>;
}

/** Where the score came from, so fans know whether it is official-feed or entered by hand. */
export function ScoreSourceLabel({ m }: { m: Match }) {
  const t = useT();
  const f = useFormat();
  if (m.status === 'upcoming') return null;
  if (m.scoreSource === 'cricketdata') return <span className="text-[11px] text-slate-500">{t('Live data: CricketData.org · updated {when}', { when: f.ago(m.liveSyncedAt || m.updatedAt) })}</span>;
  if (m.scoreA || m.scoreB) return <span className="text-[11px] text-slate-500">{t('Score entered by the match centre · {when}', { when: f.ago(m.updatedAt) })}</span>;
  return null;
}

export function MatchCard({ m, compact }: { m: Match; compact?: boolean }) {
  const { teamById } = useApp();
  const t = useT();
  const f = useFormat();
  const a = teamById(m.teamA);
  const b = teamById(m.teamB);
  const row = (team: typeof a, score?: string, overs?: string, won?: boolean) => (
    <div className="flex items-center gap-3 min-w-0">
      <TeamBadge team={team} size="sm" />
      <span className={cx('flex-1 min-w-0 truncate text-sm font-bold', won ? 'text-white' : 'text-slate-200')}>{team?.name || '—'}</span>
      {score ? (
        <span className="font-mono text-sm font-bold text-white tabular-nums shrink-0">
          {score} {overs && <span className="text-slate-500 text-xs">({overs})</span>}
        </span>
      ) : null}
    </div>
  );
  return (
    <Card as="article" className="p-4 hover:border-slate-600 transition-colors" data-testid="match-card">
      <Link to={`/matches/${encodeURIComponent(m.id)}`} className="block space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
          <span className="font-semibold truncate">
            {t('Match {n}', { n: m.matchNo })} · {m.stage}
          </span>
          <StatusPill m={m} />
        </div>
        <div className="space-y-2">
          {row(a, m.scoreA, m.oversA, m.winner === m.teamA)}
          {row(b, m.scoreB, m.oversB, m.winner === m.teamB)}
        </div>
        {!compact && (
          <div className="flex items-center justify-between gap-2 text-xs pt-2 border-t border-slate-800">
            {m.status === 'completed' || m.status === 'abandoned' ? (
              <span className="text-emerald-300 font-semibold truncate">{m.result || t('Match completed')}</span>
            ) : m.status === 'live' ? (
              <span className="text-red-300 font-semibold truncate">{m.lastCommentary || m.currentOver || t('In progress')}</span>
            ) : (
              <span className="text-slate-300 truncate">
                {f.dateTime(m.startsAt)} · <Countdown to={m.startsAt} prefix="in {time}" />
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-slate-500 shrink-0 rtl-flip" />
          </div>
        )}
        {!compact && (
          <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
            <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{m.venue}</span>
          </div>
        )}
      </Link>
    </Card>
  );
}

export function sortMatches(list: Match[]) {
  const live = list.filter(m => m.status === 'live');
  const upcoming = list.filter(m => m.status === 'upcoming').sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const done = list.filter(m => m.status === 'completed' || m.status === 'abandoned').sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
  return { live, upcoming, done };
}

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Radio, RefreshCw, Trophy, Zap, ChevronRight, Clock, MapPin, Calendar, Activity } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../state';
import { useT } from '../i18n';
import { Link } from '../router';
import { Card, Countdown, Pill, TeamBadge, cx, useFormat } from './ui';
import type { Match, Team } from '../types';

interface LiveMatchScoreProps {
  initialMatch?: Match;
  className?: string;
}

export function LiveMatchScore({ initialMatch, className }: LiveMatchScoreProps) {
  const { teamById, teams: contextTeams } = useApp();
  const t = useT();
  const f = useFormat();

  const [liveMatch, setLiveMatch] = useState<Match | null>(initialMatch?.status === 'live' ? initialMatch : null);
  const [nextMatch, setNextMatch] = useState<Match | null>(null);
  const [hasLive, setHasLive] = useState<boolean>(initialMatch?.status === 'live');
  const [loading, setLoading] = useState<boolean>(!initialMatch);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch current live match & next fixture from backend
  const fetchLiveStatus = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await api.getLiveMatch();
      setHasLive(res.hasLive);
      setLiveMatch(res.match);
      setNextMatch(res.nextMatch);
      setLastUpdated(new Date());
      setFetchError(null);
    } catch (err: any) {
      // Fallback: query getMatches if live endpoint is unreachable
      try {
        const matchesRes = await api.getMatches();
        const matches = matchesRes.matches || [];
        const live = matches.find(m => m.status === 'live') || null;
        const upcoming = matches.filter(m => m.status === 'upcoming');
        setHasLive(Boolean(live));
        setLiveMatch(live);
        setNextMatch(upcoming[0] || null);
        setLastUpdated(new Date());
        setFetchError(null);
      } catch (fallbackErr: any) {
        setFetchError('Unable to refresh live score');
      }
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  // Polling: every 10s if match is live, every 30s if upcoming
  useEffect(() => {
    fetchLiveStatus();
    const intervalMs = hasLive ? 10000 : 30000;
    const interval = setInterval(() => {
      fetchLiveStatus(false);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [fetchLiveStatus, hasLive]);

  const activeMatch = liveMatch || nextMatch;
  const teamA = activeMatch ? teamById(activeMatch.teamA) : null;
  const teamB = activeMatch ? teamById(activeMatch.teamB) : null;

  // Compute run rate for live match
  const crr = useMemo(() => {
    if (!liveMatch) return null;
    const activeScore = liveMatch.scoreB ? liveMatch.scoreB : liveMatch.scoreA;
    const activeOvers = liveMatch.oversB ? liveMatch.oversB : liveMatch.oversA;
    if (!activeScore || !activeOvers) return null;

    const runs = parseInt(activeScore.split('/')[0], 10) || 0;
    const ov = parseFloat(activeOvers) || 0;
    const balls = Math.floor(ov) * 6 + Math.round((ov % 1) * 10);
    if (balls === 0) return '0.00';
    return ((runs / balls) * 6).toFixed(2);
  }, [liveMatch]);

  if (loading && !activeMatch) {
    return (
      <Card className={cx('p-5 animate-pulse bg-slate-900/60 border-slate-800', className)}>
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-28 bg-slate-800 rounded-full" />
          <div className="h-4 w-20 bg-slate-800 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 my-2">
          <div className="h-10 bg-slate-800 rounded-xl" />
          <div className="h-10 bg-slate-800 rounded-xl" />
        </div>
      </Card>
    );
  }

  // If no match at all in system
  if (!activeMatch) return null;

  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-3xl border transition-all duration-300',
        hasLive
          ? 'bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-950 border-rose-500/40 shadow-xl shadow-rose-950/20'
          : 'bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border-slate-800/80 shadow-lg',
        className
      )}
    >
      {/* Background Accent Glow */}
      {hasLive && (
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
      )}

      {/* Header Bar */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-800/60 text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          {hasLive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500 text-white font-black tracking-wider text-[11px] uppercase shadow-sm shadow-rose-500/50 animate-pulse">
              <Radio className="w-3 h-3" />
              {t('LIVE MATCH')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20 font-bold text-[11px] uppercase">
              <Clock className="w-3 h-3 text-amber-400" />
              {t('NEXT MATCH')}
            </span>
          )}

          <span className="text-slate-400 font-medium">
            {t('Match #{n}', { n: activeMatch.matchNo })} · Abu Dhabi T10 2026
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400 hidden sm:inline-flex items-center gap-1">
            <Activity className="w-3 h-3 text-emerald-400" />
            {t('Updated {ago}', { ago: f.ago(lastUpdated.toISOString()) })}
          </span>

          <button
            type="button"
            onClick={() => fetchLiveStatus(true)}
            disabled={refreshing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors focus:outline-none"
            title={t('Refresh score')}
            aria-label={t('Refresh score')}
          >
            <RefreshCw className={cx('w-3.5 h-3.5', refreshing && 'animate-spin text-amber-400')} />
          </button>
        </div>
      </div>

      {/* Main Scoreboard Body */}
      <div className="p-5 sm:p-6 space-y-5">
        {hasLive && liveMatch ? (
          /* LIVE MATCH VIEW */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              {/* Team A */}
              <div
                className={cx(
                  'p-4 rounded-2xl border transition-all flex items-center justify-between gap-3',
                  !liveMatch.scoreB
                    ? 'bg-slate-900/90 border-amber-400/40 shadow-sm shadow-amber-400/10 ring-1 ring-amber-400/20'
                    : 'bg-slate-950/60 border-slate-800'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <TeamBadge team={teamA} size="md" />
                  <div className="min-w-0">
                    <span className="text-base font-extrabold text-white block truncate">
                      {teamA?.name || activeMatch.teamA}
                    </span>
                    {!liveMatch.scoreB && (
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Zap className="w-3 h-3" /> {t('Batting')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xl sm:text-2xl font-black font-mono text-white block tabular-nums">
                    {liveMatch.scoreA || '0/0'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono block">
                    {liveMatch.oversA ? `${liveMatch.oversA} ov` : '0.0 ov'}
                  </span>
                </div>
              </div>

              {/* Team B */}
              <div
                className={cx(
                  'p-4 rounded-2xl border transition-all flex items-center justify-between gap-3',
                  liveMatch.scoreB
                    ? 'bg-slate-900/90 border-amber-400/40 shadow-sm shadow-amber-400/10 ring-1 ring-amber-400/20'
                    : 'bg-slate-950/60 border-slate-800'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <TeamBadge team={teamB} size="md" />
                  <div className="min-w-0">
                    <span className="text-base font-extrabold text-white block truncate">
                      {teamB?.name || activeMatch.teamB}
                    </span>
                    {liveMatch.scoreB && (
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Zap className="w-3 h-3" /> {t('Batting')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xl sm:text-2xl font-black font-mono text-white block tabular-nums">
                    {liveMatch.scoreB || '—'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono block">
                    {liveMatch.oversB ? `${liveMatch.oversB} ov` : 'Yet to bat'}
                  </span>
                </div>
              </div>
            </div>

            {/* Run Rate & Match Status Bar */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-3 text-slate-300">
                {crr && (
                  <span>
                    <strong className="text-white font-mono">{crr}</strong> {t('Current Run Rate (CRR)')}
                  </span>
                )}
                {liveMatch.result && (
                  <span className="text-amber-400 font-semibold">{liveMatch.result}</span>
                )}
              </div>

              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{activeMatch.venue || 'Zayed Cricket Stadium, Abu Dhabi'}</span>
              </div>
            </div>
          </div>
        ) : (
          /* UPCOMING MATCH VIEW */
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-3">
                  <TeamBadge team={teamA} size="md" />
                  <span className="font-extrabold text-white text-base sm:text-lg">
                    {teamA?.short || activeMatch.teamA}
                  </span>
                </div>

                <span className="text-xs font-black text-slate-400 uppercase tracking-widest px-2 py-1 rounded bg-slate-800/60">
                  VS
                </span>

                <div className="flex items-center gap-3">
                  <TeamBadge team={teamB} size="md" />
                  <span className="font-extrabold text-white text-base sm:text-lg">
                    {teamB?.short || activeMatch.teamB}
                  </span>
                </div>
              </div>

              {/* Countdown to Next Match */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-medium">{t('Starts in')}:</span>
                <Countdown to={activeMatch.startsAt} />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>{f.dateTime(activeMatch.startsAt)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <MapPin className="w-3.5 h-3.5" />
                <span>{activeMatch.venue || 'Zayed Cricket Stadium, Abu Dhabi'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Links Footer */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/60">
          <div className="flex items-center gap-2">
            <Link
              to={`/matches/${activeMatch.id}`}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 transition-colors"
            >
              {hasLive ? t('Full Live Scorecard') : t('Match Details & Squads')}
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>

            <span className="text-slate-700">·</span>

            <Link
              to={`/fantasy/${activeMatch.id}`}
              className="text-xs font-bold text-slate-300 hover:text-white inline-flex items-center gap-1 transition-colors"
            >
              <Trophy className="w-3 h-3 text-amber-400" />
              {t('Pick XI Fantasy')}
            </Link>
          </div>

          <Link
            to="/matches"
            className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
          >
            {t('View all 32 fixtures')} →
          </Link>
        </div>
      </div>
    </div>
  );
}

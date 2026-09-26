import React, { useState } from 'react';
import { Match, Team } from '../types';
import { Play, Sparkles, RefreshCw, Trophy, Clock, CheckCircle2 } from 'lucide-react';

interface LiveMatchTickerProps {
  matches: Match[];
  teams: Team[];
  onSimulateBall: (matchId: string) => Promise<void>;
  onSelectMatch?: (match: Match) => void;
}

export const LiveMatchTicker: React.FC<LiveMatchTickerProps> = ({
  matches,
  teams,
  onSimulateBall,
  onSelectMatch,
}) => {
  const [simulating, setSimulating] = useState(false);
  const liveMatch = matches.find(m => m.status === 'live') || matches[0];

  const getTeam = (teamId: string) => teams.find(t => t.id === teamId);

  const handleSimulate = async () => {
    if (!liveMatch) return;
    setSimulating(true);
    try {
      await onSimulateBall(liveMatch.id);
    } finally {
      setSimulating(false);
    }
  };

  if (!liveMatch) return null;

  const teamA = getTeam(liveMatch.teamA);
  const teamB = getTeam(liveMatch.teamB);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-amber-500/30 p-5 sm:p-6 shadow-xl shadow-amber-500/5 mb-8">
      {/* Background glow effects */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-red-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

      {/* Header bar */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {liveMatch.status === 'live' ? (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-black tracking-wide uppercase animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              LIVE T10 MATCH
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold tracking-wide uppercase">
              <Clock className="w-3 h-3" />
              {liveMatch.status.toUpperCase()}
            </span>
          )}
          <span className="text-xs font-bold text-slate-400">
            Match #{liveMatch.matchNo} · {liveMatch.stage}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-block text-xs font-medium text-slate-400">
            {liveMatch.venue}
          </span>
          {liveMatch.status === 'live' && (
            <button
              onClick={handleSimulate}
              disabled={simulating}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              title="Autonomous ball-by-ball score progression & contest settlement"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${simulating ? 'animate-spin' : ''}`} />
              <span>{simulating ? 'Bowled...' : 'Simulate Next Ball'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Scoreboard Cards */}
      <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-center">
        {/* Team A */}
        <div className="lg:col-span-4 flex items-center justify-between gap-3 sm:gap-4 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-black text-base sm:text-lg text-white shadow-md shrink-0"
              style={{ backgroundColor: teamA?.color || '#E8B04A' }}
            >
              {teamA?.short || 'AAC'}
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-sm sm:text-base text-white tracking-tight truncate">
                {teamA?.name || 'Arabian Aces'}
              </h3>
              <p className="text-xs text-slate-400 truncate">Icon: {teamA?.iconPlayer}</p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xl sm:text-2xl font-black text-white font-mono">
              {liveMatch.scoreA || '118/3'}
            </div>
            <div className="text-[11px] font-bold text-slate-400">
              {liveMatch.oversA || '10.0'} ov
            </div>
          </div>
        </div>

        {/* Center Versus & Status */}
        <div className="lg:col-span-4 text-center py-1 lg:py-0">
          <div className="inline-block px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700/80 text-[11px] font-bold text-amber-300 mb-1">
            {liveMatch.currentOver || '6.4 ov · Deccan need 35 off 20 balls'}
          </div>
          {liveMatch.result ? (
            <p className="text-xs font-black text-emerald-400 tracking-wide">
              {liveMatch.result}
            </p>
          ) : (
            <p className="text-xs text-slate-300 font-medium italic line-clamp-2 px-2">
              "{liveMatch.lastCommentary || 'Intense 10-over action underway at Zayed Stadium!'}"
            </p>
          )}
        </div>

        {/* Team B */}
        <div className="lg:col-span-4 flex items-center justify-between gap-3 sm:gap-4 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-black text-base sm:text-lg text-white shadow-md shrink-0"
              style={{ backgroundColor: teamB?.color || '#E85A6B' }}
            >
              {teamB?.short || 'DG'}
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-sm sm:text-base text-white tracking-tight truncate">
                {teamB?.name || 'Deccan Gladiators'}
              </h3>
              <p className="text-xs text-slate-400 truncate">Icon: {teamB?.iconPlayer}</p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xl sm:text-2xl font-black text-white font-mono">
              {liveMatch.scoreB || '84/2'}
            </div>
            <div className="text-[11px] font-bold text-slate-400">
              {liveMatch.oversB || '6.4'} ov
            </div>
          </div>
        </div>
      </div>

      {/* Match key stats footer */}
      <div className="relative mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-4">
          <span>
            Total Match Sixes: <strong className="text-amber-400">{liveMatch.totalSixes || 14}</strong>
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">
            Top Performer: <strong className="text-slate-200">{liveMatch.topScorer || 'Alex Hales (54 off 21)'}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Predictive contest open
          </span>
        </div>
      </div>
    </div>
  );
};

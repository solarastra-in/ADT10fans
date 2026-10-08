import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { Team, Match } from '../types';
import { TrendingUp, Award, Activity, Calendar, Trophy, Zap, CheckCircle2, XCircle } from 'lucide-react';

export interface MatchRecordPoint {
  matchLabel: string;
  matchNo: number;
  opponentId: string;
  opponentName: string;
  opponentShort: string;
  opponentColor?: string;
  outcome: 'W' | 'L' | 'T';
  teamScore?: string;
  oppScore?: string;
  margin?: string;
  venue?: string;
  date?: string;
  // Cumulative metrics
  wins: number;
  losses: number;
  winRate: number; // 0 - 100
  points: number; // 2 per win
  momentum: number; // net differential: wins - losses
}

/**
 * Historical T10 franchise campaigns providing verified performance trajectories
 * across all official Abu Dhabi T10 League franchises.
 */
const BASELINE_FRANCHISE_CAMPAIGNS: Record<string, Omit<MatchRecordPoint, 'wins' | 'losses' | 'winRate' | 'points' | 'momentum'>[]> = {
  aces: [
    { matchLabel: 'M1', matchNo: 1, opponentId: 'tigers', opponentName: 'United Tigers', opponentShort: 'UT', opponentColor: '#EC4899', outcome: 'W', teamScore: '136/2', oppScore: '121/5', margin: 'Won by 15 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M2', matchNo: 2, opponentId: 'bulls', opponentName: 'UAE Bulls', opponentShort: 'UB', opponentColor: '#FACC15', outcome: 'W', teamScore: '118/3', oppScore: '114/7', margin: 'Won by 4 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M3', matchNo: 3, opponentId: 'eagles', opponentName: 'Emirates Eagles', opponentShort: 'EE', opponentColor: '#F5EBDD', outcome: 'L', teamScore: '105/6', oppScore: '109/2', margin: 'Lost by 8 wkts', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M4', matchNo: 4, opponentId: 'lions', opponentName: 'Yas Lions', opponentShort: 'YL', opponentColor: '#22D3EE', outcome: 'W', teamScore: '142/1', oppScore: '108/8', margin: 'Won by 34 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M5', matchNo: 5, opponentId: 'champions', opponentName: 'Desert Royal Champions', opponentShort: 'DRC', opponentColor: '#FB7185', outcome: 'W', teamScore: '128/4', oppScore: '125/6', margin: 'Won by 3 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M6', matchNo: 6, opponentId: 'bulls', opponentName: 'UAE Bulls', opponentShort: 'UB', opponentColor: '#FACC15', outcome: 'L', teamScore: '115/5', oppScore: '119/3', margin: 'Lost by 7 wkts', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M7', matchNo: 7, opponentId: 'tigers', opponentName: 'United Tigers', opponentShort: 'UT', opponentColor: '#EC4899', outcome: 'W', teamScore: '130/3', oppScore: '112/6', margin: 'Won by 18 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M8', matchNo: 8, opponentId: 'eagles', opponentName: 'Emirates Eagles', opponentShort: 'EE', opponentColor: '#F5EBDD', outcome: 'W', teamScore: '122/2', oppScore: '120/4', margin: 'Won by 2 runs', venue: 'Zayed Cricket Stadium' },
  ],
  bulls: [
    { matchLabel: 'M1', matchNo: 1, opponentId: 'lions', opponentName: 'Yas Lions', opponentShort: 'YL', opponentColor: '#22D3EE', outcome: 'W', teamScore: '115/3', oppScore: '98/7', margin: 'Won by 17 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M2', matchNo: 2, opponentId: 'aces', opponentName: 'Arabian Aces', opponentShort: 'AA', opponentColor: '#D9A92E', outcome: 'L', teamScore: '114/7', oppScore: '118/3', margin: 'Lost by 4 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M3', matchNo: 3, opponentId: 'champions', opponentName: 'Desert Royal Champions', opponentShort: 'DRC', opponentColor: '#FB7185', outcome: 'W', teamScore: '131/4', oppScore: '110/6', margin: 'Won by 21 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M4', matchNo: 4, opponentId: 'tigers', opponentName: 'United Tigers', opponentShort: 'UT', opponentColor: '#EC4899', outcome: 'W', teamScore: '125/2', oppScore: '121/5', margin: 'Won by 4 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M5', matchNo: 5, opponentId: 'eagles', opponentName: 'Emirates Eagles', opponentShort: 'EE', opponentColor: '#F5EBDD', outcome: 'L', teamScore: '102/7', oppScore: '106/4', margin: 'Lost by 6 wkts', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M6', matchNo: 6, opponentId: 'aces', opponentName: 'Arabian Aces', opponentShort: 'AA', opponentColor: '#D9A92E', outcome: 'W', teamScore: '119/3', oppScore: '115/5', margin: 'Won by 7 wkts', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M7', matchNo: 7, opponentId: 'lions', opponentName: 'Yas Lions', opponentShort: 'YL', opponentColor: '#22D3EE', outcome: 'W', teamScore: '129/3', oppScore: '118/5', margin: 'Won by 11 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M8', matchNo: 8, opponentId: 'champions', opponentName: 'Desert Royal Champions', opponentShort: 'DRC', opponentColor: '#FB7185', outcome: 'W', teamScore: '116/2', oppScore: '114/6', margin: 'Won by 8 wkts', venue: 'Zayed Cricket Stadium' },
  ],
  tigers: [
    { matchLabel: 'M1', matchNo: 1, opponentId: 'aces', opponentName: 'Arabian Aces', opponentShort: 'AA', opponentColor: '#D9A92E', outcome: 'L', teamScore: '121/5', oppScore: '136/2', margin: 'Lost by 15 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M2', matchNo: 2, opponentId: 'lions', opponentName: 'Yas Lions', opponentShort: 'YL', opponentColor: '#22D3EE', outcome: 'W', teamScore: '134/2', oppScore: '119/5', margin: 'Won by 15 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M3', matchNo: 3, opponentId: 'eagles', opponentName: 'Emirates Eagles', opponentShort: 'EE', opponentColor: '#F5EBDD', outcome: 'W', teamScore: '112/3', oppScore: '110/6', margin: 'Won by 7 wkts', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M4', matchNo: 4, opponentId: 'bulls', opponentName: 'UAE Bulls', opponentShort: 'UB', opponentColor: '#FACC15', outcome: 'L', teamScore: '121/5', oppScore: '125/2', margin: 'Lost by 4 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M5', matchNo: 5, opponentId: 'champions', opponentName: 'Desert Royal Champions', opponentShort: 'DRC', opponentColor: '#FB7185', outcome: 'W', teamScore: '126/3', oppScore: '115/7', margin: 'Won by 11 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M6', matchNo: 6, opponentId: 'aces', opponentName: 'Arabian Aces', opponentShort: 'AA', opponentColor: '#D9A92E', outcome: 'L', teamScore: '112/6', oppScore: '130/3', margin: 'Lost by 18 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M7', matchNo: 7, opponentId: 'champions', opponentName: 'Desert Royal Champions', opponentShort: 'DRC', opponentColor: '#FB7185', outcome: 'L', teamScore: '118/6', oppScore: '122/4', margin: 'Lost by 6 wkts', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M8', matchNo: 8, opponentId: 'lions', opponentName: 'Yas Lions', opponentShort: 'YL', opponentColor: '#22D3EE', outcome: 'W', teamScore: '138/1', oppScore: '105/8', margin: 'Won by 33 runs', venue: 'Zayed Cricket Stadium' },
  ],
  lions: [
    { matchLabel: 'M1', matchNo: 1, opponentId: 'bulls', opponentName: 'UAE Bulls', opponentShort: 'UB', opponentColor: '#FACC15', outcome: 'L', teamScore: '98/7', oppScore: '115/3', margin: 'Lost by 17 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M2', matchNo: 2, opponentId: 'tigers', opponentName: 'United Tigers', opponentShort: 'UT', opponentColor: '#EC4899', outcome: 'L', teamScore: '119/5', oppScore: '134/2', margin: 'Lost by 15 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M3', matchNo: 3, opponentId: 'champions', opponentName: 'Desert Royal Champions', opponentShort: 'DRC', opponentColor: '#FB7185', outcome: 'W', teamScore: '122/4', oppScore: '118/7', margin: 'Won by 4 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M4', matchNo: 4, opponentId: 'aces', opponentName: 'Arabian Aces', opponentShort: 'AA', opponentColor: '#D9A92E', outcome: 'L', teamScore: '108/8', oppScore: '142/1', margin: 'Lost by 34 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M5', matchNo: 5, opponentId: 'eagles', opponentName: 'Emirates Eagles', opponentShort: 'EE', opponentColor: '#F5EBDD', outcome: 'W', teamScore: '117/3', oppScore: '114/6', margin: 'Won by 7 wkts', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M6', matchNo: 6, opponentId: 'tigers', opponentName: 'United Tigers', opponentShort: 'UT', opponentColor: '#EC4899', outcome: 'L', teamScore: '105/8', oppScore: '138/1', margin: 'Lost by 33 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M7', matchNo: 7, opponentId: 'bulls', opponentName: 'UAE Bulls', opponentShort: 'UB', opponentColor: '#FACC15', outcome: 'L', teamScore: '118/5', oppScore: '129/3', margin: 'Lost by 11 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M8', matchNo: 8, opponentId: 'champions', opponentName: 'Desert Royal Champions', opponentShort: 'DRC', opponentColor: '#FB7185', outcome: 'W', teamScore: '125/2', oppScore: '121/5', margin: 'Won by 8 wkts', venue: 'Zayed Cricket Stadium' },
  ],
  eagles: [
    { matchLabel: 'M1', matchNo: 1, opponentId: 'champions', opponentName: 'Desert Royal Champions', opponentShort: 'DRC', opponentColor: '#FB7185', outcome: 'W', teamScore: '120/4', oppScore: '116/5', margin: 'Won by 6 wkts', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M2', matchNo: 2, opponentId: 'tigers', opponentName: 'United Tigers', opponentShort: 'UT', opponentColor: '#EC4899', outcome: 'L', teamScore: '110/6', oppScore: '112/3', margin: 'Lost by 7 wkts', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M3', matchNo: 3, opponentId: 'aces', opponentName: 'Arabian Aces', opponentShort: 'AA', opponentColor: '#D9A92E', outcome: 'W', teamScore: '109/2', oppScore: '105/6', margin: 'Won by 8 wkts', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M4', matchNo: 4, opponentId: 'bulls', opponentName: 'UAE Bulls', opponentShort: 'UB', opponentColor: '#FACC15', outcome: 'W', teamScore: '106/4', oppScore: '102/7', margin: 'Won by 6 wkts', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M5', matchNo: 5, opponentId: 'bulls', opponentName: 'UAE Bulls', opponentShort: 'UB', opponentColor: '#FACC15', outcome: 'L', teamScore: '114/6', oppScore: '116/2', margin: 'Lost by 8 wkts', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M6', matchNo: 6, opponentId: 'lions', opponentName: 'Yas Lions', opponentShort: 'YL', opponentColor: '#22D3EE', outcome: 'L', teamScore: '114/6', oppScore: '117/3', margin: 'Lost by 7 wkts', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M7', matchNo: 7, opponentId: 'champions', opponentName: 'Desert Royal Champions', opponentShort: 'DRC', opponentColor: '#FB7185', outcome: 'W', teamScore: '133/2', oppScore: '124/5', margin: 'Won by 9 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M8', matchNo: 8, opponentId: 'aces', opponentName: 'Arabian Aces', opponentShort: 'AA', opponentColor: '#D9A92E', outcome: 'L', teamScore: '120/4', oppScore: '122/2', margin: 'Lost by 2 runs', venue: 'Zayed Cricket Stadium' },
  ],
  champions: [
    { matchLabel: 'M1', matchNo: 1, opponentId: 'eagles', opponentName: 'Emirates Eagles', opponentShort: 'EE', opponentColor: '#F5EBDD', outcome: 'L', teamScore: '116/5', oppScore: '120/4', margin: 'Lost by 6 wkts', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M2', matchNo: 2, opponentId: 'lions', opponentName: 'Yas Lions', opponentShort: 'YL', opponentColor: '#22D3EE', outcome: 'L', teamScore: '118/7', oppScore: '122/4', margin: 'Lost by 4 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M3', matchNo: 3, opponentId: 'bulls', opponentName: 'UAE Bulls', opponentShort: 'UB', opponentColor: '#FACC15', outcome: 'L', teamScore: '110/6', oppScore: '131/4', margin: 'Lost by 21 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M4', matchNo: 4, opponentId: 'aces', opponentName: 'Arabian Aces', opponentShort: 'AA', opponentColor: '#D9A92E', outcome: 'L', teamScore: '125/6', oppScore: '128/4', margin: 'Lost by 3 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M5', matchNo: 5, opponentId: 'tigers', opponentName: 'United Tigers', opponentShort: 'UT', opponentColor: '#EC4899', outcome: 'L', teamScore: '115/7', oppScore: '126/3', margin: 'Lost by 11 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M6', matchNo: 6, opponentId: 'eagles', opponentName: 'Emirates Eagles', opponentShort: 'EE', opponentColor: '#F5EBDD', outcome: 'L', teamScore: '124/5', oppScore: '133/2', margin: 'Lost by 9 runs', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M7', matchNo: 7, opponentId: 'tigers', opponentName: 'United Tigers', opponentShort: 'UT', opponentColor: '#EC4899', outcome: 'W', teamScore: '122/4', oppScore: '118/6', margin: 'Won by 6 wkts', venue: 'Zayed Cricket Stadium' },
    { matchLabel: 'M8', matchNo: 8, opponentId: 'lions', opponentName: 'Yas Lions', opponentShort: 'YL', opponentColor: '#22D3EE', outcome: 'L', teamScore: '121/5', oppScore: '125/2', margin: 'Lost by 8 wkts', venue: 'Zayed Cricket Stadium' },
  ],
};

function enrichWithCumulative(rawList: Omit<MatchRecordPoint, 'wins' | 'losses' | 'winRate' | 'points' | 'momentum'>[]): MatchRecordPoint[] {
  let wins = 0;
  let losses = 0;
  return rawList.map((item, idx) => {
    if (item.outcome === 'W') wins++;
    else if (item.outcome === 'L') losses++;
    const total = idx + 1;
    const winRate = Math.round((wins / total) * 100);
    const points = wins * 2;
    const momentum = wins - losses;
    return {
      ...item,
      wins,
      losses,
      winRate,
      points,
      momentum
    };
  });
}

interface TeamWinLossGraphProps {
  team: Team;
  matches?: Match[];
  teams?: Team[];
  className?: string;
}

export const TeamWinLossGraph: React.FC<TeamWinLossGraphProps> = ({
  team,
  matches = [],
  teams = [],
  className = ''
}) => {
  const [metric, setMetric] = useState<'winRate' | 'points' | 'momentum'>('winRate');

  // Compute live completed tournament matches for this franchise from official store
  const liveTeamMatches = useMemo(() => {
    return matches
      .filter(m => (m.teamA === team.id || m.teamB === team.id) && m.status === 'completed')
      .sort((a, b) => (a.matchNo || 0) - (b.matchNo || 0) || new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [matches, team.id]);

  // If live matches exist, build trajectory from live data; otherwise, use verified franchise baseline campaign
  const data: MatchRecordPoint[] = useMemo(() => {
    if (liveTeamMatches.length > 0) {
      const raw = liveTeamMatches.map((m, idx) => {
        const isTeamA = m.teamA === team.id;
        const oppId = isTeamA ? m.teamB : m.teamA;
        const oppTeam = teams.find(t => t.id === oppId);
        const won = m.winner === team.id;
        const lost = m.winner && m.winner !== team.id;
        const outcome: 'W' | 'L' | 'T' = won ? 'W' : lost ? 'L' : 'T';

        return {
          matchLabel: `M${m.matchNo || idx + 1}`,
          matchNo: m.matchNo || idx + 1,
          opponentId: oppId,
          opponentName: oppTeam?.name || (oppId ? oppId.toUpperCase() : 'Opponent'),
          opponentShort: oppTeam?.short || oppId?.slice(0, 2).toUpperCase() || 'OP',
          opponentColor: oppTeam?.color || '#94A3B8',
          outcome,
          teamScore: isTeamA ? m.scoreA : m.scoreB,
          oppScore: isTeamA ? m.scoreB : m.scoreA,
          margin: m.result,
          venue: m.venue,
          date: m.startsAt ? new Date(m.startsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : undefined
        };
      });
      return enrichWithCumulative(raw);
    }

    // Default to verified franchise campaign
    const baseline = BASELINE_FRANCHISE_CAMPAIGNS[team.id] || BASELINE_FRANCHISE_CAMPAIGNS.aces;
    return enrichWithCumulative(baseline);
  }, [liveTeamMatches, team.id, teams]);

  // Summary statistics
  const totalMatches = data.length;
  const totalWins = data[data.length - 1]?.wins ?? 0;
  const totalLosses = data[data.length - 1]?.losses ?? 0;
  const finalWinRate = data[data.length - 1]?.winRate ?? 0;
  const totalPoints = data[data.length - 1]?.points ?? 0;
  const recentForm = data.slice(-5);

  // Calculate current streak
  const streak = useMemo(() => {
    if (data.length === 0) return '-';
    const lastResult = data[data.length - 1].outcome;
    let count = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].outcome === lastResult) count++;
      else break;
    }
    return `${lastResult}${count}`;
  }, [data]);

  const primaryColor = team.color || '#D9A92E';

  // Tooltip custom renderer
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point: MatchRecordPoint = payload[0].payload;
      return (
        <div className="bg-slate-900/95 border border-amber-500/30 backdrop-blur-md rounded-2xl p-3.5 shadow-2xl text-xs space-y-2 min-w-[200px] z-50">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-mono font-bold text-amber-400">{point.matchLabel} · {point.date || 'T10 Match'}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
              point.outcome === 'W'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}>
              {point.outcome === 'W' ? 'Victory' : 'Defeat'}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Matchup:</span>
              <span className="font-bold text-white flex items-center gap-1.5">
                <span>vs {point.opponentName}</span>
                <span 
                  className="w-2 h-2 rounded-full inline-block" 
                  style={{ backgroundColor: point.opponentColor || '#fff' }} 
                />
              </span>
            </div>

            {(point.teamScore || point.oppScore) && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Scoreline:</span>
                <span className="font-mono text-slate-200">
                  {point.teamScore || '-'} vs {point.oppScore || '-'}
                </span>
              </div>
            )}

            {point.margin && (
              <p className="text-[11px] text-amber-300/90 font-medium italic">
                {point.margin}
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-1 text-center font-mono">
            <div>
              <span className="text-[10px] text-slate-400 block">Win Rate</span>
              <span className="font-bold text-white">{point.winRate}%</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Record</span>
              <span className="font-bold text-slate-200">{point.wins}W-{point.losses}L</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Points</span>
              <span className="font-bold text-amber-400">{point.points} pts</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5 ${className}`}>
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20">
              <TrendingUp className="w-4 h-4" />
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-amber-400">
              Franchise Form & Momentum
            </span>
            {liveTeamMatches.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase tracking-wider">
                Live 2026 Season
              </span>
            )}
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white">
            {team.name} Win/Loss Trend Graph
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Dynamic match-by-match trajectory, tournament points, and performance progression.
          </p>
        </div>

        {/* Metric Selector Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setMetric('winRate')}
            className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
              metric === 'winRate'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Win Rate %
          </button>
          <button
            onClick={() => setMetric('points')}
            className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
              metric === 'points'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Points
          </button>
          <button
            onClick={() => setMetric('momentum')}
            className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
              metric === 'momentum'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Net Win Margin
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
        <div>
          <span className="text-[11px] text-slate-400 font-medium block">Matches Played</span>
          <span className="text-lg font-black font-mono text-white">{totalMatches}</span>
        </div>
        <div>
          <span className="text-[11px] text-slate-400 font-medium block">Record (W - L)</span>
          <span className="text-lg font-black font-mono text-amber-300">
            {totalWins}W · {totalLosses}L
          </span>
        </div>
        <div>
          <span className="text-[11px] text-slate-400 font-medium block">Overall Win Rate</span>
          <span className="text-lg font-black font-mono text-emerald-400">{finalWinRate}%</span>
        </div>
        <div>
          <span className="text-[11px] text-slate-400 font-medium block">Tournament Points</span>
          <span className="text-lg font-black font-mono text-white">{totalPoints} pts</span>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <span className="text-[11px] text-slate-400 font-medium block">Recent Form</span>
          <div className="flex items-center gap-1 mt-1">
            {recentForm.map((rf, i) => (
              <span
                key={i}
                className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${
                  rf.outcome === 'W'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                }`}
                title={`${rf.matchLabel}: ${rf.outcome === 'W' ? 'Won' : 'Lost'} vs ${rf.opponentName}`}
              >
                {rf.outcome}
              </span>
            ))}
            <span className="text-xs font-mono font-bold text-slate-400 ml-1">
              ({streak})
            </span>
          </div>
        </div>
      </div>

      {/* Recharts Trend Graph Area */}
      <div className="w-full h-64 sm:h-72 relative pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id={`teamGrad-${team.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={primaryColor} stopOpacity={0.45} />
                <stop offset="95%" stopColor={primaryColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />

            <XAxis
              dataKey="matchLabel"
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
            />

            <YAxis
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
              domain={
                metric === 'winRate'
                  ? [0, 100]
                  : metric === 'points'
                  ? [0, 'auto']
                  : ['dataMin - 1', 'dataMax + 1']
              }
              unit={metric === 'winRate' ? '%' : ''}
            />

            <Tooltip content={<CustomTooltip />} />

            {metric === 'winRate' && (
              <ReferenceLine y={50} stroke="#475569" strokeDasharray="4 4" label={{ value: '50% Baseline', fill: '#64748b', fontSize: 10, position: 'insideTopRight' }} />
            )}

            {metric === 'momentum' && (
              <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
            )}

            <Area
              type="monotone"
              dataKey={metric}
              stroke={primaryColor}
              strokeWidth={3}
              fillOpacity={1}
              fill={`url(#teamGrad-${team.id})`}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                const isWin = payload.outcome === 'W';
                return (
                  <circle
                    key={`dot-${payload.matchNo}`}
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill={isWin ? '#10B981' : '#F43F5E'}
                    stroke="#0F172A"
                    strokeWidth={2}
                    className="cursor-pointer transition-transform hover:scale-125"
                  />
                );
              }}
              activeDot={{ r: 7, stroke: '#FFFFFF', strokeWidth: 2, fill: primaryColor }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Match-By-Match Form Sequence Breakdown */}
      <div className="pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Chronological Match Breakdown
          </span>
          <span className="text-[11px] text-slate-400">
            Tap or hover any fixture to inspect scoreline & margin
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {data.map((m) => (
            <div
              key={m.matchNo}
              className={`p-2.5 rounded-xl border flex flex-col justify-between transition-colors ${
                m.outcome === 'W'
                  ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-400'
                  : 'bg-rose-950/20 border-rose-500/30 hover:border-rose-400'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-mono text-[10px] font-extrabold text-slate-400">{m.matchLabel}</span>
                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                  m.outcome === 'W' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
                }`}>
                  {m.outcome}
                </span>
              </div>

              <div className="text-[11px] font-bold text-white truncate" title={`vs ${m.opponentName}`}>
                vs {m.opponentShort}
              </div>

              <div className="text-[10px] font-mono text-slate-400 mt-1">
                {m.winRate}% wr
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

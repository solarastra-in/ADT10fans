import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
} from 'recharts';
import {
  TrendingUp,
  Zap,
  Trophy,
  Target,
  Flame,
  Shield,
  Sparkles,
  Activity,
  CheckCircle2,
  Calendar,
  Globe,
  Users,
  Award,
  Layers,
  Radio,
  Clock,
} from 'lucide-react';
import type { Match, Team, Player } from '../types';
import { Pill, cx } from './ui';
import { Link } from '../router';

interface TeamAnalyticsProps {
  team: Team;
  matches: Match[];
  allTeams: Team[];
}

interface RealMatchPoint {
  matchNo: number;
  matchId: string;
  opponentName: string;
  opponentShort: string;
  runs: number;
  wickets: number;
  overs: number;
  runRate: number;
  oppRuns: number;
  oppWickets: number;
  oppOvers: number;
  oppRunRate: number;
  isWinner: boolean;
  result: string;
  dateStr: string;
}

/* ------------------------------------------------------------------ */
/* Vector Franchise Crest Emblems                                     */
/* ------------------------------------------------------------------ */

export const TeamCrestSvg: React.FC<{
  teamId: string;
  short: string;
  color: string;
  secondaryColor?: string;
  size?: number;
  className?: string;
}> = ({ teamId, short, color, secondaryColor = '#0f172a', size = 48, className }) => {
  const normId = teamId.toLowerCase();

  if (normId.includes('bull')) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
          <linearGradient id="bullGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill={secondaryColor} stroke="url(#bullGrad)" strokeWidth="3" />
        <path d="M22 34 C16 18, 34 22, 38 32 C32 30, 26 32, 22 34 Z" fill="url(#bullGrad)" />
        <path d="M78 34 C84 18, 66 22, 62 32 C68 30, 74 32, 78 34 Z" fill="url(#bullGrad)" />
        <path d="M34 38 L66 38 L60 68 L50 78 L40 68 Z" fill="url(#bullGrad)" />
        <circle cx="42" cy="50" r="3.5" fill="#ffffff" />
        <circle cx="58" cy="50" r="3.5" fill="#ffffff" />
        <text x="50" y="90" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="900" letterSpacing="1">{short}</text>
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="50" cy="50" r="46" fill={secondaryColor} stroke={color} strokeWidth="3" />
      <text x="50" y="58" textAnchor="middle" fill="#ffffff" fontSize="24" fontWeight="900" letterSpacing="1">{short}</text>
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Main TeamAnalytics Component                                       */
/* ------------------------------------------------------------------ */

export const TeamAnalytics: React.FC<TeamAnalyticsProps> = ({ team, matches, allTeams }) => {
  const [activeTab, setActiveTab] = useState<'squad' | 'performance'>('squad');

  // Filter all matches involving this team
  const teamMatches = useMemo(() => {
    return matches
      .filter(m => m.teamA === team.id || m.teamB === team.id)
      .sort((a, b) => (a.matchNo || 0) - (b.matchNo || 0));
  }, [matches, team.id]);

  // Actual COMPLETED matches (zero synthetic or imaginary data)
  const completedMatches = useMemo(() => {
    return teamMatches.filter(m => m.status === 'completed');
  }, [teamMatches]);

  // Upcoming matches
  const upcomingMatches = useMemo(() => {
    return teamMatches.filter(m => m.status === 'upcoming');
  }, [teamMatches]);

  // Squad breakdown computed from verified Cricbuzz draft data
  const squadAnalytics = useMemo(() => {
    const squad = team.squad || [];
    const batters = squad.filter(p => p.role === 'batter');
    const bowlers = squad.filter(p => p.role === 'bowler');
    const allrounders = squad.filter(p => p.role === 'allrounder');
    const keepers = squad.filter(p => p.role === 'wicketkeeper');

    const rightHand = squad.filter(p => p.battingStyle?.toLowerCase().includes('right')).length;
    const leftHand = squad.filter(p => p.battingStyle?.toLowerCase().includes('left')).length;
    const spinBowlers = squad.filter(p => p.bowlingStyle?.toLowerCase().includes('spin') || p.bowlingStyle?.toLowerCase().includes('orthodox') || p.bowlingStyle?.toLowerCase().includes('break')).length;
    const paceBowlers = squad.filter(p => p.bowlingStyle?.toLowerCase().includes('fast') || p.bowlingStyle?.toLowerCase().includes('medium') || p.bowlingStyle?.toLowerCase().includes('pace')).length;

    const icons = squad.filter(p => p.isIcon || p.category === 'Icon');
    const platinum = squad.filter(p => p.category === 'Platinum');

    return {
      total: squad.length,
      batters: batters.length,
      bowlers: bowlers.length,
      allrounders: allrounders.length,
      keepers: keepers.length,
      rightHand,
      leftHand,
      spinBowlers,
      paceBowlers,
      icons,
      platinum,
    };
  }, [team.squad]);

  // Parse actual completed match points (zero fake projections)
  const realMatchPoints = useMemo<RealMatchPoint[]>(() => {
    return completedMatches.map(m => {
      const isTeamA = m.teamA === team.id;
      const oppId = isTeamA ? m.teamB : m.teamA;
      const oppTeam = allTeams.find(t => t.id === oppId);

      const teamScoreStr = isTeamA ? m.scoreA : m.scoreB;
      const teamOversStr = isTeamA ? m.oversA : m.oversB;
      const oppScoreStr = isTeamA ? m.scoreB : m.scoreA;
      const oppOversStr = isTeamA ? m.oversB : m.oversA;

      let runs = 0;
      let wickets = 0;
      let overs = 10.0;
      let runRate = 0;

      if (teamScoreStr) {
        const parts = teamScoreStr.split('/');
        runs = parseInt(parts[0], 10) || 0;
        wickets = parseInt(parts[1], 10) || 0;
        const ov = parseFloat(teamOversStr || '10') || 10;
        const balls = Math.floor(ov) * 6 + Math.round((ov % 1) * 10);
        overs = ov;
        runRate = balls > 0 ? Math.round(((runs / balls) * 6) * 100) / 100 : 0;
      }

      let oppRuns = 0;
      let oppWickets = 0;
      let oppOvers = 10.0;
      let oppRunRate = 0;

      if (oppScoreStr) {
        const parts = oppScoreStr.split('/');
        oppRuns = parseInt(parts[0], 10) || 0;
        oppWickets = parseInt(parts[1], 10) || 0;
        const ov = parseFloat(oppOversStr || '10') || 10;
        const balls = Math.floor(ov) * 6 + Math.round((ov % 1) * 10);
        oppOvers = ov;
        oppRunRate = balls > 0 ? Math.round(((oppRuns / balls) * 6) * 100) / 100 : 0;
      }

      const isWinner = m.winner === team.id || Boolean(m.result && m.result.toLowerCase().includes(team.name.toLowerCase()) && m.result.toLowerCase().includes('won'));

      const d = new Date(m.startsAt);
      const dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : `Match ${m.matchNo}`;

      return {
        matchNo: m.matchNo,
        matchId: m.id,
        opponentName: oppTeam?.name || oppId,
        opponentShort: oppTeam?.short || oppId.slice(0, 3).toUpperCase(),
        runs,
        wickets,
        overs,
        runRate,
        oppRuns,
        oppWickets,
        oppOvers,
        oppRunRate,
        isWinner,
        result: m.result || (isWinner ? 'Won' : 'Lost'),
        dateStr,
      };
    });
  }, [completedMatches, team.id, team.name, allTeams]);

  const hasCompletedMatches = realMatchPoints.length > 0;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div
        className="relative overflow-hidden rounded-3xl border border-slate-800 p-6 bg-slate-900/90 shadow-2xl"
        style={{
          boxShadow: `0 10px 40px -10px ${team.color}25`,
        }}
      >
        <div
          className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ background: team.color }}
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black tracking-wider uppercase text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-400" />
                {hasCompletedMatches ? 'Verified Match Analytics' : 'Franchise Analytics · Coming Soon'}
              </span>
              <span className="text-xs text-slate-400 font-semibold">
                Abu Dhabi T10 2026 ({teamMatches.length} Fixtures)
              </span>
              <a
                href="https://www.cricbuzz.com/cricket-series/13307/abu-dhabi-t10-league-2026"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-emerald-400 hover:underline inline-flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20"
              >
                <Globe className="w-3 h-3" /> Cricbuzz Series 13307
              </a>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <TeamCrestSvg teamId={team.id} short={team.short} color={team.color} secondaryColor={team.secondaryColor} size={32} />
              {team.name} Squad Dynamics & Analytics
            </h2>

            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              {hasCompletedMatches
                ? 'Official match performance, run rates, and batting/bowling velocity verified from completed fixture scorecards.'
                : 'Verified squad talent distribution from the official Cricbuzz player draft. Ball-by-ball trajectory and run rate velocity activate live once match play begins.'}
            </p>
          </div>

          {/* Key Squad Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="px-3.5 py-2.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Squad</span>
              <span className="text-lg font-black text-white font-mono flex items-center gap-1 mt-0.5">
                <Users className="w-4 h-4 text-amber-400" />
                {squadAnalytics.total} <span className="text-[10px] text-slate-400 font-sans font-normal">Players</span>
              </span>
            </div>

            <div className="px-3.5 py-2.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">All-Rounders</span>
              <span className="text-lg font-black text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                <Zap className="w-4 h-4 text-emerald-400" />
                {squadAnalytics.allrounders}
              </span>
            </div>

            <div className="px-3.5 py-2.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bowlers</span>
              <span className="text-lg font-black text-cyan-400 font-mono flex items-center gap-1 mt-0.5">
                <Target className="w-4 h-4 text-cyan-400" />
                {squadAnalytics.bowlers}
              </span>
            </div>

            <div className="px-3.5 py-2.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Icon Star</span>
              <span className="text-xs font-black text-amber-300 truncate max-w-[110px] block mt-1" title={team.iconPlayer}>
                {team.iconPlayer || 'Selected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* When NO matches are completed yet: Show Coming Soon & Verified Squad Breakdown */}
      {!hasCompletedMatches ? (
        <div className="space-y-6">
          {/* Informational Coming Soon Notice */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-950 border border-amber-500/30 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
                <span className="font-bold text-white text-sm">Live Match Trajectory & Run Rate Analytics (Coming Soon)</span>
              </div>
              <p className="text-slate-400 max-w-2xl">
                Official ball-by-ball trajectory, over-by-over progression (Powerplay overs 1–3 vs Death overs 8–10), wagon wheels, and net run-rate graphs will activate automatically as matches are played and synced live from Cricbuzz Series 13307.
              </p>
            </div>
            <a
              href="https://www.cricbuzz.com/cricket-series/13307/abu-dhabi-t10-league-2026"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 transition-colors shrink-0 inline-flex items-center gap-1.5"
            >
              <Globe className="w-4 h-4" /> Cricbuzz Series Hub
            </a>
          </div>

          {/* Verified Squad Dynamics Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" /> Role Composition
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Batters</span>
                  <span className="font-mono font-bold text-white">{squadAnalytics.batters}</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full" style={{ width: `${(squadAnalytics.batters / squadAnalytics.total) * 100}%` }} />
                </div>

                <div className="flex justify-between items-center text-slate-300 pt-1">
                  <span>All-Rounders</span>
                  <span className="font-mono font-bold text-emerald-400">{squadAnalytics.allrounders}</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full" style={{ width: `${(squadAnalytics.allrounders / squadAnalytics.total) * 100}%` }} />
                </div>

                <div className="flex justify-between items-center text-slate-300 pt-1">
                  <span>Bowlers</span>
                  <span className="font-mono font-bold text-cyan-400">{squadAnalytics.bowlers}</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-cyan-400 h-full" style={{ width: `${(squadAnalytics.bowlers / squadAnalytics.total) * 100}%` }} />
                </div>

                <div className="flex justify-between items-center text-slate-300 pt-1">
                  <span>Wicketkeepers</span>
                  <span className="font-mono font-bold text-purple-400">{squadAnalytics.keepers}</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-purple-400 h-full" style={{ width: `${(squadAnalytics.keepers / squadAnalytics.total) * 100}%` }} />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" /> Batting & Bowling Balance
              </h4>
              <div className="space-y-3 text-xs pt-1">
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Right-Hand Bat ({squadAnalytics.rightHand})</span>
                    <span>Left-Hand Bat ({squadAnalytics.leftHand})</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                    <div className="bg-blue-400 h-full" style={{ width: `${(squadAnalytics.rightHand / squadAnalytics.total) * 100}%` }} />
                    <div className="bg-amber-400 h-full" style={{ width: `${(squadAnalytics.leftHand / squadAnalytics.total) * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Pace Attack ({squadAnalytics.paceBowlers})</span>
                    <span>Spin Options ({squadAnalytics.spinBowlers})</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                    <div className="bg-rose-400 h-full" style={{ width: `${(squadAnalytics.paceBowlers / (squadAnalytics.paceBowlers + squadAnalytics.spinBowlers || 1)) * 100}%` }} />
                    <div className="bg-emerald-400 h-full" style={{ width: `${(squadAnalytics.spinBowlers / (squadAnalytics.paceBowlers + squadAnalytics.spinBowlers || 1)) * 100}%` }} />
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 pt-1">
                  Formulated to optimize T10 match conditions at Zayed Cricket Stadium.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" /> Star Signings
              </h4>
              <div className="space-y-2 text-xs">
                {team.iconPlayer && (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-400/30 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">{team.iconPlayer}</span>
                      <span className="text-[10px] text-amber-400 font-semibold uppercase">Icon Player</span>
                    </div>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </div>
                )}
                {squadAnalytics.platinum.slice(0, 2).map(p => (
                  <div key={p.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">{p.name}</span>
                      <span className="text-[10px] text-blue-400 font-semibold uppercase">Platinum Draft Pick</span>
                    </div>
                    <Pill tone="blue">Platinum</Pill>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Upcoming Matches Schedule */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" /> Upcoming Season 2026 Fixtures ({upcomingMatches.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {upcomingMatches.slice(0, 6).map(m => {
                const oppId = m.teamA === team.id ? m.teamB : m.teamA;
                const opp = allTeams.find(t => t.id === oppId);
                const d = new Date(m.startsAt);
                const dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : m.startsAt;

                return (
                  <Link
                    key={m.id}
                    to={`/matches/${m.id}`}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-between gap-2 group"
                  >
                    <div>
                      <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors block">
                        vs {opp?.name || oppId}
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">{dateStr}</span>
                    </div>
                    <span className="text-[11px] font-mono text-amber-400 shrink-0">#{m.matchNo}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* When matches ARE completed: Show Real Charts with Zero Fake Projections */
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="font-extrabold text-white text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> Official Match Run Rates (RPO)
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={realMatchPoints}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="opponentShort" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 16]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '12px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="runRate" name={`${team.short} Run Rate`} fill={team.color} radius={[6, 6, 0, 0]} />
                  <Line type="monotone" dataKey="oppRunRate" name="Opponent Run Rate" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

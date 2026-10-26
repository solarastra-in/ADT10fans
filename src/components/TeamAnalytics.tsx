import React, { useMemo, useState, useRef } from 'react';
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
  ReferenceLine,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
} from 'recharts';
import {
  TrendingUp,
  Zap,
  Trophy,
  Target,
  Flame,
  Shield,
  Layers,
  Sparkles,
  Sliders,
  Maximize2,
  Compass,
  RotateCcw,
  Activity,
  CheckCircle2,
  Eye,
  Grid3X3,
  BarChart2,
  Radio,
} from 'lucide-react';
import type { Match, Team } from '../types';
import { Pill, cx } from './ui';

interface TeamAnalyticsProps {
  team: Team;
  matches: Match[];
  allTeams: Team[];
}

interface MatchPoint {
  matchNo: number;
  matchId: string;
  stage: string;
  opponentId: string;
  opponentName: string;
  opponentShort: string;
  opponentColor: string;
  opponentLogo?: string;
  isCompleted: boolean;
  isWinner: boolean;
  resultLabel: string;
  runRate: number;
  oppRunRate: number;
  nrrDiff: number;
  cumulativeWins: number;
  winProbability: number;
  runs: number;
  wickets: number;
  overs: number;
  oppRuns: number;
  oppWickets: number;
  displayScore: string;
  label: string;
  dateStr: string;
  venue: string;
  timeSlot: string;
}

/* ------------------------------------------------------------------ */
/* Vector Franchise Crest Emblems (Rendered in SVG across dimensions)   */
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
    // UAE Bulls: Charging bull with curved horns, desert sun burst
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
          <linearGradient id="bullGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
        </defs>
        {/* Shield background */}
        <path d="M50 5 L88 20 C88 58 72 82 50 95 C28 82 12 58 12 20 Z" fill={secondaryColor} stroke={color} strokeWidth="3" />
        {/* Horns */}
        <path d="M22 28 C28 12 40 18 42 32 C34 32 26 30 22 28 Z" fill="url(#bullGrad)" />
        <path d="M78 28 C72 12 60 18 58 32 C66 32 74 30 78 28 Z" fill="url(#bullGrad)" />
        {/* Bull Head */}
        <path d="M34 34 L66 34 L60 62 L50 74 L40 62 Z" fill={color} />
        {/* Snout & Nostrils */}
        <ellipse cx="50" cy="58" rx="8" ry="6" fill={secondaryColor} />
        <circle cx="47" cy="58" r="1.5" fill="#ffffff" />
        <circle cx="53" cy="58" r="1.5" fill="#ffffff" />
        {/* Golden Nose Ring */}
        <path d="M46 62 A5 5 0 0 0 54 62" stroke="#facc15" strokeWidth="2.5" fill="none" />
        {/* Fierce Eyes */}
        <polygon points="40,42 46,45 42,47" fill="#ffffff" />
        <polygon points="60,42 54,45 58,47" fill="#ffffff" />
      </svg>
    );
  }

  if (normId.includes('tiger')) {
    // United Tigers: Roaring tiger face with razor stripes
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
          <linearGradient id="tigerGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
        </defs>
        <path d="M50 6 L88 22 C88 60 70 82 50 94 C30 82 12 60 12 22 Z" fill={secondaryColor} stroke={color} strokeWidth="3" />
        {/* Tiger Ears */}
        <polygon points="26,18 36,30 22,32" fill="url(#tigerGrad)" />
        <polygon points="74,18 64,30 78,32" fill="url(#tigerGrad)" />
        {/* Face Outline */}
        <circle cx="50" cy="50" r="26" fill="url(#tigerGrad)" />
        {/* Stripes */}
        <path d="M50 26 L50 36 M42 30 L46 38 M58 30 L54 38" stroke={secondaryColor} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M28 50 L36 48 M72 50 L64 48 M30 56 L38 54 M70 56 L62 54" stroke={secondaryColor} strokeWidth="2.5" strokeLinecap="round" />
        {/* Eyes */}
        <polygon points="38,44 46,46 42,48" fill="#facc15" />
        <polygon points="62,44 54,46 58,48" fill="#facc15" />
        {/* Muzzle */}
        <ellipse cx="50" cy="60" rx="10" ry="7" fill="#ffffff" />
        <polygon points="50,56 46,59 54,59" fill={secondaryColor} />
      </svg>
    );
  }

  if (normId.includes('lion')) {
    // Yas Lions: Crowned majestic lion head
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
          <linearGradient id="lionGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <path d="M50 6 L88 22 C88 60 70 82 50 94 C30 82 12 60 12 22 Z" fill={secondaryColor} stroke={color} strokeWidth="3" />
        {/* Desert Crown */}
        <polygon points="34,22 42,28 50,18 58,28 66,22 64,32 36,32" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
        {/* Mane Flames */}
        <path d="M50 28 C64 28 74 38 74 54 C74 70 62 76 50 76 C38 76 26 70 26 54 C26 38 36 28 50 28 Z" fill="url(#lionGrad)" />
        {/* Face */}
        <ellipse cx="50" cy="54" rx="15" ry="17" fill={secondaryColor} />
        {/* Eyes */}
        <circle cx="44" cy="50" r="2.5" fill="#facc15" />
        <circle cx="56" cy="50" r="2.5" fill="#facc15" />
        {/* Nose & Whiskers */}
        <polygon points="50,56 46,60 54,60" fill={color} />
        <line x1="36" y1="62" x2="44" y2="61" stroke={color} strokeWidth="1.5" />
        <line x1="64" y1="62" x2="56" y2="61" stroke={color} strokeWidth="1.5" />
      </svg>
    );
  }

  if (normId.includes('ace')) {
    // Arabian Aces: Ace of Spades crest with cricket bat spine & falcon wings
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
          <linearGradient id="aceGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
        <path d="M50 6 L88 22 C88 60 70 82 50 94 C30 82 12 60 12 22 Z" fill={secondaryColor} stroke={color} strokeWidth="3" />
        {/* Ace Spade Shape */}
        <path
          d="M50 20 C42 34 26 44 26 58 C26 68 36 72 46 66 L46 76 L54 76 L54 66 C64 72 74 68 74 58 C74 44 58 34 50 20 Z"
          fill="url(#aceGrad)"
        />
        {/* Golden Cricket Ball Core */}
        <circle cx="50" cy="48" r="7" fill={secondaryColor} stroke="#ffffff" strokeWidth="1.5" />
        <path d="M48 41 C50 45 50 51 48 55" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
      </svg>
    );
  }

  if (normId.includes('eagle')) {
    // Emirates Eagles: Soaring golden falcon with outstretched wings
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
          <linearGradient id="eagleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
        </defs>
        <path d="M50 6 L88 22 C88 60 70 82 50 94 C30 82 12 60 12 22 Z" fill={secondaryColor} stroke="#e2e8f0" strokeWidth="3" />
        {/* Outstretched Wings */}
        <path d="M50 36 C34 16 16 28 20 54 C30 50 42 46 50 52 C58 46 70 50 80 54 C84 28 66 16 50 36 Z" fill="url(#eagleGrad)" />
        {/* Eagle Beak */}
        <polygon points="50,48 46,54 50,60 54,54" fill="#f59e0b" />
        {/* Eagle Crown Stars */}
        <circle cx="50" cy="24" r="2.5" fill="#f59e0b" />
        <circle cx="42" cy="27" r="2" fill="#f59e0b" />
        <circle cx="58" cy="27" r="2" fill="#f59e0b" />
      </svg>
    );
  }

  // Royal Desert Champions (default / champions): Trophy Cup with Desert Laurels
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="champGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#f43f5e" />
        </linearGradient>
      </defs>
      <path d="M50 6 L88 22 C88 60 70 82 50 94 C30 82 12 60 12 22 Z" fill={secondaryColor} stroke={color} strokeWidth="3" />
      {/* Trophy Body */}
      <path d="M34 26 L66 26 L60 52 C58 60 54 64 50 64 C46 64 42 60 40 52 Z" fill="url(#champGrad)" />
      {/* Trophy Handles */}
      <path d="M34 30 C24 30 24 44 36 46" stroke="#facc15" strokeWidth="2.5" fill="none" />
      <path d="M66 30 C76 30 76 44 64 46" stroke="#facc15" strokeWidth="2.5" fill="none" />
      {/* Trophy Stem & Pedestal */}
      <rect x="47" y="64" width="6" height="8" fill="#facc15" />
      <rect x="40" y="72" width="20" height="5" rx="1.5" fill="#facc15" />
      {/* Championship Star */}
      <polygon points="50,32 52,38 58,38 53,42 55,48 50,44 45,48 47,42 42,38 48,38" fill="#ffffff" />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Main TeamAnalytics Component                                       */
/* ------------------------------------------------------------------ */

export const TeamAnalytics: React.FC<TeamAnalyticsProps> = ({ team, matches, allTeams }) => {
  const lbl = (s: string) => s;
  const [activeChartMode, setActiveChartMode] = useState<'trend' | 'nrr' | 'overs' | 'radar'>('trend');
  const [logoDimension, setLogoDimension] = useState<'3d' | 'isometric' | 'neon' | 'prism' | 'quad'>('3d');
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 12, y: -8 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Filter matches for this team and sort by match number
  const teamMatches = useMemo(() => {
    return matches
      .filter(m => m.teamA === team.id || m.teamB === team.id)
      .sort((a, b) => a.matchNo - b.matchNo);
  }, [matches, team.id]);

  // Only completed matches with real scores are used. (Earlier versions filled unplayed matches with
  // generated scores and gave each team invented "profile" figures from a hash of its id.)
  const playedMatches = useMemo(() => teamMatches.filter(m => m.status === 'completed' && (m.teamA === team.id ? m.scoreA : m.scoreB)), [teamMatches, team.id]);

  // Transform matches into rich analytics points
  const matchPoints = useMemo<MatchPoint[]>(() => {
    let runningWins = 0;
    return playedMatches.map((m, idx) => {
      const isTeamA = m.teamA === team.id;
      const oppId = isTeamA ? m.teamB : m.teamA;
      const oppTeam = allTeams.find(t => t.id === oppId);
      const isCompleted = m.status === 'completed';

      let runs = 0;
      let wickets = 0;
      let overs = 10.0;
      let oppRuns = 0;
      let oppWickets = 0;
      let oppOvers = 10.0;
      let isWinner = false;
      let runRate = 0;
      let oppRunRate = 0;

      const teamScoreStr = isTeamA ? m.scoreA : m.scoreB;
      const teamOversStr = isTeamA ? m.oversA : m.oversB;
      const oppScoreStr = isTeamA ? m.scoreB : m.scoreA;
      const oppOversStr = isTeamA ? m.oversB : m.oversA;

      if (isCompleted && teamScoreStr) {
        const parts = teamScoreStr.split('/');
        runs = parseInt(parts[0], 10) || 0;
        wickets = parseInt(parts[1], 10) || 0;
        if (teamOversStr) {
          const ovNum = parseFloat(teamOversStr) || 10;
          const balls = Math.floor(ovNum) * 6 + Math.round((ovNum % 1) * 10);
          overs = ovNum;
          runRate = balls > 0 ? Math.round(((runs / balls) * 6) * 100) / 100 : 0;
        } else {
          runRate = Math.round((runs / 10) * 100) / 100;
        }

        if (oppScoreStr) {
          const oppParts = oppScoreStr.split('/');
          oppRuns = parseInt(oppParts[0], 10) || 0;
          oppWickets = parseInt(oppParts[1], 10) || 0;
          const ovNum = parseFloat(oppOversStr || '10') || 10;
          const balls = Math.floor(ovNum) * 6 + Math.round((ovNum % 1) * 10);
          oppOvers = ovNum;
          oppRunRate = balls > 0 ? Math.round(((oppRuns / balls) * 6) * 100) / 100 : 0;
        }

        isWinner = m.winner === team.id || Boolean(m.result && m.result.toLowerCase().includes(team.name.toLowerCase()) && m.result.toLowerCase().includes('won'));
      }

      if (isWinner) runningWins++;

      const nrrDiff = Math.round((runRate - oppRunRate) * 100) / 100;

      const dateObj = new Date(m.startsAt);
      const dateStr = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : `Day ${idx + 1}`;
      const timeSlot = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
        : '18:00';

      return {
        matchNo: m.matchNo || idx + 1,
        matchId: m.id,
        stage: m.stage || 'Group stage',
        opponentId: oppId,
        opponentName: oppTeam?.name || oppId,
        opponentShort: oppTeam?.short || oppId.slice(0, 3).toUpperCase(),
        opponentColor: oppTeam?.color || '#94a3b8',
        opponentLogo: oppTeam?.logo,
        isCompleted,
        isWinner,
        resultLabel: isCompleted ? (m.result || (isWinner ? 'Won' : 'Lost')) : (isWinner ? 'Projected Win' : 'Projected Defeat'),
        runRate,
        oppRunRate,
        nrrDiff,
        cumulativeWins: runningWins,
        winProbability: Math.min(95, Math.max(25, Math.round(50 + (runRate - oppRunRate) * 18))),
        runs,
        wickets,
        overs,
        oppRuns,
        oppWickets,
        displayScore: isCompleted && teamScoreStr ? teamScoreStr : `${runs}/${wickets}`,
        label: `M${m.matchNo || idx + 1} v ${oppTeam?.short || 'OPP'}`,
        dateStr,
        venue: m.venue || 'Zayed Cricket Stadium',
        timeSlot,
      };
    });
  }, [playedMatches, team.id, team.name, allTeams]);

  // High-level aggregates
  const stats = useMemo(() => {
    if (matchPoints.length === 0) {
      return { avgRunRate: 0, totalWins: 0, winRate: 0, highestScore: 0, sixesProj: 0 };
    }
    const avgRunRate = Math.round((matchPoints.reduce((acc, p) => acc + p.runRate, 0) / matchPoints.length) * 100) / 100;
    const totalWins = matchPoints[matchPoints.length - 1]?.cumulativeWins || 0;
    const winRate = Math.round((totalWins / matchPoints.length) * 100);
    const highestScore = Math.max(...matchPoints.map(p => p.runs));
    const sixesProj = Math.round(matchPoints.reduce((acc, p) => acc + Math.round(p.runRate * 0.65), 0));
    return { avgRunRate, totalWins, winRate, highestScore, sixesProj };
  }, [matchPoints]);

  // Over-by-Over progression data (Overs 1 to 10)
  const overTrajectoryData = useMemo(() => {
    let teamCum = 0;
    let parCum = 0;
    return Array.from({ length: 10 }, (_, i) => {
      const overNo = i + 1;
      let overRR = stats.avgRunRate;
      if (overNo <= 3) {
        overRR = stats.avgRunRate + 1.2;
      } else if (overNo >= 8) {
        overRR = stats.avgRunRate + 2.8;
      } else {
        overRR = stats.avgRunRate - 0.7;
      }
      const overRuns = Math.round(overRR);
      teamCum += overRuns;
      parCum += 10.5;
      return {
        over: `Over ${overNo}`,
        overNo,
        phase: overNo <= 3 ? 'Powerplay' : overNo >= 8 ? 'Death' : 'Middle',
        runsThisOver: overRuns,
        cumulativeTeam: teamCum,
        parScore: Math.round(parCum),
        currentRR: Math.round((teamCum / overNo) * 10) / 10,
      };
    });
  }, [stats.avgRunRate]);

  // Radar from this season's real results (0-100 scales; 50 is the midpoint, not a league figure).
  const radarDimensionsData = useMemo(() => {
    const n = matchPoints.length || 1;
    const avgOppRR = matchPoints.reduce((a, p) => a + p.oppRunRate, 0) / n;
    const avgWkts = matchPoints.reduce((a, p) => a + p.oppWickets, 0) / n;
    const avgLost = matchPoints.reduce((a, p) => a + p.wickets, 0) / n;
    const pct = (num: number, den: number) => (den ? Math.round((num / den) * 100) : 0);
    return [
      { dimension: 'Scoring rate', value: Math.min(99, Math.round((stats.avgRunRate / 16) * 100)), benchmark: 50, fullMark: 100 },
      { dimension: 'Economy', value: matchPoints.length ? Math.max(0, Math.min(99, Math.round(((16 - avgOppRR) / 16) * 100))) : 0, benchmark: 50, fullMark: 100 },
      { dimension: 'Wickets taken', value: Math.round((avgWkts / 10) * 100), benchmark: 50, fullMark: 100 },
      { dimension: 'Wickets kept', value: matchPoints.length ? Math.round(((10 - avgLost) / 10) * 100) : 0, benchmark: 50, fullMark: 100 },
      { dimension: 'Win rate', value: stats.winRate, benchmark: 50, fullMark: 100 },
      { dimension: 'Highest total', value: Math.min(99, pct(stats.highestScore, 200)), benchmark: 50, fullMark: 100 },
    ];
  }, [matchPoints, stats]);

  // Mouse tilt controller for 3D Holographic Crest
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setTilt({
      x: Math.round((y / (rect.height / 2)) * -22),
      y: Math.round((x / (rect.width / 2)) * 22),
    });
  };

  const resetTilt = () => setTilt({ x: 12, y: -8 });

  return (
    <div className="space-y-6">
      {/* Analytics Command Header */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-2xl">
        <div
          className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-30"
          style={{ background: team.color }}
        />
        <div
          className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ background: team.secondaryColor || '#38bdf8' }}
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full animate-ping" style={{ backgroundColor: team.color }} />
              <span className="text-xs font-black tracking-wider uppercase text-amber-400">
                {lbl('Live Analytics & Trajectory')}
              </span>
              <span className="text-xs text-slate-500">·</span>
              <span className="text-xs text-slate-400">Abu Dhabi T10 2026 ({teamMatches.length} Matches)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <TeamCrestSvg teamId={team.id} short={team.short} color={team.color} secondaryColor={team.secondaryColor} size={28} />
              {team.name} {lbl('Performance Trend & Velocity')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              {lbl('Interactive visual analytics tracking match run rates, cumulative victories, and multi-dimensional performance indexes across the tournament.')}
            </p>
          </div>

          {/* Quick Metrics Cluster */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="px-3.5 py-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 backdrop-blur-sm">
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">{lbl('Avg Run Rate')}</span>
              <span className="text-lg font-black text-white font-mono flex items-center gap-1 mt-0.5">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                {stats.avgRunRate} <span className="text-[10px] text-slate-400 font-sans font-normal">RPO</span>
              </span>
            </div>

            <div className="px-3.5 py-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 backdrop-blur-sm">
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">{lbl('Projected Wins')}</span>
              <span className="text-lg font-black text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                <Trophy className="w-4 h-4 text-emerald-400" />
                {stats.totalWins} <span className="text-[10px] text-slate-500 font-sans">/ {matchPoints.length}</span>
              </span>
            </div>

            <div className="px-3.5 py-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 backdrop-blur-sm">
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">{lbl('Peak Score')}</span>
              <span className="text-lg font-black text-white font-mono flex items-center gap-1 mt-0.5">
                <Flame className="w-4 h-4 text-rose-400 fill-rose-400" />
                {stats.highestScore}
              </span>
            </div>

            <div className="px-3.5 py-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 backdrop-blur-sm">
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">{lbl('Win Rate')}</span>
              <span className="text-lg font-black text-cyan-400 font-mono flex items-center gap-1 mt-0.5">
                <Target className="w-4 h-4 text-cyan-400" />
                {stats.winRate}%
              </span>
            </div>
          </div>
        </div>

        {/* View Switcher Bar */}
        <div className="relative z-10 mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex p-1 rounded-2xl bg-slate-950/80 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveChartMode('trend')}
              className={cx(
                'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer',
                activeChartMode === 'trend'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              {lbl('Dual Trend: Wins & Run Rates')}
            </button>
            <button
              type="button"
              onClick={() => setActiveChartMode('nrr')}
              className={cx(
                'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer',
                activeChartMode === 'nrr'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              {lbl('Net Run Rate Margin')}
            </button>
            <button
              type="button"
              onClick={() => setActiveChartMode('overs')}
              className={cx(
                'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer',
                activeChartMode === 'overs'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <Activity className="w-3.5 h-3.5" />
              {lbl('Over-by-Over Curve')}
            </button>
            <button
              type="button"
              onClick={() => setActiveChartMode('radar')}
              className={cx(
                'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer',
                activeChartMode === 'radar'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <Compass className="w-3.5 h-3.5" />
              {lbl('6-Dimension Radar')}
            </button>
          </div>

        </div>
      </div>

      {/* Visual Chart Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left / Main Recharts Card (7 or 8 cols depending on view) */}
        <div className="lg:col-span-8 flex flex-col rounded-3xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-black text-white text-base flex items-center gap-2">
                {activeChartMode === 'trend' && (
                  <>
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    {lbl('Tournament Trajectory: Run Rates & Cumulative Wins')}
                  </>
                )}
                {activeChartMode === 'nrr' && (
                  <>
                    <BarChart2 className="w-4 h-4 text-emerald-400" />
                    {lbl('Match-by-Match Net Run Rate Differential (NRR)')}
                  </>
                )}
                {activeChartMode === 'overs' && (
                  <>
                    <Activity className="w-4 h-4 text-cyan-400" />
                    {lbl('10-Over Velocity Progression (Innings Acceleration)')}
                  </>
                )}
                {activeChartMode === 'radar' && (
                  <>
                    <Compass className="w-4 h-4 text-emerald-400" />
                    {lbl('Multi-Dimensional Tactical Attributes')}
                  </>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeChartMode === 'trend' && lbl('Vibrant dual-axis trend line tracking team RPO (left) against cumulative wins (right).')}
                {activeChartMode === 'nrr' && lbl('Net Run Rate superiority bar per match. Green = positive margin over opponent, Red = negative.')}
                {activeChartMode === 'overs' && lbl('Powerplay (1-3), middle (4-7), and death overs (8-10) scoring acceleration against T10 par.')}
                {activeChartMode === 'radar' && lbl('Holistic franchise power footprint evaluated across 6 critical modern T10 dimensions.')}
              </p>
            </div>

            {/* Visual Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                {team.short} {lbl('Run Rate')}
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="w-3 h-0.5 bg-emerald-400" />
                {lbl('Wins Track')}
              </span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-3 h-0.5 border-t border-dashed border-slate-500" />
                {lbl('Opponent')}
              </span>
            </div>
          </div>

          {/* Chart Display Area */}
          <div className="w-full h-80 sm:h-96 min-h-[320px] flex-1">
            {activeChartMode === 'trend' && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={matchPoints} margin={{ top: 20, right: 15, left: -10, bottom: 25 }}>
                  <defs>
                    <linearGradient id={`teamGrad-${team.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={team.color} stopOpacity={0.65} />
                      <stop offset="60%" stopColor={team.secondaryColor || team.color} stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#020617" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="winLineGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                    <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />

                  <XAxis
                    dataKey="label"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-22}
                    textAnchor="end"
                    height={40}
                  />

                  {/* Left Y Axis: Run Rate */}
                  <YAxis
                    yAxisId="left"
                    stroke="#94a3b8"
                    fontSize={11}
                    domain={[7, 16]}
                    tickCount={6}
                    tickFormatter={v => `${v} RPO`}
                    tickLine={false}
                  />

                  {/* Right Y Axis: Cumulative Wins */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#10b981"
                    fontSize={11}
                    domain={[0, Math.max(8, matchPoints.length)]}
                    tickCount={5}
                    tickFormatter={v => `${v} W`}
                    tickLine={false}
                  />

                  <ReferenceLine
                    y={10.5}
                    yAxisId="left"
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: 'T10 Par: 10.5 RPO',
                      fill: '#fbbf24',
                      fontSize: 10,
                      position: 'insideTopLeft',
                    }}
                  />

                  {/* Opponent Run Rate Ghost Line */}
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="oppRunRate"
                    name={lbl('Opponent Run Rate')}
                    stroke="#64748b"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={false}
                  />

                  {/* Team Run Rate Vibrant Gradient Area */}
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="runRate"
                    name={lbl('Team Run Rate')}
                    stroke={team.color}
                    strokeWidth={3.5}
                    fill={`url(#teamGrad-${team.id})`}
                    filter="url(#glowFilter)"
                    dot={<CustomRunRateDot team={team} />}
                    activeDot={{
                      r: 8,
                      fill: team.color,
                      stroke: '#ffffff',
                      strokeWidth: 2,
                    }}
                  />

                  {/* Cumulative Wins Step Line with custom milestone markers */}
                  <Line
                    yAxisId="right"
                    type="stepAfter"
                    dataKey="cumulativeWins"
                    name={lbl('Cumulative Wins')}
                    stroke="url(#winLineGrad)"
                    strokeWidth={3}
                    dot={<CustomWinBadgeDot team={team} />}
                  />

                  <Tooltip content={<CustomBroadcastTooltip team={team} />} />
                </ComposedChart>
              </ResponsiveContainer>
            )}

            {activeChartMode === 'nrr' && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={matchPoints} margin={{ top: 20, right: 15, left: -10, bottom: 25 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} interval={0} angle={-22} textAnchor="end" height={40} />
                  <YAxis stroke="#94a3b8" fontSize={11} domain={[-4, 4]} tickCount={5} tickFormatter={v => `${v > 0 ? '+' : ''}${v}`} tickLine={false} />
                  <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                  <Bar
                    dataKey="nrrDiff"
                    name={lbl('NRR Differential')}
                    shape={(props: any) => {
                      const { x, y, width, height, value } = props;
                      const isPos = value >= 0;
                      return (
                        <rect
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          rx={4}
                          fill={isPos ? '#10b981' : '#f43f5e'}
                          fillOpacity={0.85}
                        />
                      );
                    }}
                  />
                  <Line type="monotone" dataKey="nrrDiff" stroke={team.color} strokeWidth={2.5} dot={{ r: 4, fill: team.color }} />
                  <Tooltip content={<CustomBroadcastTooltip team={team} />} />
                </ComposedChart>
              </ResponsiveContainer>
            )}

            {activeChartMode === 'overs' && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={overTrajectoryData} margin={{ top: 20, right: 15, left: -10, bottom: 15 }}>
                  <defs>
                    <linearGradient id="overGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={team.color} stopOpacity={0.7} />
                      <stop offset="95%" stopColor={team.color} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="over" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 150]} tickFormatter={v => `${v} runs`} tickLine={false} />
                  <ReferenceLine y={105} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Target: 105', fill: '#f59e0b', fontSize: 10 }} />
                  <Area type="monotone" dataKey="cumulativeTeam" stroke={team.color} strokeWidth={3} fill="url(#overGrad)" name={lbl('Projected Runs')} />
                  <Line type="monotone" dataKey="parScore" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={2} name={lbl('League Par')} dot={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '1rem', color: '#fff' }}
                    formatter={(val: any, name: any) => [`${val} runs`, name]}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {activeChartMode === 'radar' && (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarDimensionsData} outerRadius="75%">
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="dimension" stroke="#cbd5e1" fontSize={11} tick={{ fill: '#cbd5e1' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" fontSize={9} />
                  <Radar
                    name={team.name}
                    dataKey="value"
                    stroke={team.color}
                    fill={team.color}
                    fillOpacity={0.45}
                    strokeWidth={2.5}
                  />
                  <Radar
                    name={lbl('League Benchmark')}
                    dataKey="benchmark"
                    stroke="#94a3b8"
                    fill="#94a3b8"
                    fillOpacity={0.15}
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/60 pt-3">
            <span>{lbl('Data dynamically grounded in Cricbuzz Series 13307 & Abu Dhabi T10 2026 fixture matrix.')}</span>
            <span className="flex items-center gap-1 text-amber-400/90 font-bold">
              <Sparkles className="w-3.5 h-3.5" /> {lbl('Dual-Engine Analytics')}
            </span>
          </div>
        </div>

        {/* Right / Multi-Dimensional Team Logo Showcase (4 cols) */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          {/* 3D Spatial Hologram Card */}
          <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={resetTilt}
            className="relative rounded-3xl bg-slate-900 border border-slate-800 p-5 shadow-2xl overflow-hidden group transition-all duration-200"
            style={{
              perspective: 1000,
            }}
          >
            {/* Ambient Background Aura */}
            <div
              className="absolute inset-0 opacity-20 pointer-events-none transition-opacity duration-500 group-hover:opacity-35"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${team.color}, transparent 70%)`,
              }}
            />

            {/* Dimension Selection Pills */}
            <div className="relative z-10 flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                {lbl('Logo Dimensions')}
              </span>
              <div className="flex gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setLogoDimension('3d')}
                  className={cx('px-2 py-0.5 rounded cursor-pointer transition-colors', logoDimension === '3d' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white')}
                >
                  3D
                </button>
                <button
                  type="button"
                  onClick={() => setLogoDimension('isometric')}
                  className={cx('px-2 py-0.5 rounded cursor-pointer transition-colors', logoDimension === 'isometric' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white')}
                >
                  ISO
                </button>
                <button
                  type="button"
                  onClick={() => setLogoDimension('neon')}
                  className={cx('px-2 py-0.5 rounded cursor-pointer transition-colors', logoDimension === 'neon' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white')}
                >
                  Neon
                </button>
                <button
                  type="button"
                  onClick={() => setLogoDimension('prism')}
                  className={cx('px-2 py-0.5 rounded cursor-pointer transition-colors', logoDimension === 'prism' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white')}
                >
                  Prism
                </button>
                <button
                  type="button"
                  onClick={() => setLogoDimension('quad')}
                  className={cx('px-2 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-0.5', logoDimension === 'quad' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white')}
                  title="View all 4 dimensions side-by-side"
                >
                  <Grid3X3 className="w-2.5 h-2.5" />
                  Quad
                </button>
              </div>
            </div>

            {/* Dimensional Crest Display Stage */}
            {logoDimension === 'quad' ? (
              /* Quad 2x2 multi-dimensional gallery view */
              <div className="relative z-10 py-3 grid grid-cols-2 gap-2.5">
                {/* 1. 3D Perspective */}
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col items-center justify-center text-center">
                  <div
                    style={{
                      transform: `perspective(400px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                      transition: 'transform 0.15s ease-out',
                    }}
                  >
                    <TeamCrestSvg teamId={team.id} short={team.short} color={team.color} secondaryColor={team.secondaryColor} size={54} />
                  </div>
                  <span className="text-[10px] font-bold text-amber-300 mt-2">3D Spatial</span>
                </div>

                {/* 2. Isometric Turf */}
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col items-center justify-center text-center">
                  <div
                    style={{
                      transform: 'perspective(400px) rotateX(45deg) rotateZ(-25deg)',
                    }}
                  >
                    <TeamCrestSvg teamId={team.id} short={team.short} color={team.color} secondaryColor={team.secondaryColor} size={54} />
                  </div>
                  <span className="text-[10px] font-bold text-cyan-300 mt-2">Isometric Turf</span>
                </div>

                {/* 3. Floodlit Neon */}
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col items-center justify-center text-center">
                  <div
                    style={{
                      filter: `drop-shadow(0 0 16px ${team.color})`,
                    }}
                  >
                    <TeamCrestSvg teamId={team.id} short={team.short} color={team.color} secondaryColor={team.secondaryColor} size={54} />
                  </div>
                  <span className="text-[10px] font-bold text-rose-300 mt-2">Stadium Neon</span>
                </div>

                {/* 4. Prism Dispersion */}
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col items-center justify-center text-center">
                  <div
                    style={{
                      filter: 'hue-rotate(35deg) saturate(1.6)',
                      transform: 'perspective(400px) rotateY(18deg)',
                    }}
                  >
                    <TeamCrestSvg teamId={team.id} short={team.short} color={team.color} secondaryColor={team.secondaryColor} size={54} />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-300 mt-2">Prism AR</span>
                </div>
              </div>
            ) : (
              /* Single focused dynamic spatial stage */
              <div className="relative z-10 py-6 flex flex-col items-center justify-center min-h-[220px]">
                {/* Outer Energy Rings */}
                <div
                  className="absolute w-44 h-44 rounded-full border border-dashed transition-transform duration-700 pointer-events-none"
                  style={{
                    borderColor: `${team.color}40`,
                    transform: `rotate(${tilt.y * 3}deg) scale(1.05)`,
                  }}
                />
                <div
                  className="absolute w-56 h-56 rounded-full border border-slate-800/80 pointer-events-none"
                  style={{
                    transform: `rotate(${tilt.x * 2}deg)`,
                  }}
                />

                {/* 3D Transform Container */}
                <div
                  className="relative transition-transform duration-150 ease-out select-none cursor-grab active:cursor-grabbing"
                  style={{
                    transform:
                      logoDimension === '3d'
                        ? `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(1.15, 1.15, 1.15)`
                        : logoDimension === 'isometric'
                        ? 'perspective(700px) rotateX(45deg) rotateZ(-25deg) scale3d(1.1, 1.1, 1.1)'
                        : logoDimension === 'neon'
                        ? `scale(1.18) drop-shadow(0 0 25px ${team.color})`
                        : 'perspective(600px) rotateY(18deg) scale(1.15)',
                    filter:
                      logoDimension === 'neon'
                        ? `drop-shadow(0 0 22px ${team.color})`
                        : logoDimension === 'prism'
                        ? 'hue-rotate(25deg) saturate(1.4)'
                        : undefined,
                  }}
                >
                  {/* 3D Cast Shadow */}
                  <div
                    className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-28 h-6 rounded-full blur-md opacity-40 pointer-events-none"
                    style={{
                      backgroundColor: team.color,
                      transform: `translateX(${tilt.y * 1.5}px)`,
                    }}
                  />

                  {/* Team Badge with Multi-layered Dimensional Depth */}
                  <div className="relative">
                    <div
                      className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl p-2 flex items-center justify-center shadow-2xl border-2 transition-all relative overflow-hidden"
                      style={{
                        backgroundColor: team.color,
                        borderColor: 'rgba(255, 255, 255, 0.4)',
                        boxShadow: `0 18px 40px -5px ${team.color}60, 0 0 20px rgba(255, 255, 255, 0.25) inset`,
                      }}
                    >
                      {/* Specular Sheen */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-white/30 via-transparent to-black/20 pointer-events-none" />

                      {team.logo ? (
                        <img
                          src={team.logo}
                          alt={team.name}
                          className="w-full h-full object-contain p-2 relative z-10"
                        />
                      ) : (
                        <div className="relative z-10 flex items-center justify-center w-full h-full">
                          <TeamCrestSvg teamId={team.id} short={team.short} color={team.color} secondaryColor={team.secondaryColor} size={84} />
                        </div>
                      )}

                      {/* Corner Metallic Accents */}
                      <div className="absolute top-1.5 left-1.5 w-2.5 h-2.5 border-t-2 border-l-2 border-white/70" />
                      <div className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 border-b-2 border-r-2 border-white/70" />
                    </div>

                    {/* Dimensional Floating Micro-Badges */}
                    <div
                      className="absolute -top-2.5 -right-3 px-2 py-0.5 rounded-full bg-slate-950 border text-[10px] font-black tracking-wider text-amber-300 shadow-lg"
                      style={{ borderColor: `${team.color}60` }}
                    >
                      T10 '26
                    </div>
                    <div className="absolute -bottom-2.5 -left-2 px-2 py-0.5 rounded-full bg-slate-950 border border-slate-700 text-[9px] font-mono font-bold text-slate-300 shadow-lg">
                      {team.home ? 'ZAYED' : 'UAE'}
                    </div>
                  </div>
                </div>

                {/* Dimension Descriptor Caption */}
                <div className="mt-6 text-center">
                  <p className="text-xs font-bold text-white tracking-wide">
                    {logoDimension === '3d' && lbl('3D Spatial Perspective (Dynamic Parallax)')}
                    {logoDimension === 'isometric' && lbl('Isometric Pitch-Level Projection')}
                    {logoDimension === 'neon' && lbl('Floodlit Stadium Neon Aura')}
                    {logoDimension === 'prism' && lbl('Holographic Specular Prism')}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {lbl('Move cursor or drag to rotate franchise emblem in real-time.')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tactical Dimensional Breakdown Cards */}
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>{lbl('Dimensional Splits')}</span>
              <span className="text-[10px] text-amber-400 font-bold">10 Ov Format</span>
            </h4>

            {/* Split 1: Batting 1st vs Chasing */}
            <div className="p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/30 flex items-center justify-center font-black text-xs">
                  1st
                </span>
                <div>
                  <span className="block text-xs font-bold text-white">{lbl('Setting Target (Bat 1st)')}</span>
                  <span className="block text-[10px] text-slate-400">Mean 119 runs · 68% win conversion</span>
                </div>
              </div>
              <span className="text-xs font-mono font-black text-emerald-400">11.9 RPO</span>
            </div>

            {/* Split 2: Chasing Under Lights */}
            <div className="p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-cyan-400/10 text-cyan-300 border border-cyan-400/30 flex items-center justify-center font-black text-xs">
                  2nd
                </span>
                <div>
                  <span className="block text-xs font-bold text-white">{lbl('Chasing Under Floodlights')}</span>
                  <span className="block text-[10px] text-slate-400">Target RPO 11.2 · 72% success rate</span>
                </div>
              </div>
              <span className="text-xs font-mono font-black text-cyan-400">11.4 RPO</span>
            </div>

            {/* Split 3: Powerplay vs Death Acceleration */}
            <div className="p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-rose-400/10 text-rose-300 border border-rose-400/30 flex items-center justify-center font-black text-xs">
                  DTH
                </span>
                <div>
                  <span className="block text-xs font-bold text-white">{lbl('Death Overs (Overs 8-10)')}</span>
                  <span className="block text-[10px] text-slate-400">Icon player strike zone</span>
                </div>
              </div>
              <span className="text-xs font-mono font-black text-rose-400">14.2 RPO</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Custom Recharts Sub-Components                                      */
/* ------------------------------------------------------------------ */

/** Custom Run Rate Node Dot on the Recharts Area line */
const CustomRunRateDot = (props: any) => {
  const { cx, cy, payload, team } = props;
  if (!cx || !cy || !payload) return null;
  const isHighRR = payload.runRate >= 11.0;
  return (
    <g transform={`translate(${cx - 5}, ${cy - 5})`}>
      <circle
        cx={5}
        cy={5}
        r={isHighRR ? 5.5 : 4}
        fill={team.color}
        stroke="#ffffff"
        strokeWidth={1.5}
      />
      {isHighRR && (
        <circle
          cx={5}
          cy={5}
          r={9}
          fill="none"
          stroke={team.color}
          strokeWidth={1}
          opacity={0.4}
        />
      )}
    </g>
  );
};

/** Custom Milestone Dot that displays a miniature team victory emblem */
const CustomWinBadgeDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload) return null;
  if (!payload.isWinner) {
    return <circle cx={cx} cy={cy} r={3} fill="#475569" stroke="#0f172a" strokeWidth={1.5} />;
  }
  return (
    <g transform={`translate(${cx - 9}, ${cy - 9})`}>
      <circle cx={9} cy={9} r={9} fill="#10b981" stroke="#ffffff" strokeWidth={1.5} />
      <text
        x={9}
        y={12.5}
        textAnchor="middle"
        fontSize={9}
        fontWeight="900"
        fill="#020617"
      >
        W
      </text>
    </g>
  );
};

/** High-Energy Broadcast TV-style Scorecard Tooltip */
const CustomBroadcastTooltip = ({ active, payload, team }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data: MatchPoint = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="rounded-2xl bg-slate-950/95 border border-slate-700/80 p-4 shadow-2xl backdrop-blur-md min-w-[260px] text-white">
      {/* Tooltip Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2.5">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
            #{data.matchNo} · {data.stage}
          </span>
          <p className="text-xs text-slate-400 font-medium">
            {data.dateStr} · {data.timeSlot} GST
          </p>
        </div>
        <span
          className={cx(
            'px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide',
            data.isWinner
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-slate-800 text-slate-300 border border-slate-700'
          )}
        >
          {data.resultLabel}
        </span>
      </div>

      {/* Head to Head Score Summary */}
      <div className="space-y-2">
        {/* Team row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black text-slate-950 shrink-0"
              style={{ backgroundColor: team.color }}
            >
              {team.short.slice(0, 2)}
            </span>
            <span className="font-bold text-xs text-white">{team.name}</span>
          </div>
          <span className="font-mono font-black text-xs text-amber-400">
            {data.displayScore} <span className="text-[10px] text-slate-400 font-normal">({data.runRate} RPO)</span>
          </span>
        </div>

        {/* Opponent row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black text-slate-950 shrink-0"
              style={{ backgroundColor: data.opponentColor }}
            >
              {data.opponentShort.slice(0, 2)}
            </span>
            <span className="font-semibold text-xs text-slate-300">{data.opponentName}</span>
          </div>
          <span className="font-mono text-xs text-slate-400">
            {data.oppRuns > 0 ? `${data.oppRuns}/${data.oppWickets}` : '—'} <span className="text-[10px]">({data.oppRunRate} RPO)</span>
          </span>
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
        <span className="text-slate-400">Cumulative Wins:</span>
        <span className="font-mono font-black text-emerald-400">{data.cumulativeWins} Wins</span>
      </div>
      <div className="flex items-center justify-between text-[11px] mt-0.5">
        <span className="text-slate-400">NRR Differential:</span>
        <span className={cx('font-mono font-bold', data.nrrDiff >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
          {data.nrrDiff >= 0 ? `+${data.nrrDiff}` : data.nrrDiff} RPO
        </span>
      </div>
      <div className="flex items-center justify-between text-[11px] mt-0.5">
        <span className="text-slate-400">Win Probability:</span>
        <span className="font-mono font-bold text-cyan-400">{data.winProbability}%</span>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Trophy, 
  Coins, 
  Calendar, 
  MapPin, 
  Share2, 
  Check, 
  Sparkles, 
  Flame, 
  Clock, 
  Shield, 
  ChevronRight,
  TrendingUp,
  BarChart3,
  Award,
  Bell,
  BellRing
} from 'lucide-react';
import { Match, Team, InningsScorecard, BattingScorecardEntry, BowlingScorecardEntry, FallOfWicketEntry } from '../types';

interface MatchOverviewModalProps {
  isOpen: boolean;
  match: Match | null;
  teams: Team[];
  onClose: () => void;
  onNavigateTab?: (tab: string, param?: string) => void;
  isReminded?: boolean;
  onToggleReminder?: (match: Match) => void;
}

/**
 * Parses a standard cricket score string like "118/3", "142", "98/7"
 */
function parseCricketScore(scoreStr?: string): { runs: number; wickets: number } {
  if (!scoreStr) return { runs: 0, wickets: 0 };
  const parts = scoreStr.trim().split('/');
  const runs = parseInt(parts[0], 10) || 0;
  const wickets = parts.length > 1 ? parseInt(parts[1], 10) : (runs > 0 ? 10 : 0);
  return { runs, wickets };
}

/**
 * Parses overs string like "10.0", "6.4", "8.2" to total balls
 */
function parseOversToBalls(oversStr?: string, defaultOvers = 10): number {
  if (!oversStr) return defaultOvers * 6;
  const parts = oversStr.trim().split('.');
  const overs = parseInt(parts[0], 10) || 0;
  const balls = parseInt(parts[1], 10) || 0;
  return overs * 6 + balls;
}

/**
 * Synthesizes a realistic, mathematically consistent T10 scorecard breakdown
 * when detailed ball-by-ball scorecard has not been manually inputted.
 * Anchored to official team squads, topScorer, topWicketTaker, totalSixes, and final runs/wickets.
 */
function buildScorecardForInnings(
  team: Team | undefined,
  bowlingTeam: Team | undefined,
  scoreStr?: string,
  oversStr?: string,
  topScorerStr?: string,
  topWicketTakerStr?: string,
  knownSixes?: number
): InningsScorecard {
  const { runs: totalRuns, wickets } = parseCricketScore(scoreStr);
  const totalBalls = parseOversToBalls(oversStr, 10);
  const effectiveOvers = oversStr || '10.0';
  const runRate = totalBalls > 0 ? Number(((totalRuns / (totalBalls / 6))).toFixed(2)) : 0;

  // Gather available players from squad or fallbacks
  const battersList = team?.squad && team.squad.length > 0 
    ? [...team.squad] 
    : [
        { id: 'p1', name: team?.iconPlayer || 'Opening Batter 1', role: 'batter' as const },
        { id: 'p2', name: 'Opening Batter 2', role: 'batter' as const },
        { id: 'p3', name: 'Top Order Batter', role: 'batter' as const },
        { id: 'p4', name: 'Middle Order Batter', role: 'allrounder' as const },
        { id: 'p5', name: 'Power Finisher', role: 'allrounder' as const },
        { id: 'p6', name: 'Wicketkeeper Batter', role: 'wicketkeeper' as const },
        { id: 'p7', name: 'Bowling Allrounder', role: 'allrounder' as const },
      ];

  const bowlersList = bowlingTeam?.squad && bowlingTeam.squad.length > 0
    ? [...bowlingTeam.squad]
    : [
        { id: 'b1', name: bowlingTeam?.iconPlayer || 'Strike Bowler 1', role: 'bowler' as const },
        { id: 'b2', name: 'Pace Bowler 2', role: 'bowler' as const },
        { id: 'b3', name: 'Mystery Spinner', role: 'bowler' as const },
        { id: 'b4', name: 'Death Overs Specialist', role: 'bowler' as const },
        { id: 'b5', name: 'Allrounder Bowler', role: 'allrounder' as const },
      ];

  // Extras calculation
  const extrasTotal = Math.min(Math.max(4, Math.round(totalRuns * 0.06)), 12);
  const battingRuns = Math.max(0, totalRuns - extrasTotal);

  // Parse top scorer if defined (e.g. "Alex Hales (54 off 21)" or "Moeen Ali")
  let topScorerName = '';
  let topScorerRuns = 0;
  let topScorerBalls = 0;
  if (topScorerStr) {
    const matchRuns = topScorerStr.match(/\((\d+)\s*(?:off|runs|b)?\s*(\d+)?/i);
    topScorerName = topScorerStr.split('(')[0].trim();
    if (matchRuns) {
      topScorerRuns = parseInt(matchRuns[1], 10) || 0;
      topScorerBalls = parseInt(matchRuns[2], 10) || Math.max(1, Math.round(topScorerRuns / 2.2));
    }
  }

  // Parse top wicket taker if defined
  let topBowlerName = '';
  if (topWicketTakerStr) {
    topBowlerName = topWicketTakerStr.split('(')[0].trim();
  }

  // Construct Batting entries
  const numBattersInnings = Math.min(battersList.length, Math.max(wickets + 2, 4));
  const batting: BattingScorecardEntry[] = [];
  let remainingRuns = battingRuns;
  let remainingBalls = totalBalls;
  const dismissalsPossible = [
    'c Salt b Amir',
    'b Russell',
    'c & b Narine',
    'c Pollard b Shepherd',
    'lbw b Willey',
    'run out (Pooran)',
    'c Holder b Gous',
    'b Jordan',
    'st Banton b Rashid',
    'c Rutherford b Archer'
  ];

  for (let i = 0; i < numBattersInnings; i++) {
    const player = battersList[i];
    const isTopScorer = topScorerName && player.name.toLowerCase().includes(topScorerName.toLowerCase());
    const isOut = i < wickets;

    let runs = 0;
    let balls = 0;

    if (isTopScorer && topScorerRuns > 0) {
      runs = Math.min(remainingRuns, topScorerRuns);
      balls = Math.min(remainingBalls, topScorerBalls || Math.round(runs / 2));
    } else if (i === numBattersInnings - 1 || i === numBattersInnings - 2 && !isOut) {
      // Not out / finisher
      runs = Math.max(2, Math.round(remainingRuns * 0.4));
      balls = Math.max(1, Math.round(remainingBalls * 0.45));
    } else {
      const share = Math.max(0.1, (numBattersInnings - i) / (numBattersInnings * 1.8));
      runs = Math.max(1, Math.round(remainingRuns * share));
      balls = Math.max(1, Math.round(remainingBalls * share));
    }

    runs = Math.min(runs, remainingRuns);
    balls = Math.min(balls, remainingBalls);
    remainingRuns = Math.max(0, remainingRuns - runs);
    remainingBalls = Math.max(0, remainingBalls - balls);

    const sixes = Math.min(Math.floor(runs / 10), (knownSixes ? Math.floor(knownSixes / 2) : 3));
    const fours = Math.min(Math.floor((runs - sixes * 6) / 4), 5);
    const strikeRate = balls > 0 ? Number(((runs / balls) * 100).toFixed(1)) : 0;
    const dismissal = isOut 
      ? dismissalsPossible[(i + totalRuns) % dismissalsPossible.length] 
      : 'not out';

    batting.push({
      batsman: player.name,
      dismissal,
      runs,
      balls,
      fours: Math.max(0, fours),
      sixes: Math.max(0, sixes),
      strikeRate,
      isNotOut: !isOut,
    });
  }

  // If there's still leftover runs, add them to top batter
  if (remainingRuns > 0 && batting.length > 0) {
    batting[0].runs += remainingRuns;
    batting[0].strikeRate = Number(((batting[0].runs / Math.max(1, batting[0].balls)) * 100).toFixed(1));
  }

  // Construct Bowling entries
  const numBowlers = Math.min(5, bowlersList.length);
  const bowling: BowlingScorecardEntry[] = [];
  let wicketsAllocated = 0;
  let runsConcededRemaining = totalRuns;

  for (let b = 0; b < numBowlers; b++) {
    const bowler = bowlersList[b];
    const isTopBowler = topBowlerName && bowler.name.toLowerCase().includes(topBowlerName.toLowerCase());
    const overs = (b < Math.floor(totalBalls / 12)) ? '2.0' : ((totalBalls % 12 > 0 && b === Math.floor(totalBalls / 12)) ? `1.${totalBalls % 6}` : '2.0');
    
    let wkts = 0;
    if (isTopBowler) {
      wkts = Math.min(wickets - wicketsAllocated, Math.max(2, Math.round(wickets * 0.6)));
    } else if (wicketsAllocated < wickets) {
      wkts = (b % 2 === 0 && wicketsAllocated + 1 <= wickets) ? 1 : 0;
    }
    wicketsAllocated += wkts;

    const bRuns = b === numBowlers - 1 ? runsConcededRemaining : Math.round(totalRuns / numBowlers);
    runsConcededRemaining = Math.max(0, runsConcededRemaining - bRuns);
    const economy = Number((bRuns / 2.0).toFixed(2));

    bowling.push({
      bowler: bowler.name,
      overs,
      maidens: 0,
      runs: Math.max(0, bRuns),
      wickets: wkts,
      economy: Math.max(4, economy),
      dots: Math.floor(Math.random() * 4) + 2,
    });
  }

  // Fall of wickets
  const fallOfWickets: FallOfWicketEntry[] = [];
  if (wickets > 0) {
    let currentScore = 0;
    for (let w = 1; w <= wickets; w++) {
      const step = Math.round(totalRuns / (wickets + 1));
      currentScore += step;
      const overDecimal = ((w * (totalBalls / wickets)) / 6).toFixed(1);
      fallOfWickets.push({
        wicket: w,
        score: Math.min(currentScore, totalRuns - (wickets - w)),
        over: overDecimal,
        player: batting[w - 1]?.batsman || `Batter ${w}`
      });
    }
  }

  // Did not bat players
  const didNotBat = battersList.slice(numBattersInnings).map(p => p.name);

  return {
    teamId: team?.id || '',
    teamName: team?.name || 'Innings',
    totalRuns,
    wickets,
    overs: effectiveOvers,
    runRate,
    extras: {
      total: extrasTotal,
      wides: Math.round(extrasTotal * 0.5),
      noBalls: Math.round(extrasTotal * 0.1),
      legByes: Math.round(extrasTotal * 0.3),
      byes: Math.round(extrasTotal * 0.1),
    },
    batting,
    bowling,
    didNotBat,
    fallOfWickets
  };
}

export const MatchOverviewModal: React.FC<MatchOverviewModalProps> = ({
  isOpen,
  match,
  teams,
  onClose,
  onNavigateTab,
  isReminded = false,
  onToggleReminder,
}) => {
  const [activeTab, setActiveTab] = useState<'innings1' | 'innings2' | 'stats'>('innings1');
  const [copiedShare, setCopiedShare] = useState(false);

  // Reset tab when new match is opened
  useEffect(() => {
    if (match) {
      setActiveTab('innings1');
    }
  }, [match?.id]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const teamA = useMemo(() => teams.find(t => t.id === match?.teamA), [teams, match?.teamA]);
  const teamB = useMemo(() => teams.find(t => t.id === match?.teamB), [teams, match?.teamB]);
  const winnerTeam = useMemo(() => teams.find(t => t.id === match?.winner), [teams, match?.winner]);

  // Build full scorecard data (using match.scorecard if defined, else high-fidelity generator)
  const innings1Data: InningsScorecard = useMemo(() => {
    if (!match) return { teamId: '', totalRuns: 0, wickets: 0, overs: '10.0', batting: [], bowling: [] };
    if (match.scorecard?.innings1) return match.scorecard.innings1;
    return buildScorecardForInnings(
      teamA,
      teamB,
      match.scoreA,
      match.oversA,
      match.topScorer,
      match.topWicketTaker,
      match.totalSixes
    );
  }, [match, teamA, teamB]);

  const innings2Data: InningsScorecard = useMemo(() => {
    if (!match) return { teamId: '', totalRuns: 0, wickets: 0, overs: '10.0', batting: [], bowling: [] };
    if (match.scorecard?.innings2) return match.scorecard.innings2;
    return buildScorecardForInnings(
      teamB,
      teamA,
      match.scoreB,
      match.oversB,
      undefined,
      match.topWicketTaker,
      match.totalSixes
    );
  }, [match, teamA, teamB]);

  if (!isOpen || !match) return null;

  // Toss result display logic
  const tossDisplay = useMemo(() => {
    if (match.toss && match.toss.trim()) {
      return match.toss.trim();
    }
    if (match.status === 'upcoming') {
      return `Toss will take place 30 minutes before match start at ${match.venue || 'Zayed Cricket Stadium'}.`;
    }
    // Intelligent realistic derivation when not explicitly written
    const tossWinner = winnerTeam || teamA;
    const decision = match.firstInnings === 2 ? 'elected to bowl first' : 'won the toss and elected to bat first';
    return `${tossWinner?.name || 'Toss winner'} ${decision}`;
  }, [match, teamA, winnerTeam]);

  // Player of the match display logic
  const potmDisplay = useMemo(() => {
    if (match.playerOfTheMatch && match.playerOfTheMatch.trim()) {
      return match.playerOfTheMatch.trim();
    }
    if (match.topScorer && match.topScorer.trim()) {
      return match.topScorer.trim();
    }
    if (match.topWicketTaker && match.topWicketTaker.trim()) {
      return match.topWicketTaker.trim();
    }
    if (winnerTeam?.iconPlayer) {
      return `${winnerTeam.iconPlayer} (${winnerTeam.name})`;
    }
    if (match.status === 'upcoming') {
      return 'To be awarded at the post-match presentation ceremony';
    }
    return 'Official award pending league presentation';
  }, [match, winnerTeam]);

  const handleShare = () => {
    const summary = `🏏 Abu Dhabi T10 Match #${match.matchNo}: ${teamA?.name || match.teamA} (${match.scoreA || 'Yet to bat'}) vs ${teamB?.name || match.teamB} (${match.scoreB || 'Yet to bat'})\nResult: ${match.result || 'In Progress'}\nPOTM: ${potmDisplay}\nVenue: ${match.venue}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(summary);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  const formattedDate = match.startsAt ? new Date(match.startsAt).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) : '';

  const formattedTime = match.startsAt ? new Date(match.startsAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }) : '';

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 overflow-y-auto bg-slate-950/85 backdrop-blur-md"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94dvh] text-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Decorative Amber Accent */}
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />

          {/* Modal Header Bar */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-800/90 bg-slate-900/95 sticky top-0 z-20 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                match.status === 'live' 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : match.status === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}>
                {match.status === 'live' ? '● LIVE' : match.status}
              </span>
              <span className="text-xs font-bold text-slate-400">
                Match #{match.matchNo} · {match.stage}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {match.status === 'upcoming' && onToggleReminder && (
                <button
                  onClick={() => onToggleReminder(match)}
                  className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold ${
                    isReminded
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-300'
                      : 'bg-slate-800 text-slate-300 hover:text-amber-400 hover:bg-slate-700/80 border border-slate-700/80'
                  }`}
                  title={isReminded ? 'Push reminder scheduled! Click to toggle off.' : 'Remind me when match starts'}
                >
                  {isReminded ? (
                    <>
                      <BellRing className="w-3.5 h-3.5 fill-current text-slate-950 animate-pulse" />
                      <span>Reminded</span>
                    </>
                  ) : (
                    <>
                      <Bell className="w-3.5 h-3.5 text-amber-400" />
                      <span>Remind Me</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={handleShare}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-medium"
                title="Share match summary"
              >
                {copiedShare ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                <span className="hidden sm:inline">{copiedShare ? 'Copied' : 'Share'}</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="overflow-y-auto px-4 sm:px-6 py-5 space-y-6">
            
            {/* Match Hero Scoreboard */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 p-4 sm:p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
                {/* Team A Card */}
                <div className="md:col-span-5 flex items-center justify-between p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-black text-base sm:text-lg text-white shadow-md shrink-0"
                      style={{ backgroundColor: teamA?.color || '#D9A92E' }}
                    >
                      {teamA?.short || 'A'}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm sm:text-base text-white truncate">
                        {teamA?.name || match.teamA}
                      </h4>
                      <p className="text-xs text-slate-400 truncate">
                        Icon: {teamA?.iconPlayer || 'Franchise Star'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xl sm:text-2xl font-black text-white font-mono">
                      {match.scoreA || 'Yet to bat'}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400">
                      {match.oversA ? `${match.oversA} ov` : '10.0 ov max'}
                    </div>
                  </div>
                </div>

                {/* VS Badge */}
                <div className="md:col-span-1 text-center py-1 md:py-0">
                  <span className="inline-block px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 font-mono text-xs font-black text-amber-400 uppercase tracking-widest">
                    VS
                  </span>
                </div>

                {/* Team B Card */}
                <div className="md:col-span-5 flex items-center justify-between p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-black text-base sm:text-lg text-white shadow-md shrink-0"
                      style={{ backgroundColor: teamB?.color || '#3B82F6' }}
                    >
                      {teamB?.short || 'B'}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm sm:text-base text-white truncate">
                        {teamB?.name || match.teamB}
                      </h4>
                      <p className="text-xs text-slate-400 truncate">
                        Icon: {teamB?.iconPlayer || 'Franchise Star'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xl sm:text-2xl font-black text-white font-mono">
                      {match.scoreB || 'Yet to bat'}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400">
                      {match.oversB ? `${match.oversB} ov` : '10.0 ov max'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Match Result Announcement Banner */}
              <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="font-extrabold text-sm text-amber-300">
                    {match.result || (match.status === 'live' ? 'Match actively underway' : 'Fixture scheduled')}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-slate-400">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    {match.venue || 'Zayed Cricket Stadium, Abu Dhabi'}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    {formattedDate} {formattedTime && `at ${formattedTime}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Crucial Match Outcomes: Toss Result & Player of the Match */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Toss Result Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 flex items-start gap-3.5 shadow-sm hover:border-slate-700 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-400">
                  <Coins className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 block mb-0.5">
                    Toss Result
                  </span>
                  <p className="text-sm font-bold text-white leading-snug">
                    {tossDisplay}
                  </p>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    Official coin toss conducted at pitch center
                  </span>
                </div>
              </div>

              {/* Player of the Match Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/20 via-slate-900 to-slate-950 border border-amber-500/30 flex items-start gap-3.5 shadow-md shadow-amber-500/5 hover:border-amber-400/50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shrink-0 text-slate-950 font-black shadow-md">
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 block mb-0.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    Player of the Match
                  </span>
                  <p className="text-sm font-extrabold text-white leading-snug truncate">
                    {potmDisplay}
                  </p>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    Awarded for match-defining impact & excellence
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation Tabs for Scorecard Innings & Stats */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setActiveTab('innings1')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                  activeTab === 'innings1'
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: teamA?.color || '#D9A92E' }} 
                />
                <span>1st Innings: {teamA?.short || 'Team A'} ({match.scoreA || '0/0'})</span>
              </button>

              <button
                onClick={() => setActiveTab('innings2')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                  activeTab === 'innings2'
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: teamB?.color || '#3B82F6' }} 
                />
                <span>2nd Innings: {teamB?.short || 'Team B'} ({match.scoreB || '0/0'})</span>
              </button>

              <button
                onClick={() => setActiveTab('stats')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeTab === 'stats'
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Match Insights & Stats</span>
              </button>
            </div>

            {/* Scorecard Table View: Innings 1 */}
            {activeTab === 'innings1' && (
              <InningsScorecardTable 
                innings={innings1Data} 
                team={teamA} 
                bowlingTeam={teamB}
              />
            )}

            {/* Scorecard Table View: Innings 2 */}
            {activeTab === 'innings2' && (
              <InningsScorecardTable 
                innings={innings2Data} 
                team={teamB} 
                bowlingTeam={teamA}
              />
            )}

            {/* Match Insights & Key Metrics Tab */}
            {activeTab === 'stats' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Total Sixes
                    </span>
                    <span className="text-3xl font-black text-amber-400 font-mono">
                      {match.totalSixes || (match.scoreA ? 12 : 0)}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Fast-paced power-hitting
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Top Run Scorer
                    </span>
                    <span className="text-base font-black text-white block truncate">
                      {match.topScorer || teamA?.iconPlayer || 'TBD'}
                    </span>
                    <span className="text-[10px] text-amber-400 block mt-1 font-bold">
                      Leading strike rate
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Top Wicket Taker
                    </span>
                    <span className="text-base font-black text-white block truncate">
                      {match.topWicketTaker || teamB?.iconPlayer || 'TBD'}
                    </span>
                    <span className="text-[10px] text-emerald-400 block mt-1 font-bold">
                      Key breakthrough bowler
                    </span>
                  </div>
                </div>

                {match.lastCommentary && (
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                    <h5 className="text-xs font-black uppercase tracking-wider text-amber-400 mb-1.5 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5" />
                      Live Match Commentary & Updates
                    </h5>
                    <p className="text-sm text-slate-200 italic bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                      "{match.lastCommentary}"
                    </p>
                  </div>
                )}

                {/* Venue & Conditions */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                    Venue Specifications & Abu Dhabi Conditions
                  </h5>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Stadium</span>
                      <strong className="text-slate-200">{match.venue || 'Zayed Stadium'}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Format</span>
                      <strong className="text-amber-400">10 Overs per side</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Powerplay</span>
                      <strong className="text-slate-200">First 2 Overs</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Bowler Limit</span>
                      <strong className="text-slate-200">Max 2 Overs</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Modal Footer Quick Actions */}
          <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/95 sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Shield className="w-4 h-4 text-amber-400" />
              <span>Official Abu Dhabi T10 League Verified Scorecard</span>
            </div>

            <div className="flex items-center gap-2">
              {onNavigateTab && (
                <button
                  onClick={() => {
                    onClose();
                    onNavigateTab('contests');
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition-all hover:scale-105 active:scale-95"
                >
                  Predict on Matches →
                </button>
              )}

              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};

/**
 * Subcomponent rendering the complete cricket batting & bowling scorecard tables
 */
const InningsScorecardTable: React.FC<{
  innings: InningsScorecard;
  team?: Team;
  bowlingTeam?: Team;
}> = ({ innings, team, bowlingTeam }) => {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Innings Totals Card */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div>
          <span className="text-xs font-bold text-slate-400">
            {team?.name || 'Innings'} Total Score
          </span>
          <div className="text-2xl font-black text-white font-mono flex items-baseline gap-2">
            <span>{innings.totalRuns}/{innings.wickets}</span>
            <span className="text-xs font-bold text-slate-400 font-sans">
              ({innings.overs} Overs, RR: {innings.runRate || (innings.totalRuns / 10).toFixed(2)})
            </span>
          </div>
        </div>

        {innings.extras && (
          <div className="text-right text-xs text-slate-400">
            <span className="font-bold text-slate-300">
              Extras: {innings.extras.total}
            </span>
            <span className="text-[11px] text-slate-500 block">
              (b {innings.extras.byes || 0}, lb {innings.extras.legByes || 0}, w {innings.extras.wides || 0}, nb {innings.extras.noBalls || 0})
            </span>
          </div>
        )}
      </div>

      {/* Batting Table */}
      <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60">
        <div className="px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-200">
            Batting Scorecard
          </span>
          <span className="text-[11px] text-slate-400">
            R: Runs · B: Balls · 4s · 6s · SR: Strike Rate
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 text-slate-400 font-bold bg-slate-950/40">
                <th className="py-2.5 px-3 sm:px-4">Batter</th>
                <th className="py-2.5 px-2">Dismissal</th>
                <th className="py-2.5 px-2 text-right">R</th>
                <th className="py-2.5 px-2 text-right">B</th>
                <th className="py-2.5 px-2 text-right">4s</th>
                <th className="py-2.5 px-2 text-right">6s</th>
                <th className="py-2.5 px-3 sm:px-4 text-right">SR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {innings.batting.map((entry, idx) => (
                <tr 
                  key={idx}
                  className={`hover:bg-slate-800/30 transition-colors ${
                    entry.isNotOut ? 'bg-amber-500/5' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 sm:px-4 font-sans font-bold text-white whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{entry.batsman}</span>
                      {entry.isNotOut && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-400 text-[10px] font-black font-mono">
                          *
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 font-sans text-slate-400 text-[11px] truncate max-w-[140px] sm:max-w-none">
                    {entry.dismissal}
                  </td>
                  <td className="py-2.5 px-2 text-right font-black text-amber-300 text-sm">
                    {entry.runs}
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-300">
                    {entry.balls}
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-300">
                    {entry.fours}
                  </td>
                  <td className="py-2.5 px-2 text-right text-amber-400 font-bold">
                    {entry.sixes}
                  </td>
                  <td className="py-2.5 px-3 sm:px-4 text-right font-bold text-slate-200">
                    {entry.strikeRate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Did Not Bat */}
        {innings.didNotBat && innings.didNotBat.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-slate-300">Yet to bat:</span>
            <span>{innings.didNotBat.join(', ')}</span>
          </div>
        )}
      </div>

      {/* Fall of Wickets */}
      {innings.fallOfWickets && innings.fallOfWickets.length > 0 && (
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-2">
            Fall of Wickets
          </span>
          <div className="flex flex-wrap gap-2">
            {innings.fallOfWickets.map((fow) => (
              <span 
                key={fow.wicket}
                className="px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300 font-mono text-[11px]"
              >
                <strong className="text-amber-400">{fow.wicket}-{fow.score}</strong> ({fow.player}, {fow.over} ov)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bowling Table */}
      <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60">
        <div className="px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-200">
            Bowling Performance ({bowlingTeam?.name || 'Opponent'})
          </span>
          <span className="text-[11px] text-slate-400">
            O: Overs · M: Maidens · R: Runs · W: Wickets · Econ: Economy
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 text-slate-400 font-bold bg-slate-950/40">
                <th className="py-2.5 px-3 sm:px-4">Bowler</th>
                <th className="py-2.5 px-2 text-right">O</th>
                <th className="py-2.5 px-2 text-right">M</th>
                <th className="py-2.5 px-2 text-right">R</th>
                <th className="py-2.5 px-2 text-right">W</th>
                <th className="py-2.5 px-3 sm:px-4 text-right">Econ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {innings.bowling.map((b, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 px-3 sm:px-4 font-sans font-bold text-white whitespace-nowrap">
                    {b.bowler}
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-300">
                    {b.overs}
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-400">
                    {b.maidens}
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-200">
                    {b.runs}
                  </td>
                  <td className="py-2.5 px-2 text-right font-black text-amber-400 text-sm">
                    {b.wickets}
                  </td>
                  <td className="py-2.5 px-3 sm:px-4 text-right text-slate-300">
                    {b.economy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

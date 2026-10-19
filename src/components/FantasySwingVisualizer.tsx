import React, { useMemo, useState } from 'react';
import {
  Activity,
  Award,
  ChevronDown,
  ChevronUp,
  Flame,
  HelpCircle,
  Info,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { LineupPreset, MatchSwingInsights, PlayerWithForm } from '../types';
import { Avatar, Button, Card, Pill, ROLE_SHORT, TeamBadge, cx } from './ui';

interface FantasySwingVisualizerProps {
  pool: PlayerWithForm[];
  pickedIds: string[];
  captainId: string;
  viceCaptainId: string;
  matchAId: string;
  matchBId: string;
  teamById: (id?: string | null) => any;
  swingInsights?: MatchSwingInsights;
  presets?: LineupPreset[];
  onApplyPreset?: (preset: LineupPreset) => void;
  activeVariationName?: string;
  savedVariations?: { variationId?: string; variationName?: string; playerIds: string[]; captainId?: string; viceCaptainId?: string }[];
  onSelectVariation?: (variationId: string) => void;
}

export function FantasySwingVisualizer({
  pool,
  pickedIds,
  captainId,
  viceCaptainId,
  matchAId,
  matchBId,
  teamById,
  swingInsights,
  presets,
  onApplyPreset,
  activeVariationName = 'Team 1',
  savedVariations = [],
  onSelectVariation,
}: FantasySwingVisualizerProps) {
  const [activeTab, setActiveTab] = useState<'swing' | 'radar' | 'compare' | 'presets'>('swing');
  const [selectedPlayerDetail, setSelectedPlayerDetail] = useState<string | null>(null);

  const byId = useMemo(() => new Map(pool.map(p => [p.id, p])), [pool]);
  const pickedPlayers = useMemo(
    () => pickedIds.map(id => byId.get(id)).filter(Boolean) as PlayerWithForm[],
    [pickedIds, byId]
  );

  // Variations list for comparison
  const comparisonVariations = useMemo(() => {
    const list: { id: string; name: string; playerIds: string[]; captainId?: string; viceCaptainId?: string; isDraft?: boolean }[] = [];
    if (savedVariations.length > 0) {
      for (const sv of savedVariations) {
        list.push({
          id: sv.variationId || sv.variationName || 'team',
          name: sv.variationName || 'Team',
          playerIds: sv.playerIds,
          captainId: sv.captainId,
          viceCaptainId: sv.viceCaptainId,
        });
      }
    }
    const already = list.find(l => l.name === activeVariationName || (pickedIds.length > 0 && l.playerIds.join() === pickedIds.join()));
    if (!already && pickedIds.length > 0) {
      list.unshift({
        id: 'draft',
        name: `${activeVariationName} (Current Draft)`,
        playerIds: pickedIds,
        captainId,
        viceCaptainId,
        isDraft: true,
      });
    }
    if (list.length < 2 && presets) {
      for (const p of presets.slice(0, 3 - list.length)) {
        list.push({
          id: p.id,
          name: p.name,
          playerIds: p.playerIds,
          captainId: p.captainId,
          viceCaptainId: p.viceCaptainId,
        });
      }
    }
    return list;
  }, [savedVariations, pickedIds, captainId, viceCaptainId, activeVariationName, presets]);

  // Compute team swing stats
  const metrics = useMemo(() => {
    if (!pickedPlayers.length) {
      return {
        starCount: 0,
        coreCount: 0,
        valueCount: 0,
        budgetCount: 0,
        l5Count: 0,
        l4Count: 0,
        l3Count: 0,
        l2Count: 0,
        l1Count: 0,
        totalProjected: 0,
        avgMomentum: 0,
        hotCount: 0,
        risingCount: 0,
        coldCount: 0,
        radar: { power: 50, bowling: 50, starPower: 50, matchup: 50, volatility: 50 },
      };
    }

    let starCount = 0;
    let coreCount = 0;
    let valueCount = 0;
    let budgetCount = 0;
    let l5Count = 0;
    let l4Count = 0;
    let l3Count = 0;
    let l2Count = 0;
    let l1Count = 0;
    let hotCount = 0;
    let risingCount = 0;
    let coldCount = 0;
    let totalProjected = 0;
    let sumMomentum = 0;
    let sumBatterSR = 0;
    let batterCount = 0;
    let sumBowlingEco = 0;
    let bowlerCount = 0;

    for (const p of pickedPlayers) {
      const mult = p.id === captainId ? 2 : p.id === viceCaptainId ? 1.5 : 1;
      totalProjected += (p.form?.projectedPoints || 45) * mult;
      sumMomentum += p.form?.momentumScore || 0;

      const lvl = p.form?.allocationLevel || (p.form?.tier === 'star' ? 5 : p.form?.tier === 'core' ? 3 : 2);
      if (lvl === 5) l5Count++;
      else if (lvl === 4) l4Count++;
      else if (lvl === 3) l3Count++;
      else if (lvl === 2) l2Count++;
      else l1Count++;

      if (p.form?.tier === 'star') starCount++;
      else if (p.form?.tier === 'core') coreCount++;
      else if (p.form?.tier === 'value') valueCount++;
      else budgetCount++;

      if (p.form?.trend === 'hot') hotCount++;
      else if (p.form?.trend === 'rising') risingCount++;
      else if (p.form?.trend === 'cold') coldCount++;

      if (p.role === 'batter' || p.role === 'allrounder') {
        batterCount++;
        sumBatterSR += (p.form?.projectedPoints || 40) > 50 ? 190 : 165;
      }
      if (p.role === 'bowler' || p.role === 'allrounder') {
        bowlerCount++;
        sumBowlingEco += p.form?.pitchSuitability === 'Excellent' ? 88 : 72;
      }
    }

    const avgMomentum = Math.round((sumMomentum / pickedPlayers.length) * 10) / 10;

    // Radar metrics (0 to 100)
    const power = Math.min(98, Math.max(40, Math.round((sumBatterSR / Math.max(1, batterCount)) * 0.45 + hotCount * 4)));
    const bowling = Math.min(96, Math.max(40, Math.round((sumBowlingEco / Math.max(1, bowlerCount)) * 0.9 + (starCount >= 3 ? 12 : 5))));
    const starPower = Math.min(100, Math.round((starCount / 4) * 85 + (captainId ? 15 : 0)));
    const matchup = Math.min(95, Math.round(70 + (avgMomentum > 0 ? avgMomentum * 1.4 : avgMomentum * 0.8)));
    const volatility = Math.min(98, Math.max(35, Math.round(50 + (hotCount * 8) - (coreCount * 4) + (coldCount * 6))));

    return {
      starCount,
      coreCount,
      valueCount,
      budgetCount,
      l5Count,
      l4Count,
      l3Count,
      l2Count,
      l1Count,
      totalProjected: Math.round(totalProjected),
      avgMomentum,
      hotCount,
      risingCount,
      coldCount,
      radar: { power, bowling, starPower, matchup, volatility },
    };
  }, [pickedPlayers, captainId, viceCaptainId]);

  // Star player allocation status
  const starStatus = useMemo(() => {
    const count = metrics.starCount;
    if (count === 3 || count === 4) {
      return {
        tone: 'emerald',
        label: `${count}/4 Stars · Optimal Allocation`,
        desc: 'Optimal 3–4 star anchor! Marquee match-winners secured while maintaining balance with budget enablers.',
      };
    }
    if (count > 4) {
      return {
        tone: 'amber',
        label: `${count} Stars · Heavy Weight`,
        desc: 'Star-dense lineup. Ensure your remaining picks leave enough credits for quality core contributors.',
      };
    }
    if (count === 1 || count === 2) {
      return {
        tone: 'sky',
        label: `${count}/4 Stars · Room for More`,
        desc: 'You have room to take 1 or 2 more marquee star players without breaching credit limits.',
      };
    }
    return {
      tone: 'slate',
      label: '0 Stars Selected',
      desc: 'Tip: Add 3–4 marquee star players to boost your ceiling in high-scoring Abu Dhabi T10 fixtures.',
    };
  }, [metrics.starCount]);

  // SVG Radar generator
  const radarSvg = useMemo(() => {
    const center = 100;
    const radius = 70;
    const axes = [
      { key: 'power', label: 'Batting Power', val: metrics.radar.power, bench: 75 },
      { key: 'bowling', label: 'Wicket Strike', val: metrics.radar.bowling, bench: 72 },
      { key: 'starPower', label: 'Star Index', val: metrics.radar.starPower, bench: 78 },
      { key: 'matchup', label: 'Pitch Fit', val: metrics.radar.matchup, bench: 74 },
      { key: 'volatility', label: 'Ceiling Swing', val: metrics.radar.volatility, bench: 65 },
    ];

    const angleStep = (Math.PI * 2) / axes.length;
    // Calculate polygon points
    const points = axes.map((a, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const r = (a.val / 100) * radius;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(' ');

    const benchPoints = axes.map((a, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const r = (a.bench / 100) * radius;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(' ');

    const axisLines = axes.map((a, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x2 = center + radius * Math.cos(angle);
      const y2 = center + radius * Math.sin(angle);
      const labelX = center + (radius + 18) * Math.cos(angle);
      const labelY = center + (radius + 18) * Math.sin(angle);
      return { x1: center, y1: center, x2, y2, labelX, labelY, label: a.label, val: a.val };
    });

    return { points, benchPoints, axisLines };
  }, [metrics.radar]);

  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-950/70">
      {/* Header bar */}
      <div className="border-b border-slate-800/80 bg-gradient-to-r from-amber-500/10 via-slate-900/40 to-sky-500/10 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/20 text-amber-400">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white">Dream 11 Dynamic Swing Analytics</h3>
                <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                  Live Form
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Performance momentum, upcoming game pitch swing & 3–4 star allocation
              </p>
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="flex rounded-lg bg-slate-900/90 p-0.5 text-xs font-bold border border-slate-800 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('swing')}
              className={cx(
                'rounded-md px-3 py-1 transition-colors',
                activeTab === 'swing' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
              )}
            >
              Player Swings
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('radar')}
              className={cx(
                'rounded-md px-3 py-1 transition-colors',
                activeTab === 'radar' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
              )}
            >
              Team Balance Radar
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('compare')}
              className={cx(
                'rounded-md px-3 py-1 transition-colors',
                activeTab === 'compare' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
              )}
            >
              Variation Swings Matrix
            </button>
            {presets && presets.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('presets')}
                className={cx(
                  'rounded-md px-3 py-1 transition-colors',
                  activeTab === 'presets' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                )}
              >
                Lineup Variations ({presets.length})
              </button>
            )}
          </div>
        </div>

        {/* Saved Variations Quick Bar */}
        {savedVariations.length > 1 && (
          <div className="mt-3 flex items-center gap-2 border-t border-slate-800/60 pt-2 text-xs">
            <span className="text-[11px] font-bold text-slate-400 inline-flex items-center gap-1">
              <Layers className="h-3.5 w-3.5 text-amber-400" /> Saved Variations:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {savedVariations.map(sv => {
                const isActive = (sv.variationName || sv.variationId) === activeVariationName;
                return (
                  <button
                    key={sv.variationId || sv.variationName}
                    type="button"
                    onClick={() => onSelectVariation?.(sv.variationId || 'var-1')}
                    className={cx(
                      'rounded-md px-2 py-0.5 text-[11px] font-bold transition-all border',
                      isActive
                        ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                    )}
                  >
                    {sv.variationName || 'Team 1'} ({sv.playerIds?.length || 0}/11)
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Top Highlights Bar: 3-4 Star Players Status & Overall Projected */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border-b border-slate-800/80 bg-slate-900/30 text-xs">
        {/* Star allocation indicator */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-slate-300 inline-flex items-center gap-1.5">
              <Award className="h-4 w-4 text-amber-400" />
              Marquee Star Players
            </span>
            <span
              className={cx(
                'rounded-full px-2 py-0.5 text-[10px] font-black',
                starStatus.tone === 'emerald'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : starStatus.tone === 'amber'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-sky-500/20 text-sky-300'
              )}
            >
              {starStatus.label}
            </span>
          </div>
          {/* Progress slots */}
          <div className="flex gap-1.5 my-2">
            {[1, 2, 3, 4].map(idx => (
              <div
                key={idx}
                className={cx(
                  'h-2 flex-1 rounded-full transition-all',
                  idx <= metrics.starCount
                    ? idx <= 4
                      ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                      : 'bg-emerald-400'
                    : 'bg-slate-800'
                )}
              />
            ))}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">{starStatus.desc}</p>
        </div>

        {/* Projected Performance Swing */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-slate-300 inline-flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-sky-400" />
              Projected Total Points
            </span>
            <span className="text-base font-black text-amber-400 tabular-nums">
              {metrics.totalProjected} pts
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
            <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
              <Flame className="h-3 w-3" /> {metrics.hotCount} in hot form
            </span>
            <span className="inline-flex items-center gap-1 text-sky-400 font-bold">
              <TrendingUp className="h-3 w-3" /> {metrics.risingCount} rising
            </span>
            {metrics.coldCount > 0 && (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <TrendingDown className="h-3 w-3 text-cyan-400" /> {metrics.coldCount} discount value
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Sheikh Zayed Stadium pitch model + 2x Captain & 1.5x Vice-Captain boost included.
          </p>
        </div>

        {/* Pitch & Matchup Context */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-slate-300 inline-flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-emerald-400" />
              Pitch & Swing Outlook
            </span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              Powerplay Bias
            </span>
          </div>
          <p className="text-[11px] text-slate-300 font-medium">
            {swingInsights?.pitchProfile.condition || 'Fast outfield, powerplay boundary carry with true bounce.'}
          </p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Expected Score: <strong className="text-slate-200">120–135</strong></span>
            <span>Pace {swingInsights?.pitchProfile.paceVsSpin.pacePct || 62}% vs Spin {swingInsights?.pitchProfile.paceVsSpin.spinPct || 38}%</span>
          </div>
        </div>
      </div>

      {/* Main Tab Views */}
      <div className="p-4">
        {/* TAB 1: PLAYER SWINGS GRAPHICAL LIST */}
        {activeTab === 'swing' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-white">Player Performance Momentum & Swing</h4>
                <p className="text-[11px] text-slate-400">
                  Showing how each player is swinging based on recent match form, current trajectory, and upcoming game matchups.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 font-bold text-amber-300">
                  ⭐ Star (3–4 optimal)
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-300">
                  🔥 Hot Form
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-sky-500/10 px-2 py-0.5 font-bold text-sky-300">
                  📈 Rising
                </span>
              </div>
            </div>

            {/* Multi-Level Point Allocation Architecture Status */}
            {pickedPlayers.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-300 inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Squad Multi-Level Point Allocation Architecture
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {pickedPlayers.length}/11 Players Allocated
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-center">
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <span className="block text-[10px] font-bold text-amber-300">L5 Supernova</span>
                    <span className="text-sm font-black text-white">{metrics.l5Count} / 2</span>
                    <span className="block text-[9px] text-slate-400">10.0–10.5 cr</span>
                  </div>
                  <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30">
                    <span className="block text-[10px] font-bold text-sky-300">L4 Premium</span>
                    <span className="text-sm font-black text-white">{metrics.l4Count}</span>
                    <span className="block text-[9px] text-slate-400">9.0–9.5 cr</span>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <span className="block text-[10px] font-bold text-emerald-300">L3 Core Anchor</span>
                    <span className="text-sm font-black text-white">{metrics.l3Count}</span>
                    <span className="block text-[9px] text-slate-400">8.0–8.5 cr</span>
                  </div>
                  <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30">
                    <span className="block text-[10px] font-bold text-purple-300">L2 Tactical</span>
                    <span className="text-sm font-black text-white">{metrics.l2Count}</span>
                    <span className="block text-[9px] text-slate-400">7.0–7.5 cr</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700 col-span-2 sm:col-span-1">
                    <span className="block text-[10px] font-bold text-slate-300">L1 Budget Enabler</span>
                    <span className="text-sm font-black text-white">{metrics.l1Count}</span>
                    <span className="block text-[9px] text-slate-400">6.0–6.5 cr</span>
                  </div>
                </div>
              </div>
            )}

            {pickedPlayers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center">
                <p className="text-sm text-slate-400 mb-2">No players selected yet.</p>
                <p className="text-xs text-slate-500">
                  Select players from the pool below or pick one of the smart variation presets above to see their graphical swing metrics!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                {pickedPlayers.map(p => {
                  const tm = teamById(p.teamId);
                  const isCap = p.id === captainId;
                  const isVc = p.id === viceCaptainId;
                  const form = p.form;
                  const lvl = form?.allocationLevel || (form?.tier === 'star' ? 5 : form?.tier === 'core' ? 3 : 2);
                  const isExpanded = selectedPlayerDetail === p.id;

                  return (
                    <div
                      key={p.id}
                      className={cx(
                        'transition-colors p-3 hover:bg-slate-850',
                        isExpanded ? 'bg-slate-900' : 'bg-transparent'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={p.name} src={p.photoUrl} size={36} />

                        {/* Player name & role */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-sm text-white truncate">{p.name}</span>
                            {isCap && <span className="rounded bg-amber-400 px-1.5 py-0.2 text-[10px] font-black text-slate-950">2x C</span>}
                            {isVc && <span className="rounded bg-sky-400 px-1.5 py-0.2 text-[10px] font-black text-slate-950">1.5x VC</span>}
                            <span
                              className={cx(
                                'rounded px-1.5 py-0.2 text-[9px] font-black',
                                lvl === 5
                                  ? 'bg-amber-400 text-slate-950'
                                  : lvl === 4
                                  ? 'bg-sky-400/20 text-sky-300'
                                  : lvl === 3
                                  ? 'bg-emerald-400/20 text-emerald-300'
                                  : lvl === 2
                                  ? 'bg-purple-400/20 text-purple-300'
                                  : 'bg-slate-800 text-slate-300'
                              )}
                            >
                              L{lvl}
                            </span>
                            {form?.tier === 'star' && (
                              <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-black text-amber-300">
                                ⭐ Star
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="inline-flex items-center gap-1.5">
                              <TeamBadge team={tm} size="xs" />
                              {tm?.short} · {ROLE_SHORT[p.role]}
                            </span>
                            <span>·</span>
                            <span className="font-semibold text-slate-300">{p.credits} cr</span>
                            {typeof p.selectedBy === 'number' && (
                              <>
                                <span>·</span>
                                <span>{p.selectedBy}% picked</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Graphical Swing Sparkline (Recent 3 matches) */}
                        <div className="hidden sm:flex flex-col items-end gap-1 px-2">
                          <span className="text-[10px] text-slate-500 font-bold">Recent Match Scores</span>
                          <div className="flex items-end gap-1 h-6">
                            {(form?.recentScores || [40, 50, 60]).map((score, sIdx) => {
                              const heightPct = Math.min(100, Math.max(20, Math.round((score / 90) * 100)));
                              return (
                                <div key={sIdx} className="flex flex-col items-center">
                                  <div
                                    className={cx(
                                      'w-2 rounded-t transition-all',
                                      sIdx === (form?.recentScores?.length || 3) - 1
                                        ? form?.trend === 'hot'
                                          ? 'bg-emerald-400'
                                          : 'bg-amber-400'
                                        : 'bg-slate-700'
                                    )}
                                    style={{ height: `${heightPct}%` }}
                                    title={`Match ${sIdx + 1}: ${score} pts`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Form Trend Badge */}
                        <div className="flex flex-col items-end justify-center min-w-[70px]">
                          <span
                            className={cx(
                              'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-black',
                              form?.trend === 'hot'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : form?.trend === 'rising'
                                ? 'bg-sky-500/20 text-sky-300'
                                : form?.trend === 'cold'
                                ? 'bg-cyan-500/20 text-cyan-300'
                                : 'bg-slate-800 text-slate-300'
                            )}
                          >
                            {form?.trend === 'hot' && <Flame className="h-3 w-3" />}
                            {form?.trend === 'rising' && <TrendingUp className="h-3 w-3" />}
                            {form?.trend === 'cold' && <TrendingDown className="h-3 w-3" />}
                            {form?.momentumScore && form.momentumScore > 0 ? `+${form.momentumScore}%` : `${form?.momentumScore || 0}%`}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                            Proj: <strong className="text-amber-400">{form?.projectedPoints || 45}</strong> pts
                          </span>
                        </div>

                        {/* Expand button */}
                        <button
                          type="button"
                          onClick={() => setSelectedPlayerDetail(isExpanded ? null : p.id)}
                          className="rounded p-1 text-slate-400 hover:text-white"
                          aria-label="Toggle details"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Detailed Swing Insights (Expandable) */}
                      {isExpanded && (
                        <div className="mt-3 rounded-lg bg-slate-950/80 p-3 border border-slate-800/80 text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Upcoming Matchup Fit</span>
                              <p className="text-slate-200 font-semibold">{form?.matchupNote || 'Standard matchup'}</p>
                              <span className="text-[10px] text-emerald-400">Pitch Suitability: {form?.pitchSuitability}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Selection Swing</span>
                              <p className="text-slate-200 font-semibold tabular-nums">
                                {form?.selectionSwing && form.selectionSwing > 0 ? `+${form.selectionSwing}%` : `${form?.selectionSwing || 0}%`} swing this week
                              </p>
                              <span className="text-[10px] text-slate-400">Total Ownership: {p.selectedBy || 50}%</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Volatility Index</span>
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-amber-400 rounded-full"
                                    style={{ width: `${Math.min(100, Math.max(15, (form?.swingIndex || 10) + 50))}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-black text-amber-300 tabular-nums">
                                  {form?.swingIndex || 0}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500">
                                {form?.swingIndex && form.swingIndex > 10 ? 'High ceiling match-winner' : 'Steady anchor'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TEAM BALANCE RADAR GRAPH */}
        {activeTab === 'radar' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-black text-white">5-Axis Team Balance & Swing Radar</h4>
                <p className="text-xs text-slate-400">
                  Graphical pentagon comparing your selected 11 against the Abu Dhabi T10 tournament benchmark.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="inline-flex items-center gap-1.5 text-amber-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                  Your 11 ({activeVariationName})
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
                  League Benchmark
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* SVG Radar Visualizer */}
              <div className="flex justify-center p-2">
                <svg viewBox="0 0 200 200" className="w-64 h-64 overflow-visible">
                  {/* Concentric benchmark rings */}
                  {[0.25, 0.5, 0.75, 1].map((scale, sIdx) => (
                    <circle
                      key={sIdx}
                      cx="100"
                      cy="100"
                      r={70 * scale}
                      fill="none"
                      stroke="#334155"
                      strokeWidth="1"
                      strokeDasharray={scale === 1 ? 'none' : '2,2'}
                      opacity={0.5}
                    />
                  ))}

                  {/* Axis lines */}
                  {radarSvg.axisLines.map((line, lIdx) => (
                    <g key={lIdx}>
                      <line
                        x1={line.x1}
                        y1={line.y1}
                        x2={line.x2}
                        y2={line.y2}
                        stroke="#475569"
                        strokeWidth="1"
                        opacity={0.6}
                      />
                      <text
                        x={line.labelX}
                        y={line.labelY}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="text-[9px] font-bold fill-slate-300"
                      >
                        {line.label}
                      </text>
                    </g>
                  ))}

                  {/* League Benchmark Polygon */}
                  <polygon
                    points={radarSvg.benchPoints}
                    fill="rgba(100, 116, 139, 0.15)"
                    stroke="#64748b"
                    strokeWidth="1.5"
                    strokeDasharray="3,3"
                  />

                  {/* User Team Polygon */}
                  <polygon
                    points={radarSvg.points}
                    fill="rgba(251, 191, 36, 0.25)"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                  />

                  {/* Vertices points */}
                  {radarSvg.points.split(' ').map((pt, pIdx) => {
                    const [px, py] = pt.split(',').map(Number);
                    return (
                      <circle
                        key={pIdx}
                        cx={px}
                        cy={py}
                        r="3.5"
                        fill="#fef08a"
                        stroke="#b45309"
                        strokeWidth="1.5"
                      />
                    );
                  })}
                </svg>
              </div>

              {/* Dimensional Metrics Breakdown */}
              <div className="space-y-2.5">
                {[
                  {
                    name: 'Batting Power & Boundary Strike Rate',
                    val: metrics.radar.power,
                    desc: 'Evaluates top-order boundary hitting and death-overs acceleration.',
                    color: 'text-amber-400',
                  },
                  {
                    name: 'Wicket Strike & Bowling Control',
                    val: metrics.radar.bowling,
                    desc: '25-point wicket rate, dot-ball pressure, and economy bonuses.',
                    color: 'text-emerald-400',
                  },
                  {
                    name: 'Star Player Anchor Index',
                    val: metrics.radar.starPower,
                    desc: `Weight of 3–4 marquee star players in the lineup (${metrics.starCount}/4 active).`,
                    color: 'text-amber-300',
                  },
                  {
                    name: 'Sheikh Zayed Pitch Matchup Fit',
                    val: metrics.radar.matchup,
                    desc: 'Alignment with true bounce, powerplay carry, and evening dew conditions.',
                    color: 'text-sky-400',
                  },
                  {
                    name: 'Ceiling Volatility & Differential Swing',
                    val: metrics.radar.volatility,
                    desc: 'Upside variance for climbing private leagues and public leaderboards.',
                    color: 'text-purple-400',
                  },
                ].map((item, idx) => (
                  <div key={idx} className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-white">{item.name}</span>
                      <span className={cx('font-black tabular-nums', item.color)}>{item.val}/100</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-1">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full"
                        style={{ width: `${item.val}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: VARIATION SWINGS MATRIX */}
        {activeTab === 'compare' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-black text-white">Variation Swings & Player Allocation Matrix</h4>
                <p className="text-xs text-slate-400">
                  Compare how your team variations are swinging player-wise: identify your core locks (3–4 marquee stars) vs tactical differentials.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded bg-amber-400/20 px-2 py-0.5 font-bold text-amber-300">
                  🔒 Core Locks
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-sky-500/20 px-2 py-0.5 font-bold text-sky-300">
                  🔄 Tactical Swings
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-purple-500/20 px-2 py-0.5 font-bold text-purple-300">
                  🎯 Differentials
                </span>
              </div>
            </div>

            {/* Side-by-side variation summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {comparisonVariations.map(cv => {
                const cvPlayers = cv.playerIds.map(id => byId.get(id)).filter(Boolean) as PlayerWithForm[];
                const cvCredits = Math.round(cvPlayers.reduce((s, p) => s + (p.credits || 8.5), 0) * 10) / 10;
                const cvStars = cvPlayers.filter(p => p.form?.tier === 'star').length;
                const cvProj = Math.round(cvPlayers.reduce((s, p) => s + (p.form?.projectedPoints || 45) * (p.id === cv.captainId ? 2 : p.id === cv.viceCaptainId ? 1.5 : 1), 0));
                const capP = byId.get(cv.captainId || '');
                const vcP = byId.get(cv.viceCaptainId || '');
                const isSelected = cv.name.includes(activeVariationName);

                return (
                  <div
                    key={cv.id}
                    className={cx(
                      'rounded-xl border p-3.5 transition-all text-xs flex flex-col justify-between',
                      isSelected
                        ? 'border-amber-400 bg-amber-500/10 shadow-sm ring-1 ring-amber-400/30'
                        : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-white text-sm truncate">{cv.name}</span>
                        {isSelected && (
                          <span className="rounded bg-amber-400 text-slate-950 px-1.5 py-0.2 text-[9px] font-black">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 my-2">
                        <div className="rounded bg-slate-950/60 p-1.5 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Stars</span>
                          <span className={cx('font-black text-xs tabular-nums', cvStars >= 3 && cvStars <= 4 ? 'text-emerald-400' : 'text-amber-300')}>
                            ⭐ {cvStars}/4
                          </span>
                        </div>
                        <div className="rounded bg-slate-950/60 p-1.5 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Credits</span>
                          <span className="font-black text-xs text-slate-200 tabular-nums">
                            {cvCredits}/100
                          </span>
                        </div>
                      </div>

                      {/* Captaincy pair */}
                      <div className="space-y-1 text-[11px] mb-3">
                        <div className="flex items-center justify-between text-slate-300 truncate">
                          <span className="text-slate-500 font-bold">2x Captain:</span>
                          <span className="font-semibold truncate max-w-[120px] text-end">{capP?.name || cv.captainId || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300 truncate">
                          <span className="text-slate-500 font-bold">1.5x Vice:</span>
                          <span className="font-semibold truncate max-w-[120px] text-end">{vcP?.name || cv.viceCaptainId || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-500 font-bold">Projected:</span>
                          <span className="font-black text-amber-400 tabular-nums">{cvProj} pts</span>
                        </div>
                      </div>
                    </div>

                    {!isSelected && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (onSelectVariation && !cv.id.startsWith('preset')) onSelectVariation(cv.id);
                          else if (onApplyPreset && presets) {
                            const matchPreset = presets.find(p => p.id === cv.id);
                            if (matchPreset) onApplyPreset(matchPreset);
                          }
                        }}
                        className="w-full text-xs text-amber-400 border border-slate-800 hover:border-amber-400/40 justify-center"
                      >
                        Switch to this Variation
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Dynamic Player Allocation Swing Table */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400">
                    <tr>
                      <th className="py-2.5 px-3 text-start font-bold">Player & Form</th>
                      <th className="py-2.5 px-2 text-start font-bold">Role</th>
                      <th className="py-2.5 px-2 text-start font-bold">Cost</th>
                      <th className="py-2.5 px-2 text-center font-bold">Swing Role</th>
                      {comparisonVariations.map(cv => (
                        <th key={cv.id} className="py-2.5 px-2 text-center font-bold truncate max-w-[120px]">
                          {cv.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {(() => {
                      // Collect all distinct player IDs across the variations
                      const uniquePlayerIds = Array.from(new Set(comparisonVariations.flatMap(cv => cv.playerIds)));
                      const playerRows = uniquePlayerIds.map(pid => {
                        const p = byId.get(pid);
                        const countInTeams = comparisonVariations.filter(cv => cv.playerIds.includes(pid)).length;
                        return { p, pid, countInTeams };
                      }).filter(r => r.p) as { p: PlayerWithForm; pid: string; countInTeams: number }[];

                      // Sort: Core Locks first, then Stars, then highest credits
                      playerRows.sort((a, b) => {
                        if (a.countInTeams !== b.countInTeams) return b.countInTeams - a.countInTeams;
                        const aStar = a.p.form?.tier === 'star' ? 1 : 0;
                        const bStar = b.p.form?.tier === 'star' ? 1 : 0;
                        if (aStar !== bStar) return bStar - aStar;
                        return (b.p.credits || 0) - (a.p.credits || 0);
                      });

                      const totalVars = comparisonVariations.length;

                      return playerRows.map(({ p, pid, countInTeams }) => {
                        const isCoreLock = countInTeams === totalVars;
                        const isDifferential = countInTeams === 1;
                        const isTactical = !isCoreLock && !isDifferential;
                        const tm = teamById(p.teamId);

                        return (
                          <tr key={pid} className="hover:bg-slate-850/60 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <Avatar name={p.name} src={p.photoUrl} size={28} />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-white truncate">{p.name}</span>
                                    {p.form?.tier === 'star' && (
                                      <span className="rounded bg-amber-400/20 px-1 py-0.2 text-[8px] font-black text-amber-300">
                                        ⭐ Star
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                                    <TeamBadge team={tm} size="xs" />
                                    {tm?.short} · {p.form?.matchupNote || 'Sheikh Zayed'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-slate-300 font-semibold whitespace-nowrap">
                              {ROLE_SHORT[p.role]}
                            </td>
                            <td className="py-2.5 px-2 text-slate-200 font-bold tabular-nums whitespace-nowrap">
                              {p.credits} cr
                            </td>
                            <td className="py-2.5 px-2 text-center whitespace-nowrap">
                              {isCoreLock ? (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-300">
                                  🔒 Core Lock ({countInTeams}/{totalVars})
                                </span>
                              ) : isDifferential ? (
                                <span className="inline-flex items-center gap-1 rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-black text-purple-300">
                                  🎯 Differential ({countInTeams}/{totalVars})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-black text-sky-300">
                                  🔄 Tactical ({countInTeams}/{totalVars})
                                </span>
                              )}
                            </td>
                            {comparisonVariations.map(cv => {
                              const inThis = cv.playerIds.includes(pid);
                              const isC = cv.captainId === pid;
                              const isVc = cv.viceCaptainId === pid;

                              return (
                                <td key={cv.id} className="py-2.5 px-2 text-center whitespace-nowrap">
                                  {inThis ? (
                                    isC ? (
                                      <span className="inline-flex items-center gap-0.5 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-slate-950 shadow-sm">
                                        👑 2x C
                                      </span>
                                    ) : isVc ? (
                                      <span className="inline-flex items-center gap-0.5 rounded bg-sky-400 px-1.5 py-0.5 text-[10px] font-black text-slate-950 shadow-sm">
                                        ⭐ 1.5x VC
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-xs">
                                        ✓
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-slate-600 font-mono">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SMART LINEUP VARIATION PRESETS */}
        {activeTab === 'presets' && presets && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-black text-white">Smart Lineup Variation Presets</h4>
              <p className="text-xs text-slate-400">
                Generate different tactical variations for this match in one click. Each variation ensures 3–4 good players are comfortably taken and balanced with smart differentials.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {presets.map(pr => {
                const capPlayer = byId.get(pr.captainId);
                const vcPlayer = byId.get(pr.viceCaptainId);

                return (
                  <div
                    key={pr.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-4 transition-all hover:border-slate-600"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-300">
                          {pr.badge}
                        </span>
                        <span className="text-xs font-black text-slate-300 tabular-nums">
                          {pr.totalCredits} / 100 cr
                        </span>
                      </div>
                      <h5 className="text-sm font-black text-white">{pr.name}</h5>
                      <p className="text-xs font-semibold text-amber-400/90 mb-1">{pr.tagline}</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed mb-3">{pr.description}</p>

                      {/* Captain & VC preview */}
                      <div className="flex items-center gap-3 text-xs bg-slate-950/60 p-2 rounded-lg border border-slate-800 mb-3">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="rounded bg-amber-400 px-1 py-0.2 text-[9px] font-black text-slate-950">C</span>
                          <span className="text-slate-200 truncate font-bold">{capPlayer?.name || pr.captainId}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="rounded bg-sky-400 px-1 py-0.2 text-[9px] font-black text-slate-950">VC</span>
                          <span className="text-slate-200 truncate font-bold">{vcPlayer?.name || pr.viceCaptainId}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold shrink-0">
                          ⭐ {pr.starCount} Stars
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onApplyPreset?.(pr)}
                      className="w-full justify-center"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      Apply This Variation
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

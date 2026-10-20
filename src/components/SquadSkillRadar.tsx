import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  Legend,
} from 'recharts';
import { Activity, Shield, Zap, Target, Sparkles, Award } from 'lucide-react';
import { PlayerWithForm, PlayerRole } from '../types';
import { Card, cx } from './ui';
import { useT } from '../i18n';

interface SquadSkillRadarProps {
  pickedPlayers: PlayerWithForm[];
  captainId: string;
  viceCaptainId: string;
  squadSizeLimit?: number;
  className?: string;
}

interface SkillMetric {
  skill: string;
  squad: number;
  benchmark: number;
  fullMark: number;
  label: string;
  icon: typeof Zap;
  color: string;
  topContributor?: { name: string; score: number; role: PlayerRole } | null;
  assessment: string;
}

export function SquadSkillRadar({
  pickedPlayers,
  captainId,
  viceCaptainId,
  squadSizeLimit = 11,
  className,
}: SquadSkillRadarProps) {
  const t = useT();

  const metrics = useMemo(() => {
    if (pickedPlayers.length === 0) {
      return {
        battingScore: 0,
        bowlingScore: 0,
        fieldingScore: 0,
        topBatter: null,
        topBowler: null,
        topFielder: null,
        overallBalance: 0,
      };
    }

    // Individual player skill rating calculations
    const rated = pickedPlayers.map(p => {
      const isCap = p.id === captainId;
      const isVc = p.id === viceCaptainId;
      const mult = isCap ? 1.35 : isVc ? 1.2 : 1.0;
      const form = p.form;
      const lvl = form?.allocationLevel || (form?.tier === 'star' ? 5 : 3);
      const lvlBonus = lvl === 5 ? 12 : lvl === 4 ? 8 : lvl === 3 ? 4 : 0;
      const formBonus = form?.trend === 'hot' ? 8 : form?.trend === 'rising' ? 4 : form?.trend === 'cold' ? -6 : 0;

      // 1. Batting Skill calculation (0-100)
      let baseBat = 30;
      if (p.role === 'batter') baseBat = 88;
      else if (p.role === 'wicketkeeper') baseBat = 82;
      else if (p.role === 'allrounder') baseBat = 80;
      else if (p.role === 'bowler') baseBat = 28;

      if (p.isIcon) baseBat += 5;
      if (p.battingStyle) baseBat += 3;
      const battingRating = Math.min(100, Math.max(15, Math.round(baseBat + lvlBonus + formBonus)));

      // 2. Bowling Skill calculation (0-100)
      let baseBowl = 15;
      if (p.role === 'bowler') baseBowl = 90;
      else if (p.role === 'allrounder') baseBowl = 78;
      else if (p.role === 'batter') baseBowl = 20;
      else if (p.role === 'wicketkeeper') baseBowl = 5;

      if (p.isIcon && (p.role === 'bowler' || p.role === 'allrounder')) baseBowl += 5;
      if (p.bowlingStyle) baseBowl += 4;
      const bowlingRating = Math.min(100, Math.max(5, Math.round(baseBowl + lvlBonus + formBonus)));

      // 3. Fielding Skill calculation (0-100)
      let baseField = 72;
      if (p.role === 'wicketkeeper' || p.isKeeper) baseField = 95;
      else if (p.role === 'allrounder') baseField = 86;
      else if (p.role === 'batter') baseField = 80;
      else if (p.role === 'bowler') baseField = 72;

      if (p.isIcon) baseField += 3;
      const fieldingRating = Math.min(100, Math.max(40, Math.round(baseField + (lvl >= 4 ? 4 : 0) + (form?.trend === 'hot' ? 5 : 0))));

      return {
        player: p,
        batting: battingRating,
        bowling: bowlingRating,
        fielding: fieldingRating,
        weightedBatting: battingRating * mult,
        weightedBowling: bowlingRating * mult,
        weightedFielding: fieldingRating * mult,
        mult,
      };
    });

    const sumMult = rated.reduce((acc, r) => acc + r.mult, 0);

    // Aggregate team skills with squad completion scaling
    const rawBat = Math.round(rated.reduce((acc, r) => acc + r.weightedBatting, 0) / sumMult);
    const rawBowl = Math.round(rated.reduce((acc, r) => acc + r.weightedBowling, 0) / sumMult);
    const rawField = Math.round(rated.reduce((acc, r) => acc + r.weightedFielding, 0) / sumMult);

    // Factor in squad size coverage (fewer picks have less depth)
    const completionRatio = Math.min(1, pickedPlayers.length / squadSizeLimit);
    const scaleFactor = 0.4 + 0.6 * completionRatio;

    const battingScore = Math.min(99, Math.round(rawBat * scaleFactor));
    const bowlingScore = Math.min(99, Math.round(rawBowl * scaleFactor));
    const fieldingScore = Math.min(99, Math.round(rawField * scaleFactor));

    // Identify top contributors
    const sortedBatters = [...rated].sort((a, b) => b.batting - a.batting);
    const sortedBowlers = [...rated].sort((a, b) => b.bowling - a.bowling);
    const sortedFielders = [...rated].sort((a, b) => b.fielding - a.fielding);

    const topBatter = sortedBatters[0] ? { name: sortedBatters[0].player.name, score: sortedBatters[0].batting, role: sortedBatters[0].player.role } : null;
    const topBowler = sortedBowlers[0] ? { name: sortedBowlers[0].player.name, score: sortedBowlers[0].bowling, role: sortedBowlers[0].player.role } : null;
    const topFielder = sortedFielders[0] ? { name: sortedFielders[0].player.name, score: sortedFielders[0].fielding, role: sortedFielders[0].player.role } : null;

    const overallBalance = Math.round((battingScore + bowlingScore + fieldingScore) / 3);

    return {
      battingScore,
      bowlingScore,
      fieldingScore,
      topBatter,
      topBowler,
      topFielder,
      overallBalance,
    };
  }, [pickedPlayers, captainId, viceCaptainId, squadSizeLimit]);

  // Assessment descriptions
  const getAssessment = (type: 'batting' | 'bowling' | 'fielding', score: number) => {
    if (pickedPlayers.length === 0) return t('Select players to evaluate skill.');
    if (pickedPlayers.length < 3) return t('Partial squad ({n}/{total})', { n: pickedPlayers.length, total: squadSizeLimit });

    if (type === 'batting') {
      if (score >= 85) return t('Explosive Powerplay & death-overs boundary hitters.');
      if (score >= 70) return t('Well-rounded top and middle order scoring strength.');
      return t('Consider adding a specialist batter or all-rounder.');
    }
    if (type === 'bowling') {
      if (score >= 82) return t('High-impact strike attack with death-overs yorkers.');
      if (score >= 68) return t('Solid bowling coverage with spin & pace options.');
      return t('Bowler or all-rounder needed for 10-over containment.');
    }
    if (score >= 88) return t('Elite glovework and athletic boundary ring coverage.');
    if (score >= 75) return t('Dependable catching and run-out threat.');
    return t('Good baseline fielding reflexes across the unit.');
  };

  const chartData: SkillMetric[] = [
    {
      skill: t('Batting'),
      label: t('Batting Firepower'),
      squad: metrics.battingScore,
      benchmark: 78,
      fullMark: 100,
      icon: Zap,
      color: '#f59e0b',
      topContributor: metrics.topBatter,
      assessment: getAssessment('batting', metrics.battingScore),
    },
    {
      skill: t('Bowling'),
      label: t('Bowling Containment'),
      squad: metrics.bowlingScore,
      benchmark: 74,
      fullMark: 100,
      icon: Target,
      color: '#38bdf8',
      topContributor: metrics.topBowler,
      assessment: getAssessment('bowling', metrics.bowlingScore),
    },
    {
      skill: t('Fielding'),
      label: t('Fielding Agility'),
      squad: metrics.fieldingScore,
      benchmark: 80,
      fullMark: 100,
      icon: Shield,
      color: '#10b981',
      topContributor: metrics.topFielder,
      assessment: getAssessment('fielding', metrics.fieldingScore),
    },
  ];

  return (
    <Card className={cx('overflow-hidden border border-slate-800 bg-slate-900/90 shadow-lg', className)}>
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/20 text-amber-400">
              <Activity className="h-4 w-4" />
            </span>
            <h3 className="text-base font-black text-white">
              {t("Squad Skill Radar")}
            </h3>
            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-300">
              {pickedPlayers.length}/{squadSizeLimit} {t('Players')}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {t("Aggregate skill distribution across Batting, Bowling, and Fielding for your 11-player squad.")}
          </p>
        </div>

        {/* Overall balance badge */}
        <div className="flex items-center gap-2 rounded-xl bg-slate-950/80 px-3 py-1.5 border border-slate-800 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <div className="text-start">
            <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">
              {t("Overall Synergy")}
            </span>
            <span className={cx(
              'text-sm font-black tabular-nums',
              metrics.overallBalance >= 75 ? 'text-emerald-400' : metrics.overallBalance >= 50 ? 'text-amber-400' : 'text-slate-400'
            )}>
              {metrics.overallBalance}/100
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 items-center">
        {/* Recharts Radar Chart */}
        <div className="md:col-span-6 flex flex-col items-center justify-center min-h-[260px] bg-slate-950/40 rounded-2xl p-2 border border-slate-800/60">
          <div className="w-full h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="72%" data={chartData}>
                <PolarGrid stroke="#334155" strokeDasharray="3 3" />
                <PolarAngleAxis
                  dataKey="skill"
                  stroke="#cbd5e1"
                  tick={{ fill: '#f1f5f9', fontSize: 12, fontWeight: 700 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  stroke="#475569"
                  tick={{ fill: '#64748b', fontSize: 9 }}
                />
                <Radar
                  name={t("Selected Squad")}
                  dataKey="squad"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.4}
                  strokeWidth={2.5}
                />
                <Radar
                  name={t("Balanced Target")}
                  dataKey="benchmark"
                  stroke="#38bdf8"
                  fill="#38bdf8"
                  fillOpacity={0.12}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as SkillMetric;
                      return (
                        <div className="rounded-xl border border-slate-700 bg-slate-950/95 p-3 text-xs shadow-xl backdrop-blur space-y-1">
                          <p className="font-black text-white">{data.label}</p>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-amber-400 font-bold">{t("Your Squad:")}</span>
                            <span className="font-mono font-black text-amber-300">{data.squad}/100</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sky-400">{t("Target Benchmark:")}</span>
                            <span className="font-mono text-sky-300">{data.benchmark}/100</span>
                          </div>
                          {data.topContributor && (
                            <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                              Top: <strong className="text-white">{data.topContributor.name}</strong> ({data.topContributor.score} pts)
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
                  formatter={(value: string) => <span className="text-slate-300 font-semibold">{value}</span>}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <span className="text-[10px] text-slate-500 font-medium mt-1">
            {t("Interactive Recharts 3-Axis Skill Radar (Batting · Bowling · Fielding)")}
          </span>
        </div>

        {/* Skill Dimension Breakdown Cards */}
        <div className="md:col-span-6 space-y-2.5">
          {chartData.map(m => {
            const Icon = m.icon;
            const diff = m.squad - m.benchmark;
            const isAhead = diff >= 0;

            return (
              <div
                key={m.skill}
                className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-3 transition-colors hover:border-slate-700"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${m.color}20`, color: m.color }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-black text-white">{m.label}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black tabular-nums text-white">
                      {m.squad}<span className="text-[10px] font-normal text-slate-400">/100</span>
                    </span>
                    {pickedPlayers.length > 0 && (
                      <span
                        className={cx(
                          'text-[10px] font-bold px-1.5 py-0.2 rounded font-mono',
                          isAhead ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                        )}
                      >
                        {isAhead ? `+${diff}` : `${diff}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(4, m.squad))}%`,
                      backgroundColor: m.color,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate pr-2">{m.assessment}</span>
                  {m.topContributor && (
                    <span className="text-slate-300 font-semibold shrink-0 inline-flex items-center gap-1 text-[10px]">
                      <Award className="w-3 h-3 text-amber-400" />
                      {m.topContributor.name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

import React, { useMemo } from 'react';
import {
  Ticket,
  Shirt,
  Sparkles,
  Award,
  Crown,
  CheckCircle2,
  Lock,
  Unlock,
  TrendingUp,
  Zap,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import type { PrizeItem, User } from '../types';
import { cx } from './ui';

export interface RewardTier {
  id: string;
  level: number;
  name: string;
  subtitle: string;
  categoryFilter: 'tickets' | 'tshirts' | 'signed' | 'bats' | 'all';
  minPoints: number;
  iconName: 'ticket' | 'shirt' | 'sparkles' | 'award' | 'crown';
  themeColor: string;
  themeGlow: string;
  accentBorder: string;
  description: string;
  keyItems: string[];
}

export const REWARD_TIERS: RewardTier[] = [
  {
    id: 'tier-1',
    level: 1,
    name: 'Matchday Pass',
    subtitle: 'Free Stadium Tickets',
    categoryFilter: 'tickets',
    minPoints: 150,
    iconName: 'ticket',
    themeColor: '#f59e0b', // Amber
    themeGlow: 'rgba(245, 158, 11, 0.25)',
    accentBorder: 'border-amber-400/40',
    description: 'Free stadium entry tickets to every Arabian Aces matchday at Zayed Cricket Stadium, Abu Dhabi.',
    keyItems: [
      'Match 3: vs Tigers (Nov 7)',
      'Match 4: vs Bulls (Nov 8)',
      'Match 9: vs Lions (Nov 10)',
      'Match 18 & 19: Double-Header (Nov 15)',
    ],
  },
  {
    id: 'tier-2',
    level: 2,
    name: 'Supporter Kit',
    subtitle: 'Official Apparel',
    categoryFilter: 'tshirts',
    minPoints: 250,
    iconName: 'shirt',
    themeColor: '#38bdf8', // Sky
    themeGlow: 'rgba(56, 189, 248, 0.25)',
    accentBorder: 'border-sky-400/40',
    description: 'Official 2026 season supporter jersey engineered with breathable performance mesh and team crest.',
    keyItems: [
      'Arabian Aces Official Supporter T-Shirt',
      'Sizes S, M, L, XL, XXL',
      'Franchise Crest Embroidery',
    ],
  },
  {
    id: 'tier-3',
    level: 3,
    name: 'Autographed Edition',
    subtitle: 'Signed T-Shirts',
    categoryFilter: 'signed',
    minPoints: 600,
    iconName: 'sparkles',
    themeColor: '#10b981', // Emerald
    themeGlow: 'rgba(16, 185, 129, 0.25)',
    accentBorder: 'border-emerald-400/40',
    description: 'Authentic franchise jerseys personally hand-signed by world-class cricket superstars with Certificate of Authenticity.',
    keyItems: [
      'Signed T-Shirt by Moeen Ali (Icon & Captain)',
      'Signed T-Shirt by Andre Russell (Dre Russ)',
      'Signed T-Shirt by Liam Livingstone',
    ],
  },
  {
    id: 'tier-4',
    level: 4,
    name: 'Willow Legend',
    subtitle: 'Miniature Signed Bats of International Players',
    categoryFilter: 'bats',
    minPoints: 1000,
    iconName: 'award',
    themeColor: '#a855f7', // Purple
    themeGlow: 'rgba(168, 85, 247, 0.25)',
    accentBorder: 'border-purple-400/40',
    description: 'Miniature display bats, each autographed by an international star, with a Certificate of Authenticity.',
    keyItems: [
      'Miniature Bat Signed by Moeen Ali (1100 pts)',
      'Miniature Bat Signed by Dre Russ (1100 pts)',
      'Miniature Bat Signed by Liam Livingstone (1000 pts)',
    ],
  },
  {
    id: 'tier-5',
    level: 5,
    name: 'Master Collector',
    subtitle: 'Miniature Signed Bat & Jersey Bundles',
    categoryFilter: 'signed',
    minPoints: 1350,
    iconName: 'crown',
    themeColor: '#f43f5e', // Rose
    themeGlow: 'rgba(244, 63, 94, 0.25)',
    accentBorder: 'border-rose-400/40',
    description: 'The top fan reward: a miniature signed bat together with a signed team jersey.',
    keyItems: [
      'Powerhouse Bundle: Miniature Bat + T-Shirt Signed by Dre Russ (1400 pts)',
      'Boundary Hitter Bundle: Miniature Bat + T-Shirt Signed by Liam (1350 pts)',
      'VIP Stadium Lounge Box Presentation',
    ],
  },
];

interface TieredRewardDashboardProps {
  user: User | null;
  balance: number;
  prizes: PrizeItem[];
  selectedCategory: string;
  onSelectCategory: (category: 'all' | 'tickets' | 'tshirts' | 'bats' | 'signed') => void;
  onOpenAuth?: () => void;
}

export const TieredRewardDashboard: React.FC<TieredRewardDashboardProps> = ({
  user,
  balance,
  prizes,
  selectedCategory,
  onSelectCategory,
  onOpenAuth,
}) => {
  // Current user's unlocked tier (highest tier where balance >= minPoints)
  const currentUnlockedTier = useMemo(() => {
    if (!user) return null;
    const unlocked = [...REWARD_TIERS].reverse().find(t => balance >= t.minPoints);
    return unlocked || null;
  }, [user, balance]);

  // Next target milestone (first tier where balance < minPoints)
  const nextMilestone = useMemo(() => {
    if (!user) return REWARD_TIERS[0];
    const target = REWARD_TIERS.find(t => balance < t.minPoints);
    return target || null; // null if all tiers unlocked!
  }, [user, balance]);

  // Points to next milestone
  const pointsNeeded = useMemo(() => {
    if (!nextMilestone) return 0;
    return Math.max(0, nextMilestone.minPoints - balance);
  }, [nextMilestone, balance]);

  // Progress percentage between previous milestone and next milestone
  const milestoneProgressPct = useMemo(() => {
    if (!nextMilestone) return 100;
    const prevMin = currentUnlockedTier ? currentUnlockedTier.minPoints : 0;
    const range = nextMilestone.minPoints - prevMin;
    if (range <= 0) return 100;
    const currentProgress = balance - prevMin;
    return Math.min(100, Math.max(0, Math.round((currentProgress / range) * 100)));
  }, [currentUnlockedTier, nextMilestone, balance]);

  // Overall milestone progress across the entire 0 -> 1500 spectrum
  const overallProgressPct = useMemo(() => {
    const maxMilestone = 1500;
    return Math.min(100, Math.max(0, Math.round((balance / maxMilestone) * 100)));
  }, [balance]);

  // Count items available per tier
  const tierItemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tier of REWARD_TIERS) {
      if (tier.id === 'tier-1') {
        counts[tier.id] = prizes.filter(p => p.title.toLowerCase().includes('ticket')).length;
      } else if (tier.id === 'tier-2') {
        counts[tier.id] = prizes.filter(p => p.title.toLowerCase().includes('t-shirt') && !p.title.toLowerCase().includes('signed')).length;
      } else if (tier.id === 'tier-3') {
        counts[tier.id] = prizes.filter(p => p.title.toLowerCase().includes('signed') && p.title.toLowerCase().includes('t-shirt') && !p.title.toLowerCase().includes('bundle')).length;
      } else if (tier.id === 'tier-4') {
        counts[tier.id] = prizes.filter(p => p.title.toLowerCase().includes('bat') && !p.title.toLowerCase().includes('bundle')).length;
      } else if (tier.id === 'tier-5') {
        counts[tier.id] = prizes.filter(p => p.title.toLowerCase().includes('bundle')).length;
      }
    }
    return counts;
  }, [prizes]);

  const renderTierIcon = (iconName: RewardTier['iconName'], className = 'w-4 h-4') => {
    switch (iconName) {
      case 'ticket':
        return <Ticket className={className} />;
      case 'shirt':
        return <Shirt className={className} />;
      case 'sparkles':
        return <Sparkles className={className} />;
      case 'award':
        return <Award className={className} />;
      case 'crown':
        return <Crown className={className} />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Tier Dashboard Hero Card */}
      <div className="relative rounded-3xl bg-slate-900 border border-slate-800 p-5 sm:p-7 shadow-2xl overflow-hidden">
        {/* Ambient atmospheric glows */}
        <div
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ background: nextMilestone ? nextMilestone.themeColor : '#10b981' }}
        />
        <div
          className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-15"
          style={{ background: '#f59e0b' }}
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: User Tier Status & Milestone Overview */}
          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wide uppercase bg-amber-400/15 border border-amber-400/30 text-amber-300">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                Reward Progression System
              </span>
              {currentUnlockedTier ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <Unlock className="w-3 h-3" /> Tier {currentUnlockedTier.level}: {currentUnlockedTier.name} Unlocked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 border border-slate-700 text-slate-400">
                  <Lock className="w-3 h-3" /> Earning to Tier 1
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-3">
                <img
                  src="/logos/adt10.png"
                  alt="Abu Dhabi T10"
                  className="w-10 h-10 object-contain rounded-xl p-0.5 bg-slate-950 border border-amber-400/40 shadow-md shrink-0"
                />
                <img
                  src="/logos/aces.svg"
                  alt="Arabian Aces"
                  className="w-8 h-8 object-contain shrink-0"
                />
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                    Point Milestones & Reward Tiers
                  </h2>
                  <span className="text-[11px] font-bold text-amber-400">Abu Dhabi T10 Official Fan Rewards</span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xl mt-2 leading-relaxed">
                Earn fan points by playing daily games, picking fantasy lineups, and making match predictions to unlock Free Match Tickets, Official T-Shirts, and Signed Memorabilia.
              </p>
            </div>

            {/* Next Milestone Banner */}
            {user ? (
              nextMilestone ? (
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Next Target Milestone · Tier {nextMilestone.level} ({nextMilestone.name})
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-black text-white flex items-center gap-1.5">
                        <span style={{ color: nextMilestone.themeColor }}>
                          {renderTierIcon(nextMilestone.iconName, 'w-4 h-4')}
                        </span>
                        {nextMilestone.subtitle}
                      </span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-800 text-amber-300">
                        {nextMilestone.minPoints} pts
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <div className="text-right">
                      <span className="block text-xs font-bold text-amber-400 font-mono">
                        {pointsNeeded} pts to go
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        {milestoneProgressPct}% toward unlock
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectCategory(nextMilestone.categoryFilter)}
                      className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      View Items <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                  <Crown className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="text-sm font-black text-emerald-300">All Tiers Unlocked!</h4>
                    <p className="text-xs text-emerald-200/80">
                      You have earned enough points to claim any prize in the catalog, including Master Collector bundles!
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-white block">Sign in to track your reward tier progress</span>
                  <span className="text-[11px] text-slate-400">Earn 10 points daily just by checking in</span>
                </div>
                {onOpenAuth && (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-colors cursor-pointer shrink-0"
                  >
                    Sign In
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: Quick Fan Points Balance Card */}
          <div className="shrink-0 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 min-w-[200px] flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Your Redeemable Balance
              </span>
              <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400 flex items-center gap-1.5 mt-1">
                <Zap className="w-5 h-5 fill-amber-400 text-amber-400" />
                {balance} <span className="text-xs font-sans text-slate-400 font-normal">pts</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
              <div className="flex justify-between items-center text-[11px]">
                <span>Overall Catalog Progress:</span>
                <span className="font-mono font-bold text-white">{overallProgressPct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${overallProgressPct}%`,
                    background: 'linear-gradient(90deg, #f59e0b, #10b981, #f43f5e)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Milestone Progression Stepper Line */}
        <div className="relative z-10 mt-8 pt-6 border-t border-slate-800/80">
          <div className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center justify-between">
            <span>Tier Milestones Timeline</span>
            <span className="text-[11px] text-amber-400 font-bold">150 to 1,500 pts</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {REWARD_TIERS.map((tier) => {
              const isUnlocked = balance >= tier.minPoints;
              const isTarget = nextMilestone?.id === tier.id;
              const isSelected = selectedCategory === tier.categoryFilter;

              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => onSelectCategory(tier.categoryFilter)}
                  className={cx(
                    'p-3 rounded-2xl border text-left transition-all duration-200 relative overflow-hidden group cursor-pointer flex flex-col justify-between',
                    isSelected
                      ? 'bg-slate-800/90 border-amber-400 shadow-lg shadow-amber-400/10'
                      : isUnlocked
                      ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      : isTarget
                      ? 'bg-slate-950/80 border-amber-400/50 hover:border-amber-400'
                      : 'bg-slate-950/40 border-slate-800/60 opacity-80 hover:opacity-100 hover:border-slate-700'
                  )}
                >
                  {/* Top status & point badge */}
                  <div className="flex items-center justify-between gap-1 w-full mb-2">
                    <span
                      className="w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs"
                      style={{
                        backgroundColor: `${tier.themeColor}20`,
                        color: tier.themeColor,
                        border: `1px solid ${tier.themeColor}50`,
                      }}
                    >
                      {renderTierIcon(tier.iconName, 'w-3.5 h-3.5')}
                    </span>

                    <span className="font-mono text-xs font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md">
                      {tier.minPoints}+
                    </span>
                  </div>

                  {/* Tier Names */}
                  <div className="space-y-0.5">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Tier {tier.level}
                    </span>
                    <h4 className="text-xs font-black text-white truncate leading-tight group-hover:text-amber-300 transition-colors">
                      {tier.name}
                    </h4>
                    <span className="block text-[10px] text-slate-400 truncate">
                      {tier.subtitle}
                    </span>
                  </div>

                  {/* Status Indicator */}
                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                    {isUnlocked ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Unlocked
                      </span>
                    ) : isTarget ? (
                      <span className="text-amber-400 font-bold flex items-center gap-1 animate-pulse">
                        <TrendingUp className="w-3 h-3" /> Target
                      </span>
                    ) : (
                      <span className="text-slate-500 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Locked
                      </span>
                    )}

                    <span className="text-slate-400 group-hover:text-amber-300 font-semibold flex items-center">
                      Items →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tier Details Comparison Drawer / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Highlight 1: Free Match Ticket Tier Details */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                <Ticket className="w-3 h-3" /> Tier 1 · 150 pts
              </span>
              <span className="text-[11px] text-slate-400 font-medium">8 Matches Available</span>
            </div>
            <h4 className="text-sm font-black text-white">Free Match Tickets</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Redeem 150 points for general admission tickets to any Arabian Aces match at Zayed Cricket Stadium. Collect at Gate 3 with your claim code.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectCategory('tickets')}
            className="mt-3 text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer self-start"
          >
            Filter Match Tickets ({tierItemCounts['tier-1'] || 8}) <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Highlight 2: Autographed Edition T-Shirts */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md border border-emerald-400/20">
                <Sparkles className="w-3 h-3" /> Tier 3 · 600 pts
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Icon Signed Items</span>
            </div>
            <h4 className="text-sm font-black text-white">Signed Superstar Jerseys</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Official jerseys hand-signed by Moeen Ali, Andre Russell (Dre Russ), and Liam Livingstone with Certificate of Authenticity.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectCategory('signed')}
            className="mt-3 text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer self-start"
          >
            Filter Signed Memorabilia ({tierItemCounts['tier-3'] || 3}) <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Highlight 3: Miniature Signed Bats of International Players */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-md border border-purple-400/20">
                <Award className="w-3 h-3" /> Tier 4 & 5 · 1,000+ pts
              </span>
              <span className="text-[11px] text-slate-400 font-medium">International Icons</span>
            </div>
            <h4 className="text-sm font-black text-white">Miniature Signed Bats of International Players</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Authentic miniature display bats hand-signed by international icons Moeen Ali, Dre Russ, and Liam Livingstone with Certificate of Authenticity.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectCategory('bats')}
            className="mt-3 text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors cursor-pointer self-start"
          >
            Filter Miniature Bats ({tierItemCounts['tier-4'] || 3}) <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

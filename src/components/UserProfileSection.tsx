import React, { useState, useEffect } from 'react';
import { User, Team, AchievementBadge, UserStats } from '../types';
import { api } from '../api';
import { 
  Trophy, 
  Flame, 
  Target, 
  Zap, 
  Award, 
  Eye, 
  Sun, 
  Shield, 
  Crown, 
  Users, 
  Star, 
  Medal, 
  Heart, 
  Gift, 
  Sparkles, 
  CheckCircle2, 
  Lock, 
  ChevronRight, 
  TrendingUp, 
  ArrowUpRight,
  Search,
  Share2,
  Edit3,
  X,
  Check,
  Copy,
  RefreshCw,
  Compass
} from 'lucide-react';

interface UserProfileSectionProps {
  user: User;
  teams: Team[];
  onOpenTeamPicker: () => void;
  onNavigateToTab: (tab: string) => void;
  onUserUpdated: (user: User) => void;
  onDailyCheckin: () => void;
  checkingIn: boolean;
}

const PRESET_AVATARS = [
  { id: 'aces-falcon', name: 'Arabian Falcon', url: 'https://images.unsplash.com/photo-1611689342806-0863700ce1e4?q=80&w=200&auto=format&fit=crop' },
  { id: 'desert-warrior', name: 'Desert Batsman', url: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=200&auto=format&fit=crop' },
  { id: 'vip-owner', name: 'Franchise VIP', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop' },
  { id: 'stadium-lights', name: 'Zayed Floodlights', url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=200&auto=format&fit=crop' },
  { id: 'gold-trophy', name: 'Champion Trophy', url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=200&auto=format&fit=crop' },
  { id: 'speed-ball', name: 'T10 Thunder', url: 'https://images.unsplash.com/photo-1531415074868-036b1c57e350?q=80&w=200&auto=format&fit=crop' },
  { id: 'bot-avatar', name: 'Cyber Tactician', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=ArabianAcesT10' },
  { id: 'gladiator-helm', name: 'Desert Knight', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=AbuDhabiChamps' },
];

export const UserProfileSection: React.FC<UserProfileSectionProps> = ({
  user,
  teams,
  onOpenTeamPicker,
  onNavigateToTab,
  onUserUpdated,
  onDailyCheckin,
  checkingIn
}) => {
  const [badges, setBadges] = useState<AchievementBadge[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'contest' | 'streak' | 'fantasy' | 'loyalty'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unlocked' | 'locked' | 'claimable'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimSuccessMsg, setClaimSuccessMsg] = useState<string | null>(null);

  // Selected Badge Showcase Modal
  const [selectedBadge, setSelectedBadge] = useState<AchievementBadge | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  // Profile Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editAvatar, setEditAvatar] = useState(user.avatar);
  const [savingProfile, setSavingProfile] = useState(false);

  const userTeam = teams.find(t => t.id === user.teamId) || null;

  const loadProfile = async () => {
    try {
      const res = await api.getProfile();
      setBadges(res.badges || []);
      setStats(res.stats || null);
      if (res.user) onUserUpdated(res.user);
    } catch (e) {
      console.error('Failed to load profile badges:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleClaimBadge = async (badge: AchievementBadge) => {
    if (badge.claimed) return;
    setClaimingId(badge.id);
    setClaimSuccessMsg(null);
    try {
      const res = await api.claimBadge(badge.id);
      setClaimSuccessMsg(`🎉 Success! +${res.pointsAdded} Fan Points claimed for "${badge.name}"!`);
      if (res.user) onUserUpdated(res.user);
      await loadProfile();
      if (selectedBadge?.id === badge.id) {
        setSelectedBadge(prev => prev ? { ...prev, claimed: true } : null);
      }
    } catch (e: any) {
      alert(e?.message || 'Reward already claimed or badge not eligible');
    } finally {
      setClaimingId(null);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await api.updateProfile({ name: editName, avatar: editAvatar });
      onUserUpdated(res.user);
      setEditModalOpen(false);
      await loadProfile();
    } catch (e: any) {
      alert(e?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleShareBadge = (badge: AchievementBadge) => {
    const text = `🏆 I just earned the "${badge.name}" (${badge.tier.toUpperCase()} Tier) achievement badge in the Abu Dhabi T10 League! Can you beat my ${user.points} Fan Points?`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 3000);
    } else {
      alert(text);
    }
  };

  // Icon map for achievement badges
  const getBadgeIcon = (iconName: string) => {
    switch (iconName) {
      case 'Target': return Target;
      case 'Zap': return Zap;
      case 'Award': return Award;
      case 'Eye': return Eye;
      case 'Flame': return Flame;
      case 'Sun': return Sun;
      case 'Shield': return Shield;
      case 'Crown': return Crown;
      case 'Users': return Users;
      case 'Star': return Star;
      case 'Trophy': return Trophy;
      case 'Medal': return Medal;
      case 'Heart': return Heart;
      case 'Gift': return Gift;
      default: return Sparkles;
    }
  };

  // Visual tier styling (Metallic borders and glowing highlights)
  const getTierStyle = (tier: string, unlocked: boolean) => {
    if (!unlocked) {
      return {
        bg: 'bg-slate-950/60',
        border: 'border-slate-800/80',
        text: 'text-slate-500',
        badgeChip: 'bg-slate-800/80 text-slate-400 border border-slate-700/50',
        glow: '',
        iconBg: 'bg-slate-900 border-slate-800 text-slate-600',
        ring: 'ring-slate-800',
        label: 'Bronze Tier'
      };
    }

    switch (tier) {
      case 'bronze':
        return {
          bg: 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950',
          border: 'border-amber-700/60 hover:border-amber-600',
          text: 'text-amber-500',
          badgeChip: 'bg-amber-900/30 text-amber-300 border border-amber-700/60',
          glow: 'shadow-lg shadow-amber-900/20',
          iconBg: 'bg-gradient-to-br from-amber-900/40 to-slate-950 border-amber-700/70 text-amber-400',
          ring: 'ring-amber-700/50',
          label: 'Bronze Medal'
        };
      case 'silver':
        return {
          bg: 'bg-gradient-to-br from-slate-800/50 via-slate-900 to-slate-950',
          border: 'border-slate-400/60 hover:border-slate-300',
          text: 'text-slate-200',
          badgeChip: 'bg-slate-300/20 text-slate-100 border border-slate-400/50',
          glow: 'shadow-lg shadow-slate-400/15',
          iconBg: 'bg-gradient-to-br from-slate-700/50 to-slate-950 border-slate-400/70 text-slate-200',
          ring: 'ring-slate-400/50',
          label: 'Silver Medal'
        };
      case 'gold':
        return {
          bg: 'bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950',
          border: 'border-amber-400/70 hover:border-amber-300',
          text: 'text-amber-300',
          badgeChip: 'bg-amber-400/20 text-amber-300 border border-amber-400/60',
          glow: 'shadow-xl shadow-amber-500/20',
          iconBg: 'bg-gradient-to-br from-amber-500/30 to-slate-950 border-amber-400/80 text-amber-300',
          ring: 'ring-amber-400/50',
          label: 'Gold Trophy'
        };
      case 'platinum':
        return {
          bg: 'bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-950',
          border: 'border-cyan-400/70 hover:border-cyan-300',
          text: 'text-cyan-300',
          badgeChip: 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/60',
          glow: 'shadow-xl shadow-cyan-500/25',
          iconBg: 'bg-gradient-to-br from-cyan-900/50 to-slate-950 border-cyan-400/80 text-cyan-300',
          ring: 'ring-cyan-400/50',
          label: 'Platinum Star'
        };
      case 'diamond':
        return {
          bg: 'bg-gradient-to-br from-purple-950/50 via-slate-900 to-slate-950',
          border: 'border-purple-400/80 hover:border-purple-300',
          text: 'text-purple-300',
          badgeChip: 'bg-purple-400/20 text-purple-200 border border-purple-400/60',
          glow: 'shadow-2xl shadow-purple-500/30 ring-1 ring-purple-400/40',
          iconBg: 'bg-gradient-to-br from-purple-900/60 to-slate-950 border-purple-400/90 text-purple-200',
          ring: 'ring-purple-400/60',
          label: 'Diamond Crown'
        };
      default:
        return {
          bg: 'bg-slate-900',
          border: 'border-slate-800',
          text: 'text-amber-400',
          badgeChip: 'bg-slate-800 text-slate-300',
          glow: '',
          iconBg: 'bg-slate-950 border-slate-800 text-slate-400',
          ring: 'ring-slate-800',
          label: 'Official Badge'
        };
    }
  };

  // Filtered badges
  const filteredBadges = badges.filter(b => {
    if (categoryFilter !== 'all' && b.category !== categoryFilter) return false;
    
    if (statusFilter === 'unlocked' && !b.unlocked) return false;
    if (statusFilter === 'locked' && b.unlocked) return false;
    if (statusFilter === 'claimable' && (!b.unlocked || b.claimed)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.requirement.toLowerCase().includes(q) ||
        b.tier.toLowerCase().includes(q)
      );
    }

    return true;
  });

  const unlockedCount = badges.filter(b => b.unlocked).length;
  const totalCount = badges.length;
  const claimableCount = badges.filter(b => b.unlocked && !b.claimed).length;
  const completionRate = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  // Level computation (250 points per level)
  const userLevel = Math.max(1, Math.floor((user.points || 0) / 250) + 1);
  const nextLevelPoints = userLevel * 250;
  const currentLevelProgress = (user.points || 0) % 250;

  const getLevelTitle = (lvl: number) => {
    if (lvl >= 10) return 'Franchise Hall of Famer';
    if (lvl >= 7) return 'Grandmaster Strategist';
    if (lvl >= 5) return 'Master Tactician';
    if (lvl >= 3) return 'Desert Superfan';
    if (lvl >= 2) return 'Rising Contender';
    return 'Rookie Fan';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ============================================================== */}
      {/* 1. HERO PROFILE & LEVEL PROGRESSION CARD */}
      {/* ============================================================== */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-amber-500/30 p-6 sm:p-8 shadow-2xl shadow-amber-500/10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* User Persona & Level */}
          <div className="flex items-center gap-5">
            <div className="relative group cursor-pointer" onClick={() => setEditModalOpen(true)}>
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl ring-4 ring-amber-400/40 group-hover:ring-amber-400 overflow-hidden shadow-2xl bg-slate-800 flex-shrink-0 transition-all">
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] tracking-wider uppercase shadow-md flex items-center gap-1">
                <span>LVL {userLevel}</span>
              </div>
              <div className="absolute inset-0 bg-slate-950/60 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Edit3 className="w-5 h-5 text-amber-400" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {user.name}
                </h1>
                <button
                  onClick={() => setEditModalOpen(true)}
                  className="p-1 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 transition-colors"
                  title="Edit profile & avatar"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-black uppercase tracking-wider">
                  {user.role === 'admin' ? 'Franchise VIP & Admin' : getLevelTitle(userLevel)}
                </span>
              </div>
              <p className="text-xs text-slate-400">{user.email}</p>

              {/* Supported Team Pill & Fan Wars impact */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  onClick={onOpenTeamPicker}
                  className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-400/60 text-xs font-bold transition-colors group"
                >
                  <div
                    className="w-3.5 h-3.5 rounded-full ring-2 ring-slate-800"
                    style={{ backgroundColor: userTeam?.color || '#94A3B8' }}
                  />
                  <span className="text-slate-200 group-hover:text-amber-300">
                    Backed Franchise: <strong>{userTeam ? userTeam.name : 'Choose Franchise'}</strong>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400" />
                </button>

                <button
                  onClick={() => onNavigateToTab('leaderboard')}
                  className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:border-amber-400 text-[11px] font-bold text-amber-300 flex items-center gap-1 transition-colors"
                >
                  <Flame className="w-3 h-3 fill-amber-400" />
                  <span>Fan Wars Standings →</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Streak Claim */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Fan Points</span>
                <span className="text-2xl font-black font-mono text-amber-400">
                  {user.points.toLocaleString()}
                </span>
              </div>
              <div className="h-8 w-px bg-slate-800"></div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Badges Unlocked</span>
                <span className="text-2xl font-black font-mono text-emerald-400">
                  {unlockedCount} <span className="text-xs text-slate-500">/ {totalCount}</span>
                </span>
              </div>
            </div>

            <button
              onClick={onDailyCheckin}
              disabled={checkingIn}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
            >
              <Flame className="w-4 h-4 fill-slate-950" />
              <span>{checkingIn ? 'Checking In...' : `Claim Daily Streak (${user.streak || 1}d)`}</span>
            </button>
          </div>
        </div>

        {/* Level XP Progress Bar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="flex justify-between items-center text-xs mb-1.5 font-bold">
            <span className="text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              Fan Tier Progress: <strong className="text-amber-300">Level {userLevel} · {getLevelTitle(userLevel)}</strong>
            </span>
            <span className="text-slate-400 font-mono">
              {currentLevelProgress} / 250 XP to Level {userLevel + 1}
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.round((currentLevelProgress / 250) * 100))}%` }}
            />
          </div>
        </div>
      </div>

      {claimSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{claimSuccessMsg}</span>
          </div>
          <button onClick={() => setClaimSuccessMsg(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. THREE KEY PERFORMANCE DASHBOARDS */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. Contest Wins & Prediction Accuracy */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-400/40 transition-colors flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Target className="w-4 h-4" /> Contest Performance
              </span>
              <span className="text-[10px] bg-amber-400/10 text-amber-300 px-2 py-0.5 rounded font-bold border border-amber-400/20">
                Predictor IQ
              </span>
            </div>

            <div className="space-y-2.5 my-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Contests Entered:</span>
                <span className="font-mono font-bold text-white">{stats?.contestsEntered || 0}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Contests Won / Scored:</span>
                <span className="font-mono font-bold text-emerald-400">{stats?.contestsWon || 0}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Prediction Accuracy:</span>
                <span className="font-mono font-bold text-amber-300">
                  {stats?.contestsEntered ? Math.round(((stats.contestsWon || 0) / stats.contestsEntered) * 100) : 0}%
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Prediction Points:</span>
                <span className="font-mono font-bold text-amber-400">+{stats?.predictionPoints || 0} pts</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateToTab('contests')}
            className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 text-amber-400 text-xs font-bold rounded-xl border border-slate-800 hover:border-amber-400/40 flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Enter Match Contests</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 2. Daily Check-in Streak Track */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-400/40 transition-colors flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Flame className="w-4 h-4 fill-amber-400 text-amber-400" /> Daily Check-In Streaks
              </span>
              <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-bold border border-red-500/30">
                Active Streak
              </span>
            </div>

            <div className="space-y-2.5 my-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Current Day Streak:</span>
                <span className="font-mono font-black text-amber-400 text-sm flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 fill-amber-400" /> {user.streak || 1} Days
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Highest Streak Record:</span>
                <span className="font-mono font-bold text-white">{stats?.highestStreak || user.streak || 1} Days</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Streak Point Multiplier:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {Math.min(user.streak || 1, 5)}x (+{25 * Math.min(user.streak || 1, 5)} pts/day)
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Next Milestone:</span>
                <span className="font-mono font-bold text-slate-300">
                  {(user.streak || 1) < 3 ? '3 Days (Desert Starter)' : (user.streak || 1) < 7 ? '7 Days (Floodlight)' : (user.streak || 1) < 14 ? '14 Days (Iron Fanatic)' : '30 Days (Season Legend)'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onDailyCheckin}
            disabled={checkingIn}
            className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 text-amber-400 text-xs font-bold rounded-xl border border-slate-800 hover:border-amber-400/40 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <span>{checkingIn ? 'Checking In...' : 'Claim Daily Streak Bonus'}</span>
            <Flame className="w-3.5 h-3.5 fill-amber-400" />
          </button>
        </div>

        {/* 3. Fantasy League Performance */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-400/40 transition-colors flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Trophy className="w-4 h-4" /> Fantasy 10 League
              </span>
              <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-bold border border-cyan-500/30">
                Manager Stats
              </span>
            </div>

            <div className="space-y-2.5 my-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Lineups Created:</span>
                <span className="font-mono font-bold text-white">{stats?.fantasyTeamsCreated || 0}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Best Match Score:</span>
                <span className="font-mono font-bold text-emerald-400">{stats?.fantasyBestScore || 0} pts</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Fantasy Points:</span>
                <span className="font-mono font-bold text-cyan-300">{stats?.fantasyTotalPoints || 0} pts</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Avg Points / Lineup:</span>
                <span className="font-mono font-bold text-slate-300">
                  {stats?.fantasyTeamsCreated ? Math.round((stats.fantasyTotalPoints || 0) / stats.fantasyTeamsCreated) : 0} pts
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateToTab('contests')}
            className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 text-cyan-400 text-xs font-bold rounded-xl border border-slate-800 hover:border-cyan-400/40 flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Build Fantasy 10 Team</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. ACHIEVEMENT BADGES TROPHY CABINET */}
      {/* ============================================================== */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Fan Trophy Room
              </span>
              <span className="text-xs text-slate-400">
                {unlockedCount} of {totalCount} Badges Unlocked ({completionRate}%)
              </span>
              {claimableCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider animate-pulse">
                  {claimableCount} Claimable Bonus!
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Official Abu Dhabi T10 Achievement Badges
            </h2>
            <p className="text-xs text-slate-400">
              Earn metallic tier badges through match prediction accuracy, streak dedication, and fantasy drafting. Click any badge to view lore and rewards.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search badges by title or tier..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
            {[
              { id: 'all', label: 'All Badges' },
              { id: 'contest', label: 'Contest Wins' },
              { id: 'streak', label: 'Check-in Streaks' },
              { id: 'fantasy', label: 'Fantasy 10' },
              { id: 'loyalty', label: 'Franchise Loyalty' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id as any)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                  categoryFilter === cat.id
                    ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold self-end sm:self-auto">
            <span className="text-slate-500 hidden sm:inline mr-1">Status:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'unlocked', label: 'Unlocked' },
              { id: 'claimable', label: 'Claimable' },
              { id: 'locked', label: 'Locked' },
            ].map(st => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id as any)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  statusFilter === st.id
                    ? 'bg-slate-800 text-white font-bold border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Badges Grid */}
        {filteredBadges.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-slate-800 text-slate-400 text-xs">
            No achievement badges match your current filters. Try selecting "All Badges".
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBadges.map(badge => {
              const Icon = getBadgeIcon(badge.icon);
              const style = getTierStyle(badge.tier, badge.unlocked);
              const progressPercent = Math.min(100, Math.round((badge.currentProgress / badge.maxProgress) * 100));

              return (
                <div
                  key={badge.id}
                  onClick={() => setSelectedBadge(badge)}
                  className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between cursor-pointer group hover:scale-[1.02] ${style.bg} ${style.border} ${style.glow}`}
                >
                  <div>
                    {/* Badge Header: Icon + Tier Chip */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner transition-transform group-hover:scale-110 ${style.iconBg}`}>
                        <Icon className="w-6 h-6" />
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${style.badgeChip}`}>
                          {badge.tier}
                        </span>
                        {badge.unlocked ? (
                          badge.claimed ? (
                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-400" /> Claimed
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 animate-pulse">
                              <CheckCircle2 className="w-3 h-3" /> Unlocked!
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Locked
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <h3 className={`font-black text-base tracking-tight mb-1 group-hover:text-amber-300 transition-colors ${badge.unlocked ? 'text-white' : 'text-slate-400'}`}>
                      {badge.name}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                      {badge.description}
                    </p>
                  </div>

                  {/* Progress Bar / Requirement / Claim action */}
                  <div className="pt-3 border-t border-slate-800/60 space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 font-medium">Requirement:</span>
                      <span className="font-semibold text-slate-300 text-right">{badge.requirement}</span>
                    </div>

                    {!badge.unlocked && (
                      <div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1">
                          <span>Progress</span>
                          <span>{badge.currentProgress} / {badge.maxProgress} ({progressPercent}%)</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Unlocked Reward Claim Row */}
                    {badge.unlocked && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] font-mono font-bold text-amber-400">
                          +{badge.rewardPoints} Bonus Pts
                        </span>
                        {badge.claimed ? (
                          <span className="px-2.5 py-1 bg-slate-950 text-slate-400 border border-slate-800 rounded-lg text-[10px] font-bold">
                            Claimed ✓
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClaimBadge(badge);
                            }}
                            disabled={claimingId === badge.id}
                            className="px-2.5 py-1 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 active:scale-95"
                          >
                            {claimingId === badge.id ? 'Claiming...' : 'Claim Pts'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 4. INTERACTIVE BADGE SHOWCASE MODAL */}
      {/* ============================================================== */}
      {selectedBadge && (() => {
        const Icon = getBadgeIcon(selectedBadge.icon);
        const style = getTierStyle(selectedBadge.tier, selectedBadge.unlocked);
        const progressPercent = Math.min(100, Math.round((selectedBadge.currentProgress / selectedBadge.maxProgress) * 100));

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
            <div 
              className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-amber-500/40 p-6 sm:p-8 shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Background ambient glow matching tier */}
              <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 ${
                selectedBadge.tier === 'diamond' ? 'bg-purple-500/20' :
                selectedBadge.tier === 'platinum' ? 'bg-cyan-500/20' :
                selectedBadge.tier === 'gold' ? 'bg-amber-500/20' :
                selectedBadge.tier === 'silver' ? 'bg-slate-300/15' : 'bg-amber-800/20'
              }`} />

              {/* Close Button */}
              <button
                onClick={() => setSelectedBadge(null)}
                className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative z-10 text-center space-y-4">
                {/* Large 3D Metallic Emblem */}
                <div className="mx-auto w-24 h-24 sm:w-28 sm:h-28 rounded-3xl p-1 bg-gradient-to-br from-amber-400/50 via-slate-700 to-slate-950 shadow-2xl flex items-center justify-center">
                  <div className={`w-full h-full rounded-[22px] flex items-center justify-center border shadow-inner ${style.iconBg}`}>
                    <Icon className="w-12 h-12 sm:w-14 sm:h-14" />
                  </div>
                </div>

                {/* Tier & Category Badges */}
                <div className="flex items-center justify-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${style.badgeChip}`}>
                    {selectedBadge.tier} Tier
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-300 text-[11px] font-bold uppercase tracking-wider">
                    {selectedBadge.category} Category
                  </span>
                  {selectedBadge.unlocked ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Unlocked
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[11px] font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  )}
                </div>

                {/* Title & Lore */}
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {selectedBadge.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                    {selectedBadge.description}
                  </p>
                  {selectedBadge.lore && (
                    <p className="text-xs text-amber-300/90 italic mt-2 bg-amber-400/5 p-3 rounded-xl border border-amber-400/20">
                      "{selectedBadge.lore}"
                    </p>
                  )}
                </div>

                {/* Requirement & Live Progress */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-left space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Unlock Condition:</span>
                    <span className="font-bold text-white">{selectedBadge.requirement}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Progress:</span>
                    <span className="font-mono font-bold text-amber-400">
                      {selectedBadge.currentProgress} / {selectedBadge.maxProgress} ({progressPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {selectedBadge.tip && (
                    <p className="text-[11px] text-slate-400 pt-1 flex items-start gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <span>{selectedBadge.tip}</span>
                    </p>
                  )}
                </div>

                {/* Actions & Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  {selectedBadge.unlocked && !selectedBadge.claimed && (
                    <button
                      onClick={() => handleClaimBadge(selectedBadge)}
                      disabled={claimingId === selectedBadge.id}
                      className="w-full sm:flex-1 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      <Sparkles className="w-4 h-4 fill-slate-950" />
                      <span>{claimingId === selectedBadge.id ? 'Claiming...' : `Claim +${selectedBadge.rewardPoints} Bonus Points`}</span>
                    </button>
                  )}

                  {selectedBadge.actionTab && (
                    <button
                      onClick={() => {
                        const tab = selectedBadge.actionTab!;
                        setSelectedBadge(null);
                        onNavigateToTab(tab);
                      }}
                      className="w-full sm:flex-1 py-3 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-xl border border-slate-700 hover:border-amber-400/50 flex items-center justify-center gap-2 transition-colors"
                    >
                      <span>{selectedBadge.actionLabel || 'Take Action'}</span>
                      <ArrowUpRight className="w-4 h-4 text-amber-400" />
                    </button>
                  )}

                  <button
                    onClick={() => handleShareBadge(selectedBadge)}
                    className="w-full sm:w-auto px-4 py-3 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 flex items-center justify-center gap-2 text-xs font-bold transition-colors"
                    title="Copy achievement brag to clipboard"
                  >
                    {copiedShare ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-amber-400" />}
                    <span>{copiedShare ? 'Copied Brag!' : 'Share'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* 5. PROFILE CUSTOMIZER / AVATAR MODAL */}
      {/* ============================================================== */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-amber-500/40 p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                Customize Fan Profile
              </h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Display Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Display Name / Fan Handle</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                maxLength={40}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Preset Avatars */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Choose Fan Avatar</label>
              <div className="grid grid-cols-4 gap-3">
                {PRESET_AVATARS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setEditAvatar(preset.url)}
                    className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-transform hover:scale-105 ${
                      editAvatar === preset.url
                        ? 'border-amber-400 ring-2 ring-amber-400/40'
                        : 'border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                    {editAvatar === preset.url && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Avatar URL option */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400">Or Paste Image URL</label>
              <input
                type="text"
                value={editAvatar}
                onChange={e => setEditAvatar(e.target.value)}
                placeholder="https://..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold border border-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

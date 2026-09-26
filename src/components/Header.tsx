import React from 'react';
import { User, Team } from '../types';
import { getPathForTab } from '../utils/navigation';
import { 
  Trophy, 
  Flame, 
  User as UserIcon, 
  ShieldCheck, 
  LogIn, 
  LogOut, 
  Calendar, 
  Share2, 
  Sparkles, 
  SlidersHorizontal,
  Gift,
  Award,
  MessageSquare,
  FileText,
  Bell,
  MapPin,
  GraduationCap
} from 'lucide-react';

interface HeaderProps {
  user: User | null;
  userTeam: Team | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAuth: () => void;
  onOpenTeamPicker: () => void;
  onOpenAI: () => void;
  onLogout: () => void;
  tickerText?: string;
  onDailyCheckin: () => void;
  checkingIn: boolean;
  onOpenNotifications: () => void;
  unreadNotificationsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  userTeam,
  activeTab,
  setActiveTab,
  onOpenAuth,
  onOpenTeamPicker,
  onOpenAI,
  onLogout,
  tickerText = '⚡ ABU DHABI T10 2026 LIVE · ARABIAN ACES VS DECCAN GLADIATORS · PREDICT & WIN VIP PASSES ⚡',
  onDailyCheckin,
  checkingIn,
  onOpenNotifications,
  unreadNotificationsCount = 0
}) => {
  return (
    <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-amber-500/20">
      {/* Live Ticker Tape */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 font-bold text-xs py-1.5 px-4 overflow-hidden shadow-inner">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-950"></span>
            </span>
            <span className="tracking-wider uppercase font-black text-[11px]">ADT10 LIVE WIRE:</span>
            <span className="marquee font-medium text-slate-900">{tickerText}</span>
          </div>

          <div className="hidden md:flex items-center gap-4 text-[11px] font-bold">
            <span className="flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5" /> 6 FRANCHISES · 90-MIN CRICKET
            </span>
            <span className="bg-slate-950 text-amber-400 px-2 py-0.5 rounded text-[10px] tracking-wide uppercase">
              Zayed Stadium, Abu Dhabi
            </span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <a 
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('home');
          }}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <span className="text-amber-400 font-black text-xl tracking-tighter">T10</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-white group-hover:text-amber-400 transition-colors">
                ABU DHABI <span className="text-amber-400">T10</span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400/10 text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded">
                Fan Hub
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
              Official League & Arabian Aces Curator · Azlir Sport
            </p>
          </div>
        </a>

        {/* Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1 text-sm font-semibold">
          {[
            { id: 'home', label: 'Home', icon: Flame },
            { id: 'matches', label: 'Matches & Live', icon: Calendar },
            { id: 'teams', label: 'Teams & Squads', icon: Trophy },
            { id: 'social', label: 'Social Hub', icon: Share2 },
            { id: 'forum', label: 'Discussion Forum', icon: MessageSquare },
            { id: 'fanspaces', label: 'Fan Spaces', icon: MapPin },
            { id: 'growth', label: 'Youth & Creators', icon: GraduationCap },
            { id: 'contests', label: 'Contests & Fantasy', icon: Sparkles },
            { id: 'draws', label: 'Prize Draws', icon: Gift },
            { id: 'leaderboard', label: 'Fan Wars', icon: Flame },
            ...(user ? [{ id: 'profile', label: 'My Badges', icon: Award }] : []),
            { id: 'proposal', label: 'League Proposal', icon: FileText, highlight: true },
          ].map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <a
                key={item.id}
                href={getPathForTab(item.id)}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(item.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  active 
                    ? 'bg-amber-400/15 text-amber-400 border border-amber-400/30 font-bold' 
                    : item.highlight
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-400/40 hover:bg-amber-500/20 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-amber-400' : item.highlight ? 'text-amber-400' : 'text-slate-400'}`} />
                {item.label}
              </a>
            );
          })}
          <button
            onClick={onOpenAI}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-300 border border-amber-400/40 hover:bg-amber-500/30 font-bold transition-all ml-1 shadow-sm"
            title="Open Gemini AI Chatbot, Search Grounding, Voice & Media Studio"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>AI Studio</span>
          </button>
        </nav>

        {/* Right Section: Team badge, Points, Admin Switcher & User Auth */}
        <div className="flex items-center gap-2.5">
          {/* User Team selection badge */}
          {user && (
            <button
              onClick={onOpenTeamPicker}
              className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-400/50 transition-colors text-xs"
              title="Click to switch supported franchise"
            >
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: userTeam?.color || '#94A3B8' }}
              />
              <span className="font-bold text-slate-200">
                {userTeam ? userTeam.short : 'Pick Team'}
              </span>
            </button>
          )}

          {/* Daily Streak / Check-in */}
          {user && (
            <button
              onClick={onDailyCheckin}
              disabled={checkingIn}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-all"
              title="Claim daily +25 fan points"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>{user.streak || 1}d Streak</span>
              <span className="text-slate-400">·</span>
              <span className="text-amber-300">{user.points || 0} pts</span>
            </button>
          )}

          {/* Real-time Notifications Bell Button */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-400/50 text-slate-300 hover:text-amber-400 transition-colors"
            title="Real-Time Match & Contest Alerts"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-400 text-slate-950 animate-pulse ring-2 ring-slate-950 leading-none">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Admin Portal Button */}
          {user?.role === 'admin' ? (
            <button
              onClick={() => setActiveTab(activeTab === 'admin' ? 'home' : 'admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                activeTab === 'admin'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-amber-500/20'
                  : 'bg-slate-900 border border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Admin Console</span>
            </button>
          ) : (
            /* Quick Access for Admin demo prompt */
            <button
              onClick={onOpenAuth}
              className="hidden xl:flex items-center gap-1 text-[11px] text-amber-400/80 hover:text-amber-300 font-semibold px-2 py-1 rounded hover:bg-amber-400/5 transition-colors"
            >
              <ShieldCheck className="w-3 h-3" />
              <span>Admin Login</span>
            </button>
          )}

          {/* Sign In / User Profile */}
          {user ? (
            <div className="flex items-center gap-2">
              <div 
                onClick={() => setActiveTab('profile')}
                className="w-8 h-8 rounded-full ring-2 ring-amber-400/40 hover:ring-amber-400 overflow-hidden cursor-pointer bg-slate-800 flex items-center justify-center transition-all"
                title={`${user.name} - View Profile & Badges`}
              >
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-900 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 transition-all hover:scale-105 active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Join / Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="lg:hidden border-t border-slate-900 px-4 py-2 flex items-center justify-between gap-1 overflow-x-auto text-xs font-semibold no-scrollbar">
        {[
          { id: 'home', label: 'Home' },
          { id: 'matches', label: 'Matches' },
          { id: 'teams', label: 'Teams' },
          { id: 'social', label: 'Social' },
          { id: 'forum', label: 'Fan Forum' },
          { id: 'fanspaces', label: 'Fan Spaces' },
          { id: 'growth', label: 'Youth & Creators' },
          { id: 'contests', label: 'Contests' },
          { id: 'draws', label: 'Draws' },
          { id: 'leaderboard', label: 'Fan Wars' },
          ...(user ? [{ id: 'profile', label: 'My Badges' }] : []),
          { id: 'proposal', label: 'League Proposal' },
        ].map(item => (
          <a
            key={item.id}
            href={getPathForTab(item.id)}
            onClick={(e) => {
              e.preventDefault();
              setActiveTab(item.id);
            }}
            className={`whitespace-nowrap px-2.5 py-1.5 rounded-md transition-colors ${
              activeTab === item.id 
                ? 'bg-amber-400 text-slate-950 font-bold' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>
    </header>
  );
};

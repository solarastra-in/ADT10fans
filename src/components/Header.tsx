import React from 'react';
import { User, Team } from '../types';
import { getPathForTab } from '../utils/navigation';
import { Flame, LogIn, LogOut, Bell, SlidersHorizontal, Sparkles, User as UserIcon, ExternalLink } from 'lucide-react';
import { ADT10Logo } from './Branding';

interface HeaderProps {
  user: User | null;
  userTeam: Team | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAuth: () => void;
  onOpenTeamPicker: () => void;
  onOpenAI?: () => void;
  /** Show the AI Studio entry (config.features.gemini) */
  aiEnabled?: boolean;
  onLogout: () => void;
  brandName?: string;
  /** '' or undefined hides the ticker */
  tickerText?: string;
  onDailyCheckin: () => void;
  checkingIn: boolean;
  onOpenNotifications: () => void;
  unreadNotificationsCount?: number;
}

const DESKTOP_NAV: { id: string; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'matches', label: 'Matches' },
  { id: 'teams', label: 'Teams' },
  { id: 'social', label: 'Social' },
  { id: 'contests', label: 'Contests' },
  { id: 'draws', label: 'Draws' },
  { id: 'leaderboard', label: 'Fan Wars' },
  { id: 'forum', label: 'Forum' },
  { id: 'fanspaces', label: 'Fan Spaces' },
  { id: 'growth', label: 'Growth' },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';
}

export const Avatar: React.FC<{ user: User; size?: number }> = ({ user, size = 32 }) => {
  const [failed, setFailed] = React.useState(false);
  const showImg = !!user.avatar && !failed;
  return (
    <span
      className="rounded-full ring-2 ring-amber-400/40 overflow-hidden bg-slate-800 flex items-center justify-center shrink-0 text-xs font-black text-amber-300"
      style={{ width: size, height: size }}
    >
      {showImg ? (
        <img
          src={user.avatar}
          alt=""
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(user.name || user.email)
      )}
    </span>
  );
};

export const Header: React.FC<HeaderProps> = ({
  user,
  userTeam,
  activeTab,
  setActiveTab,
  onOpenAuth,
  onOpenTeamPicker,
  onOpenAI,
  aiEnabled = false,
  onLogout,
  brandName = 'ADT10 Fans',
  tickerText,
  onDailyCheckin,
  checkingIn,
  onOpenNotifications,
  unreadNotificationsCount = 0,
}) => {
  const ticker = (tickerText || '').trim();

  const navLink = (id: string, label: string) => {
    const active = activeTab === id;
    return (
      <a
        key={id}
        href={getPathForTab(id)}
        onClick={(e) => {
          e.preventDefault();
          setActiveTab(id);
        }}
        aria-current={active ? 'page' : undefined}
        className={`px-2.5 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
          active ? 'bg-amber-400/15 text-amber-400' : 'text-slate-300 hover:text-white hover:bg-slate-900'
        }`}
      >
        {label}
      </a>
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 pt-safe">
      {ticker && (
        <div className="h-7 bg-amber-500 text-slate-950 text-xs font-bold overflow-hidden flex items-center" aria-label="Announcement">
          <div className="max-w-7xl mx-auto w-full px-4 overflow-hidden whitespace-nowrap">
            <span className="ticker-marquee inline-block">{ticker}</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 lg:h-16 flex items-center justify-between gap-3">
        {/* Brand with official ADT10 logo and Arabian Aces attribution */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('home');
            }}
            className="flex items-center gap-2 select-none"
            aria-label={`${brandName} home`}
          >
            <ADT10Logo size="md" />
            <span className="font-extrabold text-base lg:text-lg tracking-tight text-white hidden sm:inline truncate">{brandName}</span>
          </a>

          <a
            href="https://www.arabianaces.ae"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-[11px] font-bold text-amber-300 hover:bg-amber-400/20 transition-colors"
            title="Brought to you by Arabian Aces franchise"
          >
            <span>Brought to you by <strong className="text-white">Arabian Aces</strong></span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>

        {/* Desktop nav */}
        <nav className="hidden lg:flex flex-1 items-center gap-0.5 min-w-0 overflow-x-auto scrollbar-none" aria-label="Main">
          {DESKTOP_NAV.map((n) => navLink(n.id, n.label))}
          {user && navLink('profile', 'Profile')}
          {user?.role === 'admin' && navLink('proposal', 'Proposal')}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {user && (
            <button
              onClick={onOpenTeamPicker}
              className="hidden sm:flex lg:hidden xl:flex items-center gap-2 h-9 px-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-400/50 transition-colors text-xs"
              title="Choose your franchise"
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: userTeam?.color || '#94A3B8' }} />
              <span className="font-bold text-slate-200">{userTeam ? userTeam.short : 'Pick team'}</span>
            </button>
          )}

          {user && (
            <button
              onClick={onDailyCheckin}
              disabled={checkingIn}
              className="hidden md:flex lg:hidden 2xl:flex items-center gap-1.5 h-9 px-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-colors disabled:opacity-60"
              title="Daily check-in"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>{user.streak || 0}d</span>
              <span className="text-slate-500">·</span>
              <span className="text-amber-300">{user.points || 0} pts</span>
            </button>
          )}

          {aiEnabled && onOpenAI && (
            <button
              onClick={onOpenAI}
              className="hidden lg:flex items-center gap-1.5 h-9 px-3 rounded-lg bg-amber-500/10 border border-amber-400/40 text-amber-300 hover:bg-amber-500/20 text-xs font-bold transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI</span>
            </button>
          )}

          <button
            onClick={onOpenNotifications}
            className="relative w-11 h-11 lg:w-10 lg:h-10 flex items-center justify-center rounded-lg text-slate-300 hover:text-amber-400 hover:bg-slate-900 transition-colors"
            aria-label={unreadNotificationsCount > 0 ? `Notifications, ${unreadNotificationsCount} unread` : 'Notifications'}
          >
            <Bell className="w-5 h-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-black bg-amber-400 text-slate-950 ring-2 ring-slate-950 leading-[18px] text-center">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>

          {user?.role === 'admin' && (
            <button
              onClick={() => setActiveTab(activeTab === 'admin' ? 'home' : 'admin')}
              className={`hidden lg:flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'admin'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-900 border border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          )}

          {user ? (
            <>
              <button
                onClick={() => setActiveTab('profile')}
                className="w-11 h-11 lg:w-10 lg:h-10 flex items-center justify-center rounded-full"
                aria-label={`${user.name} — profile`}
              >
                <Avatar user={user} />
              </button>
              <button
                onClick={onLogout}
                className="hidden lg:flex w-10 h-10 items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-900 transition-colors"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 h-10 px-3.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm transition-colors"
            >
              <LogIn className="w-4 h-4 hidden sm:block" />
              <UserIcon className="w-4 h-4 sm:hidden" />
              <span>Sign in</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

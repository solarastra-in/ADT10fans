import React, { useState } from 'react';
import { 
  Flame, 
  Calendar, 
  Trophy, 
  Share2, 
  Sparkles, 
  Grid, 
  X, 
  MessageSquare, 
  Gift, 
  Award, 
  FileText, 
  SlidersHorizontal, 
  ShieldCheck, 
  User as UserIcon,
  ChevronRight,
  MapPin,
  GraduationCap
} from 'lucide-react';
import { User, Team } from '../types';

interface MobileBottomNavProps {
  activeTab: string;
  onNavigate: (tab: string, param?: string | null) => void;
  user: User | null;
  userTeam: Team | null;
  onOpenAuth: () => void;
  onOpenAI: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onNavigate,
  user,
  userTeam,
  onOpenAuth,
  onOpenAI
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);

  const mainTabs = [
    { id: 'home', label: 'Home', icon: Flame, path: '/' },
    { id: 'matches', label: 'Matches', icon: Calendar, path: '/matches' },
    { id: 'teams', label: 'Teams', icon: Trophy, path: '/teams' },
    { id: 'social', label: 'Social', icon: Share2, path: '/social' },
    { id: 'contests', label: 'Contests', icon: Sparkles, path: '/contests' },
  ];

  const handleTabClick = (tabId: string) => {
    onNavigate(tabId);
    setSheetOpen(false);
  };

  const isMoreActive = ['forum', 'fanspaces', 'growth', 'draws', 'leaderboard', 'proposal', 'profile', 'admin'].includes(activeTab);

  return (
    <>
      {/* Slide-up Bottom Drawer / Sheet for secondary pages */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity animate-fade-in"
            onClick={() => setSheetOpen(false)}
          />

          {/* Drawer Sheet */}
          <div className="fixed inset-x-0 bottom-0 max-h-[88vh] bg-slate-900 border-t border-amber-500/30 rounded-t-3xl shadow-2xl p-5 pb-8 overflow-y-auto animate-slide-up z-10 flex flex-col justify-between">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center font-black text-xs">
                    T10
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">All Platform Pages</h3>
                    <p className="text-[10px] text-slate-400">Abu Dhabi T10 · Azlir Sport</p>
                  </div>
                </div>
                <button
                  onClick={() => setSheetOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Grid of extra pages */}
              <div className="grid grid-cols-2 gap-2.5 mb-5">
                <button
                  onClick={() => handleTabClick('forum')}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                    activeTab === 'forum'
                      ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <MessageSquare className="w-5 h-5 text-amber-400" />
                    <span className="text-[9px] font-bold uppercase text-amber-400/80">Active</span>
                  </div>
                  <span className="font-bold text-xs">Discussion Forum</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Fan match debates</span>
                </button>

                <button
                  onClick={() => handleTabClick('fanspaces')}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                    activeTab === 'fanspaces'
                      ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <MapPin className="w-5 h-5 text-amber-400" />
                    <span className="text-[9px] font-bold uppercase text-emerald-400">5 Cities</span>
                  </div>
                  <span className="font-bold text-xs">Global Fan Spaces</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">VIP Clubhouses & Lounges</span>
                </button>

                <button
                  onClick={() => handleTabClick('growth')}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                    activeTab === 'growth'
                      ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <GraduationCap className="w-5 h-5 text-amber-400" />
                    <span className="text-[9px] font-bold uppercase text-amber-400/80">Live</span>
                  </div>
                  <span className="font-bold text-xs">Youth & Creators</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Grassroots Cup & Audio</span>
                </button>

                <button
                  onClick={() => handleTabClick('draws')}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                    activeTab === 'draws'
                      ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Gift className="w-5 h-5 text-amber-400" />
                    <span className="text-[9px] font-bold uppercase text-amber-300">Free</span>
                  </div>
                  <span className="font-bold text-xs">Prize Draws</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Win VIP Final passes</span>
                </button>

                <button
                  onClick={() => handleTabClick('leaderboard')}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                    activeTab === 'leaderboard'
                      ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Flame className="w-5 h-5 text-amber-400" />
                    <span className="text-[9px] font-bold uppercase text-amber-400/80">Live</span>
                  </div>
                  <span className="font-bold text-xs">Fan Wars</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Franchise standings</span>
                </button>

                <button
                  onClick={() => handleTabClick('proposal')}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                    activeTab === 'proposal'
                      ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                      : 'bg-gradient-to-br from-amber-500/10 to-slate-950 border-amber-500/30 text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <FileText className="w-5 h-5 text-amber-400" />
                    <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/20 px-1 rounded">+108% ROI</span>
                  </div>
                  <span className="font-bold text-xs">League Proposal</span>
                  <span className="text-[10px] text-slate-300 mt-0.5">Board & Fan Spaces</span>
                </button>
              </div>

              {/* Extra user and utility items */}
              <div className="space-y-2 mb-4">
                {user ? (
                  <button
                    onClick={() => handleTabClick('profile')}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-400/40 text-left transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover ring-1 ring-amber-400/50" />
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{user.name}</span>
                          <span className="text-[10px] text-amber-400 font-semibold">({user.points || 0} pts)</span>
                        </div>
                        <p className="text-[10px] text-slate-400">View Trophy Room & Badges</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSheetOpen(false);
                      onOpenAuth();
                    }}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                  >
                    <UserIcon className="w-4 h-4" />
                    <span>Sign In / Join Fan Arena</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setSheetOpen(false);
                    onOpenAI();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-400/30 text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="text-xs font-bold text-amber-300">Gemini AI Studio</span>
                      <p className="text-[10px] text-slate-400">Tactics chatbot, voice & video</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">Launch</span>
                </button>

                {user?.role === 'admin' && (
                  <button
                    onClick={() => handleTabClick('admin')}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-amber-500/40 text-left text-amber-400 font-bold text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <SlidersHorizontal className="w-4 h-4" />
                      <span>Admin Management Console</span>
                    </div>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Azlir Sport Copyright in Mobile Drawer */}
            <div className="pt-3 border-t border-slate-800/80 text-center">
              <p className="text-[11px] font-semibold text-slate-400">
                Copyright by Azlir Sport © 2026. All rights reserved.
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Abu Dhabi T10 Fan Hub · Official Franchise Platform
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Bottom Bar */}
      <nav 
        className="fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-amber-500/20 lg:hidden shadow-2xl safe-area-bottom"
        aria-label="Mobile Navigation"
      >
        <div className="grid grid-cols-6 items-center h-16 px-1 max-w-lg mx-auto">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <a
                key={tab.id}
                href={tab.path}
                onClick={(e) => {
                  e.preventDefault();
                  handleTabClick(tab.id);
                }}
                className={`flex flex-col items-center justify-center h-full relative transition-all py-1 ${
                  active ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {active && (
                  <span className="absolute top-0 inset-x-2 h-0.5 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                )}
                <div className={`p-1 rounded-xl transition-transform ${active ? 'scale-110' : ''}`}>
                  <Icon className={`w-5 h-5 ${active ? 'text-amber-400' : 'text-slate-400'}`} />
                </div>
                <span className={`text-[10px] font-bold tracking-tight truncate max-w-[54px] text-center ${
                  active ? 'text-amber-300 font-extrabold' : 'text-slate-400'
                }`}>
                  {tab.label}
                </span>
              </a>
            );
          })}

          {/* More Button */}
          <button
            onClick={() => setSheetOpen(true)}
            className={`flex flex-col items-center justify-center h-full relative transition-all py-1 ${
              isMoreActive ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
            aria-label="Open more pages menu"
          >
            {isMoreActive && (
              <span className="absolute top-0 inset-x-2 h-0.5 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            )}
            <div className={`p-1 rounded-xl transition-transform relative ${isMoreActive ? 'scale-110' : ''}`}>
              <Grid className={`w-5 h-5 ${isMoreActive ? 'text-amber-400' : 'text-slate-400'}`} />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-1 right-1" />
            </div>
            <span className={`text-[10px] font-bold tracking-tight ${
              isMoreActive ? 'text-amber-300 font-extrabold' : 'text-slate-400'
            }`}>
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};

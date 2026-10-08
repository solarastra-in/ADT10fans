import React from 'react';
import { Team, SocialHandle, FeedItem, User, Match } from '../types';
import { X, ExternalLink, Shield, Trophy, Users, Flame, CheckCircle, Sparkles, TrendingUp } from 'lucide-react';
import { SocialCuratorWall } from './SocialCuratorWall';
import { TeamWinLossGraph } from './TeamWinLossGraph';

interface TeamDetailModalProps {
  team: Team | null;
  onClose: () => void;
  handles: SocialHandle[];
  feedItems: FeedItem[];
  user: User | null;
  onSelectTeam: (teamId: string) => void;
  teams: Team[];
  matches?: Match[];
}

export const TeamDetailModal: React.FC<TeamDetailModalProps> = ({
  team,
  onClose,
  handles,
  feedItems,
  user,
  onSelectTeam,
  teams,
  matches = []
}) => {
  if (!team) return null;

  const teamHandles = handles.filter(h => h.teamId === team.id);
  const isUserTeam = user?.teamId === team.id;
  const isAces = team.id === 'aces';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-amber-500/30 rounded-3xl p-4 sm:p-8 shadow-2xl shadow-amber-500/10 text-slate-100 my-4 sm:my-8 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Team Banner Header */}
        <div 
          className="relative rounded-2xl p-4 sm:p-8 mb-6 sm:mb-8 overflow-hidden border border-white/10"
          style={{ 
            background: `linear-gradient(135deg, ${team.color}25 0%, #0F172A 70%, #020617 100%)` 
          }}
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4 sm:gap-6">
              <div 
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center font-black text-2xl sm:text-3xl text-white shadow-xl shadow-black/40 ring-4 ring-white/10"
                style={{ backgroundColor: team.color }}
              >
                {team.short}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest">
                    Abu Dhabi T10 Franchise
                  </span>
                  {isAces && (
                    <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Franchise Focus
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                  {team.name}
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 flex items-center gap-3">
                  <span>Home: <strong>{team.home}</strong></span>
                  <span>·</span>
                  <span>Icon: <strong className="text-amber-300">{team.iconPlayer}</strong></span>
                  {team.headCoach && (
                    <>
                      <span>·</span>
                      <span>Coach: <strong>{team.headCoach}</strong></span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={() => onSelectTeam(team.id)}
                className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
                  isUserTeam
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-amber-500/25 active:scale-95'
                }`}
              >
                {isUserTeam ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Your Backed Team</span>
                  </>
                ) : (
                  <>
                    <Flame className="w-4 h-4" />
                    <span>Back in Fan Wars</span>
                  </>
                )}
              </button>

              {team.website && (
                <a
                  href={team.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Official Website</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Official Social Media Channels (Verified Links) */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Official Social Media Directory
            </h3>
            <span className="text-xs text-slate-400">All channels verified</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {teamHandles.map((h) => (
              <a
                key={h.id}
                href={h.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-amber-400 hover:bg-slate-800/60 transition-all flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-amber-400">{h.platform}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 transition-colors" />
                </div>
                <div className="text-[11px] font-semibold text-slate-300 truncate group-hover:text-white">
                  {h.handle}
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Recharts-Based Win/Loss Trend Graph */}
        <div className="mb-8">
          <TeamWinLossGraph
            team={team}
            matches={matches}
            teams={teams}
          />
        </div>

        {/* Squad Roster */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Users className="w-4 h-4" /> 2026 Season Squad & Credits
            </h3>
            <span className="text-xs text-slate-400">{team.squad.length} Players</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {team.squad.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-white">{p.name}</span>
                    {p.isIcon && (
                      <span className="text-[9px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1 rounded font-black">
                        ICON
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 capitalize">{p.role}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-amber-400">{p.credits}</span>
                  <span className="text-[10px] text-slate-400 block">cr</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team-Specific Curated Social Feed with Dynamic Team Theme */}
        <div className="pt-6 border-t border-slate-800">
          <SocialCuratorWall
            feedItems={feedItems}
            teams={teams}
            handles={handles}
            selectedTeamId={team.id}
            userTeamId={user?.teamId}
            onOpenTeamPicker={() => onSelectTeam(team.id)}
            title={`${team.name} Live Social Feed`}
            subtitle={`Curating the top 5 updates from ${team.name} official channels`}
            limitPerPlatform={5}
          />
        </div>
      </div>
    </div>
  );
};

interface TeamsViewProps {
  teams: Team[];
  handles: SocialHandle[];
  feedItems: FeedItem[];
  user: User | null;
  onSelectTeam: (teamId: string) => void;
  selectedTeamId?: string | null;
  onNavigateTeam?: (teamId: string | null) => void;
  matches?: Match[];
}

export const TeamsView: React.FC<TeamsViewProps> = ({
  teams,
  handles,
  feedItems,
  user,
  onSelectTeam,
  selectedTeamId,
  onNavigateTeam,
  matches = []
}) => {
  const [selectedTeamModal, setSelectedTeamModal] = React.useState<Team | null>(null);

  // If a specific team is selected via URL route (/teams/:teamId), render dedicated franchise page!
  const dedicatedTeam = selectedTeamId ? teams.find(t => t.id.toLowerCase() === selectedTeamId.toLowerCase()) : null;

  if (dedicatedTeam) {
    const teamHandles = handles.filter(h => h.teamId === dedicatedTeam.id);
    const isUserTeam = user?.teamId === dedicatedTeam.id;
    const isAces = dedicatedTeam.id === 'aces';

    return (
      <div className="space-y-6">
        {/* Breadcrumb Navigation for SEO & Users */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <a 
            href="/" 
            onClick={(e) => {
              e.preventDefault();
              onNavigateTeam?.(null);
            }} 
            className="hover:text-amber-400 transition-colors"
          >
            Home
          </a>
          <span>/</span>
          <a 
            href="/teams" 
            onClick={(e) => {
              e.preventDefault();
              onNavigateTeam?.(null);
            }} 
            className="hover:text-amber-400 transition-colors"
          >
            Franchises
          </a>
          <span>/</span>
          <span className="text-amber-400 font-bold">{dedicatedTeam.name}</span>
        </nav>

        {/* Dedicated Franchise Hero Banner */}
        <div 
          className="relative rounded-3xl p-6 sm:p-10 overflow-hidden border border-white/10 shadow-2xl"
          style={{ 
            background: `linear-gradient(135deg, ${dedicatedTeam.color}35 0%, #0F172A 70%, #020617 100%)` 
          }}
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              <div 
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center font-black text-3xl sm:text-4xl text-white shadow-2xl shadow-black/50 ring-4 ring-white/10 shrink-0"
                style={{ backgroundColor: dedicatedTeam.color }}
              >
                {dedicatedTeam.short}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
                    Abu Dhabi T10 Franchise
                  </span>
                  {isAces && (
                    <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow">
                      ★ Franchise Focus
                    </span>
                  )}
                  <span className="text-[10px] bg-slate-900/80 text-slate-300 font-bold px-2 py-0.5 rounded border border-slate-700">
                    Season 2026
                  </span>
                </div>
                <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                  {dedicatedTeam.name}
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Home: <strong className="text-white">{dedicatedTeam.home}</strong></span>
                  <span>·</span>
                  <span>Icon: <strong className="text-amber-300">{dedicatedTeam.iconPlayer}</strong></span>
                  {dedicatedTeam.headCoach && (
                    <>
                      <span>·</span>
                      <span>Coach: <strong className="text-white">{dedicatedTeam.headCoach}</strong></span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={() => onSelectTeam(dedicatedTeam.id)}
                className={`px-5 py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
                  isUserTeam
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-amber-500/25 active:scale-95'
                }`}
              >
                {isUserTeam ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Your Backed Team</span>
                  </>
                ) : (
                  <>
                    <Flame className="w-4 h-4" />
                    <span>Back in Fan Wars</span>
                  </>
                )}
              </button>

              <button
                onClick={() => onNavigateTeam?.(null)}
                className="px-4 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>← All Franchises</span>
              </button>
            </div>
          </div>
        </div>

        {/* Official Social Media Directory */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Official Social Channels & Handles
            </h2>
            <span className="text-xs text-slate-400">All channels verified authentic</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {teamHandles.map((h) => (
              <a
                key={h.id}
                href={h.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-amber-400 hover:bg-slate-800/80 transition-all flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-amber-400">{h.platform}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 transition-colors" />
                </div>
                <div className="text-xs font-semibold text-slate-300 truncate group-hover:text-white">
                  {h.handle}
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Franchise Win/Loss Trend Graph */}
        <TeamWinLossGraph
          team={dedicatedTeam}
          matches={matches}
          teams={teams}
        />

        {/* Squad Roster */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Users className="w-4 h-4" /> 2026 Season Official Squad Roster
            </h2>
            <span className="text-xs text-slate-400 font-semibold">{dedicatedTeam.squad.length} Players Registered</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {dedicatedTeam.squad.map((p) => (
              <div
                key={p.id}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-amber-400/40 transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs sm:text-sm text-white">{p.name}</span>
                    {p.isIcon && (
                      <span className="text-[9px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1 rounded font-black">
                        ICON
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 capitalize">{p.role}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono font-bold text-amber-400">{p.credits}</span>
                  <span className="text-[10px] text-slate-400 block">cr</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Curated Feed for this Franchise */}
        <div className="pt-2">
          <SocialCuratorWall
            feedItems={feedItems}
            teams={teams}
            handles={handles}
            selectedTeamId={dedicatedTeam.id}
            userTeamId={user?.teamId}
            onOpenTeamPicker={() => onSelectTeam(dedicatedTeam.id)}
            title={`${dedicatedTeam.name} Official Live Feeds`}
            subtitle={`Curating top updates, YouTube streams, and verified announcements from ${dedicatedTeam.name}`}
            limitPerPlatform={5}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400">
              Abu Dhabi T10 League 2026 Franchises
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Cricbuzz Series 13307 Verified
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Teams & Official Squad Rosters
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Browse all 6 official Abu Dhabi T10 League franchises with confirmed icon stars, direct platinum signings, draft acquisitions, and verified social media channels.
          </p>
        </div>
        <a
          href="https://www.cricbuzz.com/cricket-series/13307/abu-dhabi-t10-league-2026/squads"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/50 text-slate-300 hover:text-amber-300 text-xs font-semibold rounded-xl transition-colors self-start md:self-end"
        >
          <span>View on Cricbuzz</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Grid of Teams */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {teams.map((t) => {
          const isAces = t.id === 'aces';
          const teamHandles = handles.filter(h => h.teamId === t.id);

          return (
            <a
              key={t.id}
              href={`/teams/${t.id}`}
              onClick={(e) => {
                e.preventDefault();
                if (onNavigateTeam) {
                  onNavigateTeam(t.id);
                } else {
                  setSelectedTeamModal(t);
                }
              }}
              className={`group relative rounded-2xl p-5 border cursor-pointer transition-all duration-300 flex flex-col justify-between ${
                isAces
                  ? 'bg-gradient-to-b from-amber-500/15 to-slate-900 border-amber-400/50 shadow-xl shadow-amber-500/10 hover:border-amber-400 hover:scale-[1.02]'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900 hover:scale-[1.01]'
              }`}
            >
              {isAces && (
                <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow-md">
                  ★ Franchise Focus
                </div>
              )}

              <div>
                {/* Header */}
                <div className="flex items-center gap-3.5 mb-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-md ring-2 ring-white/10"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.short}
                  </div>
                  <div>
                    <h2 className="font-extrabold text-lg text-white group-hover:text-amber-300 transition-colors">
                      {t.name}
                    </h2>
                    <p className="text-xs text-slate-400">{t.home}</p>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-1.5 mb-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Icon Star:</span>
                    <strong className="text-amber-300 font-semibold">{t.iconPlayer}</strong>
                  </div>
                  {t.headCoach && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Head Coach:</span>
                      <strong className="text-slate-200 font-semibold">{t.headCoach}</strong>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">Squad Size:</span>
                    <strong className="text-slate-200 font-semibold">{t.squad.length} Players</strong>
                  </div>
                </div>

                {/* Handles preview */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {teamHandles.map((h) => (
                    <span
                      key={h.id}
                      className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-bold text-slate-300"
                    >
                      {h.platform}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action link */}
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                  <span>Win/Loss Trend & Squad</span>
                </span>
                <span className="text-amber-400 font-bold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                  Explore →
                </span>
              </div>
            </a>
          );
        })}
      </div>

      {/* Fallback Modal */}
      <TeamDetailModal
        team={selectedTeamModal}
        onClose={() => setSelectedTeamModal(null)}
        handles={handles}
        feedItems={feedItems}
        user={user}
        onSelectTeam={onSelectTeam}
        teams={teams}
        matches={matches}
      />
    </div>
  );
};

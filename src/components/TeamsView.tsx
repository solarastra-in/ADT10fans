import React, { useState, useMemo } from 'react';
import { Team, SocialHandle, FeedItem, User, Match, Player } from '../types';
import { X, ExternalLink, Shield, Trophy, Users, Flame, CheckCircle, Sparkles, TrendingUp, Search, Award, Activity, BarChart2 } from 'lucide-react';
import { SocialCuratorWall } from './SocialCuratorWall';
import { TeamWinLossGraph } from './TeamWinLossGraph';

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Player Detail Modal with Full Cricbuzz Career Stats */
const PlayerDetailModal: React.FC<{
  player: Player | null;
  team: Team;
  onClose: () => void;
}> = ({ player, team, onClose }) => {
  if (!player) return null;

  const photo = player.photoUrl || (player.imageId ? `https://static.cricbuzz.com/a/img/v1/i1/c${player.imageId}/i.jpg` : null);
  const cricbuzzUrl = player.cricbuzzProfileUrl || (player.cricbuzzId ? `https://www.cricbuzz.com/profiles/${player.cricbuzzId}/${slug(player.name)}` : null);
  const initials = player.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const stats = player.stats;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-slate-900 border border-amber-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-amber-500/10 text-slate-100 max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Player Profile Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="relative shrink-0">
            {photo ? (
              <img
                src={photo}
                alt={player.name}
                className="w-20 h-20 rounded-2xl object-cover bg-slate-800 border-2 border-amber-400/40 shadow-lg shadow-black/40"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div 
                className="w-20 h-20 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-lg border-2 border-white/20"
                style={{ backgroundColor: team.color }}
              >
                {initials}
              </div>
            )}
            {player.isIcon && (
              <span className="absolute -bottom-2 -right-1 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black uppercase tracking-wider shadow">
                ICON
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: team.color }}>
                {team.short}
              </span>
              {player.isCaptain && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/40">
                  CAPTAIN
                </span>
              )}
              {player.isKeeper && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-400/20 text-emerald-300 border border-emerald-400/40">
                  WICKETKEEPER
                </span>
              )}
            </div>
            <h3 className="text-xl font-black text-white">{player.name}</h3>
            <p className="text-xs font-semibold text-amber-400 capitalize">
              {player.cricbuzzRole || player.role}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 flex-wrap">
              {player.battingStyle && <span>Bat: {player.battingStyle}</span>}
              {player.bowlingStyle && (
                <>
                  <span>•</span>
                  <span>Bowl: {player.bowlingStyle}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Career Stats Grid (No amounts, real verified cricket statistics) */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-amber-400" /> Career T20 & Franchise Statistics
            </h4>
            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
              <CheckCircle className="w-2.5 h-2.5" /> Cricbuzz Verified
            </span>
          </div>

          {stats ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold">Matches</span>
                <strong className="text-base font-black text-white">{stats.matches}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold">Innings</span>
                <strong className="text-base font-black text-white">{stats.innings ?? '-'}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold">Total Runs</span>
                <strong className="text-base font-black text-amber-300">{stats.runs?.toLocaleString() ?? 0}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold">Highest Score</span>
                <strong className="text-base font-black text-white">{stats.highestScore || '-'}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold">Strike Rate</span>
                <strong className="text-base font-black text-cyan-300">
                  {stats.strikeRate ? stats.strikeRate.toFixed(1) : '-'}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold">Batting Avg</span>
                <strong className="text-base font-black text-white">
                  {stats.average ? stats.average.toFixed(2) : '-'}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold">Wickets</span>
                <strong className="text-base font-black text-amber-300">{stats.wickets ?? 0}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold">Economy</span>
                <strong className="text-base font-black text-white">
                  {stats.economy ? stats.economy.toFixed(2) : '-'}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold">Best Bowling</span>
                <strong className="text-base font-black text-white">{stats.bestBowling || '-'}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold">50s / 100s</span>
                <strong className="text-xs font-bold text-slate-200">
                  {stats.fifties ?? 0} / {stats.hundreds ?? 0}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold">Fours</span>
                <strong className="text-xs font-bold text-slate-200">{stats.fours ?? 0}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold">Sixes</span>
                <strong className="text-xs font-bold text-slate-200">{stats.sixes ?? 0}</strong>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-950/50 rounded-xl">
              Career statistics syncing for this player.
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
          {cricbuzzUrl && (
            <a
              href={cricbuzzUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-semibold transition-colors"
            >
              <span>View Profile on Cricbuzz</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold ml-auto transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/** Reusable Squad Roster with Filtering, Player Cards, Real Stats and No Amounts */
const SquadRosterSection: React.FC<{
  squad: Player[];
  team: Team;
  title?: string;
}> = ({ squad, team, title = '2026 Season Official Squad Roster' }) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'batter' | 'allrounder' | 'bowler' | 'wicketkeeper'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectingPlayer, setInspectingPlayer] = useState<Player | null>(null);

  const filteredSquad = useMemo(() => {
    return squad.filter(p => {
      const matchesFilter = activeFilter === 'all' || p.role === activeFilter;
      const matchesSearch = !searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      return matchesFilter && matchesSearch;
    });
  }, [squad, activeFilter, searchQuery]);

  return (
    <div>
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <Users className="w-4 h-4" /> {title}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Confirmed 18-player franchise roster matching Cricbuzz series 13307 registration. Click any player for full career stats.
          </p>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 self-start sm:self-auto">
          {squad.length} Players
        </span>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {(
            [
              { id: 'all', label: `All (${squad.length})` },
              { id: 'batter', label: 'Batters' },
              { id: 'allrounder', label: 'All-Rounders' },
              { id: 'bowler', label: 'Bowlers' },
              { id: 'wicketkeeper', label: 'Wicketkeepers' },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeFilter === tab.id
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-56">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search squad player..."
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/50"
          />
        </div>
      </div>

      {/* Player Cards Grid (NO AMOUNTS OR CREDITS - ONLY VERIFIED CRICKET STATS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredSquad.map((p) => {
          const photo = p.photoUrl || (p.imageId ? `https://static.cricbuzz.com/a/img/v1/i1/c${p.imageId}/i.jpg` : null);
          const initials = p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
          const stats = p.stats;
          const isBowler = p.role === 'bowler';
          const isAllrounder = p.role === 'allrounder';

          return (
            <div
              key={p.id}
              onClick={() => setInspectingPlayer(p)}
              className="group p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-amber-400/40 hover:bg-slate-950 transition-all cursor-pointer flex flex-col justify-between"
            >
              {/* Header with Photo, Name & Badges */}
              <div className="flex items-start gap-2.5 mb-2.5">
                <div className="relative shrink-0">
                  {photo ? (
                    <img
                      src={photo}
                      alt={p.name}
                      className="w-11 h-11 rounded-xl object-cover bg-slate-800 border border-slate-700/80 group-hover:border-amber-400/50 transition-colors"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xs text-white border border-white/10"
                      style={{ backgroundColor: team.color }}
                    >
                      {initials}
                    </div>
                  )}
                  {p.isIcon && (
                    <span className="absolute -bottom-1.5 -right-1 px-1 rounded-full bg-amber-400 text-slate-950 font-black text-[8px] uppercase tracking-wider">
                      ★
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-bold text-xs text-white group-hover:text-amber-300 transition-colors truncate">
                      {p.name}
                    </span>
                    {p.isCaptain && (
                      <span className="text-[9px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1 rounded font-black shrink-0">
                        C
                      </span>
                    )}
                    {p.isKeeper && (
                      <span className="text-[9px] bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 px-1 rounded font-black shrink-0">
                        WK
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-amber-400/90 block capitalize">
                    {p.cricbuzzRole || p.role}
                  </span>
                  <div className="text-[10px] text-slate-400 truncate">
                    {p.battingStyle ? p.battingStyle.replace('-hand bat', 'HB') : ''}
                    {p.battingStyle && p.bowlingStyle ? ' • ' : ''}
                    {p.bowlingStyle ? p.bowlingStyle.replace('Right-arm ', 'RA ').replace('Left-arm ', 'LA ') : ''}
                  </div>
                </div>
              </div>

              {/* Stats Highlight Pills (Replacing amounts with authentic stats) */}
              <div className="pt-2 border-t border-slate-800/80 mt-auto">
                {stats ? (
                  <div className="grid grid-cols-3 gap-1 text-center bg-slate-900/60 p-1.5 rounded-lg border border-slate-800/60">
                    {isBowler ? (
                      <>
                        <div>
                          <span className="text-[8px] text-slate-400 block uppercase font-bold">Wkts</span>
                          <span className="text-[11px] font-black text-amber-300">{stats.wickets ?? 0}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-slate-400 block uppercase font-bold">Econ</span>
                          <span className="text-[11px] font-bold text-slate-200">
                            {stats.economy ? stats.economy.toFixed(1) : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[8px] text-slate-400 block uppercase font-bold">BBI</span>
                          <span className="text-[10px] font-bold text-slate-300 truncate block">
                            {stats.bestBowling || '-'}
                          </span>
                        </div>
                      </>
                    ) : isAllrounder ? (
                      <>
                        <div>
                          <span className="text-[8px] text-slate-400 block uppercase font-bold">Runs</span>
                          <span className="text-[11px] font-black text-amber-300">{stats.runs?.toLocaleString() ?? 0}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-slate-400 block uppercase font-bold">SR</span>
                          <span className="text-[11px] font-bold text-cyan-300">
                            {stats.strikeRate ? stats.strikeRate.toFixed(0) : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[8px] text-slate-400 block uppercase font-bold">Wkts</span>
                          <span className="text-[11px] font-black text-emerald-400">{stats.wickets ?? 0}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-[8px] text-slate-400 block uppercase font-bold">Runs</span>
                          <span className="text-[11px] font-black text-amber-300">{stats.runs?.toLocaleString() ?? 0}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-slate-400 block uppercase font-bold">SR</span>
                          <span className="text-[11px] font-bold text-cyan-300">
                            {stats.strikeRate ? stats.strikeRate.toFixed(0) : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[8px] text-slate-400 block uppercase font-bold">HS</span>
                          <span className="text-[11px] font-bold text-slate-200">{stats.highestScore || '-'}</span>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-1 text-[10px] text-slate-400">
                    Official Squad Star
                  </div>
                )}

                <div className="flex items-center justify-between text-[9px] text-slate-400 font-semibold mt-1 px-0.5 group-hover:text-amber-400/80 transition-colors">
                  <span>{stats?.matches ?? 0} Career Matches</span>
                  <span>Stats & Profile →</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredSquad.length === 0 && (
        <div className="text-center py-8 text-xs text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800">
          No players found matching your filter.
        </div>
      )}

      {/* Player Stats Modal */}
      {inspectingPlayer && (
        <PlayerDetailModal
          player={inspectingPlayer}
          team={team}
          onClose={() => setInspectingPlayer(null)}
        />
      )}
    </div>
  );
};

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
          <SquadRosterSection
            squad={team.squad}
            team={team}
            title={`${team.name} 2026 Official Squad Roster`}
          />
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
          <SquadRosterSection
            squad={dedicatedTeam.squad}
            team={dedicatedTeam}
            title={`${dedicatedTeam.name} Official 18-Player Squad Roster`}
          />
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

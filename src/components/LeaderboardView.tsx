import React from 'react';
import { Flame, Trophy, Award, Users, Shield } from 'lucide-react';
import { Team, User } from '../types';

interface LeaderboardViewProps {
  fanWars: { team: Team; points: number; fansCount: number }[];
  topFans: User[];
  user: User | null;
  onOpenTeamPicker: () => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  fanWars,
  topFans,
  user,
  onOpenTeamPicker
}) => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Flame className="w-4 h-4 fill-amber-400 text-amber-400" /> Abu Dhabi T10 Fan Wars
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Franchise Standings & Leaderboards
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Every contest point, quiz score, and daily streak counts towards your team's Fan Wars trophy!
          </p>
        </div>

        <button
          onClick={onOpenTeamPicker}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold rounded-xl border border-slate-700 self-start md:self-auto flex items-center gap-2"
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Switch Supported Franchise</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Fan Wars Team Leaderboard */}
        <div className="lg:col-span-8 rounded-2xl p-6 bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <h3 className="font-black text-lg text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Fan Wars Championship Table
            </h3>
            <span className="text-xs text-slate-400 font-bold">Season 2026</span>
          </div>

          <div className="space-y-3">
            {fanWars.map((item, index) => {
              const isFirst = index === 0;
              const isUserTeam = user?.teamId === item.team.id;

              return (
                <div
                  key={item.team.id}
                  className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
                    isUserTeam
                      ? 'bg-amber-500/15 border-amber-400/80 ring-1 ring-amber-400'
                      : isFirst
                      ? 'bg-gradient-to-r from-amber-500/20 to-slate-950 border-amber-500/40'
                      : 'bg-slate-950/70 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <span className={`w-7 text-center font-black text-sm ${isFirst ? 'text-amber-400' : 'text-slate-400'}`}>
                      #{index + 1}
                    </span>

                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white shadow-md"
                      style={{ backgroundColor: item.team.color }}
                    >
                      {item.team.short}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm text-white">{item.team.name}</h4>
                        {isUserTeam && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black text-[9px] uppercase">
                            Your Team
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Users className="w-3 h-3" /> {item.fansCount.toLocaleString()} Active Fans
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base sm:text-lg font-black font-mono text-amber-400">
                      {item.points.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Fan Points
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Individual Fan Hall of Fame */}
        <div className="lg:col-span-4 rounded-2xl p-6 bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <h3 className="font-black text-base text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              MVP Fans
            </h3>
            <span className="text-xs text-slate-400">Top Predictors</span>
          </div>

          <div className="space-y-3">
            {topFans.map((fan, idx) => (
              <div
                key={fan.id}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 text-center font-bold text-xs text-slate-400">
                    #{idx + 1}
                  </span>
                  <img src={fan.avatar} alt={fan.name} className="w-8 h-8 rounded-full bg-slate-800" />
                  <div>
                    <span className="font-bold text-xs text-white block truncate max-w-[120px]">
                      {fan.name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {fan.streak}d streak
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono font-bold text-xs text-amber-400">
                    {fan.points}
                  </span>
                  <span className="text-[10px] text-slate-400 block">pts</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

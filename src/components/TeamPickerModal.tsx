import React from 'react';
import { Team, User } from '../types';
import { X, Check, Shield, Flame, Sparkles } from 'lucide-react';

interface TeamPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: Team[];
  user: User | null;
  onSelectTeam: (teamId: string) => void;
}

export const TeamPickerModal: React.FC<TeamPickerModalProps> = ({
  isOpen,
  onClose,
  teams,
  user,
  onSelectTeam
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-amber-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-amber-500/10 text-slate-100 max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400 mb-2">
            <Flame className="w-6 h-6 fill-amber-400" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Pledge Your Allegiance in <span className="text-amber-400">Fan Wars</span>
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
            Backing a franchise routes all your prediction & fantasy points directly to their Fan Wars championship total!
          </p>
        </div>

        {/* Team Selection Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto pr-1 no-scrollbar flex-1 pb-2">
          {teams.map((t) => {
            const isSelected = user?.teamId === t.id;
            const isAces = t.id === 'aces';
            return (
              <div
                key={t.id}
                onClick={() => onSelectTeam(t.id)}
                className={`group relative p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-400 ring-1 ring-amber-400 shadow-lg shadow-amber-500/20'
                    : isAces
                    ? 'bg-slate-800/80 border-amber-500/40 hover:border-amber-400 hover:bg-slate-800'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                {isAces && (
                  <span className="absolute -top-2.5 right-3 bg-amber-400 text-slate-950 font-black text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
                    Franchise Spotlight
                  </span>
                )}

                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-4 h-4 rounded-full ring-2 ring-slate-800"
                      style={{ backgroundColor: t.color }}
                    />
                    <div>
                      <h3 className="font-extrabold text-sm text-white group-hover:text-amber-300 transition-colors">
                        {t.name}
                      </h3>
                      <span className="text-[10px] font-bold text-slate-400">
                        {t.short} · {t.home.split(',')[0]}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-300 space-y-1 mt-2 pt-2 border-t border-slate-800/60">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Icon Star:</span>
                    <span className="font-semibold text-amber-200">{t.iconPlayer}</span>
                  </div>
                  {t.headCoach && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Head Coach:</span>
                      <span className="font-semibold text-slate-200">{t.headCoach}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <span>You can switch your backed team once per season.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

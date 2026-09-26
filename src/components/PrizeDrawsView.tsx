import React, { useState } from 'react';
import { PrizeDraw, User, Team } from '../types';
import { Gift, ShieldCheck, CheckCircle2, Clock, Sparkles, Trophy } from 'lucide-react';

interface PrizeDrawsViewProps {
  draws: PrizeDraw[];
  user: User | null;
  userTeam: Team | null;
  onOpenAuth: () => void;
  onEnterDraw: (drawId: string) => Promise<any>;
}

export const PrizeDrawsView: React.FC<PrizeDrawsViewProps> = ({
  draws,
  user,
  userTeam,
  onOpenAuth,
  onEnterDraw
}) => {
  const [enteringId, setEnteringId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleEnter = async (drawId: string) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setEnteringId(drawId);
    setSuccessMsg(null);
    try {
      await onEnterDraw(drawId);
      setSuccessMsg('You are officially entered into the prize draw!');
    } catch (e: any) {
      alert(e?.message || 'Error entering draw');
    } finally {
      setEnteringId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Gift className="w-4 h-4" /> Cryptographic Provably Fair Prize Draws
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            VIP Passes & Franchise Experiences
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Free entry for signed-in fans. Winners drawn autonomously using verified SHA-256 entropy.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {draws.map(draw => {
          const isDrawn = draw.status === 'drawn';
          const isAcesExclusive = draw.teamOnly === 'aces';

          return (
            <div
              key={draw.id}
              className="rounded-2xl p-6 bg-slate-900 border border-slate-800 hover:border-amber-400/50 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-slate-950"
                    style={{ backgroundColor: draw.color || '#E8B04A' }}
                  >
                    {isAcesExclusive ? 'Aces Fans Exclusive' : 'All-Fan Open Draw'}
                  </span>

                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    {isDrawn ? 'Completed' : 'Closes in 4d'}
                  </span>
                </div>

                <h3 className="font-black text-lg text-white mb-2 leading-snug">
                  {draw.title}
                </h3>

                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 mb-4">
                  <span className="text-[11px] text-slate-400 font-semibold block mb-1">Grand Prize:</span>
                  <p className="text-sm font-extrabold text-amber-300">
                    {draw.prize}
                  </p>
                </div>

                <p className="text-xs text-slate-300 mb-4">
                  {draw.description}
                </p>

                {isDrawn && (
                  <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs mb-4">
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <Trophy className="w-4 h-4 text-emerald-400" />
                      <span>Winner Drawn: {draw.winnerName || 'Lucky Fan'}</span>
                    </div>
                    <p className="text-[10px] text-emerald-200 font-mono truncate">
                      Seed: {draw.seed}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Provably Fair</span>
                </div>

                {isDrawn ? (
                  <span className="text-xs font-bold text-slate-400">Draw Closed</span>
                ) : (
                  <button
                    onClick={() => handleEnter(draw.id)}
                    disabled={enteringId === draw.id}
                    className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-transform"
                  >
                    {enteringId === draw.id ? 'Entering...' : 'Enter Draw (Free)'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { Award, Check, Copy, Crown, Sparkles, Star, Trophy, X, Zap, ShieldCheck, Flame } from 'lucide-react';
import { TeamBadge } from './ui';
import type { Team } from '../types';

interface LevelUpCelebrationProps {
  open: boolean;
  onClose: () => void;
  prizeTitle: string;
  pointsSpent: number;
  voucherCode: string;
  fulfilment?: string;
  team?: Team | null;
  userPoints?: number;
  userBalance?: number;
}

/** Synthesize a dynamic, multi-voice brass & chime victory fanfare using Web Audio */
function playLevelUpChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    // Fanfare chord progression: C4, E4, G4, C5 -> arpeggiated + triumphant high C6 flourish
    const notes = [
      { freq: 261.63, delay: 0, dur: 0.25, vol: 0.15 },
      { freq: 329.63, delay: 0.1, dur: 0.25, vol: 0.18 },
      { freq: 392.00, delay: 0.2, dur: 0.3, vol: 0.2 },
      { freq: 523.25, delay: 0.3, dur: 0.45, vol: 0.25 },
      { freq: 659.25, delay: 0.45, dur: 0.45, vol: 0.22 },
      { freq: 783.99, delay: 0.55, dur: 0.5, vol: 0.22 },
      { freq: 1046.5, delay: 0.65, dur: 0.8, vol: 0.3 },
    ];

    notes.forEach(({ freq, delay, dur, vol }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur + 0.05);
    });
  } catch {
    /* audio playback optional */
  }
}

export function LevelUpCelebration({
  open,
  onClose,
  prizeTitle,
  pointsSpent,
  voucherCode,
  fulfilment,
  team,
  userPoints = 450,
  userBalance,
}: LevelUpCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [animProgress, setAnimProgress] = useState(0);

  // Compute Fan Tier Level & Next Milestone
  const { currentLevel, levelTitle, nextLevelPoints, progressPct, tierColor } = React.useMemo(() => {
    const pts = userPoints;
    if (pts >= 2000) return { currentLevel: 5, levelTitle: 'Franchise Legend', nextLevelPoints: 2000, progressPct: 100, tierColor: '#ec4899' };
    if (pts >= 1200) return { currentLevel: 4, levelTitle: 'Platinum VIP', nextLevelPoints: 2000, progressPct: Math.round(((pts - 1200) / 800) * 100), tierColor: '#38bdf8' };
    if (pts >= 600) return { currentLevel: 3, levelTitle: 'Matchday Pro', nextLevelPoints: 1200, progressPct: Math.round(((pts - 600) / 600) * 100), tierColor: '#10b981' };
    if (pts >= 250) return { currentLevel: 2, levelTitle: 'Club Contender', nextLevelPoints: 600, progressPct: Math.round(((pts - 250) / 350) * 100), tierColor: '#f59e0b' };
    return { currentLevel: 1, levelTitle: 'Rookie Fan', nextLevelPoints: 250, progressPct: Math.round((pts / 250) * 100), tierColor: '#a855f7' };
  }, [userPoints]);

  useEffect(() => {
    if (!open) {
      setAnimProgress(0);
      return;
    }
    playLevelUpChime();

    // Trigger visual progress meter animation
    const timer = setTimeout(() => {
      setAnimProgress(Math.max(15, progressPct));
    }, 200);

    // Particle Confetti and Gold Sparkle Animation
    const canvas = canvasRef.current;
    if (!canvas) return () => clearTimeout(timer);
    const ctx = canvas.getContext('2d');
    if (!ctx) return () => clearTimeout(timer);

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const colors = ['#f59e0b', '#fbbf24', '#fef08a', '#10b981', '#38bdf8', '#a855f7', '#ec4899', '#ffffff'];
    const particleCount = 140;
    const particles = Array.from({ length: particleCount }).map(() => ({
      x: width * 0.5 + (Math.random() - 0.5) * 260,
      y: height * 0.42 + (Math.random() - 0.5) * 120,
      vx: (Math.random() - 0.5) * 18,
      vy: Math.random() * -16 - 5,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.22,
      gravity: 0.32,
      drag: 0.965,
      opacity: 1,
    }));

    let animId: number;
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach(p => {
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        if (p.y > height * 0.72) {
          p.opacity -= 0.015;
        }

        if (p.opacity > 0) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
          ctx.restore();
        }
      });

      if (particles.some(p => p.opacity > 0)) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animId);
    };
  }, [open, progressPct]);

  if (!open) return null;

  const copyCode = () => {
    navigator.clipboard?.writeText(voucherCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
      {/* Particle Canvas Overlay */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

      {/* Main Level-Up Modal Container */}
      <div className="relative z-20 w-full max-w-lg my-auto overflow-hidden rounded-3xl border-2 border-amber-400/60 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-6 sm:p-8 text-center shadow-[0_0_60px_rgba(245,158,11,0.4)] animate-in zoom-in-95 duration-300">
        {/* Background Sunburst & Rotating Radiant Aura */}
        <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[440px] h-[440px] bg-gradient-to-r from-amber-500/25 via-yellow-400/35 to-amber-600/25 rounded-full blur-3xl pointer-events-none animate-pulse" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/70 hover:bg-slate-700 transition-colors z-30"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Level-Up Crest Badge with Golden Laurel Crown */}
        <div className="relative mx-auto mb-4 flex items-center justify-center">
          <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-200 p-1 shadow-[0_0_35px_rgba(251,191,36,0.7)] animate-bounce">
            <div className="flex flex-col items-center justify-center w-full h-full rounded-[22px] bg-slate-950 text-amber-300">
              <Trophy className="w-11 h-11 text-amber-400 filter drop-shadow-[0_4px_12px_rgba(245,158,11,0.6)]" />
            </div>
          </div>
          {/* Sparkle Badges */}
          <Sparkles className="absolute -top-2.5 -right-3 w-8 h-8 text-yellow-300 animate-pulse" />
          <Star className="absolute -bottom-1 -left-3 w-7 h-7 text-amber-400 fill-amber-400 animate-pulse" />
          <div className="absolute -bottom-2 px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow-lg border border-yellow-200">
            Level {currentLevel} Fan
          </div>
        </div>

        {/* Level Up Banner Text */}
        <div className="space-y-1 mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-black uppercase tracking-widest shadow-sm">
            <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
            LEVEL UP & REWARD UNLOCKED
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-amber-300 tracking-tight pt-1">
            Redemption Complete!
          </h2>
          <p className="text-xs text-slate-300">
            You successfully redeemed <strong className="text-amber-400 tabular-nums">{pointsSpent} pts</strong>.
            {userBalance !== undefined && (
              <span> Remaining balance: <strong className="text-emerald-400 tabular-nums">{userBalance} pts</strong>.</span>
            )}
          </p>
        </div>

        {/* Dynamic Fan Tier Experience Progress Meter */}
        <div className="mb-4 p-3 rounded-2xl bg-slate-950/90 border border-slate-800 text-start space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 inline-flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Fan Tier: <span className="text-amber-300 font-black">{levelTitle}</span>
            </span>
            <span className="text-[11px] font-mono font-bold text-slate-400 tabular-nums">
              {userPoints} / {nextLevelPoints} XP
            </span>
          </div>

          {/* Animated Level-Up Bar */}
          <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800 relative">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 transition-all duration-1000 ease-out relative"
              style={{ width: `${animProgress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
            <span>Tier Status: Active</span>
            <span className="text-amber-300 font-bold">★ Priority Matchday Booking Access</span>
          </div>
        </div>

        {/* Prize Showcase Card with Prominent Team Badge */}
        <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 text-start relative overflow-hidden shadow-lg">
          <div className="flex items-center gap-3.5">
            {team ? (
              <TeamBadge team={team} size="md" glow />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-slate-950 border border-amber-400/40 flex items-center justify-center shrink-0 shadow-lg">
                <Crown className="w-8 h-8 text-amber-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                {team?.name || 'Abu Dhabi T10 Official Reward'}
              </span>
              <h3 className="text-base font-black text-white truncate">{prizeTitle}</h3>
              <span className="text-xs text-emerald-400 font-bold inline-flex items-center gap-1 mt-0.5">
                <Check className="w-3.5 h-3.5" /> Official Claim Voucher Generated
              </span>
            </div>
          </div>

          {fulfilment && (
            <p className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300 leading-relaxed">
              {fulfilment}
            </p>
          )}
        </div>

        {/* Holographic Voucher Code Box */}
        <div className="mb-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-950 to-amber-500/15 border-2 border-amber-400/60 p-4 shadow-inner relative overflow-hidden">
          <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-16 h-16 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />
          <span className="block text-[10px] font-black uppercase tracking-wider text-amber-400 mb-1">
            Your Official Voucher Code
          </span>
          <div className="flex items-center justify-center gap-2.5">
            <span className="font-mono text-2xl sm:text-3xl font-black text-amber-300 tracking-widest select-all drop-shadow">
              {voucherCode}
            </span>
            <button
              type="button"
              onClick={copyCode}
              className="p-2.5 rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors shadow-md active:scale-95"
              title="Copy code"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-950 stroke-[3]" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <span className="block text-[11px] text-slate-300 mt-1.5">
            {copied ? (
              <span className="text-emerald-300 font-bold">✓ Code copied to clipboard!</span>
            ) : (
              'Saved securely to your account profile under My Claims. Show this at the stadium desk.'
            )}
          </span>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-slate-950 font-black text-sm hover:brightness-110 shadow-lg shadow-amber-500/30 transition-all active:scale-[0.98] cursor-pointer"
        >
          Awesome! Continue to Rewards
        </button>
      </div>
    </div>
  );
}

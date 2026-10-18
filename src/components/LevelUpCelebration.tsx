import React, { useEffect, useRef, useState } from 'react';
import { Award, Check, Copy, Crown, Sparkles, Star, Trophy, X, Zap } from 'lucide-react';
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
}

/** Web Audio synthesizer to play a celebratory fanfare without external audio files. */
function playLevelUpChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);

      gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + idx * 0.1 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.1);
      osc.stop(ctx.currentTime + idx * 0.1 + 0.7);
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
}: LevelUpCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    playLevelUpChime();

    // Canvas Confetti Animation
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const colors = ['#f59e0b', '#fbbf24', '#fef08a', '#10b981', '#38bdf8', '#a855f7', '#ef4444', '#ffffff'];
    const particleCount = 120;
    const particles = Array.from({ length: particleCount }).map(() => ({
      x: width * 0.5 + (Math.random() - 0.5) * 200,
      y: height * 0.45 + (Math.random() - 0.5) * 100,
      vx: (Math.random() - 0.5) * 16,
      vy: Math.random() * -14 - 4,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      gravity: 0.35,
      drag: 0.96,
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

        if (p.y > height * 0.7) {
          p.opacity -= 0.015;
        }

        if (p.opacity > 0) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      });

      if (particles.some(p => p.opacity > 0)) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animId);
    };
  }, [open]);

  if (!open) return null;

  const copyCode = () => {
    navigator.clipboard?.writeText(voucherCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300">
      {/* Particle Canvas Overlay */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

      {/* Main Level-Up Modal Container */}
      <div className="relative z-20 w-full max-w-lg overflow-hidden rounded-3xl border border-amber-400/50 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-6 sm:p-8 text-center shadow-[0_0_50px_rgba(245,158,11,0.35)] animate-in zoom-in-95 duration-300">
        {/* Background Sunburst Aura */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-r from-amber-500/20 via-yellow-400/30 to-amber-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-700 transition-colors z-30"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Level-Up Crest Badge */}
        <div className="relative mx-auto mb-4 flex items-center justify-center">
          <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-200 p-1 shadow-[0_0_30px_rgba(251,191,36,0.6)] animate-bounce">
            <div className="flex flex-col items-center justify-center w-full h-full rounded-[22px] bg-slate-950 text-amber-300">
              <Trophy className="w-10 h-10 text-amber-400 filter drop-shadow" />
            </div>
          </div>
          {/* Sparkle Badges */}
          <Sparkles className="absolute -top-2 -right-2 w-7 h-7 text-yellow-300 animate-pulse" />
          <Star className="absolute -bottom-1 -left-2 w-6 h-6 text-amber-400 fill-amber-400 animate-pulse" />
        </div>

        {/* Level Up Banner Text */}
        <div className="space-y-1 mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-black uppercase tracking-widest shadow-sm">
            <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
            Level Up & Reward Unlocked
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-amber-300 tracking-tight pt-1">
            Redemption Complete!
          </h2>
          <p className="text-xs text-slate-300">
            You successfully redeemed <strong className="text-amber-400 tabular-nums">{pointsSpent} pts</strong>. Your fan tier experience has leveled up!
          </p>
        </div>

        {/* Prize Showcase Card */}
        <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-start relative overflow-hidden">
          <div className="flex items-center gap-3">
            {team ? (
              <TeamBadge team={team} size="md" />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-slate-950 border border-amber-400/30 flex items-center justify-center shrink-0">
                <Crown className="w-6 h-6 text-amber-400" />
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

        {/* Voucher Code Box */}
        <div className="mb-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-950 to-amber-500/10 border border-amber-400/50 p-3.5 shadow-inner">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-400/90 mb-1">
            Your Exclusive Voucher Code
          </span>
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-2xl sm:text-3xl font-black text-amber-300 tracking-widest select-all">
              {voucherCode}
            </span>
            <button
              type="button"
              onClick={copyCode}
              className="p-2 rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors shadow-sm"
              title="Copy code"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <span className="block text-[10px] text-slate-400 mt-1">
            {copied ? '✓ Code copied to clipboard!' : 'Saved securely to your account profile under My Claims.'}
          </span>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-slate-950 font-black text-sm hover:brightness-110 shadow-lg shadow-amber-500/25 transition-all active:scale-[0.98]"
        >
          Awesome! Continue
        </button>
      </div>
    </div>
  );
}

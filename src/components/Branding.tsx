import React from 'react';
import { ExternalLink, Shield, Trophy } from 'lucide-react';

/** Official Abu Dhabi T10 League Logo from https://abudhabit10.com/ */
export const ADT10Logo: React.FC<{ className?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }> = ({
  className = '',
  size = 'md',
}) => {
  const [imgFailed, setImgFailed] = React.useState(false);

  const dim = {
    sm: 'h-6 max-w-[90px]',
    md: 'h-8 max-w-[120px]',
    lg: 'h-11 max-w-[160px]',
    xl: 'h-16 max-w-[220px]',
  }[size];

  if (!imgFailed) {
    return (
      <a
        href="https://abudhabit10.com/"
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center select-none group transition-opacity hover:opacity-90 ${className}`}
        title="Abu Dhabi T10 League Official Site"
      >
        <img
          src="https://framerusercontent.com/images/mmKbaRRmkPEpmYP03xkvFKCySk.svg"
          alt="Abu Dhabi T10 Official"
          className={`${dim} object-contain filter drop-shadow`}
          onError={() => {
            // Try high-resolution fallback
            setImgFailed(true);
          }}
        />
      </a>
    );
  }

  return (
    <a
      href="https://abudhabit10.com/"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 select-none group ${className}`}
      title="Abu Dhabi T10 League Official Site"
    >
      <img
        src="https://upload.wikimedia.org/wikipedia/en/0/05/T10_League_Logo.png"
        alt="Abu Dhabi T10"
        className={`${dim} object-contain`}
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
      <div className="flex flex-col text-left">
        <span className="text-[10px] uppercase font-black tracking-widest text-amber-400 leading-none">ABU DHABI</span>
        <span className="text-sm font-black text-white leading-none mt-0.5">T10 LEAGUE</span>
      </div>
    </a>
  );
};

/** Arabian Aces Franchise Brand & Attribution Badge */
export const ArabianAcesAttribution: React.FC<{
  variant?: 'banner' | 'pill' | 'footer' | 'inline';
  className?: string;
}> = ({ variant = 'banner', className = '' }) => {
  if (variant === 'pill') {
    return (
      <a
        href="https://www.arabianaces.ae"
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/15 via-amber-400/20 to-amber-500/10 border border-amber-400/40 text-amber-300 text-xs font-bold hover:bg-amber-400/25 transition-all shadow-sm ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span>Brought to you by <strong className="text-white font-extrabold">Arabian Aces franchise</strong></span>
        <span className="text-slate-400">·</span>
        <span className="underline underline-offset-2 text-amber-200 hover:text-white flex items-center gap-1">
          www.arabianaces.ae <ExternalLink className="w-3 h-3 inline" />
        </span>
      </a>
    );
  }

  if (variant === 'footer') {
    return (
      <div className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/30 text-left ${className}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shrink-0 shadow-lg shadow-amber-500/10">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-black text-amber-400 text-base">
                AA
              </div>
            </div>
            <div>
              <div className="text-xs uppercase font-black tracking-wider text-amber-400 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" /> Brought to you by Arabian Aces franchise
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                Official Abu Dhabi T10 Franchise · Captain: <strong className="text-white">Moeen Ali</strong> · Coach: <strong className="text-white">Lance Klusener</strong>
              </p>
            </div>
          </div>
          <a
            href="https://www.arabianaces.ae"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs hover:bg-amber-300 transition-colors shrink-0 shadow-md"
          >
            Visit www.arabianaces.ae <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  }

  // Default banner variant
  return (
    <div className={`flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-300 ${className}`}>
      <span className="text-slate-400">Brought to you by</span>
      <span className="font-extrabold text-amber-300">Arabian Aces franchise</span>
      <span className="text-slate-600">·</span>
      <a
        href="https://www.arabianaces.ae"
        target="_blank"
        rel="noopener noreferrer"
        className="text-amber-400 hover:text-amber-300 underline underline-offset-2 font-bold inline-flex items-center gap-1"
      >
        www.arabianaces.ae <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
};

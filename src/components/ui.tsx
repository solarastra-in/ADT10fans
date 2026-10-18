import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { Link } from '../router';
import { useI18n, useT } from '../i18n';
import type { Team } from '../types';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Card({ className, children, as: As = 'div', ...rest }: React.HTMLAttributes<HTMLDivElement> & { as?: any }) {
  return (
    <As className={cx('rounded-2xl bg-slate-900/80 border border-slate-800', className)} {...rest}>
      {children}
    </As>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
const BTN: Record<ButtonVariant, string> = {
  primary: 'bg-amber-400 text-slate-950 hover:bg-amber-300 disabled:bg-amber-400/40',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700 disabled:opacity-50',
  outline: 'border border-amber-400/60 text-amber-300 hover:bg-amber-400/10 disabled:opacity-50',
  ghost: 'text-slate-300 hover:text-white hover:bg-slate-800/70 disabled:opacity-50',
  danger: 'bg-red-500/15 text-red-300 border border-red-500/40 hover:bg-red-500/25 disabled:opacity-50',
};
export function Button({ variant = 'primary', size = 'md', loading, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors disabled:cursor-not-allowed select-none',
        size === 'sm' ? 'min-h-[36px] px-3 text-xs' : size === 'lg' ? 'min-h-[52px] px-6 text-base' : 'min-h-[44px] px-4 text-sm',
        BTN[variant],
        className,
      )}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

export function ButtonLink({ to, variant = 'primary', size = 'md', className, children, external }: { to: string; variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg'; className?: string; children: React.ReactNode; external?: boolean }) {
  const cls = cx(
    'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors select-none',
    size === 'sm' ? 'min-h-[36px] px-3 text-xs' : size === 'lg' ? 'min-h-[52px] px-6 text-base' : 'min-h-[44px] px-4 text-sm',
    BTN[variant],
    className,
  );
  if (external) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={cls}>
      {children}
    </Link>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-black uppercase tracking-wider text-amber-400">{eyebrow}</p>}
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight break-words">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ title, action, id }: { title: string; action?: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="flex items-center justify-between gap-3 mb-3 scroll-mt-24">
      <h2 className="text-lg font-black text-white">{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card className="p-6 sm:p-8 text-center">
      {icon && <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center mb-3">{icon}</div>}
      <h3 className="text-base font-bold text-white">{title}</h3>
      {body && <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">{body}</p>}
      {action && <div className="mt-4 flex justify-center gap-2 flex-wrap">{action}</div>}
    </Card>
  );
}

export function Spinner({ label }: { label?: string }) {
  const t = useT();
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-sm" role="status">
      <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
      <span>{label || t('Loading…')}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <div role="alert" className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-sm text-red-200 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
      <div className="flex-1 min-w-0">
        <p className="break-words">{message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-2 text-xs font-bold text-red-100 underline">
            {t('Try again')}
          </button>
        )}
      </div>
    </div>
  );
}

export function Notice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' | 'success' }) {
  const cls = tone === 'warn' ? 'bg-amber-400/10 border-amber-400/30 text-amber-100' : tone === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100' : 'bg-sky-500/10 border-sky-500/30 text-sky-100';
  return <div className={cx('p-3 rounded-xl border text-sm', cls)}>{children}</div>;
}

export function Pill({ children, tone = 'slate', className }: { children: React.ReactNode; tone?: 'slate' | 'amber' | 'green' | 'red' | 'blue'; className?: string }) {
  const c = { slate: 'bg-slate-800 text-slate-300 border-slate-700', amber: 'bg-amber-400/15 text-amber-300 border-amber-400/30', green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', red: 'bg-red-500/15 text-red-300 border-red-500/30', blue: 'bg-sky-500/15 text-sky-300 border-sky-500/30' }[tone];
  return <span className={cx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap', c, className)}>{children}</span>;
}

export function TeamDot({ team, size = 12 }: { team?: Pick<Team, 'color'> | null; size?: number }) {
  return <span className="inline-block rounded-full shrink-0 ring-1 ring-white/10" style={{ width: size, height: size, background: team?.color || '#475569' }} />;
}

export function TeamBadge({
  team,
  size = 'md',
  className,
  glow = true,
}: {
  team?: Team | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  glow?: boolean;
}) {
  const dim = {
    xs: 'w-7 h-7 text-[10px] p-0.5',
    sm: 'w-10 h-10 sm:w-11 sm:h-11 text-xs p-1',
    md: 'w-13 h-13 sm:w-14 sm:h-14 text-sm p-1.5',
    lg: 'w-20 h-20 sm:w-24 sm:h-24 text-lg p-2',
    xl: 'w-28 h-28 sm:w-32 sm:h-32 text-xl p-2.5',
    '2xl': 'w-36 h-36 sm:w-44 sm:h-44 text-2xl p-3',
  }[size];

  if (!team) {
    return (
      <span className={cx(dim, 'rounded-2xl bg-slate-900 border border-slate-800 inline-flex items-center justify-center text-slate-500 font-black shrink-0', className)}>
        ?
      </span>
    );
  }

  const logoSrc = team.logo || (team.id && ['bulls', 'tigers', 'lions', 'aces', 'eagles', 'champions'].includes(team.id) ? `/logos/${team.id}.svg` : null);

  if (logoSrc) {
    return (
      <div
        className={cx(
          dim,
          'rounded-2xl inline-flex items-center justify-center bg-gradient-to-b from-slate-900/95 via-slate-950/90 to-slate-900/95 border shadow-lg transition-transform shrink-0 relative overflow-hidden group',
          glow ? 'hover:scale-105' : '',
          className
        )}
        style={{
          borderColor: team.color ? `${team.color}66` : 'rgba(51,65,85,0.7)',
          boxShadow: glow && team.color ? `0 4px 16px -2px ${team.color}33, 0 2px 6px -1px rgba(0,0,0,0.6)` : '0 4px 12px rgba(0,0,0,0.5)',
        }}
        title={team.name || team.short}
      >
        {/* Subtle radial highlight behind logo */}
        <div
          className="absolute inset-0 opacity-20 group-hover:opacity-35 transition-opacity pointer-events-none rounded-2xl"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${team.color || '#38bdf8'} 0%, transparent 70%)`,
          }}
        />
        <img
          src={logoSrc}
          alt={team.name || team.short}
          className="w-full h-full object-contain filter drop-shadow-md shrink-0 relative z-10 transition-transform duration-200 group-hover:scale-105"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <span
      className={cx(dim, 'rounded-2xl inline-flex items-center justify-center font-black shrink-0 border shadow-md', className)}
      style={{
        background: `linear-gradient(135deg, ${team.color}, ${team.secondaryColor || '#0f172a'})`,
        color: '#ffffff',
        borderColor: `${team.color}88`,
      }}
      aria-hidden
    >
      {team.short}
    </span>
  );
}

export function Avatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initials = (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('');
  if (src && !failed)
    return <img src={src} alt="" width={size} height={size} onError={() => setFailed(true)} referrerPolicy="no-referrer" className="rounded-full object-cover shrink-0 bg-slate-800" style={{ width: size, height: size }} loading="lazy" />;
  return (
    <span className="rounded-full shrink-0 inline-flex items-center justify-center bg-slate-700 text-slate-200 font-bold" style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }} aria-hidden>
      {initials || '?'}
    </span>
  );
}

export function PlayerPhoto({ name, src, size = 48 }: { name: string; src?: string; size?: number }) {
  return <Avatar name={name} src={src} size={size} />;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cx('relative w-full bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 bg-slate-900/95 backdrop-blur border-b border-slate-800">
          <h2 className="text-base font-black text-white">{title}</h2>
          <button type="button" onClick={onClose} className="w-10 h-10 -me-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 inline-flex items-center justify-center" aria-label={t('Close')}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { id: T; label: React.ReactNode; count?: number }[]; className?: string }) {
  return (
    <div className={cx('flex gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1', className)} role="tablist">
      {items.map(it => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={cx('min-h-[40px] px-3.5 rounded-full text-sm font-bold whitespace-nowrap border transition-colors', value === it.id ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white')}
        >
          {it.label}
          {it.count !== undefined && <span className={cx('ms-1.5 text-xs', value === it.id ? 'text-slate-800' : 'text-slate-500')}>{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: React.ReactNode; children: React.ReactNode; htmlFor?: string }) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="block text-xs font-bold text-slate-300 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}

export const inputCls = 'w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-base sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/60';

export function useFormat() {
  const { locale, t } = useI18n();
  return {
    date: (iso?: string | null, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => (iso ? new Date(iso).toLocaleDateString(locale, opts) : ''),
    time: (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : ''),
    dateTime: (iso?: string | null) => (iso ? new Date(iso).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''),
    num: (n: number) => n.toLocaleString(locale),
    ago: (iso?: string | null) => {
      if (!iso) return '';
      const s = Math.round((Date.now() - +new Date(iso)) / 1000);
      if (s < 60) return t('just now');
      if (s < 3600) return t('{n}m ago', { n: Math.floor(s / 60) });
      if (s < 86400) return t('{n}h ago', { n: Math.floor(s / 3600) });
      if (s < 86400 * 7) return t('{n}d ago', { n: Math.floor(s / 86400) });
      return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    },
  };
}

/** Counts down to a time; shows "Starts in 2d 4h" / "Locks in 12m". */
export function Countdown({ to, prefix }: { to: string; prefix?: string }) {
  const t = useT();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const ms = +new Date(to) - now;
  if (ms <= 0) return null;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const text = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return (
    <span className="tabular-nums">
      {prefix ? t(prefix, { time: text }) : text}
    </span>
  );
}

export function StatTile({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
      <div className={cx('text-xl font-black tabular-nums', accent ? 'text-amber-400' : 'text-white')}>{value}</div>
      <div className="text-[11px] text-slate-400 font-semibold mt-0.5">{label}</div>
    </div>
  );
}

export const ROLE_LABEL: Record<string, string> = { batter: 'Batter', bowler: 'Bowler', allrounder: 'All-rounder', wicketkeeper: 'Wicketkeeper' };
export const ROLE_SHORT: Record<string, string> = { batter: 'BAT', bowler: 'BOWL', allrounder: 'AR', wicketkeeper: 'WK' };

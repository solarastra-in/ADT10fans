import React, { useCallback, useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, Loader2 } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export const isHttpsUrl = (value: string | undefined | null): boolean => {
  if (!value) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'https:' && !!u.hostname;
  } catch {
    return false;
  }
};

/** ISO string -> value for <input type="datetime-local"> in the browser's local time */
export const toLocalInput = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** datetime-local value -> ISO string ('' when blank/invalid) */
export const fromLocalInput = (value: string): string => {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toISOString();
};

export const toDateInput = (iso?: string | null): string => (iso ? String(iso).slice(0, 10) : '');

export const formatDateTime = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

export const errorMessage = (err: unknown, fallback = 'Something went wrong'): string =>
  (err as any)?.message ? String((err as any).message) : fallback;

export const splitList = (value: string): string[] =>
  value
    .split(/[,\n]/)
    .map(s => s.trim())
    .filter(Boolean);

export const toNumber = (value: string, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export type Errors = Record<string, string>;

/* ------------------------------------------------------------------ */
/* Async action runner with a status notice                            */
/* ------------------------------------------------------------------ */

export type NoticeKind = 'ok' | 'err' | 'info' | 'warn';
export interface NoticeState {
  kind: NoticeKind;
  text: string;
  details?: string[];
}

export function useRunner() {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, okText?: string | ((r: T) => string)): Promise<T | undefined> => {
      setBusy(key);
      setNotice(null);
      try {
        const r = await fn();
        if (okText) setNotice({ kind: 'ok', text: typeof okText === 'function' ? okText(r) : okText });
        return r;
      } catch (err) {
        setNotice({ kind: 'err', text: errorMessage(err) });
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    []
  );

  return { busy, notice, setNotice, run };
}

/* ------------------------------------------------------------------ */
/* Class names                                                         */
/* ------------------------------------------------------------------ */

export const inputCls = (hasError?: boolean) =>
  `w-full min-h-[44px] px-3 py-2 bg-slate-950 border rounded-xl text-base sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/40 ${
    hasError ? 'border-rose-500' : 'border-slate-700 focus:border-amber-400'
  }`;

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400';

const btnVariants = {
  primary: 'bg-amber-400 hover:bg-amber-300 text-slate-950',
  secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700',
  danger: 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/40',
  ghost: 'bg-transparent hover:bg-slate-800 text-slate-300',
  success: 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40',
};

const btnSizes = {
  md: 'min-h-[44px] px-4 py-2 text-sm',
  sm: 'min-h-[36px] px-3 py-1.5 text-xs sm:text-sm',
};

/* ------------------------------------------------------------------ */
/* Components                                                          */
/* ------------------------------------------------------------------ */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof btnVariants;
  size?: keyof typeof btnSizes;
  loading?: boolean;
  icon?: React.ReactNode;
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={`${btnBase} ${btnVariants[variant]} ${btnSizes[size]} ${className}`}
    {...rest}
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
    {children}
  </button>
);

export const Field: React.FC<{
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ label, htmlFor, error, hint, required, className = '', children }) => (
  <div className={`min-w-0 ${className}`}>
    <label htmlFor={htmlFor} className="block text-xs font-bold text-slate-300 mb-1">
      {label}
      {required && <span className="text-amber-400"> *</span>}
    </label>
    {children}
    {error ? (
      <p className="mt-1 text-xs font-semibold text-rose-400" role="alert">
        {error}
      </p>
    ) : hint ? (
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    ) : null}
  </div>
);

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }> = ({
  error,
  className = '',
  ...rest
}) => <input className={`${inputCls(error)} ${className}`} {...rest} />;

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }> = ({
  error,
  className = '',
  rows = 3,
  ...rest
}) => <textarea rows={rows} className={`${inputCls(error)} ${className}`} {...rest} />;

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }> = ({
  error,
  className = '',
  children,
  ...rest
}) => (
  <select className={`${inputCls(error)} ${className}`} {...rest}>
    {children}
  </select>
);

export const Checkbox: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }> = ({
  label,
  checked,
  onChange,
  hint,
}) => (
  <label className="flex items-start gap-3 min-h-[44px] py-2 cursor-pointer select-none">
    <input
      type="checkbox"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      className="mt-0.5 w-5 h-5 accent-amber-400 shrink-0"
    />
    <span className="text-sm text-slate-200">
      {label}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </span>
  </label>
);

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-5 ${className}`}>{children}</div>
);

export const SectionHeader: React.FC<{ title: string; description?: React.ReactNode; actions?: React.ReactNode }> = ({
  title,
  description,
  actions,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
    <div className="min-w-0">
      <h2 className="text-lg sm:text-xl font-black text-white">{title}</h2>
      {description && <p className="text-sm text-slate-400 mt-0.5">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
  </div>
);

const chipTones: Record<string, string> = {
  green: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
  amber: 'bg-amber-500/10 text-amber-300 border-amber-500/40',
  red: 'bg-rose-500/10 text-rose-300 border-rose-500/40',
  blue: 'bg-sky-500/10 text-sky-300 border-sky-500/40',
  slate: 'bg-slate-800 text-slate-300 border-slate-700',
  violet: 'bg-violet-500/10 text-violet-300 border-violet-500/40',
};

export const Chip: React.FC<{ tone?: keyof typeof chipTones; children: React.ReactNode; className?: string }> = ({
  tone = 'slate',
  children,
  className = '',
}) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold whitespace-nowrap ${chipTones[tone]} ${className}`}
  >
    {children}
  </span>
);

export const statusTone = (status?: string): keyof typeof chipTones => {
  switch (status) {
    case 'verified':
    case 'success':
    case 'live':
    case 'open':
    case 'active':
    case 'approved':
    case 'fcm':
      return 'green';
    case 'pending':
    case 'warning':
    case 'upcoming':
    case 'locked':
    case 'scheduled':
    case 'standby':
    case 'in-app':
      return 'amber';
    case 'error':
    case 'rejected':
    case 'hidden':
    case 'sold_out':
      return 'red';
    case 'pinned':
    case 'drawn':
    case 'settled':
    case 'completed':
      return 'blue';
    default:
      return 'slate';
  }
};

export const Notice: React.FC<{ notice: NoticeState | null; onClose?: () => void }> = ({ notice, onClose }) => {
  if (!notice) return null;
  const tone =
    notice.kind === 'ok'
      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
      : notice.kind === 'err'
      ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
      : notice.kind === 'warn'
      ? 'bg-amber-950/50 border-amber-500/40 text-amber-200'
      : 'bg-slate-900 border-slate-700 text-slate-200';
  const Icon = notice.kind === 'ok' ? CheckCircle2 : notice.kind === 'info' ? Info : AlertTriangle;
  return (
    <div className={`p-3 rounded-xl border text-sm flex items-start gap-2 ${tone}`} role="status">
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 break-words">
        <p className="font-semibold">{notice.text}</p>
        {notice.details && notice.details.length > 0 && (
          <ul className="mt-1 list-disc pl-4 space-y-0.5 text-xs opacity-90">
            {notice.details.map((d, i) => (
              <li key={i} className="break-words">
                {d}
              </li>
            ))}
          </ul>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="-m-2 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-current opacity-70 hover:opacity-100"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export const EmptyState: React.FC<{ title: string; description?: string; action?: React.ReactNode }> = ({
  title,
  description,
  action,
}) => (
  <div className="p-6 rounded-2xl border border-dashed border-slate-700 text-center">
    <p className="text-sm font-bold text-slate-200">{title}</p>
    {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
    {action && <div className="mt-3 flex justify-center">{action}</div>}
  </div>
);

/** Full-screen on mobile, centered dialog from sm: up. */
export const Sheet: React.FC<{
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}> = ({ open, title, onClose, children, footer, wide }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`w-full h-[100dvh] sm:h-auto sm:max-h-[90dvh] ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'
        } bg-slate-900 sm:rounded-2xl sm:border sm:border-slate-700 flex flex-col overflow-hidden`}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-800 shrink-0">
          <h3 className="font-black text-white text-base truncate">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-slate-800 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode; onClick?: () => void }> = ({
  label,
  value,
  hint,
  onClick,
}) => {
  const content = (
    <>
      <span className="text-xs font-bold text-slate-400 block">{label}</span>
      <span className="text-2xl font-black text-white font-mono block mt-1">{value}</span>
      {hint && <span className="text-xs text-slate-500 block mt-0.5">{hint}</span>}
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="text-left p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-400/50 transition-colors min-w-0"
    >
      {content}
    </button>
  ) : (
    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 min-w-0">{content}</div>
  );
};

/** Small row of action buttons that wraps on narrow screens */
export const Actions: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`flex flex-wrap gap-2 ${className}`}>{children}</div>
);

export const TeamSwatch: React.FC<{ color?: string; label?: string; logo?: string }> = ({ color, label, logo }) =>
  logo && isHttpsUrl(logo) ? (
    <img src={logo} alt="" loading="lazy" className="w-9 h-9 rounded-lg object-cover bg-slate-800 shrink-0 aspect-square" />
  ) : (
    <span
      className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-xs font-black text-slate-950"
      style={{ backgroundColor: color || '#475569' }}
      aria-hidden="true"
    >
      {(label || '?').slice(0, 3).toUpperCase()}
    </span>
  );

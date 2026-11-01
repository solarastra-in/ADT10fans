import React, { useState } from 'react';
import { useT } from '../i18n';
import { MAX_BALLS, MAX_OVERS, niceMax, oversOf, type OverBar, type WormPoint } from '../utils/matchAnalytics';

/**
 * Charts for the live centre. Two series at most (one per innings), in two validated hues for the
 * dark surface (blue, orange); identity is never colour alone: a legend, direct labels at the line
 * ends, and a table under every chart.
 */
export const SERIES = ['#3987e5', '#d95926'] as const;
const GRID = '#1e293b';
const AXIS = '#64748b';
const SURFACE = '#0f172a';

export interface Series<T> { label: string; points: T[] }

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300" aria-hidden="true">
      {items.map(i => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: i.color }} /> {i.label}
        </span>
      ))}
    </div>
  );
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: React.ReactNode }) {
  // Keep the tooltip inside the chart: flip to the left of the pointer past the middle.
  const left = x > width / 2;
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-lg border border-slate-700 bg-slate-950/95 px-2.5 py-1.5 text-[11px] text-slate-100 shadow-xl whitespace-nowrap"
      style={{ top: `${y}%`, left: left ? undefined : `${(x / width) * 100}%`, right: left ? `${100 - (x / width) * 100}%` : undefined, transform: `translate(${left ? '-8px' : '8px'}, -50%)` }}
    >
      {children}
    </div>
  );
}

/** Runs against balls for each innings, wickets marked on the line. */
export function WormChart({ series }: { series: Series<WormPoint>[] }) {
  const t = useT();
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 260;
  const pad = { l: 36, r: 64, t: 12, b: 28 };
  const maxRuns = niceMax(Math.max(...series.flatMap(s => s.points.map(p => p.runs)), 40), 20);
  const x = (b: number) => pad.l + (b / MAX_BALLS) * (W - pad.l - pad.r);
  const y = (r: number) => H - pad.b - (r / maxRuns) * (H - pad.t - pad.b);
  const ticks = Array.from({ length: maxRuns / 20 + 1 }, (_, i) => i * 20).filter((_, i, a) => a.length <= 8 || i % 2 === 0);
  const at = (pts: WormPoint[], b: number) => [...pts].filter(p => p.balls <= b).pop();
  const overAt = hover === null ? null : Math.round(hover);

  return (
    <div className="space-y-2">
      <Legend items={series.map((s, i) => ({ label: s.label, color: SERIES[i] }))} />
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto touch-none"
          role="img"
          aria-label={t('Runs over by over')}
          onPointerMove={e => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            const over = ((px - pad.l) / (W - pad.l - pad.r)) * MAX_OVERS;
            setHover(over < 0 || over > MAX_OVERS + 0.5 ? null : Math.max(0, Math.min(MAX_OVERS, over)));
          }}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map(v => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
              <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill={AXIS}>{v}</text>
            </g>
          ))}
          {Array.from({ length: MAX_OVERS + 1 }, (_, o) => (
            <text key={o} x={x(o * 6)} y={H - 8} textAnchor="middle" fontSize={11} fill={AXIS}>{o}</text>
          ))}
          {overAt !== null && <line x1={x(overAt * 6)} x2={x(overAt * 6)} y1={pad.t} y2={H - pad.b} stroke={AXIS} strokeWidth={1} strokeDasharray="3 3" />}
          {series.map((s, i) => (
            <g key={s.label}>
              <polyline fill="none" stroke={SERIES[i]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={s.points.map(p => `${x(p.balls)},${y(p.runs)}`).join(' ')} />
              {s.points.map((p, k) => {
                const prev = s.points[k - 1];
                return prev && p.wickets > prev.wickets ? <circle key={k} cx={x(p.balls)} cy={y(p.runs)} r={4.5} fill={SERIES[i]} stroke={SURFACE} strokeWidth={2} /> : null;
              })}
              {s.points.length > 0 && (() => {
                const last = s.points[s.points.length - 1];
                return (
                  <text x={x(last.balls) + 6} y={y(last.runs) + 4 + (i === 1 && series[0] && Math.abs(y(series[0].points[series[0].points.length - 1]?.runs ?? 0) - y(last.runs)) < 14 ? 14 : 0)} fontSize={12} fontWeight={700} fill="#e2e8f0">
                    {s.label} {last.runs}/{last.wickets}
                  </text>
                );
              })()}
            </g>
          ))}
        </svg>
        {overAt !== null && (
          <Tooltip x={x(overAt * 6)} y={30} width={W}>
            <p className="font-bold text-slate-300 mb-0.5">{t('After {n} overs', { n: overAt })}</p>
            {series.map((s, i) => {
              const p = at(s.points, overAt * 6);
              const covered = s.points.length && s.points[s.points.length - 1].balls >= overAt * 6;
              return (
                <p key={s.label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm" style={{ background: SERIES[i] }} />
                  {s.label}: {p && covered ? `${p.runs}/${p.wickets}${p.balls !== overAt * 6 ? ` (${oversOf(p.balls)})` : ''}` : '–'}
                </p>
              );
            })}
          </Tooltip>
        )}
      </div>
      <p className="text-[11px] text-slate-500">{t('Overs along the bottom, runs up the side. Dots are wickets.')}</p>
      <details className="text-xs text-slate-300">
        <summary className="cursor-pointer text-slate-400">{t('Show as a table')}</summary>
        <table className="mt-2 w-full text-start tabular-nums">
          <thead className="text-slate-500"><tr><th className="text-start font-semibold py-1">{t('Overs')}</th>{series.map(s => <th key={s.label} className="text-end font-semibold">{s.label}</th>)}</tr></thead>
          <tbody>
            {Array.from(new Set(series.flatMap(s => s.points.map(p => p.balls)))).sort((a, b) => a - b).filter(b => b > 0).map(b => (
              <tr key={b} className="border-t border-slate-800">
                <td className="py-1">{oversOf(b)}</td>
                {series.map(s => { const p = s.points.find(q => q.balls === b); return <td key={s.label} className="text-end">{p ? `${p.runs}/${p.wickets}` : ''}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/** Runs in each over, the two innings side by side; wickets as dots above the bar. */
export function ManhattanChart({ series }: { series: Series<OverBar>[] }) {
  const t = useT();
  const [hover, setHover] = useState<{ s: number; over: number } | null>(null);
  const W = 600;
  const H = 240;
  const pad = { l: 32, r: 8, t: 22, b: 28 };
  const maxRuns = niceMax(Math.max(...series.flatMap(s => s.points.map(p => p.runs)), 12), 6);
  const slot = (W - pad.l - pad.r) / MAX_OVERS;
  const gap = 2;
  const barW = series.length > 1 ? (slot - 10 - gap) / 2 : slot - 12;
  const y = (r: number) => H - pad.b - (r / maxRuns) * (H - pad.t - pad.b);
  const bx = (over: number, s: number) => pad.l + (over - 1) * slot + 5 + s * (barW + gap);
  const ticks = Array.from({ length: maxRuns / 6 + 1 }, (_, i) => i * 6).filter((_, i, a) => a.length <= 7 || i % 2 === 0);
  const hv = hover && series[hover.s]?.points.find(p => p.over === hover.over);

  return (
    <div className="space-y-2">
      {series.length > 1 && <Legend items={series.map((s, i) => ({ label: s.label, color: SERIES[i] }))} />}
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={t('Runs in each over')} onPointerLeave={() => setHover(null)}>
          {ticks.map(v => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
              <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill={AXIS}>{v}</text>
            </g>
          ))}
          {Array.from({ length: MAX_OVERS }, (_, i) => (
            <text key={i} x={pad.l + i * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize={11} fill={AXIS}>{i + 1}</text>
          ))}
          {series.map((s, si) =>
            s.points.map(p => {
              const top = y(p.runs);
              const h = Math.max(0, H - pad.b - top);
              const r = Math.min(4, barW / 2, h);
              const x0 = bx(p.over, si);
              const base = H - pad.b;
              const d = h <= 0 ? '' : `M${x0},${base} L${x0},${top + r} Q${x0},${top} ${x0 + r},${top} L${x0 + barW - r},${top} Q${x0 + barW},${top} ${x0 + barW},${top + r} L${x0 + barW},${base} Z`;
              return (
                <g key={`${si}-${p.over}`} onPointerEnter={() => setHover({ s: si, over: p.over })} onPointerDown={() => setHover({ s: si, over: p.over })}>
                  {/* Hit area larger than the bar. */}
                  <rect x={x0 - 2} y={pad.t} width={barW + 4} height={H - pad.t - pad.b} fill="transparent" />
                  {d && <path d={d} fill={SERIES[si]} opacity={hover && (hover.s !== si || hover.over !== p.over) ? 0.55 : 1} />}
                  {Array.from({ length: p.wickets }, (_, k) => (
                    <circle key={k} cx={x0 + barW / 2} cy={top - 6 - k * 9} r={3.5} fill="#e2e8f0" stroke={SURFACE} strokeWidth={2} />
                  ))}
                </g>
              );
            }),
          )}
        </svg>
        {hover && hv && (
          <Tooltip x={bx(hover.over, hover.s) + barW / 2} y={25} width={W}>
            <p className="font-bold">{series[hover.s].label} · {t('Over {n}', { n: hover.over })}</p>
            <p>{t('{n} runs', { n: hv.runs })}{hv.wickets ? ` · ${t('{n} wickets', { n: hv.wickets })}` : ''}</p>
          </Tooltip>
        )}
      </div>
      <p className="text-[11px] text-slate-500">{t('Runs in each over. White dots are wickets.')}</p>
      <details className="text-xs text-slate-300">
        <summary className="cursor-pointer text-slate-400">{t('Show as a table')}</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead className="text-slate-500"><tr><th className="text-start font-semibold py-1">{t('Over')}</th>{series.map(s => <th key={s.label} className="text-end font-semibold">{s.label}</th>)}</tr></thead>
          <tbody>
            {Array.from({ length: MAX_OVERS }, (_, i) => i + 1).filter(o => series.some(s => s.points.some(p => p.over === o))).map(o => (
              <tr key={o} className="border-t border-slate-800">
                <td className="py-1">{o}</td>
                {series.map(s => { const p = s.points.find(q => q.over === o); return <td key={s.label} className="text-end">{p ? `${p.runs}${p.wickets ? ` · ${p.wickets}w` : ''}` : ''}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/** One horizontal bar per row, for top scorers or partnerships (single series: the title names it). */
export function BarList({ rows, color, max }: { rows: { label: string; value: number; note?: string; highlight?: boolean }[]; color: string; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map(r => r.value));
  return (
    <ul className="space-y-1.5">
      {rows.map((r, i) => (
        <li key={i} className="text-xs">
          <div className="flex items-baseline gap-2">
            <span className="flex-1 min-w-0 truncate text-slate-200 font-semibold">{r.label}</span>
            <span className="tabular-nums font-black text-white">{r.value}</span>
            {r.note && <span className="tabular-nums text-slate-400">{r.note}</span>}
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.value / top) * 100)}%`, background: color, opacity: r.highlight === false ? 0.6 : 1 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

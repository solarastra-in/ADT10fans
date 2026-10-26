import React, { useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { api } from '../api';
import { useLoad } from '../state';
import { useT } from '../i18n';
import { Button, Card, EmptyState, Spinner, cx, useFormat } from './ui';
import type { PointsEntry, PointsSource } from '../types';

/** Names for each kind of points change (translated on the client). */
export const SOURCE_NAMES: Record<PointsSource, string> = {
  checkin: 'Daily check-in',
  guess: 'Guess the Player',
  superover: 'Super Over',
  'dream-xi': 'Pick XI',
  prediction: 'Match prediction',
  quiz: 'Quiz',
  'forum-thread': 'Forum thread',
  'forum-reply': 'Forum reply',
  'forum-removed': 'Forum post removed',
  badge: 'Badge reward',
  referral: 'Invite reward',
  prize: 'Prize claim',
  'prize-refund': 'Prize claim cancelled',
  admin: 'Adjustment by the organisers',
};

export function PointsRow({ e }: { e: PointsEntry }) {
  const t = useT();
  const f = useFormat();
  const spentBucket = e.bucket === 'spent';
  const up = e.delta > 0;
  return (
    <div className="flex items-start gap-3 px-4 py-2.5" data-testid="points-row">
      <span className={cx('mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0', spentBucket ? 'bg-sky-400/10 text-sky-300' : up ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400')}>
        {up ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-white">{t(SOURCE_NAMES[e.source] || e.label)}</span>
        {e.note && <span className="block text-xs text-slate-400 break-words">{e.note}</span>}
        <span className="block text-[11px] text-slate-500">{f.dateTime(e.at)}{e.by ? ` · ${e.by}` : ''}</span>
      </span>
      <span className={cx('text-sm font-black tabular-nums shrink-0', spentBucket ? 'text-sky-300' : up ? 'text-emerald-400' : 'text-red-400')}>
        {up ? '+' : '−'}
        {f.num(Math.abs(e.delta))}
      </span>
    </div>
  );
}

/** The signed-in fan's points: where they came from, what was spent, and every change. */
export function PointsHistory() {
  const t = useT();
  const f = useFormat();
  const { data, loading } = useLoad(() => api.getMyPoints(), []);
  const [all, setAll] = useState(false);
  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const sources = (Object.entries(data.bySource) as [PointsSource, number][]).filter(([s, n]) => n && s !== 'prize' && s !== 'prize-refund').sort((a, b) => b[1] - a[1]);
  const list = all ? data.history : data.history.slice(0, 10);
  return (
    <div className="space-y-3" data-testid="points-history">
      {(sources.length > 0 || data.earlier > 0) && (
        <Card className="p-4">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">{t('Where your points came from')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {sources.map(([s, n]) => (
              <div key={s} className="flex justify-between gap-3">
                <span className="text-slate-300">{t(SOURCE_NAMES[s])}</span>
                <span className={cx('font-black tabular-nums', n > 0 ? 'text-white' : 'text-red-400')}>{f.num(n)}</span>
              </div>
            ))}
            {data.earlier > 0 && (
              <div className="flex justify-between gap-3">
                <span className="text-slate-300">{t('Earned before history was kept')}</span>
                <span className="font-black tabular-nums text-white">{f.num(data.earlier)}</span>
              </div>
            )}
            {data.pointsSpent > 0 && (
              <div className="flex justify-between gap-3 sm:col-span-2 border-t border-slate-800 pt-1.5 mt-1">
                <span className="text-sky-300">{t('Spent on prizes')}</span>
                <span className="font-black tabular-nums text-sky-300">−{f.num(data.pointsSpent)}</span>
              </div>
            )}
          </div>
        </Card>
      )}
      {data.history.length === 0 ? (
        <EmptyState title={t('No points yet')} body={t('Check in or play a daily game to start earning.')} />
      ) : (
        <Card className="divide-y divide-slate-800">
          {list.map(e => (
            <PointsRow key={e.id} e={e} />
          ))}
        </Card>
      )}
      {data.history.length > 10 && (
        <Button variant="ghost" size="sm" onClick={() => setAll(!all)}>
          {all ? t('Show less') : t('Show all')}
        </Button>
      )}
    </div>
  );
}

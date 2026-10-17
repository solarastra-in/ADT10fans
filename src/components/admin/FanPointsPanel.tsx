import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../../api';
import type { AdminFanPoints, PointsEntry, PointsHistory, PrizeRedemption, Team } from '../../types';
import { PointsRow, SOURCE_NAMES } from '../PointsHistory';
import { Button, Card, Chip, Field, Notice, TextInput, statusTone, useRunner } from './ui';

type Detail = { id: string; fan: AdminFanPoints; bySource: PointsHistory['bySource']; ledger: PointsEntry[]; claims: PrizeRedemption[]; unitemised: number };

/**
 * Look up any fan by name, email or prize claim code: their season points, what they have spent,
 * every change to their points, and their claims. Points can be added or removed with a reason,
 * which the fan sees in their history.
 */
export const FanPointsPanel: React.FC<{ teams: Team[] }> = ({ teams }) => {
  const [q, setQ] = useState('');
  const [fans, setFans] = useState<AdminFanPoints[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const { busy, notice, setNotice, run } = useRunner();

  const search = async (query = q, id?: string) => {
    const r = await run('search', () => api.getAdminPoints({ q: query.trim() || undefined, id }));
    if (!r) return;
    setFans(r.fans);
    setDetail(r.detail || null);
  };
  useEffect(() => {
    search('');
  }, []);

  const fan = detail?.fan || null;
  const adjust = async () => {
    if (!fan) return;
    const n = Math.round(Number(delta));
    if (!n) return setNotice({ kind: 'err', text: 'Enter points to add, or a negative number to remove.' });
    if (reason.trim().length < 5) return setNotice({ kind: 'err', text: 'Give a reason. The fan sees it in their points history.' });
    if (!window.confirm(`${n > 0 ? 'Add' : 'Remove'} ${Math.abs(n)} points ${n > 0 ? 'to' : 'from'} ${fan.name}?`)) return;
    const r = await run('adjust', () => api.adjustPoints(fan.id, n, reason.trim()), x => `Done. ${fan.name} now has ${x.points} season points (${x.balance} to spend).`);
    if (r) {
      setDelta('');
      setReason('');
      search(q, fan.id);
    }
  };

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-end gap-2 mb-3">
        <div className="flex-1">
          <h3 className="font-extrabold text-white">Fan points</h3>
          <p className="text-xs text-slate-400">Find a fan by name, email or claim code to see every point they earned and spent.</p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={e => {
            e.preventDefault();
            search();
          }}
        >
          <TextInput value={q} onChange={e => setQ(e.target.value)} placeholder="Name, email or claim code" aria-label="Find a fan" />
          <Button type="submit" size="sm" icon={<Search className="w-4 h-4" />} loading={busy === 'search'}>
            Find
          </Button>
        </form>
      </div>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {fans.length === 0 ? (
        <p className="text-sm text-slate-400">No fans found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="py-1.5 pe-2">Fan</th>
                <th className="py-1.5 pe-2 text-right">Season</th>
                <th className="py-1.5 pe-2 text-right">Spent</th>
                <th className="py-1.5 text-right">To spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {fans.map(f => (
                <tr key={f.id} className={detail?.id === f.id ? 'bg-amber-400/5' : ''}>
                  <td className="py-2 pe-2">
                    <button type="button" className="text-left" onClick={() => search(q, f.id)} data-testid="fan-points-row">
                      <span className="block font-bold text-white">{f.name}</span>
                      <span className="block text-xs text-slate-400 break-all">
                        {f.email}
                        {f.teamId ? ` · ${teams.find(t => t.id === f.teamId)?.short || f.teamId}` : ''}
                        {f.invited ? ` · invited ${f.invited}` : ''}
                      </span>
                    </button>
                  </td>
                  <td className="py-2 pe-2 text-right font-black text-white tabular-nums">{f.points}</td>
                  <td className="py-2 pe-2 text-right tabular-nums text-sky-300">{f.pointsSpent}</td>
                  <td className="py-2 text-right tabular-nums text-amber-300">{f.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {fan && detail && (
        <div className="mt-4 space-y-3 border-t border-slate-800 pt-4" data-testid="fan-points-detail">
          <p className="text-sm text-white">
            <span className="font-black">{fan.name}</span> <span className="text-slate-400">{fan.email}</span> · {fan.points} season · {fan.pointsSpent} spent · <span className="text-amber-300 font-bold">{fan.balance} to spend</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(detail.bySource) as [keyof typeof SOURCE_NAMES, number][])
              .filter(([, n]) => n)
              .map(([s, n]) => (
                <Chip key={s} tone={s === 'prize' ? 'blue' : n < 0 ? 'red' : 'slate'}>
                  {SOURCE_NAMES[s]}: {n > 0 ? '+' : ''}
                  {n}
                </Chip>
              ))}
            {detail.unitemised !== 0 && <Chip>Before history was kept: {detail.unitemised}</Chip>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_auto] gap-2 items-end">
            <Field label="Points (+/−)">
              <TextInput type="number" inputMode="numeric" value={delta} onChange={e => setDelta(e.target.value)} placeholder="e.g. -50" />
            </Field>
            <Field label="Reason (the fan sees this)">
              <TextInput value={reason} onChange={e => setReason(e.target.value)} maxLength={200} placeholder="e.g. Duplicate account removed" />
            </Field>
            <Button variant="primary" onClick={adjust} loading={busy === 'adjust'}>
              Adjust
            </Button>
          </div>
          {detail.claims.length > 0 && (
            <ul className="text-sm divide-y divide-slate-800">
              {detail.claims.map(c => (
                <li key={c.id} className="py-1.5 flex flex-wrap gap-2 items-center">
                  <span className="font-mono text-amber-300">{c.code}</span>
                  <span className="text-white">{c.prizeTitle}</span>
                  <span className="text-slate-400">{c.pointsCost} pts</span>
                  <Chip tone={statusTone(c.status === 'fulfilled' ? 'success' : c.status === 'cancelled' ? 'rejected' : 'pending')}>{c.status}</Chip>
                </li>
              ))}
            </ul>
          )}
          <div className="rounded-xl border border-slate-800 divide-y divide-slate-800 max-h-[480px] overflow-y-auto">
            {detail.ledger.length === 0 ? <p className="p-3 text-sm text-slate-400">No changes recorded yet.</p> : detail.ledger.map(e => <PointsRow key={e.id} e={e} />)}
          </div>
        </div>
      )}
    </Card>
  );
};

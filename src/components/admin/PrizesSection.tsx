import React, { useEffect, useState } from 'react';
import { Check, Edit3, Plus, Trash2, X } from 'lucide-react';
import { api } from '../../api';
import type { PrizeItem, PrizeRedemption, Team } from '../../types';
import { Actions, Button, Card, Checkbox, Chip, EmptyState, Errors, Field, Notice, SectionHeader, Select, Sheet, TextArea, TextInput, isHttpsUrl, statusTone, useRunner } from './ui';

type Draft = { id?: string; title: string; description: string; image: string; pointsCost: string; stock: string; teamOnly: string; active: boolean; fulfilment: string };
const blank: Draft = { title: '', description: '', image: '', pointsCost: '200', stock: '10', teamOnly: '', active: true, fulfilment: 'Show your claim code at the Fan Zone merchandise desk.' };

/** Rewards fans can claim with points, and the claims waiting to be fulfilled. */
export const PrizesSection: React.FC<{ teams: Team[] }> = ({ teams }) => {
  const [prizes, setPrizes] = useState<PrizeItem[]>([]);
  const [claims, setClaims] = useState<PrizeRedemption[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const { busy, notice, setNotice, run } = useRunner();
  const load = async () => {
    const r = await api.getAdminPrizes().catch(e => {
      setNotice({ kind: 'err', text: e.message });
      return null;
    });
    if (r) {
      setPrizes(r.prizes);
      setClaims(r.redemptions);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!draft) return;
    const e: Errors = {};
    if (!draft.title.trim()) e.title = 'Name the prize.';
    if (!(Number(draft.pointsCost) >= 1)) e.pointsCost = 'Set a points cost of at least 1.';
    if (!(Number(draft.stock) >= 0)) e.stock = 'Stock cannot be negative.';
    if (!draft.fulfilment.trim()) e.fulfilment = 'Say how fans receive it.';
    if (draft.image && !isHttpsUrl(draft.image)) e.image = 'Image must be an https:// link.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const r = await run('save', () => api.savePrize({ id: draft.id, title: draft.title.trim(), description: draft.description.trim(), image: draft.image.trim() || undefined, pointsCost: Number(draft.pointsCost), stock: Number(draft.stock), teamOnly: draft.teamOnly || null, active: draft.active, fulfilment: draft.fulfilment.trim() }), 'Prize saved.');
    if (r) {
      setDraft(null);
      load();
    }
  };
  const remove = async (p: PrizeItem) => {
    if (!window.confirm(`Delete "${p.title}"?`)) return;
    if (await run(`del:${p.id}`, () => api.deletePrize(p.id), 'Prize deleted.')) load();
  };
  const decide = async (c: PrizeRedemption, status: 'fulfilled' | 'cancelled') => {
    const note = status === 'cancelled' ? window.prompt('Reason for cancelling (shown to the fan; points are refunded):') ?? undefined : undefined;
    if (status === 'cancelled' && note === undefined) return;
    if (await run(`c:${c.id}`, () => api.updateRedemption(c.id, status, note), status === 'fulfilled' ? 'Marked as fulfilled. The fan has been notified.' : 'Cancelled and points refunded.')) load();
  };

  const list = claims.filter(c => filter === 'all' || c.status === 'pending');
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Prizes & claims"
        description="Fans spend points on these. Spending never lowers their leaderboard score. Each claim gets a code; fulfil it when the fan collects, or cancel to refund the points."
        actions={<Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => { setErrors({}); setDraft({ ...blank }); }}>Add prize</Button>}
      />
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {prizes.length === 0 ? (
        <EmptyState title="No prizes yet" description="Add rewards such as signed merchandise, Fan Space VIP upgrades or matchday tickets." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {prizes.map(p => {
            const claimed = claims.filter(c => c.prizeId === p.id && c.status !== 'cancelled').length;
            return (
              <Card key={p.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-white">{p.title}</span>
                  <Chip tone="amber">{p.pointsCost} pts</Chip>
                  <Chip tone={p.active ? 'green' : 'slate'}>{p.active ? 'active' : 'off'}</Chip>
                  <Chip>{claimed}/{p.stock} claimed</Chip>
                  {p.teamOnly && <Chip tone="blue">{teams.find(t => t.id === p.teamOnly)?.short} fans</Chip>}
                </div>
                {p.description && <p className="text-sm text-slate-400 mt-2">{p.description}</p>}
                <p className="text-xs text-slate-500 mt-1">{p.fulfilment}</p>
                <Actions className="mt-3">
                  <Button size="sm" icon={<Edit3 className="w-4 h-4" />} onClick={() => { setErrors({}); setDraft({ id: p.id, title: p.title, description: p.description, image: p.image || '', pointsCost: String(p.pointsCost), stock: String(p.stock), teamOnly: p.teamOnly || '', active: p.active, fulfilment: p.fulfilment }); }}>Edit</Button>
                  <Button size="sm" variant="danger" icon={<Trash2 className="w-4 h-4" />} loading={busy === `del:${p.id}`} onClick={() => remove(p)}>Delete</Button>
                </Actions>
              </Card>
            );
          })}
        </div>
      )}
      <Card>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-extrabold text-white">Claims</h3>
          <Select value={filter} onChange={e => setFilter(e.target.value as any)} aria-label="Filter claims" className="max-w-[200px]">
            <option value="pending">To fulfil ({claims.filter(c => c.status === 'pending').length})</option>
            <option value="all">All ({claims.length})</option>
          </Select>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing to fulfil.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {list.map(c => (
              <li key={c.id} className="py-2.5 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono text-amber-300">{c.code}</span>
                <span className="text-white font-bold">{c.prizeTitle}</span>
                <span className="text-slate-400">{c.userName} · {c.userEmail}</span>
                <Chip tone={statusTone(c.status === 'fulfilled' ? 'success' : c.status === 'cancelled' ? 'rejected' : 'pending')}>{c.status}</Chip>
                <span className="text-xs text-slate-500">{new Date(c.createdAt).toLocaleString()}</span>
                {c.status === 'pending' && (
                  <span className="ms-auto flex gap-2">
                    <Button size="sm" variant="success" icon={<Check className="w-4 h-4" />} loading={busy === `c:${c.id}`} onClick={() => decide(c, 'fulfilled')}>Fulfilled</Button>
                    <Button size="sm" variant="danger" icon={<X className="w-4 h-4" />} onClick={() => decide(c, 'cancelled')}>Cancel</Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Sheet open={!!draft} title={draft?.id ? 'Edit prize' : 'Add prize'} onClose={() => setDraft(null)} footer={<><Button onClick={() => setDraft(null)}>Cancel</Button><Button variant="primary" onClick={save} loading={busy === 'save'}>Save prize</Button></>}>
        {draft && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Prize" required error={errors.title} className="sm:col-span-2"><TextInput value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} error={!!errors.title} /></Field>
            <Field label="Description" className="sm:col-span-2"><TextArea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></Field>
            <Field label="Points cost" required error={errors.pointsCost}><TextInput type="number" min={1} value={draft.pointsCost} onChange={e => setDraft({ ...draft, pointsCost: e.target.value })} error={!!errors.pointsCost} /></Field>
            <Field label="Stock" required error={errors.stock} hint="How many can be claimed in total"><TextInput type="number" min={0} value={draft.stock} onChange={e => setDraft({ ...draft, stock: e.target.value })} error={!!errors.stock} /></Field>
            <Field label="Only for fans of"><Select value={draft.teamOnly} onChange={e => setDraft({ ...draft, teamOnly: e.target.value })}><option value="">Any team</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
            <Field label="Image link" error={errors.image} hint="Optional https:// image"><TextInput type="url" value={draft.image} onChange={e => setDraft({ ...draft, image: e.target.value })} error={!!errors.image} /></Field>
            <Field label="How fans receive it" required error={errors.fulfilment} className="sm:col-span-2"><TextArea rows={2} value={draft.fulfilment} onChange={e => setDraft({ ...draft, fulfilment: e.target.value })} /></Field>
            <Checkbox label="Active (visible to fans)" checked={draft.active} onChange={v => setDraft({ ...draft, active: v })} />
          </div>
        )}
      </Sheet>
    </div>
  );
};

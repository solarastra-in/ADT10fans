import React, { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { ProposalActivity, ProposalSettings } from '../../types';
import { api } from '../../api';
import { Button, Card, EmptyState, Field, Notice, SectionHeader, Stat, TextArea, TextInput, toNumber, useRunner } from './ui';

const REVENUE_FIELDS: { key: keyof ProposalSettings['revenueStreams']; label: string }[] = [
  { key: 'predictorSponsorshipUsd', label: 'Predictor title sponsorship (USD)' },
  { key: 'fantasySponsorshipUsd', label: 'Fantasy title sponsorship (USD)' },
  { key: 'fanSpacesNamingRightsUsd', label: 'Fan spaces naming rights (USD)' },
  { key: 'merchAndFbUsd', label: 'Fan spaces merch & F&B (USD)' },
  { key: 'superfanPassportUsers', label: 'Projected passport members' },
  { key: 'superfanPassportFeeUsd', label: 'Passport fee per member (USD)' },
];

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

export const ProposalSection: React.FC = () => {
  const { busy, notice, setNotice, run } = useRunner();
  const [p, setP] = useState<ProposalSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getProposalSettings();
      setP(res.proposalSettings || null);
    } catch (e: any) {
      setNotice({ kind: 'err', text: e?.message || 'Could not load the proposal' });
    } finally {
      setLoading(false);
    }
  }, [setNotice]);

  useEffect(() => {
    load();
  }, [load]);

  if (!p) {
    return (
      <div className="space-y-5">
        <SectionHeader title="League proposal" description="Confidential — admin only." />
        <Notice notice={notice} />
        <EmptyState title={loading ? 'Loading…' : 'No proposal settings found'} />
      </div>
    );
  }

  const rate = p.exchangeRateUsdToAed || 0;
  const activities = p.activities || [];
  const rev = p.revenueStreams || ({} as ProposalSettings['revenueStreams']);
  const totalBudget = activities.reduce((a, x) => a + (x.capexUsd || 0) + (x.opexUsd || 0), 0);
  const grossRev =
    (rev.predictorSponsorshipUsd || 0) +
    (rev.fantasySponsorshipUsd || 0) +
    (rev.fanSpacesNamingRightsUsd || 0) +
    (rev.merchAndFbUsd || 0) +
    (rev.superfanPassportUsers || 0) * (rev.superfanPassportFeeUsd || 0);
  const net = grossRev - totalBudget;
  const roi = totalBudget > 0 ? Math.round((net / totalBudget) * 100) : null;

  const setActivity = (i: number, patch: Partial<ProposalActivity>) => {
    const next = activities.map((a, idx) => {
      if (idx !== i) return a;
      const merged = { ...a, ...patch };
      const usdCost = (merged.capexUsd || 0) + (merged.opexUsd || 0);
      return { ...merged, usdCost, aedCost: Math.round(usdCost * rate) };
    });
    setP({ ...p, activities: next });
  };

  const save = async () => {
    const res = await run('save', () => api.saveProposalSettings(p), 'Proposal saved.');
    if (res?.proposalSettings) setP(res.proposalSettings);
  };

  const reset = async () => {
    if (!window.confirm('Reset the proposal to its original figures? Your edits will be lost.')) return;
    const res = await run('reset', () => api.resetProposalSettings(), 'Proposal reset.');
    if (res?.proposalSettings) setP(res.proposalSettings);
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="League proposal"
        description="Confidential — admin only. These projections feed the proposal page; they are planning figures, not results."
        actions={
          <>
            <Button size="sm" onClick={reset} loading={busy === 'reset'} icon={<RotateCcw className="w-4 h-4" />}>
              Reset
            </Button>
            <Button size="sm" variant="primary" onClick={save} loading={busy === 'save'} icon={<Save className="w-4 h-4" />}>
              Save proposal
            </Button>
          </>
        }
      />
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total budget" value={usd(totalBudget)} hint={rate ? `${Math.round(totalBudget * rate).toLocaleString()} AED` : undefined} />
        <Stat label="Projected revenue" value={usd(grossRev)} hint={rate ? `${Math.round(grossRev * rate).toLocaleString()} AED` : undefined} />
        <Stat label="Projected net" value={`${net < 0 ? '-' : ''}${usd(Math.abs(net))}`} />
        <Stat label="Projected ROI" value={roi === null ? '—' : `${roi}%`} hint={roi === null ? 'Add activity costs' : undefined} />
      </div>

      <Card className="space-y-3">
        <h3 className="font-extrabold text-white">Revenue assumptions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {REVENUE_FIELDS.map(f => (
            <Field key={f.key} label={f.label}>
              <TextInput
                type="number"
                inputMode="decimal"
                min={0}
                value={String(rev[f.key] ?? 0)}
                onChange={e => setP({ ...p, revenueStreams: { ...rev, [f.key]: toNumber(e.target.value, 0) } })}
              />
            </Field>
          ))}
          <Field label="Exchange rate (1 USD → AED)">
            <TextInput type="number" inputMode="decimal" step="0.0001" min={0} value={String(p.exchangeRateUsdToAed ?? '')} onChange={e => setP({ ...p, exchangeRateUsdToAed: toNumber(e.target.value, 0) })} />
          </Field>
        </div>
      </Card>

      <div className="space-y-3">
        <h3 className="font-extrabold text-white">Activities ({activities.length})</h3>
        {activities.map((a, i) => (
          <Card key={a.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center shrink-0">{a.number}</span>
              <span className="text-sm font-mono text-amber-300 ml-auto text-right">
                {usd((a.capexUsd || 0) + (a.opexUsd || 0))}
                {rate ? ` · ${Math.round(((a.capexUsd || 0) + (a.opexUsd || 0)) * rate).toLocaleString()} AED` : ''}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Title" className="sm:col-span-2">
                <TextInput value={a.title} onChange={e => setActivity(i, { title: e.target.value })} />
              </Field>
              <Field label="CapEx (USD)">
                <TextInput type="number" inputMode="decimal" min={0} value={String(a.capexUsd ?? 0)} onChange={e => setActivity(i, { capexUsd: toNumber(e.target.value, 0) })} />
              </Field>
              <Field label="OpEx (USD)">
                <TextInput type="number" inputMode="decimal" min={0} value={String(a.opexUsd ?? 0)} onChange={e => setActivity(i, { opexUsd: toNumber(e.target.value, 0) })} />
              </Field>
              <Field label="Scope">
                <TextArea rows={3} value={a.what} onChange={e => setActivity(i, { what: e.target.value })} />
              </Field>
              <Field label="Expected outcome">
                <TextArea rows={3} value={a.outcome} onChange={e => setActivity(i, { outcome: e.target.value })} />
              </Field>
              <Field label="Timeline">
                <TextInput value={a.timeline} onChange={e => setActivity(i, { timeline: e.target.value })} />
              </Field>
              <Field label="KPIs" hint="Comma-separated">
                <TextInput
                  defaultValue={(a.kpis || []).join(', ')}
                  key={`${a.id}-${(a.kpis || []).join('|')}`}
                  onBlur={e =>
                    setActivity(i, {
                      kpis: e.target.value
                        .split(',')
                        .map(s => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

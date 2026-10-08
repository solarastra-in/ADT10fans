import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Approval } from '../../types';
import { api } from '../../api';
import { Actions, Button, Card, Chip, EmptyState, Notice, SectionHeader, Select, formatDateTime, statusTone, useRunner } from './ui';

export const ApprovalsSection: React.FC<{ approvals: Approval[]; onRefreshAll: () => Promise<void> }> = ({ approvals, onRefreshAll }) => {
  const { busy, notice, setNotice, run } = useRunner();
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const list = approvals
    .filter(a => filter === 'all' || a.status === 'pending')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const decide = async (a: Approval, decision: 'approve' | 'reject') => {
    const res = await run(`${decision}:${a.id}`, () => api.decideApproval(a.id, decision), decision === 'approve' ? 'Approved.' : 'Rejected.');
    if (res) await onRefreshAll();
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Approvals" description="Items agents found that need a human decision before fans see them." />
      <Select value={filter} onChange={e => setFilter(e.target.value as any)} aria-label="Filter approvals" className="sm:max-w-xs">
        <option value="pending">Pending ({approvals.filter(a => a.status === 'pending').length})</option>
        <option value="all">All ({approvals.length})</option>
      </Select>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {list.length === 0 ? (
        <EmptyState title={filter === 'pending' ? 'Nothing waiting for review' : 'No approvals yet'} />
      ) : (
        <ul className="space-y-3">
          {list.map(a => (
            <li key={a.id}>
              <Card className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone={statusTone(a.status)}>{a.status}</Chip>
                  <Chip>{a.kind}</Chip>
                  <span className="text-xs text-slate-500">{formatDateTime(a.createdAt)}</span>
                </div>
                <p className="font-bold text-white break-words">{a.title}</p>
                <p className="text-sm text-slate-400 break-words">{a.detail}</p>
                {a.payload?.url && (
                  <a href={a.payload.url} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-300 hover:underline break-all">
                    {a.payload.url}
                  </a>
                )}
                {a.status === 'pending' && (
                  <Actions>
                    <Button size="sm" variant="success" icon={<Check className="w-4 h-4" />} loading={busy === `approve:${a.id}`} onClick={() => decide(a, 'approve')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="danger" icon={<X className="w-4 h-4" />} loading={busy === `reject:${a.id}`} onClick={() => decide(a, 'reject')}>
                      Reject
                    </Button>
                  </Actions>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Edit3, Check, X, ExternalLink } from 'lucide-react';
import { Approval, SocialHandle, Team } from '../../types';
import { api } from '../../api';
import { Actions, Button, Card, Chip, EmptyState, Errors, Field, Notice, SectionHeader, Select, Sheet, TextInput, isHttpsUrl, statusTone, useRunner } from './ui';
import { HANDLE_PLATFORMS, teamName } from './shared';

type Draft = { id?: string; teamId: string; platform: SocialHandle['platform']; handle: string; url: string; status: SocialHandle['status'] };

const blank: Draft = { teamId: '', platform: 'X', handle: '', url: '', status: 'verified' };

export const HandlesSection: React.FC<{
  handles: SocialHandle[];
  teams: Team[];
  approvals: Approval[];
  onRefreshAll: () => Promise<void>;
}> = ({ handles, teams, approvals, onRefreshAll }) => {
  const { busy, notice, setNotice, run } = useRunner();
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending'>('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  const pendingApprovalFor = (h: SocialHandle) =>
    approvals.find(a => a.status === 'pending' && a.kind === 'handle' && (a.payload?.handleId === h.id || a.payload?.url === h.url));

  const filtered = useMemo(
    () =>
      handles
        .filter(h => statusFilter === 'all' || h.status === statusFilter)
        .filter(h => teamFilter === 'all' || (teamFilter === 'league' ? !h.teamId : h.teamId === teamFilter))
        .sort((a, b) => (a.status === b.status ? 0 : a.status === 'pending' ? -1 : 1)),
    [handles, statusFilter, teamFilter]
  );

  const pendingCount = handles.filter(h => h.status === 'pending').length;

  const save = async () => {
    if (!draft) return;
    const e: Errors = {};
    if (!draft.url.trim()) e.url = 'URL is required.';
    else if (!isHttpsUrl(draft.url)) e.url = 'URL must start with https://';
    if (!draft.handle.trim()) e.handle = 'Handle / display name is required.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await run(
      'save',
      () =>
        api.saveHandle({
          id: draft.id,
          teamId: draft.teamId || null,
          platform: draft.platform,
          handle: draft.handle.trim(),
          url: draft.url.trim(),
          status: draft.status,
        }),
      'Handle saved.'
    );
    if (res) {
      setDraft(null);
      await onRefreshAll();
    }
  };

  const approve = async (h: SocialHandle) => {
    const ap = pendingApprovalFor(h);
    const res = await run(
      `ap:${h.id}`,
      async (): Promise<unknown> => (ap ? api.decideApproval(ap.id, 'approve') : api.saveHandle({ ...h, status: 'verified' })),
      `${h.handle} verified.`
    );
    if (res) await onRefreshAll();
  };

  const reject = async (h: SocialHandle) => {
    if (!window.confirm(`Reject and delete ${h.handle}?`)) return;
    const ap = pendingApprovalFor(h);
    const res = await run(
      `rej:${h.id}`,
      async () => {
        if (ap) await api.decideApproval(ap.id, 'reject');
        return api.deleteHandle(h.id);
      },
      `${h.handle} rejected.`
    );
    if (res) await onRefreshAll();
  };

  const remove = async (h: SocialHandle) => {
    if (!window.confirm(`Delete ${h.platform} handle ${h.handle}?`)) return;
    const res = await run(`del:${h.id}`, () => api.deleteHandle(h.id), 'Handle deleted.');
    if (res) await onRefreshAll();
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Social handles"
        description="Only verified handles are shown to fans and used for feed syncing."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setErrors({});
              setDraft({ ...blank });
            }}
          >
            Add handle
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} aria-label="Filter by status">
          <option value="all">All statuses ({handles.length})</option>
          <option value="pending">Pending ({pendingCount})</option>
          <option value="verified">Verified ({handles.length - pendingCount})</option>
        </Select>
        <Select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} aria-label="Filter by team">
          <option value="all">All teams</option>
          <option value="league">League-wide</option>
          {teams.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      {filtered.length === 0 ? (
        <EmptyState title="No handles match" description="Add official handles manually, or seed the official franchises from the Teams tab." />
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(h => (
            <li key={h.id}>
              <Card className="flex flex-col gap-2 h-full">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={statusTone(h.status)}>{h.status}</Chip>
                  <Chip>{h.platform}</Chip>
                  <span className="text-xs text-slate-400">{teamName(teams, h.teamId)}</span>
                </div>
                <p className="font-bold text-white break-words">{h.handle}</p>
                <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-300 hover:underline break-all inline-flex items-center gap-1">
                  {h.url} <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
                {h.source && <p className="text-xs text-slate-500">Source: {h.source}</p>}
                <Actions className="mt-auto pt-1">
                  {h.status === 'pending' && (
                    <>
                      <Button size="sm" variant="success" icon={<Check className="w-4 h-4" />} loading={busy === `ap:${h.id}`} onClick={() => approve(h)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="danger" icon={<X className="w-4 h-4" />} loading={busy === `rej:${h.id}`} onClick={() => reject(h)}>
                        Reject
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    icon={<Edit3 className="w-4 h-4" />}
                    onClick={() => {
                      setErrors({});
                      setDraft({ id: h.id, teamId: h.teamId || '', platform: h.platform, handle: h.handle, url: h.url, status: h.status });
                    }}
                  >
                    Edit
                  </Button>
                  {h.status !== 'pending' && (
                    <Button size="sm" variant="danger" icon={<Trash2 className="w-4 h-4" />} loading={busy === `del:${h.id}`} onClick={() => remove(h)}>
                      Delete
                    </Button>
                  )}
                </Actions>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={!!draft}
        title={draft?.id ? 'Edit handle' : 'Add handle'}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={busy === 'save'}>
              Save handle
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Team">
              <Select value={draft.teamId} onChange={e => setDraft({ ...draft, teamId: e.target.value })}>
                <option value="">League-wide</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Platform">
              <Select value={draft.platform} onChange={e => setDraft({ ...draft, platform: e.target.value as SocialHandle['platform'] })}>
                {HANDLE_PLATFORMS.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Profile URL" required error={errors.url} className="sm:col-span-2">
              <TextInput type="url" inputMode="url" placeholder="https://" value={draft.url} onChange={e => setDraft({ ...draft, url: e.target.value })} error={!!errors.url} />
            </Field>
            <Field label="Handle" required error={errors.handle} hint="e.g. @uaebulls">
              <TextInput value={draft.handle} onChange={e => setDraft({ ...draft, handle: e.target.value })} error={!!errors.handle} />
            </Field>
            <Field label="Status">
              <Select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as SocialHandle['status'] })}>
                <option value="verified">Verified (visible to fans)</option>
                <option value="pending">Pending review</option>
              </Select>
            </Field>
          </div>
        )}
      </Sheet>
    </div>
  );
};

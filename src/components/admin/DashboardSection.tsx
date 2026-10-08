import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { AgentRun, Approval } from '../../types';
import { api } from '../../api';
import { Button, Card, Chip, EmptyState, Notice, SectionHeader, Stat, formatDateTime, statusTone, useRunner } from './ui';
import { AdminSectionId } from './shared';

interface DashboardData {
  usersCount?: number;
  handlesCount?: number;
  feedItemsCount?: number;
  matchesCount?: number;
  contestsCount?: number;
  drawsCount?: number;
  notificationsCount?: number;
  fcmSubscribersCount?: number;
  pendingApprovals?: Approval[];
  agentRuns?: AgentRun[];
  integrations?: {
    gemini?: boolean;
    smtp?: boolean;
    pushServer?: boolean;
    googleSignIn?: boolean;
    curator?: boolean;
  };
}

const INTEGRATIONS: { key: keyof NonNullable<DashboardData['integrations']>; label: string; howTo: string }[] = [
  { key: 'gemini', label: 'Gemini AI', howTo: 'Set GEMINI_API_KEY on the server' },
  { key: 'smtp', label: 'Email (SMTP)', howTo: 'Fill in SMTP in Settings and enable it' },
  { key: 'pushServer', label: 'Push notifications (FCM)', howTo: 'Configure Firebase Admin credentials on the server' },
  { key: 'googleSignIn', label: 'Google sign-in', howTo: 'Configure Firebase Auth (web config + Admin credentials)' },
  { key: 'curator', label: 'Curator social wall', howTo: 'Enter Curator feed / container IDs in Settings' },
];

const AGENTS: { name: string; label: string; desc: string }[] = [
  { name: 'discovery', label: 'Discovery', desc: 'Look for official team handles (results go to approvals)' },
  { name: 'social', label: 'Social', desc: 'Pull posts from verified official handles' },
  { name: 'news', label: 'News', desc: 'Fetch headlines for the configured news queries' },
  { name: 'content', label: 'Content', desc: 'Draft copy for admin review' },
  { name: 'ops', label: 'Ops', desc: 'Check links and summarise pending work' },
];

export const DashboardSection: React.FC<{
  agentRuns: AgentRun[];
  approvals: Approval[];
  onRefreshAll: () => Promise<void>;
  goTo: (id: AdminSectionId) => void;
}> = ({ agentRuns: propRuns, approvals, onRefreshAll, goTo }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { busy, notice, setNotice, run } = useRunner();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setData(await api.getAdminDashboard());
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAgent = async (name: string) => {
    const res = await run(`agent:${name}`, () => api.runAgent(name));
    if (!res) return;
    const r = res.result || {};
    const status: string = r.status || 'success';
    setNotice({
      kind: status === 'error' ? 'err' : status === 'warning' ? 'warn' : 'ok',
      text: `${name} agent: ${r.summary || 'finished'}${typeof r.items === 'number' ? ` (${r.items} item${r.items === 1 ? '' : 's'})` : ''}`,
      details: Array.isArray(r.errors) ? r.errors : undefined,
    });
    await Promise.all([load(), onRefreshAll()]);
  };

  const runs = data?.agentRuns || propRuns;
  const pending = data?.pendingApprovals || approvals.filter(a => a.status === 'pending');
  const n = (v?: number) => (typeof v === 'number' ? v.toLocaleString() : '—');

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Dashboard"
        description="Live counts from the server. Nothing here is estimated."
        actions={
          <Button size="sm" onClick={load} loading={loading} icon={<RefreshCw className="w-4 h-4" />}>
            Refresh
          </Button>
        }
      />

      {loadError && <Notice notice={{ kind: 'err', text: loadError }} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Registered users" value={n(data?.usersCount)} />
        <Stat label="Push subscribers" value={n(data?.fcmSubscribersCount)} onClick={() => goTo('notifications')} />
        <Stat label="Handles" value={n(data?.handlesCount)} onClick={() => goTo('handles')} />
        <Stat label="Feed items" value={n(data?.feedItemsCount)} onClick={() => goTo('feeds')} />
        <Stat label="Matches" value={n(data?.matchesCount)} onClick={() => goTo('matches')} />
        <Stat label="Contests" value={n(data?.contestsCount)} onClick={() => goTo('contests')} />
        <Stat label="Draws" value={n(data?.drawsCount)} onClick={() => goTo('draws')} />
        <Stat label="Pending approvals" value={pending.length.toLocaleString()} onClick={() => goTo('approvals')} />
      </div>

      <Card>
        <h3 className="font-extrabold text-white mb-3">Integrations</h3>
        {!data?.integrations ? (
          <p className="text-sm text-slate-400">{loading ? 'Checking…' : 'Integration status was not returned by the server.'}</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {INTEGRATIONS.map(i => {
              const ok = !!data.integrations?.[i.key];
              return (
                <li key={i.key} className="py-2.5 flex items-start gap-3">
                  {ok ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">{i.label}</p>
                    <p className="text-xs text-slate-400">{ok ? 'Configured' : `Missing — ${i.howTo}`}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="font-extrabold text-white mb-1">Run agents</h3>
        <p className="text-sm text-slate-400 mb-3">Agents report honestly — a warning or error means something needs attention.</p>
        <Notice notice={notice} onClose={() => setNotice(null)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
          {AGENTS.map(a => (
            <button
              key={a.name}
              type="button"
              onClick={() => runAgent(a.name)}
              disabled={busy !== null}
              className="min-h-[44px] p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-400/50 text-left disabled:opacity-50 flex items-start gap-3"
            >
              {busy === `agent:${a.name}` ? (
                <RefreshCw className="w-4 h-4 mt-0.5 text-amber-400 animate-spin shrink-0" />
              ) : (
                <Play className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-bold text-amber-300">{a.label} agent</span>
                <span className="block text-xs text-slate-400">{a.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-extrabold text-white mb-3">Recent agent runs</h3>
        {runs.length === 0 ? (
          <EmptyState title="No agent runs yet" />
        ) : (
          <ul className="space-y-2">
            {runs.slice(0, 12).map(r => (
              <li key={r.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-sm font-black text-amber-300">{r.agent}</span>
                  <Chip tone={statusTone(r.status)}>{r.status}</Chip>
                  <span className="text-xs text-slate-500">{formatDateTime(r.startedAt)}</span>
                </div>
                <p className="text-sm text-slate-300 break-words">{r.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

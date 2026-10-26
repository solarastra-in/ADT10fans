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
  fantasyLineups?: number;
  gamePlaysToday?: number;
  pendingRedemptions?: number;
  openReports?: number;
  warnings?: string[];
  integrations?: {
    gemini?: boolean;
    smtp?: boolean;
    pushServer?: boolean;
    pushClient?: boolean;
    googleSignIn?: boolean;
    curator?: boolean;
    liveScores?: boolean;
    sharedStorage?: boolean;
    persistentStorage?: boolean;
    scheduledJobs?: boolean;
    storage?: string;
    lastScheduledRun?: string | null;
  };
}

const INTEGRATIONS: { key: keyof NonNullable<DashboardData['integrations']>; label: string; howTo: string }[] = [
  { key: 'persistentStorage', label: 'Data saved in Firebase (Firestore)', howTo: 'Set FIREBASE_SERVICE_ACCOUNT in Vercel (Firebase console → Project settings → Service accounts → Generate new private key), then redeploy. This is the only value that must be set outside this console.' },
  { key: 'scheduledJobs', label: 'Scheduled jobs (reminders, live scores, feeds)', howTo: 'Run by themselves every few minutes while people use the site' },
  { key: 'smtp', label: 'Email sign-in codes', howTo: 'Fill in the email (SMTP) settings in Environment or Settings' },
  { key: 'googleSignIn', label: 'Google sign-in', howTo: 'Uses the Firebase project in firebase-applet-config.json' },
  { key: 'pushServer', label: 'Push sending', howTo: 'Comes with FIREBASE_SERVICE_ACCOUNT' },
  { key: 'pushClient', label: 'Push sign-up in browsers', howTo: 'Add the web push key (VAPID) in Environment' },
  { key: 'liveScores', label: 'Live scores (CricketData.org)', howTo: 'Add the CricketData.org API key in Environment, then link fixtures in Matches' },
  { key: 'curator', label: 'Curator.io social wall', howTo: 'Enter a Curator feed id in Settings' },
  { key: 'gemini', label: 'AI copy helper (Gemini)', howTo: 'Add the Gemini API key in Environment' },
];

const AGENTS: { name: string; label: string; desc: string }[] = [
  { name: 'discovery', label: 'Discovery', desc: 'Look for official team handles (results go to approvals)' },
  { name: 'social', label: 'Social', desc: 'Pull videos from the verified YouTube channels' },
  { name: 'scores', label: 'Scores', desc: 'Flag fixtures that should be live or need a result' },
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
        <Stat label="Pick XI lineups" value={n(data?.fantasyLineups)} onClick={() => goTo('fantasy')} />
        <Stat label="Daily games played today" value={n(data?.gamePlaysToday)} />
        <Stat label="Prize claims to fulfil" value={n(data?.pendingRedemptions)} onClick={() => goTo('prizes')} />
        <Stat label="Open forum reports" value={n(data?.openReports)} onClick={() => goTo('forum')} />
      </div>

      {(data?.warnings || []).map(w => (
        <Notice key={w} notice={{ kind: 'warn', text: w }} />
      ))}

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
        {data?.integrations?.storage && <p className="mt-3 text-xs text-slate-500">Store: {data.integrations.storage}{data.integrations.sharedStorage ? ' (shared, safe for several instances)' : ''} · Last scheduled run: {data.integrations.lastScheduledRun ? formatDateTime(data.integrations.lastScheduledRun) : 'never'}</p>}
        <div className="mt-3">
          <Button
            size="sm"
            loading={busy === 'jobs'}
            onClick={async () => {
              const r = await run('jobs', () => api.runScheduledJobs());
              if (r) {
                setNotice({ kind: 'ok', text: `Scheduled jobs finished in ${r.tookMs} ms.`, details: Object.entries(r.jobs || {}).map(([k, v]) => `${k}: ${JSON.stringify(v)}`) });
                await load();
              }
            }}
            icon={<Play className="w-4 h-4" />}
          >
            Run scheduled jobs now
          </Button>
        </div>
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

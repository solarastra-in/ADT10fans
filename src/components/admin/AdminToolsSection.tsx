import React, { useState } from 'react';
import { 
  Wrench, 
  RefreshCw, 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Zap, 
  Globe, 
  Users, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp, 
  Terminal, 
  Layers, 
  Activity,
  ArrowRight,
  Save
} from 'lucide-react';
import { Team } from '../../types';
import { api } from '../../api';
import { CricketSyncResult } from '../../types';
import { Button, Card, Checkbox, Field, Notice, SectionHeader, Select, TextInput, useRunner } from './ui';

export const AdminToolsSection: React.FC<{
  teams: Team[];
  onRefreshAll: () => Promise<void>;
  goToSection?: (sectionId: any) => void;
}> = ({ teams = [], onRefreshAll, goToSection }) => {
  const { busy, notice, setNotice, run } = useRunner();

  // Cricket Provider State
  const [provider, setProvider] = useState<'cricbuzz' | 'cricketdata' | 'custom'>('cricbuzz');
  const [seriesId, setSeriesId] = useState('13307');
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [overwrite, setOverwrite] = useState(true);

  // Connection Test & Sync Results
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    success?: boolean;
    latencyMs?: number;
    message?: string;
  } | null>(null);

  const [syncResult, setSyncResult] = useState<CricketSyncResult | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(true);

  // Test provider connection
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await api.testCricketProvider({
        provider,
        seriesId: seriesId.trim(),
        apiUrl: apiUrl.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
      });
      setConnectionStatus({
        tested: true,
        success: res.success,
        latencyMs: res.latencyMs,
        message: res.message,
      });
      if (res.success) {
        setNotice({ kind: 'ok', text: `Provider reachable: ${res.message} (${res.latencyMs}ms)` });
      } else {
        setNotice({ kind: 'err', text: res.message || 'Connection test failed' });
      }
    } catch (e: any) {
      setConnectionStatus({
        tested: true,
        success: false,
        message: e?.message || 'Connection test failed',
      });
      setNotice({ kind: 'err', text: e?.message || 'Connection error' });
    } finally {
      setTestingConnection(false);
    }
  };

  // Trigger automated fetch, format, and persist script
  const handleFetchAndPersist = async () => {
    await run(
      'fetch-squads',
      async () => {
        setSyncResult(null);
        const res = await api.fetchAndPersistCricketSquads({
          provider,
          seriesId: seriesId.trim(),
          apiUrl: apiUrl.trim() || undefined,
          apiKey: apiKey.trim() || undefined,
          overwrite,
        });

        setSyncResult(res);
        await onRefreshAll();

        if (!res.success) {
          throw new Error(res.error || 'Cricket provider sync failed');
        }
        return res;
      },
      (res: CricketSyncResult) => `Automated sync completed! ${res.teamsCount} teams and ${res.playersCount} squad members formatted and persisted in ${res.executionTimeMs}ms.`
    );
  };

  // Fast seed action
  const handleSeedOfficialSnapshot = async () => {
    await run(
      'seed-official',
      async () => {
        const res = await api.seedOfficialTeams(true);
        await onRefreshAll();
        return res;
      },
      (res) => res.summary || 'Official Cricbuzz 2026 franchises and confirmed squads seeded successfully.'
    );
  };

  // Re-sync all social feeds
  const handleSyncSocialFeeds = async () => {
    await run(
      'sync-social',
      async () => {
        const res = await api.syncRealFeeds();
        await onRefreshAll();
        return res;
      },
      (res) => res.summary || `Synced ${res.syncedCount} posts across verified franchise handles.`
    );
  };

  const totalPlayersInDb = teams.reduce((acc, t) => acc + (t.squad?.length || 0), 0);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Cricket Data Provider & Admin Tools"
        description="Trigger automated scripts to fetch official franchise & squad data from reliable cricket data providers, format into Team/Squad structures, and persist in the database."
      />

      <Notice notice={notice} />

      {/* Main Automation Card */}
      <Card className="p-5 sm:p-6 space-y-6 border-amber-500/40 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-400 text-slate-950">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                Automated Cricket Squad Ingestion Script
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                  Ready
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Fetches raw provider payloads, parses rosters, formats into <code>Team</code> & <code>Squad</code> schemas, strips amounts, and saves to database.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={<Globe className={`w-4 h-4 ${testingConnection ? 'animate-spin' : ''}`} />}
              disabled={!!busy || testingConnection}
              onClick={handleTestConnection}
            >
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={<RefreshCw className={`w-4 h-4 ${busy === 'fetch-squads' ? 'animate-spin' : ''}`} />}
              disabled={!!busy || testingConnection}
              onClick={handleFetchAndPersist}
            >
              {busy === 'fetch-squads' ? 'Running Script...' : 'Fetch & Persist to Database'}
            </Button>
          </div>
        </div>

        {/* Configuration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Cricket Data Provider">
            <Select value={provider} onChange={e => setProvider(e.target.value as any)}>
              <option value="cricbuzz">Cricbuzz Series API / DOM (Abu Dhabi T10 2026)</option>
              <option value="cricketdata">CricketData.org API (Series Squads)</option>
              <option value="custom">Custom Cricket REST Provider</option>
            </Select>
          </Field>

          <Field label="Series / League ID" hint="Abu Dhabi T10 2026 series identifier">
            <TextInput
              value={seriesId}
              onChange={e => setSeriesId(e.target.value)}
              placeholder="13307"
            />
          </Field>

          {provider === 'cricketdata' && (
            <Field label="Provider API Key" hint="CricketData API Key">
              <TextInput
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Enter API key"
              />
            </Field>
          )}

          {provider === 'custom' && (
            <Field label="Provider Custom Endpoint URL" hint="Full REST URL">
              <TextInput
                value={apiUrl}
                onChange={e => setApiUrl(e.target.value)}
                placeholder="https://api.example.com/squads"
              />
            </Field>
          )}

          <div className="flex items-end pb-2">
            <Checkbox
              label="Overwrite existing squads with provider roster"
              checked={overwrite}
              onChange={v => setOverwrite(v)}
            />
          </div>
        </div>

        {/* Connection status notification pill */}
        {connectionStatus && (
          <div className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between gap-3 ${
            connectionStatus.success
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
          }`}>
            <div className="flex items-center gap-2">
              {connectionStatus.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
              <span>{connectionStatus.message}</span>
            </div>
            {connectionStatus.latencyMs !== undefined && (
              <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 font-bold">
                {connectionStatus.latencyMs}ms
              </span>
            )}
          </div>
        )}

        {/* Execution Results Banner */}
        {syncResult && (
          <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-black text-white">Automated Script Execution Summary</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                <span>{syncResult.executionTimeMs}ms execution time</span>
                <span>·</span>
                <span>{new Date(syncResult.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Provider</div>
                <div className="text-sm font-black text-amber-300 truncate">{syncResult.provider}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Series ID</div>
                <div className="text-sm font-black text-white">{syncResult.seriesId}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Teams Formatted</div>
                <div className="text-sm font-black text-emerald-400">{syncResult.teamsCount} Franchises</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Squad Players</div>
                <div className="text-sm font-black text-emerald-400">{syncResult.playersCount} Players</div>
              </div>
            </div>

            {/* Terminal Log Output */}
            <div>
              <button
                type="button"
                onClick={() => setShowLogs(!showLogs)}
                className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                <span>Execution Logs ({syncResult.logs.length} entries)</span>
                {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showLogs && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-xl bg-black/90 p-3 font-mono text-[11px] space-y-1 border border-slate-800">
                  {syncResult.logs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-slate-500 whitespace-nowrap">{log.timestamp.slice(11, 19)}</span>
                      <span className={`uppercase font-black text-[9px] px-1 rounded ${
                        log.level === 'success' ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/50' :
                        log.level === 'error' ? 'bg-rose-950 text-rose-400 border border-rose-700/50' :
                        log.level === 'warn' ? 'bg-amber-950 text-amber-400 border border-amber-700/50' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {log.level}
                      </span>
                      <span className={log.level === 'success' ? 'text-emerald-200' : log.level === 'error' ? 'text-rose-200' : 'text-slate-300'}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Database Status & Franchises Preview */}
      <Card className="p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-400" />
              Database Teams & Squads Status
            </h3>
            <p className="text-xs text-slate-400">
              Current persisted franchises in <code>t10_store.json</code>. Each franchise has confirmed 18-player rosters with attached Cricbuzz stats and HD photos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-800 text-slate-200">
              {teams.length} Teams
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {totalPlayersInDb} Confirmed Players
            </span>
          </div>
        </div>

        {/* Franchises Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {teams.map(t => {
            const isExpanded = expandedTeamId === t.id;
            return (
              <div 
                key={t.id}
                className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div 
                      className="w-4 h-4 rounded-full shrink-0 shadow"
                      style={{ background: t.color }}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-black text-white truncate">{t.name}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span className="font-bold text-amber-400">{t.short}</span>
                        <span>·</span>
                        <span>{t.squad?.length || 0} players</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedTeamId(isExpanded ? null : t.id)}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    title={isExpanded ? 'Collapse squad' : 'View squad'}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                <div className="text-xs text-slate-300 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Icon:</span>
                  <span className="font-bold text-amber-300 truncate">{t.iconPlayer || '—'}</span>
                </div>

                {isExpanded && (
                  <div className="pt-2 border-t border-slate-800 space-y-1.5 max-h-56 overflow-y-auto">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                      Confirmed 18-Man Squad:
                    </div>
                    {t.squad?.map((p, idx) => (
                      <div key={p.id || idx} className="flex items-center justify-between gap-2 text-xs py-1 px-1.5 rounded hover:bg-slate-800/50">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] text-slate-500 font-mono w-4">{idx + 1}.</span>
                          <span className="font-bold text-white truncate">{p.name}</span>
                          {p.isIcon && (
                            <span className="px-1 py-0.2 rounded text-[9px] bg-amber-400 text-slate-950 font-black">
                              ICON
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 capitalize shrink-0">{p.role}</span>
                      </div>
                    ))}
                    {goToSection && (
                      <button
                        type="button"
                        onClick={() => goToSection('teams')}
                        className="w-full mt-2 py-1 px-2 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/30 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Save className="w-3 h-3" />
                        <span>Edit & Save Squad in Teams Tab →</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Auxiliary Admin Utilities */}
      <Card className="p-5 sm:p-6 space-y-4">
        <h3 className="text-base font-black text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-400" />
          Additional Administrative Tools
        </h3>
        <p className="text-xs text-slate-400">
          Fast maintenance utilities for league operations, verified handle feeds, and database snapshots.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <h4 className="text-xs font-black text-white">Seed Official Franchises</h4>
            <p className="text-[11px] text-slate-400">
              Applies verified 2026 Abu Dhabi T10 franchises, Cricbuzz confirmed squads, and social handles immediately.
            </p>
            <Button
              size="sm"
              variant="secondary"
              disabled={!!busy}
              onClick={handleSeedOfficialSnapshot}
              className="w-full justify-center"
            >
              Seed Official Snapshot
            </Button>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <h4 className="text-xs font-black text-white">Re-sync Social Feeds</h4>
            <p className="text-[11px] text-slate-400">
              Refreshes 128+ multi-platform posts across verified franchise handles (YouTube, X, Instagram, TikTok, Threads).
            </p>
            <Button
              size="sm"
              variant="secondary"
              disabled={!!busy}
              onClick={handleSyncSocialFeeds}
              className="w-full justify-center"
            >
              Sync Social Handles
            </Button>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <h4 className="text-xs font-black text-white">Manage Environment Variables</h4>
            <p className="text-[11px] text-slate-400">
              Configure system parameters, API keys, and inspect variables requiring server restart.
            </p>
            <Button
              size="sm"
              variant="primary"
              onClick={() => goToSection && goToSection('env')}
              className="w-full justify-center"
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Open Environment Tab
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

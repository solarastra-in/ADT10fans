import React, { useState } from 'react';
import { Database, Eye, Globe, RefreshCw, RotateCcw, Terminal } from 'lucide-react';
import type { CricketSyncResult, Team } from '../../types';
import { api } from '../../api';
import { Actions, Button, Card, Checkbox, Chip, Field, Notice, SectionHeader, Select, TextInput, useRunner } from './ui';

/**
 * Squad tools for league admins: read squads from a cricket data provider, preview what would
 * change, then apply. Nothing is written until "Apply" is pressed, and existing players are kept
 * unless "Replace" is ticked, so hand edits made in the squad editor are safe by default.
 */
export const AdminToolsSection: React.FC<{ teams: Team[]; onRefreshAll: () => Promise<void>; goToSection?: (sectionId: any) => void }> = ({ teams = [], onRefreshAll }) => {
  const { busy, notice, setNotice, run } = useRunner();
  const [provider, setProvider] = useState<'cricbuzz' | 'cricketdata' | 'custom'>('cricketdata');
  const [seriesId, setSeriesId] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [teamId, setTeamId] = useState('');
  const [overwrite, setOverwrite] = useState(false);
  const [result, setResult] = useState<CricketSyncResult | null>(null);
  const [test, setTest] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);

  const options = (dryRun: boolean) => ({
    provider,
    seriesId: seriesId.trim() || undefined,
    apiUrl: apiUrl.trim() || undefined,
    apiKey: apiKey.trim() || undefined,
    teamId: teamId || undefined,
    overwrite,
    dryRun,
  });

  const testConnection = async () => {
    setTest(null);
    const r = await run('test', () => api.testCricketProvider(options(true)));
    if (r) setTest({ success: !!r.success, message: r.message || r.error || '', latencyMs: r.latencyMs });
  };

  const sync = async (dryRun: boolean) => {
    if (!dryRun && overwrite && !window.confirm('Replace squads with the provider roster? Players missing from the provider will be removed (their credit overrides and photos go with them).')) return;
    setResult(null);
    const r = await run(dryRun ? 'preview' : 'apply', async () => {
      const res = await api.fetchAndPersistCricketSquads(options(dryRun));
      if (!res.success) throw new Error(res.error || 'The provider sync failed. Squads were not changed.');
      return res;
    });
    if (r) {
      setResult(r);
      if (!dryRun) {
        await onRefreshAll();
        setNotice({ kind: 'ok', text: `Saved: ${r.added.length} added, ${r.removed.length} removed, ${r.linked} linked to provider IDs.` });
      } else {
        setNotice({ kind: 'ok', text: 'Preview ready. Nothing has been saved yet.' });
      }
    }
  };

  const reset = async () => {
    const label = teamId ? teams.find(t => t.id === teamId)?.name : 'all six teams';
    if (!window.confirm(`Reset ${label} to the squads shipped with the site? Any edits made in the squad editor for ${teamId ? 'this team' : 'these teams'} will be lost.`)) return;
    const r = await run('reset', () => api.seedOfficialTeams(true, teamId || undefined));
    if (r) {
      await onRefreshAll();
      setNotice({ kind: 'ok', text: r.summary || 'Squads reset.' });
    }
  };

  const total = teams.reduce((s, t) => s + (t.squad?.length || 0), 0);

  return (
    <div className="space-y-5">
      <SectionHeader title="Squad tools" description="Read squads from a cricket data provider, preview the changes, then apply them. Existing players are kept unless you choose to replace the squad." />
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <Card className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Provider">
            <Select value={provider} onChange={e => setProvider(e.target.value as any)}>
              <option value="cricketdata">CricketData.org (needs an API key)</option>
              <option value="cricbuzz">Cricbuzz series squads page</option>
              <option value="custom">Custom JSON endpoint</option>
            </Select>
          </Field>
          <Field label="Series ID" hint={provider === 'cricketdata' ? 'The CricketData series ID for this season' : provider === 'cricbuzz' ? 'The number in the Cricbuzz series URL' : 'Optional'}>
            <TextInput value={seriesId} onChange={e => setSeriesId(e.target.value)} />
          </Field>
          {provider === 'cricketdata' && (
            <Field label="API key" hint="Leave empty to use CRICKET_API_KEY from the server">
              <TextInput type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} />
            </Field>
          )}
          {provider === 'custom' && (
            <Field label="Endpoint (https://)" hint="Must return the CricketData squad JSON shape">
              <TextInput type="url" inputMode="url" value={apiUrl} onChange={e => setApiUrl(e.target.value)} />
            </Field>
          )}
          <Field label="Teams">
            <Select value={teamId} onChange={e => setTeamId(e.target.value)}>
              <option value="">All teams</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
        </div>
        <Checkbox label="Replace the squad (remove players the provider does not list)" checked={overwrite} onChange={setOverwrite} />
        <Actions>
          <Button icon={<Globe className="w-4 h-4" />} loading={busy === 'test'} disabled={!!busy} onClick={testConnection}>Test connection</Button>
          <Button icon={<Eye className="w-4 h-4" />} loading={busy === 'preview'} disabled={!!busy} onClick={() => sync(true)}>Preview changes</Button>
          <Button variant="primary" icon={<RefreshCw className="w-4 h-4" />} loading={busy === 'apply'} disabled={!!busy} onClick={() => sync(false)}>Apply</Button>
        </Actions>
        {test && (
          <p className={`text-sm ${test.success ? 'text-emerald-300' : 'text-rose-300'}`}>
            {test.message}{test.latencyMs !== undefined ? ` (${test.latencyMs} ms)` : ''}
          </p>
        )}
        {result && (
          <div className="space-y-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex flex-wrap gap-1.5">
              <Chip tone={result.dryRun ? 'amber' : 'green'}>{result.dryRun ? 'preview, not saved' : 'saved'}</Chip>
              <Chip>{result.provider}</Chip>
              <Chip>{result.teamsUpdated.length} teams</Chip>
              <Chip>{result.playersCount} players</Chip>
              <Chip tone="green">+{result.added.length}</Chip>
              <Chip tone="red">−{result.removed.length}</Chip>
              <Chip tone="blue">{result.linked} linked</Chip>
            </div>
            {result.added.length > 0 && <p className="text-xs text-emerald-200 break-words"><b>Added:</b> {result.added.join(', ')}</p>}
            {result.removed.length > 0 && <p className="text-xs text-rose-200 break-words"><b>Removed:</b> {result.removed.join(', ')}</p>}
            <details>
              <summary className="text-xs text-slate-400 cursor-pointer inline-flex items-center gap-1"><Terminal className="w-3.5 h-3.5" /> Log ({result.logs.length})</summary>
              <ul className="mt-2 max-h-48 overflow-y-auto font-mono text-[11px] space-y-1">
                {result.logs.map((l, i) => (
                  <li key={i} className={l.level === 'error' ? 'text-rose-300' : l.level === 'warn' ? 'text-amber-300' : 'text-slate-300'}>
                    {l.timestamp.slice(11, 19)} {l.message}
                  </li>
                ))}
              </ul>
            </details>
            {result.dryRun && (
              <Button size="sm" variant="primary" loading={busy === 'apply'} onClick={() => sync(false)}>Apply these changes</Button>
            )}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h3 className="font-extrabold text-white inline-flex items-center gap-2"><Database className="w-4 h-4 text-amber-400" /> Squads on the site</h3>
        <p className="text-sm text-slate-400">{teams.length} teams, {total} players.</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {teams.map(t => (
            <li key={t.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="flex items-center gap-2 min-w-0"><span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color }} /><span className="truncate text-white">{t.name}</span></span>
              <span className="text-slate-400 shrink-0">{t.squad?.length || 0}</span>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="danger" icon={<RotateCcw className="w-4 h-4" />} loading={busy === 'reset'} onClick={reset}>
          Reset {teamId ? 'selected team' : 'all teams'} to shipped squads
        </Button>
      </Card>
    </div>
  );
};

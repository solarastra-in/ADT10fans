import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleDashed, Cloud, KeyRound, RefreshCw, Save, Server } from 'lucide-react';
import { api } from '../../api';
import type { EnvVariableInfo } from '../../types';
import { Button, Card, Chip, Field, Notice, SectionHeader, TextInput, useRunner } from './ui';

const GROUPS: { id: EnvVariableInfo['category']; title: string }[] = [
  { id: 'core', title: 'Site' },
  { id: 'auth', title: 'Sign-in and email' },
  { id: 'cricket', title: 'Live scores' },
  { id: 'notifications', title: 'Notifications' },
  { id: 'social', title: 'Feeds' },
  { id: 'ai', title: 'AI helper' },
];

const sourceChip = (v: EnvVariableInfo) =>
  v.source === 'console' ? <Chip tone="green">set here</Chip> : v.source === 'environment' ? <Chip tone="blue">from Vercel</Chip> : v.source === 'default' ? <Chip>default</Chip> : <Chip tone="slate">not set</Chip>;

/**
 * Server settings. Everything except the deployment key is saved here, kept with the site's data,
 * and applied on every server within seconds — no environment variables or redeploys needed.
 */
export const EnvVariablesSection: React.FC<{ onRefreshAll?: () => Promise<void> }> = ({ onRefreshAll }) => {
  const [vars, setVars] = useState<EnvVariableInfo[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const { busy, notice, setNotice, run } = useRunner();

  const load = async () => {
    const r = await api.getEnvVariables().catch(e => {
      setNotice({ kind: 'err', text: e.message });
      return null;
    });
    if (r) {
      setVars(r.variables);
      setDraft({});
    }
  };
  useEffect(() => {
    load();
  }, []);

  const deploy = vars.filter(v => v.envOnly);
  const editable = vars.filter(v => !v.envOnly);
  const changed = useMemo(() => Object.keys(draft).filter(k => draft[k] !== undefined), [draft]);

  const save = async () => {
    if (!changed.length) return;
    const payload: Record<string, string> = {};
    for (const k of changed) payload[k] = draft[k];
    const r = await run('save', async () => {
      const res = await api.saveEnvVariables(payload);
      if (!res.success) throw new Error(res.error || res.message);
      return res;
    }, res => res.message);
    if (r) {
      await load();
      await onRefreshAll?.();
    }
  };
  const clear = (v: EnvVariableInfo) => setDraft({ ...draft, [v.key]: '' });

  const storageOk = deploy.find(v => v.key === 'FIREBASE_SERVICE_ACCOUNT')?.isSetInEnv || deploy.find(v => v.key === 'STORE_BUCKET')?.isSetInEnv;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Environment"
        description="Keys and server settings. Values saved here are kept with the site's data and apply on every server within seconds; you do not need to add them in Vercel."
        actions={<Button size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={load}>Reload</Button>}
      />
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <Card className="space-y-3">
        <h3 className="font-extrabold text-white inline-flex items-center gap-2"><Cloud className="w-4 h-4 text-amber-400" /> Set once in Vercel</h3>
        <p className="text-sm text-slate-400">
          The server needs this before it can read anything else, so it cannot be saved here. In Vercel: Project → Settings → Environment Variables, add it, then redeploy.
        </p>
        {deploy.filter(v => v.key === 'FIREBASE_SERVICE_ACCOUNT').map(v => (
          <div key={v.key} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-amber-300 text-sm">{v.key}</code>
              {v.isSetInEnv ? <Chip tone="green">set: {v.value}</Chip> : <Chip tone="red">not set</Chip>}
            </div>
            <p className="text-xs text-slate-400">{v.description}</p>
          </div>
        ))}
        <p className={`text-sm inline-flex items-center gap-2 ${storageOk ? 'text-emerald-300' : 'text-amber-300'}`}>
          {storageOk ? <CheckCircle2 className="w-4 h-4" /> : <CircleDashed className="w-4 h-4" />}
          {storageOk ? 'Data is saved in your Firebase project.' : 'Until it is set, data on Vercel is temporary and is lost when the server restarts.'}
        </p>
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer">Other deployment-only settings</summary>
          <ul className="mt-2 space-y-1">
            {deploy.filter(v => v.key !== 'FIREBASE_SERVICE_ACCOUNT').map(v => (
              <li key={v.key}><code className="text-slate-300">{v.key}</code> {v.isSetInEnv ? `= ${v.value}` : '(not set)'}: {v.description}</li>
            ))}
          </ul>
        </details>
      </Card>

      {GROUPS.map(g => {
        const list = editable.filter(v => v.category === g.id);
        if (!list.length) return null;
        return (
          <Card key={g.id} className="space-y-4">
            <h3 className="font-extrabold text-white inline-flex items-center gap-2"><Server className="w-4 h-4 text-amber-400" /> {g.title}</h3>
            {list.map(v => {
              const pending = draft[v.key];
              return (
                <Field
                  key={v.key}
                  label={<span className="inline-flex flex-wrap items-center gap-2">{v.label} {sourceChip(v)}{pending !== undefined && <Chip tone="amber">unsaved</Chip>}</span> as any}
                  hint={v.description}
                >
                  <div className="flex gap-2">
                    <TextInput
                      type={v.isSecret ? 'password' : v.type === 'number' ? 'number' : 'text'}
                      autoComplete="off"
                      placeholder={v.isSecret && v.source !== 'unset' ? `${v.value} (type to replace)` : v.defaultValue ? `Default: ${v.defaultValue}` : ''}
                      value={pending !== undefined ? pending : v.isSecret ? '' : v.source === 'console' ? v.value : ''}
                      onChange={e => setDraft({ ...draft, [v.key]: e.target.value })}
                      aria-label={v.label}
                    />
                    {v.source === 'console' && (
                      <Button variant="ghost" onClick={() => clear(v)} aria-label={`Clear ${v.label}`}>Clear</Button>
                    )}
                  </div>
                  {!v.isSecret && v.source === 'environment' && pending === undefined && <p className="text-xs text-slate-500 mt-1">Currently from Vercel: {v.value}</p>}
                </Field>
              );
            })}
          </Card>
        );
      })}

      <div className="sticky bottom-20 lg:bottom-4 flex justify-end">
        <Button variant="primary" icon={<Save className="w-4 h-4" />} loading={busy === 'save'} disabled={!changed.length} onClick={save}>
          Save {changed.length ? `${changed.length} change${changed.length === 1 ? '' : 's'}` : ''}
        </Button>
      </div>
      <p className="text-xs text-slate-500 inline-flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> Secrets are never shown again after saving. Only super admins can open this page.</p>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { 
  Key, 
  RotateCcw, 
  Save, 
  Copy, 
  Check, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Eye, 
  EyeOff, 
  Terminal, 
  Sliders, 
  Server, 
  ShieldAlert, 
  Sparkles,
  Info
} from 'lucide-react';
import { EnvVariableInfo } from '../../types';
import { api } from '../../api';
import { Button, Card, Field, Notice, SectionHeader, Select, TextInput, useRunner } from './ui';

export const EnvVariablesSection: React.FC<{
  onRefreshAll?: () => Promise<void>;
}> = ({ onRefreshAll }) => {
  const { busy, notice, setNotice, run } = useRunner();

  const [variables, setVariables] = useState<EnvVariableInfo[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyRestartRequired, setOnlyRestartRequired] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  // Load environment variables from server
  const loadEnv = async () => {
    try {
      const res = await api.getEnvVariables();
      setVariables(res.variables);
      const initialDrafts: Record<string, string> = {};
      for (const v of res.variables) {
        initialDrafts[v.key] = v.value || '';
      }
      setDrafts(initialDrafts);
      setDirty(false);
    } catch (e: any) {
      setNotice({ kind: 'err', text: e?.message || 'Failed to load environment variables' });
    }
  };

  useEffect(() => {
    loadEnv();
  }, []);

  const handleDraftChange = (key: string, val: string) => {
    setDrafts(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  const toggleRevealSecret = (key: string) => {
    setRevealedSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Save changes
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(
      'save-env',
      async () => {
        // Find modified keys
        const overridesToSave: Record<string, string> = {};
        for (const v of variables) {
          if (drafts[v.key] !== undefined && drafts[v.key] !== v.value) {
            overridesToSave[v.key] = drafts[v.key];
          }
        }

        if (Object.keys(overridesToSave).length === 0) {
          return { message: 'No changes detected to save.', hasRestartRequired: false, requiresRestartKeys: [] };
        }

        const res = await api.saveEnvVariables(overridesToSave);
        await loadEnv();
        if (onRefreshAll) await onRefreshAll();
        return res;
      },
      (res) => {
        if (res.hasRestartRequired) {
          return `⚠️ Saved! Note: The following variables require a server restart to take effect: ${res.requiresRestartKeys.join(', ')}.`;
        }
        return res.message || 'Environment variable overrides saved successfully.';
      }
    );
  };

  // Copy full .env snippet
  const handleCopyEnvFile = () => {
    const lines = [
      '# Abu Dhabi T10 Fan Hub - Environment Variables',
      `# Generated: ${new Date().toISOString()}`,
      '',
    ];

    const categories = ['core', 'storage', 'auth', 'notifications', 'ai', 'social', 'cricket'] as const;
    for (const cat of categories) {
      lines.push(`# ---- ${cat.toUpperCase()} ----`);
      const catVars = variables.filter(v => v.category === cat);
      for (const v of catVars) {
        const val = drafts[v.key] !== undefined ? drafts[v.key] : v.value;
        const restartNotice = v.requiresRestart ? ' [REQUIRES SERVER RESTART]' : ' [DYNAMIC - NO RESTART]';
        lines.push(`# ${v.description}${restartNotice}`);
        lines.push(`${v.key}="${val.replace(/"/g, '\\"')}"`);
      }
      lines.push('');
    }

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2500);
  };

  // Filter variables
  const filtered = variables.filter(v => {
    if (onlyRestartRequired && !v.requiresRestart) return false;
    if (selectedCategory !== 'all' && v.category !== selectedCategory) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return v.key.toLowerCase().includes(q) || v.label.toLowerCase().includes(q) || v.description.toLowerCase().includes(q);
    }
    return true;
  });

  const restartRequiredCount = variables.filter(v => v.requiresRestart).length;
  const dynamicCount = variables.filter(v => !v.requiresRestart).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Environment Variables & Configuration"
        description="Manage all system environment variables directly from the Admin Portal. Variables that require a server process restart are explicitly highlighted with warning specifications."
      />

      <Notice notice={notice} />

      {/* Overview Stat Counters & Actions Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Variables</div>
          <div className="text-2xl font-black text-white">{variables.length}</div>
          <div className="text-[11px] text-slate-400">System configuration keys</div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-1">
          <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Requires Restart
          </div>
          <div className="text-2xl font-black text-amber-300">{restartRequiredCount}</div>
          <div className="text-[11px] text-amber-200/70">Static / boot-time bindings</div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-1">
          <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Live / Dynamic
          </div>
          <div className="text-2xl font-black text-emerald-300">{dynamicCount}</div>
          <div className="text-[11px] text-emerald-200/70">Applied live without restart</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-2">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Export Configuration</div>
          <Button
            size="sm"
            variant="secondary"
            icon={copiedEnv ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            onClick={handleCopyEnvFile}
            className="w-full justify-center"
          >
            {copiedEnv ? 'Copied .env Snippet!' : 'Copy .env File'}
          </Button>
        </div>
      </div>

      {/* Explanatory Banner on Restart Requirements */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <div className="font-bold text-amber-300">Important Server Restart Specification</div>
          <p className="text-amber-200/90 leading-relaxed">
            Values marked with <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">⚠️ Requires Restart</span> bind to low-level Node.js primitives at startup (e.g. Express network ports, database storage paths, and Express sitemap routers).
            Saving them will update the persisted database configuration, but you must restart the host server (or redeploy) for changes to take effect.
            Values marked with <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">🟢 Dynamic</span> apply immediately in memory!
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2 max-w-md bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Filter by key or description..."
              className="bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none w-full"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="core">Core & Server</option>
              <option value="storage">Storage & Database</option>
              <option value="auth">Auth & SMTP</option>
              <option value="notifications">Push Notifications</option>
              <option value="ai">AI Models & Gemini</option>
              <option value="social">Social Feeds & Curator</option>
              <option value="cricket">Cricket Data Provider</option>
            </select>

            <button
              type="button"
              onClick={() => setOnlyRestartRequired(!onlyRestartRequired)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                onlyRestartRequired
                  ? 'bg-amber-400 text-slate-950 border-amber-400'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Only Restart-Required</span>
            </button>

            <Button
              size="sm"
              variant="primary"
              disabled={!!busy || !dirty}
              onClick={handleSave}
              icon={<Save className="w-4 h-4" />}
            >
              {busy ? 'Saving...' : 'Save Overrides'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Variables List */}
      <div className="space-y-3">
        {filtered.map(v => {
          const isSecret = v.isSecret;
          const isRevealed = revealedSecrets[v.key];
          const currentDraft = drafts[v.key] !== undefined ? drafts[v.key] : v.value;
          const isModified = drafts[v.key] !== undefined && drafts[v.key] !== v.value;

          return (
            <Card 
              key={v.key}
              className={`p-4 sm:p-5 transition-all space-y-3 border ${
                v.requiresRestart ? 'border-amber-500/20 bg-slate-900/90' : 'border-slate-800 bg-slate-900/60'
              } ${isModified ? 'ring-1 ring-amber-400' : ''}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm sm:text-base font-black text-amber-300">
                      {v.key}
                    </span>
                    <span className="text-xs font-bold text-white">({v.label})</span>

                    {/* Restart specification badge */}
                    {v.requiresRestart ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Requires Server Restart
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Dynamic (Live)
                      </span>
                    )}

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 uppercase">
                      {v.category}
                    </span>

                    {v.isSetInEnv && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-950 text-sky-400 border border-sky-800 font-mono">
                        .env active
                      </span>
                    )}

                    {v.isOverridden && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950 text-purple-400 border border-purple-800 font-mono">
                        db override
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300">{v.description}</p>

                  {/* Why restart is required note */}
                  <div className="text-[11px] font-mono flex items-center gap-1.5 pt-0.5">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">Lifecycle Behavior:</span>
                    <span className={v.requiresRestart ? 'text-amber-300/90 font-medium' : 'text-emerald-300/90 font-medium'}>
                      {v.restartReason}
                    </span>
                  </div>
                </div>

                {isModified && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-amber-400 text-slate-950 font-black uppercase tracking-wider shrink-0">
                    Modified
                  </span>
                )}
              </div>

              {/* Input Control */}
              <div className="flex items-center gap-2 pt-1">
                <div className="relative flex-1">
                  <input
                    type={isSecret && !isRevealed ? 'password' : 'text'}
                    value={currentDraft}
                    onChange={e => handleDraftChange(v.key, e.target.value)}
                    placeholder={v.defaultValue ? `Default: ${v.defaultValue}` : 'Not set'}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
                  />
                </div>

                {isSecret && (
                  <button
                    type="button"
                    onClick={() => toggleRevealSecret(v.key)}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                    title={isRevealed ? 'Hide secret' : 'Reveal secret'}
                  >
                    {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}

                {isModified && (
                  <button
                    type="button"
                    onClick={() => handleDraftChange(v.key, v.value)}
                    className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                    title="Reset to current value"
                  >
                    Reset
                  </button>
                )}
              </div>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <Card className="p-8 text-center text-slate-400 text-sm">
            No environment variables match your search filter.
          </Card>
        )}
      </div>

      {/* Save Floating Bar */}
      {dirty && (
        <div className="sticky bottom-4 z-20 p-4 rounded-2xl bg-amber-500 text-slate-950 shadow-2xl flex items-center justify-between gap-4 font-bold">
          <div className="flex items-center gap-2 text-sm">
            <Sliders className="w-4 h-4" />
            <span>You have unsaved environment variable modifications!</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const resetDrafts: Record<string, string> = {};
                for (const v of variables) resetDrafts[v.key] = v.value || '';
                setDrafts(resetDrafts);
                setDirty(false);
              }}
              className="bg-slate-950 text-white border-slate-950 hover:bg-slate-900"
            >
              Discard Changes
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!!busy}
              onClick={handleSave}
              className="bg-slate-950 text-amber-300 hover:bg-black"
            >
              {busy ? 'Saving...' : 'Save All Changes'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

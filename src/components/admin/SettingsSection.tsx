import React, { useEffect, useState } from 'react';
import { Save, Info, Sparkles, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { SystemSettings } from '../../types';
import { api } from '../../api';
import { Button, Card, Checkbox, Errors, Field, Notice, SectionHeader, TextArea, TextInput, splitList, toDateInput, toNumber, useRunner } from './ui';

type Draft = {
  brandName: string;
  tagline: string;
  copyrightHolder: string;
  seasonLabel: string;
  seasonStart: string;
  seasonEnd: string;
  venue: string;
  tickerText: string;
  adminEmails: string;
  curatorFeedId: string;
  curatorContainerId: string;
  curatorFeedUuid: string;
  curatorApiKey: string;
  curatorHashtags: string;
  maxSocialPerPlatform: string;
  newsQueries: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpFrom: string;
  smtpEnabled: boolean;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toDraft = (s: Partial<SystemSettings> | null | undefined): Draft => ({
  brandName: s?.brandName || '',
  tagline: s?.tagline || '',
  copyrightHolder: s?.copyrightHolder || '',
  seasonLabel: s?.seasonLabel || '',
  seasonStart: toDateInput(s?.seasonStart),
  seasonEnd: toDateInput(s?.seasonEnd),
  venue: s?.venue || '',
  tickerText: s?.tickerText || '',
  adminEmails: (s?.adminEmails || []).join(', '),
  curatorFeedId: s?.curatorFeedId || '',
  curatorContainerId: s?.curatorContainerId || '',
  curatorFeedUuid: s?.curatorFeedUuid || '',
  curatorApiKey: s?.curatorApiKey || '',
  curatorHashtags: s?.curatorHashtags || '',
  maxSocialPerPlatform: s?.maxSocialPerPlatform !== undefined ? String(s.maxSocialPerPlatform) : '',
  newsQueries: s?.newsQueries || '',
  smtpHost: s?.smtp?.host || '',
  smtpPort: s?.smtp?.port ? String(s.smtp.port) : '',
  smtpUser: s?.smtp?.user || '',
  smtpFrom: s?.smtp?.from || '',
  smtpEnabled: !!s?.smtp?.enabled,
});

export const SettingsSection: React.FC<{ settings: SystemSettings; onRefreshAll: () => Promise<void> }> = ({ settings, onRefreshAll }) => {
  const { busy, notice, setNotice, run } = useRunner();
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  const [passIsSet, setPassIsSet] = useState<boolean>(!!settings?.smtp?.pass);
  const [newPass, setNewPass] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .getSettings()
      .then(res => {
        if (!alive || !res.settings) return;
        setDraft(toDraft(res.settings));
        setPassIsSet(!!res.settings.smtp?.pass);
        setDirty(false);
      })
      .catch(() => {
        /* keep props */
      });
    return () => {
      alive = false;
    };
  }, []);

  const set = (patch: Partial<Draft>) => {
    setDirty(true);
    setDraft(d => ({ ...d, ...patch }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Errors = {};
    const emails = splitList(draft.adminEmails);
    const badEmails = emails.filter(x => !EMAIL.test(x));
    if (emails.length === 0) er.adminEmails = 'At least one admin email is required, or you will lock yourself out.';
    else if (badEmails.length) er.adminEmails = `Not a valid email: ${badEmails.join(', ')}`;
    if (draft.seasonStart && draft.seasonEnd && draft.seasonEnd < draft.seasonStart) er.seasonEnd = 'End date must be after the start date.';
    const max = toNumber(draft.maxSocialPerPlatform, -1);
    if (!(Number.isInteger(max) && max >= 1 && max <= 50)) er.maxSocialPerPlatform = 'Use a whole number from 1 to 50.';
    const port = toNumber(draft.smtpPort, -1);
    if (draft.smtpPort && !(Number.isInteger(port) && port > 0 && port < 65536)) er.smtpPort = 'Port must be 1–65535.';
    if (draft.smtpEnabled) {
      if (!draft.smtpHost.trim()) er.smtpHost = 'Host is required when email is enabled.';
      if (!draft.smtpPort) er.smtpPort = 'Port is required when email is enabled.';
      if (!draft.smtpFrom.trim()) er.smtpFrom = 'From address is required when email is enabled.';
    }
    setErrors(er);
    if (Object.keys(er).length) {
      setNotice({ kind: 'err', text: 'Please fix the highlighted fields.' });
      return;
    }

    const smtp: Record<string, any> = {
      host: draft.smtpHost.trim(),
      port: draft.smtpPort ? port : 0,
      user: draft.smtpUser.trim(),
      from: draft.smtpFrom.trim(),
      enabled: draft.smtpEnabled,
    };
    if (newPass) smtp.pass = newPass;

    const payload = {
      brandName: draft.brandName.trim(),
      tagline: draft.tagline.trim(),
      copyrightHolder: draft.copyrightHolder.trim(),
      seasonLabel: draft.seasonLabel.trim(),
      seasonStart: draft.seasonStart,
      seasonEnd: draft.seasonEnd,
      venue: draft.venue.trim(),
      tickerText: draft.tickerText.trim(),
      adminEmails: emails.map(x => x.toLowerCase()),
      curatorFeedId: draft.curatorFeedId.trim(),
      curatorContainerId: draft.curatorContainerId.trim(),
      curatorFeedUuid: draft.curatorFeedUuid.trim(),
      curatorApiKey: draft.curatorApiKey.trim(),
      curatorHashtags: draft.curatorHashtags.trim(),
      maxSocialPerPlatform: max,
      newsQueries: draft.newsQueries
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .join('\n'),
      smtp: smtp as SystemSettings['smtp'],
    };

    const res = await run('save', () => api.saveSettings(payload), 'Settings saved.');
    if (res) {
      if (res.settings) {
        setDraft(toDraft(res.settings));
        setPassIsSet(!!res.settings.smtp?.pass);
      }
      setNewPass('');
      setDirty(false);
      await onRefreshAll();
    }
  };

  return (
    <form onSubmit={save} className="space-y-5" noValidate>
      <SectionHeader title="Settings" description="Brand text, season details, integrations and email." />

      <Card className="space-y-4">
        <div>
          <h3 className="font-extrabold text-white text-base">Brand & season</h3>
          <p className="text-xs text-slate-400 mt-0.5">Core visual identifiers, stadium venue and tournament calendar.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field 
            label="Site name" 
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> Updates app header title immediately (Default: “ADT10 Fans”).
              </span>
            }
          >
            <TextInput value={draft.brandName} onChange={e => set({ brandName: e.target.value })} />
          </Field>

          <Field 
            label="Copyright holder" 
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> Displayed in footer (Default: “Azlir Sports”).
              </span>
            }
          >
            <TextInput value={draft.copyrightHolder} onChange={e => set({ copyrightHolder: e.target.value })} />
          </Field>

          <Field 
            label="Tagline" 
            className="sm:col-span-2"
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> Subtitle under site brand banner.
              </span>
            }
          >
            <TextInput value={draft.tagline} onChange={e => set({ tagline: e.target.value })} />
          </Field>

          <Field 
            label="Season label" 
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> e.g. Abu Dhabi T10 2026.
              </span>
            }
          >
            <TextInput value={draft.seasonLabel} onChange={e => set({ seasonLabel: e.target.value })} />
          </Field>

          <Field 
            label="Default venue" 
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> Pre-fills default ground for new fixtures.
              </span>
            }
          >
            <TextInput value={draft.venue} onChange={e => set({ venue: e.target.value })} />
          </Field>

          <Field 
            label="Season starts"
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> Tournament launch day filter.
              </span>
            }
          >
            <TextInput type="date" value={draft.seasonStart} onChange={e => set({ seasonStart: e.target.value })} />
          </Field>

          <Field 
            label="Season ends" 
            error={errors.seasonEnd}
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> Championship final match cutoff.
              </span>
            }
          >
            <TextInput type="date" value={draft.seasonEnd} onChange={e => set({ seasonEnd: e.target.value })} error={!!errors.seasonEnd} />
          </Field>

          <Field 
            label="Ticker text" 
            className="sm:col-span-2" 
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> Scrolling marquee header banner. Leave blank to hide.
              </span>
            }
          >
            <TextArea rows={2} value={draft.tickerText} onChange={e => set({ tickerText: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-3">
        <div>
          <h3 className="font-extrabold text-white text-base">Access & Super Admins</h3>
          <p className="text-xs text-slate-400 mt-0.5">Accounts granted complete administrative privileges.</p>
        </div>
        <Field 
          label="Admin emails" 
          required 
          error={errors.adminEmails} 
          hint={
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> Evaluated dynamically on every request. Comma-separated Google login emails.
            </span>
          }
        >
          <TextArea rows={2} value={draft.adminEmails} onChange={e => set({ adminEmails: e.target.value })} error={!!errors.adminEmails} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </Field>
      </Card>

      <Card className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="font-extrabold text-white text-base">Social Wall & News (Curator.io Integration)</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Manage Curator.io multi-channel social feed parameters or keep empty to use built-in official feeds.</p>
        </div>

        {/* Informational Box explaining CURATOR_FEED_ID and CURATOR_API_KEY */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <Info className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Understanding Curator.io Properties & Production Setup</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            <strong className="text-white">Curator.io</strong> is an external social aggregation service that crawls public posts from X, Instagram, YouTube, TikTok, and Facebook into a single feed stream.
          </p>
          <ul className="space-y-1 pl-4 list-disc text-slate-300 text-[11px]">
            <li>
              <strong className="text-amber-200 font-mono">Curator Feed ID:</strong> The published feed identifier or UUID assigned in your Curator.io account dashboard.
            </li>
            <li>
              <strong className="text-amber-200 font-mono">Curator API Key:</strong> The optional private REST API key from Curator.io used for automated server-to-server post syncing.
            </li>
            <li>
              <strong className="text-emerald-300 font-semibold">Production Default:</strong> You do <span className="underline">not</span> need environment variables for Curator. If you don't have a Curator.io subscription, simply <strong>keep these fields empty</strong>. The platform will automatically run in production using 100% verified native team social handles (YouTube video highlights, X updates, Instagram posts, and Cricbuzz news) with zero external setup required!
            </li>
            <li>
              <strong className="text-emerald-300 font-mono">⚡ Lifecycle:</strong> All Curator properties take effect <strong>live without restart</strong>.
            </li>
          </ul>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field 
            label="Curator feed ID"
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> Curator published stream ID (e.g. 1a2b3c4d-...). Keep empty if not using Curator.
              </span>
            }
          >
            <TextInput placeholder="Empty (uses built-in feeds)" value={draft.curatorFeedId} onChange={e => set({ curatorFeedId: e.target.value })} autoComplete="off" />
          </Field>

          <Field 
            label="Curator API key"
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> Private REST API key from Curator dashboard. Keep empty if not using Curator API.
              </span>
            }
          >
            <TextInput type="password" placeholder="Empty (optional)" value={draft.curatorApiKey} onChange={e => set({ curatorApiKey: e.target.value })} autoComplete="new-password" />
          </Field>

          <Field 
            label="Curator container ID"
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> HTML widget mount container (Default: curator-feed-default-feed-layout).
              </span>
            }
          >
            <TextInput value={draft.curatorContainerId} onChange={e => set({ curatorContainerId: e.target.value })} autoComplete="off" />
          </Field>

          <Field 
            label="Curator feed UUID"
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> Optional secondary feed UUID if provided by Curator. Keep empty if unused.
              </span>
            }
          >
            <TextInput placeholder="Empty (optional)" value={draft.curatorFeedUuid} onChange={e => set({ curatorFeedUuid: e.target.value })} autoComplete="off" />
          </Field>

          <Field 
            label="Curator hashtags" 
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> Comma-separated social discovery tags (e.g. AbuDhabiT10, ArabianAces).
              </span>
            }
          >
            <TextInput value={draft.curatorHashtags} onChange={e => set({ curatorHashtags: e.target.value })} />
          </Field>

          <Field 
            label="Max posts per platform" 
            required 
            error={errors.maxSocialPerPlatform}
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> Caps per platform (YouTube, X, Instagram, etc.) to keep feeds balanced.
              </span>
            }
          >
            <TextInput type="number" inputMode="numeric" min={1} max={50} value={draft.maxSocialPerPlatform} onChange={e => set({ maxSocialPerPlatform: e.target.value })} error={!!errors.maxSocialPerPlatform} />
          </Field>

          <Field 
            label="News queries" 
            className="sm:col-span-2" 
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> Google News queries (one per line). Blank lines ignored.
              </span>
            }
          >
            <TextArea rows={3} value={draft.newsQueries} onChange={e => set({ newsQueries: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-3">
        <div>
          <h3 className="font-extrabold text-white text-base">Email Delivery (SMTP)</h3>
          <p className="text-xs text-slate-400 mt-0.5">Used for passwordless one-time passcodes (OTP) and notifications.</p>
        </div>
        <Checkbox label="Send email through this SMTP server" checked={draft.smtpEnabled} onChange={v => set({ smtpEnabled: v })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field 
            label="Host" 
            required={draft.smtpEnabled} 
            error={errors.smtpHost}
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> Mail server host.
              </span>
            }
          >
            <TextInput value={draft.smtpHost} onChange={e => set({ smtpHost: e.target.value })} error={!!errors.smtpHost} autoCapitalize="none" />
          </Field>

          <Field 
            label="Port" 
            required={draft.smtpEnabled} 
            error={errors.smtpPort} 
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> Usually 587 (TLS) or 465 (SSL).
              </span>
            }
          >
            <TextInput type="number" inputMode="numeric" value={draft.smtpPort} onChange={e => set({ smtpPort: e.target.value })} error={!!errors.smtpPort} />
          </Field>

          <Field 
            label="Username"
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> SMTP authentication username.
              </span>
            }
          >
            <TextInput value={draft.smtpUser} onChange={e => set({ smtpUser: e.target.value })} autoCapitalize="none" autoComplete="off" />
          </Field>

          <Field 
            label="Password" 
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> {passIsSet ? 'A password is saved. Leave blank to keep it.' : 'Not set.'}
              </span>
            }
          >
            <TextInput
              type="password"
              value={newPass}
              placeholder={passIsSet ? '••••••••' : ''}
              onChange={e => {
                setDirty(true);
                setNewPass(e.target.value);
              }}
              autoComplete="new-password"
            />
          </Field>

          <Field 
            label="From address" 
            required={draft.smtpEnabled} 
            error={errors.smtpFrom} 
            className="sm:col-span-2" 
            hint={
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">⚡ Live without restart:</span> Sender header (e.g. ADT10 Fans &lt;no-reply@adt10fans.com&gt;).
              </span>
            }
          >
            <TextInput value={draft.smtpFrom} onChange={e => set({ smtpFrom: e.target.value })} error={!!errors.smtpFrom} autoCapitalize="none" />
          </Field>
        </div>
      </Card>

      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] md:bottom-4 z-10 space-y-2">
        <Notice notice={notice} onClose={() => setNotice(null)} />
        <Button type="submit" variant="primary" loading={busy === 'save'} icon={<Save className="w-4 h-4" />} className="w-full sm:w-auto shadow-lg shadow-black/40">
          {dirty ? 'Save settings' : 'Save settings (no changes)'}
        </Button>
      </div>
    </form>
  );
};

import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
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

      <Card className="space-y-3">
        <h3 className="font-extrabold text-white">Brand & season</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Site name" hint="Blank uses “ADT10 Fans”">
            <TextInput value={draft.brandName} onChange={e => set({ brandName: e.target.value })} />
          </Field>
          <Field label="Copyright holder" hint="Blank uses “Azlir Sports”">
            <TextInput value={draft.copyrightHolder} onChange={e => set({ copyrightHolder: e.target.value })} />
          </Field>
          <Field label="Tagline" className="sm:col-span-2">
            <TextInput value={draft.tagline} onChange={e => set({ tagline: e.target.value })} />
          </Field>
          <Field label="Season label" hint="e.g. Abu Dhabi T10 2026">
            <TextInput value={draft.seasonLabel} onChange={e => set({ seasonLabel: e.target.value })} />
          </Field>
          <Field label="Default venue" hint="Pre-fills new fixtures">
            <TextInput value={draft.venue} onChange={e => set({ venue: e.target.value })} />
          </Field>
          <Field label="Season starts">
            <TextInput type="date" value={draft.seasonStart} onChange={e => set({ seasonStart: e.target.value })} />
          </Field>
          <Field label="Season ends" error={errors.seasonEnd}>
            <TextInput type="date" value={draft.seasonEnd} onChange={e => set({ seasonEnd: e.target.value })} error={!!errors.seasonEnd} />
          </Field>
          <Field label="Ticker text" className="sm:col-span-2" hint="Scrolling banner at the top of the site. Leave blank to hide it.">
            <TextArea rows={2} value={draft.tickerText} onChange={e => set({ tickerText: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-extrabold text-white">Access</h3>
        <Field label="Admin emails" required error={errors.adminEmails} hint="Comma-separated. These accounts get the Admin Console.">
          <TextArea rows={2} value={draft.adminEmails} onChange={e => set({ adminEmails: e.target.value })} error={!!errors.adminEmails} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </Field>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-extrabold text-white">Social wall & news</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Curator feed ID">
            <TextInput value={draft.curatorFeedId} onChange={e => set({ curatorFeedId: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Curator container ID">
            <TextInput value={draft.curatorContainerId} onChange={e => set({ curatorContainerId: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Curator feed UUID">
            <TextInput value={draft.curatorFeedUuid} onChange={e => set({ curatorFeedUuid: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Curator API key">
            <TextInput type="password" value={draft.curatorApiKey} onChange={e => set({ curatorApiKey: e.target.value })} autoComplete="new-password" />
          </Field>
          <Field label="Curator hashtags" hint="e.g. #AbuDhabiT10">
            <TextInput value={draft.curatorHashtags} onChange={e => set({ curatorHashtags: e.target.value })} />
          </Field>
          <Field label="Max posts per platform" required error={errors.maxSocialPerPlatform}>
            <TextInput type="number" inputMode="numeric" min={1} max={50} value={draft.maxSocialPerPlatform} onChange={e => set({ maxSocialPerPlatform: e.target.value })} error={!!errors.maxSocialPerPlatform} />
          </Field>
          <Field label="News queries" className="sm:col-span-2" hint="One Google News query per line. Blank lines are ignored.">
            <TextArea rows={4} value={draft.newsQueries} onChange={e => set({ newsQueries: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-extrabold text-white">Email (SMTP)</h3>
        <p className="text-sm text-slate-400">Used for sign-in codes and notifications.</p>
        <Checkbox label="Send email through this SMTP server" checked={draft.smtpEnabled} onChange={v => set({ smtpEnabled: v })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Host" required={draft.smtpEnabled} error={errors.smtpHost}>
            <TextInput value={draft.smtpHost} onChange={e => set({ smtpHost: e.target.value })} error={!!errors.smtpHost} autoCapitalize="none" />
          </Field>
          <Field label="Port" required={draft.smtpEnabled} error={errors.smtpPort} hint="Usually 587 or 465">
            <TextInput type="number" inputMode="numeric" value={draft.smtpPort} onChange={e => set({ smtpPort: e.target.value })} error={!!errors.smtpPort} />
          </Field>
          <Field label="Username">
            <TextInput value={draft.smtpUser} onChange={e => set({ smtpUser: e.target.value })} autoCapitalize="none" autoComplete="off" />
          </Field>
          <Field label="Password" hint={passIsSet ? 'A password is saved. Leave blank to keep it.' : 'Not set.'}>
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
          <Field label="From address" required={draft.smtpEnabled} error={errors.smtpFrom} className="sm:col-span-2" hint='e.g. ADT10 Fans <no-reply@example.com>'>
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

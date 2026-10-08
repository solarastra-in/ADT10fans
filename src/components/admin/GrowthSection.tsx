import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Edit3, RefreshCw, ExternalLink } from 'lucide-react';
import { CommentaryAudioFeed, CreatorPartner, SuperfanPassportTier, YouthCupSchool } from '../../types';
import { api } from '../../api';
import {
  Actions,
  Button,
  Card,
  Checkbox,
  Chip,
  EmptyState,
  Errors,
  Field,
  Notice,
  NoticeState,
  SectionHeader,
  Select,
  Sheet,
  TextArea,
  TextInput,
  isHttpsUrl,
  statusTone,
  toNumber,
  useRunner,
} from './ui';

type Tab = 'schools' | 'creators' | 'audio' | 'tiers';
const TABS: { id: Tab; label: string }[] = [
  { id: 'schools', label: 'Youth schools' },
  { id: 'creators', label: 'Creators' },
  { id: 'audio', label: 'Commentary feeds' },
  { id: 'tiers', label: 'Passport tiers' },
];

const genId = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;
const isBareDomain = (u: string) => {
  try {
    const p = new URL(u).pathname;
    return p === '' || p === '/';
  } catch {
    return false;
  }
};
const numErr = (v: string) => (v !== '' && !(toNumber(v, -1) >= 0) ? 'Must be 0 or more.' : '');

type Runner = ReturnType<typeof useRunner>;

/* ------------------------------- Schools -------------------------------- */

type SchoolDraft = {
  id?: string;
  name: string;
  region: string;
  city: string;
  studentsCount: string;
  tapeBallTeam: string;
  status: YouthCupSchool['status'];
  equipmentKitGranted: boolean;
  matchdayTicketsAllocated: string;
};

const SchoolsPanel: React.FC<{ items: YouthCupSchool[]; setItems: (v: YouthCupSchool[]) => void; r: Runner }> = ({ items, setItems, r }) => {
  const [draft, setDraft] = useState<SchoolDraft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const blank: SchoolDraft = { name: '', region: '', city: '', studentsCount: '', tapeBallTeam: '', status: 'registered', equipmentKitGranted: false, matchdayTicketsAllocated: '' };

  const save = async () => {
    if (!draft) return;
    const e: Errors = {};
    if (!draft.name.trim()) e.name = 'School name is required.';
    if (!draft.city.trim()) e.city = 'City is required.';
    if (numErr(draft.studentsCount)) e.studentsCount = numErr(draft.studentsCount);
    if (numErr(draft.matchdayTicketsAllocated)) e.matchdayTicketsAllocated = numErr(draft.matchdayTicketsAllocated);
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await r.run(
      'save',
      () =>
        api.saveYouthSchool({
          id: draft.id,
          name: draft.name.trim(),
          region: draft.region.trim(),
          city: draft.city.trim(),
          studentsCount: toNumber(draft.studentsCount, 0),
          tapeBallTeam: draft.tapeBallTeam.trim(),
          status: draft.status,
          equipmentKitGranted: draft.equipmentKitGranted,
          matchdayTicketsAllocated: toNumber(draft.matchdayTicketsAllocated, 0),
        }),
      'School saved.'
    );
    if (res) {
      if (res.youthSchools) setItems(res.youthSchools);
      setDraft(null);
    }
  };

  const remove = async (s: YouthCupSchool) => {
    if (!window.confirm(`Delete ${s.name}?`)) return;
    const res = await r.run(`del:${s.id}`, () => api.deleteYouthSchool(s.id), 'School deleted.');
    if (res?.youthSchools) setItems(res.youthSchools);
  };

  return (
    <>
      <div className="flex justify-end">
        <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => { setErrors({}); setDraft({ ...blank }); }}>
          Add school
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No schools registered" />
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map(s => (
            <li key={s.id}>
              <Card className="flex flex-col gap-2 h-full">
                <div className="flex flex-wrap gap-1.5">
                  <Chip tone={statusTone(s.status)}>{s.status.replace('_', ' ')}</Chip>
                  {s.equipmentKitGranted && <Chip tone="green">kit granted</Chip>}
                </div>
                <p className="font-bold text-white break-words">{s.name}</p>
                <p className="text-xs text-slate-400">
                  {[s.city, s.region].filter(Boolean).join(', ')}
                  {s.studentsCount ? ` · ${s.studentsCount} students` : ''}
                  {s.matchdayTicketsAllocated ? ` · ${s.matchdayTicketsAllocated} tickets` : ''}
                </p>
                <Actions className="mt-auto pt-1">
                  <Button
                    size="sm"
                    icon={<Edit3 className="w-4 h-4" />}
                    onClick={() => {
                      setErrors({});
                      setDraft({
                        id: s.id,
                        name: s.name || '',
                        region: s.region || '',
                        city: s.city || '',
                        studentsCount: s.studentsCount ? String(s.studentsCount) : '',
                        tapeBallTeam: s.tapeBallTeam || '',
                        status: s.status,
                        equipmentKitGranted: !!s.equipmentKitGranted,
                        matchdayTicketsAllocated: s.matchdayTicketsAllocated ? String(s.matchdayTicketsAllocated) : '',
                      });
                    }}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" icon={<Trash2 className="w-4 h-4" />} loading={r.busy === `del:${s.id}`} onClick={() => remove(s)}>
                    Delete
                  </Button>
                </Actions>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Sheet
        open={!!draft}
        title={draft?.id ? 'Edit school' : 'Add school'}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={r.busy === 'save'}>
              Save school
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="School name" required error={errors.name} className="sm:col-span-2">
              <TextInput value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} error={!!errors.name} />
            </Field>
            <Field label="City" required error={errors.city}>
              <TextInput value={draft.city} onChange={e => setDraft({ ...draft, city: e.target.value })} error={!!errors.city} />
            </Field>
            <Field label="Region / emirate">
              <TextInput value={draft.region} onChange={e => setDraft({ ...draft, region: e.target.value })} />
            </Field>
            <Field label="Team name">
              <TextInput value={draft.tapeBallTeam} onChange={e => setDraft({ ...draft, tapeBallTeam: e.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as YouthCupSchool['status'] })}>
                <option value="registered">Registered</option>
                <option value="bracket_qualified">Qualified</option>
                <option value="champion">Champion</option>
              </Select>
            </Field>
            <Field label="Students taking part" error={errors.studentsCount}>
              <TextInput type="number" inputMode="numeric" min={0} value={draft.studentsCount} onChange={e => setDraft({ ...draft, studentsCount: e.target.value })} error={!!errors.studentsCount} />
            </Field>
            <Field label="Matchday tickets allocated" error={errors.matchdayTicketsAllocated}>
              <TextInput type="number" inputMode="numeric" min={0} value={draft.matchdayTicketsAllocated} onChange={e => setDraft({ ...draft, matchdayTicketsAllocated: e.target.value })} error={!!errors.matchdayTicketsAllocated} />
            </Field>
            <div className="sm:col-span-2">
              <Checkbox label="Equipment kit granted" checked={draft.equipmentKitGranted} onChange={v => setDraft({ ...draft, equipmentKitGranted: v })} />
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
};

/* ------------------------------- Creators ------------------------------- */

type CreatorDraft = {
  id?: string;
  name: string;
  handle: string;
  platform: CreatorPartner['platform'];
  followers: string;
  streamUrl: string;
  specialty: string;
  status: CreatorPartner['status'];
  totalWatchViews: string;
  avatar: string;
};

const CreatorsPanel: React.FC<{ items: CreatorPartner[]; setItems: (v: CreatorPartner[]) => void; r: Runner }> = ({ items, setItems, r }) => {
  const [draft, setDraft] = useState<CreatorDraft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const blank: CreatorDraft = { name: '', handle: '', platform: 'YouTube', followers: '', streamUrl: '', specialty: '', status: 'partnered', totalWatchViews: '', avatar: '' };

  const save = async () => {
    if (!draft) return;
    const e: Errors = {};
    if (!draft.name.trim()) e.name = 'Name is required.';
    if (!draft.handle.trim()) e.handle = 'Handle is required.';
    if (!draft.streamUrl.trim()) e.streamUrl = 'The creator’s real channel URL is required.';
    else if (!isHttpsUrl(draft.streamUrl)) e.streamUrl = 'URL must start with https://';
    else if (isBareDomain(draft.streamUrl)) e.streamUrl = 'Link to the creator’s own channel or profile, not a site homepage.';
    if (draft.avatar && !isHttpsUrl(draft.avatar)) e.avatar = 'Avatar URL must start with https://';
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await r.run(
      'save',
      () =>
        api.saveCreatorPartner({
          id: draft.id,
          name: draft.name.trim(),
          handle: draft.handle.trim(),
          platform: draft.platform,
          followers: draft.followers.trim(),
          streamUrl: draft.streamUrl.trim(),
          specialty: draft.specialty.trim(),
          status: draft.status,
          totalWatchViews: draft.totalWatchViews.trim(),
          avatar: draft.avatar.trim(),
        }),
      'Creator saved.'
    );
    if (res) {
      if (res.creatorPartners) setItems(res.creatorPartners);
      setDraft(null);
    }
  };

  const remove = async (c: CreatorPartner) => {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    const res = await r.run(`del:${c.id}`, () => api.deleteCreatorPartner(c.id), 'Creator deleted.');
    if (res?.creatorPartners) setItems(res.creatorPartners);
  };

  return (
    <>
      <div className="flex justify-end">
        <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => { setErrors({}); setDraft({ ...blank }); }}>
          Add creator
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No creator partners yet" description="Add creators you have an actual partnership with." />
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map(c => (
            <li key={c.id}>
              <Card className="flex flex-col gap-2 h-full">
                <div className="flex flex-wrap gap-1.5">
                  <Chip tone={statusTone(c.status)}>{c.status}</Chip>
                  <Chip>{c.platform}</Chip>
                  {!isHttpsUrl(c.streamUrl) ? (
                    <Chip tone="red">missing channel URL</Chip>
                  ) : isBareDomain(c.streamUrl) ? (
                    <Chip tone="red">generic URL — edit</Chip>
                  ) : null}
                </div>
                <p className="font-bold text-white break-words">
                  {c.name} <span className="text-slate-400 font-normal">{c.handle}</span>
                </p>
                {c.specialty && <p className="text-sm text-slate-400 break-words">{c.specialty}</p>}
                {isHttpsUrl(c.streamUrl) && (
                  <a href={c.streamUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-300 hover:underline break-all inline-flex items-center gap-1">
                    {c.streamUrl} <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                )}
                <Actions className="mt-auto pt-1">
                  <Button
                    size="sm"
                    icon={<Edit3 className="w-4 h-4" />}
                    onClick={() => {
                      setErrors({});
                      setDraft({
                        id: c.id,
                        name: c.name || '',
                        handle: c.handle || '',
                        platform: c.platform,
                        followers: c.followers || '',
                        streamUrl: c.streamUrl || '',
                        specialty: c.specialty || '',
                        status: c.status,
                        totalWatchViews: c.totalWatchViews || '',
                        avatar: c.avatar || '',
                      });
                    }}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" icon={<Trash2 className="w-4 h-4" />} loading={r.busy === `del:${c.id}`} onClick={() => remove(c)}>
                    Delete
                  </Button>
                </Actions>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Sheet
        open={!!draft}
        title={draft?.id ? 'Edit creator' : 'Add creator'}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={r.busy === 'save'}>
              Save creator
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name" required error={errors.name}>
              <TextInput value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} error={!!errors.name} />
            </Field>
            <Field label="Handle" required error={errors.handle} hint="e.g. @creator">
              <TextInput value={draft.handle} onChange={e => setDraft({ ...draft, handle: e.target.value })} error={!!errors.handle} />
            </Field>
            <Field label="Channel / profile URL" required error={errors.streamUrl} className="sm:col-span-2">
              <TextInput type="url" inputMode="url" placeholder="https://" value={draft.streamUrl} onChange={e => setDraft({ ...draft, streamUrl: e.target.value })} error={!!errors.streamUrl} />
            </Field>
            <Field label="Platform">
              <Select value={draft.platform} onChange={e => setDraft({ ...draft, platform: e.target.value as CreatorPartner['platform'] })}>
                <option value="YouTube">YouTube</option>
                <option value="Twitch">Twitch</option>
                <option value="Kick">Kick</option>
                <option value="TikTok">TikTok</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as CreatorPartner['status'] })}>
                <option value="partnered">Partnered</option>
                <option value="scheduled">Scheduled</option>
                <option value="live">Live now</option>
              </Select>
            </Field>
            <Field label="Specialty" className="sm:col-span-2">
              <TextInput value={draft.specialty} onChange={e => setDraft({ ...draft, specialty: e.target.value })} />
            </Field>
            <Field label="Followers" hint="Optional. Only enter a figure you have verified.">
              <TextInput value={draft.followers} onChange={e => setDraft({ ...draft, followers: e.target.value })} />
            </Field>
            <Field label="Total views" hint="Optional. Verified figures only.">
              <TextInput value={draft.totalWatchViews} onChange={e => setDraft({ ...draft, totalWatchViews: e.target.value })} />
            </Field>
            <Field label="Avatar URL" error={errors.avatar} className="sm:col-span-2" hint="Optional. Initials are shown when empty.">
              <TextInput type="url" inputMode="url" placeholder="https://" value={draft.avatar} onChange={e => setDraft({ ...draft, avatar: e.target.value })} error={!!errors.avatar} />
            </Field>
          </div>
        )}
      </Sheet>
    </>
  );
};

/* ---------------------------- Commentary feeds --------------------------- */

type AudioDraft = {
  id?: string;
  language: CommentaryAudioFeed['language'];
  commentator: string;
  status: CommentaryAudioFeed['status'];
  streamUrl: string;
  description: string;
  bitrate: string;
};

const AudioPanel: React.FC<{ items: CommentaryAudioFeed[]; setItems: (v: CommentaryAudioFeed[]) => void; r: Runner }> = ({ items, setItems, r }) => {
  const [draft, setDraft] = useState<AudioDraft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const blank: AudioDraft = { language: 'English', commentator: '', status: 'standby', streamUrl: '', description: '', bitrate: '' };

  const save = async () => {
    if (!draft) return;
    const e: Errors = {};
    if (!draft.commentator.trim()) e.commentator = 'Commentator / broadcaster is required.';
    if (!draft.streamUrl.trim()) e.streamUrl = 'Stream URL is required.';
    else if (!isHttpsUrl(draft.streamUrl)) e.streamUrl = 'Stream URL must start with https://';
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await r.run(
      'save',
      () =>
        api.saveAudioFeed({
          id: draft.id || genId('audio'),
          language: draft.language,
          commentator: draft.commentator.trim(),
          status: draft.status,
          streamUrl: draft.streamUrl.trim(),
          description: draft.description.trim(),
          bitrate: draft.bitrate.trim(),
        }),
      'Commentary feed saved.'
    );
    if (res) {
      if (res.commentaryFeeds) setItems(res.commentaryFeeds);
      setDraft(null);
    }
  };

  const remove = async (f: CommentaryAudioFeed) => {
    if (!window.confirm(`Delete the ${f.language} feed?`)) return;
    const res = await r.run(`del:${f.id}`, () => api.deleteAudioFeed(f.id), 'Feed deleted.');
    if (res?.commentaryFeeds) setItems(res.commentaryFeeds);
  };

  const toggle = async (f: CommentaryAudioFeed) => {
    const res = await r.run(`tg:${f.id}`, () => api.saveAudioFeed({ ...f, status: f.status === 'live' ? 'standby' : 'live' }));
    if (res?.commentaryFeeds) setItems(res.commentaryFeeds);
  };

  return (
    <>
      <div className="flex justify-end">
        <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => { setErrors({}); setDraft({ ...blank }); }}>
          Add feed
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No commentary feeds" description="Add a feed when you have a licensed audio stream URL." />
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map(f => (
            <li key={f.id}>
              <Card className="flex flex-col gap-2 h-full">
                <div className="flex flex-wrap gap-1.5">
                  <Chip tone={statusTone(f.status)}>{f.status}</Chip>
                  <Chip>{f.language}</Chip>
                  {!isHttpsUrl(f.streamUrl) && <Chip tone="red">missing stream URL</Chip>}
                </div>
                <p className="font-bold text-white break-words">{f.commentator}</p>
                {f.description && <p className="text-sm text-slate-400 break-words">{f.description}</p>}
                {f.streamUrl && <p className="text-xs text-slate-500 break-all">{f.streamUrl}</p>}
                <Actions className="mt-auto pt-1">
                  <Button size="sm" loading={r.busy === `tg:${f.id}`} onClick={() => toggle(f)} disabled={f.status !== 'live' && !isHttpsUrl(f.streamUrl)}>
                    {f.status === 'live' ? 'Set standby' : 'Set live'}
                  </Button>
                  <Button
                    size="sm"
                    icon={<Edit3 className="w-4 h-4" />}
                    onClick={() => {
                      setErrors({});
                      setDraft({
                        id: f.id,
                        language: f.language,
                        commentator: f.commentator || '',
                        status: f.status,
                        streamUrl: f.streamUrl || '',
                        description: f.description || '',
                        bitrate: f.bitrate || '',
                      });
                    }}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" icon={<Trash2 className="w-4 h-4" />} loading={r.busy === `del:${f.id}`} onClick={() => remove(f)}>
                    Delete
                  </Button>
                </Actions>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Sheet
        open={!!draft}
        title={draft?.id ? 'Edit commentary feed' : 'Add commentary feed'}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={r.busy === 'save'}>
              Save feed
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Language">
              <Select value={draft.language} onChange={e => setDraft({ ...draft, language: e.target.value as CommentaryAudioFeed['language'] })}>
                {['English', 'Arabic', 'Hindi', 'Urdu', 'Bengali'].map(l => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as CommentaryAudioFeed['status'] })}>
                <option value="standby">Standby</option>
                <option value="live">Live</option>
              </Select>
            </Field>
            <Field label="Commentator / broadcaster" required error={errors.commentator} className="sm:col-span-2">
              <TextInput value={draft.commentator} onChange={e => setDraft({ ...draft, commentator: e.target.value })} error={!!errors.commentator} />
            </Field>
            <Field label="Stream URL" required error={errors.streamUrl} className="sm:col-span-2">
              <TextInput type="url" inputMode="url" placeholder="https://" value={draft.streamUrl} onChange={e => setDraft({ ...draft, streamUrl: e.target.value })} error={!!errors.streamUrl} />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <TextArea rows={2} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <Field label="Bitrate" hint="Optional, e.g. 128 kbps">
              <TextInput value={draft.bitrate} onChange={e => setDraft({ ...draft, bitrate: e.target.value })} />
            </Field>
          </div>
        )}
      </Sheet>
    </>
  );
};

/* ----------------------------- Passport tiers ---------------------------- */

type TierDraft = {
  id?: string;
  tierName: string;
  annualFeeUsd: string;
  annualFeeAed: string;
  ticketDiscountPct: string;
  fanSpacePriorityEntry: boolean;
  exclusiveBadge: string;
  doublePointsMultiplier: boolean;
  description: string;
  signupUrl: string;
};

const TiersPanel: React.FC<{ items: SuperfanPassportTier[]; setItems: (v: SuperfanPassportTier[]) => void; r: Runner }> = ({ items, setItems, r }) => {
  const [draft, setDraft] = useState<TierDraft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const blank: TierDraft = {
    tierName: '',
    annualFeeUsd: '',
    annualFeeAed: '',
    ticketDiscountPct: '',
    fanSpacePriorityEntry: false,
    exclusiveBadge: '',
    doublePointsMultiplier: false,
    description: '',
    signupUrl: '',
  };

  const save = async () => {
    if (!draft) return;
    const e: Errors = {};
    if (!draft.tierName.trim()) e.tierName = 'Tier name is required.';
    (['annualFeeUsd', 'annualFeeAed'] as const).forEach(k => numErr(draft[k]) && (e[k] = numErr(draft[k])));
    const pct = toNumber(draft.ticketDiscountPct, -1);
    if (draft.ticketDiscountPct !== '' && !(pct >= 0 && pct <= 100)) e.ticketDiscountPct = 'Use 0–100.';
    if (draft.signupUrl && !isHttpsUrl(draft.signupUrl)) e.signupUrl = 'Sign-up URL must start with https://';
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await r.run(
      'save',
      () =>
        api.savePassportTier({
          id: draft.id || genId('tier'),
          tierName: draft.tierName.trim(),
          annualFeeUsd: toNumber(draft.annualFeeUsd, 0),
          annualFeeAed: toNumber(draft.annualFeeAed, 0),
          ticketDiscountPct: toNumber(draft.ticketDiscountPct, 0),
          fanSpacePriorityEntry: draft.fanSpacePriorityEntry,
          exclusiveBadge: draft.exclusiveBadge.trim(),
          doublePointsMultiplier: draft.doublePointsMultiplier,
          description: draft.description.trim(),
          signupUrl: draft.signupUrl.trim(),
        }),
      'Tier saved.'
    );
    if (res) {
      if (res.passportTiers) setItems(res.passportTiers);
      setDraft(null);
    }
  };

  const remove = async (t: SuperfanPassportTier) => {
    if (!window.confirm(`Delete the ${t.tierName} tier?`)) return;
    const res = await r.run(`del:${t.id}`, () => api.deletePassportTier(t.id), 'Tier deleted.');
    if (res?.passportTiers) setItems(res.passportTiers);
  };

  return (
    <>
      <div className="flex justify-end">
        <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => { setErrors({}); setDraft({ ...blank }); }}>
          Add tier
        </Button>
      </div>
      <p className="text-sm text-slate-400">Fans register interest only; no payment is taken on this site. Only list benefits that are actually offered.</p>
      {items.length === 0 ? (
        <EmptyState title="No passport tiers" />
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map(t => (
            <li key={t.id}>
              <Card className="flex flex-col gap-2 h-full">
                <div className="flex flex-wrap gap-1.5">
                  <Chip tone="slate">{(t.totalSubscribers ?? 0).toLocaleString()} registered</Chip>
                  {t.ticketDiscountPct > 0 && <Chip tone="amber">{t.ticketDiscountPct}% ticket discount</Chip>}
                  {t.fanSpacePriorityEntry && <Chip tone="blue">priority entry</Chip>}
                  {t.doublePointsMultiplier && <Chip tone="violet">2× points</Chip>}
                </div>
                <p className="font-bold text-white break-words">{t.tierName}</p>
                <p className="text-sm text-slate-400">
                  {t.annualFeeUsd || t.annualFeeAed ? `USD ${t.annualFeeUsd} / AED ${t.annualFeeAed} per year` : 'Free'}
                </p>
                <Actions className="mt-auto pt-1">
                  <Button
                    size="sm"
                    icon={<Edit3 className="w-4 h-4" />}
                    onClick={() => {
                      setErrors({});
                      setDraft({
                        id: t.id,
                        tierName: t.tierName || '',
                        annualFeeUsd: t.annualFeeUsd ? String(t.annualFeeUsd) : '',
                        annualFeeAed: t.annualFeeAed ? String(t.annualFeeAed) : '',
                        ticketDiscountPct: t.ticketDiscountPct ? String(t.ticketDiscountPct) : '',
                        fanSpacePriorityEntry: !!t.fanSpacePriorityEntry,
                        exclusiveBadge: t.exclusiveBadge || '',
                        doublePointsMultiplier: !!t.doublePointsMultiplier,
                        description: t.description || '',
                        signupUrl: t.signupUrl || '',
                      });
                    }}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" icon={<Trash2 className="w-4 h-4" />} loading={r.busy === `del:${t.id}`} onClick={() => remove(t)}>
                    Delete
                  </Button>
                </Actions>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Sheet
        open={!!draft}
        title={draft?.id ? 'Edit tier' : 'Add tier'}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={r.busy === 'save'}>
              Save tier
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Tier name" required error={errors.tierName} className="sm:col-span-2">
              <TextInput value={draft.tierName} onChange={e => setDraft({ ...draft, tierName: e.target.value })} error={!!errors.tierName} />
            </Field>
            <Field label="Annual fee (USD)" error={errors.annualFeeUsd} hint="Blank or 0 = free">
              <TextInput type="number" inputMode="decimal" min={0} value={draft.annualFeeUsd} onChange={e => setDraft({ ...draft, annualFeeUsd: e.target.value })} error={!!errors.annualFeeUsd} />
            </Field>
            <Field label="Annual fee (AED)" error={errors.annualFeeAed}>
              <TextInput type="number" inputMode="decimal" min={0} value={draft.annualFeeAed} onChange={e => setDraft({ ...draft, annualFeeAed: e.target.value })} error={!!errors.annualFeeAed} />
            </Field>
            <Field label="Ticket discount %" error={errors.ticketDiscountPct} hint="Only if a ticketing partner has agreed to it">
              <TextInput type="number" inputMode="numeric" min={0} max={100} value={draft.ticketDiscountPct} onChange={e => setDraft({ ...draft, ticketDiscountPct: e.target.value })} error={!!errors.ticketDiscountPct} />
            </Field>
            <Field label="Profile badge name">
              <TextInput value={draft.exclusiveBadge} onChange={e => setDraft({ ...draft, exclusiveBadge: e.target.value })} />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <TextArea rows={2} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <Field label="External sign-up URL" error={errors.signupUrl} className="sm:col-span-2" hint="Optional. When empty, fans can only register interest.">
              <TextInput type="url" inputMode="url" placeholder="https://" value={draft.signupUrl} onChange={e => setDraft({ ...draft, signupUrl: e.target.value })} error={!!errors.signupUrl} />
            </Field>
            <Checkbox label="Priority entry at fan spaces" checked={draft.fanSpacePriorityEntry} onChange={v => setDraft({ ...draft, fanSpacePriorityEntry: v })} />
            <Checkbox label="Double fan points" checked={draft.doublePointsMultiplier} onChange={v => setDraft({ ...draft, doublePointsMultiplier: v })} />
          </div>
        )}
      </Sheet>
    </>
  );
};

/* -------------------------------- Section -------------------------------- */

export const GrowthSection: React.FC = () => {
  const r = useRunner();
  const [tab, setTab] = useState<Tab>('schools');
  const [schools, setSchools] = useState<YouthCupSchool[]>([]);
  const [creators, setCreators] = useState<CreatorPartner[]>([]);
  const [audio, setAudio] = useState<CommentaryAudioFeed[]>([]);
  const [tiers, setTiers] = useState<SuperfanPassportTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<NoticeState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const res = await api.getGrowthCatalysts();
      setSchools(res.youthSchools || []);
      setCreators(res.creatorPartners || []);
      setAudio(res.commentaryFeeds || []);
      setTiers(res.passportTiers || []);
    } catch (e: any) {
      setLoadErr({ kind: 'err', text: e?.message || 'Could not load growth programmes' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts: Record<Tab, number> = { schools: schools.length, creators: creators.length, audio: audio.length, tiers: tiers.length };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Growth programmes"
        description="Youth schools, creator partners, commentary feeds and passport tiers."
        actions={
          <Button size="sm" onClick={load} loading={loading} icon={<RefreshCw className="w-4 h-4" />}>
            Refresh
          </Button>
        }
      />
      <div
        className="-mx-4 px-4 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Growth programmes"
      >
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              r.setNotice(null);
              setTab(t.id);
            }}
            className={`shrink-0 min-h-[36px] px-3 rounded-full text-sm font-bold border whitespace-nowrap ${
              tab === t.id ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            {t.label} ({counts[t.id]})
          </button>
        ))}
      </div>
      <Notice notice={loadErr} />
      <Notice notice={r.notice} onClose={() => r.setNotice(null)} />
      <div className="space-y-3">
        {tab === 'schools' && <SchoolsPanel items={schools} setItems={setSchools} r={r} />}
        {tab === 'creators' && <CreatorsPanel items={creators} setItems={setCreators} r={r} />}
        {tab === 'audio' && <AudioPanel items={audio} setItems={setAudio} r={r} />}
        {tab === 'tiers' && <TiersPanel items={tiers} setItems={setTiers} r={r} />}
      </div>
    </div>
  );
};

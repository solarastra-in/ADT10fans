import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Edit3, RefreshCw } from 'lucide-react';
import { FanSpace, FanSpaceBooking } from '../../types';
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
  SectionHeader,
  Select,
  Sheet,
  TextArea,
  TextInput,
  formatDateTime,
  isHttpsUrl,
  splitList,
  statusTone,
  toNumber,
  useRunner,
} from './ui';

type Draft = {
  id?: string;
  name: string;
  city: string;
  country: string;
  tagline: string;
  location: string;
  capacity: string;
  status: FanSpace['status'];
  image: string;
  mapUrl: string;
  features: string;
  amenities: string;
  openHours: string;
  liveMatchSchedule: string;
  vipPassPriceAed: string;
  vipPassPriceUsd: string;
  vipPerks: string;
  merchBoutique: string;
  menuHighlights: string;
  bookingEnabled: boolean;
};

const blank: Draft = {
  name: '',
  city: '',
  country: '',
  tagline: '',
  location: '',
  capacity: '',
  status: 'upcoming',
  image: '',
  mapUrl: '',
  features: '',
  amenities: '',
  openHours: '',
  liveMatchSchedule: '',
  vipPassPriceAed: '',
  vipPassPriceUsd: '',
  vipPerks: '',
  merchBoutique: '',
  menuHighlights: '',
  bookingEnabled: false,
};

const fromSpace = (s: FanSpace): Draft => ({
  id: s.id,
  name: s.name || '',
  city: s.city || '',
  country: s.country || '',
  tagline: s.tagline || '',
  location: s.location || '',
  capacity: s.capacity ? String(s.capacity) : '',
  status: s.status || 'upcoming',
  image: s.image || '',
  mapUrl: s.mapUrl || '',
  features: (s.features || []).join('\n'),
  amenities: (s.amenities || []).join('\n'),
  openHours: s.openHours || '',
  liveMatchSchedule: s.liveMatchSchedule || '',
  vipPassPriceAed: s.vipPassPriceAed ? String(s.vipPassPriceAed) : '',
  vipPassPriceUsd: s.vipPassPriceUsd ? String(s.vipPassPriceUsd) : '',
  vipPerks: (s.vipPerks || []).join('\n'),
  merchBoutique: s.merchBoutique || '',
  menuHighlights: s.menuHighlights || '',
  bookingEnabled: !!s.bookingEnabled,
});

export const FanSpacesSection: React.FC = () => {
  const { busy, notice, setNotice, run } = useRunner();
  const [spaces, setSpaces] = useState<FanSpace[]>([]);
  const [bookings, setBookings] = useState<FanSpaceBooking[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, b] = await Promise.allSettled([api.getFanSpaces(), api.getAdminFanSpaceBookings()]);
    if (s.status === 'fulfilled') setSpaces(s.value.spaces || []);
    else setNotice({ kind: 'err', text: (s.reason as any)?.message || 'Could not load fan spaces' });
    if (b.status === 'fulfilled') setBookings(b.value.bookings || []);
    setLoading(false);
  }, [setNotice]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!draft) return;
    const e: Errors = {};
    if (!draft.name.trim()) e.name = 'Name is required.';
    if (!draft.city.trim()) e.city = 'City is required.';
    if (!draft.country.trim()) e.country = 'Country is required.';
    if (draft.image && !isHttpsUrl(draft.image)) e.image = 'Image URL must start with https://';
    if (draft.mapUrl && !isHttpsUrl(draft.mapUrl)) e.mapUrl = 'Map URL must start with https://';
    (['capacity', 'vipPassPriceAed', 'vipPassPriceUsd'] as const).forEach(k => {
      if (draft[k] && !(toNumber(draft[k], -1) >= 0)) e[k] = 'Must be a number (0 or more).';
    });
    setErrors(e);
    if (Object.keys(e).length) return;
    const payload: Partial<FanSpace> = {
      id: draft.id,
      name: draft.name.trim(),
      city: draft.city.trim(),
      country: draft.country.trim(),
      tagline: draft.tagline.trim(),
      location: draft.location.trim(),
      capacity: toNumber(draft.capacity, 0),
      status: draft.status,
      image: draft.image.trim(),
      mapUrl: draft.mapUrl.trim(),
      features: splitList(draft.features),
      amenities: splitList(draft.amenities),
      openHours: draft.openHours.trim(),
      liveMatchSchedule: draft.liveMatchSchedule.trim(),
      vipPassPriceAed: toNumber(draft.vipPassPriceAed, 0),
      vipPassPriceUsd: toNumber(draft.vipPassPriceUsd, 0),
      vipPerks: splitList(draft.vipPerks),
      merchBoutique: draft.merchBoutique.trim(),
      menuHighlights: draft.menuHighlights.trim(),
      bookingEnabled: draft.bookingEnabled,
    };
    const res = await run('save', () => api.saveFanSpace(payload), 'Fan space saved.');
    if (res) {
      if (res.spaces) setSpaces(res.spaces);
      setDraft(null);
    }
  };

  const remove = async (s: FanSpace) => {
    if (!window.confirm(`Delete ${s.name}?`)) return;
    const res = await run(`del:${s.id}`, () => api.deleteFanSpace(s.id), 'Fan space deleted.');
    if (res?.spaces) setSpaces(res.spaces);
  };

  const set = (patch: Partial<Draft>) => draft && setDraft({ ...draft, ...patch });

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Fan spaces"
        description="Physical venues where fans can watch together. Only list venues that are confirmed."
        actions={
          <>
            <Button size="sm" onClick={load} loading={loading} icon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setErrors({});
                setDraft({ ...blank });
              }}
            >
              Add venue
            </Button>
          </>
        }
      />
      <Notice notice={notice} onClose={() => setNotice(null)} />

      {spaces.length === 0 ? (
        <EmptyState title="No fan spaces yet" description="Add a venue once it has been confirmed." />
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {spaces.map(s => (
            <li key={s.id}>
              <Card className="flex flex-col gap-2 h-full">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone={statusTone(s.status)}>{s.status.replace('_', ' ')}</Chip>
                  <Chip>{s.bookingEnabled ? 'Bookings on' : 'Bookings off'}</Chip>
                  <Chip tone="slate">{bookings.filter(b => b.spaceId === s.id).length} bookings</Chip>
                </div>
                <p className="font-bold text-white break-words">{s.name}</p>
                <p className="text-xs text-slate-400 break-words">
                  {[s.location, s.city, s.country].filter(Boolean).join(', ')}
                </p>
                <Actions className="mt-auto pt-1">
                  <Button
                    size="sm"
                    icon={<Edit3 className="w-4 h-4" />}
                    onClick={() => {
                      setErrors({});
                      setDraft(fromSpace(s));
                    }}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" icon={<Trash2 className="w-4 h-4" />} loading={busy === `del:${s.id}`} onClick={() => remove(s)}>
                    Delete
                  </Button>
                </Actions>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <h3 className="font-extrabold text-white mb-3">Bookings ({bookings.length})</h3>
        {bookings.length === 0 ? (
          <EmptyState title="No bookings yet" />
        ) : (
          <ul className="divide-y divide-slate-800">
            {bookings.map(b => (
              <li key={b.id} className="py-2 text-sm">
                <p className="font-bold text-white break-words">
                  {b.userName} · {b.spaceName}
                </p>
                <p className="text-xs text-slate-400 break-all">
                  {b.userEmail} · {b.ticketType.replace(/_/g, ' ')} × {b.ticketsCount} · {b.date || formatDateTime(b.createdAt)} · code {b.passCode}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Sheet
        open={!!draft}
        wide
        title={draft?.id ? 'Edit fan space' : 'Add fan space'}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={busy === 'save'}>
              Save venue
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name" required error={errors.name} className="sm:col-span-2">
              <TextInput value={draft.name} onChange={e => set({ name: e.target.value })} error={!!errors.name} />
            </Field>
            <Field label="City" required error={errors.city}>
              <TextInput value={draft.city} onChange={e => set({ city: e.target.value })} error={!!errors.city} />
            </Field>
            <Field label="Country" required error={errors.country}>
              <TextInput value={draft.country} onChange={e => set({ country: e.target.value })} error={!!errors.country} />
            </Field>
            <Field label="Address / location" className="sm:col-span-2">
              <TextInput value={draft.location} onChange={e => set({ location: e.target.value })} />
            </Field>
            <Field label="Tagline" className="sm:col-span-2">
              <TextInput value={draft.tagline} onChange={e => set({ tagline: e.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={draft.status} onChange={e => set({ status: e.target.value as FanSpace['status'] })}>
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="sold_out">Sold out</option>
              </Select>
            </Field>
            <Field label="Capacity" error={errors.capacity}>
              <TextInput type="number" inputMode="numeric" min={0} value={draft.capacity} onChange={e => set({ capacity: e.target.value })} error={!!errors.capacity} />
            </Field>
            <Field label="Image URL" error={errors.image} hint="Optional. A neutral placeholder is shown when empty.">
              <TextInput type="url" inputMode="url" placeholder="https://" value={draft.image} onChange={e => set({ image: e.target.value })} error={!!errors.image} />
            </Field>
            <Field label="Map URL" error={errors.mapUrl}>
              <TextInput type="url" inputMode="url" placeholder="https://" value={draft.mapUrl} onChange={e => set({ mapUrl: e.target.value })} error={!!errors.mapUrl} />
            </Field>
            <Field label="Opening hours">
              <TextInput value={draft.openHours} onChange={e => set({ openHours: e.target.value })} />
            </Field>
            <Field label="Screening schedule">
              <TextInput value={draft.liveMatchSchedule} onChange={e => set({ liveMatchSchedule: e.target.value })} />
            </Field>
            <Field label="Features" hint="One per line">
              <TextArea rows={3} value={draft.features} onChange={e => set({ features: e.target.value })} />
            </Field>
            <Field label="Amenities" hint="One per line">
              <TextArea rows={3} value={draft.amenities} onChange={e => set({ amenities: e.target.value })} />
            </Field>
            <Field label="VIP pass price (AED)" error={errors.vipPassPriceAed} hint="Leave blank if not selling VIP passes">
              <TextInput type="number" inputMode="decimal" min={0} value={draft.vipPassPriceAed} onChange={e => set({ vipPassPriceAed: e.target.value })} error={!!errors.vipPassPriceAed} />
            </Field>
            <Field label="VIP pass price (USD)" error={errors.vipPassPriceUsd}>
              <TextInput type="number" inputMode="decimal" min={0} value={draft.vipPassPriceUsd} onChange={e => set({ vipPassPriceUsd: e.target.value })} error={!!errors.vipPassPriceUsd} />
            </Field>
            <Field label="VIP perks" hint="One per line" className="sm:col-span-2">
              <TextArea rows={2} value={draft.vipPerks} onChange={e => set({ vipPerks: e.target.value })} />
            </Field>
            <Field label="Merchandise">
              <TextInput value={draft.merchBoutique} onChange={e => set({ merchBoutique: e.target.value })} />
            </Field>
            <Field label="Food & drink">
              <TextInput value={draft.menuHighlights} onChange={e => set({ menuHighlights: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Checkbox label="Accept bookings on the site" checked={draft.bookingEnabled} onChange={v => set({ bookingEnabled: v })} />
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
};

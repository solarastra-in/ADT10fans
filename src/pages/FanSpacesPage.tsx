import React, { useEffect, useState } from 'react';
import { CalendarDays, Clock, ExternalLink, MapPin, QrCode, Users } from 'lucide-react';
import QRCode from 'qrcode';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { usePageMeta } from '../router';
import { Button, ButtonLink, Card, EmptyState, ErrorBox, Field, Modal, Notice, PageHeader, Pill, SectionTitle, Spinner, inputCls, useFormat } from '../components/ui';
import type { FanSpace, FanSpaceBooking } from '../types';

export function PassQR({ code, size = 220 }: { code: string; size?: number }) {
  const [src, setSrc] = useState<string>('');
  useEffect(() => {
    QRCode.toDataURL(`ADT10PASS:${code}`, { width: size, margin: 1, errorCorrectionLevel: 'M' }).then(setSrc).catch(() => setSrc(''));
  }, [code, size]);
  return src ? <img src={src} alt={`QR code for pass ${code}`} width={size} height={size} className="rounded-xl bg-white p-2 mx-auto" data-testid="pass-qr" /> : <div style={{ width: size, height: size }} className="mx-auto rounded-xl bg-slate-800" />;
}

function BookingForm({ space, onBooked }: { space: FanSpace; onBooked: (b: FanSpaceBooking) => void }) {
  const { user, openAuth, toast } = useApp();
  const t = useT();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
  const [date, setDate] = useState(today);
  const [type, setType] = useState('standard_entry');
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const vip = space.vipPerks?.length || space.vipPassPriceAed;
  const book = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return openAuth(t('Sign in to book a Fan Space pass.'));
    setBusy(true);
    try {
      const r = await api.bookFanSpace(space.id, { date, ticketType: type, ticketsCount: count });
      onBooked(r.booking);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={book} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
      <Field label={t('Date')}>
        <input type="date" value={date} min={today} onChange={e => setDate(e.target.value)} className={inputCls} required />
      </Field>
      <Field label={t('Pass')}>
        <select value={type} onChange={e => setType(e.target.value)} className={inputCls}>
          <option value="standard_entry">{t('Standard entry')}</option>
          {vip ? <option value="vip_pass">{t('VIP')}{space.vipPassPriceAed ? ` (AED ${space.vipPassPriceAed})` : ''}</option> : null}
        </select>
      </Field>
      <Field label={t('People')}>
        <select value={count} onChange={e => setCount(Number(e.target.value))} className={inputCls}>
          {[1, 2, 3, 4, 5, 6].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </Field>
      <Button type="submit" loading={busy}>{t('Book pass')}</Button>
    </form>
  );
}

export default function FanSpacesPage() {
  const { user, config, toast } = useApp();
  const t = useT();
  const f = useFormat();
  usePageMeta(t('Fan Spaces and watch parties'), t('Official screening venues and watch parties. Book a free pass and check in with your QR code.'), config?.brandName);
  const { data, error, loading, reload } = useLoad(() => api.getFanSpaces(), [user?.id]);
  const [pass, setPass] = useState<FanSpaceBooking | null>(null);
  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox message={error || ''} onRetry={reload} />;
  const myPasses = data.bookings.filter(b => !b.cancelledAt);

  const cancel = async (b: FanSpaceBooking) => {
    if (!confirm(t('Cancel this pass?'))) return;
    try {
      await api.cancelBooking(b.id);
      toast(t('Pass cancelled'));
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t('Watch together')} title={t('Fan Spaces')} subtitle={t('Screenings and watch parties for every match. Book a pass, then show the QR code at the door.')} />
      {myPasses.length > 0 && (
        <section>
          <SectionTitle title={t('My passes')} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myPasses.map(b => (
              <Card key={b.id} className="p-4 flex items-center gap-3" data-testid="my-pass">
                <QrCode className="w-8 h-8 text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{b.spaceName}</p>
                  <p className="text-xs text-slate-400">
                    {f.date(b.date + 'T12:00:00', { weekday: 'short', day: 'numeric', month: 'short' })} · {t('{n} people', { n: b.ticketsCount })} · <span className="font-mono">{b.passCode}</span>
                  </p>
                  {b.checkedInAt && <Pill tone="green">{t('Checked in')}</Pill>}
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" onClick={() => setPass(b)}>{t('Show QR')}</Button>
                  {!b.checkedInAt && <Button size="sm" variant="ghost" onClick={() => cancel(b)}>{t('Cancel')}</Button>}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
      {data.spaces.length === 0 ? (
        <EmptyState icon={<Users className="w-6 h-6" />} title={t('Fan Spaces will be announced soon')} body={t('Venues and watch parties are listed here as soon as they are confirmed.')} />
      ) : (
        <div className="space-y-4">
          {data.spaces.map(s => (
            <Card key={s.id} className="overflow-hidden" data-testid="fanspace-card">
              {s.image && <img src={s.image} alt="" className="w-full h-44 sm:h-56 object-cover bg-slate-800" loading="lazy" />}
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-black text-white">{s.name}</h2>
                    <p className="text-sm text-slate-400 inline-flex items-center gap-1"><MapPin className="w-4 h-4" /> {[s.location, s.city, s.country].filter(Boolean).join(', ')}</p>
                  </div>
                  <Pill tone={s.status === 'active' ? 'green' : s.status === 'sold_out' ? 'red' : 'amber'}>{s.status === 'active' ? t('Open') : s.status === 'sold_out' ? t('Full') : t('Coming soon')}</Pill>
                </div>
                {s.tagline && <p className="text-sm text-slate-300">{s.tagline}</p>}
                <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                  {s.openHours && <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {s.openHours}</span>}
                  {s.liveMatchSchedule && <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {s.liveMatchSchedule}</span>}
                  {s.capacity > 0 && <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {t('Capacity {n}', { n: s.capacity })}</span>}
                </div>
                {s.features.length > 0 && <div className="flex flex-wrap gap-1.5">{s.features.map(x => <Pill key={x}>{x}</Pill>)}</div>}
                {s.vipPerks.length > 0 && <p className="text-xs text-amber-200">{t('VIP')}: {s.vipPerks.join(' · ')}</p>}
                {s.mapUrl && (
                  <ButtonLink to={s.mapUrl} external variant="ghost" size="sm">
                    {t('Directions')} <ExternalLink className="w-3.5 h-3.5" />
                  </ButtonLink>
                )}
                {s.bookingEnabled !== false && s.status !== 'sold_out' ? (
                  <BookingForm space={s} onBooked={b => { setPass(b); reload(); }} />
                ) : (
                  <Notice>{t('Bookings are not open for this Fan Space yet.')}</Notice>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={Boolean(pass)} onClose={() => setPass(null)} title={t('Your pass')}>
        {pass && (
          <div className="space-y-3 text-center">
            <PassQR code={pass.passCode} />
            <p className="text-2xl font-black font-mono tracking-widest text-amber-300" data-testid="pass-code">{pass.passCode}</p>
            <p className="text-sm text-slate-300">{pass.spaceName} · {f.date(pass.date + 'T12:00:00', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <p className="text-xs text-slate-500">{t('{n} people · show this at the door. Each pass can be scanned once.', { n: pass.ticketsCount })}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

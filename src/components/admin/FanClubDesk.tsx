import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CameraOff, CheckCircle2, Gift, Pencil, Plus, Trash2, UserCheck } from 'lucide-react';
import { useApp, useLoad } from '../../state';
import { api } from '../../api';
import { useT } from '../../i18n';
import { Link, usePageMeta } from '../../router';
import { Avatar, Button, Card, EmptyState, ErrorBox, Field, Modal, PageHeader, Pill, Spinner, Tabs, inputCls, useFormat } from '../ui';
import type { FanClubAdminClub, FanClubFanLookup, VenueOffer } from '../../types';

const CLUB_KEY = 'fanclub_admin_club';
const store = {
  get: () => {
    try {
      return localStorage.getItem(CLUB_KEY) || '';
    } catch {
      return '';
    }
  },
  set: (v: string) => {
    try {
      localStorage.setItem(CLUB_KEY, v);
    } catch {
      /* private mode */
    }
  },
};

/**
 * The fan club desk: for fan club admins (their own clubs) and league admins (every club). Check fans
 * in by code or QR (each check-in gives points), redeem offers, edit the club and its offers.
 */
export function FanClubAdminPage() {
  const { user, config, openAuth } = useApp();
  const t = useT();
  usePageMeta(t('Fan club desk'), undefined, config?.brandName);
  const data = useLoad(() => api.fanClubAdmin(), [user?.id]);
  const [clubId, setClubId] = useState(store.get());
  const [tab, setTab] = useState<'desk' | 'matches' | 'offers' | 'club' | 'activity'>('desk');

  const clubs = data.data?.clubs || [];
  const club = clubs.find(c => c.id === clubId) || clubs[0];
  useEffect(() => {
    if (club && club.id !== clubId) setClubId(club.id);
  }, [club?.id]);

  if (!user) {
    return <EmptyState title={t('Sign in to use the fan club desk')} action={<Button onClick={() => openAuth()}>{t('Sign in')}</Button>} />;
  }
  if (data.error) return <ErrorBox message={data.error} onRetry={data.reload} />;
  if (!data.data) return <Spinner />;
  if (!clubs.length) {
    return (
      <EmptyState
        title={t('No fan clubs yet')}
        body={data.data.leagueWide ? t('Add the first fan club, or import a list.') : t('You are not an admin of any fan club yet. Ask a league admin to add you.')}
        action={data.data.leagueWide ? <Link to="/admin/fanclubs" className="underline text-amber-300">{t('Manage fan clubs')}</Link> : undefined}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('Fan club desk')}
        title={club.name}
        subtitle={`${club.city}, ${club.country}`}
        actions={data.data.leagueWide ? <Link to="/admin/fanclubs" className="text-sm text-amber-300 underline">{t('All fan clubs')}</Link> : undefined}
      />
      {clubs.length > 1 && (
        <Field label={t('Fan club')} htmlFor="fc-club">
          <select
            id="fc-club"
            className={inputCls}
            value={club.id}
            onChange={e => {
              setClubId(e.target.value);
              store.set(e.target.value);
            }}
          >
            {clubs.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.city}
                {c.active === false ? ` (${t('off')})` : ''}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'desk', label: t('Check-in') },
          { id: 'offers', label: t('Offers ({n})', { n: club.offers.filter(o => o.active !== false).length }) },
          { id: 'club', label: t('Club') },
          { id: 'matches', label: t('Matches ({n})', { n: club.matchIds.length }) },
          { id: 'activity', label: t('Activity') },
        ]}
      />
      {tab === 'desk' && <Desk club={club} view={data.data} onChange={data.reload} />}
      {tab === 'matches' && <ClubMatches club={club} view={data.data} onChange={data.reload} />}
      {tab === 'offers' && <Offers club={club} onChange={data.reload} />}
      {tab === 'club' && <ClubForm club={club} leagueWide={data.data.leagueWide} defaultPoints={data.data.defaultCheckInPoints} onSaved={data.reload} />}
      {tab === 'activity' && <Activity clubId={club.id} />}
    </div>
  );
}

function Desk({ club, view, onChange }: { club: FanClubAdminClub; view: NonNullable<Awaited<ReturnType<typeof api.fanClubAdmin>>>; onChange: () => void }) {
  const { teamById, toast } = useApp();
  const t = useT();
  const f = useFormat();
  // Only today's matches (in Abu Dhabi) can be chosen for check-in, plus any whose check-in is open now.
  const clubAll = view.matches.filter(m => club.matchIds.includes(m.id));
  const clubMatchList = clubAll.filter(m => m.day === view.today || m.open);
  const nextMatch = clubAll.find(m => !m.test && m.status !== 'completed' && m.status !== 'abandoned' && (m.day || '') > view.today);
  const testMatch = view.matches.find(m => m.test);
  const pick = () => (clubMatchList.find(m => m.id === club.currentMatchId) || clubMatchList.find(m => m.open) || clubMatchList[0])?.id || '';
  const [matchId, setMatchId] = useState(pick());
  useEffect(() => setMatchId(pick()), [club.id, club.currentMatchId, clubMatchList.map(m => m.id).join()]);
  const [code, setCode] = useState('');
  const [fan, setFan] = useState<FanClubFanLookup | null>(null);
  const [busy, setBusy] = useState<'' | 'lookup' | 'checkin' | string>('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const match = clubMatchList.find(m => m.id === matchId) || null;

  const lookup = async (raw = code) => {
    const c = raw.trim().toUpperCase();
    if (!c) return;
    setBusy('lookup');
    setError('');
    setFan(null);
    try {
      setFan(await api.fanClubLookup(club.id, c, matchId || undefined));
      setCode(c.replace(/^ADT10FC:/, ''));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const checkIn = async () => {
    setBusy('checkin');
    setError('');
    try {
      const r = await api.fanClubCheckIn({ fanClubId: club.id, code, matchId: matchId || undefined });
      toast(t('{name} checked in: +{n} points', { name: r.fan.name, n: r.pointsAwarded }));
      await lookup(code);
    } catch (e: any) {
      setError(e.message);
      setBusy('');
    }
  };

  const redeem = async (o: VenueOffer) => {
    setBusy(o.id);
    setError('');
    try {
      const r = await api.fanClubRedeem({ fanClubId: club.id, offerId: o.id, code });
      toast(r.message);
      await lookup(code);
    } catch (e: any) {
      setError(e.message);
      setBusy('');
    }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    streamRef.current = null;
    setScanning(false);
  };
  const start = async () => {
    setError('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      streamRef.current = s;
      setScanning(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play().catch(() => undefined);
        }
      });
    } catch {
      setError(t('The camera is not available. Type the fan’s code instead.'));
    }
  };
  useEffect(() => {
    if (!scanning) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (v && c && v.readyState === v.HAVE_ENOUGH_DATA) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, c.width, c.height);
          const img = ctx.getImageData(0, 0, c.width, c.height);
          const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (hit?.data) {
            stop();
            lookup(hit.data);
            return;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scanning]);
  useEffect(() => stop, []);

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        {clubMatchList.length ? (
          <Field label={t('Today’s match')} htmlFor="fc-match">
            <select id="fc-match" className={inputCls} value={matchId} onChange={e => { setMatchId(e.target.value); setFan(null); }} data-testid="desk-match">
              {clubMatchList.map(m => (
                <option key={m.id} value={m.id}>
                  {m.test ? t('TEST MATCH') + ': ' : t('Match {n}', { n: m.matchNo }) + ': '}
                  {teamById(m.teamA)?.short || m.teamA} vs {teamById(m.teamB)?.short || m.teamB} · {f.time(m.startsAt)}
                  {m.open ? ` · ${t('check-in open')}` : ''}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <p className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-200" data-testid="desk-no-match-today">
            {t('No match for this club today, so there is nothing to check in for.')}
            {nextMatch ? ' ' + t('Next: Match {n}, {a} vs {b}, {date}. Check-in opens {time}.', { n: nextMatch.matchNo, a: teamById(nextMatch.teamA)?.short || nextMatch.teamA, b: teamById(nextMatch.teamB)?.short || nextMatch.teamB, date: f.dateTime(nextMatch.startsAt), time: nextMatch.opensAt ? f.time(nextMatch.opensAt) : '' }) : ''}
          </p>
        )}
        {match && !match.open && match.opensAt && (
          <p className="text-sm font-bold text-amber-200" data-testid="desk-opens-at">{t('Check-in opens at {time} ({n} minutes before the first ball).', { time: f.time(match.opensAt), n: view.opensMinutesBefore })}</p>
        )}
        {view.leagueWide && (
          testMatch ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 p-2.5 text-xs text-sky-100">
              <span className="flex-1">{t('A test match is running (starts {time}). Fans never see it.', { time: f.time(testMatch.startsAt) })}</span>
              <Button size="sm" variant="ghost" onClick={async () => { try { const r = await api.fanClubTestMatchRemove(testMatch.id); toast(t('Test match removed; {n} test check-in(s) and their points taken back.', { n: r.undone })); setFan(null); onChange(); } catch (e: any) { toast(e.message, 'error'); } }} data-testid="desk-test-remove">
                {t('Remove test match')}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={async () => { try { await api.fanClubTestMatchStart(); toast(t('Test match started: check-in is open now.')); onChange(); } catch (e: any) { toast(e.message, 'error'); } }} data-testid="desk-test-start">
              {t('Start a test match (try check-in now)')}
            </Button>
          )
        )}
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); lookup(); }}>
          <label htmlFor="fc-code" className="sr-only">{t('Fan code')}</label>
          <input id="fc-code" className={inputCls + ' font-mono uppercase tracking-widest'} placeholder="ABC234" maxLength={20} value={code} onChange={e => setCode(e.target.value)} data-testid="desk-code" />
          <Button type="submit" loading={busy === 'lookup'} disabled={!code.trim()} data-testid="desk-find">{t('Find')}</Button>
          <Button type="button" variant="ghost" onClick={scanning ? stop : start} aria-label={scanning ? t('Stop camera') : t('Scan QR')}>
            {scanning ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
          </Button>
        </form>
        {scanning && (
          <div className="relative rounded-xl overflow-hidden bg-black">
            <video ref={videoRef} className="w-full max-h-72 object-cover" muted />
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}
        {error && <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200" role="alert" data-testid="desk-error">{error}</p>}
      </Card>

      {fan && (
        <Card className="p-4 space-y-3" data-testid="desk-fan">
          <div className="flex items-center gap-3">
            <Avatar name={fan.fan.name} src={fan.fan.avatar} size={44} />
            <div className="min-w-0 flex-1">
              <p className="font-black text-white truncate">{fan.fan.name}</p>
              <p className="text-xs text-slate-400">
                {fan.fan.instagramHandle ? `@${fan.fan.instagramHandle} · ` : ''}
                {t('{n} points', { n: fan.fan.points })}
                {fan.fan.teamId ? ` · ${teamById(fan.fan.teamId)?.short || ''}` : ''}
              </p>
            </div>
            {fan.fan.instagramVerified ? <Pill tone="green">{t('Instagram verified')}</Pill> : <Pill tone="red">{t('Instagram not verified')}</Pill>}
          </div>
          {fan.checkedIn ? (
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-300" data-testid="desk-checked-in">
              <CheckCircle2 className="w-4 h-4" /> {t('Checked in for Match {n} at {club}', { n: fan.checkedIn.matchNo, club: fan.checkedIn.fanClubName })}
            </p>
          ) : (
            <>
            {fan.fan.instagramVerified && !fan.window?.open && (
              <p className="text-xs text-amber-200" data-testid="desk-not-open">
                {(fan as any).matchAtThisClub === false ? t('This match is not one of this club’s matches.') : fan.window?.opensAt && Date.now() < +new Date(fan.window.opensAt) ? t('Check-in opens at {time}.', { time: f.dateTime(fan.window.opensAt) }) : t('Check-in for this match has closed.')}
              </p>
            )}
            <Button onClick={checkIn} loading={busy === 'checkin'} disabled={!fan.fan.instagramVerified || !fan.window?.open || !match} data-testid="desk-checkin">
              <UserCheck className="w-4 h-4" /> {t('Check in · +{n} points', { n: club.effectiveCheckInPoints })}
            </Button>
            </>
          )}
          {!fan.fan.instagramVerified && <p className="text-xs text-amber-200">{t('The fan must verify Instagram on ADT10fans.com before checking in.')}</p>}
          {fan.offers.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">{t('Offers here')}</p>
              {fan.offers.map(o => (
                <div key={o.id} className="flex items-center gap-2 rounded-xl border border-slate-800 p-2.5">
                  <Gift className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span className="flex-1 text-sm text-white">{o.title}{o.bonusPoints ? <span className="text-amber-300 font-bold"> · +{o.bonusPoints}</span> : null}</span>
                  {o.used ? (
                    <Pill>{t('Used')}</Pill>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => redeem(o)} loading={busy === o.id} disabled={!fan.checkedInHereToday} data-testid="desk-redeem">
                      {t('Redeem')}
                    </Button>
                  )}
                </div>
              ))}
              {!fan.checkedInHereToday && <p className="text-[11px] text-slate-500">{t('Offers can be redeemed once the fan is checked in here.')}</p>}
            </div>
          )}
        </Card>
      )}
      <div className="grid grid-cols-2 gap-2 text-center">
        <Card className="p-3"><p className="text-2xl font-black text-amber-300">{club.todayCheckIns}</p><p className="text-xs text-slate-400">{t('Check-ins today')}</p></Card>
        <Card className="p-3"><p className="text-2xl font-black text-white">{club.totalCheckIns}</p><p className="text-xs text-slate-400">{t('All check-ins')}</p></Card>
      </div>
    </div>
  );
}

const emptyOffer: Partial<VenueOffer> = { title: '', description: '', perk: '', badge: '', bonusPoints: 0, limit: 0, startsAt: '', expiresAt: '', active: true };
const toLocal = (iso?: string) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

function Offers({ club, onChange }: { club: FanClubAdminClub; onChange: () => void }) {
  const { toast } = useApp();
  const t = useT();
  const f = useFormat();
  const [edit, setEdit] = useState<Partial<VenueOffer> | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      await api.fanClubSaveOffer(club.id, {
        ...edit,
        startsAt: edit.startsAt ? new Date(edit.startsAt).toISOString() : '',
        expiresAt: edit.expiresAt ? new Date(edit.expiresAt).toISOString() : '',
      });
      toast(t('Offer saved'));
      setEdit(null);
      onChange();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (o: VenueOffer) => {
    try {
      await api.fanClubDeleteOffer(club.id, o.id);
      toast(o.redeemed ? t('Offer switched off (fans already used it)') : t('Offer removed'));
      onChange();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="space-y-3">
      <Button onClick={() => setEdit({ ...emptyOffer })} data-testid="offer-add"><Plus className="w-4 h-4" /> {t('Add an offer')}</Button>
      {club.offers.length === 0 && <p className="text-sm text-slate-400">{t('No offers yet. Offers are perks for fans checked in here, like a free drink or a discount. An offer can also give bonus points.')}</p>}
      {club.offers.map(o => (
        <Card key={o.id} className="p-3 flex items-start gap-3" data-testid="offer-row">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white">{o.title} {o.active === false && <Pill>{t('Off')}</Pill>}</p>
            {o.description && <p className="text-xs text-slate-400">{o.description}</p>}
            <p className="text-[11px] text-slate-500 mt-1">
              {o.bonusPoints ? `+${o.bonusPoints} ${t('points')} · ` : ''}
              {t('{n} used', { n: o.redeemed || 0 })}
              {o.limit ? ` / ${o.limit}` : ''}
              {o.expiresAt ? ` · ${t('until {d}', { d: f.dateTime(o.expiresAt) })}` : ''}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setEdit({ ...o, startsAt: toLocal(o.startsAt), expiresAt: toLocal(o.expiresAt) })} aria-label={t('Edit')}><Pencil className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => remove(o)} aria-label={t('Remove')}><Trash2 className="w-4 h-4" /></Button>
        </Card>
      ))}
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? t('Edit offer') : t('New offer')}>
        {edit && (
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); save(); }}>
            <Field label={t('Title')} htmlFor="of-title"><input id="of-title" className={inputCls} value={edit.title || ''} onChange={e => setEdit({ ...edit, title: e.target.value })} required maxLength={120} /></Field>
            <Field label={t('Description')} htmlFor="of-desc"><textarea id="of-desc" className={inputCls} rows={2} value={edit.description || ''} onChange={e => setEdit({ ...edit, description: e.target.value })} maxLength={400} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('Short label')} hint={t('e.g. Free drink')} htmlFor="of-perk"><input id="of-perk" className={inputCls} value={edit.perk || ''} onChange={e => setEdit({ ...edit, perk: e.target.value })} maxLength={80} /></Field>
              <Field label={t('Bonus points')} hint={t('Given when redeemed')} htmlFor="of-pts"><input id="of-pts" type="number" min={0} max={500} className={inputCls} value={edit.bonusPoints ?? 0} onChange={e => setEdit({ ...edit, bonusPoints: Number(e.target.value) })} /></Field>
              <Field label={t('How many fans')} hint={t('0 = no limit')} htmlFor="of-limit"><input id="of-limit" type="number" min={0} className={inputCls} value={edit.limit ?? 0} onChange={e => setEdit({ ...edit, limit: Number(e.target.value) })} /></Field>
              <Field label={t('Active')} htmlFor="of-active"><select id="of-active" className={inputCls} value={edit.active === false ? 'no' : 'yes'} onChange={e => setEdit({ ...edit, active: e.target.value === 'yes' })}><option value="yes">{t('Yes')}</option><option value="no">{t('No')}</option></select></Field>
              <Field label={t('Starts')} htmlFor="of-start"><input id="of-start" type="datetime-local" className={inputCls} value={edit.startsAt || ''} onChange={e => setEdit({ ...edit, startsAt: e.target.value })} /></Field>
              <Field label={t('Ends')} htmlFor="of-end"><input id="of-end" type="datetime-local" className={inputCls} value={edit.expiresAt || ''} onChange={e => setEdit({ ...edit, expiresAt: e.target.value })} /></Field>
            </div>
            <Button type="submit" loading={busy} data-testid="offer-save">{t('Save offer')}</Button>
          </form>
        )}
      </Modal>
    </div>
  );
}

export function ClubForm({ club, leagueWide, defaultPoints, onSaved }: { club: Partial<FanClubAdminClub>; leagueWide: boolean; defaultPoints: number; onSaved: () => void }) {
  const { toast } = useApp();
  const t = useT();
  const [d, setD] = useState<any>({ ...club, checkInPoints: club.checkInPoints ?? '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => setD({ ...club, checkInPoints: club.checkInPoints ?? '' }), [club.id]);
  const set = (k: string, v: any) => setD((x: any) => ({ ...x, [k]: v }));
  const save = async () => {
    setBusy(true);
    try {
      await api.fanClubSave({ id: club.id, name: d.name, city: d.city, country: d.country, address: d.address, region: d.region, capacity: d.capacity, contactPerson: d.contactPerson, active: d.active !== false, checkInPoints: d.checkInPoints === '' ? null : d.checkInPoints, gamesMode: d.gamesMode });
      toast(t('Fan club saved'));
      onSaved();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); save(); }} data-testid="club-form">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={t('Name')} htmlFor="cl-name"><input id="cl-name" className={inputCls} value={d.name || ''} onChange={e => set('name', e.target.value)} required /></Field>
        <Field label={t('Contact person')} htmlFor="cl-contact"><input id="cl-contact" className={inputCls} value={d.contactPerson || ''} onChange={e => set('contactPerson', e.target.value)} /></Field>
        <Field label={t('City')} htmlFor="cl-city"><input id="cl-city" className={inputCls} value={d.city || ''} onChange={e => set('city', e.target.value)} required /></Field>
        <Field label={t('Country')} htmlFor="cl-country"><input id="cl-country" className={inputCls} value={d.country || ''} onChange={e => set('country', e.target.value)} required /></Field>
        <Field label={t('Address')} htmlFor="cl-address"><input id="cl-address" className={inputCls} value={d.address || ''} onChange={e => set('address', e.target.value)} /></Field>
        <Field label={t('Region')} hint={t('Optional, e.g. UAE')} htmlFor="cl-region"><input id="cl-region" className={inputCls} value={d.region || ''} onChange={e => set('region', e.target.value)} /></Field>
        <Field label={t('Capacity')} htmlFor="cl-cap"><input id="cl-cap" type="number" min={0} className={inputCls} value={d.capacity ?? ''} onChange={e => set('capacity', e.target.value)} /></Field>
        <Field label={t('Points per check-in')} hint={t('Empty = site default ({n})', { n: defaultPoints })} htmlFor="cl-pts"><input id="cl-pts" type="number" min={0} max={1000} className={inputCls} value={d.checkInPoints} onChange={e => set('checkInPoints', e.target.value)} data-testid="club-points" /></Field>
        {leagueWide && (
          <Field label={t('Games for fans checked in here')} htmlFor="cl-games">
            <select id="cl-games" className={inputCls} value={d.gamesMode || 'team'} onChange={e => set('gamesMode', e.target.value)}>
              <option value="team">{t('Only the fan club team’s games')}</option>
              <option value="all">{t('Every game')}</option>
            </select>
          </Field>
        )}
        <Field label={t('Active')} htmlFor="cl-active"><select id="cl-active" className={inputCls} value={d.active === false ? 'no' : 'yes'} onChange={e => set('active', e.target.value === 'yes')}><option value="yes">{t('Yes')}</option><option value="no">{t('No')}</option></select></Field>
      </div>
      <Button type="submit" loading={busy} data-testid="club-save">{t('Save')}</Button>
    </form>
  );
}

function Activity({ clubId }: { clubId: string }) {
  const t = useT();
  const f = useFormat();
  const s = useLoad(() => api.fanClubStats(clubId), [clubId]);
  if (s.error) return <ErrorBox message={s.error} onRetry={s.reload} />;
  if (!s.data) return <Spinner />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Card className="p-3"><p className="text-xl font-black text-amber-300">{s.data.totalCheckIns}</p><p className="text-[11px] text-slate-400">{t('Check-ins')}</p></Card>
        <Card className="p-3"><p className="text-xl font-black text-white">{s.data.totalRedemptions}</p><p className="text-[11px] text-slate-400">{t('Offers used')}</p></Card>
        <Card className="p-3"><p className="text-xl font-black text-emerald-300">{s.data.pointsGiven}</p><p className="text-[11px] text-slate-400">{t('Points given')}</p></Card>
      </div>
      <ul className="divide-y divide-slate-800 rounded-2xl border border-slate-800 text-sm">
        {s.data.recentCheckIns.map(c => (
          <li key={c.id} className="p-2.5 flex gap-2">
            <span className="flex-1 text-white">{c.userName}</span>
            <span className="text-slate-400">{t('Match {n}', { n: c.matchNo })} · {f.dateTime(c.checkedInAt)}</span>
            <span className="text-amber-300 font-bold">+{c.pointsAwarded}</span>
          </li>
        ))}
        {s.data.recentRedemptions.map(r => (
          <li key={r.id} className="p-2.5 flex gap-2">
            <Gift className="w-4 h-4 text-emerald-300" />
            <span className="flex-1 text-white">{r.userName} · {r.offerTitle}</span>
            <span className="text-slate-400">{f.dateTime(r.at)}</span>
          </li>
        ))}
        {!s.data.recentCheckIns.length && !s.data.recentRedemptions.length && <li className="p-3 text-slate-400">{t('Nothing yet.')}</li>}
      </ul>
    </div>
  );
}

/**
 * The matches fans can check in for at this club. By default every match of the fan club team (the
 * Arabian Aces); the club's admins and league admins can add other matches or take some out.
 */
function ClubMatches({ club, view, onChange }: { club: FanClubAdminClub; view: NonNullable<Awaited<ReturnType<typeof api.fanClubAdmin>>>; onChange: () => void }) {
  const { teamById, toast } = useApp();
  const t = useT();
  const f = useFormat();
  const [busy, setBusy] = useState('');
  const team = teamById(view.fanClubTeamId);
  const set = async (body: { matchId?: string; include?: boolean; reset?: boolean }) => {
    setBusy(body.matchId || 'reset');
    try {
      await api.fanClubSetMatch(club.id, body);
      onChange();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };
  const changed = Boolean(club.extraMatchIds?.length || club.excludedMatchIds?.length);
  return (
    <div className="space-y-3" data-testid="club-matches">
      <p className="text-sm text-slate-300">
        {t('Fans can check in here for the ticked matches. By default these are all {team} matches.', { team: team?.name || view.fanClubTeamId })}
      </p>
      {changed && (
        <Button size="sm" variant="ghost" onClick={() => set({ reset: true })} loading={busy === 'reset'} data-testid="club-matches-reset">
          {t('Back to {team} matches only', { team: team?.short || view.fanClubTeamId })}
        </Button>
      )}
      {view.matches.filter(m => !m.test).length === 0 && <p className="text-sm text-slate-400">{t('No matches yet.')}</p>}
      <ul className="divide-y divide-slate-800 rounded-2xl border border-slate-800">
        {view.matches.filter(m => !m.test).map(m => {
          const on = club.matchIds.includes(m.id);
          const isTeam = m.teamA === view.fanClubTeamId || m.teamB === view.fanClubTeamId;
          return (
            <li key={m.id}>
              <label className="flex items-center gap-3 p-3 min-h-[48px] cursor-pointer">
                <input type="checkbox" className="accent-amber-400 w-4 h-4" checked={on} disabled={busy === m.id} onChange={e => set({ matchId: m.id, include: e.target.checked })} data-testid="club-match-toggle" data-match={m.id} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-white">
                    {t('Match {n}', { n: m.matchNo })}: {teamById(m.teamA)?.short || m.teamA} vs {teamById(m.teamB)?.short || m.teamB}
                  </span>
                  <span className="block text-xs text-slate-400">{f.dateTime(m.startsAt)}{m.status === 'completed' ? ` · ${t('played')}` : ''}</span>
                </span>
                {isTeam ? <Pill tone="amber">{team?.short || view.fanClubTeamId}</Pill> : on ? <Pill tone="blue">{t('Added')}</Pill> : null}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

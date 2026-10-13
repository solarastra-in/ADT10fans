import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, CheckCircle2, ScanLine } from 'lucide-react';
import { api } from '../../api';
import type { FanSpaceBooking } from '../../types';
import { Button, Card, Checkbox, Notice, SectionHeader, TextInput, useRunner } from './ui';

/**
 * Door check-in for Fan Space passes. Uses the phone camera where the browser can read QR codes
 * (BarcodeDetector); otherwise staff type the pass code. Each pass is accepted once.
 */
export const FanCheckInPanel: React.FC = () => {
  const [code, setCode] = useState('');
  const [anyDate, setAnyDate] = useState(false);
  const [last, setLast] = useState<FanSpaceBooking | null>(null);
  const [scanning, setScanning] = useState(false);
  const [recent, setRecent] = useState<FanSpaceBooking[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);
  const { busy, notice, setNotice, run } = useRunner();
  const supportsScan = typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;

  const loadRecent = async () => {
    const r = await api.getAdminFanSpaceBookings().catch(() => null);
    if (r) setRecent(r.bookings.filter(b => b.checkedInAt).sort((a, b) => +new Date(b.checkedInAt!) - +new Date(a.checkedInAt!)).slice(0, 10));
  };
  useEffect(() => {
    loadRecent();
    return () => stop();
  }, []);

  const check = async (raw: string) => {
    const value = raw.trim();
    if (!value || busyRef.current) return;
    busyRef.current = true;
    try {
      const r = await run('check', () => api.checkInFanSpace(value, anyDate));
      if (r) {
        setLast(r.booking);
        setNotice({ kind: 'ok', text: `Welcome! ${r.booking.userName}: ${r.booking.ticketsCount} ${r.booking.ticketsCount === 1 ? 'person' : 'people'}, ${r.booking.ticketType === 'vip_pass' ? 'VIP' : 'standard'} pass for ${r.booking.spaceName}.` });
        setCode('');
        loadRecent();
      }
    } finally {
      setTimeout(() => (busyRef.current = false), 1500);
    }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  };
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setScanning(true);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const codes = await detector.detect(video);
          if (codes[0]?.rawValue) await check(codes[0].rawValue);
        } catch {
          /* keep scanning */
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch (e: any) {
      setNotice({ kind: 'err', text: `Camera unavailable: ${e?.message || e}. Type the code instead.` });
      stop();
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Door check-in" description="Scan the QR code on a fan's pass, or type the code printed under it. Passes are only valid on their booked date unless you allow any date." />
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <Card className="space-y-4">
        {supportsScan && (
          <div className="space-y-2">
            <div className={`relative rounded-xl overflow-hidden bg-black ${scanning ? '' : 'hidden'}`}>
              <video ref={videoRef} className="w-full max-h-[360px] object-cover" muted playsInline />
              <ScanLine className="absolute inset-0 m-auto w-24 h-24 text-amber-400/70" />
            </div>
            {scanning ? (
              <Button onClick={stop} icon={<CameraOff className="w-4 h-4" />}>Stop camera</Button>
            ) : (
              <Button variant="primary" onClick={start} icon={<Camera className="w-4 h-4" />}>Scan with camera</Button>
            )}
          </div>
        )}
        <form onSubmit={e => { e.preventDefault(); check(code); }} className="flex gap-2">
          <TextInput value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABU-XXXXXX" className="font-mono tracking-widest" aria-label="Pass code" />
          <Button type="submit" variant="primary" loading={busy === 'check'}>Check in</Button>
        </form>
        <Checkbox label="Accept passes booked for another date" checked={anyDate} onChange={setAnyDate} />
        {last && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-sm text-emerald-100 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" /> {last.passCode} · {last.userName} · {last.spaceName}
          </div>
        )}
      </Card>
      <Card>
        <h3 className="font-extrabold text-white mb-2">Recent check-ins</h3>
        {recent.length === 0 ? <p className="text-sm text-slate-400">None yet.</p> : (
          <ul className="text-sm divide-y divide-slate-800">
            {recent.map(b => (
              <li key={b.id} className="py-2 flex justify-between gap-2"><span className="text-slate-200">{b.userName} · {b.spaceName}</span><span className="text-slate-400">{new Date(b.checkedInAt!).toLocaleTimeString()}</span></li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

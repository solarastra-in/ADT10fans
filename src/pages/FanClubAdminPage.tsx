import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { useApp } from '../state';
import { api } from '../api';
import type { FanClub, Match, FanClubCheckInRecord, VenueOffer } from '../types';

const STATION_KEY = 'admin_fanclub_station';

export const FanClubAdminPage: React.FC = () => {
  const { user } = useApp();
  const [clubs, setClubs] = useState<FanClub[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string>(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem(STATION_KEY) : null) || '';
  });
  const [stationLocked, setStationLocked] = useState<boolean>(() => {
    return Boolean(typeof window !== 'undefined' ? localStorage.getItem(STATION_KEY) : false);
  });

  // Scanner state
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // Manual code input
  const [manualCode, setManualCode] = useState('');
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastCheckInResult, setLastCheckInResult] = useState<{
    fan: any;
    pointsAwarded: number;
    fanClub: FanClub;
    match: Match;
    checkInRecord: FanClubCheckInRecord;
  } | null>(null);

  // Stats
  const [stats, setStats] = useState<{ totalCheckIns: number; todayCheckIns: number; recentCheckIns: FanClubCheckInRecord[] }>({
    totalCheckIns: 0,
    todayCheckIns: 0,
    recentCheckIns: [],
  });

  // Offer redemption
  const [redeemingOfferId, setRedeemingOfferId] = useState<string | null>(null);
  const [offerSuccessMsg, setOfferSuccessMsg] = useState<string | null>(null);

  // Web Audio chime for successful check-in
  const playSuccessChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {
      // Audio autoplay restrictions ignored safely
    }
  };

  // Load clubs
  useEffect(() => {
    api.getFanClubs().then(res => {
      setClubs(res.clubs);
      if (!selectedClubId && res.clubs.length > 0) {
        // Default to first Hyderabad fan club if available
        const hyd = res.clubs.find(c => c.region === 'hyderabad') || res.clubs[0];
        setSelectedClubId(hyd.id);
      }
    }).catch(console.error);
  }, []);

  // Load venue stats
  const refreshStats = () => {
    if (!selectedClubId) return;
    api.getFanClubAdminStats(selectedClubId).then(setStats).catch(console.error);
  };

  useEffect(() => {
    refreshStats();
  }, [selectedClubId]);

  // Lock station handler
  const handleLockStation = (clubId: string) => {
    setSelectedClubId(clubId);
    setStationLocked(true);
    localStorage.setItem(STATION_KEY, clubId);
    refreshStats();
  };

  const handleUnlockStation = () => {
    setStationLocked(false);
    localStorage.removeItem(STATION_KEY);
  };

  // Check in action
  const executeCheckIn = async (payload: { qrPayload?: string; code?: string }) => {
    if (!selectedClubId) {
      setErrorMsg('Please select your active fan club station first.');
      return;
    }

    setProcessing(true);
    setErrorMsg(null);
    setOfferSuccessMsg(null);

    try {
      const res = await api.fanClubAdminCheckIn({
        ...payload,
        fanClubId: selectedClubId,
      });

      playSuccessChime();
      setLastCheckInResult(res);
      setManualCode('');
      refreshStats();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Check-in failed. Please verify code or match window.');
    } finally {
      setProcessing(false);
    }
  };

  // Start / stop camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode } },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        setScanning(true);
      }
    } catch (err: any) {
      setCameraError('Unable to access camera. Please allow camera permissions or use the manual 6-character code fallback.');
      setScanning(false);
    }
  };

  const stopCamera = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  // QR Decoding loop
  useEffect(() => {
    if (!scanning) return;

    let active = true;

    const tick = () => {
      if (!active) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data) {
            // Found QR! Stop scanning and execute check-in
            stopCamera();
            executeCheckIn({ qrPayload: code.data });
            return;
          }
        }
      }

      scanLoopRef.current = requestAnimationFrame(tick);
    };

    scanLoopRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current);
    };
  }, [scanning, selectedClubId]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Redeem venue offer
  const handleRedeemOffer = async (offer: VenueOffer) => {
    if (!lastCheckInResult?.fan?.id || !selectedClubId) return;

    setRedeemingOfferId(offer.id);
    setOfferSuccessMsg(null);
    try {
      const res = await api.fanClubAdminRedeemOffer({
        userId: lastCheckInResult.fan.id,
        offerId: offer.id,
        fanClubId: selectedClubId,
      });

      playSuccessChime();
      setOfferSuccessMsg(res.message);
      // Update fan profile claimed offers locally
      if (lastCheckInResult.fan) {
        const claimed = lastCheckInResult.fan.claimedVenueOfferIds || [];
        lastCheckInResult.fan.claimedVenueOfferIds = [...claimed, offer.id];
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to redeem offer.');
    } finally {
      setRedeemingOfferId(null);
    }
  };

  const currentClub = clubs.find(c => c.id === selectedClubId);

  return (
    <div className="min-h-screen bg-navy-950 text-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-navy-800">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-gold-500/20 text-gold-400 text-xs font-bold uppercase tracking-wider mb-2">
              Official Venue Operations Desk
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Fan Club Check-In Portal
            </h1>
            <p className="text-navy-300 text-sm mt-1">
              Scan fan matchday QR passes or punch 6-digit codes to award +100 Fan Points & redeem venue offers.
            </p>
          </div>

          {/* Station Status */}
          {stationLocked && currentClub && (
            <div className="flex items-center gap-3 bg-navy-900 border border-gold-500/40 rounded-xl px-4 py-2.5">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-navy-400 block">Station Locked At</span>
                <span className="text-xs font-bold text-gold-400">{currentClub.name}</span>
                <span className="text-[11px] text-navy-400 block">{currentClub.city}</span>
              </div>
              <button
                type="button"
                onClick={handleUnlockStation}
                className="text-xs text-navy-400 hover:text-white underline decoration-navy-600"
              >
                Change
              </button>
            </div>
          )}
        </div>

        {/* Step 1: Venue Station Selector (Locks for the match) */}
        {!stationLocked ? (
          <div className="bg-navy-900 border border-gold-500/30 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-2">Step 1: Set Your Fan Club Station</h2>
            <p className="text-navy-300 text-xs mb-4">
              Per requirements, mark which fan club you are operating at once. It will stay locked for the rest of this match session.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {clubs.map(club => (
                <div
                  key={club.id}
                  onClick={() => setSelectedClubId(club.id)}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                    selectedClubId === club.id
                      ? 'bg-navy-850 border-gold-500 shadow-md ring-1 ring-gold-500'
                      : 'bg-navy-950/70 border-navy-800 hover:border-navy-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gold-400 uppercase tracking-wide">
                      {club.region === 'hyderabad' ? '🇮🇳 Hyderabad' : club.region === 'uae' ? '🇦🇪 UAE' : '🌍 Global'}
                    </span>
                    <span className="text-[11px] text-navy-400 font-mono">Cap: {club.capacity}</span>
                  </div>
                  <h3 className="font-bold text-sm text-white mb-1">{club.name}</h3>
                  <p className="text-xs text-navy-400 line-clamp-1">{club.address}</p>
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={!selectedClubId}
              onClick={() => handleLockStation(selectedClubId)}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-sm transition-all shadow-md disabled:opacity-50"
            >
              Lock Station for this Match Session
            </button>
          </div>
        ) : (
          /* Step 2: Scanner & Check-In Action Desk */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: QR Scanner & Manual Input */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-navy-900 border border-navy-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-white">Fan QR Scanner</h2>
                    <p className="text-xs text-navy-400">Scan using device camera or type the 6-character code.</p>
                  </div>
                  {scanning && (
                    <button
                      type="button"
                      onClick={() => setFacingMode(m => m === 'environment' ? 'user' : 'environment')}
                      className="text-xs px-2.5 py-1 rounded bg-navy-800 text-navy-200 hover:text-white"
                    >
                      Flip Camera
                    </button>
                  )}
                </div>

                {/* Camera Viewport */}
                <div className="relative bg-black rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center border border-navy-700 mb-4">
                  {scanning ? (
                    <>
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        playsInline
                        muted
                      />
                      <canvas ref={canvasRef} className="hidden" />
                      {/* Reticle guide */}
                      <div className="absolute inset-0 border-2 border-gold-400/40 pointer-events-none flex items-center justify-center">
                        <div className="w-48 h-48 border-2 border-dashed border-gold-400 rounded-xl animate-pulse" />
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-6 space-y-3">
                      <div className="w-16 h-16 rounded-full bg-navy-800 text-gold-400 mx-auto flex items-center justify-center">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                      </div>
                      <p className="text-xs text-navy-300 max-w-xs">
                        Point camera at fan's pass. Scans automatically.
                      </p>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-5 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-xs tracking-wide transition-all shadow"
                      >
                        Start Camera Scanner
                      </button>
                    </div>
                  )}
                </div>

                {scanning && (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="w-full py-2.5 rounded-xl bg-navy-800 hover:bg-navy-700 text-navy-200 text-xs font-semibold mb-4"
                  >
                    Stop Camera
                  </button>
                )}

                {cameraError && (
                  <div className="p-3 mb-4 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs">
                    {cameraError}
                  </div>
                )}

                {/* Manual 6-character Code Fallback */}
                <div className="pt-4 border-t border-navy-800">
                  <label className="block text-xs font-semibold text-navy-300 uppercase tracking-wider mb-2">
                    Or Enter Manual Fan Code (e.g. AA8F2B)
                  </label>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (manualCode.trim()) executeCheckIn({ code: manualCode.trim() });
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      maxLength={12}
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      placeholder="AA8F2B"
                      className="flex-1 bg-navy-950 border border-navy-700 focus:border-gold-500 rounded-xl px-4 py-2.5 text-white font-mono tracking-widest text-sm focus:outline-none uppercase"
                    />
                    <button
                      type="submit"
                      disabled={processing || !manualCode.trim()}
                      className="px-5 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-xs tracking-wider transition-all disabled:opacity-50"
                    >
                      {processing ? 'Punching...' : 'Punch Check-In'}
                    </button>
                  </form>
                </div>

                {errorMsg && (
                  <div className="mt-4 p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs font-medium">
                    {errorMsg}
                  </div>
                )}
              </div>

              {/* Station Statistics */}
              <div className="bg-navy-900 border border-navy-800 rounded-2xl p-5">
                <h3 className="text-xs font-bold text-navy-400 uppercase tracking-wider mb-3">
                  Station Activity ({currentClub?.name})
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-navy-950 p-4 rounded-xl border border-navy-800">
                    <span className="text-[11px] text-navy-400 block">Today's Check-Ins</span>
                    <span className="text-2xl font-extrabold text-gold-400">{stats.todayCheckIns}</span>
                  </div>
                  <div className="bg-navy-950 p-4 rounded-xl border border-navy-800">
                    <span className="text-[11px] text-navy-400 block">Total Venue Check-Ins</span>
                    <span className="text-2xl font-extrabold text-white">{stats.totalCheckIns}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Check-in Confirmation & Offer Redemption Kiosk */}
            <div className="lg:col-span-5 space-y-6">
              {lastCheckInResult ? (
                <div className="bg-navy-900 border border-emerald-500/50 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Check-In Verified!
                    </span>
                  </div>

                  {/* Fan Identity */}
                  <div className="flex items-center gap-3 pb-4 border-b border-navy-800">
                    <div className="w-12 h-12 rounded-full bg-navy-800 border-2 border-gold-500/50 overflow-hidden flex items-center justify-center font-bold text-gold-400 text-lg">
                      {lastCheckInResult.fan?.avatar ? (
                        <img src={lastCheckInResult.fan.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        lastCheckInResult.fan?.name?.slice(0, 2).toUpperCase() || 'FN'
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">{lastCheckInResult.fan?.name}</h3>
                      <div className="text-xs text-navy-400 font-mono">Code: {lastCheckInResult.fan?.fanClubCode}</div>
                    </div>
                    <div className="ml-auto text-right">
                      <span className="text-xs text-navy-400 block">Balance</span>
                      <span className="text-sm font-bold text-gold-400">{lastCheckInResult.fan?.points || 0} Pts</span>
                    </div>
                  </div>

                  {/* Points awarded banner */}
                  <div className="my-4 p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-center">
                    <span className="text-xl font-extrabold text-emerald-300">+{lastCheckInResult.pointsAwarded} Fan Points</span>
                    <span className="text-[11px] text-emerald-400/80 block mt-0.5">Credited to fan's profile for Match {lastCheckInResult.match?.matchNo}</span>
                  </div>

                  {/* Single-Use Venue Offers Kiosk */}
                  <div className="mt-4 pt-4 border-t border-navy-800">
                    <h4 className="text-xs font-bold text-navy-300 uppercase tracking-wider mb-2">
                      Venue Offers for this Fan
                    </h4>

                    {offerSuccessMsg && (
                      <div className="mb-3 p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs">
                        ✓ {offerSuccessMsg}
                      </div>
                    )}

                    <div className="space-y-2.5">
                      {(currentClub?.offers || []).map(offer => {
                        const isRedeemed = (lastCheckInResult.fan?.claimedVenueOfferIds || []).includes(offer.id);
                        return (
                          <div
                            key={offer.id}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                              isRedeemed
                                ? 'bg-navy-950/40 border-navy-800 opacity-60'
                                : 'bg-navy-950 border-navy-700'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold text-white">{offer.title}</div>
                              <div className="text-[11px] text-gold-400 font-medium">{offer.perk}</div>
                            </div>
                            <div>
                              {isRedeemed ? (
                                <span className="text-[10px] font-semibold text-navy-400 px-2 py-1 rounded bg-navy-800">
                                  Already Claimed
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={redeemingOfferId === offer.id}
                                  onClick={() => handleRedeemOffer(offer)}
                                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold text-xs transition-all shadow"
                                >
                                  {redeemingOfferId === offer.id ? 'Redeeming...' : 'Redeem Perk'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setLastCheckInResult(null);
                      setOfferSuccessMsg(null);
                    }}
                    className="mt-5 w-full py-2.5 rounded-xl bg-navy-800 hover:bg-navy-700 text-navy-200 text-xs font-semibold"
                  >
                    Ready for Next Fan
                  </button>
                </div>
              ) : (
                /* Idle state waiting for scan */
                <div className="bg-navy-900 border border-navy-800 rounded-2xl p-6 text-center text-navy-400">
                  <div className="w-12 h-12 rounded-xl bg-navy-950 text-navy-500 mx-auto flex items-center justify-center mb-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-white text-sm mb-1">Awaiting Fan Scan</h3>
                  <p className="text-xs text-navy-400">
                    Scanned fan verification, points credit, and single-use offer redemption will appear here.
                  </p>
                </div>
              )}

              {/* Recent check-ins list */}
              {stats.recentCheckIns.length > 0 && (
                <div className="bg-navy-900 border border-navy-800 rounded-2xl p-5">
                  <h4 className="text-xs font-bold text-navy-400 uppercase tracking-wider mb-3">
                    Recent Check-Ins at this Desk
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {stats.recentCheckIns.slice(0, 10).map(c => (
                      <div key={c.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-navy-950/60 border border-navy-800">
                        <span className="font-semibold text-white">{c.userName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gold-400 font-bold">+{c.pointsAwarded} pts</span>
                          <span className="text-[10px] text-navy-500">
                            {new Date(c.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

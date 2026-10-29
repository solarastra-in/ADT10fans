import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../state';
import { api } from '../api';
import type { FanClubStatusResponse, FanClub } from '../types';

export const FanClubCheckInCard: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { user, openAuth, teamById } = useApp();
  const [status, setStatus] = useState<FanClubStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<'all' | 'hyderabad' | 'uae'>('hyderabad');
  const [selectedClub, setSelectedClub] = useState<FanClub | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await api.getFanClubStatus();
      setStatus(data);

      if (data.qrPayload) {
        const url = await QRCode.toDataURL(data.qrPayload, {
          width: 320,
          margin: 1,
          color: {
            dark: '#0a1024',
            light: '#ffffff',
          },
        });
        setQrDataUrl(url);
      }
    } catch (e) {
      console.error('Failed to load fan club check-in status', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const handleCopyCode = () => {
    if (!status?.fanClubCode) return;
    navigator.clipboard?.writeText(status.fanClubCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="bg-navy-900/60 border border-navy-800 rounded-2xl p-6 text-center animate-pulse">
        <div className="h-6 w-48 bg-navy-800 rounded mx-auto mb-4" />
        <div className="h-48 w-48 bg-navy-800 rounded-xl mx-auto mb-4" />
        <div className="h-4 w-36 bg-navy-800 rounded mx-auto" />
      </div>
    );
  }

  const { openMatch, checkInWindowActive, minutesToMatch, checkedIn, checkedInRecord, fanClubCode, fanClubs = [], activeOffers = [] } = status || {};

  const filteredClubs = fanClubs.filter(fc => {
    if (selectedRegion === 'all') return true;
    return fc.region === selectedRegion;
  });

  return (
    <div className="bg-gradient-to-b from-navy-900 to-navy-950 border border-gold-500/30 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-gold-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-navy-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-gold-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-gold-400">Matchday Fan Club Pass</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Fan Club Check-In & Venue Offers
          </h3>
          <p className="text-navy-300 text-sm mt-0.5">
            Check in at official Arabian Aces venue desks across Hyderabad & UAE to earn <span className="text-amber-400 font-bold">+100 Fan Points</span>.
          </p>
        </div>

        {/* Status pill */}
        <div>
          {checkedIn ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-semibold">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Checked In ({checkedInRecord?.fanClubName || 'Match Venue'})
            </div>
          ) : checkInWindowActive ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-950/80 border border-amber-500/60 text-amber-300 text-xs font-bold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Check-In Desk Open Now
            </div>
          ) : openMatch ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-navy-800/80 border border-navy-700 text-navy-300 text-xs">
              <svg className="w-3.5 h-3.5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Window opens {minutesToMatch && minutesToMatch > 90 ? `in ${minutesToMatch - 90}m` : 'at T-90 min'}
            </div>
          ) : null}
        </div>
      </div>

      {/* Main Grid: QR Code & Check-in Info */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 py-6 items-center">
        {/* Left: QR Code Card */}
        <div className="md:col-span-5 flex flex-col items-center text-center">
          <div className="relative p-3.5 bg-white rounded-2xl shadow-2xl border-4 border-gold-500/40">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Fan Club Check-in QR Code"
                className="w-48 h-48 sm:w-56 sm:h-56 rounded-lg object-contain"
              />
            ) : (
              <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center text-navy-900 font-bold text-xs">
                Generating QR...
              </div>
            )}
            {!user && (
              <div className="absolute inset-0 bg-navy-950/90 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center p-4 text-center">
                <span className="text-xs font-bold text-white mb-1">Fan Pass Locked</span>
                <p className="text-[11px] text-navy-300 mb-3">Sign in to generate your personal check-in QR pass and earn +100 points.</p>
                <button
                  type="button"
                  onClick={() => openAuth('Fan Club Matchday Check-In Pass')}
                  className="px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-xs shadow"
                >
                  Sign In to Unlock Pass
                </button>
              </div>
            )}
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-navy-950 text-gold-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-gold-500/50 uppercase tracking-widest whitespace-nowrap">
              Aces Verified Pass
            </div>
          </div>

          {/* 6-Character Fallback Code */}
          <div className="mt-6 flex flex-col items-center">
            <span className="text-[11px] uppercase tracking-wider text-navy-400 font-medium mb-1">
              Manual Check-in Code
            </span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-mono font-bold tracking-widest text-gold-400 bg-navy-950/80 px-4 py-1.5 rounded-xl border border-navy-700">
                {fanClubCode || '••••••'}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                title="Copy Code"
                className="p-2 rounded-xl bg-navy-800 hover:bg-navy-700 text-navy-200 transition-colors"
              >
                {copied ? (
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
            {copied && <span className="text-xs text-emerald-400 mt-1">Code copied to clipboard!</span>}
          </div>
        </div>

        {/* Right: How to check in + Match window details */}
        <div className="md:col-span-7 space-y-4">
          <div className="bg-navy-950/60 border border-navy-800 rounded-xl p-4 sm:p-5">
            <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              How Matchday Check-In Works
            </h4>
            <ol className="text-xs sm:text-sm text-navy-200 space-y-2 list-decimal list-inside">
              <li>Head to any official Arabian Aces Fan Club venue (watch parties, stadium kiosks, sports hubs).</li>
              <li>Present this QR code or 6-digit code to the Venue Desk Admin <strong>60 to 90 minutes before match start</strong>.</li>
              <li>Admin scans your pass, instantly verifying your attendance and awarding <strong>+100 Fan Points</strong> directly into your profile!</li>
            </ol>
          </div>

          {openMatch && (
            <div className="bg-navy-900/80 border border-gold-500/20 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-gold-400 tracking-wider">Next Match Fixture</span>
                <div className="text-sm font-bold text-white mt-0.5">
                  Match {openMatch.matchNo}: {teamById?.(openMatch.teamA)?.name || openMatch.teamA} vs {teamById?.(openMatch.teamB)?.name || openMatch.teamB}
                </div>
                <div className="text-xs text-navy-400 mt-0.5">
                  {new Date(openMatch.startsAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at {new Date(openMatch.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {openMatch.venue}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-gold-400 block">+100 Pts</span>
                <span className="text-[11px] text-navy-400">On Check-in</span>
              </div>
            </div>
          )}

          {/* User profile reflected points confirmation */}
          {checkedIn && checkedInRecord && (
            <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  ✓
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-300">
                    Checked in at {checkedInRecord.fanClubName}
                  </div>
                  <div className="text-[11px] text-emerald-400/80">
                    Awarded {checkedInRecord.pointsAwarded} Fan Points · {new Date(checkedInRecord.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!compact && (
        <>
          {/* Venue Specific Single-Use Offers Section */}
          <div className="mt-6 pt-6 border-t border-navy-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-base font-bold text-white">Exclusive Venue Perks & Single-Use Offers</h4>
                <p className="text-xs text-navy-300">Show your checked-in QR pass at the venue counter to claim these limited perks.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeOffers.map(offer => (
                <div
                  key={offer.id}
                  className={`p-4 rounded-xl border transition-all ${
                    offer.redeemed
                      ? 'bg-navy-950/40 border-navy-800/60 opacity-60'
                      : 'bg-navy-900/90 border-navy-700 hover:border-gold-500/50 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h5 className="font-bold text-sm text-white line-clamp-1">{offer.title}</h5>
                    {offer.redeemed ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-navy-800 text-navy-400 border border-navy-700">
                        Claimed
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        Single-Use
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-navy-300 mb-3 line-clamp-2">{offer.description}</p>
                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-navy-800/60">
                    <span className="text-gold-400 font-semibold">{offer.perk}</span>
                    <span className="text-navy-400">At venue desk</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Official Fan Club Locations (Primary focus: Hyderabad, India & UAE) */}
          <div className="mt-8 pt-6 border-t border-navy-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-base font-bold text-white">Official Fan Club Hubs</h4>
                <p className="text-xs text-navy-300">Watch parties, merchandise desks, and live screening locations.</p>
              </div>

              {/* Region Filter */}
              <div className="inline-flex rounded-xl bg-navy-950 p-1 border border-navy-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSelectedRegion('hyderabad')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    selectedRegion === 'hyderabad' ? 'bg-gold-500 text-navy-950' : 'text-navy-300 hover:text-white'
                  }`}
                >
                  Hyderabad ({fanClubs.filter(c => c.region === 'hyderabad').length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRegion('uae')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    selectedRegion === 'uae' ? 'bg-gold-500 text-navy-950' : 'text-navy-300 hover:text-white'
                  }`}
                >
                  UAE ({fanClubs.filter(c => c.region === 'uae').length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRegion('all')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    selectedRegion === 'all' ? 'bg-gold-500 text-navy-950' : 'text-navy-300 hover:text-white'
                  }`}
                >
                  All ({fanClubs.length})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredClubs.map(club => (
                <div
                  key={club.id}
                  onClick={() => setSelectedClub(selectedClub?.id === club.id ? null : club)}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                    selectedClub?.id === club.id
                      ? 'bg-navy-850 border-gold-500 shadow-lg'
                      : 'bg-navy-950/70 border-navy-800 hover:border-navy-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gold-400">{club.city}, {club.country}</span>
                    <span className="text-[10px] text-navy-400 font-mono">Cap: {club.capacity}</span>
                  </div>
                  <h5 className="font-semibold text-sm text-white mb-1">{club.name}</h5>
                  <p className="text-xs text-navy-400 line-clamp-1">{club.address}</p>
                  {club.contactPerson && (
                    <div className="text-[11px] text-navy-500 mt-2">
                      Coordinator: {club.contactPerson}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

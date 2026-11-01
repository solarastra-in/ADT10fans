import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../state';
import { api } from '../api';
import type { FanClubStatusResponse, FanClub, VenueOffer } from '../types';

const PREFERRED_VENUE_KEY = 'aces_preferred_venue_id';

interface QuickQRPassModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickQRPassModal: React.FC<QuickQRPassModalProps> = ({ isOpen, onClose }) => {
  const { user, openAuth } = useApp();
  const [status, setStatus] = useState<FanClubStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem(PREFERRED_VENUE_KEY) : '') || '';
  });

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

      // Default selected venue if not chosen yet
      if (!selectedVenueId && data.fanClubs.length > 0) {
        const defaultClub = data.fanClubs.find(c => c.region === 'hyderabad') || data.fanClubs[0];
        setSelectedVenueId(defaultClub.id);
      }
    } catch (e) {
      console.error('Failed to load fan pass status', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen, user?.id]);

  const handleCopyCode = () => {
    if (!status?.fanClubCode) return;
    navigator.clipboard?.writeText(status.fanClubCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVenueChange = (venueId: string) => {
    setSelectedVenueId(venueId);
    if (typeof window !== 'undefined') {
      localStorage.setItem(PREFERRED_VENUE_KEY, venueId);
    }
  };

  if (!isOpen) return null;

  const { openMatch, checkInWindowActive, minutesToMatch, checkedIn, checkedInRecord, fanClubCode, fanClubs = [] } = status || {};

  const currentVenue = fanClubs.find(c => c.id === selectedVenueId) || fanClubs[0];
  const userClaimedOfferIds = new Set(user?.claimedVenueOfferIds || []);

  const venueOffers = currentVenue?.offers || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-gradient-to-b from-navy-900 to-navy-950 border border-gold-500/40 rounded-2xl shadow-2xl p-6 sm:p-7 text-white my-8 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-navy-800 hover:bg-navy-700 text-navy-300 hover:text-white flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal Header */}
        <div className="text-center sm:text-left pb-4 border-b border-navy-800">
          <div className="inline-flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-gold-400 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-gold-400">Official Matchday Access Pass</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Matchday Fan Club QR Pass
          </h2>
          <p className="text-xs text-navy-300 mt-1">
            Present this pass at your selected fan club desk 60–90 min before match start to claim <span className="text-amber-400 font-bold">+100 Fan Points</span> & venue perks.
          </p>
        </div>

        {/* Status Pill */}
        <div className="my-4 flex items-center justify-between flex-wrap gap-2">
          {checkedIn ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-xs font-bold">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Checked In ({checkedInRecord?.fanClubName || 'Match Venue'})
            </div>
          ) : checkInWindowActive ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-950/90 border border-amber-500/70 text-amber-300 text-xs font-bold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Check-In Desk Open Now · Ready for Scanning
            </div>
          ) : openMatch ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-navy-800 border border-navy-700 text-navy-300 text-xs">
              <svg className="w-3.5 h-3.5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Check-in window opens {minutesToMatch && minutesToMatch > 90 ? `in ${minutesToMatch - 90}m` : 'at T-90 min'}
            </div>
          ) : null}

          {/* Quick link to venue admin scanner if authorized */}
          {status?.isVenueManager && (
            <a
              href="/admin/fanclub"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-gold-400 hover:text-gold-300 inline-flex items-center gap-1"
            >
              <span>Venue Desk Kiosk</span>
              <span>→</span>
            </a>
          )}
        </div>

        {/* QR Pass Body */}
        <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
          {/* QR Code Container */}
          <div className="relative p-3 bg-white rounded-2xl shadow-2xl border-2 border-gold-500/50 shrink-0">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Matchday QR Pass"
                className="w-44 h-44 sm:w-48 sm:h-48 rounded-lg object-contain"
              />
            ) : (
              <div className="w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center text-navy-900 font-bold text-xs">
                Generating Pass...
              </div>
            )}

            {!user && (
              <div className="absolute inset-0 bg-navy-950/90 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center p-3 text-center">
                <span className="text-xs font-bold text-white mb-1">Fan Pass Locked</span>
                <p className="text-[11px] text-navy-300 mb-2.5">Sign in to unlock your QR code pass & claim +100 points.</p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openAuth('Matchday QR Pass');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-xs shadow"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>

          {/* Manual Code & Anti-Duplicate Match Rules */}
          <div className="space-y-3.5 flex-1 min-w-0 text-center sm:text-left">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-navy-400 font-semibold block mb-1">
                6-Character Check-In Code
              </span>
              <div className="inline-flex items-center gap-2">
                <span className="text-xl font-mono font-extrabold tracking-widest text-gold-400 bg-navy-950 px-3 py-1.5 rounded-xl border border-navy-700">
                  {fanClubCode || '••••••'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-2 rounded-xl bg-navy-800 hover:bg-navy-700 text-navy-300 transition-colors"
                  title="Copy Code"
                >
                  {copied ? (
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
              {copied && <span className="text-xs text-emerald-400 block mt-1">Code copied!</span>}
            </div>

            <div className="text-xs text-navy-300 space-y-1 bg-navy-950/70 p-3 rounded-xl border border-navy-800/80">
              <div className="font-semibold text-white flex items-center gap-1.5 justify-center sm:justify-start">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-400" />
                <span>Strict Matchday Check-In Rules</span>
              </div>
              <p className="text-[11px] text-navy-400">
                1 check-in per match only. Points are bound to your verified Instagram handle ({user?.instagramHandle || 'Required on Sign-In'}) and cannot be claimed multiple times across different accounts or devices.
              </p>
            </div>
          </div>
        </div>

        {/* Venue Selection Formatted as "City Name - Venue Name" */}
        <div className="mt-5 pt-4 border-t border-navy-800">
          <label className="block text-xs font-bold text-navy-300 uppercase tracking-wider mb-1.5">
            Select Your Venue to View Perks (City Name - Venue Name)
          </label>
          <div className="relative">
            <select
              value={selectedVenueId}
              onChange={(e) => handleVenueChange(e.target.value)}
              className="w-full bg-navy-950 border border-gold-500/40 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold-500 font-medium"
            >
              {fanClubs.map(fc => (
                <option key={fc.id} value={fc.id}>
                  {fc.city} - {fc.name}
                </option>
              ))}
            </select>
          </div>
          {currentVenue && (
            <p className="text-[11px] text-navy-400 mt-1.5 truncate">
              📍 {currentVenue.address} {currentVenue.contactPerson ? `· Coordinator: ${currentVenue.contactPerson}` : ''}
            </p>
          )}
        </div>

        {/* Venue-Specific Perks (Only for Selected Venue) */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Perks at {currentVenue?.city} - {currentVenue?.name.split('–')[1] || currentVenue?.name}
            </span>
            <span className="text-[10px] text-navy-400">
              {venueOffers.length} Perk{venueOffers.length !== 1 ? 's' : ''}
            </span>
          </div>

          {venueOffers.length === 0 ? (
            <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 text-xs text-navy-400 text-center">
              No special perks listed for this venue today. General +100 check-in points apply!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {venueOffers.map(offer => {
                const isClaimed = userClaimedOfferIds.has(offer.id);
                return (
                  <div
                    key={offer.id}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      isClaimed
                        ? 'bg-navy-950/40 border-navy-800/80 opacity-60'
                        : 'bg-navy-950 border-navy-700/80 hover:border-gold-500/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-bold text-white line-clamp-1">{offer.title}</span>
                        {isClaimed ? (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-navy-800 text-navy-400">
                            Claimed
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-400 border border-gold-500/40">
                            Single-Use
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-navy-300 line-clamp-2">{offer.description}</p>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-navy-800/60 flex items-center justify-between text-[10px]">
                      <span className="text-gold-400 font-bold">{offer.perk}</span>
                      <span className="text-navy-400">Scan at desk</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="mt-6 pt-4 border-t border-navy-800 flex items-center justify-between">
          <span className="text-xs text-navy-400">
            {checkedIn ? '✓ Check-in recorded for this match' : 'Scan once at the venue entrance desk'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-navy-800 hover:bg-navy-700 text-white font-bold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

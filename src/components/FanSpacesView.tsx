import React, { useState, useEffect } from 'react';
import { FanSpace, FanSpaceBooking, User } from '../types';
import { api } from '../api';
import {
  MapPin,
  Users,
  Clock,
  Calendar,
  Tv,
  Sparkles,
  Ticket,
  Coffee,
  ShoppingBag,
  CheckCircle2,
  Award,
  X,
  ExternalLink,
  Settings,
  Loader2,
} from 'lucide-react';

interface FanSpacesViewProps {
  user: User | null;
  onOpenAuth: () => void;
  onOpenAdmin?: () => void;
}

const hasText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const hasList = (v: unknown): v is string[] => Array.isArray(v) && v.some(x => hasText(x));
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isHttpUrl = (v: unknown): v is string => hasText(v) && /^https?:\/\//i.test(v.trim());

const canBook = (s: FanSpace) => s.status !== 'sold_out' && s.bookingEnabled !== false;

const statusLabel = (s: FanSpace['status']) =>
  s === 'active' ? 'Open' : s === 'upcoming' ? 'Coming soon' : s === 'sold_out' ? 'Fully reserved' : String(s || '');

const statusClass = (s: FanSpace['status']) =>
  s === 'active'
    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
    : s === 'sold_out'
    ? 'bg-red-500/15 border-red-500/40 text-red-300'
    : 'bg-amber-500/15 border-amber-500/40 text-amber-300';

const ticketTypeLabel = (t: string) =>
  t === 'vip_pass' ? 'VIP pass' : t === 'vr_cage_reservation' ? 'VR cage' : 'Standard entry';

function priceText(space: FanSpace): string | null {
  const parts: string[] = [];
  if (positive(space.vipPassPriceUsd)) parts.push(`$${space.vipPassPriceUsd}`);
  if (positive(space.vipPassPriceAed)) parts.push(`${space.vipPassPriceAed} AED`);
  return parts.length ? parts.join(' / ') : null;
}

const SpaceImage: React.FC<{ space: FanSpace; className?: string }> = ({ space, className = '' }) => {
  const [failed, setFailed] = useState(false);
  if (!isHttpUrl(space.image) || failed) {
    return (
      <div className={`w-full bg-gradient-to-br from-slate-800 via-slate-900 to-amber-950/40 flex items-center justify-center ${className}`}>
        <MapPin className="w-10 h-10 text-amber-400/60" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={space.image}
      alt={space.name}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`w-full object-cover ${className}`}
    />
  );
};

export const FanSpacesView: React.FC<FanSpacesViewProps> = ({ user, onOpenAuth, onOpenAdmin }) => {
  const [spaces, setSpaces] = useState<FanSpace[]>([]);
  const [userBookings, setUserBookings] = useState<FanSpaceBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');

  // Reservation sheet state
  const [bookingSpace, setBookingSpace] = useState<FanSpace | null>(null);
  const [bookingDate, setBookingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [ticketType, setTicketType] = useState<'standard_entry' | 'vip_pass'>('standard_entry');
  const [ticketsCount, setTicketsCount] = useState<number>(1);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookedSuccess, setBookedSuccess] = useState<FanSpaceBooking | null>(null);

  const isAdmin = user?.role === 'admin';

  const loadSpaces = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.getFanSpaces();
      const list: FanSpace[] = res.spaces || [];
      setSpaces(list);
      setUserBookings(res.bookings || []);
      setSelectedSpaceId(prev => (list.some(s => s.id === prev) ? prev : list[0]?.id || ''));
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load Fan Spaces.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSpaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const activeSpace = spaces.find(s => s.id === selectedSpaceId) || spaces[0];

  const handleOpenBooking = (space: FanSpace) => {
    if (!canBook(space)) return;
    if (!user) {
      onOpenAuth();
      return;
    }
    setBookingSpace(space);
    setBookedSuccess(null);
    setBookingError(null);
    setTicketType('standard_entry');
    setTicketsCount(1);
  };

  const closeBooking = () => {
    setBookingSpace(null);
    setBookedSuccess(null);
    setBookingError(null);
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingSpace) return;
    setBookingSubmitting(true);
    setBookingError(null);
    try {
      const res = await api.bookFanSpace(bookingSpace.id, { date: bookingDate, ticketType, ticketsCount });
      if (res.success && res.booking) {
        const booking: FanSpaceBooking = { ...res.booking, passCode: res.booking.passCode || res.passCode };
        setBookedSuccess(booking);
        setUserBookings(prev => [booking, ...prev]);
        setSpaces(prev =>
          prev.map(s => (s.id === bookingSpace.id ? { ...s, totalBookings: (s.totalBookings || 0) + (booking.ticketsCount || 0) } : s))
        );
      } else {
        setBookingError('The reservation could not be completed. Please try again.');
      }
    } catch (err: any) {
      setBookingError(err?.message || 'The reservation could not be completed.');
    } finally {
      setBookingSubmitting(false);
    }
  };

  const hasVipOption = (s: FanSpace) => hasList(s.vipPerks) || priceText(s) !== null;

  // ---------------- Loading / error / empty ----------------
  if (loading && spaces.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
        <span>Loading Fan Spaces…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/40 border border-amber-500/30 p-5 sm:p-8">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>Fan Spaces</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight font-display">
            Watch with <span className="bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">fellow fans</span>
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Venues where fans gather to watch matches together. Reserving a spot is free — you'll get a pass code to show on arrival.
          </p>
        </div>

        {/* Space picker chips */}
        {spaces.length > 1 && (
          <div className="relative z-10 mt-6 -mx-5 px-5 sm:-mx-8 sm:px-8 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {spaces.map(space => {
              const isSelected = space.id === activeSpace?.id;
              return (
                <button
                  key={space.id}
                  onClick={() => setSelectedSpaceId(space.id)}
                  className={`shrink-0 min-h-[40px] flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <MapPin className={`w-4 h-4 ${isSelected ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span>{space.city || space.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {loadError && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>{loadError}</span>
          <button onClick={loadSpaces} className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm">
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loadError && spaces.length === 0 && (
        <div className="p-8 sm:p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-400/10 text-amber-400 border border-amber-400/30 flex items-center justify-center mx-auto">
            <MapPin className="w-7 h-7" />
          </div>
          <p className="text-slate-300 text-sm sm:text-base">Fan Spaces will be announced here.</p>
          {isAdmin && onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-amber-400 text-slate-950 font-black text-sm"
            >
              <Settings className="w-4 h-4" />
              Add a Fan Space in Admin Console
            </button>
          )}
        </div>
      )}

      {/* Active space detail */}
      {activeSpace && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          <div className="lg:col-span-8 min-w-0">
            <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden">
              <div className="relative">
                <SpaceImage space={activeSpace} className="aspect-[16/9]" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent pointer-events-none" />
                <div className="absolute top-3 left-3 right-3 flex flex-wrap gap-2">
                  {(hasText(activeSpace.city) || hasText(activeSpace.country)) && (
                    <span className="px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                      {[activeSpace.city, activeSpace.country].filter(hasText).join(', ')}
                    </span>
                  )}
                  {activeSpace.status && (
                    <span className={`px-3 py-1 rounded-full border font-bold text-xs ${statusClass(activeSpace.status)}`}>
                      {statusLabel(activeSpace.status)}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-5 sm:p-8 space-y-6">
                <div className="space-y-1 min-w-0">
                  {hasText(activeSpace.tagline) && (
                    <span className="text-amber-400 text-xs font-bold uppercase tracking-widest block">{activeSpace.tagline}</span>
                  )}
                  <h2 className="text-xl sm:text-3xl font-black text-white font-display break-words">{activeSpace.name}</h2>
                  {hasText(activeSpace.location) && (
                    <p className="text-slate-300 text-sm flex items-start gap-1.5">
                      <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span className="break-words">{activeSpace.location}</span>
                    </p>
                  )}
                  {isHttpUrl(activeSpace.mapUrl) && (
                    <a
                      href={activeSpace.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-bold text-amber-400 hover:text-amber-300"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in Maps
                    </a>
                  )}
                </div>

                {/* Key facts — only filled fields */}
                {(() => {
                  const facts: { label: string; value: React.ReactNode; icon: React.ReactNode }[] = [];
                  if (positive(activeSpace.capacity))
                    facts.push({ label: 'Capacity', value: activeSpace.capacity.toLocaleString(), icon: <Users className="w-4 h-4 text-amber-400" /> });
                  if (hasText(activeSpace.openHours))
                    facts.push({ label: 'Opening hours', value: activeSpace.openHours, icon: <Clock className="w-4 h-4 text-amber-400" /> });
                  const price = priceText(activeSpace);
                  if (price) facts.push({ label: 'VIP pass price', value: price, icon: <Award className="w-4 h-4 text-amber-400" /> });
                  if (positive(activeSpace.totalBookings))
                    facts.push({ label: 'Spots reserved', value: activeSpace.totalBookings.toLocaleString(), icon: <Ticket className="w-4 h-4 text-amber-400" /> });
                  if (!facts.length) return null;
                  return (
                    <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
                      {facts.map(f => (
                        <div key={f.label} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 min-w-0">
                          <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                            {f.icon}
                            {f.label}
                          </span>
                          <span className="text-sm font-bold text-white block mt-1 break-words">{f.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {hasList(activeSpace.features) && (
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" /> Features
                    </h3>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeSpace.features.filter(hasText).map((feat, idx) => (
                        <li key={idx} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5 text-sm text-slate-200">
                          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <span className="break-words min-w-0">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {hasList(activeSpace.amenities) && (
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Amenities</h3>
                    <div className="flex flex-wrap gap-2">
                      {activeSpace.amenities.filter(hasText).map((a, i) => (
                        <span key={i} className="text-xs bg-slate-950 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-800">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {hasText(activeSpace.liveMatchSchedule) && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                    <Tv className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-amber-300 uppercase tracking-wide block">Match screenings</span>
                      <p className="text-sm text-slate-200 mt-0.5 break-words">{activeSpace.liveMatchSchedule}</p>
                    </div>
                  </div>
                )}

                {(hasText(activeSpace.menuHighlights) || hasText(activeSpace.merchBoutique)) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {hasText(activeSpace.menuHighlights) && (
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-1.5">
                          <Coffee className="w-4 h-4" />
                          <span>Food & drink</span>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed break-words">{activeSpace.menuHighlights}</p>
                      </div>
                    )}
                    {hasText(activeSpace.merchBoutique) && (
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-1.5">
                          <ShoppingBag className="w-4 h-4" />
                          <span>Merchandise</span>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed break-words">{activeSpace.merchBoutique}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reservation panel */}
          <div className="lg:col-span-4 min-w-0">
            <div className="rounded-3xl bg-slate-900 border border-amber-500/30 p-5 sm:p-6 space-y-5 lg:sticky lg:top-24">
              <div className="space-y-1">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">Free reservation</span>
                <h3 className="text-lg font-black text-white font-display break-words">{activeSpace.name}</h3>
              </div>

              {hasList(activeSpace.vipPerks) && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-400" />
                    VIP inclusions
                  </span>
                  <ul className="space-y-1.5 text-sm text-slate-300">
                    {activeSpace.vipPerks.filter(hasText).map((perk, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-amber-400 font-bold">•</span>
                        <span className="break-words min-w-0">{perk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {canBook(activeSpace) ? (
                <button
                  onClick={() => handleOpenBooking(activeSpace)}
                  className="w-full min-h-[48px] px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <Ticket className="w-4 h-4" />
                  <span>{user ? 'Reserve a spot' : 'Sign in to reserve a spot'}</span>
                </button>
              ) : (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-400 text-center">
                  {activeSpace.status === 'sold_out' ? 'This Fan Space is fully reserved.' : 'Reservations are not open yet.'}
                </div>
              )}

              {user && userBookings.length > 0 && (
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <span className="text-sm font-bold text-slate-200 flex items-center justify-between">
                    <span>My reservations</span>
                    <span className="text-xs bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded font-mono">{userBookings.length}</span>
                  </span>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {userBookings.map(bk => (
                      <div key={bk.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-white text-sm break-words min-w-0">{bk.spaceName}</span>
                          <span className="text-xs text-amber-400 font-bold shrink-0">{ticketTypeLabel(bk.ticketType)}</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-x-2 text-xs text-slate-400">
                          <span>
                            {bk.date} · {bk.ticketsCount} {bk.ticketsCount === 1 ? 'spot' : 'spots'}
                          </span>
                          <span className="font-mono text-emerald-400 font-bold break-all">{bk.passCode}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All spaces */}
      {spaces.length > 1 && (
        <div className="space-y-4">
          <h3 className="text-lg sm:text-xl font-black text-white font-display">All Fan Spaces</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {spaces.map(s => (
              <div
                key={s.id}
                className={`rounded-2xl bg-slate-900 border overflow-hidden flex flex-col ${
                  s.id === activeSpace?.id ? 'border-amber-400' : 'border-slate-800'
                }`}
              >
                <button onClick={() => setSelectedSpaceId(s.id)} className="text-left flex-1">
                  <div className="relative">
                    <SpaceImage space={s} className="aspect-[16/9]" />
                    {s.status && (
                      <span className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full border text-xs font-bold ${statusClass(s.status)}`}>
                        {statusLabel(s.status)}
                      </span>
                    )}
                  </div>
                  <div className="p-4 space-y-1">
                    <h4 className="font-bold text-white text-base break-words">{s.name}</h4>
                    {(hasText(s.city) || hasText(s.country)) && (
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-amber-400" />
                        {[s.city, s.country].filter(hasText).join(', ')}
                      </p>
                    )}
                    {hasText(s.tagline) && <p className="text-sm text-slate-300 line-clamp-2">{s.tagline}</p>}
                  </div>
                </button>
                <div className="px-4 pb-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  {priceText(s) ? (
                    <div className="min-w-0">
                      <span className="text-xs text-slate-400 block">VIP pass</span>
                      <span className="text-sm font-mono font-bold text-amber-400">{priceText(s)}</span>
                    </div>
                  ) : (
                    <span />
                  )}
                  {canBook(s) && (
                    <button
                      onClick={() => handleOpenBooking(s)}
                      className="min-h-[44px] px-4 bg-amber-400/10 hover:bg-amber-400 text-amber-400 hover:text-slate-950 font-bold text-sm rounded-xl border border-amber-400/30 transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      <Ticket className="w-4 h-4" />
                      <span>Reserve a spot</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reservation sheet */}
      {bookingSpace && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Reserve a spot"
          onClick={closeBooking}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[100dvh] sm:max-h-[90dvh] overflow-y-auto relative"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 sm:px-6 py-3 bg-slate-900/95 backdrop-blur border-b border-slate-800">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
                <Ticket className="w-3.5 h-3.5" />
                {bookedSuccess ? 'Reservation confirmed' : 'Reserve a spot'}
              </span>
              <button
                onClick={closeBooking}
                aria-label="Close"
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6">
              {!bookedSuccess ? (
                <form onSubmit={handleConfirmBooking} className="space-y-5">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-white font-display break-words">{bookingSpace.name}</h3>
                    {(hasText(bookingSpace.city) || hasText(bookingSpace.location)) && (
                      <p className="text-sm text-slate-300 break-words">
                        {[bookingSpace.city, bookingSpace.location].filter(hasText).join(' · ')}
                      </p>
                    )}
                  </div>

                  {hasVipOption(bookingSpace) && (
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1.5">Entry type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            { id: 'standard_entry', label: 'Standard entry' },
                            { id: 'vip_pass', label: 'VIP' },
                          ] as const
                        ).map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setTicketType(t.id)}
                            className={`min-h-[44px] px-3 rounded-xl border text-sm font-bold transition-colors ${
                              ticketType === t.id
                                ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                                : 'bg-slate-950 border-slate-800 text-slate-300'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      {ticketType === 'vip_pass' && priceText(bookingSpace) && (
                        <p className="text-xs text-slate-400 mt-2">
                          VIP price listed by the venue: {priceText(bookingSpace)} — payable at the venue, not on this site.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="fs-date" className="text-xs font-bold text-slate-300 block mb-1.5">
                        Date of visit
                      </label>
                      <input
                        id="fs-date"
                        type="date"
                        value={bookingDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setBookingDate(e.target.value)}
                        className="w-full min-h-[44px] px-3 bg-slate-950 border border-slate-800 rounded-xl text-base sm:text-sm text-white focus:outline-none focus:border-amber-400"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="fs-count" className="text-xs font-bold text-slate-300 block mb-1.5">
                        Number of people
                      </label>
                      <select
                        id="fs-count"
                        value={ticketsCount}
                        onChange={e => setTicketsCount(parseInt(e.target.value, 10))}
                        className="w-full min-h-[44px] px-3 bg-slate-950 border border-slate-800 rounded-xl text-base sm:text-sm text-white focus:outline-none focus:border-amber-400"
                      >
                        {[1, 2, 3, 4, 5, 6].map(n => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {user && (
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm space-y-0.5 min-w-0">
                      <span className="font-bold text-slate-300 block">Reserved for</span>
                      <span className="text-slate-400 block break-all">
                        {user.name} ({user.email})
                      </span>
                    </div>
                  )}

                  {bookingError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{bookingError}</div>
                  )}

                  <button
                    type="submit"
                    disabled={bookingSubmitting}
                    className="w-full min-h-[48px] bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-sm rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {bookingSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {bookingSubmitting ? 'Reserving…' : 'Confirm free reservation'}
                  </button>
                </form>
              ) : (
                <div className="text-center space-y-5 py-2">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white font-display">You're on the list</h3>
                    <p className="text-sm text-slate-300 mt-1 break-words">Your reservation for {bookedSuccess.spaceName} is confirmed.</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-950 border border-amber-500/30 text-center space-y-2">
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Pass code</span>
                    <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-widest break-all select-all">
                      {bookedSuccess.passCode}
                    </div>
                    <div className="flex items-center justify-center gap-1.5 text-sm text-slate-400 pt-1">
                      <Calendar className="w-4 h-4 text-amber-400" />
                      <span>
                        {bookedSuccess.date} · {bookedSuccess.ticketsCount} {bookedSuccess.ticketsCount === 1 ? 'person' : 'people'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">Show this pass code at the venue on arrival.</p>
                  <button
                    onClick={closeBooking}
                    className="w-full min-h-[44px] bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

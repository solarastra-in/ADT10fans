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
  ShieldCheck, 
  ChevronRight, 
  Award, 
  QrCode, 
  X,
  ExternalLink,
  Flame,
  Globe
} from 'lucide-react';

interface FanSpacesViewProps {
  user: User | null;
  onOpenAuth: () => void;
  onOpenAdmin?: () => void;
}

export const FanSpacesView: React.FC<FanSpacesViewProps> = ({
  user,
  onOpenAuth,
  onOpenAdmin
}) => {
  const [spaces, setSpaces] = useState<FanSpace[]>([]);
  const [userBookings, setUserBookings] = useState<FanSpaceBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('space-abu-dhabi');
  
  // Booking Modal State
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingSpace, setBookingSpace] = useState<FanSpace | null>(null);
  const [bookingDate, setBookingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [ticketType, setTicketType] = useState<'standard_entry' | 'vip_pass' | 'vr_cage_reservation'>('vip_pass');
  const [ticketsCount, setTicketsCount] = useState<number>(2);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookedSuccess, setBookedSuccess] = useState<FanSpaceBooking | null>(null);

  const loadSpaces = async () => {
    try {
      setLoading(true);
      const res = await api.getFanSpaces();
      setSpaces(res.spaces || []);
      setUserBookings(res.bookings || []);
      if (res.spaces && res.spaces.length > 0 && !res.spaces.some(s => s.id === selectedSpaceId)) {
        setSelectedSpaceId(res.spaces[0].id);
      }
    } catch (e) {
      console.error('Failed to load fan spaces:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSpaces();
  }, [user]);

  const activeSpace = spaces.find(s => s.id === selectedSpaceId) || spaces[0];

  const handleOpenBooking = (space: FanSpace) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setBookingSpace(space);
    setBookedSuccess(null);
    setBookingModalOpen(true);
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingSpace) return;
    setBookingSubmitting(true);
    try {
      const res = await api.bookFanSpace(bookingSpace.id, {
        date: bookingDate,
        ticketType,
        ticketsCount
      });
      if (res.success && res.booking) {
        setBookedSuccess(res.booking);
        setUserBookings(prev => [res.booking, ...prev]);
        setSpaces(prev => prev.map(s => s.id === bookingSpace.id ? { ...s, totalBookings: (s.totalBookings || 0) + res.booking.ticketsCount } : s));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to complete booking');
    } finally {
      setBookingSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/40 border border-amber-500/30 p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span>Activity 8: Physical Experiential Network</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight font-display">
              Global <span className="bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">Fan Spaces</span> & Clubhouses
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Experience the 90-minute thunder of Abu Dhabi T10 live across 5 international metropolis clubhouses. Featuring 360° cylindrical LED screens, VR batting cages against 140km/h bowling, authentic Emirati hospitality, and official merchandise boutiques.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 font-semibold block">Total Global Capacity</span>
              <span className="text-2xl font-black text-amber-400 font-mono">
                {spaces.reduce((acc, s) => acc + (s.capacity || 0), 0).toLocaleString()} Fans
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 font-semibold block">International Metropolises</span>
              <span className="text-2xl font-black text-white font-mono">{spaces.length} Hubs</span>
            </div>
          </div>
        </div>

        {/* City Filter Pills */}
        <div className="flex items-center gap-2 mt-8 overflow-x-auto pb-2 no-scrollbar">
          {spaces.map(space => {
            const isSelected = space.id === selectedSpaceId;
            return (
              <button
                key={space.id}
                onClick={() => setSelectedSpaceId(space.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 scale-105'
                    : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <MapPin className={`w-4 h-4 ${isSelected ? 'text-slate-950' : 'text-amber-400'}`} />
                <span>{space.city}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${
                  isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  {space.capacity} cap
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Fan Space Detailed Card */}
      {activeSpace && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Showcase (Left 8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
              {/* Hero Image */}
              <div className="relative h-64 sm:h-96 w-full overflow-hidden">
                <img 
                  src={activeSpace.image} 
                  alt={activeSpace.name} 
                  className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                
                {/* Badges Overlay */}
                <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    {activeSpace.city}, {activeSpace.country}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {activeSpace.status === 'active' ? 'Open Daily & Matchdays' : activeSpace.status}
                  </span>
                </div>

                <div className="absolute bottom-6 left-6 right-6">
                  <span className="text-amber-400 text-xs font-bold uppercase tracking-widest block mb-1">
                    {activeSpace.tagline}
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white font-display">
                    {activeSpace.name}
                  </h2>
                  <p className="text-slate-300 text-xs sm:text-sm mt-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    {activeSpace.location}
                  </p>
                </div>
              </div>

              {/* Core Details Grid */}
              <div className="p-6 sm:p-8 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-[11px] text-slate-400 font-semibold block">Clubhouse Capacity</span>
                    <span className="text-lg font-black text-white font-mono flex items-center gap-1 mt-0.5">
                      <Users className="w-4 h-4 text-amber-400" /> {activeSpace.capacity}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-[11px] text-slate-400 font-semibold block">Opening Hours</span>
                    <span className="text-xs font-bold text-slate-200 block mt-0.5 truncate" title={activeSpace.openHours}>
                      {activeSpace.openHours}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-[11px] text-slate-400 font-semibold block">VIP Pass (USD / AED)</span>
                    <span className="text-base font-black text-amber-400 font-mono block mt-0.5">
                      ${activeSpace.vipPassPriceUsd} / {activeSpace.vipPassPriceAed} AED
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-[11px] text-slate-400 font-semibold block">Passes Reserved</span>
                    <span className="text-lg font-black text-emerald-400 font-mono block mt-0.5">
                      {activeSpace.totalBookings || 240} fans
                    </span>
                  </div>
                </div>

                {/* Key Features List */}
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" /> Experiential Innovations
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activeSpace.features.map((feat, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-200 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Match Broadcast Schedule */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                  <Tv className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wide block">
                      Live Tournament Screenings
                    </span>
                    <p className="text-xs text-slate-200 mt-0.5">
                      {activeSpace.liveMatchSchedule}
                    </p>
                  </div>
                </div>

                {/* F&B & Merchandise Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-1.5">
                      <Coffee className="w-4 h-4" />
                      <span>Matchday Food & Bar Highlights</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {activeSpace.menuHighlights}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-1.5">
                      <ShoppingBag className="w-4 h-4" />
                      <span>Official Merchandise Boutique</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {activeSpace.merchBoutique}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Booking & VIP Pass Widget (Right 4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-3xl bg-slate-900 border border-amber-500/30 p-6 shadow-xl space-y-5 sticky top-24">
              <div className="space-y-1">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                  Matchday Passes & Hospitality
                </span>
                <h3 className="text-xl font-black text-white font-display">
                  Book Your {activeSpace.city} Pass
                </h3>
                <p className="text-xs text-slate-400">
                  Select your experience tier for guaranteed stadium screen seating and VR simulator tokens.
                </p>
              </div>

              {/* VIP Perks Card */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  VIP Enclosure Inclusions
                </span>
                <ul className="space-y-1.5 text-[11px] text-slate-300">
                  {activeSpace.vipPerks.map((perk, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={() => handleOpenBooking(activeSpace)}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-95"
                >
                  <Ticket className="w-4 h-4" />
                  <span>Reserve Fan Space Entry (${activeSpace.vipPassPriceUsd})</span>
                </button>
                <p className="text-[10px] text-center text-slate-400 font-medium">
                  Instant QR code confirmation · Free cancellation up to 6 hours before match
                </p>
              </div>

              {/* User Bookings Section */}
              {user && userBookings.length > 0 && (
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <span className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>My Fan Space Passes</span>
                    <span className="text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded font-mono">
                      {userBookings.length}
                    </span>
                  </span>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {userBookings.map(bk => (
                      <div key={bk.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">{bk.spaceName}</span>
                          <span className="text-[10px] text-amber-400 font-mono font-bold uppercase">
                            {bk.ticketType.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>{bk.date} · {bk.ticketsCount} {bk.ticketsCount === 1 ? 'pass' : 'passes'}</span>
                          <span className="font-mono text-emerald-400 font-bold">{bk.passCode}</span>
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

      {/* 5 Metropolis Comparison Cards */}
      <div className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-white font-display">
              All 5 Global Metropolis Clubhouses
            </h3>
            <p className="text-xs text-slate-400">
              Browse features, capacity, and city locations across the UAE, UK, India, and Canada.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {spaces.map(s => (
            <div 
              key={s.id} 
              onClick={() => setSelectedSpaceId(s.id)}
              className={`rounded-2xl bg-slate-900 border p-5 cursor-pointer transition-all hover:border-amber-400/50 flex flex-col justify-between ${
                s.id === selectedSpaceId ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-slate-800'
              }`}
            >
              <div className="space-y-3">
                <div className="relative h-40 rounded-xl overflow-hidden">
                  <img src={s.image} alt={s.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                  <span className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-slate-950/80 text-white text-[11px] font-bold flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" />
                    {s.city}, {s.country}
                  </span>
                  <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                    {s.capacity} cap
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-white text-base hover:text-amber-400 transition-colors">
                    {s.name}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {s.tagline}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {s.features.slice(0, 3).map((f, i) => (
                    <span key={i} className="text-[10px] bg-slate-950 text-slate-300 px-2 py-0.5 rounded border border-slate-800">
                      {f.split('(')[0]}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">VIP Pass</span>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    ${s.vipPassPriceUsd} ({s.vipPassPriceAed} AED)
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenBooking(s);
                  }}
                  className="px-3 py-1.5 bg-amber-400/10 hover:bg-amber-400 text-amber-400 hover:text-slate-950 font-bold text-xs rounded-lg border border-amber-400/30 transition-all flex items-center gap-1"
                >
                  <Ticket className="w-3.5 h-3.5" />
                  <span>Reserve</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Booking Modal */}
      {bookingModalOpen && bookingSpace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 relative shadow-2xl">
            <button
              onClick={() => setBookingModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            {!bookedSuccess ? (
              <form onSubmit={handleConfirmBooking} className="space-y-5">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <Ticket className="w-3.5 h-3.5" />
                    <span>Fan Space Pass Reservation</span>
                  </div>
                  <h3 className="text-xl font-black text-white font-display">
                    {bookingSpace.name}
                  </h3>
                  <p className="text-xs text-slate-300">
                    {bookingSpace.city} · {bookingSpace.location}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Experience Tier
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'standard_entry', label: 'Standard Fan', price: `$${Math.round(bookingSpace.vipPassPriceUsd * 0.35)}` },
                        { id: 'vip_pass', label: 'VIP Majlis', price: `$${bookingSpace.vipPassPriceUsd}` },
                        { id: 'vr_cage_reservation', label: 'VR Batting Cage', price: `$${Math.round(bookingSpace.vipPassPriceUsd * 0.6)}` },
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTicketType(t.id as any)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            ticketType === t.id
                              ? 'bg-amber-400/15 border-amber-400 text-amber-300 font-bold'
                              : 'bg-slate-950 border-slate-800 text-slate-300'
                          }`}
                        >
                          <span className="text-xs block font-bold">{t.label}</span>
                          <span className="text-[11px] text-amber-400 font-mono">{t.price}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        Date of Visit
                      </label>
                      <input 
                        type="date"
                        value={bookingDate}
                        onChange={e => setBookingDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        Number of Passes
                      </label>
                      <select
                        value={ticketsCount}
                        onChange={e => setTicketsCount(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                      >
                        {[1, 2, 3, 4, 5, 8, 10].map(n => (
                          <option key={n} value={n}>{n} {n === 1 ? 'Pass' : 'Passes'}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                    <span className="font-bold text-slate-300">Guest Name:</span>
                    <span className="text-slate-400 block">{user?.name} ({user?.email})</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={bookingSubmitting}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
                >
                  {bookingSubmitting ? 'Confirming Reservation...' : 'Confirm & Generate Access Pass'}
                </button>
              </form>
            ) : (
              <div className="text-center space-y-5 py-2 animate-in zoom-in-95">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white font-display">Pass Confirmed!</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Your official matchday entry voucher for {bookedSuccess.spaceName} is generated.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-950 border border-amber-500/30 text-center space-y-2">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Official Pass Code</span>
                  <div className="text-2xl font-black text-amber-400 font-mono tracking-widest">
                    {bookedSuccess.passCode}
                  </div>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 pt-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>{bookedSuccess.date} · {bookedSuccess.ticketsCount} Guests</span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  +50 Fan Loyalty points awarded! Present this pass code on your mobile upon arrival at the clubhouse front desk.
                </p>

                <button
                  onClick={() => setBookingModalOpen(false)}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors"
                >
                  Close & View Passbook
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { YouthCupSchool, CreatorPartner, CommentaryAudioFeed, SuperfanPassportTier, User } from '../types';
import { api } from '../api';
import {
  GraduationCap,
  Video,
  Volume2,
  CreditCard,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Radio,
  Settings,
  Loader2,
  Users,
} from 'lucide-react';

interface GrowthCatalystsViewProps {
  user: User | null;
  onOpenAuth: () => void;
  onOpenAdmin?: () => void;
}

const hasText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isHttpUrl = (v: unknown): v is string => hasText(v) && /^https?:\/\//i.test(v.trim());
const isAudioStream = (url: string) => /\.(mp3|aac|ogg|oga|opus|m4a|wav|m3u8)(\?[^#]*)?(#.*)?$/i.test(url.trim());

const initials = (name: string) =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('') || '?';

const CreatorAvatar: React.FC<{ creator: CreatorPartner }> = ({ creator }) => {
  const [failed, setFailed] = useState(false);
  if (isHttpUrl(creator.avatar) && !failed) {
    return (
      <img
        src={creator.avatar}
        alt={creator.name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-12 h-12 rounded-xl object-cover border border-amber-500/30 shrink-0"
      />
    );
  }
  return (
    <div className="w-12 h-12 rounded-xl bg-amber-400/15 border border-amber-500/30 text-amber-300 font-black flex items-center justify-center shrink-0">
      {initials(creator.name)}
    </div>
  );
};

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string }> = ({ icon, title, subtitle }) => (
  <div className="space-y-1">
    <h2 className="text-lg sm:text-2xl font-black text-white font-display flex items-center gap-2">
      {icon}
      <span>{title}</span>
    </h2>
    {subtitle && <p className="text-sm text-slate-300 max-w-2xl">{subtitle}</p>}
  </div>
);

export const GrowthCatalystsView: React.FC<GrowthCatalystsViewProps> = ({ user, onOpenAuth, onOpenAdmin }) => {
  const [youthSchools, setYouthSchools] = useState<YouthCupSchool[]>([]);
  const [creatorPartners, setCreatorPartners] = useState<CreatorPartner[]>([]);
  const [commentaryFeeds, setCommentaryFeeds] = useState<CommentaryAudioFeed[]>([]);
  const [passportTiers, setPassportTiers] = useState<SuperfanPassportTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [subscribingTier, setSubscribingTier] = useState<string | null>(null);
  const [registeredTiers, setRegisteredTiers] = useState<Record<string, boolean>>({});
  const [tierMessage, setTierMessage] = useState<Record<string, { ok: boolean; text: string }>>({});

  const isAdmin = user?.role === 'admin';

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.getGrowthCatalysts();
      setYouthSchools(res.youthSchools || []);
      setCreatorPartners(res.creatorPartners || []);
      setCommentaryFeeds(res.commentaryFeeds || []);
      setPassportTiers(res.passportTiers || []);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load this page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegisterInterest = async (tier: SuperfanPassportTier) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setSubscribingTier(tier.id);
    setTierMessage(prev => {
      const next = { ...prev };
      delete next[tier.id];
      return next;
    });
    try {
      const res = await api.subscribeSuperfanPassport(tier.id);
      if (res.success) {
        setRegisteredTiers(prev => ({ ...prev, [tier.id]: true }));
        if (res.tier && typeof res.tier.totalSubscribers === 'number') {
          setPassportTiers(prev => prev.map(t => (t.id === tier.id ? { ...t, totalSubscribers: res.tier.totalSubscribers } : t)));
        }
        setTierMessage(prev => ({
          ...prev,
          [tier.id]: {
            ok: true,
            text: res.alreadyRegistered ? "You've already registered interest in this tier." : "Thanks — we've noted your interest.",
          },
        }));
      }
    } catch (err: any) {
      setTierMessage(prev => ({ ...prev, [tier.id]: { ok: false, text: err?.message || 'Could not register interest.' } }));
    } finally {
      setSubscribingTier(null);
    }
  };

  const allEmpty = !youthSchools.length && !creatorPartners.length && !commentaryFeeds.length && !passportTiers.length;

  if (loading && allEmpty) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
        <span>Loading…</span>
      </div>
    );
  }

  const sections = [
    { id: 'gc-youth', label: 'Youth Cup', icon: GraduationCap, show: youthSchools.length > 0 },
    { id: 'gc-creators', label: 'Creators', icon: Video, show: creatorPartners.length > 0 },
    { id: 'gc-audio', label: 'Commentary', icon: Volume2, show: commentaryFeeds.length > 0 },
    { id: 'gc-passport', label: 'Superfan Passport', icon: CreditCard, show: passportTiers.length > 0 },
  ].filter(s => s.show);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-full overflow-x-hidden">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/40 border border-amber-500/30 p-5 sm:p-8">
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Community</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight font-display">
            Youth cricket, creators & <span className="bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">superfans</span>
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            School programmes, creator watch-alongs, commentary feeds and the Superfan Passport — listed here as they're announced.
          </p>
        </div>

        {sections.length > 1 && (
          <nav className="relative z-10 mt-6 -mx-5 px-5 sm:-mx-8 sm:px-8 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {sections.map(s => {
              const Icon = s.icon;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={e => {
                    e.preventDefault();
                    document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="shrink-0 min-h-[40px] flex items-center gap-2 px-4 rounded-xl font-bold text-sm whitespace-nowrap bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800"
                >
                  <Icon className="w-4 h-4 text-amber-400" />
                  <span>{s.label}</span>
                </a>
              );
            })}
          </nav>
        )}
      </div>

      {loadError && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>{loadError}</span>
          <button onClick={loadData} className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm">
            Try again
          </button>
        </div>
      )}

      {!loadError && allEmpty && (
        <div className="p-8 sm:p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-400/10 text-amber-400 border border-amber-400/30 flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7" />
          </div>
          <p className="text-slate-300 text-sm sm:text-base">Programmes and partners will be announced here.</p>
          {isAdmin && onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-amber-400 text-slate-950 font-black text-sm"
            >
              <Settings className="w-4 h-4" />
              Manage in Admin Console
            </button>
          )}
        </div>
      )}

      {!allEmpty && isAdmin && onOpenAdmin && (
        <div className="flex justify-end">
          <button
            onClick={onOpenAdmin}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm"
          >
            <Settings className="w-4 h-4 text-amber-400" />
            Manage in Admin Console
          </button>
        </div>
      )}

      {/* YOUTH CUP */}
      {youthSchools.length > 0 && (
        <section id="gc-youth" className="space-y-4 scroll-mt-24">
          <SectionHeader icon={<GraduationCap className="w-6 h-6 text-amber-400 shrink-0" />} title="Youth Cup schools" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {youthSchools.map(sch => (
              <div key={sch.id} className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {(hasText(sch.region) || hasText(sch.city)) && (
                    <span className="text-xs px-2 py-0.5 rounded font-bold bg-amber-400/15 text-amber-300 border border-amber-400/30">
                      {[sch.region, sch.city].filter(hasText).join(' · ')}
                    </span>
                  )}
                  <span
                    className={`text-xs font-bold ${
                      sch.status === 'champion' ? 'text-amber-400' : sch.status === 'bracket_qualified' ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    {sch.status === 'champion' ? 'Champions' : sch.status === 'bracket_qualified' ? 'Qualified' : 'Registered'}
                  </span>
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-white text-base break-words">{sch.name}</h4>
                  {hasText(sch.tapeBallTeam) && <p className="text-sm text-amber-400 font-semibold mt-0.5 break-words">{sch.tapeBallTeam}</p>}
                </div>
                {(positive(sch.studentsCount) || sch.equipmentKitGranted || positive(sch.matchdayTicketsAllocated)) && (
                  <dl className="pt-2 border-t border-slate-800/80 space-y-1.5 text-sm text-slate-400">
                    {positive(sch.studentsCount) && (
                      <div className="flex items-center justify-between gap-2">
                        <dt>Students</dt>
                        <dd className="font-bold text-white font-mono">{sch.studentsCount.toLocaleString()}</dd>
                      </div>
                    )}
                    {sch.equipmentKitGranted && (
                      <div className="flex items-center justify-between gap-2">
                        <dt>Equipment kit</dt>
                        <dd className="font-bold text-emerald-400">Granted</dd>
                      </div>
                    )}
                    {positive(sch.matchdayTicketsAllocated) && (
                      <div className="flex items-center justify-between gap-2">
                        <dt>Matchday tickets</dt>
                        <dd className="font-bold text-amber-400 font-mono">{sch.matchdayTicketsAllocated}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CREATORS */}
      {creatorPartners.length > 0 && (
        <section id="gc-creators" className="space-y-4 scroll-mt-24">
          <SectionHeader icon={<Video className="w-6 h-6 text-amber-400 shrink-0" />} title="Creator partners" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {creatorPartners.map(cr => (
              <div key={cr.id} className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between min-w-0">
                <div className="space-y-3 min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <CreatorAvatar creator={cr} />
                    <div className="min-w-0">
                      <h4 className="font-bold text-white text-base leading-tight break-words">{cr.name}</h4>
                      {hasText(cr.handle) && <span className="text-sm text-slate-400 block truncate">{cr.handle}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {hasText(cr.platform) && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-950 text-slate-300 border border-slate-800">{cr.platform}</span>
                    )}
                    {hasText(cr.followers) && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-400/10 text-amber-300 border border-amber-400/30">
                        {cr.followers} followers
                      </span>
                    )}
                    {cr.status === 'live' && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> Live
                      </span>
                    )}
                  </div>
                  {hasText(cr.specialty) && <p className="text-sm text-slate-300 leading-relaxed break-words">{cr.specialty}</p>}
                </div>
                {(hasText(cr.totalWatchViews) || isHttpUrl(cr.streamUrl)) && (
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    {hasText(cr.totalWatchViews) ? (
                      <div className="min-w-0">
                        <span className="text-xs text-slate-400 block">Views</span>
                        <span className="text-sm font-mono font-bold text-emerald-400">{cr.totalWatchViews}</span>
                      </div>
                    ) : (
                      <span />
                    )}
                    {isHttpUrl(cr.streamUrl) && (
                      <a
                        href={cr.streamUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] px-4 bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-white font-bold text-sm rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
                      >
                        <span>{cr.status === 'live' ? 'Watch live' : 'Visit channel'}</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* COMMENTARY */}
      {commentaryFeeds.length > 0 && (
        <section id="gc-audio" className="space-y-4 scroll-mt-24">
          <SectionHeader icon={<Volume2 className="w-6 h-6 text-amber-400 shrink-0" />} title="Commentary feeds" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {commentaryFeeds.map(feed => {
              const url = isHttpUrl(feed.streamUrl) ? feed.streamUrl.trim() : '';
              return (
                <div key={feed.id} className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-black text-white">
                      <Radio className="w-4 h-4 text-amber-400" />
                      {feed.language}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded border ${
                        feed.status === 'live'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      {feed.status === 'live' ? 'Live' : 'Off air'}
                    </span>
                  </div>
                  {hasText(feed.commentator) && <p className="text-sm text-slate-200 break-words">{feed.commentator}</p>}
                  {hasText(feed.description) && <p className="text-sm text-slate-400 break-words">{feed.description}</p>}
                  {(hasText(feed.bitrate) || positive(feed.listenersCount)) && (
                    <p className="text-xs text-slate-400 font-mono flex flex-wrap gap-x-3">
                      {hasText(feed.bitrate) && <span>{feed.bitrate}</span>}
                      {positive(feed.listenersCount) && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {feed.listenersCount.toLocaleString()} listening
                        </span>
                      )}
                    </p>
                  )}
                  {url ? (
                    isAudioStream(url) ? (
                      <audio controls preload="none" src={url} className="w-full" />
                    ) : (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 min-h-[44px] px-4 bg-amber-400 text-slate-950 font-black text-sm rounded-xl"
                      >
                        <Volume2 className="w-4 h-4" />
                        Listen
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )
                  ) : (
                    <p className="text-xs text-slate-500">Stream link not available yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SUPERFAN PASSPORT */}
      {passportTiers.length > 0 && (
        <section id="gc-passport" className="space-y-4 scroll-mt-24">
          <SectionHeader
            icon={<CreditCard className="w-6 h-6 text-amber-400 shrink-0" />}
            title="Superfan Passport"
            subtitle="Registering interest is free and doesn't commit you to anything — we'll let you know when sign-ups open."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {passportTiers.map(tier => {
              const perks: string[] = [];
              if (positive(tier.ticketDiscountPct)) perks.push(`${tier.ticketDiscountPct}% off match tickets`);
              if (tier.fanSpacePriorityEntry) perks.push('Priority entry at Fan Spaces');
              if (tier.doublePointsMultiplier) perks.push('Double contest points');
              if (hasText(tier.exclusiveBadge)) perks.push(`Profile badge: ${tier.exclusiveBadge}`);
              const fee = [positive(tier.annualFeeUsd) ? `$${tier.annualFeeUsd}` : '', positive(tier.annualFeeAed) ? `${tier.annualFeeAed} AED` : '']
                .filter(Boolean)
                .join(' / ');
              const registered = registeredTiers[tier.id];
              const msg = tierMessage[tier.id];
              return (
                <div key={tier.id} className="rounded-3xl bg-slate-900 border border-amber-500/30 p-5 sm:p-6 space-y-4 flex flex-col min-w-0">
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-xl font-black text-white font-display break-words">{tier.tierName}</h3>
                    {fee && <p className="text-sm font-mono font-bold text-amber-400">{fee} per year</p>}
                    {positive(tier.totalSubscribers) && (
                      <p className="text-xs text-slate-400">
                        {tier.totalSubscribers.toLocaleString()} {tier.totalSubscribers === 1 ? 'fan' : 'fans'} interested
                      </p>
                    )}
                  </div>
                  {hasText(tier.description) && <p className="text-sm text-slate-300 break-words">{tier.description}</p>}
                  {perks.length > 0 && (
                    <ul className="space-y-2">
                      {perks.map((p, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-slate-200">
                          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <span className="break-words min-w-0">{p}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-auto pt-2 space-y-2">
                    <button
                      onClick={() => handleRegisterInterest(tier)}
                      disabled={subscribingTier === tier.id || registered}
                      className="w-full min-h-[48px] bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-sm rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {subscribingTier === tier.id && <Loader2 className="w-4 h-4 animate-spin" />}
                      {registered ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" /> Interest registered
                        </>
                      ) : user ? (
                        'Register interest'
                      ) : (
                        'Sign in to register interest'
                      )}
                    </button>
                    {isHttpUrl(tier.signupUrl) && (
                      <a
                        href={tier.signupUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full min-h-[44px] bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"
                      >
                        Sign up
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

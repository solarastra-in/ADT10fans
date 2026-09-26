import React, { useState, useEffect } from 'react';
import { YouthCupSchool, CreatorPartner, CommentaryAudioFeed, SuperfanPassportTier, User } from '../types';
import { api } from '../api';
import { 
  GraduationCap, 
  Video, 
  Volume2, 
  CreditCard, 
  Sparkles, 
  Trophy, 
  Users, 
  Play, 
  CheckCircle2, 
  ExternalLink, 
  Award, 
  Radio, 
  Plus, 
  QrCode,
  ShieldCheck,
  Flame,
  Globe,
  Share2
} from 'lucide-react';

interface GrowthCatalystsViewProps {
  user: User | null;
  onOpenAuth: () => void;
  onOpenAdmin?: () => void;
}

export const GrowthCatalystsView: React.FC<GrowthCatalystsViewProps> = ({
  user,
  onOpenAuth,
  onOpenAdmin
}) => {
  const [activeTab, setActiveTab] = useState<'youth' | 'creators' | 'audio' | 'passport'>('youth');
  const [youthSchools, setYouthSchools] = useState<YouthCupSchool[]>([]);
  const [creatorPartners, setCreatorPartners] = useState<CreatorPartner[]>([]);
  const [commentaryFeeds, setCommentaryFeeds] = useState<CommentaryAudioFeed[]>([]);
  const [passportTiers, setPassportTiers] = useState<SuperfanPassportTier[]>([]);
  const [loading, setLoading] = useState(true);

  // Audio commentary playback simulation
  const [activeAudioLang, setActiveAudioLang] = useState<string>('Arabic');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // School registration modal
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [schoolCity, setSchoolCity] = useState('Abu Dhabi');
  const [schoolRegion, setSchoolRegion] = useState<'UAE' | 'UK'>('UAE');
  const [studentsCount, setStudentsCount] = useState(300);
  const [schoolTeam, setSchoolTeam] = useState('');
  const [schoolSubmitting, setSchoolSubmitting] = useState(false);
  const [schoolSuccessMsg, setSchoolSuccessMsg] = useState<string | null>(null);

  // Passport subscription state
  const [passportSubscribing, setPassportSubscribing] = useState(false);
  const [passportSuccess, setPassportSuccess] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.getGrowthCatalysts();
      setYouthSchools(res.youthSchools || []);
      setCreatorPartners(res.creatorPartners || []);
      setCommentaryFeeds(res.commentaryFeeds || []);
      setPassportTiers(res.passportTiers || []);
    } catch (e) {
      console.error('Failed to load growth catalysts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegisterSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName) return;
    setSchoolSubmitting(true);
    try {
      const res = await api.saveYouthSchool({
        name: schoolName,
        region: schoolRegion,
        city: schoolCity,
        studentsCount,
        tapeBallTeam: schoolTeam || `${schoolName} Tape-Ball XI`,
        status: 'registered',
        equipmentKitGranted: true,
        matchdayTicketsAllocated: 30
      });
      if (res.success) {
        setYouthSchools(res.youthSchools);
        setSchoolSuccessMsg(`Congratulations! ${schoolName} has been enrolled in the Grassroots Youth T10 Cup. Cricket kit & 30 matchday tickets dispatched.`);
        setTimeout(() => {
          setShowSchoolModal(false);
          setSchoolSuccessMsg(null);
          setSchoolName('');
          setSchoolTeam('');
        }, 3000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to register school');
    } finally {
      setSchoolSubmitting(false);
    }
  };

  const handleActivatePassport = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setPassportSubscribing(true);
    try {
      const res = await api.subscribeSuperfanPassport();
      if (res.success) {
        setPassportSuccess(true);
        if (passportTiers[0]) {
          setPassportTiers(prev => [{ ...prev[0], totalSubscribers: (prev[0].totalSubscribers || 38000) + 1 }]);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to activate passport');
    } finally {
      setPassportSubscribing(false);
    }
  };

  const currentAudio = commentaryFeeds.find(f => f.language === activeAudioLang) || commentaryFeeds[0];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/40 border border-amber-500/30 p-6 sm:p-10 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Activity 9: Next-Generation Fandom Catalysts</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight font-display">
              Youth Cup, Creator Studio & <span className="bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">Superfan Pass</span>
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Bridging grassroots youth cricket, 50+ global gaming/cricket streamers, multi-lingual real-time commentary in 5 languages, and the official Superfan Digital Passport.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:w-auto w-full">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 font-semibold block">Partner Schools</span>
              <span className="text-2xl font-black text-amber-400 font-mono">120+</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 font-semibold block">Creator Views</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">45M+</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-8 overflow-x-auto pb-2 no-scrollbar">
          {[
            { id: 'youth', label: 'Grassroots Youth T10 Cup', icon: GraduationCap, count: youthSchools.length },
            { id: 'creators', label: '50+ Influencer Creator Studio', icon: Video, count: creatorPartners.length },
            { id: 'audio', label: 'Multi-Lingual AI Audio Commentary', icon: Volume2, count: commentaryFeeds.length },
            { id: 'passport', label: 'Superfan Digital Passport', icon: CreditCard, count: passportTiers[0]?.totalSubscribers || '38K' },
          ].map(t => {
            const Icon = t.icon;
            const isSelected = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 scale-105'
                    : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? 'text-slate-950' : 'text-amber-400'}`} />
                <span>{t.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${
                  isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: GRASSROOTS YOUTH T10 CUP */}
      {activeTab === 'youth' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white font-display flex items-center gap-2">
                <GraduationCap className="w-6 h-6 text-amber-400" />
                Grassroots Youth T10 Cup (UAE & UK Schools)
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                10-over tape-ball tournaments across 120+ schools in the UAE and the UK. Free equipment starter kits, youth coaching clinics, and complimentary tickets to Zayed Cricket Stadium.
              </p>
            </div>
            <button
              onClick={() => setShowSchoolModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 whitespace-nowrap shrink-0 transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Enroll School / Academy</span>
            </button>
          </div>

          {/* School Directory Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {youthSchools.map(sch => (
              <div key={sch.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 hover:border-amber-400/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${
                    sch.region === 'UAE' ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}>
                    {sch.region} · {sch.city}
                  </span>
                  <span className={`text-[10px] font-bold ${
                    sch.status === 'champion' ? 'text-amber-400' : sch.status === 'bracket_qualified' ? 'text-emerald-400' : 'text-slate-400'
                  }`}>
                    {sch.status === 'champion' ? '🏆 Champions' : sch.status === 'bracket_qualified' ? '⚡ Qualified' : 'Registered'}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-white text-sm">{sch.name}</h4>
                  <p className="text-xs text-amber-400 font-semibold mt-0.5">{sch.tapeBallTeam}</p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
                  <div className="flex items-center justify-between">
                    <span>Students Engaged:</span>
                    <span className="font-bold text-white font-mono">{sch.studentsCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Kit Grant:</span>
                    <span className={`font-bold ${sch.equipmentKitGranted ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {sch.equipmentKitGranted ? 'Dispatched' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Stadium Passes:</span>
                    <span className="font-bold text-amber-400 font-mono">{sch.matchdayTicketsAllocated} tickets</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: INFLUENCER CREATOR STUDIO */}
      {activeTab === 'creators' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800">
            <h2 className="text-xl sm:text-2xl font-black text-white font-display flex items-center gap-2">
              <Video className="w-6 h-6 text-amber-400" />
              50+ Influencer Creator Studio & Live Watch-Alongs
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Official streaming partnerships with top gaming and cricket creators on YouTube, Twitch, Kick, and TikTok. Generating 45M+ cumulative watch-along impressions during the tournament cycle.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {creatorPartners.map(cr => (
              <div key={cr.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 hover:border-amber-400/40 transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <img src={cr.avatar} alt={cr.name} className="w-12 h-12 rounded-xl object-cover border border-amber-500/30" />
                    <div>
                      <h4 className="font-bold text-white text-base leading-tight">{cr.name}</h4>
                      <span className="text-xs text-slate-400 block">{cr.handle}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-950 text-slate-300 border border-slate-800">
                      {cr.platform}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/10 text-amber-300 border border-amber-400/30">
                      {cr.followers} Community
                    </span>
                    {cr.status === 'live' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Live Watch-Along
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {cr.specialty}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Watch Impressions</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">{cr.totalWatchViews}</span>
                  </div>
                  <a
                    href={cr.streamUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <span>Watch Stream</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: MULTI-LINGUAL AI AUDIO COMMENTARY */}
      {activeTab === 'audio' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800">
            <h2 className="text-xl sm:text-2xl font-black text-white font-display flex items-center gap-2">
              <Volume2 className="w-6 h-6 text-amber-400" />
              Real-Time Multi-Lingual Audio Commentary Player
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Real-time localized commentary feeds in Arabic, English, Hindi, Urdu, and Bengali. Instant sub-second broadcast synchronization so global fans listen in their native tongue.
            </p>
          </div>

          {/* Interactive Player Console */}
          <div className="rounded-3xl bg-slate-900 border border-amber-500/30 p-6 sm:p-8 space-y-6 shadow-2xl">
            {/* Language Switcher */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              {commentaryFeeds.map(feed => {
                const isSelected = feed.language === activeAudioLang;
                return (
                  <button
                    key={feed.id}
                    onClick={() => {
                      setActiveAudioLang(feed.language);
                      setIsPlayingAudio(true);
                    }}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                        : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    <Radio className={`w-3.5 h-3.5 ${isSelected ? 'text-slate-950 animate-pulse' : 'text-amber-400'}`} />
                    <span>{feed.language}</span>
                    <span className="text-[10px] opacity-80 font-mono">({feed.listenersCount.toLocaleString()})</span>
                  </button>
                );
              })}
            </div>

            {/* Current Channel Display */}
            {currentAudio && (
              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                        Live Audio Feed · {currentAudio.language}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white font-display">
                      Commentators: {currentAudio.commentator}
                    </h3>
                    <span className="text-xs text-slate-400 font-mono">
                      Stream Quality: {currentAudio.bitrate} · {currentAudio.listenersCount.toLocaleString()} active listeners
                    </span>
                  </div>

                  <button
                    onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                    className={`px-5 py-3 rounded-2xl font-black text-xs flex items-center gap-2 transition-all ${
                      isPlayingAudio
                        ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    <Volume2 className={`w-4 h-4 ${isPlayingAudio ? 'animate-bounce' : ''}`} />
                    <span>{isPlayingAudio ? 'Mute Commentary' : 'Play Live Audio Stream'}</span>
                  </button>
                </div>

                {/* Simulated Live Audio Waves & Live Transcript */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 space-y-2">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                    Live Broadcast Audio Transcript:
                  </span>
                  <p className="text-sm text-slate-200 font-medium italic leading-relaxed">
                    "{currentAudio.sampleAudioText}"
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SUPERFAN DIGITAL PASSPORT */}
      {activeTab === 'passport' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Passport Hologram Card (Left 6 cols) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="relative rounded-3xl bg-gradient-to-br from-amber-600 via-amber-500 to-amber-700 p-1 shadow-2xl overflow-hidden">
                <div className="rounded-[22px] bg-slate-950 p-6 sm:p-8 space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mt-12 -mr-12 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex items-center justify-between border-b border-amber-500/30 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-sm">
                        T10
                      </div>
                      <div>
                        <span className="text-xs font-black uppercase text-amber-300 tracking-wider block">
                          Official Digital Membership
                        </span>
                        <h3 className="text-base font-black text-white">
                          Abu Dhabi T10 Superfan Passport
                        </h3>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400 text-amber-300 font-black text-[10px] uppercase">
                      VIP Gold Tier
                    </span>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-400 text-[11px] block">Passport Holder</span>
                        <span className="text-white font-bold text-sm block mt-0.5">
                          {user?.name || 'SolarAstra Fan'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Member Since</span>
                        <span className="text-white font-mono font-bold text-sm block mt-0.5">
                          2026 Season
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-400 text-[11px] block">Supported Team</span>
                        <span className="text-amber-400 font-bold block mt-0.5">
                          Arabian Aces (AAC)
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">Membership Fee</span>
                        <span className="text-emerald-400 font-mono font-bold block mt-0.5">
                          $10 / 37 AED Annual
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Digital Fast-Pass Code</span>
                      <span className="text-sm font-black text-amber-400 font-mono tracking-widest">
                        ADT10-PASS-8849-GOLD
                      </span>
                    </div>
                    <QrCode className="w-10 h-10 text-amber-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Passport Perks & Activation (Right 6 cols) */}
            <div className="lg:col-span-6 space-y-6">
              <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 space-y-6">
                <div>
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                    Exclusive Superfan Privileges
                  </span>
                  <h3 className="text-2xl font-black text-white font-display mt-1">
                    Unlock 365-Day League Access
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1">
                    Purchased by 38,000+ fans worldwide, generating $380,000 in direct league funding.
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    '15% Off Official Matchday Tickets at Zayed Cricket Stadium',
                    'Priority Fast-Track Entry at all 5 Global Fan Clubhouses (Abu Dhabi, Dubai, London, Mumbai, Toronto)',
                    '2x Contest Points Multiplier across all match predictors & trivia',
                    'Exclusive Superfan Gold Passport badge on Discussion Forums',
                    'Invitations to Private AMA Video Calls with Franchise Captains & Coaches'
                  ].map((perk, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>{perk}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  {passportSuccess || user?.badges.includes('Superfan Gold Passport') ? (
                    <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>Superfan Digital Passport is Active on your Account!</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleActivatePassport}
                      disabled={passportSubscribing}
                      className="w-full py-4 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
                    >
                      {passportSubscribing ? 'Activating Passport...' : 'Claim / Activate Superfan Passport ($10 / 37 AED)'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* School Registration Modal */}
      {showSchoolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 relative shadow-2xl">
            <div>
              <h3 className="text-xl font-black text-white font-display">
                Enroll School / Academy in Youth T10 Cup
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Register your school team for 10-over tape-ball matches, kit grants, and stadium ticket passes.
              </p>
            </div>

            {schoolSuccessMsg ? (
              <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                {schoolSuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleRegisterSchool} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    School / Academy Name
                  </label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={e => setSchoolName(e.target.value)}
                    placeholder="e.g. Cranleigh Abu Dhabi"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Region</label>
                    <select
                      value={schoolRegion}
                      onChange={e => setSchoolRegion(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="UAE">United Arab Emirates</option>
                      <option value="UK">United Kingdom</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">City</label>
                    <input
                      type="text"
                      value={schoolCity}
                      onChange={e => setSchoolCity(e.target.value)}
                      placeholder="e.g. Abu Dhabi"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Team Moniker</label>
                    <input
                      type="text"
                      value={schoolTeam}
                      onChange={e => setSchoolTeam(e.target.value)}
                      placeholder="e.g. Cranleigh Strikers"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Student Participants</label>
                    <input
                      type="number"
                      value={studentsCount}
                      onChange={e => setStudentsCount(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSchoolModal(false)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={schoolSubmitting}
                    className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50"
                  >
                    {schoolSubmitting ? 'Registering...' : 'Register School'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  User, 
  Team, 
  SocialHandle, 
  FeedItem, 
  Match, 
  Contest, 
  PrizeDraw, 
  SystemSettings, 
  Approval, 
  AgentRun,
  NotificationItem
} from './types';
import { api, clearStoredToken } from './api';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { TeamPickerModal } from './components/TeamPickerModal';
import { LiveMatchTicker } from './components/LiveMatchTicker';
import { SocialCuratorWall } from './components/SocialCuratorWall';
import { TeamsView } from './components/TeamsView';
import { ContestsView } from './components/ContestsView';
import { PrizeDrawsView } from './components/PrizeDrawsView';
import { LeaderboardView } from './components/LeaderboardView';
import { AdminPortal } from './components/AdminPortal';
import { GeminiStudioModal } from './components/GeminiStudioModal';
import { UserProfileSection } from './components/UserProfileSection';
import { ForumView } from './components/ForumView';
import { LeagueProposalView } from './components/LeagueProposalView';
import { NotificationModal } from './components/NotificationModal';
import { requestFCMToken, registerForegroundPushListener } from './firebase';
import { 
  Flame, 
  Trophy, 
  Sparkles, 
  Gift, 
  Share2, 
  ArrowRight, 
  Calendar, 
  ShieldCheck, 
  Users, 
  Radio,
  Award,
  MessageSquare,
  FileText,
  Bell,
  X,
  CheckCircle2,
  Clock
} from 'lucide-react';

function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch {
    // Silent fallback
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [handles, setHandles] = useState<SocialHandle[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [draws, setDraws] = useState<PrizeDraw[]>([]);
  const [fanWars, setFanWars] = useState<any[]>([]);
  const [topFans, setTopFans] = useState<User[]>([]);

  // Notifications & FCM State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [selectedNotificationDetail, setSelectedNotificationDetail] = useState<NotificationItem | null>(null);
  const [fcmStatus, setFcmStatus] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [foregroundToast, setForegroundToast] = useState<NotificationItem | null>(null);

  // Admin Data
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    adminEmails: ['solarastra.in@gmail.com'],
    publicUserCountOverride: 18450,
    tickerText: '⚡ ABU DHABI T10 2026 LIVE · ARABIAN ACES VS DECCAN GLADIATORS · PREDICT & WIN VIP PASSES ⚡',
    curatorFeedId: '',
    curatorContainerId: 'curator-feed-default-feed-layout',
    curatorFeedUuid: '',
    curatorApiKey: '',
    curatorHashtags: 'AbuDhabiT10,ArabianAces,T10League',
    maxSocialPerPlatform: 5,
    smtp: {
      host: 'smtp.gmail.com',
      port: 587,
      user: '',
      pass: '',
      from: 'noreply@t10fanhub.com',
      enabled: false
    }
  });

  const [activeTab, setActiveTab] = useState<string>('home');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);
  const [geminiModalOpen, setGeminiModalOpen] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedWallTeamId, setSelectedWallTeamId] = useState<string | null>(null);

  // Check initial Notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setFcmStatus(Notification.permission as any);
    } else {
      setFcmStatus('unsupported');
    }
  }, []);

  // Setup Firebase Cloud Messaging Foreground Listener
  useEffect(() => {
    let cleanupListener: (() => void) | null = null;

    registerForegroundPushListener((payload) => {
      console.log('[APP] Foreground FCM Push Arrived:', payload);
      const newNotif: NotificationItem = {
        id: payload.data?.notificationId || 'fcm-' + Date.now(),
        title: payload.notification?.title || payload.data?.title || '⚡ Abu Dhabi T10 Alert',
        body: payload.notification?.body || payload.data?.body || 'New live update from the tournament.',
        category: (payload.data?.category as any) || 'announcement',
        targetAudience: 'all',
        createdAt: new Date().toISOString(),
        createdBy: 'FCM Push Engine',
        data: payload.data,
        read: false
      };

      setNotifications(prev => [newNotif, ...prev]);
      setUnreadNotificationsCount(c => c + 1);
      setForegroundToast(newNotif);
      playNotificationChime();

      setTimeout(() => {
        setForegroundToast(current => current?.id === newNotif.id ? null : current);
      }, 7000);
    }).then(unsub => {
      cleanupListener = unsub;
    });

    return () => {
      if (cleanupListener) cleanupListener();
    };
  }, []);

  // Periodic Polling for Real-Time Background Notifications (every 10s)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const notifsRes = await api.getNotifications().catch(() => null);
        if (notifsRes && Array.isArray(notifsRes.notifications)) {
          setNotifications(prev => {
            // Check if there is a brand new notification that wasn't in previous list
            if (prev.length > 0 && notifsRes.notifications.length > 0) {
              const latestNew = notifsRes.notifications[0];
              const isBrandNew = !prev.some(p => p.id === latestNew.id);
              if (isBrandNew) {
                setForegroundToast(latestNew);
                playNotificationChime();
                setTimeout(() => setForegroundToast(null), 7000);
              }
            }
            return notifsRes.notifications;
          });
          setUnreadNotificationsCount(notifsRes.unreadCount);
        }
      } catch (err) {
        // Silent poll error
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Sync selected team theme with backed team when user loads
  useEffect(() => {
    if (user?.teamId && !selectedWallTeamId) {
      setSelectedWallTeamId(user.teamId);
    }
  }, [user?.teamId]);

  // Request FCM Notification Permission
  const handleRequestFCMPermission = async () => {
    const res = await requestFCMToken();
    setFcmStatus(res.status);
    if (res.token) {
      await api.registerFCMToken(res.token, 'web_browser', navigator.userAgent).catch(() => {});
      // Refresh notifications list and count
      const notifsRes = await api.getNotifications().catch(() => null);
      if (notifsRes) {
        setNotifications(notifsRes.notifications);
        setUnreadNotificationsCount(notifsRes.unreadCount);
      }
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    setSelectedNotificationDetail(notif);
    if (!notif.read && user) {
      await api.markNotificationRead(notif.id).catch(() => {});
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      setUnreadNotificationsCount(c => Math.max(0, c - 1));
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (user) {
      await api.markAllNotificationsRead().catch(() => {});
    }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadNotificationsCount(0);
  };

  // Initial Data Fetch
  const loadData = async () => {
    try {
      const [
        meRes,
        teamsRes,
        handlesRes,
        feedsRes,
        matchesRes,
        contestsRes,
        drawsRes,
        leaderboardRes,
        notifsRes
      ] = await Promise.all([
        api.getMe().catch(() => ({ user: null })),
        api.getTeams().catch(() => ({ teams: [] })),
        api.getHandles().catch(() => ({ handles: [] })),
        api.getFeeds().catch(() => ({ items: [], countsByPlatform: {}, limitPerPlatform: 5, totalCurated: 0, totalAvailable: 0 })),
        api.getMatches().catch(() => ({ matches: [] })),
        api.getContests().catch(() => ({ contests: [], entries: [] })),
        api.getDraws().catch(() => ({ draws: [], entries: [] })),
        api.getLeaderboard().catch(() => ({ fanWars: [], topFans: [] })),
        api.getNotifications().catch(() => ({ notifications: [], unreadCount: 0, total: 0, fcmSubscribed: false }))
      ]);

      setUser(meRes.user);
      setTeams(teamsRes.teams);
      setHandles(handlesRes.handles);
      setFeedItems(feedsRes.items);
      setMatches(matchesRes.matches);
      setContests(contestsRes.contests);
      setDraws(drawsRes.draws);
      setFanWars(leaderboardRes.fanWars);
      setTopFans(leaderboardRes.topFans);

      if (notifsRes) {
        setNotifications(notifsRes.notifications);
        setUnreadNotificationsCount(notifsRes.unreadCount);
      }

      // If user is admin, fetch dashboard metadata
      if (meRes.user?.role === 'admin') {
        const dashRes = await api.getAdminDashboard().catch(() => null);
        if (dashRes) {
          setApprovals(dashRes.pendingApprovals || []);
          setAgentRuns(dashRes.agentRuns || []);
          if (dashRes.settings) setSettings(dashRes.settings);
        }
      }
    } catch (e) {
      console.error('Error loading data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogout = () => {
    clearStoredToken();
    setUser(null);
    if (activeTab === 'admin') setActiveTab('home');
  };

  const handleDailyCheckin = async () => {
    setCheckingIn(true);
    try {
      const res = await api.checkin();
      setUser(res.user);
      alert(`Daily Check-in Complete! +${res.pointsAdded} Fan Points Added.`);
    } catch (e: any) {
      alert(e?.message || 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleSelectTeam = async (teamId: string) => {
    setSelectedWallTeamId(teamId);
    if (!user) {
      setTeamPickerOpen(false);
      const team = teams.find(t => t.id === teamId);
      // Let guests enjoy dynamic theming even before sign in
      return;
    }
    try {
      const res = await api.selectTeam(teamId);
      setUser(res.user);
      setTeamPickerOpen(false);
      const team = teams.find(t => t.id === teamId);
      alert(`Success! You are now backing ${team?.name || 'your chosen franchise'} in Fan Wars! Dynamic theme applied.`);
      await loadData();
    } catch (e: any) {
      alert(e?.message || 'Error selecting team');
    }
  };

  const handleSimulateBall = async (matchId: string) => {
    try {
      const res = await api.simulateBall(matchId);
      setMatches(prev => prev.map(m => m.id === res.match.id ? res.match : m));
    } catch (e: any) {
      alert(e?.message);
    }
  };

  const userTeam = teams.find(t => t.id === user?.teamId) || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400 flex items-center justify-center animate-spin mb-4">
          <span className="text-amber-400 font-black text-xl">T10</span>
        </div>
        <p className="text-sm font-bold text-slate-300 tracking-wide">
          Initializing Abu Dhabi T10 Fan Hub & Agents...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      {/* Global Header */}
      <Header
        user={user}
        userTeam={userTeam}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenTeamPicker={() => setTeamPickerOpen(true)}
        onOpenAI={() => setGeminiModalOpen(true)}
        onLogout={handleLogout}
        tickerText={settings.tickerText}
        onDailyCheckin={handleDailyCheckin}
        checkingIn={checkingIn}
        onOpenNotifications={() => setNotificationModalOpen(true)}
        unreadNotificationsCount={unreadNotificationsCount}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        {/* ================= VIEW 1: HOME ================= */}
        {activeTab === 'home' && (
          <div className="space-y-10">
            {/* Hero Section */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950 border border-amber-500/30 p-6 sm:p-10 shadow-2xl shadow-amber-500/10">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-32 -mt-32"></div>

              <div className="relative z-10 max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-black uppercase tracking-wider mb-4">
                  <Flame className="w-3.5 h-3.5 fill-amber-400" />
                  <span>The Fastest Format in World Cricket · 90-Minute Spectacle</span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.08] mb-4">
                  Abu Dhabi <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500">T10 League</span> & Arabian Aces
                </h1>

                <p className="text-sm sm:text-base text-slate-300 mb-8 leading-relaxed">
                  Welcome to the autonomous league platform. Experience real-time social feeds curated from verified team handles, live ball-by-ball scorecards, Fantasy 10 leagues, and provably fair VIP prize draws.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setActiveTab('contests')}
                    className="px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
                  >
                    <Trophy className="w-4 h-4" />
                    <span>Enter Contests & Predictors</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('proposal')}
                    className="px-5 py-3 bg-gradient-to-r from-amber-500/20 via-amber-400/20 to-amber-600/10 hover:bg-amber-500/30 text-amber-300 font-black text-xs sm:text-sm rounded-xl border border-amber-400/50 flex items-center gap-2 transition-all shadow-md shadow-amber-500/10"
                    title="View the comprehensive ADT10 League Fan Base Expansion Proposal & Budget"
                  >
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>ADT10 League Proposal</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('forum')}
                    className="px-5 py-3 bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-xs sm:text-sm rounded-xl border border-slate-700 hover:border-amber-400/40 flex items-center gap-2 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 text-amber-400" />
                    <span>Discussion Forum</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('social')}
                    className="px-4 py-3 bg-slate-900/70 hover:bg-slate-800 text-slate-400 hover:text-white font-semibold text-xs sm:text-sm rounded-xl border border-slate-800 hover:border-slate-700 flex items-center gap-2 transition-colors"
                  >
                    <Share2 className="w-4 h-4 text-slate-400" />
                    <span>Social Hub</span>
                  </button>

                  {!user && (
                    <button
                      onClick={() => setAuthModalOpen(true)}
                      className="px-4 py-3 text-xs sm:text-sm text-slate-300 hover:text-white font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <span>Join Fan Arena</span>
                      <ArrowRight className="w-4 h-4 text-amber-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* Stats Bar */}
              <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-8 border-t border-slate-800/80">
                <div>
                  <span className="text-2xl font-black text-white font-mono">9</span>
                  <p className="text-xs text-slate-400 font-medium">Franchise Teams</p>
                </div>
                <div>
                  <span className="text-2xl font-black text-amber-400 font-mono">
                    {settings.publicUserCountOverride.toLocaleString()}
                  </span>
                  <p className="text-xs text-slate-400 font-medium">Registered Fans</p>
                </div>
                <div>
                  <span className="text-2xl font-black text-white font-mono">Top 5</span>
                  <p className="text-xs text-slate-400 font-medium">Curated / Platform</p>
                </div>
                <div>
                  <span className="text-2xl font-black text-emerald-400 font-mono">SHA-256</span>
                  <p className="text-xs text-slate-400 font-medium">Provably Fair Draws</p>
                </div>
              </div>
            </div>

            {/* Live Match Ticker */}
            <LiveMatchTicker
              matches={matches}
              teams={teams}
              onSimulateBall={handleSimulateBall}
            />

            {/* Curated Social Media Wall with Dynamic Team Theme Generation */}
            <SocialCuratorWall
              feedItems={feedItems}
              teams={teams}
              handles={handles}
              selectedTeamId={selectedWallTeamId}
              onSelectTeam={(tId) => setSelectedWallTeamId(tId)}
              onOpenTeamPicker={() => setTeamPickerOpen(true)}
              userTeamId={user?.teamId}
              limitPerPlatform={settings.maxSocialPerPlatform}
              title="Consolidated Team Social Wall"
              subtitle="Crawling verified public feeds, YouTube live broadcasts, and media across all franchises."
            />

            {/* Contests, Forum, Draws & League Proposal Teasers */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Contests Preview */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-amber-400/40 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" /> Active Challenges
                    </span>
                    <span className="text-xs text-emerald-400 font-bold">Points open</span>
                  </div>
                  <h3 className="text-lg font-black text-white mb-2">
                    Match Predictor & Fantasy 10
                  </h3>
                  <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                    Call match winners, boundary counts, and draft your 6-player squad under 55 credits to earn points for your franchise!
                  </p>
                </div>

                <button
                  onClick={() => setActiveTab('contests')}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-black rounded-xl border border-slate-700 flex items-center justify-center gap-2"
                >
                  <span>Play Predictor & Fantasy</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Fan Discussion Forum Preview */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-amber-400/40 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4" /> Fan Commons
                    </span>
                    <span className="text-xs text-amber-300 font-bold">+15 / +5 pts</span>
                  </div>
                  <h3 className="text-lg font-black text-white mb-2">
                    Discussion Forum
                  </h3>
                  <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                    Open new discussion threads, debate team selections, analyze boundary tactics, and join active conversations across all 9 franchises.
                  </p>
                </div>

                <button
                  onClick={() => setActiveTab('forum')}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-black rounded-xl border border-slate-700 flex items-center justify-center gap-2"
                >
                  <span>Join Live Discussions</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* VIP Prize Draw Preview */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-slate-900 border border-amber-500/30 flex flex-col justify-between hover:border-amber-400/50 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Gift className="w-4 h-4" /> VIP Grand Final Pass
                    </span>
                    <span className="text-xs text-amber-300 font-bold">Free Entry</span>
                  </div>
                  <h3 className="text-lg font-black text-white mb-2">
                    Win President Box Hospitality
                  </h3>
                  <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                    Experience the Abu Dhabi T10 Grand Final live from the VIP enclosure with dugout access and player meet-and-greets.
                  </p>
                </div>

                <button
                  onClick={() => setActiveTab('draws')}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  <span>Enter VIP Prize Draw</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* ADT10 League Proposal Preview */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-amber-500/30 hover:border-amber-400/60 flex flex-col justify-between transition-colors shadow-lg">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <FileText className="w-4 h-4" /> ADT10 Board Doc
                    </span>
                    <span className="text-xs text-emerald-400 font-bold">+108% ROI</span>
                  </div>
                  <h3 className="text-lg font-black text-white mb-2">
                    League Fan Base Proposal
                  </h3>
                  <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                    Turnkey expansion proposal with detailed USD/AED activity budgets, physical fan spaces across 5 global cities, and ROI projections.
                  </p>
                </div>

                <button
                  onClick={() => setActiveTab('proposal')}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Read Official Proposal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= VIEW 2: MATCHES & SCORES ================= */}
        {activeTab === 'matches' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Fixtures & Scorecards
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Abu Dhabi T10 Match Center
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Real-time ball-by-ball simulation, scorecards, and tournament standings.
                </p>
              </div>
            </div>

            <LiveMatchTicker
              matches={matches}
              teams={teams}
              onSimulateBall={handleSimulateBall}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matches.map(m => {
                const teamA = teams.find(t => t.id === m.teamA);
                const teamB = teams.find(t => t.id === m.teamB);

                return (
                  <div
                    key={m.id}
                    className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-400/50 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-xs font-bold text-slate-400">
                          Match #{m.matchNo} · {m.stage}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          m.status === 'live' ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {m.status}
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: teamA?.color }} />
                            <span className="font-bold text-sm text-white">{teamA?.name}</span>
                          </div>
                          <span className="font-mono font-bold text-sm text-slate-200">
                            {m.scoreA || 'Yet to bat'} {m.oversA ? `(${m.oversA} ov)` : ''}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: teamB?.color }} />
                            <span className="font-bold text-sm text-white">{teamB?.name}</span>
                          </div>
                          <span className="font-mono font-bold text-sm text-slate-200">
                            {m.scoreB || 'Yet to bat'} {m.oversB ? `(${m.oversB} ov)` : ''}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-400">
                        Venue: {m.venue}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                      <span className="text-amber-400 font-bold">
                        {m.result || 'Match in progress'}
                      </span>
                      <button
                        onClick={() => setActiveTab('contests')}
                        className="text-slate-300 hover:text-white font-bold"
                      >
                        Predict →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= VIEW 3: TEAMS & SQUADS ================= */}
        {activeTab === 'teams' && (
          <TeamsView
            teams={teams}
            handles={handles}
            feedItems={feedItems}
            user={user}
            onSelectTeam={handleSelectTeam}
          />
        )}

        {/* ================= VIEW 4: SOCIAL HUB ================= */}
        {activeTab === 'social' && (
          <div className="space-y-6">
            <SocialCuratorWall
              feedItems={feedItems}
              teams={teams}
              handles={handles}
              selectedTeamId={selectedWallTeamId}
              onSelectTeam={(tId) => setSelectedWallTeamId(tId)}
              onOpenTeamPicker={() => setTeamPickerOpen(true)}
              userTeamId={user?.teamId}
              limitPerPlatform={settings.maxSocialPerPlatform}
              title="Official Social Media Hub"
              subtitle="Real-time public postings, YouTube live streams, and verified announcements from Arabian Aces and all franchises."
            />
          </div>
        )}

        {/* ================= VIEW 5: CONTESTS & FANTASY ================= */}
        {activeTab === 'contests' && (
          <ContestsView
            contests={contests}
            teams={teams}
            user={user}
            onOpenAuth={() => setAuthModalOpen(true)}
            onEnterContest={api.enterContest}
            onSubmitFantasy={api.submitFantasy}
            onNavigateToProfile={() => setActiveTab('profile')}
          />
        )}

        {/* ================= VIEW 6: PRIZE DRAWS ================= */}
        {activeTab === 'draws' && (
          <PrizeDrawsView
            draws={draws}
            user={user}
            userTeam={userTeam}
            onOpenAuth={() => setAuthModalOpen(true)}
            onEnterDraw={api.enterDraw}
          />
        )}

        {/* ================= VIEW 7: LEADERBOARD / FAN WARS ================= */}
        {activeTab === 'leaderboard' && (
          <LeaderboardView
            fanWars={fanWars}
            topFans={topFans}
            user={user}
            onOpenTeamPicker={() => setTeamPickerOpen(true)}
          />
        )}

        {/* ================= VIEW 8: ADMIN PORTAL ================= */}
        {activeTab === 'admin' && (
          <AdminPortal
            teams={teams}
            handles={handles}
            feedItems={feedItems}
            matches={matches}
            contests={contests}
            draws={draws}
            settings={settings}
            approvals={approvals}
            agentRuns={agentRuns}
            notifications={notifications}
            onRefreshAll={loadData}
          />
        )}

        {/* ================= VIEW 9: USER PROFILE & BADGES ================= */}
        {activeTab === 'profile' && (
          user ? (
            <UserProfileSection
              user={user}
              teams={teams}
              onOpenTeamPicker={() => setTeamPickerOpen(true)}
              onNavigateToTab={setActiveTab}
              onUserUpdated={(updated) => setUser(updated)}
              onDailyCheckin={handleDailyCheckin}
              checkingIn={checkingIn}
            />
          ) : (
            <div className="p-8 sm:p-12 rounded-3xl bg-slate-900 border border-amber-500/30 text-center max-w-xl mx-auto space-y-4 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-amber-400/10 text-amber-400 border border-amber-400/30 flex items-center justify-center mx-auto">
                <Trophy className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-white">Fan Trophy Room & Achievements</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sign in with Google or Email OTP to track your contest wins, maintain your daily check-in streak, review your fantasy league performance, and unlock metallic achievement badges!
              </p>
              <button
                onClick={() => setAuthModalOpen(true)}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20"
              >
                Sign In / Join Fan Arena
              </button>
            </div>
          )
        )}

        {/* ================= VIEW 10: DISCUSSION FORUM ================= */}
        {activeTab === 'forum' && (
          <ForumView
            user={user}
            teams={teams}
            onOpenAuth={() => setAuthModalOpen(true)}
            onUserPointsAwarded={(newPoints) => {
              setUser(prev => prev ? { ...prev, points: newPoints } : null);
            }}
            onNavigateToProposal={() => setActiveTab('proposal')}
          />
        )}

        {/* ================= VIEW 11: LEAGUE PROPOSAL ================= */}
        {activeTab === 'proposal' && (
          <LeagueProposalView
            onNavigateToForum={() => setActiveTab('forum')}
            onNavigateToContests={() => setActiveTab('contests')}
            onNavigateToSocial={() => setActiveTab('social')}
            onNavigateToDraws={() => setActiveTab('draws')}
          />
        )}
      </main>

      {/* Global Modals */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(loggedUser) => {
          setUser(loggedUser);
          loadData();
        }}
      />

      <TeamPickerModal
        isOpen={teamPickerOpen}
        onClose={() => setTeamPickerOpen(false)}
        teams={teams}
        user={user}
        onSelectTeam={handleSelectTeam}
      />

      {/* Gemini AI Intelligence Studio Modal */}
      <GeminiStudioModal
        isOpen={geminiModalOpen}
        onClose={() => setGeminiModalOpen(false)}
      />

      {/* Real-Time FCM Notification Center Drawer & Details */}
      <NotificationModal
        isOpen={notificationModalOpen}
        onClose={() => setNotificationModalOpen(false)}
        notifications={notifications}
        unreadCount={unreadNotificationsCount}
        fcmStatus={fcmStatus}
        onRequestPermission={handleRequestFCMPermission}
        onNotificationClick={handleNotificationClick}
        onMarkAllRead={handleMarkAllNotificationsRead}
        selectedNotification={selectedNotificationDetail}
        onCloseDetail={() => setSelectedNotificationDetail(null)}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setNotificationModalOpen(false);
          setSelectedNotificationDetail(null);
        }}
      />

      {/* Foreground Real-Time Alert Toast (when new match result or contest deadline arrives) */}
      {foregroundToast && (
        <div className="fixed top-20 right-4 z-50 max-w-sm w-full bg-slate-900 border border-amber-400 rounded-2xl shadow-2xl p-4 text-xs flex items-start justify-between gap-3 shadow-amber-500/20 backdrop-blur-md animate-fade-in">
          <div 
            className="flex-1 cursor-pointer"
            onClick={() => {
              handleNotificationClick(foregroundToast);
              setForegroundToast(null);
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="font-black text-amber-400 uppercase text-[10px] tracking-wider">
                {foregroundToast.category === 'match_result' ? '🏆 Live Match Result' : foregroundToast.category === 'contest_deadline' ? '⏳ Contest Deadline Alert' : '⚡ Hub Alert'}
              </span>
            </div>
            <h4 className="font-extrabold text-white leading-snug">
              {foregroundToast.title}
            </h4>
            <p className="text-slate-300 text-[11px] mt-0.5 line-clamp-2">
              {foregroundToast.body}
            </p>
            <span className="text-[10px] text-amber-300 font-bold block mt-1.5 hover:underline">
              Tap to view full scorecard & event details →
            </span>
          </div>
          <button
            onClick={() => setForegroundToast(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Floating AI Strategist & Studio Trigger */}
      <button
        onClick={() => setGeminiModalOpen(true)}
        className="fixed bottom-6 right-6 z-40 px-4 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-2xl shadow-2xl shadow-amber-500/30 font-black text-xs flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 border border-amber-300 select-none"
        title="Open Gemini AI Chatbot, Search Grounding, Voice & Media Studio"
      >
        <Sparkles className="w-4 h-4 fill-slate-950" />
        <span className="hidden sm:inline">AI Strategist & Studio</span>
      </button>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-black text-amber-400 tracking-tight">ABU DHABI T10</span>
            <span>·</span>
            <span>Arabian Aces Franchise & League Platform</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => setActiveTab('forum')}
              className="hover:text-slate-300 transition-colors"
            >
              Discussion Forum
            </button>
            <button
              onClick={() => setActiveTab('proposal')}
              className="text-amber-400 font-bold hover:text-amber-300 transition-colors"
            >
              ADT10 League Proposal
            </button>
            <button
              onClick={() => setActiveTab('social')}
              className="hover:text-slate-300 transition-colors"
            >
              Social Directory
            </button>
            <button
              onClick={() => setActiveTab('contests')}
              className="hover:text-slate-300 transition-colors"
            >
              Fan Rules
            </button>
            <button
              onClick={() => {
                if (user?.role === 'admin') setActiveTab('admin');
                else setAuthModalOpen(true);
              }}
              className="text-amber-400/70 hover:text-amber-300 font-semibold transition-colors"
            >
              Admin Portal
            </button>
          </div>

          <p className="text-[11px] text-slate-600">
            Powered by Autonomous AI Studio Agents & Gemini 3.8 Flash
          </p>
        </div>
      </footer>
    </div>
  );
}

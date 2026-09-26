import React, { useState, useEffect } from 'react';
import { 
  Team, 
  SocialHandle, 
  FeedItem, 
  Match, 
  Contest, 
  PrizeDraw, 
  Approval, 
  AgentRun, 
  SystemSettings,
  NotificationItem,
  FCMDeviceToken,
  FanSpace,
  FanSpaceBooking,
  YouthCupSchool,
  CreatorPartner,
  CommentaryAudioFeed,
  SuperfanPassportTier,
  ProposalSettings,
  ProposalActivity
} from '../types';
import { api } from '../api';
import { 
  ShieldCheck, 
  SlidersHorizontal, 
  Share2, 
  Trophy, 
  Bot, 
  CheckCircle2, 
  CheckCircle,
  XCircle, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Edit3, 
  Sparkles, 
  Mail, 
  Play, 
  ExternalLink, 
  Pin, 
  EyeOff, 
  Eye, 
  Radio, 
  Settings,
  Gift,
  Bell,
  Send,
  Clock,
  Code2,
  Copy,
  Smartphone,
  Info,
  X,
  FileText,
  DollarSign,
  Globe,
  GraduationCap,
  Video,
  Volume2,
  CreditCard,
  MapPin,
  TrendingUp,
  RotateCcw,
  Check
} from 'lucide-react';

interface AdminPortalProps {
  teams: Team[];
  handles: SocialHandle[];
  feedItems: FeedItem[];
  matches: Match[];
  contests: Contest[];
  draws: PrizeDraw[];
  settings: SystemSettings;
  approvals: Approval[];
  agentRuns: AgentRun[];
  notifications?: NotificationItem[];
  onRefreshAll: () => Promise<void>;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  teams,
  handles,
  feedItems,
  matches,
  contests,
  draws,
  settings,
  approvals,
  agentRuns,
  notifications: initialNotifications = [],
  onRefreshAll,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'notifications' | 'proposal' | 'fanspaces' | 'growth' | 'contests' | 'feeds' | 'teams' | 'agents' | 'approvals' | 'matches' | 'draws' | 'marketing' | 'settings'>('overview');

  // Proposal & Financial Budget State
  const [proposalSettings, setProposalSettings] = useState<ProposalSettings | null>(null);
  const [savingProposal, setSavingProposal] = useState(false);
  const [proposalStatusMsg, setProposalStatusMsg] = useState<string | null>(null);

  // Fan Spaces State
  const [spacesList, setSpacesList] = useState<FanSpace[]>([]);
  const [spaceBookingsList, setSpaceBookingsList] = useState<FanSpaceBooking[]>([]);
  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [editingSpace, setEditingSpace] = useState<FanSpace | null>(null);
  const [spaceForm, setSpaceForm] = useState<Partial<FanSpace>>({
    name: '',
    city: '',
    country: '',
    tagline: '',
    location: '',
    capacity: 500,
    status: 'active',
    vipPassPriceUsd: 50,
    vipPassPriceAed: 185,
    openHours: 'Daily 12:00 PM – 02:00 AM',
    liveMatchSchedule: 'Screening all 34 matches live with stadium acoustic audio',
    image: 'https://images.unsplash.com/photo-1512958789358-4dacacbe09c3?q=80&w=1200&auto=format&fit=crop',
    features: ['360° LED Match Screens', 'VR Batting Simulator', 'Merch Boutique'],
    amenities: ['Valet Parking', 'Fast Wi-Fi', 'Artisanal Bar'],
    vipPerks: ['Reserved lounge seating', 'Complimentary beverages'],
    merchBoutique: 'Official franchise jerseys & caps',
    menuHighlights: 'Gourmet sliders & Karak chai'
  });

  // Growth Catalysts State
  const [youthSchoolsList, setYouthSchoolsList] = useState<YouthCupSchool[]>([]);
  const [creatorPartnersList, setCreatorPartnersList] = useState<CreatorPartner[]>([]);
  const [commentaryFeedsList, setCommentaryFeedsList] = useState<CommentaryAudioFeed[]>([]);
  const [passportTiersList, setPassportTiersList] = useState<SuperfanPassportTier[]>([]);
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [schoolForm, setSchoolForm] = useState<Partial<YouthCupSchool>>({
    name: '',
    region: 'UAE',
    city: 'Abu Dhabi',
    studentsCount: 250,
    tapeBallTeam: '',
    status: 'registered',
    equipmentKitGranted: true,
    matchdayTicketsAllocated: 30
  });
  const [showCreatorModal, setShowCreatorModal] = useState(false);
  const [creatorForm, setCreatorForm] = useState<Partial<CreatorPartner>>({
    name: '',
    handle: '@',
    platform: 'YouTube',
    followers: '500K',
    streamUrl: 'https://youtube.com',
    specialty: 'Matchday Reactions & Watch-Along',
    status: 'partnered',
    totalWatchViews: '2.5M',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop'
  });

  // Contests Admin State
  const [contestsList, setContestsList] = useState<Contest[]>(contests);
  const [settlingContest, setSettlingContest] = useState<Contest | null>(null);
  const [settleAnswersMap, setSettleAnswersMap] = useState<Record<string, string>>({});
  const [settlingSubmitting, setSettlingSubmitting] = useState(false);
  const [showAddContestModal, setShowAddContestModal] = useState(false);
  const [newContestTitle, setNewContestTitle] = useState('');
  const [newContestType, setNewContestType] = useState<'predictor' | 'sixes' | 'trivia' | 'season'>('predictor');
  const [newContestPrize, setNewContestPrize] = useState('VIP Hospitality Passes + 100 Points');
  const [newContestMatchId, setNewContestMatchId] = useState(matches[0]?.id || '');
  const [newContestPrompt, setNewContestPrompt] = useState('Which team will hit the longest six?');
  const [newContestOptions, setNewContestOptions] = useState('Arabian Aces, Deccan Gladiators, Equal');
  const [newContestPoints, setNewContestPoints] = useState(50);

  // Notifications & FCM State
  const [notificationsList, setNotificationsList] = useState<NotificationItem[]>(initialNotifications);
  const [fcmTokensList, setFcmTokensList] = useState<FCMDeviceToken[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [sendingPush, setSendingPush] = useState(false);
  const [pushStatusMsg, setPushStatusMsg] = useState<string | null>(null);

  // Custom Push Composer Form State
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [pushCategory, setPushCategory] = useState<'match_result' | 'contest_deadline' | 'announcement' | 'perk'>('announcement');
  const [pushAudience, setPushAudience] = useState<'all' | 'logged_in' | 'team'>('all');
  const [pushTeamId, setPushTeamId] = useState<string>('aces');
  const [pushUrl, setPushUrl] = useState('/');
  const [pushPriority, setPushPriority] = useState<'normal' | 'high'>('high');

  // Quick Triggers State
  const [selectedMatchForAlert, setSelectedMatchForAlert] = useState<string>(matches[0]?.id || '');
  const [selectedContestForAlert, setSelectedContestForAlert] = useState<string>(contests[0]?.id || '');
  const [contestMinutesBefore, setContestMinutesBefore] = useState<number>(15);

  // Notification Details Inspector Modal
  const [inspectingNotif, setInspectingNotif] = useState<NotificationItem | null>(null);
  const [inspectingDetails, setInspectingDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  // Load notifications and FCM subscriber tokens
  const refreshNotificationsData = async () => {
    setLoadingNotifs(true);
    try {
      const [notifsRes, tokensRes] = await Promise.all([
        api.getNotifications().catch(() => ({ notifications: [] })),
        api.getFCMTokens().catch(() => ({ tokens: [] }))
      ]);
      setNotificationsList(notifsRes.notifications);
      setFcmTokensList(tokensRes.tokens);
    } catch (e) {
      console.warn('Could not load notifications:', e);
    } finally {
      setLoadingNotifs(false);
    }
  };

  const loadAllAdminAdditions = async () => {
    try {
      const [propRes, spacesRes, growthRes, contestsRes, bookingsRes] = await Promise.all([
        api.getProposalSettings().catch(() => ({ proposalSettings: null })),
        api.getFanSpaces().catch(() => ({ spaces: [] })),
        api.getGrowthCatalysts().catch(() => ({ youthSchools: [], creatorPartners: [], commentaryFeeds: [], passportTiers: [] })),
        api.getContests().catch(() => ({ contests: [] })),
        api.getAdminFanSpaceBookings().catch(() => ({ bookings: [] }))
      ]);
      if (propRes.proposalSettings) setProposalSettings(propRes.proposalSettings);
      if (spacesRes.spaces) setSpacesList(spacesRes.spaces);
      if (growthRes.youthSchools) setYouthSchoolsList(growthRes.youthSchools);
      if (growthRes.creatorPartners) setCreatorPartnersList(growthRes.creatorPartners);
      if (growthRes.commentaryFeeds) setCommentaryFeedsList(growthRes.commentaryFeeds);
      if (growthRes.passportTiers) setPassportTiersList(growthRes.passportTiers);
      if (contestsRes.contests) setContestsList(contestsRes.contests);
      if (bookingsRes.bookings) setSpaceBookingsList(bookingsRes.bookings);
    } catch (e) {
      console.warn('Failed to load additions:', e);
    }
  };

  useEffect(() => {
    refreshNotificationsData();
    loadAllAdminAdditions();
  }, []);

  // Agent execution state
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [agentMsg, setAgentMsg] = useState<string | null>(null);

  // Announced Teams & Handle Search Engine State
  const [seedingTeams, setSeedingTeams] = useState(false);
  const [seedResultMsg, setSeedResultMsg] = useState<string | null>(null);
  const [teamHandleFilter, setTeamHandleFilter] = useState<string>('all');
  const [syncingRealFeeds, setSyncingRealFeeds] = useState(false);
  const [realFeedSyncMsg, setRealFeedSyncMsg] = useState<string | null>(null);

  const handleSyncRealFeeds = async () => {
    setSyncingRealFeeds(true);
    setRealFeedSyncMsg('Ingesting authentic live posts, YouTube match highlights, and Google News releases from official handles...');
    try {
      const res = await api.syncRealFeeds();
      await onRefreshAll();
      setRealFeedSyncMsg(`✓ ${res.summary}`);
      setTimeout(() => setRealFeedSyncMsg(null), 6000);
    } catch (err: any) {
      setRealFeedSyncMsg('Sync error: ' + (err?.message || 'Failed to sync real feeds'));
    } finally {
      setSyncingRealFeeds(false);
    }
  };

  const handleSeedAnnouncedTeamsAndSearch = async () => {
    setSeedingTeams(true);
    setSeedResultMsg('Searching Google & Social Platforms for UAE Bulls, United Tigers, Yas Lions, Arabian Aces, Emirates Eagles, Desert Royal Champions...');
    try {
      const res = await api.seedAnnouncedTeamsAndSearch();
      await onRefreshAll();
      setSeedResultMsg(res.summary);
    } catch (err: any) {
      setSeedResultMsg('Failed to seed announced teams and search handles: ' + (err?.message || 'Unknown error'));
    } finally {
      setSeedingTeams(false);
    }
  };

  // New Handle Form State
  const [handlePlatform, setHandlePlatform] = useState<'X' | 'Instagram' | 'Threads' | 'Facebook' | 'TikTok' | 'LinkedIn' | 'YouTube'>('X');
  const [handleTeamId, setHandleTeamId] = useState<string>('aces');
  const [handleUrl, setHandleUrl] = useState<string>('');
  const [handleUsername, setHandleUsername] = useState<string>('');

  // New Team Form State
  const [teamName, setTeamName] = useState('');
  const [teamShort, setTeamShort] = useState('');
  const [teamColor, setTeamColor] = useState('#E8B04A');
  const [teamIcon, setTeamIcon] = useState('');
  const [teamCoach, setTeamCoach] = useState('');
  const [teamWebsite, setTeamWebsite] = useState('');

  // New Feed Item Form State
  const [showAddFeedModal, setShowAddFeedModal] = useState(false);
  const [newFeedTitle, setNewFeedTitle] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedPlatform, setNewFeedPlatform] = useState<any>('X');
  const [newFeedTeam, setNewFeedTeam] = useState<string>('aces');
  const [newFeedKind, setNewFeedKind] = useState<any>('post');
  const [newFeedSummary, setNewFeedSummary] = useState('');

  // AI Marketing Generator State
  const [marketingPrompt, setMarketingPrompt] = useState('Create an electrifying match preview and fan prediction campaign for Arabian Aces vs Deccan Gladiators at Zayed Cricket Stadium.');
  const [marketingTeam, setMarketingTeam] = useState('Arabian Aces');
  const [marketingResult, setMarketingResult] = useState<string | null>(null);
  const [generatingMarketing, setGeneratingMarketing] = useState(false);

  // Settings State
  const [settingsForm, setSettingsForm] = useState<SystemSettings>({ ...settings });
  const [savingSettings, setSavingSettings] = useState(false);

  // Quick Pre-Fill Templates
  const handleLoadTemplate = (templateType: 'match' | 'deadline' | 'giveaway' | 'news') => {
    if (templateType === 'match') {
      const match = matches.find(m => m.id === selectedMatchForAlert) || matches[0];
      const teamA = teams.find(t => t.id === match?.teamA);
      const teamB = teams.find(t => t.id === match?.teamB);
      const winner = teams.find(t => t.id === match?.winner);
      setPushTitle(`🏆 MATCH RESULT: ${winner?.name || 'Arabian Aces'} victorious at Zayed Stadium!`);
      setPushBody(`Final scorecard: ${teamA?.short} ${match?.scoreA || '138/2'} vs ${teamB?.short} ${match?.scoreB || '120/5'}. ${match?.result || 'Arabian Aces won by 18 runs!'}`);
      setPushCategory('match_result');
      setPushAudience('all');
      setPushUrl('/matches');
      setPushPriority('high');
    } else if (templateType === 'deadline') {
      const contest = contests.find(c => c.id === selectedContestForAlert) || contests[0];
      setPushTitle(`⏳ CONTEST DEADLINE: "${contest?.title || 'Sixes Frenzy'}" locks in ${contestMinutesBefore} minutes!`);
      setPushBody(`Don't miss out on winning: ${contest?.prize || 'VIP Hospitality passes'}. Submit your prediction answers now!`);
      setPushCategory('contest_deadline');
      setPushAudience('logged_in');
      setPushUrl('/contests');
      setPushPriority('high');
    } else if (templateType === 'giveaway') {
      const draw = draws[0];
      setPushTitle(`🎁 VIP DRAW ALERT: ${draw?.title || 'Grand Final VIP Passes'} is now open!`);
      setPushBody(`Provably fair draw open to all registered fans. Prize: ${draw?.prize || 'VIP Passes'}. Click to enter with 1 click!`);
      setPushCategory('perk');
      setPushAudience('logged_in');
      setPushUrl('/draws');
      setPushPriority('high');
    } else {
      setPushTitle(`⚡ BREAKING: Lance Klusener announces Arabian Aces starting XI`);
      setPushBody(`Powerhouse batting lineup confirmed for tonight's clash against Deccan Gladiators at Zayed Cricket Stadium.`);
      setPushCategory('announcement');
      setPushAudience('all');
      setPushUrl('/social');
      setPushPriority('normal');
    }
  };

  // Dispatch Custom Push Notification
  const handleSendCustomPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushTitle.trim() || !pushBody.trim()) {
      alert('Please fill both notification title and body');
      return;
    }
    setSendingPush(true);
    setPushStatusMsg(null);
    try {
      const res = await api.sendPushNotification({
        title: pushTitle.trim(),
        body: pushBody.trim(),
        category: pushCategory,
        targetAudience: pushAudience,
        teamId: pushAudience === 'team' ? pushTeamId : null,
        url: pushUrl,
        priority: pushPriority
      });
      setPushStatusMsg(`✓ Dispatched: "${res.notification.title}" to ${res.notification.fcmSuccessCount} subscribers!`);
      setPushTitle('');
      setPushBody('');
      await refreshNotificationsData();
    } catch (err: any) {
      setPushStatusMsg(`✗ Error dispatching: ${err?.message}`);
    } finally {
      setSendingPush(false);
    }
  };

  // Trigger One-Click Match Result Alert
  const handleTriggerMatchResult = async () => {
    if (!selectedMatchForAlert) {
      alert('Please select a match first');
      return;
    }
    setSendingPush(true);
    setPushStatusMsg(null);
    try {
      const res = await api.triggerMatchResult(selectedMatchForAlert);
      setPushStatusMsg(`✓ Pushed Match Result Alert: "${res.notification.title}"`);
      await refreshNotificationsData();
    } catch (err: any) {
      setPushStatusMsg(`✗ Error: ${err?.message}`);
    } finally {
      setSendingPush(false);
    }
  };

  // Trigger One-Click Contest Deadline Alert
  const handleTriggerContestDeadline = async () => {
    if (!selectedContestForAlert) {
      alert('Please select a contest first');
      return;
    }
    setSendingPush(true);
    setPushStatusMsg(null);
    try {
      const res = await api.triggerContestDeadline(selectedContestForAlert, contestMinutesBefore);
      setPushStatusMsg(`✓ Pushed Contest Deadline Alert: "${res.notification.title}"`);
      await refreshNotificationsData();
    } catch (err: any) {
      setPushStatusMsg(`✗ Error: ${err?.message}`);
    } finally {
      setSendingPush(false);
    }
  };

  // Inspect Notification Details & API
  const handleInspectNotification = async (notif: NotificationItem) => {
    setInspectingNotif(notif);
    setLoadingDetails(true);
    try {
      const res = await api.getNotificationDetails(notif.id);
      setInspectingDetails(res);
    } catch (e: any) {
      setInspectingDetails({ error: e?.message, notification: notif });
    } finally {
      setLoadingDetails(false);
    }
  };

  // Run Agent Helper
  const handleRunAgent = async (name: string) => {
    setRunningAgent(name);
    setAgentMsg(null);
    try {
      const res = await api.runAgent(name);
      setAgentMsg(`✓ ${name.toUpperCase()} Agent: ${res.result?.summary || 'Completed successfully'}`);
      await onRefreshAll();
    } catch (e: any) {
      setAgentMsg(`✗ Error running ${name}: ${e?.message}`);
    } finally {
      setRunningAgent(null);
    }
  };

  // Run All Agents Sequentially
  const handleRunAllAgents = async () => {
    setRunningAgent('all');
    setAgentMsg(null);
    try {
      await api.runAgent('discovery');
      await api.runAgent('social');
      await api.runAgent('news');
      await api.runAgent('scores');
      await api.runAgent('content');
      await api.runAgent('ops');
      setAgentMsg('✓ All 6 autonomous agents executed successfully.');
      await onRefreshAll();
    } catch (e: any) {
      setAgentMsg(`✗ Agent execution issue: ${e?.message}`);
    } finally {
      setRunningAgent(null);
    }
  };

  // Add Handle Helper
  const handleAddHandleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handleUrl) return;
    try {
      await api.saveHandle({
        platform: handlePlatform,
        teamId: handleTeamId || null,
        url: handleUrl,
        handle: handleUsername || ('@' + handleUrl.split('/').pop()),
        status: 'verified'
      });
      setHandleUrl('');
      setHandleUsername('');
      await onRefreshAll();
      alert('Social handle verified and added!');
    } catch (e: any) {
      alert(e?.message || 'Error saving handle');
    }
  };

  // Delete Handle Helper
  const handleDeleteHandle = async (id: string) => {
    if (!confirm('Are you sure you want to delete this social handle?')) return;
    try {
      await api.deleteHandle(id);
      await onRefreshAll();
    } catch (e: any) {
      alert(e?.message);
    }
  };

  // Add Team Helper
  const handleAddTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName || !teamShort) return;
    try {
      await api.saveTeam({
        name: teamName,
        short: teamShort.toUpperCase(),
        color: teamColor,
        iconPlayer: teamIcon || 'TBD',
        headCoach: teamCoach,
        website: teamWebsite,
        home: 'Zayed Cricket Stadium, Abu Dhabi'
      });
      setTeamName('');
      setTeamShort('');
      setTeamIcon('');
      setTeamCoach('');
      setTeamWebsite('');
      await onRefreshAll();
      alert('Franchise team added!');
    } catch (e: any) {
      alert(e?.message);
    }
  };

  // Delete Team Helper
  const handleDeleteTeam = async (id: string) => {
    if (!confirm('Are you sure you want to delete this franchise?')) return;
    try {
      await api.deleteTeam(id);
      await onRefreshAll();
    } catch (e: any) {
      alert(e?.message);
    }
  };

  // Toggle Feed Item Status (Live vs Hidden vs Pinned)
  const handleToggleFeedStatus = async (item: FeedItem, newStatus: 'live' | 'hidden' | 'pinned') => {
    try {
      await api.saveFeedItem({
        id: item.id,
        status: newStatus
      });
      await onRefreshAll();
    } catch (e: any) {
      alert(e?.message);
    }
  };

  const handleDeleteFeedItem = async (id: string) => {
    if (!confirm('Delete this feed post from curator?')) return;
    try {
      await api.deleteFeedItem(id);
      await onRefreshAll();
    } catch (e: any) {
      alert(e?.message);
    }
  };

  // Add Manual Feed Item
  const handleAddFeedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedTitle || !newFeedUrl) return;
    try {
      await api.saveFeedItem({
        title: newFeedTitle,
        url: newFeedUrl,
        platform: newFeedPlatform,
        teamId: newFeedTeam || null,
        kind: newFeedKind,
        summary: newFeedSummary,
        status: 'live'
      });
      setShowAddFeedModal(false);
      setNewFeedTitle('');
      setNewFeedUrl('');
      setNewFeedSummary('');
      await onRefreshAll();
    } catch (e: any) {
      alert(e?.message);
    }
  };

  // Execute Draw
  const handleExecuteDraw = async (drawId: string) => {
    if (!confirm('Run provably fair SHA-256 lottery draw now? This will select a verified winner.')) return;
    try {
      const res = await api.executeDraw(drawId);
      alert(`Winner Selected: ${res.winner?.userName} (${res.winner?.userEmail})! Provably fair seed: ${res.draw?.seed}`);
      await onRefreshAll();
    } catch (e: any) {
      alert(e?.message || 'Error executing draw');
    }
  };

  // Approval Helper
  const handleDecideApproval = async (id: string, decision: 'approve' | 'reject') => {
    try {
      await api.decideApproval(id, decision);
      await onRefreshAll();
    } catch (e: any) {
      alert(e?.message);
    }
  };

  // Generate AI Marketing
  const handleGenerateMarketing = async () => {
    setGeneratingMarketing(true);
    setMarketingResult(null);
    try {
      const res = await api.generateMarketing(marketingPrompt, marketingTeam);
      setMarketingResult(res.text);
    } catch (e: any) {
      setMarketingResult('Error generating: ' + e?.message);
    } finally {
      setGeneratingMarketing(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.saveSettings(settingsForm);
      await onRefreshAll();
      alert('Settings updated successfully!');
    } catch (e: any) {
      alert(e?.message || 'Error saving settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Proposal Handlers
  const handleSaveProposal = async () => {
    if (!proposalSettings) return;
    setSavingProposal(true);
    setProposalStatusMsg(null);
    try {
      const res = await api.saveProposalSettings(proposalSettings);
      if (res.success) {
        setProposalSettings(res.proposalSettings);
        setProposalStatusMsg('Proposal settings & budget calculations saved successfully to database!');
        setTimeout(() => setProposalStatusMsg(null), 4000);
      }
    } catch (e: any) {
      alert(e?.message || 'Error saving proposal settings');
    } finally {
      setSavingProposal(false);
    }
  };

  const handleResetProposal = async () => {
    if (!confirm('Reset proposal document and budget to default tournament submission baseline?')) return;
    setSavingProposal(true);
    try {
      const res = await api.resetProposalSettings();
      if (res.success) {
        setProposalSettings(res.proposalSettings);
        setProposalStatusMsg('Proposal reset to default submission baseline.');
        setTimeout(() => setProposalStatusMsg(null), 4000);
      }
    } catch (e: any) {
      alert(e?.message || 'Error resetting proposal');
    } finally {
      setSavingProposal(false);
    }
  };

  // Fan Space Handlers
  const handleSaveFanSpace = async (spaceData: Partial<FanSpace>) => {
    try {
      const res = await api.saveFanSpace(spaceData);
      if (res.success) {
        setSpacesList(res.spaces);
        setShowSpaceModal(false);
        setEditingSpace(null);
      }
    } catch (e: any) {
      alert(e?.message || 'Error saving Fan Space');
    }
  };

  const handleDeleteFanSpace = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Fan Space?')) return;
    try {
      const res = await api.deleteFanSpace(id);
      if (res.success) setSpacesList(res.spaces);
    } catch (e: any) {
      alert(e?.message || 'Error deleting Fan Space');
    }
  };

  const handleToggleSpaceStatus = async (space: FanSpace) => {
    const nextStatus = space.status === 'active' ? 'upcoming' : space.status === 'upcoming' ? 'sold_out' : 'active';
    await handleSaveFanSpace({ ...space, status: nextStatus });
  };

  // Growth Catalyst Handlers
  const handleSaveSchool = async (schoolData: Partial<YouthCupSchool>) => {
    try {
      const res = await api.saveYouthSchool(schoolData);
      if (res.success) {
        setYouthSchoolsList(res.youthSchools);
        setShowSchoolModal(false);
      }
    } catch (e: any) {
      alert(e?.message || 'Error saving school');
    }
  };

  const handleDeleteSchool = async (id: string) => {
    if (!confirm('Delete this school participant?')) return;
    try {
      const res = await api.deleteYouthSchool(id);
      if (res.success) setYouthSchoolsList(res.youthSchools);
    } catch (e: any) {
      alert(e?.message || 'Error deleting school');
    }
  };

  const handleSaveCreator = async (creatorData: Partial<CreatorPartner>) => {
    try {
      const res = await api.saveCreatorPartner(creatorData);
      if (res.success) {
        setCreatorPartnersList(res.creatorPartners);
        setShowCreatorModal(false);
      }
    } catch (e: any) {
      alert(e?.message || 'Error saving creator');
    }
  };

  const handleDeleteCreator = async (id: string) => {
    if (!confirm('Delete creator partner?')) return;
    try {
      const res = await api.deleteCreatorPartner(id);
      if (res.success) setCreatorPartnersList(res.creatorPartners);
    } catch (e: any) {
      alert(e?.message || 'Error deleting creator');
    }
  };

  const handleToggleAudioStatus = async (feed: CommentaryAudioFeed) => {
    const nextStatus = feed.status === 'live' ? 'standby' : 'live';
    try {
      const res = await api.saveAudioFeed({ ...feed, status: nextStatus });
      if (res.success) setCommentaryFeedsList(res.commentaryFeeds);
    } catch (e: any) {
      alert(e?.message || 'Error updating audio feed');
    }
  };

  // Contests Handlers
  const handleSaveNewContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContestTitle) return;
    try {
      const optionsArray = newContestOptions.split(',').map(o => o.trim()).filter(Boolean);
      const res = await api.saveContest({
        title: newContestTitle,
        type: newContestType,
        prize: newContestPrize,
        matchId: newContestMatchId || null,
        locksAt: new Date(Date.now() + 3600 * 1000 * 24).toISOString(),
        status: 'open',
        questions: [
          {
            id: 'q-' + Date.now(),
            prompt: newContestPrompt,
            options: optionsArray.length > 0 ? optionsArray : ['Option A', 'Option B'],
            points: newContestPoints || 50
          }
        ]
      });
      if (res.success) {
        setContestsList(res.contests);
        setShowAddContestModal(false);
        setNewContestTitle('');
        setNewContestPrompt('');
        alert('Contest created successfully!');
      }
    } catch (e: any) {
      alert(e?.message || 'Error creating contest');
    }
  };

  const handleToggleContestLock = async (contest: Contest) => {
    const nextStatus = contest.status === 'open' ? 'locked' : 'open';
    try {
      const res = await api.toggleContestStatus(contest.id, nextStatus);
      if (res.success) {
        setContestsList(prev => prev.map(c => c.id === contest.id ? { ...c, status: nextStatus } : c));
      }
    } catch (e: any) {
      alert(e?.message || 'Error toggling contest status');
    }
  };

  const handleOpenSettleModal = (contest: Contest) => {
    setSettlingContest(contest);
    const initialMap: Record<string, string> = {};
    contest.questions.forEach(q => {
      initialMap[q.id] = q.answer || q.options[0] || '';
    });
    setSettleAnswersMap(initialMap);
  };

  const handleConfirmSettleContest = async () => {
    if (!settlingContest) return;
    setSettlingSubmitting(true);
    try {
      const res = await api.settleContest(settlingContest.id, settleAnswersMap);
      if (res.success) {
        setContestsList(prev => prev.map(c => c.id === settlingContest.id ? { ...c, status: 'settled' } : c));
        alert(`Contest settled! ${res.settledEntriesCount} entries evaluated, ${res.totalPointsDistributed} points awarded to winning fans!`);
        setSettlingContest(null);
      }
    } catch (e: any) {
      alert(e?.message || 'Error settling contest');
    } finally {
      setSettlingSubmitting(false);
    }
  };

  const handleDeleteContest = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contest?')) return;
    try {
      const res = await api.deleteContest(id);
      if (res.success) setContestsList(res.contests);
    } catch (e: any) {
      alert(e?.message || 'Error deleting contest');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/40 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl shadow-amber-500/5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Authorized Owner Console
            </span>
            <span className="text-xs text-amber-300 font-bold">
              solarastra.in@gmail.com
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Abu Dhabi T10 League & Franchise Admin
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Manage teams, social handles, Curator feeds (last 5 per platform), crawler agents, live matches & SMTP settings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunAllAgents}
            disabled={runningAgent !== null}
            className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningAgent === 'all' ? 'animate-spin' : ''}`} />
            <span>Run All 6 Autonomous Agents</span>
          </button>
        </div>
      </div>

      {agentMsg && (
        <div className="p-3.5 rounded-xl bg-slate-900 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-2">
          <span>{agentMsg}</span>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
        {[
          { id: 'overview', label: 'Overview & Stats' },
          { id: 'proposal', label: '📄 Proposal & Budget Settings' },
          { id: 'fanspaces', label: `🌍 Fan Spaces (${spacesList.length || 5} Hubs)` },
          { id: 'growth', label: '🚀 Youth Cup & Creator Studio' },
          { id: 'contests', label: `🎯 Contests & Fantasy 10 (${contestsList.length})` },
          { id: 'matches', label: 'Matches & Live Center' },
          { id: 'notifications', label: `🔔 FCM Push Alerts (${notificationsList.length})` },
          { id: 'feeds', label: 'Curator & Social Feeds' },
          { id: 'teams', label: 'Teams & Handles' },
          { id: 'agents', label: 'Autonomous Agents' },
          { id: 'approvals', label: `Approval Queue (${approvals.filter(a => a.status === 'pending').length})` },
          { id: 'draws', label: 'Contest Draws' },
          { id: 'marketing', label: 'AI Marketing Studio' },
          { id: 'settings', label: 'Portal Config & SMTP' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`whitespace-nowrap px-4 py-2.5 rounded-t-xl transition-all ${
              activeTab === t.id
                ? 'bg-slate-900 text-amber-400 border-t-2 border-t-amber-400 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & STATS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-bold text-slate-400">Total Registered Fans</span>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono mt-1">
                {settings.publicUserCountOverride.toLocaleString()}
              </div>
              <span className="text-[10px] text-amber-400 font-semibold block mt-1">
                Display count configurable
              </span>
            </div>

            <div 
              onClick={() => setActiveTab('notifications')}
              className="p-5 rounded-2xl bg-slate-900 border border-amber-500/30 hover:border-amber-400 cursor-pointer transition-colors"
            >
              <span className="text-xs font-bold text-slate-400">FCM Push Alerts</span>
              <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono mt-1">
                {notificationsList.length}
              </div>
              <span className="text-[10px] text-emerald-400 block mt-1">
                {fcmTokensList.length || 1} active device tokens
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-bold text-slate-400">Verified Handles</span>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono mt-1">
                {handles.filter(h => h.status === 'verified').length}
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Across {teams.length} franchises
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-bold text-slate-400">Curated Posts</span>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono mt-1">
                {feedItems.length}
              </div>
              <span className="text-[10px] text-emerald-400 block mt-1">
                Max {settings.maxSocialPerPlatform} per platform shown
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-bold text-slate-400">Pending Approvals</span>
              <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono mt-1">
                {approvals.filter(a => a.status === 'pending').length}
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                AI crawler suggestions
              </span>
            </div>
          </div>

          {/* Quick Action: Seed 6 Announced Teams & Pull Handles */}
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                  Official Lineup
                </span>
                <span className="text-xs font-bold text-amber-300">
                  UAE Bulls · United Tigers · Yas Lions · Arabian Aces · Emirates Eagles · Desert Royal Champions
                </span>
              </div>
              <h4 className="font-extrabold text-sm sm:text-base text-white">
                Seed 6 Announced Teams & Pull Live Handles
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically seed the official franchises and trigger Google Search Grounding to pull verified handles into the portal.
              </p>
            </div>

            <button
              onClick={handleSeedAnnouncedTeamsAndSearch}
              disabled={seedingTeams}
              className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 flex-shrink-0 ${
                seedingTeams
                  ? 'bg-slate-800 text-amber-300 border border-amber-500/40 cursor-wait'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md shadow-amber-500/20 active:scale-95'
              }`}
            >
              {seedingTeams ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Searching & Pulling Handles...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Seed Teams & Pull Handles</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Agent Runner Actions */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
            <h3 className="font-extrabold text-base text-white mb-3">
              Trigger Autonomous Agents
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { name: 'discovery', label: 'Discovery Agent', desc: 'Scan league & team sites for handles' },
                { name: 'social', label: 'Social & Curator', desc: 'Crawl YouTube, X, IG, Threads, TikTok' },
                { name: 'news', label: 'News Agent', desc: 'Sync press releases & headlines' },
                { name: 'scores', label: 'Scores Agent', desc: 'Simulate ball / settle contests' },
                { name: 'content', label: 'Content Agent', desc: 'Generate match previews & copy' },
                { name: 'ops', label: 'Ops Agent', desc: 'Audit broken links & system digest' },
              ].map(ag => (
                <button
                  key={ag.name}
                  onClick={() => handleRunAgent(ag.name)}
                  disabled={runningAgent !== null}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-400/50 hover:bg-slate-800/80 text-left transition-all"
                >
                  <span className="font-bold text-xs text-amber-300 block mb-1">
                    {runningAgent === ag.name ? 'Running...' : ag.label}
                  </span>
                  <span className="text-[10px] text-slate-400 block leading-tight">
                    {ag.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Agent Runs */}
          <div className="rounded-2xl p-6 bg-slate-900 border border-slate-800">
            <h3 className="font-extrabold text-base text-white mb-4">
              Recent Agent Activity Logs
            </h3>
            <div className="space-y-2">
              {agentRuns.slice(0, 8).map(run => (
                <div key={run.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-black text-amber-400">{run.agent}</span>
                      <span className="text-[10px] text-slate-400">{new Date(run.startedAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-slate-300">{run.summary}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase">
                    {run.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: PROPOSAL & BUDGET SETTINGS */}
      {activeTab === 'proposal' && proposalSettings && (
        <div className="space-y-6">
          {proposalStatusMsg && (
            <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between">
              <span>{proposalStatusMsg}</span>
              <button onClick={() => setProposalStatusMsg(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Proposal Header & KPI Summary */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/40 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                  ADT10 Official Submission Config
                </span>
                <span className="text-xs text-amber-300 font-bold">1 USD = {proposalSettings.exchangeRateUsdToAed} AED</span>
              </div>
              <h2 className="text-2xl font-black text-white font-display">
                Strategic Proposal, 9 Activities & Financial ROI Engine
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl">
                Configure itemized CapEx, OpEx, revenue projections, and exchange rate. Updates made here immediately sync to the League Proposal dossier, presentation pitch deck, and budget simulator.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleResetProposal}
                disabled={savingProposal}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Defaults</span>
              </button>
              <button
                type="button"
                onClick={handleSaveProposal}
                disabled={savingProposal}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{savingProposal ? 'Saving Changes...' : 'Save Proposal Settings'}</span>
              </button>
            </div>
          </div>

          {/* Financial Computations Bar */}
          {(() => {
            const rate = proposalSettings.exchangeRateUsdToAed || 3.6725;
            const totalCapexUsd = (proposalSettings.activities || []).reduce((acc, a) => acc + (a.capexUsd || 0), 0);
            const totalOpexUsd = (proposalSettings.activities || []).reduce((acc, a) => acc + (a.opexUsd || 0), 0);
            const totalBudgetUsd = totalCapexUsd + totalOpexUsd;
            const rev = proposalSettings.revenueStreams || {} as any;
            const grossRevUsd = (rev.predictorSponsorshipUsd || 450000) + 
                                (rev.fantasySponsorshipUsd || 350000) + 
                                (rev.fanSpacesNamingRightsUsd || 650000) + 
                                (rev.merchAndFbUsd || 370000) + 
                                ((rev.superfanPassportUsers || 38000) * (rev.superfanPassportFeeUsd || 10));
            const netProfitUsd = grossRevUsd - totalBudgetUsd;
            const roiPct = totalBudgetUsd > 0 ? Math.round((netProfitUsd / totalBudgetUsd) * 100) : 108;

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400 font-bold uppercase">Total Proposed Budget</span>
                  <div className="text-2xl font-black font-mono text-amber-400">
                    ${totalBudgetUsd.toLocaleString()}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono block">
                    {Math.round(totalBudgetUsd * rate).toLocaleString()} AED
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400 font-bold uppercase">Gross Projected Revenue</span>
                  <div className="text-2xl font-black font-mono text-emerald-400">
                    ${grossRevUsd.toLocaleString()}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono block">
                    {Math.round(grossRevUsd * rate).toLocaleString()} AED
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400 font-bold uppercase">Net Profit Contribution</span>
                  <div className="text-2xl font-black font-mono text-white">
                    +${netProfitUsd.toLocaleString()}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono block">
                    +{Math.round(netProfitUsd * rate).toLocaleString()} AED
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900 border border-amber-500/30 space-y-1">
                  <span className="text-xs text-amber-400 font-bold uppercase">Year 1 Net ROI</span>
                  <div className="text-3xl font-black font-mono text-amber-400">
                    +{roiPct}%
                  </div>
                  <span className="text-[11px] text-emerald-400 block font-semibold">
                    Self-funding in Month 8
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Revenue Streams Configurator */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="font-extrabold text-base text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-400" />
              <span>Commercial Revenue Streams Projections</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Predictor Title Sponsorship ($)
                </label>
                <input
                  type="number"
                  value={proposalSettings.revenueStreams.predictorSponsorshipUsd}
                  onChange={e => setProposalSettings({
                    ...proposalSettings,
                    revenueStreams: {
                      ...proposalSettings.revenueStreams,
                      predictorSponsorshipUsd: parseInt(e.target.value, 10) || 0
                    }
                  })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Fantasy 10 Title Sponsorship ($)
                </label>
                <input
                  type="number"
                  value={proposalSettings.revenueStreams.fantasySponsorshipUsd}
                  onChange={e => setProposalSettings({
                    ...proposalSettings,
                    revenueStreams: {
                      ...proposalSettings.revenueStreams,
                      fantasySponsorshipUsd: parseInt(e.target.value, 10) || 0
                    }
                  })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Fan Spaces Naming Rights ($)
                </label>
                <input
                  type="number"
                  value={proposalSettings.revenueStreams.fanSpacesNamingRightsUsd}
                  onChange={e => setProposalSettings({
                    ...proposalSettings,
                    revenueStreams: {
                      ...proposalSettings.revenueStreams,
                      fanSpacesNamingRightsUsd: parseInt(e.target.value, 10) || 0
                    }
                  })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Fan Spaces Merch & F&B Retail ($)
                </label>
                <input
                  type="number"
                  value={proposalSettings.revenueStreams.merchAndFbUsd}
                  onChange={e => setProposalSettings({
                    ...proposalSettings,
                    revenueStreams: {
                      ...proposalSettings.revenueStreams,
                      merchAndFbUsd: parseInt(e.target.value, 10) || 0
                    }
                  })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Superfan Passport Members
                </label>
                <input
                  type="number"
                  value={proposalSettings.revenueStreams.superfanPassportUsers}
                  onChange={e => setProposalSettings({
                    ...proposalSettings,
                    revenueStreams: {
                      ...proposalSettings.revenueStreams,
                      superfanPassportUsers: parseInt(e.target.value, 10) || 0
                    }
                  })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Fixed Peg (1 USD to AED)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={proposalSettings.exchangeRateUsdToAed}
                  onChange={e => setProposalSettings({
                    ...proposalSettings,
                    exchangeRateUsdToAed: parseFloat(e.target.value) || 3.6725
                  })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Itemized 9 Activities Editor */}
          <div className="space-y-4">
            <h3 className="font-extrabold text-base text-white flex items-center justify-between">
              <span>Itemized Activities & Strategic Scope</span>
              <span className="text-xs text-slate-400 font-normal">All 9 Pillars fully configurable</span>
            </h3>

            <div className="space-y-4">
              {proposalSettings.activities.map((act, index) => (
                <div key={act.id} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center">
                        {act.number}
                      </span>
                      <span className="font-bold text-white text-base">Activity {act.number}:</span>
                      <input
                        type="text"
                        value={act.title}
                        onChange={e => {
                          const updated = [...proposalSettings.activities];
                          updated[index].title = e.target.value;
                          setProposalSettings({ ...proposalSettings, activities: updated });
                        }}
                        className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs font-bold text-amber-300 flex-1 min-w-[200px]"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <label className="text-[11px] font-bold text-slate-400">CapEx ($):</label>
                        <input
                          type="number"
                          value={act.capexUsd}
                          onChange={e => {
                            const updated = [...proposalSettings.activities];
                            const val = parseInt(e.target.value, 10) || 0;
                            updated[index].capexUsd = val;
                            updated[index].usdCost = val + (updated[index].opexUsd || 0);
                            updated[index].aedCost = Math.round(updated[index].usdCost * proposalSettings.exchangeRateUsdToAed);
                            setProposalSettings({ ...proposalSettings, activities: updated });
                          }}
                          className="w-24 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <label className="text-[11px] font-bold text-slate-400">OpEx ($):</label>
                        <input
                          type="number"
                          value={act.opexUsd}
                          onChange={e => {
                            const updated = [...proposalSettings.activities];
                            const val = parseInt(e.target.value, 10) || 0;
                            updated[index].opexUsd = val;
                            updated[index].usdCost = (updated[index].capexUsd || 0) + val;
                            updated[index].aedCost = Math.round(updated[index].usdCost * proposalSettings.exchangeRateUsdToAed);
                            setProposalSettings({ ...proposalSettings, activities: updated });
                          }}
                          className="w-24 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono"
                        />
                      </div>

                      <div className="text-right pl-2">
                        <span className="text-[10px] text-slate-500 block">Total</span>
                        <span className="text-xs font-mono font-bold text-amber-400">
                          ${act.usdCost.toLocaleString()} ({Math.round(act.usdCost * proposalSettings.exchangeRateUsdToAed).toLocaleString()} AED)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Scope & Implementation:</label>
                      <textarea
                        rows={2}
                        value={act.what}
                        onChange={e => {
                          const updated = [...proposalSettings.activities];
                          updated[index].what = e.target.value;
                          setProposalSettings({ ...proposalSettings, activities: updated });
                        }}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Expected Deliverable & Outcome:</label>
                      <textarea
                        rows={2}
                        value={act.outcome}
                        onChange={e => {
                          const updated = [...proposalSettings.activities];
                          updated[index].outcome = e.target.value;
                          setProposalSettings({ ...proposalSettings, activities: updated });
                        }}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Timeline:</label>
                      <input
                        type="text"
                        value={act.timeline}
                        onChange={e => {
                          const updated = [...proposalSettings.activities];
                          updated[index].timeline = e.target.value;
                          setProposalSettings({ ...proposalSettings, activities: updated });
                        }}
                        className="w-full px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">KPIs (Comma-separated):</label>
                      <input
                        type="text"
                        value={act.kpis.join(', ')}
                        onChange={e => {
                          const updated = [...proposalSettings.activities];
                          updated[index].kpis = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          setProposalSettings({ ...proposalSettings, activities: updated });
                        }}
                        className="w-full px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-amber-300"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: GLOBAL PHYSICAL FAN SPACES (5 HUBS) */}
      {activeTab === 'fanspaces' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase mb-1">
                <Globe className="w-3 h-3" /> Activity 8 Manager
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white font-display">
                Global Fan Spaces & Experiential Clubhouses
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                Manage the 5 international experiential hubs in Abu Dhabi, Dubai, London, Mumbai, and Toronto. Configure capacities, VIP ticket pricing, screening schedules, and amenities.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingSpace(null);
                setSpaceForm({
                  name: '',
                  city: '',
                  country: '',
                  tagline: '',
                  location: '',
                  capacity: 500,
                  status: 'active',
                  vipPassPriceUsd: 50,
                  vipPassPriceAed: 185,
                  openHours: 'Daily 12:00 PM – 02:00 AM',
                  liveMatchSchedule: 'Screening all 34 matches live with stadium acoustic audio',
                  image: 'https://images.unsplash.com/photo-1512958789358-4dacacbe09c3?q=80&w=1200&auto=format&fit=crop',
                  features: ['360° LED Match Screens', 'VR Batting Simulator', 'Merch Boutique'],
                  amenities: ['Valet Parking', 'Fast Wi-Fi', 'Artisanal Bar'],
                  vipPerks: ['Reserved lounge seating', 'Complimentary beverages'],
                  merchBoutique: 'Official franchise jerseys & caps',
                  menuHighlights: 'Gourmet sliders & Karak chai'
                });
                setShowSpaceModal(true);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 whitespace-nowrap shrink-0 transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Global Fan Space</span>
            </button>
          </div>

          {/* Cards of Fan Spaces */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {spacesList.map(sp => (
              <div key={sp.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="relative h-40 rounded-xl overflow-hidden">
                    <img src={sp.image} alt={sp.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                    <span className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-slate-950/80 text-white text-[11px] font-bold flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-amber-400" />
                      {sp.city}, {sp.country}
                    </span>
                    <button
                      onClick={() => handleToggleSpaceStatus(sp)}
                      className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        sp.status === 'active' ? 'bg-emerald-500 text-slate-950' : sp.status === 'upcoming' ? 'bg-amber-400 text-slate-950' : 'bg-red-500 text-white'
                      }`}
                    >
                      {sp.status}
                    </button>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-base">{sp.name}</h4>
                    <p className="text-xs text-amber-400 font-medium mt-0.5">{sp.tagline}</p>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">{sp.location}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-slate-800/80">
                    <div className="p-2 rounded-lg bg-slate-950">
                      <span className="text-[10px] text-slate-500 block">Capacity</span>
                      <span className="font-mono font-bold text-white">{sp.capacity}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950">
                      <span className="text-[10px] text-slate-500 block">VIP Pass</span>
                      <span className="font-mono font-bold text-amber-400">${sp.vipPassPriceUsd}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950">
                      <span className="text-[10px] text-slate-500 block">Bookings</span>
                      <span className="font-mono font-bold text-emerald-400">{sp.totalBookings || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setEditingSpace(sp);
                      setSpaceForm(sp);
                      setShowSpaceModal(true);
                    }}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Edit Space</span>
                  </button>
                  <button
                    onClick={() => handleDeleteFanSpace(sp.id)}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
                    title="Delete space"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Bookings Audit Table */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="font-extrabold text-base text-white flex items-center justify-between">
              <span>Recent VIP & Fan Space Pass Reservations</span>
              <span className="text-xs text-amber-400 font-mono font-bold">{spaceBookingsList.length} total entries</span>
            </h3>

            {spaceBookingsList.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No fan bookings registered yet. Test booking a pass in the Fan Spaces tab.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Pass Code</th>
                      <th className="py-2.5 px-3">Fan / Guest</th>
                      <th className="py-2.5 px-3">Clubhouse</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Tier</th>
                      <th className="py-2.5 px-3 text-right">Passes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {spaceBookingsList.slice(0, 10).map(bk => (
                      <tr key={bk.id} className="hover:bg-slate-850">
                        <td className="py-2.5 px-3 text-emerald-400 font-bold">{bk.passCode}</td>
                        <td className="py-2.5 px-3 font-sans text-white">{bk.userName} ({bk.userEmail})</td>
                        <td className="py-2.5 px-3 font-sans text-slate-300">{bk.spaceName}</td>
                        <td className="py-2.5 px-3 text-slate-400">{bk.date}</td>
                        <td className="py-2.5 px-3 uppercase text-amber-400 font-bold">{bk.ticketType.replace('_', ' ')}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-white">{bk.ticketsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add / Edit Space Modal */}
          {showSpaceModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 relative shadow-2xl max-h-[90vh] overflow-y-auto">
                <button
                  onClick={() => setShowSpaceModal(false)}
                  className="absolute top-5 right-5 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                <h3 className="text-xl font-black text-white font-display">
                  {editingSpace ? `Edit ${editingSpace.name}` : 'Add New Global Fan Space'}
                </h3>

                <form onSubmit={e => {
                  e.preventDefault();
                  handleSaveFanSpace(spaceForm);
                }} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Space Name</label>
                      <input
                        type="text"
                        value={spaceForm.name || ''}
                        onChange={e => setSpaceForm({ ...spaceForm, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">City</label>
                      <input
                        type="text"
                        value={spaceForm.city || ''}
                        onChange={e => setSpaceForm({ ...spaceForm, city: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Country</label>
                      <input
                        type="text"
                        value={spaceForm.country || ''}
                        onChange={e => setSpaceForm({ ...spaceForm, country: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Capacity</label>
                      <input
                        type="number"
                        value={spaceForm.capacity || 500}
                        onChange={e => setSpaceForm({ ...spaceForm, capacity: parseInt(e.target.value, 10) || 500 })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Status</label>
                      <select
                        value={spaceForm.status || 'active'}
                        onChange={e => setSpaceForm({ ...spaceForm, status: e.target.value as any })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      >
                        <option value="active">Active</option>
                        <option value="upcoming">Upcoming</option>
                        <option value="sold_out">Sold Out</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">VIP Pass Price ($ USD)</label>
                      <input
                        type="number"
                        value={spaceForm.vipPassPriceUsd || 50}
                        onChange={e => setSpaceForm({
                          ...spaceForm,
                          vipPassPriceUsd: parseInt(e.target.value, 10) || 50,
                          vipPassPriceAed: Math.round((parseInt(e.target.value, 10) || 50) * 3.6725)
                        })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">VIP Pass Price (AED)</label>
                      <input
                        type="number"
                        value={spaceForm.vipPassPriceAed || 185}
                        onChange={e => setSpaceForm({ ...spaceForm, vipPassPriceAed: parseInt(e.target.value, 10) || 185 })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Location Address</label>
                    <input
                      type="text"
                      value={spaceForm.location || ''}
                      onChange={e => setSpaceForm({ ...spaceForm, location: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Image URL</label>
                    <input
                      type="text"
                      value={spaceForm.image || ''}
                      onChange={e => setSpaceForm({ ...spaceForm, image: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowSpaceModal(false)}
                      className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl shadow-lg"
                    >
                      {editingSpace ? 'Update Space' : 'Create Fan Space'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: GROWTH CATALYSTS & YOUTH CUP */}
      {activeTab === 'growth' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase mb-1">
              <Sparkles className="w-3 h-3" /> Activity 9 Manager
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-display">
              Next-Gen Growth Catalysts Management
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Configure participating schools for the Grassroots Youth T10 Cup, partnered gaming/cricket streamers, multi-lingual AI audio commentary feeds, and the Superfan Digital Passport tiers.
            </p>
          </div>

          {/* Section A: Youth Schools */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-amber-400" />
                  <span>Grassroots Youth Cup Schools ({youthSchoolsList.length})</span>
                </h3>
                <p className="text-xs text-slate-400">10-over tape-ball tournament schools in the UAE and the UK.</p>
              </div>
              <button
                onClick={() => setShowSchoolModal(true)}
                className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add School</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {youthSchoolsList.map(sc => (
                <div key={sc.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-amber-400 uppercase text-[10px]">{sc.region} · {sc.city}</span>
                    <button onClick={() => handleDeleteSchool(sc.id)} className="text-slate-500 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h4 className="font-bold text-white text-sm">{sc.name}</h4>
                  <div className="text-[11px] text-slate-400 space-y-0.5">
                    <div>Students: <span className="text-white font-mono">{sc.studentsCount}</span></div>
                    <div>Tickets: <span className="text-amber-400 font-mono">{sc.matchdayTicketsAllocated}</span></div>
                    <div>Kit: <span className={sc.equipmentKitGranted ? 'text-emerald-400' : 'text-slate-500'}>{sc.equipmentKitGranted ? 'Granted' : 'Pending'}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section B: Creator Partners */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                  <Video className="w-5 h-5 text-amber-400" />
                  <span>50+ Influencer Creator Studio Partners ({creatorPartnersList.length})</span>
                </h3>
                <p className="text-xs text-slate-400">Twitch, YouTube, TikTok creators hosting live watch-alongs.</p>
              </div>
              <button
                onClick={() => setShowCreatorModal(true)}
                className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Partner Streamer</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {creatorPartnersList.map(cr => (
                <div key={cr.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-amber-400 uppercase text-[10px]">{cr.platform}</span>
                    <button onClick={() => handleDeleteCreator(cr.id)} className="text-slate-500 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h4 className="font-bold text-white text-sm">{cr.name} ({cr.handle})</h4>
                  <p className="text-[11px] text-slate-300">{cr.specialty}</p>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                    <span>{cr.followers} followers</span>
                    <span className="text-emerald-400 font-mono font-bold">{cr.totalWatchViews} views</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section C: Audio Commentary Feeds */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="font-extrabold text-base text-white flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-amber-400" />
              <span>Multi-Lingual AI Audio Commentary Feeds</span>
            </h3>

            <div className="space-y-3">
              {commentaryFeedsList.map(feed => (
                <div key={feed.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-amber-400 text-sm">{feed.language}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        feed.status === 'live' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {feed.status}
                      </span>
                    </div>
                    <p className="text-slate-300 mt-0.5">Commentator: {feed.commentator}</p>
                    <p className="text-slate-400 text-[11px] italic mt-0.5">"{feed.sampleAudioText}"</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-slate-400 font-mono text-[11px]">{feed.listenersCount.toLocaleString()} listeners</span>
                    <button
                      onClick={() => handleToggleAudioStatus(feed)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs ${
                        feed.status === 'live' ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-white'
                      }`}
                    >
                      {feed.status === 'live' ? 'Set to Standby' : 'Set to Live'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modals for School & Creator */}
          {showSchoolModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4">
                <h3 className="text-lg font-black text-white">Add Participating School</h3>
                <form onSubmit={e => {
                  e.preventDefault();
                  handleSaveSchool(schoolForm);
                }} className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">School Name</label>
                    <input
                      type="text"
                      value={schoolForm.name || ''}
                      onChange={e => setSchoolForm({ ...schoolForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Region</label>
                      <select
                        value={schoolForm.region || 'UAE'}
                        onChange={e => setSchoolForm({ ...schoolForm, region: e.target.value as any })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      >
                        <option value="UAE">UAE</option>
                        <option value="UK">UK</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">City</label>
                      <input
                        type="text"
                        value={schoolForm.city || ''}
                        onChange={e => setSchoolForm({ ...schoolForm, city: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Student Participants</label>
                    <input
                      type="number"
                      value={schoolForm.studentsCount || 250}
                      onChange={e => setSchoolForm({ ...schoolForm, studentsCount: parseInt(e.target.value, 10) || 200 })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setShowSchoolModal(false)} className="flex-1 py-2 bg-slate-800 text-white font-bold rounded-xl">Cancel</button>
                    <button type="submit" className="flex-1 py-2 bg-amber-400 text-slate-950 font-black rounded-xl">Save School</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showCreatorModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4">
                <h3 className="text-lg font-black text-white">Partner New Content Creator</h3>
                <form onSubmit={e => {
                  e.preventDefault();
                  handleSaveCreator(creatorForm);
                }} className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Creator Name</label>
                    <input
                      type="text"
                      value={creatorForm.name || ''}
                      onChange={e => setCreatorForm({ ...creatorForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Handle / Channel</label>
                    <input
                      type="text"
                      value={creatorForm.handle || ''}
                      onChange={e => setCreatorForm({ ...creatorForm, handle: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Platform</label>
                      <select
                        value={creatorForm.platform || 'YouTube'}
                        onChange={e => setCreatorForm({ ...creatorForm, platform: e.target.value as any })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      >
                        <option value="YouTube">YouTube</option>
                        <option value="Twitch">Twitch</option>
                        <option value="Kick">Kick</option>
                        <option value="TikTok">TikTok</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Followers</label>
                      <input
                        type="text"
                        value={creatorForm.followers || ''}
                        onChange={e => setCreatorForm({ ...creatorForm, followers: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setShowCreatorModal(false)} className="flex-1 py-2 bg-slate-800 text-white font-bold rounded-xl">Cancel</button>
                    <button type="submit" className="flex-1 py-2 bg-amber-400 text-slate-950 font-black rounded-xl">Add Partner</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: CONTESTS & FANTASY 10 */}
      {activeTab === 'contests' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase mb-1">
                <Trophy className="w-3 h-3" /> Activities 3 & 4 Manager
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white font-display">
                Gamification Suite & Match Predictor Control
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                Create ball-by-ball predictions, boundary over/unders, and trivia contests. Settle answers in 1 click to distribute points and push alerts to winners.
              </p>
            </div>

            <button
              onClick={() => setShowAddContestModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 whitespace-nowrap shrink-0 transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Contest</span>
            </button>
          </div>

          {/* Contests List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contestsList.map(ct => (
              <div key={ct.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-950 text-amber-400 border border-slate-800">
                      {ct.type}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      ct.status === 'open' ? 'bg-emerald-500/20 text-emerald-400' : ct.status === 'locked' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {ct.status}
                    </span>
                  </div>

                  <h4 className="font-bold text-white text-base">{ct.title}</h4>
                  <p className="text-xs text-slate-300 line-clamp-2">{ct.description}</p>
                  <p className="text-xs text-amber-400 font-semibold">Prize: {ct.prize}</p>

                  <div className="text-[11px] text-slate-400 pt-1">
                    Questions: <span className="text-white font-bold">{ct.questions.length}</span> · Points: <span className="text-emerald-400 font-mono font-bold">{ct.questions.reduce((a, q) => a + q.points, 0)} pts</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
                  <button
                    onClick={() => handleToggleContestLock(ct)}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
                  >
                    {ct.status === 'open' ? 'Lock Contest' : 'Unlock Contest'}
                  </button>
                  <button
                    onClick={() => handleOpenSettleModal(ct)}
                    className="flex-1 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow"
                  >
                    Settle Answers
                  </button>
                  <button
                    onClick={() => handleDeleteContest(ct.id)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Settle Contest Modal */}
          {settlingContest && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 relative shadow-2xl">
                <button
                  onClick={() => setSettlingContest(null)}
                  className="absolute top-5 right-5 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                <div>
                  <h3 className="text-xl font-black text-white font-display">
                    Settle Contest: {settlingContest.title}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Select the winning answer for each question. All participating fans with matching answers will receive points instantly, and a broadcast announcement alert will trigger.
                  </p>
                </div>

                <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                  {settlingContest.questions.map((q, idx) => (
                    <div key={q.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                      <span className="font-bold text-white block">Q{idx + 1}: {q.prompt} ({q.points} pts)</span>
                      <div className="space-y-1">
                        {q.options.map(opt => (
                          <label key={opt} className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer">
                            <input
                              type="radio"
                              name={`settle-${q.id}`}
                              checked={settleAnswersMap[q.id] === opt}
                              onChange={() => setSettleAnswersMap({ ...settleAnswersMap, [q.id]: opt })}
                              className="text-amber-400"
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSettlingContest(null)}
                    className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSettleContest}
                    disabled={settlingSubmitting}
                    className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black rounded-xl text-xs shadow-lg disabled:opacity-50"
                  >
                    {settlingSubmitting ? 'Distributing Points...' : 'Confirm & Award Points'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add Contest Modal */}
          {showAddContestModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 relative shadow-2xl">
                <button
                  onClick={() => setShowAddContestModal(false)}
                  className="absolute top-5 right-5 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                <h3 className="text-xl font-black text-white font-display">Create Prediction Contest</h3>

                <form onSubmit={handleSaveNewContest} className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Contest Title</label>
                    <input
                      type="text"
                      value={newContestTitle}
                      onChange={e => setNewContestTitle(e.target.value)}
                      placeholder="e.g. Sixes Over/Under Showdown"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Type</label>
                      <select
                        value={newContestType}
                        onChange={e => setNewContestType(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      >
                        <option value="predictor">Match Predictor</option>
                        <option value="sixes">Sixes Over/Under</option>
                        <option value="trivia">T10 Trivia</option>
                        <option value="season">Season Oracle</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Prize Description</label>
                      <input
                        type="text"
                        value={newContestPrize}
                        onChange={e => setNewContestPrize(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Question Prompt</label>
                    <input
                      type="text"
                      value={newContestPrompt}
                      onChange={e => setNewContestPrompt(e.target.value)}
                      placeholder="e.g. Which team scores 130+ runs?"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Options (Comma-separated)</label>
                    <input
                      type="text"
                      value={newContestOptions}
                      onChange={e => setNewContestOptions(e.target.value)}
                      placeholder="Arabian Aces, Deccan Gladiators, Both, Neither"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Points for Correct Answer</label>
                    <input
                      type="number"
                      value={newContestPoints}
                      onChange={e => setNewContestPoints(parseInt(e.target.value, 10) || 50)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setShowAddContestModal(false)} className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl">Cancel</button>
                    <button type="submit" className="flex-1 py-3 bg-amber-400 text-slate-950 font-black rounded-xl">Publish Contest</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: NOTIFICATIONS & FCM PUSH ALERTS */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          {pushStatusMsg && (
            <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between gap-3 ${
              pushStatusMsg.startsWith('✓') 
                ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300' 
                : 'bg-red-950/60 border border-red-500/40 text-red-300'
            }`}>
              <span>{pushStatusMsg}</span>
              <button onClick={() => setPushStatusMsg(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* FCM Overview Header */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Bell className="w-3 h-3" /> Real-Time Push Dispatcher
                </span>
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  FCM Cloud Messaging Active
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                FCM Push Notifications & Match Alerts Control
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                Broadcast instant push alerts to logged-in fans and web subscribers when a new match result is posted or a contest deadline approaches.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={refreshNotificationsData}
                disabled={loadingNotifs}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-slate-700 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingNotifs ? 'animate-spin' : ''}`} />
                <span>Refresh Logs</span>
              </button>
            </div>
          </div>

          {/* 1. ONE-CLICK REAL-TIME EVENT DISPATCHERS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Match Result Instant Trigger */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <h3 className="font-black text-base text-white">
                      1-Click Match Result Alert
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase">
                    Automated
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-4">
                  Select any match to format and push real-time scorecards and winner notifications to all fans.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Target Match</label>
                    <select
                      value={selectedMatchForAlert}
                      onChange={e => setSelectedMatchForAlert(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                    >
                      {matches.map(m => {
                        const tA = teams.find(t => t.id === m.teamA);
                        const tB = teams.find(t => t.id === m.teamB);
                        return (
                          <option key={m.id} value={m.id}>
                            Match #{m.matchNo}: {tA?.short || m.teamA} vs {tB?.short || m.teamB} ({m.status.toUpperCase()})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {(() => {
                    const m = matches.find(match => match.id === selectedMatchForAlert) || matches[0];
                    const tA = teams.find(t => t.id === m?.teamA);
                    const tB = teams.find(t => t.id === m?.teamB);
                    const winT = teams.find(t => t.id === m?.winner);
                    return (
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                        <div className="flex items-center justify-between text-slate-400 text-[11px]">
                          <span>Preview Notification:</span>
                          <span className="font-mono text-amber-400">{m?.stage}</span>
                        </div>
                        <p className="font-bold text-white">
                          🏆 MATCH RESULT: {winT ? winT.name : 'Match Result'} ({tA?.short} vs {tB?.short})
                        </p>
                        <p className="text-slate-400 text-[11px]">
                          {m?.result || `${winT?.name || 'Winner'} won!`}. Final: {tA?.short} {m?.scoreA || '138/2'} vs {tB?.short} {m?.scoreB || '120/5'}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTriggerMatchResult}
                  disabled={sendingPush}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-transform active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingPush ? 'Pushing FCM Alert...' : 'Push Match Result to All Fans'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadTemplate('match')}
                  className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700"
                  title="Load into custom composer"
                >
                  Edit Copy
                </button>
              </div>
            </div>

            {/* Contest Deadline Warning Trigger */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    <h3 className="font-black text-base text-white">
                      1-Click Contest Deadline Warning
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase">
                    Urgent Alert
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-4">
                  Send high-priority alerts to logged-in users before predictions lock so they never miss entering.
                </p>

                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">Target Contest</label>
                      <select
                        value={selectedContestForAlert}
                        onChange={e => setSelectedContestForAlert(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                      >
                        {contests.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.title} ({c.status.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">Lock Time Warning</label>
                      <select
                        value={contestMinutesBefore}
                        onChange={e => setContestMinutesBefore(parseInt(e.target.value) || 15)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                      >
                        <option value={5}>Imminent (5 minutes left)</option>
                        <option value={15}>15 minutes before 1st ball</option>
                        <option value={30}>30 minutes before 1st ball</option>
                        <option value={60}>1 hour before toss</option>
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const c = contests.find(contest => contest.id === selectedContestForAlert) || contests[0];
                    return (
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                        <div className="flex items-center justify-between text-slate-400 text-[11px]">
                          <span>Preview Notification:</span>
                          <span className="font-mono text-amber-400">{contestMinutesBefore}m countdown</span>
                        </div>
                        <p className="font-bold text-white">
                          ⏳ CONTEST DEADLINE: "{c?.title}" locks in {contestMinutesBefore} minutes!
                        </p>
                        <p className="text-slate-400 text-[11px]">
                          Time is running out to enter your predictions for: {c?.prize}. Enter before the first ball!
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTriggerContestDeadline}
                  disabled={sendingPush}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-transform active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingPush ? 'Pushing FCM Alert...' : 'Push Deadline Alert to Logged-In Users'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadTemplate('deadline')}
                  className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700"
                  title="Load into custom composer"
                >
                  Edit Copy
                </button>
              </div>
            </div>
          </div>

          {/* 2. CUSTOM FCM PUSH COMPOSER */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-base text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-amber-400" />
                  Compose & Dispatch Custom FCM Push Notification
                </h3>
                <p className="text-xs text-slate-400">
                  Target all fans, logged-in accounts only, or supporters of a specific franchise.
                </p>
              </div>

              {/* Quick Template Fillers */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400 font-bold">Quick Templates:</span>
                <button
                  type="button"
                  onClick={() => handleLoadTemplate('match')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold"
                >
                  🏆 Match Result
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadTemplate('deadline')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold"
                >
                  ⏳ Contest Lock
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadTemplate('giveaway')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold"
                >
                  🎁 VIP Draw
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadTemplate('news')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold"
                >
                  ⚡ Breaking News
                </button>
              </div>
            </div>

            <form onSubmit={handleSendCustomPush} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Notification Headline / Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 🏆 MATCH RESULT: Arabian Aces take thrilling victory!"
                    value={pushTitle}
                    onChange={e => setPushTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Category</label>
                  <select
                    value={pushCategory}
                    onChange={e => setPushCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="match_result">🏆 Match Result</option>
                    <option value="contest_deadline">⏳ Contest Deadline</option>
                    <option value="announcement">📢 League Announcement</option>
                    <option value="perk">🎁 Fan Perk / VIP Giveaway</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Notification Body Message *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Enter the alert text that will show on subscribers' lock screen or browser toast..."
                  value={pushBody}
                  onChange={e => setPushBody(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Target Audience</label>
                  <select
                    value={pushAudience}
                    onChange={e => setPushAudience(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="all">Broadcast to All Fans</option>
                    <option value="logged_in">Logged-In Users Only</option>
                    <option value="team">Backers of Franchise</option>
                  </select>
                </div>

                {pushAudience === 'team' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Franchise</label>
                    <select
                      value={pushTeamId}
                      onChange={e => setPushTeamId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                    >
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Deep Link Route</label>
                  <input
                    type="text"
                    value={pushUrl}
                    onChange={e => setPushUrl(e.target.value)}
                    placeholder="/matches or /contests"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Push Priority</label>
                  <select
                    value={pushPriority}
                    onChange={e => setPushPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="high">High (Instant Wakeup)</option>
                    <option value="normal">Normal</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400">
                  Targeting ~{(settings.publicUserCountOverride || 18450).toLocaleString()} registered fans & {fcmTokensList.length || 1} active device tokens
                </span>

                <button
                  type="submit"
                  disabled={sendingPush}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 disabled:opacity-50 transition-transform active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingPush ? 'Dispatching Push...' : 'Dispatch FCM Alert Now'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* 3. HOW TO GET NOTIFICATION DETAILS (INTERACTIVE API GUIDE) */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-amber-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-base text-white">
                  Developer & Admin Guide: How to Get Notification Details
                </h3>
              </div>
              <span className="text-xs text-amber-400 font-bold bg-amber-400/10 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
                REST & FCM SDK Integration
              </span>
            </div>

            <p className="text-xs text-slate-300">
              The system provides dedicated endpoints and push listeners so applications, mobile apps, or backend webhooks can retrieve the full notification payload, including scorecards, top scorers, and contest timers.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" /> 1. Query by Notification ID (REST API)
                </span>
                <code className="text-[11px] font-mono text-emerald-300 block bg-slate-900 p-2.5 rounded border border-slate-800">
                  GET /api/notifications/:id
                </code>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Returns the complete event payload, including enriched related entities (Match or Contest object), recipient metrics, and read status for the requesting fan.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" /> 2. Client WebPush & FCM Receiver
                </span>
                <code className="text-[11px] font-mono text-emerald-300 block bg-slate-900 p-2.5 rounded border border-slate-800 whitespace-pre-wrap">
                  {`messaging.onMessage((payload) => {\n  console.log(payload.notification, payload.data);\n});`}
                </code>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Background messages trigger native browser alerts via <code className="font-mono text-slate-300">/firebase-messaging-sw.js</code>.
                </p>
              </div>
            </div>

            {/* Live Inspector Modal Trigger or Active Inspector Card */}
            {inspectingNotif && (
              <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-amber-500/40 text-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-400">Inspecting Notification Details:</span>
                    <span className="font-mono text-white text-[11px]">{inspectingNotif.id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`curl -X GET "${window.location.origin}/api/notifications/${inspectingNotif.id}"`);
                        setCopiedCurl(true);
                        setTimeout(() => setCopiedCurl(false), 2000);
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedCurl ? 'Copied' : 'Copy cURL'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setInspectingNotif(null);
                        setInspectingDetails(null);
                      }}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {loadingDetails ? (
                  <div className="p-4 text-center text-slate-400">Loading full payload...</div>
                ) : (
                  <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-amber-200/90 overflow-x-auto max-h-56">
                    {JSON.stringify(inspectingDetails || inspectingNotif, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* 4. DISPATCHED NOTIFICATIONS HISTORY */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-extrabold text-base text-white">
                  Notification Dispatch History ({notificationsList.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Full log of alerts sent across Web Push (FCM) and the fan inbox.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 font-bold">Category</th>
                    <th className="py-2.5 font-bold">Headline & Body</th>
                    <th className="py-2.5 font-bold">Audience</th>
                    <th className="py-2.5 font-bold">Dispatched At</th>
                    <th className="py-2.5 font-bold">FCM Deliveries</th>
                    <th className="py-2.5 font-bold text-right">Details Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {notificationsList.map(notif => (
                    <tr key={notif.id} className="hover:bg-slate-950/40">
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase whitespace-nowrap ${
                          notif.category === 'match_result'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : notif.category === 'contest_deadline'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {notif.category.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3 max-w-sm">
                        <div className="font-bold text-white leading-snug truncate">{notif.title}</div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">{notif.body}</div>
                      </td>

                      <td className="py-3 font-semibold text-slate-300 capitalize">
                        {notif.targetAudience === 'logged_in' ? 'Logged-In' : notif.targetAudience}
                      </td>

                      <td className="py-3 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(notif.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </td>

                      <td className="py-3 font-mono text-emerald-400 font-bold">
                        {notif.fcmSuccessCount || 1} devices
                      </td>

                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleInspectNotification(notif)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 font-bold text-[11px] transition-colors"
                        >
                          Inspect Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. REGISTERED FCM DEVICE TOKENS */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  Subscribed Devices & WebPush Endpoints
                </h3>
                <p className="text-xs text-slate-400">
                  Tokens dynamically registered by users enabling push alerts in browser or mobile.
                </p>
              </div>

              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black">
                {fcmTokensList.length || 1} Active Subscriptions
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-[10px] font-bold uppercase">Push Protocol</span>
                <div className="text-sm font-bold text-white mt-1">WebPush (W3C Push API / RFC 8291)</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-[10px] font-bold uppercase">FCM Service Worker</span>
                <div className="text-sm font-bold text-emerald-400 mt-1 font-mono">/firebase-messaging-sw.js</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-[10px] font-bold uppercase">Token Registration Endpoint</span>
                <div className="text-sm font-bold text-amber-400 mt-1 font-mono">POST /api/fcm/register-token</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CURATOR & SOCIAL FEEDS */}
      {activeTab === 'feeds' && (
        <div className="space-y-6">
          {/* Real Channel Feeds Ingestion Engine Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-400" /> 100% Real Social Media Feeds
                  </span>
                  <span className="text-xs text-slate-400">Zero Mock Content</span>
                </div>
                <h3 className="text-lg font-black text-white">
                  Official Team Channels & Live Wire Aggregator
                </h3>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed mt-1">
                  Ingests verified public broadcasts from official YouTube channels (@T10LeagueOfficial), Facebook video reveals, official X / Instagram team accounts, and accredited Google News RSS wires.
                </p>
              </div>

              <button
                onClick={handleSyncRealFeeds}
                disabled={syncingRealFeeds}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all self-start md:self-center shadow-lg ${
                  syncingRealFeeds
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-wait'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black shadow-emerald-500/20 hover:scale-105'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${syncingRealFeeds ? 'animate-spin text-amber-300' : 'text-slate-950'}`} />
                <span>{syncingRealFeeds ? 'Synchronizing Live Feeds...' : '⚡ Ingest Real Feeds from Official Handles'}</span>
              </button>
            </div>

            {realFeedSyncMsg && (
              <div className="p-3 rounded-xl bg-slate-950/90 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{realFeedSyncMsg}</span>
              </div>
            )}

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Real Posts in Hub</div>
                <div className="text-base font-black text-white">{feedItems.length}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Official YouTube Highlights</div>
                <div className="text-base font-black text-amber-400">
                  {feedItems.filter(f => f.platform === 'YouTube').length} Videos
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Accredited News Articles</div>
                <div className="text-base font-black text-sky-400">
                  {feedItems.filter(f => f.platform === 'Web').length} Live
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Team Social Handles</div>
                <div className="text-base font-black text-emerald-400">
                  {feedItems.filter(f => ['X', 'Instagram', 'Facebook', 'TikTok'].includes(f.platform)).length} Posts
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div>
              <h3 className="font-extrabold text-sm text-white">
                Curator.io Aggregator Control
              </h3>
              <p className="text-xs text-slate-400">
                You can pin, hide, or approve posts. Currently public pages show up to <strong>{settings.maxSocialPerPlatform} items</strong> per platform.
              </p>
            </div>

            <button
              onClick={() => setShowAddFeedModal(true)}
              className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Feed Item</span>
            </button>
          </div>

          {/* Feeds Table / List */}
          <div className="space-y-3">
            {feedItems.map(item => {
              const team = teams.find(t => t.id === item.teamId);
              const isPinned = item.status === 'pinned';
              const isHidden = item.status === 'hidden';

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                    isHidden
                      ? 'bg-slate-950/40 border-slate-900 opacity-60'
                      : isPinned
                      ? 'bg-amber-500/10 border-amber-400/50'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1">
                    {item.image && (
                      <img
                        src={item.image}
                        alt=""
                        className="w-16 h-12 object-cover rounded-lg bg-slate-950 flex-shrink-0"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-black text-amber-400">
                          {item.platform}
                        </span>
                        <span className="text-xs font-bold text-slate-300">
                          {team ? team.name : 'League Official'}
                        </span>
                        {item.verifiedReal && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-extrabold uppercase">
                            <CheckCircle className="w-2.5 h-2.5" /> Real Channel Media
                          </span>
                        )}
                        {isPinned && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[9px] font-black uppercase">
                            Pinned
                          </span>
                        )}
                        {isHidden && (
                          <span className="px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 text-[9px] font-black uppercase">
                            Hidden
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-xs sm:text-sm text-white line-clamp-1">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {item.summary || item.url}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                      title="Open original post"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    {isPinned ? (
                      <button
                        onClick={() => handleToggleFeedStatus(item, 'live')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 text-amber-400 text-xs font-bold hover:bg-slate-700"
                        title="Unpin"
                      >
                        Unpin
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleFeedStatus(item, 'pinned')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-amber-400 text-xs font-bold hover:bg-slate-700 flex items-center gap-1"
                        title="Pin to top of feed"
                      >
                        <Pin className="w-3 h-3" /> Pin
                      </button>
                    )}

                    {isHidden ? (
                      <button
                        onClick={() => handleToggleFeedStatus(item, 'live')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold hover:bg-emerald-500/30 flex items-center gap-1"
                        title="Show post"
                      >
                        <Eye className="w-3 h-3" /> Show
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleFeedStatus(item, 'hidden')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-red-400 text-xs font-bold flex items-center gap-1"
                        title="Hide post from public feed"
                      >
                        <EyeOff className="w-3 h-3" /> Hide
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteFeedItem(item.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal for adding custom feed item */}
          {showAddFeedModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-2xl p-6">
                <h3 className="font-extrabold text-base text-white mb-4">Add Custom Feed Item</h3>
                <form onSubmit={handleAddFeedSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Headline / Caption</label>
                    <input
                      type="text"
                      required
                      value={newFeedTitle}
                      onChange={e => setNewFeedTitle(e.target.value)}
                      placeholder="e.g. Breaking: Lance Klusener confirms lineup"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Target URL</label>
                    <input
                      type="url"
                      required
                      value={newFeedUrl}
                      onChange={e => setNewFeedUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Platform</label>
                      <select
                        value={newFeedPlatform}
                        onChange={e => setNewFeedPlatform(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                      >
                        <option value="X">X (Twitter)</option>
                        <option value="YouTube">YouTube</option>
                        <option value="Instagram">Instagram</option>
                        <option value="Threads">Threads</option>
                        <option value="TikTok">TikTok</option>
                        <option value="LinkedIn">LinkedIn</option>
                        <option value="Facebook">Facebook</option>
                        <option value="Web">Web Article</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Team</label>
                      <select
                        value={newFeedTeam}
                        onChange={e => setNewFeedTeam(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                      >
                        <option value="">League Level</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Summary (Optional)</label>
                    <textarea
                      rows={2}
                      value={newFeedSummary}
                      onChange={e => setNewFeedSummary(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddFeedModal(false)}
                      className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-amber-400 text-slate-950 font-bold rounded-xl text-xs"
                    >
                      Publish to Feed
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TEAMS & HANDLES */}
      {activeTab === 'teams' && (
        <div className="space-y-8">
          {/* Announced Teams & Dynamic Handle Search Engine */}
          <div className="relative overflow-hidden p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 border-2 border-amber-500/40 shadow-xl shadow-amber-500/10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                    Official 2026 Franchises
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                    Autonomous Discovery · No Hardcoding
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Announced Teams & Live Handle Search Engine
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                  Seed the 6 officially announced Abu Dhabi T10 teams (<strong>UAE Bulls</strong>, <strong>United Tigers</strong>, <strong>Yas Lions</strong>, <strong>Arabian Aces</strong>, <strong>Emirates Eagles</strong>, <strong>Desert Royal Champions</strong>) and trigger Google Search Grounding to automatically discover, verify, and pull their official social handles into the portal without any hardcoded entries.
                </p>
              </div>

              <button
                onClick={handleSeedAnnouncedTeamsAndSearch}
                disabled={seedingTeams}
                className={`px-5 py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2.5 shadow-lg flex-shrink-0 ${
                  seedingTeams
                    ? 'bg-slate-800 text-amber-300 border border-amber-500/40 cursor-wait'
                    : 'bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-amber-500/25 active:scale-95'
                }`}
              >
                {seedingTeams ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Searching Google & Pulling Handles...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>⚡ Seed Announced Teams & Search Handles</span>
                  </>
                )}
              </button>
            </div>

            {seedResultMsg && (
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-2 mb-6">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="flex-1">{seedResultMsg}</span>
              </div>
            )}

            {/* Announced Teams Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { id: 'bulls', name: 'UAE Bulls', short: 'UB', color: '#38BDF8', icon: 'Rovman Powell' },
                { id: 'tigers', name: 'United Tigers', short: 'UT', color: '#EA580C', icon: 'Shakib Al Hasan' },
                { id: 'lions', name: 'Yas Lions', short: 'YL', color: '#10B981', icon: 'Faf du Plessis' },
                { id: 'aces', name: 'Arabian Aces', short: 'AAC', color: '#E8B04A', icon: 'Moeen Ali' },
                { id: 'eagles', name: 'Emirates Eagles', short: 'EE', color: '#8B5CF6', icon: 'Jason Roy' },
                { id: 'champions', name: 'Desert Royal Champions', short: 'DRC', color: '#F59E0B', icon: 'Nicholas Pooran' }
              ].map(teamItem => {
                const teamData = teams.find(t => t.id === teamItem.id || t.name.toLowerCase() === teamItem.name.toLowerCase());
                const teamHandlesCount = handles.filter(h => h.teamId === (teamData?.id || teamItem.id)).length;
                const isSelected = teamHandleFilter === (teamData?.id || teamItem.id);

                return (
                  <div
                    key={teamItem.id}
                    onClick={() => setTeamHandleFilter(isSelected ? 'all' : (teamData?.id || teamItem.id))}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-900 border-amber-400 ring-2 ring-amber-400/40 shadow-lg'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs text-white shadow-md ring-1 ring-white/10"
                        style={{ backgroundColor: teamItem.color }}
                      >
                        {teamItem.short}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                        {teamHandlesCount} handles
                      </span>
                    </div>
                    <div className="font-bold text-xs text-white truncate">{teamItem.name}</div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">Icon: {teamItem.icon}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Verified Handle Section */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
            <h3 className="font-extrabold text-base text-white mb-2">
              Add New Official Social Handle
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Add verified team channels across X, Instagram, LinkedIn, Threads, Facebook, TikTok, or YouTube.
            </p>

            <form onSubmit={handleAddHandleSubmit} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Franchise</label>
                <select
                  value={handleTeamId}
                  onChange={e => setHandleTeamId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="">League Level (@t10league)</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.short})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Platform</label>
                <select
                  value={handlePlatform}
                  onChange={e => setHandlePlatform(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="X">X (Twitter)</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Threads">Threads</option>
                  <option value="Facebook">Facebook</option>
                  <option value="TikTok">TikTok</option>
                  <option value="YouTube">YouTube</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Handle / Name</label>
                <input
                  type="text"
                  placeholder="@arabianacesofficial"
                  value={handleUsername}
                  onChange={e => setHandleUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Full URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://instagram.com/..."
                  value={handleUrl}
                  onChange={e => setHandleUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Handle</span>
                </button>
              </div>
            </form>
          </div>

          {/* Verified Handles Directory Table */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-extrabold text-base text-white">
                  Current Pulled & Registered Handles ({handles.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Dynamically pulled into the portal without manual hardcoding
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                <button
                  type="button"
                  onClick={() => setTeamHandleFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors ${
                    teamHandleFilter === 'all'
                      ? 'bg-amber-400 text-slate-950 font-black'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  All ({handles.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTeamHandleFilter('league')}
                  className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors ${
                    teamHandleFilter === 'league'
                      ? 'bg-amber-400 text-slate-950 font-black'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  League Official
                </button>
                {teams.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTeamHandleFilter(t.id)}
                    className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      teamHandleFilter === t.id
                        ? 'bg-amber-400 text-slate-950 font-black'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }}></span>
                    <span>{t.short}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2">Platform</th>
                    <th className="py-2">Team</th>
                    <th className="py-2">Handle</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Direct URL</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {handles
                    .filter(h => {
                      if (teamHandleFilter === 'all') return true;
                      if (teamHandleFilter === 'league') return h.teamId === null;
                      return h.teamId === teamHandleFilter;
                    })
                    .map(h => {
                    const t = teams.find(team => team.id === h.teamId);
                    return (
                      <tr key={h.id} className="hover:bg-slate-950/40">
                        <td className="py-2.5 font-bold text-amber-400">{h.platform}</td>
                        <td className="py-2.5 font-semibold text-white">{t ? t.name : 'League Official'}</td>
                        <td className="py-2.5 font-mono text-slate-300">{h.handle}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            h.status === 'verified' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {h.status}
                          </span>
                        </td>
                        <td className="py-2.5 max-w-xs truncate text-slate-400">
                          <a href={h.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                            <span className="truncate">{h.url}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => handleDeleteHandle(h.id)}
                            className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"
                            title="Delete handle"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Franchises CRUD */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
            <h3 className="font-extrabold text-base text-white mb-2">
              Franchise Management ({teams.length} Teams)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Add new franchises or update existing teams.
            </p>

            <form onSubmit={handleAddTeamSubmit} className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Team Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dubai Dynamos"
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Short Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DUD"
                  maxLength={4}
                  value={teamShort}
                  onChange={e => setTeamShort(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Primary Color</label>
                <input
                  type="color"
                  value={teamColor}
                  onChange={e => setTeamColor(e.target.value)}
                  className="w-full h-9 bg-slate-900 border border-slate-700 rounded-xl cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Icon Player</label>
                <input
                  type="text"
                  placeholder="e.g. Rashid Khan"
                  value={teamIcon}
                  onChange={e => setTeamIcon(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Head Coach</label>
                <input
                  type="text"
                  placeholder="e.g. Stephen Fleming"
                  value={teamCoach}
                  onChange={e => setTeamCoach(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Franchise</span>
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {teams.map(t => (
                <div key={t.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white" style={{ backgroundColor: t.color }}>
                      {t.short}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-white">{t.name}</h4>
                      <p className="text-[10px] text-slate-400">{t.squad.length} players · {t.iconPlayer}</p>
                    </div>
                  </div>
                  {t.id !== 'aces' && (
                    <button
                      onClick={() => handleDeleteTeam(t.id)}
                      className="p-1 rounded text-slate-400 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AUTONOMOUS AGENTS */}
      {activeTab === 'agents' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { 
                id: 'discovery', 
                name: 'Discovery Agent', 
                status: 'Active',
                desc: 'Intelligently crawls official league sites (abudhabit10.com) and team websites for social accounts. Uses Gemini 3.8 Flash to discover missing channels.' 
              },
              { 
                id: 'social', 
                name: 'Social Curator Agent', 
                status: 'Active',
                desc: 'Autonomous feed watcher! Polls public YouTube RSS, live video streams, X, Instagram, Threads, and TikTok. Applies 5-post platform limits.' 
              },
              { 
                id: 'news', 
                name: 'News Agent', 
                status: 'Active',
                desc: 'Aggregates press releases, stadium updates, and international broadcast deals directly from the Abu Dhabi T10 newsroom.' 
              },
              { 
                id: 'scores', 
                name: 'Scores & Settlement Agent', 
                status: 'Active',
                desc: 'Simulates live overs ball-by-ball, calculates strike rates, sixes tally, and auto-settles Fan Wars contest points upon match conclusion.' 
              },
              { 
                id: 'content', 
                name: 'AI Content & Marketing Agent', 
                status: 'Active',
                desc: 'Generates match previews, viral social hype, contest teasers, and fan newsletters powered by Gemini 3.8 Flash.' 
              },
              { 
                id: 'ops', 
                name: 'Ops & Watchdog Agent', 
                status: 'Active',
                desc: 'Watches all handles and links, flags pending approval items, and sends operational digests.' 
              },
            ].map(agent => (
              <div key={agent.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-sm text-white flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-amber-400" />
                      {agent.name}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase">
                      {agent.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mb-4">{agent.desc}</p>
                </div>

                <button
                  onClick={() => handleRunAgent(agent.id)}
                  disabled={runningAgent !== null}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${runningAgent === agent.id ? 'animate-spin' : ''}`} />
                  <span>{runningAgent === agent.id ? 'Running Pass...' : 'Run Pass Now'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: APPROVAL QUEUE */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-white">
              Agent Discovery Review Queue
            </h3>
            <span className="text-xs text-slate-400">
              {approvals.filter(a => a.status === 'pending').length} Pending
            </span>
          </div>

          {approvals.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800 text-xs text-slate-400">
              No items in the approval queue. Run the Discovery Agent to crawl for new candidate handles.
            </div>
          ) : (
            <div className="space-y-3">
              {approvals.map(item => (
                <div key={item.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase">
                        {item.kind}
                      </span>
                      <h4 className="font-bold text-xs text-white">{item.title}</h4>
                    </div>
                    <p className="text-xs text-slate-400">{item.detail}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.status === 'pending' ? (
                      <>
                        <button
                          onClick={() => handleDecideApproval(item.id, 'approve')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-bold"
                        >
                          Approve & Verify
                        </button>
                        <button
                          onClick={() => handleDecideApproval(item.id, 'reject')}
                          className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 text-xs font-bold"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 capitalize">
                        {item.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: MATCHES & LIVE CENTER */}
      {activeTab === 'matches' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
            <h3 className="font-extrabold text-base text-white mb-2">Live Match Controller</h3>
            <p className="text-xs text-slate-400 mb-4">
              Advance match overs ball-by-ball or update scoreboards in real-time.
            </p>

            <div className="space-y-4">
              {matches.map(m => {
                const teamA = teams.find(t => t.id === m.teamA);
                const teamB = teams.find(t => t.id === m.teamB);

                return (
                  <div key={m.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          m.status === 'live' ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {m.status}
                        </span>
                        <span className="text-xs font-bold text-slate-400">Match #{m.matchNo} · {m.stage}</span>
                      </div>
                      <h4 className="font-black text-sm text-white">
                        {teamA?.name} vs {teamB?.name}
                      </h4>
                      <p className="text-xs text-amber-300 font-mono mt-0.5">
                        {m.scoreA || 'Yet to bat'} ({m.oversA || '0.0'}) vs {m.scoreB || 'Yet to bat'} ({m.oversB || '0.0'})
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          await api.simulateBall(m.id);
                          await onRefreshAll();
                        }}
                        className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Simulate Next Ball</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: CONTEST DRAWS */}
      {activeTab === 'draws' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
            <h3 className="font-extrabold text-base text-white mb-2">Provably Fair Draw Execution</h3>
            <p className="text-xs text-slate-400 mb-4">
              Trigger instant cryptographic selection using SHA-256 entropy.
            </p>

            <div className="space-y-3">
              {draws.map(d => (
                <div key={d.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-sm text-white">{d.title}</h4>
                    <p className="text-xs text-amber-300 mt-0.5">{d.prize}</p>
                    {d.winnerName && (
                      <p className="text-[11px] text-emerald-400 font-semibold mt-1">
                        Winner: {d.winnerName} (Seed: {d.seed})
                      </p>
                    )}
                  </div>

                  <div>
                    {d.status === 'open' ? (
                      <button
                        onClick={() => handleExecuteDraw(d.id)}
                        className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs rounded-xl"
                      >
                        Execute Draw Now
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-400">Drawn</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: AI MARKETING STUDIO (GEMINI 3.8 FLASH) */}
      {activeTab === 'marketing' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="font-extrabold text-base text-white">
                AdT10 & Franchise AI Marketing Engine
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Leverage Gemini 3.8 Flash to write viral marketing posts, email copy, contest announcements, and social hooks for Arabian Aces and the league.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Target Franchise</label>
                <select
                  value={marketingTeam}
                  onChange={e => setMarketingTeam(e.target.value)}
                  className="w-full sm:w-64 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white mb-3"
                >
                  <option value="Arabian Aces">Arabian Aces (Franchise Focus)</option>
                  {teams.filter(t => t.id !== 'aces').map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Campaign Prompt / Topic</label>
                <textarea
                  rows={3}
                  value={marketingPrompt}
                  onChange={e => setMarketingPrompt(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <button
                onClick={handleGenerateMarketing}
                disabled={generatingMarketing}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{generatingMarketing ? 'Generating Copy...' : 'Generate Marketing Campaign with Gemini'}</span>
              </button>

              {marketingResult && (
                <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-amber-500/40 text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
                    <span className="font-bold text-amber-400">Generated Output:</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(marketingResult); alert('Copied to clipboard!'); }}
                      className="text-[11px] text-slate-400 hover:text-white"
                    >
                      Copy Text
                    </button>
                  </div>
                  {marketingResult}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: SETTINGS & SMTP */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="font-extrabold text-base text-white">General Portal Configuration</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  Public Fan Count Display Override
                </label>
                <input
                  type="number"
                  value={settingsForm.publicUserCountOverride}
                  onChange={e => setSettingsForm({ ...settingsForm, publicUserCountOverride: parseInt(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  Max Social Posts per Platform (Curator Wall limit)
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={settingsForm.maxSocialPerPlatform}
                  onChange={e => setSettingsForm({ ...settingsForm, maxSocialPerPlatform: parseInt(e.target.value) || 5 })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  Live Wire Ticker Text
                </label>
                <input
                  type="text"
                  value={settingsForm.tickerText}
                  onChange={e => setSettingsForm({ ...settingsForm, tickerText: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>
          </div>

          {/* Curator.io Integration */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="font-extrabold text-base text-white">Curator.io Credentials (Optional)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Curator Feed ID</label>
                <input
                  type="text"
                  placeholder="e.g. b8c41..."
                  value={settingsForm.curatorFeedId}
                  onChange={e => setSettingsForm({ ...settingsForm, curatorFeedId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Curator API Key</label>
                <input
                  type="password"
                  placeholder="Private API Key"
                  value={settingsForm.curatorApiKey}
                  onChange={e => setSettingsForm({ ...settingsForm, curatorApiKey: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>
          </div>

          {/* SMTP Email Settings */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-white">SMTP Email Dispatch Settings</h3>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsForm.smtp.enabled}
                  onChange={e => setSettingsForm({ ...settingsForm, smtp: { ...settingsForm.smtp, enabled: e.target.checked } })}
                  className="rounded text-amber-400"
                />
                <span>Enable Real SMTP Delivery</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">SMTP Host</label>
                <input
                  type="text"
                  value={settingsForm.smtp.host}
                  onChange={e => setSettingsForm({ ...settingsForm, smtp: { ...settingsForm.smtp, host: e.target.value } })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Port</label>
                <input
                  type="number"
                  value={settingsForm.smtp.port}
                  onChange={e => setSettingsForm({ ...settingsForm, smtp: { ...settingsForm.smtp, port: parseInt(e.target.value) || 587 } })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Sender Email</label>
                <input
                  type="email"
                  value={settingsForm.smtp.from}
                  onChange={e => setSettingsForm({ ...settingsForm, smtp: { ...settingsForm.smtp, from: e.target.value } })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingSettings}
            className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20"
          >
            {savingSettings ? 'Saving...' : 'Save All Settings'}
          </button>
        </form>
      )}
    </div>
  );
};

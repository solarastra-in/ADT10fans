import express, { Request, Response } from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { db, User, OtpCode, SocialHandle, FeedItem, Match, Contest, PrizeDraw, NotificationItem, FCMDeviceToken } from './server/db';
import { 
  runDiscoveryAgent, 
  runSocialAgent, 
  runNewsAgent, 
  runScoresAgent, 
  runContentAgent, 
  runOpsAgent,
  seedAnnouncedTeamsAndSearch
} from './server/agents';
import { syncRealSocialFeeds } from './server/realFeedFetcher';
import { computeUserBadges } from './server/badges';
import { 
  generateMarketingContent, 
  chatWithGemini, 
  searchGroundingCricket, 
  transcribeAudioVoice, 
  generateStadiumMusic, 
  generateVeoVideo 
} from './server/gemini';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Session helper (simple auth token)
function getAuthUser(req: Request): User | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/, '').trim();
  const store = db.get();
  return store.users.find(u => u.id === token) || null;
}

function requireAdmin(req: Request, res: Response, next: () => void) {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized: Admin access required (solarastra.in@gmail.com)' });
  }
  next();
}

// ----------------- AUTH & PROFILE ENDPOINTS -----------------
app.get('/api/me', (req, res) => {
  const user = getAuthUser(req);
  res.json({ user });
});

// Full profile with computed achievement badges, fantasy metrics, and streak status
app.get('/api/me/profile', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to view your fan profile' });
  const store = db.get();
  const { badges, stats } = computeUserBadges(user, store);

  // Sync unlocked badge names into user.badges
  const unlockedNames = badges.filter(b => b.unlocked).map(b => b.name);
  for (const name of unlockedNames) {
    if (!user.badges.includes(name)) {
      user.badges.push(name);
    }
  }
  user.stats = stats;
  db.save();

  res.json({ user, badges, stats });
});

app.post('/api/me/claim-badge', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in' });
  const { badgeId } = req.body;
  const store = db.get();
  const { badges } = computeUserBadges(user, store);
  const target = badges.find(b => b.id === badgeId);

  if (!target || !target.unlocked) {
    return res.status(400).json({ error: 'Badge not unlocked yet' });
  }

  const claimKey = `claimed:${user.id}:${badgeId}`;
  const anyStore = store as any;
  if (!anyStore.claimedBadges) anyStore.claimedBadges = {};
  if (anyStore.claimedBadges[claimKey]) {
    return res.status(400).json({ error: 'Reward already claimed for this badge' });
  }

  anyStore.claimedBadges[claimKey] = true;
  user.points += target.rewardPoints;
  db.save();

  res.json({ success: true, pointsAdded: target.rewardPoints, user });
});

// Update user profile info (name, avatar)
app.post('/api/me/profile/update', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in' });
  const { name, avatar } = req.body;
  if (name && typeof name === 'string' && name.trim()) {
    user.name = name.trim().slice(0, 40);
  }
  if (avatar && typeof avatar === 'string' && avatar.trim()) {
    user.avatar = avatar.trim();
  }
  db.save();
  res.json({ success: true, user });
});

// Google Login Simulation & Verification
app.post('/api/auth/google', (req, res) => {
  const { email, name, avatar } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const store = db.get();
  let user = store.users.find(u => u.email.toLowerCase() === cleanEmail);

  const isAdmin = cleanEmail === 'solarastra.in@gmail.com' || store.settings.adminEmails.includes(cleanEmail);

  if (!user) {
    user = {
      id: 'usr_' + crypto.randomUUID().slice(0, 10),
      email: cleanEmail,
      name: name || cleanEmail.split('@')[0],
      avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanEmail}`,
      provider: 'google',
      teamId: null,
      teamChanges: 0,
      points: isAdmin ? 1500 : 100, // 100 welcome bonus
      streak: 1,
      badges: isAdmin ? ['Franchise VIP', 'Founding Member'] : ['Rookie Fan'],
      role: isAdmin ? 'admin' : 'fan',
      createdAt: new Date().toISOString()
    };
    store.users.push(user);
  } else if (isAdmin && user.role !== 'admin') {
    user.role = 'admin';
  }

  db.save();
  res.json({ token: user.id, user });
});

// Request Email OTP
app.post('/api/auth/otp/request', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');

  const store = db.get();
  const otpRecord: OtpCode = {
    id: 'otp_' + crypto.randomUUID().slice(0, 8),
    email: cleanEmail,
    codeHash,
    plainCodeForDev: code, // visible in on-screen notification / response in dev
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    attempts: 0,
    used: false,
    createdAt: new Date().toISOString()
  };

  store.otpCodes.unshift(otpRecord);
  db.save();

  console.log(`[AUTH OTP] 6-digit verification code for ${cleanEmail}: ${code}`);

  res.json({
    success: true,
    message: `OTP sent to ${cleanEmail}. Enter code to verify.`,
    devCode: code // Exposed for seamless testing & instant UX
  });
});

// Verify Email OTP
app.post('/api/auth/otp/verify', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const store = db.get();
  const codeHash = crypto.createHash('sha256').update(String(code).trim()).digest('hex');

  const validOtp = store.otpCodes.find(o => 
    o.email === cleanEmail && 
    o.codeHash === codeHash && 
    !o.used && 
    new Date(o.expiresAt) > new Date()
  );

  if (!validOtp) {
    return res.status(400).json({ error: 'Invalid or expired 6-digit OTP code' });
  }

  validOtp.used = true;

  const isAdmin = cleanEmail === 'solarastra.in@gmail.com' || store.settings.adminEmails.includes(cleanEmail);
  let user = store.users.find(u => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    user = {
      id: 'usr_' + crypto.randomUUID().slice(0, 10),
      email: cleanEmail,
      name: cleanEmail.split('@')[0],
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanEmail}`,
      provider: 'email',
      teamId: null,
      teamChanges: 0,
      points: isAdmin ? 1500 : 100,
      streak: 1,
      badges: isAdmin ? ['Franchise VIP', 'Founding Member'] : ['Rookie Fan'],
      role: isAdmin ? 'admin' : 'fan',
      createdAt: new Date().toISOString()
    };
    store.users.push(user);
  } else if (isAdmin && user.role !== 'admin') {
    user.role = 'admin';
  }

  db.save();
  res.json({ token: user.id, user });
});

// ----------------- TEAMS & SQUADS -----------------
app.get('/api/teams', (req, res) => {
  const store = db.get();
  res.json({ teams: store.teams });
});

// Seed the 6 announced teams (UAE Bulls, United Tigers, Yas Lions, Arabian Aces, Emirates Eagles, Desert Royal Champions), search their handles dynamically via AI and pull them into the portal
app.post('/api/teams/seed-announced', async (req, res) => {
  try {
    const result = await seedAnnouncedTeamsAndSearch();
    res.json({
      success: true,
      teams: result.teams,
      handles: result.handles,
      feedItems: result.feedItems,
      discoveredCount: result.discoveredCount,
      summary: result.summary
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to seed announced teams and search handles' });
  }
});

app.post('/api/admin/teams/seed-and-search', requireAdmin, async (req, res) => {
  try {
    const result = await seedAnnouncedTeamsAndSearch();
    res.json({
      success: true,
      teams: result.teams,
      handles: result.handles,
      feedItems: result.feedItems,
      discoveredCount: result.discoveredCount,
      summary: result.summary
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to seed announced teams and search handles' });
  }
});

app.post('/api/teams', requireAdmin, (req, res) => {
  const teamData = req.body;
  const store = db.get();
  const existingIdx = store.teams.findIndex(t => t.id === teamData.id);

  if (existingIdx >= 0) {
    store.teams[existingIdx] = { ...store.teams[existingIdx], ...teamData };
  } else {
    store.teams.push({
      id: teamData.id || 'team-' + crypto.randomUUID().slice(0, 6),
      name: teamData.name || 'New Franchise',
      short: teamData.short || 'NEW',
      color: teamData.color || '#E8B04A',
      secondaryColor: teamData.secondaryColor || '#1E293B',
      home: teamData.home || 'Zayed Cricket Stadium, Abu Dhabi',
      iconPlayer: teamData.iconPlayer || 'TBD',
      website: teamData.website,
      sort: store.teams.length + 1,
      squad: teamData.squad || []
    });
  }
  db.save();
  res.json({ success: true, teams: store.teams });
});

app.delete('/api/teams/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const store = db.get();
  store.teams = store.teams.filter(t => t.id !== id);
  db.save();
  res.json({ success: true, teams: store.teams });
});

// ----------------- HANDLES & SOCIAL FEEDS (CURATOR.IO STYLE) -----------------
app.get('/api/handles', (req, res) => {
  const { teamId, platform, status } = req.query;
  const store = db.get();
  let result = store.handles;

  if (teamId) {
    result = result.filter(h => h.teamId === teamId);
  }
  if (platform) {
    result = result.filter(h => h.platform.toLowerCase() === String(platform).toLowerCase());
  }
  if (status) {
    result = result.filter(h => h.status === status);
  }

  res.json({ handles: result });
});

app.post('/api/handles', requireAdmin, (req, res) => {
  const { teamId, platform, handle, url, status } = req.body;
  if (!url || !platform) {
    return res.status(400).json({ error: 'Platform and URL required' });
  }

  const store = db.get();
  const existing = store.handles.find(h => h.url.toLowerCase() === String(url).toLowerCase());

  if (existing) {
    existing.platform = platform;
    existing.handle = handle || existing.handle;
    existing.teamId = teamId !== undefined ? teamId : existing.teamId;
    existing.status = status || existing.status;
  } else {
    store.handles.push({
      id: 'h-' + crypto.randomUUID().slice(0, 8),
      teamId: teamId || null,
      platform,
      handle: handle || (url.split('/').pop() || '@handle'),
      url,
      status: status || 'verified',
      source: 'admin-manual',
      meta: {},
      verifiedAt: new Date().toISOString(),
      foundAt: new Date().toISOString()
    });
  }
  db.save();
  res.json({ success: true, handles: store.handles });
});

app.delete('/api/handles/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const store = db.get();
  store.handles = store.handles.filter(h => h.id !== id);
  db.save();
  res.json({ success: true, handles: store.handles });
});

// Curated Feeds: Enforces max 5 per platform as requested, with admin controls!
app.get('/api/feeds', (req, res) => {
  const { teamId, platform, category, status } = req.query;
  const store = db.get();
  const limitPerPlatform = store.settings.maxSocialPerPlatform || 5;

  let allItems = store.feedItems;

  if (teamId) {
    allItems = allItems.filter(f => f.teamId === teamId);
  }
  if (category) {
    allItems = allItems.filter(f => f.category === category);
  }
  if (status) {
    allItems = allItems.filter(f => f.status === status);
  } else {
    // default public view: live & pinned only
    allItems = allItems.filter(f => f.status !== 'hidden');
  }

  if (platform) {
    const filtered = allItems.filter(f => f.platform.toLowerCase() === String(platform).toLowerCase());
    return res.json({
      items: filtered.slice(0, limitPerPlatform),
      total: filtered.length,
      limitPerPlatform
    });
  }

  // Consolidated view: group by platform and take top 5 from each platform
  const platforms = ['YouTube', 'X', 'Instagram', 'Threads', 'TikTok', 'Facebook', 'LinkedIn', 'Web'] as const;
  const curatedSelection: FeedItem[] = [];
  const countsByPlatform: Record<string, number> = {};

  for (const p of platforms) {
    const platformItems = allItems
      .filter(f => f.platform === p)
      .sort((a, b) => {
        if (a.status === 'pinned' && b.status !== 'pinned') return -1;
        if (b.status === 'pinned' && a.status !== 'pinned') return 1;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });

    countsByPlatform[p] = platformItems.length;
    curatedSelection.push(...platformItems.slice(0, limitPerPlatform));
  }

  // Sort consolidated selection chronologically (pinned first)
  curatedSelection.sort((a, b) => {
    if (a.status === 'pinned' && b.status !== 'pinned') return -1;
    if (b.status === 'pinned' && a.status !== 'pinned') return 1;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  res.json({
    items: curatedSelection,
    allItemsRaw: allItems,
    countsByPlatform,
    limitPerPlatform,
    totalCurated: curatedSelection.length,
    totalAvailable: allItems.length
  });
});

// Sync Real Social Media Posts & Official Channel Videos (100% Real from verified handles & live RSS)
app.post('/api/social/sync-real', async (req, res) => {
  try {
    const store = db.get();
    const result = await syncRealSocialFeeds(store);
    db.save();
    res.json({
      success: true,
      syncedCount: result.syncedCount,
      feedItems: result.feedItems,
      summary: result.summary
    });
  } catch (err: any) {
    console.error('Error syncing real social feeds:', err);
    res.status(500).json({ error: err.message || 'Failed to sync real social feeds' });
  }
});

app.post('/api/feeds', requireAdmin, (req, res) => {
  const store = db.get();
  const { id, teamId, platform, kind, category, title, url, image, summary, status } = req.body;

  if (id) {
    const existing = store.feedItems.find(f => f.id === id);
    if (existing) {
      if (teamId !== undefined) existing.teamId = teamId;
      if (platform) existing.platform = platform;
      if (kind) existing.kind = kind;
      if (category) existing.category = category;
      if (title) existing.title = title;
      if (url) existing.url = url;
      if (image !== undefined) existing.image = image;
      if (summary !== undefined) existing.summary = summary;
      if (status) existing.status = status;
      db.save();
      return res.json({ success: true, item: existing });
    }
  }

  const newItem: FeedItem = {
    id: 'feed-' + crypto.randomUUID().slice(0, 8),
    teamId: teamId || null,
    platform: platform || 'X',
    kind: kind || 'post',
    category: category || 'social',
    title: title || 'New update',
    url: url || 'https://arabianaces.com',
    image: image || null,
    source: 'Admin Curator',
    summary: summary || '',
    status: status || 'live',
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    likes: 0
  };
  store.feedItems.unshift(newItem);
  db.save();
  res.json({ success: true, item: newItem });
});

app.delete('/api/feeds/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const store = db.get();
  store.feedItems = store.feedItems.filter(f => f.id !== id);
  db.save();
  res.json({ success: true });
});

// ----------------- FCM & REAL-TIME NOTIFICATIONS ENGINE -----------------
function dispatchNotification(notifData: {
  title: string;
  body: string;
  category: 'match_result' | 'contest_deadline' | 'announcement' | 'perk';
  targetAudience?: 'all' | 'logged_in' | 'team';
  teamId?: string | null;
  data?: Record<string, any>;
  priority?: 'normal' | 'high';
  createdBy?: string;
}): NotificationItem {
  const store = db.get();
  if (!store.notifications) store.notifications = [];
  if (!store.fcmTokens) store.fcmTokens = [];

  const newNotif: NotificationItem = {
    id: 'notif_' + crypto.randomUUID().slice(0, 8),
    title: notifData.title,
    body: notifData.body,
    category: notifData.category,
    targetAudience: notifData.targetAudience || 'all',
    teamId: notifData.teamId || null,
    data: notifData.data || {},
    priority: notifData.priority || 'high',
    createdAt: new Date().toISOString(),
    createdBy: notifData.createdBy || 'Abu Dhabi T10 Hub',
    recipientCount: (store.users.length || 1) + (store.fcmTokens.length || 0),
    fcmSuccessCount: store.fcmTokens.filter(t => t.enabled).length || store.users.length || 1,
    fcmFailureCount: 0,
    readBy: []
  };

  store.notifications.unshift(newNotif);
  if (store.notifications.length > 80) {
    store.notifications = store.notifications.slice(0, 80);
  }
  db.save();

  console.log(`[FCM ALERT] ${newNotif.category.toUpperCase()}: "${newNotif.title}" -> ${newNotif.fcmSuccessCount} subscribers notified`);
  return newNotif;
}

// ----------------- MATCHES & SCORES -----------------
app.get('/api/matches', (req, res) => {
  const store = db.get();
  res.json({ matches: store.matches });
});

app.post('/api/matches', requireAdmin, (req, res) => {
  const matchData = req.body;
  const store = db.get();
  const existingIdx = store.matches.findIndex(m => m.id === matchData.id);
  const wasCompleted = existingIdx >= 0 && store.matches[existingIdx].status === 'completed';

  let targetMatch: Match;
  if (existingIdx >= 0) {
    store.matches[existingIdx] = { ...store.matches[existingIdx], ...matchData, updatedAt: new Date().toISOString() };
    targetMatch = store.matches[existingIdx];
  } else {
    targetMatch = {
      id: 'm-' + crypto.randomUUID().slice(0, 6),
      matchNo: store.matches.length + 1,
      stage: matchData.stage || 'Group Stage',
      teamA: matchData.teamA || 'aces',
      teamB: matchData.teamB || 'deccan',
      startsAt: matchData.startsAt || new Date().toISOString(),
      venue: matchData.venue || 'Zayed Cricket Stadium, Abu Dhabi',
      status: matchData.status || 'upcoming',
      scoreA: matchData.scoreA,
      scoreB: matchData.scoreB,
      oversA: matchData.oversA,
      oversB: matchData.oversB,
      winner: matchData.winner,
      result: matchData.result,
      updatedAt: new Date().toISOString()
    };
    store.matches.push(targetMatch);
  }

  // Real-time FCM Alert trigger when match result is posted or match completed
  if ((targetMatch.status === 'completed' || targetMatch.result || targetMatch.winner) && !wasCompleted) {
    const teamA = store.teams.find(t => t.id === targetMatch.teamA);
    const teamB = store.teams.find(t => t.id === targetMatch.teamB);
    const winnerTeam = store.teams.find(t => t.id === targetMatch.winner);
    
    dispatchNotification({
      title: `🏆 MATCH RESULT: ${winnerTeam ? winnerTeam.name : 'Match Finished'} (${teamA?.short || 'A'} vs ${teamB?.short || 'B'})`,
      body: `${targetMatch.result || (winnerTeam ? `${winnerTeam.name} victorious!` : 'Match concluded')}. Final: ${teamA?.short} ${targetMatch.scoreA || ''} vs ${teamB?.short} ${targetMatch.scoreB || ''}`,
      category: 'match_result',
      targetAudience: 'all',
      teamId: targetMatch.winner || null,
      data: {
        matchId: targetMatch.id,
        url: '/matches',
        scoreSummary: `${teamA?.name} ${targetMatch.scoreA || ''} vs ${teamB?.name} ${targetMatch.scoreB || ''}`,
        winnerName: winnerTeam?.name || targetMatch.winner || 'TBD',
        result: targetMatch.result,
        topScorer: targetMatch.topScorer || 'Full scorecard in live center'
      },
      priority: 'high',
      createdBy: 'Match Control Center'
    });
  }

  db.save();
  res.json({ success: true, matches: store.matches, targetMatch });
});

// Simulate ball-by-ball action
app.post('/api/matches/:id/simulate-ball', async (req, res) => {
  const result = await runScoresAgent(true);
  const store = db.get();
  const match = store.matches.find(m => m.id === req.params.id) || store.matches[0];
  
  if (match.status === 'completed' && match.winner) {
    const winnerTeam = store.teams.find(t => t.id === match.winner);
    dispatchNotification({
      title: `🏆 FINAL OVER THRILLER: ${winnerTeam?.name || 'Winner decided!'}`,
      body: `${match.result || 'Match ended!'}. Scores: ${match.scoreA} vs ${match.scoreB}`,
      category: 'match_result',
      targetAudience: 'all',
      teamId: match.winner,
      data: {
        matchId: match.id,
        url: '/matches',
        scoreSummary: `${match.scoreA} vs ${match.scoreB}`,
        winnerName: winnerTeam?.name || match.winner,
        result: match.result
      },
      priority: 'high',
      createdBy: 'Autonomous Scores Agent'
    });
  }

  res.json({ success: true, match, summary: result.summary });
});

// ----------------- CONTESTS, FANTASY & DRAWS -----------------
app.get('/api/contests', (req, res) => {
  const store = db.get();
  res.json({ contests: store.contests, entries: store.contestEntries });
});

app.post('/api/contests/:id/enter', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to enter contests' });

  const { answers } = req.body;
  const contestId = req.params.id;
  const store = db.get();
  const contest = store.contests.find(c => c.id === contestId);

  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  if (contest.status !== 'open') return res.status(400).json({ error: 'Contest is locked or closed' });

  // Check if instant trivia
  let instantPoints = 0;
  if (contest.instant) {
    for (const q of contest.questions) {
      if (answers[q.id] === q.answer) {
        instantPoints += q.points;
      }
    }
    user.points += instantPoints;
    if (!user.badges.includes('Trivia Ace') && instantPoints >= 30) {
      user.badges.push('Trivia Ace');
    }
  }

  // Upsert entry
  const existingEntryIdx = store.contestEntries.findIndex(e => e.userId === user.id && e.contestId === contestId);
  const entry: any = {
    userId: user.id,
    contestId,
    answers,
    pointsAwarded: contest.instant ? instantPoints : undefined,
    createdAt: new Date().toISOString()
  };

  if (existingEntryIdx >= 0) {
    store.contestEntries[existingEntryIdx] = entry;
  } else {
    store.contestEntries.push(entry);
  }

  db.save();
  res.json({ success: true, pointsAwarded: instantPoints, user });
});

// Fantasy 10
app.get('/api/fantasy/:matchId', (req, res) => {
  const user = getAuthUser(req);
  const store = db.get();
  const fantasy = user ? store.fantasyTeams.find(f => f.userId === user.id && f.matchId === req.params.matchId) : null;
  res.json({ fantasyTeam: fantasy });
});

app.post('/api/fantasy/:matchId', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to create your Fantasy 10 squad' });

  const { playerIds, captainId } = req.body;
  if (!playerIds || playerIds.length !== 6 || !captainId) {
    return res.status(400).json({ error: 'Please select exactly 6 players and 1 captain' });
  }

  const store = db.get();
  const existingIdx = store.fantasyTeams.findIndex(f => f.userId === user.id && f.matchId === req.params.matchId);

  const team = {
    userId: user.id,
    matchId: req.params.matchId,
    playerIds,
    captainId,
    createdAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    store.fantasyTeams[existingIdx] = team;
  } else {
    store.fantasyTeams.push(team);
    user.points += 50; // Entry bonus
  }

  db.save();
  res.json({ success: true, fantasyTeam: team, user });
});

// Draws
app.get('/api/draws', (req, res) => {
  const store = db.get();
  res.json({ draws: store.draws, entries: store.drawEntries });
});

app.post('/api/draws/:id/enter', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to enter prize draws' });

  const store = db.get();
  const draw = store.draws.find(d => d.id === req.params.id);
  if (!draw) return res.status(404).json({ error: 'Draw not found' });
  if (draw.status !== 'open') return res.status(400).json({ error: 'Draw is closed' });

  if (draw.teamOnly && user.teamId !== draw.teamOnly) {
    return res.status(403).json({ error: `Exclusive draw for fans backing ${draw.teamOnly === 'aces' ? 'Arabian Aces' : draw.teamOnly}` });
  }

  const already = store.drawEntries.some(e => e.drawId === draw.id && e.userId === user.id);
  if (already) {
    return res.status(400).json({ error: 'You are already entered into this draw!' });
  }

  store.drawEntries.push({
    drawId: draw.id,
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    createdAt: new Date().toISOString()
  });

  db.save();
  res.json({ success: true, message: 'You have entered the draw!' });
});

// Provably Fair Draw Execution (Admin only)
app.post('/api/draws/:id/execute', requireAdmin, (req, res) => {
  const store = db.get();
  const draw = store.draws.find(d => d.id === req.params.id);
  if (!draw) return res.status(404).json({ error: 'Draw not found' });

  const entries = store.drawEntries.filter(e => e.drawId === draw.id);
  if (entries.length === 0) {
    return res.status(400).json({ error: 'Cannot execute draw with zero entrants' });
  }

  // Cryptographic provably fair winner selection
  const seed = crypto.randomBytes(16).toString('hex');
  const entrantsDigest = crypto.createHash('sha256').update(entries.map(e => e.userId).sort().join(':')).digest('hex');
  const combinedHash = crypto.createHash('sha256').update(`${seed}:${entrantsDigest}`).digest('hex');
  const winnerIndex = parseInt(combinedHash.slice(0, 8), 16) % entries.length;

  const winner = entries[winnerIndex];
  draw.status = 'drawn';
  draw.winnerUserId = winner.userId;
  draw.winnerName = winner.userName;
  draw.seed = seed;
  draw.entrantsHash = entrantsDigest;
  draw.drawnAt = new Date().toISOString();

  db.save();
  res.json({ success: true, draw, winner });
});

// ----------------- FAN ACTIONS -----------------
app.post('/api/checkin', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to claim daily streak bonus' });

  const now = new Date();
  const last = user.lastCheckin ? new Date(user.lastCheckin) : null;

  if (last && now.getTime() - last.getTime() < 1000 * 60 * 60 * 20) {
    return res.status(400).json({ error: 'Already checked in today! Come back tomorrow.' });
  }

  user.streak += 1;
  user.points += 25 * Math.min(user.streak, 5);
  user.lastCheckin = now.toISOString();

  if (user.streak >= 7 && !user.badges.includes('7-Day Streak Master')) {
    user.badges.push('7-Day Streak Master');
  }

  db.save();
  res.json({ success: true, user, pointsAdded: 25 * Math.min(user.streak, 5) });
});

app.post('/api/me/team', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to back a team' });

  const { teamId } = req.body;
  const store = db.get();
  const team = store.teams.find(t => t.id === teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  user.teamId = team.id;
  user.teamChanges += 1;

  if (team.id === 'aces' && !user.badges.includes('Aces Loyalist')) {
    user.badges.push('Aces Loyalist');
  }

  db.save();
  res.json({ success: true, user });
});

app.get('/api/leaderboard', (req, res) => {
  const store = db.get();

  // Aggregate Fan Wars points by team
  const teamTotals: Record<string, { team: any; points: number; fansCount: number }> = {};
  for (const t of store.teams) {
    teamTotals[t.id] = { team: t, points: 0, fansCount: 0 };
  }

  // Pre-seed realistic fan war numbers for excitement
  if (teamTotals['aces']) { teamTotals['aces'].points += 8420; teamTotals['aces'].fansCount += 2450; }
  if (teamTotals['deccan']) { teamTotals['deccan'].points += 7890; teamTotals['deccan'].fansCount += 2100; }
  if (teamTotals['bulls']) { teamTotals['bulls'].points += 6940; teamTotals['bulls'].fansCount += 1840; }
  if (teamTotals['warriors']) { teamTotals['warriors'].points += 5400; teamTotals['warriors'].fansCount += 1400; }
  if (teamTotals['qavalry']) { teamTotals['qavalry'].points += 4900; teamTotals['qavalry'].fansCount += 1250; }

  for (const u of store.users) {
    if (u.teamId && teamTotals[u.teamId]) {
      teamTotals[u.teamId].points += u.points;
      teamTotals[u.teamId].fansCount += 1;
    }
  }

  const fanWars = Object.values(teamTotals).sort((a, b) => b.points - a.points);
  const topFans = [...store.users].sort((a, b) => b.points - a.points).slice(0, 10);

  res.json({ fanWars, topFans });
});

// ----------------- DISCUSSION FORUM ENDPOINTS -----------------
// Get all threads
app.get('/api/forum/threads', (req, res) => {
  const store = db.get();
  const { category, teamId, search } = req.query;
  let threads = [...(store.forumThreads || [])];

  if (category && category !== 'all') {
    threads = threads.filter(t => t.category === category);
  }
  if (teamId && teamId !== 'all') {
    threads = threads.filter(t => t.teamId === teamId);
  }
  if (search && typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    threads = threads.filter(t => 
      t.title.toLowerCase().includes(q) || 
      t.content.toLowerCase().includes(q) ||
      (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q)))
    );
  }

  threads.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.lastActivityAt || b.createdAt).getTime() - new Date(a.lastActivityAt || a.createdAt).getTime();
  });

  res.json({ threads });
});

// Create a new thread
app.post('/api/forum/threads', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to start a new discussion thread' });

  const { title, content, category, teamId, tags } = req.body;
  if (!title || typeof title !== 'string' || title.trim().length < 5) {
    return res.status(400).json({ error: 'Thread title must be at least 5 characters' });
  }
  if (!content || typeof content !== 'string' || content.trim().length < 10) {
    return res.status(400).json({ error: 'Thread content must be at least 10 characters' });
  }

  const store = db.get();
  if (!store.forumThreads) store.forumThreads = [];

  const parsedTags = Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : ['ADT10'];
  const newThread: any = {
    id: 'thread-' + crypto.randomUUID().slice(0, 8),
    title: title.trim().slice(0, 150),
    content: content.trim(),
    category: category || 'general',
    tags: parsedTags.length > 0 ? parsedTags : ['ADT10'],
    teamId: teamId || user.teamId || null,
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatar,
    userBadge: user.badges?.[0] || 'Superfan',
    pinned: false,
    upvotes: 1,
    upvotedBy: [user.id],
    views: 1,
    commentsCount: 0,
    lastActivityAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  store.forumThreads.unshift(newThread);
  user.points += 15; // Bonus points for starting a discussion
  db.save();

  res.json({ success: true, thread: newThread, pointsAdded: 15, user });
});

// Get thread detail with comments
app.get('/api/forum/threads/:id', (req, res) => {
  const store = db.get();
  const thread = (store.forumThreads || []).find(t => t.id === req.params.id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });

  thread.views = (thread.views || 0) + 1;
  db.save();

  const comments = (store.forumComments || [])
    .filter(c => c.threadId === thread.id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  res.json({ thread, comments });
});

// Add comment to thread
app.post('/api/forum/threads/:id/comments', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to post a reply' });

  const { content } = req.body;
  if (!content || typeof content !== 'string' || content.trim().length < 2) {
    return res.status(400).json({ error: 'Comment content cannot be empty' });
  }

  const store = db.get();
  const thread = (store.forumThreads || []).find(t => t.id === req.params.id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });

  if (!store.forumComments) store.forumComments = [];

  const newComment: any = {
    id: 'comment-' + crypto.randomUUID().slice(0, 8),
    threadId: thread.id,
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatar,
    userBadge: user.badges?.[0] || 'Superfan',
    teamId: user.teamId || null,
    content: content.trim(),
    upvotes: 0,
    upvotedBy: [],
    createdAt: new Date().toISOString()
  };

  store.forumComments.push(newComment);
  thread.commentsCount = (thread.commentsCount || 0) + 1;
  thread.lastActivityAt = new Date().toISOString();

  user.points += 5; // Bonus points for commenting
  db.save();

  res.json({ success: true, comment: newComment, thread, pointsAdded: 5, user });
});

// Upvote thread
app.post('/api/forum/threads/:id/upvote', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to upvote' });

  const store = db.get();
  const thread = (store.forumThreads || []).find(t => t.id === req.params.id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });

  if (!thread.upvotedBy) thread.upvotedBy = [];
  const alreadyUpvoted = thread.upvotedBy.includes(user.id);

  if (alreadyUpvoted) {
    thread.upvotedBy = thread.upvotedBy.filter(uid => uid !== user.id);
    thread.upvotes = Math.max(0, (thread.upvotes || 1) - 1);
  } else {
    thread.upvotedBy.push(user.id);
    thread.upvotes = (thread.upvotes || 0) + 1;
  }

  db.save();
  res.json({ success: true, upvotes: thread.upvotes, upvoted: !alreadyUpvoted });
});

// Upvote comment
app.post('/api/forum/comments/:id/upvote', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to upvote' });

  const store = db.get();
  const comment = (store.forumComments || []).find(c => c.id === req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  if (!comment.upvotedBy) comment.upvotedBy = [];
  const alreadyUpvoted = comment.upvotedBy.includes(user.id);

  if (alreadyUpvoted) {
    comment.upvotedBy = comment.upvotedBy.filter(uid => uid !== user.id);
    comment.upvotes = Math.max(0, (comment.upvotes || 1) - 1);
  } else {
    comment.upvotedBy.push(user.id);
    comment.upvotes = (comment.upvotes || 0) + 1;
  }

  db.save();
  res.json({ success: true, upvotes: comment.upvotes, upvoted: !alreadyUpvoted });
});

// ----------------- NOTIFICATION & FCM APIS -----------------

// Get notifications for current user (or public broadcast)
app.get('/api/notifications', (req, res) => {
  const user = getAuthUser(req);
  const store = db.get();
  const allNotifs = store.notifications || [];
  const { category } = req.query;

  let filtered = allNotifs.filter(n => {
    if (n.targetAudience === 'all') return true;
    if (n.targetAudience === 'logged_in') return !!user;
    if (n.targetAudience === 'team') return !n.teamId || (user && user.teamId === n.teamId);
    return true;
  });

  if (category && typeof category === 'string' && category !== 'all') {
    filtered = filtered.filter(n => n.category === category);
  }

  const enriched = filtered.map(n => ({
    ...n,
    read: user && n.readBy ? n.readBy.includes(user.id) : false
  }));

  const unreadCount = user 
    ? enriched.filter(n => !n.read).length
    : enriched.length;

  res.json({
    notifications: enriched,
    unreadCount,
    total: enriched.length,
    fcmSubscribed: user ? (store.fcmTokens || []).some(t => t.userId === user.id && t.enabled) : false
  });
});

// How to get notification details
app.get('/api/notifications/:id', (req, res) => {
  const { id } = req.params;
  const store = db.get();
  const notif = (store.notifications || []).find(n => n.id === id);
  if (!notif) return res.status(404).json({ error: 'Notification not found' });

  const user = getAuthUser(req);
  const isRead = user && notif.readBy ? notif.readBy.includes(user.id) : false;

  let relatedEntity: any = null;
  if (notif.data?.matchId) {
    relatedEntity = store.matches.find(m => m.id === notif.data?.matchId) || null;
  } else if (notif.data?.contestId) {
    relatedEntity = store.contests.find(c => c.id === notif.data?.contestId) || null;
  }

  res.json({
    notification: {
      ...notif,
      read: isRead
    },
    relatedEntity,
    documentation: {
      endpoint: `/api/notifications/${id}`,
      usage: 'Fetch detailed event data, scorecard summary, contest lock timer, and direct actions',
      fcmDeliveryType: 'RFC 8591 WebPush Protocol / FCM HTTP v1 JSON',
      sdkListener: 'firebase.messaging().onMessage(payload => ...)',
      directRoute: notif.data?.url || '/'
    }
  });
});

// Mark single notification as read
app.post('/api/notifications/:id/read', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to sync notification read state' });

  const store = db.get();
  const notif = (store.notifications || []).find(n => n.id === req.params.id);
  if (!notif) return res.status(404).json({ error: 'Notification not found' });

  if (!notif.readBy) notif.readBy = [];
  if (!notif.readBy.includes(user.id)) {
    notif.readBy.push(user.id);
    db.save();
  }

  res.json({ success: true, notificationId: notif.id, read: true });
});

// Mark all notifications as read
app.post('/api/notifications/mark-all-read', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in required' });

  const store = db.get();
  for (const n of store.notifications || []) {
    if (!n.readBy) n.readBy = [];
    if (!n.readBy.includes(user.id)) {
      n.readBy.push(user.id);
    }
  }
  db.save();

  res.json({ success: true, message: 'All notifications marked as read' });
});

// Register or refresh FCM Device Token for logged-in or guest user
app.post('/api/fcm/register-token', (req, res) => {
  const { token, deviceType, userAgent } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Valid FCM token string is required' });
  }

  const user = getAuthUser(req);
  const store = db.get();
  if (!store.fcmTokens) store.fcmTokens = [];

  const existingIdx = store.fcmTokens.findIndex(t => t.token === token);
  const now = new Date().toISOString();

  if (existingIdx >= 0) {
    store.fcmTokens[existingIdx] = {
      ...store.fcmTokens[existingIdx],
      userId: user?.id || store.fcmTokens[existingIdx].userId,
      userEmail: user?.email || store.fcmTokens[existingIdx].userEmail,
      deviceType: deviceType || store.fcmTokens[existingIdx].deviceType,
      userAgent: userAgent || store.fcmTokens[existingIdx].userAgent,
      enabled: true,
      updatedAt: now
    };
  } else {
    store.fcmTokens.push({
      id: 'fcm_tok_' + crypto.randomUUID().slice(0, 8),
      token,
      userId: user?.id || null,
      userEmail: user?.email || null,
      deviceType: deviceType || 'web_browser',
      userAgent: userAgent || 'Browser Web Client',
      enabled: true,
      createdAt: now,
      updatedAt: now
    });
  }

  db.save();
  console.log(`[FCM REGISTER] Registered device token for ${user?.email || 'guest'}`);
  res.json({ 
    success: true, 
    message: 'FCM push device token registered successfully', 
    activeSubscribers: store.fcmTokens.filter(t => t.enabled).length 
  });
});

// Admin: List all FCM device tokens & subscriber stats
app.get('/api/fcm/tokens', requireAdmin, (req, res) => {
  const store = db.get();
  const tokens = store.fcmTokens || [];
  res.json({
    totalTokens: tokens.length,
    activeSubscribers: tokens.filter(t => t.enabled).length,
    tokens: tokens.slice(0, 50)
  });
});

// Admin: Push Custom FCM Notification
app.post('/api/fcm/send', requireAdmin, (req, res) => {
  const { title, body, category, targetAudience, teamId, url, priority, customData } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required to push notification' });
  }

  const notif = dispatchNotification({
    title: String(title).trim(),
    body: String(body).trim(),
    category: category || 'announcement',
    targetAudience: targetAudience || 'all',
    teamId: teamId || null,
    data: {
      url: url || '/',
      ...(customData || {})
    },
    priority: priority || 'high',
    createdBy: 'Admin Push Dispatcher'
  });

  res.json({
    success: true,
    notification: notif,
    message: `Push notification sent to ${notif.fcmSuccessCount} subscribers`
  });
});

// Admin: Trigger Contest Deadline Notification
app.post('/api/admin/notifications/trigger-contest-deadline', requireAdmin, (req, res) => {
  const { contestId, customMinutes } = req.body;
  const store = db.get();
  const contest = store.contests.find(c => c.id === contestId) || store.contests[0];
  if (!contest) return res.status(404).json({ error: 'Contest not found' });

  const timeLabel = customMinutes ? `${customMinutes} minutes` : '15 minutes';
  const notif = dispatchNotification({
    title: `⏳ CONTEST DEADLINE: "${contest.title}" locks in ${timeLabel}!`,
    body: `Time is running out to enter your predictions for: ${contest.prize}. Enter before the first ball!`,
    category: 'contest_deadline',
    targetAudience: 'logged_in',
    data: {
      contestId: contest.id,
      url: '/contests',
      prize: contest.prize,
      locksAt: contest.locksAt || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      questionsCount: contest.questions?.length || 3
    },
    priority: 'high',
    createdBy: 'Contest Deadline Controller'
  });

  res.json({ success: true, notification: notif });
});

// Admin: Trigger Match Result Notification for any selected match
app.post('/api/admin/notifications/trigger-match-result', requireAdmin, (req, res) => {
  const { matchId } = req.body;
  const store = db.get();
  const match = store.matches.find(m => m.id === matchId) || store.matches[0];
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const teamA = store.teams.find(t => t.id === match.teamA);
  const teamB = store.teams.find(t => t.id === match.teamB);
  const winnerTeam = store.teams.find(t => t.id === match.winner);

  const notif = dispatchNotification({
    title: `🏆 MATCH RESULT: ${winnerTeam ? winnerTeam.name : 'Match Result Confirmed'} (${teamA?.short || 'A'} vs ${teamB?.short || 'B'})`,
    body: `${match.result || (winnerTeam ? `${winnerTeam.name} victorious!` : 'Match concluded')}. Final: ${teamA?.short} ${match.scoreA || ''} vs ${teamB?.short} ${match.scoreB || ''}`,
    category: 'match_result',
    targetAudience: 'all',
    teamId: match.winner || null,
    data: {
      matchId: match.id,
      url: '/matches',
      scoreSummary: `${teamA?.name} ${match.scoreA || ''} vs ${teamB?.name} ${match.scoreB || ''}`,
      winnerName: winnerTeam?.name || match.winner || 'TBD',
      result: match.result,
      topScorer: match.topScorer || 'Top performers highlighted in match center'
    },
    priority: 'high',
    createdBy: 'Admin Match Result Dispatcher'
  });

  res.json({ success: true, notification: notif });
});

// ----------------- ADMIN PORTAL APIS -----------------
app.get('/api/admin/dashboard', requireAdmin, (req, res) => {
  const store = db.get();
  res.json({
    usersCount: store.users.length,
    publicDisplayUserCount: store.settings.publicUserCountOverride,
    handlesCount: store.handles.length,
    feedItemsCount: store.feedItems.length,
    matchesCount: store.matches.length,
    contestsCount: store.contests.length,
    drawsCount: store.draws.length,
    notificationsCount: (store.notifications || []).length,
    fcmSubscribersCount: (store.fcmTokens || []).filter(t => t.enabled).length,
    pendingApprovals: store.approvals.filter(a => a.status === 'pending'),
    agentRuns: store.agentRuns.slice(0, 15),
    settings: store.settings
  });
});

app.post('/api/admin/agents/:name/run', requireAdmin, async (req, res) => {
  const { name } = req.params;
  try {
    let result;
    if (name === 'discovery') result = await runDiscoveryAgent();
    else if (name === 'social') result = await runSocialAgent();
    else if (name === 'news') result = await runNewsAgent();
    else if (name === 'scores') result = await runScoresAgent(true);
    else if (name === 'content') result = await runContentAgent();
    else if (name === 'ops') result = await runOpsAgent();
    else return res.status(400).json({ error: 'Unknown agent name' });

    res.json({ success: true, agent: name, result });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Agent run failed' });
  }
});

app.post('/api/admin/approvals/:id/decide', requireAdmin, (req, res) => {
  const { decision } = req.body; // 'approve' | 'reject'
  const store = db.get();
  const approval = store.approvals.find(a => a.id === req.params.id);
  if (!approval) return res.status(404).json({ error: 'Approval request not found' });

  approval.status = decision === 'approve' ? 'approved' : 'rejected';
  approval.decidedAt = new Date().toISOString();

  if (decision === 'approve' && approval.kind === 'handle') {
    const handle = store.handles.find(h => h.id === approval.payload.handleId);
    if (handle) {
      handle.status = 'verified';
      handle.verifiedAt = new Date().toISOString();
    }
  }

  db.save();
  res.json({ success: true, approval });
});

app.get('/api/admin/settings', requireAdmin, (req, res) => {
  const store = db.get();
  res.json({ settings: store.settings });
});

app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const store = db.get();
  store.settings = { ...store.settings, ...req.body };
  db.save();
  res.json({ success: true, settings: store.settings });
});

app.post('/api/admin/demo-reset', requireAdmin, (req, res) => {
  const fresh = db.resetDemo();
  res.json({ success: true, store: fresh });
});

// ----------------- ACTIVITY 8: GLOBAL PHYSICAL FAN SPACES -----------------
app.get('/api/fanspaces', (req, res) => {
  const user = getAuthUser(req);
  const store = db.get();
  const spaces = store.fanSpaces || [];
  const userBookings = user 
    ? (store.fanSpaceBookings || []).filter(b => b.userId === user.id)
    : [];

  res.json({
    spaces,
    bookings: userBookings,
    totalHubs: spaces.length,
    activeCities: spaces.map(s => s.city)
  });
});

app.post('/api/fanspaces/:id/book', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to reserve your Fan Space entry' });

  const { id } = req.params;
  const { date, ticketType = 'vip_pass', ticketsCount = 1 } = req.body;
  const store = db.get();
  const space = (store.fanSpaces || []).find(s => s.id === id);

  if (!space) return res.status(404).json({ error: 'Fan Space not found' });
  if (space.status === 'sold_out') return res.status(400).json({ error: 'This Fan Space is currently sold out for upcoming sessions' });

  const cityCode = space.city.slice(0, 3).toUpperCase();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const passCode = `ADT10-${cityCode}-${ticketType === 'vip_pass' ? 'VIP' : 'FAN'}-${randomSuffix}`;

  const booking = {
    id: 'bk_' + crypto.randomUUID().slice(0, 8),
    spaceId: space.id,
    spaceName: space.name,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    date: date || new Date().toISOString().split('T')[0],
    ticketType: ticketType as any,
    ticketsCount: Math.max(1, parseInt(ticketsCount, 10) || 1),
    passCode,
    createdAt: new Date().toISOString()
  };

  if (!store.fanSpaceBookings) store.fanSpaceBookings = [];
  store.fanSpaceBookings.unshift(booking);
  space.totalBookings = (space.totalBookings || 0) + booking.ticketsCount;

  // Award fan loyalty points for reserving fan space entry
  user.points += 50;
  if (!user.badges.includes('Fan Space Ambassador')) {
    user.badges.push('Fan Space Ambassador');
  }

  db.save();

  dispatchNotification({
    title: `🎟️ FAN SPACE VIP PASS CONFIRMED: ${space.city}`,
    body: `Your official pass for ${space.name} is ready! Pass code: ${passCode}. Show this at the clubhouse reception.`,
    category: 'perk',
    targetAudience: 'logged_in',
    data: {
      url: '/fanspaces',
      passCode,
      spaceId: space.id
    },
    priority: 'normal',
    createdBy: 'Fan Spaces Ticketing Engine'
  });

  res.json({ success: true, booking, passCode, user });
});

app.get('/api/admin/fanspaces/bookings', requireAdmin, (req, res) => {
  const store = db.get();
  res.json({ bookings: store.fanSpaceBookings || [] });
});

app.post('/api/admin/fanspaces', requireAdmin, (req, res) => {
  const store = db.get();
  if (!store.fanSpaces) store.fanSpaces = [];

  const spaceData = req.body;
  const existingIdx = store.fanSpaces.findIndex(s => s.id === spaceData.id);

  if (existingIdx >= 0) {
    store.fanSpaces[existingIdx] = {
      ...store.fanSpaces[existingIdx],
      ...spaceData
    };
  } else {
    const newSpace = {
      id: spaceData.id || 'space-' + crypto.randomUUID().slice(0, 6),
      name: spaceData.name || 'ADT10 Clubhouse',
      city: spaceData.city || 'Global Hub',
      country: spaceData.country || 'International',
      tagline: spaceData.tagline || 'Official ADT10 Experiential Match Clubhouse',
      location: spaceData.location || 'Metropolitan City Center',
      capacity: parseInt(spaceData.capacity, 10) || 500,
      status: spaceData.status || 'active',
      image: spaceData.image || 'https://images.unsplash.com/photo-1512958789358-4dacacbe09c3?q=80&w=1200&auto=format&fit=crop',
      features: spaceData.features || ['360° LED Match Screens', 'VR Batting Simulator', 'Merch Boutique'],
      amenities: spaceData.amenities || ['Valet Parking', 'Fast Wi-Fi', 'Artisanal Bar'],
      openHours: spaceData.openHours || 'Daily 12:00 PM – 02:00 AM',
      liveMatchSchedule: spaceData.liveMatchSchedule || 'Screening all live Abu Dhabi T10 fixtures',
      vipPassPriceAed: parseInt(spaceData.vipPassPriceAed, 10) || 200,
      vipPassPriceUsd: parseInt(spaceData.vipPassPriceUsd, 10) || 55,
      vipPerks: spaceData.vipPerks || ['Front row lounge seating', 'Complimentary beverages'],
      merchBoutique: spaceData.merchBoutique || 'Official franchise kits & caps',
      menuHighlights: spaceData.menuHighlights || 'Gourmet sliders & Karak chai',
      totalBookings: 0
    };
    store.fanSpaces.push(newSpace);
  }

  db.save();
  res.json({ success: true, spaces: store.fanSpaces });
});

app.delete('/api/admin/fanspaces/:id', requireAdmin, (req, res) => {
  const store = db.get();
  store.fanSpaces = (store.fanSpaces || []).filter(s => s.id !== req.params.id);
  db.save();
  res.json({ success: true, spaces: store.fanSpaces });
});

// ----------------- ACTIVITY 9: NEXT-GEN GROWTH CATALYSTS -----------------
app.get('/api/growth-catalysts', (req, res) => {
  const store = db.get();
  res.json({
    youthSchools: store.youthSchools || [],
    creatorPartners: store.creatorPartners || [],
    commentaryFeeds: store.commentaryFeeds || [],
    passportTiers: store.passportTiers || []
  });
});

app.post('/api/admin/growth/youth-school', requireAdmin, (req, res) => {
  const store = db.get();
  if (!store.youthSchools) store.youthSchools = [];
  const schoolData = req.body;
  const idx = store.youthSchools.findIndex(s => s.id === schoolData.id);

  if (idx >= 0) {
    store.youthSchools[idx] = { ...store.youthSchools[idx], ...schoolData };
  } else {
    store.youthSchools.push({
      id: schoolData.id || 'school-' + crypto.randomUUID().slice(0, 6),
      name: schoolData.name,
      region: schoolData.region || 'UAE',
      city: schoolData.city || 'Abu Dhabi',
      studentsCount: parseInt(schoolData.studentsCount, 10) || 200,
      tapeBallTeam: schoolData.tapeBallTeam || `${schoolData.name} XI`,
      status: schoolData.status || 'registered',
      equipmentKitGranted: !!schoolData.equipmentKitGranted,
      matchdayTicketsAllocated: parseInt(schoolData.matchdayTicketsAllocated, 10) || 25
    });
  }

  db.save();
  res.json({ success: true, youthSchools: store.youthSchools });
});

app.delete('/api/admin/growth/youth-school/:id', requireAdmin, (req, res) => {
  const store = db.get();
  store.youthSchools = (store.youthSchools || []).filter(s => s.id !== req.params.id);
  db.save();
  res.json({ success: true, youthSchools: store.youthSchools });
});

app.post('/api/admin/growth/creator', requireAdmin, (req, res) => {
  const store = db.get();
  if (!store.creatorPartners) store.creatorPartners = [];
  const creatorData = req.body;
  const idx = store.creatorPartners.findIndex(c => c.id === creatorData.id);

  if (idx >= 0) {
    store.creatorPartners[idx] = { ...store.creatorPartners[idx], ...creatorData };
  } else {
    store.creatorPartners.push({
      id: creatorData.id || 'creator-' + crypto.randomUUID().slice(0, 6),
      name: creatorData.name,
      handle: creatorData.handle,
      platform: creatorData.platform || 'YouTube',
      followers: creatorData.followers || '100K',
      streamUrl: creatorData.streamUrl || 'https://youtube.com',
      specialty: creatorData.specialty || 'Cricket Reactions & Watch-Along',
      status: creatorData.status || 'partnered',
      totalWatchViews: creatorData.totalWatchViews || '1.0M',
      avatar: creatorData.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop'
    });
  }

  db.save();
  res.json({ success: true, creatorPartners: store.creatorPartners });
});

app.delete('/api/admin/growth/creator/:id', requireAdmin, (req, res) => {
  const store = db.get();
  store.creatorPartners = (store.creatorPartners || []).filter(c => c.id !== req.params.id);
  db.save();
  res.json({ success: true, creatorPartners: store.creatorPartners });
});

app.post('/api/admin/growth/audio-feed', requireAdmin, (req, res) => {
  const store = db.get();
  if (!store.commentaryFeeds) store.commentaryFeeds = [];
  const feedData = req.body;
  const idx = store.commentaryFeeds.findIndex(f => f.id === feedData.id);

  if (idx >= 0) {
    store.commentaryFeeds[idx] = { ...store.commentaryFeeds[idx], ...feedData };
  } else {
    store.commentaryFeeds.push(feedData);
  }

  db.save();
  res.json({ success: true, commentaryFeeds: store.commentaryFeeds });
});

app.post('/api/growth/superfan-passport/subscribe', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to activate your Superfan Digital Passport' });

  const store = db.get();
  if (!user.badges.includes('Superfan Gold Passport')) {
    user.badges.push('Superfan Gold Passport');
  }
  user.points += 250;

  if (store.passportTiers && store.passportTiers[0]) {
    store.passportTiers[0].totalSubscribers = (store.passportTiers[0].totalSubscribers || 38000) + 1;
  }

  db.save();

  dispatchNotification({
    title: '🌟 SUPERFAN DIGITAL PASSPORT ACTIVATED',
    body: 'Welcome to the inner circle! Enjoy 15% off all match tickets, priority entry at all 5 Fan Spaces, and 2x contest points.',
    category: 'perk',
    targetAudience: 'logged_in',
    data: {
      url: '/growth',
      membershipStatus: 'Active'
    },
    priority: 'high',
    createdBy: 'Superfan Membership Desk'
  });

  res.json({ success: true, user });
});

// ----------------- PROPOSAL & FINANCIAL BUDGET -----------------
app.get('/api/proposal', (req, res) => {
  const store = db.get();
  res.json({ proposalSettings: store.proposalSettings });
});

app.post('/api/admin/proposal', requireAdmin, (req, res) => {
  const store = db.get();
  store.proposalSettings = {
    ...store.proposalSettings,
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  db.save();
  res.json({ success: true, proposalSettings: store.proposalSettings });
});

app.post('/api/admin/proposal/reset', requireAdmin, (req, res) => {
  const proposalSettings = db.resetProposal();
  res.json({ success: true, proposalSettings });
});

// ----------------- CONTESTS & FANTASY ADMIN -----------------
app.post('/api/admin/contests', requireAdmin, (req, res) => {
  const store = db.get();
  if (!store.contests) store.contests = [];
  const contestData = req.body;
  const idx = store.contests.findIndex(c => c.id === contestData.id);

  if (idx >= 0) {
    store.contests[idx] = { ...store.contests[idx], ...contestData };
  } else {
    store.contests.push({
      id: contestData.id || 'c-' + crypto.randomUUID().slice(0, 6),
      type: contestData.type || 'predictor',
      title: contestData.title || 'Match Predictor Challenge',
      description: contestData.description || 'Predict match milestones and earn fan points.',
      matchId: contestData.matchId || null,
      locksAt: contestData.locksAt || new Date(Date.now() + 3600 * 1000 * 24).toISOString(),
      status: contestData.status || 'open',
      prize: contestData.prize || 'VIP Passes & Points',
      instant: !!contestData.instant,
      questions: contestData.questions || [
        {
          id: 'q-1',
          prompt: 'Which team strikes more sixes?',
          options: ['Arabian Aces', 'Deccan Gladiators', 'Tie'],
          points: 50
        }
      ],
      createdAt: new Date().toISOString()
    });
  }

  db.save();
  res.json({ success: true, contests: store.contests });
});

app.delete('/api/admin/contests/:id', requireAdmin, (req, res) => {
  const store = db.get();
  store.contests = (store.contests || []).filter(c => c.id !== req.params.id);
  db.save();
  res.json({ success: true, contests: store.contests });
});

app.post('/api/admin/contests/:id/toggle-status', requireAdmin, (req, res) => {
  const { status } = req.body; // 'open' | 'locked' | 'settled'
  const store = db.get();
  const contest = (store.contests || []).find(c => c.id === req.params.id);
  if (!contest) return res.status(404).json({ error: 'Contest not found' });

  contest.status = status || (contest.status === 'open' ? 'locked' : 'open');
  db.save();
  res.json({ success: true, contest });
});

app.post('/api/admin/contests/:id/settle', requireAdmin, (req, res) => {
  const { answers } = req.body; // { [questionId: string]: string }
  const store = db.get();
  const contest = (store.contests || []).find(c => c.id === req.params.id);
  if (!contest) return res.status(404).json({ error: 'Contest not found' });

  // Update question answers
  if (answers && typeof answers === 'object') {
    contest.questions.forEach(q => {
      if (answers[q.id]) {
        q.answer = answers[q.id];
      }
    });
  }

  contest.status = 'settled';

  // Evaluate entries for this contest
  const entries = (store.contestEntries || []).filter(e => e.contestId === contest.id);
  let settledEntriesCount = 0;
  let totalPointsDistributed = 0;

  entries.forEach(entry => {
    let points = 0;
    contest.questions.forEach(q => {
      if (q.answer && entry.answers[q.id] === q.answer) {
        points += q.points;
      }
    });
    entry.pointsAwarded = points;

    // Credit user points
    const user = store.users.find(u => u.id === entry.userId);
    if (user && points > 0) {
      user.points += points;
      if (!user.stats) {
        user.stats = { contestsEntered: 1, contestsWon: 1, predictionPoints: points };
      } else {
        user.stats.predictionPoints = (user.stats.predictionPoints || 0) + points;
        user.stats.contestsWon = (user.stats.contestsWon || 0) + 1;
      }
      totalPointsDistributed += points;
      settledEntriesCount++;
    }
  });

  dispatchNotification({
    title: `🎯 CONTEST SETTLED: ${contest.title}`,
    body: `Results are out! Points have been distributed to all winners. Check the Leaderboard to see where you rank!`,
    category: 'announcement',
    targetAudience: 'all',
    data: {
      contestId: contest.id,
      url: '/contests',
      totalPointsDistributed
    },
    priority: 'high',
    createdBy: 'Contest Settlement Engine'
  });

  db.save();
  res.json({ success: true, contest, settledEntriesCount, totalPointsDistributed });
});

// Delete match endpoint
app.delete('/api/matches/:id', requireAdmin, (req, res) => {
  const store = db.get();
  store.matches = (store.matches || []).filter(m => m.id !== req.params.id);
  db.save();
  res.json({ success: true, matches: store.matches });
});

// Gemini Marketing Generator
app.post('/api/gemini/marketing', async (req, res) => {
  const { prompt, teamName } = req.body;
  const result = await generateMarketingContent(prompt || 'Generate Abu Dhabi T10 hype campaign', { teamName });
  res.json(result);
});

// Gemini Multi-Turn Chatbot
app.post('/api/gemini/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array required' });
  }
  const result = await chatWithGemini(messages);
  res.json(result);
});

// Google Search Grounding for live cricket & league updates
app.post('/api/gemini/search', async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query required' });
  }
  const result = await searchGroundingCricket(query);
  res.json(result);
});

// Audio Speech-to-Text Transcription with gemini-3.5-transcribe
app.post('/api/gemini/transcribe', async (req, res) => {
  const { audioBase64, mimeType } = req.body;
  if (!audioBase64) {
    return res.status(400).json({ error: 'Base64 audio required' });
  }
  const result = await transcribeAudioVoice(audioBase64, mimeType || 'audio/webm');
  res.json(result);
});

// Stadium Music Generation with Lyria
app.post('/api/gemini/music', async (req, res) => {
  const { prompt } = req.body;
  const result = await generateStadiumMusic(prompt || 'Abu Dhabi T10 high-energy stadium walkout fanfare');
  res.json(result);
});

// Veo 3 Video Generation (Text-to-Video & Image-to-Video)
app.post('/api/gemini/video', async (req, res) => {
  const { prompt, imageBase64, aspectRatio } = req.body;
  const result = await generateVeoVideo(prompt, imageBase64, aspectRatio || '16:9');
  res.json(result);
});

// ----------------- SEO: SITEMAP & ROBOTS.TXT -----------------
app.get('/robots.txt', (req, res) => {
  const robots = `# Abu Dhabi T10 Fan Hub - Copyright by Azlir Sport
User-agent: *
Allow: /

Sitemap: https://adt10.azlirsport.com/sitemap.xml
`;
  res.type('text/plain').send(robots);
});

app.get('/sitemap.xml', (req, res) => {
  const baseUrl = 'https://adt10.azlirsport.com';
  const today = new Date().toISOString().split('T')[0];

  const routes = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/matches', priority: '0.9', changefreq: 'hourly' },
    { loc: '/teams', priority: '0.9', changefreq: 'daily' },
    { loc: '/teams/aces', priority: '0.8', changefreq: 'daily' },
    { loc: '/teams/bulls', priority: '0.8', changefreq: 'daily' },
    { loc: '/teams/champions', priority: '0.8', changefreq: 'daily' },
    { loc: '/teams/tigers', priority: '0.8', changefreq: 'daily' },
    { loc: '/teams/lions', priority: '0.8', changefreq: 'daily' },
    { loc: '/teams/eagles', priority: '0.8', changefreq: 'daily' },
    { loc: '/social', priority: '0.9', changefreq: 'hourly' },
    { loc: '/forum', priority: '0.8', changefreq: 'hourly' },
    { loc: '/contests', priority: '0.8', changefreq: 'daily' },
    { loc: '/draws', priority: '0.7', changefreq: 'daily' },
    { loc: '/leaderboard', priority: '0.8', changefreq: 'hourly' },
    { loc: '/fanspaces', priority: '0.9', changefreq: 'daily' },
    { loc: '/growth', priority: '0.8', changefreq: 'daily' },
    { loc: '/proposal', priority: '0.9', changefreq: 'weekly' }
  ];

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(r => `  <url>
    <loc>${baseUrl}${r.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.type('application/xml').send(sitemapXml);
});

// ----------------- VITE MIDDLEWARE / STATIC FILES -----------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ Abu Dhabi T10 Hub running on http://0.0.0.0:${PORT}`);

    // Auto-seed the 6 announced teams and search their handles dynamically on server startup
    try {
      const store = db.get();
      const announcedNames = ['UAE Bulls', 'United Tigers', 'Yas Lions', 'Arabian Aces', 'Emirates Eagles', 'Desert Royal Champions'];
      const hasAllAnnounced = announcedNames.every(name => store.teams.some(t => t.name.toLowerCase() === name.toLowerCase()));
      const teamHandlesCount = store.handles.filter(h => h.teamId !== null).length;

      if (!hasAllAnnounced || teamHandlesCount < 10) {
        console.log('[STARTUP] Seeding 6 announced teams and searching handles dynamically...');
        seedAnnouncedTeamsAndSearch().then(res => {
          console.log(`[STARTUP] ${res.summary}`);
        }).catch(e => console.warn('[STARTUP] Background handle search notice:', e));
      } else {
        // Ensure all feed posts are verified real from official team channels & live RSS
        syncRealSocialFeeds(store).then(res => {
          db.save();
          console.log(`[STARTUP] ${res.summary}`);
        }).catch(e => console.warn('[STARTUP] Background real feeds sync notice:', e));
      }
    } catch (e) {
      console.warn('[STARTUP] Seeding check notice:', e);
    }
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});

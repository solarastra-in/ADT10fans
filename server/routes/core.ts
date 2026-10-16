import crypto from 'crypto';
import { Router } from 'express';
import { db } from '../db';
import {
  firebaseProjectId, getAuthUser, requireUser, upsertUser, createSession, revokeSession, verifyFirebaseIdToken, rateLimit,
  emailOtpAvailable, sendOtpEmail, hashOtp, timingSafeEqualHex, selfUser, isSuperAdmin,
} from '../auth';
import { bad, newId, optionalUrl, str, userOf, wrap } from '../http';
import { computeUserBadges } from '../badges';
import { attachReferral, checkReferralReward, referralSummary } from '../referrals';
import { geminiConfigured } from '../gemini';
import { liveScoresConfigured } from '../liveScores';
import { fantasySeasonTotals } from '../fantasy';
import { gameStats } from '../games';
import { awardPoints, balanceOf, ledgerFor, summaryFor } from '../points';

export const coreRouter = Router();

const brand = () => db.get().settings.brandName || 'ADT10 Fans';
const drawOpen = (d: { status: string; closesAt: string }) => d.status !== 'drawn' && d.status !== 'closed' && +new Date(d.closesAt) > Date.now();

coreRouter.get('/health', (_req, res) => res.json({ ok: true, storage: db.backend.kind, jobsLastRun: db.get().jobLog['jobs:last-run'] || null }));

coreRouter.get('/config', (req, res) => {
  const viewer = getAuthUser(req);
  const s = db.get();
  const st = s.settings;
  res.json({
    config: {
      brandName: st.brandName || 'ADT10 Fans',
      tagline: st.tagline || '',
      copyrightHolder: st.copyrightHolder || '',
      seasonLabel: st.seasonLabel,
      seasonStart: st.seasonStart,
      seasonEnd: st.seasonEnd,
      venue: st.venue,
      tickerText: st.tickerText,
      isSuperAdmin: isSuperAdmin(viewer),
      maxSocialPerPlatform: st.maxSocialPerPlatform || 6,
      referralRewardPoints: st.referralRewardPoints || 0,
      referralMaxRewarded: st.referralMaxRewarded ?? 10,
      features: {
        googleSignIn: Boolean(firebaseProjectId()),
        emailOtp: emailOtpAvailable(),
        gemini: geminiConfigured(),
        pushNotifications: Boolean(process.env.FCM_VAPID_KEY),
        liveScores: liveScoresConfigured(),
        curator: Boolean(st.curatorFeedId || process.env.CURATOR_FEED_ID),
      },
      fcmVapidKey: process.env.FCM_VAPID_KEY || '',
      stats: {
        teams: s.teams.length,
        players: s.teams.reduce((n, t) => n + t.squad.length, 0),
        fans: s.users.length,
        handles: s.handles.filter(h => h.status === 'verified').length,
        matches: s.matches.length,
        openContests: s.contests.filter(c => c.status === 'open' && (!c.locksAt || +new Date(c.locksAt) > Date.now())).length,
        openDraws: s.draws.filter(drawOpen).length,
        prizes: s.prizes.filter(p => p.active && p.stock > 0).length,
        forumThreads: s.forumThreads.filter(t => !t.hidden).length,
      },
    },
  });
});

// ---------- auth ----------
coreRouter.get('/me', (req, res) => {
  const u = getAuthUser(req);
  res.json({ user: u ? selfUser(u) : null });
});

function onSignIn(email: string, provider: 'google' | 'email', profile: { name?: string; avatar?: string }, ref: unknown) {
  const { user, created } = upsertUser(email, provider, profile);
  if (created) attachReferral(db.get(), user, ref);
  db.save();
  return { token: createSession(user.id), user: selfUser(user), created };
}

coreRouter.post('/auth/google', rateLimit('google', 20, 60_000), wrap(async (req, res) => {
  const idToken = str(req.body?.idToken, 5000);
  if (!idToken) return bad(res, 'Missing Google ID token');
  let profile;
  try {
    profile = await verifyFirebaseIdToken(idToken);
  } catch (e: any) {
    return bad(res, e?.message?.includes('not configured') ? e.message : 'Google sign-in could not be verified. Please try again.', 401);
  }
  res.json(onSignIn(profile.email, 'google', { name: profile.name, avatar: profile.picture }, req.body?.ref));
}));

coreRouter.post('/auth/otp/request', rateLimit('otp-req', 5, 10 * 60_000), wrap(async (req, res) => {
  const email = str(req.body?.email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return bad(res, 'Please enter a valid email address');
  if (!emailOtpAvailable()) return bad(res, 'Email sign-in is not available right now. Please use Google sign-in.', 503);
  const store = db.get();
  if (store.otpCodes.some(o => o.email === email && Date.now() - +new Date(o.createdAt) < 60_000)) {
    return bad(res, 'A code was just sent. Please wait a minute before requesting another.', 429);
  }
  const code = crypto.randomInt(100000, 1000000).toString();
  store.otpCodes = store.otpCodes.filter(o => +new Date(o.expiresAt) > Date.now() && !o.used && o.email !== email).slice(0, 1000);
  store.otpCodes.unshift({ id: newId('otp'), email, codeHash: hashOtp(email, code), expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), attempts: 0, used: false, createdAt: new Date().toISOString() });
  db.save();
  let mode: 'sent' | 'dev';
  try {
    mode = await sendOtpEmail(email, code, brand());
  } catch (e: any) {
    console.error('[OTP] email send failed:', e?.message);
    return bad(res, 'We could not send the email. Please try again or use Google sign-in.', 502);
  }
  if (mode === 'dev') console.log(`[OTP][dev] code for ${email}: ${code}`);
  res.json({ success: true, message: `We sent a 6-digit code to ${email}.`, ...(mode === 'dev' ? { devCode: code } : {}) });
}));

coreRouter.post('/auth/otp/verify', rateLimit('otp-verify', 20, 10 * 60_000), (req, res) => {
  const email = str(req.body?.email, 200).toLowerCase();
  const code = str(req.body?.code, 10).replace(/\D/g, '');
  if (!email || code.length !== 6) return bad(res, 'Enter the 6-digit code from your email');
  const store = db.get();
  const otp = store.otpCodes.find(o => o.email === email && !o.used && +new Date(o.expiresAt) > Date.now());
  if (!otp) return bad(res, 'That code has expired. Please request a new one.');
  otp.attempts++;
  if (otp.attempts > 5) {
    otp.used = true;
    db.save();
    return bad(res, 'Too many attempts. Please request a new code.', 429);
  }
  if (!timingSafeEqualHex(otp.codeHash, hashOtp(email, code))) {
    db.save();
    return bad(res, 'That code is not correct');
  }
  otp.used = true;
  res.json(onSignIn(email, 'email', {}, req.body?.ref));
});

coreRouter.post('/auth/logout', (req, res) => {
  revokeSession(req);
  res.json({ success: true });
});

// ---------- profile ----------
coreRouter.get('/me/profile', requireUser, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const { badges, stats } = computeUserBadges(user, store);
  let changed = false;
  for (const b of badges) if (b.unlocked && !user.badges.includes(b.name)) {
    user.badges.push(b.name);
    changed = true;
  }
  if (changed) db.save();
  const fantasy = fantasySeasonTotals(store, new Set([user.id]))[0] || { points: 0, matches: 0, best: 0 };
  const history = store.fantasyTeams
    .filter(f => f.userId === user.id)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 20)
    .map(f => {
      const m = store.matches.find(x => x.id === f.matchId);
      return { matchId: f.matchId, matchNo: m?.matchNo, teamA: m?.teamA, teamB: m?.teamB, startsAt: m?.startsAt, points: f.points ?? null, rank: f.rank ?? null, scored: Boolean(f.scoredAt) };
    });
  res.json({
    user: selfUser(user),
    badges,
    stats,
    fantasy,
    fantasyHistory: history,
    games: gameStats(store, user.id),
    redemptions: store.redemptions.filter(r => r.userId === user.id).slice(0, 50),
    bookings: store.fanSpaceBookings.filter(b => b.userId === user.id).slice(0, 50),
  });
});

/** The signed-in fan's points: totals, where they came from, and every change. */
coreRouter.get('/me/points', requireUser, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const itemised = store.pointsLedger.filter(e => e.userId === user.id && e.bucket === 'earned').reduce((s, e) => s + e.delta, 0);
  res.json({
    points: user.points,
    pointsSpent: user.pointsSpent || 0,
    balance: balanceOf(user),
    bySource: summaryFor(store, user.id),
    // Points earned before the history was kept (before 16 October 2026).
    earlier: Math.max(0, user.points - itemised),
    history: ledgerFor(store, user.id, 200).map(({ by, ...e }) => e),
  });
});

coreRouter.post('/me/claim-badge', requireUser, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const { badges } = computeUserBadges(user, store);
  const target = badges.find(b => b.id === str(req.body?.badgeId, 80));
  if (!target || !target.unlocked) return bad(res, 'Badge not unlocked yet');
  const key = `claimed:${user.id}:${target.id}`;
  if (store.claimedBadges[key]) return bad(res, 'Reward already claimed for this badge');
  store.claimedBadges[key] = true;
  awardPoints(store, user, target.rewardPoints, 'badge', target.name, target.id);
  db.save();
  res.json({ success: true, pointsAdded: target.rewardPoints, user: selfUser(user) });
});

const COUNTRY = /^[\p{L}\s.'-]{2,56}$/u;
coreRouter.post('/me/profile/update', requireUser, (req, res) => {
  const user = userOf(req);
  const b = req.body || {};
  const name = str(b.name, 40);
  if (b.name !== undefined) {
    if (name.length < 2) return bad(res, 'Display name must be at least 2 characters');
    user.name = name;
  }
  if (b.avatar !== undefined) {
    const avatar = optionalUrl(b.avatar);
    if (avatar === null) return bad(res, 'Profile picture must be an https:// image link');
    user.avatar = avatar;
  }
  if (b.country !== undefined) {
    const c = str(b.country, 56);
    if (c && !COUNTRY.test(c)) return bad(res, 'Enter a country name');
    user.country = c || undefined;
  }
  if (b.city !== undefined) user.city = str(b.city, 56) || undefined;
  if (b.bio !== undefined) user.bio = str(b.bio, 280) || undefined;
  const store = db.get();
  for (const t of store.forumThreads) if (t.userId === user.id) Object.assign(t, { userName: user.name, userAvatar: user.avatar });
  for (const c of store.forumComments) if (c.userId === user.id) Object.assign(c, { userName: user.name, userAvatar: user.avatar });
  db.save();
  res.json({ success: true, user: selfUser(user) });
});

/** Deletes the account. Forum posts stay (other replies depend on them) but show as "Former fan". */
coreRouter.delete('/me', requireUser, (req, res) => {
  const user = userOf(req);
  if (str(req.body?.confirm, 20) !== 'DELETE') return bad(res, 'Type DELETE to confirm');
  const store = db.get();
  store.users = store.users.filter(u => u.id !== user.id);
  store.sessions = store.sessions.filter(s => s.userId !== user.id);
  store.fcmTokens = store.fcmTokens.filter(t => t.userId !== user.id);
  store.contestEntries = store.contestEntries.filter(e => e.userId !== user.id);
  store.fantasyTeams = store.fantasyTeams.filter(f => f.userId !== user.id);
  store.gamePlays = store.gamePlays.filter(p => p.userId !== user.id);
  store.drawEntries = store.drawEntries.filter(d => d.userId !== user.id || store.draws.find(x => x.id === d.drawId)?.status === 'drawn');
  store.passportInterest = store.passportInterest.filter(p => p.userId !== user.id);
  for (const l of store.fantasyLeagues) l.memberIds = l.memberIds.filter(id => id !== user.id);
  store.fantasyLeagues = store.fantasyLeagues.filter(l => l.memberIds.length > 0);
  for (const p of store.polls) delete p.votes[user.id];
  for (const t of store.forumThreads) if (t.userId === user.id) Object.assign(t, { userName: 'Former fan', userAvatar: '' });
  for (const c of store.forumComments) if (c.userId === user.id) Object.assign(c, { userName: 'Former fan', userAvatar: '' });
  for (const r of store.redemptions) if (r.userId === user.id) Object.assign(r, { userName: 'Former fan', userEmail: '' });
  for (const b of store.fanSpaceBookings) if (b.userId === user.id) Object.assign(b, { userName: 'Former fan', userEmail: '' });
  for (const u of store.users) if (u.referredBy === user.id) u.referredBy = null;
  db.save();
  res.json({ success: true });
});

coreRouter.post('/checkin', requireUser, (req, res) => {
  const user = userOf(req);
  const now = new Date();
  const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
  const last = user.lastCheckin ? new Date(user.lastCheckin) : null;
  if (last && dayKey(last) === dayKey(now)) return bad(res, "You've already checked in today. Come back tomorrow!");
  const yesterday = new Date(now.getTime() - 86400000);
  user.streak = last && dayKey(last) === dayKey(yesterday) ? user.streak + 1 : 1;
  const pts = 10 * Math.min(user.streak, 5);
  awardPoints(db.get(), user, pts, 'checkin', `Day ${user.streak} of your streak`, dayKey(now));
  user.lastCheckin = now.toISOString();
  db.save();
  res.json({ success: true, user: selfUser(user), pointsAdded: pts });
});

/** First pick is free; after that a fan may switch team once per season (keeps Fan Wars fair). */
coreRouter.post('/me/team', requireUser, (req, res) => {
  const user = userOf(req);
  const team = db.get().teams.find(t => t.id === req.body?.teamId);
  if (!team) return bad(res, 'Team not found', 404);
  if (user.teamId === team.id) return res.json({ success: true, user: selfUser(user) });
  if (user.teamId && user.teamChanges >= 1) return bad(res, 'You have already switched team once this season.', 409);
  if (user.teamId) user.teamChanges += 1;
  user.teamId = team.id;
  db.save();
  res.json({ success: true, user: selfUser(user) });
});

coreRouter.get('/me/referral', requireUser, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const had = Boolean(user.referralCode);
  const summary = referralSummary(store, user);
  if (!had) db.save();
  res.json(summary);
});

/** Pays pending invite rewards after any request that may have counted as taking part. */
export function referralCheckMiddleware(req: any, res: any, next: any) {
  if (req.method === 'GET') return next();
  const origJson = res.json.bind(res);
  res.json = (body: any) => {
    try {
      const user = getAuthUser(req);
      if (user && user.referredBy && !user.referralRewardedAt && res.statusCode < 400) {
        const pts = checkReferralReward(db.get(), user);
        if (pts) {
          db.save();
          if (body && typeof body === 'object' && !Array.isArray(body)) body = { ...body, referralReward: pts };
        }
      }
    } catch {
      /* never break the response */
    }
    return origJson(body);
  };
  next();
}

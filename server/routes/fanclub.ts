import crypto from 'crypto';
import { Router } from 'express';
import { db, FanClub, FanClubCheckInRecord, VenueOffer } from '../db';
import { getAuthUser, requireUser, selfUser } from '../auth';
import { bad, str, userOf, wrap } from '../http';
import { awardPoints } from '../points';
import { OFFICIAL_FAN_CLUBS } from '../data/officialVenues';

export const fanclubRouter = Router();

/**
 * Returns deterministic or existing 6-character fan club check-in code.
 */
export function getOrCreateFanClubCode(userId: string, existing?: string): string {
  if (existing && existing.length >= 6) return existing.toUpperCase();
  const hash = crypto.createHash('md5').update(userId + 'aces-fanclub').digest('hex').toUpperCase();
  return (hash.slice(0, 2) + hash.slice(4, 8)); // e.g. "AA8F2B"
}

/**
 * Determines whether a user is authorized as a Super Admin or Venue Manager for a specific fan club.
 */
export function isVenueAuthorized(user: any, fanClubId?: string): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.isSuperAdmin || user.adminRole === 'superadmin') return true;
  const store = db.get();
  const userEmail = (user.email || '').toLowerCase().trim();
  if (!userEmail) return false;
  const clubs = store.fanClubs.length > 0 ? store.fanClubs : OFFICIAL_FAN_CLUBS;
  if (fanClubId) {
    const club = clubs.find(c => c.id === fanClubId);
    return Boolean(club?.managerEmails?.some(e => e.toLowerCase().trim() === userEmail));
  }
  return clubs.some(c => c.managerEmails?.some(e => e.toLowerCase().trim() === userEmail));
}

/**
 * Returns all active fan clubs across Hyderabad, UAE, and international chapters.
 */
fanclubRouter.get('/fanclub/clubs', (_req, res) => {
  const store = db.get();
  const clubs = store.fanClubs.length > 0 ? store.fanClubs : OFFICIAL_FAN_CLUBS;
  res.json({ clubs: clubs.filter(c => c.active) });
});

/**
 * Fan's personal check-in status, open match window (90 mins prior to match start),
 * QR code payload, and available venue offers.
 */
fanclubRouter.get('/fanclub/my-status', (req, res) => {
  const user = getAuthUser(req);
  const store = db.get();
  const now = Date.now();
  const fanClubs = store.fanClubs.length > 0 ? store.fanClubs : OFFICIAL_FAN_CLUBS;

  // Find the next upcoming or live match
  const upcomingMatches = [...store.matches]
    .filter(m => m.status === 'upcoming' || m.status === 'live')
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

  const targetMatch = upcomingMatches[0] || store.matches[0] || null;

  let checkInWindowActive = false;
  let minutesToMatch: number | null = null;

  if (targetMatch) {
    const matchStartMs = +new Date(targetMatch.startsAt);
    minutesToMatch = Math.round((matchStartMs - now) / 60_000);
    // Window opens 90 minutes before scheduled start time and stays open while match is live (up to 3 hours after start)
    checkInWindowActive = minutesToMatch <= 90 && minutesToMatch >= -180;
  }

  const fanClubCode = user ? getOrCreateFanClubCode(user.id, user.fanClubCode) : 'GUEST1';
  if (user && !user.fanClubCode) {
    user.fanClubCode = fanClubCode;
    db.save();
  }

  const qrPayload = JSON.stringify({
    type: 'adt10-fanclub-checkin',
    userId: user?.id || 'guest',
    code: fanClubCode,
    name: user?.name || 'Fan',
    issuedAt: now,
  });

  const checkedInRecord = user && targetMatch
    ? user.fanClubCheckIns?.find(c => c.matchId === targetMatch.id) || null
    : null;

  const claimedOfferIds = new Set(user?.claimedVenueOfferIds || []);

  const allOffers: (VenueOffer & { redeemed: boolean })[] = fanClubs.flatMap(fc =>
    (fc.offers || []).map(o => ({
      ...o,
      redeemed: claimedOfferIds.has(o.id),
    }))
  );

  const userEmail = (user?.email || '').toLowerCase().trim();
  const isManager = isVenueAuthorized(user);
  const managedClubs = fanClubs.filter(c =>
    user?.isSuperAdmin || user?.adminRole === 'superadmin' ||
    c.managerEmails?.some(e => e.toLowerCase().trim() === userEmail)
  );

  res.json({
    openMatch: targetMatch,
    checkInWindowActive,
    minutesToMatch,
    checkedIn: Boolean(checkedInRecord),
    checkedInRecord,
    fanClubCode,
    qrPayload,
    fanClubs: fanClubs.filter(c => c.active),
    activeOffers: allOffers,
    isVenueManager: isManager,
    managedClubIds: managedClubs.map(c => c.id),
  });
});

/**
 * Rigorous Instagram Username Validator:
 * - 1-30 characters
 * - Only letters, numbers, periods, and underscores
 * - Cannot start or end with a period
 * - Cannot contain consecutive periods (..)
 * - Rejects dummy/spam/placeholder handles
 */
export function validateInstagramUsername(username: string): { valid: boolean; reason?: string; normalized: string } {
  const clean = (username || '').trim().toLowerCase().replace(/^@/, '');
  if (!clean) return { valid: false, reason: 'Instagram username cannot be empty', normalized: '' };
  if (clean.length < 2) return { valid: false, reason: 'Instagram username must be at least 2 characters long', normalized: clean };
  if (clean.length > 30) return { valid: false, reason: 'Instagram username cannot exceed 30 characters', normalized: clean };
  
  if (!/^[a-zA-Z0-9._]+$/.test(clean)) {
    return { valid: false, reason: 'Instagram usernames can only contain letters, numbers, periods (.), and underscores (_)', normalized: clean };
  }
  if (clean.startsWith('.') || clean.endsWith('.')) {
    return { valid: false, reason: 'Instagram usernames cannot start or end with a period', normalized: clean };
  }
  if (clean.includes('..')) {
    return { valid: false, reason: 'Instagram usernames cannot contain consecutive periods', normalized: clean };
  }
  
  const BLACKLISTED = new Set([
    'instagram', 'admin', 'administrator', 'user', 'username', 'test', 'tester', 'none', 'null',
    'undefined', 'someone', 'fake', 'sample', 'dummy', 'arabianaces', 'arabianacesofficial',
    'asdf', 'qwerty', '123456', 'unknown', 'profile', 'support', 'help'
  ]);
  if (BLACKLISTED.has(clean)) {
    return { valid: false, reason: `"${clean}" is a reserved or placeholder username. Please enter your genuine personal Instagram account.`, normalized: clean };
  }
  
  return { valid: true, normalized: clean };
}

/**
 * Gatekeeper verification endpoint for adt10fans.com.
 * Accessible to all visitors (before sign-in) and signed-in users.
 * Validates Instagram handle syntax, checks handle uniqueness, confirms follow and like actions,
 * and generates a unique fan verification key.
 */
fanclubRouter.post('/fanclub/instagram/verify-gatekeeper', wrap(async (req, res) => {
  const store = db.get();
  const caller = getAuthUser(req);
  const rawHandle = str(req.body?.handle, 80);
  const followedAccount = req.body?.followedAccount === true;
  const likedPost = req.body?.likedPost === true;

  const check = validateInstagramUsername(rawHandle);
  if (!check.valid) {
    return bad(res, check.reason || 'Invalid Instagram username format');
  }

  const normalized = check.normalized;

  // Rule: Check if already registered by another fan
  const existingUser = store.users.find(u =>
    (!caller || u.id !== caller.id) &&
    u.instagramHandle &&
    u.instagramHandle.toLowerCase().replace(/^@/, '').trim() === normalized
  );

  if (existingUser) {
    return bad(res, `Instagram handle @${normalized} is already registered on adt10fans.com by fan "${existingUser.name}". Each Instagram account can only access the platform once.`);
  }

  if (!followedAccount) {
    return bad(res, 'Please confirm you have followed @ArabianAcesofficial on Instagram');
  }

  if (!likedPost) {
    return bad(res, 'Please confirm you have liked the latest match post on @ArabianAcesofficial');
  }

  // Generate deterministic verification token
  const hash = crypto.createHash('sha256').update(normalized + '-aces-ig-gatekeeper').digest('hex');
  const verificationCode = `ACES-${hash.slice(0, 4).toUpperCase()}`;

  let pointsAwarded = 0;
  if (caller) {
    caller.instagramFollowed = true;
    caller.instagramHandle = `@${normalized}`;
    caller.instagramVerificationCode = verificationCode;
    caller.instagramLikedPost = true;
    caller.instagramVerifiedAt = new Date().toISOString();
    if (!caller.badges) caller.badges = [];
    if (!caller.badges.includes('social-instagram')) {
      caller.badges.push('social-instagram');
      pointsAwarded = 25;
      awardPoints(store, caller, pointsAwarded, 'social-follow', 'Welcome to Arabian Aces on Instagram', caller.id);
    }
    db.save();
  }

  res.json({
    success: true,
    handle: `@${normalized}`,
    verificationCode,
    pointsAwarded,
    message: `Instagram @${normalized} verified! Welcome to adt10fans.com.`,
  });
}));

/**
 * Super Admin view of all verified Instagram handles across adt10fans.com
 */
fanclubRouter.get('/fanclub/admin/instagram-fans', requireUser, wrap(async (req, res) => {
  const caller = userOf(req);
  if (caller.role !== 'admin') return bad(res, 'Admin access required', 403);
  const store = db.get();
  const fans = store.users
    .filter(u => u.instagramFollowed || u.instagramHandle)
    .map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      teamId: u.teamId,
      points: u.points,
      instagramHandle: u.instagramHandle,
      verificationCode: u.instagramVerificationCode || 'VERIFIED',
      likedPost: u.instagramLikedPost ?? true,
      verifiedAt: u.instagramVerifiedAt || u.createdAt,
    }));
  res.json({ fans, total: fans.length });
}));

/**
 * Records when a user follows the official Instagram or X account, awarding welcome points.
 * Ensures the Instagram handle is uniquely associated and cannot be reused across multiple accounts.
 */
fanclubRouter.post('/fanclub/social-verify', requireUser, wrap(async (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const platform = str(req.body?.platform, 20); // 'instagram' | 'twitter'
  const handle = str(req.body?.handle, 80);

  if (!handle) return bad(res, 'Please provide your social handle');

  let awarded = 0;
  if (!user.badges) user.badges = [];

  if (platform === 'instagram') {
    const check = validateInstagramUsername(handle);
    if (!check.valid) return bad(res, check.reason || 'Invalid Instagram username format');
    const normalized = check.normalized;

    // Check if this Instagram handle is already registered by another account
    const existingOwner = store.users.find(u =>
      u.id !== user.id &&
      u.instagramHandle &&
      u.instagramHandle.toLowerCase().replace(/^@/, '').trim() === normalized
    );
    if (existingOwner) {
      return bad(res, `Instagram handle @${normalized} is already linked to another fan account (${existingOwner.name}). Each Instagram handle can only be associated with one account.`);
    }

    const hash = crypto.createHash('sha256').update(normalized + '-aces-ig-gatekeeper').digest('hex');
    user.instagramFollowed = true;
    user.instagramHandle = `@${normalized}`;
    user.instagramVerificationCode = `ACES-${hash.slice(0, 4).toUpperCase()}`;
    user.instagramLikedPost = true;
    user.instagramVerifiedAt = new Date().toISOString();
    if (!user.badges.includes('social-instagram')) {
      user.badges.push('social-instagram');
      awarded = 25;
      awardPoints(store, user, awarded, 'social-follow', 'Welcome to Arabian Aces on Instagram', user.id);
    }
  } else if (platform === 'twitter' || platform === 'x') {
    const normalized = handle.toLowerCase().replace(/^@/, '').trim();
    user.xFollowed = true;
    user.xHandle = `@${normalized}`;
    if (!user.badges.includes('social-twitter')) {
      user.badges.push('social-twitter');
      awarded = 25;
      awardPoints(store, user, awarded, 'social-follow', 'Welcome to Arabian Aces on X', user.id);
    }
  }

  db.save();
  res.json({ success: true, pointsAwarded: awarded, user: selfUser(user) });
}));

/**
 * Fan Club Venue Admin or Super Admin checks in a fan via scanned QR payload or 6-char code.
 * Strict rules enforced:
 * 1. Check-in is strictly allowed ONCE per match per fan.
 * 2. An Instagram handle cannot claim fan points multiple times for the same match across different accounts/devices.
 */
fanclubRouter.post('/fanclub/admin/checkin', requireUser, wrap(async (req, res) => {
  const admin = userOf(req);
  const store = db.get();
  const { qrPayload, code, fanClubId, matchId: explicitMatchId } = req.body || {};

  const selectedFanClubId = str(fanClubId, 80);
  if (!selectedFanClubId) return bad(res, 'Please select your active fan club station');

  const fanClubs = store.fanClubs.length > 0 ? store.fanClubs : OFFICIAL_FAN_CLUBS;
  const club = fanClubs.find(c => c.id === selectedFanClubId);
  if (!club) return bad(res, 'Fan club station not recognized');

  // Verify that the caller is authorized as Super Admin or an assigned manager for this venue
  if (!isVenueAuthorized(admin, club.id)) {
    return bad(res, `Access denied: you are not assigned as a venue manager for ${club.name}.`, 403);
  }

  // Resolve fan from QR payload or 6-char code
  let targetUserId: string | null = null;
  let targetCode = str(code, 20)?.toUpperCase();

  if (qrPayload) {
    try {
      const parsed = typeof qrPayload === 'string' ? JSON.parse(qrPayload) : qrPayload;
      if (parsed.userId) targetUserId = parsed.userId;
      if (parsed.code) targetCode = String(parsed.code).toUpperCase();
    } catch {
      targetCode = str(qrPayload, 20)?.toUpperCase();
    }
  }

  const fan = store.users.find(u =>
    (targetUserId && u.id === targetUserId) ||
    (targetCode && u.fanClubCode && u.fanClubCode.toUpperCase() === targetCode) ||
    (targetCode && getOrCreateFanClubCode(u.id) === targetCode)
  );

  if (!fan) {
    return bad(res, 'Fan not found. Please verify the QR code or 6-character code.');
  }

  // Find target match
  let match = explicitMatchId ? store.matches.find(m => m.id === explicitMatchId) : null;
  if (!match) {
    const upcoming = [...store.matches]
      .filter(m => m.status === 'upcoming' || m.status === 'live')
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
    match = upcoming[0] || store.matches[0];
  }

  if (!match) return bad(res, 'No active match scheduled for check-in');

  // Check 90-minute window
  const now = Date.now();
  const matchStartMs = +new Date(match.startsAt);
  const minutesToMatch = Math.round((matchStartMs - now) / 60_000);

  if (minutesToMatch > 90) {
    return bad(res, `Check-in window opens 90 minutes before the match (in ${minutesToMatch - 90} minutes).`);
  }

  if (minutesToMatch < -240 && match.status === 'completed') {
    return bad(res, 'Check-in window for this match has already concluded.');
  }

  // Rule 1: Strictly one check-in per match per fan
  if (!fan.fanClubCheckIns) fan.fanClubCheckIns = [];
  const alreadyCheckedIn = fan.fanClubCheckIns.some(c => c.matchId === match!.id);
  if (alreadyCheckedIn) {
    return bad(res, `${fan.name} has already checked in for Match ${match.matchNo}. Only one check-in allowed per match.`);
  }

  // Rule 2: Prevent claiming on multiple devices using the same Instagram handle
  const fanInsta = fan.instagramHandle ? fan.instagramHandle.toLowerCase().replace(/^@/, '').trim() : null;
  if (fanInsta) {
    const existingHandleCheckIn = (store.fanClubCheckIns || []).find(c =>
      c.matchId === match!.id &&
      c.userInstagramHandle &&
      c.userInstagramHandle.toLowerCase().replace(/^@/, '').trim() === fanInsta
    );
    if (existingHandleCheckIn) {
      return bad(res, `A match check-in for Match ${match.matchNo} was already claimed by an account associated with Instagram handle @${fanInsta}. Each Instagram account may only claim one check-in per match across all devices.`);
    }
  }

  // Award check-in points (100 pts default or admin-configured)
  const points = store.settings.fanClubCheckInPoints || 100;
  awardPoints(store, fan, points, 'fanclub-checkin', `Fan Club Matchday Check-In (${club.name}) · Match ${match.matchNo}`, match.id);

  const checkInRecord: FanClubCheckInRecord = {
    id: 'fcc-' + crypto.randomUUID().slice(0, 10),
    userId: fan.id,
    userName: fan.name,
    userAvatar: fan.avatar,
    userTeamId: fan.teamId,
    userInstagramHandle: fan.instagramHandle,
    fanClubId: club.id,
    fanClubName: club.name,
    matchId: match.id,
    matchNo: match.matchNo,
    adminId: admin.id,
    adminName: admin.name,
    pointsAwarded: points,
    checkedInAt: new Date().toISOString(),
  };

  if (!store.fanClubCheckIns) store.fanClubCheckIns = [];
  store.fanClubCheckIns.unshift(checkInRecord);

  fan.fanClubCheckIns.push({
    matchId: match.id,
    matchNo: match.matchNo,
    fanClubId: club.id,
    fanClubName: club.name,
    checkedInAt: checkInRecord.checkedInAt,
    pointsAwarded: points,
  });

  db.save();

  res.json({
    success: true,
    pointsAwarded: points,
    fan: {
      id: fan.id,
      name: fan.name,
      avatar: fan.avatar,
      teamId: fan.teamId,
      points: fan.points,
      fanClubCode: fan.fanClubCode,
      instagramHandle: fan.instagramHandle,
      claimedVenueOfferIds: fan.claimedVenueOfferIds || [],
    },
    fanClub: club,
    match,
    checkInRecord,
  });
}));

/**
 * Super Admin or Venue Admin adds or edits a perk for a specific venue.
 */
fanclubRouter.post('/fanclub/admin/venues/:id/perks', requireUser, wrap(async (req, res) => {
  const caller = userOf(req);
  const store = db.get();
  const venueId = req.params.id;

  const fanClubs = store.fanClubs.length > 0 ? store.fanClubs : OFFICIAL_FAN_CLUBS;
  const club = fanClubs.find(c => c.id === venueId);
  if (!club) return bad(res, 'Venue not found', 404);

  if (!isVenueAuthorized(caller, club.id)) {
    return bad(res, 'You are not authorized to edit perks for this venue', 403);
  }

  const b = req.body || {};
  const title = str(b.title, 120);
  const description = str(b.description, 300);
  const perk = str(b.perk, 80);
  const badge = str(b.badge, 50) || '🎁 Venue Perk';

  if (!title || !description || !perk) {
    return bad(res, 'Title, description, and perk text are required');
  }

  if (!club.offers) club.offers = [];

  const offerId = b.id ? str(b.id, 80) : `off-${venueId.replace(/^fc-/, '')}-${crypto.randomUUID().slice(0, 6)}`;
  const idx = club.offers.findIndex(o => o.id === offerId);

  const offerRecord: VenueOffer = {
    id: offerId,
    fanClubId: club.id,
    title,
    description,
    perk,
    badge,
    active: b.active !== undefined ? Boolean(b.active) : true,
  };

  if (idx >= 0) club.offers[idx] = offerRecord;
  else club.offers.push(offerRecord);

  // Sync back to store.fanClubs
  const storeIdx = store.fanClubs.findIndex(c => c.id === club.id);
  if (storeIdx >= 0) store.fanClubs[storeIdx] = club;
  else store.fanClubs.push(club);

  db.save();
  res.json({ success: true, offer: offerRecord, offers: club.offers });
}));

/**
 * Super Admin or Venue Admin deletes a perk from a venue.
 */
fanclubRouter.delete('/fanclub/admin/venues/:id/perks/:perkId', requireUser, wrap(async (req, res) => {
  const caller = userOf(req);
  const store = db.get();
  const { id: venueId, perkId } = req.params;

  const fanClubs = store.fanClubs.length > 0 ? store.fanClubs : OFFICIAL_FAN_CLUBS;
  const club = fanClubs.find(c => c.id === venueId);
  if (!club) return bad(res, 'Venue not found', 404);

  if (!isVenueAuthorized(caller, club.id)) {
    return bad(res, 'You are not authorized to edit perks for this venue', 403);
  }

  club.offers = (club.offers || []).filter(o => o.id !== perkId);

  const storeIdx = store.fanClubs.findIndex(c => c.id === club.id);
  if (storeIdx >= 0) store.fanClubs[storeIdx] = club;
  else store.fanClubs.push(club);

  db.save();
  res.json({ success: true, offers: club.offers });
}));

/**
 * Redeems a one-time venue offer for a fan. Once claimed, it cannot be redeemed again.
 */
fanclubRouter.post('/fanclub/admin/redeem-offer', requireUser, wrap(async (req, res) => {
  const caller = userOf(req);
  const store = db.get();
  const { userId, offerId, fanClubId } = req.body || {};

  const fanClubs = store.fanClubs.length > 0 ? store.fanClubs : OFFICIAL_FAN_CLUBS;
  const club = fanClubs.find(c => c.id === fanClubId);
  if (!club) return bad(res, 'Venue station not found', 404);

  if (!isVenueAuthorized(caller, club.id)) {
    return bad(res, 'You are not authorized to redeem perks at this venue', 403);
  }

  const fan = store.users.find(u => u.id === userId);
  if (!fan) return bad(res, 'Fan not found', 404);

  const offer = club.offers.find(o => o.id === offerId) || fanClubs.flatMap(c => c.offers).find(o => o.id === offerId);
  if (!offer) return bad(res, 'Venue offer not found', 404);

  if (!fan.claimedVenueOfferIds) fan.claimedVenueOfferIds = [];
  if (fan.claimedVenueOfferIds.includes(offer.id)) {
    return bad(res, 'This offer has already been claimed by this fan and cannot be used again.');
  }

  fan.claimedVenueOfferIds.push(offer.id);
  db.save();

  res.json({
    success: true,
    message: `Perk "${offer.title}" redeemed for ${fan.name}!`,
    offer,
    fan: selfUser(fan),
  });
}));

/**
 * Returns recent check-ins and stats for a specific venue station.
 */
fanclubRouter.get('/fanclub/admin/stats', requireUser, wrap(async (req, res) => {
  const caller = userOf(req);
  const store = db.get();
  const fanClubId = str(req.query.fanClubId, 80);

  if (fanClubId && !isVenueAuthorized(caller, fanClubId)) {
    return bad(res, 'You are not authorized to view stats for this station', 403);
  }

  const checkIns = (store.fanClubCheckIns || []).filter(c => !fanClubId || c.fanClubId === fanClubId);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = checkIns.filter(c => c.checkedInAt.slice(0, 10) === todayStr).length;

  res.json({
    totalCheckIns: checkIns.length,
    todayCheckIns: todayCount,
    recentCheckIns: checkIns.slice(0, 30),
  });
}));

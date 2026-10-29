import crypto from 'crypto';
import { Router } from 'express';
import { db, FanClub, FanClubCheckInRecord, VenueOffer } from '../db';
import { getAuthUser, requireAdmin, requireUser, selfUser } from '../auth';
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
  });
});

/**
 * Records when a user follows the official Instagram or X account, awarding welcome points.
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
    user.instagramFollowed = true;
    user.instagramHandle = handle.startsWith('@') ? handle : `@${handle}`;
    if (!user.badges.includes('social-instagram')) {
      user.badges.push('social-instagram');
      awarded = 25;
      awardPoints(store, user, awarded, 'social-follow', 'Welcome to Arabian Aces on Instagram', user.id);
    }
  } else if (platform === 'twitter' || platform === 'x') {
    user.xFollowed = true;
    user.xHandle = handle.startsWith('@') ? handle : `@${handle}`;
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
 * Fan Club Venue Admin checks in a fan via scanned QR payload or 6-char code.
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

  // Resolve fan from QR payload or 6-char code
  let targetUserId: string | null = null;
  let targetCode = str(code, 20)?.toUpperCase();

  if (qrPayload) {
    try {
      const parsed = typeof qrPayload === 'string' ? JSON.parse(qrPayload) : qrPayload;
      if (parsed.userId) targetUserId = parsed.userId;
      if (parsed.code) targetCode = String(parsed.code).toUpperCase();
    } catch {
      // If raw payload is simply the 6-character code
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

  // Allow check-in if within 90 minutes before match or during live match
  if (minutesToMatch > 90) {
    return bad(res, `Check-in window opens 90 minutes before the match (in ${minutesToMatch - 90} minutes).`);
  }

  if (minutesToMatch < -240 && match.status === 'completed') {
    return bad(res, 'Check-in window for this match has already concluded.');
  }

  // Check if fan has already checked in for this match
  if (!fan.fanClubCheckIns) fan.fanClubCheckIns = [];
  const alreadyCheckedIn = fan.fanClubCheckIns.some(c => c.matchId === match!.id);
  if (alreadyCheckedIn) {
    return bad(res, `${fan.name} is already checked in for Match ${match.matchNo} at ${club.name}.`);
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
    },
    fanClub: club,
    match,
    checkInRecord,
  });
}));

/**
 * Redeems a one-time venue offer for a fan. Once claimed, it cannot be redeemed again.
 */
fanclubRouter.post('/fanclub/admin/redeem-offer', requireUser, wrap(async (req, res) => {
  const store = db.get();
  const { userId, offerId, fanClubId } = req.body || {};

  const fan = store.users.find(u => u.id === userId);
  if (!fan) return bad(res, 'Fan not found', 404);

  const fanClubs = store.fanClubs.length > 0 ? store.fanClubs : OFFICIAL_FAN_CLUBS;
  const club = fanClubs.find(c => c.id === fanClubId);
  const offer = club?.offers.find(o => o.id === offerId) || fanClubs.flatMap(c => c.offers).find(o => o.id === offerId);

  if (!offer) return bad(res, 'Venue offer not found', 404);

  if (!fan.claimedVenueOfferIds) fan.claimedVenueOfferIds = [];
  if (fan.claimedVenueOfferIds.includes(offer.id)) {
    return bad(res, 'This offer has already been claimed by this fan and cannot be used again.');
  }

  fan.claimedVenueOfferIds.push(offer.id);
  db.save();

  res.json({
    success: true,
    message: `Offer "${offer.title}" verified and redeemed for ${fan.name}!`,
    offer,
    fan: selfUser(fan),
  });
}));

/**
 * Returns recent check-ins and stats for a specific venue station.
 */
fanclubRouter.get('/fanclub/admin/stats', requireUser, wrap(async (req, res) => {
  const store = db.get();
  const fanClubId = str(req.query.fanClubId, 80);

  const checkIns = (store.fanClubCheckIns || []).filter(c => !fanClubId || c.fanClubId === fanClubId);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = checkIns.filter(c => c.checkedInAt.slice(0, 10) === todayStr).length;

  res.json({
    totalCheckIns: checkIns.length,
    todayCheckIns: todayCount,
    recentCheckIns: checkIns.slice(0, 30),
  });
}));

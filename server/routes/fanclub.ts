import crypto from 'crypto';
import { Router } from 'express';
import { db, AppStore, FanClub, FanClubCheckInRecord, Match, User, VenueOffer } from '../db';
import { canManageFanClub, fanClubScopeOf, getAuthUser, hasPermission, rateLimit, requireAdmin, requireUser } from '../auth';
import { photoStorage, readPhoto, storePhoto } from '../uploads';
import { bad, num, str, userOf, wrap } from '../http';
import { awardPoints } from '../points';
import { gameSecret } from '../games';
import { gateSettings, isVerified, needsInstagram, verifyInPerson } from '../instagramGate';

/**
 * Fan clubs: places where fans watch matches together (a venue, a supporters' chapter).
 *
 * Nothing is built in: league admins (permission 'fanclubs') add the clubs, by hand or by importing
 * a list, and name each club's fan club admins. A fan club admin runs only their own clubs: they
 * edit the club and its offers, check fans in on matchdays (each check-in gives the fan points) and
 * redeem offers.
 *
 * A fan checks in by showing their fan club code (or its QR). One check-in per fan per match, during
 * the check-in window (opens fanClubCheckInOpensMins before the first ball, closes when the match is
 * over). Every fan must have passed the Instagram check first.
 */
export const fanclubRouter = Router();

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const QR_PREFIX = 'ADT10FC:';

/**
 * A fan's check-in code, worked out from their account with the site's secret: every server gives
 * the same code without saving anything (page views cannot save on shared storage), and it cannot be
 * guessed from the account. "Get a new code" bumps the version, which is saved.
 */
const codeCache = new Map<string, string>();
export function fanCodeFor(store: AppStore, user: Pick<User, 'id' | 'fanClubCodeVersion'>): string {
  const key = `${user.id}:${user.fanClubCodeVersion || 0}`;
  let code = codeCache.get(key);
  if (!code) {
    const h = crypto.createHmac('sha256', gameSecret(store)).update(`fanclub-code:${key}`).digest();
    code = Array.from(h.subarray(0, 6), b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
    if (codeCache.size > 200_000) codeCache.clear();
    codeCache.set(key, code);
  }
  return code;
}

const codeFrom = (raw: unknown) => {
  const s = String(raw ?? '').trim().toUpperCase();
  const m = s.startsWith(QR_PREFIX) ? s.slice(QR_PREFIX.length) : s;
  return /^[A-Z2-9]{6}$/.test(m) ? m : null;
};

const opensMins = (store: AppStore) => Math.max(15, Math.min(24 * 60, store.settings.fanClubCheckInOpensMins || 45));
const offerOpensBefore = (store: AppStore) => Math.max(0, Math.min(240, store.settings.fanClubOfferOpensBeforeMins ?? 30));
const matchMins = (store: AppStore) => Math.max(30, Math.min(600, store.settings.fanClubMatchMins || 90));

/**
 * When a match is over, for fan club purposes: when it is marked completed or abandoned, otherwise
 * matchMins after the first ball (a match still live runs on until it is completed).
 */
export function matchOver(store: AppStore, m: Match, now = Date.now()) {
  if (m.status === 'completed' || m.status === 'abandoned') return true;
  if (m.status === 'live') return false;
  return now > +new Date(m.startsAt) + matchMins(store) * 60_000;
}

/** When a match's offers can be redeemed: from offerOpensBefore minutes before the first ball until the match ends. */
export function offerWindow(store: AppStore, m: Match, now = Date.now()) {
  const opensAt = +new Date(m.startsAt) - offerOpensBefore(store) * 60_000;
  const closesAt = m.status === 'live' && now > +new Date(m.startsAt) + matchMins(store) * 60_000 ? null : +new Date(m.startsAt) + matchMins(store) * 60_000;
  return { open: now >= opensAt && !matchOver(store, m, now), opensAt: new Date(opensAt).toISOString(), closesAt: closesAt ? new Date(closesAt).toISOString() : null };
}

/** Whether check-in is open for this match now. */
export function checkInWindow(store: AppStore, m: Match, now = Date.now()) {
  const start = +new Date(m.startsAt);
  const opensAt = start - opensMins(store) * 60_000;
  // Check-in stays open until the match ends.
  const closesAt = m.status === 'completed' ? (m.updatedAt ? +new Date(m.updatedAt) : start) + 30 * 60_000 : m.status === 'live' ? start + 6 * 3600_000 : start + matchMins(store) * 60_000;
  return { open: now >= opensAt && now <= closesAt && m.status !== 'abandoned', opensAt: new Date(opensAt).toISOString(), closesAt: new Date(closesAt).toISOString() };
}

const clubTeam = (store: AppStore) => store.settings.fanClubTeamId || 'aces';
/** The season's matches plus any fan club test match (test matches exist only for the fan club desk). */
const allMatches = (store: AppStore): Match[] => [...store.matches, ...(store.fanClubTestMatches || [])];
const isTest = (m: Match) => Boolean((m as any).test);
/** The day in Abu Dhabi, e.g. 2026-11-07. */
export const uaeDay = (d: string | number | Date) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
const byStart = (a: Match, b: Match) => +new Date(a.startsAt) - +new Date(b.startsAt);

/** Whether fans can check in for this match at this club (default: the fan club team's matches). */
export function clubHasMatch(store: AppStore, club: FanClub | null | undefined, m: Match): boolean {
  if (!club) return isTest(m) || m.teamA === clubTeam(store) || m.teamB === clubTeam(store);
  if (isTest(m)) return true;
  if ((club.excludedMatchIds || []).includes(m.id)) return false;
  if ((club.extraMatchIds || []).includes(m.id)) return true;
  return m.teamA === clubTeam(store) || m.teamB === clubTeam(store);
}

/** The matches of a club; with no club, the matches of any active club. */
export function clubMatches(store: AppStore, club?: FanClub | null): Match[] {
  const clubs = club ? [club] : store.fanClubs.filter(c => c.active);
  const list = clubs.length ? allMatches(store).filter(m => clubs.some(c => clubHasMatch(store, c, m))) : allMatches(store).filter(m => clubHasMatch(store, null, m) || isTest(m));
  return list.sort(byStart);
}

/** The match fans would check in for now: the one whose window is open (earliest first), else the next one. */
export function currentMatch(store: AppStore, now = Date.now(), club?: FanClub | null): { match: Match | null; open: boolean; opensAt?: string } {
  const sorted = clubMatches(store, club);
  const open = sorted.find(m => checkInWindow(store, m, now).open);
  if (open) return { match: open, open: true };
  const next = sorted.find(m => +new Date(m.startsAt) > now && m.status !== 'completed' && m.status !== 'abandoned') || null;
  return { match: next, open: false, opensAt: next ? checkInWindow(store, next, now).opensAt : undefined };
}

/** Whether an offer applies to this match (offers without matches apply to all of the club's matches). */
const offerForMatch = (o: VenueOffer, matchId?: string | null) => !o.matchIds?.length || (Boolean(matchId) && o.matchIds.includes(String(matchId)));

/** An offer that is switched on and not run out. When fans can use it comes from the match (offerWindow). */
const offerLive = (o: VenueOffer, _now = Date.now()) => Boolean(o.active) && (!o.limit || (o.redeemed || 0) < o.limit);

const publicOffer = (o: VenueOffer) => ({ id: o.id, fanClubId: o.fanClubId, matchIds: o.matchIds || [], title: o.title, description: o.description, badge: o.badge, perk: o.perk, imageUrl: o.imageUrl, bonusPoints: o.bonusPoints || 0, perUserLimit: o.perUserLimit || 1, limit: o.limit || 0, remaining: o.limit ? Math.max(0, o.limit - (o.redeemed || 0)) : null });

const usedBy = (store: AppStore, userId: string, offerId: string) => store.fanClubRedemptions.filter(r => r.userId === userId && r.offerId === offerId).length;

/** The fan's offer at a club for their check-in there: whether they can redeem it now, and why not. */
function offerForFan(store: AppStore, fan: User, club: FanClub, o: VenueOffer, now = Date.now(), matchId?: string | null) {
  const visits = store.fanClubCheckIns.filter(c => c.userId === fan.id && c.fanClubId === club.id);
  const all = allMatches(store);
  // The fan's check-in here for a match this offer is for, that has not ended (one whose offers
  // are open now first).
  const live = visits.filter(v => {
    const m = all.find(x => x.id === v.matchId);
    return m && offerForMatch(o, m.id) && !matchOver(store, m, now) && (!matchId || m.id === matchId);
  });
  const visit = live.find(v => offerWindow(store, all.find(x => x.id === v.matchId)!, now).open) || live[0];
  const m = visit ? all.find(x => x.id === visit.matchId) || null : null;
  const used = usedBy(store, fan.id, o.id);
  const perUser = o.perUserLimit || 1;
  const w = m ? offerWindow(store, m, now) : null;
  const soldOut = Boolean(o.limit) && (o.redeemed || 0) >= (o.limit || 0);
  const reason = !o.active ? 'This offer is switched off.' : !m ? 'Check in at this fan club for the match first.' : used >= perUser ? 'You have used this offer.' : soldOut ? 'This offer has run out.' : !w!.open ? (now < +new Date(w!.opensAt) ? 'opens' : 'This offer has ended.') : null;
  return { ...publicOffer(o), clubName: club.name, matchId: m?.id || null, window: w, used, usedUp: used >= perUser, canRedeem: !reason, reason: reason === 'opens' ? null : reason, opensAt: w?.opensAt || null };
}

/** Redeem one of an offer for a fan (on the fan's phone, or at the desk). Returns an error message or the redemption. */
function redeemFor(store: AppStore, fan: User, club: FanClub, offer: VenueOffer, by: { id: string; name?: string; email: string }) {
  const view = offerForFan(store, fan, club, offer);
  if (!view.canRedeem) return { error: view.reason || `This offer opens ${offerOpensBefore(store)} minutes before the first ball.` };
  fan.claimedVenueOfferIds ||= [];
  if (!fan.claimedVenueOfferIds.includes(offer.id)) fan.claimedVenueOfferIds.push(offer.id);
  offer.redeemed = (offer.redeemed || 0) + 1;
  const bonus = offer.bonusPoints || 0;
  if (bonus) awardPoints(store, fan, bonus, 'fanclub-offer', `${offer.title} · ${club.name}`, offer.id, by.email);
  const rec = { id: 'fcr-' + crypto.randomUUID().slice(0, 10), userId: fan.id, userName: fan.name, fanClubId: club.id, offerId: offer.id, offerTitle: offer.title, matchId: view.matchId || undefined, bonusPoints: bonus, adminId: by.id, adminName: by.name, at: new Date().toISOString() };
  store.fanClubRedemptions.unshift(rec);
  if (store.fanClubRedemptions.length > 50_000) store.fanClubRedemptions.length = 50_000;
  return { redemption: rec, offer: offerForFan(store, fan, club, offer), bonusPoints: bonus };
}

const publicClub = (c: FanClub, now = Date.now()) => ({
  id: c.id, name: c.name, city: c.city, country: c.country, address: c.address, region: c.region, capacity: c.capacity,
  checkInPoints: pointsFor(db.get(), c), gamesMode: c.gamesMode || 'team',
  offers: (c.offers || []).filter(o => offerLive(o, now)).map(publicOffer),
});

export const pointsFor = (store: AppStore, c: FanClub) => Math.max(0, Math.round(c.checkInPoints ?? store.settings.fanClubCheckInPoints ?? 100));

/**
 * The team whose games this fan plays, when they are a fan club fan: anyone who has checked in at a
 * club with gamesMode 'team' gets only that team's games (Admin → Settings → fan club team). null =
 * every game.
 */
export function fanClubGamesTeam(store: AppStore, user: User | null | undefined): string | null {
  if (!user || user.role === 'admin' || !user.fanClubCheckIns?.length) return null;
  const teamId = store.settings.fanClubTeamId || 'aces';
  if (!store.teams.some(t => t.id === teamId)) return null;
  const clubs = new Map(store.fanClubs.map(c => [c.id, c]));
  const all = allMatches(store);
  // From the check-in until that match ends.
  return user.fanClubCheckIns.some(ci => {
    if ((clubs.get(ci.fanClubId)?.gamesMode || 'team') !== 'team') return false;
    const m = all.find(x => x.id === ci.matchId);
    return Boolean(m) && !matchOver(store, m!, Date.now());
  })
    ? teamId
    : null;
}

// ---------- Fans ----------

fanclubRouter.get('/fanclub/clubs', (_req, res) => {
  const now = Date.now();
  res.json({ clubs: db.get().fanClubs.filter(c => c.active).map(c => publicClub(c, now)) });
});

/** The fan's code, the match they can check in for, their check-ins and the offers they can use. */
fanclubRouter.get('/fanclub/my-status', (req, res) => {
  const user = getAuthUser(req);
  const store = db.get();
  const now = Date.now();
  const cur = currentMatch(store, now);
  const clubs = store.fanClubs.filter(c => c.active);
  const base = {
    openMatch: cur.match,
    checkInWindowActive: cur.open,
    opensAt: cur.opensAt || null,
    opensMinutesBefore: opensMins(store),
    fanClubs: clubs.map(c => publicClub(c, now)),
  };
  if (!user) return res.json({ ...base, signedIn: false });
  // Fans who have not verified Instagram still get their code: a venue admin can confirm their
  // Instagram in person when they show it at a fan club (and check them in at the same time).
  const instagramRequired = needsInstagram(store, user);
  const code = fanCodeFor(store, user);
  const claimed = new Set(user.claimedVenueOfferIds || []);
  res.json({
    ...base,
    signedIn: true,
    ...(instagramRequired ? { instagramRequired: true } : {}),
    fanClubCode: code,
    qrPayload: QR_PREFIX + code,
    checkedIn: Boolean(cur.match && user.fanClubCheckIns?.some(c => c.matchId === cur.match!.id)),
    checkedInRecord: cur.match ? user.fanClubCheckIns?.find(c => c.matchId === cur.match!.id) || null : null,
    checkIns: [...(user.fanClubCheckIns || [])].reverse().slice(0, 30),
    gamesTeamId: fanClubGamesTeam(store, user),
    // Where the fan is checked in now (until that match ends), and that club's offers for the match.
    ...(() => {
      const all = allMatches(store);
      const visit = [...store.fanClubCheckIns].sort((a, b) => String(b.checkedInAt).localeCompare(String(a.checkedInAt))).find(c => {
        if (c.userId !== user.id) return false;
        const m = all.find(x => x.id === c.matchId);
        return Boolean(m) && !matchOver(store, m!, now);
      });
      const club = visit && store.fanClubs.find(c => c.id === visit.fanClubId);
      if (!visit || !club) return { todayVisit: null, todayOffers: [] };
      const m = all.find(x => x.id === visit.matchId);
      return {
        todayVisit: { fanClubId: club.id, fanClubName: club.name, city: club.city, matchId: visit.matchId, matchNo: visit.matchNo, teamA: m?.teamA, teamB: m?.teamB, startsAt: m?.startsAt, checkedInAt: visit.checkedInAt, pointsAwarded: visit.pointsAwarded, offersOpenAt: m ? offerWindow(store, m, now).opensAt : null },
        todayOffers: club.offers.filter(o => o.active && offerForMatch(o, visit.matchId)).map(o => offerForFan(store, user, club, o, now, visit.matchId)),
      };
    })(),
    activeOffers: clubs.flatMap(c => (c.offers || []).filter(o => offerLive(o, now)).map(o => ({ ...publicOffer(o), clubName: c.name, used: claimed.has(o.id) }))),
  });
});

/** A fan asks for a new code (e.g. a screenshot of theirs was shared). */
fanclubRouter.post('/fanclub/my-code/renew', requireUser, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  user.fanClubCodeVersion = (user.fanClubCodeVersion || 0) + 1;
  const code = fanCodeFor(store, user);
  db.save();
  res.json({ fanClubCode: code, qrPayload: QR_PREFIX + code });
});

// ---------- Fan club admins ----------

const requireFanClubs = requireAdmin('fanclubs');
const leagueWide = (u: User) => hasPermission(u, 'fanclubs') && fanClubScopeOf(u) === null;

function clubFor(req: any, res: any, id: unknown): FanClub | null {
  const user = userOf(req);
  const club = db.get().fanClubs.find(c => c.id === String(id || ''));
  if (!club) {
    bad(res, 'Fan club not found', 404);
    return null;
  }
  if (!canManageFanClub(user, club.id)) {
    bad(res, 'You do not run this fan club', 403);
    return null;
  }
  return club;
}

const adminsOf = (store: AppStore, clubId: string) =>
  store.adminUsers.filter(a => a.role === 'fanclub_admin' && (a.fanClubIds || []).includes(clubId)).map(a => ({ email: a.email, name: a.name || a.email }));

/** The clubs this admin runs (every club for league admins), with offers, admins and today's numbers. */
fanclubRouter.get('/fanclub/admin/clubs', requireFanClubs, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const scope = fanClubScopeOf(user);
  const clubs = store.fanClubs.filter(c => scope === null || scope.includes(c.id));
  const today = new Date().toISOString().slice(0, 10);
  const cur = currentMatch(store);
  res.json({
    leagueWide: scope === null,
    defaultCheckInPoints: store.settings.fanClubCheckInPoints ?? 100,
    opensMinutesBefore: opensMins(store),
    currentMatch: cur.match,
    checkInOpen: cur.open,
    opensAt: cur.opensAt || null,
    fanClubTeamId: clubTeam(store),
    today: uaeDay(Date.now()),
    offerOpensBeforeMins: offerOpensBefore(store),
    matchMins: matchMins(store),
    matches: allMatches(store).sort(byStart).map(m => {
      const w = checkInWindow(store, m);
      return { id: m.id, matchNo: m.matchNo, teamA: m.teamA, teamB: m.teamB, startsAt: m.startsAt, status: m.status, open: w.open, opensAt: w.opensAt, day: uaeDay(m.startsAt), test: isTest(m) };
    }),
    clubs: clubs.map(c => ({
      ...c,
      matchIds: clubMatches(store, c).map(m => m.id),
      currentMatchId: currentMatch(store, Date.now(), c).match?.id || null,
      checkInPoints: c.checkInPoints ?? null,
      effectiveCheckInPoints: pointsFor(store, c),
      gamesMode: c.gamesMode || 'team',
      admins: adminsOf(store, c.id),
      totalCheckIns: store.fanClubCheckIns.filter(x => x.fanClubId === c.id).length,
      todayCheckIns: store.fanClubCheckIns.filter(x => x.fanClubId === c.id && x.checkedInAt.slice(0, 10) === today).length,
    })),
  });
});

function readClub(b: any, existing: FanClub | null, by: string): FanClub | string {
  const name = str(b.name ?? existing?.name, 120);
  const city = str(b.city ?? existing?.city, 60);
  const country = str(b.country ?? existing?.country, 60);
  const address = str(b.address ?? existing?.address, 200);
  if (!name || !city || !country) return 'Name, city and country are required';
  const pts = b.checkInPoints === '' || b.checkInPoints === null ? undefined : b.checkInPoints !== undefined ? Math.max(0, Math.min(1000, Math.round(num(b.checkInPoints, 0)))) : existing?.checkInPoints;
  const now = new Date().toISOString();
  return {
    id: existing?.id || `fc-${(city + '-' + name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${crypto.randomUUID().slice(0, 6)}`,
    name, city, country, address,
    region: str(b.region ?? existing?.region, 40) || undefined,
    capacity: b.capacity !== undefined && b.capacity !== '' ? Math.max(0, Math.round(num(b.capacity, 0))) || undefined : existing?.capacity,
    contactPerson: str(b.contactPerson ?? existing?.contactPerson, 100) || undefined,
    active: b.active !== undefined ? Boolean(b.active) : existing?.active ?? true,
    offers: existing?.offers || [],
    checkInPoints: pts,
    gamesMode: b.gamesMode === 'all' ? 'all' : b.gamesMode === 'team' ? 'team' : existing?.gamesMode || 'team',
    extraMatchIds: existing?.extraMatchIds || [],
    excludedMatchIds: existing?.excludedMatchIds || [],
    createdBy: existing?.createdBy || by,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

/** Add a club (league admins) or edit one (league admins, or that club's own admins). */
fanclubRouter.post('/fanclub/admin/clubs', requireFanClubs, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const b = req.body || {};
  let existing: FanClub | null = null;
  if (b.id) {
    existing = clubFor(req, res, b.id);
    if (!existing) return;
  } else if (!leagueWide(user)) return bad(res, 'Only league admins can add fan clubs', 403);
  const club = readClub(b, existing, user.email);
  if (typeof club === 'string') return bad(res, club);
  // A fan club admin may not change how their club's fans play.
  if (existing && !leagueWide(user)) club.gamesMode = existing.gamesMode || 'team';
  if (existing) store.fanClubs[store.fanClubs.indexOf(existing)] = club;
  else store.fanClubs.push(club);
  db.save();
  res.json({ success: true, club });
});

fanclubRouter.delete('/fanclub/admin/clubs/:id', requireFanClubs, (req, res) => {
  const user = userOf(req);
  if (!leagueWide(user)) return bad(res, 'Only league admins can remove fan clubs', 403);
  const store = db.get();
  const club = store.fanClubs.find(c => c.id === req.params.id);
  if (!club) return bad(res, 'Fan club not found', 404);
  if (store.fanClubCheckIns.some(c => c.fanClubId === club.id)) {
    // Keep the history of check-ins (and the points they gave) intact.
    club.active = false;
    db.save();
    return res.json({ success: true, deactivated: true, note: 'Fans have checked in here, so the club was switched off instead of deleted.' });
  }
  store.fanClubs = store.fanClubs.filter(c => c !== club);
  for (const a of store.adminUsers) if (a.fanClubIds) a.fanClubIds = a.fanClubIds.filter(id => id !== club.id);
  db.save();
  res.json({ success: true });
});

/**
 * Import or update clubs in one go (league admins): a JSON list, or CSV with a header row
 * name,city,country,address,region,capacity,contactPerson,checkInPoints,gamesMode. A row whose name
 * and city match an existing club updates it. Offers may be given per club in JSON.
 */
fanclubRouter.post('/fanclub/admin/import', requireFanClubs, (req, res) => {
  const user = userOf(req);
  if (!leagueWide(user)) return bad(res, 'Only league admins can import fan clubs', 403);
  const store = db.get();
  let rows: any[] = [];
  if (Array.isArray(req.body?.clubs)) rows = req.body.clubs;
  else if (typeof req.body?.csv === 'string') rows = parseCsv(req.body.csv);
  else return bad(res, 'Send a list of clubs or CSV text');
  if (!rows.length) return bad(res, 'Nothing to import');
  if (rows.length > 500) return bad(res, 'Import at most 500 clubs at a time');
  const errors: string[] = [];
  let added = 0;
  let updated = 0;
  let offers = 0;
  rows.forEach((r, i) => {
    const key = `${String(r.name || '').trim().toLowerCase()}|${String(r.city || '').trim().toLowerCase()}`;
    const existing = store.fanClubs.find(c => (r.id && c.id === r.id) || `${c.name.toLowerCase()}|${c.city.toLowerCase()}` === key) || null;
    const club = readClub(r, existing, user.email);
    if (typeof club === 'string') return errors.push(`Row ${i + 1}: ${club}`);
    if (Array.isArray(r.offers)) {
      for (const o of r.offers) {
        const offer = readOffer(o, club, null, user.email);
        if (typeof offer === 'string') errors.push(`Row ${i + 1} offer: ${offer}`);
        else if (!club.offers.some(x => x.title.toLowerCase() === offer.title.toLowerCase())) {
          club.offers.push(offer);
          offers++;
        }
      }
    }
    if (existing) {
      store.fanClubs[store.fanClubs.indexOf(existing)] = club;
      updated++;
    } else {
      store.fanClubs.push(club);
      added++;
    }
  });
  db.save();
  res.json({ success: true, added, updated, offers, errors });
});

/** Every club with its offers, in the import format (a backup, or a starting point for another season). */
fanclubRouter.get('/fanclub/admin/export', requireFanClubs, (req, res) => {
  const user = userOf(req);
  if (!leagueWide(user)) return bad(res, 'Only league admins can export fan clubs', 403);
  res.json({
    clubs: db.get().fanClubs.map(c => ({
      id: c.id, name: c.name, city: c.city, country: c.country, address: c.address, region: c.region, capacity: c.capacity,
      contactPerson: c.contactPerson, active: c.active, checkInPoints: c.checkInPoints, gamesMode: c.gamesMode || 'team',
      offers: c.offers.map(o => ({ title: o.title, description: o.description, perk: o.perk, badge: o.badge, bonusPoints: o.bonusPoints || 0, limit: o.limit || 0, startsAt: o.startsAt, expiresAt: o.expiresAt, active: o.active })),
    })),
  });
});

export function parseCsv(text: string): Record<string, string>[] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim())) lines.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim())) lines.push(row);
  if (lines.length < 2) return [];
  const head = lines[0].map(h => h.trim());
  return lines.slice(1).map(cells => Object.fromEntries(head.map((h, i) => [h, (cells[i] ?? '').trim()])));
}

/** Name or remove the fan club admins of a club (league admins). The person signs in with that email. */
fanclubRouter.post('/fanclub/admin/clubs/:id/admins', requireFanClubs, (req, res) => {
  const user = userOf(req);
  if (!leagueWide(user)) return bad(res, 'Only league admins can choose fan club admins', 403);
  const store = db.get();
  const club = store.fanClubs.find(c => c.id === req.params.id);
  if (!club) return bad(res, 'Fan club not found', 404);
  const email = str(req.body?.email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return bad(res, 'Enter a valid email');
  const remove = Boolean(req.body?.remove);
  const now = new Date().toISOString();
  const rec = store.adminUsers.find(a => a.email.toLowerCase() === email);
  if (remove) {
    if (rec?.role === 'fanclub_admin') {
      rec.fanClubIds = (rec.fanClubIds || []).filter(id => id !== club.id);
      if (!rec.fanClubIds.length) store.adminUsers = store.adminUsers.filter(a => a !== rec);
    }
  } else if (rec && rec.role !== 'fanclub_admin') {
    return bad(res, 'This email already has another admin role. A super admin can change it in Admin → Admins.', 409);
  } else if (rec) {
    rec.fanClubIds = Array.from(new Set([...(rec.fanClubIds || []), club.id]));
    rec.updatedAt = now;
  } else {
    store.adminUsers.push({ email, name: str(req.body?.name, 80) || email.split('@')[0], role: 'fanclub_admin', permissions: ['fanclubs'], fanClubIds: [club.id], addedBy: user.email, addedAt: now });
  }
  db.save();
  res.json({ success: true, admins: adminsOf(store, club.id) });
});

function readOffer(b: any, club: FanClub, existing: VenueOffer | null, by: string): VenueOffer | string {
  const title = str(b.title ?? existing?.title, 120);
  if (!title) return 'Give the offer a title';
  // No dates: an offer runs with its match (from offerOpensBefore minutes before the first ball to the end).
  const imageUrl = b.imageUrl !== undefined ? str(b.imageUrl, 500) : existing?.imageUrl;
  if (imageUrl && !/^(https:\/\/|\/uploads\/)/.test(imageUrl)) return 'The image must be uploaded here';
  return {
    id: existing?.id || 'off-' + crypto.randomUUID().slice(0, 10),
    fanClubId: club.id,
    title,
    description: str(b.description ?? existing?.description, 400),
    perk: str(b.perk ?? existing?.perk, 80) || title,
    badge: str(b.badge ?? existing?.badge, 40) || undefined,
    imageUrl: imageUrl || undefined,
    bonusPoints: Math.max(0, Math.min(500, Math.round(num(b.bonusPoints ?? existing?.bonusPoints, 0)))),
    matchIds: Array.isArray(b.matchIds) ? b.matchIds.map((x: unknown) => str(x, 80)).filter(Boolean).slice(0, 100) : existing?.matchIds || [],
    perUserLimit: Math.max(1, Math.min(20, Math.round(num(b.perUserLimit ?? existing?.perUserLimit, 1)))),
    limit: Math.max(0, Math.round(num(b.limit ?? existing?.limit, 0))) || undefined,
    redeemed: existing?.redeemed || 0,
    active: b.active !== undefined ? Boolean(b.active) : existing?.active ?? true,
    createdBy: existing?.createdBy || by,
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
}

/**
 * Add a match to a club, or take one out (the club's own admins and league admins). With
 * { reset: true } the club goes back to the default: every match of the fan club team.
 */
fanclubRouter.post('/fanclub/admin/clubs/:id/matches', requireFanClubs, (req, res) => {
  const club = clubFor(req, res, req.params.id);
  if (!club) return;
  const store = db.get();
  if (req.body?.reset) {
    club.extraMatchIds = [];
    club.excludedMatchIds = [];
  } else {
    const m = store.matches.find(x => x.id === String(req.body?.matchId || ''));
    if (!m) return bad(res, 'Match not found', 404);
    const include = Boolean(req.body?.include);
    const isTeam = m.teamA === clubTeam(store) || m.teamB === clubTeam(store);
    club.extraMatchIds = (club.extraMatchIds || []).filter(id => id !== m.id);
    club.excludedMatchIds = (club.excludedMatchIds || []).filter(id => id !== m.id);
    if (include && !isTeam) club.extraMatchIds.push(m.id);
    if (!include && isTeam) club.excludedMatchIds.push(m.id);
  }
  club.updatedAt = new Date().toISOString();
  db.save();
  res.json({ success: true, matchIds: clubMatches(store, club).map(m => m.id) });
});

/**
 * A test match for trying check-in (league admins): the fan club team against another team, starting
 * in 30 minutes, so check-in is open at once. It is kept apart from the season's fixtures, so fans
 * never see it in matches, games or predictions. Removing it takes back any points it gave.
 */
fanclubRouter.post('/fanclub/admin/test-match', requireFanClubs, wrap(async (req, res) => {
  const user = userOf(req);
  if (!leagueWide(user)) return bad(res, 'Only league admins can start a test match', 403);
  const r = await db.mutate(store => {
    store.fanClubTestMatches ||= [];
    if (store.fanClubTestMatches.length) return { error: 'A test match is already running. Remove it first.', status: 409 };
    const team = clubTeam(store);
    const opp = store.teams.find(t => t.id !== team)?.id;
    if (!opp || !store.teams.some(t => t.id === team)) return { error: 'The fan club team is not set up', status: 409 };
    const now = new Date();
    const m = {
      id: 'test-' + crypto.randomUUID().slice(0, 8), matchNo: 0, stage: 'Test', teamA: team, teamB: opp,
      startsAt: new Date(now.getTime() + 30 * 60_000).toISOString(), venue: 'Test', status: 'upcoming' as const,
      updatedAt: now.toISOString(), test: true as const, createdBy: user.email,
    };
    store.fanClubTestMatches.push(m as any);
    return { ok: m };
  });
  if ('error' in r) return bad(res, r.error!, r.status);
  res.json({ success: true, match: r.ok });
}));

fanclubRouter.delete('/fanclub/admin/test-match/:id', requireFanClubs, wrap(async (req, res) => {
  const user = userOf(req);
  if (!leagueWide(user)) return bad(res, 'Only league admins can remove a test match', 403);
  const r = await db.mutate(store => {
    const m = (store.fanClubTestMatches || []).find(x => x.id === req.params.id);
    if (!m) return { error: 'Test match not found', status: 404 };
    let undone = 0;
    // Take back the check-in points and offers of the test.
    for (const rec of store.fanClubCheckIns.filter(c => c.matchId === m.id)) {
      const fan = store.users.find(u => u.id === rec.userId);
      if (fan) {
        if (rec.pointsAwarded) awardPoints(store, fan, -rec.pointsAwarded, 'fanclub-checkin', 'Test check-in removed', m.id, user.email);
        fan.fanClubCheckIns = (fan.fanClubCheckIns || []).filter(c => c.matchId !== m.id);
      }
      undone++;
    }
    store.fanClubCheckIns = store.fanClubCheckIns.filter(c => c.matchId !== m.id);
    for (const red of store.fanClubRedemptions.filter(x => x.matchId === m.id)) {
      const fan = store.users.find(u => u.id === red.userId);
      if (fan) {
        if (red.bonusPoints) awardPoints(store, fan, -red.bonusPoints, 'fanclub-offer', 'Test offer removed', red.offerId, user.email);
        fan.claimedVenueOfferIds = (fan.claimedVenueOfferIds || []).filter(id => id !== red.offerId);
      }
      const offer = store.fanClubs.flatMap(c => c.offers).find(o => o.id === red.offerId);
      if (offer) offer.redeemed = Math.max(0, (offer.redeemed || 0) - 1);
    }
    store.fanClubRedemptions = store.fanClubRedemptions.filter(x => x.matchId !== m.id);
    store.fanClubTestMatches = store.fanClubTestMatches.filter(x => x.id !== m.id);
    return { ok: { undone } };
  });
  if ('error' in r) return bad(res, r.error!, r.status);
  res.json({ success: true, ...r.ok });
}));

/** Add or edit an offer at a club this admin runs. */
fanclubRouter.post('/fanclub/admin/clubs/:id/offers', requireFanClubs, (req, res) => {
  const club = clubFor(req, res, req.params.id);
  if (!club) return;
  const b = req.body || {};
  const existing = b.id ? club.offers.find(o => o.id === b.id) || null : null;
  if (b.id && !existing) return bad(res, 'Offer not found', 404);
  const offer = readOffer(b, club, existing, userOf(req).email);
  if (typeof offer === 'string') return bad(res, offer);
  if (existing) club.offers[club.offers.indexOf(existing)] = offer;
  else club.offers.push(offer);
  club.updatedAt = new Date().toISOString();
  db.save();
  res.json({ success: true, offer, offers: club.offers });
});

fanclubRouter.delete('/fanclub/admin/clubs/:id/offers/:offerId', requireFanClubs, (req, res) => {
  const club = clubFor(req, res, req.params.id);
  if (!club) return;
  const offer = club.offers.find(o => o.id === req.params.offerId);
  if (!offer) return bad(res, 'Offer not found', 404);
  // An offer fans already used is switched off, so their redemption history stays readable.
  if (offer.redeemed) offer.active = false;
  else club.offers = club.offers.filter(o => o !== offer);
  db.save();
  res.json({ success: true, offers: club.offers });
});

function fanByCode(store: AppStore, raw: unknown): User | null {
  const code = codeFrom(raw);
  return code ? store.users.find(u => fanCodeFor(store, u) === code) || null : null;
}

function matchFor(store: AppStore, matchId: unknown, club: FanClub): Match | null {
  if (matchId) return allMatches(store).find(m => m.id === String(matchId)) || null;
  return currentMatch(store, Date.now(), club).match;
}

/** Look a fan up by code before checking them in: who they are, whether they can check in, their offers. */
fanclubRouter.get('/fanclub/admin/fan', requireFanClubs, (req, res) => {
  const club = clubFor(req, res, req.query.fanClubId);
  if (!club) return;
  const store = db.get();
  const fan = fanByCode(store, req.query.code);
  if (!fan) return bad(res, 'No fan has this code. Ask the fan to open Fan Club on ADT10fans.com and show their code.', 404);
  const match = matchFor(store, req.query.matchId, club);
  const checkedIn = match ? fan.fanClubCheckIns?.find(c => c.matchId === match.id) || null : null;
  const claimed = new Set(fan.claimedVenueOfferIds || []);
  res.json({
    fan: { id: fan.id, name: fan.name, avatar: fan.avatar, teamId: fan.teamId, points: fan.points, instagramVerified: isVerified(fan) || !gateSettings(store).required, instagramHandle: fan.instagramHandle || null },
    match,
    window: match ? (clubHasMatch(store, club, match) ? checkInWindow(store, match) : { ...checkInWindow(store, match), open: false }) : null,
    matchAtThisClub: match ? clubHasMatch(store, club, match) : false,
    checkedIn,
    checkedInHereToday: hereToday(store, fan, club.id),
    offers: club.offers.filter(o => o.active && offerForMatch(o, match?.id)).map(o => offerForFan(store, fan, club, o, Date.now(), match?.id)),
  });
});

const hereToday = (store: AppStore, fan: User, clubId: string) =>
  store.fanClubCheckIns.some(c => c.userId === fan.id && c.fanClubId === clubId && Date.now() - +new Date(c.checkedInAt) < 12 * 3600_000);

/** Check a fan in for a match at this club: one per fan per match, during the window. Gives the fan points. */
fanclubRouter.post('/fanclub/admin/checkin', requireFanClubs, wrap(async (req, res) => {
  const admin = userOf(req);
  const b = req.body || {};
  const r = await db.mutate(store => {
    const club = store.fanClubs.find(c => c.id === String(b.fanClubId || ''));
    if (!club) return { status: 404, error: 'Fan club not found' };
    if (!canManageFanClub(admin, club.id)) return { status: 403, error: 'You do not run this fan club' };
    if (!club.active) return { status: 409, error: 'This fan club is switched off' };
    const fan = fanByCode(store, b.code ?? b.qrPayload);
    if (!fan) return { status: 404, error: 'No fan has this code. Ask the fan to show the code on their Fan Club page.' };
    const match = matchFor(store, b.matchId, club);
    if (!match) return { status: 409, error: 'There is no match to check in for' };
    if (!clubHasMatch(store, club, match)) return { status: 409, error: `Match ${match.matchNo} is not one of ${club.name}’s matches. An admin can add it on the club’s Matches tab.` };
    // With verifyInstagram, the venue admin confirms the fan's Instagram in person as part of the check-in.
    if (needsInstagram(store, fan)) {
      if (!b.verifyInstagram) return { status: 409, error: `${fan.name} has not verified Instagram yet. Check their Instagram on their phone, then use “Confirm Instagram and check in”.` };
      const w0 = checkInWindow(store, match);
      if (!w0.open) return { status: 409, error: `Check-in for Match ${match.matchNo} is not open, so use “Confirm Instagram only”.` };
      const err = verifyInPerson(store, fan, `${admin.email} at ${club.name}`, b.handle);
      if (err) return { status: 409, error: err };
    }
    const w = checkInWindow(store, match);
    if (!w.open) {
      const opens = new Date(w.opensAt);
      return { status: 409, error: Date.now() < +opens ? `Check-in for Match ${match.matchNo} opens ${opensMins(store)} minutes before the first ball.` : `Check-in for Match ${match.matchNo} has closed.` };
    }
    fan.fanClubCheckIns ||= [];
    const prev = fan.fanClubCheckIns.find(c => c.matchId === match.id);
    if (prev) return { status: 409, error: `${fan.name} already checked in for Match ${match.matchNo} at ${prev.fanClubName}.` };
    const points = pointsFor(store, club);
    const at = new Date().toISOString();
    if (points) awardPoints(store, fan, points, 'fanclub-checkin', `${club.name} · Match ${match.matchNo}`, match.id, admin.email);
    const rec: FanClubCheckInRecord = {
      id: 'fcc-' + crypto.randomUUID().slice(0, 10),
      userId: fan.id, userName: fan.name, userAvatar: fan.avatar, userTeamId: fan.teamId,
      fanClubId: club.id, fanClubName: club.name, matchId: match.id, matchNo: match.matchNo,
      adminId: admin.id, adminName: admin.name, pointsAwarded: points, checkedInAt: at,
    };
    store.fanClubCheckIns.unshift(rec);
    if (store.fanClubCheckIns.length > 50_000) store.fanClubCheckIns.length = 50_000;
    fan.fanClubCheckIns.push({ matchId: match.id, matchNo: match.matchNo, fanClubId: club.id, fanClubName: club.name, checkedInAt: at, pointsAwarded: points });
    return { ok: { pointsAwarded: points, fan: { id: fan.id, name: fan.name, avatar: fan.avatar, teamId: fan.teamId, points: fan.points }, match, checkInRecord: rec, offers: club.offers.filter(o => o.active && offerForMatch(o, match.id)).map(o => offerForFan(store, fan, club, o, Date.now(), match.id)) } };
  });
  if ('error' in r) return bad(res, r.error!, r.status);
  res.json({ success: true, ...r.ok });
}));

/** A venue admin confirms a fan's Instagram in person (no check-in), e.g. when there is no match today. */
fanclubRouter.post('/fanclub/admin/verify-instagram', requireFanClubs, wrap(async (req, res) => {
  const admin = userOf(req);
  const b = req.body || {};
  const r = await db.mutate(store => {
    const club = store.fanClubs.find(c => c.id === String(b.fanClubId || ''));
    if (!club) return { status: 404, error: 'Fan club not found' };
    if (!canManageFanClub(admin, club.id)) return { status: 403, error: 'You do not run this fan club' };
    const fan = fanByCode(store, b.code);
    if (!fan) return { status: 404, error: 'No fan has this code.' };
    const err = verifyInPerson(store, fan, `${admin.email} at ${club.name}`, b.handle);
    if (err) return { status: 409, error: err };
    return { ok: { fan: { id: fan.id, name: fan.name, instagramHandle: fan.instagramHandle } } };
  });
  if ('error' in r) return bad(res, r.error!, r.status);
  res.json({ success: true, ...r.ok });
}));

/** Redeem an offer of this club for a fan who checked in here today. Once per fan; gives any bonus points. */
fanclubRouter.post('/fanclub/admin/redeem-offer', requireFanClubs, wrap(async (req, res) => {
  const admin = userOf(req);
  const b = req.body || {};
  const r = await db.mutate(store => {
    const club = store.fanClubs.find(c => c.id === String(b.fanClubId || ''));
    if (!club) return { status: 404, error: 'Fan club not found' };
    if (!canManageFanClub(admin, club.id)) return { status: 403, error: 'You do not run this fan club' };
    const fan = b.code ? fanByCode(store, b.code) : store.users.find(u => u.id === String(b.userId || '')) || null;
    if (!fan) return { status: 404, error: 'Fan not found' };
    const offer = club.offers.find(o => o.id === String(b.offerId || ''));
    if (!offer) return { status: 404, error: 'This offer is not one of this club’s offers' };
    const r2 = redeemFor(store, fan, club, offer, admin);
    if ('error' in r2) return { status: 409, error: r2.error };
    const bonus = r2.bonusPoints;
    return { ok: { message: `${offer.title}: redeemed for ${fan.name}.${bonus ? ` +${bonus} points.` : ''}`, offer: r2.offer, bonusPoints: bonus, fan: { id: fan.id, name: fan.name, points: fan.points } } };
  });
  if ('error' in r) return bad(res, r.error!, r.status);
  res.json({ success: true, ...r.ok });
}));

/**
 * The fan redeems an offer on their own phone, in front of the venue staff: only at the club they
 * are checked in at, for that match, while the offer is open, within the per-fan and venue limits.
 */
fanclubRouter.post('/fanclub/offers/:offerId/redeem', requireUser, rateLimit('offer-redeem', 20, 60_000), wrap(async (req, res) => {
  const me = userOf(req);
  const r = await db.mutate(store => {
    const club = store.fanClubs.find(c => c.offers.some(o => o.id === req.params.offerId));
    const offer = club?.offers.find(o => o.id === req.params.offerId);
    const fan = store.users.find(u => u.id === me.id);
    if (!club || !offer || !fan) return { status: 404, error: 'Offer not found' };
    if (!club.active) return { status: 409, error: 'This fan club is switched off' };
    const r2 = redeemFor(store, fan, club, offer, { id: fan.id, name: `${fan.name} (on their phone)`, email: fan.email });
    if ('error' in r2) return { status: 409, error: r2.error };
    return { ok: r2 };
  });
  if ('error' in r) return bad(res, r.error!, r.status);
  res.json({ success: true, ...r.ok });
}));

/** A picture for an offer (fan club admins). Returns its address, to save with the offer. */
fanclubRouter.post('/fanclub/admin/offer-image', requireFanClubs, wrap(async (req, res) => {
  if (photoStorage().mode === 'off') return bad(res, 'Image uploads are not set up.', 503);
  const r = readPhoto(req.body?.photo);
  if ('error' in r) return bad(res, r.error);
  try {
    const stored = await storePhoto(r.bytes, r.info);
    res.json({ success: true, url: stored.url });
  } catch (e: any) {
    console.error('[FANCLUB] offer image upload failed:', e?.message);
    bad(res, 'The image could not be saved. Please try again.', 502);
  }
}));

/** Check-ins and redemptions at a club (or every club this admin runs). */
fanclubRouter.get('/fanclub/admin/stats', requireFanClubs, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const scope = fanClubScopeOf(user);
  const id = str(req.query.fanClubId, 80);
  if (id && !canManageFanClub(user, id)) return bad(res, 'You do not run this fan club', 403);
  const inScope = (clubId: string) => (id ? clubId === id : scope === null || scope.includes(clubId));
  const checkIns = store.fanClubCheckIns.filter(c => inScope(c.fanClubId));
  const redemptions = store.fanClubRedemptions.filter(c => inScope(c.fanClubId));
  const today = new Date().toISOString().slice(0, 10);
  res.json({
    totalCheckIns: checkIns.length,
    todayCheckIns: checkIns.filter(c => c.checkedInAt.slice(0, 10) === today).length,
    pointsGiven: checkIns.reduce((s, c) => s + (c.pointsAwarded || 0), 0) + redemptions.reduce((s, r) => s + (r.bonusPoints || 0), 0),
    totalRedemptions: redemptions.length,
    recentCheckIns: checkIns.slice(0, 50),
    recentRedemptions: redemptions.slice(0, 50),
  });
});

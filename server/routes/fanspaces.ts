import crypto from 'crypto';
import { Router } from 'express';
import { db } from '../db';
import { getAuthUser, rateLimit, requireAdmin, requireUser, selfUser } from '../auth';
import { bad, isHttpsUrl, newId, num, optionalUrl, str, userOf } from '../http';

export const fanSpacesRouter = Router();

const PASS_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dubaiToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });

fanSpacesRouter.get('/fanspaces', (req, res) => {
  const user = getAuthUser(req);
  const store = db.get();
  const reserved = (spaceId: string, date: string) => store.fanSpaceBookings.filter(b => b.spaceId === spaceId && b.date === date && !b.cancelledAt).reduce((s, b) => s + b.ticketsCount, 0);
  res.json({
    spaces: store.fanSpaces.map(s => ({ ...s, reservedToday: reserved(s.id, dubaiToday()) })),
    bookings: user ? store.fanSpaceBookings.filter(b => b.userId === user.id) : [],
    totalHubs: store.fanSpaces.length,
    activeCities: [...new Set(store.fanSpaces.map(s => s.city).filter(Boolean))],
  });
});

fanSpacesRouter.post('/fanspaces/:id/book', requireUser, rateLimit('booking', 10, 60_000), (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const space = store.fanSpaces.find(s => s.id === req.params.id);
  if (!space) return bad(res, 'Fan Space not found', 404);
  if (space.status === 'sold_out' || space.bookingEnabled === false) return bad(res, 'Reservations are not open for this Fan Space');
  const ticketType = req.body?.ticketType === 'vip_pass' ? 'vip_pass' : 'standard_entry';
  if (ticketType === 'vip_pass' && !space.vipPerks?.length && !space.vipPassPriceAed) return bad(res, 'This Fan Space has no VIP passes');
  const ticketsCount = Math.min(6, Math.max(1, Math.round(num(req.body?.ticketsCount, 1))));
  const date = str(req.body?.date, 10);
  if (!DATE.test(date)) return bad(res, 'Choose a date');
  if (date < dubaiToday()) return bad(res, 'Choose a date from today onwards');
  if (store.fanSpaceBookings.some(b => b.spaceId === space.id && b.userId === user.id && b.date === date && !b.cancelledAt)) return bad(res, 'You already have a pass for this Fan Space on that date');
  const reserved = store.fanSpaceBookings.filter(b => b.spaceId === space.id && b.date === date && !b.cancelledAt).reduce((s, b) => s + b.ticketsCount, 0);
  if (space.capacity && reserved + ticketsCount > space.capacity) return bad(res, `Only ${Math.max(0, space.capacity - reserved)} place(s) left on that date`);
  let passCode = '';
  do passCode = `${(space.city || 'FS').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X')}-${Array.from(crypto.randomBytes(6), b => PASS_ALPHABET[b % PASS_ALPHABET.length]).join('')}`;
  while (store.fanSpaceBookings.some(b => b.passCode === passCode));
  const booking = { id: newId('bk'), spaceId: space.id, spaceName: space.name, userId: user.id, userName: user.name, userEmail: user.email, date, ticketType, ticketsCount, passCode, createdAt: new Date().toISOString(), checkedInAt: null, checkedInBy: null } as const;
  store.fanSpaceBookings.unshift({ ...booking });
  space.totalBookings = store.fanSpaceBookings.filter(b => b.spaceId === space.id && !b.cancelledAt).reduce((s, b) => s + b.ticketsCount, 0);
  db.save();
  res.json({ success: true, booking, passCode, user: selfUser(user) });
});

fanSpacesRouter.post('/fanspaces/bookings/:id/cancel', requireUser, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const b = store.fanSpaceBookings.find(x => x.id === req.params.id && x.userId === user.id);
  if (!b) return bad(res, 'Booking not found', 404);
  if (b.checkedInAt) return bad(res, 'This pass has already been used');
  b.cancelledAt = new Date().toISOString();
  const space = store.fanSpaces.find(s => s.id === b.spaceId);
  if (space) space.totalBookings = store.fanSpaceBookings.filter(x => x.spaceId === space.id && !x.cancelledAt).reduce((s, x) => s + x.ticketsCount, 0);
  db.save();
  res.json({ success: true, booking: b });
});

fanSpacesRouter.get('/admin/fanspaces/bookings', requireAdmin('fanspaces'), (_req, res) => res.json({ bookings: db.get().fanSpaceBookings }));

/** Door check-in: scan the QR on the fan's pass (or type the code). Each pass works once. */
fanSpacesRouter.post('/admin/fanspaces/checkin', requireAdmin('fanspaces'), (req, res) => {
  const store = db.get();
  const raw = str(req.body?.code, 200).toUpperCase();
  const code = raw.replace(/^ADT10PASS:/, '').trim();
  const b = store.fanSpaceBookings.find(x => x.passCode.toUpperCase() === code);
  if (!b) return bad(res, 'No pass with that code', 404);
  if (b.cancelledAt) return bad(res, 'This pass was cancelled', 409);
  const today = dubaiToday();
  if (b.date !== today && !req.body?.anyDate) return bad(res, `This pass is for ${b.date}, not today`, 409);
  if (b.checkedInAt) return res.status(409).json({ error: `Already checked in at ${new Date(b.checkedInAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit' })}`, booking: b });
  b.checkedInAt = new Date().toISOString();
  b.checkedInBy = userOf(req).email;
  db.save();
  res.json({ success: true, booking: b });
});

fanSpacesRouter.post('/admin/fanspaces', requireAdmin('fanspaces'), (req, res) => {
  const b = req.body || {};
  const store = db.get();
  const name = str(b.name, 100);
  const city = str(b.city, 60);
  if (!name || !city) return bad(res, 'Name and city are required');
  const image = optionalUrl(b.image);
  const mapUrl = optionalUrl(b.mapUrl);
  if (image === null || mapUrl === null) return bad(res, 'Image and map links must start with https://');
  const list = (v: any) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []).map((x: any) => str(x, 80)).filter(Boolean);
  const idx = b.id ? store.fanSpaces.findIndex(s => s.id === b.id) : -1;
  const space = {
    ...(idx >= 0 ? store.fanSpaces[idx] : {}),
    id: idx >= 0 ? store.fanSpaces[idx].id : newId('space'),
    name, city, country: str(b.country, 60), tagline: str(b.tagline, 160), location: str(b.location, 200),
    capacity: Math.max(0, Math.round(num(b.capacity, 0))),
    status: ['active', 'upcoming', 'sold_out'].includes(b.status) ? b.status : 'upcoming',
    image: image || '', mapUrl: mapUrl || '', features: list(b.features), amenities: list(b.amenities),
    openHours: str(b.openHours, 120), liveMatchSchedule: str(b.liveMatchSchedule, 200),
    vipPassPriceAed: Math.max(0, num(b.vipPassPriceAed, 0)), vipPassPriceUsd: Math.max(0, num(b.vipPassPriceUsd, 0)),
    vipPerks: list(b.vipPerks), merchBoutique: str(b.merchBoutique, 200), menuHighlights: str(b.menuHighlights, 200),
    bookingEnabled: b.bookingEnabled !== false,
    totalBookings: idx >= 0 ? store.fanSpaces[idx].totalBookings : 0,
  };
  if (idx >= 0) store.fanSpaces[idx] = space as any;
  else store.fanSpaces.push(space as any);
  db.save();
  res.json({ success: true, spaces: store.fanSpaces });
});

fanSpacesRouter.delete('/admin/fanspaces/:id', requireAdmin('fanspaces'), (req, res) => {
  const store = db.get();
  store.fanSpaces = store.fanSpaces.filter(s => s.id !== req.params.id);
  db.save();
  res.json({ success: true, spaces: store.fanSpaces });
});

// ---------- growth programmes ----------
fanSpacesRouter.get('/growth-catalysts', (_req, res) => {
  const s = db.get();
  res.json({ youthSchools: s.youthSchools, creatorPartners: s.creatorPartners, commentaryFeeds: s.commentaryFeeds, passportTiers: s.passportTiers });
});

function upsert<T extends { id: string }>(list: T[], item: T, idProvided: boolean): T[] {
  const idx = idProvided ? list.findIndex(x => x.id === item.id) : -1;
  if (idx >= 0) list[idx] = { ...list[idx], ...item };
  else list.push(item);
  return list;
}

fanSpacesRouter.post('/admin/growth/youth-school', requireAdmin('growth'), (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 120);
  if (!name) return bad(res, 'School name is required');
  const store = db.get();
  upsert(store.youthSchools, {
    id: str(b.id, 60) || newId('school'), name, region: str(b.region, 40) || 'UAE', city: str(b.city, 60),
    studentsCount: Math.max(0, Math.round(num(b.studentsCount, 0))), tapeBallTeam: str(b.tapeBallTeam, 80),
    status: ['registered', 'bracket_qualified', 'champion'].includes(b.status) ? b.status : 'registered',
    equipmentKitGranted: Boolean(b.equipmentKitGranted), matchdayTicketsAllocated: Math.max(0, Math.round(num(b.matchdayTicketsAllocated, 0))),
  }, Boolean(b.id));
  db.save();
  res.json({ success: true, youthSchools: store.youthSchools });
});
fanSpacesRouter.delete('/admin/growth/youth-school/:id', requireAdmin('growth'), (req, res) => {
  const store = db.get();
  store.youthSchools = store.youthSchools.filter(s => s.id !== req.params.id);
  db.save();
  res.json({ success: true, youthSchools: store.youthSchools });
});

fanSpacesRouter.post('/admin/growth/creator', requireAdmin('growth'), (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 80);
  if (!name) return bad(res, 'Creator name is required');
  if (!isHttpsUrl(b.streamUrl)) return bad(res, "Add the creator's channel or profile link (https://)");
  const avatar = optionalUrl(b.avatar);
  if (avatar === null) return bad(res, 'Avatar must be an https:// image link');
  const store = db.get();
  upsert(store.creatorPartners, {
    id: str(b.id, 60) || newId('creator'), name, handle: str(b.handle, 80),
    platform: ['YouTube', 'Twitch', 'Kick', 'TikTok'].includes(b.platform) ? b.platform : 'YouTube',
    followers: str(b.followers, 20) || undefined, streamUrl: str(b.streamUrl, 500), specialty: str(b.specialty, 120),
    status: ['live', 'scheduled', 'partnered'].includes(b.status) ? b.status : 'partnered',
    totalWatchViews: str(b.totalWatchViews, 20) || undefined, avatar: avatar || '',
  }, Boolean(b.id));
  db.save();
  res.json({ success: true, creatorPartners: store.creatorPartners });
});
fanSpacesRouter.delete('/admin/growth/creator/:id', requireAdmin('growth'), (req, res) => {
  const store = db.get();
  store.creatorPartners = store.creatorPartners.filter(c => c.id !== req.params.id);
  db.save();
  res.json({ success: true, creatorPartners: store.creatorPartners });
});

fanSpacesRouter.post('/admin/growth/audio-feed', requireAdmin('growth'), (req, res) => {
  const b = req.body || {};
  if (!isHttpsUrl(b.streamUrl)) return bad(res, 'Add the stream or broadcast link (https://)');
  const store = db.get();
  upsert(store.commentaryFeeds, {
    id: str(b.id, 60) || newId('audio'),
    language: ['Arabic', 'English', 'Hindi', 'Urdu', 'Bengali'].includes(b.language) ? b.language : 'English',
    commentator: str(b.commentator, 80), status: b.status === 'live' ? 'live' : 'standby', streamUrl: str(b.streamUrl, 500),
    description: str(b.description, 300) || undefined,
  } as any, Boolean(b.id));
  db.save();
  res.json({ success: true, commentaryFeeds: store.commentaryFeeds });
});
fanSpacesRouter.delete('/admin/growth/audio-feed/:id', requireAdmin('growth'), (req, res) => {
  const store = db.get();
  store.commentaryFeeds = store.commentaryFeeds.filter(f => f.id !== req.params.id);
  db.save();
  res.json({ success: true, commentaryFeeds: store.commentaryFeeds });
});

fanSpacesRouter.post('/admin/growth/passport-tier', requireAdmin('growth'), (req, res) => {
  const b = req.body || {};
  const tierName = str(b.tierName, 60);
  if (!tierName) return bad(res, 'Tier name is required');
  const signupUrl = optionalUrl(b.signupUrl);
  if (signupUrl === null) return bad(res, 'Sign-up link must start with https://');
  const store = db.get();
  const id = str(b.id, 60) || newId('tier');
  upsert(store.passportTiers, {
    id, tierName, description: str(b.description, 400) || undefined,
    annualFeeUsd: Math.max(0, num(b.annualFeeUsd, 0)), annualFeeAed: Math.max(0, num(b.annualFeeAed, 0)),
    ticketDiscountPct: Math.min(100, Math.max(0, num(b.ticketDiscountPct, 0))), fanSpacePriorityEntry: Boolean(b.fanSpacePriorityEntry),
    exclusiveBadge: str(b.exclusiveBadge, 60), doublePointsMultiplier: Boolean(b.doublePointsMultiplier), signupUrl: signupUrl || undefined,
    totalSubscribers: store.passportInterest.filter(p => p.tierId === id).length,
  }, Boolean(b.id));
  db.save();
  res.json({ success: true, passportTiers: store.passportTiers });
});
fanSpacesRouter.delete('/admin/growth/passport-tier/:id', requireAdmin('growth'), (req, res) => {
  const store = db.get();
  store.passportTiers = store.passportTiers.filter(t => t.id !== req.params.id);
  store.passportInterest = store.passportInterest.filter(p => p.tierId !== req.params.id);
  db.save();
  res.json({ success: true, passportTiers: store.passportTiers });
});

fanSpacesRouter.post('/growth/superfan-passport/subscribe', requireUser, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const tier = store.passportTiers.find(t => t.id === req.body?.tierId) || (store.passportTiers.length === 1 ? store.passportTiers[0] : undefined);
  if (!tier) return bad(res, 'Choose a membership tier', 404);
  const already = store.passportInterest.some(p => p.tierId === tier.id && p.userId === user.id);
  if (!already) store.passportInterest.push({ tierId: tier.id, userId: user.id, createdAt: new Date().toISOString() });
  tier.totalSubscribers = store.passportInterest.filter(p => p.tierId === tier.id).length;
  db.save();
  res.json({ success: true, user: selfUser(user), alreadyRegistered: already, tier });
});

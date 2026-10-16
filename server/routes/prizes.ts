import crypto from 'crypto';
import { Router } from 'express';
import { db, PrizeDraw, PrizeItem } from '../db';
import { getAuthUser, rateLimit, requireAdmin, requireUser, selfUser } from '../auth';
import { bad, isColor, isoOrEmpty, newId, num, optionalUrl, str, userOf, wrap } from '../http';
import { dispatchNotification } from '../notify';
import { awardPoints, balanceOf, ledgerFor, refundPoints, spendPoints, summaryFor } from '../points';

export const prizesRouter = Router();

export function drawStatus(d: PrizeDraw): PrizeDraw['status'] {
  if (d.status === 'drawn') return 'drawn';
  if (d.status === 'closed' || +new Date(d.closesAt) <= Date.now()) return 'closed';
  return 'open';
}

// ---------- prize draws ----------
prizesRouter.get('/draws', (req, res) => {
  const user = getAuthUser(req);
  const store = db.get();
  const mine = new Set(user ? store.drawEntries.filter(e => e.userId === user.id).map(e => e.drawId) : []);
  const draws = store.draws.map(({ winnerUserId, ...d }) => {
    const entries = store.drawEntries.filter(e => e.drawId === d.id);
    return {
      ...d,
      status: drawStatus(d as PrizeDraw),
      entriesCount: entries.length,
      entered: mine.has(d.id),
      wonByMe: Boolean(user && winnerUserId === user.id),
      // Anyone can re-check a drawn result: the sorted entrant ids hash to entrantsHash, and
      // sha256(seed + ':' + entrantsHash) picks index parseInt(first 8 hex chars) % entries.
      verification: d.status === 'drawn' ? { seed: d.seed, entrantsHash: d.entrantsHash, entries: entries.length } : undefined,
    };
  });
  res.json({ draws, myEntries: [...mine] });
});

prizesRouter.post('/draws/:id/enter', requireUser, rateLimit('draw', 20, 60_000), (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const draw = store.draws.find(d => d.id === req.params.id);
  if (!draw) return bad(res, 'Draw not found', 404);
  if (drawStatus(draw) !== 'open') return bad(res, 'This draw is closed');
  if (draw.teamOnly && user.teamId !== draw.teamOnly) {
    const t = store.teams.find(x => x.id === draw.teamOnly);
    return bad(res, `This draw is only for ${t?.name || 'one team'} fans`, 403);
  }
  if (draw.minPoints && user.points < draw.minPoints) return bad(res, `You need ${draw.minPoints} season points to enter (you have ${user.points}).`, 403);
  if (store.drawEntries.some(e => e.drawId === draw.id && e.userId === user.id)) return bad(res, "You're already in this draw");
  store.drawEntries.push({ drawId: draw.id, userId: user.id, userEmail: user.email, userName: user.name, createdAt: new Date().toISOString() });
  db.save();
  res.json({ success: true, message: "You're in! Good luck." });
});

prizesRouter.post('/admin/draws', requireAdmin('draws'), (req, res) => {
  const b = req.body || {};
  const store = db.get();
  const title = str(b.title, 150);
  const prize = str(b.prize, 200);
  const closesAt = isoOrEmpty(b.closesAt);
  if (!title || !prize) return bad(res, 'Title and prize are required');
  if (!closesAt) return bad(res, 'Closing date is required');
  const teamOnly = str(b.teamOnly, 60) || null;
  if (teamOnly && !store.teams.some(t => t.id === teamOnly)) return bad(res, 'Unknown team');
  const idx = b.id ? store.draws.findIndex(d => d.id === b.id) : -1;
  if (idx >= 0 && store.draws[idx].status === 'drawn') return bad(res, 'This draw has already been drawn');
  const draw: PrizeDraw = {
    ...(idx >= 0 ? store.draws[idx] : {}),
    id: idx >= 0 ? store.draws[idx].id : newId('draw'),
    title,
    prize,
    description: str(b.description, 800),
    color: isColor(b.color) ? b.color : '#F59E0B',
    closesAt,
    status: b.status === 'closed' ? 'closed' : 'open',
    teamOnly,
    minPoints: Math.max(0, Math.round(num(b.minPoints, 0))),
    createdAt: idx >= 0 ? store.draws[idx].createdAt : new Date().toISOString(),
  };
  if (idx >= 0) store.draws[idx] = draw;
  else store.draws.push(draw);
  db.save();
  res.json({ success: true, draws: store.draws });
});

prizesRouter.delete('/admin/draws/:id', requireAdmin('draws'), (req, res) => {
  const store = db.get();
  store.draws = store.draws.filter(d => d.id !== req.params.id);
  store.drawEntries = store.drawEntries.filter(e => e.drawId !== req.params.id);
  db.save();
  res.json({ success: true, draws: store.draws });
});

prizesRouter.get('/admin/draws/:id/entries', requireAdmin('draws'), (req, res) => {
  res.json({ entries: db.get().drawEntries.filter(e => e.drawId === req.params.id).map(({ userName, userEmail, createdAt }) => ({ userName, userEmail, createdAt })) });
});

/** Verifiable draw: winnerIndex = int(sha256(seed + ':' + entrantsHash)[0..8], 16) % entries, entrants sorted by id. */
export function pickWinner(entries: { userId: string }[], seed: string) {
  const sorted = [...entries].sort((a, b) => a.userId.localeCompare(b.userId));
  const entrantsHash = crypto.createHash('sha256').update(sorted.map(e => e.userId).join(':')).digest('hex');
  const h = crypto.createHash('sha256').update(`${seed}:${entrantsHash}`).digest('hex');
  return { index: parseInt(h.slice(0, 8), 16) % sorted.length, sorted, entrantsHash };
}

prizesRouter.post('/draws/:id/execute', requireAdmin('draws'), wrap(async (req, res) => {
  const store = db.get();
  const draw = store.draws.find(d => d.id === req.params.id);
  if (!draw) return bad(res, 'Draw not found', 404);
  if (draw.status === 'drawn') return bad(res, 'Already drawn');
  const entries = store.drawEntries.filter(e => e.drawId === draw.id);
  if (!entries.length) return bad(res, 'No entries yet');
  const seed = crypto.randomBytes(16).toString('hex');
  const { index, sorted, entrantsHash } = pickWinner(entries, seed);
  const winner = sorted[index] as typeof entries[number];
  Object.assign(draw, { status: 'drawn', winnerUserId: winner.userId, winnerName: winner.userName, seed, entrantsHash, drawnAt: new Date().toISOString() });
  db.save();
  await dispatchNotification({
    title: `🎉 You won: ${draw.prize}`,
    body: `You were drawn as the winner of "${draw.title}". We'll email you with how to collect it.`,
    category: 'perk',
    targetAudience: 'users',
    userIds: [winner.userId],
    data: { url: '/prizes' },
    priority: 'high',
    createdBy: 'Prize draws',
  });
  res.json({ success: true, draw, winner: { userName: winner.userName, userEmail: winner.userEmail } });
}));

// ---------- prize catalogue (spend points) ----------
const balance = balanceOf;

prizesRouter.get('/prizes', (req, res) => {
  const user = getAuthUser(req);
  const store = db.get();
  const prizes = store.prizes.filter(p => p.active).map(p => ({ ...p, claimed: store.redemptions.filter(r => r.prizeId === p.id && r.status !== 'cancelled').length }));
  res.json({
    prizes,
    balance: user ? balance(user) : null,
    myRedemptions: user ? store.redemptions.filter(r => r.userId === user.id) : [],
  });
});

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
prizesRouter.post('/prizes/:id/redeem', requireUser, rateLimit('redeem', 10, 60_000), (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const prize = store.prizes.find(p => p.id === req.params.id && p.active);
  if (!prize) return bad(res, 'Prize not found', 404);
  if (prize.teamOnly && user.teamId !== prize.teamOnly) return bad(res, `This prize is for ${store.teams.find(t => t.id === prize.teamOnly)?.name || 'one team'} fans`, 403);
  const claimed = store.redemptions.filter(r => r.prizeId === prize.id && r.status !== 'cancelled').length;
  if (claimed >= prize.stock) return bad(res, 'This prize has all been claimed', 409);
  if (store.redemptions.some(r => r.prizeId === prize.id && r.userId === user.id && r.status !== 'cancelled')) return bad(res, 'You have already claimed this prize', 409);
  if (balance(user) < prize.pointsCost) return bad(res, `You need ${prize.pointsCost} points; you have ${balance(user)} to spend.`, 402);
  const code = Array.from(crypto.randomBytes(8), b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  const redemptionId = newId('rdm');
  spendPoints(store, user, prize.pointsCost, `${prize.title} (claim ${code})`, redemptionId);
  const redemption = {
    id: redemptionId, prizeId: prize.id, prizeTitle: prize.title, userId: user.id, userName: user.name, userEmail: user.email,
    pointsCost: prize.pointsCost, code, status: 'pending' as const, createdAt: new Date().toISOString(),
  };
  store.redemptions.unshift(redemption);
  db.save();
  res.json({ success: true, redemption, fulfilment: prize.fulfilment, user: selfUser(user) });
});

prizesRouter.get('/admin/prizes', requireAdmin('prizes'), (_req, res) => {
  const store = db.get();
  res.json({ prizes: store.prizes, redemptions: store.redemptions.slice(0, 3000) });
});

prizesRouter.post('/admin/prizes', requireAdmin('prizes'), (req, res) => {
  const b = req.body || {};
  const store = db.get();
  const title = str(b.title, 120);
  if (!title) return bad(res, 'Prize name is required');
  const pointsCost = Math.round(num(b.pointsCost, 0));
  if (pointsCost < 1) return bad(res, 'Set how many points it costs');
  const stock = Math.max(0, Math.round(num(b.stock, 0)));
  const fulfilment = str(b.fulfilment, 300);
  if (!fulfilment) return bad(res, 'Say how fans will receive it (e.g. "Collect at the Fan Zone with your code")');
  const image = optionalUrl(b.image);
  if (image === null) return bad(res, 'Image must be an https:// link');
  const teamOnly = str(b.teamOnly, 60) || null;
  if (teamOnly && !store.teams.some(t => t.id === teamOnly)) return bad(res, 'Unknown team');
  const idx = b.id ? store.prizes.findIndex(p => p.id === b.id) : -1;
  const prize: PrizeItem = {
    ...(idx >= 0 ? store.prizes[idx] : {}),
    id: idx >= 0 ? store.prizes[idx].id : newId('prize'),
    title,
    description: str(b.description, 600),
    image: image || undefined,
    pointsCost,
    stock,
    teamOnly,
    active: b.active !== false,
    fulfilment,
    createdAt: idx >= 0 ? store.prizes[idx].createdAt : new Date().toISOString(),
  };
  if (idx >= 0) store.prizes[idx] = prize;
  else store.prizes.push(prize);
  db.save();
  res.json({ success: true, prize, prizes: store.prizes });
});

prizesRouter.delete('/admin/prizes/:id', requireAdmin('prizes'), (req, res) => {
  const store = db.get();
  if (store.redemptions.some(r => r.prizeId === req.params.id && r.status === 'pending')) return bad(res, 'Fans have pending claims for this prize. Fulfil or cancel them first, or switch the prize off instead.', 409);
  store.prizes = store.prizes.filter(p => p.id !== req.params.id);
  db.save();
  res.json({ success: true, prizes: store.prizes });
});

/** Mark a claim fulfilled, or cancel it (cancelling refunds the points). */
prizesRouter.post('/admin/redemptions/:id', requireAdmin('prizes'), wrap(async (req, res) => {
  const store = db.get();
  const r = store.redemptions.find(x => x.id === req.params.id);
  if (!r) return bad(res, 'Claim not found', 404);
  const status = req.body?.status;
  if (!['fulfilled', 'cancelled'].includes(status)) return bad(res, 'Choose fulfilled or cancelled');
  if (r.status !== 'pending') return bad(res, `This claim is already ${r.status}`);
  r.status = status;
  r.updatedAt = new Date().toISOString();
  r.note = str(req.body?.note, 200) || undefined;
  const u = store.users.find(x => x.id === r.userId);
  if (status === 'cancelled' && u) refundPoints(store, u, r.pointsCost, `${r.prizeTitle} (claim ${r.code})${r.note ? `: ${r.note}` : ''}`, r.id, userOf(req).email);
  db.save();
  if (u) {
    await dispatchNotification({
      title: status === 'fulfilled' ? `🎁 ${r.prizeTitle}: on its way` : `${r.prizeTitle}: claim cancelled`,
      body: status === 'fulfilled' ? `Your claim ${r.code} has been fulfilled.${r.note ? ` ${r.note}` : ''}` : `Your claim ${r.code} was cancelled and ${r.pointsCost} points were returned.${r.note ? ` ${r.note}` : ''}`,
      category: 'perk',
      targetAudience: 'users',
      userIds: [u.id],
      data: { url: '/prizes' },
      createdBy: 'Prizes',
    });
  }
  res.json({ success: true, redemption: r });
}));

// ---------- fan points (admin) ----------

/** Finds fans by name, email or claim code, with their points and recent history. */
prizesRouter.get('/admin/points', requireAdmin('prizes'), (req, res) => {
  const store = db.get();
  const q = str(req.query.q, 120).toLowerCase();
  let users = store.users;
  if (q) {
    const byCode = store.redemptions.filter(r => r.code.toLowerCase() === q).map(r => r.userId);
    users = users.filter(u => byCode.includes(u.id) || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || u.id === q);
  } else {
    users = [...users].sort((a, b) => b.points - a.points);
  }
  const row = (u: (typeof users)[number]) => ({
    id: u.id, name: u.name, email: u.email, teamId: u.teamId || null, createdAt: u.createdAt,
    points: u.points, pointsSpent: u.pointsSpent || 0, balance: balanceOf(u),
    invited: store.users.filter(x => x.referredBy === u.id).length,
  });
  const fans = users.slice(0, 25).map(row);
  const wanted = str(req.query.id, 80) || (fans.length === 1 ? fans[0].id : '');
  const detail = wanted ? store.users.find(u => u.id === wanted) : null;
  res.json({
    fans,
    detail: detail
      ? {
          id: detail.id,
          fan: row(detail),
          bySource: summaryFor(store, detail.id),
          ledger: ledgerFor(store, detail.id, 300),
          claims: store.redemptions.filter(r => r.userId === detail.id),
          // Points earned before the ledger existed (October 2026) are not itemised.
          unitemised: detail.points - store.pointsLedger.filter(e => e.userId === detail.id && e.bucket === 'earned').reduce((s, e) => s + e.delta, 0),
        }
      : null,
  });
});

/** Adds or removes points with a reason (corrections, fraud, goodwill). Recorded with the admin's email. */
prizesRouter.post('/admin/points/:userId/adjust', requireAdmin('prizes'), (req, res) => {
  const store = db.get();
  const fan = store.users.find(u => u.id === req.params.userId);
  if (!fan) return bad(res, 'Fan not found', 404);
  const delta = Math.round(num(req.body?.delta, 0));
  const reason = str(req.body?.reason, 200);
  if (!delta || Math.abs(delta) > 100_000) return bad(res, 'Enter a whole number of points to add (or a negative number to remove)');
  if (reason.length < 5) return bad(res, 'Give a reason (the fan sees it in their points history)');
  const applied = awardPoints(store, fan, delta, 'admin', reason, undefined, userOf(req).email);
  db.save();
  res.json({ success: true, applied, points: fan.points, balance: balanceOf(fan) });
});

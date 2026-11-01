import { Router } from 'express';
import { db } from '../db';
import { getAuthUser, hasPermission, rateLimit, requireAdmin, requireUser, selfUser } from '../auth';
import { bad, userOf, wrap } from '../http';
import { creditsFor, DREAM_XI } from '../fantasy';
import { matchOpen, matchOpensAt } from '../matchWindow';
import { fanClubGamesTeam } from './fanclub';
import { PICK_SIZE, gamesTeamId, myPick, pickLocked, pickPool, scoreTeamPicks, settleTeamGames, teamContestId, validatePick } from '../teamGames';

/** Team games (Pick 5 and the team predictions); see teamGames.ts. */
export const teamGamesRouter = Router();

teamGamesRouter.get('/team-games', (req, res) => {
  const user = getAuthUser(req);
  const store = db.get();
  const teamId = gamesTeamId(store);
  const team = store.teams.find(t => t.id === teamId);
  if (!team) return res.json({ team: null, matches: [] });
  const now = Date.now();
  const mine = new Map(store.contestEntries.filter(e => user && e.userId === user.id).map(e => [e.contestId, e]));
  const matches = [...store.matches]
    .filter(m => m.teamA === teamId || m.teamB === teamId)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    .map(m => {
      const c = store.contests.find(x => x.id === teamContestId(m));
      const pick = user ? myPick(store, user.id, m.id) : null;
      return {
        matchId: m.id, matchNo: m.matchNo, teamA: m.teamA, teamB: m.teamB, startsAt: m.startsAt, status: m.status,
        open: matchOpen(m, now), locked: pickLocked(m), opensAt: matchOpensAt(m),
        pick: pick ? { playerIds: pick.playerIds, captainId: pick.captainId, points: pick.points ?? null, scored: Boolean(pick.scoredAt) } : null,
        picks: store.teamPicks.filter(p => p.matchId === m.id).length,
        contestId: c?.id || null,
        contestStatus: c ? (c.status === 'open' && c.locksAt && +new Date(c.locksAt) <= now ? 'locked' : c.status) : null,
        predicted: c ? mine.has(c.id) : false,
        predictionPoints: c ? mine.get(c.id)?.pointsAwarded ?? null : null,
      };
    });
  res.json({
    team: { id: team.id, name: team.name, short: team.short, logo: team.logo, color: team.color },
    onlyTeamGames: Boolean(fanClubGamesTeam(store, user)),
    pickSize: PICK_SIZE,
    captainMultiplier: DREAM_XI.captainMultiplier,
    fanPointsDivisor: DREAM_XI.fanPointsDivisor,
    matches,
  });
});

teamGamesRouter.get('/team-games/:matchId/pick5', (req, res) => {
  const user = getAuthUser(req);
  const store = db.get();
  const m = store.matches.find(x => x.id === req.params.matchId);
  if (!m) return bad(res, 'Match not found', 404);
  const pool = pickPool(store, m);
  if (!pool.length) return bad(res, 'Pick 5 is only for this team’s matches', 404);
  const pick = user ? myPick(store, user.id, m.id) : null;
  const all = store.teamPicks.filter(p => p.matchId === m.id);
  res.json({
    match: { id: m.id, matchNo: m.matchNo, teamA: m.teamA, teamB: m.teamB, startsAt: m.startsAt, status: m.status, open: matchOpen(m), locked: pickLocked(m), opensAt: matchOpensAt(m) },
    teamId: gamesTeamId(store),
    pool: pool.map(p => ({ id: p.id, name: p.name, role: p.role, imageId: p.imageId, isIcon: p.isIcon, isCaptain: p.isCaptain, credits: creditsFor(p), selectedBy: all.length ? Math.round((all.filter(x => x.playerIds.includes(p.id)).length / all.length) * 100) : null })),
    pick: pick || null,
    pickSize: PICK_SIZE,
  });
});

teamGamesRouter.post('/team-games/:matchId/pick5', requireUser, rateLimit('pick5', 40, 60_000), (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const m = store.matches.find(x => x.id === req.params.matchId);
  if (!m) return bad(res, 'Match not found', 404);
  if (pickLocked(m)) return bad(res, 'This match has started, so picks are locked');
  if (!matchOpen(m)) return bad(res, 'Pick 5 opens at midnight UAE time on the day before the match');
  const pool = pickPool(store, m);
  if (!pool.length) return bad(res, 'Pick 5 is only for this team’s matches', 404);
  const v = validatePick(pool, req.body?.playerIds, req.body?.captainId);
  if (typeof v === 'string') return bad(res, v);
  const now = new Date().toISOString();
  const existing = myPick(store, user.id, m.id);
  if (existing) Object.assign(existing, v, { updatedAt: now });
  else store.teamPicks.push({ userId: user.id, matchId: m.id, teamId: gamesTeamId(store), ...v, createdAt: now });
  db.save();
  res.json({ success: true, pick: myPick(store, user.id, m.id), user: selfUser(user) });
});

teamGamesRouter.delete('/team-games/:matchId/pick5', requireUser, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const m = store.matches.find(x => x.id === req.params.matchId);
  if (!m) return bad(res, 'Match not found', 404);
  if (pickLocked(m)) return bad(res, 'This match has started, so picks are locked');
  store.teamPicks = store.teamPicks.filter(p => !(p.userId === user.id && p.matchId === m.id));
  db.save();
  res.json({ success: true });
});

/** Results of a scored match: every Pick 5, best first. */
teamGamesRouter.get('/team-games/:matchId/results', (req, res) => {
  const store = db.get();
  const user = getAuthUser(req);
  const picks = store.teamPicks.filter(p => p.matchId === req.params.matchId && p.scoredAt).sort((a, b) => (b.points || 0) - (a.points || 0));
  const isAdmin = Boolean(user && hasPermission(user, 'fantasy'));
  res.json({
    results: picks.slice(0, 100).map((p, i) => {
      const u = store.users.find(x => x.id === p.userId);
      return { rank: i + 1, name: u?.name || 'Fan', avatar: u?.avatar || '', mine: p.userId === user?.id, points: p.points, ...(p.userId === user?.id || isAdmin ? { breakdown: p.breakdown } : {}) };
    }),
  });
});

/** Admin: score Pick 5 and settle the team predictions again (e.g. after a scorecard correction). */
teamGamesRouter.post('/admin/team-games/:matchId/score', requireAdmin('fantasy'), wrap(async (req, res) => {
  const store = db.get();
  const m = store.matches.find(x => x.id === req.params.matchId);
  if (!m) return bad(res, 'Match not found', 404);
  if (m.status !== 'completed') return bad(res, 'The match is not completed yet');
  const r = await settleTeamGames(m.id);
  // Re-scoring after a correction: settleTeamGames skips predictions already settled, but Pick 5 rescoring is safe.
  if (!r.picksScored) await db.mutate(s => scoreTeamPicks(s, m.id));
  res.json({ success: true, ...r });
}));

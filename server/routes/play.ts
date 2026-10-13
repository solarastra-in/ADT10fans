import crypto from 'crypto';
import { Router } from 'express';
import { Contest, db } from '../db';
import { getAuthUser, hasPermission, rateLimit, requireAdmin, requireUser, selfUser } from '../auth';
import { bad, isoOrEmpty, newId, num, str, userOf, wrap } from '../http';
import { dispatchNotification } from '../notify';
import { creditsFor, DREAM_XI, fantasySeasonTotals, lineupLocked, lineupPool, scoreMatchFantasy, scoringRules, validateLineup } from '../fantasy';
import { GameError, guessView, playBall, submitGuess, superOverState, todayLeaderboard, dubaiDay, Shot } from '../games';
import { notifyFantasyResults } from '../reminders';

export const playRouter = Router();

// ---------- prediction contests ----------
function contestLocked(c: Contest) {
  return c.status !== 'open' || (c.locksAt ? +new Date(c.locksAt) <= Date.now() : false);
}
export function stripAnswers(c: Contest, isAdmin: boolean): Contest {
  if (isAdmin || c.status === 'settled') return c;
  return { ...c, questions: c.questions.map(({ answer, explain, ...q }) => q) as Contest['questions'] };
}

playRouter.get('/contests', (req, res) => {
  const user = getAuthUser(req);
  const store = db.get();
  const isAdmin = Boolean(user && hasPermission(user, 'contests'));
  const entryCounts: Record<string, number> = {};
  for (const e of store.contestEntries) entryCounts[e.contestId] = (entryCounts[e.contestId] || 0) + 1;
  const contests = store.contests.map(c => {
    const view = stripAnswers(c, isAdmin);
    return c.status === 'open' && c.locksAt && +new Date(c.locksAt) <= Date.now() ? { ...view, status: 'locked' as const } : view;
  });
  res.json({ contests, myEntries: user ? store.contestEntries.filter(e => e.userId === user.id) : [], entryCounts });
});

playRouter.post('/contests/:id/enter', requireUser, rateLimit('contest', 30, 60_000), (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const contest = store.contests.find(c => c.id === req.params.id);
  if (!contest) return bad(res, 'Contest not found', 404);
  if (contestLocked(contest)) return bad(res, 'This contest is closed');
  const raw = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
  const answers: Record<string, string> = {};
  for (const q of contest.questions) {
    const a = str(raw[q.id], 200);
    if (a && q.options.includes(a)) answers[q.id] = a;
  }
  if (Object.keys(answers).length !== contest.questions.length) return bad(res, 'Please answer every question');
  const existingIdx = store.contestEntries.findIndex(e => e.userId === user.id && e.contestId === contest.id);
  let pointsAwarded: number | undefined;
  if (contest.instant) {
    if (existingIdx >= 0) return bad(res, 'You have already played this quiz');
    pointsAwarded = contest.questions.reduce((sum, q) => sum + (q.answer && answers[q.id] === q.answer ? q.points : 0), 0);
    user.points += pointsAwarded;
  }
  const entry = { userId: user.id, contestId: contest.id, answers, pointsAwarded, createdAt: new Date().toISOString() };
  if (existingIdx >= 0) store.contestEntries[existingIdx] = entry;
  else store.contestEntries.push(entry);
  db.save();
  const results = contest.instant ? contest.questions.map(q => ({ id: q.id, correct: answers[q.id] === q.answer, answer: q.answer, explain: q.explain })) : undefined;
  res.json({ success: true, pointsAwarded: pointsAwarded || 0, user: selfUser(user), results });
});

playRouter.post('/admin/contests', requireAdmin('contests'), (req, res) => {
  const b = req.body || {};
  const store = db.get();
  const title = str(b.title, 150);
  if (!title) return bad(res, 'Contest title is required');
  const questions = (Array.isArray(b.questions) ? b.questions : []).map((q: any, i: number) => ({
    id: str(q.id, 60) || `q${i + 1}-${crypto.randomUUID().slice(0, 4)}`,
    prompt: str(q.prompt, 300),
    options: Array.from(new Set((Array.isArray(q.options) ? q.options : []).map((o: any) => str(o, 120)).filter(Boolean))) as string[],
    points: Math.max(1, Math.min(500, Math.round(num(q.points, 10)))),
    answer: str(q.answer, 120) || undefined,
    explain: str(q.explain, 300) || undefined,
  }));
  if (!questions.length) return bad(res, 'Add at least one question');
  for (const q of questions) {
    if (!q.prompt) return bad(res, 'Every question needs a prompt');
    if (q.options.length < 2) return bad(res, `"${q.prompt}" needs at least two options`);
    if (q.answer && !q.options.includes(q.answer)) return bad(res, `The answer for "${q.prompt}" must be one of its options`);
  }
  const instant = Boolean(b.instant);
  if (instant && questions.some((q: any) => !q.answer)) return bad(res, 'Instant quizzes need a correct answer for every question');
  const matchId = str(b.matchId, 60) || undefined;
  if (matchId && !store.matches.some(m => m.id === matchId)) return bad(res, 'Unknown match');
  const idx = b.id ? store.contests.findIndex(c => c.id === b.id) : -1;
  if (idx >= 0 && store.contests[idx].status === 'settled') return bad(res, 'Settled contests cannot be edited');
  const contest: Contest = {
    ...(idx >= 0 ? store.contests[idx] : {}),
    id: idx >= 0 ? store.contests[idx].id : newId('c'),
    type: ['predictor', 'sixes', 'captain', 'season', 'trivia'].includes(b.type) ? b.type : 'predictor',
    title,
    description: str(b.description, 600),
    matchId,
    locksAt: isoOrEmpty(b.locksAt) || (matchId ? store.matches.find(m => m.id === matchId)?.startsAt : undefined),
    status: ['open', 'locked'].includes(b.status) ? b.status : idx >= 0 ? store.contests[idx].status : 'open',
    prize: str(b.prize, 200),
    instant,
    questions,
    createdAt: idx >= 0 ? store.contests[idx].createdAt : new Date().toISOString(),
  };
  if (idx >= 0) store.contests[idx] = contest;
  else store.contests.push(contest);
  db.save();
  res.json({ success: true, contest, contests: store.contests });
});

playRouter.delete('/admin/contests/:id', requireAdmin('contests'), (req, res) => {
  const store = db.get();
  const c = store.contests.find(x => x.id === req.params.id);
  if (!c) return bad(res, 'Contest not found', 404);
  if (c.status === 'settled' && store.contestEntries.some(e => e.contestId === c.id && (e.pointsAwarded || 0) > 0)) {
    return bad(res, 'This contest has been settled and fans received points. It cannot be deleted.', 409);
  }
  store.contests = store.contests.filter(x => x.id !== c.id);
  store.contestEntries = store.contestEntries.filter(e => e.contestId !== c.id);
  db.save();
  res.json({ success: true, contests: store.contests });
});

playRouter.post('/admin/contests/:id/toggle-status', requireAdmin('contests'), (req, res) => {
  const c = db.get().contests.find(x => x.id === req.params.id);
  if (!c) return bad(res, 'Contest not found', 404);
  if (c.status === 'settled') return bad(res, 'Settled contests cannot be reopened');
  c.status = req.body?.status === 'open' || req.body?.status === 'locked' ? req.body.status : c.status === 'open' ? 'locked' : 'open';
  if (c.status === 'open' && c.locksAt && +new Date(c.locksAt) <= Date.now()) c.locksAt = undefined;
  db.save();
  res.json({ success: true, contest: c });
});

playRouter.post('/admin/contests/:id/settle', requireAdmin('contests'), wrap(async (req, res) => {
  const store = db.get();
  const contest = store.contests.find(c => c.id === req.params.id);
  if (!contest) return bad(res, 'Contest not found', 404);
  if (contest.status === 'settled') return bad(res, 'Already settled');
  const answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
  for (const q of contest.questions) {
    const a = str(answers[q.id], 120);
    if (a) {
      if (!q.options.includes(a)) return bad(res, `Answer for "${q.prompt}" must be one of its options`);
      q.answer = a;
    }
  }
  if (contest.questions.some(q => !q.answer)) return bad(res, 'Pick the correct answer for every question');
  contest.status = 'settled';
  let winners = 0;
  let total = 0;
  const perUser: Record<string, { body: string }> = {};
  const entrants = store.contestEntries.filter(x => x.contestId === contest.id);
  for (const e of entrants) {
    if (contest.instant) continue;
    const pts = contest.questions.reduce((s, q) => s + (e.answers[q.id] === q.answer ? q.points : 0), 0);
    e.pointsAwarded = pts;
    const u = store.users.find(x => x.id === e.userId);
    if (u && pts > 0) {
      u.points += pts;
      winners++;
      total += pts;
    }
    perUser[e.userId] = { body: pts > 0 ? `You scored ${pts} point${pts === 1 ? '' : 's'}.` : 'No points this time. Try the next one!' };
  }
  db.save();
  if (entrants.length && !contest.instant) {
    await dispatchNotification({
      title: `🎯 Results: ${contest.title}`,
      body: 'Answers are in.',
      category: 'announcement',
      targetAudience: 'users',
      userIds: entrants.map(e => e.userId),
      perUser,
      data: { contestId: contest.id, url: '/contests' },
      createdBy: 'Predictions',
    });
  }
  res.json({ success: true, contest, settledEntriesCount: winners, totalPointsDistributed: total });
}));

playRouter.post('/admin/notifications/trigger-contest-deadline', requireAdmin('notifications'), wrap(async (req, res) => {
  const store = db.get();
  const contest = store.contests.find(c => c.id === req.body?.contestId);
  if (!contest) return bad(res, 'Choose a contest', 404);
  const mins = Math.max(1, Math.round(num(req.body?.customMinutes, 0)) || (contest.locksAt ? Math.round((+new Date(contest.locksAt) - Date.now()) / 60000) : 15));
  const notif = await dispatchNotification({
    title: `⏳ "${contest.title}" closes in ${mins} min`,
    body: contest.prize ? `Get your picks in for a chance at: ${contest.prize}` : 'Get your picks in before it locks.',
    category: 'contest_deadline',
    targetAudience: 'logged_in',
    data: { contestId: contest.id, url: '/contests', locksAt: contest.locksAt },
    priority: 'high',
    createdBy: 'Predictions',
  });
  res.json({ success: true, notification: notif });
}));

// ---------- Dream XI ----------
playRouter.get('/fantasy/rules', (_req, res) => res.json({ rules: DREAM_XI, scoring: scoringRules() }));

playRouter.get('/fantasy', (req, res) => {
  const user = getAuthUser(req);
  const store = db.get();
  const matches = [...store.matches].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const mine = user ? store.fantasyTeams.filter(f => f.userId === user.id) : [];
  res.json({
    rules: DREAM_XI,
    matches: matches.map(m => ({
      matchId: m.id,
      matchNo: m.matchNo,
      teamA: m.teamA,
      teamB: m.teamB,
      startsAt: m.startsAt,
      status: m.status,
      locked: lineupLocked(m),
      lineups: store.fantasyTeams.filter(f => f.matchId === m.id).length,
      mine: (() => {
        const f = mine.find(x => x.matchId === m.id);
        return f ? { points: f.points ?? null, rank: f.rank ?? null, saved: true } : null;
      })(),
    })),
    season: user ? fantasySeasonTotals(store, new Set([user.id]))[0] || null : null,
  });
});

playRouter.get('/fantasy/leaderboard', (req, res) => {
  const store = db.get();
  const matchId = str(req.query.matchId, 60);
  const users = new Map(store.users.map(u => [u.id, u]));
  if (matchId) {
    const rows = store.fantasyTeams
      .filter(f => f.matchId === matchId && f.scoredAt)
      .sort((a, b) => (a.rank || 0) - (b.rank || 0))
      .slice(0, 100)
      .map(f => ({ userId: f.userId, name: users.get(f.userId)?.name || 'Fan', avatar: users.get(f.userId)?.avatar || '', teamId: users.get(f.userId)?.teamId || null, points: f.points || 0, rank: f.rank || 0 }));
    return res.json({ rows });
  }
  const rows = fantasySeasonTotals(store).slice(0, 100).map((r, i) => ({ ...r, rank: i + 1, name: users.get(r.userId)?.name || 'Fan', avatar: users.get(r.userId)?.avatar || '', teamId: users.get(r.userId)?.teamId || null }));
  res.json({ rows });
});

playRouter.get('/fantasy/:matchId', (req, res) => {
  const user = getAuthUser(req);
  const store = db.get();
  const match = store.matches.find(m => m.id === req.params.matchId);
  if (!match) return bad(res, 'Match not found', 404);
  const pool = lineupPool(store, match).map(p => {
    const lineups = store.fantasyTeams.filter(f => f.matchId === match.id);
    return { ...p, credits: creditsFor(p), selectedBy: lineups.length ? Math.round((lineups.filter(f => f.playerIds.includes(p.id)).length / lineups.length) * 100) : 0 };
  });
  const mine = user ? store.fantasyTeams.find(f => f.userId === user.id && f.matchId === match.id) || null : null;
  res.json({ match, locked: lineupLocked(match), rules: DREAM_XI, pool, fantasyTeam: mine, lineups: store.fantasyTeams.filter(f => f.matchId === match.id).length });
});

playRouter.post('/fantasy/:matchId', requireUser, rateLimit('fantasy', 40, 60_000), (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const match = store.matches.find(m => m.id === req.params.matchId);
  if (!match) return bad(res, 'Match not found', 404);
  if (lineupLocked(match)) return bad(res, 'Lineups are locked for this match');
  const ids: string[] = Array.isArray(req.body?.playerIds) ? req.body.playerIds.map((x: any) => String(x)) : [];
  const captainId = str(req.body?.captainId, 80);
  const viceCaptainId = str(req.body?.viceCaptainId, 80);
  const v = validateLineup(lineupPool(store, match), ids, captainId, viceCaptainId);
  if (!v.ok) return bad(res, v.error!);
  const idx = store.fantasyTeams.findIndex(f => f.userId === user.id && f.matchId === match.id);
  const now = new Date().toISOString();
  const team = { userId: user.id, matchId: match.id, playerIds: Array.from(new Set(ids)), captainId, viceCaptainId, createdAt: idx >= 0 ? store.fantasyTeams[idx].createdAt : now, updatedAt: now };
  if (idx >= 0) store.fantasyTeams[idx] = team;
  else store.fantasyTeams.push(team);
  db.save();
  res.json({ success: true, fantasyTeam: team, credits: v.credits, user: selfUser(user) });
});

playRouter.delete('/fantasy/:matchId', requireUser, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const match = store.matches.find(m => m.id === req.params.matchId);
  if (!match) return bad(res, 'Match not found', 404);
  if (lineupLocked(match)) return bad(res, 'Lineups are locked for this match');
  store.fantasyTeams = store.fantasyTeams.filter(f => !(f.userId === user.id && f.matchId === match.id));
  db.save();
  res.json({ success: true });
});

/** Admin: re-score Dream XI for a match after correcting its scorecard. */
playRouter.post('/admin/fantasy/:matchId/score', requireAdmin('fantasy'), wrap(async (req, res) => {
  const store = db.get();
  const m = store.matches.find(x => x.id === req.params.matchId);
  if (!m) return bad(res, 'Match not found', 404);
  if (m.status !== 'completed') return bad(res, 'Mark the match as completed first');
  const r = scoreMatchFantasy(store, m.id);
  db.save();
  await notifyFantasyResults(m.id);
  res.json({ success: true, ...r });
}));

// Private leagues
playRouter.get('/fantasy-leagues', requireUser, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const users = new Map(store.users.map(u => [u.id, u]));
  const leagues = store.fantasyLeagues
    .filter(l => l.memberIds.includes(user.id))
    .map(l => ({
      id: l.id,
      name: l.name,
      code: l.code,
      isOwner: l.ownerId === user.id,
      members: fantasySeasonTotals(store, new Set(l.memberIds))
        .concat(l.memberIds.filter(id => !store.fantasyTeams.some(f => f.userId === id && f.scoredAt)).map(id => ({ userId: id, points: 0, matches: 0, best: 0 })))
        .map((r, i) => ({ ...r, rank: i + 1, name: users.get(r.userId)?.name || 'Fan', avatar: users.get(r.userId)?.avatar || '', teamId: users.get(r.userId)?.teamId || null })),
    }));
  res.json({ leagues });
});

const LEAGUE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
playRouter.post('/fantasy-leagues', requireUser, rateLimit('league', 10, 60 * 60_000), (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const name = str(req.body?.name, 40);
  if (name.length < 3) return bad(res, 'League name must be at least 3 characters');
  if (store.fantasyLeagues.filter(l => l.ownerId === user.id).length >= 10) return bad(res, 'You can run up to 10 leagues');
  let code = '';
  do code = Array.from(crypto.randomBytes(6), b => LEAGUE_ALPHABET[b % LEAGUE_ALPHABET.length]).join('');
  while (store.fantasyLeagues.some(l => l.code === code));
  const league = { id: newId('league'), name, code, ownerId: user.id, memberIds: [user.id], createdAt: new Date().toISOString() };
  store.fantasyLeagues.push(league);
  db.save();
  res.json({ success: true, league });
});

playRouter.post('/fantasy-leagues/join', requireUser, rateLimit('league-join', 20, 60 * 60_000), (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const code = str(req.body?.code, 12).toUpperCase();
  const league = store.fantasyLeagues.find(l => l.code === code);
  if (!league) return bad(res, 'No league has that code', 404);
  if (league.memberIds.includes(user.id)) return res.json({ success: true, league, already: true });
  if (league.memberIds.length >= 200) return bad(res, 'This league is full');
  league.memberIds.push(user.id);
  db.save();
  res.json({ success: true, league });
});

playRouter.post('/fantasy-leagues/:id/leave', requireUser, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const league = store.fantasyLeagues.find(l => l.id === req.params.id);
  if (!league || !league.memberIds.includes(user.id)) return bad(res, 'League not found', 404);
  league.memberIds = league.memberIds.filter(id => id !== user.id);
  if (!league.memberIds.length) store.fantasyLeagues = store.fantasyLeagues.filter(l => l.id !== league.id);
  else if (league.ownerId === user.id) league.ownerId = league.memberIds[0];
  db.save();
  res.json({ success: true });
});

// ---------- daily games ----------
playRouter.get('/games/today', (req, res) => {
  const user = getAuthUser(req);
  const store = db.get();
  const day = dubaiDay();
  res.json({
    day,
    guess: guessView(store, user, day),
    superOver: superOverState(store, user, day),
    leaderboards: { guess: todayLeaderboard(store, 'guess', day), superover: todayLeaderboard(store, 'superover', day) },
    players: store.teams.flatMap(t => t.squad.map(p => ({ id: p.id, name: p.name, teamId: t.id }))).sort((a, b) => a.name.localeCompare(b.name)),
  });
});

playRouter.post('/games/guess', requireUser, rateLimit('game', 60, 60_000), (req, res) => {
  try {
    const user = userOf(req);
    const view = submitGuess(db.get(), user, str(req.body?.playerId, 80));
    db.save();
    res.json({ success: true, guess: view, user: selfUser(user) });
  } catch (e: any) {
    if (e instanceof GameError) return bad(res, e.message);
    throw e;
  }
});

playRouter.post('/games/superover', requireUser, rateLimit('game', 60, 60_000), (req, res) => {
  try {
    const user = userOf(req);
    const view = playBall(db.get(), user, str(req.body?.shot, 20) as Shot);
    db.save();
    res.json({ success: true, superOver: view, user: selfUser(user) });
  } catch (e: any) {
    if (e instanceof GameError) return bad(res, e.message);
    throw e;
  }
});

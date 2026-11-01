import { ensureMatchPredictions, settleMatchPredictions } from '../predictions';
import { recordProgress, sanitizeOvers } from '../matchProgress';
import { ensureTeamGames, settleTeamGames } from '../teamGames';
import { Router } from 'express';
import { db, Match, NotificationItem } from '../db';
import { rateLimit, requireAdmin, teamScopeOf } from '../auth';
import { bad, isHttpsUrl, isoOrEmpty, newId, num, str, userOf, wrap } from '../http';
import { dispatchNotification } from '../notify';
import { afterMatchCompleted } from '../reminders';
import { computePlayerPoints } from '../fantasy';
import { findCandidateMatches, liveScoresConfigured, syncLiveMatch } from '../liveScores';
import { seedOfficialMatches } from '../seedOfficial';
import { geminiConfigured, parseScheduleWithGemini } from '../gemini';

export const matchesRouter = Router();

const sortByStart = (a: Match, b: Match) => +new Date(a.startsAt) - +new Date(b.startsAt);

matchesRouter.get('/matches', (req, res) => {
  let list = [...db.get().matches].sort(sortByStart);
  if (req.query.teamId) list = list.filter(m => m.teamA === req.query.teamId || m.teamB === req.query.teamId);
  if (req.query.status) list = list.filter(m => m.status === req.query.status);
  res.json({ matches: list });
});

matchesRouter.get('/matches/live', (req, res) => {
  const store = db.get();
  const list = [...store.matches].sort(sortByStart);
  const liveMatch = list.find(m => m.status === 'live') || null;
  const upcoming = list.filter(m => m.status === 'upcoming');
  const completed = list.filter(m => m.status === 'completed');
  const nextMatch = upcoming[0] || null;
  const recentMatch = completed[completed.length - 1] || null;

  res.json({
    hasLive: Boolean(liveMatch),
    match: liveMatch,
    nextMatch,
    recentMatch,
    teams: store.teams,
    serverTime: new Date().toISOString(),
  });
});

matchesRouter.get('/matches/:id', (req, res) => {
  const store = db.get();
  const m = store.matches.find(x => x.id === req.params.id);
  if (!m) return bad(res, 'Match not found', 404);
  const lineups = store.fantasyTeams.filter(f => f.matchId === m.id);
  const pool = store.teams.filter(t => t.id === m.teamA || t.id === m.teamB).flatMap(t => t.squad);
  let fantasyPoints: { playerId: string; name: string; teamId: string; points: number; detail: string }[] = [];
  if (m.status === 'completed' || m.status === 'live') {
    fantasyPoints = [...computePlayerPoints(store, m).values()]
      .map(r => ({ playerId: r.playerId, name: r.name, teamId: r.teamId, points: r.points, detail: r.detail.join(', ') }))
      .sort((a, b) => b.points - a.points);
  }
  const pickCounts = new Map<string, number>();
  const captainCounts = new Map<string, number>();
  for (const f of lineups) {
    for (const id of f.playerIds) pickCounts.set(id, (pickCounts.get(id) || 0) + 1);
    captainCounts.set(f.captainId, (captainCounts.get(f.captainId) || 0) + 1);
  }
  const mostPicked = [...pickCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, n]) => ({ playerId: id, name: pool.find(p => p.id === id)?.name || id, pct: Math.round((n / lineups.length) * 100), captainPct: Math.round(((captainCounts.get(id) || 0) / lineups.length) * 100) }));
  res.json({
    match: m,
    fantasy: { lineups: lineups.length, mostPicked, playerPoints: fantasyPoints },
    contests: store.contests.filter(c => c.matchId === m.id).map(c => ({ id: c.id, title: c.title, status: c.status })),
    polls: store.polls.filter(p => p.matchId === m.id).map(p => p.id),
    threads: store.forumThreads.filter(t => t.matchId === m.id && !t.hidden).map(t => ({ id: t.id, title: t.title, commentsCount: t.commentsCount })),
  });
});

export function resultNotificationFor(match: Match) {
  const store = db.get();
  const a = store.teams.find(t => t.id === match.teamA);
  const b = store.teams.find(t => t.id === match.teamB);
  const w = store.teams.find(t => t.id === match.winner);
  return {
    title: `🏆 Result: ${a?.name || match.teamA} vs ${b?.name || match.teamB}`,
    body: [match.result || (w ? `${w.name} won` : 'Match completed'), [match.scoreA && `${a?.short} ${match.scoreA}`, match.scoreB && `${b?.short} ${match.scoreB}`].filter(Boolean).join(' · ')].filter(Boolean).join('. '),
    category: 'match_result' as const,
    targetAudience: 'all' as const,
    teamId: null,
    data: { matchId: match.id, url: `/matches/${match.id}` },
    priority: 'high' as const,
    createdBy: 'Match Centre',
  };
}

/** What happens when a match is first saved as completed: result push, Pick XI scoring, personal results. */
export async function onMatchCompleted(matchId: string, notify = true) {
  // Claim the result notification in a short write, so it goes out once even with several servers.
  const claim = await db.mutate(store => {
    const m = store.matches.find(x => x.id === matchId);
    if (!m) return null;
    const key = `match-result:${m.id}`;
    const send = notify && !store.jobLog[key];
    if (send) store.jobLog[key] = new Date().toISOString();
    return { input: send ? resultNotificationFor(m) : null };
  });
  if (!claim) return { notification: undefined, fantasy: null, predictions: null, teamGames: null };
  let notification: NotificationItem | undefined;
  if (claim.input) notification = await dispatchNotification(claim.input);
  const fantasy = await afterMatchCompleted(matchId);
  const predictions = await settleMatchPredictions(matchId).catch(e => ({ settled: false, error: String(e?.message || e) }));
  const teamGames = await settleTeamGames(matchId).catch(e => ({ settled: false, error: String(e?.message || e) }));
  return { notification, fantasy, predictions, teamGames };
}

matchesRouter.post('/matches', requireAdmin('matches'), wrap(async (req, res) => {
  const b = req.body || {};
  const store = db.get();
  const idx = b.id ? store.matches.findIndex(m => m.id === b.id) : -1;
  const prev = idx >= 0 ? store.matches[idx] : undefined;
  const teamA = str(b.teamA ?? prev?.teamA, 60);
  const teamB = str(b.teamB ?? prev?.teamB, 60);
  if (!store.teams.some(t => t.id === teamA) || !store.teams.some(t => t.id === teamB)) return bad(res, 'Choose two existing teams');
  if (teamA === teamB) return bad(res, 'A team cannot play itself');
  const startsAt = isoOrEmpty(b.startsAt ?? prev?.startsAt);
  if (!startsAt) return bad(res, 'Start date and time are required');
  const status: Match['status'] = ['upcoming', 'live', 'completed', 'abandoned'].includes(b.status) ? b.status : prev?.status || 'upcoming';
  const winner = b.winner !== undefined ? str(b.winner, 60) : prev?.winner || '';
  if (winner && winner !== teamA && winner !== teamB) return bad(res, 'Winner must be one of the two teams');
  const streamUrl = b.streamUrl !== undefined ? str(b.streamUrl, 500) : prev?.streamUrl || '';
  if (streamUrl && !isHttpsUrl(streamUrl)) return bad(res, 'Stream link must start with https://');
  const opt = (k: keyof Match, max = 200) => (b[k] !== undefined ? str(b[k], max) || undefined : (prev?.[k] as any));
  const sc = b.scorecard !== undefined ? sanitizeScorecard(b.scorecard, teamA, teamB) : undefined;
  // Keep the over-by-over tally when a save does not send it.
  const scorecard = b.scorecard !== undefined ? (sc ? { ...sc, overs: b.scorecard?.overs !== undefined ? sc.overs : prev?.scorecard?.overs } : undefined) : prev?.scorecard;
  const match: Match = {
    ...(prev || {}),
    id: prev?.id || newId('m'),
    matchNo: Math.max(1, Math.round(num(b.matchNo, prev?.matchNo || store.matches.length + 1))),
    stage: str(b.stage ?? prev?.stage, 60) || 'Group stage',
    teamA,
    teamB,
    startsAt,
    venue: str(b.venue ?? prev?.venue, 120) || store.settings.venue || '',
    status,
    scoreA: opt('scoreA', 20),
    scoreB: opt('scoreB', 20),
    oversA: opt('oversA', 10),
    oversB: opt('oversB', 10),
    currentOver: opt('currentOver', 120),
    lastCommentary: opt('lastCommentary', 300),
    topScorer: opt('topScorer', 120),
    topWicketTaker: opt('topWicketTaker', 120),
    toss: opt('toss', 200),
    playerOfTheMatch: opt('playerOfTheMatch', 120),
    scorecard,
    result: opt('result', 200),
    winner: winner || undefined,
    totalSixes: b.totalSixes !== undefined && b.totalSixes !== '' ? Math.max(0, Math.round(num(b.totalSixes))) : prev?.totalSixes,
    streamUrl: streamUrl || undefined,
    externalId: b.externalId !== undefined ? str(b.externalId, 80) || undefined : prev?.externalId,
    firstInnings: b.firstInnings === 1 || b.firstInnings === 2 ? b.firstInnings : prev?.firstInnings,
    scoreSource: b.scoreA !== undefined || b.scoreB !== undefined || b.scorecard !== undefined ? 'manual' : prev?.scoreSource,
    updatedAt: new Date().toISOString(),
  };
  if (match.status === 'live' || match.status === 'completed') recordProgress(match);
  if (idx >= 0) store.matches[idx] = match;
  else store.matches.push(match);
  ensureMatchPredictions(store);
  ensureTeamGames(store);
  db.save();
  let notification: NotificationItem | undefined;
  let fantasy: any = null;
  let predictions: any = null;
  let teamGames: any = null;
  if (match.status === 'completed') {
    const r = await onMatchCompleted(match.id, prev?.status !== 'completed' && b.notify !== false);
    notification = r.notification;
    fantasy = r.fantasy;
    predictions = r.predictions;
    teamGames = r.teamGames;
  }
  res.json({ success: true, matches: store.matches.sort(sortByStart), targetMatch: match, notification, fantasy, predictions, teamGames });
}));

function sanitizeScorecard(raw: any, teamA: string, teamB: string) {
  if (!raw || typeof raw !== 'object') return undefined;
  const inn = (x: any) => {
    if (!x || typeof x !== 'object') return undefined;
    const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    return {
      teamId: [teamA, teamB].includes(x.teamId) ? x.teamId : '',
      teamName: str(x.teamName, 80) || undefined,
      totalRuns: n(x.totalRuns),
      wickets: n(x.wickets),
      overs: str(x.overs, 10),
      extras: x.extras && typeof x.extras === 'object' ? { total: n(x.extras.total), wides: n(x.extras.wides), noBalls: n(x.extras.noBalls), byes: n(x.extras.byes), legByes: n(x.extras.legByes) } : undefined,
      batting: (Array.isArray(x.batting) ? x.batting : []).slice(0, 15).map((b: any) => ({ batsman: str(b.batsman, 60), dismissal: str(b.dismissal, 120), runs: n(b.runs), balls: n(b.balls), fours: n(b.fours), sixes: n(b.sixes), strikeRate: n(b.strikeRate) || (n(b.balls) ? Math.round((n(b.runs) / n(b.balls)) * 1000) / 10 : 0), isNotOut: Boolean(b.isNotOut) || /not out/i.test(String(b.dismissal || '')) })).filter((b: any) => b.batsman),
      bowling: (Array.isArray(x.bowling) ? x.bowling : []).slice(0, 12).map((b: any) => ({ bowler: str(b.bowler, 60), overs: str(b.overs, 6), maidens: n(b.maidens), runs: n(b.runs), wickets: n(b.wickets), economy: n(b.economy), dots: b.dots !== undefined ? n(b.dots) : undefined })).filter((b: any) => b.bowler),
      didNotBat: (Array.isArray(x.didNotBat) ? x.didNotBat : []).map((s: any) => str(s, 60)).filter(Boolean),
      fallOfWickets: Array.isArray(x.fallOfWickets) ? x.fallOfWickets.slice(0, 10).map((f: any) => ({ wicket: n(f.wicket), score: n(f.score), over: str(f.over, 8), player: str(f.player, 60) })) : undefined,
    };
  };
  return { innings1: inn(raw.innings1), innings2: inn(raw.innings2), overs: sanitizeOvers(raw.overs) };
}

/**
 * Enter or upload a match's scorecard by hand, for when live scores are not available. League and
 * super admins can do it for any match; a team admin only for their own team's matches. Saving with
 * complete: true finishes the match, which scores Pick XI, Pick 5 and the predictions.
 */
matchesRouter.post('/admin/matches/:id/scorecard', requireAdmin(['matches', 'team']), wrap(async (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const m = store.matches.find(x => x.id === req.params.id);
  if (!m) return bad(res, 'Match not found', 404);
  const scope = teamScopeOf(user);
  if (scope !== null && m.teamA !== scope && m.teamB !== scope) return bad(res, 'You can only enter scorecards for your own team’s matches', 403);
  const b = req.body || {};
  const card0 = sanitizeScorecard(b.scorecard, m.teamA, m.teamB);
  const card = card0 && { ...card0, overs: b.scorecard?.overs !== undefined ? card0.overs : m.scorecard?.overs };
  if (!card?.innings1?.batting.length && !card?.innings2?.batting.length && !card?.overs?.length) return bad(res, 'Add at least one batter, or the over-by-over runs');
  const winner = b.winner !== undefined ? str(b.winner, 60) : m.winner || '';
  if (winner && winner !== m.teamA && winner !== m.teamB) return bad(res, 'Winner must be one of the two teams');
  const wasCompleted = m.status === 'completed';
  const scoreOf = (teamId: string) => {
    const inn = [card.innings1, card.innings2].find(i => i?.teamId === teamId);
    return inn ? { score: `${inn.totalRuns}/${inn.wickets}`, overs: inn.overs } : null;
  };
  const a = scoreOf(m.teamA);
  const bb = scoreOf(m.teamB);
  Object.assign(m, {
    scorecard: card,
    scoreSource: 'manual',
    scoreA: a?.score ?? m.scoreA,
    oversA: a?.overs ?? m.oversA,
    scoreB: bb?.score ?? m.scoreB,
    oversB: bb?.overs ?? m.oversB,
    winner: winner || undefined,
    result: b.result !== undefined ? str(b.result, 200) || undefined : m.result,
    status: b.complete ? 'completed' : m.status === 'upcoming' && +new Date(m.startsAt) <= Date.now() ? 'live' : m.status,
    updatedAt: new Date().toISOString(),
  });
  if (card.innings1?.teamId) m.firstInnings = card.innings1.teamId === m.teamA ? 1 : 2;
  recordProgress(m);
  db.save();
  let completed: any = null;
  if (m.status === 'completed') completed = await onMatchCompleted(m.id, !wasCompleted);
  res.json({ success: true, match: m, ...(completed ? { fantasy: completed.fantasy, predictions: completed.predictions, teamGames: completed.teamGames } : {}) });
}));

matchesRouter.delete('/matches/:id', requireAdmin('matches'), (req, res) => {
  const store = db.get();
  store.matches = store.matches.filter(m => m.id !== req.params.id);
  store.fantasyTeams = store.fantasyTeams.filter(f => f.matchId !== req.params.id);
  for (const c of store.contests) if (c.matchId === req.params.id) c.matchId = null;
  db.save();
  res.json({ success: true, matches: store.matches });
});

/**
 * The live centre asks for fresh scores while a match is on. At most one fetch from CricketData per
 * match every 30 seconds, whoever is watching; otherwise it answers with what is stored.
 */
const LIVE_REFRESH_MS = 30_000;
const liveInFlight = new Set<string>();
matchesRouter.post('/live/:id/refresh', rateLimit('live-refresh', 12, 60_000), wrap(async (req, res) => {
  const m = db.get().matches.find(x => x.id === req.params.id);
  if (!m) return bad(res, 'Match not found', 404);
  const near = m.status === 'live' || (m.status === 'upcoming' && Math.abs(+new Date(m.startsAt) - Date.now()) < 30 * 60_000);
  const fresh = m.liveSyncedAt && Date.now() - +new Date(m.liveSyncedAt) < LIVE_REFRESH_MS;
  if (!liveScoresConfigured() || !m.externalId || !near || fresh || liveInFlight.has(m.id)) {
    return res.json({ success: true, synced: false, liveSyncedAt: m.liveSyncedAt || null });
  }
  liveInFlight.add(m.id);
  try {
    const r = await syncLiveMatch(m.id);
    if (r.justCompleted) await onMatchCompleted(m.id);
    res.json({ success: true, synced: true, liveSyncedAt: db.get().matches.find(x => x.id === m.id)?.liveSyncedAt || null });
  } catch (e: any) {
    console.warn('[LIVE] refresh failed:', e?.message || e);
    res.json({ success: true, synced: false, liveSyncedAt: m.liveSyncedAt || null });
  } finally {
    liveInFlight.delete(m.id);
  }
}));

matchesRouter.post('/admin/matches/:id/live-sync', requireAdmin('matches'), wrap(async (req, res) => {
  if (!liveScoresConfigured()) return bad(res, 'Live scores are off. Set CRICKET_API_KEY (CricketData.org) to turn them on.', 400);
  try {
    const r = await syncLiveMatch(req.params.id);
    let fantasy = null;
    if (r.justCompleted) fantasy = (await onMatchCompleted(req.params.id)).fantasy;
    res.json({ success: true, ...r, fantasy, match: db.get().matches.find(m => m.id === req.params.id) });
  } catch (e: any) {
    bad(res, e?.message || 'Live score sync failed', 502);
  }
}));

matchesRouter.get('/admin/cricketdata/matches', requireAdmin('matches'), wrap(async (_req, res) => {
  if (!liveScoresConfigured()) return bad(res, 'Set CRICKET_API_KEY (CricketData.org) first.', 400);
  try {
    res.json({ matches: await findCandidateMatches() });
  } catch (e: any) {
    bad(res, `CricketData: ${e?.message || e}`, 502);
  }
}));

matchesRouter.post('/admin/notifications/trigger-match-result', requireAdmin('notifications'), wrap(async (req, res) => {
  const match = db.get().matches.find(m => m.id === req.body?.matchId);
  if (!match) return bad(res, 'Choose a match', 404);
  if (match.status !== 'completed') return bad(res, 'Mark the match as completed first');
  res.json({ success: true, notification: await dispatchNotification(resultNotificationFor(match)) });
}));

matchesRouter.post('/admin/matches/seed-official', requireAdmin('matches'), wrap(async (req, res) => {
  const store = db.get();
  const overwrite = Boolean(req.body?.overwrite);
  const now = new Date().toISOString();
  seedOfficialMatches(store, now, overwrite);
  db.save();
  res.json({ success: true, count: store.matches.length, matches: [...store.matches].sort(sortByStart) });
}));

matchesRouter.post('/admin/matches/import-schedule', requireAdmin('matches'), wrap(async (req, res) => {
  const b = req.body || {};
  const fileData = typeof b.fileData === 'string' ? b.fileData : undefined;
  const mimeType = typeof b.mimeType === 'string' ? b.mimeType : 'application/pdf';
  const text = typeof b.text === 'string' ? b.text : undefined;
  const overwrite = Boolean(b.overwrite);

  if (!fileData && !text) {
    return bad(res, 'Please provide a PDF file or schedule text to import.', 400);
  }

  if (!geminiConfigured()) {
    return bad(res, 'AI schedule parsing requires GEMINI_API_KEY. Configure it or enter fixtures manually.', 400);
  }

  const store = db.get();
  const teamSummaries = store.teams.map(t => ({ id: t.id, name: t.name, short: t.short }));

  let parsedMatches: any[];
  try {
    parsedMatches = await parseScheduleWithGemini({ fileData, mimeType, text }, teamSummaries);
  } catch (err: any) {
    return bad(res, `Failed to parse schedule: ${err?.message || err}`, 500);
  }

  if (!parsedMatches || parsedMatches.length === 0) {
    return bad(res, 'No fixtures found in the provided document.', 400);
  }

  const now = new Date().toISOString();
  const validTeamIds = new Set(store.teams.map(t => t.id));
  const imported: Match[] = [];

  for (let i = 0; i < parsedMatches.length; i++) {
    const raw = parsedMatches[i];
    let teamA = String(raw.teamA || '').toLowerCase().trim();
    let teamB = String(raw.teamB || '').toLowerCase().trim();

    if (!validTeamIds.has(teamA)) {
      const matchA = store.teams.find(t => t.id === teamA || t.name.toLowerCase() === teamA || t.short.toLowerCase() === teamA);
      if (matchA) teamA = matchA.id;
    }
    if (!validTeamIds.has(teamB)) {
      const matchB = store.teams.find(t => t.id === teamB || t.name.toLowerCase() === teamB || t.short.toLowerCase() === teamB);
      if (matchB) teamB = matchB.id;
    }

    if (!validTeamIds.has(teamA) || !validTeamIds.has(teamB) || teamA === teamB) {
      continue;
    }

    const matchNo = Math.max(1, Math.round(Number(raw.matchNo) || (i + 1)));
    let startsAt = isoOrEmpty(raw.startsAt);
    if (!startsAt) {
      startsAt = new Date().toISOString();
    }

    imported.push({
      id: newId('m'),
      matchNo,
      stage: str(raw.stage, 60) || 'Group stage',
      teamA,
      teamB,
      startsAt,
      venue: str(raw.venue, 120) || store.settings.venue || 'Zayed Cricket Stadium, Abu Dhabi',
      status: 'upcoming',
      updatedAt: now,
    });
  }

  if (imported.length === 0) {
    return bad(res, 'Could not map teams in the schedule to the 6 league franchises.', 400);
  }

  if (overwrite) {
    store.matches = imported.sort((a, b) => a.matchNo - b.matchNo);
  } else {
    const existingNos = new Set(store.matches.map(m => m.matchNo));
    for (const m of imported) {
      if (existingNos.has(m.matchNo)) {
        const idx = store.matches.findIndex(x => x.matchNo === m.matchNo);
        store.matches[idx] = { ...store.matches[idx], ...m, id: store.matches[idx].id };
      } else {
        store.matches.push(m);
      }
    }
    store.matches.sort((a, b) => a.matchNo - b.matchNo);
  }

  db.save();
  res.json({
    success: true,
    count: imported.length,
    total: store.matches.length,
    matches: store.matches.sort(sortByStart),
  });
}));

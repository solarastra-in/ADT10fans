import { AppStore, db, Match } from './db';
import { dispatchNotification } from './notify';
import { DREAM_XI, scoreMatchFantasy } from './fantasy';

const teamLabel = (store: AppStore, m: Match) => {
  const a = store.teams.find(t => t.id === m.teamA);
  const b = store.teams.find(t => t.id === m.teamB);
  return `${a?.name || m.teamA} vs ${b?.name || m.teamB}`;
};

/** "Pick XI locks soon" for one match. Sent once per match. */
export async function sendLockReminder(matchId: string, minutes: number) {
  // Claim the reminder first (a short write), so two servers never both send it.
  const claim = await db.mutate(store => {
    const m = store.matches.find(x => x.id === matchId);
    const key = `lock:${matchId}`;
    if (!m || store.jobLog[key]) return null;
    store.jobLog[key] = new Date().toISOString();
    return { label: teamLabel(store, m), withLineup: [...new Set(store.fantasyTeams.filter(f => f.matchId === matchId).map(f => f.userId))] };
  });
  if (!claim) return null;
  const perUser: Record<string, { title?: string; body: string }> = {};
  for (const uid of claim.withLineup) perUser[uid] = { body: `Your Pick XI is in. You have ${minutes} minutes to change players, captain or vice-captain.` };
  const m = { id: matchId };
  return dispatchNotification({
    title: `⏳ ${claim.label}: Pick XI locks in ${minutes} min`,
    body: `Pick 11 players and a captain before the first ball.`,
    category: 'contest_deadline',
    targetAudience: 'logged_in',
    perUser,
    data: { matchId: m.id, url: `/fantasy/${m.id}` },
    priority: 'high',
    createdBy: 'Pick XI',
  });
}

/** Personal "your Pick XI scored N points, rank R" messages. Sent once per match (re-scoring does not resend). */
export async function notifyFantasyResults(matchId: string) {
  const claim = await db.mutate(store => {
    const m = store.matches.find(x => x.id === matchId);
    if (!m) return null;
    const key = `result:${m.id}`;
    const lineups = store.fantasyTeams.filter(f => f.matchId === m.id && f.scoredAt);
    if (store.jobLog[key] || !lineups.length) return null;
    store.jobLog[key] = new Date().toISOString();
    return { label: teamLabel(store, m), lineups: lineups.map(f => ({ userId: f.userId, points: f.points || 0, rank: f.rank })) };
  });
  if (!claim) return null;
  const m = { id: matchId };
  const perUser: Record<string, { title?: string; body: string }> = {};
  for (const ft of claim.lineups) {
    perUser[ft.userId] = {
      title: `🏏 Your Pick XI: ${ft.points} pts`,
      body: `${claim.label}: you finished #${ft.rank} of ${claim.lineups.length} and earned ${Math.round(ft.points / DREAM_XI.fanPointsDivisor)} fan points.`,
    };
  }
  return dispatchNotification({
    title: `🏏 Pick XI results: ${claim.label}`,
    body: 'Your points are in.',
    category: 'fantasy',
    targetAudience: 'users',
    userIds: claim.lineups.map(f => f.userId),
    perUser,
    data: { matchId: m.id, url: `/fantasy/${m.id}` },
    createdBy: 'Pick XI',
  });
}

/** Called whenever a match is saved as completed (by an admin or the live-score sync). */
export async function afterMatchCompleted(matchId: string) {
  const r = await db.mutate(store => {
    const m = store.matches.find(x => x.id === matchId);
    if (!m || m.status !== 'completed') return undefined;
    const hasScorecard = Boolean(m.scorecard?.innings1?.batting?.length || m.scorecard?.innings2?.batting?.length);
    if (!hasScorecard) return null;
    return scoreMatchFantasy(store, matchId);
  });
  if (r === undefined) return null;
  if (r === null) return { scored: 0, note: 'No scorecard yet, so Pick XI lineups were not scored. Add the scorecard and save again.' };
  await notifyFantasyResults(matchId);
  return { ...r, note: `${r.scored} Pick XI lineup(s) scored.${r.unmatchedNames.length ? ` Names not matched to a squad player: ${r.unmatchedNames.join(', ')}.` : ''}` };
}

/** Lineup-lock reminders and contest auto-locking. Safe to run as often as you like. */
export async function runReminders(now = Date.now()) {
  const snapshot = db.get();
  const minutes = snapshot.settings.lockReminderMinutes || 30;
  const due = snapshot.matches
    .filter(m => m.status === 'upcoming' && !snapshot.jobLog[`lock:${m.id}`])
    .map(m => ({ id: m.id, t: +new Date(m.startsAt) }))
    .filter(m => m.t > now && m.t - now <= minutes * 60_000);
  const sent: string[] = [];
  for (const m of due) {
    if (await sendLockReminder(m.id, Math.max(1, Math.round((m.t - now) / 60_000)))) sent.push(m.id);
  }
  const locked = await db.mutate(store => {
    let n = 0;
    for (const c of store.contests) {
      if (c.status === 'open' && c.locksAt && +new Date(c.locksAt) <= now) {
        c.status = 'locked';
        n++;
      }
    }
    return n;
  });
  return { lockReminders: sent.length, contestsLocked: locked };
}

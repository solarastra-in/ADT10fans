import { AppStore, db, Match } from './db';
import { dispatchNotification } from './notify';
import { DREAM_XI, scoreMatchFantasy } from './fantasy';

const teamLabel = (store: AppStore, m: Match) => {
  const a = store.teams.find(t => t.id === m.teamA);
  const b = store.teams.find(t => t.id === m.teamB);
  return `${a?.name || m.teamA} vs ${b?.name || m.teamB}`;
};

/** "Dream XI locks soon" for one match. Sent once per match. */
export async function sendLockReminder(matchId: string, minutes: number) {
  const store = db.get();
  const m = store.matches.find(x => x.id === matchId);
  if (!m) return null;
  const key = `lock:${m.id}`;
  if (store.jobLog[key]) return null;
  store.jobLog[key] = new Date().toISOString();
  db.save();
  const withLineup = new Set(store.fantasyTeams.filter(f => f.matchId === m.id).map(f => f.userId));
  const perUser: Record<string, { title?: string; body: string }> = {};
  for (const uid of withLineup) perUser[uid] = { body: `Your Dream XI is in. You have ${minutes} minutes to change players, captain or vice-captain.` };
  return dispatchNotification({
    title: `⏳ ${teamLabel(store, m)}: Dream XI locks in ${minutes} min`,
    body: `Pick 11 players and a captain before the first ball.`,
    category: 'contest_deadline',
    targetAudience: 'logged_in',
    perUser,
    data: { matchId: m.id, url: `/fantasy/${m.id}` },
    priority: 'high',
    createdBy: 'Dream XI',
  });
}

/** Personal "your Dream XI scored N points, rank R" messages. Sent once per match (re-scoring does not resend). */
export async function notifyFantasyResults(matchId: string) {
  const store = db.get();
  const m = store.matches.find(x => x.id === matchId);
  if (!m) return null;
  const key = `result:${m.id}`;
  const lineups = store.fantasyTeams.filter(f => f.matchId === m.id && f.scoredAt);
  if (store.jobLog[key] || !lineups.length) return null;
  store.jobLog[key] = new Date().toISOString();
  db.save();
  const perUser: Record<string, { title?: string; body: string }> = {};
  for (const ft of lineups) {
    perUser[ft.userId] = {
      title: `🏏 Your Dream XI: ${ft.points} pts`,
      body: `${teamLabel(store, m)}: you finished #${ft.rank} of ${lineups.length} and earned ${Math.round((ft.points || 0) / DREAM_XI.fanPointsDivisor)} fan points.`,
    };
  }
  return dispatchNotification({
    title: `🏏 Dream XI results: ${teamLabel(store, m)}`,
    body: 'Your points are in.',
    category: 'fantasy',
    targetAudience: 'users',
    userIds: lineups.map(f => f.userId),
    perUser,
    data: { matchId: m.id, url: `/fantasy/${m.id}` },
    createdBy: 'Dream XI',
  });
}

/** Called whenever a match is saved as completed (by an admin or the live-score sync). */
export async function afterMatchCompleted(matchId: string) {
  const store = db.get();
  const m = store.matches.find(x => x.id === matchId);
  if (!m || m.status !== 'completed') return null;
  const hasScorecard = Boolean(m.scorecard?.innings1?.batting?.length || m.scorecard?.innings2?.batting?.length);
  if (!hasScorecard) return { scored: 0, note: 'No scorecard yet, so Dream XI lineups were not scored. Add the scorecard and save again.' };
  const r = scoreMatchFantasy(store, matchId);
  db.save();
  await notifyFantasyResults(matchId);
  return { ...r, note: `${r.scored} Dream XI lineup(s) scored.${r.unmatchedNames.length ? ` Names not matched to a squad player: ${r.unmatchedNames.join(', ')}.` : ''}` };
}

/** Lineup-lock reminders and contest auto-locking. Safe to run as often as you like. */
export async function runReminders(now = Date.now()) {
  const store = db.get();
  const minutes = store.settings.lockReminderMinutes || 30;
  const sent: string[] = [];
  for (const m of store.matches) {
    if (m.status !== 'upcoming') continue;
    const t = +new Date(m.startsAt);
    if (t > now && t - now <= minutes * 60_000 && !store.jobLog[`lock:${m.id}`]) {
      await sendLockReminder(m.id, Math.max(1, Math.round((t - now) / 60_000)));
      sent.push(m.id);
    }
  }
  let locked = 0;
  for (const c of store.contests) {
    if (c.status === 'open' && c.locksAt && +new Date(c.locksAt) <= now) {
      c.status = 'locked';
      locked++;
    }
  }
  if (locked) db.save();
  return { lockReminders: sent.length, contestsLocked: locked };
}

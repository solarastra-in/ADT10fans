import crypto from 'crypto';
import { AppStore, db, GamePlay, Player, Team, User } from './db';
import { awardPoints } from './points';

/**
 * Daily games. One play per fan per game per day (Dubai time). All outcomes are decided on the
 * server from a secret kept in the store, so they cannot be predicted or replayed from the browser.
 *
 *  Guess the Player: a mystery player from the six squads. Up to 5 guesses; each wrong guess shows
 *    whether the guessed player shares the team or role, and reveals another clue.
 *    Points: 50 / 40 / 30 / 20 / 10 by the guess it was solved on.
 *  Super Over: 6 balls, 2 wickets. Pick a shot for each ball; riskier shots score more but get out
 *    more often. Points = runs, plus 15 for beating the day's target.
 */

export const dubaiDay = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });

export function gameSecret(store: AppStore): string {
  if (process.env.GAME_SECRET) return process.env.GAME_SECRET;
  if (!store.jobLog['game-secret']) store.jobLog['game-secret'] = crypto.randomBytes(24).toString('hex');
  return store.jobLog['game-secret'];
}

// Made when the store loads (and saved), so every server uses the same secret. Made lazily during a
// page view, each server would invent its own and fans would get different puzzles from different servers.
db.onLoad(store => {
  if (process.env.GAME_SECRET || store.jobLog['game-secret']) return false;
  gameSecret(store);
  return true;
});

/** Deterministic number in [0, 1) for a key. */
function roll(store: AppStore, key: string): number {
  const h = crypto.createHmac('sha256', gameSecret(store)).update(key).digest();
  return h.readUInt32BE(0) / 0x100000000;
}

function findPlay(store: AppStore, userId: string, game: GamePlay['game'], day: string) {
  return store.gamePlays.find(p => p.userId === userId && p.game === game && p.day === day);
}

function startPlay(store: AppStore, userId: string, game: GamePlay['game'], day: string, state: any): GamePlay {
  const now = new Date().toISOString();
  const play: GamePlay = { userId, game, day, state, finished: false, points: 0, createdAt: now, updatedAt: now };
  store.gamePlays.push(play);
  // Keep the collection bounded: plays older than 60 days are only needed for streak stats.
  if (store.gamePlays.length > 50_000) store.gamePlays = store.gamePlays.slice(-40_000);
  return play;
}

// ---------- Guess the Player ----------
const GUESS_MAX = 5;

function allPlayers(store: AppStore): (Player & { teamName: string })[] {
  return store.teams.flatMap(t => t.squad.map(p => ({ ...p, teamName: t.name })));
}

export function mysteryPlayer(store: AppStore, day: string) {
  const players = allPlayers(store).sort((a, b) => a.id.localeCompare(b.id));
  if (!players.length) return null;
  return players[Math.floor(roll(store, `guess:${day}`) * players.length)];
}

const ROLE_LABEL: Record<Player['role'], string> = { batter: 'Batter', bowler: 'Bowler', allrounder: 'All-rounder', wicketkeeper: 'Wicketkeeper' };

function clues(p: Player & { teamName: string }) {
  const surname = p.name.trim().split(/\s+/).slice(-1)[0];
  const list = [
    { label: 'Role', value: ROLE_LABEL[p.role] },
    { label: 'Team', value: p.teamName },
    { label: 'Batting', value: p.battingStyle || 'Not listed' },
    { label: 'Bowling', value: p.bowlingStyle || 'Does not bowl' },
    { label: 'Surname starts with', value: surname[0].toUpperCase() },
  ];
  return list;
}

export function guessView(store: AppStore, user: User | null, day = dubaiDay()) {
  const target = mysteryPlayer(store, day);
  if (!target) return { day, available: false as const };
  const play = user ? findPlay(store, user.id, 'guess', day) : undefined;
  const guesses: string[] = play?.state?.guesses || [];
  const finished = Boolean(play?.finished);
  const all = clues(target);
  const revealed = finished ? all : all.slice(0, Math.min(all.length, 1 + guesses.length));
  const pool = allPlayers(store);
  return {
    day,
    available: true as const,
    maxGuesses: GUESS_MAX,
    clues: revealed,
    guesses: guesses.map(id => {
      const g = pool.find(p => p.id === id);
      return {
        playerId: id,
        name: g?.name || id,
        teamId: g?.teamId,
        teamName: g?.teamName,
        role: g?.role,
        correct: id === target.id,
        sameTeam: g ? g.teamId === target.teamId : false,
        sameRole: g ? g.role === target.role : false,
      };
    }),
    finished,
    solved: Boolean(play?.state?.solved),
    points: play?.points || 0,
    answer: finished ? { id: target.id, name: target.name, teamId: target.teamId, teamName: target.teamName, photoUrl: target.photoUrl } : null,
  };
}

export function submitGuess(store: AppStore, user: User, playerId: string, day = dubaiDay()) {
  const target = mysteryPlayer(store, day);
  if (!target) throw new GameError('There are no players to guess yet');
  if (!allPlayers(store).some(p => p.id === playerId)) throw new GameError('Choose a player from the list');
  const play = findPlay(store, user.id, 'guess', day) || startPlay(store, user.id, 'guess', day, { guesses: [], solved: false });
  if (play.finished) throw new GameError("You've already played today. A new player is up tomorrow.");
  if (play.state.guesses.includes(playerId)) throw new GameError('You already guessed that player');
  play.state.guesses.push(playerId);
  play.updatedAt = new Date().toISOString();
  if (playerId === target.id) {
    play.state.solved = true;
    play.finished = true;
    play.points = (GUESS_MAX + 1 - play.state.guesses.length) * 10;
    awardPoints(store, user, play.points, 'guess', `Solved in ${play.state.guesses.length} guess(es)`, day);
  } else if (play.state.guesses.length >= GUESS_MAX) {
    play.finished = true;
  }
  return guessView(store, user, day);
}

// ---------- Super Over ----------
export type Shot = 'defend' | 'rotate' | 'drive' | 'loft' | 'slog';
export const SHOTS: { id: Shot; label: string; hint: string }[] = [
  { id: 'defend', label: 'Defend', hint: 'Safe, rarely scores' },
  { id: 'rotate', label: 'Rotate strike', hint: 'Ones and twos' },
  { id: 'drive', label: 'Drive', hint: 'Fours, some risk' },
  { id: 'loft', label: 'Loft', hint: 'Sixes, real risk' },
  { id: 'slog', label: 'Slog', hint: 'Six or out' },
];
type Outcome = number | 'W';
const TABLE: Record<Shot, [Outcome, number][]> = {
  defend: [[0, 0.6], [1, 0.35], ['W', 0.05]],
  rotate: [[1, 0.55], [2, 0.25], [0, 0.12], ['W', 0.08]],
  drive: [[4, 0.35], [2, 0.2], [1, 0.2], [0, 0.13], ['W', 0.12]],
  loft: [[6, 0.3], [4, 0.2], [1, 0.15], [0, 0.15], ['W', 0.2]],
  slog: [[6, 0.4], [4, 0.1], [0, 0.2], ['W', 0.3]],
};
const SUPER_OVER_BONUS = 15;

export function superOverTarget(store: AppStore, day: string) {
  return 12 + Math.floor(roll(store, `target:${day}`) * 13); // 12-24
}

function superOverView(store: AppStore, play: GamePlay | undefined, day: string) {
  const balls: { shot: Shot; outcome: Outcome }[] = play?.state?.balls || [];
  const runs = balls.reduce((s, b) => s + (b.outcome === 'W' ? 0 : b.outcome), 0);
  const wickets = balls.filter(b => b.outcome === 'W').length;
  return {
    day,
    target: superOverTarget(store, day),
    shots: SHOTS,
    balls,
    runs,
    wickets,
    ballsLeft: play?.finished ? 0 : 6 - balls.length,
    finished: Boolean(play?.finished),
    points: play?.points || 0,
    bonus: SUPER_OVER_BONUS,
  };
}

export function superOverState(store: AppStore, user: User | null, day = dubaiDay()) {
  return superOverView(store, user ? findPlay(store, user.id, 'superover', day) : undefined, day);
}

export function playBall(store: AppStore, user: User, shot: Shot, day = dubaiDay()) {
  if (!TABLE[shot]) throw new GameError('Choose a shot');
  const play = findPlay(store, user.id, 'superover', day) || startPlay(store, user.id, 'superover', day, { balls: [] });
  if (play.finished) throw new GameError("You've batted today. Come back tomorrow for a new target.");
  const ballNo = play.state.balls.length;
  const r = roll(store, `ball:${user.id}:${day}:${ballNo}`);
  let acc = 0;
  let outcome: Outcome = 0;
  for (const [o, p] of TABLE[shot]) {
    acc += p;
    if (r < acc) {
      outcome = o;
      break;
    }
  }
  play.state.balls.push({ shot, outcome });
  play.updatedAt = new Date().toISOString();
  const view = superOverView(store, play, day);
  if (view.balls.length >= 6 || view.wickets >= 2) {
    play.finished = true;
    play.points = view.runs + (view.runs >= view.target ? SUPER_OVER_BONUS : 0);
    awardPoints(store, user, play.points, 'superover', `${view.runs} run(s)${view.runs >= view.target ? `, beat the target of ${view.target}` : ''}`, day);
  }
  return { ...superOverView(store, play, day), last: { shot, outcome } };
}

export function todayLeaderboard(store: AppStore, game: GamePlay['game'], day = dubaiDay(), limit = 10) {
  const users = new Map(store.users.map(u => [u.id, u]));
  return store.gamePlays
    .filter(p => p.game === game && p.day === day && p.finished)
    .sort((a, b) => b.points - a.points || +new Date(a.updatedAt) - +new Date(b.updatedAt))
    .slice(0, limit)
    .map(p => {
      const u = users.get(p.userId);
      return { userId: p.userId, name: u?.name || 'Fan', avatar: u?.avatar || '', teamId: u?.teamId || null, points: p.points };
    });
}

export function gameStats(store: AppStore, userId: string) {
  const mine = store.gamePlays.filter(p => p.userId === userId && p.finished);
  return {
    played: mine.length,
    points: mine.reduce((s, p) => s + p.points, 0),
    guessSolved: mine.filter(p => p.game === 'guess' && p.state?.solved).length,
    bestSuperOver: Math.max(0, ...mine.filter(p => p.game === 'superover').map(p => (p.state?.balls || []).reduce((s: number, b: any) => s + (b.outcome === 'W' ? 0 : b.outcome), 0))),
  };
}

export class GameError extends Error {}

export function teamName(teams: Team[], id: string | null | undefined) {
  return teams.find(t => t.id === id)?.name || '';
}

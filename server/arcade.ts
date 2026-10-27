import crypto from 'crypto';
import type { AppStore, Duel, GamePlay, Player, Team, User } from './db';
import { allPlayers, dubaiDay, findPlay, GameError, roll, startPlay } from './games';
import { awardPoints } from './points';
import { seasonStats } from './playerStats';
import { computePlayerPoints } from './fantasy';
import { findBy } from './indexes';

/**
 * Skill games built only from real data: who plays for whom, how they bat and bowl, their signing
 * category, and (Stat Wars) this season's figures from the site's scorecards. Every puzzle is chosen
 * on the server from a secret, so it is the same for everyone on a day and cannot be worked out from
 * the browser; answers are checked on the server.
 *
 *  Squad Connections  16 players, 4 hidden groups of 4. Up to 4 mistakes.
 *  Cricket Grid       3 teams x 3 traits. Name a player for each cell; rarer correct picks score more.
 *  Stat Wars          60 seconds of "who has more this season?". One scoring run a day, plus duels.
 */

// ---------------------------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------------------------

/** Deterministic generator for one puzzle (seeded from the game secret). */
function rng(store: AppStore, key: string) {
  let a = Math.floor(roll(store, key) * 0xffffffff) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = <T>(arr: T[], next: () => number) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

type P = Player & { teamName: string };

/** A trait a player either has or not, from their squad entry. */
export interface Trait {
  id: string;
  label: string;
  test: (p: P) => boolean;
  kind: 'team' | 'skill';
}

const bowl = (p: P) => (p.bowlingStyle || '').toLowerCase();
export const SKILL_TRAITS: Trait[] = [
  { id: 'lhb', label: 'Left-hand batter', test: p => /left-hand/i.test(p.battingStyle || ''), kind: 'skill' },
  { id: 'keeper', label: 'Wicketkeeper', test: p => p.role === 'wicketkeeper' || Boolean(p.isKeeper), kind: 'skill' },
  { id: 'offspin', label: 'Off-spinner', test: p => /offbreak/.test(bowl(p)), kind: 'skill' },
  { id: 'wristspin', label: 'Leg-spinner or wrist-spinner', test: p => /legbreak|wrist-spin/.test(bowl(p)), kind: 'skill' },
  { id: 'sla', label: 'Left-arm orthodox spinner', test: p => /left-arm orthodox/.test(bowl(p)), kind: 'skill' },
  { id: 'leftseam', label: 'Left-arm seamer', test: p => /^left-arm (fast|medium)/.test(bowl(p)), kind: 'skill' },
  { id: 'rightfast', label: 'Right-arm fast or fast-medium', test: p => /^right-arm fast/.test(bowl(p)), kind: 'skill' },
  { id: 'rightmed', label: 'Right-arm medium pace', test: p => bowl(p) === 'right-arm medium', kind: 'skill' },
  { id: 'star', label: 'Icon or Platinum signing', test: p => p.isIcon || /icon|platinum/i.test(p.category || ''), kind: 'skill' },
  { id: 'batar', label: 'Batting all-rounder', test: p => p.cricbuzzRole === 'Batting Allrounder', kind: 'skill' },
  { id: 'bowlar', label: 'Bowling all-rounder', test: p => p.cricbuzzRole === 'Bowling Allrounder', kind: 'skill' },
  { id: 'batter', label: 'Specialist batter', test: p => p.role === 'batter', kind: 'skill' },
  { id: 'bowler', label: 'Specialist bowler', test: p => p.role === 'bowler', kind: 'skill' },
  { id: 'nobowl', label: "Doesn't bowl", test: p => !p.bowlingStyle, kind: 'skill' },
];
const teamTraits = (teams: Team[]): Trait[] => teams.map(t => ({ id: `team:${t.id}`, label: `Plays for ${t.name}`, test: (p: P) => p.teamId === t.id, kind: 'team' }));

const publicPlayer = (p: P) => ({ id: p.id, name: p.name, photoUrl: p.photoUrl || null, teamId: p.teamId });

function playOf(store: AppStore, user: User | null, game: GamePlay['game'], day: string) {
  return user ? findPlay(store, user.id, game, day) : undefined;
}

// ---------------------------------------------------------------------------------------------
// Squad Connections
// ---------------------------------------------------------------------------------------------

const CONNECTIONS_MISTAKES = 4;
const COLORS = ['yellow', 'green', 'blue', 'purple'] as const;

interface ConnectionsPuzzle {
  groups: { traitId: string; label: string; color: (typeof COLORS)[number]; playerIds: string[] }[];
  order: string[];
}

const puzzleCache = new Map<string, ConnectionsPuzzle | null>();

/**
 * Picks four traits and four players for each, so that every player shown has exactly one of the
 * four traits (no player fits two groups, so there is a single answer).
 */
export function connectionsPuzzle(store: AppStore, day: string): ConnectionsPuzzle | null {
  const players = allPlayers(store).sort((a, b) => a.id.localeCompare(b.id));
  const cacheKey = `${day}|${players.map(p => `${p.id}:${p.teamId}:${p.role}:${p.battingStyle}:${p.bowlingStyle}:${p.category}`).join(',')}`;
  if (puzzleCache.has(cacheKey)) return puzzleCache.get(cacheKey)!;
  const next = rng(store, `connections:${day}`);
  const teams = teamTraits(store.teams);
  let result: ConnectionsPuzzle | null = null;
  for (let attempt = 0; attempt < 400 && !result; attempt++) {
    const teamCount = 1 + Math.floor(next() * 2); // one or two team groups
    const chosen = [...shuffle(teams, next).slice(0, teamCount), ...shuffle(SKILL_TRAITS, next).slice(0, 4 - teamCount)];
    const groups: ConnectionsPuzzle['groups'] = [];
    let ok = true;
    for (const tr of chosen) {
      const others = chosen.filter(o => o !== tr);
      const pool = players.filter(p => tr.test(p) && !others.some(o => o.test(p)));
      if (pool.length < 4) {
        ok = false;
        break;
      }
      groups.push({ traitId: tr.id, label: tr.label, color: 'yellow', playerIds: shuffle(pool, next).slice(0, 4).map(p => p.id), _size: pool.length } as any);
    }
    if (!ok) continue;
    // Easier groups first: teams, then traits shared by many players.
    groups.sort((a: any, b: any) => Number(b.traitId.startsWith('team:')) - Number(a.traitId.startsWith('team:')) || b._size - a._size);
    groups.forEach((g: any, i) => {
      g.color = COLORS[i];
      delete g._size;
    });
    result = { groups, order: shuffle(groups.flatMap(g => g.playerIds), next) };
  }
  if (puzzleCache.size > 20) puzzleCache.clear();
  puzzleCache.set(cacheKey, result);
  return result;
}

export function connectionsView(store: AppStore, user: User | null, day = dubaiDay()) {
  const puzzle = connectionsPuzzle(store, day);
  if (!puzzle) return { day, available: false as const };
  const play = playOf(store, user, 'connections', day);
  const found: string[] = play?.state?.found || [];
  const finished = Boolean(play?.finished);
  const byId = new Map(allPlayers(store).map(p => [p.id, p]));
  const solvedGroups = puzzle.groups.filter(g => finished || found.includes(g.traitId));
  const solvedIds = new Set(solvedGroups.flatMap(g => g.playerIds));
  return {
    day,
    available: true as const,
    maxMistakes: CONNECTIONS_MISTAKES,
    mistakes: play?.state?.mistakes || 0,
    finished,
    solved: Boolean(play?.state?.solved),
    points: play?.points || 0,
    groups: solvedGroups.map(g => ({ label: g.label, color: g.color, found: found.includes(g.traitId), players: g.playerIds.map(id => publicPlayer(byId.get(id)!)) })),
    remaining: puzzle.order.filter(id => !solvedIds.has(id)).map(id => publicPlayer(byId.get(id)!)),
    guesses: (play?.state?.guesses || []) as string[][],
  };
}

export function submitConnections(store: AppStore, user: User, ids: string[], day = dubaiDay()) {
  const puzzle = connectionsPuzzle(store, day);
  if (!puzzle) throw new GameError('There is no puzzle today');
  const pick = [...new Set(ids)];
  if (pick.length !== 4) throw new GameError('Pick four players');
  if (!pick.every(id => puzzle.order.includes(id))) throw new GameError('Pick players from today’s puzzle');
  const play = findPlay(store, user.id, 'connections', day) || startPlay(store, user.id, 'connections', day, { found: [], mistakes: 0, guesses: [] });
  if (play.finished) throw new GameError('You have finished today’s puzzle. A new one is up tomorrow.');
  const key = [...pick].sort().join(',');
  if (play.state.guesses.some((g: string[]) => [...g].sort().join(',') === key)) throw new GameError('You already tried those four');
  const group = puzzle.groups.find(g => !play.state.found.includes(g.traitId) && g.playerIds.every(id => pick.includes(id)));
  play.state.guesses.push(pick);
  play.updatedAt = new Date().toISOString();
  let oneAway = false;
  if (group) {
    play.state.found.push(group.traitId);
  } else {
    play.state.mistakes++;
    oneAway = puzzle.groups.some(g => !play.state.found.includes(g.traitId) && g.playerIds.filter(id => pick.includes(id)).length === 3);
  }
  const solved = play.state.found.length === puzzle.groups.length;
  if (solved || play.state.mistakes >= CONNECTIONS_MISTAKES) {
    play.finished = true;
    play.state.solved = solved;
    // 10 per group found, plus 20 for solving it, less 5 per mistake.
    play.points = play.state.found.length * 10 + (solved ? Math.max(0, 20 - play.state.mistakes * 5) : 0);
    awardPoints(store, user, play.points, 'connections', `${play.state.found.length} of 4 groups, ${play.state.mistakes} mistake(s)`, day);
  }
  return { ...connectionsView(store, user, day), correct: Boolean(group), oneAway, label: group?.label || null };
}

// ---------------------------------------------------------------------------------------------
// Cricket Grid
// ---------------------------------------------------------------------------------------------

interface GridPuzzle {
  rows: Trait[];
  cols: Trait[];
  /** How many players fit each cell ("r-c"). */
  sizes: Record<string, number>;
}
const gridCache = new Map<string, GridPuzzle | null>();

/** Three teams down the side, three traits across the top; every cell fits at least two players. */
export function gridPuzzle(store: AppStore, day: string): GridPuzzle | null {
  const players = allPlayers(store);
  const cacheKey = `${day}|${players.length}|${players.map(p => `${p.id}:${p.teamId}:${p.role}:${p.battingStyle}:${p.bowlingStyle}:${p.category}`).join(',')}`;
  if (gridCache.has(cacheKey)) return gridCache.get(cacheKey)!;
  const next = rng(store, `grid:${day}`);
  const teams = teamTraits(store.teams);
  let out: GridPuzzle | null = null;
  for (let attempt = 0; attempt < 400 && !out && teams.length >= 3; attempt++) {
    const rows = shuffle(teams, next).slice(0, 3);
    const cols = shuffle(SKILL_TRAITS, next).slice(0, 3);
    const sizes: Record<string, number> = {};
    let ok = true;
    rows.forEach((r, i) =>
      cols.forEach((c, j) => {
        const n = players.filter(p => r.test(p) && c.test(p)).length;
        sizes[`${i}-${j}`] = n;
        if (n < 2) ok = false;
      }),
    );
    if (ok) out = { rows, cols, sizes };
  }
  if (gridCache.size > 20) gridCache.clear();
  gridCache.set(cacheKey, out);
  return out;
}

const GRID_GUESSES = 9;

/** Share of today's players who put each player in each cell (the rarity shown after answering). */
function gridPickShares(store: AppStore, day: string) {
  const counts = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  for (const p of store.gamePlays) {
    if (p.game !== 'grid' || p.day !== day) continue;
    for (const [cell, id] of Object.entries((p.state?.cells || {}) as Record<string, string>)) {
      totals.set(cell, (totals.get(cell) || 0) + 1);
      if (!counts.has(cell)) counts.set(cell, new Map());
      counts.get(cell)!.set(id, (counts.get(cell)!.get(id) || 0) + 1);
    }
  }
  return (cell: string, id: string) => {
    const total = totals.get(cell) || 0;
    return total ? Math.round(((counts.get(cell)?.get(id) || 0) / total) * 100) : 100;
  };
}

const rarityBonus = (pct: number) => (pct <= 10 ? 4 : pct <= 25 ? 2 : pct <= 50 ? 1 : 0);

export function gridView(store: AppStore, user: User | null, day = dubaiDay()) {
  const g = gridPuzzle(store, day);
  if (!g) return { day, available: false as const };
  const play = playOf(store, user, 'grid', day);
  const cells: Record<string, string> = play?.state?.cells || {};
  const share = gridPickShares(store, day);
  const byId = new Map(allPlayers(store).map(p => [p.id, p]));
  const finished = Boolean(play?.finished);
  return {
    day,
    available: true as const,
    rows: g.rows.map(r => ({ id: r.id, label: r.label.replace(/^Plays for /, ''), teamId: r.id.replace(/^team:/, '') })),
    cols: g.cols.map(c => ({ id: c.id, label: c.label })),
    guessesLeft: play ? play.state.guessesLeft : GRID_GUESSES,
    finished,
    points: play?.points || 0,
    cells: Object.fromEntries(Object.entries(cells).map(([cell, id]) => [cell, { ...publicPlayer(byId.get(id)!), pickedBy: share(cell, id) }])),
    /** After finishing: how many players fitted each cell. */
    sizes: finished ? g.sizes : undefined,
    rarity: Object.entries(cells).reduce((s, [cell, id]) => s + share(cell, id), 0) + (9 - Object.keys(cells).length) * 100,
  };
}

export function submitGrid(store: AppStore, user: User, cell: string, playerId: string, day = dubaiDay()) {
  const g = gridPuzzle(store, day);
  if (!g) throw new GameError('There is no grid today');
  const m = /^([0-2])-([0-2])$/.exec(cell);
  if (!m) throw new GameError('Choose a square');
  const p = allPlayers(store).find(x => x.id === playerId);
  if (!p) throw new GameError('Choose a player from the list');
  const play = findPlay(store, user.id, 'grid', day) || startPlay(store, user.id, 'grid', day, { cells: {}, guessesLeft: GRID_GUESSES, wrong: [] });
  if (play.finished) throw new GameError('You have finished today’s grid. A new one is up tomorrow.');
  if (play.state.cells[cell]) throw new GameError('That square is already filled');
  if (Object.values(play.state.cells).includes(playerId)) throw new GameError('You have used that player already');
  play.state.guessesLeft--;
  const correct = g.rows[Number(m[1])].test(p) && g.cols[Number(m[2])].test(p);
  if (correct) play.state.cells[cell] = playerId;
  else play.state.wrong.push({ cell, playerId });
  play.updatedAt = new Date().toISOString();
  if (play.state.guessesLeft <= 0 || Object.keys(play.state.cells).length === 9) {
    play.finished = true;
    const share = gridPickShares(store, day);
    play.points = Object.entries(play.state.cells as Record<string, string>).reduce((s, [c, id]) => s + 6 + rarityBonus(share(c, id)), 0);
    awardPoints(store, user, play.points, 'grid', `${Object.keys(play.state.cells).length} of 9 squares`, day);
  }
  return { ...gridView(store, user, day), correct };
}

export function gridLeaderboard(store: AppStore, day = dubaiDay(), limit = 10) {
  const users = new Map(store.users.map(u => [u.id, u]));
  const share = gridPickShares(store, day);
  return store.gamePlays
    .filter(p => p.game === 'grid' && p.day === day && p.finished)
    .map(p => {
      const cells = Object.entries((p.state?.cells || {}) as Record<string, string>);
      const u = users.get(p.userId);
      return { userId: p.userId, name: u?.name || 'Fan', avatar: u?.avatar || '', teamId: u?.teamId || null, points: p.points, squares: cells.length, rarity: cells.reduce((s, [c, id]) => s + share(c, id), 0) + (9 - cells.length) * 100 };
    })
    .sort((a, b) => b.squares - a.squares || a.rarity - b.rarity)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------------------------
// Stat Wars
// ---------------------------------------------------------------------------------------------

export const STAT_WARS = { seconds: 60, graceMs: 8_000, questions: 20, minQuestions: 10, correct: 3, wrong: -1 };

interface StatQuestion {
  id: string;
  prompt: string;
  a: { id: string; name: string; teamId: string; photoUrl: string | null };
  b: { id: string; name: string; teamId: string; photoUrl: string | null };
  /** 'a' or 'b'; never sent to the browser before the run ends. */
  answer: 'a' | 'b';
  values: [number, number];
  unit: string;
}

let poolCache: { key: string; pool: Omit<StatQuestion, 'id'>[] } | null = null;

/** Every comparison the season's real figures allow (no ties). Worked out again when a scorecard changes. */
function questionPool(store: AppStore) {
  const key = store.matches
    .filter(m => m.status === 'completed' && m.scorecard)
    .map(m => `${m.id}@${m.updatedAt}`)
    .join('|') + `#${store.teams.map(t => `${t.id}:${t.squad.length}:${t.updatedAt || ''}`).join(',')}`;
  if (poolCache?.key === key) return poolCache.pool;
  const pool = buildQuestionPool(store);
  poolCache = { key, pool };
  return pool;
}

function buildQuestionPool(store: AppStore) {
  const stats = seasonStats(store);
  const players = allPlayers(store);
  const fantasy = new Map<string, number>();
  for (const m of store.matches.filter(x => x.status === 'completed' && x.scorecard)) {
    for (const [id, row] of computePlayerPoints(store, m)) fantasy.set(id, (fantasy.get(id) || 0) + row.points);
  }
  const metrics: { key: string; prompt: string; unit: string; lowerWins?: boolean; value: (id: string) => number | null }[] = [
    { key: 'runs', prompt: 'More runs this season?', unit: 'runs', value: id => (stats.get(id)?.innings ? stats.get(id)!.runs : null) },
    { key: 'wkts', prompt: 'More wickets this season?', unit: 'wickets', value: id => (stats.get(id)?.ballsBowled ? stats.get(id)!.wickets : null) },
    { key: 'sixes', prompt: 'More sixes this season?', unit: 'sixes', value: id => (stats.get(id)?.innings ? stats.get(id)!.sixes : null) },
    { key: 'sr', prompt: 'Higher strike rate this season? (10+ balls)', unit: 'strike rate', value: id => ((stats.get(id)?.balls || 0) >= 10 ? stats.get(id)!.strikeRate : null) },
    { key: 'econ', prompt: 'Better (lower) economy this season? (1+ over)', unit: 'runs per over', lowerWins: true, value: id => ((stats.get(id)?.ballsBowled || 0) >= 6 ? stats.get(id)!.economy : null) },
    { key: 'pts', prompt: 'More Pick XI points this season?', unit: 'Pick XI points', value: id => (fantasy.has(id) ? fantasy.get(id)! : null) },
  ];
  const out: Omit<StatQuestion, 'id'>[] = [];
  for (const m of metrics) {
    const have = players.map(p => ({ p, v: m.value(p.id) })).filter(x => x.v !== null && Number.isFinite(x.v)) as { p: P; v: number }[];
    for (let i = 0; i < have.length; i++) {
      for (let j = i + 1; j < have.length; j++) {
        const [x, y] = [have[i], have[j]];
        if (x.v === y.v) continue;
        const aWins = m.lowerWins ? x.v < y.v : x.v > y.v;
        out.push({ prompt: m.prompt, a: publicPlayer(x.p) as any, b: publicPlayer(y.p) as any, answer: aWins ? 'a' : 'b', values: [x.v, y.v], unit: m.unit });
      }
    }
  }
  return out;
}

/** The questions for one run, in order, from a seed (the same seed gives the same questions). */
export function statWarsQuestions(store: AppStore, seed: string): StatQuestion[] | null {
  const pool = questionPool(store);
  if (pool.length < STAT_WARS.minQuestions) return null;
  const next = rng(store, `statwars:${seed}`);
  // Spread across prompts so one stat does not dominate, then shuffle sides.
  const byPrompt = new Map<string, Omit<StatQuestion, 'id'>[]>();
  for (const q of shuffle(pool, next)) {
    if (!byPrompt.has(q.prompt)) byPrompt.set(q.prompt, []);
    byPrompt.get(q.prompt)!.push(q);
  }
  const lists = [...byPrompt.values()];
  const picked: Omit<StatQuestion, 'id'>[] = [];
  for (let i = 0; picked.length < STAT_WARS.questions && lists.some(l => l.length > i); i++) for (const l of lists) if (l[i] && picked.length < STAT_WARS.questions) picked.push(l[i]);
  return shuffle(picked, next).map((q, i) => {
    const swap = next() < 0.5;
    return swap
      ? { ...q, id: `q${i}`, a: q.b, b: q.a, answer: q.answer === 'a' ? 'b' : 'a', values: [q.values[1], q.values[0]] }
      : { ...q, id: `q${i}` };
  });
}

const publicQuestions = (qs: StatQuestion[]) => qs.map(({ answer: _a, values: _v, ...q }) => q);

export function statWarsAvailable(store: AppStore) {
  return questionPool(store).length >= STAT_WARS.minQuestions;
}

export function statWarsView(store: AppStore, user: User | null, day = dubaiDay()) {
  const available = statWarsAvailable(store);
  const play = playOf(store, user, 'statwars', day);
  return {
    day,
    available,
    seconds: STAT_WARS.seconds,
    questions: STAT_WARS.questions,
    played: Boolean(play?.finished),
    inProgress: Boolean(play && !play.finished),
    result: play?.finished ? play.state.result : null,
  };
}

/** Starts a run. Daily (one scoring run a day) or for a duel (the duel's seed). */
export function startStatWars(store: AppStore, user: User, opts: { duel?: Duel } = {}, day = dubaiDay()) {
  const now = new Date().toISOString();
  if (opts.duel) {
    const d = opts.duel;
    if (d.status !== 'waiting') throw new GameError('This duel is over');
    if (d.createdBy !== user.id && d.opponentId !== user.id) throw new GameError('Join the duel first');
    if (d.runs[user.id]?.startedAt) throw new GameError('You have already played this duel');
    const qs = statWarsQuestions(store, d.seed);
    if (!qs) throw new GameError('Stat Wars opens once this season has enough matches');
    d.runs[user.id] = { startedAt: now };
    return { startedAt: now, seconds: STAT_WARS.seconds, questions: publicQuestions(qs) };
  }
  const existing = findPlay(store, user.id, 'statwars', day);
  if (existing?.finished) throw new GameError('You have played today’s Stat Wars. Challenge a friend to a duel, or come back tomorrow.');
  if (existing) throw new GameError('Your run has already started');
  const seed = `${day}:${user.id}`;
  const qs = statWarsQuestions(store, seed);
  if (!qs) throw new GameError('Stat Wars opens once this season has enough matches');
  startPlay(store, user.id, 'statwars', day, { seed, startedAt: now });
  return { startedAt: now, seconds: STAT_WARS.seconds, questions: publicQuestions(qs) };
}

/** Marks a run, from the answers and the server's own clock (late answers do not count). */
function mark(qs: StatQuestion[], answers: unknown, startedAt: string) {
  const list = Array.isArray(answers) ? answers.slice(0, qs.length) : [];
  const elapsedMs = Math.max(0, Date.now() - +new Date(startedAt));
  const late = elapsedMs > STAT_WARS.seconds * 1000 + STAT_WARS.graceMs;
  let correct = 0;
  let wrong = 0;
  const review = qs.map((q, i) => {
    const given = list[i] === 'a' || list[i] === 'b' ? (list[i] as 'a' | 'b') : null;
    if (given === q.answer) correct++;
    else if (given) wrong++;
    return { ...q, given, right: given === q.answer };
  });
  const answered = correct + wrong;
  // Fast and accurate runs earn a time bonus: a point for every 5 seconds left, if 70%+ correct.
  const secondsLeft = Math.max(0, STAT_WARS.seconds - Math.ceil(elapsedMs / 1000));
  const timeBonus = !late && answered === qs.length && correct / qs.length >= 0.7 ? Math.floor(secondsLeft / 5) : 0;
  const score = late ? 0 : Math.max(0, correct * STAT_WARS.correct + wrong * STAT_WARS.wrong + timeBonus);
  return { correct, wrong, answered, score, timeBonus, elapsedMs: Math.min(elapsedMs, STAT_WARS.seconds * 1000), late, review };
}

export function finishStatWars(store: AppStore, user: User, answers: unknown, opts: { duel?: Duel } = {}, day = dubaiDay()) {
  if (opts.duel) {
    const d = opts.duel;
    const run = d.runs[user.id];
    if (!run?.startedAt) throw new GameError('Start the duel first');
    if (run.finishedAt) throw new GameError('You have already finished this duel');
    const qs = statWarsQuestions(store, d.seed);
    if (!qs) throw new GameError('Stat Wars is not available');
    const r = mark(qs, answers, run.startedAt);
    Object.assign(run, { finishedAt: new Date().toISOString(), score: r.score, correct: r.correct, answered: r.answered, elapsedMs: r.elapsedMs });
    settleDuel(store, d);
    return { ...r, duel: duelView(store, d, user) };
  }
  const play = findPlay(store, user.id, 'statwars', day);
  if (!play) throw new GameError('Start a run first');
  if (play.finished) throw new GameError('You have played today’s Stat Wars');
  const qs = statWarsQuestions(store, play.state.seed);
  if (!qs) throw new GameError('Stat Wars is not available');
  const r = mark(qs, answers, play.state.startedAt);
  play.finished = true;
  play.points = r.score;
  play.state.result = { correct: r.correct, wrong: r.wrong, score: r.score, timeBonus: r.timeBonus, elapsedMs: r.elapsedMs, late: r.late };
  play.updatedAt = new Date().toISOString();
  awardPoints(store, user, r.score, 'statwars', `${r.correct} correct in ${Math.round(r.elapsedMs / 1000)}s`, day);
  return r;
}

export function statWarsLeaderboard(store: AppStore, day = dubaiDay(), limit = 10) {
  const users = new Map(store.users.map(u => [u.id, u]));
  return store.gamePlays
    .filter(p => p.game === 'statwars' && p.day === day && p.finished)
    .sort((a, b) => b.points - a.points || (a.state?.result?.elapsedMs || 0) - (b.state?.result?.elapsedMs || 0))
    .slice(0, limit)
    .map(p => {
      const u = users.get(p.userId);
      return { userId: p.userId, name: u?.name || 'Fan', avatar: u?.avatar || '', teamId: u?.teamId || null, points: p.points, correct: p.state?.result?.correct || 0 };
    });
}

// ---------------------------------------------------------------------------------------------
// Duels
// ---------------------------------------------------------------------------------------------

export const DUEL = { hours: 48, winPoints: 15, playPoints: 3, paidWinsPerDay: 3, createPerDay: 10 };

const code = () => crypto.randomBytes(5).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase().padEnd(6, 'X');

export function createDuel(store: AppStore, user: User, open: boolean): Duel {
  if (!statWarsAvailable(store)) throw new GameError('Duels open once this season has enough matches for Stat Wars');
  const today = dubaiDay();
  const mine = store.duels.filter(d => d.createdBy === user.id && dubaiDay(new Date(d.createdAt)) === today).length;
  if (mine >= DUEL.createPerDay) throw new GameError(`You can start ${DUEL.createPerDay} duels a day`);
  const now = new Date();
  let c = code();
  while (store.duels.some(d => d.code === c)) c = code();
  const d: Duel = {
    id: 'duel-' + crypto.randomUUID().replace(/-/g, '').slice(0, 10),
    code: c,
    game: 'statwars',
    seed: crypto.randomBytes(8).toString('hex'),
    createdBy: user.id,
    createdByName: user.name,
    opponentId: null,
    open,
    createdAt: now.toISOString(),
    expiresAt: new Date(+now + DUEL.hours * 3600_000).toISOString(),
    runs: {},
    status: 'waiting',
  };
  store.duels.push(d);
  return d;
}

export function joinDuel(store: AppStore, user: User, d: Duel) {
  expireDuel(d);
  if (d.status !== 'waiting') throw new GameError('This duel is over');
  if (d.createdBy === user.id) return d;
  if (d.opponentId && d.opponentId !== user.id) throw new GameError('Someone has already taken this challenge');
  d.opponentId = user.id;
  d.opponentName = user.name;
  return d;
}

function expireDuel(d: Duel) {
  if (d.status === 'waiting' && +new Date(d.expiresAt) < Date.now()) d.status = 'expired';
}

/** Decides a duel once both have played: higher score wins, then the faster run. */
function settleDuel(store: AppStore, d: Duel) {
  const a = d.runs[d.createdBy];
  const b = d.opponentId ? d.runs[d.opponentId] : undefined;
  if (!a?.finishedAt || !b?.finishedAt || d.status !== 'waiting') return;
  d.status = 'done';
  const sa = a.score || 0;
  const sb = b.score || 0;
  d.winnerId = sa !== sb ? (sa > sb ? d.createdBy : d.opponentId) : (a.elapsedMs || 0) !== (b.elapsedMs || 0) ? ((a.elapsedMs || 0) < (b.elapsedMs || 0) ? d.createdBy : d.opponentId) : null;
  const today = dubaiDay();
  for (const uid of [d.createdBy, d.opponentId!]) {
    const u = findBy(store.users, 'id', uid);
    if (!u) continue;
    const winsToday = store.pointsLedger.filter(e => e.userId === uid && e.source === 'duel' && e.delta >= DUEL.winPoints && dubaiDay(new Date(e.at)) === today).length;
    const won = d.winnerId === uid;
    const pts = won && winsToday < DUEL.paidWinsPerDay ? DUEL.winPoints : DUEL.playPoints;
    awardPoints(store, u, pts, 'duel', won ? `Won a duel (${d.code})` : d.winnerId ? `Played a duel (${d.code})` : `Drew a duel (${d.code})`, d.id);
  }
}

export function duelView(store: AppStore, d: Duel, viewer: User | null) {
  expireDuel(d);
  const side = (uid: string | null) => {
    if (!uid) return null;
    const u = findBy(store.users, 'id', uid);
    const r = d.runs[uid];
    // Scores are shown once the viewer has finished (or the duel is over), so nobody plays knowing the target.
    const reveal = d.status !== 'waiting' || (viewer && d.runs[viewer.id]?.finishedAt) || viewer?.id === uid;
    return {
      userId: uid,
      name: u?.name || (uid === d.createdBy ? d.createdByName : d.opponentName) || 'Fan',
      avatar: u?.avatar || '',
      teamId: u?.teamId || null,
      played: Boolean(r?.finishedAt),
      score: reveal && r?.finishedAt ? r.score : null,
      correct: reveal && r?.finishedAt ? r.correct : null,
      seconds: reveal && r?.finishedAt ? Math.round((r.elapsedMs || 0) / 1000) : null,
    };
  };
  return {
    code: d.code,
    open: d.open,
    status: d.status,
    createdAt: d.createdAt,
    expiresAt: d.expiresAt,
    challenger: side(d.createdBy),
    opponent: side(d.opponentId),
    winnerId: d.status === 'done' ? d.winnerId ?? null : null,
    youCanPlay: Boolean(viewer && d.status === 'waiting' && (d.createdBy === viewer.id || d.opponentId === viewer.id) && !d.runs[viewer.id]?.startedAt),
    youCanJoin: Boolean(viewer && d.status === 'waiting' && d.createdBy !== viewer.id && !d.opponentId),
  };
}

export function findDuel(store: AppStore, c: string) {
  return store.duels.find(d => d.code === String(c || '').toUpperCase());
}

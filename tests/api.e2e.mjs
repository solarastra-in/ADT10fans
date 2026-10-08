// End-to-end API checks. Run against a DEV server (NODE_ENV!=production so OTP codes are returned):
//   DATA_DIR=/tmp/adt10-test ADMIN_EMAILS=admin@test.dev FEED_SYNC_MINUTES=0 PORT=3300 npx tsx server.ts
//   BASE=http://localhost:3300 node tests/api.e2e.mjs
import assert from 'node:assert/strict';
const BASE = process.env.BASE || 'http://localhost:3300';
let passed = 0;
async function call(method, path, body, token) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, json };
}
const ok = (name, cond) => { assert.ok(cond, name); passed++; console.log('✓', name); };
async function login(email) {
  const r1 = await call('POST', '/api/auth/otp/request', { email });
  assert.equal(r1.status, 200, JSON.stringify(r1.json));
  const r2 = await call('POST', '/api/auth/otp/verify', { email, code: r1.json.devCode });
  assert.equal(r2.status, 200, JSON.stringify(r2.json));
  return r2.json;
}

const empty = await call('GET', '/api/teams');
ok('fresh store has no teams', empty.json.teams.length === 0);
ok('fresh store has no feed items', (await call('GET', '/api/feeds')).json.items.length === 0);
ok('fresh store has no matches', (await call('GET', '/api/matches')).json.matches.length === 0);

const fake = await call('POST', '/api/auth/google', { idToken: 'not-a-real-token' });
ok('google sign-in rejects forged tokens', fake.status === 401);
const legacy = await call('POST', '/api/auth/google', { email: 'admin@test.dev' });
ok('google sign-in no longer accepts a bare email', legacy.status === 400);
ok('user id is not a valid bearer token', (await call('GET', '/api/me', null, 'usr_123')).json.user === null);

const wrong = await call('POST', '/api/auth/otp/request', { email: 'wrongcode@test.dev' });
ok('otp request ok', wrong.status === 200);
ok('wrong otp rejected', (await call('POST', '/api/auth/otp/verify', { email: 'wrongcode@test.dev', code: '000000' })).status === 400);

const admin = await login('admin@test.dev');
ok('admin email gets admin role', admin.user.role === 'admin');
ok('session token is opaque, not the user id', admin.token !== admin.user.id && admin.token.length >= 40);
const A = admin.token;

const seeded = await call('POST', '/api/admin/teams/seed-official', { overwrite: false }, A);
ok('seed creates six franchises', seeded.json.created.length === 6);
const names = seeded.json.teams.map(t => t.name);
for (const n of ['UAE Bulls', 'United Tigers', 'Yas Lions', 'Arabian Aces', 'Emirates Eagles', 'Desert Royal Champions']) ok(`seeded ${n}`, names.includes(n));
const aces = seeded.json.teams.find(t => t.id === 'aces');
ok('Arabian Aces icon is Moeen Ali', aces.iconPlayer === 'Moeen Ali' && aces.squad.length === 3);
ok('Desert Royal Champions signings', seeded.json.teams.find(t => t.id === 'champions').squad.map(p => p.name).join() === 'Nicholas Pooran,Phil Salt,Sherfane Rutherford');
const again = await call('POST', '/api/admin/teams/seed-official', {}, A);
ok('seeding is idempotent', again.json.created.length === 0 && again.json.skipped.length === 6 && again.json.teams.length === 6);
const handles = (await call('GET', '/api/handles')).json.handles;
ok('only verified handles are public', handles.length > 0 && handles.every(h => h.status === 'verified'));
ok('all handles are https', handles.every(h => h.url.startsWith('https://')));

const fan = await login('fan1@test.dev');
const F = fan.token;
ok('fan role', fan.user.role === 'fan');
ok('fan starts with 0 points', fan.user.points === 0);
ok('fan cannot seed teams', (await call('POST', '/api/admin/teams/seed-official', {}, F)).status === 403);
ok('fan cannot read proposal', (await call('GET', '/api/admin/proposal', null, F)).status === 403);
ok('anonymous cannot sync feeds', (await call('POST', '/api/social/sync-real')).status === 401);
ok('fan cannot push notifications', (await call('POST', '/api/fcm/send', { title: 'x', body: 'y' }, F)).status === 403);
ok('fan cannot change settings', (await call('POST', '/api/admin/settings', { adminEmails: 'fan1@test.dev' }, F)).status === 403);
ok('gemini requires sign-in', (await call('POST', '/api/gemini/chat', { messages: [{ role: 'user', parts: [{ text: 'hi' }] }] })).status === 401);
const g = await call('POST', '/api/gemini/chat', { messages: [{ role: 'user', parts: [{ text: 'hi' }] }] }, F);
ok('gemini without key returns 503, no canned answer', g.status === 503 && !g.json.text);

ok('match needs real teams', (await call('POST', '/api/matches', { teamA: 'aces', teamB: 'deccan', startsAt: '2026-11-07T15:00:00Z' }, A)).status === 400);
const start = new Date(Date.now() + 3 * 86400000).toISOString();
const m = await call('POST', '/api/matches', { teamA: 'aces', teamB: 'bulls', startsAt: start, stage: 'Group stage' }, A);
ok('admin creates fixture', m.status === 200 && m.json.targetMatch.venue === 'Zayed Cricket Stadium, Abu Dhabi');
const matchId = m.json.targetMatch.id;

const c = await call('POST', '/api/admin/contests', {
  title: 'Match 1 predictor', type: 'predictor', matchId, prize: 'Signed cap',
  questions: [{ prompt: 'Who wins?', options: ['Arabian Aces', 'UAE Bulls'], points: 50 }],
}, A);
ok('admin creates contest', c.status === 200);
const contest = c.json.contests[0];
const quiz = await call('POST', '/api/admin/contests', {
  title: 'Quick quiz', type: 'trivia', instant: true, prize: 'Points',
  questions: [{ prompt: 'Overs per innings?', options: ['8', '10'], points: 10, answer: '10' }],
}, A);
const quizId = quiz.json.contests.find(x => x.instant).id;
const pub = (await call('GET', '/api/contests', null, F)).json;
ok('answers are hidden from fans', pub.contests.every(x => x.questions.every(q => q.answer === undefined)));
ok('partial entry rejected', (await call('POST', `/api/contests/${contest.id}/enter`, { answers: {} }, F)).status === 400);
ok('fan enters contest', (await call('POST', `/api/contests/${contest.id}/enter`, { answers: { [contest.questions[0].id]: 'Arabian Aces' } }, F)).status === 200);
const qz = quiz.json.contests.find(x => x.instant);
const qr = await call('POST', `/api/contests/${quizId}/enter`, { answers: { [qz.questions[0].id]: '10' } }, F);
ok('instant quiz graded server-side', qr.json.pointsAwarded === 10);
ok('instant quiz cannot be replayed for points', (await call('POST', `/api/contests/${quizId}/enter`, { answers: { [qz.questions[0].id]: '10' } }, F)).status === 400);
const settle = await call('POST', `/api/admin/contests/${contest.id}/settle`, { answers: { [contest.questions[0].id]: 'Arabian Aces' } }, A);
ok('settle awards points', settle.json.totalPointsDistributed === 50);

const squad = (await call('GET', '/api/teams')).json.teams.filter(t => t.id === 'aces' || t.id === 'bulls').flatMap(t => t.squad).map(p => p.id);
const ft = await call('POST', `/api/fantasy/${matchId}`, { playerIds: squad, captainId: squad[0] }, F);
ok('fantasy lineup over credit cap rejected (6 × ~9.7 > 55)', ft.status === 400 && /cap/.test(ft.json.error));
ok('fantasy rejects foreign players', (await call('POST', `/api/fantasy/${matchId}`, { playerIds: ['x1', 'x2', 'x3', 'x4', 'x5', 'x6'], captainId: 'x1' }, F)).status === 400);

const d = await call('POST', '/api/admin/draws', { title: 'Signed bat', prize: 'Signed bat', closesAt: new Date(Date.now() + 86400000).toISOString() }, A);
ok('admin creates draw', d.status === 200);
const drawId = d.json.draws[0].id;
ok('fan enters draw', (await call('POST', `/api/draws/${drawId}/enter`, null, F)).status === 200);
ok('duplicate draw entry rejected', (await call('POST', `/api/draws/${drawId}/enter`, null, F)).status === 400);
const dl = (await call('GET', '/api/draws', null, F)).json;
ok('draw shows real entry count and no emails', dl.draws[0].entriesCount === 1 && dl.draws[0].entered === true && !JSON.stringify(dl).includes('fan1@test.dev'));
const ex = await call('POST', `/api/draws/${drawId}/execute`, null, A);
ok('draw executes with seed + hash', ex.json.draw.seed && ex.json.draw.entrantsHash && ex.json.draw.winnerName);

ok('team pick', (await call('POST', '/api/me/team', { teamId: 'aces' }, F)).json.user.teamId === 'aces');
const lb = (await call('GET', '/api/leaderboard')).json;
const acesRow = lb.fanWars.find(r => r.team.id === 'aces');
ok('leaderboard uses only real fan points', acesRow.fansCount === 1 && acesRow.points === 60);
ok('leaderboard hides emails', !JSON.stringify(lb).includes('@test.dev'));

const th = await call('POST', '/api/forum/threads', { title: 'Who opens for the Aces?', content: 'Thoughts on the batting order this season?' }, F);
ok('fan creates thread (no fake upvotes)', th.status === 200 && th.json.thread.upvotes === 0);
ok('admin pins thread', (await call('POST', `/api/admin/forum/threads/${th.json.thread.id}/pin`, { pinned: true }, A)).json.thread.pinned === true);
ok('admin deletes thread', (await call('DELETE', `/api/admin/forum/threads/${th.json.thread.id}`, null, A)).status === 200);

const n = await call('POST', '/api/fcm/send', { title: 'Hello fans', body: 'Season starts soon' }, A);
ok('notification stored in-app with honest counts', n.json.notification.delivery === 'in-app' && n.json.notification.fcmSuccessCount === 0);
ok('fake push tokens rejected', (await call('POST', '/api/fcm/register-token', { token: 'fcm_web_abc' })).status === 400);

ok('creator requires real URL', (await call('POST', '/api/admin/growth/creator', { name: 'X' }, A)).status === 400);
const tier = await call('POST', '/api/admin/growth/passport-tier', { tierName: 'Superfan' }, A);
const tierId = tier.json.passportTiers[0].id;
const sub = await call('POST', '/api/growth/superfan-passport/subscribe', { tierId }, F);
ok('passport interest counted from real registrations', sub.json.tier.totalSubscribers === 1);

const settings = (await call('GET', '/api/admin/settings', null, A)).json.settings;
ok('smtp password never returned', settings.smtp.pass === '' || settings.smtp.pass === '********');
const logout = await call('POST', '/api/auth/logout', null, F);
ok('logout revokes session', logout.status === 200 && (await call('GET', '/api/me', null, F)).json.user === null);
const cfg = (await call('GET', '/api/config')).json.config;
ok('config stats are real', cfg.stats.teams === 6 && cfg.stats.fans === 2 && cfg.stats.handles > 0);
console.log(`\n${passed} checks passed`);

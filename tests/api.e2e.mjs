// End-to-end checks of every critical user journey against a running DEV server with offline fixtures.
// Started by tests/run-e2e.sh (see there for the environment). Exits non-zero on the first failure.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:3300';
const FIX = JSON.parse(fs.readFileSync(`${process.env.FEED_FIXTURES_DIR}/fixture-ids.json`, 'utf8'));
const GAME_SECRET = process.env.GAME_SECRET;
const CRON = process.env.CRON_SECRET;
let passed = 0;
let ipSeq = 1;

async function call(method, path, body, token, extra = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': extra.ip || '10.9.9.9', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(extra.headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text, headers: r.headers };
}
const get = (p, t) => call('GET', p, null, t);
const post = (p, b, t) => call('POST', p, b || {}, t);
const del = (p, t, b) => call('DELETE', p, b, t);
function ok(name, cond, detail) {
  if (!cond) {
    console.error('✗', name, detail !== undefined ? JSON.stringify(detail).slice(0, 800) : '');
    process.exit(1);
  }
  passed++;
  console.log('✓', name);
}
async function rawLogin(email, ref) {
  const ip = `10.0.${Math.floor(ipSeq / 250)}.${ipSeq++ % 250}`;
  const r1 = await call('POST', '/api/auth/otp/request', { email }, null, { ip });
  assert.equal(r1.status, 200, JSON.stringify(r1.json));
  const r2 = await call('POST', '/api/auth/otp/verify', { email, code: r1.json.devCode, ref }, null, { ip });
  assert.equal(r2.status, 200, JSON.stringify(r2.json));
  return { token: r2.json.token, user: r2.json.user, ip };
}
// Fans must pass the Instagram check before playing. Test fans pass it the way a fan would (a code
// commented on the club's pinned post, read from the fake Graph API), with no welcome points so the
// points checks below stay exact. Pass { instagram: false } for a fan who has not done it yet.
let gateReady = null;
const META = process.env.META_COMMENTS_GRAPH_BASE;
let adminSession = null;
async function setupGate() {
  const a = (adminSession = await rawLogin('admin@test.dev'));
  const r = await call('POST', '/api/admin/settings', { instagramWelcomePoints: 0, instagramVerifyPostUrl: 'https://www.instagram.com/p/TESTPOST1/' }, a.token);
  assert.equal(r.status, 200, JSON.stringify(r.json));
}
async function igComment(username, text) {
  await fetch(`${META}/__comment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, text }) });
}
async function verifyInstagram(token, email, ip) {
  const handle = email.split('@')[0].replace(/[^a-z0-9._]/gi, '').toLowerCase().slice(0, 24) + ipSeq;
  const s = await call('POST', '/api/instagram/start', { handle }, token, { ip });
  assert.equal(s.status, 200, JSON.stringify(s.json));
  await igComment(handle, `Go Aces ${s.json.code}`);
  let c;
  for (let i = 0; i < 4; i++) {
    c = await call('POST', '/api/instagram/check', {}, token, { ip });
    if (c.json?.verified) break;
    await new Promise(r => setTimeout(r, 3_100)); // the server reads the comments at most every 3s
  }
  assert.ok(c.json?.verified, JSON.stringify(c.json));
}
async function login(email, ref, opts = {}) {
  if (!gateReady) gateReady = setupGate();
  await gateReady;
  if (email === 'admin@test.dev' && adminSession) {
    const s = adminSession;
    adminSession = null;
    return { token: s.token, user: (await get('/api/me', s.token)).json.user };
  }
  const s = await rawLogin(email, ref);
  if (opts.instagram !== false && s.user.role !== 'admin' && !s.user.instagramFollowed) await verifyInstagram(s.token, email, s.ip);
  return { token: s.token, user: (await get('/api/me', s.token)).json.user };
}
const me = async t => (await get('/api/me', t)).json.user;
const dubaiDay = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
const inMinutes = m => new Date(Date.now() + m * 60_000).toISOString();

// ============ 1. Seeded data is real and complete ============
const teams = (await get('/api/teams')).json.teams;
ok('six franchises are seeded', teams.length === 6);
const NAMES = ['UAE Bulls', 'United Tigers', 'Yas Lions', 'Arabian Aces', 'Emirates Eagles', 'Royal Desert Champions'];
// Emirates Eagles have two places for replacements not yet named in the official list; those are not players.
for (const n of NAMES) ok(`seeded ${n} with its named players`, teams.find(t => t.name === n)?.squad.length === (n === 'Emirates Eagles' ? 16 : 18));
ok('unnamed replacements are not listed as players', !teams.some(t => t.squad.some(p => /replacement|tbc/i.test(p.name))));
ok('every player has a role and credits', teams.every(t => t.squad.every(p => ['batter', 'bowler', 'allrounder', 'wicketkeeper'].includes(p.role) && p.credits >= 7 && p.credits <= 10.5)));
ok('no invented player stats are shipped', teams.every(t => t.squad.every(p => p.stats === undefined)));
ok('icon players cost 10.5 credits', teams.every(t => t.squad.filter(p => p.isIcon).every(p => p.credits === 10.5)));
const bulls = teams.find(t => t.id === 'bulls');
const aces = teams.find(t => t.id === 'aces');
ok('UAE Bulls icon is Kieron Pollard', bulls.iconPlayer === 'Kieron Pollard');
ok('Arabian Aces icon is Moeen Ali, coach Lance Klusener', aces.iconPlayer === 'Moeen Ali' && aces.headCoach === 'Lance Klusener');
ok('team links are https or absent', teams.every(t => !t.website || t.website.startsWith('https://')));

const handles = (await get('/api/handles')).json.handles;
ok('15 checked handles are public', handles.length === 15, handles.length);
ok('every public handle is verified and https', handles.every(h => h.status === 'verified' && /^https:\/\//.test(h.url)));
ok('public handles do not leak sync notes', handles.every(h => h.lastSyncNote === undefined));
const ytHandles = handles.filter(h => h.platform === 'YouTube');
ok('league and Bulls YouTube channels have channel ids for in-site play', ytHandles.length === 2 && ytHandles.every(h => /^UC[\w-]{22}$/.test(h.meta.channelId)));
ok('handles exist only for teams with confirmed accounts', new Set(handles.map(h => h.teamId)).size === 3 && handles.every(h => [null, 'bulls', 'aces'].includes(h.teamId)));
const cfg = (await get('/api/config')).json.config;
ok('config reports season and venue', cfg.seasonLabel && cfg.venue.includes('Zayed'));
ok('fresh store has no fixtures, contests or fake feed items', cfg.stats.matches === 0 && cfg.stats.openContests === 0 && (await get('/api/feeds')).json.items.length === 0);

// ============ 2. Sign-in and security ============
ok('forged Google tokens are rejected', (await post('/api/auth/google', { idToken: 'not-a-real-token' })).status === 401);
ok('bare-email Google sign-in is refused', (await post('/api/auth/google', { email: 'admin@test.dev' })).status === 400);
ok('a user id is not a bearer token', (await get('/api/me', 'usr_123')).json.user === null);
{
  const ip = '10.200.0.1';
  await call('POST', '/api/auth/otp/request', { email: 'wrong@test.dev' }, null, { ip });
  ok('wrong OTP rejected', (await call('POST', '/api/auth/otp/verify', { email: 'wrong@test.dev', code: '000000' }, null, { ip })).status === 400);
  ok('a second code within a minute is refused', (await call('POST', '/api/auth/otp/request', { email: 'wrong@test.dev' }, null, { ip })).status === 429);
  let limited = false;
  for (let i = 0; i < 6; i++) if ((await call('POST', '/api/auth/otp/request', { email: `burst${i}@test.dev` }, null, { ip: '10.201.0.1' })).status === 429) limited = true;
  ok('OTP requests are rate limited per IP', limited);
  let spoof = false;
  for (let i = 0; i < 6; i++) if ((await call('POST', '/api/auth/otp/request', { email: `spoof${i}@test.dev` }, null, { ip: `1.2.3.${i}, 10.202.0.1` })).status === 429) spoof = true;
  ok('a forged X-Forwarded-For prefix does not bypass the rate limit', spoof);
}

const admin = await login('admin@test.dev');
const A = admin.token;
ok('ADMIN_EMAILS user is a super admin', admin.user.role === 'admin' && admin.user.isSuperAdmin === true);
ok('session token is opaque', A !== admin.user.id && A.length >= 40);
const fan1 = await login('fan1@test.dev');
const F1 = fan1.token;
ok('new fan starts with 0 points and no team', fan1.user.points === 0 && fan1.user.teamId === null && fan1.user.role === 'fan');
const dashA = (await get('/api/admin/dashboard', A)).json;
const suggestions = dashA.pendingApprovals.filter(a => a.kind === 'handle');
ok('19 unconfirmed team accounts wait in Approvals', suggestions.length === 19, suggestions.length);
ok('suggested accounts are not shown to fans', (await get('/api/handles')).json.handles.length === 15);
ok('X usernames longer than X allows were not suggested', !suggestions.some(a => /· X @(EmiratesEaglesT10|RoyalChampionsT10)/.test(a.title)));
const lionsX = suggestions.find(a => /Yas Lions · X/.test(a.title));
const lionsIg = suggestions.find(a => /Yas Lions · Instagram/.test(a.title));
await post(`/api/admin/approvals/${lionsX.id}/decide`, { decision: 'approve' }, A);
await post(`/api/admin/approvals/${lionsIg.id}/decide`, { decision: 'reject' }, A);
ok('an approved suggestion becomes a public official account', (await get('/api/handles?teamId=lions')).json.handles.some(h => h.platform === 'X'));
await post('/api/admin/teams/seed-official', { overwrite: false }, A);
ok('a rejected suggestion is not suggested again', !(await get('/api/admin/dashboard', A)).json.pendingApprovals.some(a => /Yas Lions · Instagram/.test(a.title)) && !(await get('/api/handles?teamId=lions', A)).json.handles.some(h => h.platform === 'Instagram'));
ok('fans cannot seed teams', (await post('/api/admin/teams/seed-official', {}, F1)).status === 403);
ok('fans cannot read the confidential proposal', (await get('/api/admin/proposal', F1)).status === 403);
ok('anonymous cannot sync feeds', (await post('/api/admin/feeds/sync')).status === 401);
ok('fans cannot send push notifications', (await post('/api/fcm/send', { title: 'x', body: 'y' }, F1)).status === 403);
ok('fans cannot change settings', (await post('/api/admin/settings', { brandName: 'x' }, F1)).status === 403);
ok('fans cannot open the admin list', (await get('/api/admin/admins', F1)).status === 403);
ok('fans cannot see env variables', (await get('/api/admin/env', F1)).status === 403);
const gm = await post('/api/gemini/chat', { messages: [{ role: 'user', parts: [{ text: 'hi' }] }] }, F1);
ok('AI assistant without a key answers 503, never a canned reply', gm.status === 503 && !gm.json.text);

// ============ 3. Feeds: every team's handles are pulled and playable ============
const sync = (await post('/api/admin/feeds/sync', {}, A)).json;
ok('feed sync pulled YouTube videos from both channels', sync.videoCount === FIX.leagueVideos.length + FIX.bullsVideos.length, sync);
ok('feed sync pulled league X posts and Instagram posts', sync.socialCount === FIX.leagueTweets.length + 2, sync);
ok('news came from Google and the Bing fallback', sync.newsCount === 3, sync);
ok('failed news sources are reported, not filled in', sync.errors.some(e => e.startsWith('News')));
const health = (await get('/api/admin/feeds/health', A)).json.handles;
const hs = (team, platform) => health.find(h => h.teamId === team && h.platform === platform);
ok('league YouTube: ok', hs(null, 'YouTube').lastSyncStatus === 'ok' && hs(null, 'YouTube').items === 3);
ok('Bulls YouTube: ok', hs('bulls', 'YouTube').lastSyncStatus === 'ok' && hs('bulls', 'YouTube').items === 2);
ok('league X: ok', hs(null, 'X').lastSyncStatus === 'ok');
ok('Bulls X refused by X: falls back to the embed', hs('bulls', 'X').lastSyncStatus === 'embed-only' && /429/.test(hs('bulls', 'X').lastSyncNote));
ok('Aces X empty: falls back to the embed', hs('aces', 'X').lastSyncStatus === 'embed-only');
for (const p of ['Threads', 'Facebook', 'TikTok', 'LinkedIn']) ok(`Aces ${p}: shown with its embed or profile card`, hs('aces', p).lastSyncStatus === 'embed-only');
ok('league Instagram: real posts from Meta\'s Business Discovery API', hs(null, 'Instagram').lastSyncStatus === 'ok' && hs(null, 'Instagram').items === 2, hs(null, 'Instagram'));
ok('Bulls Instagram: the API error is shown, nothing is made up', hs('bulls', 'Instagram').lastSyncStatus === 'error' && /Invalid user id/.test(hs('bulls', 'Instagram').lastSyncNote) && hs('bulls', 'Instagram').items === 0);
ok('Instagram errors never reveal the access token', !JSON.stringify(health).includes('test-meta-token'));
const igPosts = (await get('/api/feeds?platform=Instagram')).json.items;
ok('Instagram posts keep the real link, caption, date and likes', igPosts.length === 2 && igPosts.some(i => i.url === 'https://www.instagram.com/reel/TESTig00002/' && i.kind === 'video' && i.publishedAt.startsWith('2026-10-11')) && igPosts.some(i => i.likes === 321 && i.title === '[test] Draft night recap'));
const videos = (await get('/api/feeds?kind=video')).json.items;
ok('videos have a playable YouTube id and thumbnail', videos.filter(v => v.platform === 'YouTube').length === 5 && videos.filter(v => v.platform === 'YouTube').every(v => /^[\w-]{11}$/.test(v.videoId) && v.image.startsWith('https://')));
ok('Bulls videos are tagged to the Bulls', (await get('/api/feeds?teamId=bulls&kind=video')).json.items.length === 2);
const all = (await get('/api/feeds?limit=100')).json;
ok('every feed item links to its real source over https', all.items.every(i => /^https:\/\//.test(i.url)));
ok('no placeholder or stock content in feeds', all.items.every(i => !/dQw4w9WgXcQ|unsplash|dicebear|picsum/.test(JSON.stringify(i))));
ok('HTML entities in posts are decoded', all.items.filter(i => i.platform === 'X').every(i => i.summary.includes('& friends') && !i.summary.includes('t.co')));
const page1 = (await get('/api/feeds?limit=2')).json;
const page2 = (await get(`/api/feeds?limit=2&before=${encodeURIComponent(page1.items[1].publishedAt)}`)).json;
ok('feeds page with "before"', page1.hasMore && page2.items.length > 0 && !page2.items.some(i => page1.items.some(j => j.id === i.id)));
ok('syncing again adds nothing new', (await post('/api/admin/feeds/sync', {}, A)).json.added === 0);

// Social harvester: AI search suggests links; only posts the platform confirms are kept.
const noKey = await post('/api/admin/feeds/harvest', {}, A);
ok('without a Gemini key the harvester says what it needs', /Gemini API key/.test(noKey.json.summary));
await post('/api/admin/env', { overrides: { GEMINI_API_KEY: 'harvest-test-key' } }, A);
const harvest = await post('/api/admin/feeds/harvest', {}, A);
ok('harvester keeps only the 2 confirmed posts out of 6 suggestions', harvest.json.items === 2 && /4 of 6 search result\(s\) dropped/.test(harvest.json.summary), harvest.json);
ok('harvester explains why links were dropped', /another account posted it/.test(harvest.json.summary) && /not an official account/.test(harvest.json.summary) && /could not confirm/.test(harvest.json.summary) && /not accepted from search/.test(harvest.json.summary));
const found = (await get('/api/feeds?limit=100', A)).json.items.filter(i => i.sourceType === 'discovery');
const xFound = found.find(i => i.platform === 'X');
ok('confirmed X post uses the text and date from X, never the AI\'s', xFound && xFound.title === '[test] Confirmed post & real text from X' && xFound.publishedAt.startsWith('2026-10-12') && xFound.source === '@T10League');
const ttFound = found.find(i => i.platform === 'TikTok');
ok('confirmed TikTok video has its thumbnail and the date encoded in its id', ttFound && ttFound.title === '[test] TikTok video confirmed' && ttFound.image.startsWith('https://') && /^20\d\d-/.test(ttFound.publishedAt));
ok('invented and unofficial links were not stored', !(await get('/api/feeds?limit=100', A)).json.items.some(i => /1990000000000000003|RandomFanPage|MadeUp123/.test(i.url)));
ok('harvesting again keeps the posts without duplicates', (await post('/api/admin/feeds/harvest', {}, A)).json.items === 0 && (await get('/api/feeds?limit=100', A)).json.items.filter(i => i.sourceType === 'discovery').length === 2);
await post('/api/admin/env', { overrides: { GEMINI_API_KEY: '' } }, A);

// Feed address (RSS bridge) on any account, and the public team refresh button.
ok('a feed address must be https', (await post('/api/handles', { id: handles.find(h => h.teamId === 'aces' && h.platform === 'TikTok').id, platform: 'TikTok', url: 'https://www.tiktok.com/@arabianaces', teamId: 'aces', feedUrl: 'http://insecure.test/feed' }, A)).status === 400);
const pub1 = await call('POST', '/api/feeds/pull', { teamId: 'bulls' }, null, { ip: '10.77.0.1' });
ok('visitors cannot refresh a team that was pulled minutes ago', pub1.status === 200 && pub1.json.skipped === true);
ok('visitors cannot start a full pull of every account', (await call('POST', '/api/feeds/pull', {}, null, { ip: '10.77.0.2' })).status === 400);
ok('the feed webhook is off without its own key', (await post('/api/feeds/webhook', { url: 'https://example.test/spam' })).status === 503);
await post('/api/admin/env', { overrides: { FEED_WEBHOOK_SECRET: 'hook-key-123456' } }, A);
ok('the feed webhook refuses a wrong key', (await call('POST', '/api/feeds/webhook', { url: 'https://example.test/spam' }, null, { headers: { 'X-Webhook-Secret': 'nope' } })).status === 401);
await post('/api/admin/env', { overrides: { FEED_WEBHOOK_SECRET: '' } }, A);
const link = await post('/api/admin/feeds/from-link', { url: `https://youtu.be/${FIX.oembedVideo}` }, A);
ok('admin adds a video by link; title comes from oEmbed', link.status === 200 && link.json.item.title.includes('added by link') && link.json.item.videoId === FIX.oembedVideo);
ok('a link with no readable title needs one typed in', (await post('/api/admin/feeds/from-link', { url: 'https://www.tiktok.com/@abudhabit10/video/7400000000000000000' }, A)).status === 400);
ok('adding a non-X link as an X handle is refused', (await post('/api/handles', { platform: 'X', url: 'https://example.com/T10League' }, A)).status === 400);
const addH = await post('/api/handles', { platform: 'YouTube', url: 'https://www.youtube.com/@NoSuchTestChannel', teamId: 'lions' }, A);
ok('adding a handle pulls it at once and reports failure honestly', addH.status === 200 && addH.json.sync?.status === 'error');
const delH = await del(`/api/handles/${addH.json.handle.id}`, A);
ok('removing a handle works', delH.status === 200);
const bullsYt = handles.find(h => h.teamId === 'bulls' && h.platform === 'YouTube');
const purge = await del(`/api/handles/${bullsYt.id}`, A);
ok('removing a handle purges its pulled items', purge.json.purged === 2);
await post('/api/admin/teams/seed-official', { overwrite: false }, A);
ok('a removed official handle is not re-added by seeding', !(await get('/api/handles')).json.handles.some(h => h.id === bullsYt.id || (h.teamId === 'bulls' && h.platform === 'YouTube')));
const readd = await post('/api/handles', { platform: 'YouTube', url: bullsYt.url, teamId: 'bulls', handle: '@BullsT10' }, A);
ok('admin can add it back', readd.status === 200);
ok('re-added official handle keeps its known channel id and pulls at once', readd.json.sync?.status === 'ok' && readd.json.sync.items === 2, readd.json.sync);

// ============ 4. Fan profile, team, referral ============
ok('profile rejects non-https avatar', (await post('/api/me/profile/update', { avatar: 'http://x.test/a.png' }, F1)).status === 400);
ok('profile update with country', (await post('/api/me/profile/update', { name: 'Fan One', country: 'United Arab Emirates', city: 'Abu Dhabi' }, F1)).json.user.country === 'United Arab Emirates');
ok('pick a team', (await post('/api/me/team', { teamId: 'bulls' }, F1)).json.user.teamId === 'bulls');
ok('switch team once', (await post('/api/me/team', { teamId: 'aces' }, F1)).json.user.teamId === 'aces');
ok('second switch is refused', (await post('/api/me/team', { teamId: 'lions' }, F1)).status === 409);
await post('/api/me/team', { teamId: 'aces' }, F1);
const ci = await post('/api/checkin', {}, F1);
ok('daily check-in gives 10 points', ci.json.pointsAdded === 10);
ok('second check-in same day refused', (await post('/api/checkin', {}, F1)).status === 400);
const ref = (await get('/api/me/referral', F1)).json;
ok('fan gets an invite code', /^[A-Z0-9]{6}$/.test(ref.code) && ref.rewardPoints === 50);
const fan2 = await login('fan2@test.dev', ref.code);
const F2 = fan2.token;
await post('/api/me/team', { teamId: 'bulls' }, F2);
ok('signing up through an invite pays nothing yet', (await me(F2)).points === 0 && (await get('/api/me/referral', F1)).json.invited === 1);
const fan3 = await login('fan3@test.dev');
const F3 = fan3.token;
await post('/api/me/team', { teamId: 'bulls' }, F3);
const fan4 = await login('fan4@test.dev');
const F4 = fan4.token;
await post('/api/me/team', { teamId: 'lions' }, F4);

// ============ 5. Matches, contests, Dream XI, scoring ============
ok('match needs real teams', (await post('/api/matches', { teamA: 'bulls', teamB: 'nope', startsAt: inMinutes(600) }, A)).status === 400);
ok('stream link must be https', (await post('/api/matches', { teamA: 'bulls', teamB: 'aces', startsAt: inMinutes(600), streamUrl: 'http://x' }, A)).status === 400);
const m1 = (await post('/api/matches', { teamA: 'bulls', teamB: 'aces', startsAt: inMinutes(24 * 60), stage: 'Group stage' }, A)).json.targetMatch;
ok('admin creates a fixture at the default venue', m1.venue.includes('Zayed') && m1.status === 'upcoming');

// Games for a match open at midnight in Abu Dhabi on the day before match day.
const later = (await post('/api/matches', { teamA: 'lions', teamB: 'tigers', startsAt: inMinutes(4 * 24 * 60) }, A)).json.targetMatch;
const laterDay = new Date(later.startsAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
const expectOpen = new Date(Date.parse(`${laterDay}T00:00:00+04:00`) - 86400000).toISOString();
const hubNow = (await get('/api/fantasy')).json.matches;
ok('a match four days away is not open yet, and says when it opens', hubNow.find(x => x.matchId === later.matchId || x.matchId === later.id)?.open === false && hubNow.find(x => x.matchId === later.id)?.opensAt === expectOpen, hubNow.find(x => x.matchId === later.id));
ok('tomorrow\'s match is open', hubNow.find(x => x.matchId === m1.id)?.open === true);
ok('no predictions for a match that is not open yet', !(await get('/api/contests')).json.contests.some(c => c.id === `auto-${later.id}`));
const auto1 = (await get('/api/contests', F1)).json.contests.find(c => c.id === `auto-${m1.id}`);
ok('every open match gets five match predictions, locking at the first ball', auto1?.questions.length === 5 && auto1.locksAt === m1.startsAt && auto1.auto === true, auto1);
ok('match predictions hide their answers', auto1.questions.every(q => q.answer === undefined));
const autoPicks = { winner: 'UAE Bulls', 'top-total': '110–129', sixes: '0–9', 'more-sixes': 'UAE Bulls', fifty: 'No' };
const P8 = (await login('predict8@test.dev')).token;
const P9 = (await login('predict9@test.dev')).token;
ok('fan enters match predictions', (await post(`/api/contests/${auto1.id}/enter`, { answers: autoPicks }, P8)).status === 200);
ok('another fan enters match predictions', (await post(`/api/contests/${auto1.id}/enter`, { answers: { ...autoPicks, winner: 'Arabian Aces', fifty: 'Yes' } }, P9)).status === 200);
const p8PredBefore = (await me(P8)).points;
const p9PredBefore = (await me(P9)).points;

const contest = (await post('/api/admin/contests', { title: 'Match predictor', matchId: m1.id, prize: 'Signed bat', questions: [{ prompt: 'Who wins?', options: ['UAE Bulls', 'Arabian Aces'], points: 50 }, { prompt: 'Over 20 sixes?', options: ['Yes', 'No'], points: 25 }] }, A)).json.contest;
ok('contest locks at the match start', contest.locksAt === m1.startsAt);
const pubC = (await get('/api/contests', F1)).json.contests.find(c => c.id === contest.id);
ok('fans never see answers before settlement', pubC.questions.every(q => q.answer === undefined));
const [q1, q2] = contest.questions;
ok('must answer every question', (await post(`/api/contests/${contest.id}/enter`, { answers: { [q1.id]: 'UAE Bulls' } }, F1)).status === 400);
ok('answers must be one of the options', (await post(`/api/contests/${contest.id}/enter`, { answers: { [q1.id]: 'Mumbai', [q2.id]: 'Yes' } }, F1)).status === 400);
ok('fan1 enters', (await post(`/api/contests/${contest.id}/enter`, { answers: { [q1.id]: 'UAE Bulls', [q2.id]: 'Yes' } }, F1)).status === 200);
const f2Before = (await me(F1)).points;
const enter2 = await post(`/api/contests/${contest.id}/enter`, { answers: { [q1.id]: 'Arabian Aces', [q2.id]: 'Yes' } }, F2);
ok('invited fan taking part pays the referral reward to both', enter2.json.referralReward === 50 && (await me(F2)).points === 50 && (await me(F1)).points === f2Before + 50);
ok('referral reward is paid only once', (await post(`/api/contests/${contest.id}/enter`, { answers: { [q1.id]: 'Arabian Aces', [q2.id]: 'No' } }, F2)).json.referralReward === undefined);
ok('referral summary shows it', (await get('/api/me/referral', F1)).json.joinedAndPlayed === 1);

const quiz = (await post('/api/admin/contests', { title: 'T10 trivia', type: 'trivia', instant: true, questions: [{ prompt: 'How many overs a side?', options: ['10', '20'], answer: '10', points: 20, explain: 'T10 is ten overs.' }] }, A)).json.contest;
const qa = await post(`/api/contests/${quiz.id}/enter`, { answers: { [quiz.questions[0].id]: '10' } }, F3);
ok('instant quiz scores at once and marks the answer right', qa.json.pointsAwarded === 20 && qa.json.results[0].correct === true);
ok('an open quiz never reveals its answers (a second account could collect them)', qa.json.results[0].answer === undefined && qa.json.results[0].explain === undefined && (await get('/api/contests', F1)).json.contests.find(c => c.id === quiz.id).questions.every(q => q.answer === undefined));
ok('instant quiz can be played once', (await post(`/api/contests/${quiz.id}/enter`, { answers: { [quiz.questions[0].id]: '10' } }, F3)).status === 400);
ok('instant quiz needs answers', (await post('/api/admin/contests', { title: 'x', instant: true, questions: [{ prompt: 'q?', options: ['a', 'b'] }] }, A)).status === 400);

// Dream XI
const rules = (await get('/api/fantasy/rules')).json.rules;
ok('Dream XI rules: 11 players, 100 credits, max 7 per team', rules.size === 11 && rules.creditCap === 100 && rules.maxFromOneTeam === 7);
const pool = (await get(`/api/fantasy/${m1.id}`)).json.pool;
ok('lineup pool is the two squads (36 players) with credits', pool.length === 36 && pool.every(p => p.credits > 0));
const byName = n => pool.find(p => p.name === n);
const XI = ['Max Bryant', 'Muhammad Rohid', 'Aneurin Donald', 'Khushdil Shah', 'Muhammad Amir', 'Moeen Ali', 'Amshi de Silva', 'Ibrahim Masood', 'Muhammad Arfan', 'Sam Billings', 'Paul Walter'].map(n => byName(n).id);
const [maxB, matiullah] = [byName('Max Bryant').id, byName('Muhammad Rohid').id];
const save = (t, ids, c, vc, m = m1) => post(`/api/fantasy/${m.id}`, { playerIds: ids, captainId: c, viceCaptainId: vc }, t);
ok('10 players refused', (await save(F1, XI.slice(0, 10), maxB, matiullah)).status === 400);
ok('captain must be in the XI', (await save(F1, XI, byName('Kieron Pollard').id, matiullah)).status === 400);
ok('captain and vice-captain must differ', (await save(F1, XI, maxB, maxB)).status === 400);
const eightBulls = pool.filter(p => p.teamId === 'bulls').slice(0, 8).map(p => p.id).concat(pool.filter(p => p.teamId === 'aces' && p.role === 'bowler').slice(0, 3).map(p => p.id));
ok('more than 7 from one team refused', /at most 7/.test((await save(F1, eightBulls, eightBulls[0], eightBulls[1])).json.error));
const pricey = pool.filter(p => p.credits >= 10).map(p => p.id);
const tooRich = [...pricey, ...pool.filter(p => !pricey.includes(p.id)).slice(0, 11 - pricey.length).map(p => p.id)];
const richRes = await save(F1, tooRich, tooRich[0], tooRich[1]);
ok('lineups over budget or breaking role limits are refused', richRes.status === 400);
const s1 = await save(F1, XI, maxB, matiullah);
const xiCredits = Math.round(XI.reduce((sum, id) => sum + pool.find(p => p.id === id).credits, 0) * 10) / 10;
ok('valid Dream XI saved with credits used', s1.status === 200 && s1.json.credits === xiCredits && xiCredits <= 100, { credits: s1.json.credits, xiCredits });
ok('fan2 saves a lineup', (await save(F2, XI, byName('Ibrahim Masood').id, byName('Amshi de Silva').id)).status === 200);
ok('anonymous cannot save a lineup', (await save(null, XI, maxB, matiullah)).status === 401);
ok('selected-by percentage shows', (await get(`/api/fantasy/${m1.id}`)).json.pool.find(p => p.id === maxB).selectedBy === 100);

// Squad edits that would break saved lineups need confirmation (on a scratch copy of the Aces squad).
const acesSquad = (await get('/api/teams')).json.teams.find(t => t.id === 'aces').squad;
const conflict = await post('/api/teams/aces/squad', { squad: acesSquad.filter(p => p.name !== 'Moeen Ali') }, A);
ok('removing a picked player asks for confirmation', conflict.status === 400 || conflict.status === 409);
ok('credit override is validated', (await post('/api/teams/aces/squad', { squad: acesSquad.map(p => (p.name === 'Paul Walter' ? { ...p, credits: 99 } : p)) }, A)).status === 400);

// Complete the match with a scorecard; check points by hand.
const card = (maxRuns, maxBalls, fours, sixes) => ({
  innings1: { teamId: 'bulls', totalRuns: 120, wickets: 4, overs: '10', batting: [{ batsman: 'Max Bryant', dismissal: 'c Moeen Ali b Amshi de Silva', runs: maxRuns, balls: maxBalls, fours, sixes }], bowling: [{ bowler: 'Amshi de Silva', overs: '2', maidens: 0, runs: 18, wickets: 1 }] },
  innings2: { teamId: 'aces', totalRuns: 100, wickets: 7, overs: '10', batting: [{ batsman: 'Ibrahim Masood', dismissal: 'b Muhammad Rohid', runs: 0, balls: 2 }], bowling: [{ bowler: 'Muhammad Rohid', overs: '2', maidens: 1, runs: 9, wickets: 3 }] },
});
const p1Before = (await me(F1)).points;
const done = await post('/api/matches', { id: m1.id, status: 'completed', winner: 'bulls', result: 'UAE Bulls won by 20 runs', scoreA: '120/4', scoreB: '100/7', scorecard: card(40, 18, 4, 2) }, A);
ok('completing a match sends the result and scores Dream XI', done.json.notification?.category === 'match_result' && done.json.fantasy?.scored === 2, done.json);
ok('match predictions settle from the scorecard', done.json.predictions?.settled === true, done.json.predictions);
const autoDone = (await get('/api/contests', P8)).json.contests.find(c => c.id === `auto-${m1.id}`);
ok('settled predictions show the answers the scorecard gave', autoDone.status === 'settled' && autoDone.questions.map(q => q.answer).join('|') === 'UAE Bulls|110–129|0–9|UAE Bulls|No', autoDone.questions.map(q => q.answer));
ok('all five right: 70 points', (await me(P8)).points - p8PredBefore === 70);
ok('three right: 40 points', (await me(P9)).points - p9PredBefore === 40);
const myFt = (await get(`/api/fantasy/${m1.id}`, F1)).json.fantasyTeam;
const line = id => myFt.breakdown.find(b => b.playerId === id);
// Points follow the published rules (GET /api/fantasy/rules): playing 20, run 2, four +2, six +5,
// 30-run bonus 16, wicket 35, 3-wicket bonus 32, maiden 32, bowled/LBW 12, catch 12, duck -4,
// strike rate above 200 +12, below 60 -8, economy under 7 +12, 8.51-10 +4.
const rulesTable = (await get('/api/fantasy/rules')).json.scoring;
const ruleValue = label => rulesTable.flatMap(g => g.rules).find(r => r[0] === label)?.[1];
ok('published rules list the strike-rate and economy bands used for scoring', ruleValue('Above 200.0') === 12 && ruleValue('Under 7.0 runs per over') === 12 && ruleValue('Below 60.0') === -8);
// Max Bryant: 40 runs 80 + 4 fours 8 + 2 sixes 10 + 30 bonus 16 + strike rate 222 (+12) + playing 20 = 146, captain x2
ok('batting points: 146 doubled for the captain', line(maxB).base === 146 && line(maxB).total === 292, line(maxB));
// Muhammad Rohid: 3 wickets 105 + 3-wicket bonus 32 + maiden 32 + economy 4.5 (+12) + bowled bonus 12 + playing 20 = 213, x1.5
ok('bowling points: 213 x1.5 for the vice-captain', line(matiullah).base === 213 && line(matiullah).total === 319.5, line(matiullah));
ok('catch earns fielding and playing points (12 + 20)', line(byName('Moeen Ali').id).base === 32);
ok('wicket, economy 9.0 and playing points (35 + 4 + 20)', line(byName('Amshi de Silva').id).base === 59);
ok('duck costs a batter 4 (20 - 4 = 16)', line(byName('Ibrahim Masood').id).base === 16);
ok('players who did not play score 0', line(byName('Paul Walter').id).base === 0);
ok('lineup total 718.5, ranked 1st', myFt.points === 718.5 && myFt.rank === 1, myFt.points);
ok('fan gets total/5 = 144 season points', (await me(F1)).points === p1Before + 144);
const lb = (await get(`/api/fantasy/leaderboard?matchId=${m1.id}`)).json.rows;
// Fan 2: Ibrahim Masood 16 x2 + Amshi de Silva 59 x1.5 + 146 + 213 + 32 = 511.5
ok('match leaderboard ranks both lineups', lb.length === 2 && lb[0].userId === fan1.user.id && lb[1].points === 511.5, lb.map(r => r.points));
ok('locked lineups cannot change', (await save(F1, XI, matiullah, maxB)).status === 400);
const md = (await get(`/api/matches/${m1.id}`)).json;
ok('match page shows fantasy points and most-picked players', md.fantasy.playerPoints[0].name === 'Muhammad Rohid' && md.fantasy.mostPicked.length === 5);
const p1Mid = (await me(F1)).points;
await post('/api/matches', { id: m1.id, scorecard: card(10, 18, 0, 0) }, A);
// Corrected: Max Bryant 10 runs 20, strike rate 55 (-8), playing 20 = 32 -> x2 64 -> lineup 490.5 -> 98 season points
const fixed = (await get(`/api/fantasy/${m1.id}`, F1)).json.fantasyTeam;
ok('scorecard correction re-scores the lineup', fixed.points === 490.5, fixed.points);
ok('re-scoring reverses the old award first (144 -> 98)', (await me(F1)).points === p1Mid - 46);
const res2 = await post(`/api/admin/fantasy/${m1.id}/score`, {}, A);
ok('admin re-score is idempotent', res2.json.scored === 2 && (await me(F1)).points === p1Mid - 46);
const n1 = (await get('/api/notifications', F1)).json.notifications;
ok('fan gets a personal Dream XI result', n1.some(n => n.category === 'fantasy' && /you finished #1 of 2/.test(n.body)));
ok('result notification is sent once', n1.filter(n => n.category === 'match_result').length === 1);
ok('other fans do not see personal results', !(await get('/api/notifications', F4)).json.notifications.some(n => n.category === 'fantasy'));
ok('anonymous visitors only see public notifications', (await get('/api/notifications')).json.notifications.every(n => n.category !== 'fantasy'));
const lgs = (await get('/api/fantasy/leaderboard')).json.rows;
ok('season Dream XI leaderboard', lgs[0].userId === fan1.user.id && lgs[0].matches === 1);
// Player links: found by joining ids (Cricbuzz -> Cricsheet -> ESPNcricinfo -> Wikidata), never by name.
const resolved = await post('/api/admin/players/links/resolve', { all: true }, A);
ok('player links lookup runs for every player', resolved.status === 200 && resolved.json.checked === 106, resolved.json);
const pollard = (await get('/api/players/bulls-kieron-pollard')).json;
const linkOf = (pp, key) => pp.links.find(l => l.key === key)?.url;
ok('ESPNcricinfo link from the Cricsheet register', linkOf(pollard, 'espncricinfo') === 'https://www.espncricinfo.com/cricketers/kieron-pollard-230559', pollard.links);
ok('Wikipedia and official social accounts from Wikidata', linkOf(pollard, 'wikipedia') === 'https://en.wikipedia.org/wiki/Kieron_Pollard' && linkOf(pollard, 'instagram') === 'https://www.instagram.com/test_pollard_ig/' && linkOf(pollard, 'x') === 'https://x.com/test_pollard_x');
ok('social link shows the handle', pollard.links.find(l => l.key === 'x').handle === '@test_pollard_x');
ok('TikTok and Threads accounts from Wikidata, with handles', linkOf(pollard, 'tiktok') === 'https://www.tiktok.com/@test_pollard_tt' && pollard.links.find(l => l.key === 'threads')?.handle === '@test_pollard_th', pollard.links);
const bryant = (await get(`/api/players/${maxB}`)).json;
ok('an id that maps to another name is refused (no ESPNcricinfo link)', !linkOf(bryant, 'espncricinfo') && /cricbuzz\.com\/profiles\/13120/.test(linkOf(bryant, 'cricbuzz') || ''), bryant.links);
// An admin's own link is kept when the lookup runs again.
const bullsSquad = (await get('/api/teams')).json.teams.find(t => t.id === 'bulls').squad;
const withAdminLink = bullsSquad.map(p => (p.id === 'bulls-kieron-pollard' ? { ...p, links: { ...p.links, instagram: 'https://www.instagram.com/admin_set_handle/' } } : p));
ok('admin can set a player link', (await post('/api/teams/bulls/squad', { squad: withAdminLink, confirm: true }, A)).status === 200);
ok('a link to the wrong site is refused', (await post('/api/teams/bulls/squad', { squad: bullsSquad.map(p => (p.id === 'bulls-kieron-pollard' ? { ...p, links: { instagram: 'https://evil.example/x' } } : p)), confirm: true }, A)).status === 400);
await post('/api/admin/players/links/resolve', { all: true }, A);
ok("the lookup never replaces an admin's link", linkOf((await get('/api/players/bulls-kieron-pollard')).json, 'instagram') === 'https://www.instagram.com/admin_set_handle/');
// Career records from CricketData.org: exact name (narrowed by country), padded values cleaned, unplayed formats dropped.
const car = await post('/api/admin/players/career/refresh', { playerId: 'bulls-kieron-pollard' }, A);
ok('career stats fetch for a player', car.status === 200 && car.json.found === 1, car.json);
const pc = (await get('/api/players/bulls-kieron-pollard')).json.career;
ok('career record lists T20I then IPL, without formats never played', pc?.formats.map(f => f.label).join(',') === 'T20I,IPL', pc);
ok('career figures are cleaned', pc.formats[0].batting.runs === '1569' && pc.formats[0].batting.hs === '75*' && pc.formats[1].bowling.wkts === '69');
const carB = await post('/api/admin/players/career/refresh', { playerId: maxB }, A);
ok('two players with the same name and country give no record', carB.json.found === 0 && (await get(`/api/players/${maxB}`)).json.career === null, carB.json);
ok('career refresh needs an admin', (await post('/api/admin/players/career/refresh', { playerId: maxB }, F1)).status === 403);
const ssrPollard = await fetch(`${BASE}/players/bulls-kieron-pollard`).then(r => r.text());
ok('player page renders the career record for search engines', /<h2>Career record<\/h2>[\s\S]*T20I[\s\S]*1569/.test(ssrPollard));
ok('player page no longer lists fixtures', !/fixtures<\/h2>/i.test(ssrPollard.split('<body')[1] || ''));
const playerPage = (await get(`/api/players/${maxB}`)).json;
ok('player page shows fantasy points per match', playerPage.fixtures[0].fantasyPoints === 32 && playerPage.player.credits === 8, { pts: playerPage.fixtures[0].fantasyPoints, credits: playerPage.player.credits });

// Settle the contest
const settle = await post(`/api/admin/contests/${contest.id}/settle`, { answers: { [q1.id]: 'UAE Bulls', [q2.id]: 'No' } }, A);
ok('contest settles with points', settle.json.settledEntriesCount === 2 && settle.json.totalPointsDistributed === 75);
ok('entrants get a personal contest result', (await get('/api/notifications', F1)).json.notifications.some(n => /You scored 50 points/.test(n.body)));
ok('settled contest cannot be deleted', (await del(`/api/admin/contests/${contest.id}`, A)).status === 409);

// Private leagues
const lg = (await post('/api/fantasy-leagues', { name: 'Office league' }, F1)).json.league;
ok('create a private league with a code', /^[A-Z0-9]{6}$/.test(lg.code));
ok('unknown code refused', (await post('/api/fantasy-leagues/join', { code: 'ZZZZZZ' }, F2)).status === 404);
ok('friend joins with the code', (await post('/api/fantasy-leagues/join', { code: lg.code.toLowerCase() }, F2)).status === 200);
const myLeagues = (await get('/api/fantasy-leagues', F2)).json.leagues;
ok('league table ranks members by Dream XI points', myLeagues[0].members.length === 2 && myLeagues[0].members[0].userId === fan1.user.id);
ok('leave league', (await post(`/api/fantasy-leagues/${lg.id}/leave`, {}, F2)).status === 200);

// Live scores from CricketData (fixtures)
const cands = await get('/api/admin/cricketdata/matches', A);
ok('CricketData candidates list only this league\'s matches', cands.json.matches.length === 1 && cands.json.matches[0].id === FIX.cricketMatchId);
const m2 = (await post('/api/matches', { teamA: 'bulls', teamB: 'aces', startsAt: inMinutes(23 * 60), externalId: FIX.cricketMatchId }, A)).json.targetMatch;
ok('fan3 saves a lineup for the linked match', (await save(F3, XI, maxB, matiullah, m2)).status === 200);
const live = await post(`/api/admin/matches/${m2.id}/live-sync`, {}, A);
ok('live sync applies the result and scorecard', live.status === 200 && live.json.match.status === 'completed' && live.json.match.winner === 'bulls' && live.json.match.scoreA === '121/4' && live.json.match.scoreSource === 'cricketdata', live.json);
ok('live sync scores Dream XI when the match ends', live.json.fantasy?.scored === 1 && (await get(`/api/fantasy/${m2.id}`, F3)).json.fantasyTeam.points > 0);
ok('live sync derives top scorer and sixes', /Max Bryant 44/.test(live.json.match.topScorer) && live.json.match.totalSixes === 5);

// ============ 6. Scheduled jobs: lock reminders ============
const m3 = (await post('/api/matches', { teamA: 'lions', teamB: 'eagles', startsAt: inMinutes(20) }, A)).json.targetMatch;
const lions = teams.find(t => t.id === 'lions');
const eagles = teams.find(t => t.id === 'eagles');
const pickBalanced = () => {
  const p = [...lions.squad, ...eagles.squad];
  const out = [];
  for (const role of ['wicketkeeper', 'batter', 'allrounder', 'bowler']) out.push(p.filter(x => x.role === role && x.credits <= 9)[out.length % 2]);
  for (const x of p.filter(x => x.credits <= 9)) {
    if (out.length >= 11) break;
    if (out.includes(x)) continue;
    if (out.filter(o => o.role === x.role).length >= 6) continue;
    if (out.filter(o => o.teamId === x.teamId).length >= 7) continue;
    out.push(x);
  }
  return out.map(x => x.id);
};
const xi3 = pickBalanced();
const s3 = await save(F4, xi3, xi3[0], xi3[1], m3);
ok('lineup saved for a match starting soon', s3.status === 200, s3.json);
const cron1 = await call('GET', '/api/cron/run?only=reminders', null, null, { headers: { Authorization: `Bearer ${CRON}` } });
ok('cron sends one lock reminder', cron1.status === 200 && cron1.json.jobs.reminders.lockReminders === 1, cron1.json);
const cron2 = await call('POST', '/api/cron/run?only=reminders', null, null, { headers: { Authorization: `Bearer ${CRON}` } });
ok('lock reminder is not repeated', cron2.json.jobs.reminders.lockReminders === 0);
const remF4 = (await get('/api/notifications', F4)).json.notifications.find(n => n.data?.matchId === m3.id);
const remF2 = (await get('/api/notifications', F2)).json.notifications.find(n => n.data?.matchId === m3.id);
ok('fans with a lineup get "your Dream XI is in"', /Your Pick XI is in/.test(remF4?.body));
ok('fans without one get "pick 11 players"', /Pick 11 players/.test(remF2?.body));
const cron3 = await call('POST', '/api/cron/run', null, null, { headers: { Authorization: `Bearer ${CRON}` } });
ok('full cron run pulls feeds and checks fixtures', cron3.json.jobs.feeds && cron3.json.jobs.scores && cron3.json.jobs.checks !== undefined, cron3.json);
ok('feeds are not pulled again before they are due', (await call('POST', '/api/cron/run', null, null, { headers: { Authorization: `Bearer ${CRON}` } })).json.jobs.feeds.skipped);
const anonCron = await get('/api/cron/run');
ok('without the secret, the cron only runs when jobs are due (not again right after a run)', anonCron.status === 200 && anonCron.json.ran === false && anonCron.json.reason === 'ran recently' && !anonCron.json.jobs, anonCron.json);
ok('a wrong secret gets the same limited run', (await call('GET', '/api/cron/run', null, null, { headers: { Authorization: 'Bearer nope' } })).json.ran === false);
const forced = await call('POST', '/api/cron/run', null, A);
ok('a super admin can force a run', forced.json.ran === true && forced.json.jobs);

// ============ 7. Daily games ============
const today = (await get('/api/games/today', F3)).json;
ok('games use the Dubai day', today.day === dubaiDay());
ok('one clue before the first guess, no answer', today.guess.clues.length === 1 && today.guess.answer === null);
const everyone = (await get('/api/teams')).json.teams.flatMap(t => t.squad).sort((a, b) => a.id.localeCompare(b.id));
const h = crypto.createHmac('sha256', GAME_SECRET).update(`guess:${today.day}`).digest();
const target = everyone[Math.floor((h.readUInt32BE(0) / 0x100000000) * everyone.length)];
const wrongP = everyone.find(p => p.id !== target.id);
const g1 = await post('/api/games/guess', { playerId: wrongP.id }, F3);
ok('wrong guess reveals another clue and same-team/role hints', g1.json.guess.clues.length === 2 && g1.json.guess.guesses[0].correct === false && typeof g1.json.guess.guesses[0].sameTeam === 'boolean');
ok('same player cannot be guessed twice', (await post('/api/games/guess', { playerId: wrongP.id }, F3)).status === 400);
const g3pts = (await me(F3)).points;
const g2 = await post('/api/games/guess', { playerId: target.id }, F3);
ok('solved on the 2nd guess earns 40 points', g2.json.guess.solved && g2.json.guess.points === 40 && (await me(F3)).points === g3pts + 40);
ok('answer revealed after solving', g2.json.guess.answer.id === target.id);
ok('only one game a day', (await post('/api/games/guess', { playerId: target.id }, F3)).status === 400);
ok('guess needs sign-in', (await post('/api/games/guess', { playerId: target.id })).status === 401);
let so;
for (let i = 0; i < 6; i++) {
  so = (await post('/api/games/superover', { shot: 'loft' }, F3)).json.superOver;
  if (so.finished) break;
}
ok('super over ends after 6 balls or 2 wickets', so.finished && (so.balls.length === 6 || so.wickets === 2));
ok('super over points = runs (+15 if target reached)', so.points === so.runs + (so.runs >= so.target ? 15 : 0) && so.target >= 12 && so.target <= 24);
ok('super over once a day', (await post('/api/games/superover', { shot: 'defend' }, F3)).status === 400);
ok('invalid shot refused', (await post('/api/games/superover', { shot: 'switch-hit' }, F4)).status === 400);
ok('daily leaderboards list finishers', (await get('/api/games/today')).json.leaderboards.guess[0].userId === fan3.user.id);

// ============ 8. Prizes and draws ============
ok('prize needs fulfilment details', (await post('/api/admin/prizes', { title: 'Cap', pointsCost: 10, stock: 1 }, A)).status === 400);
const prize = (await post('/api/admin/prizes', { title: 'Signed cap', pointsCost: 50, stock: 1, fulfilment: 'Collect at the Fan Zone desk' }, A)).json.prize;
const bal1 = (await get('/api/prizes', F1)).json.balance;
const red = await post(`/api/prizes/${prize.id}/redeem`, {}, F1);
ok('fan claims a prize and gets a code', red.status === 200 && /^[A-Z0-9]{8}$/.test(red.json.redemption.code));
ok('spending lowers the balance, not the leaderboard score', (await get('/api/prizes', F1)).json.balance === bal1 - 50 && (await me(F1)).pointsSpent === 50);
ok('out of stock', (await post(`/api/prizes/${prize.id}/redeem`, {}, F2)).status === 409);
ok('cannot delete a prize with pending claims', (await del(`/api/admin/prizes/${prize.id}`, A)).status === 409);
await post(`/api/admin/redemptions/${red.json.redemption.id}`, { status: 'cancelled', note: 'Out of caps' }, A);
ok('cancelling refunds the points', (await get('/api/prizes', F1)).json.balance === bal1);
ok('fan is told about the cancellation', (await get('/api/notifications', F1)).json.notifications.some(n => /cancelled/.test(n.title)));
const poor = await post(`/api/prizes/${(await post('/api/admin/prizes', { title: 'Jersey', pointsCost: 5000, stock: 5, fulfilment: 'Posted' }, A)).json.prize.id}/redeem`, {}, F4);
ok('not enough points: 402', poor.status === 402);
const draw = (await post('/api/admin/draws', { title: 'VIP box draw', prize: 'Two VIP seats', closesAt: inMinutes(60), minPoints: 100 }, A)).json.draws[0];
ok('draw keeps a minimum points rule', draw.minPoints === 100);
ok('fans below the minimum cannot enter', (await post(`/api/draws/${draw.id}/enter`, {}, F4)).status === 403);
ok('fan1 enters', (await post(`/api/draws/${draw.id}/enter`, {}, F1)).status === 200);
ok('fan3 enters', (await post(`/api/draws/${draw.id}/enter`, {}, F3)).status === 200 || (await me(F3)).points < 100);
ok('no double entry', (await post(`/api/draws/${draw.id}/enter`, {}, F1)).status === 400);
const ex = await post(`/api/draws/${draw.id}/execute`, {}, A);
ok('draw picks a winner', ex.status === 200 && ex.json.draw.status === 'drawn');
const pub = (await get('/api/draws', F1)).json.draws.find(d => d.id === draw.id);
const entrantIds = [fan1.user.id, ...((await me(F3)).points >= 100 ? [fan3.user.id] : [])].sort();
const eh = crypto.createHash('sha256').update(entrantIds.join(':')).digest('hex');
const idx = parseInt(crypto.createHash('sha256').update(`${pub.verification.seed}:${eh}`).digest('hex').slice(0, 8), 16) % entrantIds.length;
ok('anyone can re-check the draw from the published seed', pub.verification.entrantsHash === eh && ex.json.draw.winnerUserId === entrantIds[idx]);
ok('public draw list never exposes the winner id', !('winnerUserId' in pub));
ok('winner is notified', (await get('/api/notifications', entrantIds[idx] === fan1.user.id ? F1 : F3)).json.notifications.some(n => /You won/.test(n.title)));

// ============ 9. Forum, polls, fan base ============
const before3 = (await me(F3)).points;
const th = await post('/api/forum/threads', { title: 'Who opens for the Bulls?', content: 'Thoughts on the opening pair for game one?', category: 'tactics', teamId: 'bulls', matchId: m1.id }, F3);
ok('posting a thread earns 15 points', th.json.pointsAdded === 15);
const T = th.json.thread.id;
let lastEarned = null;
for (let i = 0; i < 8; i++) lastEarned = (await post(`/api/forum/threads/${T}/comments`, { content: `Reply number ${i}` }, F3)).json.pointsAdded;
ok('forum points are capped at 50 a day', lastEarned === 0 && (await me(F3)).points === before3 + 50);
ok('react to a thread', (await post(`/api/forum/threads/${T}/react`, { emoji: '🔥' }, F1)).json.reactions[0].count === 1);
ok('unknown reaction refused', (await post(`/api/forum/threads/${T}/react`, { emoji: '💩' }, F1)).status === 400);
ok('upvote toggles', (await post(`/api/forum/threads/${T}/upvote`, {}, F1)).json.upvoted === true && (await post(`/api/forum/threads/${T}/upvote`, {}, F1)).json.upvoted === false);
ok('more than 3 links refused', (await post('/api/forum/threads', { title: 'Spam spam', content: 'https://a.test https://b.test https://c.test https://d.test' }, F4)).status === 400);
ok('others cannot edit my post', (await call('PATCH', `/api/forum/threads/${T}`, { content: 'hijacked content here' }, F1)).status === 403);
ok('author can edit within 24h', (await call('PATCH', `/api/forum/threads/${T}`, { content: 'Thoughts on the opening pair? Edited.' }, F3)).json.thread.editedAt);
ok('cannot report own post', (await post(`/api/forum/threads/${T}/report`, { reason: 'spam' }, F3)).status === 400);
await post(`/api/forum/threads/${T}/report`, { reason: 'spam' }, F1);
await post(`/api/forum/threads/${T}/report`, { reason: 'spam' }, F2);
const rep3 = await post(`/api/forum/threads/${T}/report`, { reason: 'spam' }, F4);
ok('three reports hide the thread automatically', rep3.json.hidden === true);
ok('hidden thread is gone for fans', (await get(`/api/forum/threads/${T}`)).status === 404);
ok('moderators still see it', (await get(`/api/forum/threads/${T}`, A)).status === 200);
const reports = (await get('/api/admin/forum/reports', A)).json.reports;
ok('report queue shows the thread', reports.length === 3 && reports[0].threadTitle.includes('Bulls'));
await post(`/api/admin/forum/reports/${reports[0].id}`, { action: 'dismiss' }, A);
ok('dismissing restores the thread', (await get(`/api/forum/threads/${T}`)).status === 200 && (await get('/api/admin/forum/reports', A)).json.reports.length === 0);
await post(`/api/admin/forum/threads/${T}/lock`, { value: true }, A);
ok('locked threads refuse replies', (await post(`/api/forum/threads/${T}/comments`, { content: 'late reply' }, F1)).status === 423);
const mdT = (await get(`/api/matches/${m1.id}`)).json.threads;
ok('match page lists its threads', mdT.some(t => t.id === T));

const poll = (await post('/api/admin/polls', { question: 'Player of the season?', options: ['Pollard', 'Moeen', 'Russell'], teamId: null }, A)).json.poll;
ok('vote on a poll', (await post(`/api/polls/${poll.id}/vote`, { optionId: poll.options[0].id }, F1)).json.poll.total === 1);
ok('change vote', (await post(`/api/polls/${poll.id}/vote`, { optionId: poll.options[1].id }, F1)).json.poll.options[1].votes === 1);
ok('options locked once voted', (await post('/api/admin/polls', { id: poll.id, question: 'Player of the season?', options: ['A', 'B'] }, A)).status === 400);
await post('/api/admin/polls', { id: poll.id, question: 'Player of the season?', options: ['Pollard', 'Moeen', 'Russell'], status: 'closed' }, A);
ok('closed polls refuse votes', (await post(`/api/polls/${poll.id}/vote`, { optionId: poll.options[0].id }, F2)).status === 400);

const fans = (await get('/api/fans')).json;
ok('fan base counts fans per team and countries', fans.totalFans >= 5 && fans.teams.find(t => t.teamId === 'bulls').fans >= 2 && fans.countries[0].country === 'United Arab Emirates');
ok('public fan lists never include emails', !JSON.stringify(fans).includes('@test.dev'));
const board = (await get('/api/leaderboard', F1)).json;
ok('Fan Wars and top fans', board.fanWars.length === 6 && board.topFans.length > 0 && board.myRank >= 1 && !JSON.stringify(board).includes('@test.dev'));

// ============ 10. Fan Spaces: book, QR pass, door check-in ============
const spaces = (await post('/api/admin/fanspaces', { name: 'Test Fan Zone', city: 'Abu Dhabi', capacity: 3, status: 'active' }, A)).json.spaces;
const sp = spaces[0];
ok('past dates refused', (await post(`/api/fanspaces/${sp.id}/book`, { date: '2020-01-01', ticketsCount: 1 }, F1)).status === 400);
const bk = await post(`/api/fanspaces/${sp.id}/book`, { date: dubaiDay(), ticketsCount: 2 }, F1);
ok('booking returns a pass code', bk.status === 200 && /^ABU-[A-Z0-9]{6}$/.test(bk.json.passCode));
ok('capacity is enforced', /Only 1 place/.test((await post(`/api/fanspaces/${sp.id}/book`, { date: dubaiDay(), ticketsCount: 2 }, F2)).json.error));
const tomorrow = dubaiDay(new Date(Date.now() + 86400_000));
const bk2 = await post(`/api/fanspaces/${sp.id}/book`, { date: tomorrow, ticketsCount: 1 }, F2);
ok('pass for another day is refused at the door', (await post('/api/admin/fanspaces/checkin', { code: bk2.json.passCode }, A)).status === 409);
ok('unknown code', (await post('/api/admin/fanspaces/checkin', { code: 'ABU-NOPE00' }, A)).status === 404);
const chk = await post('/api/admin/fanspaces/checkin', { code: `ADT10PASS:${bk.json.passCode.toLowerCase()}` }, A);
ok('QR payload checks in once', chk.status === 200 && chk.json.booking.checkedInAt);
ok('second scan is refused', (await post('/api/admin/fanspaces/checkin', { code: bk.json.passCode }, A)).status === 409);
ok('used pass cannot be cancelled', (await post(`/api/fanspaces/bookings/${bk.json.booking.id}/cancel`, {}, F1)).status === 400);
ok('cancelled pass is refused at the door', (await post(`/api/fanspaces/bookings/${bk2.json.booking.id}/cancel`, {}, F2)).status === 200 && (await post('/api/admin/fanspaces/checkin', { code: bk2.json.passCode, anyDate: true }, A)).status === 409);

// ============ 11. Notifications by audience ============
const tn = await post('/api/fcm/send', { title: 'Bulls fan meetup', body: 'Fan Zone, 6pm', targetAudience: 'team', teamId: 'bulls' }, A);
ok('admin sends to one team\'s fans', tn.status === 200);
const seen = async t => (await get('/api/notifications', t)).json.notifications.some(n => n.title === 'Bulls fan meetup');
ok('Bulls fans see it; others and anonymous do not', (await seen(F2)) && !(await seen(F1)) && !(await seen(null)));
const unread = (await get('/api/notifications', F2)).json.unreadCount;
await post('/api/notifications/mark-all-read', {}, F2);
ok('mark all read', unread > 0 && (await get('/api/notifications', F2)).json.unreadCount === 0);
ok('push tokens are validated', (await post('/api/fcm/register-token', { token: 'short' })).status === 400);

// ============ 12. Admin roles: team officials ============
ok('admin permission cannot be granted', (await post('/api/admin/admins', { email: 'x@test.dev', role: 'custom', permissions: ['admins'] }, A)).status === 400);
ok('owner account cannot be changed', (await post('/api/admin/admins', { email: 'solarastra.in@gmail.com', role: 'custom', permissions: ['matches'] }, A)).status === 409);
ok('team official needs a team', (await post('/api/admin/admins', { email: 'official@test.dev', role: 'team_official' }, A)).status === 400);
ok('super admin adds a Bulls team official', (await post('/api/admin/admins', { email: 'official@test.dev', role: 'team_official', teamId: 'bulls' }, A)).status === 200);
const off = await login('official@test.dev');
const O = off.token;
ok('official is an admin scoped to the Bulls', off.user.role === 'admin' && off.user.adminRole === 'team_official' && off.user.adminTeamId === 'bulls');
ok('official cannot create matches', (await post('/api/matches', { teamA: 'bulls', teamB: 'aces', startsAt: inMinutes(999) }, O)).status === 403);
ok('official cannot change settings or admins', (await post('/api/admin/settings', { brandName: 'x' }, O)).status === 403 && (await get('/api/admin/admins', O)).status === 403 && (await get('/api/admin/env', O)).status === 403);
ok('official cannot edit another team', (await post('/api/teams', { id: 'aces', name: 'Arabian Aces', note: 'x' }, O)).status === 403);
ok('official cannot edit another team\'s squad', (await post('/api/teams/aces/squad', { squad: acesSquad }, O)).status === 403);
ok('official can update the Bulls page details', (await post('/api/teams', { id: 'bulls', name: 'UAE Bulls', note: 'Official page' }, O)).json.team.note === 'Official page');
const bullsNow = (await get('/api/teams')).json.teams.find(t => t.id === 'bulls');
ok('Bulls page edit leaves the squad untouched', bullsNow.squad.length === 18 && bullsNow.squad.map(p => p.id).join() === bulls.squad.map(p => p.id).join());
ok('official cannot add handles for another team', (await post('/api/handles', { platform: 'X', url: 'https://x.com/SomeAcesTest', teamId: 'aces' }, O)).status === 403);
ok('official cannot delete league handles', (await del(`/api/handles/${handles.find(h => !h.teamId).id}`, O)).status === 403);
ok('official feed health shows only the Bulls', (await get('/api/admin/feeds/health', O)).json.handles.every(h => h.teamId === 'bulls'));
const on = await post('/api/fcm/send', { title: 'From the Bulls', body: 'Training open day', targetAudience: 'all' }, O);
ok('official notifications always go to their own fans only', on.status === 200 && on.json.notification.teamId === 'bulls' && on.json.notification.targetAudience === 'team');
ok('official can post a Bulls poll but not a league one', (await post('/api/admin/polls', { question: 'Best Bulls moment?', options: ['a', 'b'], teamId: 'bulls' }, O)).status === 200 && (await post('/api/admin/polls', { question: 'League question?', options: ['a', 'b'] }, O)).status === 403);
const acesThread = (await post('/api/forum/threads', { title: 'Aces chat thread', content: 'Discussing the Aces squad here', teamId: 'aces' }, F1)).json.thread;
ok('official cannot moderate another team\'s threads', (await post(`/api/admin/forum/threads/${acesThread.id}/hide`, { value: true }, O)).status === 403);
ok('official can moderate Bulls threads', (await post(`/api/admin/forum/threads/${T}/pin`, { value: true }, O)).status === 200);
ok('removing the official revokes access', (await del('/api/admin/admins/official@test.dev', A)).status === 200 && (await get('/api/admin/feeds/health', O)).status === 403);

// ============ 12b. Team portals: onboarding team admins by invitation ============
ok('only a super admin can invite team admins', (await post('/api/admin/team-invites', { name: 'Sam', email: 'aces.admin@test.dev', teamId: 'aces' }, F1)).status === 403);
ok('invitation needs a name, a valid email and a team', (await post('/api/admin/team-invites', { name: '', email: 'x@test.dev', teamId: 'aces' }, A)).status === 400 && (await post('/api/admin/team-invites', { name: 'X', email: 'nope', teamId: 'aces' }, A)).status === 400 && (await post('/api/admin/team-invites', { name: 'X', email: 'x@test.dev', teamId: 'nope' }, A)).status === 400);
ok('an existing league admin cannot be invited as a team admin', (await post('/api/admin/team-invites', { name: 'Admin', email: 'admin@test.dev', teamId: 'aces' }, A)).status === 409);
const inv = await post('/api/admin/team-invites', { name: 'Sara Aces', email: 'Aces.Admin@test.dev', teamId: 'aces' }, A);
ok('super admin invites a team admin; without a mail server the link is returned to pass on', inv.status === 200 && inv.json.invite.status === 'pending' && inv.json.invite.emailed === false && /\/team-invite\/[\w-]{40,}$/.test(inv.json.link), inv.json);
ok('the invitation list never shows the token', !JSON.stringify((await get('/api/admin/team-invites', A)).json).includes(inv.json.link.split('/').pop()) && !('tokenHash' in (await get('/api/admin/team-invites', A)).json.invites[0]));
const token = inv.json.link.split('/').pop();
const pubInv = (await get(`/api/team-invites/${token}`)).json;
ok('the invitation page shows the team and a partly hidden address', pubInv.team.id === 'aces' && pubInv.name === 'Sara Aces' && pubInv.emailHint.startsWith('ac') && !pubInv.emailHint.includes('aces.admin') && pubInv.status === 'pending');
ok('a wrong link is refused', (await get('/api/team-invites/notarealtoken000000000000000')).status === 404);
ok('accepting needs a signed-in user', (await post(`/api/team-invites/${token}/accept`, {})).status === 401);
ok('someone else cannot accept it', (await post(`/api/team-invites/${token}/accept`, {}, F1)).status === 403);
const sara = await login('aces.admin@test.dev');
ok('before accepting, the invited person is a fan', sara.user.role === 'fan');
ok('the invitation page knows the invited person is signed in', (await get(`/api/team-invites/${token}`, sara.token)).json.signedInAsInvitee === true);
const acc = await post(`/api/team-invites/${token}/accept`, {}, sara.token);
ok('accepting makes them a team admin for that team only', acc.status === 200 && acc.json.user.role === 'admin' && acc.json.user.adminRole === 'team_official' && acc.json.user.adminTeamId === 'aces', acc.json);
ok('the link works once', (await post(`/api/team-invites/${token}/accept`, {}, sara.token)).status === 409);
ok('the super admin sees it accepted, and the admin listed', (await get('/api/admin/team-invites', A)).json.invites.find(i => i.email === 'aces.admin@test.dev').status === 'accepted' && (await get('/api/admin/admins', A)).json.admins.some(a => a.email === 'aces.admin@test.dev' && a.role === 'team_official' && a.teamId === 'aces'));
const S = sara.token;
// The portal: their own team, nothing league-wide.
const ov = await get('/api/team-portal/aces/overview', S);
ok('team portal overview for their own team', ov.status === 200 && ov.json.team.id === 'aces' && ov.json.squad === 18 && ov.json.admins.some(a => a.email === 'aces.admin@test.dev'), ov.json);
ok('no portal for another team', (await get('/api/team-portal/bulls/overview', S)).status === 403);
const sDash = (await get('/api/admin/dashboard', S)).json;
ok('team admins get no league-wide dashboard, settings or admin addresses', sDash.teamScope === 'aces' && sDash.usersCount === undefined && !JSON.stringify(sDash).includes('admin@test.dev'));
ok('team admins cannot run prize draws, fans\' points or Fan of the Day', (await post('/api/admin/draws', { title: 'x', prize: 'y', closesAt: inMinutes(60) }, S)).status === 403 && (await get('/api/admin/points?q=fan', S)).status === 403 && (await post('/api/admin/points/x/adjust', { delta: 5 }, S)).status === 403);
ok('team admins cannot sync matches or test email', (await post('/api/scraper/seed-series', {}, S)).status === 403 && (await post('/api/admin/smtp/test', { to: 'x@test.dev' }, S)).status === 403);
// Prizes for their fans.
const leaguePrize = (await post('/api/admin/prizes', { title: 'League cap', pointsCost: 50, stock: 5, fulfilment: 'Fan Zone desk' }, A)).json.prize;
const teamPrize = await post('/api/admin/prizes', { title: 'Aces training session pass', pointsCost: 120, stock: 10, teamOnly: 'aces', fulfilment: 'We email you the session time', teamId: 'bulls' }, S);
ok('a team admin adds a prize for their own fans; it belongs to their team whatever they send', teamPrize.status === 200 && teamPrize.json.prize.teamId === 'aces' && teamPrize.json.prize.teamOnly === 'aces', teamPrize.json);
ok('a team prize cannot be reserved for another team\'s fans', (await post('/api/admin/prizes', { title: 'x', pointsCost: 10, stock: 1, teamOnly: 'bulls', fulfilment: 'x' }, S)).status === 403);
ok('a team admin cannot edit or delete league prizes', (await post('/api/admin/prizes', { id: leaguePrize.id, title: 'Hacked', pointsCost: 1, stock: 999, fulfilment: 'x' }, S)).status === 403 && (await del(`/api/admin/prizes/${leaguePrize.id}`, S)).status === 403);
const sPrizes = (await get('/api/admin/prizes', S)).json;
ok('a team admin sees only their own prizes and claims', sPrizes.prizes.length === 1 && sPrizes.prizes[0].id === teamPrize.json.prize.id && sPrizes.redemptions.every(r => r.prizeId === teamPrize.json.prize.id));
ok('fans see the team prize with its team', (await get('/api/prizes')).json.prizes.some(p => p.id === teamPrize.json.prize.id && p.teamId === 'aces'));
// Invitations can be withdrawn, and a new one replaces a pending one.
const inv2 = await post('/api/admin/team-invites', { name: 'Lee', email: 'lions.admin@test.dev', teamId: 'lions' }, A);
const inv3 = await post('/api/admin/team-invites', { name: 'Lee', email: 'lions.admin@test.dev', teamId: 'lions' }, A);
ok('a new invitation replaces the pending one (the old link stops working)', (await get(`/api/team-invites/${inv2.json.link.split('/').pop()}`)).json.status === 'revoked' && (await get(`/api/team-invites/${inv3.json.link.split('/').pop()}`)).json.status === 'pending');
ok('a super admin can withdraw an invitation', (await del(`/api/admin/team-invites/${inv3.json.invite.id}`, A)).status === 200);
const lee = await login('lions.admin@test.dev');
ok('a withdrawn invitation cannot be accepted', (await post(`/api/team-invites/${inv3.json.link.split('/').pop()}/accept`, {}, lee.token)).status === 410 && (await me(lee.token)).role === 'fan');
ok('the team portal page is kept out of search engines', /noindex/.test((await call('GET', '/team-portal', null, null, { headers: { Accept: 'text/html' } })).text) && /Disallow: \/team-portal/.test((await call('GET', '/robots.txt')).text));

// ============ 13. Settings ============
const st = await post('/api/admin/settings', { referralRewardPoints: 75, lockReminderMinutes: 45 }, A);
ok('referral reward and reminder time are configurable', st.json.settings.referralRewardPoints === 75 && st.json.settings.lockReminderMinutes === 45);
ok('secrets are masked', (await get('/api/admin/settings', A)).json.settings.smtp.pass === '');
const dash = (await get('/api/admin/dashboard', A)).json;
ok('dashboard counts are real', dash.matchesCount === 4 && dash.fantasyLineups === 4 && dash.integrations.liveScores === true);

// ============ 13b. Settings kept in the Admin console instead of environment variables ============
const envList = (await get('/api/admin/env', A)).json.variables;
ok('the deployment key is the only required environment-only setting', envList.filter(v => v.envOnly).map(v => v.key).includes('FIREBASE_SERVICE_ACCOUNT') && envList.find(v => v.key === 'CRICKET_API_KEY').envOnly === false);
ok('AI helper is off before a key is saved', (await get('/api/config')).json.config.features.gemini === false);
const savedEnv = await post('/api/admin/env', { overrides: { GEMINI_API_KEY: 'console-test-key', FEED_SYNC_MINUTES: '45', FIREBASE_SERVICE_ACCOUNT: '{"x":1}' } }, A);
ok('console settings save; deployment-only ones are refused', savedEnv.json.success && savedEnv.json.updatedKeys.includes('GEMINI_API_KEY') && savedEnv.json.refusedKeys.includes('FIREBASE_SERVICE_ACCOUNT'));
ok('a key saved in the console takes effect at once', (await get('/api/config')).json.config.features.gemini === true);
const envAfter = (await get('/api/admin/env', A)).json.variables;
ok('saved secrets are masked and marked as set here', envAfter.find(v => v.key === 'GEMINI_API_KEY').value.includes('••') && envAfter.find(v => v.key === 'GEMINI_API_KEY').source === 'console');
ok('invalid values are refused', (await post('/api/admin/env', { overrides: { APP_URL: 'not a url' } }, A)).json.success === false);
await post('/api/admin/env', { overrides: { GEMINI_API_KEY: '' } }, A);
ok('clearing a console value switches it off again', (await get('/api/config')).json.config.features.gemini === false);
ok('only super admins see the environment page', (await get('/api/admin/env', F1)).status === 403);

// ============ 14. SEO pages ============
const html = async p => {
  const r = await fetch(BASE + p);
  return { status: r.status, text: await r.text() };
};
const home = await html('/');
ok('home page has title, description, canonical and JSON-LD', /<title>[^<]+<\/title>/.test(home.text) && /name="description"/.test(home.text) && /rel="canonical"/.test(home.text) && /application\/ld\+json/.test(home.text));
const tp = await html('/teams/bulls');
ok('team page is server-rendered with the squad and SportsTeam data', tp.status === 200 && tp.text.includes('Kieron Pollard') && tp.text.includes('"SportsTeam"'));
ok('player page has Person data', (await html(`/players/${maxB}`)).text.includes('"Person"'));
const mp = await html(`/matches/${m1.id}`);
ok('match page has SportsEvent data and the result', mp.text.includes('"SportsEvent"') && mp.text.includes('UAE Bulls won'));
ok('forum thread page has DiscussionForumPosting', (await html(`/forum/${T}`)).text.includes('DiscussionForumPosting'));
for (const p of ['/matches', '/teams', '/players', '/videos', '/news', '/fantasy', '/games', '/forum', '/fans', '/prizes', '/rules']) {
  const r = await html(p);
  ok(`${p} renders with its own title`, r.status === 200 && !/<title>ADT10 Fans<\/title>/.test(r.text));
}
const nf = await html('/no-such-page');
ok('unknown pages are real 404s with noindex', nf.status === 404 && /noindex/.test(nf.text));
ok('unknown team is a 404', (await html('/teams/nope')).status === 404);
ok('admin pages are noindex', /noindex/.test((await html('/admin')).text));
const sm = await html('/sitemap.xml');
ok('sitemap lists teams, players, matches and threads', sm.text.includes('/teams/bulls') && sm.text.includes(`/players/${maxB}`) && sm.text.includes(`/matches/${m1.id}`) && sm.text.includes(`/forum/${T}`));
const evil = (await post('/api/forum/threads', { title: '<script>alert(1)</script> title', content: 'Body </script><img src=x onerror=alert(2)> here' }, F1)).json.thread;
const evilPage = (await html(`/forum/${evil.id}`)).text;
ok('user text is escaped in server-rendered pages and JSON-LD', !evilPage.includes('<script>alert(1)') && !evilPage.includes('<img src=x') && !/<\/script><img/.test(evilPage));
ok('robots.txt blocks admin and API', /Disallow: \/admin/.test((await html('/robots.txt')).text) && /Disallow: \/api\//.test((await html('/robots.txt')).text));

// ============ 14b. Points ledger, prize checkout and loopholes ============
{
  const ip = { ip: '10.77.0.1' };
  const L = await login('ledger@test.dev');
  const LT = L.token;
  await post('/api/checkin', {}, LT);
  let hist = (await get('/api/me/points', LT)).json;
  ok('points history records the check-in', hist.points === 10 && hist.history[0].source === 'checkin' && hist.history[0].delta === 10 && hist.bySource.checkin === 10 && hist.earlier === 0);
  ok('points history needs sign-in', (await get('/api/me/points')).status === 401);

  // Posting then deleting used to free up the day's forum allowance, so points could be farmed.
  const earned = [];
  for (let i = 0; i < 4; i++) {
    const r = await call('POST', '/api/forum/threads', { title: `Farming attempt ${i}`, content: 'Trying to farm forum points here' }, LT, ip);
    earned.push(r.json.pointsAdded);
    await del(`/api/forum/threads/${r.json.thread.id}`, LT);
  }
  ok('forum posts stop earning at the daily cap even after deleting', earned.join(',') === '15,15,15,5', earned);
  const fifth = await call('POST', '/api/forum/threads', { title: 'One more thread', content: 'This one should earn nothing now' }, LT, ip);
  ok('deleting a post takes its points back', fifth.json.pointsAdded === 0 && (await me(LT)).points === 10);
  hist = (await get('/api/me/points', LT)).json;
  ok('removed posts show as taken back in the history', hist.bySource['forum-thread'] === 50 && hist.bySource['forum-removed'] === -50);

  // Admin adjustments: reason required, recorded with who made it.
  ok('adjustment needs a reason', (await post(`/api/admin/points/${L.user.id}/adjust`, { delta: 300 }, A)).status === 400);
  ok('fans cannot adjust points', (await post(`/api/admin/points/${L.user.id}/adjust`, { delta: 300, reason: 'Giving myself points' }, LT)).status === 403);
  const adj = await post(`/api/admin/points/${L.user.id}/adjust`, { delta: 300, reason: 'Matchday quiz winner (paper entry)' }, A);
  ok('admin adds points with a reason', adj.status === 200 && adj.json.points === 310 && adj.json.balance === 310);
  hist = (await get('/api/me/points', LT)).json;
  ok('the fan sees the adjustment and its reason, not the admin email', hist.history[0].source === 'admin' && hist.history[0].note.includes('paper entry') && hist.history[0].by === undefined);

  // Prize checkout: spend, refund, all in the ledger.
  const pz = (await post('/api/admin/prizes', { title: 'Team scarf', pointsCost: 120, stock: 3, fulfilment: 'Collect at the Fan Zone desk' }, A)).json.prize;
  const claim = await post(`/api/prizes/${pz.id}/redeem`, {}, LT);
  ok('claim deducts from the balance only', claim.status === 200 && (await get('/api/prizes', LT)).json.balance === 190 && (await me(LT)).points === 310);
  ok('one claim per prize per fan', (await post(`/api/prizes/${pz.id}/redeem`, {}, LT)).status === 409);
  hist = (await get('/api/me/points', LT)).json;
  ok('the claim is in the history with its code', hist.history[0].source === 'prize' && hist.history[0].delta === -120 && hist.history[0].note.includes(claim.json.redemption.code) && hist.pointsSpent === 120);
  const look = (await get(`/api/admin/points?q=${claim.json.redemption.code}`, A)).json;
  ok('admin finds the fan by claim code with full history', look.fans.length === 1 && look.detail.fan.email === 'ledger@test.dev' && look.detail.claims.length === 1 && look.detail.ledger.some(e => e.source === 'admin' && e.by));
  await post(`/api/admin/redemptions/${claim.json.redemption.id}`, { status: 'cancelled', note: 'Size unavailable' }, A);
  hist = (await get('/api/me/points', LT)).json;
  ok('a cancelled claim refunds and is listed', hist.balance === 310 && hist.history[0].source === 'prize-refund' && hist.history[0].delta === 120);

  // Invite rewards stop paying the inviter after the limit (fake accounts can't farm points).
  await post('/api/admin/settings', { referralMaxRewarded: 1 }, A);
  const code = (await get('/api/me/referral', F1)).json.code;
  const f1Before = (await me(F1)).points;
  const F5 = (await login('fan5@test.dev', code)).token;
  const f5Post = await call('POST', '/api/forum/threads', { title: 'Hello from fan five', content: 'Just joined through an invite' }, F5, { ip: '10.77.0.2' });
  ok('friend past the limit still gets their reward', f5Post.json.referralReward > 0 && (await me(F5)).points === f5Post.json.referralReward + 15);
  ok('inviter past the limit is not paid again', (await me(F1)).points === f1Before);
  ok('referral summary shows the limit', (await get('/api/me/referral', F1)).json.maxRewarded === 1);
  await post('/api/admin/settings', { referralMaxRewarded: 10 }, A);
}

// ============ 14b. Skill games: Squad Connections, Cricket Grid, Stat Wars, duels ============
{
  const G1 = (await login('gamer1@test.dev')).token;
  const G2 = (await login('gamer2@test.dev')).token;
  const allTeams = (await get('/api/teams')).json.teams;
  const pl = new Map(allTeams.flatMap(t => t.squad.map(p => [p.id, p])));
  const bowl = p => (p.bowlingStyle || '').toLowerCase();
  // The same traits as server/arcade.ts, by label, so the test can check answers independently.
  const traits = {
    'Left-hand batter': p => /left-hand/i.test(p.battingStyle || ''),
    Wicketkeeper: p => p.role === 'wicketkeeper' || Boolean(p.isKeeper),
    'Off-spinner': p => /offbreak/.test(bowl(p)),
    'Leg-spinner or wrist-spinner': p => /legbreak|wrist-spin/.test(bowl(p)),
    'Left-arm orthodox spinner': p => /left-arm orthodox/.test(bowl(p)),
    'Left-arm seamer': p => /^left-arm (fast|medium)/.test(bowl(p)),
    'Right-arm fast or fast-medium': p => /^right-arm fast/.test(bowl(p)),
    'Right-arm medium pace': p => bowl(p) === 'right-arm medium',
    'Icon or Platinum signing': p => p.isIcon || /icon|platinum/i.test(p.category || ''),
    'Batting all-rounder': p => p.cricbuzzRole === 'Batting Allrounder',
    'Bowling all-rounder': p => p.cricbuzzRole === 'Bowling Allrounder',
    'Specialist batter': p => p.role === 'batter',
    'Specialist bowler': p => p.role === 'bowler',
    "Doesn't bowl": p => !p.bowlingStyle,
  };
  const traitOf = label => {
    if (traits[label]) return traits[label];
    const team = allTeams.find(t => label === `Plays for ${t.name}` || label === t.name);
    return team ? p => p.teamId === team.id : null;
  };

  // Squad Connections
  let today = (await get('/api/games/today', G1)).json;
  ok('Squad Connections: 16 players, groups hidden', today.connections.available && today.connections.remaining.length === 16 && today.connections.groups.length === 0, today.connections);
  ok('the puzzle carries no answers', !JSON.stringify(today.connections).includes('traitId'));
  const ids = today.connections.remaining.map(p => p.id);
  const tries = [ids.slice(0, 4), ids.slice(4, 8), ids.slice(8, 12), ids.slice(12, 16), [ids[0], ids[5], ids[10], ids[15]], [ids[1], ids[6], ids[11], ids[12]], [ids[2], ids[7], ids[8], ids[13]], [ids[3], ids[4], ids[9], ids[14]]];
  let c1;
  for (const t of tries) {
    c1 = await post('/api/games/connections', { playerIds: t }, G1);
    if (c1.json.connections?.finished) break;
  }
  ok('Connections ends after 4 mistakes (or a solve) and reveals the groups', c1.json.connections.finished && c1.json.connections.groups.length === 4, c1.json);
  const groups = c1.json.connections.groups;
  ok('every revealed group really shares its trait', groups.every(g => g.players.every(p => traitOf(g.label)?.(pl.get(p.id)))), groups.map(g => g.label));
  ok('no player fits two groups (one answer only)', groups.every(g => g.players.every(p => groups.filter(h => h !== g).every(h => !traitOf(h.label)(pl.get(p.id))))));
  ok('a finished puzzle cannot be played again', (await post('/api/games/connections', { playerIds: groups[0].players.map(p => p.id) }, G1)).status === 400);
  const before2 = (await me(G2)).points;
  let c2;
  for (const g of groups) c2 = await post('/api/games/connections', { playerIds: g.players.map(p => p.id) }, G2);
  ok('another fan solves it without mistakes: 4 x 10 + 20 = 60 points', c2.json.connections.solved && c2.json.connections.points === 60 && (await me(G2)).points === before2 + 60, c2.json.connections);

  // Cricket Grid
  today = (await get('/api/games/today', G1)).json;
  const grid = today.grid;
  ok('Cricket Grid: 3 teams x 3 traits', grid.available && grid.rows.length === 3 && grid.cols.length === 3 && grid.guessesLeft === 9, grid);
  const fits = (r, c) => [...pl.values()].filter(p => p.teamId === grid.rows[r].teamId && traits[grid.cols[c].label](p));
  ok('every square has at least two possible players', [0, 1, 2].every(r => [0, 1, 2].every(c => fits(r, c).length >= 2)));
  const right = fits(0, 0)[0];
  const wrongPick = [...pl.values()].find(p => p.teamId !== grid.rows[0].teamId);
  const g1 = await post('/api/games/grid', { cell: '0-0', playerId: right.id }, G1);
  ok('a correct pick fills the square and shows how many fans picked it', g1.json.grid.correct && g1.json.grid.cells['0-0'].id === right.id && g1.json.grid.cells['0-0'].pickedBy === 100 && g1.json.grid.guessesLeft === 8, g1.json);
  const g2 = await post('/api/games/grid', { cell: '0-1', playerId: wrongPick.id }, G1);
  ok('a wrong pick uses a guess and leaves the square empty', !g2.json.grid.correct && !g2.json.grid.cells['0-1'] && g2.json.grid.guessesLeft === 7);
  ok('a player cannot be used twice', (await post('/api/games/grid', { cell: '1-1', playerId: right.id }, G1)).status === 400);
  const other = fits(0, 0)[1];
  await post('/api/games/grid', { cell: '0-0', playerId: other.id }, G2);
  ok('rarity: a pick shared by half the fans shows 50%', (await get('/api/games/today', G1)).json.grid.cells['0-0'].pickedBy === 50);

  // Stat Wars (this season's real figures: match 1 was completed with a scorecard above)
  ok('Stat Wars is open once the season has figures', today.statWars.available, today.statWars);
  const run = await post('/api/games/statwars/start', {}, G1);
  ok('a run starts with questions but no answers', run.status === 200 && run.json.questions.length >= 10 && run.json.questions.every(q => q.answer === undefined && q.values === undefined && q.a.name && q.b.name), run.json);
  ok('only one run at a time', (await post('/api/games/statwars/start', {}, G1)).status === 400);
  const done = await post('/api/games/statwars/finish', { answers: run.json.questions.map(() => 'a') }, G1);
  const review = done.json.review;
  const expect = review.filter(q => q.right).length * 3 - review.filter(q => !q.right).length;
  ok('answers are marked from real season figures', review.every(q => (q.answer === 'a') === (/lower/.test(q.prompt) ? q.values[0] < q.values[1] : q.values[0] > q.values[1])), review.slice(0, 3));
  ok('score: 3 per correct, -1 per wrong, never below 0', done.json.score === Math.max(0, expect + done.json.timeBonus), { score: done.json.score, expect, bonus: done.json.timeBonus });
  ok('one scoring run a day', (await post('/api/games/statwars/start', {}, G1)).status === 400);

  // Duels
  const duel = await post('/api/duels', { open: true }, G1);
  ok('a fan starts a duel and gets a code', duel.status === 200 && /^[A-Z0-9]{6}$/.test(duel.json.duel.code), duel.json);
  const code = duel.json.duel.code;
  const d1 = await post('/api/games/statwars/start', { duel: code }, G1);
  await post('/api/games/statwars/finish', { duel: code, answers: d1.json.questions.map(q => 'a') }, G1);
  ok('an open duel is listed for other fans once its creator has played', (await get('/api/duels', G2)).json.open.some(d => d.code === code));
  ok('the challenger\'s score stays hidden until you have played', (await get(`/api/duels/${code}`, G2)).json.duel.challenger.score === null);
  ok('another fan accepts the duel', (await post(`/api/duels/${code}/join`, {}, G2)).json.duel.opponent?.played === false);
  const d2 = await post('/api/games/statwars/start', { duel: code }, G2);
  ok('both fans get the same questions', JSON.stringify(d2.json.questions) === JSON.stringify(d1.json.questions));
  const g2Before = (await me(G2)).points;
  const fin = await post('/api/games/statwars/finish', { duel: code, answers: d2.json.questions.map(() => 'b') }, G2);
  const dv = fin.json.duel;
  ok('the duel is decided when both have played', dv.status === 'done' && dv.challenger.score !== null && dv.opponent.score !== null, dv);
  const g2Won = dv.winnerId && dv.winnerId !== dv.challenger.userId;
  ok('winner gets 15 points, the other 3', (await me(G2)).points === g2Before + (g2Won ? 15 : 3));
  ok('a third fan cannot take a duel that is taken', (await post(`/api/duels/${code}/join`, {}, F1)).status === 400);
}

// ============ 14c. Fan wall and Fan of the Day ============
{
  const zlib = await import('node:zlib');
  // A real 240x240 PNG with a text chunk (metadata that must be removed before storing).
  const crc32 = buf => { let c, crc = 0xffffffff; for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const W = 240, H = 240;
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((W * 3 + 1) * H, 0x55); for (let y = 0; y < H; y++) raw[y * (W * 3 + 1)] = 0;
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('tEXt', Buffer.from('Location\0Secret home address')), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  // A JPEG header with an EXIF segment (GPS) and a 300x300 frame.
  const seg = (m, data) => { const l = Buffer.alloc(2); l.writeUInt16BE(data.length + 2); return Buffer.concat([Buffer.from([0xff, m]), l, data]); };
  const sof = Buffer.from([8, 0x01, 0x2c, 0x01, 0x2c, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'binary')), seg(0xe1, Buffer.from('Exif\0\0GPS 25.2048N 55.2708E')), seg(0xc0, sof), Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0, 0x12, 0x34, 0xff, 0xd9])]);

  const W1 = (await login('wall1@test.dev')).token;
  const W2 = (await login('wall2@test.dev')).token;
  const before = (await me(W1)).points;
  const textPost = await post('/api/fanwall/new', { text: 'Front row for the opener, flag in hand!', kind: 'matchday' }, W1);
  ok('a text post goes live at once and earns 5 points', textPost.status === 200 && textPost.json.post.status === 'live' && textPost.json.pointsAdded === 5 && (await me(W1)).points === before + 5, textPost.json);
  const photoPost = await post('/api/fanwall/new', { text: 'My shirt collection', kind: 'memorabilia', photo: `data:image/png;base64,${png.toString('base64')}` }, W1);
  ok('a photo post waits for review (default: photos are reviewed)', photoPost.status === 200 && photoPost.json.post.status === 'pending' && /^\/uploads\//.test(photoPost.json.post.photoUrl), photoPost.json);
  const storedPng = Buffer.from(await (await fetch(BASE + photoPost.json.post.photoUrl)).arrayBuffer());
  ok('the stored photo is the image without its metadata', storedPng.length > 100 && !storedPng.includes(Buffer.from('Secret home address')) && storedPng.includes(Buffer.from('IDAT')));
  const jpegPost = await post('/api/fanwall/new', { text: 'At the stadium', photo: `data:image/jpeg;base64,${jpeg.toString('base64')}` }, W2);
  const storedJpeg = Buffer.from(await (await fetch(BASE + jpegPost.json.post.photoUrl)).arrayBuffer());
  ok('GPS/EXIF is removed from JPEG photos', jpegPost.status === 200 && !storedJpeg.includes(Buffer.from('GPS')) && !storedJpeg.includes(Buffer.from('Exif')) && storedJpeg.includes(Buffer.from('JFIF')), { status: jpegPost.status });
  ok('a file that is not an image is refused', (await post('/api/fanwall/new', { text: 'x x x', photo: 'data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64') }, W2)).status === 400);
  let wall = (await get('/api/fanwall')).json;
  ok('other fans only see approved posts', wall.posts.some(p => p.id === textPost.json.post.id) && !wall.posts.some(p => p.id === photoPost.json.post.id));
  ok('the author sees their own post waiting', (await get('/api/fanwall', W1)).json.posts.some(p => p.id === photoPost.json.post.id && p.status === 'pending'));
  const queue = (await get('/api/admin/fanwall?status=pending', A)).json;
  ok('admins see the review queue', queue.posts.some(p => p.id === photoPost.json.post.id) && queue.counts.pending >= 2);
  ok('admin approves a photo', (await post(`/api/admin/fanwall/${photoPost.json.post.id}/approve`, {}, A)).json.post.status === 'live');
  const react = await post(`/api/fanwall/${photoPost.json.post.id}/react`, { emoji: '🔥' }, W2);
  ok('fans react to posts', react.json.reactions.some(r => r.emoji === '🔥' && r.count === 1 && r.mine));

  // Fan of the Day: points to the fan, a notification, and the post at the top of the wall.
  const w1Before = (await me(W1)).points;
  const pick = await post(`/api/admin/fanwall/${photoPost.json.post.id}/feature`, { note: 'Best collection we have seen' }, A);
  ok('admin picks the Fan of the Day', pick.status === 200 && pick.json.fanOfTheDay.post.id === photoPost.json.post.id, pick.json);
  ok('the fan gets the Fan of the Day points (100)', (await me(W1)).points === w1Before + 100);
  ok('the fan is told', (await get('/api/notifications', W1)).json.notifications.some(n => /Fan of the Day/.test(n.title)));
  wall = (await get('/api/fanwall')).json;
  ok('the wall shows the Fan of the Day', wall.fansOfTheDay[0]?.post?.id === photoPost.json.post.id && wall.fansOfTheDay[0].note === 'Best collection we have seen');
  // Picking someone else the same day moves the title and the points.
  await post(`/api/admin/fanwall/${jpegPost.json.post.id}/approve`, {}, A);
  const w2Before = (await me(W2)).points;
  await post(`/api/admin/fanwall/${jpegPost.json.post.id}/feature`, {}, A);
  ok('changing the pick moves the points to the new fan', (await me(W1)).points === w1Before && (await me(W2)).points === w2Before + 100);
  const fanPage = await call('GET', `/fanwall/${jpegPost.json.post.id}`, null, null, { headers: { Accept: 'text/html' } });
  ok('a Fan of the Day post page is indexable and previews with the photo', /"index, follow/.test(fanPage.text) && /og:image" content="[^"]*\/uploads\//.test(fanPage.text));

  // Reports: three reports hide a post until a moderator looks.
  const R = [];
  for (let i = 0; i < 3; i++) R.push((await login(`reporter${i}@test.dev`)).token);
  for (const t of R) await post(`/api/fanwall/${textPost.json.post.id}/report`, { reason: 'spam' }, t);
  ok('three reports take a post off the wall for review', !(await get('/api/fanwall')).json.posts.some(p => p.id === textPost.json.post.id) && (await get('/api/admin/fanwall?status=reported', A)).json.posts.some(p => p.id === textPost.json.post.id));
  const pointsBeforeDelete = (await me(W1)).points;
  ok('fans can delete their own post', (await del(`/api/fanwall/${textPost.json.post.id}`, W1)).status === 200);
  ok('deleting a post takes back its points', (await me(W1)).points === pointsBeforeDelete - 5);
}

// ============ 14b. Instagram check, fan clubs, team games, reward tiers ============
{
  // --- Instagram check: nothing to play until the fan proves their account ---
  const ig = await login('igfan@test.dev', undefined, { instagram: false });
  const IG = ig.token;
  const igIp = '10.77.0.1';
  const igCall = (m, p, b) => call(m, p, b, IG, { ip: igIp });
  let st = (await igCall('GET', '/api/instagram/status')).json;
  ok('a new fan must pass the Instagram check', st.required === true && st.status === 'none' && st.target === '@arabianacesofficial' && st.automatic === true, st);
  const blocked = await igCall('POST', '/api/checkin', {});
  ok('games are blocked until Instagram is verified', blocked.status === 403 && blocked.json.code === 'instagram_required', blocked.json);
  ok('predictions are blocked too', (await igCall('POST', `/api/contests/${quiz.id}/enter`, { answers: {} })).json?.code === 'instagram_required');
  ok('the fan can still update their profile', (await igCall('POST', '/api/me/profile/update', { bio: 'Aces fan' })).status === 200);
  ok('an invalid username is refused', (await igCall('POST', '/api/instagram/start', { handle: 'bad name!' })).status === 400);
  st = (await igCall('POST', '/api/instagram/start', { handle: '@IG.Fan_One' })).json;
  ok('the fan gets a code to comment', /^ACES-[A-Z2-9]{5}$/.test(st.code) && st.handle === 'ig.fan_one' && st.status === 'code', st);
  let chk = (await igCall('POST', '/api/instagram/check', {})).json;
  ok('no comment yet: not verified', chk.verified === false && /could not find/i.test(chk.reason), chk);
  await igComment('someone.else', `here is ${st.code}`);
  await new Promise(r => setTimeout(r, 3100));
  chk = (await igCall('POST', '/api/instagram/check', {})).json;
  ok('the code from another account does not count', chk.verified === false, chk);
  await igComment('ig.fan_one', 'Love the Aces!');
  await new Promise(r => setTimeout(r, 3100));
  ok('a comment without the code does not count', (await igCall('POST', '/api/instagram/check', {})).json.verified === false);
  await igComment('ig.fan_one', `My code: ${st.code.toLowerCase()}`);
  await new Promise(r => setTimeout(r, 3100));
  chk = (await igCall('POST', '/api/instagram/check', {})).json;
  ok('the fan’s own comment with the code verifies them', chk.verified === true && chk.status === 'verified', chk);
  ok('a verified fan can play', (await igCall('POST', '/api/checkin', {})).status === 200);
  const twin = await login('igtwin@test.dev', undefined, { instagram: false });
  ok('one Instagram account can verify only one ADT10fans account', (await call('POST', '/api/instagram/start', { handle: 'ig.fan_one' }, twin.token, { ip: '10.77.0.2' })).status === 409);
  await call('POST', '/api/instagram/start', { handle: 'twin.account' }, twin.token, { ip: '10.77.0.2' });
  ok('a fan can ask an organiser instead', (await call('POST', '/api/instagram/request-review', {}, twin.token, { ip: '10.77.0.2' })).json.status === 'review');
  ok('fans cannot see the review queue', (await get('/api/admin/instagram', F1)).status === 403);
  const queue = (await get('/api/admin/instagram', A)).json;
  ok('the fan waits in the organisers’ queue', queue.queue.some(r => r.handle === 'twin.account') && queue.counts.waiting >= 1, queue.counts);
  const twinRow = queue.queue.find(r => r.handle === 'twin.account');
  ok('an organiser approves them', (await post(`/api/admin/instagram/${twinRow.id}`, { action: 'approve' }, A)).json.status === 'verified' && (await me(twin.token)).instagramFollowed === true);
  const diag = (await get('/api/admin/instagram?diagnose=1', A)).json.setup;
  ok('the setup test finds the club account and the pinned post', diag.account === '@arabianacesofficial' && diag.matchesTarget === true && diag.postFound === true, diag);

  // --- Fan clubs: nothing built in, admins add them ---
  ok('no fan clubs until admins add them', (await get('/api/fanclub/clubs')).json.clubs.length === 0);
  ok('fans cannot open the fan club desk', (await get('/api/fanclub/admin/clubs', F1)).status === 403);
  ok('fans cannot check anyone in', (await post('/api/fanclub/admin/checkin', { fanClubId: 'x', code: 'ABCDEF' }, F1)).status === 403);
  const imp = (await post('/api/fanclub/admin/import', { csv: 'name,city,country,address,checkInPoints,gamesMode\nAces Lounge,Dubai,UAE,"Al Barsha, Dubai",120,team\nCorner Cafe,London,UK,Wembley,,all' }, A)).json;
  ok('league admins import fan clubs from CSV', imp.added === 2 && imp.errors.length === 0, imp);
  const clubs = (await get('/api/fanclub/admin/clubs', A)).json.clubs;
  const lounge = clubs.find(c => c.name === 'Aces Lounge');
  const cafe = clubs.find(c => c.name === 'Corner Cafe');
  ok('a club can set its own check-in points; others use the default', lounge.effectiveCheckInPoints === 120 && cafe.effectiveCheckInPoints === 100 && cafe.gamesMode === 'all');
  ok('importing again updates instead of duplicating', (await post('/api/fanclub/admin/import', { csv: 'name,city,country,capacity\nAces Lounge,Dubai,UAE,150' }, A)).json.updated === 1 && (await get('/api/fanclub/admin/clubs', A)).json.clubs.length === 2);
  ok('league admins name a fan club admin', (await post(`/api/fanclub/admin/clubs/${lounge.id}/admins`, { email: 'club.admin@test.dev', name: 'Sam' }, A)).json.admins.some(a => a.email === 'club.admin@test.dev'));
  const ca = await login('club.admin@test.dev');
  const CA = ca.token;
  ok('the fan club admin signs in with that role', ca.user.adminRole === 'fanclub_admin' && ca.user.role === 'admin');
  const caView = (await get('/api/fanclub/admin/clubs', CA)).json;
  ok('a fan club admin sees only their own clubs', caView.leagueWide === false && caView.clubs.length === 1 && caView.clubs[0].id === lounge.id);
  ok('a fan club admin cannot use other admin areas', (await get('/api/admin/settings', CA)).status === 403 && (await post('/api/matches', { teamA: 'aces', teamB: 'bulls', startsAt: inMinutes(60) }, CA)).status === 403);
  ok('a fan club admin cannot edit another club', (await post('/api/fanclub/admin/clubs', { id: cafe.id, name: 'Hijack' }, CA)).status === 403);
  ok('a fan club admin cannot add clubs', (await post('/api/fanclub/admin/clubs', { name: 'New', city: 'Doha', country: 'Qatar' }, CA)).status === 403);
  ok('a fan club admin cannot change how their fans play', (await post('/api/fanclub/admin/clubs', { id: lounge.id, gamesMode: 'all' }, CA)).json.club.gamesMode === 'team');
  const offer = (await post(`/api/fanclub/admin/clubs/${lounge.id}/offers`, { title: 'Free karak chai', perk: 'Free chai', bonusPoints: 15, limit: 1 }, CA)).json.offer;
  ok('a fan club admin adds an offer', offer?.title === 'Free karak chai' && offer.bonusPoints === 15);
  ok('but not at another club', (await post(`/api/fanclub/admin/clubs/${cafe.id}/offers`, { title: 'x' }, CA)).status === 403);
  ok('offers show to fans', (await get('/api/fanclub/clubs')).json.clubs.find(c => c.id === lounge.id).offers.some(o => o.id === offer.id));

  // --- Check-in on a matchday ---
  const st1 = (await get('/api/fanclub/my-status', IG)).json;
  ok('a verified fan has a random fan club code and QR', /^[A-Z2-9]{6}$/.test(st1.fanClubCode) && st1.qrPayload === `ADT10FC:${st1.fanClubCode}`, st1);
  const unv = await login('clubunverified@test.dev', undefined, { instagram: false });
  ok('a fan who has not verified Instagram is flagged on their fan club pass', (await get('/api/fanclub/my-status', unv.token)).json.instagramRequired === true);
  const far = (await post('/api/matches', { teamA: 'aces', teamB: 'eagles', startsAt: inMinutes(3 * 60) }, A)).json.targetMatch;
  const tooEarly = await post('/api/fanclub/admin/checkin', { fanClubId: lounge.id, code: st1.fanClubCode, matchId: far.id }, CA);
  ok('check-in is not open three hours before the match', tooEarly.status === 409 && /opens 45 minutes/.test(tooEarly.json.error), tooEarly.json);
  const mAces = (await post('/api/matches', { teamA: 'aces', teamB: 'tigers', startsAt: inMinutes(30) }, A)).json.targetMatch;
  const look = (await get(`/api/fanclub/admin/fan?fanClubId=${lounge.id}&code=${st1.fanClubCode}&matchId=${mAces.id}`, CA)).json;
  ok('the desk looks the fan up by code', look.fan.name && look.fan.instagramVerified === true && look.window.open === true && look.checkedIn === null, look);
  ok('an offer cannot be redeemed before checking in', (await post('/api/fanclub/admin/redeem-offer', { fanClubId: lounge.id, offerId: offer.id, code: st1.fanClubCode }, CA)).status === 409);
  const before = (await me(IG)).points;
  const ci = await post('/api/fanclub/admin/checkin', { fanClubId: lounge.id, code: `ADT10FC:${st1.fanClubCode}`, matchId: mAces.id }, CA);
  ok('checking in gives the club’s points', ci.status === 200 && ci.json.pointsAwarded === 120 && (await me(IG)).points === before + 120, ci.json);
  ok('one check-in per fan per match', (await post('/api/fanclub/admin/checkin', { fanClubId: lounge.id, code: st1.fanClubCode, matchId: mAces.id }, CA)).status === 409);
  ok('even at another club', (await post('/api/fanclub/admin/checkin', { fanClubId: cafe.id, code: st1.fanClubCode, matchId: mAces.id }, A)).status === 409);
  // Fan clubs cover the Arabian Aces matches by default; their admins add or remove matches.
  const loungeView = () => get('/api/fanclub/admin/clubs', CA).then(r => r.json.clubs[0]);
  ok('a fan club’s matches are the Aces matches by default', (await loungeView()).matchIds.includes(mAces.id) && (await loungeView()).matchIds.includes(far.id));
  const other = (await post('/api/matches', { teamA: 'bulls', teamB: 'lions', startsAt: inMinutes(20) }, A)).json.targetMatch;
  ok('a match without the Aces is not a fan club match', !(await loungeView()).matchIds.includes(other.id));
  const notHere = await post('/api/fanclub/admin/checkin', { fanClubId: lounge.id, code: st1.fanClubCode, matchId: other.id }, CA);
  ok('fans cannot check in for it', notHere.status === 409 && /not one of/.test(notHere.json.error), notHere.json);
  ok('a fan club admin cannot change another club’s matches', (await post(`/api/fanclub/admin/clubs/${cafe.id}/matches`, { matchId: other.id, include: true }, CA)).status === 403);
  ok('the fan club admin adds that match to their club', (await post(`/api/fanclub/admin/clubs/${lounge.id}/matches`, { matchId: other.id, include: true }, CA)).json.matchIds.includes(other.id));
  const ci2 = await post('/api/fanclub/admin/checkin', { fanClubId: lounge.id, code: st1.fanClubCode, matchId: other.id }, CA);
  ok('fans can now check in for the added match', ci2.status === 200 && ci2.json.pointsAwarded === 120, ci2.json);
  ok('an Aces match can be taken out', !(await post(`/api/fanclub/admin/clubs/${lounge.id}/matches`, { matchId: far.id, include: false }, CA)).json.matchIds.includes(far.id));
  ok('editing the club keeps its match list', (await post('/api/fanclub/admin/clubs', { id: lounge.id, contactPerson: 'Sam' }, CA)).status === 200 && !(await loungeView()).matchIds.includes(far.id) && (await loungeView()).matchIds.includes(other.id));
  ok('a super admin can change the club’s matches too', (await post(`/api/fanclub/admin/clubs/${lounge.id}/matches`, { matchId: far.id, include: true }, A)).json.matchIds.includes(far.id));
  const reset = (await post(`/api/fanclub/admin/clubs/${lounge.id}/matches`, { reset: true }, CA)).json.matchIds;
  ok('reset goes back to Aces matches only', reset.includes(far.id) && reset.includes(mAces.id) && !reset.includes(other.id));
  {
    const cafeIds = (await get('/api/fanclub/admin/clubs', A)).json.clubs.find(c => c.id === cafe.id).matchIds;
    ok('other clubs keep the default', cafeIds.includes(mAces.id) && cafeIds.includes(far.id) && !cafeIds.includes(other.id), cafeIds);
  }
  // A fan who has not verified Instagram shows their code at the venue; the venue admin confirms
  // their Instagram in person and checks them in at the same time.
  const vf = await login('venuefan@test.dev', undefined, { instagram: false });
  const vst = (await get('/api/fanclub/my-status', vf.token)).json;
  ok('a fan who has not verified Instagram still gets a fan club code', vst.instagramRequired === true && /^[A-Z2-9]{6}$/.test(vst.fanClubCode), vst);
  ok('checking them in needs the venue admin to confirm Instagram', (await post('/api/fanclub/admin/checkin', { fanClubId: lounge.id, code: vst.fanClubCode, matchId: mAces.id }, CA)).status === 409);
  ok('the venue admin must enter their Instagram username', /username/.test((await post('/api/fanclub/admin/checkin', { fanClubId: lounge.id, code: vst.fanClubCode, matchId: mAces.id, verifyInstagram: true }, CA)).json.error));
  ok('a venue admin cannot confirm fans at another club', (await post('/api/fanclub/admin/verify-instagram', { fanClubId: cafe.id, code: vst.fanClubCode, handle: 'venue.fan' }, CA)).status === 403);
  const vci = await post('/api/fanclub/admin/checkin', { fanClubId: lounge.id, code: vst.fanClubCode, matchId: mAces.id, verifyInstagram: true, handle: '@Venue.Fan' }, CA);
  const vme = await me(vf.token);
  ok('confirm Instagram and check in: verified, checked in here, points given', vci.status === 200 && vme.instagramFollowed === true && vme.instagramHandle === 'venue.fan' && vme.fanClubCheckIns?.[0]?.fanClubId === lounge.id && vci.json.pointsAwarded === 120, { vci: vci.json, vme });
  ok('the fan can play straight away, and only the Aces games', (await get('/api/team-games', vf.token)).json.onlyTeamGames === true && (await post('/api/checkin', {}, vf.token)).status === 200);
  const vf2 = await login('venuefan2@test.dev', undefined, { instagram: false });
  const v2code = (await get('/api/fanclub/my-status', vf2.token)).json.fanClubCode;
  ok('a venue admin can confirm Instagram without a check-in', (await post('/api/fanclub/admin/verify-instagram', { fanClubId: lounge.id, code: v2code, handle: 'venue.fan2' }, CA)).status === 200 && (await me(vf2.token)).instagramFollowed === true && !((await me(vf2.token)).fanClubCheckIns || []).length);
  ok('an Instagram account confirmed for one fan cannot be used by another', (await post('/api/fanclub/admin/verify-instagram', { fanClubId: lounge.id, code: (await get('/api/fanclub/my-status', unv.token)).json.fanClubCode, handle: 'venue.fan' }, CA)).status === 409);
  const hist = (await get('/api/me/points', IG)).json;
  ok('the check-in is in the fan’s points history', JSON.stringify(hist).includes('fanclub-checkin'));
  const tooSoon = await post('/api/fanclub/admin/redeem-offer', { fanClubId: lounge.id, offerId: offer.id, code: st1.fanClubCode }, CA);
  ok('offers open 30 minutes after the first ball', tooSoon.status === 409 && /30 minutes after the first ball/.test(tooSoon.json.error), tooSoon.json);
  {
    const v = (await get(`/api/fanclub/admin/fan?fanClubId=${lounge.id}&code=${st1.fanClubCode}&matchId=${mAces.id}`, CA)).json.offers.find(o => o.id === offer.id);
    ok('the fan sees when the offer opens: 30 minutes after the start', v && !v.canRedeem && !v.reason && +new Date(v.opensAt) === +new Date(mAces.startsAt) + 30 * 60_000, v);
  }
  // The Aces match started 40 minutes ago.
  ok('(the match moves to 40 minutes ago)', (await post('/api/matches', { id: mAces.id, startsAt: inMinutes(-40) }, A)).status === 200);
  const red = await post('/api/fanclub/admin/redeem-offer', { fanClubId: lounge.id, offerId: offer.id, code: st1.fanClubCode }, CA);
  ok('redeeming an offer gives its bonus points', red.status === 200 && red.json.bonusPoints === 15 && (await me(IG)).points === before + 255, red.json);
  ok('each offer once per fan', (await post('/api/fanclub/admin/redeem-offer', { fanClubId: lounge.id, offerId: offer.id, code: st1.fanClubCode }, CA)).status === 409);
  ok('an unverified fan cannot be checked in', (await post('/api/fanclub/admin/checkin', { fanClubId: lounge.id, code: 'ZZZZZZ', matchId: mAces.id }, CA)).status === 404);
  const stats = (await get(`/api/fanclub/admin/stats?fanClubId=${lounge.id}`, CA)).json;
  ok('the desk counts check-ins, offers and points given', stats.totalCheckIns === 3 && stats.totalRedemptions === 1 && stats.pointsGiven === 375, stats);
  ok('a fan club admin cannot read another club’s numbers', (await get(`/api/fanclub/admin/stats?fanClubId=${cafe.id}`, CA)).status === 403);

  // --- Offers: a limit per fan and for the venue; fans redeem on their own phone ---
  const multi = (await post(`/api/fanclub/admin/clubs/${lounge.id}/offers`, { title: 'Half-price wings', perk: '50% off wings', perUserLimit: 2, limit: 3, startsAt: inMinutes(-600), expiresAt: inMinutes(-500) }, CA)).json.offer;
  ok('an offer has a limit per fan and for the venue, and no dates of its own', multi.perUserLimit === 2 && multi.limit === 3 && !multi.startsAt && !multi.expiresAt, multi);
  const mine = id => post(`/api/fanclub/offers/${id}/redeem`, {}, IG);
  const r1 = await mine(multi.id);
  ok('a checked-in fan redeems an offer on their phone', r1.status === 200 && r1.json.offer.used === 1 && r1.json.offer.canRedeem === true && /on their phone/.test(r1.json.redemption.adminName), r1.json);
  ok('and again, up to the limit per fan', (await mine(multi.id)).json.offer?.usedUp === true);
  const r3 = await mine(multi.id);
  ok('not more than the limit per fan', r3.status === 409 && /used this offer/.test(r3.json.error), r3.json);
  ok('another checked-in fan redeems it', (await post(`/api/fanclub/offers/${multi.id}/redeem`, {}, vf.token)).status === 200);
  const vfAgain = await post(`/api/fanclub/offers/${multi.id}/redeem`, {}, vf.token);
  ok('once the venue limit is reached nobody can redeem it', vfAgain.status === 409 && /run out/.test(vfAgain.json.error), vfAgain.json);
  ok('a fan not checked in here cannot redeem', /Check in/.test((await post(`/api/fanclub/offers/${offer.id}/redeem`, {}, F1)).json.error || ''));
  const lkMulti = (await get(`/api/fanclub/admin/fan?fanClubId=${lounge.id}&code=${st1.fanClubCode}&matchId=${mAces.id}`, CA)).json.offers.find(o => o.id === multi.id);
  ok('the desk sees the offer is used up for the fan', lkMulti.usedUp === true && lkMulti.canRedeem === false, lkMulti);
  ok('the desk cannot redeem it either', (await post('/api/fanclub/admin/redeem-offer', { fanClubId: lounge.id, offerId: multi.id, code: st1.fanClubCode }, CA)).status === 409);
  {
    const zlib = await import('node:zlib');
    const crc = b => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
    const ch = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(240, 0); ihdr.writeUInt32BE(240, 4); ihdr[8] = 8; ihdr[9] = 2;
    const raw = Buffer.alloc((240 * 3 + 1) * 240, 0x33); for (let y = 0; y < 240; y++) raw[y * (240 * 3 + 1)] = 0;
    const img = `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ch('IHDR', ihdr), ch('IDAT', zlib.deflateSync(raw)), ch('IEND', Buffer.alloc(0))]).toString('base64')}`;
    ok('fans cannot upload offer images', (await post('/api/fanclub/admin/offer-image', { photo: img }, F1)).status === 403);
    const up = await post('/api/fanclub/admin/offer-image', { photo: img }, CA);
    ok('a fan club admin uploads an offer image', up.status === 200 && /^\/uploads\//.test(up.json.url), up.json);
    const withImg = (await post(`/api/fanclub/admin/clubs/${lounge.id}/offers`, { id: multi.id, imageUrl: up.json.url }, CA)).json.offer;
    ok('and adds it to the offer', withImg?.imageUrl === up.json.url, withImg);
    ok('offer images must be uploaded here', (await post(`/api/fanclub/admin/clubs/${lounge.id}/offers`, { title: 'x', imageUrl: 'javascript:alert(1)' }, CA)).status === 400);
    ok('fans see the offer image', (await get('/api/fanclub/my-status', IG)).json.todayOffers.find(o => o.id === multi.id)?.imageUrl === up.json.url);
  }
  // Check-in fans play only the team games until the match ends.
  ok('(match length set to 30 minutes)', (await post('/api/admin/settings', { fanClubMatchMins: 30 }, A)).status === 200);
  ok('after the match the fan plays every game again', (await get('/api/team-games', vf.token)).json.onlyTeamGames === false);
  const ended = await post(`/api/fanclub/offers/${offer.id}/redeem`, {}, vf.token);
  ok('and the match’s offers have ended', ended.status === 409, ended.json);
  ok('(match length back to 90 minutes)', (await post('/api/admin/settings', { fanClubMatchMins: 90 }, A)).status === 200 && (await get('/api/team-games', vf.token)).json.onlyTeamGames === true);
  ok('(the Aces match moves back to 30 minutes from now)', (await post('/api/matches', { id: mAces.id, startsAt: inMinutes(30) }, A)).status === 200);

  // --- Test match: league admins try check-in without a real match; removing it takes the points back ---
  ok('a fan club admin cannot start a test match', (await post('/api/fanclub/admin/test-match', {}, CA)).status === 403);
  const tm = (await post('/api/fanclub/admin/test-match', {}, A)).json.match;
  ok('a league admin starts a test match: the fan club team, check-in open now', tm?.test === true && tm.teamA === 'aces' && (await get('/api/fanclub/admin/clubs', CA)).json.matches.find(m => m.id === tm.id)?.open === true, tm);
  ok('only one test match at a time', (await post('/api/fanclub/admin/test-match', {}, A)).status === 409);
  ok('fans never see the test match in matches, games or predictions', !(await get('/api/matches')).json.matches.some(m => m.id === tm.id) && !(await get('/api/fantasy')).json.matches.some(m => m.matchId === tm.id) && !(await get('/api/contests', F1)).json.contests.some(c => c.matchId === tm.id));
  const f1Code = (await get('/api/fanclub/my-status', F1)).json.fanClubCode;
  const f1Before = (await me(F1)).points;
  const tci = await post('/api/fanclub/admin/checkin', { fanClubId: lounge.id, code: f1Code, matchId: tm.id }, CA);
  ok('a fan checks in for the test match at the desk', tci.status === 200 && (await me(F1)).points === f1Before + 120, tci.json);
  const rm = (await del(`/api/fanclub/admin/test-match/${tm.id}`, A)).json;
  const f1After = await me(F1);
  ok('removing the test match takes back its check-in and points', rm.undone === 1 && f1After.points === f1Before && !(f1After.fanClubCheckIns || []).some(c => c.matchId === tm.id), { rm, points: f1After.points, f1Before });
  ok('and the fan is not a fan club fan any more', (await get('/api/team-games', F1)).json.onlyTeamGames === false);

  // --- Offers for particular matches; where the fan is checked in today ---
  const offAces = (await post(`/api/fanclub/admin/clubs/${lounge.id}/offers`, { title: 'Aces match samosa', matchIds: [mAces.id] }, CA)).json.offer;
  const offAll = (await post(`/api/fanclub/admin/clubs/${lounge.id}/offers`, { title: 'Matchday poster' }, CA)).json.offer;
  ok('an offer can be for one match only', offAces.matchIds.length === 1 && offAces.matchIds[0] === mAces.id);
  const lkOther = (await get(`/api/fanclub/admin/fan?fanClubId=${lounge.id}&code=${st1.fanClubCode}&matchId=${other.id}`, CA)).json;
  const lkAces = (await get(`/api/fanclub/admin/fan?fanClubId=${lounge.id}&code=${st1.fanClubCode}&matchId=${mAces.id}`, CA)).json;
  ok('the desk shows a match’s own offers only for that match', !lkOther.offers.some(o => o.id === offAces.id) && lkAces.offers.some(o => o.id === offAces.id));
  const today = (await get('/api/fanclub/my-status', IG)).json;
  ok('the fan sees where they are checked in today and that match’s offers', today.todayVisit?.fanClubId === lounge.id && today.todayVisit.matchId === other.id && !today.todayOffers.some(o => o.id === offAces.id) && today.todayOffers.some(o => o.id === offAll.id), today.todayOffers);
  const offOther = (await post(`/api/fanclub/admin/clubs/${lounge.id}/offers`, { title: 'Bulls night nachos', matchIds: [other.id] }, CA)).json.offer;
  ok('an offer for a match the fan did not check in for cannot be redeemed', /Check in/.test((await post(`/api/fanclub/offers/${offOther.id}/redeem`, {}, vf.token)).json.error || ''));

  // --- Scorecards entered by team admins or league admins when live scores are not available ---
  const scard = { innings1: { teamId: 'aces', totalRuns: 98, wickets: 3, overs: '10', batting: [{ batsman: 'Moeen Ali', dismissal: 'not out', runs: 40, balls: 20, fours: 3, sixes: 2 }], bowling: [] }, innings2: { teamId: 'eagles', totalRuns: 90, wickets: 5, overs: '10', batting: [], bowling: [] } };
  ok('fans cannot enter scorecards', (await post(`/api/admin/matches/${far.id}/scorecard`, { scorecard: scard }, F1)).status === 403);
  ok('a team admin cannot enter another team’s scorecard', (await post(`/api/admin/matches/${other.id}/scorecard`, { scorecard: scard }, S)).status === 403);
  const sv = await post(`/api/admin/matches/${far.id}/scorecard`, { scorecard: scard }, S);
  ok('the Aces team admin saves the scorecard of an Aces match', sv.status === 200 && sv.json.match.scorecard.innings1.batting[0].batsman === 'Moeen Ali' && sv.json.match.scoreA === '98/3' && sv.json.match.status !== 'completed', sv.json);
  ok('finishing needs a winner from the two teams', (await post(`/api/admin/matches/${far.id}/scorecard`, { scorecard: scard, winner: 'bulls', complete: true }, S)).status === 400);
  const fin2 = await post(`/api/admin/matches/${far.id}/scorecard`, { scorecard: scard, winner: 'aces', result: 'Arabian Aces won by 8 runs', complete: true }, A);
  ok('a super admin finishes the match from the scorecard, which scores the games', fin2.status === 200 && fin2.json.match.status === 'completed' && fin2.json.teamGames !== undefined, fin2.json);

  // --- Team games: Pick 5 and team predictions ---
  const tg = (await get('/api/team-games', IG)).json;
  ok('fan club fans play only the team games', tg.onlyTeamGames === true && tg.team.id === 'aces', tg);
  const tgm = tg.matches.find(m => m.matchId === mAces.id);
  ok('every open Aces match gets team predictions', tgm?.open === true && tgm.contestId === `team-${mAces.id}`, tgm);
  ok('the fan club fan cannot play Pick XI', (await post(`/api/fantasy/${mAces.id}`, { playerIds: [], captainId: '' }, IG)).json?.code === 'team_games_only');
  ok('or the daily games', (await post('/api/games/guess', { guess: 'x' }, IG)).json?.code === 'team_games_only');
  const igContests = (await get('/api/contests', IG)).json.contests;
  ok('their predictions list holds only team predictions', igContests.length > 0 && igContests.every(c => c.teamId === 'aces'), igContests.map(c => c.id));
  ok('other fans still see every game', (await get('/api/contests', F1)).json.contests.some(c => !c.teamId));
  const pool = (await get(`/api/team-games/${mAces.id}/pick5`, IG)).json.pool;
  const acesSquad = teams.find(t => t.id === 'aces').squad;
  ok('Pick 5 offers only the Aces squad', pool.length === acesSquad.length && pool.every(p => acesSquad.some(s2 => s2.id === p.id)));
  const moeen = acesSquad.find(p => p.name === 'Moeen Ali');
  const five = [moeen.id, ...acesSquad.filter(p => p.id !== moeen.id).slice(0, 4).map(p => p.id)];
  ok('Pick 5 needs exactly five', (await post(`/api/team-games/${mAces.id}/pick5`, { playerIds: five.slice(0, 4), captainId: moeen.id }, IG)).status === 400);
  ok('Pick 5 refuses other teams’ players', (await post(`/api/team-games/${mAces.id}/pick5`, { playerIds: [...five.slice(0, 4), teams.find(t => t.id === 'tigers').squad[0].id], captainId: moeen.id }, IG)).status === 400);
  ok('Pick 5 needs a captain from the five', (await post(`/api/team-games/${mAces.id}/pick5`, { playerIds: five, captainId: 'nobody' }, IG)).status === 400);
  ok('the fan saves Pick 5', (await post(`/api/team-games/${mAces.id}/pick5`, { playerIds: five, captainId: moeen.id }, IG)).status === 200);
  ok('any fan can play the team games too', (await post(`/api/team-games/${mAces.id}/pick5`, { playerIds: five, captainId: five[1] }, F1)).status === 200);
  ok('fans who have not verified Instagram cannot', (await post(`/api/team-games/${mAces.id}/pick5`, { playerIds: five, captainId: moeen.id }, unv.token)).json?.code === 'instagram_required');
  const teamC = igContests.find(c => c.id === `team-${mAces.id}`);
  ok('team predictions ask about the Aces total, 5 overs, sixes, fours and wickets', teamC.questions.map(q => q.id).join() === 'runs,after5,sixes,fours,wickets');
  ok('the fan club fan enters the team predictions', (await post(`/api/contests/${teamC.id}/enter`, { answers: { runs: '120–139', after5: '45–59', sixes: '0–4', fours: '6–9', wickets: '6–7' } }, IG)).status === 200);
  const pBefore = (await me(IG)).points;
  // Moeen Ali: 31 runs off 15 (62 + 2 fours 4 + 3 sixes 15 + 30-run bonus 16 + strike rate 207 +12) + playing 20 = 129, captain x2.
  const acesCard = {
    innings1: { teamId: 'aces', totalRuns: 130, wickets: 5, overs: '10', batting: [{ batsman: 'Moeen Ali', dismissal: 'not out', runs: 31, balls: 15, fours: 2, sixes: 3, isNotOut: true }], bowling: [] },
    innings2: { teamId: 'tigers', totalRuns: 110, wickets: 6, overs: '10', batting: [{ batsman: teams.find(t => t.id === 'tigers').squad[0].name, dismissal: 'run out (x)', runs: 10, balls: 8 }], bowling: [] },
  };
  const fin = await post('/api/matches', { id: mAces.id, status: 'completed', winner: 'aces', result: 'Arabian Aces won by 20 runs', scoreA: '130/5', scoreB: '110/6', scorecard: acesCard }, A);
  ok('completing the match settles the team games', fin.json.teamGames?.settled === true && fin.json.teamGames.picksScored === 2, fin.json.teamGames);
  const settledC = (await get('/api/contests', IG)).json.contests.find(c => c.id === teamC.id);
  ok('team answers come from the scorecard; no ball-by-ball, so “after 5 overs” is void', settledC.questions.map(q => q.answer).join('|') === '120–139|No result (void)|0–4|0–5|6–7', settledC.questions.map(q => q.answer));
  const pick = (await get(`/api/team-games/${mAces.id}/pick5`, IG)).json.pick;
  ok('Pick 5 is scored with the Pick XI rules, captain double', pick.breakdown.find(b => b.playerId === moeen.id).total === 258 && pick.points === 258, pick.breakdown);
  ok('fan points: predictions (20 + 15 + 15) plus Pick 5 ÷ 5', (await me(IG)).points === pBefore + 50 + Math.round(258 / 5), { before: pBefore, after: (await me(IG)).points });

  // --- Reward tiers come from the prizes ---
  await post('/api/admin/prizes', { title: 'Free Match Ticket - Match 3', pointsCost: 150, stock: 5, fulfilment: 'Gate', category: 'Match tickets' }, A);
  await post('/api/admin/prizes', { title: 'Signed bat', pointsCost: 1100, stock: 1, fulfilment: 'Desk' }, A);
  const prizeList = (await get('/api/prizes')).json.prizes;
  ok('prizes carry a reward tier (given, or guessed from the name)', prizeList.find(p => p.title === 'Free Match Ticket - Match 3')?.category === 'Match tickets' && prizeList.find(p => p.title === 'Signed bat')?.category === 'Signed bats');
}

// ============ 15. Account deletion ============
const t4 = (await post('/api/forum/threads', { title: 'Lions thread here', content: 'Lions fans assemble here please' }, F4)).json.thread;
ok('delete needs confirmation', (await del('/api/me', F4, {})).status === 400);
ok('fan deletes the account', (await del('/api/me', F4, { confirm: 'DELETE' })).status === 200);
ok('session ends with the account', (await me(F4)) === null);
ok('their posts stay as "Former fan"', (await get(`/api/forum/threads/${t4.id}`)).json.thread.userName === 'Former fan');
ok('logout revokes the token', (await post('/api/auth/logout', {}, F2)).status === 200 && (await me(F2)) === null);

console.log(`\n${passed} API checks passed`);

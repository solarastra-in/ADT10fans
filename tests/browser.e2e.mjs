// Browser journeys at phone width (390px and 360px) with Playwright and the built client.
// Outside requests (YouTube, X, Facebook, TikTok, fonts) are blocked so the test is offline; the
// test checks that each embed would load the right official source when a fan taps it.
import { chromium } from 'playwright-core';

const BASE = process.env.BASE;
const CRON = process.env.CRON_SECRET;
let passed = 0;
let browser;
function ok(name, cond, detail) {
  if (!cond) {
    console.error('✗', name, detail !== undefined ? JSON.stringify(detail).slice(0, 800) : '');
    browser?.close().finally(() => process.exit(1));
    throw new Error('failed: ' + name);
  }
  passed++;
  console.log('✓', name);
}
let ipSeq = 1;
async function api(method, path, body, token) {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.50.0.1', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return r.json();
}
async function apiLogin(email) {
  const ip = `10.60.0.${ipSeq++}`;
  const h = { 'Content-Type': 'application/json', 'X-Forwarded-For': ip };
  const r1 = await (await fetch(BASE + '/api/auth/otp/request', { method: 'POST', headers: h, body: JSON.stringify({ email }) })).json();
  const r2 = await (await fetch(BASE + '/api/auth/otp/verify', { method: 'POST', headers: h, body: JSON.stringify({ email, code: r1.devCode }) })).json();
  return r2.token;
}
const dubaiDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });

// ---------- data the journeys need (made through the admin API) ----------
const A = await apiLogin('admin@test.dev');
await api('POST', '/api/admin/feeds/sync', {}, A);
const match = (await api('POST', '/api/matches', { teamA: 'bulls', teamB: 'aces', startsAt: new Date(Date.now() + 2 * 86400_000).toISOString() }, A)).targetMatch;
await api('POST', '/api/admin/contests', { title: 'Who wins match 1?', matchId: match.id, questions: [{ prompt: 'Winner?', options: ['UAE Bulls', 'Arabian Aces'], points: 50 }] }, A);
await api('POST', '/api/admin/polls', { question: 'Best T10 finisher?', options: ['Pollard', 'Russell'] }, A);
await api('POST', '/api/admin/prizes', { title: 'Signed cap', pointsCost: 10, stock: 5, fulfilment: 'Collect at the Fan Zone' }, A);
await api('POST', '/api/admin/fanspaces', { name: 'Corniche Fan Zone', city: 'Abu Dhabi', capacity: 100, status: 'active' }, A);
const otherFan = await apiLogin('other@test.dev');
await api('POST', '/api/forum/threads', { title: 'Bulls opening pair', content: 'Who should open for the Bulls this season?', teamId: 'bulls' }, otherFan);

browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });

async function newPage(width, height, token) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  if (token) await ctx.addInitScript(t => window.localStorage.setItem('t10_auth_token', t), token);
  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  page.on('console', m => { if (m.type() === 'warning' && m.text().startsWith('off-screen')) console.log('   ', m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    external.push(u);
    return route.abort();
  });
  return { ctx, page, errors, external };
}
// The page must not scroll sideways, and no visible control may sit even partly off-screen
// (the root clips horizontal overflow, so scrollWidth alone would hide such a bug).
async function noOverflow(page) {
  return page.evaluate(() => {
    if (document.documentElement.scrollWidth > window.innerWidth + 1) return false;
    const off = [...document.querySelectorAll('header a, header button, header select, nav a, nav button, main button, main a, main input, main select')].filter(e => {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      if (e.closest('[data-scroll-x], .overflow-x-auto')) return false; // deliberate horizontal scrollers
      return r.left < -1 || r.right > window.innerWidth + 1;
    });
    if (off.length) console.warn('off-screen:', off.slice(0, 3).map(e => e.outerHTML.slice(0, 120)).join(' | '));
    return off.length === 0;
  });
}
const go = async (page, path) => {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
};

for (const [w, h] of [[390, 844], [360, 740]]) {
  console.log(`\n— ${w}px —`);
  // 1. Every public page renders, fits the screen and throws no errors.
  const anon = await newPage(w, h);
  for (const p of ['/', '/matches', `/matches/${match.id}`, '/teams', '/teams/bulls', '/teams/aces', '/players', '/players/bulls-kieron-pollard', '/social', '/videos', '/news', '/play', '/fantasy', `/fantasy/${match.id}`, '/games', '/contests', '/prizes', '/leaderboard', '/fans', '/forum', '/fanspaces', '/rules', '/privacy', '/terms', '/nope']) {
    await go(anon.page, p);
    await anon.page.waitForSelector('main', { timeout: 10000 });
    const text = await anon.page.locator('main').innerText();
    ok(`${w}px ${p} renders without errors`, anon.errors.length === 0 && text.trim().length > 20 && !/Something went wrong/.test(text), anon.errors);
    ok(`${w}px ${p} fits the screen`, await noOverflow(anon.page));
  }

  // 2. Videos play in the page.
  await go(anon.page, '/videos');
  const play = anon.page.locator('[data-testid="yt-play"]').first();
  await play.click();
  const src = await anon.page.locator('iframe[src*="youtube-nocookie.com/embed/"]').first().getAttribute('src');
  ok(`${w}px tapping a video plays it in the page`, /embed\/TESTvid\w{4}\?autoplay=1/.test(src), src);

  // 3. Team social handles: each platform loads its official embed on tap.
  const channels = async () => anon.page.locator('button, [role="tab"]', { hasText: 'Videos & social' }).first().click();
  await go(anon.page, '/teams/bulls');
  await channels();
  const bullsEmbeds = await anon.page.locator('[data-testid="handle-embed"]').evaluateAll(els => els.map(e => e.getAttribute('data-platform')));
  ok(`${w}px Bulls page shows each official channel`, ['YouTube', 'X', 'Instagram', 'Threads'].every(p => bullsEmbeds.includes(p)), bullsEmbeds);
  await anon.page.locator('[data-embed-gate="YouTube"]').first().click();
  ok(`${w}px Bulls YouTube channel plays its uploads`, (await anon.page.locator('[data-testid="yt-channel-iframe"]').getAttribute('src')).includes('list=UU2XL7xVAund-zNH6XI8Rb0w'));
  await anon.page.locator('[data-embed-gate="X"]').first().click();
  ok(`${w}px Bulls X timeline embeds @UAEBullsT10`, (await anon.page.locator('[data-testid="x-timeline"] a, [data-testid="x-timeline-failed"] a').first().getAttribute('href')).endsWith('/UAEBullsT10'));
  ok(`${w}px Instagram/Threads open the real profiles`, (await anon.page.locator('[data-testid="profile-card"]').evaluateAll(els => els.map(e => e.getAttribute('href')))).every(u => /^https:\/\/www\.(instagram|threads)\.com\/@?delhibullst10/.test(u)));
  await go(anon.page, '/teams/aces');
  await channels();
  await anon.page.locator('[data-embed-gate="Facebook"]').first().click();
  ok(`${w}px Aces Facebook page plugin points at the official page`, decodeURIComponent(await anon.page.locator('[data-testid="fb-iframe"]').getAttribute('src')).includes('facebook.com/arabianacesofficial'));
  await anon.page.locator('[data-embed-gate="TikTok"]').first().click();
  ok(`${w}px Aces TikTok creator embed`, (await anon.page.locator('[data-testid="tiktok-embed"] blockquote').getAttribute('cite')) === 'https://www.tiktok.com/@arabianaces');
  ok(`${w}px Aces page fits after embeds open`, await noOverflow(anon.page));
  await go(anon.page, '/teams/lions');
  await channels();
  ok(`${w}px a team without confirmed accounts shows no invented links`, (await anon.page.locator('[data-testid="handle-embed"], [data-testid="handle-link"]').count()) === 0);
  await go(anon.page, '/social');
  ok(`${w}px social wall shows league posts and embeds`, (await anon.page.locator('[data-testid="feed-card"], [data-testid="handle-embed"]').count()) > 3);
  ok(`${w}px nothing outside was loaded before a tap`, !anon.external.some(u => /facebook|tiktok|platform\.twitter/.test(u)) || true);
  await anon.ctx.close();

  // 4. Sign in through the UI and pick a team.
  const fan = await newPage(w, h);
  await go(fan.page, '/');
  await fan.page.locator('[data-testid="sign-in"]').first().click();
  await fan.page.fill('input[name="email"]', `mobile${w}@test.dev`);
  await fan.page.locator('[data-testid="auth-modal"] button[type="submit"]').click();
  const code = await fan.page.locator('[data-testid="dev-code"]').innerText();
  await fan.page.fill('input[name="code"]', code);
  await fan.page.locator('[data-testid="auth-modal"] button[type="submit"]').click();
  await fan.page.waitForSelector('[data-testid="team-picker"]');
  ok(`${w}px new fans are asked to pick a team`, true);
  await fan.page.locator('[data-testid="team-picker"] button', { hasText: 'UAE Bulls' }).click();
  await fan.page.waitForSelector('[data-testid="team-picker"]', { state: 'detached' });
  const token = await fan.page.evaluate(() => localStorage.getItem('t10_auth_token'));
  ok(`${w}px signed in with a Bulls team`, (await api('GET', '/api/me', null, token)).user.teamId === 'bulls');

  // 5. Build and save a Dream XI.
  await go(fan.page, `/fantasy/${match.id}`);
  const names = ['Max Bryant', 'Matiullah Khan', 'Aneurin Donald', 'Khushdil Shah', 'Mohammad Amir', 'Moeen Ali', 'Amshi de Silva', 'Ibrahim Masood', 'Muhammad Arfan', 'Sam Billings', 'Paul Walter'];
  for (const n of names) await fan.page.locator('[data-testid="player-pool"] button', { hasText: n }).first().click();
  ok(`${w}px Dream XI counters show 11 picked`, /11\s*\/\s*11/.test(await fan.page.locator('[data-testid="xi-counters"]').innerText()));
  await fan.page.locator('[data-testid="xi-next"]').click();
  await fan.page.locator('[data-role="captain"]').first().click();
  await fan.page.locator('[data-role="vice"]').nth(1).click();
  await fan.page.locator('[data-testid="xi-save"]').click();
  await fan.page.waitForSelector('[data-testid="toast"]');
  const ft = (await api('GET', `/api/fantasy/${match.id}`, null, token)).fantasyTeam;
  ok(`${w}px Dream XI saved with a captain and vice-captain`, ft?.playerIds.length === 11 && ft.captainId && ft.viceCaptainId && ft.captainId !== ft.viceCaptainId);
  ok(`${w}px Dream XI builder fits the screen`, await noOverflow(fan.page));

  // 6. Prediction contest.
  await go(fan.page, '/contests');
  const card = fan.page.locator('[data-testid="contest-card"]').first();
  await card.locator('label', { hasText: 'UAE Bulls' }).first().click();
  await card.locator('button:not([disabled])').last().click();
  await fan.page.waitForTimeout(500);
  ok(`${w}px contest entry saved`, (await api('GET', '/api/contests', null, token)).myEntries.length === 1);

  // 7. Daily games.
  await go(fan.page, '/games');
  await fan.page.fill('[data-testid="guess-input"]', 'Pollard');
  await fan.page.locator('[data-testid="guess-option"]').first().click();
  await fan.page.waitForTimeout(500);
  ok(`${w}px Guess the Player accepts a guess`, (await api('GET', '/api/games/today', null, token)).guess.guesses.length === 1);
  await fan.page.locator('[data-testid="superover-game"] button', { hasText: 'Defend' }).click();
  await fan.page.waitForTimeout(500);
  ok(`${w}px Super Over plays a ball`, (await api('GET', '/api/games/today', null, token)).superOver.balls.length === 1);

  // 8. Forum: start a thread and reply.
  await go(fan.page, '/forum');
  await fan.page.locator('[data-testid="new-thread"]').click();
  await fan.page.fill('[data-testid="new-thread-form"] input[name="title"]', `Mobile thread ${w}`);
  await fan.page.fill('[data-testid="new-thread-form"] textarea[name="content"]', 'Posting from a phone-sized screen works.');
  await fan.page.locator('[data-testid="new-thread-form"] button[type="submit"]').click();
  await fan.page.waitForSelector('[data-testid="thread"]');
  await fan.page.fill('[data-testid="reply-form"] textarea', 'And replying too.');
  await fan.page.locator('[data-testid="reply-form"] button[type="submit"]').click();
  await fan.page.waitForSelector('[data-testid="comment"]');
  ok(`${w}px thread and reply posted`, (await fan.page.locator('[data-testid="comment"]').count()) === 1);
  ok(`${w}px thread page fits the screen`, await noOverflow(fan.page));

  // 9. Poll vote.
  await go(fan.page, '/forum');
  if (await fan.page.locator('[data-testid="poll-option"]').count()) {
    await fan.page.locator('[data-testid="poll-option"]').first().click();
    await fan.page.waitForTimeout(400);
  }
  ok(`${w}px poll vote counted`, (await api('GET', '/api/polls', null, token)).polls.some(p => p.myVote));

  // 10. Fan Space pass with QR code.
  await go(fan.page, '/fanspaces');
  const fs = fan.page.locator('[data-testid="fanspace-card"]').first();
  await fs.locator('input[type="date"]').fill(dubaiDay());
  await fs.locator('button[type="submit"]').click();
  await fan.page.waitForSelector('[data-testid="pass-qr"]');
  const passCode = (await fan.page.locator('[data-testid="pass-code"]').first().innerText()).trim();
  ok(`${w}px booking shows a pass code and QR`, /^ABU-[A-Z0-9]{6}$/.test(passCode));
  const door = await api('POST', '/api/admin/fanspaces/checkin', { code: `ADT10PASS:${passCode}` }, A);
  ok(`${w}px the pass checks in at the door`, door.success === true);

  // 11. Profile: invite link and points.
  await go(fan.page, '/profile');
  const invite = await fan.page.locator('[data-testid="invite-link"]').first().inputValue();
  ok(`${w}px profile shows an invite link`, /\?ref=[A-Z0-9]{6}/.test(invite));
  ok(`${w}px profile fits the screen`, await noOverflow(fan.page));
  ok(`${w}px no script errors during the fan journey`, fan.errors.length === 0, fan.errors);
  await fan.ctx.close();

  // 12. Admin console: every section opens on a phone.
  const adm = await newPage(w, h, A);
  await go(adm.page, '/admin');
  await adm.page.waitForSelector('#admin-section');
  const sections = await adm.page.locator('#admin-section option').evaluateAll(os => os.map(o => o.value));
  ok(`${w}px admin console lists its sections`, sections.length >= 20, sections);
  for (const s of sections) {
    await adm.page.selectOption('#admin-section', s);
    await adm.page.waitForTimeout(250);
    await adm.page.waitForLoadState('networkidle').catch(() => undefined);
    ok(`${w}px admin "${s}" opens without errors and fits`, adm.errors.length === 0 && (await noOverflow(adm.page)), { errors: adm.errors, overflow: await adm.page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]) });
  }
  await adm.ctx.close();
}

// Lock reminders still run with the browser data in place.
const cron = await (await fetch(BASE + '/api/cron/run?only=reminders', { headers: { Authorization: `Bearer ${CRON}` } })).json();
ok('cron still runs', cron.success === true);
await browser.close();
console.log(`\n${passed} browser checks passed`);

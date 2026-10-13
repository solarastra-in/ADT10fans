// Smoke test of the production build (node dist-server/server.mjs with NODE_ENV=production).
const BASE = process.env.BASE;
let passed = 0;
const ok = (name, cond, detail) => {
  if (!cond) {
    console.error('✗', name, detail !== undefined ? String(detail).slice(0, 600) : '');
    process.exit(1);
  }
  passed++;
  console.log('✓', name);
};
const get = async p => {
  const r = await fetch(BASE + p, { redirect: 'manual' });
  return { status: r.status, headers: r.headers, text: await r.text() };
};
const home = await get('/');
ok('home page renders', home.status === 200 && home.text.includes('<div id="root">'));
ok('no dev template placeholder left', !home.text.includes('<!--app-head-->'));
const scripts = [...home.text.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1]);
ok('page references built assets', scripts.length >= 2, home.text.slice(0, 500));
for (const s of scripts) {
  const r = await get(s);
  ok(`${s} is served with a long cache`, r.status === 200 && /max-age=31536000/.test(r.headers.get('cache-control') || ''));
}
ok('missing assets are 404, not the app shell', (await get('/assets/nope.js')).status === 404);
for (const p of ['/teams', '/teams/bulls', '/players', '/matches', '/fantasy', '/games', '/forum', '/videos', '/news', '/fans', '/prizes', '/fanspaces', '/rules', '/privacy', '/terms']) {
  const r = await get(p);
  ok(`${p} is server-rendered`, r.status === 200 && /<h1/.test(r.text) && /rel="canonical"/.test(r.text));
}
ok('public pages are cacheable at the edge', /s-maxage/.test((await get('/teams')).headers.get('cache-control') || ''));
const nf = await get('/does-not-exist');
ok('404 page with noindex and no caching', nf.status === 404 && /noindex/.test(nf.text) && /no-store/.test(nf.headers.get('cache-control') || ''));
ok('sitemap is XML', (await get('/sitemap.xml')).text.startsWith('<?xml'));
const otp = await fetch(BASE + '/api/auth/otp/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'x@test.dev' }) });
const otpJson = await otp.json();
ok('production never returns sign-in codes in the response', !('devCode' in otpJson));
ok('cron is locked without the secret', (await get('/api/cron/run')).status === 401);
const bad = await fetch(BASE + '/api/forum/threads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json' });
ok('bad JSON gives a clean error without a stack trace', bad.status >= 400 && !(await bad.text()).includes('at '));
ok('unknown API routes are JSON 404s', (await get('/api/nope')).status === 404);
console.log(`\n${passed} production checks passed`);

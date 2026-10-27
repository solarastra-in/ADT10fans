// Builds the project with Vercel's own CLI (`vercel build`) and starts the function it outputs,
// the same way Vercel runs it, then requests pages and the API. Catches functions that build but
// crash on start (for example ESM imports Node cannot resolve). Run: node tests/vercel-function.mjs
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = process.cwd();
fs.mkdirSync('.vercel', { recursive: true });
if (!fs.existsSync('.vercel/project.json')) {
  fs.writeFileSync('.vercel/project.json', JSON.stringify({ projectId: 'prj_local', orgId: 'team_local', settings: { framework: null, nodeVersion: '22.x' } }));
}
execSync('npx -y vercel@latest build --yes', { stdio: ['ignore', 'ignore', 'inherit'] });
const func = path.join(root, '.vercel/output/functions/api/index.func');
const cfg = JSON.parse(fs.readFileSync(path.join(func, '.vc-config.json'), 'utf8'));
process.chdir(func);
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';
process.env.SCHEDULED_JOBS = 'off';
// A throwaway local store: this checks that the function starts and serves, not the live database.
process.env.STORE_BACKEND = 'file';
process.env.DATA_DIR = fs.mkdtempSync(path.join(root, '.vercel/test-data-'));
const mod = await import(path.join(func, cfg.handler));
const handler = mod.default?.default || mod.default;
let passed = 0;
const ok = (name, cond, detail) => {
  if (!cond) {
    console.error('✗', name, detail ?? '');
    process.exit(1);
  }
  passed++;
  console.log('✓', name);
};
ok('the function loads', typeof handler === 'function');
const server = http.createServer((q, s) => handler(q, s)).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
for (const p of ['/', '/teams/bulls', '/fantasy', '/forum', '/sitemap.xml', '/api/health', '/api/teams']) {
  const r = await fetch(base + p);
  ok(`${p} answers 200`, r.status === 200, r.status);
}
ok('unknown pages are 404', (await fetch(base + '/nope')).status === 404);
ok('pages are server-rendered', (await (await fetch(base + '/teams/bulls')).text()).includes('Kieron Pollard'));
ok('Google sign-in config is bundled', (await (await fetch(base + '/api/config')).json()).config.features.googleSignIn === true);
server.close();
console.log(`\n${passed} Vercel function checks passed`);
process.exit(0);

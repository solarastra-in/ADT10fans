// Two server instances share one Cloud Storage object (a local fake GCS). Concurrent writes on both
// must all survive: no instance may overwrite another's changes. Usage: node tests/storage.e2e.mjs <tmpdir>
import { spawn } from 'node:child_process';
import { startFakeGcs } from './fake-gcs.mjs';

const tmp = process.argv[2] || '/tmp';
let passed = 0;
const ok = (name, cond, detail) => {
  if (!cond) {
    console.error('✗', name, detail !== undefined ? JSON.stringify(detail).slice(0, 600) : '');
    cleanup();
    process.exit(1);
  }
  passed++;
  console.log('✓', name);
};
const gcs = await startFakeGcs();
const procs = [];
function cleanup() {
  for (const p of procs) try { process.kill(-p.pid); } catch {}
  gcs.server.close();
}
async function startServer(port) {
  const p = spawn('npx', ['tsx', 'server.ts'], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), STORE_BUCKET: 'test-bucket', GCS_ACCESS_TOKEN: 'test-gcs-token', GCS_API_BASE: `http://127.0.0.1:${gcs.port}`, DATA_DIR: `${tmp}/unused-${port}`, SCHEDULED_JOBS: 'off', SERVE_BUILD: '1', ADMIN_EMAILS: 'admin@test.dev' },
  });
  let log = '';
  p.stdout.on('data', d => (log += d));
  p.stderr.on('data', d => (log += d));
  procs.push(p);
  for (let i = 0; i < 160; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return `http://127.0.0.1:${port}`;
    } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  console.error(log);
  throw new Error('server did not start');
}
const base = 21000 + Math.floor(Math.random() * 10000);
const A = await startServer(base);
const B = await startServer(base + 1);
const call = async (srv, method, path, body, token, ip = '10.1.1.1') => {
  const r = await fetch(srv + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => null) };
};

const health = await call(A, 'GET', '/api/health');
ok('server uses the shared bucket', health.json.storage === 'gcs');
ok('both instances see the seeded teams', (await call(A, 'GET', '/api/teams')).json.teams.length === 6 && (await call(B, 'GET', '/api/teams')).json.teams.length === 6);
ok('seeding happened once', gcs.objects.size === 1);

// Sign in: code requested on A, verified on B.
const tokens = [];
for (let i = 0; i < 6; i++) {
  const ip = `10.2.0.${i + 1}`;
  const r1 = await call(A, 'POST', '/api/auth/otp/request', { email: `fan${i}@test.dev` }, null, ip);
  const r2 = await call(B, 'POST', '/api/auth/otp/verify', { email: `fan${i}@test.dev`, code: r1.json.devCode }, null, ip);
  ok(`fan${i}: code from instance A works on instance B`, r2.status === 200, r2.json);
  tokens.push(r2.json.token);
}
ok('a session made on B works on A', (await call(A, 'GET', '/api/me', null, tokens[0])).json.user?.email === 'fan0@test.dev');

const th = await call(A, 'POST', '/api/forum/threads', { title: 'Concurrency thread', content: 'Replies arrive from both servers' }, tokens[0], '10.3.0.1');
const T = th.json.thread.id;
const jobs = [];
for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) jobs.push(call(j % 2 ? B : A, 'POST', `/api/forum/threads/${T}/comments`, { content: `reply ${i}-${j}` }, tokens[i], `10.4.${i}.${j}`));
for (let i = 0; i < 6; i++) jobs.push(call(i % 2 ? A : B, 'POST', '/api/checkin', {}, tokens[i], `10.5.0.${i}`));
const results = await Promise.all(jobs);
ok('all 36 concurrent writes succeeded', results.every(r => r.status === 200), results.filter(r => r.status !== 200).map(r => r.status));
ok('instances really raced (conditional writes were refused and retried)', gcs.stats.conflicts > 0, gcs.stats);
// Reads check storage for newer data at most once a second, so allow that much lag between instances.
await new Promise(r => setTimeout(r, 1200));
const tA = (await call(A, 'GET', `/api/forum/threads/${T}`)).json;
const tB = (await call(B, 'GET', `/api/forum/threads/${T}`)).json;
ok('no reply was lost: 30 on instance A', tA.comments.length === 30, tA.comments.length);
ok('no reply was lost: 30 on instance B', tB.comments.length === 30);
const stored = JSON.parse([...gcs.objects.values()][0].data);
ok('the stored object has every reply and check-in', stored.forumComments.length === 30 && stored.users.filter(u => u.lastCheckin).length === 6);
const pts = (await call(B, 'GET', '/api/me', null, tokens[3])).json.user.points;
ok('points from both servers add up (5 replies x5 + check-in 10)', pts === 35, pts);
console.log(`\n${passed} storage checks passed`);
cleanup();
process.exit(0);

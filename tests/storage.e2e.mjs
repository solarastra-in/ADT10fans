// Two server instances share one store, either a Cloud Storage object (fake GCS) or the Firebase
// project's Firestore (fake Firestore, store split across several documents). Concurrent writes on
// both must all survive: no instance may overwrite another's changes.
// Usage: node tests/storage.e2e.mjs <tmpdir> [gcs|firestore]
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { startFakeGcs } from './fake-gcs.mjs';
import { startFakeFirestore } from './fake-firestore.mjs';

const tmp = process.argv[2] || '/tmp';
const MODE = process.argv[3] || 'gcs';
console.log(`— shared storage: ${MODE} —`);
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
const fake = MODE === 'firestore' ? await startFakeFirestore() : await startFakeGcs();
const gcs = fake;
const procs = [];
function cleanup() {
  for (const p of procs) try { process.kill(-p.pid); } catch {}
  fake.server.close();
}
let storeEnv;
if (MODE === 'firestore') {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const sa = { type: 'service_account', project_id: 'test-project', client_email: 'store@test-project.iam.gserviceaccount.com', private_key: privateKey };
  storeEnv = {
    STORE_BACKEND: 'firestore',
    FIREBASE_SERVICE_ACCOUNT: Buffer.from(JSON.stringify(sa)).toString('base64'),
    GOOGLE_OAUTH_TOKEN_URL: `http://127.0.0.1:${fake.port}/token`,
    FIRESTORE_API_BASE: `http://127.0.0.1:${fake.port}`,
    STORE_CHUNK_BYTES: '40000',
  };
} else {
  storeEnv = { STORE_BACKEND: 'gcs', STORE_BUCKET: 'test-bucket', GCS_ACCESS_TOKEN: 'test-gcs-token', GCS_API_BASE: `http://127.0.0.1:${fake.port}` };
}
// The stored JSON, read back from the fake service. Firestore: the store is split into shards
// (adt10_store_shards/<shard> + adt10_store_chunks/<shard>~<i>); each shard holds one key or part of one.
const appCfg = JSON.parse(fs.readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf8'));
const ROOT = `projects/${appCfg.projectId}/databases/${appCfg.firestoreDatabaseId}/documents`;
function storedJson() {
  if (MODE !== 'firestore') return JSON.parse([...fake.objects.values()][0].data);
  const metas = [...fake.docs.keys()].filter(n => n.startsWith(`${ROOT}/adt10_store_shards/`)).map(n => [n, fake.latest(n)]).filter(([, v]) => v && !v.fields.deleted?.booleanValue);
  const json = {};
  for (const [name, v] of metas) {
    const shard = name.split('/').pop();
    let text = '';
    for (let i = 0; i < Number(v.fields.chunks.integerValue); i++) text += fake.latest(`${ROOT}/adt10_store_chunks/${shard}~${i}`).fields.d.stringValue;
    const p = JSON.parse(text);
    if (p.items) (json[p.key] ||= []).push(...p.items);
    else json[p.key] = p.value;
  }
  return { json, count: metas.length };
}
// Firestore: start from a store in the older single-document layout, which the servers must move into shards.
if (MODE === 'firestore') {
  const legacy = { schemaVersion: 5, forumThreads: [{ id: 'thread-legacy', title: 'Written before the move to shards', content: 'Kept', category: 'general', userId: 'usr_old', userName: 'Old Fan', userAvatar: '', upvotes: 0, upvotedBy: [], commentsCount: 0, createdAt: '2026-10-01T00:00:00.000Z', lastActivityAt: '2026-10-01T00:00:00.000Z' }], users: [{ id: 'usr_old', email: 'old@test.dev', name: 'Old Fan', points: 40, teamId: 'bulls', badges: [], streak: 0, createdAt: '2026-10-01T00:00:00.000Z' }] };
  fake.put(`${ROOT}/adt10_store/meta`, { chunks: { integerValue: '1' } });
  fake.put(`${ROOT}/adt10_store/c0000`, { d: { stringValue: JSON.stringify(legacy) } });
}
async function startServer(port) {
  const p = spawn('npx', ['tsx', 'server.ts'], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...storeEnv, PORT: String(port), DATA_DIR: `${tmp}/unused-${port}`, SCHEDULED_JOBS: 'off', SERVE_BUILD: '1', ADMIN_EMAILS: 'admin@test.dev' },
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
if (MODE === 'firestore') {
  ok('a store in the older single-document layout is moved into shards', (await call(B, 'GET', '/api/forum/threads/thread-legacy')).json.thread?.title === 'Written before the move to shards');
}
ok(`server uses the shared ${MODE} store`, health.json.storage === MODE);
ok('both instances see the seeded teams', (await call(A, 'GET', '/api/teams')).json.teams.length === 6 && (await call(B, 'GET', '/api/teams')).json.teams.length === 6);
ok('seeding happened once', MODE === 'firestore' ? fake.stats.commits >= 1 && Boolean(storedJson().json.teams.length === 6) : gcs.objects.size === 1);

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
ok('instances really raced (conditional writes were refused and retried)', fake.stats.conflicts > 0, fake.stats);
// Reads check storage for newer data at most once a second, so allow that much lag between instances.
await new Promise(r => setTimeout(r, 1200));
const tA = (await call(A, 'GET', `/api/forum/threads/${T}`)).json;
const tB = (await call(B, 'GET', `/api/forum/threads/${T}`)).json;
ok('no reply was lost: 30 on instance A', tA.comments.length === 30, tA.comments.length);
ok('no reply was lost: 30 on instance B', tB.comments.length === 30);
const storedRaw = storedJson();
const stored = MODE === 'firestore' ? storedRaw.json : storedRaw;
if (MODE === 'firestore') ok('the store is split across several Firestore documents', storedRaw.count > 1, storedRaw.count);
ok('the stored object has every reply and check-in', stored.forumComments.length === 30 && stored.users.filter(u => u.lastCheckin).length === 6);
if (MODE === 'firestore') {
  // A single change sends only the shards it touched, not the whole store.
  const total = JSON.stringify(stored).length;
  await call(A, 'POST', `/api/forum/threads/${T}/comments`, { content: 'one more' }, tokens[0], '10.6.0.1');
  ok('a reply writes a small part of the store, not all of it', fake.stats.lastCommitBytes < total / 4, { commit: fake.stats.lastCommitBytes, store: total });
}
const pts = (await call(B, 'GET', '/api/me', null, tokens[3])).json.user.points;
ok('points from both servers add up (5 replies x5 + check-in 10)', pts === 35, pts);
// A key saved in the Admin console on one instance applies on the other (no environment variables).
const ip = '10.9.0.1';
const o1 = await call(A, 'POST', '/api/auth/otp/request', { email: 'admin@test.dev' }, null, ip);
const o2 = await call(A, 'POST', '/api/auth/otp/verify', { email: 'admin@test.dev', code: o1.json.devCode }, null, ip);
await call(A, 'POST', '/api/admin/env', { overrides: { GEMINI_API_KEY: 'shared-console-key' } }, o2.json.token);
await new Promise(r => setTimeout(r, 1200));
ok('a key saved in the console on one server applies on the other', (await call(B, 'GET', '/api/config')).json.config.features.gemini === true);
if (MODE === 'firestore') {
  fake.options.publicRead = true;
  const dash = (await call(B, 'GET', '/api/admin/dashboard', null, o2.json.token)).json;
  ok('the dashboard warns when Firestore rules let anyone read the data', dash.warnings.some(w => /security rules/.test(w)), dash.warnings);
}
console.log(`\n${passed} storage checks passed`);
cleanup();
process.exit(0);

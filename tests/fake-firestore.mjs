// A small stand-in for the Firestore REST API (batchGet with readTime, commit with preconditions)
// plus a Google OAuth token endpoint, for tests/storage.e2e.mjs. Keeps every document version so
// reads at a readTime see a consistent snapshot, as Firestore does.
import http from 'node:http';

export function startFakeFirestore() {
  const docs = new Map(); // name -> [{ t, fields|null }]
  let tick = Date.parse('2026-10-01T00:00:00Z') * 1000; // microseconds
  const iso = us => new Date(Math.floor(us / 1000)).toISOString().replace('Z', `${String(us % 1000).padStart(3, '0')}Z`);
  const parse = s => Date.parse(s.slice(0, 23) + 'Z') * 1000 + Number(s.slice(23, 26) || 0);
  const at = (name, us) => {
    const v = (docs.get(name) || []).filter(x => x.t <= us).pop();
    return v && v.fields ? v : null;
  };
  const stats = { commits: 0, conflicts: 0, tokens: 0 };
  const options = { publicRead: false };
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = chunks.length ? Buffer.concat(chunks).toString('utf8') : '';
      const send = (code, obj) => res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(obj));
      if (req.url === '/token') {
        stats.tokens++;
        return send(200, { access_token: 'fake-firestore-token', expires_in: 3600 });
      }
      if (req.method === 'GET' && /[?&]key=/.test(req.url) && !req.headers.authorization) return options.publicRead ? send(200, {}) : send(403, { error: { status: 'PERMISSION_DENIED' } });
      if (req.headers.authorization !== 'Bearer fake-firestore-token') return send(401, { error: { status: 'UNAUTHENTICATED' } });
      const json = body ? JSON.parse(body) : {};
      if (req.url.endsWith(':batchGet')) {
        const now = json.readTime ? parse(json.readTime) : tick;
        return send(200, json.documents.map(name => {
          const v = at(name, now);
          return v ? { found: { name, fields: v.fields, updateTime: iso(v.t) }, readTime: iso(now) } : { missing: name, readTime: iso(now) };
        }));
      }
      if (req.url.endsWith(':commit')) {
        for (const w of json.writes) {
          const name = w.update ? w.update.name : w.delete;
          const cur = at(name, tick);
          const pre = w.currentDocument;
          if (pre && pre.exists === false && cur) { stats.conflicts++; return send(409, { error: { status: 'ALREADY_EXISTS' } }); }
          if (pre && pre.updateTime && (!cur || iso(cur.t) !== pre.updateTime)) { stats.conflicts++; return send(400, { error: { status: 'FAILED_PRECONDITION' } }); }
        }
        tick += 1000 + Math.floor(Math.random() * 500);
        for (const w of json.writes) {
          const name = w.update ? w.update.name : w.delete;
          if (!docs.has(name)) docs.set(name, []);
          docs.get(name).push({ t: tick, fields: w.update ? w.update.fields : null });
          const bytes = JSON.stringify(w.update?.fields || {}).length;
          if (bytes > 1_048_576) return send(400, { error: { status: 'INVALID_ARGUMENT', message: 'document too large' } });
        }
        stats.commits++;
        return send(200, { writeResults: json.writes.map(() => ({ updateTime: iso(tick) })), commitTime: iso(tick) });
      }
      send(404, { error: { status: 'NOT_FOUND' } });
    });
  });
  const latest = name => at(name, tick);
  return new Promise(resolve => server.listen(0, () => resolve({ server, port: server.address().port, stats, latest, docs, options })));
}

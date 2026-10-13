// A tiny stand-in for the Cloud Storage JSON API: one object per bucket/name, generations and
// ifGenerationMatch preconditions (412 on mismatch), like the real service. Used by storage.e2e.mjs.
import http from 'node:http';

export function startFakeGcs() {
  const objects = new Map(); // key -> { data, generation }
  let gen = 1000;
  const stats = { writes: 0, conflicts: 0 };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (req.headers.authorization !== 'Bearer test-gcs-token') {
      res.writeHead(401).end();
      return;
    }
    const read = u.pathname.match(/^\/storage\/v1\/b\/([^/]+)\/o\/(.+)$/);
    if (req.method === 'GET' && read) {
      const obj = objects.get(`${read[1]}/${decodeURIComponent(read[2])}`);
      if (!obj) return res.writeHead(404).end('{}');
      if (u.searchParams.get('alt') === 'media') return res.writeHead(200, { 'x-goog-generation': String(obj.generation), 'Content-Type': 'application/json' }).end(obj.data);
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ generation: String(obj.generation) }));
    }
    const up = u.pathname.match(/^\/upload\/storage\/v1\/b\/([^/]+)\/o$/);
    if (req.method === 'POST' && up) {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        const key = `${up[1]}/${u.searchParams.get('name')}`;
        const want = u.searchParams.get('ifGenerationMatch');
        const cur = objects.get(key);
        const curGen = cur ? String(cur.generation) : '0';
        if (want !== null && want !== curGen) {
          stats.conflicts++;
          return res.writeHead(412).end('{"error":"precondition"}');
        }
        const next = { data: Buffer.concat(chunks).toString('utf8'), generation: ++gen };
        objects.set(key, next);
        stats.writes++;
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ generation: String(next.generation) }));
      });
      return;
    }
    res.writeHead(404).end();
  });
  return new Promise(resolve => server.listen(0, () => resolve({ server, port: server.address().port, objects, stats })));
}

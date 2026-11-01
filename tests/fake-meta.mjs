// A stand-in for Meta's Graph API in tests: the club account, one pinned post, and its comments.
// POST /__comment {username, text} adds a comment as if a fan had posted it on Instagram.
import http from 'node:http';

const port = Number(process.argv[2] || 41000);
const ACCOUNT = { id: process.env.META_IG_USER_ID || '17841400000000000', username: 'arabianacesofficial' };
const MEDIA = [{ id: '18000000000000001', shortcode: 'TESTPOST1', permalink: 'https://www.instagram.com/p/TESTPOST1/' }];
const comments = [];
const hidden = new Set();

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = (code, body) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'POST' && url.pathname === '/__comment') {
      let raw = '';
      req.on('data', c => (raw += c));
      req.on('end', () => {
        const b = JSON.parse(raw || '{}');
        const c = { id: `c${comments.length + 1}`, username: b.username, text: b.text, timestamp: new Date().toISOString() };
        comments.push(c);
        send(200, c);
      });
      return;
    }
    if (url.pathname === '/__hidden') return send(200, { hidden: [...hidden] });
    if (url.searchParams.get('access_token') !== 'test-meta-token') return send(400, { error: { message: 'Invalid OAuth access token', type: 'OAuthException' } });
    const parts = url.pathname.split('/').filter(Boolean); // [version, id, edge?]
    const [, id, edge] = parts;
    if (req.method === 'POST' && url.searchParams.get('hide') === 'true') {
      hidden.add(id);
      return send(200, { success: true });
    }
    if (id === ACCOUNT.id && !edge) return send(200, ACCOUNT);
    if (id === ACCOUNT.id && edge === 'media') return send(200, { data: MEDIA, paging: {} });
    if (MEDIA.some(m => m.id === id) && edge === 'comments') return send(200, { data: comments.filter(c => !hidden.has(c.id)), paging: {} });
    send(404, { error: { message: 'Unknown path' } });
  })
  .listen(port, '127.0.0.1');

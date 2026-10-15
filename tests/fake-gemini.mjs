// A local stand-in for the Gemini API (generateContent) used by the social harvester in the tests.
// For the league it "finds" a mix of links: two real ones the fixtures confirm, and several that must
// be dropped (wrong author, invented, not an official account, a platform that cannot be confirmed).
// Usage: node tests/fake-gemini.mjs <port>
import http from 'node:http';
const port = Number(process.argv[2] || 0);
const LEAGUE = [
  { url: 'https://x.com/T10League/status/1990000000000000001', platform: 'X', title: 'AI-written title that must not be used' },
  { url: 'https://x.com/T10League/status/1990000000000000002', platform: 'X', title: 'wrong author' },
  { url: 'https://x.com/T10League/status/1990000000000000003', platform: 'X', title: 'invented link' },
  { url: 'https://x.com/RandomFanPage/status/1990000000000000004', platform: 'X', title: 'not official' },
  { url: 'https://www.tiktok.com/@abudhabit10/video/7560000000000000000', platform: 'TikTok', title: 'AI title' },
  { url: 'https://www.instagram.com/p/MadeUp123/', platform: 'Instagram', title: 'cannot be confirmed' },
];
http.createServer((req, res) => {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => {
    const prompt = JSON.stringify(JSON.parse(body || '{}').contents || '');
    const links = /Abu Dhabi T10 league/.test(prompt) ? LEAGUE : [];
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
      candidates: [{ content: { role: 'model', parts: [{ text: 'Here is what I found:\n' + JSON.stringify(links) }] }, finishReason: 'STOP' }],
    }));
  });
}).listen(port, () => console.log(`fake gemini on ${port}`));

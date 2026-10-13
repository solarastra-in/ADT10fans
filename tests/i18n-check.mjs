// Every t('…') string in the fan-facing code must have an Arabic, Hindi and Urdu translation with the
// same {placeholders}. The admin console is English-only. Run: node tests/i18n-check.mjs
import fs from 'node:fs';
import path from 'node:path';
const files = [];
const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) && files.push(path.join(d, e.name))));
walk('src');
const keys = new Set();
const re = /\bt\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
for (const f of files) {
  if (f.includes(`${path.sep}admin${path.sep}`) || /AdminPortal|Proposal/.test(f)) continue;
  for (const m of fs.readFileSync(f, 'utf8').matchAll(re)) keys.add((m[1] ?? m[2]).replace(/\\'/g, "'").replace(/\\"/g, '"'));
}
let bad = 0;
for (const lang of ['ar', 'hi', 'ur']) {
  const src = fs.readFileSync(`src/i18n/${lang}.ts`, 'utf8');
  const dict = JSON.parse('{' + src.slice(src.indexOf('{') + 1, src.lastIndexOf('}')).replace(/,\s*$/, '') + '}');
  for (const k of keys) {
    if (!(k in dict)) { console.error(`${lang}: missing "${k}"`); bad++; continue; }
    const a = (k.match(/\{\w+\}/g) || []).sort().join();
    const b = (dict[k].match(/\{\w+\}/g) || []).sort().join();
    if (a !== b) { console.error(`${lang}: placeholders differ for "${k}"`); bad++; }
  }
}
if (bad) process.exit(1);
console.log(`✓ ${keys.size} strings translated into Arabic, Hindi and Urdu`);

import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import type { AppStore, Match, Player, Team } from './db';
import { statsFor } from './playerStats';

/**
 * Share images (1200×630 PNG) for links posted on WhatsApp, X, Facebook, LinkedIn and in search
 * results: one per player, match and team, plus one for the site. They are drawn from an SVG with the
 * Inter font (SIL Open Font License, in server/assets/fonts) and cached.
 *
 * They carry no player photos: those belong to the sites that publish them.
 * If the renderer is unavailable, /og/… redirects to the site logo instead.
 */

export type OgKind = 'player' | 'match' | 'team' | 'site';

const W = 1200;
const H = 630;
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ROLE: Record<string, string> = { batter: 'Batter', bowler: 'Bowler', allrounder: 'All-rounder', wicketkeeper: 'Wicketkeeper' };

/** Shortens text to fit roughly `max` characters at the given size. */
const fit = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s);
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('');
const fmtDubai = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' GST';
  } catch {
    return iso;
  }
};
const safeColor = (c?: string, fallback = '#334155') => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback);

function frame(inner: string, a: string, b: string, brand: string, season: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a}"/>
      <stop offset="0.55" stop-color="${b}"/>
      <stop offset="1" stop-color="#020617"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="0" y="${H - 86}" width="${W}" height="86" fill="#020617" fill-opacity="0.72"/>
  <text x="64" y="${H - 34}" font-family="Inter" font-weight="800" font-size="30" fill="#fbbf24">${esc(brand)}</text>
  <text x="${W - 64}" y="${H - 34}" text-anchor="end" font-family="Inter" font-size="26" fill="#cbd5e1">${esc(season)}</text>
  ${inner}
</svg>`;
}

function playerSvg(store: AppStore, team: Team, p: Player, brand: string, season: string) {
  const s = statsFor(store, p.id);
  const parts: string[] = [];
  if (s?.matches) {
    if (s.innings) parts.push(`${s.runs} runs${s.strikeRate ? ` · SR ${s.strikeRate}` : ''}`);
    if (s.ballsBowled) parts.push(`${s.wickets} wkts${s.economy ? ` · econ ${s.economy}` : ''}`);
  }
  const line = parts.length ? `This season: ${parts.join(' · ')}` : [p.battingStyle, p.bowlingStyle].filter(Boolean).join(' · ');
  const badge = p.isIcon || p.category === 'Icon' ? 'ICON PLAYER' : p.category ? `${p.category.toUpperCase()} SIGNING` : '';
  const color = safeColor(team.color);
  return frame(
    `<circle cx="200" cy="250" r="128" fill="#0f172a" fill-opacity="0.55" stroke="${color}" stroke-width="10"/>
  <text x="200" y="290" text-anchor="middle" font-family="Inter" font-weight="800" font-size="112" fill="#ffffff">${esc(initials(p.name))}</text>
  ${badge ? `<rect x="380" y="118" rx="22" width="${badge.length * 17 + 48}" height="44" fill="#fbbf24"/><text x="404" y="149" font-family="Inter" font-weight="800" font-size="24" fill="#0f172a">${esc(badge)}</text>` : ''}
  <text x="380" y="${badge ? 248 : 220}" font-family="Inter" font-weight="800" font-size="${p.name.length > 18 ? 66 : 82}" fill="#ffffff">${esc(fit(p.name, 24))}</text>
  <text x="380" y="${badge ? 310 : 284}" font-family="Inter" font-weight="800" font-size="38" fill="#e2e8f0">${esc(fit(`${ROLE[p.role] || ''} · ${team.name}`, 40))}</text>
  ${line ? `<text x="380" y="${badge ? 370 : 344}" font-family="Inter" font-size="30" fill="#cbd5e1">${esc(fit(line, 52))}</text>` : ''}
  <text x="380" y="${badge ? 450 : 424}" font-family="Inter" font-size="26" fill="#94a3b8">Player card · stats · Pick XI</text>`,
    color,
    safeColor(team.secondaryColor, '#0f172a'),
    brand,
    season,
  );
}

function matchSvg(store: AppStore, m: Match, brand: string, season: string) {
  const a = store.teams.find(t => t.id === m.teamA);
  const b = store.teams.find(t => t.id === m.teamB);
  const status =
    m.status === 'completed' ? fit(m.result || 'Result', 46) : m.status === 'live' ? 'LIVE' : m.status === 'abandoned' ? 'Abandoned' : fmtDubai(m.startsAt);
  const score = (t: Team | undefined, sc?: string, ov?: string) => (sc ? `${sc}${ov ? ` (${ov})` : ''}` : '');
  const ca = safeColor(a?.color);
  const cb = safeColor(b?.color);
  return frame(
    `<rect x="0" y="0" width="${W / 2}" height="14" fill="${ca}"/>
  <rect x="${W / 2}" y="0" width="${W / 2}" height="14" fill="${cb}"/>
  <text x="${W / 2}" y="96" text-anchor="middle" font-family="Inter" font-weight="800" font-size="30" fill="#fbbf24">MATCH ${esc(m.matchNo)}${m.stage && !/group/i.test(m.stage) ? ` · ${esc(m.stage.toUpperCase())}` : ''}</text>
  <text x="${W / 4 + 10}" y="246" text-anchor="middle" font-family="Inter" font-weight="800" font-size="${(a?.name || '').length > 14 ? 52 : 62}" fill="#ffffff">${esc(fit(a?.name || m.teamA, 20))}</text>
  <rect x="${W / 4 - 70}" y="268" width="160" height="10" rx="5" fill="${ca}"/>
  <text x="${(W * 3) / 4 - 10}" y="246" text-anchor="middle" font-family="Inter" font-weight="800" font-size="${(b?.name || '').length > 14 ? 52 : 62}" fill="#ffffff">${esc(fit(b?.name || m.teamB, 20))}</text>
  <rect x="${(W * 3) / 4 - 90}" y="268" width="160" height="10" rx="5" fill="${cb}"/>
  <text x="${W / 2}" y="246" text-anchor="middle" font-family="Inter" font-weight="800" font-size="36" fill="#64748b">vs</text>
  <text x="${W / 4 + 10}" y="340" text-anchor="middle" font-family="Inter" font-weight="800" font-size="44" fill="#e2e8f0">${esc(score(a, m.scoreA, m.oversA))}</text>
  <text x="${(W * 3) / 4 - 10}" y="340" text-anchor="middle" font-family="Inter" font-weight="800" font-size="44" fill="#e2e8f0">${esc(score(b, m.scoreB, m.oversB))}</text>
  ${m.status === 'live' ? `<rect x="${W / 2 - 70}" y="396" rx="24" width="140" height="48" fill="#dc2626"/>` : ''}
  <text x="${W / 2}" y="430" text-anchor="middle" font-family="Inter" font-weight="800" font-size="32" fill="#ffffff">${esc(status)}</text>
  <text x="${W / 2}" y="486" text-anchor="middle" font-family="Inter" font-size="26" fill="#94a3b8">${esc(fit(m.venue || store.settings.venue || '', 60))}</text>`,
    '#111827',
    '#0b1220',
    brand,
    season,
  );
}

function teamSvg(t: Team, brand: string, season: string) {
  const color = safeColor(t.color);
  return frame(
    `<text x="80" y="170" font-family="Inter" font-weight="800" font-size="30" fill="#ffffff" fill-opacity="0.9">${esc(t.short)} · SQUAD ${esc(season.match(/\d{4}/)?.[0] || '')}</text>
  <text x="80" y="290" font-family="Inter" font-weight="800" font-size="${t.name.length > 18 ? 84 : 104}" fill="#ffffff">${esc(fit(t.name, 22))}</text>
  ${t.iconPlayer ? `<text x="80" y="370" font-family="Inter" font-weight="800" font-size="40" fill="#e2e8f0">Icon player: ${esc(fit(t.iconPlayer, 30))}</text>` : ''}
  <text x="80" y="430" font-family="Inter" font-size="30" fill="#cbd5e1">${esc(t.squad.length)} players · fixtures · official channels</text>`,
    color,
    safeColor(t.secondaryColor, '#0f172a'),
    brand,
    season,
  );
}

function siteSvg(store: AppStore, brand: string, season: string) {
  const s = store.settings;
  return frame(
    `<text x="80" y="200" font-family="Inter" font-weight="800" font-size="34" fill="#fbbf24">${esc((season || '').toUpperCase())}</text>
  <text x="80" y="320" font-family="Inter" font-weight="800" font-size="104" fill="#ffffff">${esc(fit(brand, 20))}</text>
  <text x="80" y="390" font-family="Inter" font-size="34" fill="#e2e8f0">Live scores · squads · Pick XI · games · fan wall</text>
  <text x="80" y="446" font-family="Inter" font-size="28" fill="#94a3b8">${esc(fit(`${s.venue || ''}${s.seasonStart ? ` · ${s.seasonStart} to ${s.seasonEnd}` : ''}`, 64))}</text>`,
    '#1e3a8a',
    '#0f172a',
    brand,
    season,
  );
}

/** The SVG for a share image, or null when the subject does not exist. */
export function ogSvg(store: AppStore, kind: OgKind, id: string): string | null {
  const brand = store.settings.brandName || 'ADT10 Fans';
  const season = store.settings.seasonLabel || 'Abu Dhabi T10';
  if (kind === 'site') return siteSvg(store, brand, season);
  if (kind === 'team') {
    const t = store.teams.find(x => x.id === id);
    return t ? teamSvg(t, brand, season) : null;
  }
  if (kind === 'match') {
    const m = store.matches.find(x => x.id === id);
    return m ? matchSvg(store, m, brand, season) : null;
  }
  const team = store.teams.find(t => t.squad.some(p => p.id === id));
  const p = team?.squad.find(x => x.id === id);
  return team && p ? playerSvg(store, team, p, brand, season) : null;
}

// ---------------------------------------------------------------------------------------------

let renderer: ((svg: string) => Buffer) | null | undefined;
function getRenderer(): ((svg: string) => Buffer) | null {
  if (renderer !== undefined) return renderer;
  try {
    const { Resvg } = createRequire(import.meta.url)('@resvg/resvg-js');
    const dir = [path.join(process.cwd(), 'server', 'assets', 'fonts'), path.join(__dirnameSafe(), 'assets', 'fonts'), path.join(__dirnameSafe(), '..', 'server', 'assets', 'fonts')].find(d => fs.existsSync(path.join(d, 'Inter_400Regular.ttf')));
    if (!dir) throw new Error('fonts not found');
    const fontFiles = ['Inter_400Regular.ttf', 'Inter_800ExtraBold.ttf'].map(f => path.join(dir, f));
    renderer = (svg: string) =>
      new Resvg(svg, { fitTo: { mode: 'width', value: W }, font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter' } }).render().asPng();
  } catch (e) {
    console.warn('[OG] share images disabled:', (e as Error)?.message || e);
    renderer = null;
  }
  return renderer;
}

function __dirnameSafe() {
  try {
    return path.dirname(new URL(import.meta.url).pathname);
  } catch {
    return process.cwd();
  }
}

const cache = new Map<string, Buffer>();
/** PNG for a share image (cached by its SVG). Null: unknown subject or renderer unavailable. */
export function ogPng(store: AppStore, kind: OgKind, id: string): Buffer | null | 'no-renderer' {
  const svg = ogSvg(store, kind, id);
  if (!svg) return null;
  const render = getRenderer();
  if (!render) return 'no-renderer';
  const hit = cache.get(svg);
  if (hit) return hit;
  const png = render(svg);
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
  cache.set(svg, png);
  return png;
}

/** Absolute URL of the share image for a page. */
export const ogUrl = (base: string, kind: OgKind, id = 'site') => `${base}/og/${kind}/${encodeURIComponent(id)}.png`;

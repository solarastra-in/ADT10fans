import type { Player } from './db';
import { fetchText } from './feeds';
import { normName } from './fantasy';

/**
 * Where to follow a player: career statistics (ESPNcricinfo, Cricbuzz), Wikipedia, and their own
 * official social accounts.
 *
 * Nothing is guessed from a name. Links are found by joining identifiers:
 *   1. The player's Cricbuzz id (from the published squad) → their ESPNcricinfo id, through the
 *      Cricsheet register, a public table that maps each cricketer's ids across cricket sites.
 *   2. The ESPNcricinfo id → their Wikidata entry (property P2697), which lists the English
 *      Wikipedia article and the player's verified Instagram (P2003), X (P2002), Facebook (P2013)
 *      and YouTube (P2397) accounts.
 * A player with no match gets no link. Admins can add or correct any link in Admin → Squad editor;
 * an admin's link is never overwritten by the lookup.
 */

export const LINK_KEYS = ['espncricinfo', 'cricbuzz', 'wikipedia', 'instagram', 'x', 'facebook', 'youtube'] as const;
export type LinkKey = (typeof LINK_KEYS)[number];
export type PlayerLinks = Partial<Record<LinkKey, string>>;
export type LinkSource = 'admin' | 'cricsheet' | 'wikidata' | 'squad';

export const LINK_LABELS: Record<LinkKey, string> = {
  espncricinfo: 'ESPNcricinfo',
  cricbuzz: 'Cricbuzz',
  wikipedia: 'Wikipedia',
  instagram: 'Instagram',
  x: 'X',
  facebook: 'Facebook',
  youtube: 'YouTube',
};

/** Each link must point at its own site (an admin cannot put an arbitrary site under "Instagram"). */
export const LINK_PATTERNS: Record<LinkKey, RegExp> = {
  espncricinfo: /^https:\/\/(www\.)?espncricinfo\.com\/[\w\-/]+$/i,
  cricbuzz: /^https:\/\/(www\.)?cricbuzz\.com\/[\w\-/]+$/i,
  wikipedia: /^https:\/\/[a-z]{2,3}\.wikipedia\.org\/wiki\/[^\s]+$/i,
  instagram: /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]{1,30}\/?$/i,
  x: /^https:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/?$/i,
  facebook: /^https:\/\/(www\.)?facebook\.com\/[\w.\-/]+\/?$/i,
  youtube: /^https:\/\/(www\.)?youtube\.com\/(channel\/UC[\w-]{22}|@[\w.\-]{3,30})\/?$/i,
};

/** Validates links from the admin console. Returns the clean links, or an error message. */
export function cleanLinks(raw: unknown): { links: PlayerLinks; error?: string } {
  const links: PlayerLinks = {};
  if (!raw || typeof raw !== 'object') return { links };
  for (const key of LINK_KEYS) {
    const v = (raw as any)[key];
    if (v === undefined || v === null || v === '') continue;
    const url = String(v).trim().slice(0, 300);
    if (!LINK_PATTERNS[key].test(url)) return { links: {}, error: `${LINK_LABELS[key]} link must be a ${LINK_LABELS[key]} address (https://…)` };
    links[key] = url;
  }
  return { links };
}

const slug = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const cricinfoUrl = (name: string, id: string) => `https://www.espncricinfo.com/cricketers/${slug(name) || 'player'}-${id}`;
export const cricbuzzUrl = (name: string, id: string) => `https://www.cricbuzz.com/profiles/${id}/${slug(name) || 'player'}`;

/** Every link to show for a player: stored links first, then those that follow from known ids. */
export function linksFor(p: Player): PlayerLinks {
  const out: PlayerLinks = { ...(p.links || {}) };
  if (!out.cricbuzz) {
    if (p.cricbuzzProfileUrl && LINK_PATTERNS.cricbuzz.test(p.cricbuzzProfileUrl)) out.cricbuzz = p.cricbuzzProfileUrl;
    else if (p.cricbuzzId) out.cricbuzz = cricbuzzUrl(p.name, p.cricbuzzId);
  }
  if (!out.espncricinfo && p.cricinfoId) out.espncricinfo = cricinfoUrl(p.name, p.cricinfoId);
  return out;
}

/** Handle shown next to a social link (e.g. "@kieron.pollard55"). */
export function handleOf(key: LinkKey, url: string): string | null {
  if (key === 'instagram' || key === 'x') {
    const m = url.match(/\.com\/([^/?#]+)/);
    return m ? `@${m[1]}` : null;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------------------------

export const CRICSHEET_PEOPLE_URL = 'https://cricsheet.org/register/people.csv';
export const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';

/** Minimal CSV parser (quoted fields, escaped quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.length > 1 || r[0]);
}

/** Cricbuzz id → { ESPNcricinfo id, name } from the Cricsheet register. */
export function cricsheetIndex(csv: string): Map<string, { cricinfo: string; name: string }> {
  const rows = parseCsv(csv);
  const header = rows.shift() || [];
  const col = (prefix: string) => header.map((h, i) => (h === prefix || h.startsWith(`${prefix}_`) ? i : -1)).filter(i => i >= 0);
  const cb = col('key_cricbuzz');
  const ci = col('key_cricinfo');
  const nameCols = [header.indexOf('name'), header.indexOf('unique_name')].filter(i => i >= 0);
  const out = new Map<string, { cricinfo: string; name: string }>();
  for (const r of rows) {
    const cricinfo = ci.map(i => r[i]).find(v => v && /^\d+$/.test(v));
    if (!cricinfo) continue;
    const name = nameCols.map(i => r[i]).find(Boolean) || '';
    for (const i of cb) if (r[i] && /^\d+$/.test(r[i]) && !out.has(r[i])) out.set(r[i], { cricinfo, name });
  }
  return out;
}

/** True when two spellings of a name share a surname (guards against a wrong id in either table). */
export function sameSurname(a: string, b: string): boolean {
  const last = (s: string) => normName(s).split(' ').filter(Boolean).pop() || '';
  const la = last(a);
  const lb = last(b);
  if (!la || !lb) return false;
  return la === lb || normName(a).includes(lb) || normName(b).includes(la);
}

export function wikidataQuery(cricinfoIds: string[]): string {
  const values = cricinfoIds.map(id => `"${id.replace(/\D/g, '')}"`).join(' ');
  return `SELECT ?id ?item ?itemLabel ?article ?ig ?x ?fb ?yt WHERE {
  VALUES ?id { ${values} }
  ?item wdt:P2697 ?id .
  OPTIONAL { ?item wdt:P2003 ?ig . }
  OPTIONAL { ?item wdt:P2002 ?x . }
  OPTIONAL { ?item wdt:P2013 ?fb . }
  OPTIONAL { ?item wdt:P2397 ?yt . }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
}

export const wikidataUrl = (cricinfoIds: string[]) => `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(wikidataQuery(cricinfoIds))}`;

export interface WikidataRow {
  wikidataId: string;
  label: string;
  links: PlayerLinks;
}

/** Parses a SPARQL JSON result into links per ESPNcricinfo id (first value of each property). */
export function parseWikidata(json: any): Map<string, WikidataRow> {
  const out = new Map<string, WikidataRow>();
  for (const b of json?.results?.bindings || []) {
    const id = b.id?.value;
    if (!id) continue;
    const row: WikidataRow = out.get(id) || { wikidataId: String(b.item?.value || '').split('/').pop() || '', label: b.itemLabel?.value || '', links: {} };
    const set = (key: LinkKey, url: string | null) => {
      if (url && !row.links[key] && LINK_PATTERNS[key].test(url)) row.links[key] = url;
    };
    set('wikipedia', b.article?.value || null);
    set('instagram', b.ig?.value ? `https://www.instagram.com/${b.ig.value}/` : null);
    set('x', b.x?.value ? `https://x.com/${b.x.value}` : null);
    set('facebook', b.fb?.value ? `https://www.facebook.com/${b.fb.value}` : null);
    set('youtube', b.yt?.value ? `https://www.youtube.com/channel/${b.yt.value}` : null);
    out.set(id, row);
  }
  return out;
}

export interface ResolvedLinks {
  cricinfoId?: string;
  wikidataId?: string;
  links: PlayerLinks;
  sources: Partial<Record<LinkKey, LinkSource>>;
}

/**
 * Looks up links for players (network only; the caller saves the result). Returns, per player id,
 * what was found, plus a short report for the admin.
 */
export async function lookUpPlayerLinks(players: Pick<Player, 'id' | 'name' | 'cricbuzzId' | 'cricinfoId'>[]): Promise<{ found: Map<string, ResolvedLinks>; report: string[] }> {
  const report: string[] = [];
  const found = new Map<string, ResolvedLinks>();
  const cricinfoOf = new Map<string, string>();
  for (const p of players) if (p.cricinfoId) cricinfoOf.set(p.id, p.cricinfoId);

  const needCricinfo = players.filter(p => !p.cricinfoId && p.cricbuzzId);
  if (needCricinfo.length) {
    try {
      const index = cricsheetIndex(await fetchText(CRICSHEET_PEOPLE_URL, 25_000, { Accept: 'text/csv,*/*' }));
      let matched = 0;
      let mismatched = 0;
      for (const p of needCricinfo) {
        const hit = index.get(p.cricbuzzId!);
        if (!hit) continue;
        if (!sameSurname(hit.name, p.name)) {
          mismatched++;
          continue;
        }
        cricinfoOf.set(p.id, hit.cricinfo);
        matched++;
      }
      report.push(`Cricsheet register: ESPNcricinfo id found for ${matched} of ${needCricinfo.length} players${mismatched ? ` (${mismatched} skipped: the names did not match)` : ''}.`);
    } catch (e: any) {
      report.push(`Cricsheet register could not be read (${e?.message || e}); ESPNcricinfo links were not looked up.`);
    }
  }

  const ids = [...new Set(cricinfoOf.values())];
  let wiki = new Map<string, WikidataRow>();
  for (let i = 0; i < ids.length; i += 60) {
    const batch = ids.slice(i, i + 60);
    try {
      const text = await fetchText(wikidataUrl(batch), 25_000, { Accept: 'application/sparql-results+json' });
      wiki = new Map([...wiki, ...parseWikidata(JSON.parse(text))]);
    } catch (e: any) {
      report.push(`Wikidata could not be read (${e?.message || e}); Wikipedia and social links were not looked up for ${batch.length} players.`);
    }
  }

  let social = 0;
  for (const p of players) {
    const cricinfoId = cricinfoOf.get(p.id);
    if (!cricinfoId) continue;
    const row = wiki.get(cricinfoId);
    // The Wikidata entry must be the same person (its label shares the surname).
    const trusted = row && (!row.label || sameSurname(row.label, p.name));
    const links: PlayerLinks = { espncricinfo: cricinfoUrl(p.name, cricinfoId), ...(trusted ? row!.links : {}) };
    const sources: ResolvedLinks['sources'] = { espncricinfo: 'cricsheet' };
    if (trusted) for (const k of Object.keys(row!.links) as LinkKey[]) sources[k] = 'wikidata';
    if (trusted && (row!.links.instagram || row!.links.x || row!.links.facebook || row!.links.youtube)) social++;
    found.set(p.id, { cricinfoId, wikidataId: trusted ? row!.wikidataId : undefined, links, sources });
  }
  report.push(`Wikidata: entries for ${[...found.values()].filter(f => f.wikidataId).length} players; official social accounts for ${social}.`);
  return { found, report };
}

/**
 * Merges a lookup into a player. Links an admin set are kept; looked-up links replace older
 * looked-up ones (so a corrected Wikidata entry flows through).
 */
export function applyLinks(p: Player, r: ResolvedLinks, now = new Date().toISOString()) {
  const links: PlayerLinks = { ...(p.links || {}) };
  const sources = { ...(p.linkSources || {}) };
  for (const key of LINK_KEYS) {
    if (sources[key] === 'admin' && links[key]) continue;
    if (r.links[key]) {
      links[key] = r.links[key];
      sources[key] = r.sources[key] || 'wikidata';
    } else if (sources[key] && sources[key] !== 'admin') {
      delete links[key];
      delete sources[key];
    }
  }
  p.links = links;
  p.linkSources = sources;
  if (r.cricinfoId) p.cricinfoId = r.cricinfoId;
  if (r.wikidataId) p.wikidataId = r.wikidataId;
  p.linksCheckedAt = now;
}

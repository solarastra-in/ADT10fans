import type { AppStore, Player, PlayerCareer, CareerFormat } from './db';
import { db } from './db';
import { fetchText } from './feeds';
import { normName } from './fantasy';

/**
 * Career records (T20 internationals, IPL, and other formats CricketData.org publishes) for each
 * player, from CricketData.org: the same service and key (CRICKET_API_KEY) the site uses for live
 * scores.
 *
 * A player is matched by an exact name search, narrowed by country when several share the name. A
 * player with no exact match, or several that the country can't tell apart, gets no record rather
 * than someone else's; an admin can paste the right CricketData player id in the Squad editor.
 *
 * CricketData's free plan allows 100 requests a day across everything, so this uses a small daily
 * budget (settings.careerStatsDailyCalls, default 30), spreads the work over hourly runs, and
 * re-checks a player only once a week.
 *
 * T10 figures for this season come from the site's own scorecards (playerStats.ts); no source here
 * publishes lifetime T10 records.
 */

const API = () => (process.env.CRICKETDATA_API_BASE || 'https://api.cricapi.com/v1').replace(/\/$/, '');
const REFRESH_DAYS = 7;
const RETRY_DAYS = 14;
const PER_RUN = 6;

/** Formats shown on the player card, in this order. Others CricketData returns are kept but not shown. */
export const FORMAT_LABELS: Record<string, string> = { t10: 'T10', t20: 'T20I', ipl: 'IPL', odi: 'ODI', test: 'Test' };

/** Country names CricketData uses, for the codes in the published squads. */
const COUNTRY: Record<string, string[]> = {
  AFG: ['afghanistan'],
  AUS: ['australia'],
  BAN: ['bangladesh'],
  CAN: ['canada'],
  ENG: ['england'],
  IND: ['india'],
  IRE: ['ireland'],
  KUW: ['kuwait'],
  NAM: ['namibia'],
  NED: ['netherlands'],
  NEP: ['nepal'],
  NZ: ['new zealand'],
  OMA: ['oman'],
  PAK: ['pakistan'],
  SA: ['south africa'],
  SCO: ['scotland'],
  SL: ['sri lanka'],
  UAE: ['united arab emirates', 'uae'],
  USA: ['united states of america', 'usa', 'united states'],
  WI: ['west indies', 'jamaica', 'trinidad and tobago', 'barbados', 'guyana', 'antigua and barbuda'],
  ZIM: ['zimbabwe'],
};

export const careerStatsConfigured = () => Boolean(process.env.CRICKET_API_KEY);

async function call(path: string, params: Record<string, string>) {
  const key = process.env.CRICKET_API_KEY;
  if (!key) throw new Error('CRICKET_API_KEY is not set (Admin → Environment)');
  const qs = new URLSearchParams({ apikey: key, ...params }).toString();
  const json = JSON.parse(await fetchText(`${API()}/${path}?${qs}`, 12000, { Accept: 'application/json' }));
  if (json.status && json.status !== 'success') throw new Error(`CricketData: ${json.reason || json.status}`);
  return json.data;
}

const countryMatches = (code: string | undefined, country: unknown) => {
  if (!code || !COUNTRY[code.toUpperCase()]) return null;
  const c = String(country || '').toLowerCase().trim();
  return COUNTRY[code.toUpperCase()].includes(c);
};

/** Picks the CricketData player for a squad player from a name search, or explains why not. */
export function pickSearchResult(p: Pick<Player, 'name' | 'nationality'>, results: any[]): { id?: string; status: PlayerCareer['status']; note?: string } {
  const exact = (Array.isArray(results) ? results : []).filter(r => r?.id && normName(String(r.name || '')) === normName(p.name));
  if (!exact.length) return { status: 'no-match', note: 'No player with exactly this name on CricketData.org' };
  if (exact.length === 1) {
    // A single exact name is accepted unless its country clearly contradicts the squad's.
    if (countryMatches(p.nationality, exact[0].country) === false && p.nationality !== 'UAE') {
      return { status: 'no-match', note: `The only "${p.name}" on CricketData.org plays for ${exact[0].country}` };
    }
    return { id: String(exact[0].id), status: 'found' };
  }
  const sameCountry = exact.filter(r => countryMatches(p.nationality, r.country));
  if (sameCountry.length === 1) return { id: String(sameCountry[0].id), status: 'found' };
  return { status: 'ambiguous', note: `${exact.length} players named "${p.name}" on CricketData.org; set the right one in the Squad editor` };
}

const clean = (v: unknown) => String(v ?? '').trim();

/** Turns CricketData's players_info stats ({ fn, matchtype, stat, value } rows) into formats. */
export function parseCareer(info: any): CareerFormat[] {
  const byType = new Map<string, CareerFormat>();
  for (const row of Array.isArray(info?.stats) ? info.stats : []) {
    const fn = clean(row.fn).toLowerCase();
    const type = clean(row.matchtype).toLowerCase();
    const stat = clean(row.stat).toLowerCase();
    const value = clean(row.value);
    if (!type || !stat || (fn !== 'batting' && fn !== 'bowling')) continue;
    const f = byType.get(type) || { key: type, label: FORMAT_LABELS[type] || type.toUpperCase() };
    const side = (f[fn] ||= {});
    side[stat] = value;
    byType.set(type, f);
  }
  // A format with no matches played is noise.
  const played = (f: CareerFormat) => Number(f.batting?.m || f.bowling?.m || 0) > 0;
  return [...byType.values()].filter(played).sort((a, b) => order(a.key) - order(b.key));
}
const order = (k: string) => {
  const i = Object.keys(FORMAT_LABELS).indexOf(k);
  return i < 0 ? 99 : i;
};

/** Requests left today within the budget. */
function budgetLeft(store: AppStore, day: string): number {
  const cap = Math.max(0, Math.min(100, Number(store.settings.careerStatsDailyCalls ?? 30)));
  return cap - Number(store.jobLog[`career-calls:${day}`] || 0);
}

/** Players whose career record is missing or due a re-check, most important first. */
function due(store: AppStore, now: number, all: boolean, playerId?: string): Player[] {
  const have = new Map(store.playerCareer.map(c => [c.playerId, c]));
  const players = store.teams.flatMap(t => t.squad).filter(p => !playerId || p.id === playerId);
  return players
    .filter(p => {
      if (all || playerId) return true;
      const c = have.get(p.id);
      if (!c) return true;
      if (c.cricketdataId !== (p.cricketdataId || c.cricketdataId)) return true; // admin set another id
      const age = now - +new Date(c.checkedAt);
      return age >= (c.status === 'found' ? REFRESH_DAYS : RETRY_DAYS) * 86_400_000;
    })
    .sort((a, b) => Number(Boolean(have.get(a.id))) - Number(Boolean(have.get(b.id))) || Number(b.isIcon) - Number(a.isIcon) || (a.category === 'Platinum' ? -1 : 0) - (b.category === 'Platinum' ? -1 : 0));
}

/**
 * Fetches career records for the players that need them, within today's request budget. Network
 * first, then one short write. `playerId` fetches one player now (admin button).
 */
export async function refreshCareerStats(opts: { all?: boolean; playerId?: string; max?: number } = {}) {
  if (!careerStatsConfigured()) return { checked: 0, found: 0, report: ['Career stats need the CricketData.org key (Admin → Environment → CricketData).'] };
  const day = new Date().toISOString().slice(0, 10);
  const store = db.get();
  let left = budgetLeft(store, day);
  const targets = due(store, Date.now(), Boolean(opts.all), opts.playerId).slice(0, opts.playerId ? 1 : Math.max(1, opts.max ?? PER_RUN));
  if (!targets.length) return { checked: 0, found: 0, report: ['Every player was checked recently.'] };
  if (left <= 0) return { checked: 0, found: 0, report: [`Today's CricketData budget for career stats (${store.settings.careerStatsDailyCalls ?? 30} requests) is used up; it continues tomorrow.`] };

  const results: PlayerCareer[] = [];
  let calls = 0;
  const report: string[] = [];
  for (const p of targets) {
    const needed = p.cricketdataId ? 1 : 2;
    if (left - calls < needed) {
      report.push('Stopped for today: the CricketData budget for career stats is used up.');
      break;
    }
    const now = new Date().toISOString();
    try {
      let id = p.cricketdataId;
      if (!id) {
        calls++;
        const pick = pickSearchResult(p, await call('players', { search: p.name, offset: '0' }));
        if (!pick.id) {
          results.push({ playerId: p.id, status: pick.status, note: pick.note, checkedAt: now, formats: [] });
          continue;
        }
        id = pick.id;
      }
      calls++;
      const info = await call('players_info', { id });
      if (info?.name && normName(String(info.name)) !== normName(p.name) && !p.cricketdataId) {
        results.push({ playerId: p.id, status: 'no-match', note: `CricketData returned ${info.name}`, checkedAt: now, formats: [] });
        continue;
      }
      const formats = parseCareer(info);
      results.push({ playerId: p.id, cricketdataId: id, status: 'found', checkedAt: now, formats });
    } catch (e: any) {
      results.push({ playerId: p.id, status: 'error', note: String(e?.message || e).slice(0, 200), checkedAt: now, formats: [] });
      if (/apikey|quota|limit|hits/i.test(String(e?.message))) {
        report.push(`CricketData stopped answering: ${e?.message}`);
        break;
      }
    }
  }

  await db.mutate(s => {
    s.jobLog[`career-calls:${day}`] = String(Number(s.jobLog[`career-calls:${day}`] || 0) + calls);
    for (const k of Object.keys(s.jobLog)) if (k.startsWith('career-calls:') && k < `career-calls:${day}`) delete s.jobLog[k];
    for (const r of results) {
      const i = s.playerCareer.findIndex(c => c.playerId === r.playerId);
      const prev = i >= 0 ? s.playerCareer[i] : null;
      // A temporary error keeps the last good record (marked with when it was last tried).
      const next = r.status === 'error' && prev?.status === 'found' ? { ...prev, note: r.note, checkedAt: r.checkedAt } : r;
      if (i >= 0) s.playerCareer[i] = next;
      else s.playerCareer.push(next);
    }
  });
  const found = results.filter(r => r.status === 'found').length;
  report.unshift(`Career stats: ${found} of ${results.length} players found on CricketData.org (${calls} requests).`);
  const missing = results.filter(r => r.status !== 'found').slice(0, 5);
  for (const m of missing) report.push(`${store.teams.flatMap(t => t.squad).find(p => p.id === m.playerId)?.name}: ${m.note || m.status}`);
  return { checked: results.length, found, report };
}

/** The record shown for a player, if any. */
export function careerFor(store: AppStore, playerId: string): PlayerCareer | null {
  const c = store.playerCareer.find(x => x.playerId === playerId);
  return c && c.status === 'found' && c.formats.length ? c : null;
}

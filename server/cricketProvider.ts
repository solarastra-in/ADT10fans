import { db, Player, Team } from './db';
import { fetchText } from './feeds';
import { normName } from './fantasy';
import { OFFICIAL_2026_TEAMS } from './data/officialTeams';

/**
 * Squad refresh from a cricket data provider.
 *
 *  cricbuzz     Reads the public squads page for the series and cross-checks each player's
 *               Cricbuzz profile id and link against the squads on the site. Players listed on
 *               Cricbuzz but missing here are added (role from Cricbuzz). Nothing is invented: when
 *               the page cannot be read, the squads are left as they are and the reason is shown.
 *  cricketdata  CricketData.org series_squad API (needs CRICKET_API_KEY).
 *  custom       Any https URL returning { teams: [{ name, players: [{ name, role, ... }] }] }
 *               or CricketData's shape.
 *
 * Admin-set fantasy credits and notes are always kept for players who stay in a squad.
 */
export interface CricketSyncOptions {
  provider?: 'cricbuzz' | 'cricketdata' | 'custom';
  seriesId?: string;
  apiUrl?: string;
  apiKey?: string;
  /** Replace each squad with the provider's list (players not listed by the provider are removed). */
  overwrite?: boolean;
  /** Preview only: report what would change without saving. */
  dryRun?: boolean;
  teamId?: string;
}

export interface CricketSyncLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'success' | 'error';
  message: string;
}

export interface CricketSyncResult {
  success: boolean;
  provider: string;
  seriesId: string;
  teamsCount: number;
  playersCount: number;
  teamsUpdated: string[];
  added: string[];
  removed: string[];
  linked: number;
  executionTimeMs: number;
  timestamp: string;
  logs: CricketSyncLogEntry[];
  error?: string;
  dryRun: boolean;
}

interface ProviderPlayer {
  name: string;
  role?: string;
  battingStyle?: string;
  bowlingStyle?: string;
  country?: string;
  cricbuzzId?: string;
  profileUrl?: string;
  photoUrl?: string;
}
interface ProviderTeam {
  name: string;
  players: ProviderPlayer[];
}

const defaultSeries = () => process.env.CRICBUZZ_SERIES_ID || '13307';
const CRICBUZZ_SLUG = process.env.CRICBUZZ_SERIES_SLUG || 'abu-dhabi-t10-league-2026';

export function normalizeRole(raw?: string): Player['role'] {
  const r = (raw || '').toLowerCase();
  if (r.includes('wk') || r.includes('keeper')) return 'wicketkeeper';
  if (r.includes('allrounder') || r.includes('all-rounder') || r.includes('all rounder')) return 'allrounder';
  if (r.includes('bowl')) return 'bowler';
  return 'batter';
}

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Parses the Cricbuzz squads page: team headings followed by /profiles/<id>/<slug> links. */
export function parseCricbuzzSquads(html: string, teamNames: string[]): ProviderTeam[] {
  const lower = html.toLowerCase();
  const positions = teamNames
    .map(name => {
      const n = name.toLowerCase();
      // Prefer the squad section heading (e.g. "UAE Bulls Squad"), else the first mention.
      let at = lower.indexOf(`${n} squad`);
      if (at < 0) at = lower.indexOf(`>${n}<`);
      if (at < 0) at = lower.indexOf(n);
      return { name, at };
    })
    .filter(p => p.at >= 0)
    .sort((a, b) => a.at - b.at);
  const teams: ProviderTeam[] = [];
  positions.forEach((p, i) => {
    const end = i + 1 < positions.length ? positions[i + 1].at : html.length;
    const section = html.slice(p.at, end);
    const seen = new Set<string>();
    const players: ProviderPlayer[] = [];
    const re = /href="(?:https:\/\/www\.cricbuzz\.com)?\/profiles\/(\d+)\/([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(section))) {
      const id = m[1];
      if (seen.has(id)) continue;
      seen.add(id);
      const inner = m[3].replace(/<[^>]+>/g, '\n').split('\n').map(s => s.trim()).filter(Boolean);
      const name = inner[0] || m[2].split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      const role = inner.find(s => /bat|bowl|keeper|wk|allrounder/i.test(s));
      const img = m[0].match(/src="(https:\/\/static\.cricbuzz\.com\/a\/img\/v1\/[^"]+)"/);
      players.push({ name: name.replace(/\s*\((c|wk|c & wk)\)\s*$/i, ''), role, cricbuzzId: id, profileUrl: `https://www.cricbuzz.com/profiles/${id}/${m[2]}`, photoUrl: img?.[1] });
    }
    if (players.length) teams.push({ name: p.name, players });
  });
  return teams;
}

export function parseCricketDataSquads(json: any): ProviderTeam[] {
  const list = json?.data || json?.teams || [];
  if (!Array.isArray(list)) return [];
  return list
    .map((t: any) => ({
      name: String(t.teamName || t.name || ''),
      players: (Array.isArray(t.players) ? t.players : []).map((p: any) => ({
        name: String(p.name || ''),
        role: p.role || p.playingRole,
        battingStyle: p.battingStyle,
        bowlingStyle: p.bowlingStyle,
        country: p.country,
        photoUrl: typeof p.playerImg === 'string' && /^https:\/\//.test(p.playerImg) && !/icon512|default/i.test(p.playerImg) ? p.playerImg : undefined,
      })).filter((p: ProviderPlayer) => p.name),
    }))
    .filter((t: ProviderTeam) => t.name && t.players.length);
}

function matchTeam(teams: Team[], providerName: string): Team | undefined {
  const n = normName(providerName);
  return teams.find(t => normName(t.name) === n) || teams.find(t => n.includes(normName(t.name)) || normName(t.name).includes(n)) || teams.find(t => normName(t.short) === n);
}

async function loadProvider(opts: CricketSyncOptions, teamNames: string[]): Promise<{ teams: ProviderTeam[]; label: string }> {
  const provider = opts.provider || 'cricbuzz';
  const seriesId = (opts.seriesId || defaultSeries()).replace(/\D/g, '') || defaultSeries();
  if (provider === 'cricbuzz') {
    const url = `https://www.cricbuzz.com/cricket-series/${seriesId}/${CRICBUZZ_SLUG}/squads`;
    const html = await fetchText(url, 12000);
    return { teams: parseCricbuzzSquads(html, teamNames), label: `Cricbuzz series ${seriesId}` };
  }
  if (provider === 'cricketdata') {
    const key = opts.apiKey || process.env.CRICKET_API_KEY || '';
    if (!key) throw new Error('Set CRICKET_API_KEY (CricketData.org) first');
    const id = opts.seriesId || process.env.CRICKETDATA_SERIES_ID || '';
    if (!id) throw new Error('Enter the CricketData.org series id');
    const json = JSON.parse(await fetchText(`https://api.cricapi.com/v1/series_squad?apikey=${encodeURIComponent(key)}&id=${encodeURIComponent(id)}`, 12000));
    if (json.status && json.status !== 'success') throw new Error(`CricketData: ${json.reason || json.status}`);
    return { teams: parseCricketDataSquads(json), label: 'CricketData.org' };
  }
  const url = opts.apiUrl || '';
  if (!/^https:\/\//.test(url)) throw new Error('Enter an https:// URL for the custom provider');
  const json = JSON.parse(await fetchText(url, 12000));
  return { teams: parseCricketDataSquads(json), label: 'Custom provider' };
}

export async function testCricketProviderConnection(options: CricketSyncOptions = {}) {
  const start = Date.now();
  try {
    const names = db.get().teams.map(t => t.name);
    const { teams, label } = await loadProvider(options, names.length ? names : OFFICIAL_2026_TEAMS.map(t => t.name));
    const players = teams.reduce((s, t) => s + t.players.length, 0);
    return {
      success: teams.length > 0,
      provider: label,
      latencyMs: Date.now() - start,
      teams: teams.map(t => ({ name: t.name, players: t.players.length })),
      message: teams.length ? `${label}: read ${teams.length} team(s) and ${players} player(s).` : `${label} answered but no squads could be read from it.`,
    };
  } catch (e: any) {
    return { success: false, provider: options.provider || 'cricbuzz', latencyMs: Date.now() - start, error: e?.message || String(e), message: `Could not read squads: ${e?.message || e}` };
  }
}

export async function fetchAndPersistOfficialSquads(options: CricketSyncOptions = {}): Promise<CricketSyncResult> {
  const started = Date.now();
  const logs: CricketSyncLogEntry[] = [];
  const log = (level: CricketSyncLogEntry['level'], message: string) => logs.push({ timestamp: new Date().toISOString(), level, message });
  const provider = options.provider || 'cricbuzz';
  const seriesId = options.seriesId || defaultSeries();
  const result: CricketSyncResult = {
    success: false, provider, seriesId, teamsCount: 0, playersCount: 0, teamsUpdated: [], added: [], removed: [], linked: 0,
    executionTimeMs: 0, timestamp: new Date().toISOString(), logs, dryRun: Boolean(options.dryRun),
  };
  let providerTeams: ProviderTeam[] = [];
  try {
    const store = db.get();
    const { teams, label } = await loadProvider(options, store.teams.map(t => t.name));
    providerTeams = teams;
    log('info', `${label}: ${teams.length} team(s), ${teams.reduce((s, t) => s + t.players.length, 0)} player(s) read.`);
  } catch (e: any) {
    result.error = e?.message || String(e);
    log('error', `Could not read squads: ${result.error}. Squads were not changed.`);
    result.executionTimeMs = Date.now() - started;
    return result;
  }
  if (!providerTeams.length) {
    result.error = 'No squads could be read from the provider. Squads were not changed.';
    log('warn', result.error);
    result.executionTimeMs = Date.now() - started;
    return result;
  }

  const apply = (store = db.get()) => {
    Object.assign(result, { teamsUpdated: [], added: [], removed: [], linked: 0, playersCount: 0 });
    for (const pt of providerTeams) {
      const team = matchTeam(store.teams, pt.name);
      if (!team) {
        log('warn', `"${pt.name}" does not match any team on the site; skipped.`);
        continue;
      }
      if (options.teamId && team.id !== options.teamId) continue;
      const before = team.squad.map(p => ({ ...p }));
      const next: Player[] = options.overwrite ? [] : team.squad.map(p => ({ ...p }));
      for (const pp of pt.players) {
        const existing = (options.overwrite ? before : next).find(p => normName(p.name) === normName(pp.name) || (pp.cricbuzzId && p.cricbuzzId === pp.cricbuzzId));
        if (existing) {
          const target = options.overwrite ? { ...existing } : existing;
          if (pp.cricbuzzId && target.cricbuzzId !== pp.cricbuzzId) {
            target.cricbuzzId = pp.cricbuzzId;
            result.linked++;
          }
          if (pp.profileUrl) target.cricbuzzProfileUrl = pp.profileUrl;
          if (pp.photoUrl && !target.photoUrl) target.photoUrl = pp.photoUrl;
          if (pp.battingStyle && !target.battingStyle) target.battingStyle = pp.battingStyle;
          if (pp.bowlingStyle && !target.bowlingStyle) target.bowlingStyle = pp.bowlingStyle;
          if (pp.country && !target.nationality) target.nationality = pp.country;
          if (options.overwrite) next.push(target);
        } else {
          const id = `${team.id}-${slug(pp.name)}`;
          next.push({
            id: next.some(p => p.id === id) ? `${id}-${pp.cricbuzzId || next.length}` : id,
            teamId: team.id,
            name: pp.name,
            role: normalizeRole(pp.role),
            isIcon: false,
            cricbuzzRole: pp.role,
            cricbuzzId: pp.cricbuzzId,
            cricbuzzProfileUrl: pp.profileUrl,
            photoUrl: pp.photoUrl,
            battingStyle: pp.battingStyle,
            bowlingStyle: pp.bowlingStyle,
            nationality: pp.country,
          });
          result.added.push(`${pp.name} (${team.short})`);
        }
      }
      if (options.overwrite) {
        for (const p of before) if (!next.some(n => n.id === p.id)) result.removed.push(`${p.name} (${team.short})`);
      }
      result.teamsUpdated.push(team.name);
      result.playersCount += next.length;
      if (!options.dryRun) {
        team.squad = next;
        team.updatedAt = new Date().toISOString();
      }
    }
    result.teamsCount = result.teamsUpdated.length;
  };
  if (options.dryRun) apply(db.get());
  else await db.mutate(store => apply(store));
  result.success = result.teamsCount > 0;
  log(result.success ? 'success' : 'warn', `${options.dryRun ? 'Preview: ' : ''}${result.teamsCount} team(s) checked, ${result.added.length} player(s) added, ${result.removed.length} removed, ${result.linked} profile link(s) updated.`);
  result.executionTimeMs = Date.now() - started;
  return result;
}

import { Router } from 'express';
import { db, Player, SocialHandle, Team } from '../db';
import { canManageTeam, getAuthUser, requireAdmin, teamScopeOf } from '../auth';
import { bad, isColor, isHttpsUrl, isoOrEmpty, num, optionalUrl, str, userOf, wrap, newId } from '../http';
import { applyLinks, cleanLinks, handleOf, LINK_KEYS, LINK_LABELS, linksFor, lookUpPlayerLinks } from '../playerLinks';
import { statsFor } from '../playerStats';
import { handleKey, OFFICIAL_HANDLES, seedOfficialTeams } from '../seedOfficial';
import { creditsFor } from '../fantasy';
import { fetchAndPersistOfficialSquads, testCricketProviderConnection } from '../cricketProvider';
import { purgeHandleItems, syncHandle } from '../feeds';

export const teamsRouter = Router();

const ROLES: Player['role'][] = ['batter', 'bowler', 'allrounder', 'wicketkeeper'];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export function publicTeam(t: Team, fans = 0) {
  return { ...t, fans, squad: t.squad.map(p => ({ ...p, credits: creditsFor(p), creditsOverride: typeof p.credits === 'number' ? p.credits : null })) };
}

function fanCounts() {
  const counts = new Map<string, number>();
  for (const u of db.get().users) if (u.teamId) counts.set(u.teamId, (counts.get(u.teamId) || 0) + 1);
  return counts;
}

teamsRouter.get('/teams', (_req, res) => {
  const counts = fanCounts();
  res.json({ teams: [...db.get().teams].sort((a, b) => a.sort - b.sort).map(t => publicTeam(t, counts.get(t.id) || 0)) });
});

import { getPlayerComprehensiveStats, getPlayerSocialHandles } from '../data/playerCareerData';

teamsRouter.get('/players/:id', (req, res) => {
  const store = db.get();
  const team = store.teams.find(t => t.squad.some(p => p.id === req.params.id));
  const player = team?.squad.find(p => p.id === req.params.id);
  if (!team || !player) return bad(res, 'Player not found', 404);
  const fixtures = store.matches
    .filter(m => m.teamA === team.id || m.teamB === team.id)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    .map(m => {
      const scored = store.fantasyTeams.find(f => f.matchId === m.id && f.scoredAt && f.breakdown?.some(b => b.playerId === player.id));
      const line = scored?.breakdown?.find(b => b.playerId === player.id);
      const lineups = store.fantasyTeams.filter(f => f.matchId === m.id);
      return {
        matchId: m.id,
        matchNo: m.matchNo,
        opponent: m.teamA === team.id ? m.teamB : m.teamA,
        startsAt: m.startsAt,
        status: m.status,
        result: m.result,
        fantasyPoints: line ? line.base : null,
        fantasyDetail: line?.detail || null,
        selectedBy: lineups.length ? Math.round((lineups.filter(f => f.playerIds.includes(player.id)).length / lineups.length) * 100) : null,
      };
    });
  const comprehensiveStats = getPlayerComprehensiveStats(player);
  const socials = getPlayerSocialHandles(player);
  const links = linksFor(player);
  for (const [k, url] of Object.entries(socials)) {
    if (!(links as any)[k] && url) (links as any)[k] = url;
  }
  res.json({
    player: { ...player, credits: creditsFor(player), socials, stats: comprehensiveStats },
    team: publicTeam(team),
    fixtures,
    season: statsFor(store, player.id),
    links: LINK_KEYS.filter(k => links[k]).map(k => ({ key: k, label: LINK_LABELS[k], url: links[k]!, handle: handleOf(k, links[k]!) })),
    socials,
    stats: comprehensiveStats,
  });
});

/**
 * Admin: find each player's ESPNcricinfo, Wikipedia and official social links by joining ids
 * (Cricbuzz → Cricsheet register → ESPNcricinfo → Wikidata). Network first, then one short write.
 * `all` re-checks players already looked up; otherwise only new ones (or not checked for 14 days).
 */
teamsRouter.post('/admin/players/links/resolve', requireAdmin('teams'), wrap(async (req, res) => {
  const scope = teamScopeOf(userOf(req));
  const all = Boolean(req.body?.all);
  const result = await resolvePlayerLinks({ all, teamId: scope || str(req.body?.teamId, 60) || undefined });
  res.json({ success: true, ...result });
}));

export async function resolvePlayerLinks(opts: { all?: boolean; teamId?: string } = {}) {
  const stale = Date.now() - 14 * 86_400_000;
  const targets = db
    .get()
    .teams.filter(t => !opts.teamId || t.id === opts.teamId)
    .flatMap(t => t.squad)
    .filter(p => opts.all || !p.linksCheckedAt || +new Date(p.linksCheckedAt) < stale)
    .map(p => ({ id: p.id, name: p.name, cricbuzzId: p.cricbuzzId, cricinfoId: p.cricinfoId }));
  if (!targets.length) return { checked: 0, updated: 0, report: ['Every player was checked in the last 14 days.'] };
  const { found, report } = await lookUpPlayerLinks(targets);
  const updated = await db.mutate(store => {
    let n = 0;
    const now = new Date().toISOString();
    const want = new Set(targets.map(t => t.id));
    for (const t of store.teams) {
      for (const p of t.squad) {
        if (!want.has(p.id)) continue;
        const r = found.get(p.id);
        if (r) {
          applyLinks(p, r, now);
          n++;
        } else {
          p.linksCheckedAt = now;
        }
      }
    }
    return n;
  });
  return { checked: targets.length, updated, report };
}

teamsRouter.post('/admin/teams/seed-official', requireAdmin('teams'), (req, res) => {
  const user = userOf(req);
  const scope = teamScopeOf(user);
  if (scope !== null && !req.body?.teamId) return bad(res, 'Team officials can only reset their own team', 403);
  if (scope !== null && req.body?.teamId !== scope) return bad(res, 'You can only manage your own team', 403);
  res.json({ success: true, ...seedOfficialTeams(Boolean(req.body?.overwrite), str(req.body?.teamId, 60) || undefined) });
});

teamsRouter.post('/admin/cricket/test-connection', requireAdmin('teams'), wrap(async (req, res) => {
  if (teamScopeOf(userOf(req)) !== null) return bad(res, 'Only league admins can refresh squads from a provider', 403);
  res.json(await testCricketProviderConnection(req.body || {}));
}));

teamsRouter.post('/admin/cricket/fetch-squads', requireAdmin('teams'), wrap(async (req, res) => {
  if (teamScopeOf(userOf(req)) !== null) return bad(res, 'Only league admins can refresh squads from a provider', 403);
  res.json(await fetchAndPersistOfficialSquads(req.body || {}));
}));

export function formatPlayerSquad(raw: any[], teamId: string, previous: Player[] = []): { squad: Player[]; error?: string } {
  const before = new Map(previous.map(p => [p.id, p]));
  const seen = new Set<string>();
  const squad: Player[] = [];
  for (const p of Array.isArray(raw) ? raw : []) {
    const name = str(p?.name, 60);
    if (!name) continue;
    let id = str(p.id, 80) || `${teamId}-${slug(name)}`;
    if (seen.has(id)) id = `${id}-${seen.size}`;
    seen.add(id);
    const photo = optionalUrl(p.photoUrl);
    const profile = optionalUrl(p.cricbuzzProfileUrl);
    if (photo === null) return { squad: [], error: `${name}: photo must be an https:// link` };
    if (profile === null) return { squad: [], error: `${name}: profile link must be an https:// link` };
    const credits = p.credits === '' || p.credits === null || p.credits === undefined ? undefined : num(p.credits, NaN);
    if (credits !== undefined && (!Number.isFinite(credits) || credits < 4 || credits > 15)) return { squad: [], error: `${name}: credits must be between 4 and 15` };
    const category = str(p.category, 30) || undefined;
    const { links, error: linkError } = cleanLinks(p.links);
    if (linkError) return { squad: [], error: `${name}: ${linkError}` };
    // A link that is new or different from the stored one was typed by an admin and is marked as
    // theirs, so the automatic lookup keeps it. Unchanged links keep their stored source.
    const old = before.get(id);
    const linkSources: Player['linkSources'] = {};
    for (const key of LINK_KEYS) {
      if (!links[key]) continue;
      linkSources[key] = old?.links?.[key] === links[key] && old?.linkSources?.[key] ? old.linkSources[key] : 'admin';
    }
    squad.push({
      id,
      teamId,
      name,
      role: ROLES.includes(p.role) ? p.role : 'batter',
      category,
      credits: credits === undefined ? undefined : Math.round(credits * 2) / 2,
      isIcon: Boolean(p.isIcon) || category?.toLowerCase() === 'icon',
      battingStyle: str(p.battingStyle, 60) || undefined,
      bowlingStyle: str(p.bowlingStyle, 60) || undefined,
      cricbuzzRole: str(p.cricbuzzRole, 60) || undefined,
      cricbuzzId: str(p.cricbuzzId, 40) || undefined,
      cricbuzzProfileUrl: profile || undefined,
      photoUrl: photo || undefined,
      nationality: str(p.nationality, 60) || undefined,
      isCaptain: Boolean(p.isCaptain) || undefined,
      isKeeper: Boolean(p.isKeeper) || p.role === 'wicketkeeper' || undefined,
      imageId: num(p.imageId, 0) || undefined,
      note: str(p.note, 200) || undefined,
      cricinfoId: /^\d{1,10}$/.test(String(p.cricinfoId || '')) ? String(p.cricinfoId) : undefined,
      wikidataId: /^Q\d{1,12}$/.test(String(p.wikidataId || '')) ? String(p.wikidataId) : undefined,
      links: Object.keys(links).length ? links : undefined,
      linkSources: Object.keys(linkSources).length ? linkSources : undefined,
      linksCheckedAt: isoOrEmpty(p.linksCheckedAt) || undefined,
    });
  }
  return { squad };
}

const saveSquad = (req: any, res: any) => {
  const store = db.get();
  const team = store.teams.find(t => t.id === req.params.id);
  if (!team) return bad(res, `Team "${req.params.id}" not found`, 404);
  if (!canManageTeam(userOf(req), team.id)) return bad(res, 'You can only manage your own team', 403);
  if (!Array.isArray(req.body?.squad)) return bad(res, 'Squad must be a list of players');
  const { squad, error } = formatPlayerSquad(req.body.squad, team.id, team.squad);
  if (error) return bad(res, error);
  // Players with Pick XI picks for unplayed matches cannot be removed without warning.
  const removed = team.squad.filter(p => !squad.some(n => n.id === p.id));
  const pending = store.fantasyTeams.filter(f => {
    const m = store.matches.find(x => x.id === f.matchId);
    return m && m.status === 'upcoming' && f.playerIds.some(id => removed.some(r => r.id === id));
  });
  if (pending.length && !req.body?.force) {
    return bad(res, `${removed.filter(r => pending.some(f => f.playerIds.includes(r.id))).map(r => r.name).join(', ')} ${pending.length === 1 ? 'is' : 'are'} in ${pending.length} Pick XI lineup(s) for upcoming matches. Save again with "remove anyway" to continue; those fans will need to pick a replacement.`, 409);
  }
  team.squad = squad;
  team.updatedAt = new Date().toISOString();
  const icon = squad.find(p => p.isIcon);
  if (icon) team.iconPlayer = icon.name;
  db.save();
  res.json({ success: true, team: publicTeam(team), teams: store.teams.map(t => publicTeam(t)) });
};
teamsRouter.post('/teams/:id/squad', requireAdmin('teams'), saveSquad);
teamsRouter.put('/teams/:id/squad', requireAdmin('teams'), saveSquad);

teamsRouter.post('/teams', requireAdmin('teams'), (req, res) => {
  const b = req.body || {};
  const store = db.get();
  const user = userOf(req);
  const name = str(b.name, 80);
  if (!name) return bad(res, 'Team name is required');
  const id = str(b.id, 60) || slug(name);
  const existingIdx = store.teams.findIndex(t => t.id === id);
  if (!canManageTeam(user, existingIdx >= 0 ? id : null)) return bad(res, 'You can only edit your own team', 403);
  const website = optionalUrl(b.website);
  const logo = optionalUrl(b.logo);
  if (website === null) return bad(res, 'Website must be an https:// link');
  if (logo === null) return bad(res, 'Logo must be an https:// image link');
  const prev = existingIdx >= 0 ? store.teams[existingIdx] : undefined;
  const now = new Date().toISOString();
  let squad = prev?.squad || [];
  if (Array.isArray(b.squad)) {
    const r = formatPlayerSquad(b.squad, id, prev?.squad || []);
    if (r.error) return bad(res, r.error);
    squad = r.squad;
  }
  const team: Team = {
    ...(prev || {}),
    id,
    name,
    short: str(b.short, 5).toUpperCase() || prev?.short || name.split(/\s+/).map(w => w[0]).join('').slice(0, 4).toUpperCase(),
    color: isColor(b.color) ? b.color : prev?.color || '#F59E0B',
    secondaryColor: isColor(b.secondaryColor) ? b.secondaryColor : prev?.secondaryColor || '#0F172A',
    home: str(b.home, 120) || prev?.home || store.settings.venue || '',
    iconPlayer: str(b.iconPlayer, 60) || squad.find(p => p.isIcon)?.name || prev?.iconPlayer || '',
    headCoach: b.headCoach !== undefined ? str(b.headCoach, 60) || undefined : prev?.headCoach,
    website: b.website !== undefined ? website || undefined : prev?.website,
    logo: b.logo !== undefined ? logo || undefined : prev?.logo,
    note: b.note !== undefined ? str(b.note, 400) || undefined : prev?.note,
    sort: b.sort !== undefined ? num(b.sort, prev?.sort || store.teams.length + 1) : prev?.sort || store.teams.length + 1,
    squad,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  };
  if (existingIdx >= 0) store.teams[existingIdx] = team;
  else store.teams.push(team);
  db.save();
  res.json({ success: true, team: publicTeam(team), teams: store.teams.map(t => publicTeam(t)) });
});

teamsRouter.delete('/teams/:id', requireAdmin('teams'), (req, res) => {
  const store = db.get();
  const id = req.params.id;
  if (teamScopeOf(userOf(req)) !== null) return bad(res, 'Team officials cannot delete teams', 403);
  if (store.matches.some(m => m.teamA === id || m.teamB === id)) return bad(res, 'This team has fixtures. Delete or edit those matches first.', 409);
  store.teams = store.teams.filter(t => t.id !== id);
  for (const u of store.users) if (u.teamId === id) u.teamId = null;
  for (const h of store.handles.filter(x => x.teamId === id)) purgeHandleItems(store, h.id);
  store.handles = store.handles.filter(h => h.teamId !== id);
  db.save();
  res.json({ success: true, teams: store.teams.map(t => publicTeam(t)) });
});

// ---------- handles ----------
const PLATFORMS: SocialHandle['platform'][] = ['X', 'Instagram', 'Threads', 'Facebook', 'TikTok', 'LinkedIn', 'YouTube', 'RSS'];
const PLATFORM_HOSTS: Record<string, RegExp> = {
  X: /^(www\.)?(x|twitter)\.com$/,
  Instagram: /^(www\.)?instagram\.com$/,
  Threads: /^(www\.)?threads\.(net|com)$/,
  Facebook: /^(www\.|m\.)?facebook\.com$/,
  TikTok: /^(www\.)?tiktok\.com$/,
  LinkedIn: /^(www\.)?linkedin\.com$/,
  YouTube: /^(www\.|m\.)?youtube\.com$/,
};

teamsRouter.get('/handles', (req, res) => {
  const viewer = getAuthUser(req);
  let result = db.get().handles;
  if (viewer?.role !== 'admin') {
    result = result
      .filter(h => h.status === 'verified')
      .map(({ lastSyncNote, ...h }) => ({ ...h, meta: h.meta?.channelId ? { channelId: h.meta.channelId } : {} })) as SocialHandle[];
  }
  const { teamId, platform } = req.query;
  if (teamId) result = result.filter(h => h.teamId === teamId);
  if (platform) result = result.filter(h => h.platform.toLowerCase() === String(platform).toLowerCase());
  res.json({ handles: result });
});

teamsRouter.post('/handles', requireAdmin('social'), wrap(async (req, res) => {
  const b = req.body || {};
  const store = db.get();
  const user = userOf(req);
  if (!PLATFORMS.includes(b.platform)) return bad(res, 'Choose a platform');
  if (!isHttpsUrl(b.url)) return bad(res, 'Profile URL must start with https://');
  const url = str(b.url, 500);
  const host = new URL(url).hostname.toLowerCase();
  if (PLATFORM_HOSTS[b.platform] && !PLATFORM_HOSTS[b.platform].test(host)) return bad(res, `That is not a ${b.platform} link`);
  const teamId = b.teamId ? str(b.teamId, 60) : null;
  if (teamId && !store.teams.some(t => t.id === teamId)) return bad(res, 'Unknown team');
  if (!canManageTeam(user, teamId)) return bad(res, 'You can only add handles for your own team', 403);
  const now = new Date().toISOString();
  const existing = (b.id && store.handles.find(h => h.id === b.id)) || store.handles.find(h => handleKey(h.url) === handleKey(url));
  if (existing && !canManageTeam(user, existing.teamId)) return bad(res, 'You can only edit your own team’s handles', 403);
  const status: SocialHandle['status'] = b.status === 'pending' ? 'pending' : 'verified';
  const feedUrl = b.feedUrl === undefined ? undefined : str(b.feedUrl, 1000);
  if (feedUrl && !isHttpsUrl(feedUrl)) return bad(res, 'Feed address must start with https://');
  const derived = url.replace(/\/+$/, '').split('/').pop() || url;
  let target: SocialHandle;
  if (existing) {
    const urlChanged = handleKey(existing.url) !== handleKey(url);
    Object.assign(existing, {
      platform: b.platform,
      url,
      teamId,
      handle: str(b.handle, 80) || existing.handle,
      status,
      verifiedAt: status === 'verified' ? existing.verifiedAt || now : undefined,
      meta: { ...(urlChanged ? {} : existing.meta || {}), ...(feedUrl !== undefined ? { feedUrl: feedUrl || undefined } : {}) },
    });
    if (urlChanged) purgeHandleItems(store, existing.id);
    target = existing;
  } else {
    const known = OFFICIAL_HANDLES.find(o => handleKey(o.url) === handleKey(url));
    target = { id: newId('h'), teamId, platform: b.platform, handle: str(b.handle, 80) || (b.platform === 'Facebook' || b.platform === 'LinkedIn' ? derived : derived.startsWith('@') ? derived : `@${derived}`), url, status, source: 'admin', meta: { ...(known ? { ...(known.meta || {}), evidence: known.evidence } : {}), ...(feedUrl ? { feedUrl } : {}) }, verifiedAt: status === 'verified' ? now : undefined, foundAt: now };
    store.handles.push(target);
  }
  delete store.jobLog[`handle-removed:${handleKey(url)}`];
  for (const a of store.approvals) if (a.status === 'pending' && a.payload?.handleId === target.id && status === 'verified') {
    a.status = 'approved';
    a.decidedAt = now;
  }
  db.save();
  // Pull its content straight away so it shows up without waiting for the next scheduled sync.
  let sync = null;
  if (target.status === 'verified') sync = await syncHandle(target.id).catch(() => null);
  res.json({ success: true, handle: target, sync: sync ? { status: sync.status, note: sync.note, items: sync.items.length } : null, handles: db.get().handles });
}));

teamsRouter.post('/handles/:id/sync', requireAdmin('social'), wrap(async (req, res) => {
  const h = db.get().handles.find(x => x.id === req.params.id);
  if (!h) return bad(res, 'Handle not found', 404);
  if (!canManageTeam(userOf(req), h.teamId)) return bad(res, 'You can only manage your own team’s handles', 403);
  const r = await syncHandle(h.id);
  if (!r) return bad(res, 'Only verified handles are synced');
  res.json({ success: true, status: r.status, note: r.note, items: r.items.length, handle: db.get().handles.find(x => x.id === h.id) });
}));

teamsRouter.delete('/handles/:id', requireAdmin('social'), (req, res) => {
  const store = db.get();
  const h = store.handles.find(x => x.id === req.params.id);
  if (!h) return bad(res, 'Handle not found', 404);
  if (!canManageTeam(userOf(req), h.teamId)) return bad(res, 'You can only remove your own team’s handles', 403);
  store.handles = store.handles.filter(x => x.id !== h.id);
  const purged = purgeHandleItems(store, h.id);
  // Remember the removal so the checked-handle list does not add it back.
  store.jobLog[`handle-removed:${handleKey(h.url)}`] = new Date().toISOString();
  for (const a of store.approvals) if (a.payload?.handleId === h.id && a.status === 'pending') a.status = 'rejected';
  db.save();
  res.json({ success: true, purged, handles: store.handles });
});

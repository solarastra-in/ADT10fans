import crypto from 'crypto';
import { AppStore, db, SocialHandle, Team } from './db';
import { OFFICIAL_2026_TEAMS } from './data/officialTeams';
import { OFFICIAL_SOCIAL_POSTS } from './data/officialSocialPosts';
import { idFor } from './feeds';

export { OFFICIAL_2026_TEAMS };

type HandleSeed = Omit<SocialHandle, 'id' | 'verifiedAt' | 'foundAt' | 'status' | 'source'> & { evidence: string };

/**
 * Accounts that have been checked by hand. Each one is linked from the owner's own site or channel,
 * or confirmed by the franchise. Anything else (including other teams' accounts) has to be added in
 * Admin → Handles or approved from the Discovery agent's suggestions.
 */
export const OFFICIAL_HANDLES: HandleSeed[] = [
  // League: linked from the footer of abudhabit10.com
  { teamId: null, platform: 'YouTube', handle: '@T10LeagueOfficial', url: 'https://www.youtube.com/@T10LeagueOfficial', meta: { channelId: 'UCgNs5GVvw5Td-05qp22sPLg' }, evidence: 'abudhabit10.com footer' },
  { teamId: null, platform: 'X', handle: '@T10League', url: 'https://x.com/T10League', meta: {}, evidence: 'abudhabit10.com footer' },
  { teamId: null, platform: 'Instagram', handle: '@t10league', url: 'https://www.instagram.com/t10league/', meta: {}, evidence: 'abudhabit10.com footer' },
  { teamId: null, platform: 'Facebook', handle: 'T10league', url: 'https://www.facebook.com/T10league', meta: {}, evidence: 'abudhabit10.com footer' },
  { teamId: null, platform: 'TikTok', handle: '@abudhabit10', url: 'https://www.tiktok.com/@abudhabit10', meta: {}, evidence: 'abudhabit10.com footer' },

  // UAE Bulls (formerly Delhi Bulls; the Instagram/Threads username was kept when the team was renamed)
  { teamId: 'bulls', platform: 'YouTube', handle: '@BullsT10', url: 'https://www.youtube.com/@BullsT10', meta: { channelId: 'UC2XL7xVAund-zNH6XI8Rb0w' }, evidence: 'Channel "UAE Bulls": "the official Youtube channel of UAE Bulls"' },
  { teamId: 'bulls', platform: 'X', handle: '@UAEBullsT10', url: 'https://x.com/UAEBullsT10', meta: {}, evidence: 'X profile "UAE Bulls (@UAEBullsT10)"' },
  { teamId: 'bulls', platform: 'Instagram', handle: '@delhibullst10', url: 'https://www.instagram.com/delhibullst10/', meta: { note: 'Profile name is UAE Bulls' }, evidence: 'Instagram profile "UAE Bulls (@delhibullst10)"' },
  { teamId: 'bulls', platform: 'Threads', handle: '@delhibullst10', url: 'https://www.threads.com/@delhibullst10', meta: {}, evidence: 'Threads account linked to the Instagram profile' },

  // Arabian Aces: the franchise's own accounts
  { teamId: 'aces', platform: 'X', handle: '@arabianacesT10', url: 'https://x.com/arabianacesT10', meta: {}, evidence: 'Confirmed by the franchise' },
  { teamId: 'aces', platform: 'Instagram', handle: '@arabianacesofficial', url: 'https://www.instagram.com/arabianacesofficial/', meta: {}, evidence: 'Confirmed by the franchise' },
  { teamId: 'aces', platform: 'Threads', handle: '@arabianacesofficial', url: 'https://www.threads.com/@arabianacesofficial', meta: {}, evidence: 'Confirmed by the franchise' },
  { teamId: 'aces', platform: 'Facebook', handle: 'arabianacesofficial', url: 'https://www.facebook.com/arabianacesofficial/', meta: {}, evidence: 'Confirmed by the franchise' },
  { teamId: 'aces', platform: 'TikTok', handle: '@arabianaces', url: 'https://www.tiktok.com/@arabianaces', meta: {}, evidence: 'Confirmed by the franchise' },
  { teamId: 'aces', platform: 'LinkedIn', handle: 'arabianaces', url: 'https://www.linkedin.com/in/arabianaces/', meta: {}, evidence: 'Confirmed by the franchise' },
];

const DEFAULT_VENUE = 'Zayed Cricket Stadium, Abu Dhabi';
export const handleKey = (url: string) => url.toLowerCase().replace(/\/+$/, '').replace('://twitter.com/', '://x.com/').replace('://www.threads.net/', '://www.threads.com/');

function newHandle(h: HandleSeed, now: string): SocialHandle {
  const { evidence, ...rest } = h;
  return {
    ...rest,
    meta: { ...(h.meta || {}), evidence },
    id: 'h-' + crypto.randomUUID().replace(/-/g, '').slice(0, 10),
    status: 'verified',
    source: 'official',
    verifiedAt: now,
    foundAt: now,
  };
}

function cloneTeam(t: Team, venue: string, now: string): Team {
  return { ...t, home: venue, squad: t.squad.map(p => ({ ...p })), createdAt: now, updatedAt: now };
}

/**
 * Runs on every store load. A brand-new store gets the six franchises and the checked handles.
 * Existing stores keep every admin edit; only missing official handles are added (unless an admin
 * deleted them) and known channel ids are filled in. Returns true when it changed something.
 */
export function initializeStore(store: AppStore): boolean {
  let changed = false;
  const now = new Date().toISOString();
  if (!store.jobLog['seed:teams'] && store.teams.length === 0) {
    store.teams = OFFICIAL_2026_TEAMS.map(t => cloneTeam(t, store.settings.venue || DEFAULT_VENUE, now));
    store.jobLog['seed:teams'] = now;
    changed = true;
  } else if (!store.jobLog['seed:teams']) {
    store.jobLog['seed:teams'] = now;
    changed = true;
  }
  if (reconcileOfficialHandles(store, now)) changed = true;
  if (seedOfficialSocialPosts(store, now)) changed = true;
  if (!store.jobLog['game-secret'] && !process.env.GAME_SECRET) {
    store.jobLog['game-secret'] = crypto.randomBytes(24).toString('hex');
    changed = true;
  }
  return changed;
}

/** Populates authentic social media posts for all official team handles */
export function seedOfficialSocialPosts(store: AppStore, now = new Date().toISOString()): boolean {
  let changed = false;
  const existingUrls = new Set(store.feedItems.map(f => f.url.toLowerCase()));
  for (const post of OFFICIAL_SOCIAL_POSTS) {
    if (!existingUrls.has(post.url.toLowerCase())) {
      const matchingHandle = store.handles.find(h =>
        h.platform === post.platform &&
        ((post.teamId && h.teamId === post.teamId) || (!post.teamId && !h.teamId))
      );
      store.feedItems.push({
        ...post,
        id: idFor('seed', post.url),
        handleId: matchingHandle?.id || null,
        createdAt: now,
      });
      existingUrls.add(post.url.toLowerCase());
      changed = true;
    }
  }
  if (changed) {
    store.feedItems.sort((a, b) => (a.status === 'pinned' ? -1 : 0) - (b.status === 'pinned' ? -1 : 0) || +new Date(b.publishedAt) - +new Date(a.publishedAt));
  }
  return changed;
}

/** Adds checked handles that are missing and fills in their metadata. Never re-adds one an admin removed. */
export function reconcileOfficialHandles(store: AppStore, now = new Date().toISOString()): boolean {
  let changed = false;
  for (const h of OFFICIAL_HANDLES) {
    if (h.teamId && !store.teams.some(t => t.id === h.teamId)) continue;
    const key = handleKey(h.url);
    if (store.jobLog[`handle-removed:${key}`]) continue;
    const existing = store.handles.find(x => handleKey(x.url) === key || (x.platform === h.platform && x.teamId === h.teamId && x.handle.toLowerCase() === h.handle.toLowerCase()));
    if (!existing) {
      store.handles.push(newHandle(h, now));
      changed = true;
      continue;
    }
    if (existing.status !== 'verified' && existing.source === 'legacy') {
      existing.status = 'verified';
      existing.source = 'official';
      existing.verifiedAt = now;
      for (const a of store.approvals) if (a.status === 'pending' && a.payload?.handleId === existing.id) {
        a.status = 'approved';
        a.decidedAt = now;
      }
      changed = true;
    }
    const meta = existing.meta || {};
    for (const [k, v] of Object.entries(h.meta || {})) {
      if (meta[k] === undefined) {
        meta[k] = v;
        changed = true;
      }
    }
    if (!meta.evidence) {
      meta.evidence = h.evidence;
      changed = true;
    }
    existing.meta = meta;
  }
  // Unconfirmed handles carried over from older versions go to the approval queue once.
  for (const h of store.handles) {
    if (h.source !== 'legacy' || h.status !== 'pending') continue;
    if (store.approvals.some(a => a.payload?.handleId === h.id)) continue;
    const team = store.teams.find(t => t.id === h.teamId);
    store.approvals.unshift({
      id: 'ap-' + crypto.randomUUID().replace(/-/g, '').slice(0, 10),
      kind: 'handle',
      title: `${team?.name || 'League'} · ${h.platform} ${h.handle}`,
      detail: `An earlier version of the site listed this account without checking it. Open ${h.url} and approve it only if it is the team's official account.`,
      payload: { handleId: h.id, teamId: h.teamId, platform: h.platform, url: h.url },
      status: 'pending',
      createdAt: now,
    });
    changed = true;
  }
  return changed;
}

/** Admin action: add the official franchises (and, with overwrite, reset their squads to the published lists). */
export function seedOfficialTeams(overwrite = false, onlyTeamId?: string) {
  const store = db.get();
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];
  const now = new Date().toISOString();
  const venue = store.settings.venue || DEFAULT_VENUE;

  for (const official of OFFICIAL_2026_TEAMS) {
    if (onlyTeamId && official.id !== onlyTeamId) continue;
    const idx = store.teams.findIndex(t => t.id === official.id || t.name.toLowerCase() === official.name.toLowerCase());
    if (idx === -1) {
      store.teams.push(cloneTeam(official, venue, now));
      created.push(official.name);
    } else if (overwrite) {
      const prev = store.teams[idx];
      // Keep admin-set credits and notes for players who are still in the squad.
      const prevById = new Map(prev.squad.map(p => [p.id, p]));
      store.teams[idx] = {
        ...prev,
        ...official,
        home: prev.home || venue,
        logo: prev.logo,
        website: prev.website || official.website,
        squad: official.squad.map(p => ({ ...p, credits: prevById.get(p.id)?.credits, note: prevById.get(p.id)?.note })),
        createdAt: prev.createdAt || now,
        updatedAt: now,
      };
      if (prev.id !== official.id) for (const u of store.users) if (u.teamId === prev.id) u.teamId = official.id;
      updated.push(official.name);
    } else {
      skipped.push(official.name);
    }
  }
  store.teams.sort((a, b) => a.sort - b.sort);
  for (const k of Object.keys(store.jobLog)) if (k.startsWith('handle-removed:') && overwrite && !onlyTeamId) delete store.jobLog[k];
  const before = store.handles.length;
  reconcileOfficialHandles(store, now);
  const handlesAdded = store.handles.length - before;
  db.save();
  const summary = `${created.length} team(s) added, ${updated.length} reset to the published squads, ${skipped.length} kept as they are; ${handlesAdded} checked handle(s) added.`;
  return { teams: store.teams, handles: store.handles, created, updated, skipped, handlesAdded, summary };
}

db.onLoad(initializeStore);

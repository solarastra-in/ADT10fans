import crypto from 'crypto';
import { Router } from 'express';
import { db, FeedItem } from '../db';
import { canManageTeam, getAuthUser, hasPermission, rateLimit, requireAdmin, requireSuperAdmin } from '../auth';
import { bad, isHttpsUrl, isoOrEmpty, newId, optionalUrl, str, userOf, wrap } from '../http';
import { getCuratorConfig, fetchCurator, lookupOEmbed, extractPostMetadata, bulkIngestUrls, merge, platformOfUrl, syncAllFeeds, syncTeamFeeds, youtubeIdFromUrl } from '../feeds';
import { runSocialHarvesterAgent } from '../agents';

export const feedsRouter = Router();

const FEED_PLATFORMS: FeedItem['platform'][] = ['YouTube', 'X', 'Instagram', 'Threads', 'TikTok', 'Facebook', 'LinkedIn', 'Web'];

/**
 * GET /api/feeds?teamId=&platform=&category=social|news|marketing&kind=video&limit=&before=
 * Fans see live and pinned items, newest first (pinned on top), paged with `before`.
 */
feedsRouter.get('/feeds', (req, res) => {
  const viewer = getAuthUser(req);
  const store = db.get();
  const isAdmin = viewer?.role === 'admin' && hasPermission(viewer, 'social');
  const { teamId, platform, category, status, kind } = req.query;
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 40));
  let items = store.feedItems;
  if (teamId === 'league') items = items.filter(f => !f.teamId);
  else if (teamId) items = items.filter(f => f.teamId === teamId);
  if (platform) items = items.filter(f => f.platform.toLowerCase() === String(platform).toLowerCase());
  if (category) items = items.filter(f => f.category === category);
  if (kind === 'video') items = items.filter(f => f.platform === 'YouTube' || f.kind === 'video' || f.kind === 'live');
  if (status && isAdmin) items = items.filter(f => f.status === status);
  else if (!isAdmin) items = items.filter(f => f.status !== 'hidden');
  items = [...items].sort((a, b) => (a.status === 'pinned' ? -1 : 0) - (b.status === 'pinned' ? -1 : 0) || +new Date(b.publishedAt) - +new Date(a.publishedAt));
  const before = isoOrEmpty(req.query.before);
  if (before) items = items.filter(f => f.status !== 'pinned' && +new Date(f.publishedAt) < +new Date(before));
  const countsByPlatform: Record<string, number> = {};
  for (const f of items) countsByPlatform[f.platform] = (countsByPlatform[f.platform] || 0) + 1;
  const page = items.slice(0, limit);
  res.json({ items: page, total: items.length, countsByPlatform, hasMore: items.length > page.length });
});

/**
 * POST /api/feeds/pull
 * On-demand pull from official social handles for a team or for all teams (Curator.io replacement engine).
 */
feedsRouter.post('/feeds/pull', rateLimit('feeds-pull', 6, 10 * 60_000), wrap(async (req, res) => {
  const teamId = str(req.body?.teamId, 60) || undefined;
  const viewer = getAuthUser(req);
  const isAdmin = Boolean(viewer && hasPermission(viewer, 'social'));
  if (!teamId) {
    if (!isAdmin) return bad(res, 'Choose a team', 400);
    return res.json({ success: true, ...(await syncAllFeeds()) });
  }
  const store = db.get();
  if (!store.teams.some(t => t.id === teamId)) return bad(res, 'Team not found', 404);
  // Visitors can refresh a team at most every 5 minutes; accounts are also pulled every 10 minutes anyway.
  const last = Math.max(0, ...store.handles.filter(h => h.teamId === teamId && h.lastSyncAt).map(h => +new Date(h.lastSyncAt!)));
  if (!isAdmin && Date.now() - last < 5 * 60_000) {
    return res.json({ success: true, skipped: true, lastPulledAt: new Date(last).toISOString(), totalItems: 0, added: 0, summary: 'Already up to date' });
  }
  res.json({ success: true, ...(await syncTeamFeeds(teamId)) });
}));

const syncFeeds = wrap(async (_req, res) => {
  const r = await syncAllFeeds();
  res.json({ success: true, ...r });
});
feedsRouter.post('/admin/feeds/sync', requireAdmin('social'), syncFeeds);

/** Feed health: what each verified handle returned on its last pull. */
feedsRouter.get('/admin/feeds/health', requireAdmin('social'), (req, res) => {
  const store = db.get();
  const user = userOf(req);
  // Team officials see only their own team's handles; league admins see everything.
  const handles = store.handles.filter(h => canManageTeam(user, h.teamId));
  res.json({
    handles: handles.map(h => ({
      id: h.id, teamId: h.teamId, platform: h.platform, handle: h.handle, url: h.url, status: h.status,
      lastSyncAt: h.lastSyncAt || null, lastSyncStatus: h.lastSyncStatus || null, lastSyncNote: h.lastSyncNote || null,
      items: store.feedItems.filter(f => f.handleId === h.id).length,
      channelId: h.meta?.channelId || null,
    })),
    curator: { configured: getCuratorConfig().isConfigured, items: store.feedItems.filter(f => f.sourceType === 'curator').length },
    news: store.feedItems.filter(f => f.sourceType === 'news-rss').length,
  });
});

/** Add a post by pasting its link (Universal extractor for Instagram, TikTok, YouTube, X, Facebook, Web). */
feedsRouter.post('/admin/feeds/from-link', requireAdmin('social'), wrap(async (req, res) => {
  const url = str(req.body?.url, 1000);
  if (!isHttpsUrl(url)) return bad(res, 'Paste the full https:// link to the post or video');
  const teamId = str(req.body?.teamId, 60) || null;
  const user = userOf(req);
  if (teamId && !db.get().teams.some(t => t.id === teamId)) return bad(res, 'Unknown team');
  if (!canManageTeam(user, teamId)) return bad(res, 'You can only add posts for your own team', 403);
  const meta = await extractPostMetadata(url);
  const title = str(req.body?.title, 300) || (meta.titleFound ? meta.title : '');
  if (!title) return bad(res, 'We could not read a title for that link. Type one in.');
  const item: FeedItem = {
    id: newId('feed'),
    teamId,
    platform: meta.platform,
    kind: meta.kind,
    category: req.body?.category === 'news' ? 'news' : 'social',
    title,
    url,
    videoId: meta.videoId,
    image: (str(req.body?.image, 1000) || meta.image) && isHttpsUrl(str(req.body?.image, 1000) || meta.image || '') ? (str(req.body?.image, 1000) || meta.image) : null,
    source: str(req.body?.source, 80) || meta.author || meta.platform,
    summary: str(req.body?.summary, 1000) || meta.summary,
    status: req.body?.pinned ? 'pinned' : 'live',
    publishedAt: isoOrEmpty(req.body?.publishedAt) || meta.publishedAt || new Date().toISOString(),
    createdAt: new Date().toISOString(),
    sourceType: 'admin',
  };
  merge([item]);
  db.save();
  res.json({ success: true, item: db.get().feedItems.find(f => f.url.toLowerCase() === url.toLowerCase()) || item });
}));

/** Native Social Harvester: Discovers and pulls recent posts for teams across handles without Curator.io */
feedsRouter.post('/admin/feeds/harvest', requireAdmin('social'), wrap(async (req, res) => {
  const user = userOf(req);
  const teamId = str(req.body?.teamId, 60) || undefined;
  if (teamId && !canManageTeam(user, teamId)) return bad(res, 'You can only harvest for your own team', 403);
  const result = await runSocialHarvesterAgent(teamId);
  res.json({ success: result.status !== 'error', ...result });
}));

/** Bulk Ingest: Paste multiple social URLs at once (Instagram, X, TikTok, YouTube, etc.) */
feedsRouter.post('/admin/feeds/bulk-ingest', requireAdmin('social'), wrap(async (req, res) => {
  const user = userOf(req);
  const teamId = str(req.body?.teamId, 60) || null;
  if (teamId && !canManageTeam(user, teamId)) return bad(res, 'You can only ingest posts for your own team', 403);
  const rawUrls: string[] = Array.isArray(req.body?.urls) ? req.body.urls : String(req.body?.urls || '').split(/[\r\n,]+/);
  if (!rawUrls.length) return bad(res, 'Provide at least one URL');
  const result = await bulkIngestUrls(rawUrls, teamId, {
    pinned: Boolean(req.body?.pinned),
    category: req.body?.category === 'news' ? 'news' : 'social',
  });
  res.json({ success: true, ...result });
}));

/**
 * Public Webhook Endpoint for Zapier / IFTTT / Make / Custom Bots:
 * POST /api/feeds/webhook
 * Accepts: { url, title?, summary?, image?, platform?, teamId?, secret? }
 */
feedsRouter.post('/feeds/webhook', wrap(async (req, res) => {
  // Off until a key is saved in Admin → Environment (FEED_WEBHOOK_SECRET); the key must come in the
  // X-Webhook-Secret header. Without this anyone could put links on the site.
  const secret = process.env.FEED_WEBHOOK_SECRET || '';
  if (!secret) return bad(res, 'The feed webhook is off. Set a webhook key in Admin → Environment to turn it on.', 503);
  const given = Buffer.from(String(req.headers['x-webhook-secret'] || ''));
  const want = Buffer.from(secret);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return bad(res, 'Wrong or missing X-Webhook-Secret header', 401);
  const url = str(req.body?.url, 1000);
  if (!isHttpsUrl(url)) return bad(res, 'url must be a valid https:// link');
  const meta = await extractPostMetadata(url);
  const title = str(req.body?.title, 300) || (meta.titleFound ? meta.title : '');
  if (!title) return bad(res, 'No title could be read from that link; send one in "title"');
  const teamId = str(req.body?.teamId, 60) || null;
  const item: FeedItem = {
    id: newId('hook'),
    teamId,
    platform: meta.platform,
    kind: meta.kind,
    category: req.body?.category === 'news' ? 'news' : 'social',
    title,
    url,
    videoId: meta.videoId,
    image: (str(req.body?.image, 1000) || meta.image) && isHttpsUrl(str(req.body?.image, 1000) || meta.image || '') ? (str(req.body?.image, 1000) || meta.image) : null,
    source: str(req.body?.source, 80) || meta.author || meta.platform,
    summary: str(req.body?.summary, 1000) || meta.summary,
    status: req.body?.pinned ? 'pinned' : 'live',
    publishedAt: isoOrEmpty(req.body?.publishedAt) || meta.publishedAt || new Date().toISOString(),
    createdAt: new Date().toISOString(),
    sourceType: 'admin',
  };
  const added = merge([item]);
  db.save();
  res.json({ success: true, added: added > 0, item });
}));

feedsRouter.post('/feeds', requireAdmin('social'), (req, res) => {
  const b = req.body || {};
  const store = db.get();
  const user = userOf(req);
  const existing = b.id ? store.feedItems.find(f => f.id === b.id) : undefined;
  if (existing) {
    if (!canManageTeam(user, existing.teamId)) return bad(res, 'You can only edit your own team’s posts', 403);
    if (b.status && ['live', 'hidden', 'pinned'].includes(b.status)) existing.status = b.status;
    if (b.title !== undefined) existing.title = str(b.title, 300) || existing.title;
    if (b.summary !== undefined) existing.summary = str(b.summary, 1000);
    if (b.teamId !== undefined) {
      const t = b.teamId || null;
      if (!canManageTeam(user, t)) return bad(res, 'You can only assign posts to your own team', 403);
      existing.teamId = t;
    }
    if (b.url !== undefined) {
      if (!isHttpsUrl(b.url)) return bad(res, 'Link must start with https://');
      existing.url = str(b.url, 1000);
      existing.videoId = existing.platform === 'YouTube' ? youtubeIdFromUrl(existing.url) || undefined : undefined;
    }
    if (b.image !== undefined) {
      const img = optionalUrl(b.image);
      if (img === null) return bad(res, 'Image must be an https:// link');
      existing.image = img || null;
    }
    db.save();
    return res.json({ success: true, item: existing });
  }
  if (!isHttpsUrl(b.url)) return bad(res, 'Post link must start with https://');
  const title = str(b.title, 300);
  if (!title) return bad(res, 'Title is required');
  const image = optionalUrl(b.image);
  if (image === null) return bad(res, 'Image must be an https:// link');
  const teamId = b.teamId || null;
  if (!canManageTeam(user, teamId)) return bad(res, 'You can only add posts for your own team', 403);
  const url = str(b.url, 1000);
  const platform = FEED_PLATFORMS.includes(b.platform) ? b.platform : platformOfUrl(url);
  const item: FeedItem = {
    id: newId('feed'),
    teamId,
    platform,
    kind: ['post', 'video', 'live', 'article'].includes(b.kind) ? b.kind : platform === 'YouTube' ? 'video' : 'post',
    category: ['social', 'news', 'marketing'].includes(b.category) ? b.category : 'social',
    title,
    url,
    videoId: platform === 'YouTube' ? youtubeIdFromUrl(url) || undefined : undefined,
    image: image || null,
    source: str(b.source, 80) || 'Admin',
    summary: str(b.summary, 1000),
    status: ['live', 'hidden', 'pinned'].includes(b.status) ? b.status : 'live',
    publishedAt: isoOrEmpty(b.publishedAt) || new Date().toISOString(),
    createdAt: new Date().toISOString(),
    sourceType: 'admin',
  };
  store.feedItems.unshift(item);
  db.save();
  res.json({ success: true, item });
});

feedsRouter.delete('/feeds/:id', requireAdmin('social'), (req, res) => {
  const store = db.get();
  const item = store.feedItems.find(f => f.id === req.params.id);
  if (!item) return bad(res, 'Post not found', 404);
  if (!canManageTeam(userOf(req), item.teamId)) return bad(res, 'You can only remove your own team’s posts', 403);
  store.feedItems = store.feedItems.filter(f => f.id !== item.id);
  db.save();
  res.json({ success: true });
});

// ---------- Curator.io (super admin) ----------
feedsRouter.get('/curator/config', requireSuperAdmin, (_req, res) => {
  const { apiKey, ...cfg } = getCuratorConfig();
  res.json({ success: true, ...cfg });
});

const curatorPull = wrap(async (_req, res) => {
  const cfg = getCuratorConfig();
  if (!cfg.isConfigured) return res.json({ success: false, feedId: '', posts: [], rawCount: 0, message: 'Set a Curator feed id in Settings first.' });
  try {
    const { items } = await fetchCurator(db.get());
    const added = merge(items);
    db.save();
    res.json({ success: items.length > 0, feedId: cfg.feedId, source: cfg.feedIdSource, posts: items, rawCount: items.length, added, message: items.length ? `${items.length} post(s) read from Curator (${added} new).` : 'Curator answered but returned no posts. Check that the feed is published.' });
  } catch (e: any) {
    res.json({ success: false, feedId: cfg.feedId, source: cfg.feedIdSource, posts: [], rawCount: 0, message: `Could not read the Curator feed: ${e?.message || e}` });
  }
});
feedsRouter.get('/curator/feed', requireSuperAdmin, curatorPull);
feedsRouter.post('/curator/sync', requireSuperAdmin, curatorPull);

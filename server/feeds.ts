import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { AppStore, db, FeedItem, SocialHandle } from './db';

/**
 * Pulls public content for the verified handles and the news searches.
 *
 *   YouTube   public uploads RSS (by channel id)                 -> videos playable in the site
 *   X         public syndication timeline (best effort)         -> posts
 *   Curator   a Curator.io feed, if one is configured            -> Instagram / Facebook / TikTok / X posts
 *   News      Google News RSS, with Bing News as a fallback      -> headlines that link to the publisher
 *
 * Instagram, Threads, Facebook, TikTok and LinkedIn have no public feed. Their profiles are shown
 * with the platform's own embed (Facebook page plugin, TikTok creator embed) or a profile card.
 *
 * Every item comes from a real response. Nothing is generated when a source is unavailable; the
 * handle is marked with the error so admins can see it in Feed health.
 *
 * Offline testing: set FEED_FIXTURES_DIR. Each URL is then read from <dir>/<sha1(url)>.txt instead of
 * the network (see tests/make-fixtures.mjs).
 */

const UA = 'Mozilla/5.0 (compatible; ADT10FansBot/1.0; +https://abudhabit10.com)';
const MAX_NEWS = 150;
const MAX_VIDEOS = 300;
const MAX_POSTS = 400;

function decodeEntities(s: string) {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .trim();
}
const stripTags = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const tag = (blk: string, name: string) => {
  const m = blk.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decodeEntities(m[1]) : '';
};
const attr = (blk: string, name: string, a: string) => {
  const m = blk.match(new RegExp(`<${name}[^>]*\\s${a}="([^"]+)"`));
  return m ? decodeEntities(m[1]) : '';
};

export const idFor = (prefix: string, url: string) => `${prefix}-${crypto.createHash('sha1').update(url).digest('hex').slice(0, 12)}`;
export const fixtureKey = (url: string) => crypto.createHash('sha1').update(url).digest('hex');

export async function fetchText(url: string, timeoutMs = 9000, headers: Record<string, string> = {}): Promise<string> {
  const fixtures = process.env.FEED_FIXTURES_DIR;
  if (fixtures) {
    const file = path.join(fixtures, `${fixtureKey(url)}.txt`);
    if (!fs.existsSync(file)) throw new Error('HTTP 404 (no offline fixture)');
    const body = fs.readFileSync(file, 'utf-8');
    const status = body.match(/^#STATUS (\d{3})\n/);
    if (status && Number(status[1]) >= 400) throw new Error(`HTTP ${status[1]}`);
    return status ? body.slice(status[0].length) : body;
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9', ...headers },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('timed out');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// ---------- YouTube ----------
export const youtubeIdFromUrl = (url: string): string | null => {
  const m = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
};

/** Find the UC… channel id for a YouTube handle (cached in handle.meta.channelId). */
export async function resolveYouTubeChannelId(handle: SocialHandle): Promise<string | null> {
  if (handle.meta?.channelId && /^UC[\w-]{22}$/.test(handle.meta.channelId)) return handle.meta.channelId;
  const direct = handle.url.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
  if (direct) return direct[1];
  const html = await fetchText(handle.url);
  const m =
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/) ||
    html.match(/"externalId":"(UC[\w-]{22})"/) ||
    html.match(/"channelId":"(UC[\w-]{22})"/) ||
    html.match(/channel_id=(UC[\w-]{22})/);
  return m ? m[1] : null;
}

export function parseYouTubeRss(xml: string, handle: Pick<SocialHandle, 'id' | 'teamId' | 'handle'>): FeedItem[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  const now = new Date().toISOString();
  const items: FeedItem[] = [];
  for (const e of entries.slice(0, 25)) {
    const videoId = tag(e, 'yt:videoId');
    if (!/^[\w-]{11}$/.test(videoId)) continue;
    const title = tag(e, 'title') || tag(e, 'media:title');
    if (!title) continue;
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const views = attr(e, 'media:statistics', 'views');
    const isLive = /\blive\b/i.test(title) && !/highlights|replay|recap/i.test(title);
    items.push({
      id: idFor('yt', url),
      teamId: handle.teamId,
      platform: 'YouTube',
      kind: isLive ? 'live' : 'video',
      category: 'social',
      title,
      url,
      videoId,
      image: attr(e, 'media:thumbnail', 'url') || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      source: handle.handle,
      summary: tag(e, 'media:description').slice(0, 400),
      status: 'live',
      publishedAt: tag(e, 'published') || now,
      createdAt: now,
      views: views ? `${Number(views).toLocaleString('en-US')} views` : undefined,
      sourceType: 'youtube-rss',
      handleId: handle.id,
    });
  }
  return items;
}

async function fetchYouTube(handle: SocialHandle): Promise<{ items: FeedItem[]; channelId: string }> {
  const channelId = await resolveYouTubeChannelId(handle).catch(() => null);
  if (!channelId) throw new Error(`could not find the channel id for ${handle.url}`);
  const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
  return { items: parseYouTubeRss(xml, handle), channelId };
}

// ---------- X (public syndication timeline) ----------
export function parseXSyndication(html: string, handle: Pick<SocialHandle, 'id' | 'teamId' | 'handle'>): FeedItem[] {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  let data: any;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const screen = handle.handle.replace(/^@/, '');
  const entries = data?.props?.pageProps?.timeline?.entries || [];
  const now = new Date().toISOString();
  const items: FeedItem[] = [];
  for (const ent of entries) {
    const tweet = ent?.content?.tweet;
    const text: string = tweet?.full_text || tweet?.text || '';
    const tweetId = String(tweet?.id_str || '');
    if (!tweet || !text || !/^\d{6,}$/.test(tweetId)) continue;
    const permalink = tweet.permalink ? `https://x.com${tweet.permalink}` : `https://x.com/${screen}/status/${tweetId}`;
    const media = tweet.extended_entities?.media || tweet.entities?.media || [];
    const clean = decodeEntities(text.replace(/https:\/\/t\.co\/\w+\s*$/, '').trim());
    items.push({
      id: idFor('x', permalink),
      teamId: handle.teamId,
      platform: 'X',
      kind: 'post',
      category: 'social',
      title: clean.slice(0, 200) || 'Post',
      url: permalink,
      image: media[0]?.media_url_https || null,
      source: handle.handle,
      summary: clean,
      status: 'live',
      publishedAt: tweet.created_at ? new Date(tweet.created_at).toISOString() : now,
      createdAt: now,
      likes: typeof tweet.favorite_count === 'number' ? tweet.favorite_count : undefined,
      sourceType: 'social-syndication',
      handleId: handle.id,
    });
  }
  return items;
}

async function fetchX(handle: SocialHandle): Promise<FeedItem[]> {
  const screen = handle.handle.replace(/^@/, '').trim() || handle.url.replace(/\/$/, '').split('/').pop() || '';
  if (!/^\w{1,15}$/.test(screen)) throw new Error('not a valid X username');
  const html = await fetchText(`https://syndication.twitter.com/srv/timeline-profile/screen-name/${screen}`, 8000);
  return parseXSyndication(html, { ...handle, handle: `@${screen}` });
}

// ---------- Curator.io ----------
export function getCuratorConfig() {
  const s = db.get().settings;
  let feedId = (s.curatorFeedId || s.curatorFeedUuid || process.env.CURATOR_FEED_ID || '').trim();
  const m = feedId.match(/published\/([\w-]+)/);
  if (m) feedId = m[1];
  feedId = feedId.replace(/\.js$/, '').replace(/^#/, '').trim();
  const apiKey = (s.curatorApiKey || process.env.CURATOR_API_KEY || '').trim();
  return {
    feedId,
    feedIdSource: s.curatorFeedId || s.curatorFeedUuid ? 'db:settings' : process.env.CURATOR_FEED_ID ? 'env:CURATOR_FEED_ID' : 'none',
    hasApiKey: Boolean(apiKey),
    apiKeySource: s.curatorApiKey ? 'db:settings' : process.env.CURATOR_API_KEY ? 'env:CURATOR_API_KEY' : 'none',
    apiKey,
    containerId: s.curatorContainerId || '',
    isConfigured: Boolean(feedId),
  };
}

const NETWORKS: Record<string, FeedItem['platform']> = {
  twitter: 'X', x: 'X', instagram: 'Instagram', youtube: 'YouTube', facebook: 'Facebook', tiktok: 'TikTok', threads: 'Threads', linkedin: 'LinkedIn',
};

export function mapCuratorPost(raw: any, store: AppStore): FeedItem | null {
  if (!raw || !raw.id) return null;
  const network = String(raw.network_name || raw.network || '').toLowerCase();
  const platform = Object.entries(NETWORKS).find(([k]) => network.includes(k))?.[1] || 'Web';
  const url = String(raw.url || raw.post_url || raw.link || '');
  if (!/^https:\/\//.test(url)) return null;
  const text = stripTags(String(raw.text || raw.caption || raw.title || ''));
  const author = String(raw.user_screen_name || raw.user_name || raw.user_full_name || '').replace(/^@/, '');
  const handle = store.handles.find(h => h.status === 'verified' && h.platform === platform && h.handle.replace(/^@/, '').toLowerCase() === author.toLowerCase());
  const published = raw.source_created_at || raw.created_at;
  const image = typeof raw.image === 'string' && /^https:\/\//.test(raw.image) ? raw.image : null;
  return {
    id: idFor('cur', url),
    teamId: handle?.teamId ?? null,
    platform,
    kind: raw.video || raw.has_video ? 'video' : 'post',
    category: 'social',
    title: (text || `${platform} post`).slice(0, 200),
    url,
    image,
    videoId: platform === 'YouTube' ? youtubeIdFromUrl(url) || undefined : undefined,
    source: author ? `@${author}` : platform,
    summary: text.slice(0, 600),
    status: 'live',
    publishedAt: published && !isNaN(+new Date(published)) ? new Date(published).toISOString() : new Date().toISOString(),
    createdAt: new Date().toISOString(),
    likes: typeof raw.likes === 'number' ? raw.likes : undefined,
    sourceType: 'curator',
    handleId: handle?.id || null,
  };
}

export async function fetchCurator(store: AppStore): Promise<{ items: FeedItem[]; note: string }> {
  const cfg = getCuratorConfig();
  if (!cfg.feedId) return { items: [], note: 'not configured' };
  const url = cfg.apiKey
    ? `https://api.curator.io/v1/feeds/${encodeURIComponent(cfg.feedId)}/posts?limit=50&api_key=${encodeURIComponent(cfg.apiKey)}`
    : `https://api.curator.io/restricted/feeds/${encodeURIComponent(cfg.feedId)}/posts?limit=50`;
  const body = await fetchText(url, 9000, { Accept: 'application/json' });
  const json = JSON.parse(body);
  const list = json.posts || json.data || (Array.isArray(json) ? json : []);
  const items = (Array.isArray(list) ? list : []).map((p: any) => mapCuratorPost(p, store)).filter(Boolean) as FeedItem[];
  return { items, note: `${items.length} post(s)` };
}

// ---------- News ----------
export function newsQueries(store: AppStore = db.get()): { teamId: string | null; query: string }[] {
  const custom = (store.settings.newsQueries || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (custom.length) {
    return custom.map(q => {
      const team = store.teams.find(t => q.toLowerCase().includes(t.name.toLowerCase()));
      return { teamId: team?.id || null, query: q };
    });
  }
  return [{ teamId: null, query: '"Abu Dhabi T10"' }, ...store.teams.map(t => ({ teamId: t.id, query: `"${t.name}" T10` }))];
}

export function parseNewsRss(xml: string, q: { teamId: string | null }): FeedItem[] {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  const now = new Date().toISOString();
  const out: FeedItem[] = [];
  for (const blk of blocks.slice(0, 10)) {
    let url = tag(blk, 'link');
    if (url.includes('bing.com/news/apiclick')) {
      try {
        const real = new URL(url).searchParams.get('url');
        if (real) url = decodeURIComponent(real);
      } catch {
        /* keep */
      }
    }
    if (!/^https:\/\//.test(url)) continue;
    const source = tag(blk, 'source') || tag(blk, 'News:Source') || (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, '');
      } catch {
        return 'News';
      }
    })();
    let title = stripTags(tag(blk, 'title'));
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    if (!title) continue;
    const pub = tag(blk, 'pubDate');
    const image = tag(blk, 'News:Image');
    out.push({
      id: idFor('news', url),
      teamId: q.teamId,
      platform: 'Web',
      kind: 'article',
      category: 'news',
      title,
      url,
      image: /^https:\/\//.test(image) ? image : null,
      source,
      summary: stripTags(tag(blk, 'description')).slice(0, 300),
      status: 'live',
      publishedAt: pub && !isNaN(+new Date(pub)) ? new Date(pub).toISOString() : now,
      createdAt: now,
      sourceType: 'news-rss',
    });
  }
  return out;
}

async function fetchNews(q: { teamId: string | null; query: string }): Promise<FeedItem[]> {
  const google = `https://news.google.com/rss/search?q=${encodeURIComponent(q.query)}&hl=en-AE&gl=AE&ceid=AE:en`;
  try {
    const items = parseNewsRss(await fetchText(google), q);
    if (items.length) return items;
  } catch {
    /* fall through to Bing */
  }
  const bing = `https://www.bing.com/news/search?q=${encodeURIComponent(q.query)}&format=rss`;
  return parseNewsRss(await fetchText(bing), q);
}

// ---------- oEmbed for posts added by link ----------
export async function lookupOEmbed(url: string): Promise<{ title?: string; image?: string; author?: string; platform: FeedItem['platform']; videoId?: string } | null> {
  const yt = youtubeIdFromUrl(url);
  try {
    if (yt) {
      const j = JSON.parse(await fetchText(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${yt}`)}`, 6000));
      return { title: j.title, image: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`, author: j.author_name, platform: 'YouTube', videoId: yt };
    }
    if (/^https:\/\/(x|twitter)\.com\/\w+\/status\/\d+/.test(url)) {
      const j = JSON.parse(await fetchText(`https://publish.twitter.com/oembed?omit_script=1&url=${encodeURIComponent(url)}`, 6000));
      const text = stripTags(decodeEntities(String(j.html || '').replace(/<a[^>]*>[^<]*<\/a>\s*$/, '')));
      return { title: text.slice(0, 200), author: j.author_name, platform: 'X' };
    }
    if (/^https:\/\/(www\.)?tiktok\.com\/@[\w.]+\/video\/\d+/.test(url)) {
      const j = JSON.parse(await fetchText(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, 6000));
      return { title: j.title, image: j.thumbnail_url, author: j.author_name, platform: 'TikTok' };
    }
  } catch {
    return null;
  }
  return null;
}

export function platformOfUrl(url: string): FeedItem['platform'] {
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  })();
  if (/youtube\.com|youtu\.be/.test(host)) return 'YouTube';
  if (/^(x|twitter)\.com$/.test(host)) return 'X';
  if (/instagram\.com/.test(host)) return 'Instagram';
  if (/threads\.(net|com)/.test(host)) return 'Threads';
  if (/facebook\.com|fb\.watch/.test(host)) return 'Facebook';
  if (/tiktok\.com/.test(host)) return 'TikTok';
  if (/linkedin\.com/.test(host)) return 'LinkedIn';
  return 'Web';
}

// ---------- Merge ----------
/** Merge new items into the store, keeping admin decisions (hidden/pinned/team) on existing ones. */
export function merge(incoming: FeedItem[], store: AppStore = db.get()): number {
  const byUrl = new Map(store.feedItems.map(f => [f.url.toLowerCase(), f]));
  let added = 0;
  for (const item of incoming) {
    const existing = byUrl.get(item.url.toLowerCase());
    if (existing) {
      Object.assign(existing, { ...item, id: existing.id, status: existing.status, teamId: existing.teamId ?? item.teamId, createdAt: existing.createdAt });
    } else {
      store.feedItems.push(item);
      byUrl.set(item.url.toLowerCase(), item);
      added++;
    }
  }
  const keep = (types: FeedItem['sourceType'][], max: number) => {
    const list = store.feedItems
      .filter(f => types.includes(f.sourceType) && f.status !== 'pinned')
      .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
    const drop = new Set(list.slice(max).map(f => f.id));
    if (drop.size) store.feedItems = store.feedItems.filter(f => !drop.has(f.id));
  };
  keep(['news-rss'], MAX_NEWS);
  keep(['youtube-rss'], MAX_VIDEOS);
  keep(['social-syndication', 'curator'], MAX_POSTS);
  store.feedItems.sort((a, b) => (a.status === 'pinned' ? -1 : 0) - (b.status === 'pinned' ? -1 : 0) || +new Date(b.publishedAt) - +new Date(a.publishedAt));
  return added;
}

// ---------- Sync ----------
type HandleResult = { handleId: string; status: NonNullable<SocialHandle['lastSyncStatus']>; note: string; items: FeedItem[]; channelId?: string };

export const FEED_PLATFORMS_WITH_PULL = new Set<SocialHandle['platform']>(['YouTube', 'X']);

async function pullHandle(h: SocialHandle): Promise<HandleResult> {
  try {
    if (h.platform === 'YouTube') {
      const { items, channelId } = await fetchYouTube(h);
      return { handleId: h.id, status: items.length ? 'ok' : 'empty', note: `${items.length} video(s)`, items, channelId };
    }
    if (h.platform === 'X') {
      const items = await fetchX(h);
      return {
        handleId: h.id,
        status: items.length ? 'ok' : 'embed-only',
        note: items.length ? `${items.length} post(s)` : 'X did not return posts without sign-in; the profile timeline embed is shown instead',
        items,
      };
    }
    return { handleId: h.id, status: 'embed-only', note: `${h.platform} has no public feed; shown with the platform embed or a profile card`, items: [] };
  } catch (e: any) {
    const note = String(e?.message || e);
    if (h.platform === 'X') return { handleId: h.id, status: 'embed-only', note: `X timeline unavailable (${note}); the profile embed is shown instead`, items: [] };
    return { handleId: h.id, status: 'error', note, items: [] };
  }
}

export interface SyncSummary {
  syncedCount: number;
  added: number;
  socialCount: number;
  videoCount: number;
  newsCount: number;
  errors: string[];
  summary: string;
  handles: { id: string; platform: string; handle: string; teamId: string | null; status: string; note: string }[];
}

/** Network phase reads a snapshot; the store is only changed in the short apply phase. */
export async function syncAllFeeds(opts: { only?: 'youtube' | 'news' | 'social' } = {}): Promise<SyncSummary> {
  const snapshot = db.get();
  const handles = snapshot.handles.filter(h => h.status === 'verified').map(h => ({ ...h, meta: { ...(h.meta || {}) } }));
  const pullable = handles.filter(h => (!opts.only || (opts.only === 'youtube' ? h.platform === 'YouTube' : opts.only === 'social' ? h.platform !== 'YouTube' : false)));
  const results: HandleResult[] = [];
  const queue = opts.only === 'news' ? [] : [...pullable];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (queue.length) results.push(await pullHandle(queue.shift()!));
    }),
  );

  const errors: string[] = results.filter(r => r.status === 'error').map(r => {
    const h = handles.find(x => x.id === r.handleId)!;
    return `${h.platform} ${h.handle}: ${r.note}`;
  });

  let curatorItems: FeedItem[] = [];
  if (!opts.only || opts.only === 'social') {
    try {
      curatorItems = (await fetchCurator(snapshot)).items;
    } catch (e: any) {
      errors.push(`Curator: ${e?.message || e}`);
    }
  }

  const newsItems: FeedItem[] = [];
  if (!opts.only || opts.only === 'news') {
    for (const q of newsQueries(snapshot)) {
      try {
        newsItems.push(...(await fetchNews(q)));
      } catch (e: any) {
        errors.push(`News "${q.query}": ${e?.message || e}`);
      }
    }
  }

  const fromHandles = results.flatMap(r => r.items);
  const all = [...fromHandles, ...curatorItems, ...newsItems];
  const added = await db.mutate(store => {
    const now = new Date().toISOString();
    for (const r of results) {
      const h = store.handles.find(x => x.id === r.handleId);
      if (!h) continue;
      h.lastSyncAt = now;
      h.lastSyncStatus = r.status;
      h.lastSyncNote = r.note;
      if (r.channelId) h.meta = { ...(h.meta || {}), channelId: r.channelId };
    }
    // Drop items from handles that were removed meanwhile.
    const live = new Set(store.handles.map(h => h.id));
    return merge(all.filter(i => !i.handleId || live.has(i.handleId)), store);
  });

  const videoCount = fromHandles.filter(i => i.platform === 'YouTube').length;
  const socialCount = fromHandles.length - videoCount + curatorItems.length;
  const summary =
    `YouTube: ${videoCount} video(s) from ${results.filter(r => handles.find(h => h.id === r.handleId)?.platform === 'YouTube').length} channel(s). ` +
    `Social posts: ${socialCount}. News: ${newsItems.length} article(s). ${added} new.` +
    (errors.length ? ` ${errors.length} source(s) failed.` : '');
  return {
    syncedCount: all.length,
    added,
    socialCount,
    videoCount,
    newsCount: newsItems.length,
    errors,
    summary,
    handles: results.map(r => {
      const h = handles.find(x => x.id === r.handleId)!;
      return { id: h.id, platform: h.platform, handle: h.handle, teamId: h.teamId, status: r.status, note: r.note };
    }),
  };
}

/** Sync one handle right after an admin adds or verifies it. */
export async function syncHandle(handleId: string) {
  const h = db.get().handles.find(x => x.id === handleId);
  if (!h || h.status !== 'verified') return null;
  const r = await pullHandle({ ...h, meta: { ...(h.meta || {}) } });
  await db.mutate(store => {
    const cur = store.handles.find(x => x.id === handleId);
    if (!cur) return 0;
    cur.lastSyncAt = new Date().toISOString();
    cur.lastSyncStatus = r.status;
    cur.lastSyncNote = r.note;
    if (r.channelId) cur.meta = { ...(cur.meta || {}), channelId: r.channelId };
    return merge(r.items, store);
  });
  return r;
}

export async function syncYouTube() {
  const r = await syncAllFeeds({ only: 'youtube' });
  return { fetched: r.videoCount, added: r.added, sources: r.handles.length, errors: r.errors };
}

export async function syncNews() {
  const r = await syncAllFeeds({ only: 'news' });
  return { fetched: r.newsCount, added: r.added, sources: newsQueries().length, errors: r.errors };
}

/** Removes everything pulled for a handle (used when the handle is deleted). */
export function purgeHandleItems(store: AppStore, handleId: string) {
  const before = store.feedItems.length;
  store.feedItems = store.feedItems.filter(f => f.handleId !== handleId || f.sourceType === 'admin');
  return before - store.feedItems.length;
}

import crypto from 'crypto';
import { db, FeedItem, SocialHandle } from './db';

/**
 * Real content ingestion. Only two automatic sources are used, both public and official:
 *   1. YouTube channel RSS for every *verified* YouTube handle (league or team).
 *   2. Google News RSS for the configured search queries (league + team names by default).
 * Instagram / X / TikTok / Facebook don't offer public feeds; use the Curator.io embed
 * (Admin Console → Settings) or add posts manually in the Admin Console.
 */

const UA = 'Mozilla/5.0 (compatible; ADT10FansBot/1.0; +https://github.com/solarastra-in/ADT10fans)';
const MAX_NEWS = 150;
const MAX_VIDEOS = 300;

function decodeEntities(s: string) {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}
const tag = (blk: string, name: string) => {
  const m = blk.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decodeEntities(m[1]) : '';
};
const attr = (blk: string, name: string, a: string) => {
  const m = blk.match(new RegExp(`<${name}[^>]*\\s${a}="([^"]+)"`));
  return m ? decodeEntities(m[1]) : '';
};
const idFor = (prefix: string, url: string) => `${prefix}-${crypto.createHash('sha1').update(url).digest('hex').slice(0, 12)}`;

async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

/** Find the UC… channel id for a YouTube handle URL (cached in handle.meta.channelId). */
export async function resolveYouTubeChannelId(handle: SocialHandle): Promise<string | null> {
  if (handle.meta?.channelId && /^UC[\w-]{22}$/.test(handle.meta.channelId)) return handle.meta.channelId;
  const direct = handle.url.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
  if (direct) return direct[1];
  const html = await fetchText(handle.url);
  const m =
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/) ||
    html.match(/"externalId":"(UC[\w-]{22})"/) ||
    html.match(/"channelId":"(UC[\w-]{22})"/);
  if (!m) return null;
  handle.meta = { ...(handle.meta || {}), channelId: m[1] };
  return m[1];
}

async function fetchYouTube(handle: SocialHandle): Promise<FeedItem[]> {
  const channelId = await resolveYouTubeChannelId(handle);
  if (!channelId) throw new Error(`could not resolve channel id for ${handle.url}`);
  const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  const now = new Date().toISOString();
  return entries.slice(0, 15).map(e => {
    const videoId = tag(e, 'yt:videoId');
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const views = attr(e, 'media:statistics', 'views');
    const title = tag(e, 'title');
    const isLive = /\blive\b/i.test(title) && !/highlights/i.test(title);
    return {
      id: idFor('yt', url),
      teamId: handle.teamId,
      platform: 'YouTube',
      kind: isLive ? 'live' : 'video',
      category: 'social',
      title,
      url,
      image: attr(e, 'media:thumbnail', 'url') || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      source: handle.handle,
      summary: tag(e, 'media:description').slice(0, 400),
      status: 'live',
      publishedAt: tag(e, 'published') || now,
      createdAt: now,
      views: views ? `${Number(views).toLocaleString('en-US')} views` : undefined,
      verifiedReal: true,
      channelVerified: true,
      sourceType: 'youtube-rss',
      handleId: handle.id,
    } as FeedItem;
  }).filter(i => i.title && /watch\?v=[\w-]{6,}/.test(i.url));
}

export function newsQueries(): { teamId: string | null; query: string }[] {
  const store = db.get();
  const custom = (store.settings.newsQueries || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (custom.length) {
    return custom.map(q => {
      const team = store.teams.find(t => q.toLowerCase().includes(t.name.toLowerCase()));
      return { teamId: team?.id || null, query: q };
    });
  }
  return [
    { teamId: null, query: '"Abu Dhabi T10"' },
    ...store.teams.map(t => ({ teamId: t.id, query: `"${t.name}" T10` })),
  ];
}

async function fetchNews(q: { teamId: string | null; query: string }): Promise<FeedItem[]> {
  const cleanQ = q.query.replace(/["']/g, '').trim();
  // Try Bing News RSS first (reliable and fast, no IP blocks)
  let xml = '';
  try {
    xml = await fetchText(`https://www.bing.com/news/search?q=${encodeURIComponent(cleanQ)}&format=rss`, 8000);
  } catch (e: any) {
    // Fallback to Google News RSS
    try {
      xml = await fetchText(`https://news.google.com/rss/search?q=${encodeURIComponent(cleanQ)}&hl=en-AE&gl=AE&ceid=AE:en`, 8000);
    } catch {
      return [];
    }
  }

  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  const now = new Date().toISOString();
  return items.slice(0, 8).map(blk => {
    let url = tag(blk, 'link');
    // Unwrap direct article URL from Bing or Google redirect links if present
    if (url.includes('bing.com/news/apiclick') || url.includes('news.google.com/rss/articles')) {
      try {
        const parsed = new URL(url);
        const real = parsed.searchParams.get('url');
        if (real) url = decodeURIComponent(real);
      } catch {
        // ignore
      }
    }
    const source = tag(blk, 'News:Source') || tag(blk, 'source') || 'Cricket News';
    let title = tag(blk, 'title');
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const pub = tag(blk, 'pubDate');
    const image = tag(blk, 'News:Image') || null;
    const summary = tag(blk, 'description') || '';
    return {
      id: idFor('news', url),
      teamId: q.teamId,
      platform: 'Web',
      kind: 'article',
      category: 'news',
      title,
      url,
      image,
      source,
      summary: summary.slice(0, 400),
      status: 'live',
      publishedAt: pub ? new Date(pub).toISOString() : now,
      createdAt: now,
      verifiedReal: true,
      sourceType: 'news-rss',
    } as FeedItem;
  }).filter(i => i.title && /^https?:\/\//.test(i.url));
}

/** Merge new items into the store, keeping admin decisions (hidden/pinned) on existing ones. */
function merge(incoming: FeedItem[]): number {
  const store = db.get();
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
  const keep = (type: FeedItem['sourceType'], max: number) => {
    const list = store.feedItems.filter(f => f.sourceType === type && f.status !== 'pinned')
      .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
    const drop = new Set(list.slice(max).map(f => f.id));
    store.feedItems = store.feedItems.filter(f => !drop.has(f.id));
  };
  keep('news-rss', MAX_NEWS);
  keep('youtube-rss', MAX_VIDEOS);
  store.feedItems.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  return added;
}

export async function syncYouTube() {
  const store = db.get();
  const handles = store.handles.filter(h => h.platform === 'YouTube' && h.status === 'verified');
  const errors: string[] = [];
  const all: FeedItem[] = [];
  for (const h of handles) {
    try {
      all.push(...(await fetchYouTube(h)));
    } catch (e: any) {
      errors.push(`YouTube ${h.handle}: ${e?.message || e}`);
    }
  }
  const added = merge(all);
  db.save();
  return { fetched: all.length, added, sources: handles.length, errors };
}

export async function syncNews() {
  const errors: string[] = [];
  const all: FeedItem[] = [];
  const queries = newsQueries();
  for (const q of queries) {
    try {
      all.push(...(await fetchNews(q)));
    } catch (e: any) {
      errors.push(`News "${q.query}": ${e?.message || e}`);
    }
  }
  const added = merge(all);
  db.save();
  return { fetched: all.length, added, sources: queries.length, errors };
}

export async function syncAllFeeds() {
  const yt = await syncYouTube();
  const news = await syncNews();
  const errors = [...yt.errors, ...news.errors];
  const summary =
    `YouTube: ${yt.fetched} videos from ${yt.sources} verified channel(s), ${yt.added} new. ` +
    `News: ${news.fetched} articles from ${news.sources} search(es), ${news.added} new.` +
    (errors.length ? ` ${errors.length} source(s) failed.` : '');
  return { syncedCount: yt.fetched + news.fetched, added: yt.added + news.added, errors, summary };
}

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { AppStore, db, FeedItem, SocialHandle } from './db';
import { fetchInstagram, instagramConfigured } from './socialSources';

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
/** Social posts are kept so fans can scroll back through the season (pinned posts are never dropped). */
const MAX_POSTS = 1500;

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

// ---------- Universal Metadata & oEmbed Extractor (Instagram, TikTok, YouTube, X, Facebook, Web) ----------
export interface ExtractedMetadata {
  title: string;
  image?: string | null;
  author?: string;
  summary?: string;
  platform: FeedItem['platform'];
  kind: FeedItem['kind'];
  videoId?: string;
  publishedAt?: string;
  /** False when no real title could be read (the title is then a generic placeholder). */
  titleFound?: boolean;
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

export async function extractPostMetadata(url: string): Promise<ExtractedMetadata> {
  const platform = platformOfUrl(url);
  const yt = youtubeIdFromUrl(url);
  let metadata: Partial<ExtractedMetadata> = { platform, kind: 'post' };

  if (yt) {
    metadata.kind = 'video';
    metadata.videoId = yt;
    metadata.image = `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
    try {
      const j = JSON.parse(await fetchText(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${yt}`)}`, 6000));
      metadata.title = j.title || `YouTube Video`;
      metadata.author = j.author_name;
      return { title: metadata.title || `YouTube Video`, image: metadata.image, author: metadata.author, platform: 'YouTube', kind: 'video', videoId: yt, titleFound: Boolean(j.title) };
    } catch {
      return { title: `YouTube Video (${yt})`, image: metadata.image, platform: 'YouTube', kind: 'video', videoId: yt, titleFound: false };
    }
  }

  if (platform === 'TikTok') {
    metadata.kind = 'video';
    try {
      const j = JSON.parse(await fetchText(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, 6000));
      if (j.title) metadata.title = stripTags(decodeEntities(j.title));
      if (j.thumbnail_url) metadata.image = j.thumbnail_url;
      if (j.author_name) metadata.author = j.author_name;
    } catch {
      /* fallback to HTML OpenGraph */
    }
  } else if (platform === 'X') {
    try {
      const j = JSON.parse(await fetchText(`https://publish.twitter.com/oembed?omit_script=1&url=${encodeURIComponent(url)}`, 6000));
      const text = stripTags(decodeEntities(String(j.html || '').replace(/<a[^>]*>[^<]*<\/a>\s*$/, '')));
      if (text) metadata.title = text.slice(0, 240);
      if (j.author_name) metadata.author = j.author_name;
    } catch {
      /* fallback to HTML OpenGraph */
    }
  }

  // Universal HTML OpenGraph & Meta Scraper (works for Instagram, Facebook, TikTok, Articles, Web)
  if (!metadata.title || !metadata.image) {
    try {
      const html = await fetchText(url, 7000);
      const ogTitle = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1]
        || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:title["']/i)?.[1]
        || html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i)?.[1]
        || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];

      const ogImage = html.match(/<meta\s+(?:property|name)=["'](?:og:image|og:image:secure_url)["']\s+content=["']([^"']+)["']/i)?.[1]
        || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:image|og:image:secure_url)["']/i)?.[1]
        || html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i)?.[1];

      const ogDesc = html.match(/<meta\s+(?:property|name)=["'](?:og:description|description)["']\s+content=["']([^"']+)["']/i)?.[1]
        || html.match(/<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i)?.[1];

      const ogAuthor = html.match(/<meta\s+(?:property|name)=["'](?:og:site_name|author)["']\s+content=["']([^"']+)["']/i)?.[1];
      const ogDate = html.match(/<meta\s+(?:property|name)=["']article:published_time["']\s+content=["']([^"']+)["']/i)?.[1];
      const isVideo = /video/i.test(html.match(/<meta\s+(?:property|name)=["']og:type["']\s+content=["']([^"']+)["']/i)?.[1] || '')
        || /<meta\s+(?:property|name)=["']og:video/i.test(html);

      if (ogTitle && !metadata.title) metadata.title = stripTags(decodeEntities(ogTitle)).slice(0, 300);
      if (ogImage && !metadata.image && /^https?:\/\//.test(ogImage)) metadata.image = ogImage;
      if (ogDesc && !metadata.summary) metadata.summary = stripTags(decodeEntities(ogDesc)).slice(0, 600);
      if (ogAuthor && !metadata.author) metadata.author = stripTags(decodeEntities(ogAuthor));
      if (ogDate && !metadata.publishedAt) metadata.publishedAt = ogDate;
      if (isVideo) metadata.kind = 'video';
    } catch {
      /* ignore fetch error */
    }
  }

  const cleanTitle = metadata.title || metadata.summary?.slice(0, 150) || `${platform} Post`;
  return {
    title: cleanTitle,
    image: metadata.image || null,
    author: metadata.author || platform,
    summary: metadata.summary || '',
    platform,
    kind: metadata.kind || (platform === 'Web' ? 'article' : 'post'),
    videoId: metadata.videoId,
    publishedAt: metadata.publishedAt || new Date().toISOString(),
    titleFound: Boolean(metadata.title || metadata.summary),
  };
}

/** Legacy lookupOEmbed compatibility */
export async function lookupOEmbed(url: string) {
  try {
    const meta = await extractPostMetadata(url);
    return { title: meta.title, image: meta.image || undefined, author: meta.author, platform: meta.platform, videoId: meta.videoId };
  } catch {
    return null;
  }
}

// ---------- Native RSS / Atom Ingestion (Team media, press feeds, RSS bridges) ----------
export function parseRssXml(xml: string, handle: Pick<SocialHandle, 'id' | 'teamId' | 'handle'>): FeedItem[] {
  const items: FeedItem[] = [];
  const now = new Date().toISOString();

  // Try standard RSS 2.0 <item> blocks
  const rssItems = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  if (rssItems.length > 0) {
    for (const raw of rssItems.slice(0, 30)) {
      const title = tag(raw, 'title');
      const link = tag(raw, 'link') || attr(raw, 'link', 'href');
      if (!title || !link || !/^https?:\/\//.test(link)) continue;
      const pubDate = tag(raw, 'pubDate') || tag(raw, 'dc:date');
      const desc = tag(raw, 'description') || tag(raw, 'content:encoded');
      const image = attr(raw, 'media:content', 'url') || attr(raw, 'media:thumbnail', 'url') || attr(raw, 'enclosure', 'url') || desc.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i)?.[1] || null;
      items.push({
        id: idFor('rss', link),
        teamId: handle.teamId,
        platform: platformOfUrl(link),
        kind: 'article',
        category: 'social',
        title: stripTags(decodeEntities(title)).slice(0, 300),
        url: link,
        image: image && /^https?:\/\//.test(image) ? image : null,
        source: handle.handle,
        summary: stripTags(decodeEntities(desc)).slice(0, 500),
        status: 'live',
        publishedAt: pubDate && !isNaN(+new Date(pubDate)) ? new Date(pubDate).toISOString() : now,
        createdAt: now,
        sourceType: 'rss',
        handleId: handle.id,
      });
    }
    return items;
  }

  // Try Atom <entry> blocks
  const atomEntries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const raw of atomEntries.slice(0, 30)) {
    const title = tag(raw, 'title');
    const link = attr(raw, 'link', 'href') || tag(raw, 'link');
    if (!title || !link || !/^https?:\/\//.test(link)) continue;
    const pubDate = tag(raw, 'published') || tag(raw, 'updated');
    const summary = tag(raw, 'summary') || tag(raw, 'content');
    const image = attr(raw, 'media:thumbnail', 'url') || summary.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i)?.[1] || null;
    items.push({
      id: idFor('atom', link),
      teamId: handle.teamId,
      platform: platformOfUrl(link),
      kind: 'article',
      category: 'social',
      title: stripTags(decodeEntities(title)).slice(0, 300),
      url: link,
      image: image && /^https?:\/\//.test(image) ? image : null,
      source: handle.handle,
      summary: stripTags(decodeEntities(summary)).slice(0, 500),
      status: 'live',
      publishedAt: pubDate && !isNaN(+new Date(pubDate)) ? new Date(pubDate).toISOString() : now,
      createdAt: now,
      sourceType: 'rss',
      handleId: handle.id,
    });
  }
  return items;
}

async function fetchRss(handle: SocialHandle): Promise<FeedItem[]> {
  const xml = await fetchText(handle.url, 8000);
  return parseRssXml(xml, handle);
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
  keep(['social-syndication', 'curator', 'native-harvester', 'rss', 'instagram-graph', 'discovery'], MAX_POSTS);
  store.feedItems.sort((a, b) => (a.status === 'pinned' ? -1 : 0) - (b.status === 'pinned' ? -1 : 0) || +new Date(b.publishedAt) - +new Date(a.publishedAt));
  return added;
}

// ---------- Bulk Link Ingestion (Paste multiple social/news URLs at once) ----------
export async function bulkIngestUrls(
  urls: string[],
  teamId: string | null = null,
  opts: { pinned?: boolean; category?: FeedItem['category'] } = {}
): Promise<{ added: number; items: FeedItem[]; errors: string[] }> {
  const cleanUrls = Array.from(new Set(urls.map(u => u.trim()).filter(u => /^https:\/\/[^\s/]+/.test(u))));
  const items: FeedItem[] = [];
  const errors: string[] = [];
  const now = new Date().toISOString();

  await Promise.all(
    cleanUrls.map(async url => {
      try {
        const meta = await extractPostMetadata(url);
        if (!meta.titleFound) throw new Error('could not read a title; add it on its own with "Add by link" and type one in');
        items.push({
          id: idFor('bulk', url),
          teamId,
          platform: meta.platform,
          kind: meta.kind,
          category: opts.category || 'social',
          title: meta.title,
          url,
          videoId: meta.videoId,
          image: meta.image || null,
          source: meta.author || meta.platform,
          summary: meta.summary,
          status: opts.pinned ? 'pinned' : 'live',
          publishedAt: meta.publishedAt || now,
          createdAt: now,
          sourceType: 'admin',
        });
      } catch (e: any) {
        errors.push(`${url}: ${e?.message || 'could not extract metadata'}`);
      }
    })
  );

  const added = merge(items);
  db.save();
  return { added, items, errors };
}

// ---------- Sync ----------
type HandleResult = { handleId: string; status: NonNullable<SocialHandle['lastSyncStatus']>; note: string; items: FeedItem[]; channelId?: string };

export const FEED_PLATFORMS_WITH_PULL = new Set<SocialHandle['platform']>([
  'YouTube',
  'X',
  'Instagram',
  'Threads',
  'TikTok',
  'Facebook',
  'LinkedIn',
  'RSS',
]);

/** A feed address (RSS/Atom) set on an account, e.g. from an RSS bridge service. */
const feedUrlOf = (h: SocialHandle) => {
  const u = String(h.meta?.feedUrl || '').trim();
  return /^https:\/\//.test(u) ? u : h.platform === 'RSS' ? h.url : '';
};

/**
 * Pulls one account. Only real responses become items; when a platform cannot be read the
 * status says so (and why), and the site shows that platform's own embed or a profile card.
 */
async function pullHandle(h: SocialHandle): Promise<HandleResult> {
  const items: FeedItem[] = [];
  const notes: string[] = [];
  let channelId: string | undefined;
  let status: HandleResult['status'] = 'embed-only';
  let failed = false;
  const tag = (list: FeedItem[]) => list.map(i => ({ ...i, handleId: h.id, teamId: h.teamId }));

  const feedUrl = feedUrlOf(h);
  if (feedUrl) {
    try {
      const got = parseRssXml(await fetchText(feedUrl, 9000), h).map(i => (h.platform !== 'RSS' && i.platform === 'Web' ? { ...i, platform: h.platform as FeedItem['platform'] } : i));
      items.push(...tag(got));
      notes.push(`feed address: ${got.length} item(s)`);
    } catch (e: any) {
      failed = true;
      notes.push(`feed address failed (${e?.message || e})`);
    }
  }

  try {
    if (h.platform === 'YouTube') {
      const yt = await fetchYouTube(h);
      items.push(...tag(yt.items));
      channelId = yt.channelId;
      notes.push(`${yt.items.length} video(s)`);
    } else if (h.platform === 'X') {
      try {
        const got = await fetchX(h);
        items.push(...tag(got));
        notes.push(got.length ? `${got.length} post(s) from the public timeline` : 'X returned no posts without sign-in; the timeline embed is shown and the harvester looks for posts');
      } catch (e: any) {
        notes.push(`X timeline unavailable (${e?.message || e}); the timeline embed is shown and the harvester looks for posts`);
      }
    } else if (h.platform === 'Instagram') {
      if (instagramConfigured()) {
        const got = await fetchInstagram(h);
        items.push(...tag(got));
        notes.push(`${got.length} post(s) from Instagram`);
      } else {
        status = 'needs-setup';
        notes.push('Add a Meta access token and your Instagram account id in Admin → Environment to pull posts automatically; until then the profile card is shown');
      }
    } else if (h.platform === 'TikTok') {
      notes.push('TikTok has no public feed; the creator embed is shown and the harvester looks for videos');
    } else if (h.platform !== 'RSS') {
      notes.push(`${h.platform} has no public feed; shown with its embed or a profile card${feedUrl ? '' : ' (add a feed address to pull posts)'}`);
    }
  } catch (e: any) {
    failed = true;
    notes.push(String(e?.message || e));
  }

  if (items.length) status = 'ok';
  else if (failed) status = 'error';
  else if (status !== 'needs-setup' && (h.platform === 'YouTube' || h.platform === 'RSS' || (h.platform === 'Instagram' && instagramConfigured()))) status = 'empty';
  return { handleId: h.id, status, note: notes.join('; '), items, channelId };
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

/** Pull and sync all verified social handles for a specific team on demand. */
export async function syncTeamFeeds(teamId: string) {
  const store = db.get();
  const handles = store.handles.filter(h => h.teamId === teamId && h.status === 'verified');
  const results: HandleResult[] = [];
  for (const h of handles) {
    results.push(await pullHandle({ ...h, meta: { ...(h.meta || {}) } }));
  }
  const fromHandles = results.flatMap(r => r.items);
  const added = await db.mutate(s => {
    const now = new Date().toISOString();
    for (const r of results) {
      const h = s.handles.find(x => x.id === r.handleId);
      if (!h) continue;
      h.lastSyncAt = now;
      h.lastSyncStatus = r.status;
      h.lastSyncNote = r.note;
      if (r.channelId) h.meta = { ...(h.meta || {}), channelId: r.channelId };
    }
    return merge(fromHandles, s);
  });
  return {
    teamId,
    totalItems: fromHandles.length,
    added,
    handles: results.map(r => ({ id: r.handleId, status: r.status, note: r.note, count: r.items.length })),
  };
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

import type { FeedItem, SocialHandle } from './db';
import { fetchText, idFor } from './feeds';

/**
 * Real sources for team social posts, used by the feed sync and the social harvester.
 * Nothing here invents content: every item is a post the platform itself returned.
 *
 *  Instagram  Meta's Business Discovery API. With a Meta access token and the id of an Instagram
 *             professional account you own (Admin → Environment), it returns the latest public posts
 *             of other professional accounts (the league and teams are). Free, official, no scraping.
 *  X, TikTok  Posts found by the AI search are only kept after the platform's own oEmbed endpoint
 *             confirms the post exists and was published by that team's official account. The
 *             stored text, thumbnail and date come from the platform, never from the AI.
 *  Any        A feed address (RSS/Atom) on the account, e.g. from an RSS bridge service.
 */

const strip = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

/** The account name of a handle, without @ (from the handle text, else the profile URL). */
export function accountName(h: Pick<SocialHandle, 'handle' | 'url'>): string {
  const fromHandle = (h.handle || '').trim().replace(/^@/, '');
  if (/^[\w.]+$/.test(fromHandle)) return fromHandle;
  try {
    const parts = new URL(h.url).pathname.split('/').filter(Boolean);
    return (parts[0] || '').replace(/^@/, '');
  } catch {
    return fromHandle;
  }
}

// ---------- Instagram (Meta Business Discovery) ----------
const graphBase = () => `${(process.env.META_GRAPH_BASE || 'https://graph.facebook.com').replace(/\/$/, '')}/${process.env.META_GRAPH_VERSION || 'v23.0'}`;
export const instagramConfigured = () => Boolean(process.env.META_ACCESS_TOKEN && process.env.META_IG_USER_ID);

export async function fetchInstagram(h: SocialHandle): Promise<FeedItem[]> {
  const username = accountName(h);
  if (!/^[\w.]{1,30}$/.test(username)) throw new Error('not a valid Instagram username');
  const fields = `business_discovery.username(${username}){username,media.limit(25){caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count}}`;
  const url = `${graphBase()}/${encodeURIComponent(process.env.META_IG_USER_ID || '')}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(process.env.META_ACCESS_TOKEN || '')}`;
  let json: any;
  try {
    json = JSON.parse(await fetchText(url, 10000, { Accept: 'application/json' }));
  } catch (e: any) {
    // Never echo the URL: it carries the access token.
    throw new Error(`Instagram API: ${String(e?.message || e).replace(/access_token=[^&\s]+/g, 'access_token=…')}`);
  }
  if (json?.error) throw new Error(`Instagram API: ${json.error.message || json.error.type || 'error'}`);
  const media: any[] = json?.business_discovery?.media?.data || [];
  const now = new Date().toISOString();
  return media
    .filter(m => typeof m.permalink === 'string' && /^https:\/\/www\.instagram\.com\//.test(m.permalink))
    .map(m => {
      const caption = String(m.caption || '').trim();
      const video = m.media_type === 'VIDEO' || /\/reel\//.test(m.permalink);
      const image = video ? m.thumbnail_url || null : m.media_url || m.thumbnail_url || null;
      return {
        id: idFor('ig', m.permalink),
        teamId: h.teamId,
        platform: 'Instagram' as const,
        kind: (video ? 'video' : 'post') as FeedItem['kind'],
        category: 'social' as const,
        title: (caption.split('\n')[0] || `Post by @${username}`).slice(0, 200),
        url: m.permalink,
        image: image && /^https:\/\//.test(image) ? image : null,
        source: `@${username}`,
        summary: caption.slice(0, 1000),
        status: 'live' as const,
        publishedAt: m.timestamp && !isNaN(+new Date(m.timestamp)) ? new Date(m.timestamp).toISOString() : now,
        createdAt: now,
        likes: typeof m.like_count === 'number' ? m.like_count : undefined,
        sourceType: 'instagram-graph' as const,
        handleId: h.id,
      };
    });
}

// ---------- Verification of discovered links ----------
export interface Verified {
  ok: true;
  item: FeedItem;
}
export interface Rejected {
  ok: false;
  reason: string;
}

/** Date written at the end of an X oEmbed blockquote, e.g. "October 13, 2026". */
function xDate(html: string): string | null {
  const m = html.match(/<a[^>]*>([A-Z][a-z]+ \d{1,2}, \d{4})<\/a>\s*<\/blockquote>/);
  const d = m ? new Date(`${m[1]} 12:00:00 UTC`) : null;
  return d && !isNaN(+d) ? d.toISOString() : null;
}

/** TikTok video ids carry their creation time in the top 32 bits. */
function tiktokDate(id: string): string | null {
  try {
    const secs = Number(BigInt(id) >> 32n);
    return secs > 1_400_000_000 && secs < Date.now() / 1000 + 86400 ? new Date(secs * 1000).toISOString() : null;
  } catch {
    return null;
  }
}

/**
 * Confirms a post link with the platform and returns it as a feed item, or says why it was refused.
 * Only links to X and TikTok posts by one of `handles` are accepted.
 */
export async function verifyPostLink(rawUrl: string, handles: SocialHandle[]): Promise<Verified | Rejected> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'not a link' };
  }
  const now = new Date().toISOString();
  const host = url.hostname.replace(/^(www\.|mobile\.)/, '');

  if (host === 'x.com' || host === 'twitter.com') {
    const m = url.pathname.match(/^\/(\w{1,15})\/status\/(\d{6,25})/);
    if (!m) return { ok: false, reason: 'not an X post link' };
    const handle = handles.find(h => h.platform === 'X' && accountName(h).toLowerCase() === m[1].toLowerCase());
    if (!handle) return { ok: false, reason: `@${m[1]} is not an official account of this team` };
    const canonical = `https://x.com/${m[1]}/status/${m[2]}`;
    let j: any;
    try {
      j = JSON.parse(await fetchText(`https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${encodeURIComponent(canonical)}`, 8000));
    } catch (e: any) {
      return { ok: false, reason: `X could not confirm it (${e?.message || e})` };
    }
    const author = String(j.author_url || '').split('/').pop() || '';
    if (author.toLowerCase() !== m[1].toLowerCase()) return { ok: false, reason: 'X says another account posted it' };
    const html = String(j.html || '');
    const text = strip((html.match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '');
    if (!text) return { ok: false, reason: 'X returned no text for it' };
    return {
      ok: true,
      item: {
        id: idFor('x', canonical), teamId: handle.teamId, platform: 'X', kind: 'post', category: 'social',
        title: text.slice(0, 200), url: canonical, image: null, source: `@${author}`, summary: text.slice(0, 1000),
        status: 'live', publishedAt: xDate(html) || now, createdAt: now, sourceType: 'discovery', handleId: handle.id,
      },
    };
  }

  if (host === 'tiktok.com') {
    const m = url.pathname.match(/^\/@([\w.]{2,24})\/video\/(\d{10,25})/);
    if (!m) return { ok: false, reason: 'not a TikTok video link' };
    const handle = handles.find(h => h.platform === 'TikTok' && accountName(h).toLowerCase() === m[1].toLowerCase());
    if (!handle) return { ok: false, reason: `@${m[1]} is not an official account of this team` };
    const canonical = `https://www.tiktok.com/@${m[1]}/video/${m[2]}`;
    let j: any;
    try {
      j = JSON.parse(await fetchText(`https://www.tiktok.com/oembed?url=${encodeURIComponent(canonical)}`, 8000));
    } catch (e: any) {
      return { ok: false, reason: `TikTok could not confirm it (${e?.message || e})` };
    }
    if (String(j.author_unique_id || '').toLowerCase() !== m[1].toLowerCase()) return { ok: false, reason: 'TikTok says another account posted it' };
    const title = strip(String(j.title || '')) || `Video by @${m[1]}`;
    return {
      ok: true,
      item: {
        id: idFor('tt', canonical), teamId: handle.teamId, platform: 'TikTok', kind: 'video', category: 'social',
        title: title.slice(0, 200), url: canonical, image: /^https:\/\//.test(j.thumbnail_url || '') ? j.thumbnail_url : null,
        source: `@${m[1]}`, summary: title.slice(0, 1000), status: 'live', publishedAt: tiktokDate(m[2]) || now, createdAt: now,
        sourceType: 'discovery', handleId: handle.id,
      },
    };
  }

  return { ok: false, reason: `${host} links are not accepted from search (only X and TikTok posts can be confirmed)` };
}

import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AppStore, User } from './db';
import { db } from './db';
import { getAuthUser } from './auth';

/**
 * Instagram check before fans can play.
 *
 * Instagram offers no way for an app to see who follows an account or who liked a post, and its API
 * can only look up business/creator accounts. So the proof is a comment: the fan enters their
 * username, the site gives them a short code, and they comment it on the pinned post of the club's
 * account. The site reads that post's comments through Meta's Graph API (the comments on your own
 * posts carry the commenter's username) and verifies the fan when their username posted their code.
 * That proves the account exists, belongs to them and engaged with the club's account. Admins can
 * also approve a fan by hand (Admin → Instagram checks), e.g. when the Meta token is not set up yet.
 *
 * Needs META_ACCESS_TOKEN and META_IG_USER_ID for the club's own Instagram professional account (the
 * account the post belongs to), with the instagram_basic and instagram_manage_comments permissions.
 */

export type InstagramStatus = 'none' | 'code' | 'review' | 'verified' | 'rejected';

const graphBase = () => `${(process.env.META_GRAPH_BASE || 'https://graph.facebook.com').replace(/\/$/, '')}/${process.env.META_GRAPH_VERSION || 'v23.0'}`;
export const commentCheckConfigured = () => Boolean(process.env.META_ACCESS_TOKEN && process.env.META_IG_USER_ID);
const scrub = (s: string) => s.replace(/access_token=[^&\s]+/g, 'access_token=…');

export const USERNAME_RE = /^(?!.*\.\.)(?!\.)(?!.*\.$)[a-z0-9._]{1,30}$/;
export const cleanUsername = (raw: unknown) =>
  String(raw ?? '')
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/^@/, '')
    .toLowerCase();

export function gateSettings(store: AppStore) {
  const s = store.settings;
  return {
    required: s.requireInstagramFollow !== false,
    target: (s.instagramTargetHandle || '@arabianacesofficial').replace(/^@?/, '@'),
    postUrl: s.instagramVerifyPostUrl || '',
    hideComments: Boolean(s.instagramHideVerifyComments),
  };
}

export const statusOf = (u: User): InstagramStatus => (u.instagramFollowed ? 'verified' : u.instagramStatus || 'none');
export const isVerified = (u: User) => statusOf(u) === 'verified';

/** Whether this user must still pass the Instagram check (admins never do: they set it up). */
export function needsInstagram(store: AppStore, u: User | null | undefined) {
  if (!u || u.role === 'admin') return false;
  return gateSettings(store).required && !isVerified(u);
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newCode() {
  const bytes = crypto.randomBytes(5);
  return 'ACES-' + Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** The shortcode in a post or reel link, e.g. https://www.instagram.com/p/Cxyz123/ → Cxyz123. */
export function shortcodeOf(url: string): string | null {
  const m = String(url || '').match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}

async function graph(path: string, params: Record<string, string> = {}, method: 'GET' | 'POST' = 'GET'): Promise<any> {
  const q = new URLSearchParams({ ...params, access_token: process.env.META_ACCESS_TOKEN || '' });
  const url = `${graphBase()}/${path}?${q}`;
  let json: any;
  try {
    // Graph API errors come back as JSON with a 4xx status, so read the body either way.
    const r = await fetch(url, { method, headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    json = await r.json().catch(() => ({ error: { message: `HTTP ${r.status}` } }));
  } catch (e: any) {
    throw new Error(`Instagram API: ${scrub(String(e?.message || e))}`);
  }
  if (json?.error) throw new Error(`Instagram API: ${scrub(json.error.message || json.error.type || 'error')}`);
  return json;
}

/** Checks the Meta setup: whose account the token reads, and whether the pinned post is one of its posts. */
export async function diagnose(store: AppStore) {
  const g = gateSettings(store);
  const out: { configured: boolean; account?: string; matchesTarget?: boolean; postFound?: boolean; mediaId?: string; error?: string } = { configured: commentCheckConfigured() };
  if (!out.configured) return out;
  try {
    const me = await graph(encodeURIComponent(process.env.META_IG_USER_ID || ''), { fields: 'username' });
    out.account = me?.username ? `@${me.username}` : undefined;
    out.matchesTarget = Boolean(me?.username) && me.username.toLowerCase() === g.target.replace(/^@/, '').toLowerCase();
    if (g.postUrl) {
      out.mediaId = (await resolveMediaId(g.postUrl, true)) || undefined;
      out.postFound = Boolean(out.mediaId);
    }
  } catch (e: any) {
    out.error = String(e?.message || e);
  }
  return out;
}

let mediaCache: { url: string; id: string | null; at: number } | null = null;
async function resolveMediaId(postUrl: string, fresh = false): Promise<string | null> {
  if (!fresh && mediaCache && mediaCache.url === postUrl && Date.now() - mediaCache.at < 6 * 3600_000) return mediaCache.id;
  const code = shortcodeOf(postUrl);
  if (!code) return null;
  let after = '';
  let id: string | null = null;
  for (let page = 0; page < 8 && !id; page++) {
    const r = await graph(`${encodeURIComponent(process.env.META_IG_USER_ID || '')}/media`, { fields: 'id,permalink,shortcode', limit: '50', ...(after ? { after } : {}) });
    for (const m of r?.data || []) {
      if (m.shortcode === code || shortcodeOf(m.permalink || '') === code) {
        id = String(m.id);
        break;
      }
    }
    after = r?.paging?.cursors?.after || '';
    if (!r?.paging?.next) break;
  }
  mediaCache = { url: postUrl, id, at: Date.now() };
  return id;
}

export interface IgComment { id: string; username: string; text: string }

/** One shared read of the post's comments, reused for a few seconds by every fan checking at once. */
let commentsCache: { mediaId: string; at: number; comments: IgComment[] } | null = null;
let inflight: Promise<IgComment[]> | null = null;
export async function recentComments(postUrl: string): Promise<IgComment[]> {
  const mediaId = await resolveMediaId(postUrl);
  if (!mediaId) throw new Error('The verification post was not found on the club account. Check the post link in Admin → Settings.');
  if (commentsCache && commentsCache.mediaId === mediaId && Date.now() - commentsCache.at < 10_000) return commentsCache.comments;
  if (inflight) return inflight;
  inflight = (async () => {
    const comments: IgComment[] = [];
    let after = '';
    for (let page = 0; page < 20; page++) {
      const r = await graph(`${mediaId}/comments`, { fields: 'id,text,username,timestamp', limit: '50', ...(after ? { after } : {}) });
      for (const c of r?.data || []) if (c?.username) comments.push({ id: String(c.id), username: String(c.username).toLowerCase(), text: String(c.text || '') });
      after = r?.paging?.cursors?.after || '';
      if (!r?.paging?.next) break;
    }
    commentsCache = { mediaId, at: Date.now(), comments };
    return comments;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** The comment that proves this fan's username posted their code, if any. */
export const proofIn = (comments: IgComment[], handle: string, code: string) =>
  comments.find(c => c.username === handle.toLowerCase() && c.text.toUpperCase().replace(/\s+/g, '').includes(code.replace(/\s+/g, '')));

export async function hideComment(id: string) {
  await graph(id, { hide: 'true' }, 'POST').catch(() => undefined);
}

export function markVerified(u: User, by: string, now = new Date().toISOString()) {
  u.instagramFollowed = true;
  u.instagramStatus = 'verified';
  u.instagramVerifiedAt = now;
  u.instagramVerifiedBy = by;
  u.instagramCode = undefined;
  u.instagramReviewNote = undefined;
}

/** Another account already verified this Instagram username. */
export const takenBy = (store: AppStore, handle: string, selfId: string) =>
  store.users.find(x => x.id !== selfId && x.instagramFollowed && (x.instagramHandle || '').replace(/^@/, '').toLowerCase() === handle);

/**
 * Paths a signed-in fan may still write to before passing the check: signing in and out, the check
 * itself, their profile and team, notifications, and accepting a team-admin invitation.
 */
const OPEN_PREFIXES = ['/auth/', '/instagram/', '/notifications/', '/fcm/', '/team-invites/', '/cron/'];
const OPEN_PATHS = new Set(['/me', '/me/profile/update', '/me/team', '/feeds/webhook']);
const isOpen = (path: string) => OPEN_PATHS.has(path) || OPEN_PREFIXES.some(p => path.startsWith(p));

/** Blocks every game, prize, post and check-in for signed-in fans who have not passed the Instagram check. */
export function instagramGate(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (isOpen(req.path)) return next();
  const user = getAuthUser(req);
  if (!user) return next(); // the route itself asks for sign-in
  const store = db.get();
  if (!needsInstagram(store, user)) return next();
  const g = gateSettings(store);
  return res.status(403).json({ error: `Verify your Instagram first: follow ${g.target} and confirm your username.`, code: 'instagram_required' });
}

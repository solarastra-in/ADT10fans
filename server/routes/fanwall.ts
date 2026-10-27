import fs from 'fs';
import { Router } from 'express';
import { db, FanPost, REACTIONS, ReactionEmoji, User } from '../db';
import { canManageTeam, getAuthUser, hasPermission, publicUser, rateLimit, requireAdmin, requireUser, selfUser } from '../auth';
import { bad, newId, num, str, userOf, wrap } from '../http';
import { awardPoints, earnedOnDay } from '../points';
import { dubaiDay } from '../games';
import { dispatchNotification } from '../notify';
import { findBy } from '../indexes';
import { deletePhoto, localPhotoFile, photoStorage, readPhoto, storePhoto } from '../uploads';

/**
 * The fan wall: fans post a photo and a few lines about being a fan (a matchday moment, their shirt
 * collection, the trip to the stadium). Others react; anyone can report. Admins review photos before
 * they show (Admin → Settings → fan wall review), and pick a Fan of the Day, who gets points.
 */
export const fanWallRouter = Router();

export const FANWALL = { postPoints: 5, postPointsPerDay: 2, postsPerDay: 5, autoHideReports: 3, pageSize: 24 };
const KINDS: FanPost['kind'][] = ['moment', 'matchday', 'memorabilia', 'travel', 'other'];

function reactionSummary(reactions: Record<string, string[]>, viewerId?: string) {
  return REACTIONS.map(e => ({ emoji: e, count: (reactions[e] || []).length, mine: viewerId ? (reactions[e] || []).includes(viewerId) : false })).filter(r => r.count || r.mine);
}

function canModerate(user: User | null, teamId: string | null) {
  return Boolean(user && hasPermission(user, 'community') && canManageTeam(user, teamId));
}

export function postView(p: FanPost, viewer: User | null, opts: { admin?: boolean } = {}) {
  return {
    id: p.id,
    userId: p.userId,
    userName: p.userName,
    userAvatar: p.userAvatar,
    teamId: p.teamId,
    text: p.text,
    photoUrl: p.photoUrl || null,
    photoWidth: p.photoWidth,
    photoHeight: p.photoHeight,
    kind: p.kind,
    matchId: p.matchId || null,
    status: p.status,
    reactions: reactionSummary(p.reactions || {}, viewer?.id),
    featuredOn: p.featuredOn || [],
    createdAt: p.createdAt,
    mine: viewer?.id === p.userId,
    ...(opts.admin ? { reports: p.reports.length, reportReasons: p.reports.map(r => r.reason) } : {}),
  };
}

/** Today's Fan of the Day and the previous few. */
function fansOfTheDay(limit = 7) {
  const store = db.get();
  return [...store.fansOfTheDay]
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, limit)
    .map(f => {
      const post = store.fanPosts.find(p => p.id === f.postId);
      const u = findBy(store.users, 'id', f.userId);
      return { day: f.day, points: f.points, note: f.note || '', post: post && post.status === 'live' ? postView(post, null) : null, fan: u ? publicUser(u) : { id: f.userId, name: f.userName } };
    });
}

// ---------- reading ----------
fanWallRouter.get('/fanwall', (req, res) => {
  const viewer = getAuthUser(req);
  const store = db.get();
  const teamId = str(req.query.teamId, 60);
  const kind = str(req.query.kind, 20);
  const before = str(req.query.before, 40);
  const list = store.fanPosts
    .filter(p => (p.status === 'live' || (viewer && p.userId === viewer.id && p.status === 'pending')) && (!teamId || p.teamId === teamId) && (!kind || p.kind === kind) && (!before || p.createdAt < before))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, FANWALL.pageSize + 1);
  const storage = photoStorage();
  res.json({
    posts: list.slice(0, FANWALL.pageSize).map(p => postView(p, viewer)),
    more: list.length > FANWALL.pageSize,
    fansOfTheDay: fansOfTheDay(),
    photosEnabled: storage.mode !== 'off',
    review: store.settings.fanWallReview || 'photos',
    fanOfTheDayPoints: store.settings.fanOfTheDayPoints ?? 100,
  });
});

fanWallRouter.get('/fanwall/:id([\\w-]{3,40})', (req, res) => {
  const viewer = getAuthUser(req);
  const p = db.get().fanPosts.find(x => x.id === req.params.id);
  if (!p || (p.status !== 'live' && p.userId !== viewer?.id && !canModerate(viewer, p.teamId))) return bad(res, 'Post not found', 404);
  res.json({ post: postView(p, viewer) });
});

/** Photos stored on this server's disk (single-server mode). */
export function serveLocalPhoto(req: any, res: any) {
  const file = localPhotoFile(String(req.params.file || ''));
  if (!file) return res.status(404).type('text/plain').send('Not found');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.type(file.endsWith('.png') ? 'image/png' : 'image/jpeg');
  fs.createReadStream(file).pipe(res);
}

// ---------- posting ----------
/**
 * New post. The photo (if any) is checked and stored first, then the post is saved in one short
 * write (this path is self-managed in storeSync, so the upload does not hold the write lock).
 */
fanWallRouter.post('/fanwall/new', requireUser, rateLimit('fanwall', 6, 60 * 60_000), wrap(async (req, res) => {
  const user = userOf(req);
  const text = str(req.body?.text, 500).replace(/\s+\n/g, '\n');
  const kind = KINDS.includes(req.body?.kind) ? req.body.kind : 'moment';
  if (!text && !req.body?.photo) return bad(res, 'Add a photo or a few words');
  if (text && text.length < 3) return bad(res, 'Write a little more');
  if ((text.match(/https?:\/\//g) || []).length > 2) return bad(res, 'Posts can include at most 2 links');
  const today = dubaiDay();
  const store0 = db.get();
  if (store0.fanPosts.filter(p => p.userId === user.id && dubaiDay(new Date(p.createdAt)) === today).length >= FANWALL.postsPerDay) {
    return bad(res, `You can post ${FANWALL.postsPerDay} times a day`, 429);
  }
  let photo: { url: string; path: string; width: number; height: number } | null = null;
  if (req.body?.photo) {
    if (photoStorage().mode === 'off') return bad(res, 'Photo uploads are not available yet. Post without a photo, or try again later.', 503);
    const r = readPhoto(req.body.photo);
    if ('error' in r) return bad(res, r.error);
    try {
      const stored = await storePhoto(r.bytes, r.info);
      photo = { ...stored, width: r.info.width, height: r.info.height };
    } catch (e: any) {
      console.error('[FANWALL] upload failed:', e?.message);
      return bad(res, 'The photo could not be saved. Please try again.', 502);
    }
  }
  const result = await db.mutate(store => {
    const u = findBy(store.users, 'id', user.id);
    if (!u) return null;
    const review = store.settings.fanWallReview || 'photos';
    const matchId = req.body?.matchId && store.matches.some(m => m.id === req.body.matchId) ? String(req.body.matchId) : null;
    const now = new Date().toISOString();
    const post: FanPost = {
      id: newId('fp'),
      userId: u.id,
      userName: u.name,
      userAvatar: u.avatar,
      teamId: u.teamId,
      text,
      photoUrl: photo?.url || null,
      photoPath: photo?.path || null,
      photoWidth: photo?.width,
      photoHeight: photo?.height,
      kind,
      matchId,
      reactions: {},
      reports: [],
      status: review === 'all' || (review === 'photos' && photo) ? 'pending' : 'live',
      createdAt: now,
    };
    store.fanPosts.push(post);
    // Points for posting, a few a day (a removed post loses them).
    const paidToday = earnedOnDay(store, u.id, ['fan-post'], today);
    const points = paidToday < FANWALL.postPoints * FANWALL.postPointsPerDay ? FANWALL.postPoints : 0;
    if (points) awardPoints(store, u, points, 'fan-post', 'Fan wall post', post.id);
    return { post, points, user: u };
  });
  if (!result) return bad(res, 'Please sign in again', 401);
  res.json({
    success: true,
    post: postView(result.post, result.user),
    pointsAdded: result.points,
    message: result.post.status === 'pending' ? 'Thanks! Your post will show once a moderator has looked at it.' : 'Posted!',
    user: selfUser(result.user),
  });
}));

fanWallRouter.post('/fanwall/:id/react', requireUser, rateLimit('react', 120, 60_000), (req, res) => {
  const emoji = req.body?.emoji as ReactionEmoji;
  if (!REACTIONS.includes(emoji)) return bad(res, 'Unknown reaction');
  const user = userOf(req);
  const p = db.get().fanPosts.find(x => x.id === req.params.id && x.status === 'live');
  if (!p) return bad(res, 'Post not found', 404);
  const list = p.reactions[emoji] || [];
  p.reactions[emoji] = list.includes(user.id) ? list.filter(id => id !== user.id) : [...list, user.id];
  db.save();
  res.json({ success: true, reactions: reactionSummary(p.reactions, user.id) });
});

fanWallRouter.post('/fanwall/:id/report', requireUser, rateLimit('report', 20, 60 * 60_000), (req, res) => {
  const user = userOf(req);
  const p = db.get().fanPosts.find(x => x.id === req.params.id);
  if (!p || p.status === 'hidden') return bad(res, 'Post not found', 404);
  if (p.userId === user.id) return bad(res, 'You cannot report your own post');
  if (p.reports.some(r => r.userId === user.id)) return bad(res, 'You have already reported this');
  p.reports.push({ userId: user.id, reason: str(req.body?.reason, 200) || 'Inappropriate', at: new Date().toISOString() });
  if (p.reports.length >= FANWALL.autoHideReports && !(p.featuredOn || []).length) p.status = 'pending';
  db.save();
  res.json({ success: true, message: 'Thanks. A moderator will look at it.' });
});

/** Fans delete their own posts (points for it are taken back); moderators can delete any. */
fanWallRouter.delete('/fanwall/:id', requireUser, wrap(async (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const p = store.fanPosts.find(x => x.id === req.params.id);
  if (!p) return bad(res, 'Post not found', 404);
  if (p.userId !== user.id && !canModerate(user, p.teamId)) return bad(res, 'Not your post', 403);
  removePost(p);
  db.save();
  res.json({ success: true });
}));

function removePost(p: FanPost) {
  const store = db.get();
  const author = findBy(store.users, 'id', p.userId);
  const earned = store.pointsLedger.filter(e => e.ref === p.id && e.source === 'fan-post' && e.userId === p.userId).reduce((s, e) => s + e.delta, 0);
  if (author && earned > 0) awardPoints(store, author, -earned, 'fan-post', 'Fan wall post removed', p.id);
  store.fanPosts = store.fanPosts.filter(x => x.id !== p.id);
  void deletePhoto(p.photoPath);
}

// ---------- moderation and Fan of the Day ----------
fanWallRouter.get('/admin/fanwall', requireAdmin('community'), (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const status = str(req.query.status, 20) || 'pending';
  const list = store.fanPosts
    .filter(p => canManageTeam(user, p.teamId) || !p.teamId)
    .filter(p => (status === 'reported' ? p.reports.length > 0 && p.status !== 'hidden' : p.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);
  const today = dubaiDay();
  res.json({
    posts: list.map(p => postView(p, user, { admin: true })),
    counts: {
      pending: store.fanPosts.filter(p => p.status === 'pending').length,
      reported: store.fanPosts.filter(p => p.reports.length > 0 && p.status !== 'hidden').length,
      live: store.fanPosts.filter(p => p.status === 'live').length,
    },
    today: store.fansOfTheDay.find(f => f.day === today) || null,
    fanOfTheDayPoints: store.settings.fanOfTheDayPoints ?? 100,
  });
});

fanWallRouter.post('/admin/fanwall/:id/:action(approve|hide|restore|delete)', requireAdmin('community'), (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const p = store.fanPosts.find(x => x.id === req.params.id);
  if (!p) return bad(res, 'Post not found', 404);
  if (!canManageTeam(user, p.teamId) && p.teamId) return bad(res, 'You can only moderate your own team’s fans', 403);
  const action = req.params.action;
  if (action === 'delete') removePost(p);
  else {
    p.status = action === 'hide' ? 'hidden' : 'live';
    if (action !== 'hide') p.reports = [];
    p.updatedAt = new Date().toISOString();
  }
  db.save();
  res.json({ success: true, post: action === 'delete' ? null : postView(p, user, { admin: true }) });
});

/**
 * Picks today's Fan of the Day (Dubai date). Choosing again the same day moves the title (and the
 * points) to the new pick. The fan gets a notification; everyone sees the post at the top of the wall.
 */
fanWallRouter.post('/admin/fanwall/:id/feature', requireAdmin('community'), wrap(async (req, res) => {
  const admin = userOf(req);
  const store = db.get();
  const p = store.fanPosts.find(x => x.id === req.params.id);
  if (!p) return bad(res, 'Post not found', 404);
  if (p.status !== 'live') return bad(res, 'Approve the post first');
  // Fan of the Day is the league's award (one a day, with points): picked by league admins only.
  if (!canManageTeam(admin, '__league__')) return bad(res, 'Fan of the Day is picked by the league organisers', 403);
  const day = dubaiDay();
  const points = Math.min(1000, Math.max(0, Math.round(num(req.body?.points, store.settings.fanOfTheDayPoints ?? 100))));
  const note = str(req.body?.note, 200);
  const previous = store.fansOfTheDay.find(f => f.day === day);
  if (previous) {
    if (previous.postId === p.id) return bad(res, 'This post is already today’s Fan of the Day');
    const prevUser = findBy(store.users, 'id', previous.userId);
    if (prevUser && previous.points) awardPoints(store, prevUser, -previous.points, 'fan-of-day', `Fan of the Day moved to another fan (${day})`, `fotd:${day}`, admin.email);
    const prevPost = store.fanPosts.find(x => x.id === previous.postId);
    if (prevPost) prevPost.featuredOn = (prevPost.featuredOn || []).filter(d => d !== day);
    store.fansOfTheDay = store.fansOfTheDay.filter(f => f.day !== day);
  }
  const author = findBy(store.users, 'id', p.userId);
  if (!author) return bad(res, 'The fan no longer has an account');
  awardPoints(store, author, points, 'fan-of-day', `Fan of the Day ${day}${note ? `: ${note}` : ''}`, `fotd:${day}`, admin.email);
  p.featuredOn = [...new Set([...(p.featuredOn || []), day])];
  store.fansOfTheDay.push({ day, postId: p.id, userId: author.id, userName: author.name, points, note, chosenBy: admin.email, chosenAt: new Date().toISOString() });
  db.save();
  await dispatchNotification({
    title: `🏆 You're today's Fan of the Day!`,
    body: `Your post was picked by the organisers.${points ? ` +${points} points.` : ''}${note ? ` "${note}"` : ''}`,
    category: 'perk',
    targetAudience: 'users',
    userIds: [author.id],
    data: { url: `/fanwall/${p.id}` },
    createdBy: 'Fan wall',
  });
  res.json({ success: true, fanOfTheDay: fansOfTheDay(1)[0] || null, user: author.id === admin.id ? selfUser(author) : undefined });
}));

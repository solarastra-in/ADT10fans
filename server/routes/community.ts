import { Router } from 'express';
import { db, ForumComment, ForumThread, Poll, REACTIONS, ReactionEmoji, User } from '../db';
import { canManageTeam, getAuthUser, hasPermission, publicUser, rateLimit, requireAdmin, requireUser, selfUser, teamScopeOf } from '../auth';
import { bad, isoOrEmpty, newId, str, userOf } from '../http';
import { awardPoints, earnedOnDay } from '../points';

export const communityRouter = Router();

const FORUM_CATEGORIES: ForumThread['category'][] = ['matchday', 'tactics', 'franchises', 'fantasy', 'fanspaces', 'giveaways', 'general'];
const AUTO_HIDE_REPORTS = 3;
const THREAD_POINTS = 15;
const REPLY_POINTS = 5;
/** Points for posting are capped per day so the forum is not spammed for points. */
const DAILY_FORUM_POINTS_CAP = 50;

const linkCount = (s: string) => (s.match(/https?:\/\//g) || []).length;
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });

/**
 * Points a post earns: its full value until the fan reaches today's cap, then what is left of the
 * cap. Counted from the points ledger, so deleting a post does not free up the day's allowance.
 */
function forumPointsFor(userId: string, value: number) {
  const today = dayKey(new Date().toISOString());
  const already = earnedOnDay(db.get(), userId, ['forum-thread', 'forum-reply'], today);
  return Math.max(0, Math.min(value, DAILY_FORUM_POINTS_CAP - already));
}

/** Takes back the points a removed post earned its author. */
function takeBackPostPoints(post: { userId: string; pointsAwarded?: number; id: string }, why: string) {
  const store = db.get();
  const author = store.users.find(u => u.id === post.userId);
  if (author && post.pointsAwarded) awardPoints(store, author, -post.pointsAwarded, 'forum-removed', why, post.id);
}

function reactionSummary(r: ForumThread['reactions'], userId?: string) {
  return REACTIONS.map(e => ({ emoji: e, count: (r?.[e] || []).length, mine: Boolean(userId && (r?.[e] || []).includes(userId)) })).filter(x => x.count > 0 || false);
}

function threadView(t: ForumThread, userId?: string) {
  const { upvotedBy, reactions, ...rest } = t;
  return { ...rest, upvoted: Boolean(userId && upvotedBy.includes(userId)), reactions: reactionSummary(reactions, userId) };
}
function commentView(c: ForumComment, userId?: string) {
  const { upvotedBy, reactions, ...rest } = c;
  return { ...rest, upvoted: Boolean(userId && upvotedBy.includes(userId)), reactions: reactionSummary(reactions, userId) };
}

const canModerate = (user: ReturnType<typeof getAuthUser>, teamId?: string | null) => Boolean(user && hasPermission(user, 'community') && canManageTeam(user, teamId || null));

communityRouter.get('/forum/threads', (req, res) => {
  const viewer = getAuthUser(req);
  const { category, teamId, search, sort, matchId } = req.query;
  let threads = db.get().forumThreads.filter(t => !t.hidden || canModerate(viewer, t.teamId));
  if (category && category !== 'all') threads = threads.filter(t => t.category === category);
  if (teamId && teamId !== 'all') threads = threads.filter(t => t.teamId === teamId);
  if (matchId) threads = threads.filter(t => t.matchId === matchId);
  if (typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    threads = threads.filter(t => t.title.toLowerCase().includes(q) || t.content.toLowerCase().includes(q) || t.tags?.some(g => g.toLowerCase().includes(q)));
  }
  const byActivity = (a: ForumThread, b: ForumThread) => +new Date(b.lastActivityAt || b.createdAt) - +new Date(a.lastActivityAt || a.createdAt);
  const byTop = (a: ForumThread, b: ForumThread) => b.upvotes + b.commentsCount - (a.upvotes + a.commentsCount) || byActivity(a, b);
  threads = [...threads].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (sort === 'top' ? byTop(a, b) : sort === 'new' ? +new Date(b.createdAt) - +new Date(a.createdAt) : byActivity(a, b)));
  res.json({ threads: threads.slice(0, 200).map(t => threadView(t, viewer?.id)) });
});

communityRouter.post('/forum/threads', requireUser, rateLimit('thread', 5, 10 * 60_000), (req, res) => {
  const user = userOf(req);
  const title = str(req.body?.title, 150);
  const content = str(req.body?.content, 5000);
  if (title.length < 5) return bad(res, 'Title must be at least 5 characters');
  if (content.length < 10) return bad(res, 'Post must be at least 10 characters');
  if (linkCount(content) > 3) return bad(res, 'Posts can include at most 3 links');
  const store = db.get();
  const teamId = req.body?.teamId && store.teams.some(t => t.id === req.body.teamId) ? req.body.teamId : null;
  const matchId = req.body?.matchId && store.matches.some(m => m.id === req.body.matchId) ? req.body.matchId : null;
  const tags = (Array.isArray(req.body?.tags) ? req.body.tags : []).map((t: any) => str(t, 24)).filter(Boolean).slice(0, 5);
  const now = new Date().toISOString();
  const earned = forumPointsFor(user.id, THREAD_POINTS);
  const thread: ForumThread = {
    id: newId('thread'), title, content,
    category: FORUM_CATEGORIES.includes(req.body?.category) ? req.body.category : 'general',
    tags, teamId, matchId, userId: user.id, userName: user.name, userAvatar: user.avatar,
    userBadge: user.role === 'admin' ? (user.adminRole === 'team_official' ? 'Team official' : 'Admin') : undefined,
    pinned: false, upvotes: 0, upvotedBy: [], reactions: {}, views: 0, commentsCount: 0, lastActivityAt: now, createdAt: now,
    pointsAwarded: earned,
  };
  store.forumThreads.unshift(thread);
  awardPoints(store, user, earned, 'forum-thread', title, thread.id);
  db.save();
  res.json({ success: true, thread: threadView(thread, user.id), pointsAdded: earned, user: selfUser(user) });
});

communityRouter.get('/forum/threads/:id', (req, res) => {
  const viewer = getAuthUser(req);
  const store = db.get();
  const thread = store.forumThreads.find(t => t.id === req.params.id);
  if (!thread || (thread.hidden && !canModerate(viewer, thread.teamId))) return bad(res, 'Thread not found', 404);
  thread.views = (thread.views || 0) + 1;
  db.save();
  const comments = store.forumComments
    .filter(c => c.threadId === thread.id && (!c.hidden || canModerate(viewer, thread.teamId)))
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    .map(c => commentView(c, viewer?.id));
  res.json({ thread: threadView(thread, viewer?.id), comments, canModerate: canModerate(viewer, thread.teamId) });
});

communityRouter.patch('/forum/threads/:id', requireUser, (req, res) => {
  const user = userOf(req);
  const t = db.get().forumThreads.find(x => x.id === req.params.id);
  if (!t) return bad(res, 'Thread not found', 404);
  if (t.userId !== user.id) return bad(res, 'You can only edit your own posts', 403);
  if (Date.now() - +new Date(t.createdAt) > 24 * 3600_000) return bad(res, 'Posts can be edited for 24 hours');
  const title = str(req.body?.title, 150);
  const content = str(req.body?.content, 5000);
  if (title && title.length >= 5) t.title = title;
  if (content) {
    if (content.length < 10) return bad(res, 'Post must be at least 10 characters');
    if (linkCount(content) > 3) return bad(res, 'Posts can include at most 3 links');
    t.content = content;
  }
  t.editedAt = new Date().toISOString();
  db.save();
  res.json({ success: true, thread: threadView(t, user.id) });
});

communityRouter.delete('/forum/threads/:id', requireUser, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const t = store.forumThreads.find(x => x.id === req.params.id);
  if (!t) return bad(res, 'Thread not found', 404);
  if (t.userId !== user.id && !canModerate(user, t.teamId)) return bad(res, 'You can only delete your own posts', 403);
  takeBackPostPoints(t, `Thread removed: ${t.title}`);
  store.forumThreads = store.forumThreads.filter(x => x.id !== t.id);
  store.forumComments = store.forumComments.filter(c => c.threadId !== t.id);
  store.forumReports = store.forumReports.filter(r => r.threadId !== t.id);
  db.save();
  res.json({ success: true });
});

communityRouter.post('/forum/threads/:id/comments', requireUser, rateLimit('comment', 20, 10 * 60_000), (req, res) => {
  const user = userOf(req);
  const content = str(req.body?.content, 3000);
  if (content.length < 2) return bad(res, 'Reply cannot be empty');
  if (linkCount(content) > 3) return bad(res, 'Replies can include at most 3 links');
  const store = db.get();
  const thread = store.forumThreads.find(t => t.id === req.params.id && !t.hidden);
  if (!thread) return bad(res, 'Thread not found', 404);
  if (thread.locked) return bad(res, 'This thread is locked', 423);
  const earned = forumPointsFor(user.id, REPLY_POINTS);
  const comment: ForumComment = {
    id: newId('comment'), threadId: thread.id, userId: user.id, userName: user.name, userAvatar: user.avatar,
    userBadge: user.role === 'admin' ? (user.adminRole === 'team_official' ? 'Team official' : 'Admin') : undefined,
    teamId: user.teamId || null, content, upvotes: 0, upvotedBy: [], reactions: {}, createdAt: new Date().toISOString(),
    pointsAwarded: earned,
  };
  store.forumComments.push(comment);
  thread.commentsCount = store.forumComments.filter(c => c.threadId === thread.id && !c.hidden).length;
  thread.lastActivityAt = comment.createdAt;
  awardPoints(store, user, earned, 'forum-reply', thread.title, comment.id);
  db.save();
  res.json({ success: true, comment: commentView(comment, user.id), thread: threadView(thread, user.id), pointsAdded: earned, user: selfUser(user) });
});

communityRouter.delete('/forum/comments/:id', requireUser, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const c = store.forumComments.find(x => x.id === req.params.id);
  if (!c) return bad(res, 'Reply not found', 404);
  const t = store.forumThreads.find(x => x.id === c.threadId);
  if (c.userId !== user.id && !canModerate(user, t?.teamId)) return bad(res, 'You can only delete your own replies', 403);
  takeBackPostPoints(c, 'Reply removed');
  store.forumComments = store.forumComments.filter(x => x.id !== c.id);
  if (t) t.commentsCount = store.forumComments.filter(x => x.threadId === t.id && !x.hidden).length;
  db.save();
  res.json({ success: true });
});

function toggleVote(entity: { upvotes: number; upvotedBy?: string[] }, userId: string) {
  entity.upvotedBy = entity.upvotedBy || [];
  const had = entity.upvotedBy.includes(userId);
  entity.upvotedBy = had ? entity.upvotedBy.filter(id => id !== userId) : [...entity.upvotedBy, userId];
  entity.upvotes = entity.upvotedBy.length;
  return !had;
}
function toggleReaction(entity: { reactions?: Partial<Record<ReactionEmoji, string[]>> }, emoji: ReactionEmoji, userId: string) {
  entity.reactions = entity.reactions || {};
  const list = entity.reactions[emoji] || [];
  entity.reactions[emoji] = list.includes(userId) ? list.filter(id => id !== userId) : [...list, userId];
}

communityRouter.post('/forum/threads/:id/upvote', requireUser, (req, res) => {
  const t = db.get().forumThreads.find(x => x.id === req.params.id && !x.hidden);
  if (!t) return bad(res, 'Thread not found', 404);
  const upvoted = toggleVote(t, userOf(req).id);
  db.save();
  res.json({ success: true, upvotes: t.upvotes, upvoted });
});
communityRouter.post('/forum/comments/:id/upvote', requireUser, (req, res) => {
  const c = db.get().forumComments.find(x => x.id === req.params.id && !x.hidden);
  if (!c) return bad(res, 'Reply not found', 404);
  const upvoted = toggleVote(c, userOf(req).id);
  db.save();
  res.json({ success: true, upvotes: c.upvotes, upvoted });
});
communityRouter.post('/forum/:kind(threads|comments)/:id/react', requireUser, rateLimit('react', 120, 60_000), (req, res) => {
  const emoji = req.body?.emoji as ReactionEmoji;
  if (!REACTIONS.includes(emoji)) return bad(res, 'Unknown reaction');
  const store = db.get();
  const list: any[] = req.params.kind === 'threads' ? store.forumThreads : store.forumComments;
  const target = list.find(x => x.id === req.params.id && !x.hidden);
  if (!target) return bad(res, 'Post not found', 404);
  const user = userOf(req);
  toggleReaction(target, emoji, user.id);
  db.save();
  res.json({ success: true, reactions: reactionSummary(target.reactions, user.id) });
});

communityRouter.post('/forum/:kind(threads|comments)/:id/report', requireUser, rateLimit('report', 20, 60 * 60_000), (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const kind = req.params.kind === 'threads' ? 'thread' : 'comment';
  const target: any = kind === 'thread' ? store.forumThreads.find(x => x.id === req.params.id) : store.forumComments.find(x => x.id === req.params.id);
  if (!target) return bad(res, 'Post not found', 404);
  if (target.userId === user.id) return bad(res, 'You cannot report your own post');
  if (store.forumReports.some(r => r.targetId === target.id && r.userId === user.id && r.status === 'open')) return bad(res, 'You have already reported this');
  const reason = str(req.body?.reason, 200) || 'Inappropriate';
  store.forumReports.unshift({ id: newId('rep'), kind, targetId: target.id, threadId: kind === 'thread' ? target.id : target.threadId, userId: user.id, reason, status: 'open', createdAt: new Date().toISOString() });
  const open = store.forumReports.filter(r => r.targetId === target.id && r.status === 'open').length;
  if (open >= AUTO_HIDE_REPORTS) {
    target.hidden = true;
    if (kind === 'comment') {
      const t = store.forumThreads.find(x => x.id === target.threadId);
      if (t) t.commentsCount = store.forumComments.filter(c => c.threadId === t.id && !c.hidden).length;
    }
  }
  db.save();
  res.json({ success: true, message: 'Thanks. A moderator will look at it.', hidden: Boolean(target.hidden) });
});

// ---------- moderation ----------
communityRouter.get('/admin/forum/reports', requireAdmin('community'), (req, res) => {
  const store = db.get();
  const user = userOf(req);
  const reports = store.forumReports
    .filter(r => r.status === 'open')
    .filter(r => canManageTeam(user, store.forumThreads.find(t => t.id === r.threadId)?.teamId || null) || teamScopeOf(user) === null)
    .map(r => {
      const thread = store.forumThreads.find(t => t.id === r.threadId);
      const comment = r.kind === 'comment' ? store.forumComments.find(c => c.id === r.targetId) : undefined;
      return { ...r, threadTitle: thread?.title || '(deleted)', excerpt: (comment?.content || thread?.content || '').slice(0, 240), author: comment?.userName || thread?.userName || '', hidden: Boolean(comment ? comment.hidden : thread?.hidden) };
    });
  res.json({ reports });
});

communityRouter.post('/admin/forum/reports/:id', requireAdmin('community'), (req, res) => {
  const store = db.get();
  const report = store.forumReports.find(r => r.id === req.params.id);
  if (!report) return bad(res, 'Report not found', 404);
  const thread = store.forumThreads.find(t => t.id === report.threadId);
  if (!canManageTeam(userOf(req), thread?.teamId || null) && teamScopeOf(userOf(req)) !== null) return bad(res, 'Not your team’s thread', 403);
  const action = req.body?.action;
  if (!['dismiss', 'remove'].includes(action)) return bad(res, 'Choose dismiss or remove');
  const now = new Date().toISOString();
  for (const r of store.forumReports.filter(x => x.targetId === report.targetId && x.status === 'open')) {
    r.status = action === 'remove' ? 'removed' : 'dismissed';
    r.decidedAt = now;
  }
  const target: any = report.kind === 'thread' ? thread : store.forumComments.find(c => c.id === report.targetId);
  if (target) target.hidden = action === 'remove';
  if (thread) thread.commentsCount = store.forumComments.filter(c => c.threadId === thread.id && !c.hidden).length;
  db.save();
  res.json({ success: true });
});

communityRouter.post('/admin/forum/threads/:id/:action(pin|lock|hide)', requireAdmin('community'), (req, res) => {
  const t = db.get().forumThreads.find(x => x.id === req.params.id);
  if (!t) return bad(res, 'Thread not found', 404);
  if (!canManageTeam(userOf(req), t.teamId || null) && teamScopeOf(userOf(req)) !== null) return bad(res, 'You can only moderate your team’s threads', 403);
  const value = Boolean(req.body?.value ?? req.body?.pinned ?? true);
  if (req.params.action === 'pin') t.pinned = value;
  if (req.params.action === 'lock') t.locked = value;
  if (req.params.action === 'hide') t.hidden = value;
  db.save();
  res.json({ success: true, thread: t });
});
// Older admin UI paths
communityRouter.delete('/admin/forum/threads/:id', requireAdmin('community'), (req, res) => {
  const store = db.get();
  const t = store.forumThreads.find(x => x.id === req.params.id);
  if (t && !canManageTeam(userOf(req), t.teamId || null) && teamScopeOf(userOf(req)) !== null) return bad(res, 'You can only moderate your team’s threads', 403);
  if (t) takeBackPostPoints(t, `Thread removed: ${t.title}`);
  store.forumThreads = store.forumThreads.filter(x => x.id !== req.params.id);
  store.forumComments = store.forumComments.filter(c => c.threadId !== req.params.id);
  db.save();
  res.json({ success: true });
});
communityRouter.delete('/admin/forum/comments/:id', requireAdmin('community'), (req, res) => {
  const store = db.get();
  const c = store.forumComments.find(x => x.id === req.params.id);
  const t = c && store.forumThreads.find(x => x.id === c.threadId);
  if (t && !canManageTeam(userOf(req), t.teamId || null) && teamScopeOf(userOf(req)) !== null) return bad(res, 'You can only moderate your team’s threads', 403);
  if (c) takeBackPostPoints(c, 'Reply removed');
  store.forumComments = store.forumComments.filter(x => x.id !== req.params.id);
  if (t) t.commentsCount = store.forumComments.filter(x => x.threadId === t.id && !x.hidden).length;
  db.save();
  res.json({ success: true });
});

// ---------- polls ----------
function pollView(p: Poll, userId?: string) {
  const counts: Record<string, number> = {};
  for (const o of p.options) counts[o.id] = 0;
  for (const v of Object.values(p.votes)) if (counts[v] !== undefined) counts[v]++;
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const closed = p.status === 'closed' || Boolean(p.closesAt && +new Date(p.closesAt) <= Date.now());
  return {
    id: p.id, question: p.question, teamId: p.teamId || null, matchId: p.matchId || null, closesAt: p.closesAt || null,
    status: closed ? 'closed' : 'open', createdAt: p.createdAt, total,
    myVote: userId ? p.votes[userId] || null : null,
    options: p.options.map(o => ({ ...o, votes: counts[o.id], pct: total ? Math.round((counts[o.id] / total) * 100) : 0 })),
  };
}

communityRouter.get('/polls', (req, res) => {
  const viewer = getAuthUser(req);
  let polls = db.get().polls;
  if (req.query.teamId) polls = polls.filter(p => p.teamId === req.query.teamId);
  if (req.query.matchId) polls = polls.filter(p => p.matchId === req.query.matchId);
  const views = polls.map(p => pollView(p, viewer?.id)).sort((a, b) => Number(a.status === 'closed') - Number(b.status === 'closed') || +new Date(b.createdAt) - +new Date(a.createdAt));
  res.json({ polls: views.slice(0, 50) });
});

communityRouter.post('/polls/:id/vote', requireUser, rateLimit('vote', 60, 60_000), (req, res) => {
  const user = userOf(req);
  const p = db.get().polls.find(x => x.id === req.params.id);
  if (!p) return bad(res, 'Poll not found', 404);
  if (pollView(p).status === 'closed') return bad(res, 'This poll has closed');
  const optionId = str(req.body?.optionId, 40);
  if (!p.options.some(o => o.id === optionId)) return bad(res, 'Choose one of the options');
  p.votes[user.id] = optionId;
  db.save();
  res.json({ success: true, poll: pollView(p, user.id) });
});

communityRouter.post('/admin/polls', requireAdmin('community'), (req, res) => {
  const b = req.body || {};
  const store = db.get();
  const user = userOf(req);
  const question = str(b.question, 200);
  if (question.length < 5) return bad(res, 'Write the question');
  const options = (Array.isArray(b.options) ? b.options : []).map((o: any) => str(typeof o === 'string' ? o : o?.text, 80)).filter(Boolean);
  if (options.length < 2 || options.length > 6) return bad(res, 'A poll needs 2 to 6 options');
  const teamId = str(b.teamId, 60) || null;
  if (teamId && !store.teams.some(t => t.id === teamId)) return bad(res, 'Unknown team');
  if (!canManageTeam(user, teamId)) return bad(res, 'Team officials can only post polls for their own team', 403);
  const matchId = str(b.matchId, 60) || null;
  if (matchId && !store.matches.some(m => m.id === matchId)) return bad(res, 'Unknown match');
  const idx = b.id ? store.polls.findIndex(p => p.id === b.id) : -1;
  if (idx >= 0 && Object.keys(store.polls[idx].votes).length && JSON.stringify(store.polls[idx].options.map(o => o.text)) !== JSON.stringify(options)) {
    return bad(res, 'Options cannot be changed once fans have voted');
  }
  const poll: Poll = {
    ...(idx >= 0 ? store.polls[idx] : { votes: {}, createdAt: new Date().toISOString(), createdBy: user.name }),
    id: idx >= 0 ? store.polls[idx].id : newId('poll'),
    question,
    options: options.map((text: string, i: number) => ({ id: idx >= 0 ? store.polls[idx].options[i]?.id || `o${i + 1}` : `o${i + 1}`, text })),
    teamId,
    matchId,
    closesAt: isoOrEmpty(b.closesAt) || undefined,
    status: b.status === 'closed' ? 'closed' : 'open',
  } as Poll;
  if (idx >= 0) store.polls[idx] = poll;
  else store.polls.unshift(poll);
  db.save();
  res.json({ success: true, poll: pollView(poll) });
});

communityRouter.delete('/admin/polls/:id', requireAdmin('community'), (req, res) => {
  const store = db.get();
  const p = store.polls.find(x => x.id === req.params.id);
  if (!p) return bad(res, 'Poll not found', 404);
  if (!canManageTeam(userOf(req), p.teamId || null)) return bad(res, 'Not your team’s poll', 403);
  store.polls = store.polls.filter(x => x.id !== p.id);
  db.save();
  res.json({ success: true });
});

// ---------- leaderboards & fan base ----------
/**
 * Leaderboards sort every fan, so the tables are shared by everyone asking within a short window
 * (a fan's own rank comes from the same ranking). They are worked out again after a change on this
 * server (at most every 2 seconds), and at least every 15 seconds for changes made on other servers.
 */
const LEADERBOARD_TTL_MS = 15_000;
const MIN_RECOMPUTE_MS = () => Number(process.env.LEADERBOARD_MIN_RECOMPUTE_MS ?? 2_000);
const fresh = (c: { at: number; epoch: number } | null) => Boolean(c && (Date.now() - c.at < MIN_RECOMPUTE_MS() || (c.epoch === db.epoch && Date.now() - c.at < LEADERBOARD_TTL_MS)));
let boardCache: { at: number; epoch: number; fanWars: any[]; ranked: User[]; rankOf: Map<string, number>; byTeam: Map<string, any[]> } | null = null;
function leaderboardTables() {
  if (boardCache && fresh(boardCache)) return boardCache;
  const store = db.get();
  const totals = new Map(store.teams.map(t => [t.id, { team: { id: t.id, name: t.name, short: t.short, color: t.color }, points: 0, fansCount: 0 }]));
  for (const u of store.users) {
    const row = u.teamId ? totals.get(u.teamId) : undefined;
    if (row) {
      row.points += u.points;
      row.fansCount++;
    }
  }
  const fanWars = [...totals.values()].sort((a, b) => b.points - a.points || b.fansCount - a.fansCount);
  const ranked = [...store.users].sort((a, b) => b.points - a.points);
  const rankOf = new Map(ranked.map((u, i) => [u.id, i + 1]));
  boardCache = { at: Date.now(), epoch: db.epoch, fanWars, ranked, rankOf, byTeam: new Map() };
  return boardCache;
}

communityRouter.get('/leaderboard', (req, res) => {
  const t = leaderboardTables();
  const teamId = str(req.query.teamId, 60);
  const key = teamId || '*';
  if (!t.byTeam.has(key)) t.byTeam.set(key, t.ranked.filter(u => u.points > 0 && (!teamId || u.teamId === teamId)).slice(0, 50).map(publicUser));
  const viewer = getAuthUser(req);
  res.json({ fanWars: t.fanWars, topFans: t.byTeam.get(key), myRank: viewer ? t.rankOf.get(viewer.id) || null : null });
});

let fansCache: { at: number; epoch: number; body: any } | null = null;
communityRouter.get('/fans', (_req, res) => {
  if (fansCache && fresh(fansCache)) return res.json(fansCache.body);
  const store = db.get();
  const teams = store.teams.map(t => {
    const fans = store.users.filter(u => u.teamId === t.id);
    return {
      teamId: t.id,
      fans: fans.length,
      points: fans.reduce((s, u) => s + u.points, 0),
      activeThisWeek: fans.filter(u => u.lastActiveAt && Date.now() - +new Date(u.lastActiveAt) < 7 * 86400_000).length,
      topFans: [...fans].sort((a, b) => b.points - a.points).slice(0, 5).map(publicUser),
      threads: store.forumThreads.filter(th => th.teamId === t.id && !th.hidden).length,
    };
  });
  const countries = new Map<string, number>();
  for (const u of store.users) if (u.country) countries.set(u.country, (countries.get(u.country) || 0) + 1);
  const recent = [...store.users].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 12).map(u => ({ name: u.name, avatar: u.avatar, teamId: u.teamId, country: u.country, joinedAt: u.createdAt }));
  const body = {
    totalFans: store.users.length,
    unaffiliated: store.users.filter(u => !u.teamId).length,
    teams,
    countries: [...countries.entries()].map(([country, fans]) => ({ country, fans })).sort((a, b) => b.fans - a.fans).slice(0, 30),
    recent,
  };
  fansCache = { at: Date.now(), epoch: db.epoch, body };
  res.json(body);
});

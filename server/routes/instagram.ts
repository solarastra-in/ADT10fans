import { Router } from 'express';
import { db, User } from '../db';
import { rateLimit, requireAdmin, requireUser, selfUser } from '../auth';
import { bad, str, userOf, wrap } from '../http';
import {
  USERNAME_RE, cleanUsername, commentCheckConfigured, diagnose, gateSettings, hideComment, markVerified,
  newCode, proofIn, recentComments, statusOf, takenBy, grantWelcome,
} from '../instagramGate';

/** The Instagram check fans pass before playing (see instagramGate.ts). */
export const instagramRouter = Router();

function view(u: User | null) {
  const store = db.get();
  const g = gateSettings(store);
  return {
    required: g.required,
    target: g.target,
    targetUrl: `https://www.instagram.com/${g.target.replace(/^@/, '')}/`,
    postUrl: g.postUrl || null,
    automatic: commentCheckConfigured() && Boolean(g.postUrl),
    status: u ? statusOf(u) : 'none',
    handle: u?.instagramHandle || null,
    code: u && statusOf(u) !== 'verified' ? u.instagramCode || null : null,
    note: u?.instagramReviewNote || null,
    welcomePoints: g.welcomePoints,
  };
}

const welcome = grantWelcome;

instagramRouter.get('/instagram/status', requireUser, (req, res) => res.json(view(userOf(req))));

/** Step 1: the fan enters their username and gets a code to comment on the post. */
instagramRouter.post('/instagram/start', requireUser, rateLimit('ig-start', 10, 60 * 60_000), wrap(async (req, res) => {
  const handle = cleanUsername(req.body?.handle);
  if (!USERNAME_RE.test(handle)) return bad(res, 'Enter your Instagram username (letters, numbers, full stops and underscores).');
  const r = await db.mutate(store => {
    const u = store.users.find(x => x.id === userOf(req).id);
    if (!u) return { error: 'Please sign in first', status: 401 };
    if (statusOf(u) === 'verified') return { ok: true };
    if (takenBy(store, handle, u.id)) return { error: `@${handle} is already verified on another ADT10fans account.`, status: 409 };
    // Same username again keeps the same code (they may already have commented it).
    if (u.instagramHandle !== handle || !u.instagramCode) u.instagramCode = newCode();
    u.instagramHandle = handle;
    u.instagramStatus = 'code';
    u.instagramCodeAt = new Date().toISOString();
    u.instagramReviewNote = undefined;
    return { ok: true };
  });
  if ('error' in r) return bad(res, r.error!, r.status);
  res.json(view(db.get().users.find(x => x.id === userOf(req).id) || null));
}));

/** Step 2: look for the fan's comment on the post. */
instagramRouter.post('/instagram/check', requireUser, rateLimit('ig-check', 20, 10 * 60_000), wrap(async (req, res) => {
  const me = userOf(req);
  const g = gateSettings(db.get());
  if (statusOf(me) === 'verified') return res.json({ ...view(me), verified: true });
  if (!me.instagramHandle || !me.instagramCode) return bad(res, 'Enter your Instagram username first.');
  if (!commentCheckConfigured() || !g.postUrl) {
    return res.json({ ...view(me), verified: false, reason: 'The automatic check is not switched on yet, so an organiser will confirm your account. Tap “Ask an organiser to check”.' });
  }
  let comments;
  try {
    comments = await recentComments(g.postUrl);
    if (!proofIn(comments, me.instagramHandle, me.instagramCode)) comments = await recentComments(g.postUrl, true);
  } catch (e: any) {
    console.warn('[instagram] comment check failed:', e?.message || e);
    return res.json({ ...view(me), verified: false, reason: 'Instagram did not answer just now. Try again in a minute, or ask an organiser to check.' });
  }
  const proof = proofIn(comments, me.instagramHandle, me.instagramCode);
  if (!proof) {
    return res.json({ ...view(me), verified: false, reason: `We could not find a comment from @${me.instagramHandle} with ${me.instagramCode} yet. Instagram can take a minute to show new comments.` });
  }
  const r = await db.mutate(store => {
    const u = store.users.find(x => x.id === me.id);
    if (!u) return null;
    if (takenBy(store, u.instagramHandle || '', u.id)) return { taken: true as const };
    markVerified(u, 'comment');
    return { points: welcome(store, u), user: u };
  });
  if (!r) return bad(res, 'Please sign in first', 401);
  if ('taken' in r) return bad(res, `@${me.instagramHandle} is already verified on another ADT10fans account.`, 409);
  if (g.hideComments) void hideComment(proof.id);
  res.json({ ...view(r.user), verified: true, pointsAwarded: r.points, user: selfUser(r.user) });
}));

/** The fan asks an organiser to confirm their account by hand. */
instagramRouter.post('/instagram/request-review', requireUser, rateLimit('ig-review', 5, 60 * 60_000), wrap(async (req, res) => {
  const r = await db.mutate(store => {
    const u = store.users.find(x => x.id === userOf(req).id);
    if (!u) return null;
    if (statusOf(u) === 'verified') return u;
    if (!u.instagramHandle) return 'missing' as const;
    u.instagramStatus = 'review';
    u.instagramRequestedAt = new Date().toISOString();
    u.instagramCode ||= newCode();
    return u;
  });
  if (!r) return bad(res, 'Please sign in first', 401);
  if (r === 'missing') return bad(res, 'Enter your Instagram username first.');
  res.json(view(r));
}));

// ---------- Admin ----------

const canReview = requireAdmin(['community', 'fanclubs', 'growth']);

/** Fans waiting for an organiser, plus recent decisions and the state of the automatic check. */
instagramRouter.get('/admin/instagram', canReview, wrap(async (req, res) => {
  const store = db.get();
  const q = str(req.query.q, 60).toLowerCase().replace(/^@/, '');
  const row = (u: User) => ({ id: u.id, name: u.name, email: u.email, avatar: u.avatar, handle: u.instagramHandle || null, code: u.instagramCode || null, status: statusOf(u), requestedAt: u.instagramRequestedAt || u.instagramCodeAt || null, verifiedAt: u.instagramVerifiedAt || null, verifiedBy: u.instagramVerifiedBy || null, note: u.instagramReviewNote || null });
  const fans = store.users.filter(u => u.role !== 'admin');
  const matches = q ? fans.filter(u => (u.instagramHandle || '').includes(q) || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)) : [];
  res.json({
    settings: gateSettings(store),
    setup: req.query.diagnose ? await diagnose(store) : { configured: commentCheckConfigured() },
    counts: {
      verified: fans.filter(u => statusOf(u) === 'verified').length,
      waiting: fans.filter(u => statusOf(u) === 'review').length,
      withCode: fans.filter(u => statusOf(u) === 'code').length,
      notStarted: fans.filter(u => statusOf(u) === 'none').length,
    },
    queue: fans.filter(u => statusOf(u) === 'review').sort((a, b) => String(a.instagramRequestedAt).localeCompare(String(b.instagramRequestedAt))).slice(0, 200).map(row),
    search: matches.slice(0, 50).map(row),
  });
}));

/** Approve, reject or reset one fan's check. Approving is for when you have seen their account follow and comment. */
instagramRouter.post('/admin/instagram/:userId', canReview, wrap(async (req, res) => {
  const admin = userOf(req);
  const action = String(req.body?.action || '');
  if (!['approve', 'reject', 'reset'].includes(action)) return bad(res, 'Choose approve, reject or reset');
  const r = await db.mutate(store => {
    const u = store.users.find(x => x.id === req.params.userId);
    if (!u) return { error: 'Fan not found', status: 404 };
    if (action === 'approve') {
      if (!u.instagramHandle) return { error: 'This fan has not entered an Instagram username', status: 409 };
      if (takenBy(store, u.instagramHandle, u.id)) return { error: `@${u.instagramHandle} is already verified on another account`, status: 409 };
      markVerified(u, admin.email);
      welcome(store, u);
    } else if (action === 'reject') {
      u.instagramFollowed = false;
      u.instagramStatus = 'rejected';
      u.instagramReviewNote = str(req.body?.note, 200) || 'We could not confirm this Instagram account. Check the username and that you follow the account, then try again.';
    } else {
      u.instagramFollowed = false;
      u.instagramStatus = 'none';
      u.instagramCode = undefined;
      u.instagramVerifiedAt = undefined;
      u.instagramVerifiedBy = undefined;
    }
    return { ok: { id: u.id, status: statusOf(u) } };
  });
  if ('error' in r) return bad(res, r.error!, r.status);
  res.json({ success: true, ...r.ok });
}));

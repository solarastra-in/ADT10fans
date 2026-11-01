import crypto from 'crypto';
import { Router, type Request } from 'express';
import { db, TEAM_OFFICIAL_PERMISSIONS, type TeamInvite } from '../db';
import { adminEmails, canManageTeam, getAuthUser, isSuperAdmin, rateLimit, refreshAccess, requireAdmin, requireSuperAdmin, requireUser, sendEmail, selfUser } from '../auth';
import { bad, newId, str, userOf, wrap } from '../http';

/**
 * Team portals: each franchise runs its own page, squad and player details, official accounts,
 * posts, prizes for its fans, polls and messages, at /team-portal.
 *
 * A super admin onboards a team admin with their name, email and team. The person gets an email
 * with a link; when they sign in with that same email and accept, they become a team admin
 * (team_official) for that franchise only. The link works once, for 7 days, and only a hash of it
 * is stored. Without a mail server the super admin gets the link to pass on themselves.
 */
export const teamPortalRouter = Router();

const INVITE_DAYS = 7;
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const isEmail = (s: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(s);
const expired = (i: TeamInvite) => i.status === 'pending' && +new Date(i.expiresAt) <= Date.now();
const statusOf = (i: TeamInvite) => (expired(i) ? 'expired' : i.status);

/** What the console shows: never the token or its hash. */
const view = (i: TeamInvite) => {
  const { tokenHash, ...rest } = i;
  return { ...rest, status: statusOf(i) };
};

/** The site's public address, for the link in the email. */
function siteBase(req: Request) {
  const fromEnv = (process.env.APP_URL || '').trim();
  if (/^https?:\/\//.test(fromEnv)) return fromEnv.replace(/\/$/, '');
  const origin = String(req.get('origin') || '');
  if (/^https?:\/\/[^/]+$/.test(origin)) return origin;
  const proto = String(req.get('x-forwarded-proto') || req.protocol).split(',')[0];
  return `${proto}://${req.get('host')}`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

async function emailInvite(i: TeamInvite, link: string): Promise<boolean> {
  const store = db.get();
  const brand = store.settings.brandName || 'ADT10 Fans';
  const team = store.teams.find(t => t.id === i.teamId)?.name || i.teamId;
  const days = Math.max(1, Math.round((+new Date(i.expiresAt) - Date.now()) / 86_400_000));
  try {
    const r = await sendEmail({
      to: i.email,
      subject: `You're invited to run the ${team} team portal on ${brand}`,
      text: `Hi ${i.name},\n\nYou've been invited to manage ${team} on ${brand}: the team page, squad and player details, official accounts, posts, prizes for your fans, polls and messages.\n\nAccept here (sign in with ${i.email}): ${link}\n\nThe link works for ${days} day(s). If you weren't expecting this, ignore this email.`,
      html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff">
        <h2 style="color:#0f172a;margin-top:0">${esc(brand)}</h2>
        <p style="color:#334155;font-size:15px">Hi ${esc(i.name)},</p>
        <p style="color:#334155;font-size:15px">You've been invited to manage <strong>${esc(team)}</strong>: the team page, squad and player details, official accounts, posts, prizes for your fans, polls and messages.</p>
        <p style="text-align:center;margin:28px 0"><a href="${esc(link)}" style="background:#fbbf24;color:#0f172a;font-weight:800;text-decoration:none;padding:14px 22px;border-radius:10px;display:inline-block">Accept the invitation</a></p>
        <p style="color:#64748b;font-size:13px">Sign in with <strong>${esc(i.email)}</strong> to accept. The link works for ${days} day(s). If you weren't expecting this, you can ignore this email.</p>
      </div>`,
    });
    return r === 'sent';
  } catch (e: any) {
    console.warn('[TEAM-INVITE] email failed:', e?.message || e);
    return false;
  }
}

// ---------- super admin: onboard team admins ----------

teamPortalRouter.get('/admin/team-invites', requireSuperAdmin, (_req, res) => {
  res.json({ invites: db.get().teamInvites.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(view) });
});

teamPortalRouter.post('/admin/team-invites', requireSuperAdmin, rateLimit('team-invite', 30, 60_000), wrap(async (req, res) => {
  const store = db.get();
  const name = str(req.body?.name, 80);
  const email = str(req.body?.email, 200).toLowerCase();
  const teamId = str(req.body?.teamId, 60);
  if (!name) return bad(res, 'Enter the person\'s name');
  if (!isEmail(email)) return bad(res, 'Enter a valid email address');
  if (!store.teams.some(t => t.id === teamId)) return bad(res, 'Choose a team');
  const existing = store.adminUsers.find(a => a.email.toLowerCase() === email);
  if (existing?.role === 'team_official' && existing.teamId === teamId) return bad(res, `${email} already manages this team`, 409);
  // Other admins already reach every team; a team admin of another franchise can be moved by invitation.
  if ((existing && existing.role !== 'team_official') || (!existing && adminEmails().includes(email))) return bad(res, `${email} already has admin access. Change their role in Admins & RBAC instead.`, 409);
  // A new invitation replaces any pending one for the same email.
  for (const i of store.teamInvites) if (i.email === email && i.status === 'pending') i.status = 'revoked';
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const invite: TeamInvite = {
    id: newId('inv'),
    tokenHash: sha256(token),
    email,
    name,
    teamId,
    invitedBy: userOf(req).email,
    createdAt: now.toISOString(),
    expiresAt: new Date(+now + INVITE_DAYS * 86_400_000).toISOString(),
    status: 'pending',
  };
  store.teamInvites.push(invite);
  db.save();
  const link = `${siteBase(req)}/team-invite/${token}`;
  const emailed = await emailInvite(invite, link);
  const saved = await db.mutate(s => {
    const i = s.teamInvites.find(x => x.id === invite.id);
    if (i) {
      i.sentAt = new Date().toISOString();
      i.emailed = emailed;
    }
    return i ? view(i) : null;
  });
  res.json({
    success: true,
    invite: saved,
    // The link is shown once, to the super admin who created it, so it can be passed on by hand.
    link,
    message: emailed ? `Invitation emailed to ${email}.` : 'Email (SMTP) is not set up or the email failed, so nothing was sent. Copy the link and send it yourself.',
  });
}));

/** Sends a pending invitation again with a fresh link (the old link stops working). */
teamPortalRouter.post('/admin/team-invites/:id/resend', requireSuperAdmin, rateLimit('team-invite', 30, 60_000), wrap(async (req, res) => {
  const store = db.get();
  const invite = store.teamInvites.find(i => i.id === req.params.id);
  if (!invite) return bad(res, 'Invitation not found', 404);
  if (invite.status !== 'pending') return bad(res, `This invitation was ${invite.status}`);
  const token = crypto.randomBytes(32).toString('base64url');
  invite.tokenHash = sha256(token);
  invite.expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();
  db.save();
  const link = `${siteBase(req)}/team-invite/${token}`;
  const emailed = await emailInvite(invite, link);
  const saved = await db.mutate(s => {
    const i = s.teamInvites.find(x => x.id === invite.id);
    if (i) {
      i.sentAt = new Date().toISOString();
      i.emailed = emailed;
    }
    return i ? view(i) : null;
  });
  res.json({ success: true, invite: saved, link, message: emailed ? `Invitation sent again to ${invite.email}.` : 'Email is not set up, so nothing was sent. Copy the new link and send it yourself.' });
}));

teamPortalRouter.delete('/admin/team-invites/:id', requireSuperAdmin, (req, res) => {
  const store = db.get();
  const invite = store.teamInvites.find(i => i.id === req.params.id);
  if (!invite) return bad(res, 'Invitation not found', 404);
  if (invite.status === 'pending') invite.status = 'revoked';
  db.save();
  res.json({ success: true, invite: view(invite) });
});

// ---------- the person invited ----------

const findByToken = (token: string) => (token.length >= 20 && token.length <= 100 ? db.get().teamInvites.find(i => i.tokenHash === sha256(token)) : undefined);

/** What the invitation page shows before accepting (the address is partly hidden). */
teamPortalRouter.get('/team-invites/:token', rateLimit('team-invite-view', 30, 60_000), (req, res) => {
  const invite = findByToken(req.params.token);
  if (!invite) return bad(res, 'This invitation link is not valid. Ask for a new one.', 404);
  const store = db.get();
  const team = store.teams.find(t => t.id === invite.teamId);
  const [local, domain] = invite.email.split('@');
  const user = getAuthUser(req);
  res.json({
    name: invite.name,
    team: team ? { id: team.id, name: team.name, short: team.short, color: team.color, logo: team.logo } : null,
    emailHint: `${local.slice(0, 2)}${'•'.repeat(Math.max(1, local.length - 2))}@${domain}`,
    status: statusOf(invite),
    expiresAt: invite.expiresAt,
    // Only the invited person, signed in, sees the full address and whether they can accept now.
    signedInAsInvitee: Boolean(user && user.email.toLowerCase() === invite.email),
  });
});

teamPortalRouter.post('/team-invites/:token/accept', requireUser, rateLimit('team-invite-accept', 10, 60_000), (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const invite = findByToken(req.params.token);
  if (!invite) return bad(res, 'This invitation link is not valid. Ask for a new one.', 404);
  const status = statusOf(invite);
  if (status === 'accepted') return bad(res, 'This invitation has already been accepted.', 409);
  if (status !== 'pending') return bad(res, `This invitation has ${status === 'expired' ? 'expired' : 'been withdrawn'}. Ask for a new one.`, 410);
  if (user.email.toLowerCase() !== invite.email) return bad(res, `This invitation is for a different email address. Sign out and sign in with the address it was sent to.`, 403);
  if (!store.teams.some(t => t.id === invite.teamId)) return bad(res, 'The team for this invitation no longer exists.', 410);
  if (isSuperAdmin(user) || (user.role === 'admin' && user.adminRole !== 'team_official')) return bad(res, 'You already have admin access, which covers this team.', 409);
  const now = new Date().toISOString();
  const rec = {
    email: invite.email,
    name: invite.name,
    role: 'team_official' as const,
    permissions: [...TEAM_OFFICIAL_PERMISSIONS],
    teamId: invite.teamId,
    isSuperAdmin: false,
    addedBy: invite.invitedBy,
    addedAt: now,
    updatedAt: now,
  };
  const idx = store.adminUsers.findIndex(a => a.email.toLowerCase() === invite.email);
  if (idx >= 0) store.adminUsers[idx] = { ...store.adminUsers[idx], ...rec, addedAt: store.adminUsers[idx].addedAt };
  else store.adminUsers.push(rec);
  invite.status = 'accepted';
  invite.acceptedAt = now;
  if (!user.name || user.name === user.email.split('@')[0]) user.name = invite.name.slice(0, 40);
  refreshAccess(user);
  db.save();
  res.json({ success: true, teamId: invite.teamId, user: selfUser(user) });
});

// ---------- the portal ----------

/** Overview for a team's portal: what its admin looks after, with what needs attention. */
teamPortalRouter.get('/team-portal/:teamId/overview', requireAdmin(['team', 'teams']), (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const team = store.teams.find(t => t.id === req.params.teamId);
  if (!team) return bad(res, 'Team not found', 404);
  if (!canManageTeam(user, team.id)) return bad(res, 'You can only manage your own team', 403);
  const prizes = store.prizes.filter(p => p.teamId === team.id);
  const prizeIds = new Set(prizes.map(p => p.id));
  const handles = store.handles.filter(h => h.teamId === team.id);
  const admins = store.adminUsers.filter(a => a.role === 'team_official' && a.teamId === team.id).map(a => ({ email: a.email, name: a.name || a.email, addedAt: a.addedAt }));
  const pendingInvites = store.teamInvites.filter(i => i.teamId === team.id && statusOf(i) === 'pending').map(i => ({ name: i.name, email: i.email, expiresAt: i.expiresAt }));
  res.json({
    team: { id: team.id, name: team.name, short: team.short, color: team.color, secondaryColor: team.secondaryColor, logo: team.logo },
    fans: store.users.filter(u => u.teamId === team.id).length,
    squad: team.squad.length,
    playersWithLinks: team.squad.filter(p => p.links && Object.keys(p.links).length > 0).length,
    handles: { verified: handles.filter(h => h.status === 'verified').length, pending: handles.filter(h => h.status === 'pending').length },
    posts: store.feedItems.filter(f => f.teamId === team.id).length,
    prizes: { active: prizes.filter(p => p.active).length, total: prizes.length },
    claims: { pending: store.redemptions.filter(r => prizeIds.has(r.prizeId) && r.status === 'pending').length, total: store.redemptions.filter(r => prizeIds.has(r.prizeId)).length },
    admins,
    pendingInvites,
  });
});

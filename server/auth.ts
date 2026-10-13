import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import nodemailer from 'nodemailer';
import { db, User, SUPER_ADMIN_EMAIL, AdminPermission, AdminUserRecord, TEAM_OFFICIAL_PERMISSIONS } from './db';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
export const IS_PROD = process.env.NODE_ENV === 'production';

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

// ---------- Firebase project (for verifying Google sign-in ID tokens) ----------
export { firebaseProjectId } from './firebaseConfig';
import { firebaseProjectId } from './firebaseConfig';
const firebaseJwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export async function verifyFirebaseIdToken(idToken: string) {
  const FIREBASE_PROJECT_ID = firebaseProjectId();
  if (!FIREBASE_PROJECT_ID) throw new Error('Google sign-in is not configured (FIREBASE_PROJECT_ID missing)');
  const { payload } = await jwtVerify(idToken, firebaseJwks, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  if (!email) throw new Error('Google account has no email address');
  if (payload.email_verified !== true) throw new Error('Google email address is not verified');
  return {
    email,
    name: typeof payload.name === 'string' ? payload.name : '',
    picture: typeof payload.picture === 'string' ? payload.picture : '',
  };
}

// ---------- Admin roles ----------
const envAdminEmails = () =>
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

/** Super admins: the built-in owner account, everyone in ADMIN_EMAILS, and admins given the superadmin role. */
export function isSuperAdminEmail(email: string): boolean {
  const clean = email.trim().toLowerCase();
  if (clean === SUPER_ADMIN_EMAIL || envAdminEmails().includes(clean)) return true;
  return (db.get().adminUsers || []).some(a => a.email.toLowerCase() === clean && (a.isSuperAdmin || a.role === 'superadmin'));
}

export function getAdminRecord(email: string): AdminUserRecord | null {
  const clean = email.trim().toLowerCase();
  return (db.get().adminUsers || []).find(a => a.email.toLowerCase() === clean) || null;
}

/** Every email that has some admin access (for display in Settings). */
export function adminEmails(): string[] {
  const fromSettings = (db.get().settings.adminEmails || []).map(e => e.trim().toLowerCase()).filter(Boolean);
  const fromAdminUsers = (db.get().adminUsers || []).map(a => a.email.trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set([SUPER_ADMIN_EMAIL, ...envAdminEmails(), ...fromSettings, ...fromAdminUsers]));
}

export function isSuperAdmin(user: User | null | undefined): boolean {
  return Boolean(user && user.role === 'admin' && (user.isSuperAdmin || isSuperAdminEmail(user.email)));
}

const IMPLIED: Partial<Record<AdminPermission, AdminPermission[]>> = {
  matches: ['leagues'],
  teams: ['leagues'],
  fantasy: ['contests'],
  games: ['contests'],
  draws: ['winners', 'prizes'],
  prizes: ['winners'],
  social: ['feeds'],
  feeds: ['social'],
  community: ['social'],
};

export function hasPermission(user: User, permission?: AdminPermission | AdminPermission[]): boolean {
  if (user.role !== 'admin') return false;
  if (isSuperAdmin(user)) return true;
  if (!permission) return true;
  const perms = user.permissions || [];
  const wanted = Array.isArray(permission) ? permission : [permission];
  return wanted.some(p => {
    if (p === 'admins') return false; // only super admins manage admins
    if (perms.includes('all') && user.adminRole !== 'team_official') return true;
    if (perms.includes(p)) return true;
    if ((IMPLIED[p] || []).some(alt => perms.includes(alt))) return true;
    // Team officials manage their own team's page and squad.
    if (p === 'teams' && perms.includes('team')) return true;
    return false;
  });
}

/** null = every team; otherwise the one team this admin may touch. */
export function teamScopeOf(user: User): string | null {
  if (user.adminRole === 'team_official') return user.adminTeamId || '__none__';
  return null;
}

export function canManageTeam(user: User, teamId: string | null | undefined): boolean {
  const scope = teamScopeOf(user);
  if (scope === null) return true;
  return Boolean(teamId) && teamId === scope;
}

function syncUserRbac(user: User) {
  const clean = user.email.toLowerCase();
  const rec = getAdminRecord(clean);
  if (isSuperAdminEmail(clean)) {
    user.role = 'admin';
    user.isSuperAdmin = true;
    user.adminRole = 'superadmin';
    user.permissions = ['all'];
    user.adminTeamId = null;
  } else if (rec) {
    user.role = 'admin';
    user.isSuperAdmin = false;
    user.adminRole = rec.role;
    if (rec.role === 'team_official') {
      user.permissions = TEAM_OFFICIAL_PERMISSIONS.filter(p => rec.permissions.includes(p) || rec.permissions.length === 0);
      if (!user.permissions.length) user.permissions = [...TEAM_OFFICIAL_PERMISSIONS];
      user.adminTeamId = rec.teamId || null;
    } else {
      user.permissions = rec.permissions;
      user.adminTeamId = null;
    }
  } else if ((db.get().settings.adminEmails || []).map(e => e.toLowerCase()).includes(clean)) {
    user.role = 'admin';
    user.isSuperAdmin = false;
    user.adminRole = 'custom';
    user.permissions = ['all'];
    user.adminTeamId = null;
  } else {
    user.role = 'fan';
    user.isSuperAdmin = false;
    user.adminRole = undefined;
    user.permissions = [];
    user.adminTeamId = null;
  }
}

// ---------- Users & sessions ----------
export function upsertUser(email: string, provider: User['provider'], profile: { name?: string; avatar?: string } = {}): { user: User; created: boolean } {
  const store = db.get();
  const clean = email.trim().toLowerCase();
  let user = store.users.find(u => u.email.toLowerCase() === clean);
  let created = false;
  if (!user) {
    created = true;
    user = {
      id: 'usr_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16),
      email: clean,
      name: (profile.name || clean.split('@')[0]).slice(0, 40),
      avatar: profile.avatar && /^https:\/\//.test(profile.avatar) ? profile.avatar : '',
      provider,
      teamId: null,
      teamChanges: 0,
      points: 0,
      pointsSpent: 0,
      streak: 0,
      badges: [],
      role: 'fan',
      createdAt: new Date().toISOString(),
    };
    syncUserRbac(user);
    store.users.push(user);
  } else {
    syncUserRbac(user);
    if (!user.avatar && profile.avatar && /^https:\/\//.test(profile.avatar)) user.avatar = profile.avatar;
    if (profile.name && (!user.name || user.name === user.email.split('@')[0])) user.name = profile.name.slice(0, 40);
  }
  user.lastActiveAt = new Date().toISOString();
  db.save();
  return { user, created };
}

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('base64url');
  const store = db.get();
  const now = Date.now();
  store.sessions = (store.sessions || []).filter(s => new Date(s.expiresAt).getTime() > now);
  store.sessions.push({
    id: sha256(token),
    userId,
    createdAt: new Date(now).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  });
  db.save();
  return token;
}

export function revokeSession(req: Request) {
  const token = bearer(req);
  if (!token) return;
  const store = db.get();
  const id = sha256(token);
  store.sessions = (store.sessions || []).filter(s => s.id !== id);
  db.save();
}

function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const t = h.replace(/^Bearer\s+/i, '').trim();
  return t || null;
}

export function getAuthUser(req: Request): User | null {
  const token = bearer(req);
  if (!token) return null;
  const store = db.get();
  const session = (store.sessions || []).find(s => s.id === sha256(token));
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) return null;
  const user = store.users.find(u => u.id === session.userId) || null;
  if (user) syncUserRbac(user);
  return user;
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in first' });
  (req as any).user = user;
  next();
}

/**
 * requireAdmin            -> any admin
 * requireAdmin('matches') -> admins with that permission (super admins always pass)
 */
export function requireAdmin(arg1?: AdminPermission | AdminPermission[] | Request, arg2?: Response, arg3?: NextFunction): any {
  if (typeof arg1 === 'object' && arg1 !== null && 'headers' in arg1 && arg2 && arg3) {
    const req = arg1 as Request;
    const user = getAuthUser(req);
    if (!user) return arg2.status(401).json({ error: 'Please sign in first' });
    if (user.role !== 'admin') return arg2.status(403).json({ error: 'Admin access required' });
    (req as any).user = user;
    return arg3();
  }
  const permission = arg1 as AdminPermission | AdminPermission[] | undefined;
  return (req: Request, res: Response, next: NextFunction) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in first' });
    if (user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    if (permission && !hasPermission(user, permission)) {
      return res.status(403).json({ error: 'You do not have permission for this section' });
    }
    (req as any).user = user;
    next();
  };
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in first' });
  if (!isSuperAdmin(user)) return res.status(403).json({ error: 'Only a super admin can do this' });
  (req as any).user = user;
  next();
}

/** The user as other fans may see them. */
export function publicUser(u: User) {
  return { id: u.id, name: u.name, avatar: u.avatar, teamId: u.teamId, points: u.points, badges: u.badges, streak: u.streak, country: u.country || undefined };
}

/** The signed-in user's own view of their account. */
export function selfUser(u: User) {
  const { stats, ...rest } = u;
  return { ...rest, pointsSpent: u.pointsSpent || 0, balance: Math.max(0, u.points - (u.pointsSpent || 0)) };
}

// ---------- Rate limiting (in-memory, per IP + key) ----------
const buckets = new Map<string, { count: number; resetAt: number }>();
export function clientIp(req: Request) {
  // Platform headers first (Vercel sets these itself). Otherwise use the right-most X-Forwarded-For
  // entry: the one added by the proxy in front of us, which a client cannot forge.
  const platform = (req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip']) as string | undefined;
  if (platform) return platform.split(',')[0].trim();
  const xff = (req.headers['x-forwarded-for'] as string | undefined)?.split(',').map(s => s.trim()).filter(Boolean);
  return xff?.length ? xff[xff.length - 1] : req.socket.remoteAddress || 'unknown';
}
export function rateLimit(key: string, max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const k = `${key}:${clientIp(req)}`;
    const now = Date.now();
    const b = buckets.get(k);
    if (!b || b.resetAt < now) {
      buckets.set(k, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (b.count >= max) {
      res.setHeader('Retry-After', Math.ceil((b.resetAt - now) / 1000).toString());
      return res.status(429).json({ error: 'Too many requests, please try again shortly' });
    }
    b.count++;
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
}, 60_000).unref();

// ---------- Email OTP ----------
function smtpConfig() {
  const s = db.get().settings.smtp;
  const host = process.env.SMTP_HOST || (s.enabled ? s.host : '');
  return {
    host,
    port: Number(process.env.SMTP_PORT || s.port || 587),
    user: process.env.SMTP_USER || s.user,
    pass: process.env.SMTP_PASS || s.pass,
    from: process.env.SMTP_FROM || s.from || process.env.SMTP_USER || s.user,
  };
}
export function smtpConfigured(): boolean {
  const c = smtpConfig();
  return Boolean(c.host && c.from);
}
export function emailOtpAvailable(): boolean {
  return smtpConfigured() || !IS_PROD; // in local dev the code is returned instead of emailed
}

export async function sendOtpEmail(to: string, code: string, brand: string): Promise<'sent' | 'dev'> {
  const c = smtpConfig();
  if (!c.host || !c.from) {
    if (IS_PROD) throw new Error('Email sign-in is not configured');
    return 'dev';
  }
  const transporter = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.port === 465,
    auth: c.user ? { user: c.user, pass: c.pass } : undefined,
  });
  await transporter.sendMail({
    from: c.from,
    to,
    subject: `${code} is your ${brand} sign-in code`,
    text: `Your ${brand} sign-in code is ${code}. It expires in 10 minutes. If you didn't request it, ignore this email.`,
    html: `<p>Your <strong>${brand}</strong> sign-in code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in 10 minutes. If you didn't request it, you can ignore this email.</p>`,
  });
  return 'sent';
}

export function hashOtp(email: string, code: string) {
  return sha256(`${email.toLowerCase()}:${code}:${process.env.OTP_PEPPER || 'adt10'}`);
}

export function timingSafeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

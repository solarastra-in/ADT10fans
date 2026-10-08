import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import nodemailer from 'nodemailer';
import { db, User } from './db';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
export const IS_PROD = process.env.NODE_ENV === 'production';

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

// ---------- Firebase project (for verifying Google sign-in ID tokens) ----------
function loadFirebaseProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
    return cfg.projectId || '';
  } catch {
    return '';
  }
}
export const FIREBASE_PROJECT_ID = loadFirebaseProjectId();
const firebaseJwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export async function verifyFirebaseIdToken(idToken: string) {
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

// ---------- Admins ----------
export function adminEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  const fromSettings = (db.get().settings.adminEmails || []).map(e => e.trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set([...fromEnv, ...fromSettings]));
}
export const isAdminEmail = (email: string) => adminEmails().includes(email.toLowerCase());

// ---------- Users & sessions ----------
export function upsertUser(email: string, provider: User['provider'], profile: { name?: string; avatar?: string } = {}): User {
  const store = db.get();
  const clean = email.trim().toLowerCase();
  let user = store.users.find(u => u.email.toLowerCase() === clean);
  const admin = isAdminEmail(clean);
  if (!user) {
    user = {
      id: 'usr_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16),
      email: clean,
      name: (profile.name || clean.split('@')[0]).slice(0, 40),
      avatar: profile.avatar && /^https:\/\//.test(profile.avatar) ? profile.avatar : '',
      provider,
      teamId: null,
      teamChanges: 0,
      points: 0,
      streak: 0,
      badges: [],
      role: admin ? 'admin' : 'fan',
      createdAt: new Date().toISOString(),
    };
    store.users.push(user);
  } else {
    user.role = admin ? 'admin' : 'fan';
    if (!user.avatar && profile.avatar && /^https:\/\//.test(profile.avatar)) user.avatar = profile.avatar;
  }
  db.save();
  return user;
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
  if (user) {
    // Admin role follows the configured admin list at all times.
    const shouldBeAdmin = isAdminEmail(user.email);
    if (shouldBeAdmin !== (user.role === 'admin')) {
      user.role = shouldBeAdmin ? 'admin' : 'fan';
      db.save();
    }
  }
  return user;
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in first' });
  (req as any).user = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in first' });
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  (req as any).user = user;
  next();
}

/** Returns the user stripped of anything we don't want to send to other fans. */
export function publicUser(u: User) {
  return { id: u.id, name: u.name, avatar: u.avatar, teamId: u.teamId, points: u.points, badges: u.badges, streak: u.streak };
}

// ---------- Rate limiting (in-memory, per IP + key) ----------
const buckets = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(key: string, max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const k = `${key}:${ip}`;
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
export function emailOtpAvailable(): boolean {
  const c = smtpConfig();
  return Boolean(c.host && c.from) || !IS_PROD; // in local dev the code is returned instead of emailed
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

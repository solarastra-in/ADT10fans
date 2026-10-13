import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { User } from './db';

export type Handler = (req: Request, res: Response, next: NextFunction) => any;
export const wrap = (fn: Handler): Handler => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v).slice(0, max) : '');
export const num = (v: unknown, fallback = 0) => (v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : fallback);

export const isHttpsUrl = (v: unknown) => {
  if (typeof v !== 'string' || !v) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};

/** '' stays '' (field cleared); otherwise must be https, else null (= invalid) */
export const optionalUrl = (v: unknown): string | null => {
  const s = str(v, 2000);
  if (!s) return '';
  return isHttpsUrl(s) ? s : null;
};

export const isoOrEmpty = (v: unknown) => {
  const s = str(v, 40);
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toISOString();
};

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
export const bad = (res: Response, error: string, code = 400) => res.status(code).json({ error });
export const userOf = (req: Request) => (req as any).user as User;
export const isColor = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

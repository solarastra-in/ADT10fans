import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { googleAccessToken, parseServiceAccount } from './googleAuth';
import { firebaseAppConfig } from './firebaseConfig';

/**
 * Photos fans post on the fan wall.
 *
 * Checks: the bytes must really be a JPEG or PNG (not just the name), at most 3 MB, between 200 and
 * 8000 pixels a side. Metadata is removed before storing: phone photos carry the GPS position where
 * they were taken (EXIF), which would show where a fan lives. The browser re-encodes photos before
 * sending them, and the server strips anything left as a second line of defence.
 *
 * Where they go:
 *  - Firebase Storage (the project's bucket, or FANWALL_BUCKET) through the service account, served
 *    with a download token. Used when FIREBASE_SERVICE_ACCOUNT is set.
 *  - A folder in DATA_DIR, served at /uploads/…, on a single server (development, tests).
 * Otherwise photo uploads are off and fans can still post text.
 */

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export interface PhotoInfo {
  mime: 'image/jpeg' | 'image/png';
  width: number;
  height: number;
}

/** Reads the type and size of an image from its bytes. Null if it is not a JPEG or PNG we accept. */
export function inspectImage(buf: Buffer): PhotoInfo | null {
  if (buf.length > 24 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') {
    return { mime: 'image/png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const len = buf.readUInt16BE(i + 2);
      // SOF0-SOF15 except DHT (C4), JPG (C8) and DAC (CC) carry the frame size.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { mime: 'image/jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}

/**
 * Removes metadata: in JPEG the APP1 (EXIF, XMP), APP2-APP13 and APP15 segments and comments (APP0
 * JFIF and APP14 Adobe are kept: they affect how colours are read); in PNG the text, time and EXIF chunks.
 */
export function stripMetadata(buf: Buffer, mime: PhotoInfo['mime']): Buffer {
  if (mime === 'image/png') {
    const out: Buffer[] = [buf.subarray(0, 8)];
    let i = 8;
    while (i + 12 <= buf.length) {
      const len = buf.readUInt32BE(i);
      const type = buf.toString('ascii', i + 4, i + 8);
      const end = i + 12 + len;
      if (!['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME'].includes(type)) out.push(buf.subarray(i, end));
      i = end;
    }
    return Buffer.concat(out);
  }
  const out: Buffer[] = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1];
    if (marker === 0xda) {
      out.push(buf.subarray(i)); // start of scan: the image data runs to the end
      return Buffer.concat(out);
    }
    const len = buf.readUInt16BE(i + 2);
    const seg = buf.subarray(i, i + 2 + len);
    const isApp = marker >= 0xe1 && marker <= 0xef && marker !== 0xee;
    if (!isApp && marker !== 0xfe) out.push(seg);
    i += 2 + len;
  }
  return Buffer.concat(out);
}

/** Decodes a data: URL from the browser into checked, metadata-free bytes. */
export function readPhoto(dataUrl: unknown): { bytes: Buffer; info: PhotoInfo } | { error: string } {
  const m = typeof dataUrl === 'string' ? /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) : null;
  if (!m) return { error: 'The photo must be a JPEG or PNG image' };
  const raw = Buffer.from(m[2], 'base64');
  if (raw.length > MAX_PHOTO_BYTES) return { error: 'The photo is too large (3 MB at most)' };
  const info = inspectImage(raw);
  if (!info) return { error: 'That file is not a photo we can show' };
  if (Math.min(info.width, info.height) < 200 || Math.max(info.width, info.height) > 8000) return { error: 'The photo must be between 200 and 8000 pixels on each side' };
  return { bytes: stripMetadata(raw, info.mime), info };
}

const bucketName = () => (process.env.FANWALL_BUCKET || firebaseAppConfig().storageBucket || '').trim();
const account = () => parseServiceAccount(process.env.STORE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT || '');
const localDir = () => path.resolve(process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/adt10-data' : path.join(process.cwd(), 'data')), 'uploads');

/** Where photos would be stored right now, or why they cannot be. */
export function photoStorage(): { mode: 'firebase' | 'local' | 'off'; reason?: string } {
  if (account() && bucketName()) return { mode: 'firebase' };
  if (!process.env.VERCEL && (process.env.NODE_ENV !== 'production' || process.env.DATA_DIR)) return { mode: 'local' };
  return { mode: 'off', reason: 'Photo uploads need FIREBASE_SERVICE_ACCOUNT (and Firebase Storage turned on for the project).' };
}

export async function storePhoto(bytes: Buffer, info: PhotoInfo): Promise<{ url: string; path: string }> {
  const ext = info.mime === 'image/png' ? 'png' : 'jpg';
  const name = `fanwall/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const where = photoStorage();
  if (where.mode === 'off') throw new Error(where.reason);
  if (where.mode === 'local') {
    const file = path.join(localDir(), name.replace(/\//g, '_'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
    return { url: `/uploads/${path.basename(file)}`, path: `local:${path.basename(file)}` };
  }
  const bucket = bucketName();
  const token = crypto.randomUUID();
  const api = (process.env.GCS_API_BASE || 'https://storage.googleapis.com').replace(/\/$/, '');
  const boundary = `fanwall-${crypto.randomBytes(8).toString('hex')}`;
  const meta = JSON.stringify({ name, contentType: info.mime, cacheControl: 'public, max-age=31536000, immutable', metadata: { firebaseStorageDownloadTokens: token } });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${info.mime}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const bearer = await googleAccessToken(account()!, 'https://www.googleapis.com/auth/devstorage.read_write');
  const res = await fetch(`${api}/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=multipart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 200);
    throw new Error(res.status === 404 ? 'Firebase Storage is not turned on for this project (Firebase console → Storage)' : `Photo upload failed: HTTP ${res.status} ${text}`);
  }
  const publicBase = (process.env.FIREBASE_STORAGE_PUBLIC_BASE || 'https://firebasestorage.googleapis.com').replace(/\/$/, '');
  return { url: `${publicBase}/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}?alt=media&token=${token}`, path: `gs:${name}` };
}

export async function deletePhoto(stored: string | null | undefined) {
  if (!stored) return;
  try {
    if (stored.startsWith('local:')) {
      fs.unlinkSync(path.join(localDir(), path.basename(stored.slice(6))));
    } else if (stored.startsWith('gs:') && account() && bucketName()) {
      const api = (process.env.GCS_API_BASE || 'https://storage.googleapis.com').replace(/\/$/, '');
      const bearer = await googleAccessToken(account()!, 'https://www.googleapis.com/auth/devstorage.read_write');
      await fetch(`${api}/storage/v1/b/${encodeURIComponent(bucketName())}/o/${encodeURIComponent(stored.slice(3))}`, { method: 'DELETE', headers: { Authorization: `Bearer ${bearer}` } });
    }
  } catch (e) {
    console.warn('[UPLOADS] could not delete', stored, (e as Error)?.message);
  }
}

/** Serves a locally stored photo (single-server mode). */
export function localPhotoFile(name: string): string | null {
  if (!/^[\w.-]+\.(jpg|png)$/.test(name)) return null;
  const file = path.join(localDir(), name);
  return fs.existsSync(file) ? file : null;
}

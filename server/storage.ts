import fs from 'fs';
import path from 'path';
import { googleAccessToken, parseServiceAccount } from './googleAuth';

/**
 * Where the JSON store is kept.
 *
 * - FileBackend: a file in DATA_DIR. Right for one long-running server with a persistent disk.
 * - GcsBackend: one object in a Google Cloud Storage bucket (STORE_BUCKET). Every write is a
 *   conditional write (ifGenerationMatch), so several instances (Vercel, Cloud Run with more than
 *   one instance) can share the store safely: a writer that lost the race gets a ConflictError,
 *   reloads and replays its request (see storeSync.ts).
 */

export interface LoadResult {
  data: string | null;
  /** Opaque version token: GCS object generation, or file mtime for the file backend. */
  version: string | null;
}

export interface StorageBackend {
  readonly kind: 'file' | 'gcs';
  readonly shared: boolean;
  describe(): string;
  load(): Promise<LoadResult>;
  /** Writes the store. Throws ConflictError when `expectedVersion` no longer matches. */
  save(data: string, expectedVersion: string | null): Promise<string>;
  /** Cheap check of the current version without downloading the data. */
  currentVersion(): Promise<string | null>;
}

export class ConflictError extends Error {
  constructor(message = 'The store was changed by another instance') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class FileBackend implements StorageBackend {
  readonly kind = 'file' as const;
  readonly shared = false;
  constructor(private readonly filePath: string) {}

  describe() {
    return `file ${this.filePath}`;
  }

  private stamp(): string | null {
    try {
      return String(fs.statSync(this.filePath).mtimeMs);
    } catch {
      return null;
    }
  }

  async load(): Promise<LoadResult> {
    try {
      return { data: fs.readFileSync(this.filePath, 'utf-8'), version: this.stamp() };
    } catch {
      return { data: null, version: null };
    }
  }

  async save(data: string): Promise<string> {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, data, 'utf-8');
    fs.renameSync(tmp, this.filePath); // atomic replace
    return this.stamp() || String(Date.now());
  }

  async currentVersion() {
    return this.stamp();
  }

  /** Synchronous variant used on process exit. */
  saveSync(data: string) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, data, 'utf-8');
    fs.renameSync(tmp, this.filePath);
  }
}

export class GcsBackend implements StorageBackend {
  readonly kind = 'gcs' as const;
  readonly shared = true;
  private readonly apiBase: string;

  constructor(
    private readonly bucket: string,
    private readonly object: string,
    private readonly getToken: () => Promise<string>,
  ) {
    this.apiBase = (process.env.GCS_API_BASE || 'https://storage.googleapis.com').replace(/\/$/, '');
  }

  describe() {
    return `gs://${this.bucket}/${this.object}`;
  }

  private async headers(extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${await this.getToken()}`, ...extra };
  }

  private objectUrl(query: string) {
    return `${this.apiBase}/storage/v1/b/${encodeURIComponent(this.bucket)}/o/${encodeURIComponent(this.object)}?${query}`;
  }

  async currentVersion(): Promise<string | null> {
    const res = await fetch(this.objectUrl('fields=generation'), { headers: await this.headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GCS metadata read failed: HTTP ${res.status}`);
    const meta = (await res.json()) as { generation?: string };
    return meta.generation || null;
  }

  async load(): Promise<LoadResult> {
    const res = await fetch(this.objectUrl('alt=media'), { headers: await this.headers() });
    if (res.status === 404) return { data: null, version: null };
    if (!res.ok) throw new Error(`GCS read failed: HTTP ${res.status}`);
    const version = res.headers.get('x-goog-generation');
    return { data: await res.text(), version };
  }

  async save(data: string, expectedVersion: string | null): Promise<string> {
    // ifGenerationMatch=0 means "only create if it does not exist yet".
    const query = `uploadType=media&name=${encodeURIComponent(this.object)}&ifGenerationMatch=${expectedVersion || '0'}`;
    const url = `${this.apiBase}/upload/storage/v1/b/${encodeURIComponent(this.bucket)}/o?${query}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: await this.headers({ 'Content-Type': 'application/json' }),
      body: data,
    });
    if (res.status === 412 || res.status === 409) throw new ConflictError();
    if (!res.ok) throw new Error(`GCS write failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const meta = (await res.json()) as { generation?: string };
    return meta.generation || '';
  }
}

export function createBackend(defaultFile: string): StorageBackend {
  const bucket = (process.env.STORE_BUCKET || '').trim();
  if (!bucket) return new FileBackend(defaultFile);
  const object = (process.env.STORE_OBJECT || 't10_store.json').trim();
  const staticToken = (process.env.GCS_ACCESS_TOKEN || '').trim();
  if (staticToken) return new GcsBackend(bucket, object, async () => staticToken);
  const account = parseServiceAccount(process.env.STORE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT || '');
  if (!account) {
    throw new Error('STORE_BUCKET is set but no service account was found. Set STORE_SERVICE_ACCOUNT (or FIREBASE_SERVICE_ACCOUNT) to a service-account JSON with Storage Object Admin on the bucket.');
  }
  return new GcsBackend(bucket, object, () => googleAccessToken(account, 'https://www.googleapis.com/auth/devstorage.read_write'));
}

/** True when data written to local disk will vanish (serverless) and no shared bucket is configured. */
export function ephemeralDiskWarning(backend: StorageBackend): string | null {
  if (backend.kind === 'gcs') return null;
  if (process.env.VERCEL) {
    return 'Running on Vercel without STORE_BUCKET: data is kept in /tmp and is lost whenever the function is recycled. Set STORE_BUCKET to keep it.';
  }
  return null;
}

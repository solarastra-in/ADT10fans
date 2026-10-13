import fs from 'fs';
import path from 'path';
import { googleAccessToken, parseServiceAccount } from './googleAuth';
import { firebaseAppConfig } from './firebaseConfig';

/**
 * Where the JSON store is kept.
 *
 * - FileBackend: a file in DATA_DIR. Right for one long-running server with a persistent disk.
 * - GcsBackend: one object in a Google Cloud Storage bucket (STORE_BUCKET). Every write is a
 *   conditional write (ifGenerationMatch), so several instances (Vercel, Cloud Run with more than
 *   one instance) can share the store safely: a writer that lost the race gets a ConflictError,
 *   reloads and replays its request (see storeSync.ts).
 * - FirestoreBackend: the store in the Firebase project's Firestore database, split into ~900 KB
 *   documents. Every write is one atomic commit with a precondition on the meta document's
 *   update time, so it is shared-safe in the same way. Works on Firebase's free (Spark) plan.
 */

export interface LoadResult {
  data: string | null;
  /** Opaque version token: GCS object generation, or file mtime for the file backend. */
  version: string | null;
}

export interface StorageBackend {
  readonly kind: 'file' | 'gcs' | 'firestore';
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

/**
 * Store kept in Firestore: collection `<collection>` with a `meta` document (chunk count) and
 * `c0000`, `c0001`, … documents holding consecutive slices of the JSON text. The version token is
 * the meta document's updateTime; a write only succeeds if it still matches (precondition), and all
 * chunk documents change in the same commit, so readers never see a mix of two versions.
 */
export class FirestoreBackend implements StorageBackend {
  readonly kind = 'firestore' as const;
  readonly shared = true;
  private readonly base: string;
  private readonly docRoot: string;
  private lastChunks = 0;
  /** Firestore documents hold up to 1 MiB; STORE_CHUNK_BYTES lowers it (tests use it to force several chunks). */
  static get CHUNK_BYTES() {
    return Math.min(900_000, Math.max(10_000, Number(process.env.STORE_CHUNK_BYTES) || 900_000));
  }

  constructor(
    private readonly projectId: string,
    private readonly databaseId: string,
    private readonly collection: string,
    private readonly getToken: () => Promise<string>,
  ) {
    const api = (process.env.FIRESTORE_API_BASE || 'https://firestore.googleapis.com').replace(/\/$/, '');
    this.docRoot = `projects/${projectId}/databases/${databaseId}/documents`;
    this.base = `${api}/v1/${this.docRoot}`;
  }

  describe() {
    return `firestore ${this.projectId}/${this.databaseId}/${this.collection}`;
  }

  private name(id: string) {
    return `${this.docRoot}/${this.collection}/${id}`;
  }

  private async call(pathSuffix: string, body: unknown) {
    const res = await fetch(`${this.base}${pathSuffix}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { status: res.status, json, text };
  }

  private async getMeta(readTime?: string): Promise<{ chunks: number; version: string | null; readTime: string | null }> {
    const r = await this.call(':batchGet', { documents: [this.name('meta')], ...(readTime ? { readTime } : {}) });
    if (r.status >= 400) throw new Error(`Firestore read failed: HTTP ${r.status} ${r.text.slice(0, 200)}`);
    const row = (Array.isArray(r.json) ? r.json : [])[0] || {};
    if (!row.found) return { chunks: 0, version: null, readTime: row.readTime || null };
    return { chunks: Number(row.found.fields?.chunks?.integerValue || 0), version: row.found.updateTime, readTime: row.readTime || null };
  }

  async currentVersion() {
    return (await this.getMeta()).version;
  }

  /**
   * True when the store can be read from Firestore without signing in (open security rules).
   * Uses the public web API key from firebase-applet-config.json, like any visitor's browser could.
   */
  async publiclyReadable(apiKey: string): Promise<boolean> {
    if (!apiKey) return false;
    const api = (process.env.FIRESTORE_API_BASE || 'https://firestore.googleapis.com').replace(/\/$/, '');
    try {
      const res = await fetch(`${api}/v1/${this.name('meta')}?key=${encodeURIComponent(apiKey)}`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async load(): Promise<LoadResult> {
    const meta = await this.getMeta();
    if (!meta.version) return { data: null, version: null };
    const ids = Array.from({ length: meta.chunks }, (_, i) => this.name(`c${String(i).padStart(4, '0')}`));
    // Read the chunks at the same moment as the meta document, so a concurrent write cannot mix in.
    const r = await this.call(':batchGet', { documents: ids, readTime: meta.readTime });
    if (r.status >= 400) throw new Error(`Firestore read failed: HTTP ${r.status} ${r.text.slice(0, 200)}`);
    const byName = new Map<string, string>();
    for (const row of Array.isArray(r.json) ? r.json : []) if (row.found) byName.set(row.found.name, row.found.fields?.d?.stringValue ?? '');
    const parts = ids.map(id => byName.get(id));
    if (parts.some(p => p === undefined)) throw new Error('Firestore store is incomplete (a chunk is missing)');
    this.lastChunks = meta.chunks;
    return { data: parts.join(''), version: meta.version };
  }

  /** Splits text into slices of at most CHUNK_BYTES UTF-8 bytes without cutting a character. */
  static split(data: string): string[] {
    const out: string[] = [];
    let start = 0;
    while (start < data.length) {
      let end = Math.min(data.length, start + FirestoreBackend.CHUNK_BYTES);
      while (Buffer.byteLength(data.slice(start, end)) > FirestoreBackend.CHUNK_BYTES) end -= Math.ceil((end - start) / 10);
      // Do not split a surrogate pair.
      const code = data.charCodeAt(end - 1);
      if (end < data.length && code >= 0xd800 && code <= 0xdbff) end -= 1;
      out.push(data.slice(start, end));
      start = end;
    }
    return out.length ? out : [''];
  }

  async save(data: string, expectedVersion: string | null): Promise<string> {
    const chunks = FirestoreBackend.split(data);
    if (chunks.length > 11) throw new Error('The store is larger than about 10 MB, which one Firestore commit cannot hold');
    const writes: any[] = [
      {
        update: { name: this.name('meta'), fields: { chunks: { integerValue: String(chunks.length) }, bytes: { integerValue: String(Buffer.byteLength(data)) } } },
        currentDocument: expectedVersion ? { updateTime: expectedVersion } : { exists: false },
      },
      ...chunks.map((d, i) => ({ update: { name: this.name(`c${String(i).padStart(4, '0')}`), fields: { d: { stringValue: d } } } })),
    ];
    for (let i = chunks.length; i < this.lastChunks; i++) writes.push({ delete: this.name(`c${String(i).padStart(4, '0')}`) });
    const r = await this.call(':commit', { writes });
    const status = String(r.json?.error?.status || '');
    if (r.status === 409 || status === 'FAILED_PRECONDITION' || status === 'ABORTED' || status === 'ALREADY_EXISTS' || (r.status === 404 && expectedVersion)) throw new ConflictError();
    if (r.status >= 400) throw new Error(`Firestore write failed: HTTP ${r.status} ${r.text.slice(0, 300)}`);
    this.lastChunks = chunks.length;
    return r.json?.writeResults?.[0]?.updateTime || r.json?.commitTime || '';
  }
}

/**
 * Picks where the store lives:
 *  - STORE_BUCKET set                                  -> that Cloud Storage bucket
 *  - a service account and a Firebase project, when deployed (Vercel or NODE_ENV=production),
 *    or STORE_BACKEND=firestore                        -> the project's Firestore database
 *  - otherwise                                         -> a file in DATA_DIR
 * STORE_BACKEND=file forces the file store.
 */
export function createBackend(defaultFile: string): StorageBackend {
  const forced = (process.env.STORE_BACKEND || '').trim().toLowerCase();
  const bucket = (process.env.STORE_BUCKET || '').trim();
  const account = parseServiceAccount(process.env.STORE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT || '');
  if (forced === 'file') return new FileBackend(defaultFile);
  if (!bucket) {
    const cfg = firebaseAppConfig();
    const deployed = Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production';
    const projectId = (process.env.FIRESTORE_PROJECT_ID || cfg.projectId || account?.project_id || '').trim();
    if ((forced === 'firestore' || deployed) && account && projectId) {
      const databaseId = (process.env.FIRESTORE_DATABASE_ID || cfg.firestoreDatabaseId || '(default)').trim();
      const collection = (process.env.STORE_COLLECTION || 'adt10_store').trim();
      return new FirestoreBackend(projectId, databaseId, collection, () => googleAccessToken(account, 'https://www.googleapis.com/auth/datastore'));
    }
    if (forced === 'firestore') throw new Error('STORE_BACKEND=firestore needs FIREBASE_SERVICE_ACCOUNT (service-account JSON) and a Firebase project id.');
    return new FileBackend(defaultFile);
  }
  const object = (process.env.STORE_OBJECT || 't10_store.json').trim();
  const staticToken = (process.env.GCS_ACCESS_TOKEN || '').trim();
  if (staticToken) return new GcsBackend(bucket, object, async () => staticToken);
  if (!account) {
    throw new Error('STORE_BUCKET is set but no service account was found. Set STORE_SERVICE_ACCOUNT (or FIREBASE_SERVICE_ACCOUNT) to a service-account JSON with Storage Object Admin on the bucket.');
  }
  return new GcsBackend(bucket, object, () => googleAccessToken(account, 'https://www.googleapis.com/auth/devstorage.read_write'));
}

/** True when data written to local disk will vanish (serverless) and no shared bucket is configured. */
export function ephemeralDiskWarning(backend: StorageBackend): string | null {
  if (backend.shared) return null;
  if (process.env.VERCEL) {
    return 'Running on Vercel without a database: data is kept in /tmp and is lost whenever the function is recycled. Set FIREBASE_SERVICE_ACCOUNT (Firebase console > Project settings > Service accounts > Generate new private key) to keep it in your Firebase project\'s Firestore.';
  }
  return null;
}

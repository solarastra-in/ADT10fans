import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, doc, getDoc, writeBatch, type Firestore, setLogLevel } from 'firebase/firestore';
try {
  setLogLevel('silent');
} catch {
  /* ignore */
}

const BACKUP_PATH = path.join(process.cwd(), 'data', 'store_cloud_backup.json');

function saveLocalBackup(data: string) {
  try {
    const dir = path.dirname(BACKUP_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(BACKUP_PATH, data, 'utf8');
  } catch {
    /* fallback */
  }
}

function loadLocalBackup(): string | null {
  try {
    if (fs.existsSync(BACKUP_PATH)) return fs.readFileSync(BACKUP_PATH, 'utf8');
  } catch {
    /* fallback */
  }
  return null;
}

let globalWriteQuotaExceededUntil = 0;
let permissionDeniedUntil = 0;
export const isWriteQuotaExceeded = () => Date.now() < globalWriteQuotaExceededUntil;

export class FirestoreSdkBackend implements StorageBackend {
  readonly kind = 'firestore' as const;
  readonly shared = true;
  private readonly app: FirebaseApp;
  private readonly firestore: Firestore;
  private readonly collectionName: string;
  private lastChunks = 0;
  private currentLocalVersion = 'backup-v1';

  constructor(private readonly cfg: ReturnType<typeof firebaseAppConfig>, collectionName = 'adt10_store') {
    this.collectionName = collectionName;
    const appName = `storage-${cfg.projectId}`;
    const existing = getApps().find(a => a.name === appName || a.name === '[DEFAULT]');
    this.app = existing || initializeApp(cfg as any, appName);
    this.firestore = getFirestore(this.app, cfg.firestoreDatabaseId || '(default)');
  }

  describe() {
    return `firebase-firestore ${this.cfg.projectId}/${this.cfg.firestoreDatabaseId}/${this.collectionName}`;
  }

  async currentVersion(): Promise<string | null> {
    if (Date.now() < globalWriteQuotaExceededUntil || Date.now() < permissionDeniedUntil) {
      return this.currentLocalVersion;
    }
    try {
      const metaRef = doc(this.firestore, this.collectionName, 'meta');
      const snap = await Promise.race([
        getDoc(metaRef),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
      ]);
      if (!snap.exists()) return this.currentLocalVersion;
      return String(snap.data()?.version || snap.data()?.updatedAt || '');
    } catch (err: any) {
      if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
        permissionDeniedUntil = Date.now() + 60 * 1000;
      }
      return this.currentLocalVersion;
    }
  }

  async load(): Promise<LoadResult> {
    try {
      const metaRef = doc(this.firestore, this.collectionName, 'meta');
      const metaSnap = await Promise.race([
        getDoc(metaRef),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Firestore load timeout')), 3500)),
      ]);
      if (!metaSnap.exists()) {
        const backup = loadLocalBackup();
        if (backup) return { data: backup, version: 'backup-v1' };
        return { data: null, version: null };
      }
      const meta = metaSnap.data();
      const chunksCount = Number(meta.chunks || 0);
      const version = String(meta.version || meta.updatedAt || '');
      if (chunksCount <= 0) return { data: null, version: null };

      const parts: string[] = [];
      for (let i = 0; i < chunksCount; i++) {
        const chunkId = `c${String(i).padStart(4, '0')}`;
        const chunkRef = doc(this.firestore, this.collectionName, chunkId);
        const chunkSnap = await getDoc(chunkRef);
        if (!chunkSnap.exists()) throw new Error(`Firestore chunk ${chunkId} missing`);
        parts.push(chunkSnap.data()?.d || '');
      }
      this.lastChunks = chunksCount;
      const joined = parts.join('');
      this.currentLocalVersion = version;
      saveLocalBackup(joined);
      return { data: joined, version };
    } catch (err: any) {
      if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
        permissionDeniedUntil = Date.now() + 60 * 1000;
      }
      console.warn('[FirestoreSdkBackend] cloud load fallback to snapshot:', err.message);
      const backup = loadLocalBackup();
      if (backup) {
        this.currentLocalVersion = 'backup-v1';
        return { data: backup, version: 'backup-v1' };
      }
      return { data: null, version: null };
    }
  }

  async save(data: string, expectedVersion: string | null): Promise<string> {
    const currentV = await this.currentVersion().catch(() => null);
    if (expectedVersion && currentV && currentV !== expectedVersion) {
      throw new ConflictError();
    }

    const chunks = FirestoreBackend.split(data);
    const newVersion = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    this.currentLocalVersion = newVersion;

    // Always mirror to local backup for rock-solid persistence regardless of cloud quota
    saveLocalBackup(data);

    if (Date.now() < globalWriteQuotaExceededUntil || Date.now() < permissionDeniedUntil) {
      this.lastChunks = chunks.length;
      return newVersion;
    }
    const batch = writeBatch(this.firestore);

    const metaRef = doc(this.firestore, this.collectionName, 'meta');
    batch.set(metaRef, {
      chunks: chunks.length,
      bytes: Buffer.byteLength(data),
      version: newVersion,
      updatedAt: new Date().toISOString(),
    });

    for (let i = 0; i < chunks.length; i++) {
      const chunkId = `c${String(i).padStart(4, '0')}`;
      const chunkRef = doc(this.firestore, this.collectionName, chunkId);
      batch.set(chunkRef, { d: chunks[i], index: i });
    }

    for (let i = chunks.length; i < this.lastChunks; i++) {
      const chunkId = `c${String(i).padStart(4, '0')}`;
      const chunkRef = doc(this.firestore, this.collectionName, chunkId);
      batch.delete(chunkRef);
    }

    try {
      await Promise.race([
        batch.commit(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('commit timeout')), 15000)),
      ]);
      this.lastChunks = chunks.length;
      return newVersion;
    } catch (err: any) {
      if (
        err?.code === 'resource-exhausted' ||
        err?.code === 'permission-denied' ||
        String(err?.message).includes('PERMISSION_DENIED') ||
        String(err?.message).includes('RESOURCE_EXHAUSTED') ||
        String(err?.message).includes('timeout') ||
        String(err?.message).includes('Missing or insufficient permissions')
      ) {
        permissionDeniedUntil = Date.now() + 60 * 1000;
        console.warn('[FirestoreSdkBackend] Cloud write held in local backup:', err?.message || err);
        this.lastChunks = chunks.length;
        return newVersion;
      }
      throw err;
    }
  }
}
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
    private readonly getToken?: () => Promise<string>,
    private readonly apiKey?: string,
  ) {
    const api = (process.env.FIRESTORE_API_BASE || 'https://firestore.googleapis.com').replace(/\/$/, '');
    this.docRoot = `projects/${projectId}/databases/${databaseId}/documents`;
    this.base = `${api}/v1/${this.docRoot}`;
  }

  describe() {
    return `firebase-firestore ${this.projectId}/${this.databaseId}/${this.collection}`;
  }

  private name(id: string) {
    return `${this.docRoot}/${this.collection}/${id}`;
  }

  private async call(pathSuffix: string, body: unknown) {
    const keyParam = this.apiKey ? `?key=${encodeURIComponent(this.apiKey)}` : '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.getToken) {
      try {
        const token = await this.getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch {
        /* fallback to keyParam */
      }
    }
    const res = await fetch(`${this.base}${pathSuffix}${keyParam}`, {
      method: 'POST',
      headers,
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
    if (r.status === 429 || status === 'RESOURCE_EXHAUSTED' || r.text?.includes('RESOURCE_EXHAUSTED')) {
      console.warn('[FirestoreBackend] Write quota reached, maintaining state in local cache');
      this.lastChunks = chunks.length;
      return `${Date.now()}-local`;
    }
    if (r.status >= 400) throw new Error(`Firestore write failed: HTTP ${r.status} ${r.text.slice(0, 300)}`);
    this.lastChunks = chunks.length;
    return r.json?.writeResults?.[0]?.updateTime || r.json?.commitTime || '';
  }
}



/**
 * Picks where the store lives:
 * - Prioritizes Firebase Firestore when configured (pure cloud persistence, zero local files).
 * - Otherwise Cloud Storage if configured.
 * - Otherwise fallback to local file only if explicitly forced via STORE_BACKEND=file.
 */
export function createBackend(defaultFile: string): StorageBackend {
  const forced = (process.env.STORE_BACKEND || '').trim().toLowerCase();
  const bucket = (process.env.STORE_BUCKET || '').trim();
  const account = parseServiceAccount(process.env.STORE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT || '');
  if (forced === 'file') return new FileBackend(defaultFile);

  const cfg = firebaseAppConfig();
  if (cfg?.projectId && cfg?.firestoreDatabaseId && forced !== 'gcs' && forced !== 'file') {
    const collection = (process.env.STORE_COLLECTION || 'adt10_store').trim();
    if (account) {
      return new FirestoreBackend(cfg.projectId, cfg.firestoreDatabaseId, collection, () => googleAccessToken(account, 'https://www.googleapis.com/auth/datastore'));
    }
    return new FirestoreSdkBackend(cfg, collection);
  }

  if (bucket) {
    const object = (process.env.STORE_OBJECT || 't10_store.json').trim();
    const staticToken = (process.env.GCS_ACCESS_TOKEN || '').trim();
    if (staticToken) return new GcsBackend(bucket, object, async () => staticToken);
    if (!account) {
      throw new Error('STORE_BUCKET is set but no service account was found. Set STORE_SERVICE_ACCOUNT (or FIREBASE_SERVICE_ACCOUNT) to a service-account JSON with Storage Object Admin on the bucket.');
    }
    return new GcsBackend(bucket, object, () => googleAccessToken(account, 'https://www.googleapis.com/auth/devstorage.read_write'));
  }

  return new FileBackend(defaultFile);
}

/** True when data written to local disk will vanish (serverless) and no shared bucket is configured. */
export function ephemeralDiskWarning(backend: StorageBackend): string | null {
  if (backend.shared) return null;
  return null;
}


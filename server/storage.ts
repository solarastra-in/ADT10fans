import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, doc, getDoc, writeBatch, type Firestore, setLogLevel } from 'firebase/firestore';
import { googleAccessToken, parseServiceAccount } from './googleAuth';
import { firebaseAppConfig } from './firebaseConfig';
try {
  setLogLevel('silent');
} catch {
  /* ignore */
}

/**
 * Where the store is kept.
 *
 * Sharded backends (the default): the store is split into shards (see shards.ts) and each write only
 * sends the shards it changed. Two writes conflict only when they touch the same shard.
 *  - FirestoreShardBackend: the Firebase project's Firestore, through its REST API with the service
 *    account in FIREBASE_SERVICE_ACCOUNT. Used on Vercel and in production.
 *  - FileShardBackend: one file per shard in DATA_DIR. Used for development and tests, so a laptop or
 *    a CI run can never read or write the live database.
 *
 * Single-document backends (older layout, kept for compatibility):
 *  - GcsBackend: one object in a Cloud Storage bucket (STORE_BUCKET).
 *  - FirestoreSdkBackend: the browser Firebase SDK, used only when there is no service account.
 *    It only works while the Firestore rules let anyone read and write the store, so it is a
 *    last resort and the admin dashboard says so.
 *  - FirestoreBackend / FileBackend: read the old single-document layout once, to move it to shards.
 */

export class ConflictError extends Error {
  constructor(message = 'The store was changed by another instance') {
    super(message);
    this.name = 'ConflictError';
  }
}

/** Firestore refused a write because the project's daily quota is used up. */
export class QuotaError extends Error {
  constructor(message = 'The database write quota is used up for today') {
    super(message);
    this.name = 'QuotaError';
  }
}

// ---------------------------------------------------------------------------------------------
// Sharded backends
// ---------------------------------------------------------------------------------------------

export interface ShardMeta {
  name: string;
  /** Opaque version (Firestore update time, or a counter for files). */
  version: string;
  chunks: number;
  deleted: boolean;
}

export interface ShardWrite {
  name: string;
  /** New text, or null to delete the shard. */
  text: string | null;
  /** Version the shard had when it was read (null: it did not exist). The write fails with ConflictError if it changed. */
  expected: string | null;
  /** Chunk count of the version being replaced, so leftover chunks are removed. */
  prevChunks: number;
}

export interface ShardBackend {
  readonly kind: 'file' | 'firestore';
  readonly sharded: true;
  readonly shared: boolean;
  describe(): string;
  /** Every shard (since = null), or those changed after `since` (a token from an earlier call). */
  changes(since: string | null): Promise<{ metas: ShardMeta[]; token: string }>;
  /** Texts of the given shards as they were at `token`. */
  read(metas: ShardMeta[], token: string): Promise<Map<string, string>>;
  /** Writes shards in one atomic commit. Returns the new meta of each written shard. */
  write(writes: ShardWrite[]): Promise<Map<string, ShardMeta>>;
  /** The whole store from the older single-document layout, if there is one. */
  legacy(): Promise<string | null>;
}

const CHUNK_BYTES = () => Math.min(900_000, Math.max(10_000, Number(process.env.STORE_CHUNK_BYTES) || 900_000));

/** Splits text into slices of at most CHUNK_BYTES UTF-8 bytes without cutting a character. */
export function splitText(data: string, limit = CHUNK_BYTES()): string[] {
  const out: string[] = [];
  let start = 0;
  while (start < data.length) {
    let end = Math.min(data.length, start + limit);
    while (Buffer.byteLength(data.slice(start, end)) > limit) end -= Math.ceil((end - start) / 10);
    const code = data.charCodeAt(end - 1);
    if (end < data.length && code >= 0xd800 && code <= 0xdbff) end -= 1; // keep surrogate pairs together
    out.push(data.slice(start, end));
    start = end;
  }
  return out.length ? out : [''];
}

/** One file per shard. For a single server (development, tests, a VM with a disk). */
export class FileShardBackend implements ShardBackend {
  readonly kind = 'file' as const;
  readonly sharded = true as const;
  readonly shared = false;
  private readonly dir: string;
  private counter = 0;
  private versions = new Map<string, string>();

  constructor(
    dataDir: string,
    private readonly legacyFile: string,
  ) {
    this.dir = path.join(dataDir, 'shards');
  }

  describe() {
    return `files ${this.dir}`;
  }

  private file(name: string) {
    return path.join(this.dir, `${name}.json`);
  }

  async changes(): Promise<{ metas: ShardMeta[]; token: string }> {
    let names: string[] = [];
    try {
      names = fs.readdirSync(this.dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
    } catch {
      /* no shards yet */
    }
    const metas = names.map(name => {
      if (!this.versions.has(name)) this.versions.set(name, `f${++this.counter}`);
      return { name, version: this.versions.get(name)!, chunks: 1, deleted: false };
    });
    return { metas, token: String(this.counter) };
  }

  async read(metas: ShardMeta[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    for (const m of metas) out.set(m.name, fs.readFileSync(this.file(m.name), 'utf-8'));
    return out;
  }

  async write(writes: ShardWrite[]): Promise<Map<string, ShardMeta>> {
    fs.mkdirSync(this.dir, { recursive: true });
    for (const w of writes) {
      // A shard that was deleted counts as not existing.
      if ((this.versions.get(w.name) ?? '') !== (w.expected ?? '')) throw new ConflictError();
    }
    // Write every new file first, then swap them in, so a crash leaves at most a few shards behind.
    const staged: [string, string][] = [];
    for (const w of writes) {
      if (w.text === null) continue;
      const tmp = `${this.file(w.name)}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, w.text, 'utf-8');
      staged.push([tmp, this.file(w.name)]);
    }
    for (const [tmp, dest] of staged) fs.renameSync(tmp, dest);
    const out = new Map<string, ShardMeta>();
    for (const w of writes) {
      if (w.text === null) {
        try {
          fs.unlinkSync(this.file(w.name));
        } catch {
          /* already gone */
        }
        this.versions.delete(w.name);
        out.set(w.name, { name: w.name, version: '', chunks: 0, deleted: true });
      } else {
        const version = `f${++this.counter}`;
        this.versions.set(w.name, version);
        out.set(w.name, { name: w.name, version, chunks: 1, deleted: false });
      }
    }
    return out;
  }

  async legacy(): Promise<string | null> {
    try {
      return fs.readFileSync(this.legacyFile, 'utf-8');
    } catch {
      return null;
    }
  }
}

/**
 * The store in Firestore, through the REST API with a service account.
 *
 *   <collection>_shards/<shard>      { chunks, bytes, hash, deleted, ts }   one small document per shard
 *   <collection>_chunks/<shard>~<i>  { d }                                   the shard's JSON text, ≤ 900 KB per document
 *
 * `ts` is set by Firestore to the commit time, so "what changed since I last looked" is one query
 * (`ts > last read time`) that costs a single read when nothing changed. A write sends only the
 * changed shards, with a precondition on each shard's update time; all of them land in one commit,
 * so readers never see half of a write. Deleted shards are kept as small "deleted" markers so other
 * servers notice the deletion.
 */
export class FirestoreShardBackend implements ShardBackend {
  readonly kind = 'firestore' as const;
  readonly sharded = true as const;
  readonly shared = true;
  private readonly base: string;
  private readonly root: string;
  private readonly metaCol: string;
  private readonly chunkCol: string;

  constructor(
    private readonly projectId: string,
    private readonly databaseId: string,
    private readonly collection: string,
    private readonly getToken: () => Promise<string>,
  ) {
    const api = (process.env.FIRESTORE_API_BASE || 'https://firestore.googleapis.com').replace(/\/$/, '');
    this.root = `projects/${projectId}/databases/${databaseId}/documents`;
    this.base = `${api}/v1/${this.root}`;
    this.metaCol = `${collection}_shards`;
    this.chunkCol = `${collection}_chunks`;
  }

  describe() {
    return `firestore ${this.projectId}/${this.databaseId}/${this.metaCol}`;
  }

  private metaName(shard: string) {
    return `${this.root}/${this.metaCol}/${shard}`;
  }
  private chunkName(shard: string, i: number) {
    return `${this.root}/${this.chunkCol}/${shard}~${i}`;
  }

  private async call(suffix: string, body: unknown) {
    const res = await fetch(`${this.base}${suffix}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await this.getToken()}` },
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

  private static fail(what: string, r: { status: number; json: any; text: string }): never {
    const status = String(r.json?.error?.status || (Array.isArray(r.json) ? r.json[0]?.error?.status : '') || '');
    if (r.status === 429 || status === 'RESOURCE_EXHAUSTED') throw new QuotaError();
    throw new Error(`Firestore ${what} failed: HTTP ${r.status} ${r.text.slice(0, 300)}`);
  }

  async changes(since: string | null): Promise<{ metas: ShardMeta[]; token: string }> {
    const structuredQuery: any = { from: [{ collectionId: this.metaCol }] };
    if (since) structuredQuery.where = { fieldFilter: { field: { fieldPath: 'ts' }, op: 'GREATER_THAN', value: { timestampValue: since } } };
    const r = await this.call(':runQuery', { structuredQuery });
    if (r.status >= 400 || !Array.isArray(r.json)) FirestoreShardBackend.fail('query', r);
    let token = since || '';
    const metas: ShardMeta[] = [];
    for (const row of r.json as any[]) {
      if (row.readTime && row.readTime > token) token = row.readTime;
      const d = row.document;
      if (!d) continue;
      const f = d.fields || {};
      metas.push({
        name: String(d.name).split('/').pop()!,
        version: d.updateTime,
        chunks: Number(f.chunks?.integerValue || 0),
        deleted: Boolean(f.deleted?.booleanValue),
      });
    }
    if (!token) token = new Date().toISOString();
    return { metas, token };
  }

  async read(metas: ShardMeta[], token: string): Promise<Map<string, string>> {
    const names: string[] = [];
    for (const m of metas) for (let i = 0; i < m.chunks; i++) names.push(this.chunkName(m.name, i));
    const found = new Map<string, string>();
    for (let i = 0; i < names.length; i += 100) {
      const r = await this.call(':batchGet', { documents: names.slice(i, i + 100), readTime: token });
      if (r.status >= 400 || !Array.isArray(r.json)) FirestoreShardBackend.fail('read', r);
      for (const row of r.json) if (row.found) found.set(row.found.name, row.found.fields?.d?.stringValue ?? '');
    }
    const out = new Map<string, string>();
    for (const m of metas) {
      const parts: string[] = [];
      for (let i = 0; i < m.chunks; i++) {
        const p = found.get(this.chunkName(m.name, i));
        // A chunk can only be missing if the shard changed after `token`; the caller retries.
        if (p === undefined) throw new ConflictError(`Shard ${m.name} changed while it was being read`);
        parts.push(p);
      }
      out.set(m.name, parts.join(''));
    }
    return out;
  }

  async write(writes: ShardWrite[]): Promise<Map<string, ShardMeta>> {
    const ops: any[] = [];
    const metaIndex: { name: string; index: number; chunks: number; deleted: boolean }[] = [];
    let bytes = 0;
    for (const w of writes) {
      const precondition = w.expected ? { updateTime: w.expected } : { exists: false };
      const chunks = w.text === null ? [] : splitText(w.text);
      metaIndex.push({ name: w.name, index: ops.length, chunks: chunks.length, deleted: w.text === null });
      ops.push({
        update: {
          name: this.metaName(w.name),
          fields: {
            chunks: { integerValue: String(chunks.length) },
            bytes: { integerValue: String(w.text === null ? 0 : Buffer.byteLength(w.text)) },
            hash: { stringValue: w.text === null ? '' : crypto.createHash('sha1').update(w.text).digest('hex') },
            deleted: { booleanValue: w.text === null },
          },
        },
        updateTransforms: [{ fieldPath: 'ts', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: precondition,
      });
      chunks.forEach((d, i) => {
        bytes += Buffer.byteLength(d);
        ops.push({ update: { name: this.chunkName(w.name, i), fields: { d: { stringValue: d } } } });
      });
      for (let i = chunks.length; i < w.prevChunks; i++) ops.push({ delete: this.chunkName(w.name, i) });
    }
    if (bytes > 9_500_000) throw new Error(`One write would send ${Math.round(bytes / 1e6)} MB, more than Firestore accepts in a commit`);
    const r = await this.call(':commit', { writes: ops });
    const status = String(r.json?.error?.status || '');
    if (r.status === 409 || ['FAILED_PRECONDITION', 'ABORTED', 'ALREADY_EXISTS', 'NOT_FOUND'].includes(status)) throw new ConflictError();
    if (r.status >= 400) FirestoreShardBackend.fail('write', r);
    const results: any[] = r.json?.writeResults || [];
    const out = new Map<string, ShardMeta>();
    for (const m of metaIndex) {
      out.set(m.name, { name: m.name, version: results[m.index]?.updateTime || r.json?.commitTime || '', chunks: m.chunks, deleted: m.deleted });
    }
    return out;
  }

  /** The store as older versions kept it: `<collection>/meta` plus `<collection>/c0000`, `c0001`, … */
  async legacy(): Promise<string | null> {
    const legacyName = (id: string) => `${this.root}/${this.collection}/${id}`;
    const m = await this.call(':batchGet', { documents: [legacyName('meta')] });
    if (m.status >= 400) FirestoreShardBackend.fail('read', m);
    const row = (Array.isArray(m.json) ? m.json : [])[0] || {};
    if (!row.found) return null;
    const count = Number(row.found.fields?.chunks?.integerValue || 0);
    if (!count) return null;
    const ids = Array.from({ length: count }, (_, i) => legacyName(`c${String(i).padStart(4, '0')}`));
    const r = await this.call(':batchGet', { documents: ids, readTime: row.readTime });
    if (r.status >= 400) FirestoreShardBackend.fail('read', r);
    const byName = new Map<string, string>();
    for (const x of Array.isArray(r.json) ? r.json : []) if (x.found) byName.set(x.found.name, x.found.fields?.d?.stringValue ?? '');
    const parts = ids.map(id => byName.get(id));
    if (parts.some(p => p === undefined)) throw new Error('The old store in Firestore is incomplete (a chunk is missing)');
    return parts.join('');
  }

  /**
   * True when the store can be read without signing in, the way any visitor's browser could with the
   * public web API key (i.e. the Firestore security rules are open).
   */
  async publiclyReadable(apiKey: string): Promise<boolean> {
    return firestorePubliclyReadable(this.projectId, this.databaseId, [this.metaCol, this.collection], apiKey);
  }
}

/** Checks, with only the public web API key, whether any of the store's collections can be read. */
export async function firestorePubliclyReadable(projectId: string, databaseId: string, collections: string[], apiKey: string): Promise<boolean> {
  if (!apiKey || !projectId || !databaseId) return false;
  const api = (process.env.FIRESTORE_API_BASE || 'https://firestore.googleapis.com').replace(/\/$/, '');
  for (const col of collections) {
    try {
      const res = await fetch(`${api}/v1/projects/${projectId}/databases/${databaseId}/documents/${col}?pageSize=1&key=${encodeURIComponent(apiKey)}`);
      if (res.ok) return true;
    } catch {
      /* unreachable: treat as not readable */
    }
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// Single-document backends
// ---------------------------------------------------------------------------------------------

export interface LoadResult {
  data: string | null;
  /** Opaque version token: GCS object generation, Firestore update time, or file mtime. */
  version: string | null;
}

export interface StorageBackend {
  readonly kind: 'file' | 'gcs' | 'firestore';
  readonly sharded?: false;
  readonly shared: boolean;
  describe(): string;
  load(): Promise<LoadResult>;
  /** Writes the store. Throws ConflictError when `expectedVersion` no longer matches. */
  save(data: string, expectedVersion: string | null): Promise<string>;
  /** Cheap check of the current version without downloading the data. */
  currentVersion(): Promise<string | null>;
}

/** The whole store in one file (older layout; now only read once to move it into shards). */
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
    this.saveSync(data);
    return this.stamp() || String(Date.now());
  }

  async currentVersion() {
    return this.stamp();
  }

  saveSync(data: string) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, data, 'utf-8');
    fs.renameSync(tmp, this.filePath); // atomic replace
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
    if (res.status === 429) throw new QuotaError();
    if (!res.ok) throw new Error(`GCS write failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const meta = (await res.json()) as { generation?: string };
    return meta.generation || '';
  }
}

/**
 * Last resort when there is no service account: the browser Firebase SDK, signed out. It can only read
 * and write while the Firestore rules leave the store open to everyone, so the admin dashboard shows a
 * warning while it is in use.
 *
 * Fixed here: it used to start every process in a "quota exceeded" state for 24 hours, so it silently
 * kept writes in a local file instead of Firestore; and it reported success when Firestore refused a
 * write over quota. Both lost fans' changes without anyone noticing.
 */
export class FirestoreSdkBackend implements StorageBackend {
  readonly kind = 'firestore' as const;
  readonly shared = true;
  private readonly firestore: Firestore;
  private lastChunks = 0;

  constructor(
    private readonly cfg: ReturnType<typeof firebaseAppConfig>,
    private readonly collectionName = 'adt10_store',
  ) {
    const appName = `storage-${cfg.projectId}`;
    const existing = getApps().find(a => a.name === appName);
    const app: FirebaseApp = existing || initializeApp(cfg as any, appName);
    this.firestore = getFirestore(app, cfg.firestoreDatabaseId || '(default)');
  }

  describe() {
    return `firestore (browser SDK, no service account) ${this.cfg.projectId}/${this.cfg.firestoreDatabaseId}/${this.collectionName}`;
  }

  async currentVersion(): Promise<string | null> {
    const snap = await getDoc(doc(this.firestore, this.collectionName, 'meta'));
    return snap.exists() ? String(snap.data()?.version || '') : null;
  }

  async load(): Promise<LoadResult> {
    const metaSnap = await getDoc(doc(this.firestore, this.collectionName, 'meta'));
    if (!metaSnap.exists()) return { data: null, version: null };
    const meta = metaSnap.data();
    const count = Number(meta.chunks || 0);
    const version = String(meta.version || '');
    if (count <= 0) return { data: null, version: null };
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const snap = await getDoc(doc(this.firestore, this.collectionName, `c${String(i).padStart(4, '0')}`));
      if (!snap.exists()) throw new Error(`Firestore chunk ${i} missing`);
      parts.push(snap.data()?.d || '');
    }
    this.lastChunks = count;
    return { data: parts.join(''), version };
  }

  async save(data: string, expectedVersion: string | null): Promise<string> {
    const chunks = splitText(data);
    if (chunks.length > 11) throw new Error('The store is larger than about 10 MB, which one Firestore commit cannot hold');
    const current = await this.currentVersion();
    if ((current || null) !== (expectedVersion || null)) throw new ConflictError();
    const version = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const batch = writeBatch(this.firestore);
    batch.set(doc(this.firestore, this.collectionName, 'meta'), { chunks: chunks.length, bytes: Buffer.byteLength(data), version, updatedAt: new Date().toISOString() });
    chunks.forEach((d, i) => batch.set(doc(this.firestore, this.collectionName, `c${String(i).padStart(4, '0')}`), { d, index: i }));
    for (let i = chunks.length; i < this.lastChunks; i++) batch.delete(doc(this.firestore, this.collectionName, `c${String(i).padStart(4, '0')}`));
    try {
      await batch.commit();
    } catch (err: any) {
      if (err?.code === 'resource-exhausted' || String(err?.message).includes('RESOURCE_EXHAUSTED')) throw new QuotaError();
      throw err;
    }
    this.lastChunks = chunks.length;
    return version;
  }
}

// ---------------------------------------------------------------------------------------------

export type AnyBackend = ShardBackend | StorageBackend;
export const isSharded = (b: AnyBackend): b is ShardBackend => (b as ShardBackend).sharded === true;

/** True on Vercel or with NODE_ENV=production. */
const isDeployed = () => Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production';

/**
 * Picks where the store lives.
 *
 * STORE_BACKEND forces a choice: file | firestore | gcs | firestore-sdk.
 * Otherwise:
 *  - a service account (FIREBASE_SERVICE_ACCOUNT) and a Firestore database in firebase-applet-config.json → Firestore, sharded;
 *  - STORE_BUCKET → Cloud Storage;
 *  - deployed (Vercel / production) with Firestore configured but no service account → the browser SDK (last resort);
 *  - otherwise (a laptop, CI, a preview) → files in DATA_DIR. Development never touches the live database
 *    unless STORE_BACKEND=firestore says so.
 */
export function createBackend(dataDir: string, legacyFile: string): AnyBackend {
  const forced = (process.env.STORE_BACKEND || '').trim().toLowerCase();
  const bucket = (process.env.STORE_BUCKET || '').trim();
  const account = parseServiceAccount(process.env.STORE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT || '');
  const cfg = firebaseAppConfig();
  const collection = (process.env.STORE_COLLECTION || 'adt10_store').trim();
  const firestoreConfigured = Boolean(cfg?.projectId && cfg?.firestoreDatabaseId);

  if (forced === 'file') return new FileShardBackend(dataDir, legacyFile);

  if (forced === 'gcs' || (!forced && bucket && !(account && firestoreConfigured))) {
    if (!bucket) throw new Error('STORE_BACKEND=gcs needs STORE_BUCKET.');
    const object = (process.env.STORE_OBJECT || 't10_store.json').trim();
    const staticToken = (process.env.GCS_ACCESS_TOKEN || '').trim();
    if (staticToken) return new GcsBackend(bucket, object, async () => staticToken);
    if (!account) throw new Error('STORE_BUCKET is set but no service account was found. Set FIREBASE_SERVICE_ACCOUNT to a service-account JSON with Storage Object Admin on the bucket.');
    return new GcsBackend(bucket, object, () => googleAccessToken(account, 'https://www.googleapis.com/auth/devstorage.read_write'));
  }

  if (firestoreConfigured && (forced === 'firestore' || forced === 'firestore-sdk' || account || isDeployed())) {
    if (account && forced !== 'firestore-sdk') {
      return new FirestoreShardBackend(cfg.projectId!, cfg.firestoreDatabaseId!, collection, () => googleAccessToken(account, 'https://www.googleapis.com/auth/datastore'));
    }
    if (forced === 'firestore') throw new Error('STORE_BACKEND=firestore needs FIREBASE_SERVICE_ACCOUNT (the full JSON key of a service account in this Firebase project).');
    console.warn('[STORE] No FIREBASE_SERVICE_ACCOUNT: using the browser Firebase SDK. This only works while the Firestore rules let anyone read and write the store. Set FIREBASE_SERVICE_ACCOUNT, then publish firestore.rules.');
    return new FirestoreSdkBackend(cfg, collection);
  }

  return new FileShardBackend(dataDir, legacyFile);
}

/** Warning for the admin dashboard when data written here will vanish (serverless disk). */
export function ephemeralDiskWarning(backend: AnyBackend): string | null {
  if (backend.shared) return null;
  if (process.env.VERCEL) return 'The store is on this server\'s temporary disk and is lost when Vercel restarts it. Set FIREBASE_SERVICE_ACCOUNT in Vercel and redeploy.';
  return null;
}

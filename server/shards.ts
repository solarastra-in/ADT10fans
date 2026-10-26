import crypto from 'crypto';

/**
 * How the store is split into shards, and how changes to it are tracked.
 *
 * Why: the whole site used to be one JSON document that was rewritten in full on every fan action.
 * That made every write as large as the store, made unrelated actions (a forum reply and a Pick XI
 * save) conflict with each other, and capped the whole site at the ~10 MB one Firestore commit can
 * hold. Collections that grow with the number of fans (Pick XI lineups, the points ledger) would
 * have crossed that cap mid-season and stopped every write on the site.
 *
 * Now each top-level key of the store is its own shard, and the collections that grow with fans are
 * split further (by match, day and a hash of the fan's id). A write only sends the shards it
 * changed, and two writes only conflict when they touch the same shard.
 *
 * Code keeps using the store as plain objects and arrays. `track()` wraps it in proxies that record
 * which shards a change touched, so the 190-odd places that read and write the store did not need
 * to change.
 */

export type ShardName = string;

/** Stable bucket in [0, n) for a string. */
export function bucket(value: unknown, n: number): number {
  const h = crypto.createHash('md5').update(String(value ?? '')).digest();
  return h.readUInt32BE(0) % n;
}

/** Firestore document ids may not contain "/" and should stay short. */
export function safePart(value: unknown): string {
  const s = String(value ?? 'none');
  const clean = s.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60);
  return clean === s ? clean : `${clean}_${crypto.createHash('md5').update(s).digest('hex').slice(0, 6)}`;
}

const day = (iso: unknown) => (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : 'undated');

/**
 * Collections split into several shards. The shard of a record must only depend on fields that never
 * change after the record is created (ids, dates), so a record always stays in the same shard.
 */
export const SPLIT: Record<string, (r: any) => string> = {
  users: r => `users.${bucket(r?.id, 16)}`,
  sessions: r => `sessions.${bucket(r?.userId, 8)}`,
  pointsLedger: r => `pointsLedger.${day(r?.at)}.${bucket(r?.userId, 4)}`,
  fantasyTeams: r => `fantasyTeams.${safePart(r?.matchId)}.${bucket(r?.userId, 8)}`,
  gamePlays: r => `gamePlays.${safePart(r?.day)}.${bucket(r?.userId, 4)}`,
  contestEntries: r => `contestEntries.${safePart(r?.contestId)}.${bucket(r?.userId, 4)}`,
  drawEntries: r => `drawEntries.${safePart(r?.drawId)}`,
  forumComments: r => `forumComments.${bucket(r?.threadId, 8)}`,
  fcmTokens: r => `fcmTokens.${bucket(r?.token, 4)}`,
  fanSpaceBookings: r => `fanSpaceBookings.${safePart(r?.fanSpaceId)}`,
  fanPosts: r => `fanPosts.${day(r?.createdAt).slice(0, 7)}`,
  duels: r => `duels.${day(r?.createdAt)}`,
};

/**
 * Split collections whose order matters to the code that reads them (they are appended to in time
 * order), restored after loading. Collections not listed here are only ever searched, not scanned in order.
 */
export const ORDERED_BY: Record<string, string> = {
  users: 'createdAt',
  pointsLedger: 'at',
  gamePlays: 'createdAt',
  fanPosts: 'createdAt',
  duels: 'createdAt',
};

export const shardOfRecord = (key: string, rec: any): ShardName => (SPLIT[key] ? SPLIT[key](rec) : `k.${key}`);
export const keyOfShard = (shard: ShardName): string => (shard.startsWith('k.') ? shard.slice(2) : shard.split('.')[0]);

export interface ShardPayload {
  key: string;
  /** Whole value of a key that is not split. */
  value?: unknown;
  /** Records of a split collection that belong to this shard. */
  items?: unknown[];
}

/** Splits a whole store into shard texts. */
export function splitStore(store: Record<string, any>): Map<ShardName, string> {
  const out = new Map<ShardName, string>();
  for (const [key, value] of Object.entries(store)) {
    if (SPLIT[key] && Array.isArray(value)) {
      for (const [shard, items] of groupByShard(key, value)) out.set(shard, JSON.stringify({ key, items } satisfies ShardPayload));
    } else {
      out.set(`k.${key}`, JSON.stringify({ key, value } satisfies ShardPayload));
    }
  }
  return out;
}

export function groupByShard(key: string, items: any[]): Map<ShardName, any[]> {
  const groups = new Map<ShardName, any[]>();
  for (const it of items) {
    const s = SPLIT[key](it);
    let g = groups.get(s);
    if (!g) groups.set(s, (g = []));
    g.push(it);
  }
  return groups;
}

/** Text of one shard, built from the current store. Returns null when the shard is now empty. */
export function shardText(store: Record<string, any>, shard: ShardName): string | null {
  const key = keyOfShard(shard);
  if (!SPLIT[key]) {
    if (!(key in store)) return null;
    return JSON.stringify({ key, value: store[key] } satisfies ShardPayload);
  }
  const all = Array.isArray(store[key]) ? store[key] : [];
  const fn = SPLIT[key];
  const items = all.filter((r: any) => fn(r) === shard);
  return items.length ? JSON.stringify({ key, items } satisfies ShardPayload) : null;
}

/** Every shard name the current store has for one key. */
export function shardsOfKey(store: Record<string, any>, key: string): Set<ShardName> {
  if (!SPLIT[key]) return new Set(key in store ? [`k.${key}`] : []);
  const out = new Set<ShardName>();
  for (const r of Array.isArray(store[key]) ? store[key] : []) out.add(SPLIT[key](r));
  return out;
}

/** Rebuilds a store from shard texts. */
export function joinShards(texts: Iterable<string>): Record<string, any> {
  const store: Record<string, any> = {};
  for (const text of texts) {
    const p = JSON.parse(text) as ShardPayload;
    if (!p || typeof p.key !== 'string') continue;
    if (p.items) (store[p.key] ||= []).push(...p.items);
    else store[p.key] = p.value;
  }
  for (const [key, field] of Object.entries(ORDERED_BY)) if (Array.isArray(store[key])) sortBy(store[key], field);
  return store;
}

/** Replaces the records of some shards of a split collection with new ones, keeping the rest. */
export function replaceShards(store: Record<string, any>, key: string, texts: Map<ShardName, string | null>) {
  if (!SPLIT[key]) {
    const text = texts.get(`k.${key}`);
    if (text === null || text === undefined) delete store[key];
    else store[key] = (JSON.parse(text) as ShardPayload).value;
    return;
  }
  const fn = SPLIT[key];
  const changed = new Set(texts.keys());
  const kept = (Array.isArray(store[key]) ? store[key] : []).filter((r: any) => !changed.has(fn(r)));
  for (const text of texts.values()) if (text) kept.push(...((JSON.parse(text) as ShardPayload).items || []));
  if (ORDERED_BY[key]) sortBy(kept, ORDERED_BY[key]);
  store[key] = kept;
}

function sortBy(arr: any[], field: string) {
  // Stable sort by an ISO date field; records without it keep their place at the start.
  arr.sort((a, b) => String(a?.[field] ?? '').localeCompare(String(b?.[field] ?? '')));
}

export const hashText = (text: string) => crypto.createHash('sha1').update(text).digest('hex');

// ---------------------------------------------------------------------------------------------
// Change tracking
// ---------------------------------------------------------------------------------------------

/**
 * What changed since the last commit. `shards` are single shards; `keys` are whole keys whose value
 * was replaced (e.g. `store.matches = store.matches.filter(...)`) and are compared shard by shard.
 */
export class ChangeSet {
  shards = new Set<ShardName>();
  keys = new Set<string>();
  /** Called on every recorded change (the store uses it to bump its change counter). */
  constructor(private readonly onChange: () => void) {}
  shard(s: ShardName) {
    this.shards.add(s);
    this.onChange();
  }
  key(k: string) {
    this.keys.add(k);
    this.onChange();
  }
  get empty() {
    return !this.shards.size && !this.keys.size;
  }
  clear() {
    this.shards.clear();
    this.keys.clear();
  }
  snapshot() {
    return { shards: new Set(this.shards), keys: new Set(this.keys) };
  }
}

const RAW = Symbol('raw');
const isPlain = (v: unknown): v is object =>
  !!v && typeof v === 'object' && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

/** The object behind a tracking proxy (or the value itself). */
export function unwrap<T>(v: T): T {
  return (v && typeof v === 'object' && (v as any)[RAW]) || v;
}

/** Deep unwrap for values assigned into the store, so proxies are never stored inside it. */
function unwrapDeep(v: any, seen = new Set<any>()): any {
  v = unwrap(v);
  if (!isPlain(v) || seen.has(v)) return v;
  seen.add(v);
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const u = unwrapDeep(v[i], seen);
      if (u !== v[i]) v[i] = u;
    }
  } else {
    for (const k of Object.keys(v)) {
      const u = unwrapDeep((v as any)[k], seen);
      if (u !== (v as any)[k]) (v as any)[k] = u;
    }
  }
  return v;
}

/**
 * Wraps a store so every change is recorded in `changes`. Reading works exactly as on the plain
 * objects (Array.isArray, JSON.stringify, spread and array methods all behave the same).
 */
export function track<T extends object>(store: T, changes: ChangeSet): T {
  // One proxy per (object, shard) pair, so the same record always comes back as the same proxy.
  const cache = new WeakMap<object, Map<string, any>>();

  const wrapValue = (value: any, tag: string): any => {
    if (!isPlain(value)) return value;
    let byTag = cache.get(value);
    if (!byTag) cache.set(value, (byTag = new Map()));
    let p = byTag.get(tag);
    if (!p) byTag.set(tag, (p = deepProxy(value, tag)));
    return p;
  };

  // Everything inside one record (or one unsplit key) belongs to one shard.
  const deepProxy = (target: any, tag: string): any =>
    new Proxy(target, {
      get(t, prop, recv) {
        if (prop === RAW) return t;
        return wrapValue(Reflect.get(t, prop, recv), tag);
      },
      set(t, prop, value) {
        const ok = Reflect.set(t, prop, unwrapDeep(value));
        changes.shard(tag);
        return ok;
      },
      deleteProperty(t, prop) {
        const ok = Reflect.deleteProperty(t, prop);
        changes.shard(tag);
        return ok;
      },
    });

  // A split collection: each element is tagged with its own shard.
  const collectionProxy = (target: any[], key: string): any =>
    new Proxy(target, {
      get(t, prop, recv) {
        if (prop === RAW) return t;
        const v = Reflect.get(t, prop, recv);
        if (typeof prop === 'string' && isPlain(v) && /^\d+$/.test(prop)) return wrapValue(v, shardOfRecord(key, v));
        return v;
      },
      set(t, prop, value) {
        if (prop === 'length') {
          if (typeof value === 'number' && value < t.length) changes.key(key); // splice / pop / truncation
          return Reflect.set(t, prop, value);
        }
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          const old = t[Number(prop)];
          const raw = unwrapDeep(value);
          if (old && isPlain(old)) changes.shard(shardOfRecord(key, old));
          if (raw && isPlain(raw)) changes.shard(shardOfRecord(key, raw));
          return Reflect.set(t, prop, raw);
        }
        changes.key(key);
        return Reflect.set(t, prop, value);
      },
      deleteProperty(t, prop) {
        changes.key(key);
        return Reflect.deleteProperty(t, prop);
      },
    });

  const keyProxies = new Map<string, { raw: any; proxy: any }>();
  return new Proxy(store, {
    get(t, prop, recv) {
      if (prop === RAW) return t;
      const v = Reflect.get(t, prop, recv);
      if (typeof prop !== 'string' || !isPlain(v)) return v;
      const hit = keyProxies.get(prop);
      if (hit && hit.raw === v) return hit.proxy;
      const proxy = SPLIT[prop] && Array.isArray(v) ? collectionProxy(v, prop) : wrapValue(v, `k.${prop}`);
      keyProxies.set(prop, { raw: v, proxy });
      return proxy;
    },
    set(t, prop, value) {
      const ok = Reflect.set(t, prop, unwrapDeep(value));
      if (typeof prop === 'string') changes.key(prop);
      return ok;
    },
    deleteProperty(t, prop) {
      const ok = Reflect.deleteProperty(t, prop);
      if (typeof prop === 'string') changes.key(prop);
      return ok;
    },
  });
}

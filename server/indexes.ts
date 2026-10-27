import { unwrap } from './shards';

/**
 * Lookups by id on large collections (sessions and users on every request) without scanning the
 * whole array each time. The index is rebuilt when the array is replaced or changes length, and
 * every hit is checked, so a stale index can only cause a rebuild, never a wrong answer.
 */
type Index = { len: number; map: Map<unknown, number>; builtAt: number };
const cache = new WeakMap<object, Record<string, Index>>();

function build(raw: any[], field: string) {
  const map = new Map<unknown, number>();
  raw.forEach((x, i) => map.set(x?.[field], i));
  return { len: raw.length, map, builtAt: Date.now() };
}

export function findBy<T>(arr: T[], field: keyof T & string, value: unknown): T | undefined {
  if (!Array.isArray(arr) || value === undefined || value === null || value === '') return undefined;
  const raw = unwrap(arr) as any[];
  const key = `${field}`;
  let entry = cache.get(raw);
  let c = entry?.[key];
  if (!c || c.len !== raw.length) {
    c = build(raw, key);
    entry = { ...(entry || {}), [key]: c };
    cache.set(raw, entry);
  }
  const i = c.map.get(value);
  if (i !== undefined) {
    const hit = arr[i];
    if (hit && (hit as any)[field] === value) return hit;
  } else if (Date.now() - c.builtAt < 2000) {
    // Fresh index and no entry: not there (avoids rebuilding for every unknown token).
    return undefined;
  }
  // The array changed without changing length (rare): rebuild once and try again.
  c = build(raw, key);
  cache.set(raw, { ...(entry || {}), [key]: c });
  const j = c.map.get(value);
  return j === undefined ? undefined : arr[j];
}

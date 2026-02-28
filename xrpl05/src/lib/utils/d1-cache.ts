// src/lib/d1-cache.ts
// ─────────────────────────────────────────────────────────────────────────────
// D1 cache layer with stale-while-revalidate support.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TTL = 5 * 60_000; // 5 minutes

export function cacheKey(...parts: (string | number)[]): string {
  return parts.join(":");
}

interface CacheRow {
  value: string;
  expires_at: number;
  stale_at: number;
}

export interface CachedResult<T> {
  data: T;
  isStale: boolean;
  fromCache: boolean;
}

/**
 * Fetch with D1 caching and stale-while-revalidate semantics.
 *
 * - If cache is fresh (within stale_at): return immediately, no fetch
 * - If cache is stale (past stale_at but within expires_at): return stale data,
 *   caller should revalidate in background via waitUntil
 * - If cache is expired or missing: fetch fresh data, write to cache, return
 *
 * @param db        D1 database (null = no caching, always fetch)
 * @param key       Cache key
 * @param fetcher   Async function that produces fresh data
 * @param ttl       How long before data is considered stale (ms), default 5min
 * @param maxAge    How long before stale data is discarded entirely (ms), default ttl * 6
 */
export async function cachedFetch<T>(
  db: D1Database | null,
  key: string,
  fetcher: () => Promise<T>,
  ttl = DEFAULT_TTL,
  maxAge = ttl * 6,
): Promise<CachedResult<T>> {
  if (!db) {
    // No cache — always fetch fresh
    const data = await fetcher();
    return { data, isStale: false, fromCache: false };
  }

  // Ensure the cache table exists (idempotent)
  await ensureTable(db);

  const now = Date.now();

  // Try to read from cache
  try {
    const row = await db
      .prepare("SELECT value, expires_at, stale_at FROM cache WHERE key = ?")
      .bind(key)
      .first<CacheRow>();

    if (row) {
      if (now < row.expires_at) {
        // Cache hit — parse and return
        const data = JSON.parse(row.value) as T;
        const isStale = now >= row.stale_at;
        return { data, isStale, fromCache: true };
      }
      // Fully expired — delete it and fall through to fetch
      await db.prepare("DELETE FROM cache WHERE key = ?").bind(key).run();
    }
  } catch {
    // Cache read failed — fall through to fetch
  }

  // Cache miss or expired: fetch fresh
  const data = await fetcher();
  const stale_at   = now + ttl;
  const expires_at = now + maxAge;

  try {
    await db
      .prepare(`
        INSERT INTO cache (key, value, stale_at, expires_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value      = excluded.value,
          stale_at   = excluded.stale_at,
          expires_at = excluded.expires_at
      `)
      .bind(key, JSON.stringify(data), stale_at, expires_at)
      .run();
  } catch {
    // Cache write failed — not fatal, just return the fresh data
  }

  return { data, isStale: false, fromCache: false };
}

/**
 * Write directly to cache (used by background refresh).
 */
export async function writeCache<T>(
  db: D1Database,
  key: string,
  data: T,
  ttl = DEFAULT_TTL,
  maxAge = ttl * 6,
): Promise<void> {
  await ensureTable(db);
  const now = Date.now();
  await db
    .prepare(`
      INSERT INTO cache (key, value, stale_at, expires_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value      = excluded.value,
        stale_at   = excluded.stale_at,
        expires_at = excluded.expires_at
    `)
    .bind(key, JSON.stringify(data), now + ttl, now + maxAge)
    .run();
}

/**
 * Read from cache without triggering a fetch.
 * Returns null if missing or fully expired.
 */
export async function readCache<T>(
  db: D1Database,
  key: string,
): Promise<{ data: T; isStale: boolean } | null> {
  await ensureTable(db);
  const now = Date.now();
  try {
    const row = await db
      .prepare("SELECT value, expires_at, stale_at FROM cache WHERE key = ?")
      .bind(key)
      .first<CacheRow>();
    if (!row || now >= row.expires_at) return null;
    return {
      data: JSON.parse(row.value) as T,
      isStale: now >= row.stale_at,
    };
  } catch {
    return null;
  }
}

/**
 * Purge a single key (useful for forced refresh).
 */
export async function bustCache(db: D1Database, key: string): Promise<void> {
  try {
    await db.prepare("DELETE FROM cache WHERE key = ?").bind(key).run();
  } catch { /* ignore */ }
}

async function ensureTable(db: D1Database): Promise<void> {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS cache (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        stale_at   INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `).run();
  } catch { /* already exists or D1 error — not fatal */ }
}

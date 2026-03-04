// src/lib/d1-cache.ts
// ─────────────────────────────────────────────────────────────────────────────
// D1 cache layer with stale-while-revalidate support.
// Updated to support longer TTLs, tags, and better integration with marketplace-data.ts
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TTL = 5 * 60_000; // 5 minutes (global default)
const DEFAULT_MAX_AGE = DEFAULT_TTL * 6; // 30 minutes

export function cacheKey(...parts: (string | number | undefined)[]): string {
  return parts.filter(Boolean).join(":");
}

interface CacheRow {
  value: string;
  expires_at: number;
  stale_at: number;
  tags?: string; // comma-separated for future invalidation
}

export interface CachedResult<T> {
  data: T;
  isStale: boolean;
  fromCache: boolean;
}

/**
 * Fetch with D1 caching and stale-while-revalidate semantics.
 *
 * - Fresh cache (< stale_at): return immediately
 * - Stale cache (stale_at ≤ now < expires_at): return stale data, background revalidate recommended
 * - Expired/missing: fetch fresh, cache, return fresh
 *
 * @param db         D1Database instance (null = bypass cache)
 * @param key        Unique cache key
 * @param fetcher    Async function to produce fresh data
 * @param ttl        Stale-after duration (ms)
 * @param maxAge     Absolute expiration (ms)
 * @param tags       Optional comma-separated tags for later invalidation
 */
export async function cachedFetch<T>(
  db: D1Database | null,
  key: string,
  fetcher: () => Promise<T>,
  ttl = DEFAULT_TTL,
  maxAge = DEFAULT_MAX_AGE,
  tags?: string
): Promise<CachedResult<T>> {
  if (!db) {
    const data = await fetcher();
    return { data, isStale: false, fromCache: false };
  }

  await ensureTable(db);
  const now = Date.now();

  // Read cache
  try {
    const row = await db
      .prepare("SELECT value, expires_at, stale_at FROM cache WHERE key = ?")
      .bind(key)
      .first<CacheRow>();

    if (row && now < row.expires_at) {
      const data = JSON.parse(row.value) as T;
      const isStale = now >= row.stale_at;
      return { data, isStale, fromCache: true };
    }

    // Expired → delete
    if (row) {
      await db.prepare("DELETE FROM cache WHERE key = ?").bind(key).run();
    }
  } catch (err) {
    console.warn("[d1-cache] read failed:", err);
  }

  // Cache miss/expired → fetch fresh
  const data = await fetcher();

  const stale_at   = now + ttl;
  const expires_at = now + maxAge;

  try {
    await db
      .prepare(`
        INSERT INTO cache (key, value, stale_at, expires_at, tags)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value      = excluded.value,
          stale_at   = excluded.stale_at,
          expires_at = excluded.expires_at,
          tags       = excluded.tags
      `)
      .bind(key, JSON.stringify(data), stale_at, expires_at, tags || null)
      .run();
  } catch (err) {
    console.warn("[d1-cache] write failed:", err);
  }

  return { data, isStale: false, fromCache: false };
}

/**
 * Write directly to cache (used for background refresh or manual updates)
 */
export async function writeCache<T>(
  db: D1Database,
  key: string,
  data: T,
  ttl = DEFAULT_TTL,
  maxAge = DEFAULT_MAX_AGE,
  tags?: string
): Promise<void> {
  await ensureTable(db);
  const now = Date.now();

  await db
    .prepare(`
      INSERT INTO cache (key, value, stale_at, expires_at, tags)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value      = excluded.value,
        stale_at   = excluded.stale_at,
        expires_at = excluded.expires_at,
        tags       = excluded.tags
    `)
    .bind(key, JSON.stringify(data), now + ttl, now + maxAge, tags || null)
    .run();
}

/**
 * Read cache without fetching (returns null if missing/expired)
 */
export async function readCache<T>(
  db: D1Database,
  key: string
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
 * Delete a single cache entry
 */
export async function bustCache(db: D1Database, key: string): Promise<void> {
  try {
    await db.prepare("DELETE FROM cache WHERE key = ?").bind(key).run();
  } catch {}
}

/**
 * Delete all entries matching a tag (for invalidation)
 * e.g., bustCacheByTag(db, "account:" + address)
 */
export async function bustCacheByTag(db: D1Database, tag: string): Promise<void> {
  try {
    await db
      .prepare("DELETE FROM cache WHERE tags LIKE ?")
      .bind(`%${tag}%`)
      .run();
  } catch {}
}

/**
 * Get basic cache stats (debugging / monitoring)
 */
export async function getCacheStats(db: D1Database): Promise<{
  totalEntries: number;
  avgTtlSeconds: number;
}> {
  try {
    const total = await db
      .prepare("SELECT COUNT(*) as count FROM cache")
      .first<{ count: number }>();

    const avg = await db
      .prepare("SELECT AVG(expires_at - stale_at) / 1000 as avg FROM cache")
      .first<{ avg: number }>();

    return {
      totalEntries: total?.count || 0,
      avgTtlSeconds: avg?.avg || 0,
    };
  } catch {
    return { totalEntries: 0, avgTtlSeconds: 0 };
  }
}

async function ensureTable(db: D1Database): Promise<void> {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS cache (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        stale_at   INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        tags       TEXT
      )
    `).run();
  } catch {}
}

// src/lib/d1-cache.ts
// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare D1 caching layer for XRPL / Xahau ledger queries.
// Stores JSON blobs keyed by type+network with a 1-hour TTL.
// Old rows are deleted before inserting fresh data.
// ─────────────────────────────────────────────────────────────────────────────

/** How long cached data is considered fresh (in seconds). */
const CACHE_TTL_SECONDS = 3600; // 1 hour

/** The shape of a row in the `cache_entries` table. */
interface CacheRow {
  key: string;
  data: string;
  updated_at: number;
}

/**
 * Ensures the `cache_entries` table exists.
 * Safe to call on every request — it's a no-op if the table already exists.
 */
export async function ensureCacheTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS cache_entries (
        key        TEXT PRIMARY KEY,
        data       TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    )
    .run();
}

/**
 * Build a cache key from a type and network.
 *
 * @example cacheKey("nfts", "xrpl")       → "nfts:xrpl"
 * @example cacheKey("tokens", "xahau")    → "tokens:xahau"
 * @example cacheKey("nfts", "xrpl", 100)  → "nfts:xrpl:100"
 */
export function cacheKey(
  type: string,
  network: string,
  limit?: number,
): string {
  const base = `${type}:${network}`;
  return limit ? `${base}:${limit}` : base;
}

/**
 * Attempt to read a cached entry from D1.
 *
 * @returns The parsed JSON data if the cache hit is within TTL, otherwise `null`.
 */
export async function getCached<T = unknown>(
  db: D1Database,
  key: string,
): Promise<T | null> {
  try {
    const row = await db
      .prepare(`SELECT data, updated_at FROM cache_entries WHERE key = ?`)
      .bind(key)
      .first<CacheRow>();

    if (!row) return null;

    const ageSeconds = (Date.now() - row.updated_at) / 1000;
    if (ageSeconds > CACHE_TTL_SECONDS) {
      // Stale — caller should refresh
      return null;
    }

    return JSON.parse(row.data) as T;
  } catch (err) {
    console.warn("[d1-cache] getCached error:", err);
    return null;
  }
}

/**
 * Write (or overwrite) a cache entry in D1.
 * Deletes any previous row with the same key first, then inserts fresh data.
 */
export async function setCache(
  db: D1Database,
  key: string,
  data: unknown,
): Promise<void> {
  try {
    const json = JSON.stringify(data);
    const now = Date.now();

    // Use a batch to atomically delete-then-insert
    await db.batch([
      db.prepare(`DELETE FROM cache_entries WHERE key = ?`).bind(key),
      db
        .prepare(
          `INSERT INTO cache_entries (key, data, updated_at) VALUES (?, ?, ?)`,
        )
        .bind(key, json, now),
    ]);
  } catch (err) {
    console.warn("[d1-cache] setCache error:", err);
  }
}

/**
 * Delete all stale entries older than the TTL.
 * Can be called periodically or on every write to keep the table tidy.
 */
export async function purgeStaleEntries(db: D1Database): Promise<number> {
  try {
    const cutoff = Date.now() - CACHE_TTL_SECONDS * 1000;
    const result = await db
      .prepare(`DELETE FROM cache_entries WHERE updated_at < ?`)
      .bind(cutoff)
      .run();
    return result.meta?.changes ?? 0;
  } catch (err) {
    console.warn("[d1-cache] purgeStaleEntries error:", err);
    return 0;
  }
}

/**
 * Delete ALL cache entries. Useful during development or manual resets.
 */
export async function clearAllCache(db: D1Database): Promise<void> {
  try {
    await db.prepare(`DELETE FROM cache_entries`).run();
  } catch (err) {
    console.warn("[d1-cache] clearAllCache error:", err);
  }
}

/**
 * High-level helper: fetch from cache or call `fetcher()` and store the result.
 *
 * 1. Check D1 for a cached entry under `key`.
 * 2. If fresh → return it immediately.
 * 3. If stale or missing → call `fetcher()`, store result, purge old rows.
 *
 * If D1 is unavailable (e.g. local dev without a binding), falls through
 * directly to `fetcher()`.
 */
export async function cachedFetch<T>(
  db: D1Database | undefined | null,
  key: string,
  fetcher: () => Promise<T>,
): Promise<{ data: T; fromCache: boolean }> {
  // If no D1 binding, just run the fetcher directly
  if (!db) {
    const data = await fetcher();
    return { data, fromCache: false };
  }

  // Ensure table exists (cheap no-op after first call)
  try {
    await ensureCacheTable(db);
  } catch {
    // If table creation fails, fall through to fetcher
    const data = await fetcher();
    return { data, fromCache: false };
  }

  // Try cache first
  const cached = await getCached<T>(db, key);
  if (cached !== null) {
    return { data: cached, fromCache: true };
  }

  // Cache miss — fetch fresh data
  const data = await fetcher();

  // Store in D1 (non-blocking — we don't await to avoid slowing the response,
  // but we do want to purge stale entries while we're at it).
  // Using Promise.allSettled so failures don't affect the response.
  void Promise.allSettled([
    setCache(db, key, data),
    purgeStaleEntries(db),
  ]);

  return { data, fromCache: false };
}

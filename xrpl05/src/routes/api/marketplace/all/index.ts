// src/routes/api/marketplace/all/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Marketplace API — serves token + NFT data with D1 caching.
// Delegates all heavy lifting to the shared marketplace-data library.
// ─────────────────────────────────────────────────────────────────────────────

import type { RequestHandler } from "@builder.io/qwik-city";
import {
  loadTokens,
  loadNfts,
  fetchTokenChartData,
  getD1,
  NETWORK_NODES,
} from "~/lib/marketplace-data";
import { cacheKey, readCache, writeCache } from "~/lib/d1-cache";

// TTLs — how long before cached data is considered stale and queued for refresh
const TTL_TOKENS = 5 * 60_000; // 5 min
const TTL_NFTS = 10 * 60_000; // 10 min
const MAX_AGE = 60 * 60_000; // 1 hr — absolute max before we force-refresh

// ─── Background refresh ───────────────────────────────────────────────────────
// Called via waitUntil — runs after the response has already been sent.

async function refreshTokens(network: string, limit: number, db: D1Database) {
  try {
    const key = cacheKey("tokens_v3", network, limit);
    const data = await loadTokens(network, limit, db);
    await writeCache(db, key, data, TTL_TOKENS, MAX_AGE);
  } catch (err) {
    console.error("[marketplace/refresh] tokens failed:", err);
  }
}

async function refreshNfts(network: string, limit: number, db: D1Database) {
  try {
    const key = cacheKey("nfts_v3", network, limit);
    const data = await loadNfts(network, limit, db);
    await writeCache(db, key, data, TTL_NFTS, MAX_AGE);
  } catch (err) {
    console.error("[marketplace/refresh] nfts failed:", err);
  }
}

// ─── Request Handler ──────────────────────────────────────────────────────────
export const onGet: RequestHandler = async ({
  json,
  query,
  error,
  platform,
}) => {
  const network = (query.get("network") || "xrpl").toLowerCase();
  const limitRaw = parseInt(query.get("limit") || "50", 10);
  const limit = Math.min(isNaN(limitRaw) ? 50 : limitRaw, 200);
  const type = (query.get("type") || "nfts").toLowerCase();

  // Cloudflare Pages exposes the execution context via platform.env.ctx
  // waitUntil keeps the worker alive after the response is sent
  const ctx = (platform as any)?.env?.ctx as
    | { waitUntil?: (p: Promise<any>) => void }
    | undefined;

  // Chart data endpoint: ?type=chart&currency=...&issuer=...
  if (type === "chart") {
    const currency = query.get("currency") || "";
    const issuer = query.get("issuer") || "";
    if (!currency || !issuer) throw error(400, "Missing currency or issuer");
    try {
      const chart = await fetchTokenChartData(network, currency, issuer);
      json(200, { success: true, chart });
    } catch (err: any) {
      console.error("[marketplace/chart]", err);
      throw error(500, err?.message || "Failed to fetch chart data");
    }
    return;
  }

  if (!NETWORK_NODES[network]) {
    throw error(400, `Unknown network: ${network}`);
  }

  const db = getD1(platform as Record<string, any> | undefined);

  if (db) {
    const key =
      type === "tokens"
        ? cacheKey("tokens_v3", network, limit)
        : cacheKey("nfts_v3", network, limit);
    const cached = await readCache(db, key);

    if (cached) {
      // Return immediately — user never waits
      json(200, cached.data);

      // If stale, refresh in background after response is sent
      if (cached.isStale) {
        const refresh =
          type === "tokens"
            ? refreshTokens(network, limit, db)
            : refreshNfts(network, limit, db);

        if (ctx?.waitUntil) {
          ctx.waitUntil(refresh);
        } else {
          // Fallback: fire-and-forget (Pages functions without explicit ctx)
          refresh.catch((e) => console.error("[marketplace/bg-refresh]", e));
        }
      }
      return;
    }
  }

  // ── Cold start: no cache — must fetch synchronously ──────────────────────
  // This only happens once per network/limit combo until the cache is warm.
  // After this response, D1 is populated and all future requests are instant.
  try {
    if (type === "tokens") {
      const data = await loadTokens(network, limit, db);
      json(200, data);
    } else {
      const data = await loadNfts(network, limit, db);
      json(200, data);
    }
  } catch (err: any) {
    console.error("[marketplace/all]", err);
    throw error(500, err?.message || "Internal server error");
  }
};

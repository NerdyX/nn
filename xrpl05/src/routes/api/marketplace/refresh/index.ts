// src/routes/api/marketplace/refresh/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Cache warm-up endpoint — call this on a schedule to keep D1 always fresh.
//
// Since Cloudflare Pages doesn't support native cron triggers, ping this
// endpoint every 5 minutes from an external scheduler:
//
//   Free options:
//   • cron-job.org  — free, reliable, no account needed
//   • EasyCron      — free tier available
//   • GitHub Actions schedule — free for public repos
//
// Secure it with a secret token in your Pages env vars:
//   REFRESH_SECRET=some-random-string-here
//
// Then configure your cron to call:
//   GET https://yoursite.pages.dev/api/marketplace/refresh?secret=some-random-string-here
//
// ─────────────────────────────────────────────────────────────────────────────
import type { RequestHandler } from "@builder.io/qwik-city";
import { loadTokens, loadNfts, getD1 } from "~/lib/marketplace-data";
import { cacheKey, writeCache } from "~/lib/d1-cache";

const TTL_TOKENS = 5 * 60_000;
const TTL_NFTS = 10 * 60_000;
const MAX_AGE = 60 * 60_000;

const NETWORKS = ["xrpl", "xahau"] as const;

export const onGet: RequestHandler = async ({
  json,
  query,
  error,
  platform,
}) => {
  // Validate secret to prevent abuse
  const secret = query.get("secret") || "";
  const expected =
    (platform as any)?.env?.REFRESH_SECRET || process.env.REFRESH_SECRET || "";

  if (expected && secret !== expected) {
    throw error(401, "Unauthorized");
  }

  const db = getD1(platform as Record<string, any> | undefined);
  if (!db) throw error(503, "No D1 database configured");

  const ctx = (platform as any)?.env?.ctx as
    | { waitUntil?: (p: Promise<any>) => void }
    | undefined;
  const start = Date.now();
  const results: Record<string, string> = {};

  // Refresh all networks in parallel, fire-and-forget via waitUntil if available
  const jobs = NETWORKS.flatMap((network) => [
    (async () => {
      try {
        const data = await loadTokens(network, 200, db);
        await writeCache(
          db,
          cacheKey("tokens_v3", network, 200),
          data,
          TTL_TOKENS,
          MAX_AGE,
        );
        results[`tokens:${network}`] = "ok";
      } catch (err: any) {
        results[`tokens:${network}`] = `error: ${err?.message}`;
      }
    })(),
    (async () => {
      try {
        const data = await loadNfts(network, 500, db);
        await writeCache(
          db,
          cacheKey("nfts_v3", network, 500),
          data,
          TTL_NFTS,
          MAX_AGE,
        );
        results[`nfts:${network}`] = "ok";
      } catch (err: any) {
        results[`nfts:${network}`] = `error: ${err?.message}`;
      }
    })(),
  ]);

  if (ctx?.waitUntil) {
    // Return immediately, finish refresh in background
    json(200, { status: "refreshing", message: "Background refresh started" });
    ctx.waitUntil(Promise.all(jobs));
  } else {
    // No waitUntil — wait for completion before responding
    await Promise.allSettled(jobs);
    json(200, {
      status: "done",
      duration: `${Date.now() - start}ms`,
      results,
    });
  }
};

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

  // Chart data endpoint: ?type=chart&currency=...&issuer=...
  if (type === "chart") {
    const currency = query.get("currency") || "";
    const issuer = query.get("issuer") || "";
    if (!currency || !issuer) {
      throw error(400, "Missing currency or issuer parameter");
    }
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

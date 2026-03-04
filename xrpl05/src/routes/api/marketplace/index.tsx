// src/routes/api/marketplace/index.tsx
import type { RequestHandler } from "@builder.io/qwik-city";
import {
  rpc,
  getD1,
  getBithompBase,
  decodeCurrency,
  decodeHexUri,
  resolveIpfs,
  fetchXrpPriceUsd,
  fetchMeta,
  hexToString,
  formatDate,
  formatAmount,
  type AccountSummary,
  type EnhancedToken,
  type NftItem,
  type SellOffer,
  type BuyOffer,
  type ActivationInfo,
} from "~/lib/marketplace-data";
import { cachedFetch, cacheKey } from "~/lib/d1-cache";

const BITHOMP_TIMEOUT_MS = 10_000; // Increased from 5s
const BATCH_SIZE = 8;

// ─── API Route Handler ────────────────────────────────────────────────────────

export const onGet: RequestHandler = async ({ query, json, platform }) => {
  const startTime = Date.now();

  try {
    const network = query.get("network") || "xrpl";
    const address = query.get("address") || "";
    const mode = query.get("mode") || "summary"; // summary | nft_detail
    const nftId = query.get("nftId") || "";
    const limit = parseInt(query.get("limit") || "20", 10);

    console.log(
      `[API] /api/marketplace?network=${network}&address=${address}&mode=${mode}`,
    );

    if (!address) {
      json(400, { success: false, error: "Missing address parameter" });
      return;
    }

    // D1 cache setup
    const db = getD1(platform);
    let cacheUsed = false;

    // NFT detail mode (single NFT with full offers)
    if (mode === "nft_detail" && nftId) {
      const nftData = await fetchNftDetail(network, nftId, db);
      json(200, nftData);
      return;
    }

    // Account summary mode
    const key = cacheKey(
      "account_summary_v2",
      network,
      address.toLowerCase(),
      limit,
    );

    const { data, isStale, fromCache } = await cachedFetch<AccountSummary>(
      db,
      key,
      async () => await buildAccountSummary(network, address, limit),
      60_000, // 1 min stale-after
      300_000, // 5 min max age
    );

    cacheUsed = fromCache;

    console.log(
      `[API] Response ready in ${Date.now() - startTime}ms (cache: ${cacheUsed}, stale: ${isStale})`,
    );

    json(200, {
      ...data,
      _meta: {
        fromCache: cacheUsed,
        isStale,
        responseTime: Date.now() - startTime,
      },
    });
  } catch (error: any) {
    console.error("[API] Fatal error:", error);
    json(503, {
      success: false,
      error: error?.message || "Service unavailable",
      details: error?.stack || "",
    });
  }
};

// ─── NFT Detail Fetcher (single NFT with full offers) ─────────────────────────

async function fetchNftDetail(
  network: string,
  nftId: string,
  db: D1Database | null,
): Promise<{ success: boolean; nft: NftItem }> {
  const key = cacheKey("nft_detail_v1", network, nftId);

  const { data } = await cachedFetch(
    db,
    key,
    async () => {
      let sellOffers: SellOffer[] = [];
      let buyOffers: BuyOffer[] = [];

      try {
        const sellRes = await rpc(network, "nft_sell_offers", {
          nft_id: nftId,
        });
        sellOffers = (sellRes?.offers || []).map((o: any) => ({
          index: o.nft_offer_index,
          amount: o.amount,
          owner: o.owner,
          destination: o.destination,
          expiration: o.expiration,
        }));
      } catch (e) {
        console.warn(`[NFT Detail] sell_offers failed for ${nftId}:`, e);
      }

      try {
        const buyRes = await rpc(network, "nft_buy_offers", { nft_id: nftId });
        buyOffers = (buyRes?.offers || []).map((o: any) => ({
          index: o.nft_offer_index,
          amount: o.amount,
          owner: o.owner,
          expiration: o.expiration,
        }));
      } catch (e) {
        console.warn(`[NFT Detail] buy_offers failed for ${nftId}:`, e);
      }

      let imageUrl = "";
      const bithompBase = getBithompBase(network);

      try {
        const bRes = await fetch(`${bithompBase}/nft/${nftId}`, {
          signal: AbortSignal.timeout(BITHOMP_TIMEOUT_MS),
        });
        if (bRes.ok) {
          const d = (await bRes.json()) as any;
          imageUrl = d?.metadata?.image || d?.image || "";
        }
      } catch {
        console.warn(`[NFT Detail] Bithomp fetch failed`);
      }

      try {
        const nftRes = await rpc(network, "nft_info", { nft_id: nftId });
        const uri = nftRes?.uri ? decodeHexUri(nftRes.uri) : "";
        const resolved = resolveIpfs(uri);
        const meta = !imageUrl
          ? await fetchMeta(resolved)
          : { image: imageUrl, name: "", description: "", collection: "" };

        const nft: NftItem = {
          nftokenId: nftId,
          issuer: nftRes?.issuer || "",
          owner: nftRes?.owner || "",
          taxon: nftRes?.nft_taxon || 0,
          serial: nftRes?.nft_serial || 0,
          uri: uri,
          resolvedUri: resolved,
          image: meta.image || imageUrl || "",
          name: meta.name || `NFT #${nftRes?.nft_serial || ""}`,
          description: meta.description || "",
          collection: meta.collection || "",
          flags: nftRes?.flags || 0,
          transferFee: nftRes?.transfer_fee || 0,
          nftStandard: "XLS-20",
          sellOffers,
          buyOffers,
          sellOffersCount: sellOffers.length,
          buyOffersCount: buyOffers.length,
        };

        return { success: true, nft };
      } catch (e: any) {
        console.error(`[NFT Detail] nft_info failed:`, e);
        throw new Error(`Failed to fetch NFT details: ${e.message}`);
      }
    },
    600_000, // 10 min stale
    3600_000, // 1 hour max
  );

  return data;
}

// ─── Account Summary Builder ──────────────────────────────────────────────────

async function buildAccountSummary(
  network: string,
  address: string,
  limit: number,
): Promise<AccountSummary> {
  console.log(`[Summary] Building for ${address} on ${network}`);

  // Step 1: Fetch core account data
  let accountData: any = null;
  let lines: any[] = [];
  let txs: any[] = [];

  try {
    const [accRes, linesRes, txRes] = await Promise.allSettled([
      rpc(network, "account_info", {
        account: address,
        ledger_index: "validated",
      }),
      rpc(network, "account_lines", {
        account: address,
        ledger_index: "validated",
      }),
      rpc(network, "account_tx", {
        account: address,
        limit,
        ledger_index_min: -1,
        ledger_index_max: -1,
      }),
    ]);

    if (accRes.status === "fulfilled") accountData = accRes.value?.account_data;
    if (linesRes.status === "fulfilled") lines = linesRes.value?.lines || [];
    if (txRes.status === "fulfilled") txs = txRes.value?.transactions || [];

    if (!accountData) {
      throw new Error("Account not found or network unreachable");
    }
  } catch (e: any) {
    console.error("[Summary] Core data fetch failed:", e);
    throw new Error(`Failed to fetch account data: ${e.message}`);
  }

  // Step 2: Fetch NFTs (batched with marker support)
  let allNfts: any[] = [];
  let marker: string | undefined = undefined;
  let nftPages = 0;
  const maxNftPages = 1; // Limit to 3 pages (60 NFTs) for initial load

  try {
    while (nftPages < maxNftPages) {
      const req: any = {
        command: "account_nfts",
        account: address,
        limit: 20,
        ledger_index: "validated",
      };
      if (marker) req.marker = marker;

      const res = await rpc(network, "account_nfts", req);
      const nfts = res?.account_nfts || [];
      allNfts = allNfts.concat(nfts);
      marker = res?.marker;
      nftPages++;

      if (!marker) break;
    }
  } catch (e) {
    console.warn("[Summary] NFT fetch failed:", e);
  }

  console.log(`[Summary] Fetched ${allNfts.length} NFTs in ${nftPages} pages`);

  // Step 3: Enrich NFTs with Bithomp metadata (batched)
  const bithompBase = getBithompBase(network);
  const enrichedNfts: NftItem[] = [];

  for (let i = 0; i < allNfts.length; i += BATCH_SIZE) {
    const batch = allNfts.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (nft: any) => {
        const nftId = nft.NFTokenID;
        let imageUrl = "";
        let name = "";
        let description = "";
        let collection = "";

        // Try Bithomp first
        try {
          const bRes = await fetch(`${bithompBase}/nft/${nftId}`, {
            signal: AbortSignal.timeout(BITHOMP_TIMEOUT_MS),
          });
          if (bRes.ok) {
            const d = (await bRes.json()) as any;
            imageUrl = d?.metadata?.image || d?.image || "";
            name = d?.metadata?.name || d?.name || "";
            description = d?.metadata?.description || d?.description || "";
            collection = d?.metadata?.collection || d?.collection || "";
          }
        } catch {
          console.warn(`[NFT] Bithomp failed for ${nftId}, trying fallback`);
        }

        // Fallback: decode URI and fetch metadata
        if (!imageUrl) {
          try {
            const rawUri = nft.URI ? decodeHexUri(nft.URI) : "";
            const resolvedUri = resolveIpfs(rawUri);
            const meta = await fetchMeta(resolvedUri);
            imageUrl = meta.image;
            name = name || meta.name;
            description = description || meta.description;
            collection = collection || meta.collection;
          } catch {
            console.warn(`[NFT] Metadata fetch failed for ${nftId}`);
          }
        }

        // Count offers (lazy - don't fetch full offers here)
        let sellCount = 0;
        let buyCount = 0;

        try {
          const [sellRes, buyRes] = await Promise.allSettled([
            rpc(network, "nft_sell_offers", { nft_id: nftId }),
            rpc(network, "nft_buy_offers", { nft_id: nftId }),
          ]);
          if (sellRes.status === "fulfilled")
            sellCount = sellRes.value?.offers?.length || 0;
          if (buyRes.status === "fulfilled")
            buyCount = buyRes.value?.offers?.length || 0;
        } catch {
          console.warn(`[NFT] Offer count failed for ${nftId}`);
        }

        const item: NftItem = {
          nftokenId: nftId,
          issuer: nft.Issuer || "",
          owner: address,
          taxon: nft.NFTokenTaxon || 0,
          serial: parseInt(nftId.slice(-8), 16) || 0,
          uri: nft.URI ? decodeHexUri(nft.URI) : "",
          resolvedUri: resolveIpfs(nft.URI ? decodeHexUri(nft.URI) : ""),
          image: imageUrl,
          name: name || `NFT #${parseInt(nftId.slice(-8), 16)}`,
          description: description,
          collection: collection,
          flags: nft.Flags || 0,
          transferFee: nft.TransferFee || 0,
          nftStandard: "XLS-20",
          sellOffersCount: sellCount,
          buyOffersCount: buyCount,
        };

        return item;
      }),
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        enrichedNfts.push(result.value);
      }
    }
  }

  console.log(`[Summary] Enriched ${enrichedNfts.length} NFTs`);

  // Step 4: Calculate balances and worth
  const nativeBalDrops = accountData?.Balance
    ? parseInt(accountData.Balance, 10)
    : 0;
  const nativeBal = (nativeBalDrops / 1_000_000).toFixed(6);
  let totalWorthUsd = 0;
  let totalEscrowValue = "0";

  try {
    const xrpPrice = await fetchXrpPriceUsd();
    totalWorthUsd = (nativeBalDrops / 1_000_000) * xrpPrice;
  } catch {
    console.warn("[Summary] XRP price fetch failed");
  }

  // Fetch escrow value
  try {
    const escrowRes = await rpc(network, "account_objects", {
      account: address,
      type: "escrow",
      ledger_index: "validated",
      limit: 100,
    });
    const escrows = escrowRes?.account_objects || [];
    const escrowSum = escrows.reduce(
      (sum: number, e: any) => sum + parseInt(e.Amount || "0", 10) / 1_000_000,
      0,
    );
    totalEscrowValue = escrowSum.toFixed(6);
  } catch {
    console.warn("[Summary] Escrow fetch failed");
  }

  // Step 5: Activation info
  let activated: ActivationInfo | undefined = undefined;

  try {
    const firstTxRes = await rpc(network, "account_tx", {
      account: address,
      limit: 1,
      forward: true,
    });
    const firstTx = firstTxRes?.transactions?.[0]?.tx;
    if (firstTx) {
      activated = {
        date: formatDate(firstTx.date),
        activatedBy: firstTx.Account || "",
        amount:
          typeof firstTx.Amount === "string"
            ? (parseInt(firstTx.Amount, 10) / 1_000_000).toFixed(6) + " XRP"
            : formatAmount(firstTx.Amount),
      };
    }
  } catch {
    console.warn("[Summary] Activation fetch failed");
  }

  // Step 6: Bithomp username/paystring/kyc
  let username = "";
  let paystring = "";
  let kycStatus = "Unknown";

  try {
    const bRes = await fetch(`${bithompBase}/address/${address}`, {
      signal: AbortSignal.timeout(BITHOMP_TIMEOUT_MS),
    });
    if (bRes.ok) {
      const d = (await bRes.json()) as any;
      username = d?.username || "";
      paystring = d?.payString || "";
      kycStatus = d?.verifiedDomain ? "Verified" : "Not Verified";
    }
  } catch {
    console.warn("[Summary] Bithomp address info failed");
  }

  // Step 7: Enhanced tokens
  const enhancedTokens: EnhancedToken[] = await Promise.all(
    lines.slice(0, 30).map(async (line: any) => {
      const currency = line.currency || "";
      const issuer = line.account || "";
      const decoded = decodeCurrency(currency);
      let name = decoded;
      let symbol = decoded;
      let icon = "";

      try {
        const tokRes = await fetch(
          `${bithompBase}/token/${currency}/${issuer}`,
          {
            signal: AbortSignal.timeout(5_000),
          },
        );
        if (tokRes.ok) {
          const tok = (await tokRes.json()) as any;
          name = tok?.name || decoded;
          symbol = tok?.symbol || decoded;
          icon = tok?.icon || "";
        }
      } catch {
        // Silent fail - use decoded name
      }

      let ripplingEnabled = true;
      try {
        const issuerInfo = await rpc(network, "account_info", {
          account: issuer,
          ledger_index: "validated",
        });
        const flags = issuerInfo?.account_data?.Flags || 0;
        ripplingEnabled = !(flags & 0x00080000); // lsfDefaultRipple
      } catch {
        // Assume enabled
      }

      const maxAmount = line.limit || "0";
      const balance = line.balance || "0";
      const worthUsd = undefined; // TODO: fetch token price if needed

      return {
        currency,
        name,
        symbol,
        icon,
        balance,
        worthUsd,
        ripplingEnabled,
        maxAmount,
        issuer,
      };
    }),
  );

  // Step 8: NFT stats
  const totalSoldApprox = 0;
  const offersCreated: Array<{ name: string; amount: string }> = [];

  const listedCount = enrichedNfts.filter(
    (n) => (n.sellOffersCount || 0) > 0,
  ).length;
  const totalSellOffers = enrichedNfts.reduce(
    (sum, n) => sum + (n.sellOffersCount || 0),
    0,
  );
  const totalBuyOffers = enrichedNfts.reduce(
    (sum, n) => sum + (n.buyOffersCount || 0),
    0,
  );

  // Step 9: Format transactions
  const formattedTxs = txs.slice(0, 20).map((item: any) => {
    const tx = item.tx || {};
    const meta = item.meta || {};

    const changes = meta.delivered_amount
      ? formatAmount(meta.delivered_amount)
      : tx.Amount
        ? formatAmount(tx.Amount)
        : tx.TransactionType || "";

    return {
      hash: tx.hash || "",
      date: tx.date ? formatDate(tx.date) : "",
      type: tx.TransactionType || "Unknown",
      result: meta.TransactionResult || "tesSUCCESS",
      fee: tx.Fee ? (parseInt(tx.Fee, 10) / 1_000_000).toFixed(6) : "0",
      changes,
    };
  });

  // Step 10: Build response
  const response: AccountSummary = {
    success: true,
    network,
    address,
    balance: nativeBal,
    totalWorthUsd,
    totalEscrowValue,
    accountInfo: {
      status: accountData?.Flags ? "Active" : "Unknown",
      activated,
      domain: accountData?.Domain ? hexToString(accountData.Domain) : undefined,
      username,
      paystring,
      masterKeyDisabled: !!(
        accountData?.Flags && accountData.Flags & 0x00100000
      ),
      regularKey: accountData?.RegularKey,
      nextSequence: accountData?.Sequence || 0,
      kycStatus,
    },
    tokens: {
      totalCount: lines.length,
      list: enhancedTokens,
    },
    nfts: {
      totalOwned: allNfts.length,
      totalSoldApprox,
      offersCreated,
      list: enrichedNfts,
      listedCount,
      totalSellOffers,
      totalBuyOffers,
    },
    transactions: formattedTxs,
    queriedAt: new Date().toISOString(),
  };

  return response;
}

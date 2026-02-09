import type { RequestHandler } from "@builder.io/qwik-city";
import { Client } from "xrpl";

const NODE_TIMEOUT_MS = 10000;
const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://nftstorage.link/ipfs/",
];

function hexToString(hex: string): string {
  let str = "";
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.substring(i, i + 2), 16);
    if (code) str += String.fromCharCode(code);
  }
  return str;
}

function resolveUri(uri: string | undefined): string {
  if (!uri) return "";
  // If it's hex-encoded, decode it
  if (/^[0-9A-Fa-f]+$/.test(uri) && uri.length > 10) {
    uri = hexToString(uri);
  }
  // IPFS protocol
  if (uri.startsWith("ipfs://")) {
    const cid = uri.replace("ipfs://", "");
    return IPFS_GATEWAYS[0] + cid;
  }
  // Raw CID (starts with Qm or bafy)
  if (uri.startsWith("Qm") || uri.startsWith("bafy")) {
    return IPFS_GATEWAYS[0] + uri;
  }
  // Already an HTTP URL
  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    return uri;
  }
  // data URIs
  if (uri.startsWith("data:")) {
    return uri;
  }
  // Fallback: try as IPFS CID
  return IPFS_GATEWAYS[0] + uri;
}

async function tryFetchMetadata(
  uri: string,
): Promise<Record<string, any> | null> {
  if (!uri || uri.startsWith("data:")) return null;

  // Try to fetch JSON metadata from the URI
  for (const gateway of IPFS_GATEWAYS) {
    let fetchUrl = uri;
    // If it's an IPFS gateway URL, try alternate gateways
    if (uri.includes("/ipfs/")) {
      const cid = uri.split("/ipfs/").pop();
      fetchUrl = gateway + cid;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(fetchUrl, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeout);
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("json")) {
          return await res.json();
        }
        // Not JSON — it's likely the image itself
        return null;
      }
    } catch {
      // Try next gateway
    }
  }
  return null;
}

interface NftResult {
  nftokenId: string;
  issuer: string;
  owner: string;
  taxon: number;
  serial: number;
  uri: string;
  resolvedUri: string;
  image: string;
  name: string;
  description: string;
  collection: string;
  flags: number;
  transferFee: number;
  sellOffers: SellOffer[];
  buyOffers: BuyOffer[];
}

interface SellOffer {
  index: string;
  amount: string | { value: string; currency: string; issuer: string };
  owner: string;
  destination?: string;
  expiration?: number;
}

interface BuyOffer {
  index: string;
  amount: string | { value: string; currency: string; issuer: string };
  owner: string;
  expiration?: number;
}

const networkConfig: Record<string, string[]> = {
  xrpl: [
    "wss://xrplcluster.com",
    "wss://s1.ripple.com",
    "wss://s2.ripple.com",
  ],
  xahau: [
    "wss://xahau.network",
    "wss://xahau-rpc.com",
  ],
};

export const onGet: RequestHandler = async ({
  query,
  json,
  error,
  headers,
}) => {
  const network = query.get("network") || "xrpl";
  const address = query.get("address")?.trim();
  const mode = query.get("mode") || "account"; // "account" | "all_offers"
  const nftId = query.get("nft_id")?.trim();
  const limitParam = query.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam), 100) : 50;

  headers.set("Cache-Control", "public, max-age=15");

  const urls = networkConfig[network] || networkConfig.xrpl;
  let lastError: any = null;

  for (const url of urls) {
    const client = new Client(url);

    try {
      const connectPromise = client.connect();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Connection timeout")),
          NODE_TIMEOUT_MS,
        ),
      );
      await Promise.race([connectPromise, timeoutPromise]);

      // ── Mode: Fetch sell/buy offers for a specific NFT ──
      if (mode === "offers" && nftId) {
        let sellOffers: SellOffer[] = [];
        let buyOffers: BuyOffer[] = [];

        try {
          const sellRes = await client.request({
            command: "nft_sell_offers",
            nft_id: nftId,
          } as any);
          sellOffers = ((sellRes.result as any).offers || []).map((o: any) => ({
            index: o.nft_offer_index || o.index,
            amount: o.amount,
            owner: o.owner,
            destination: o.destination,
            expiration: o.expiration,
          }));
        } catch {
          // No sell offers
        }

        try {
          const buyRes = await client.request({
            command: "nft_buy_offers",
            nft_id: nftId,
          } as any);
          buyOffers = ((buyRes.result as any).offers || []).map((o: any) => ({
            index: o.nft_offer_index || o.index,
            amount: o.amount,
            owner: o.owner,
            expiration: o.expiration,
          }));
        } catch {
          // No buy offers
        }

        await client.disconnect();

        json(200, {
          success: true,
          nftId,
          sellOffers,
          buyOffers,
        });
        return;
      }

      // ── Mode: Fetch NFTs for an account ──
      if (!address || address.length < 25 || !address.startsWith("r")) {
        throw error(
          400,
          "Invalid or missing address (must start with 'r')",
        );
      }

      let allNfts: any[] = [];
      let marker: any = undefined;

      // Paginate through all NFTs
      do {
        const req: any = {
          command: "account_nfts",
          account: address,
          limit: Math.min(limit, 400),
        };
        if (marker) req.marker = marker;

        const nftRes = await client.request(req);
        const result = nftRes.result as any;
        allNfts = allNfts.concat(result.account_nfts || []);
        marker = result.marker;
      } while (marker && allNfts.length < limit);

      // Process NFTs — resolve URIs and fetch metadata
      const nfts: NftResult[] = [];

      // Process in batches to avoid too many concurrent fetches
      const batchSize = 10;
      for (let i = 0; i < allNfts.length; i += batchSize) {
        const batch = allNfts.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (nft: any) => {
            const rawUri = nft.URI || "";
            const resolvedUri = resolveUri(rawUri);

            let name = "";
            let description = "";
            let image = resolvedUri;
            let collection = "";

            // Try to fetch metadata if the URI points to JSON
            try {
              const metadata = await tryFetchMetadata(resolvedUri);
              if (metadata) {
                name = metadata.name || metadata.title || "";
                description =
                  metadata.description || metadata.desc || "";
                collection =
                  metadata.collection?.name ||
                  metadata.collection ||
                  metadata.collectionName ||
                  "";
                // Resolve the image field from metadata
                const rawImage =
                  metadata.image ||
                  metadata.image_url ||
                  metadata.imageUrl ||
                  metadata.animation_url ||
                  "";
                image = resolveUri(rawImage) || resolvedUri;
              }
            } catch {
              // Use resolved URI as image fallback
            }

            if (!name) {
              name = `NFT #${nft.nft_serial ?? ""}`;
            }

            // Fetch sell/buy offers for this NFT
            let sellOffers: SellOffer[] = [];
            let buyOffers: BuyOffer[] = [];

            try {
              const sellRes = await client.request({
                command: "nft_sell_offers",
                nft_id: nft.NFTokenID,
              } as any);
              sellOffers = ((sellRes.result as any).offers || []).map(
                (o: any) => ({
                  index: o.nft_offer_index || o.index,
                  amount: o.amount,
                  owner: o.owner,
                  destination: o.destination,
                  expiration: o.expiration,
                }),
              );
            } catch {
              // No sell offers
            }

            try {
              const buyRes = await client.request({
                command: "nft_buy_offers",
                nft_id: nft.NFTokenID,
              } as any);
              buyOffers = ((buyRes.result as any).offers || []).map(
                (o: any) => ({
                  index: o.nft_offer_index || o.index,
                  amount: o.amount,
                  owner: o.owner,
                  expiration: o.expiration,
                }),
              );
            } catch {
              // No buy offers
            }

            const result: NftResult = {
              nftokenId: nft.NFTokenID,
              issuer: nft.Issuer,
              owner: address,
              taxon: nft.NFTokenTaxon ?? 0,
              serial: nft.nft_serial ?? 0,
              uri: rawUri,
              resolvedUri,
              image,
              name,
              description,
              collection,
              flags: nft.Flags ?? 0,
              transferFee: nft.TransferFee
                ? nft.TransferFee / 1000
                : 0,
              sellOffers,
              buyOffers,
            };

            return result;
          }),
        );

        nfts.push(...batchResults);
      }

      // Get account info for stats
      let balanceXrp = "0";
      try {
        const accInfo = await client.request({
          command: "account_info",
          account: address,
          ledger_index: "validated",
        });
        const bal = (accInfo.result as any).account_data?.Balance;
        if (bal) {
          balanceXrp = (Number(bal) / 1_000_000).toFixed(6);
        }
      } catch {
        // ignore
      }

      await client.disconnect();

      const totalSellOffers = nfts.reduce(
        (sum, n) => sum + n.sellOffers.length,
        0,
      );
      const totalBuyOffers = nfts.reduce(
        (sum, n) => sum + n.buyOffers.length,
        0,
      );
      const listedCount = nfts.filter((n) => n.sellOffers.length > 0).length;

      json(200, {
        success: true,
        network,
        address,
        balance: balanceXrp,
        totalNfts: nfts.length,
        listedCount,
        totalSellOffers,
        totalBuyOffers,
        nfts,
        queriedAt: new Date().toISOString(),
      });
      return;
    } catch (err: any) {
      lastError = err;
      console.warn(`Marketplace API — node ${url} failed:`, err.message);
      try {
        await client.disconnect();
      } catch {
        // ignore
      }
    }
  }

  console.error("All marketplace nodes failed:", lastError);
  throw error(
    503,
    "Temporarily unable to fetch NFT data — all nodes unreachable",
  );
};

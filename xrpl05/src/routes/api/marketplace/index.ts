import type { RequestHandler } from "@builder.io/qwik-city";
import { cachedFetch } from "~/lib/utils/d1-cache";
import { resolveIpfsUrl } from "~/lib/utils/ipfs";
import { fromHex } from "~/lib/utils/hex";

const XRPL_RPC = "https://s1.ripple.com:51234/";
const XAHAU_RPC = "https://xahau.network/";

export const onGet: RequestHandler = async ({ url, json, env }) => {
  const network = url.searchParams.get("network") || "xrpl";
  const address = url.searchParams.get("address");
  const limit = parseInt(url.searchParams.get("limit") || "100", 10);

  if (!address) {
    json(400, { error: "Address is required" });
    return;
  }

  const cacheKey = `nfts:${network}:${address}:${limit}`;
  // Use D1 binding if available from env
  const db = env.get("DB") as any | null;

  try {
    const result = await cachedFetch(
      db,
      cacheKey,
      async () => {
        const rpcUrl = network === "xahau" ? XAHAU_RPC : XRPL_RPC;
        const payload = {
          method: "account_nfts",
          params: [{ account: address, limit }]
        };

        const res = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data: any = await res.json();
        
        if (data.result?.error) {
          throw new Error(data.result.error_message || data.result.error);
        }

        const nfts = data.result?.account_nfts || [];

        // Enhance with resolved URIs
        const enhancedNfts = nfts.map((nft: any) => {
          let resolvedUri = "";
          let name = "Unknown NFT";
          
          if (nft.URI) {
            try {
               const decoded = fromHex(nft.URI);
               resolvedUri = resolveIpfsUrl(decoded);
               name = decoded; // basic fallback
            } catch {
               resolvedUri = resolveIpfsUrl(nft.URI);
            }
          }

          return {
            nftokenId: nft.NFTokenID,
            issuer: nft.Issuer,
            owner: address,
            taxon: nft.NFTokenTaxon,
            serial: nft.nft_serial,
            uri: nft.URI,
            resolvedUri,
            image: resolvedUri, // If it's a direct image link
            name,
            description: "",
            collection: "Collection " + nft.NFTokenTaxon,
            flags: nft.Flags,
            transferFee: nft.TransferFee,
            sellOffers: [],
            buyOffers: []
          };
        });

        return {
          success: true,
          network,
          address,
          totalNfts: enhancedNfts.length,
          nfts: enhancedNfts,
          queriedAt: new Date().toISOString()
        };
      },
      5 * 60_000 // 5 minutes cache
    );

    json(200, result.data);
  } catch (error: any) {
    json(500, { success: false, message: error.message });
  }
};

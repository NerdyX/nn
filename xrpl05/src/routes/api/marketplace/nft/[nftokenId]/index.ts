import type { RequestHandler } from "@builder.io/qwik-city";
import { getD1, loadNfts } from "~/lib/marketplace-data";

export const onGet: RequestHandler = async ({ params, json, platform }) => {
  const nftokenId = params.nftokenId;

  if (!nftokenId) {
    json(400, { error: "NFT ID is required" });
    return;
  }

  const db = getD1(platform);

  try {
    // We can reuse loadNfts, but we'll need to filter for the specific NFT
    // A direct fetch might be more efficient if `marketplace-data` supported it.
    // For now, load a small batch and filter.
    const network = "xrpl"; // Assuming XRPL for direct NFT lookup initially
    const limit = 5; // Fetch a small batch, hoping to find it

    const data = await loadNfts(network, limit, db);

    const nft = data.nfts.find((item) => item.nftokenId === nftokenId);

    if (nft) {
      json(200, { success: true, nft });
    } else {
      // If not found in XRPL, try Xahau
      const xahauData = await loadNfts("xahau", limit, db);
      const xahauNft = xahauData.nfts.find(
        (item) => item.nftokenId === nftokenId,
      );
      if (xahauNft) {
        json(200, { success: true, nft: xahauNft });
      } else {
        json(404, { success: false, error: "NFT not found" });
      }
    }
  } catch (error: any) {
    json(500, {
      success: false,
      error: error.message || "Failed to fetch NFT details",
    });
  }
};

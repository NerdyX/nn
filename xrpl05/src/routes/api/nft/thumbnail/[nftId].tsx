// src/routes/api/nft/thumbnail/[nftId].tsx (dynamic route)
import type { RequestHandler } from "@builder.io/qwik-city";

export const onGet: RequestHandler = async ({ params, json, headers }) => {
  const nftId = params.nftId;
  // Fetch thumbnail from Bithomp/IPFS
  const thumbnailUri = await getThumbnailUri(nftId); // Your logic
  headers.set("Content-Type", "image/jpeg"); // Or appropriate type
  // Middleware will auto-add Cache-Control
  json(200, { url: thumbnailUri }); // Or redirect to it
};

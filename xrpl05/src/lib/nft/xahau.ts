import type { XahauNFTData } from "./types";

export function normalizeXahauNFT(nft: any): XahauNFTData {
  return {
    nftId: nft.NFTokenID,
    uri: nft.URI,
    flags: nft.Flags,
    issuer: nft.Issuer,
    taxon: nft.NFTokenTaxon,
    transferFee: nft.TransferFee,
    serial: nft.nft_serial,
    network: "xahau",
    metadata: nft.Metadata,
    royaltyDestination: nft.royalty_destination,
    mintedAt: nft.minted_at,
  };
}

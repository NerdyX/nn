import type { XRPLNFTData } from "./types";

export function normalizeXRPLNFT(nft: any): XRPLNFTData {
  return {
    nftId: nft.NFTokenID,
    uri: nft.URI,
    flags: nft.Flags,
    issuer: nft.Issuer,
    taxon: nft.NFTokenTaxon,
    transferFee: nft.TransferFee,
    serial: nft.nft_serial,
    network: "xrpl",
  };
}

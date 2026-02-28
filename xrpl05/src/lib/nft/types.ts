export interface BaseNFTData {
  nftId: string;
  uri?: string;
  flags?: number;
  issuer?: string;
  taxon?: number;
  transferFee?: number;
  serial?: number;
  network: "xrpl" | "xahau";
}

export interface XRPLNFTData extends BaseNFTData {
  network: "xrpl";
}

export interface XahauNFTData extends BaseNFTData {
  network: "xahau";
  metadata?: any;
  royaltyDestination?: string;
  mintedAt?: string;
}

export type NFTData = XRPLNFTData | XahauNFTData;

import { createStore } from "zustand/vanilla";
import type { NFTData } from "../nft/types";

export interface OfferData {
  offerId: string;
  nftId: string;
  owner: string;
  destination?: string;
  expiration?: number;
  expirationDate?: string;
  flags?: number;
  amount: {
    value: string;
    currency: string;
    issuer?: string;
  };
}

export interface NFTState {
  nfts: NFTData[];
  sellOffers: Record<string, OfferData[]>;
  buyOffers: Record<string, OfferData[]>;
  isLoading: boolean;
  error: string | null;
}

export const nftStore = createStore<NFTState>(() => ({
  nfts: [],
  sellOffers: {},
  buyOffers: {},
  isLoading: false,
  error: null,
}));

export const nftActions = {
  setNFTs: (nfts: NFTData[]) => nftStore.setState({ nfts, error: null }),
  setOffers: (nftId: string, type: "sell" | "buy", offers: OfferData[]) => 
    nftStore.setState((state) => ({
      [type === "sell" ? "sellOffers" : "buyOffers"]: {
        ...state[type === "sell" ? "sellOffers" : "buyOffers"],
        [nftId]: offers,
      }
    })),
  setLoading: (isLoading: boolean) => nftStore.setState({ isLoading }),
  setError: (error: string | null) => nftStore.setState({ error, isLoading: false }),
  clear: () => nftStore.setState({ nfts: [], sellOffers: {}, buyOffers: {}, error: null, isLoading: false })
};

/**
 * Main NFT Marketplace Store
 *
 * Centralized state management for the NFT marketplace application.
 * Manages NFT data, offers, network selection, and integrates with both
 * XRPL and Xahau blockchain networks.
 *
 * Features:
 * - Reactive state using Qwik signals/stores
 * - Multi-network support (XRPL and Xahau)
 * - Built-in caching to prevent redundant API calls
 * - Comprehensive error handling
 * - Loading state management
 *
 * @module lib/store/store
 */

import { createStore } from '@builder.io/qwik';
import type { NFToken, NFTokenOffer } from '~/lib/network/xrpl/types/nftTx';
import type { XahauNFToken, XahauNFTokenOffer } from '~/lib/network/xahau/types/nftTx';
import { getXRPLClient, disconnectXRPL } from '~/lib/store/network/xrpl';
import { getXahauClient, disconnectXahau } from '~/lib/store/network/xahau';

/**
 * Supported blockchain networks
 */
export type NetworkType = 'xrpl' | 'xahau';

/**
 * Normalized NFT data structure (unified for both XRPL and Xahau)
 */
export interface NFTData {
  nftId: string;
  uri?: string;
  flags: number;
  issuer: string;
  taxon: number;
  transferFee?: number;
  serial: number;
  network: NetworkType;

  // Xahau-specific fields
  metadata?: string;
  royaltyDestination?: string;
  mintedAt?: number;

  // Decoded metadata (fetched from URI)
  decodedMetadata?: {
    name: string;
    description: string;
    image: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
    external_url?: string;
    animation_url?: string;
  };

  // Loading state for metadata
  metadataLoading?: boolean;
  metadataError?: string;
}

/**
 * Normalized offer data structure
 */
export interface OfferData {
  offerId: string;
  nftId: string;
  owner: string;
  amount: {
    value: string;
    currency: string;
    issuer?: string;
  };
  destination?: string;
  expiration?: number;
  expirationDate?: string;
  flags: number;
  isSellOffer: boolean;
  network: NetworkType;

  // Xahau-specific fields
  metadata?: string;
  royaltyAmount?: string;
  createdAt?: number;
}

/**
 * Error state structure
 */
export interface ErrorState {
  code: string;
  message: string;
  timestamp: number;
  context?: string;
}

/**
 * Loading state structure for different operations
 */
export interface LoadingStates {
  nfts: boolean;
  offers: boolean;
  metadata: boolean;
  transaction: boolean;
}

/**
 * Main store state interface
 */
export interface StoreState {
  // NFT data
  nfts: NFTData[];
  currentNFT: NFTData | null;

  // Offer data
  sellOffers: OfferData[];
  buyOffers: OfferData[];

  // Network selection
  selectedNetwork: NetworkType;

  // Loading states
  loading: LoadingStates;

  // Error states
  errors: {
    nfts: ErrorState | null;
    offers: ErrorState | null;
    metadata: ErrorState | null;
    transaction: ErrorState | null;
  };

  // Last updated timestamps
  lastUpdated: {
    nfts: number | null;
    offers: number | null;
  };

  // Current account being viewed
  currentAccount: string | null;
}

/**
 * Cache entry structure
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  NFT_TTL: 60000,
  OFFERS_TTL: 30000,
  METADATA_TTL: 300000,
};

/**
 * Cache storage using Map
 */
class StoreCache {
  private nftCache = new Map<string, CacheEntry<NFTData[]>>();
  private offerCache = new Map<string, CacheEntry<{ sell: OfferData[]; buy: OfferData[] }>>();
  private metadataCache = new Map<string, CacheEntry<any>>();

  private getNFTCacheKey(account: string, network: NetworkType): string {
    return `nfts:${network}:${account}`;
  }

  private getOfferCacheKey(nftId: string, network: NetworkType): string {
    return `offers:${network}:${nftId}`;
  }

  private getMetadataCacheKey(uri: string): string {
    return `metadata:${uri}`;
  }

  private isValid<T>(entry: CacheEntry<T> | undefined): boolean {
    if (!entry) return false;
    return Date.now() < entry.expiresAt;
  }

  getNFTs(account: string, network: NetworkType): NFTData[] | null {
    const key = this.getNFTCacheKey(account, network);
    const entry = this.nftCache.get(key);

    if (this.isValid(entry)) {
      console.log(`[Cache] NFTs hit for ${account} on ${network}`);
      return entry!.data;
    }

    return null;
  }

  setNFTs(account: string, network: NetworkType, data: NFTData[]): void {
    const key = this.getNFTCacheKey(account, network);
    this.nftCache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_CONFIG.NFT_TTL,
    });
    console.log(`[Cache] NFTs stored for ${account} on ${network}`);
  }

  getOffers(nftId: string, network: NetworkType): { sell: OfferData[]; buy: OfferData[] } | null {
    const key = this.getOfferCacheKey(nftId, network);
    const entry = this.offerCache.get(key);

    if (this.isValid(entry)) {
      console.log(`[Cache] Offers hit for ${nftId} on ${network}`);
      return entry!.data;
    }

    return null;
  }

  setOffers(nftId: string, network: NetworkType, data: { sell: OfferData[]; buy: OfferData[] }): void {
    const key = this.getOfferCacheKey(nftId, network);
    this.offerCache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_CONFIG.OFFERS_TTL,
    });
    console.log(`[Cache] Offers stored for ${nftId} on ${network}`);
  }

  getMetadata(uri: string): any | null {
    const key = this.getMetadataCacheKey(uri);
    const entry = this.metadataCache.get(key);

    if (this.isValid(entry)) {
      console.log(`[Cache] Metadata hit for ${uri}`);
      return entry!.data;
    }

    return null;
  }

  setMetadata(uri: string, data: any): void {
    const key = this.getMetadataCacheKey(uri);
    this.metadataCache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_CONFIG.METADATA_TTL,
    });
    console.log(`[Cache] Metadata stored for ${uri}`);
  }

  clear(): void {
    this.nftCache.clear();
    this.offerCache.clear();
    this.metadataCache.clear();
    console.log('[Cache] All cache cleared');
  }

  clearAccount(account: string): void {
    const xrplKey = this.getNFTCacheKey(account, 'xrpl');
    const xahauKey = this.getNFTCacheKey(account, 'xahau');
    this.nftCache.delete(xrplKey);
    this.nftCache.delete(xahauKey);
    console.log(`[Cache] Cache cleared for account ${account}`);
  }

  clearNFT(nftId: string): void {
    const xrplKey = this.getOfferCacheKey(nftId, 'xrpl');
    const xahauKey = this.getOfferCacheKey(nftId, 'xahau');
    this.offerCache.delete(xrplKey);
    this.offerCache.delete(xahauKey);
    console.log(`[Cache] Cache cleared for NFT ${nftId}`);
  }
}

const cache = new StoreCache();

const initialState: StoreState = {
  nfts: [],
  currentNFT: null,
  sellOffers: [],
  buyOffers: [],
  selectedNetwork: 'xrpl',
  loading: {
    nfts: false,
    offers: false,
    metadata: false,
    transaction: false,
  },
  errors: {
    nfts: null,
    offers: null,
    metadata: null,
    transaction: null,
  },
  lastUpdated: {
    nfts: null,
    offers: null,
  },
  currentAccount: null,
};

export const nftStore = createStore<StoreState>(initialState);

function dropsToXrp(drops: string): string {
  return (parseInt(drops) / 1_000_000).toString();
}

function rippleTimeToISOString(rippleTime: number): string {
  const RIPPLE_EPOCH = 946684800;
  const unixTime = rippleTime + RIPPLE_EPOCH;
  return new Date(unixTime * 1000).toISOString();
}

function normalizeXRPLNFT(nft: NFToken, network: NetworkType): NFTData {
  return {
    nftId: nft.NFTokenID,
    uri: nft.URI,
    flags: nft.Flags,
    issuer: nft.Issuer,
    taxon: nft.NFTokenTaxon,
    transferFee: nft.TransferFee,
    serial: nft.nft_serial,
    network,
  };
}

function normalizeXahauNFT(nft: XahauNFToken, network: NetworkType): NFTData {
  return {
    nftId: nft.NFTokenID,
    uri: nft.URI,
    flags: nft.Flags,
    issuer: nft.Issuer,
    taxon: nft.NFTokenTaxon,
    transferFee: nft.TransferFee,
    serial: nft.nft_serial,
    network,
    metadata: nft.Metadata,
    royaltyDestination: nft.RoyaltyDestination,
    mintedAt: nft.MintedAt,
  };
}

function normalizeXRPLOffer(offer: NFTokenOffer, network: NetworkType, isSellOffer: boolean): OfferData {
  const amount = typeof offer.Amount === 'string'
    ? {
        value: dropsToXrp(offer.Amount),
        currency: 'XRP',
      }
    : {
        value: offer.Amount.value,
        currency: offer.Amount.currency,
        issuer: offer.Amount.issuer,
      };

  return {
    offerId: offer.index,
    nftId: offer.NFTokenID,
    owner: offer.Owner,
    amount,
    destination: offer.Destination,
    expiration: offer.Expiration,
    expirationDate: offer.Expiration ? rippleTimeToISOString(offer.Expiration) : undefined,
    flags: offer.Flags,
    isSellOffer,
    network,
  };
}

function normalizeXahauOffer(offer: XahauNFTokenOffer, network: NetworkType, isSellOffer: boolean): OfferData {
  const amount = typeof offer.Amount === 'string'
    ? {
        value: dropsToXrp(offer.Amount),
        currency: 'XRP',
      }
    : {
        value: offer.Amount.value,
        currency: offer.Amount.currency,
        issuer: offer.Amount.issuer,
      };

  return {
    offerId: offer.index,
    nftId: offer.NFTokenID,
    owner: offer.Owner,
    amount,
    destination: offer.Destination,
    expiration: offer.Expiration,
    expirationDate: offer.Expiration ? rippleTimeToISOString(offer.Expiration) : undefined,
    flags: offer.Flags,
    isSellOffer,
    network,
    metadata: offer.OfferMetadata,
    royaltyAmount: offer.RoyaltyAmount,
    createdAt: offer.CreatedAt,
  };
}

function decodeURI(hexUri?: string): string | undefined {
  if (!hexUri) return undefined;

  try {
    return Buffer.from(hexUri, 'hex').toString('utf8');
  } catch (error) {
    console.error('Error decoding URI:', error);
    return undefined;
  }
}

async function fetchNFTMetadata(uri: string): Promise<any> {
  const cached = cache.getMetadata(uri);
  if (cached) return cached;

  try {
    let fetchUrl = uri;
    if (uri.startsWith('ipfs://')) {
      fetchUrl = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const metadata = await response.json();
    cache.setMetadata(uri, metadata);

    return metadata;
  } catch (error: any) {
    console.error('Error fetching NFT metadata:', error);
    throw new Error(`Failed to fetch metadata: ${error.message}`);
  }
}

export const storeActions = {
  async loadNFTs(account: string, network: NetworkType = nftStore.selectedNetwork): Promise<void> {
    console.log(`[Store] Loading NFTs for ${account} on ${network}`);

    nftStore.loading.nfts = true;
    nftStore.errors.nfts = null;
    nftStore.currentAccount = account;

    try {
      const cachedNFTs = cache.getNFTs(account, network);
      if (cachedNFTs) {
        nftStore.nfts = cachedNFTs;
        nftStore.loading.nfts = false;
        nftStore.lastUpdated.nfts = Date.now();
        return;
      }

      let nfts: NFTData[] = [];

      if (network === 'xrpl') {
        const client = await getXRPLClient();
        const response = await client.request({
          command: 'account_nfts',
          account: account,
          limit: 400,
        });

        nfts = response.account_nfts.map(nft => normalizeXRPLNFT(nft, network));
      } else {
        const client = await getXahauClient();
        const response = await client.request({
          command: 'account_nfts',
          account: account,
          limit: 400,
          include_metadata: true,
        });

        nfts = response.account_nfts.map(nft => normalizeXahauNFT(nft, network));
      }

      for (const nft of nfts) {
        if (nft.uri) {
          const decodedUri = decodeURI(nft.uri);
          if (decodedUri) {
            fetchNFTMetadata(decodedUri)
              .then(metadata => {
                nft.decodedMetadata = metadata;
                nft.metadataLoading = false;
              })
              .catch(error => {
                nft.metadataError = error.message;
                nft.metadataLoading = false;
              });

            nft.metadataLoading = true;
          }
        }
      }

      nftStore.nfts = nfts;
      nftStore.lastUpdated.nfts = Date.now();
      cache.setNFTs(account, network, nfts);

      console.log(`[Store] Loaded ${nfts.length} NFTs for ${account}`);
    } catch (error: any) {
      console.error('[Store] Error loading NFTs:', error);

      nftStore.errors.nfts = {
        code: error.data?.error || 'LOAD_NFTS_ERROR',
        message: error.message || 'Failed to load NFTs',
        timestamp: Date.now(),
        context: 'loadNFTs',
      };
    } finally {
      nftStore.loading.nfts = false;
    }
  },

  async loadNFTOffers(nftId: string, network: NetworkType = nftStore.selectedNetwork): Promise<void> {
    console.log(`[Store] Loading offers for ${nftId} on ${network}`);

    nftStore.loading.offers = true;
    nftStore.errors.offers = null;

    try {
      const cachedOffers = cache.getOffers(nftId, network);
      if (cachedOffers) {
        nftStore.sellOffers = cachedOffers.sell;
        nftStore.buyOffers = cachedOffers.buy;
        nftStore.loading.offers = false;
        nftStore.lastUpdated.offers = Date.now();
        return;
      }

      let sellOffers: OfferData[] = [];
      let buyOffers: OfferData[] = [];

      if (network === 'xrpl') {
        const client = await getXRPLClient();

        try {
          const sellResponse = await client.request({
            command: 'nft_sell_offers',
            nft_id: nftId,
          });
          sellOffers = sellResponse.offers.map(offer => normalizeXRPLOffer(offer, network, true));
        } catch (error: any) {
          if (error.data?.error !== 'objectNotFound') throw error;
        }

        try {
          const buyResponse = await client.request({
            command: 'nft_buy_offers',
            nft_id: nftId,
          });
          buyOffers = buyResponse.offers.map(offer => normalizeXRPLOffer(offer, network, false));
        } catch (error: any) {
          if (error.data?.error !== 'objectNotFound') throw error;
        }
      } else {
        const client = await getXahauClient();

        try {
          const sellResponse = await client.request({
            command: 'nft_sell_offers',
            nft_id: nftId,
            include_metadata: true,
          });
          sellOffers = sellResponse.offers.map(offer => normalizeXahauOffer(offer, network, true));
        } catch (error: any) {
          if (error.data?.error !== 'objectNotFound') throw error;
        }

        try {
          const buyResponse = await client.request({
            command: 'nft_buy_offers',
            nft_id: nftId,
            include_metadata: true,
          });
          buyOffers = buyResponse.offers.map(offer => normalizeXahauOffer(offer, network, false));
        } catch (error: any) {
          if (error.data?.error !== 'objectNotFound') throw error;
        }
      }

      nftStore.sellOffers = sellOffers;
      nftStore.buyOffers = buyOffers;
      nftStore.lastUpdated.offers = Date.now();

      cache.setOffers(nftId, network, { sell: sellOffers, buy: buyOffers });

      console.log(`[Store] Loaded ${sellOffers.length} sell offers and ${buyOffers.length} buy offers`);
    } catch (error: any) {
      console.error('[Store] Error loading offers:', error);

      nftStore.errors.offers = {
        code: error.data?.error || 'LOAD_OFFERS_ERROR',
        message: error.message || 'Failed to load offers',
        timestamp: Date.now(),
        context: 'loadNFTOffers',
      };
    } finally {
      nftStore.loading.offers = false;
    }
  },

  async selectNetwork(network: NetworkType, reloadData: boolean = true): Promise<void> {
    console.log(`[Store] Selecting network: ${network}`);

    if (nftStore.selectedNetwork === network) {
      console.log('[Store] Network already selected');
      return;
    }

    nftStore.selectedNetwork = network;

    if (reloadData && nftStore.currentAccount) {
      await this.loadNFTs(nftStore.currentAccount, network);

      if (nftStore.currentNFT) {
        await this.loadNFTOffers(nftStore.currentNFT.nftId, network);
      }
    }

    console.log(`[Store] Network switched to ${network}`);
  },

  async setCurrentNFT(nft: NFTData | null): Promise<void> {
    console.log(`[Store] Setting current NFT:`, nft?.nftId || 'null');

    nftStore.currentNFT = nft;

    if (nft) {
      await this.loadNFTOffers(nft.nftId, nft.network);
    } else {
      nftStore.sellOffers = [];
      nftStore.buyOffers = [];
    }
  },

  async refreshNFTs(): Promise<void> {
    if (!nftStore.currentAccount) {
      console.warn('[Store] No account loaded to refresh');
      return;
    }

    console.log(`[Store] Refreshing NFTs for ${nftStore.currentAccount}`);
    cache.clearAccount(nftStore.currentAccount);
    await this.loadNFTs(nftStore.currentAccount, nftStore.selectedNetwork);
  },

  async refreshOffers(): Promise<void> {
    if (!nftStore.currentNFT) {
      console.warn('[Store] No NFT selected to refresh offers');
      return;
    }

    console.log(`[Store] Refreshing offers for ${nftStore.currentNFT.nftId}`);
    cache.clearNFT(nftStore.currentNFT.nftId);
    await this.loadNFTOffers(nftStore.currentNFT.nftId, nftStore.selectedNetwork);
  },

  clearStore(): void {
    console.log('[Store] Clearing store');

    nftStore.nfts = [];
    nftStore.currentNFT = null;
    nftStore.sellOffers = [];
    nftStore.buyOffers = [];
    nftStore.selectedNetwork = 'xrpl';
    nftStore.loading = {
      nfts: false,
      offers: false,
      metadata: false,
      transaction: false,
    };
    nftStore.errors = {
      nfts: null,
      offers: null,
      metadata: null,
      transaction: null,
    };
    nftStore.lastUpdated = {
      nfts: null,
      offers: null,
    };
    nftStore.currentAccount = null;

    cache.clear();

    disconnectXRPL();
    disconnectXahau();

    console.log('[Store] Store cleared');
  },

  clearErrors(): void {
    nftStore.errors = {
      nfts: null,
      offers: null,
      metadata: null,
      transaction: null,
    };
  },

  getStats(): {
    totalNFTs: number;
    totalSellOffers: number;
    totalBuyOffers: number;
    network: NetworkType;
    hasErrors: boolean;
    isLoading: boolean;
  } {
    return {
      totalNFTs: nftStore.nfts.length,
      totalSellOffers: nftStore.sellOffers.length,
      totalBuyOffers: nftStore.buyOffers.length,
      network: nftStore.selectedNetwork,
      hasErrors: Object.values(nftStore.errors).some(e => e !== null),
      isLoading: Object.values(nftStore.loading).some(l => l === true),
    };
  },
};

export default {
  store: nftStore,
  actions: storeActions,
  cache,
};

/**
 * NFT Offers API Endpoint
 *
 * Fetches NFT sell/buy offers from both XRPL and Xahau ledgers.
 * Handles data transformation, error handling, and response formatting.
 *
 * @endpoint GET/POST /api/store/nft-offers
 */

import type {
  NFTokenOffer,
  NFTOffersResponse,
} from "~/lib/network/xrpl/types/nftTx";
import type {
  XahauNFTokenOffer,
  XahauNFTOffersResponse,
} from "~/lib/network/xahau/types/nftTx";
import { getXRPLClient } from "~/lib/store/network/xrpl";
import { getXahauClient } from "~/lib/store/network/xahau";

/**
 * Supported networks for NFT offers
 */
export type NetworkType = "xrpl" | "xahau";

/**
 * Request parameters for fetching NFT offers
 */
export interface FetchNFTOffersRequest {
  nftId: string;
  network: NetworkType;
  offerType?: "sell" | "buy" | "both";
  limit?: number;
  marker?: unknown;
}

/**
 * Normalized NFT offer structure (unified for both networks)
 */
export interface NormalizedNFTOffer {
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
  metadata?: string; // Xahau-specific
  royaltyAmount?: string; // Xahau-specific
  createdAt?: number;
  previousTxnId: string;
  previousLedgerSeq: number;
}

/**
 * API response structure
 */
export interface NFTOffersAPIResponse {
  success: boolean;
  data?: {
    nftId: string;
    network: NetworkType;
    sellOffers: NormalizedNFTOffer[];
    buyOffers: NormalizedNFTOffer[];
    totalOffers: number;
    marker?: unknown;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Error codes for NFT offers API
 */
export enum NFTOffersErrorCode {
  INVALID_NFT_ID = "INVALID_NFT_ID",
  NETWORK_ERROR = "NETWORK_ERROR",
  LEDGER_NOT_AVAILABLE = "LEDGER_NOT_AVAILABLE",
  NFT_NOT_FOUND = "NFT_NOT_FOUND",
  INVALID_NETWORK = "INVALID_NETWORK",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/**
 * Validates NFT ID format
 */
function isValidNFTId(nftId: string): boolean {
  // NFT IDs are 64 character hex strings
  return /^[0-9A-Fa-f]{64}$/.test(nftId);
}

/**
 * Converts XRP drops to XRP amount
 */
function dropsToXrp(drops: string): string {
  return (parseInt(drops) / 1_000_000).toString();
}

/**
 * Converts Ripple epoch to ISO date string
 */
function rippleTimeToISOString(rippleTime: number): string {
  // Ripple epoch starts at January 1, 2000 (00:00 UTC)
  const RIPPLE_EPOCH = 946684800;
  const unixTime = rippleTime + RIPPLE_EPOCH;
  return new Date(unixTime * 1000).toISOString();
}

/**
 * Normalizes XRPL NFT offer to common format
 */
function normalizeXRPLOffer(
  offer: NFTokenOffer,
  network: NetworkType,
  isSellOffer: boolean,
): NormalizedNFTOffer {
  const amount =
    typeof offer.Amount === "string"
      ? {
          value: dropsToXrp(offer.Amount),
          currency: "XRP",
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
    expirationDate: offer.Expiration
      ? rippleTimeToISOString(offer.Expiration)
      : undefined,
    flags: offer.Flags,
    isSellOffer,
    network,
    previousTxnId: offer.PreviousTxnID,
    previousLedgerSeq: offer.PreviousTxnLgrSeq,
  };
}

/**
 * Normalizes Xahau NFT offer to common format
 */
function normalizeXahauOffer(
  offer: XahauNFTokenOffer,
  network: NetworkType,
  isSellOffer: boolean,
): NormalizedNFTOffer {
  const amount =
    typeof offer.Amount === "string"
      ? {
          value: dropsToXrp(offer.Amount),
          currency: "XRP",
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
    expirationDate: offer.Expiration
      ? rippleTimeToISOString(offer.Expiration)
      : undefined,
    flags: offer.Flags,
    isSellOffer,
    network,
    metadata: offer.OfferMetadata,
    royaltyAmount: offer.RoyaltyAmount,
    createdAt: offer.CreatedAt,
    previousTxnId: offer.PreviousTxnID,
    previousLedgerSeq: offer.PreviousTxnLgrSeq,
  };
}

/**
 * Fetches sell offers from XRPL
 */
async function fetchXRPLSellOffers(
  nftId: string,
  limit?: number,
  marker?: unknown,
): Promise<NormalizedNFTOffer[]> {
  const client = await getXRPLClient();

  try {
    const response = (await client.request({
      command: "nft_sell_offers",
      nft_id: nftId,
      limit: limit || 50,
      marker,
    })) as NFTOffersResponse;

    return response.offers.map((offer) =>
      normalizeXRPLOffer(offer, "xrpl", true),
    );
  } catch (error: any) {
    if (error.data?.error === "objectNotFound") {
      return [];
    }
    throw error;
  }
}

/**
 * Fetches buy offers from XRPL
 */
async function fetchXRPLBuyOffers(
  nftId: string,
  limit?: number,
  marker?: unknown,
): Promise<NormalizedNFTOffer[]> {
  const client = await getXRPLClient();

  try {
    const response = (await client.request({
      command: "nft_buy_offers",
      nft_id: nftId,
      limit: limit || 50,
      marker,
    })) as NFTOffersResponse;

    return response.offers.map((offer) =>
      normalizeXRPLOffer(offer, "xrpl", false),
    );
  } catch (error: any) {
    if (error.data?.error === "objectNotFound") {
      return [];
    }
    throw error;
  }
}

/**
 * Fetches sell offers from Xahau
 */
async function fetchXahauSellOffers(
  nftId: string,
  limit?: number,
  marker?: unknown,
): Promise<NormalizedNFTOffer[]> {
  const client = await getXahauClient();

  try {
    const response = (await client.request({
      command: "nft_sell_offers",
      nft_id: nftId,
      limit: limit || 50,
      marker,
      include_metadata: true,
    })) as XahauNFTOffersResponse;

    return response.offers.map((offer) =>
      normalizeXahauOffer(offer, "xahau", true),
    );
  } catch (error: any) {
    if (error.data?.error === "objectNotFound") {
      return [];
    }
    throw error;
  }
}

/**
 * Fetches buy offers from Xahau
 */
async function fetchXahauBuyOffers(
  nftId: string,
  limit?: number,
  marker?: unknown,
): Promise<NormalizedNFTOffer[]> {
  const client = await getXahauClient();

  try {
    const response = (await client.request({
      command: "nft_buy_offers",
      nft_id: nftId,
      limit: limit || 50,
      marker,
      include_metadata: true,
    })) as XahauNFTOffersResponse;

    return response.offers.map((offer) =>
      normalizeXahauOffer(offer, "xahau", false),
    );
  } catch (error: any) {
    if (error.data?.error === "objectNotFound") {
      return [];
    }
    throw error;
  }
}

/**
 * Main API handler for fetching NFT offers
 */
export async function fetchNFTOffers(
  request: FetchNFTOffersRequest,
): Promise<NFTOffersAPIResponse> {
  try {
    // Validate NFT ID
    if (!isValidNFTId(request.nftId)) {
      return {
        success: false,
        error: {
          code: NFTOffersErrorCode.INVALID_NFT_ID,
          message:
            "Invalid NFT ID format. Must be a 64-character hexadecimal string.",
        },
      };
    }

    // Validate network
    if (request.network !== "xrpl" && request.network !== "xahau") {
      return {
        success: false,
        error: {
          code: NFTOffersErrorCode.INVALID_NETWORK,
          message: 'Invalid network. Must be "xrpl" or "xahau".',
        },
      };
    }

    const offerType = request.offerType || "both";
    let sellOffers: NormalizedNFTOffer[] = [];
    let buyOffers: NormalizedNFTOffer[] = [];

    // Fetch offers based on network
    if (request.network === "xrpl") {
      if (offerType === "sell" || offerType === "both") {
        sellOffers = await fetchXRPLSellOffers(
          request.nftId,
          request.limit,
          request.marker,
        );
      }
      if (offerType === "buy" || offerType === "both") {
        buyOffers = await fetchXRPLBuyOffers(
          request.nftId,
          request.limit,
          request.marker,
        );
      }
    } else {
      if (offerType === "sell" || offerType === "both") {
        sellOffers = await fetchXahauSellOffers(
          request.nftId,
          request.limit,
          request.marker,
        );
      }
      if (offerType === "buy" || offerType === "both") {
        buyOffers = await fetchXahauBuyOffers(
          request.nftId,
          request.limit,
          request.marker,
        );
      }
    }

    return {
      success: true,
      data: {
        nftId: request.nftId,
        network: request.network,
        sellOffers,
        buyOffers,
        totalOffers: sellOffers.length + buyOffers.length,
      },
    };
  } catch (error: any) {
    console.error("Error fetching NFT offers:", error);

    return {
      success: false,
      error: {
        code: NFTOffersErrorCode.INTERNAL_ERROR,
        message:
          error.message ||
          "An unexpected error occurred while fetching NFT offers.",
        details: error,
      },
    };
  }
}

/**
 * HTTP handler for GET/POST requests
 */
export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const request: FetchNFTOffersRequest =
    req.method === "GET" ? req.query : req.body;

  const response = await fetchNFTOffers(request);

  const statusCode = response.success ? 200 : 400;
  return res.status(statusCode).json(response);
}

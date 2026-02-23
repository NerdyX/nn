/**
 * NFT Buy API Endpoint
 *
 * Creates NFT buy offers/transactions on XRPL and Xahau networks.
 * Handles transaction preparation, signing, and submission.
 *
 * @endpoint POST /api/store/nft-buy
 */

import type { NFTokenCreateOffer } from "~/lib/network/xrpl/types/nftTx";
import type { XahauNFTokenCreateOffer } from "~/lib/network/xahau/types/nftTx";
import { getXRPLClient } from "~/lib/store/network/xrpl";
import { getXahauClient } from "~/lib/store/network/xahau";
import type { NetworkType } from "./nft-offers";

/**
 * Request parameters for creating an NFT buy offer
 */
export interface CreateNFTBuyOfferRequest {
  network: NetworkType;
  account: string; // Buyer's account address
  nftId: string; // NFT ID to purchase
  amount: string; // Amount in drops (XRP) or value (IOU)
  currency?: string; // Currency code (default: XRP)
  issuer?: string; // Issuer for IOUs
  owner?: string; // Current owner of the NFT
  destination?: string; // Restrict offer to specific seller
  expiration?: number; // Offer expiration (Ripple epoch time)
  memos?: Array<{
    type?: string;
    data?: string;
    format?: string;
  }>;
  offerMetadata?: string; // Xahau-specific: Additional metadata
}

/**
 * Response structure for NFT buy offer creation
 */
export interface CreateNFTBuyOfferResponse {
  success: boolean;
  data?: {
    offerId?: string;
    transactionHash: string;
    ledgerIndex?: number;
    validated: boolean;
    account: string;
    nftId: string;
    amount: {
      value: string;
      currency: string;
      issuer?: string;
    };
    network: NetworkType;
    preparedTransaction?: any; // For client-side signing
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Error codes for NFT buy API
 */
export enum NFTBuyErrorCode {
  INVALID_ACCOUNT = "INVALID_ACCOUNT",
  INVALID_NFT_ID = "INVALID_NFT_ID",
  INVALID_AMOUNT = "INVALID_AMOUNT",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  NETWORK_ERROR = "NETWORK_ERROR",
  TRANSACTION_FAILED = "TRANSACTION_FAILED",
  INVALID_NETWORK = "INVALID_NETWORK",
  SIGNING_ERROR = "SIGNING_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  NFT_NOT_FOUND = "NFT_NOT_FOUND",
  OWNER_REQUIRED = "OWNER_REQUIRED",
}

/**
 * Validates XRPL/Xahau account address
 */
function isValidAddress(address: string): boolean {
  // Addresses start with 'r' and are 25-35 characters
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
}

/**
 * Validates NFT ID format
 */
function isValidNFTId(nftId: string): boolean {
  return /^[0-9A-Fa-f]{64}$/.test(nftId);
}

/**
 * Converts XRP to drops
 */
function xrpToDrops(xrp: string): string {
  return (parseFloat(xrp) * 1_000_000).toString();
}

/**
 * Prepares memos for transaction
 */
function prepareMemos(
  memos?: Array<{ type?: string; data?: string; format?: string }>,
) {
  if (!memos || memos.length === 0) return undefined;

  return memos.map((memo) => ({
    Memo: {
      MemoType: memo.type
        ? Buffer.from(memo.type).toString("hex").toUpperCase()
        : undefined,
      MemoData: memo.data
        ? Buffer.from(memo.data).toString("hex").toUpperCase()
        : undefined,
      MemoFormat: memo.format
        ? Buffer.from(memo.format).toString("hex").toUpperCase()
        : undefined,
    },
  }));
}

/**
 * Creates NFT buy offer on XRPL
 */
async function createXRPLBuyOffer(
  request: CreateNFTBuyOfferRequest,
): Promise<CreateNFTBuyOfferResponse> {
  const client = await getXRPLClient();

  try {
    // Prepare the transaction
    const transaction: NFTokenCreateOffer = {
      TransactionType: "NFTokenCreateOffer",
      Account: request.account,
      NFTokenID: request.nftId,
      Amount:
        request.currency && request.currency !== "XRP"
          ? {
              currency: request.currency,
              issuer: request.issuer!,
              value: request.amount,
            }
          : xrpToDrops(request.amount),
      Owner: request.owner,
      Destination: request.destination,
      Expiration: request.expiration,
      Flags: 0, // 0 = buy offer (no tfSellOffer flag)
      Memos: prepareMemos(request.memos),
    };

    // Auto-fill transaction fields (Fee, Sequence, LastLedgerSequence)
    const prepared = await client.autofill(transaction);

    // Note: In a real implementation, you would typically:
    // 1. Return the prepared transaction to the client for signing
    // 2. Or use a wallet/keypair to sign here (not recommended for API endpoints)
    // For this example, we'll return the prepared transaction

    return {
      success: true,
      data: {
        transactionHash: "", // Will be filled after signing and submission
        validated: false,
        account: request.account,
        nftId: request.nftId,
        amount: {
          value: request.amount,
          currency: request.currency || "XRP",
          issuer: request.issuer,
        },
        network: "xrpl",
        preparedTransaction: prepared,
      },
    };
  } catch (error: any) {
    console.error("Error creating XRPL buy offer:", error);

    // Handle specific error cases
    if (error.data?.error === "actNotFound") {
      return {
        success: false,
        error: {
          code: NFTBuyErrorCode.INVALID_ACCOUNT,
          message: "Account not found on the ledger.",
          details: error,
        },
      };
    }

    if (error.data?.error === "objectNotFound") {
      return {
        success: false,
        error: {
          code: NFTBuyErrorCode.NFT_NOT_FOUND,
          message: "NFT not found on the ledger.",
          details: error,
        },
      };
    }

    return {
      success: false,
      error: {
        code: NFTBuyErrorCode.TRANSACTION_FAILED,
        message: error.message || "Failed to create buy offer on XRPL.",
        details: error,
      },
    };
  }
}

/**
 * Creates NFT buy offer on Xahau
 */
async function createXahauBuyOffer(
  request: CreateNFTBuyOfferRequest,
): Promise<CreateNFTBuyOfferResponse> {
  const client = await getXahauClient();

  try {
    // Prepare the transaction with Xahau-specific fields
    const transaction: XahauNFTokenCreateOffer = {
      TransactionType: "NFTokenCreateOffer",
      Account: request.account,
      NFTokenID: request.nftId,
      Amount:
        request.currency && request.currency !== "XRP"
          ? {
              currency: request.currency,
              issuer: request.issuer!,
              value: request.amount,
            }
          : xrpToDrops(request.amount),
      Owner: request.owner,
      Destination: request.destination,
      Expiration: request.expiration,
      Flags: 0, // 0 = buy offer
      Memos: prepareMemos(request.memos),
      OfferMetadata: request.offerMetadata,
    };

    // Auto-fill transaction fields
    const prepared = await client.autofill(transaction);

    return {
      success: true,
      data: {
        transactionHash: "",
        validated: false,
        account: request.account,
        nftId: request.nftId,
        amount: {
          value: request.amount,
          currency: request.currency || "XRP",
          issuer: request.issuer,
        },
        network: "xahau",
        preparedTransaction: prepared,
      },
    };
  } catch (error: any) {
    console.error("Error creating Xahau buy offer:", error);

    if (error.data?.error === "actNotFound") {
      return {
        success: false,
        error: {
          code: NFTBuyErrorCode.INVALID_ACCOUNT,
          message: "Account not found on the Xahau ledger.",
          details: error,
        },
      };
    }

    if (error.data?.error === "objectNotFound") {
      return {
        success: false,
        error: {
          code: NFTBuyErrorCode.NFT_NOT_FOUND,
          message: "NFT not found on the Xahau ledger.",
          details: error,
        },
      };
    }

    return {
      success: false,
      error: {
        code: NFTBuyErrorCode.TRANSACTION_FAILED,
        message: error.message || "Failed to create buy offer on Xahau.",
        details: error,
      },
    };
  }
}

/**
 * Main handler for creating NFT buy offers
 */
export async function createNFTBuyOffer(
  request: CreateNFTBuyOfferRequest,
): Promise<CreateNFTBuyOfferResponse> {
  try {
    // Validate account address
    if (!isValidAddress(request.account)) {
      return {
        success: false,
        error: {
          code: NFTBuyErrorCode.INVALID_ACCOUNT,
          message: "Invalid account address format.",
        },
      };
    }

    // Validate NFT ID
    if (!isValidNFTId(request.nftId)) {
      return {
        success: false,
        error: {
          code: NFTBuyErrorCode.INVALID_NFT_ID,
          message: "Invalid NFT ID format.",
        },
      };
    }

    // Validate amount
    if (!request.amount || parseFloat(request.amount) <= 0) {
      return {
        success: false,
        error: {
          code: NFTBuyErrorCode.INVALID_AMOUNT,
          message: "Invalid amount. Must be greater than 0.",
        },
      };
    }

    // Validate network
    if (request.network !== "xrpl" && request.network !== "xahau") {
      return {
        success: false,
        error: {
          code: NFTBuyErrorCode.INVALID_NETWORK,
          message: 'Invalid network. Must be "xrpl" or "xahau".',
        },
      };
    }

    // Owner is required for buy offers
    if (!request.owner) {
      return {
        success: false,
        error: {
          code: NFTBuyErrorCode.OWNER_REQUIRED,
          message: "Owner address is required for buy offers.",
        },
      };
    }

    // Validate owner address
    if (!isValidAddress(request.owner)) {
      return {
        success: false,
        error: {
          code: NFTBuyErrorCode.INVALID_ACCOUNT,
          message: "Invalid owner address format.",
        },
      };
    }

    // Create buy offer based on network
    if (request.network === "xrpl") {
      return await createXRPLBuyOffer(request);
    } else {
      return await createXahauBuyOffer(request);
    }
  } catch (error: any) {
    console.error("Error in createNFTBuyOffer:", error);

    return {
      success: false,
      error: {
        code: NFTBuyErrorCode.INTERNAL_ERROR,
        message: error.message || "An unexpected error occurred.",
        details: error,
      },
    };
  }
}

/**
 * HTTP handler for POST requests
 */
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const response = await createNFTBuyOffer(req.body);
  const statusCode = response.success ? 200 : 400;

  return res.status(statusCode).json(response);
}

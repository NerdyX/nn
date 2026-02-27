/**
 * NFT Claim API Endpoint
 *
 * Accepts/claims NFT offers on XRPL and Xahau networks.
 * Handles both sell and buy offer acceptance, including brokered trades.
 *
 * @endpoint POST /api/store/nft-claim
 */

import type { NFTokenAcceptOffer } from "~/lib/network/xrpl/types/nftTx";
import type { XahauNFTokenAcceptOffer } from "~/lib/network/xahau/types/nftTx";
import { getXRPLClient } from "~/lib/store/network/xrpl";
import { getXahauClient } from "~/lib/store/network/xahau";
import type { NetworkType } from "../nft-offers";

/**
 * Request parameters for accepting an NFT offer
 */
export interface AcceptNFTOfferRequest {
  network: NetworkType;
  account: string; // Account accepting the offer
  sellOfferId?: string; // Sell offer to accept
  buyOfferId?: string; // Buy offer to accept
  brokerFee?: {
    // Optional broker fee
    value: string;
    currency?: string;
    issuer?: string;
  };
  memos?: Array<{
    type?: string;
    data?: string;
    format?: string;
  }>;
  acceptanceMetadata?: string; // Xahau-specific: Acceptance metadata
}

/**
 * Response structure for NFT offer acceptance
 */
export interface AcceptNFTOfferResponse {
  success: boolean;
  data?: {
    transactionHash: string;
    ledgerIndex?: number;
    validated: boolean;
    account: string;
    nftId?: string;
    offersAccepted: {
      sellOffer?: string;
      buyOffer?: string;
    };
    network: NetworkType;
    brokerFee?: {
      value: string;
      currency: string;
      issuer?: string;
    };
    preparedTransaction?: any; // For client-side signing
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Error codes for NFT claim API
 */
export enum NFTClaimErrorCode {
  INVALID_ACCOUNT = "INVALID_ACCOUNT",
  INVALID_OFFER_ID = "INVALID_OFFER_ID",
  NO_OFFER_SPECIFIED = "NO_OFFER_SPECIFIED",
  OFFER_NOT_FOUND = "OFFER_NOT_FOUND",
  OFFER_EXPIRED = "OFFER_EXPIRED",
  UNAUTHORIZED = "UNAUTHORIZED",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  NETWORK_ERROR = "NETWORK_ERROR",
  TRANSACTION_FAILED = "TRANSACTION_FAILED",
  INVALID_NETWORK = "INVALID_NETWORK",
  INVALID_BROKER_FEE = "INVALID_BROKER_FEE",
  BOTH_OFFERS_SAME_TYPE = "BOTH_OFFERS_SAME_TYPE",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/**
 * Validates XRPL/Xahau account address
 */
function isValidAddress(address: string): boolean {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
}

/**
 * Validates offer ID format (64 character hex string)
 */
function isValidOfferId(offerId: string): boolean {
  return /^[0-9A-Fa-f]{64}$/.test(offerId);
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
 * Prepares broker fee for transaction
 */
function prepareBrokerFee(brokerFee?: {
  value: string;
  currency?: string;
  issuer?: string;
}) {
  if (!brokerFee) return undefined;

  if (brokerFee.currency && brokerFee.currency !== "XRP") {
    return {
      currency: brokerFee.currency,
      issuer: brokerFee.issuer!,
      value: brokerFee.value,
    };
  }

  return xrpToDrops(brokerFee.value);
}

/**
 * Accepts NFT offer on XRPL
 */
async function acceptXRPLOffer(
  request: AcceptNFTOfferRequest,
): Promise<AcceptNFTOfferResponse> {
  const client = await getXRPLClient();

  try {
    // Prepare the transaction
    const transaction: NFTokenAcceptOffer = {
      TransactionType: "NFTokenAcceptOffer",
      Account: request.account,
      NFTokenSellOffer: request.sellOfferId,
      NFTokenBuyOffer: request.buyOfferId,
      NFTokenBrokerFee: prepareBrokerFee(request.brokerFee),
      Memos: prepareMemos(request.memos),
    };

    // Auto-fill transaction fields
    const prepared = await client.autofill(transaction);

    return {
      success: true,
      data: {
        transactionHash: "",
        validated: false,
        account: request.account,
        offersAccepted: {
          sellOffer: request.sellOfferId,
          buyOffer: request.buyOfferId,
        },
        network: "xrpl",
        brokerFee: request.brokerFee,
        preparedTransaction: prepared,
      },
    };
  } catch (error: any) {
    console.error("Error accepting XRPL offer:", error);

    // Handle specific error cases
    if (error.data?.error === "actNotFound") {
      return {
        success: false,
        error: {
          code: NFTClaimErrorCode.INVALID_ACCOUNT,
          message: "Account not found on the ledger.",
          details: error,
        },
      };
    }

    if (error.data?.error === "objectNotFound") {
      return {
        success: false,
        error: {
          code: NFTClaimErrorCode.OFFER_NOT_FOUND,
          message: "Offer not found on the ledger.",
          details: error,
        },
      };
    }

    if (error.data?.error === "tecEXPIRED") {
      return {
        success: false,
        error: {
          code: NFTClaimErrorCode.OFFER_EXPIRED,
          message: "The offer has expired.",
          details: error,
        },
      };
    }

    if (error.data?.error === "tecINSUFFICIENT_FUNDS") {
      return {
        success: false,
        error: {
          code: NFTClaimErrorCode.INSUFFICIENT_BALANCE,
          message: "Insufficient balance to accept this offer.",
          details: error,
        },
      };
    }

    return {
      success: false,
      error: {
        code: NFTClaimErrorCode.TRANSACTION_FAILED,
        message: error.message || "Failed to accept offer on XRPL.",
        details: error,
      },
    };
  }
}

/**
 * Accepts NFT offer on Xahau
 */
async function acceptXahauOffer(
  request: AcceptNFTOfferRequest,
): Promise<AcceptNFTOfferResponse> {
  const client = await getXahauClient();

  try {
    // Prepare the transaction with Xahau-specific fields
    const transaction: XahauNFTokenAcceptOffer = {
      TransactionType: "NFTokenAcceptOffer",
      Account: request.account,
      NFTokenSellOffer: request.sellOfferId,
      NFTokenBuyOffer: request.buyOfferId,
      NFTokenBrokerFee: prepareBrokerFee(request.brokerFee),
      Memos: prepareMemos(request.memos),
      AcceptanceMetadata: request.acceptanceMetadata,
    };

    // Auto-fill transaction fields
    const prepared = await client.autofill(transaction);

    return {
      success: true,
      data: {
        transactionHash: "",
        validated: false,
        account: request.account,
        offersAccepted: {
          sellOffer: request.sellOfferId,
          buyOffer: request.buyOfferId,
        },
        network: "xahau",
        brokerFee: request.brokerFee,
        preparedTransaction: prepared,
      },
    };
  } catch (error: any) {
    console.error("Error accepting Xahau offer:", error);

    if (error.data?.error === "actNotFound") {
      return {
        success: false,
        error: {
          code: NFTClaimErrorCode.INVALID_ACCOUNT,
          message: "Account not found on the Xahau ledger.",
          details: error,
        },
      };
    }

    if (error.data?.error === "objectNotFound") {
      return {
        success: false,
        error: {
          code: NFTClaimErrorCode.OFFER_NOT_FOUND,
          message: "Offer not found on the Xahau ledger.",
          details: error,
        },
      };
    }

    if (error.data?.error === "tecEXPIRED") {
      return {
        success: false,
        error: {
          code: NFTClaimErrorCode.OFFER_EXPIRED,
          message: "The offer has expired.",
          details: error,
        },
      };
    }

    if (error.data?.error === "tecINSUFFICIENT_FUNDS") {
      return {
        success: false,
        error: {
          code: NFTClaimErrorCode.INSUFFICIENT_BALANCE,
          message: "Insufficient balance to accept this offer.",
          details: error,
        },
      };
    }

    return {
      success: false,
      error: {
        code: NFTClaimErrorCode.TRANSACTION_FAILED,
        message: error.message || "Failed to accept offer on Xahau.",
        details: error,
      },
    };
  }
}

/**
 * Main handler for accepting NFT offers
 */
export async function acceptNFTOffer(
  request: AcceptNFTOfferRequest,
): Promise<AcceptNFTOfferResponse> {
  try {
    // Validate account address
    if (!isValidAddress(request.account)) {
      return {
        success: false,
        error: {
          code: NFTClaimErrorCode.INVALID_ACCOUNT,
          message: "Invalid account address format.",
        },
      };
    }

    // At least one offer must be specified
    if (!request.sellOfferId && !request.buyOfferId) {
      return {
        success: false,
        error: {
          code: NFTClaimErrorCode.NO_OFFER_SPECIFIED,
          message:
            "At least one offer (sell or buy) must be specified to accept.",
        },
      };
    }

    // Validate sell offer ID if provided
    if (request.sellOfferId && !isValidOfferId(request.sellOfferId)) {
      return {
        success: false,
        error: {
          code: NFTClaimErrorCode.INVALID_OFFER_ID,
          message:
            "Invalid sell offer ID format. Must be a 64-character hexadecimal string.",
        },
      };
    }

    // Validate buy offer ID if provided
    if (request.buyOfferId && !isValidOfferId(request.buyOfferId)) {
      return {
        success: false,
        error: {
          code: NFTClaimErrorCode.INVALID_OFFER_ID,
          message:
            "Invalid buy offer ID format. Must be a 64-character hexadecimal string.",
        },
      };
    }

    // Validate network
    if (request.network !== "xrpl" && request.network !== "xahau") {
      return {
        success: false,
        error: {
          code: NFTClaimErrorCode.INVALID_NETWORK,
          message: 'Invalid network. Must be "xrpl" or "xahau".',
        },
      };
    }

    // Validate broker fee if provided
    if (request.brokerFee) {
      // Broker fee can only be used when both sell and buy offers are specified (brokered mode)
      if (!request.sellOfferId || !request.buyOfferId) {
        return {
          success: false,
          error: {
            code: NFTClaimErrorCode.INVALID_BROKER_FEE,
            message:
              "Broker fee can only be specified when accepting both a sell and buy offer (brokered transaction).",
          },
        };
      }

      // Validate broker fee amount
      if (!request.brokerFee.value || parseFloat(request.brokerFee.value) < 0) {
        return {
          success: false,
          error: {
            code: NFTClaimErrorCode.INVALID_BROKER_FEE,
            message: "Broker fee value must be a positive number.",
          },
        };
      }

      // Validate issuer is provided for non-XRP currencies
      if (
        request.brokerFee.currency &&
        request.brokerFee.currency !== "XRP" &&
        !request.brokerFee.issuer
      ) {
        return {
          success: false,
          error: {
            code: NFTClaimErrorCode.INVALID_BROKER_FEE,
            message: "Issuer is required for non-XRP broker fees.",
          },
        };
      }

      // Validate issuer address format if provided
      if (
        request.brokerFee.issuer &&
        !isValidAddress(request.brokerFee.issuer)
      ) {
        return {
          success: false,
          error: {
            code: NFTClaimErrorCode.INVALID_BROKER_FEE,
            message: "Invalid broker fee issuer address format.",
          },
        };
      }
    }

    // Accept offer based on network
    if (request.network === "xrpl") {
      return await acceptXRPLOffer(request);
    } else {
      return await acceptXahauOffer(request);
    }
  } catch (error: any) {
    console.error("Error in acceptNFTOffer:", error);

    return {
      success: false,
      error: {
        code: NFTClaimErrorCode.INTERNAL_ERROR,
        message:
          error.message ||
          "An unexpected error occurred while accepting the offer.",
        details: error,
      },
    };
  }
}

/**
 * HTTP handler for POST requests
 *
 * This function can be used as an API route handler in various frameworks:
 * - Next.js API routes
 * - Express.js routes
 * - Qwik City endpoints
 * - Any framework that provides req/res objects
 *
 * @param req - HTTP request object with body containing AcceptNFTOfferRequest
 * @param res - HTTP response object
 *
 * @example
 * // Next.js API route: pages/api/store/nft-claim/index.ts
 * export default handler;
 *
 * @example
 * // Qwik City endpoint: src/routes/api/store/nft-claim/index.ts
 * export const onPost: RequestHandler = async ({ request, json }) => {
 *   const body = await request.json();
 *   const response = await acceptNFTOffer(body);
 *   const statusCode = response.success ? 200 : 400;
 *   json(statusCode, response);
 * };
 */
export default async function handler(req: any, res: any) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Method not allowed. Only POST requests are supported.",
      },
    });
  }

  // Parse request body
  let requestBody: AcceptNFTOfferRequest;

  try {
    requestBody = req.body;

    // Validate that request body exists
    if (!requestBody || typeof requestBody !== "object") {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REQUEST_BODY",
          message:
            "Invalid request body. Expected JSON object with AcceptNFTOfferRequest structure.",
        },
      });
    }
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Invalid JSON in request body.",
        details: error.message,
      },
    });
  }

  // Process the request
  const response = await acceptNFTOffer(requestBody);

  // Set appropriate status code
  const statusCode = response.success ? 200 : 400;

  // Return response
  return res.status(statusCode).json(response);
}

/**
 * Alternative export for Qwik City endpoints
 *
 * @example
 * // src/routes/api/store/nft-claim/index.ts
 * import { onPost } from './handler';
 * export { onPost };
 */
export const onPost = async ({ request, json }: any) => {
  try {
    const body = await request.json();
    const response = await acceptNFTOffer(body);
    const statusCode = response.success ? 200 : 400;
    return json(statusCode, response);
  } catch (error: any) {
    return json(400, {
      success: false,
      error: {
        code: NFTClaimErrorCode.INTERNAL_ERROR,
        message: error.message || "Failed to process request.",
        details: error,
      },
    });
  }
};

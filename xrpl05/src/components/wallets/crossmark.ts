// src/components/wallets/crossmark.ts
// Crossmark Wallet Adapter for XRPL/Xahau
// Crossmark is a browser extension that injects window.xrpl.crossmark

// ──────────────────────────────────────────────
// Types for the Crossmark injected API
// ──────────────────────────────────────────────

interface CrossmarkResponse {
  request: {
    id: string;
    command: string;
  };
  response: {
    data: {
      address?: string;
      publicKey?: string;
      network?: {
        type: string;
        wss: string;
      };
      meta?: {
        isError: boolean;
        isExpired: boolean;
        isPending: boolean;
        isRejected: boolean;
        isSigned: boolean;
        isSuccess: boolean;
      };
      resp?: {
        result?: {
          hash?: string;
          tx_json?: Record<string, unknown>;
          engine_result?: string;
          engine_result_message?: string;
        };
      };
    };
  };
}

interface CrossmarkAPI {
  methods: {
    signInAndWait: () => Promise<CrossmarkResponse>;
    signAndSubmitAndWait: (
      tx: Record<string, unknown>,
    ) => Promise<CrossmarkResponse>;
    signAndWait: (tx: Record<string, unknown>) => Promise<CrossmarkResponse>;
  };
}

interface WindowWithCrossmark extends Window {
  xrpl?: {
    crossmark?: CrossmarkAPI;
  };
  crossmark?: CrossmarkAPI;
}

// ──────────────────────────────────────────────
// Detection
// ──────────────────────────────────────────────

/**
 * Check if the Crossmark extension is installed and available.
 * The extension injects `window.xrpl.crossmark` or `window.crossmark`.
 */
export function isCrossmarkInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as WindowWithCrossmark;
  return !!(win.xrpl?.crossmark || win.crossmark);
}

/**
 * Get the Crossmark API handle, throwing if not installed.
 */
function getCrossmarkApi(): CrossmarkAPI {
  const win = window as unknown as WindowWithCrossmark;
  const api = win.xrpl?.crossmark ?? win.crossmark;
  if (!api) {
    throw new Error(
      "Crossmark wallet extension is not installed. Please install it from https://crossmark.io",
    );
  }
  return api;
}

// ──────────────────────────────────────────────
// Connection
// ──────────────────────────────────────────────

export interface CrossmarkConnectResult {
  address: string;
  publicKey: string | null;
  network: string | null;
}

/**
 * Connect (sign in) to the Crossmark wallet.
 * This will open the Crossmark popup asking the user
 * to approve the sign-in request.
 *
 * @returns The connected r-address and optional public key.
 */
export async function connectCrossmark(): Promise<CrossmarkConnectResult> {
  const api = getCrossmarkApi();

  try {
    const result = await api.methods.signInAndWait();

    const address = result.response?.data?.address;
    if (!address) {
      throw new Error("Crossmark sign-in did not return an address");
    }

    return {
      address,
      publicKey: result.response?.data?.publicKey ?? null,
      network: result.response?.data?.network?.type ?? null,
    };
  } catch (err) {
    if (err instanceof Error) {
      // Check for user rejection
      if (
        err.message.includes("rejected") ||
        err.message.includes("cancelled") ||
        err.message.includes("denied")
      ) {
        throw new Error("User rejected the Crossmark sign-in request");
      }
      throw err;
    }
    throw new Error("Crossmark sign-in failed: unknown error");
  }
}

// ──────────────────────────────────────────────
// Transaction Signing
// ──────────────────────────────────────────────

export interface CrossmarkSignResult {
  hash: string | null;
  engineResult: string | null;
  engineResultMessage: string | null;
  signed: boolean;
}

/**
 * Sign and submit a transaction via Crossmark.
 *
 * @param txjson - The XRPL/Xahau transaction JSON
 *                 (must include TransactionType, and Account
 *                  will be auto-filled by Crossmark if omitted)
 * @param submitAfterSign - If true (default), Crossmark will
 *                          sign AND submit the transaction.
 *                          If false, it only signs (returns hex).
 * @returns The transaction result
 */
export async function signWithCrossmark(
  txjson: Record<string, unknown>,
  submitAfterSign = true,
): Promise<CrossmarkSignResult> {
  const api = getCrossmarkApi();

  try {
    let result: CrossmarkResponse;

    if (submitAfterSign) {
      result = await api.methods.signAndSubmitAndWait(txjson);
    } else {
      result = await api.methods.signAndWait(txjson);
    }

    const meta = result.response?.data?.meta;
    const resp = result.response?.data?.resp?.result;

    if (meta?.isRejected || meta?.isExpired) {
      throw new Error("Transaction was rejected or expired in Crossmark");
    }

    if (meta?.isError) {
      throw new Error(
        `Crossmark transaction error: ${resp?.engine_result_message ?? "Unknown error"}`,
      );
    }

    return {
      hash: resp?.hash ?? null,
      engineResult: resp?.engine_result ?? null,
      engineResultMessage: resp?.engine_result_message ?? null,
      signed: meta?.isSigned ?? false,
    };
  } catch (err) {
    if (err instanceof Error) {
      if (
        err.message.includes("rejected") ||
        err.message.includes("cancelled") ||
        err.message.includes("denied")
      ) {
        throw new Error("User rejected the Crossmark transaction");
      }
      throw err;
    }
    throw new Error("Crossmark transaction failed: unknown error");
  }
}

// ──────────────────────────────────────────────
// Disconnect
// ──────────────────────────────────────────────

/**
 * Crossmark is a browser extension and doesn't have a formal
 * "disconnect" API. This function is a no-op but is provided
 * for interface consistency with other wallet adapters.
 *
 * Clearing the session is handled by the WalletContext.
 */
export function disconnectCrossmark(): void {
  // No-op — Crossmark doesn't maintain a persistent session
  // that needs to be explicitly torn down from the dApp side.
}

// ──────────────────────────────────────────────
// Convenience: Sign a specific transaction type
// ──────────────────────────────────────────────

/**
 * Create a Payment transaction and sign it via Crossmark.
 */
export async function sendPaymentCrossmark(
  destination: string,
  amountDrops: string,
  destinationTag?: number,
): Promise<CrossmarkSignResult> {
  const tx: Record<string, unknown> = {
    TransactionType: "Payment",
    Destination: destination,
    Amount: amountDrops,
  };
  if (destinationTag !== undefined) {
    tx.DestinationTag = destinationTag;
  }
  return signWithCrossmark(tx);
}

/**
 * Create an NFTokenMint transaction and sign it via Crossmark.
 */
export async function mintNFTCrossmark(
  uri: string,
  taxon: number,
  flags?: number,
  transferFee?: number,
): Promise<CrossmarkSignResult> {
  const tx: Record<string, unknown> = {
    TransactionType: "NFTokenMint",
    URI: uri,
    NFTokenTaxon: taxon,
  };
  if (flags !== undefined) tx.Flags = flags;
  if (transferFee !== undefined) tx.TransferFee = transferFee;
  return signWithCrossmark(tx);
}

/**
 * Accept an NFT offer via Crossmark.
 */
export async function acceptNFTOfferCrossmark(
  offerIndex: string,
  isSellOffer: boolean,
): Promise<CrossmarkSignResult> {
  const tx: Record<string, unknown> = {
    TransactionType: "NFTokenAcceptOffer",
  };
  if (isSellOffer) {
    tx.NFTokenSellOffer = offerIndex;
  } else {
    tx.NFTokenBuyOffer = offerIndex;
  }
  return signWithCrossmark(tx);
}

/**
 * Create an NFT offer (buy or sell) via Crossmark.
 */
export async function createNFTOfferCrossmark(
  nftokenId: string,
  amountDrops: string,
  isSellOffer: boolean,
  destination?: string,
  expiration?: number,
): Promise<CrossmarkSignResult> {
  const tx: Record<string, unknown> = {
    TransactionType: "NFTokenCreateOffer",
    NFTokenID: nftokenId,
    Amount: amountDrops,
    Flags: isSellOffer ? 1 : 0, // tfSellNFToken = 1
  };
  if (destination) tx.Destination = destination;
  if (expiration) tx.Expiration = expiration;
  return signWithCrossmark(tx);
}

/**
 * Claim a reward on Xahau via Crossmark.
 */
export async function claimRewardCrossmark(
  issuer?: string,
): Promise<CrossmarkSignResult> {
  const tx: Record<string, unknown> = {
    TransactionType: "ClaimReward",
  };
  if (issuer) tx.Issuer = issuer;
  return signWithCrossmark(tx);
}

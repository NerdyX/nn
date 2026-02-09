// src/components/wallets/gem.ts
// GemWallet Adapter for XRPL/Xahau
// GemWallet is a browser extension that injects window.gemWallet
// Docs: https://docs.gemwallet.app/

// ──────────────────────────────────────────────
// Types for the GemWallet injected API
// ──────────────────────────────────────────────

interface GemWalletResponse<T = unknown> {
  type: string;
  result?: T;
}

interface GemWalletAddress {
  address: string;
}

interface GemWalletPublicKey {
  publicKey: string;
}

interface GemWalletNetwork {
  network: {
    name: string;
    server: string;
    description?: string;
  };
}

interface GemWalletNFT {
  account_nfts: Array<{
    Flags: number;
    Issuer: string;
    NFTokenID: string;
    NFTokenTaxon: number;
    URI?: string;
    nft_serial: number;
  }>;
}

interface GemWalletSignResult {
  type: string;
  result?: {
    hash?: string;
    tx_blob?: string;
  };
}

interface GemWalletSubmitResult {
  type: string;
  result?: {
    hash?: string;
    engine_result?: string;
    engine_result_message?: string;
  };
}

interface GemWalletIsInstalledResult {
  result: {
    isInstalled: boolean;
  };
}

interface GemWalletAPI {
  isInstalled: () => Promise<GemWalletIsInstalledResult>;
  getAddress: () => Promise<GemWalletResponse<GemWalletAddress>>;
  getPublicKey: () => Promise<GemWalletResponse<GemWalletPublicKey>>;
  getNetwork: () => Promise<GemWalletResponse<GemWalletNetwork>>;
  getNFTs: (params?: {
    limit?: number;
    marker?: unknown;
  }) => Promise<GemWalletResponse<GemWalletNFT>>;
  signTransaction: (params: {
    transaction: Record<string, unknown>;
  }) => Promise<GemWalletSignResult>;
  submitTransaction: (params: {
    transaction: Record<string, unknown>;
  }) => Promise<GemWalletSubmitResult>;
  signMessage: (params: {
    message: string;
  }) => Promise<GemWalletResponse<{ signedMessage: string }>>;
  sendPayment: (params: {
    amount: string;
    destination: string;
    memos?: Array<{ memo: { memoType?: string; memoData?: string } }>;
    destinationTag?: number;
    fee?: string;
    flags?: number;
  }) => Promise<GemWalletSubmitResult>;
  setTrustline: (params: {
    limitAmount: {
      currency: string;
      issuer: string;
      value: string;
    };
    fee?: string;
    flags?: number;
  }) => Promise<GemWalletSubmitResult>;
  mintNFT: (params: {
    URI: string;
    flags?: number;
    transferFee?: number;
    NFTokenTaxon: number;
    memos?: Array<{ memo: { memoType?: string; memoData?: string } }>;
    fee?: string;
  }) => Promise<GemWalletSubmitResult>;
  createNFTOffer: (params: {
    NFTokenID: string;
    amount: string;
    owner?: string;
    expiration?: number;
    destination?: string;
    flags?: number;
    memos?: Array<{ memo: { memoType?: string; memoData?: string } }>;
    fee?: string;
  }) => Promise<GemWalletSubmitResult>;
  acceptNFTOffer: (params: {
    NFTokenSellOffer?: string;
    NFTokenBuyOffer?: string;
    NFTokenBrokerFee?: string;
    memos?: Array<{ memo: { memoType?: string; memoData?: string } }>;
    fee?: string;
  }) => Promise<GemWalletSubmitResult>;
  cancelNFTOffer: (params: {
    NFTokenOffers: string[];
    memos?: Array<{ memo: { memoType?: string; memoData?: string } }>;
    fee?: string;
  }) => Promise<GemWalletSubmitResult>;
  burnNFT: (params: {
    NFTokenID: string;
    owner?: string;
    memos?: Array<{ memo: { memoType?: string; memoData?: string } }>;
    fee?: string;
  }) => Promise<GemWalletSubmitResult>;
  createOffer: (params: {
    takerGets: string | { currency: string; issuer: string; value: string };
    takerPays: string | { currency: string; issuer: string; value: string };
    expiration?: number;
    flags?: number;
    memos?: Array<{ memo: { memoType?: string; memoData?: string } }>;
    fee?: string;
  }) => Promise<GemWalletSubmitResult>;
  cancelOffer: (params: {
    offerSequence: number;
    memos?: Array<{ memo: { memoType?: string; memoData?: string } }>;
    fee?: string;
  }) => Promise<GemWalletSubmitResult>;
}

interface WindowWithGemWallet extends Window {
  gemWallet?: GemWalletAPI;
  GemWalletApi?: GemWalletAPI;
}

// ──────────────────────────────────────────────
// Detection
// ──────────────────────────────────────────────

/**
 * Check if the GemWallet browser extension is installed
 * and available in the current window context.
 *
 * GemWallet injects either `window.gemWallet` or
 * `window.GemWalletApi` depending on the version.
 */
export function isGemWalletAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as WindowWithGemWallet;
  return !!(win.gemWallet || win.GemWalletApi);
}

/**
 * Async check using GemWallet's own isInstalled() method.
 * Falls back to the synchronous window check if the API
 * method is unavailable.
 */
export async function isGemWalletInstalled(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const api = getGemWalletApiSafe();
  if (!api) return false;

  try {
    if (typeof api.isInstalled === "function") {
      const res = await api.isInstalled();
      return res?.result?.isInstalled === true;
    }
    return true; // If the object exists but has no isInstalled, assume installed
  } catch {
    return false;
  }
}

/**
 * Get the GemWallet API handle, returning null if not installed.
 */
function getGemWalletApiSafe(): GemWalletAPI | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as WindowWithGemWallet;
  return win.gemWallet ?? win.GemWalletApi ?? null;
}

/**
 * Get the GemWallet API handle, throwing if not installed.
 */
function getGemWalletApi(): GemWalletAPI {
  const api = getGemWalletApiSafe();
  if (!api) {
    throw new Error(
      "GemWallet extension is not installed. Please install it from https://gemwallet.app",
    );
  }
  return api;
}

// ──────────────────────────────────────────────
// Connection
// ──────────────────────────────────────────────

export interface GemConnectResult {
  address: string;
  publicKey: string | null;
  network: string | null;
  networkServer: string | null;
}

/**
 * Connect to GemWallet by requesting the user's address.
 * This will open the GemWallet popup for the user to approve.
 *
 * @returns The connected r-address, optional public key, and network info.
 */
export async function connectGemWallet(): Promise<GemConnectResult> {
  const api = getGemWalletApi();

  try {
    // Request address (triggers user approval popup)
    const addressRes = await api.getAddress();
    const address = addressRes.result?.address;

    if (!address) {
      throw new Error(
        "GemWallet did not return an address. The user may have rejected the request.",
      );
    }

    // Fetch optional public key (non-blocking)
    let publicKey: string | null = null;
    try {
      const pkRes = await api.getPublicKey();
      publicKey = pkRes.result?.publicKey ?? null;
    } catch {
      // Public key request may fail; non-critical
    }

    // Fetch network info (non-blocking)
    let network: string | null = null;
    let networkServer: string | null = null;
    try {
      const netRes = await api.getNetwork();
      const netData = netRes.result as unknown as GemWalletNetwork;
      network = netData?.network?.name ?? null;
      networkServer = netData?.network?.server ?? null;
    } catch {
      // Network info may fail; non-critical
    }

    return {
      address,
      publicKey,
      network,
      networkServer,
    };
  } catch (err) {
    if (err instanceof Error) {
      // GemWallet rejects with specific error messages
      if (
        err.message.includes("rejected") ||
        err.message.includes("cancelled") ||
        err.message.includes("denied") ||
        err.message.includes("User refused")
      ) {
        throw new Error("User rejected the GemWallet connection request");
      }
      throw err;
    }
    throw new Error("GemWallet connection failed: unknown error");
  }
}

// ──────────────────────────────────────────────
// Transaction Signing & Submission
// ──────────────────────────────────────────────

export interface GemSignResult {
  hash: string | null;
  engineResult: string | null;
  engineResultMessage: string | null;
  signed: boolean;
  txBlob: string | null;
}

/**
 * Sign and submit an arbitrary transaction via GemWallet.
 *
 * @param txjson - The XRPL/Xahau transaction JSON.
 *                 Must include TransactionType.
 *                 Account is auto-filled by GemWallet.
 * @returns The transaction result including hash and engine result.
 */
export async function signWithGemWallet(
  txjson: Record<string, unknown>,
): Promise<GemSignResult> {
  const api = getGemWalletApi();

  try {
    const result = await api.submitTransaction({
      transaction: txjson,
    });

    if (!result.result) {
      throw new Error("GemWallet did not return a transaction result");
    }

    return {
      hash: result.result.hash ?? null,
      engineResult: result.result.engine_result ?? null,
      engineResultMessage: result.result.engine_result_message ?? null,
      signed: true,
      txBlob: null,
    };
  } catch (err) {
    if (err instanceof Error) {
      if (
        err.message.includes("rejected") ||
        err.message.includes("cancelled") ||
        err.message.includes("denied") ||
        err.message.includes("User refused")
      ) {
        throw new Error("User rejected the GemWallet transaction");
      }
      throw err;
    }
    throw new Error("GemWallet transaction failed: unknown error");
  }
}

/**
 * Sign a transaction via GemWallet WITHOUT submitting it.
 * Returns the signed transaction blob for manual submission.
 *
 * @param txjson - The XRPL/Xahau transaction JSON.
 * @returns The signed tx_blob.
 */
export async function signOnlyWithGemWallet(
  txjson: Record<string, unknown>,
): Promise<GemSignResult> {
  const api = getGemWalletApi();

  try {
    const result = await api.signTransaction({
      transaction: txjson,
    });

    if (!result.result) {
      throw new Error("GemWallet did not return a signed transaction");
    }

    return {
      hash: result.result.hash ?? null,
      engineResult: null,
      engineResultMessage: null,
      signed: true,
      txBlob: result.result.tx_blob ?? null,
    };
  } catch (err) {
    if (err instanceof Error) {
      if (
        err.message.includes("rejected") ||
        err.message.includes("cancelled") ||
        err.message.includes("denied") ||
        err.message.includes("User refused")
      ) {
        throw new Error("User rejected the GemWallet signing request");
      }
      throw err;
    }
    throw new Error("GemWallet signing failed: unknown error");
  }
}

// ──────────────────────────────────────────────
// Disconnect
// ──────────────────────────────────────────────

/**
 * GemWallet is a browser extension and does not maintain
 * a persistent session that can be explicitly "disconnected"
 * from the dApp side. This function is a no-op provided for
 * interface consistency with other wallet adapters.
 *
 * Clearing the session is handled by the WalletContext.
 */
export function disconnectGemWallet(): void {
  // No-op — GemWallet doesn't require explicit disconnect
}

// ──────────────────────────────────────────────
// Convenience: Payment
// ──────────────────────────────────────────────

/**
 * Send a payment using GemWallet's native sendPayment API.
 * This uses GemWallet's built-in Payment UI for a better UX.
 *
 * @param destination - The destination r-address
 * @param amountDrops - Amount in drops (1 XRP = 1,000,000 drops)
 * @param destinationTag - Optional destination tag
 */
export async function sendPaymentGemWallet(
  destination: string,
  amountDrops: string,
  destinationTag?: number,
): Promise<GemSignResult> {
  const api = getGemWalletApi();

  try {
    const params: Parameters<GemWalletAPI["sendPayment"]>[0] = {
      amount: amountDrops,
      destination,
    };
    if (destinationTag !== undefined) {
      params.destinationTag = destinationTag;
    }

    const result = await api.sendPayment(params);

    return {
      hash: result.result?.hash ?? null,
      engineResult: result.result?.engine_result ?? null,
      engineResultMessage: result.result?.engine_result_message ?? null,
      signed: true,
      txBlob: null,
    };
  } catch (err) {
    if (err instanceof Error) {
      if (
        err.message.includes("rejected") ||
        err.message.includes("User refused")
      ) {
        throw new Error("User rejected the GemWallet payment");
      }
      throw err;
    }
    throw new Error("GemWallet payment failed: unknown error");
  }
}

// ──────────────────────────────────────────────
// Convenience: Trust Lines
// ──────────────────────────────────────────────

/**
 * Set a trust line using GemWallet's native setTrustline API.
 *
 * @param currency - The currency code (3-char or hex)
 * @param issuer - The issuer r-address
 * @param value - The trust line limit
 */
export async function setTrustlineGemWallet(
  currency: string,
  issuer: string,
  value: string,
): Promise<GemSignResult> {
  const api = getGemWalletApi();

  try {
    const result = await api.setTrustline({
      limitAmount: { currency, issuer, value },
    });

    return {
      hash: result.result?.hash ?? null,
      engineResult: result.result?.engine_result ?? null,
      engineResultMessage: result.result?.engine_result_message ?? null,
      signed: true,
      txBlob: null,
    };
  } catch (err) {
    if (err instanceof Error) {
      if (
        err.message.includes("rejected") ||
        err.message.includes("User refused")
      ) {
        throw new Error("User rejected the GemWallet trust line request");
      }
      throw err;
    }
    throw new Error("GemWallet trust line failed: unknown error");
  }
}

// ──────────────────────────────────────────────
// Convenience: NFTs
// ──────────────────────────────────────────────

/**
 * Mint an NFT using GemWallet's native mintNFT API.
 *
 * @param uri - The NFT URI (hex-encoded)
 * @param taxon - The NFTokenTaxon
 * @param flags - Optional flags (e.g. 8 for transferable)
 * @param transferFee - Optional transfer fee (0-50000, where 50000 = 50%)
 */
export async function mintNFTGemWallet(
  uri: string,
  taxon: number,
  flags?: number,
  transferFee?: number,
): Promise<GemSignResult> {
  const api = getGemWalletApi();

  try {
    const params: Parameters<GemWalletAPI["mintNFT"]>[0] = {
      URI: uri,
      NFTokenTaxon: taxon,
    };
    if (flags !== undefined) params.flags = flags;
    if (transferFee !== undefined) params.transferFee = transferFee;

    const result = await api.mintNFT(params);

    return {
      hash: result.result?.hash ?? null,
      engineResult: result.result?.engine_result ?? null,
      engineResultMessage: result.result?.engine_result_message ?? null,
      signed: true,
      txBlob: null,
    };
  } catch (err) {
    if (err instanceof Error) {
      if (
        err.message.includes("rejected") ||
        err.message.includes("User refused")
      ) {
        throw new Error("User rejected the GemWallet NFT mint");
      }
      throw err;
    }
    throw new Error("GemWallet NFT mint failed: unknown error");
  }
}

/**
 * Create an NFT offer (buy or sell) using GemWallet's native API.
 *
 * @param nftokenId - The NFTokenID to make an offer on
 * @param amountDrops - The amount in drops
 * @param isSellOffer - If true, creates a sell offer (flag 1)
 * @param owner - For buy offers, the current owner of the NFT
 * @param destination - Optional destination (private offer)
 * @param expiration - Optional Ripple epoch expiration time
 */
export async function createNFTOfferGemWallet(
  nftokenId: string,
  amountDrops: string,
  isSellOffer: boolean,
  owner?: string,
  destination?: string,
  expiration?: number,
): Promise<GemSignResult> {
  const api = getGemWalletApi();

  try {
    const params: Parameters<GemWalletAPI["createNFTOffer"]>[0] = {
      NFTokenID: nftokenId,
      amount: amountDrops,
      flags: isSellOffer ? 1 : 0, // tfSellNFToken = 1
    };
    if (owner) params.owner = owner;
    if (destination) params.destination = destination;
    if (expiration) params.expiration = expiration;

    const result = await api.createNFTOffer(params);

    return {
      hash: result.result?.hash ?? null,
      engineResult: result.result?.engine_result ?? null,
      engineResultMessage: result.result?.engine_result_message ?? null,
      signed: true,
      txBlob: null,
    };
  } catch (err) {
    if (err instanceof Error) {
      if (
        err.message.includes("rejected") ||
        err.message.includes("User refused")
      ) {
        throw new Error("User rejected the GemWallet NFT offer");
      }
      throw err;
    }
    throw new Error("GemWallet NFT offer failed: unknown error");
  }
}

/**
 * Accept an NFT offer (buy or sell) using GemWallet's native API.
 *
 * @param offerIndex - The offer index/ID to accept
 * @param isSellOffer - If true, accepts a sell offer; otherwise accepts a buy offer
 */
export async function acceptNFTOfferGemWallet(
  offerIndex: string,
  isSellOffer: boolean,
): Promise<GemSignResult> {
  const api = getGemWalletApi();

  try {
    const params: Parameters<GemWalletAPI["acceptNFTOffer"]>[0] = {};
    if (isSellOffer) {
      params.NFTokenSellOffer = offerIndex;
    } else {
      params.NFTokenBuyOffer = offerIndex;
    }

    const result = await api.acceptNFTOffer(params);

    return {
      hash: result.result?.hash ?? null,
      engineResult: result.result?.engine_result ?? null,
      engineResultMessage: result.result?.engine_result_message ?? null,
      signed: true,
      txBlob: null,
    };
  } catch (err) {
    if (err instanceof Error) {
      if (
        err.message.includes("rejected") ||
        err.message.includes("User refused")
      ) {
        throw new Error("User rejected the GemWallet NFT offer acceptance");
      }
      throw err;
    }
    throw new Error("GemWallet NFT offer acceptance failed: unknown error");
  }
}

/**
 * Cancel one or more NFT offers using GemWallet's native API.
 *
 * @param offerIndexes - Array of NFT offer index/IDs to cancel
 */
export async function cancelNFTOfferGemWallet(
  offerIndexes: string[],
): Promise<GemSignResult> {
  const api = getGemWalletApi();

  try {
    const result = await api.cancelNFTOffer({
      NFTokenOffers: offerIndexes,
    });

    return {
      hash: result.result?.hash ?? null,
      engineResult: result.result?.engine_result ?? null,
      engineResultMessage: result.result?.engine_result_message ?? null,
      signed: true,
      txBlob: null,
    };
  } catch (err) {
    if (err instanceof Error) {
      if (
        err.message.includes("rejected") ||
        err.message.includes("User refused")
      ) {
        throw new Error("User rejected the GemWallet NFT offer cancellation");
      }
      throw err;
    }
    throw new Error("GemWallet NFT offer cancellation failed: unknown error");
  }
}

/**
 * Burn an NFT using GemWallet's native API.
 *
 * @param nftokenId - The NFTokenID to burn
 * @param owner - Optional: if burning as issuer, the current owner
 */
export async function burnNFTGemWallet(
  nftokenId: string,
  owner?: string,
): Promise<GemSignResult> {
  const api = getGemWalletApi();

  try {
    const params: Parameters<GemWalletAPI["burnNFT"]>[0] = {
      NFTokenID: nftokenId,
    };
    if (owner) params.owner = owner;

    const result = await api.burnNFT(params);

    return {
      hash: result.result?.hash ?? null,
      engineResult: result.result?.engine_result ?? null,
      engineResultMessage: result.result?.engine_result_message ?? null,
      signed: true,
      txBlob: null,
    };
  } catch (err) {
    if (err instanceof Error) {
      if (
        err.message.includes("rejected") ||
        err.message.includes("User refused")
      ) {
        throw new Error("User rejected the GemWallet NFT burn");
      }
      throw err;
    }
    throw new Error("GemWallet NFT burn failed: unknown error");
  }
}

// ──────────────────────────────────────────────
// Convenience: DEX Offers
// ──────────────────────────────────────────────

/**
 * Create a DEX offer using GemWallet's native API.
 *
 * @param takerGets - What the offer creator will pay (drops string or issued currency object)
 * @param takerPays - What the offer creator will receive (drops string or issued currency object)
 * @param expiration - Optional Ripple epoch expiration
 * @param flags - Optional flags
 */
export async function createDEXOfferGemWallet(
  takerGets: string | { currency: string; issuer: string; value: string },
  takerPays: string | { currency: string; issuer: string; value: string },
  expiration?: number,
  flags?: number,
): Promise<GemSignResult> {
  const api = getGemWalletApi();

  try {
    const params: Parameters<GemWalletAPI["createOffer"]>[0] = {
      takerGets,
      takerPays,
    };
    if (expiration !== undefined) params.expiration = expiration;
    if (flags !== undefined) params.flags = flags;

    const result = await api.createOffer(params);

    return {
      hash: result.result?.hash ?? null,
      engineResult: result.result?.engine_result ?? null,
      engineResultMessage: result.result?.engine_result_message ?? null,
      signed: true,
      txBlob: null,
    };
  } catch (err) {
    if (err instanceof Error) {
      if (
        err.message.includes("rejected") ||
        err.message.includes("User refused")
      ) {
        throw new Error("User rejected the GemWallet DEX offer");
      }
      throw err;
    }
    throw new Error("GemWallet DEX offer failed: unknown error");
  }
}

/**
 * Cancel a DEX offer using GemWallet's native API.
 *
 * @param offerSequence - The sequence number of the offer to cancel
 */
export async function cancelDEXOfferGemWallet(
  offerSequence: number,
): Promise<GemSignResult> {
  const api = getGemWalletApi();

  try {
    const result = await api.cancelOffer({
      offerSequence,
    });

    return {
      hash: result.result?.hash ?? null,
      engineResult: result.result?.engine_result ?? null,
      engineResultMessage: result.result?.engine_result_message ?? null,
      signed: true,
      txBlob: null,
    };
  } catch (err) {
    if (err instanceof Error) {
      if (
        err.message.includes("rejected") ||
        err.message.includes("User refused")
      ) {
        throw new Error("User rejected the GemWallet DEX offer cancellation");
      }
      throw err;
    }
    throw new Error("GemWallet DEX offer cancellation failed: unknown error");
  }
}

// ──────────────────────────────────────────────
// Convenience: Get user's NFTs
// ──────────────────────────────────────────────

export interface GemWalletNFTItem {
  NFTokenID: string;
  Issuer: string;
  URI: string | null;
  NFTokenTaxon: number;
  Flags: number;
  nftSerial: number;
}

/**
 * Get the connected user's NFTs from their GemWallet.
 *
 * @param limit - Maximum number of NFTs to return
 */
export async function getNFTsGemWallet(
  limit?: number,
): Promise<GemWalletNFTItem[]> {
  const api = getGemWalletApi();

  try {
    const params: Parameters<GemWalletAPI["getNFTs"]>[0] = {};
    if (limit !== undefined && params) {
      params.limit = limit;
    }

    const result = await api.getNFTs(params);
    const nfts = (result.result as unknown as GemWalletNFT)?.account_nfts ?? [];

    return nfts.map((nft) => ({
      NFTokenID: nft.NFTokenID,
      Issuer: nft.Issuer,
      URI: nft.URI ?? null,
      NFTokenTaxon: nft.NFTokenTaxon,
      Flags: nft.Flags,
      nftSerial: nft.nft_serial,
    }));
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("Failed to fetch NFTs from GemWallet");
  }
}

// ──────────────────────────────────────────────
// Convenience: Sign a message
// ──────────────────────────────────────────────

/**
 * Sign an arbitrary message using GemWallet.
 * Useful for proving wallet ownership.
 *
 * @param message - The message to sign
 * @returns The signed message hex
 */
export async function signMessageGemWallet(message: string): Promise<string> {
  const api = getGemWalletApi();

  try {
    const result = await api.signMessage({ message });
    const signed = (result.result as unknown as { signedMessage?: string })
      ?.signedMessage;

    if (!signed) {
      throw new Error("GemWallet did not return a signed message");
    }

    return signed;
  } catch (err) {
    if (err instanceof Error) {
      if (
        err.message.includes("rejected") ||
        err.message.includes("User refused")
      ) {
        throw new Error("User rejected the GemWallet message signing");
      }
      throw err;
    }
    throw new Error("GemWallet message signing failed: unknown error");
  }
}

// ──────────────────────────────────────────────
// Convenience: Xahau-specific — Claim Reward
// ──────────────────────────────────────────────

/**
 * Claim a reward on the Xahau network via GemWallet.
 * Uses the generic signWithGemWallet since GemWallet
 * doesn't have a native claimReward method.
 *
 * @param issuer - Optional issuer for the ClaimReward
 */
export async function claimRewardGemWallet(
  issuer?: string,
): Promise<GemSignResult> {
  const tx: Record<string, unknown> = {
    TransactionType: "ClaimReward",
  };
  if (issuer) tx.Issuer = issuer;

  return signWithGemWallet(tx);
}

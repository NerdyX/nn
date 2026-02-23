// src/context/wallet-context.tsx
import { createContextId, useContext, type Signal } from "@builder.io/qwik";

// ──────────────────────────────────────────────
// Gutte Provider Types (from gutte.ts)
// ──────────────────────────────────────────────

export enum GutteNetwork {
  XRPL_MAINNET = "xrpl:mainnet",
  XRPL_TESTNET = "xrpl:testnet",
  XRPL_DEVNET = "xrpl:devnet",
  XAHAU_MAINNET = "xahau:mainnet",
  XAHAU_TESTNET = "xahau:testnet",
}

export interface GutteAccount {
  address: string;
  publicKey: string;
  network: GutteNetwork;
}

export interface GutteConnectionResponse {
  approved: boolean;
  account: GutteAccount | null;
}

export interface GutteSignRequest {
  txJson: Record<string, unknown>;
  autofill?: boolean;
  submit?: boolean;
}

export interface GutteSignResponse {
  txHash: string;
  txBlob: string;
  signed: boolean;
  submitted: boolean;
  result?: Record<string, unknown>;
}

export interface GutteSignMessageRequest {
  message: string;
  hex?: boolean;
}

export interface GutteSignMessageResponse {
  signature: string;
  publicKey: string;
  message: string;
}

export interface GutteNFTCheckRequest {
  issuer: string;
  taxon?: number;
}

export interface GutteNFTCheckResponse {
  holds: boolean;
  tokenIds: string[];
  count: number;
}

export interface GutteEnrollmentStatus {
  enrolled: boolean;
  nftHolder: boolean;
  enrollmentWaived: boolean;
}

export type GutteEventType =
  | "connect"
  | "disconnect"
  | "accountChanged"
  | "networkChanged"
  | "txSigned"
  | "txSubmitted"
  | "error";

/**
 * Shape of the injected window.gutte provider.
 * Mirrors the GutteProvider class from gutte.ts so the
 * rest of the app can call it in a type-safe way without
 * importing the extension source directly.
 */
export interface GutteProviderAPI {
  readonly isGutte: boolean;
  readonly version: string;
  readonly name: string;
  connect(): Promise<GutteConnectionResponse>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  getAccount(): GutteAccount | null;
  getAddress(): string | null;
  getNetwork(): GutteNetwork;
  getNetworkConfig(): {
    id: GutteNetwork;
    name: string;
    url: string;
    networkId?: number;
    isXahau: boolean;
    explorerUrl: string;
  };
  getSupportedNetworks(): Array<{
    id: GutteNetwork;
    name: string;
    url: string;
    networkId?: number;
    isXahau: boolean;
    explorerUrl: string;
  }>;
  setNetwork(
    network: GutteNetwork,
  ): Promise<{ id: GutteNetwork; name: string; url: string }>;
  getBalance(): Promise<{ currency: string; value: string }>;
  createAccount(network?: GutteNetwork): Promise<{
    address: string;
    publicKey: string;
    network: GutteNetwork;
    funded: boolean;
  }>;
  signTransaction(request: GutteSignRequest): Promise<GutteSignResponse>;
  submitTransaction(txBlob: string): Promise<Record<string, unknown>>;
  signAndSubmit(txJson: Record<string, unknown>): Promise<GutteSignResponse>;
  signMessage(
    request: GutteSignMessageRequest,
  ): Promise<GutteSignMessageResponse>;
  checkNFT(request: GutteNFTCheckRequest): Promise<GutteNFTCheckResponse>;
  checkEnrollment(platformAddress: string): Promise<GutteEnrollmentStatus>;
  ping(): Promise<boolean>;
  isXahauNetwork(): boolean;
  getNetworkId(): number | undefined;
  on(event: GutteEventType, callback: (e: unknown) => void): void;
  off(event: GutteEventType, callback: (e: unknown) => void): void;
  once(event: GutteEventType, callback: (e: unknown) => void): void;
  removeAllListeners(event?: GutteEventType): void;
}

// Extend the Window interface so TypeScript recognizes window.gutte
declare global {
  interface Window {
    gutte?: GutteProviderAPI;
    gutteProviderInfo?: {
      name: string;
      version: string;
      networks: GutteNetwork[];
    };
  }
}

// ──────────────────────────────────────────────
// Wallet types
// ──────────────────────────────────────────────

export type WalletType =
  | "xaman"
  | "crossmark"
  | "gem"
  | "reown"
  | "gutte"
  | null;

export interface WalletSession {
  /** The r-address of the connected wallet */
  address: string;
  /** Which wallet provider is in use */
  type: WalletType;
  /** ISO timestamp of when the session was established */
  connectedAt: string;
  /** Optional display name from Xaman user info */
  name?: string;
  /** The Gutte network that was active at connection time */
  gutteNetwork?: GutteNetwork;
  /** Public key returned by Gutte on connect */
  guttePublicKey?: string;
}

// ──────────────────────────────────────────────
// Context shape
// ──────────────────────────────────────────────

export interface WalletContextState {
  /** Whether a wallet is currently connected */
  connected: Signal<boolean>;
  /** The wallet provider type currently in use */
  walletType: Signal<WalletType>;
  /** The connected r-address (empty string when disconnected) */
  address: Signal<string>;
  /** Optional display name from the wallet provider */
  displayName: Signal<string>;
  /** Current Gutte network (only meaningful when walletType is "gutte") */
  gutteNetwork: Signal<GutteNetwork | null>;
}

/**
 * Single source of truth for wallet connection state.
 * Provided in `src/routes/layout.tsx`, consumed by the
 * header, dashboard, marketplace, and any component that
 * needs to know about the connected wallet.
 */
export const WalletContext =
  createContextId<WalletContextState>("app.wallet-context");

// ──────────────────────────────────────────────
// Convenience hook
// ──────────────────────────────────────────────

/**
 * Read / write access to the wallet context.
 * Call inside any `component$` that renders under the root layout.
 */
export function useWalletContext(): WalletContextState {
  return useContext(WalletContext);
}

// ──────────────────────────────────────────────
// Session persistence helpers
// ──────────────────────────────────────────────

const STORAGE_KEY_ADDRESS = "xrpl_address";
const STORAGE_KEY_SESSION = "xaman_session";

/**
 * Persist wallet session to localStorage so it can be
 * restored on page reload (client-side only).
 */
export function persistWalletSession(session: WalletSession): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY_ADDRESS, session.address);
  localStorage.setItem(
    STORAGE_KEY_SESSION,
    JSON.stringify({
      account: session.address,
      type: session.type,
      name: session.name ?? "",
      signedAt: session.connectedAt,
      gutteNetwork: session.gutteNetwork ?? null,
      guttePublicKey: session.guttePublicKey ?? null,
    }),
  );
}

/**
 * Remove stored wallet session from localStorage.
 */
export function clearWalletSession(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY_ADDRESS);
  localStorage.removeItem(STORAGE_KEY_SESSION);
}

/**
 * Try to restore a previously-persisted wallet session
 * from localStorage. Returns null if nothing is stored.
 */
export function restoreWalletSession(): WalletSession | null {
  if (typeof localStorage === "undefined") return null;
  const address = localStorage.getItem(STORAGE_KEY_ADDRESS);
  const raw = localStorage.getItem(STORAGE_KEY_SESSION);
  if (!address || !raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      account?: string;
      type?: WalletType;
      name?: string;
      signedAt?: string;
      gutteNetwork?: GutteNetwork | null;
      guttePublicKey?: string | null;
    };

    return {
      address: parsed.account ?? address,
      type: parsed.type ?? "xaman",
      connectedAt: parsed.signedAt ?? new Date().toISOString(),
      name: parsed.name,
      gutteNetwork: parsed.gutteNetwork ?? undefined,
      guttePublicKey: parsed.guttePublicKey ?? undefined,
    };
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
// Gutte detection & connection helpers
// ──────────────────────────────────────────────

/**
 * Check whether the Gutte extension is installed and its
 * provider has been injected into `window.gutte`.
 *
 * Because content scripts may inject the provider slightly
 * after DOMContentLoaded, this helper optionally waits for
 * the `gutte:ready` custom event up to `timeoutMs`.
 */
export function isGutteInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.gutte?.isGutte;
}

export function waitForGutte(timeoutMs = 3000): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    // Already available
    if (window.gutte?.isGutte) {
      resolve(true);
      return;
    }

    let settled = false;

    const onReady = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(true);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      // One last synchronous check
      resolve(!!window.gutte?.isGutte);
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("gutte:ready", onReady);
    };

    window.addEventListener("gutte:ready", onReady);
  });
}

/**
 * Get a typed reference to the injected Gutte provider.
 * Returns `null` if the extension is not installed.
 */
export function getGutteProvider(): GutteProviderAPI | null {
  if (typeof window === "undefined") return null;
  return window.gutte?.isGutte ? (window.gutte as GutteProviderAPI) : null;
}

/**
 * Full connect flow for Gutte. Prompts the user via the
 * extension popup, then returns a WalletSession on success
 * or null if the user rejected / the extension is missing.
 */
export async function connectGutte(): Promise<WalletSession | null> {
  const provider = getGutteProvider();
  if (!provider) {
    console.warn("[WalletContext] Gutte extension not detected.");
    return null;
  }

  try {
    const response = await provider.connect();

    if (!response.approved || !response.account) {
      return null;
    }

    const session: WalletSession = {
      address: response.account.address,
      type: "gutte",
      connectedAt: new Date().toISOString(),
      name: "Gutte Wallet",
      gutteNetwork: response.account.network,
      guttePublicKey: response.account.publicKey,
    };

    return session;
  } catch (error) {
    console.error("[WalletContext] Gutte connection failed:", error);
    return null;
  }
}

/**
 * Disconnect the Gutte wallet and clean up.
 */
export async function disconnectGutte(): Promise<void> {
  const provider = getGutteProvider();
  if (!provider) return;

  try {
    await provider.disconnect();
  } catch (error) {
    console.error("[WalletContext] Gutte disconnect error:", error);
  }
}

/**
 * Attempt to silently re-establish a Gutte session after a
 * page reload. If the extension reports that the wallet is
 * still connected, returns the current account info as a
 * WalletSession. Otherwise returns null.
 */
export async function restoreGutteSession(): Promise<WalletSession | null> {
  const provider = getGutteProvider();
  if (!provider) return null;

  try {
    const stillConnected = await provider.isConnected();
    if (!stillConnected) return null;

    const account = provider.getAccount();
    if (!account) return null;

    return {
      address: account.address,
      type: "gutte",
      connectedAt: new Date().toISOString(),
      name: "Gutte Wallet",
      gutteNetwork: account.network,
      guttePublicKey: account.publicKey,
    };
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
// Gutte event binding helpers
// ──────────────────────────────────────────────

/**
 * Register Gutte event listeners that keep the WalletContextState
 * in sync when the user changes account, switches network, or
 * disconnects from within the extension popup.
 *
 * Returns an unsubscribe function.
 */
export function bindGutteEvents(
  ctx: WalletContextState,
  onDisconnect?: () => void,
): () => void {
  const provider = getGutteProvider();
  if (!provider) return () => {};

  const handleAccountChanged = (event: unknown) => {
    const e = event as { data: GutteAccount };
    if (e?.data?.address) {
      ctx.address.value = e.data.address;
      ctx.gutteNetwork.value = e.data.network;

      // Re-persist with updated address
      persistWalletSession({
        address: e.data.address,
        type: "gutte",
        connectedAt: new Date().toISOString(),
        name: "Gutte Wallet",
        gutteNetwork: e.data.network,
        guttePublicKey: e.data.publicKey,
      });
    }
  };

  const handleNetworkChanged = (event: unknown) => {
    const e = event as { data: { network: GutteNetwork } };
    if (e?.data?.network) {
      ctx.gutteNetwork.value = e.data.network;
    }
  };

  const handleDisconnect = () => {
    ctx.connected.value = false;
    ctx.walletType.value = null;
    ctx.address.value = "";
    ctx.displayName.value = "";
    ctx.gutteNetwork.value = null;
    clearWalletSession();
    onDisconnect?.();
  };

  provider.on("accountChanged", handleAccountChanged);
  provider.on("networkChanged", handleNetworkChanged);
  provider.on("disconnect", handleDisconnect);

  return () => {
    provider.off("accountChanged", handleAccountChanged);
    provider.off("networkChanged", handleNetworkChanged);
    provider.off("disconnect", handleDisconnect);
  };
}

// ──────────────────────────────────────────────
// Gutte transaction helpers
// ──────────────────────────────────────────────

/**
 * Sign a transaction through the Gutte extension.
 * No additional platform fee is applied — only the native
 * network fee goes through.
 */
export async function gutteSignTransaction(
  txJson: Record<string, unknown>,
  options?: { autofill?: boolean; submit?: boolean },
): Promise<GutteSignResponse | null> {
  const provider = getGutteProvider();
  if (!provider) {
    console.error("[WalletContext] Gutte provider not available for signing.");
    return null;
  }

  try {
    return await provider.signTransaction({
      txJson,
      autofill: options?.autofill ?? true,
      submit: options?.submit ?? false,
    });
  } catch (error) {
    console.error("[WalletContext] Gutte signTransaction failed:", error);
    throw error;
  }
}

/**
 * Sign and immediately submit a transaction through Gutte.
 */
export async function gutteSignAndSubmit(
  txJson: Record<string, unknown>,
): Promise<GutteSignResponse | null> {
  return gutteSignTransaction(txJson, { autofill: true, submit: true });
}

/**
 * Sign an arbitrary message for off-chain authentication.
 */
export async function gutteSignMessage(
  message: string,
  hex = false,
): Promise<GutteSignMessageResponse | null> {
  const provider = getGutteProvider();
  if (!provider) return null;

  try {
    return await provider.signMessage({ message, hex });
  } catch (error) {
    console.error("[WalletContext] Gutte signMessage failed:", error);
    throw error;
  }
}

// ──────────────────────────────────────────────
// Gutte NFT & enrollment helpers
// ──────────────────────────────────────────────

/**
 * Check if the connected Gutte wallet holds a specific NFT.
 * Used for verifying membership and waiving the 25 XRP enrollment fee.
 */
export async function gutteCheckNFT(
  issuer: string,
  taxon?: number,
): Promise<GutteNFTCheckResponse | null> {
  const provider = getGutteProvider();
  if (!provider) return null;

  try {
    return await provider.checkNFT({ issuer, taxon });
  } catch (error) {
    console.error("[WalletContext] Gutte checkNFT failed:", error);
    return null;
  }
}

/**
 * Check whether the connected wallet is enrolled on the platform.
 */
export async function gutteCheckEnrollment(
  platformAddress: string,
): Promise<GutteEnrollmentStatus | null> {
  const provider = getGutteProvider();
  if (!provider) return null;

  try {
    return await provider.checkEnrollment(platformAddress);
  } catch (error) {
    console.error("[WalletContext] Gutte checkEnrollment failed:", error);
    return null;
  }
}

// ──────────────────────────────────────────────
// General display helpers
// ──────────────────────────────────────────────

/**
 * Truncate an r-address for display, e.g. "rHb9CJ...wdtyTh"
 */
export function truncateAddress(addr: string, chars = 6): string {
  if (!addr || addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

/**
 * Human-friendly label for each wallet type.
 */
export function walletTypeLabel(type: WalletType): string {
  switch (type) {
    case "xaman":
      return "Xaman";
    case "crossmark":
      return "Crossmark";
    case "gem":
      return "GemWallet";
    case "reown":
      return "Reown";
    case "gutte":
      return "Gutte";
    default:
      return "Unknown";
  }
}

/**
 * Returns true when the active wallet is Gutte,
 * meaning the user pays zero platform fees.
 */
export function isFeeFreeWallet(type: WalletType): boolean {
  return type === "gutte";
}

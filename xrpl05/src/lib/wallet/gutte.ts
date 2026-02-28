import { type WalletSession, type WalletState, walletStore, walletActions, GutteNetwork, persistWalletSession, clearWalletSession } from "../store/wallet";

export interface GutteAccount {
  address: string;
  network: GutteNetwork;
  publicKey: string;
}

export interface GutteConnectionResponse {
  approved: boolean;
  account?: GutteAccount;
}

export interface GutteSignRequest {
  txJson: Record<string, unknown>;
  autofill?: boolean;
  submit?: boolean;
}

export interface GutteSignResponse {
  signedTx: string;
  txHash: string;
  submitResult?: {
    engine_result: string;
    engine_result_message: string;
    tx_json: Record<string, unknown>;
  };
}

export interface GutteSignMessageRequest {
  message: string;
  hex?: boolean;
}

export interface GutteSignMessageResponse {
  signedMessage: string;
  signature: string;
  publicKey: string;
}

export interface GutteNFTCheckRequest {
  issuer: string;
  taxon?: number;
}

export interface GutteNFTCheckResponse {
  hasNFT: boolean;
  nftId?: string;
  balance?: string;
}

export interface GutteEnrollmentStatus {
  enrolled: boolean;
  balance: string;
  reserve: string;
  isWaived?: boolean;
}

export type GutteEventType =
  | "accountChanged"
  | "networkChanged"
  | "disconnect"
  | "signRequested"
  | "transactionSubmitted";

export interface GutteProviderAPI {
  isGutte: boolean;
  version: string;
  connect(): Promise<GutteConnectionResponse>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  getAccount(): GutteAccount | null;
  getNetwork(): GutteNetwork | null;
  signTransaction(req: GutteSignRequest): Promise<GutteSignResponse>;
  signMessage(req: GutteSignMessageRequest): Promise<GutteSignMessageResponse>;
  checkNFT(req: GutteNFTCheckRequest): Promise<GutteNFTCheckResponse>;
  checkEnrollment(platformAddress: string): Promise<GutteEnrollmentStatus>;
  on(event: GutteEventType, listener: (data: unknown) => void): void;
  off(event: GutteEventType, listener: (data: unknown) => void): void;
}

declare global {
  interface Window {
    gutte?: GutteProviderAPI;
  }
}

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
      resolve(!!window.gutte?.isGutte);
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("gutte:ready", onReady);
    };
    window.addEventListener("gutte:ready", onReady);
  });
}

export function getGutteProvider(): GutteProviderAPI | null {
  if (typeof window === "undefined") return null;
  return window.gutte?.isGutte ? (window.gutte as GutteProviderAPI) : null;
}

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
    return {
      address: response.account.address,
      type: "gutte",
      connectedAt: new Date().toISOString(),
      name: "Gutte Wallet",
      gutteNetwork: response.account.network,
      guttePublicKey: response.account.publicKey,
    };
  } catch (error) {
    console.error("[WalletContext] Gutte connection failed:", error);
    return null;
  }
}

export async function disconnectGutte(): Promise<void> {
  const provider = getGutteProvider();
  if (!provider) return;
  try {
    await provider.disconnect();
  } catch (error) {
    console.error("[WalletContext] Gutte disconnect error:", error);
  }
}

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

export function bindGutteEvents(onDisconnect?: () => void): () => void {
  const provider = getGutteProvider();
  if (!provider) return () => {};

  const handleAccountChanged = (event: unknown) => {
    const e = event as { data: GutteAccount };
    if (e?.data?.address) {
      walletActions.setWalletState({
        address: e.data.address,
        gutteNetwork: e.data.network,
      });
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
      walletActions.setWalletState({
        gutteNetwork: e.data.network,
      });
    }
  };

  const handleDisconnect = () => {
    walletActions.disconnect();
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

export async function gutteSignTransaction(
  txJson: Record<string, unknown>,
  options?: { autofill?: boolean; submit?: boolean },
): Promise<GutteSignResponse | null> {
  const provider = getGutteProvider();
  if (!provider) return null;
  return await provider.signTransaction({
    txJson,
    autofill: options?.autofill ?? true,
    submit: options?.submit ?? false,
  });
}

export async function gutteSignAndSubmit(
  txJson: Record<string, unknown>,
): Promise<GutteSignResponse | null> {
  return gutteSignTransaction(txJson, { autofill: true, submit: true });
}

export async function gutteSignMessage(
  message: string,
  hex = false,
): Promise<GutteSignMessageResponse | null> {
  const provider = getGutteProvider();
  if (!provider) return null;
  return await provider.signMessage({ message, hex });
}

export async function gutteCheckNFT(
  issuer: string,
  taxon?: number,
): Promise<GutteNFTCheckResponse | null> {
  const provider = getGutteProvider();
  if (!provider) return null;
  try {
    return await provider.checkNFT({ issuer, taxon });
  } catch {
    return null;
  }
}

export async function gutteCheckEnrollment(
  platformAddress: string,
): Promise<GutteEnrollmentStatus | null> {
  const provider = getGutteProvider();
  if (!provider) return null;
  try {
    return await provider.checkEnrollment(platformAddress);
  } catch {
    return null;
  }
}

// src/components/wallets/gutte.ts
import {
  persistWalletSession,
  clearWalletSession,
} from "~/context/wallet-context";
import { walletActions } from "~/lib/store/wallet";

export interface GutteSession {
  address: string;
  gutteNetwork?: string | null;
}

export type OnDisconnectFn = () => void;

function getGutteProvider(): any | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as any).gutte;
}

export async function waitForGutte(timeoutMs = 3000): Promise<boolean> {
  if (getGutteProvider()) return true;

  return new Promise<boolean>((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (getGutteProvider()) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - start >= timeoutMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, 100);
  });
}

export async function connectGutte(): Promise<GutteSession | null> {
  const gutte = getGutteProvider();
  if (!gutte) return null;

  try {
    const result = await gutte.connect();
    if (!result?.address) return null;

    return {
      address: result.address,
      gutteNetwork: result.network ?? result.networkId ?? null,
    };
  } catch (err) {
    console.warn("[gutte] connect() rejected or threw:", err);
    return null;
  }
}

export function bindGutteEvents(
  onDisconnect?: OnDisconnectFn,
): void {
  const gutte = getGutteProvider();
  if (!gutte?.on) {
    return;
  }

  gutte.on("accountChanged", (newAddress: string) => {
    if (!newAddress) return;
    walletActions.setWalletState({ address: newAddress });

    persistWalletSession({
      address: newAddress,
      type: "gutte",
      connectedAt: new Date().toISOString(),
    });
  });

  gutte.on("networkChanged", (newNetwork: string) => {
    walletActions.setWalletState({ gutteNetwork: newNetwork as any });
  });

  gutte.on("disconnect", () => {
    walletActions.disconnect();
    clearWalletSession();
    onDisconnect?.();
  });
}

export async function connectGutteAndBind(
  onDisconnect?: OnDisconnectFn,
): Promise<void> {
  const installed = await waitForGutte(3000);
  if (!installed) {
    throw new Error(
      "Gutte wallet extension not detected. Please install it and refresh the page.",
    );
  }

  const session = await connectGutte();
  if (!session) {
    throw new Error("Connection was rejected or cancelled.");
  }

  walletActions.setWalletState({
    connected: true,
    walletType: "gutte",
    address: session.address,
    displayName: "Gutte Wallet",
    gutteNetwork: (session.gutteNetwork ?? null) as any,
  });

  persistWalletSession({
    address: session.address,
    type: "gutte",
    connectedAt: new Date().toISOString(),
  });

  bindGutteEvents(onDisconnect);
}

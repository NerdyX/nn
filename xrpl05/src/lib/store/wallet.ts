import { createStore } from "zustand/vanilla";

export enum GutteNetwork {
  XRPL = "XRPL Mainnet",
  XAHAU = "Xahau Mainnet",
}

export type WalletType = "xaman" | "crossmark" | "gem" | "reown" | "gutte" | null;

export interface WalletSession {
  address: string;
  type: WalletType;
  connectedAt: string;
  name?: string;
  gutteNetwork?: GutteNetwork;
  guttePublicKey?: string;
}

export interface WalletState {
  connected: boolean;
  walletType: WalletType;
  address: string;
  displayName: string;
  gutteNetwork: GutteNetwork | null;
}

export const walletStore = createStore<WalletState>(() => ({
  connected: false,
  walletType: null,
  address: "",
  displayName: "",
  gutteNetwork: null,
}));

export const walletActions = {
  setWalletState: (newState: Partial<WalletState>) => {
    walletStore.setState((state) => ({ ...state, ...newState }));
  },
  disconnect: () => {
    walletStore.setState({
      connected: false,
      walletType: null,
      address: "",
      displayName: "",
      gutteNetwork: null,
    });
  }
};

const STORAGE_KEY_ADDRESS = "xrpl_address";
const STORAGE_KEY_SESSION = "xaman_session";

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

export function clearWalletSession(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY_ADDRESS);
  localStorage.removeItem(STORAGE_KEY_SESSION);
}

export function restoreWalletSession(): WalletSession | null {
  if (typeof localStorage === "undefined") return null;
  const address = localStorage.getItem(STORAGE_KEY_ADDRESS);
  const raw = localStorage.getItem(STORAGE_KEY_SESSION);
  if (!address || !raw) return null;

  try {
    const parsed = JSON.parse(raw);
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

export function truncateAddress(addr: string, chars = 6): string {
  if (!addr || addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

export function walletTypeLabel(type: WalletType): string {
  switch (type) {
    case "xaman": return "Xaman";
    case "crossmark": return "Crossmark";
    case "gem": return "GemWallet";
    case "reown": return "Reown";
    case "gutte": return "Gutte";
    default: return "Unknown";
  }
}

export function isFeeFreeWallet(type: WalletType): boolean {
  return type === "gutte";
}

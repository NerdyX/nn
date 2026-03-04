// src/stores/walletStore.ts
import { create } from "zustand";

export type WalletType =
  | "xaman"
  | "gem"
  | "crossmark"
  | "ledger"
  | "walletconnect"
  | null;

interface WalletState {
  connected: boolean;
  walletType: WalletType;
  address: string;
  displayName: string;
  error?: string;

  connect: (address: string, type: WalletType, name?: string) => void;
  disconnect: () => void;
  restore: (session: {
    address: string;
    type: WalletType;
    name?: string;
  }) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  connected: false,
  walletType: null,
  address: "",
  displayName: "",
  error: undefined,

  connect: (address, type, name = "") =>
    set({
      connected: true,
      walletType: type,
      address,
      displayName: name,
      error: undefined,
    }),

  disconnect: () =>
    set({
      connected: false,
      walletType: null,
      address: "",
      displayName: "",
      error: undefined,
    }),

  restore: (session) =>
    set({
      connected: true,
      walletType: session.type,
      address: session.address,
      displayName: session.name ?? "",
      error: undefined,
    }),
}));

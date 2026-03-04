// src/hooks/useWallet.ts
import { useWalletStore } from "../stores/walletStore";
import { useSignal, useTask$ } from "@builder.io/qwik";

export type WalletType =
  | "xaman"
  | "gem"
  | "crossmark"
  | "ledger"
  | "walletconnect"
  | null;
export type WalletSession = {
  address: string;
  type: WalletType;
  name?: string;
};

// ── Reactive state only ──
export const useWalletState = () => {
  const state = useSignal(useWalletStore.getState());

  useTask$(() => {
    const unsubscribe = useWalletStore.subscribe((newState) => {
      state.value = newState;
    });
    return () => unsubscribe();
  });

  return {
    connected: state.value.connected,
    walletType: state.value.walletType,
    address: state.value.address,
    displayName: state.value.displayName,
    error: state.value.error,
  };
};

// ── Actions (never in signals) ──
export const useWalletActions = () => {
  return {
    connect: (address: string, type: WalletType, name = "") => {
      useWalletStore.setState({
        connected: true,
        walletType: type,
        address,
        displayName: name,
        error: undefined,
      });
    },
    disconnect: () => {
      useWalletStore.setState({
        connected: false,
        walletType: null,
        address: "",
        displayName: "",
        error: undefined,
      });
    },
    restore: (session: WalletSession) => {
      useWalletStore.setState({
        connected: true,
        walletType: session.type,
        address: session.address,
        displayName: session.name ?? "",
        error: undefined,
      });
    },
  };
};

// ── Session helpers (plain functions, safe to call anywhere) ──
export const restoreWalletSession = (): WalletSession | null => {
  if (typeof localStorage === "undefined") return null;

  const saved = localStorage.getItem("walletSession");
  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
};

export const saveWalletSession = (session: WalletSession) => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("walletSession", JSON.stringify(session));
  }
};

export const clearWalletSession = () => {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("walletSession");
  }
};

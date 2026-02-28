import { createStore } from "zustand/vanilla";

export interface LedgerHealth {
  ledgerIndex: number;
  ledgerHash: string;
  closeTime: string;
  feeBase: number;
  reserveBase: number;
  reserveInc: number;
  status: "online" | "syncing" | "offline";
}

export interface LedgerState {
  xrpl: LedgerHealth | null;
  xahau: LedgerHealth | null;
}

export const ledgerStore = createStore<LedgerState>(() => ({
  xrpl: null,
  xahau: null,
}));

export const ledgerActions = {
  updateLedgerHealth: (network: "xrpl" | "xahau", health: LedgerHealth) => 
    ledgerStore.setState((state) => ({
      ...state,
      [network]: health,
    })),
  setStatus: (network: "xrpl" | "xahau", status: "online" | "syncing" | "offline") => 
    ledgerStore.setState((state) => ({
      ...state,
      [network]: state[network] ? { ...state[network]!, status } : null,
    })),
};

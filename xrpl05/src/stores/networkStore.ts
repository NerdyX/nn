// src/stores/networkStore.ts
import { createStore } from "zustand/vanilla"; // ← vanilla, no React!
import { persist } from "zustand/middleware";
import { NETWORK_CONFIG, type Network } from "../lib/networks/common/config"; // relative or alias

interface NetworkState {
  activeNetwork: Network;
  wsUrl: string;
  availableNetworks: Network[];

  setNetwork: (network: Network) => void;
  reset: () => void;
}

export const networkStore = createStore<NetworkState>()(
  persist(
    (set) => ({
      activeNetwork: "xrpl" as Network,
      wsUrl: NETWORK_CONFIG.xrpl.ws,
      availableNetworks: ["xrpl", "xahau"],

      setNetwork: (network) =>
        set({
          activeNetwork: network,
          wsUrl: NETWORK_CONFIG[network]?.ws || NETWORK_CONFIG.xrpl.ws,
        }),

      reset: () =>
        set({
          activeNetwork: "xrpl",
          wsUrl: NETWORK_CONFIG.xrpl.ws,
        }),
    }),
    {
      name: "xrplos-network-storage",
      partialize: (state) => ({ activeNetwork: state.activeNetwork }),
    },
  ),
);

// Optional: typed selector helper for hooks
export const useNetworkStore = networkStore; // export as-is for now

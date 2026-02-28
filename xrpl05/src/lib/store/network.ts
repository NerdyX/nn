import { createStore } from "zustand/vanilla";

export type Network = "xrpl" | "xahau";

export interface NetworkConfig {
  label: string;
  shortLabel: string;
  ws: string;
  wsFallbacks: string[];
  explorerUrl: string;
  nativeCurrency: string;
  nativeCurrencyLong: string;
  apiSuffix: string;
  networkId: number | undefined;
  color: string;
  colorLight: string;
}

export const NETWORK_CONFIG: Record<Network, NetworkConfig> = {
  xrpl: {
    label: "XRPL Mainnet",
    shortLabel: "XRPL",
    ws: "wss://xrplcluster.com",
    wsFallbacks: [
      "wss://s1.ripple.com",
      "wss://s2.ripple.com",
      "wss://xrpl.link",
    ],
    explorerUrl: "https://livenet.xrpl.org",
    nativeCurrency: "XRP",
    nativeCurrencyLong: "XRP",
    apiSuffix: "xrpl",
    networkId: undefined,
    color: "#6340bc",
    colorLight: "#8b6ce0",
  },
  xahau: {
    label: "Xahau Mainnet",
    shortLabel: "Xahau",
    ws: "wss://xahau.network",
    wsFallbacks: ["wss://xahau-rpc.com", "wss://xahau-rpc2.com"],
    explorerUrl: "https://explorer.xahau.network",
    nativeCurrency: "XAH",
    nativeCurrencyLong: "XAH",
    apiSuffix: "xahau",
    networkId: 21337,
    color: "#f5a623",
    colorLight: "#fbc862",
  },
};

export interface NetworkState {
  activeNetwork: Network;
  wsUrl: string;
}

export const networkStore = createStore<NetworkState>(() => ({
  activeNetwork: "xrpl",
  wsUrl: NETWORK_CONFIG.xrpl.ws,
}));

export const networkActions = {
  setActiveNetwork: (network: Network) => {
    networkStore.setState({
      activeNetwork: network,
      wsUrl: NETWORK_CONFIG[network].ws,
    });
  }
};

export function getNetworkConfig(network: Network): NetworkConfig {
  return NETWORK_CONFIG[network];
}

export function getAllWsUrls(network: Network): string[] {
  const cfg = NETWORK_CONFIG[network];
  return [cfg.ws, ...cfg.wsFallbacks];
}

export function getNetworkName(network: Network): string {
  return NETWORK_CONFIG[network].shortLabel;
}

export function getNativeCurrency(network: Network): string {
  return NETWORK_CONFIG[network].nativeCurrency;
}

export function getNetworkId(network: Network): number | undefined {
  return NETWORK_CONFIG[network].networkId;
}

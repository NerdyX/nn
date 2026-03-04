// src/lib/networks/common/config.ts   ← or src/types/network-config.ts
export type Network = 'xrpl' | 'xahau'; // add 'flare' etc later

export const NETWORK_CONFIG: Record<Network, { ws: string /* add rpc, name, etc */ }> = {
  xrpl: {
    ws: 'wss://xrplcluster.com', // your actual mainnet WS
    // rpc: 'https://s1.ripple.com:51234',
    // label: 'XRPL Mainnet',
  },
  xahau: {
    ws: 'wss://xahau.network', // your actual Xahau WS
    // rpc: 'https://xahau-rpc.example.com',
    // label: 'Xahau Mainnet',
  },
  // flare: { ... } when ready
};

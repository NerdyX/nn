// src/context/network-context.tsx
import { createContextId, useContext, type Signal } from "@builder.io/qwik";

// ──────────────────────────────────────────────
// Network types
// ──────────────────────────────────────────────

export type Network = "xrpl" | "xahau";

export interface NetworkConfig {
  label: string;
  ws: string;
  wsFallbacks: string[];
  explorerUrl: string;
  nativeCurrency: string;
  apiSuffix: string;
}

export const NETWORK_CONFIG: Record<Network, NetworkConfig> = {
  xrpl: {
    label: "XRPL Mainnet",
    ws: "wss://xrplcluster.com",
    wsFallbacks: [
      "wss://s1.ripple.com",
      "wss://s2.ripple.com",
      "wss://xrpl.link",
    ],
    explorerUrl: "https://livenet.xrpl.org",
    nativeCurrency: "XRP",
    apiSuffix: "xrpl",
  },
  xahau: {
    label: "Xahau Mainnet",
    ws: "wss://xahau.network",
    wsFallbacks: ["wss://xahau-rpc.com", "wss://xahau-rpc2.com"],
    explorerUrl: "https://explorer.xahau.network",
    nativeCurrency: "XAH",
    apiSuffix: "xahau",
  },
};

// ──────────────────────────────────────────────
// Transaction types per network
// ──────────────────────────────────────────────

export const XRPL_TX_TYPES = [
  "AccountDelete",
  "AccountSet",
  "AMMBid",
  "AMMClawback",
  "AMMCreate",
  "AMMDelete",
  "AMMDeposit",
  "AMMVote",
  "AMMWithdraw",
  "Batch",
  "CheckCancel",
  "CheckCash",
  "CheckCreate",
  "Clawback",
  "CredentialAccept",
  "CredentialCreate",
  "CredentialDelete",
  "DIDDelete",
  "DIDSet",
  "DelegateSet",
  "DepositPreauth",
  "EscrowCancel",
  "EscrowCreate",
  "EscrowFinish",
  "LedgerStateFix",
  "MPTokenAuthorize",
  "MPTokenIssuanceCreate",
  "MPTokenIssuanceDestroy",
  "MPTokenIssuanceSet",
  "NFTokenAcceptOffer",
  "NFTokenBurn",
  "NFTokenCancelOffer",
  "NFTokenCreateOffer",
  "NFTokenMint",
  "NFTokenModify",
  "OfferCancel",
  "OfferCreate",
  "OracleDelete",
  "OracleSet",
  "Payment",
  "PaymentChannelClaim",
  "PaymentChannelCreate",
  "PaymentChannelFund",
  "PermissionDelete",
  "PermissionSet",
  "SetRegularKey",
  "SignerListSet",
  "TicketCreate",
  "TrustSet",
  "XChainAccountCreateCommit",
  "XChainAddAccountCreateAttestation",
  "XChainAddClaimAttestation",
  "XChainClaim",
  "XChainCommit",
  "XChainCreateBridge",
  "XChainCreateClaimID",
  "XChainModifyBridge",
] as const;

export const XAHAU_TX_TYPES = [
  "AccountDelete",
  "AccountSet",
  "CheckCancel",
  "CheckCash",
  "CheckCreate",
  "ClaimReward",
  "Clawback",
  "CronSet",
  "DepositPreauth",
  "EscrowCancel",
  "EscrowCreate",
  "EscrowFinish",
  "Import",
  "NFTokenAcceptOffer",
  "NFTokenBurn",
  "NFTokenCancelOffer",
  "NFTokenCreateOffer",
  "NFTokenMint",
  "OfferCancel",
  "OfferCreate",
  "Payment",
  "PaymentChannelClaim",
  "PaymentChannelCreate",
  "PaymentChannelFund",
  "SetRegularKey",
  "SignerListSet",
  "TrustSet",
] as const;

// ──────────────────────────────────────────────
// Shared context shape
// ──────────────────────────────────────────────

export interface NetworkContextState {
  /** Current selected network */
  activeNetwork: Signal<Network>;
  /** Resolved WebSocket URL */
  wsUrl: Signal<string>;
}

/**
 * The single source of truth for the active network.
 * Provided in `src/routes/layout.tsx`, consumed everywhere.
 */
export const NetworkContext = createContextId<NetworkContextState>(
  "app.network-context",
);

// ──────────────────────────────────────────────
// Convenience hook
// ──────────────────────────────────────────────

/**
 * Read-only access to the current network context.
 * Call inside any component$ that sits under the root layout.
 */
export function useNetworkContext() {
  return useContext(NetworkContext);
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Get the full config object for a network key */
export function getNetworkConfig(network: Network): NetworkConfig {
  return NETWORK_CONFIG[network];
}

/** Get the transaction types available on the given network */
export function getTxTypesForNetwork(network: Network): readonly string[] {
  return network === "xahau" ? XAHAU_TX_TYPES : XRPL_TX_TYPES;
}

/** Get all WebSocket URLs for a network (primary + fallbacks) */
export function getAllWsUrls(network: Network): string[] {
  const cfg = NETWORK_CONFIG[network];
  return [cfg.ws, ...cfg.wsFallbacks];
}

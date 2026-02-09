// src/context/network-context.tsx
import { createContextId, useContext, type Signal } from "@builder.io/qwik";

// ──────────────────────────────────────────────
// Network types
// ──────────────────────────────────────────────

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
    nativeCurrencyLong: "XRP (Ripple)",
    apiSuffix: "xrpl",
    networkId: undefined, // XRPL mainnet does not require NetworkID
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
    nativeCurrencyLong: "XAH (Xahau)",
    apiSuffix: "xahau",
    networkId: 21337, // Xahau mainnet NetworkID
    color: "#f5a623",
    colorLight: "#fbc862",
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

// Shared transaction types present on BOTH networks
export const SHARED_TX_TYPES = [
  "AccountDelete",
  "AccountSet",
  "CheckCancel",
  "CheckCash",
  "CheckCreate",
  "Clawback",
  "DepositPreauth",
  "EscrowCancel",
  "EscrowCreate",
  "EscrowFinish",
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

// XRPL-only transaction types (not on Xahau)
export const XRPL_ONLY_TX_TYPES = XRPL_TX_TYPES.filter(
  (t) => !(SHARED_TX_TYPES as readonly string[]).includes(t),
);

// Xahau-only transaction types (not on XRPL mainnet)
export const XAHAU_ONLY_TX_TYPES = XAHAU_TX_TYPES.filter(
  (t) => !(SHARED_TX_TYPES as readonly string[]).includes(t),
);

// ──────────────────────────────────────────────
// Transaction type categories (for UI grouping)
// ──────────────────────────────────────────────

export interface TxCategory {
  id: string;
  label: string;
  icon: string;
  types: string[];
  /** If set, only show this category on this network */
  networkOnly?: Network;
}

export const TX_CATEGORIES: TxCategory[] = [
  {
    id: "payment",
    label: "Payments",
    icon: "💸",
    types: ["Payment"],
  },
  {
    id: "nft",
    label: "NFTokens",
    icon: "🖼️",
    types: [
      "NFTokenMint",
      "NFTokenBurn",
      "NFTokenCreateOffer",
      "NFTokenAcceptOffer",
      "NFTokenCancelOffer",
      "NFTokenModify",
    ],
  },
  {
    id: "dex",
    label: "DEX / Offers",
    icon: "📊",
    types: ["OfferCreate", "OfferCancel"],
  },
  {
    id: "trustline",
    label: "Trust Lines",
    icon: "🔗",
    types: ["TrustSet", "Clawback"],
  },
  {
    id: "escrow",
    label: "Escrow",
    icon: "🔒",
    types: ["EscrowCreate", "EscrowFinish", "EscrowCancel"],
  },
  {
    id: "checks",
    label: "Checks",
    icon: "📝",
    types: ["CheckCreate", "CheckCash", "CheckCancel"],
  },
  {
    id: "paychan",
    label: "Payment Channels",
    icon: "📡",
    types: [
      "PaymentChannelCreate",
      "PaymentChannelFund",
      "PaymentChannelClaim",
    ],
  },
  {
    id: "account",
    label: "Account",
    icon: "👤",
    types: [
      "AccountSet",
      "AccountDelete",
      "SetRegularKey",
      "SignerListSet",
      "DepositPreauth",
      "TicketCreate",
    ],
  },
  {
    id: "amm",
    label: "AMM",
    icon: "🏦",
    types: [
      "AMMCreate",
      "AMMDelete",
      "AMMDeposit",
      "AMMWithdraw",
      "AMMBid",
      "AMMVote",
      "AMMClawback",
    ],
    networkOnly: "xrpl",
  },
  {
    id: "mptoken",
    label: "Multi-Purpose Tokens",
    icon: "🪙",
    types: [
      "MPTokenAuthorize",
      "MPTokenIssuanceCreate",
      "MPTokenIssuanceDestroy",
      "MPTokenIssuanceSet",
    ],
    networkOnly: "xrpl",
  },
  {
    id: "did",
    label: "DID / Identity",
    icon: "🆔",
    types: [
      "DIDSet",
      "DIDDelete",
      "CredentialAccept",
      "CredentialCreate",
      "CredentialDelete",
    ],
    networkOnly: "xrpl",
  },
  {
    id: "oracle",
    label: "Oracles",
    icon: "🔮",
    types: ["OracleSet", "OracleDelete"],
    networkOnly: "xrpl",
  },
  {
    id: "xchain",
    label: "Cross-Chain Bridge",
    icon: "🌉",
    types: [
      "XChainAccountCreateCommit",
      "XChainAddAccountCreateAttestation",
      "XChainAddClaimAttestation",
      "XChainClaim",
      "XChainCommit",
      "XChainCreateBridge",
      "XChainCreateClaimID",
      "XChainModifyBridge",
    ],
    networkOnly: "xrpl",
  },
  {
    id: "batch",
    label: "Batch",
    icon: "📦",
    types: ["Batch"],
    networkOnly: "xrpl",
  },
  {
    id: "permissions",
    label: "Permissions",
    icon: "🛡️",
    types: ["PermissionSet", "PermissionDelete", "DelegateSet"],
    networkOnly: "xrpl",
  },
  {
    id: "hooks",
    label: "Hooks / Import",
    icon: "⚡",
    types: ["Import", "CronSet"],
    networkOnly: "xahau",
  },
  {
    id: "rewards",
    label: "Rewards",
    icon: "🎁",
    types: ["ClaimReward"],
    networkOnly: "xahau",
  },
];

// ──────────────────────────────────────────────
// Network-aware dashboard sidebar navigation
// ──────────────────────────────────────────────

export interface SidebarNavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  /** If set, this item only shows when the given network is active */
  networkOnly?: Network;
  /** If true, the item is always shown regardless of network */
  always?: boolean;
}

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  {
    id: "accounts",
    label: "Accounts",
    href: "/dashboard/accounts",
    icon: "👤",
    always: true,
  },
  {
    id: "explorer",
    label: "Explorer",
    href: "/explorer",
    icon: "🔍",
    always: true,
  },
  {
    id: "assets",
    label: "Assets & Tokens",
    href: "/dashboard/assets",
    icon: "🪙",
    always: true,
  },
  {
    id: "nfts",
    label: "NFTs",
    href: "/marketplace",
    icon: "🖼️",
    always: true,
  },
  {
    id: "dex",
    label: "DEX Trading",
    href: "/dashboard/trading",
    icon: "📊",
    always: true,
  },
  {
    id: "payments",
    label: "Payments",
    href: "/dashboard/payments",
    icon: "💸",
    always: true,
  },
  {
    id: "escrow",
    label: "Escrow",
    href: "/dashboard/escrow",
    icon: "🔒",
    always: true,
  },
  {
    id: "trustlines",
    label: "Trust Lines",
    href: "/dashboard/trustlines",
    icon: "🔗",
    always: true,
  },
  {
    id: "amm",
    label: "AMM Pools",
    href: "/dashboard/amm",
    icon: "🏦",
    networkOnly: "xrpl",
  },
  {
    id: "xchain",
    label: "Cross-Chain Bridge",
    href: "/dashboard/bridging",
    icon: "🌉",
    networkOnly: "xrpl",
  },
  {
    id: "did",
    label: "DID / Identity",
    href: "/dashboard/identity",
    icon: "🆔",
    networkOnly: "xrpl",
  },
  {
    id: "oracles",
    label: "Oracles",
    href: "/dashboard/oracles",
    icon: "🔮",
    networkOnly: "xrpl",
  },
  {
    id: "rewards",
    label: "Claim Rewards",
    href: "/dashboard/rewards",
    icon: "🎁",
    networkOnly: "xahau",
  },
  {
    id: "hooks",
    label: "Hooks & Cron",
    href: "/dashboard/hooks",
    icon: "⚡",
    networkOnly: "xahau",
  },
  {
    id: "import",
    label: "Import Account",
    href: "/dashboard/import",
    icon: "📥",
    networkOnly: "xahau",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/dashboard/settings",
    icon: "⚙️",
    always: true,
  },
];

// ──────────────────────────────────────────────
// Transaction type color mapping (for explorer)
// ──────────────────────────────────────────────

export interface TxColorData {
  bg: string;
  dot: string;
  label: string;
}

export const TX_TYPE_COLORS: Record<string, TxColorData> = {
  Payment: { bg: "bg-green-50", dot: "bg-green-500", label: "Payment" },
  OfferCreate: { bg: "bg-blue-50", dot: "bg-blue-500", label: "Offer Create" },
  OfferCancel: { bg: "bg-blue-50", dot: "bg-cyan-500", label: "Offer Cancel" },
  TrustSet: { bg: "bg-red-50", dot: "bg-red-500", label: "Trust Set" },
  NFTokenMint: { bg: "bg-purple-50", dot: "bg-purple-500", label: "NFT Mint" },
  NFTokenBurn: {
    bg: "bg-purple-50",
    dot: "bg-violet-500",
    label: "NFT Burn",
  },
  NFTokenCreateOffer: {
    bg: "bg-purple-50",
    dot: "bg-fuchsia-500",
    label: "NFT Offer",
  },
  NFTokenAcceptOffer: {
    bg: "bg-purple-50",
    dot: "bg-pink-500",
    label: "NFT Accept",
  },
  NFTokenCancelOffer: {
    bg: "bg-purple-50",
    dot: "bg-rose-400",
    label: "NFT Cancel",
  },
  AccountSet: {
    bg: "bg-amber-50",
    dot: "bg-amber-500",
    label: "Account Set",
  },
  AccountDelete: {
    bg: "bg-amber-50",
    dot: "bg-amber-700",
    label: "Account Delete",
  },
  EscrowCreate: { bg: "bg-pink-50", dot: "bg-pink-500", label: "Escrow" },
  EscrowFinish: {
    bg: "bg-pink-50",
    dot: "bg-pink-600",
    label: "Escrow Finish",
  },
  EscrowCancel: {
    bg: "bg-pink-50",
    dot: "bg-pink-400",
    label: "Escrow Cancel",
  },
  CheckCreate: { bg: "bg-cyan-50", dot: "bg-cyan-500", label: "Check" },
  CheckCash: { bg: "bg-cyan-50", dot: "bg-cyan-600", label: "Check Cash" },
  CheckCancel: {
    bg: "bg-cyan-50",
    dot: "bg-cyan-400",
    label: "Check Cancel",
  },
  Clawback: { bg: "bg-red-50", dot: "bg-red-600", label: "Clawback" },
  SetRegularKey: {
    bg: "bg-gray-50",
    dot: "bg-gray-500",
    label: "Regular Key",
  },
  SignerListSet: {
    bg: "bg-gray-50",
    dot: "bg-gray-600",
    label: "Signer List",
  },
  DepositPreauth: {
    bg: "bg-gray-50",
    dot: "bg-gray-400",
    label: "Deposit Preauth",
  },
  TicketCreate: {
    bg: "bg-indigo-50",
    dot: "bg-indigo-500",
    label: "Ticket",
  },
  // AMM types
  AMMCreate: { bg: "bg-teal-50", dot: "bg-teal-500", label: "AMM Create" },
  AMMDelete: { bg: "bg-teal-50", dot: "bg-teal-700", label: "AMM Delete" },
  AMMDeposit: { bg: "bg-teal-50", dot: "bg-teal-400", label: "AMM Deposit" },
  AMMWithdraw: {
    bg: "bg-teal-50",
    dot: "bg-teal-600",
    label: "AMM Withdraw",
  },
  AMMBid: { bg: "bg-teal-50", dot: "bg-teal-300", label: "AMM Bid" },
  AMMVote: { bg: "bg-teal-50", dot: "bg-teal-800", label: "AMM Vote" },
  AMMClawback: {
    bg: "bg-teal-50",
    dot: "bg-teal-900",
    label: "AMM Clawback",
  },
  // Payment channels
  PaymentChannelCreate: {
    bg: "bg-sky-50",
    dot: "bg-sky-500",
    label: "PayChan Create",
  },
  PaymentChannelFund: {
    bg: "bg-sky-50",
    dot: "bg-sky-600",
    label: "PayChan Fund",
  },
  PaymentChannelClaim: {
    bg: "bg-sky-50",
    dot: "bg-sky-400",
    label: "PayChan Claim",
  },
  // Cross-chain
  XChainCommit: {
    bg: "bg-orange-50",
    dot: "bg-orange-500",
    label: "XChain Commit",
  },
  XChainClaim: {
    bg: "bg-orange-50",
    dot: "bg-orange-600",
    label: "XChain Claim",
  },
  XChainCreateBridge: {
    bg: "bg-orange-50",
    dot: "bg-orange-400",
    label: "XChain Bridge",
  },
  XChainCreateClaimID: {
    bg: "bg-orange-50",
    dot: "bg-orange-700",
    label: "XChain ClaimID",
  },
  XChainModifyBridge: {
    bg: "bg-orange-50",
    dot: "bg-orange-300",
    label: "XChain Modify",
  },
  XChainAccountCreateCommit: {
    bg: "bg-orange-50",
    dot: "bg-orange-800",
    label: "XChain AcctCreate",
  },
  XChainAddAccountCreateAttestation: {
    bg: "bg-orange-50",
    dot: "bg-orange-200",
    label: "XChain Attest Acct",
  },
  XChainAddClaimAttestation: {
    bg: "bg-orange-50",
    dot: "bg-orange-100",
    label: "XChain Attest Claim",
  },
  // DID / Identity
  DIDSet: { bg: "bg-lime-50", dot: "bg-lime-500", label: "DID Set" },
  DIDDelete: { bg: "bg-lime-50", dot: "bg-lime-700", label: "DID Delete" },
  CredentialAccept: {
    bg: "bg-lime-50",
    dot: "bg-lime-400",
    label: "Credential Accept",
  },
  CredentialCreate: {
    bg: "bg-lime-50",
    dot: "bg-lime-600",
    label: "Credential Create",
  },
  CredentialDelete: {
    bg: "bg-lime-50",
    dot: "bg-lime-800",
    label: "Credential Delete",
  },
  // MPTokens
  MPTokenAuthorize: {
    bg: "bg-yellow-50",
    dot: "bg-yellow-500",
    label: "MPToken Auth",
  },
  MPTokenIssuanceCreate: {
    bg: "bg-yellow-50",
    dot: "bg-yellow-600",
    label: "MPToken Create",
  },
  MPTokenIssuanceDestroy: {
    bg: "bg-yellow-50",
    dot: "bg-yellow-700",
    label: "MPToken Destroy",
  },
  MPTokenIssuanceSet: {
    bg: "bg-yellow-50",
    dot: "bg-yellow-400",
    label: "MPToken Set",
  },
  // Oracles
  OracleSet: { bg: "bg-violet-50", dot: "bg-violet-500", label: "Oracle Set" },
  OracleDelete: {
    bg: "bg-violet-50",
    dot: "bg-violet-700",
    label: "Oracle Delete",
  },
  // Permissions
  PermissionSet: {
    bg: "bg-stone-50",
    dot: "bg-stone-500",
    label: "Permission Set",
  },
  PermissionDelete: {
    bg: "bg-stone-50",
    dot: "bg-stone-700",
    label: "Permission Delete",
  },
  DelegateSet: {
    bg: "bg-stone-50",
    dot: "bg-stone-400",
    label: "Delegate Set",
  },
  // Batch / Other XRPL
  Batch: { bg: "bg-slate-50", dot: "bg-slate-500", label: "Batch" },
  LedgerStateFix: {
    bg: "bg-slate-50",
    dot: "bg-slate-700",
    label: "Ledger Fix",
  },
  // Xahau-specific
  ClaimReward: {
    bg: "bg-emerald-50",
    dot: "bg-emerald-500",
    label: "Claim Reward",
  },
  CronSet: { bg: "bg-emerald-50", dot: "bg-emerald-600", label: "Cron Set" },
  Import: { bg: "bg-emerald-50", dot: "bg-emerald-400", label: "Import" },
  // Fallback
  Default: { bg: "bg-slate-50", dot: "bg-slate-400", label: "Other" },
};

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

/** Check if a given transaction type is supported on a network */
export function isTxTypeSupported(txType: string, network: Network): boolean {
  const types = getTxTypesForNetwork(network);
  return (types as readonly string[]).includes(txType);
}

/** Get the transaction categories visible on the given network */
export function getTxCategoriesForNetwork(network: Network): TxCategory[] {
  return TX_CATEGORIES.filter(
    (cat) => !cat.networkOnly || cat.networkOnly === network,
  );
}

/** Get sidebar nav items filtered for the given network */
export function getSidebarNavItems(network: Network): SidebarNavItem[] {
  return SIDEBAR_NAV_ITEMS.filter(
    (item) => item.always || !item.networkOnly || item.networkOnly === network,
  );
}

/** Get the color data for a transaction type (for explorer display) */
export function getTxColorData(type?: string): TxColorData {
  return TX_TYPE_COLORS[type ?? "Default"] || TX_TYPE_COLORS.Default;
}

/** Get the network display name (short label) */
export function getNetworkName(network: Network): string {
  return NETWORK_CONFIG[network].shortLabel;
}

/** Get the native currency symbol for a network */
export function getNativeCurrency(network: Network): string {
  return NETWORK_CONFIG[network].nativeCurrency;
}

/** Get the NetworkID for Xaman signing (undefined for XRPL mainnet) */
export function getNetworkId(network: Network): number | undefined {
  return NETWORK_CONFIG[network].networkId;
}

/**
 * Determine which transaction types are ONLY available on the
 * current network and not shared with the other.
 */
export function getExclusiveTxTypes(network: Network): string[] {
  if (network === "xrpl") {
    return [...XRPL_ONLY_TX_TYPES];
  }
  return [...XAHAU_ONLY_TX_TYPES];
}

/**
 * Full validation: is user wallet connected AND is the requested
 * transaction type supported on the active network?
 */
export function canSignTransaction(
  txType: string,
  network: Network,
  walletConnected: boolean,
): { allowed: boolean; reason?: string } {
  if (!walletConnected) {
    return { allowed: false, reason: "No wallet connected" };
  }
  if (!isTxTypeSupported(txType, network)) {
    return {
      allowed: false,
      reason: `${txType} is not supported on ${NETWORK_CONFIG[network].label}`,
    };
  }
  return { allowed: true };
}

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

/**
 * SVG icon paths (24x24 viewBox) for sidebar nav items.
 * Each value is an SVG `d` attribute for a single `<path>`.
 * Rendered via the dashboard layout as:
 *   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
 *     <path d={SIDEBAR_ICONS[item.icon]} ... />
 *   </svg>
 */
export const SIDEBAR_ICONS: Record<string, string> = {
  accounts:
    "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.25a7.5 7.5 0 0 1 15 0",
  explorer: "M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z",
  assets:
    "M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  nfts: "M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z",
  dex: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z",
  payments:
    "M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5",
  escrow:
    "M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z",
  trustlines:
    "M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 0 0-1.242-7.244l4.5-4.5a4.5 4.5 0 1 1 6.364 6.364l-1.757 1.757",
  amm: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125m16.5 3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125",
  xchain:
    "M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5",
  did: "M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z",
  oracles:
    "M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18",
  rewards:
    "M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z",
  hooks:
    "M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z",
  import:
    "M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15M12 1.5v11.25m0 0 3-3m-3 3-3-3",
  settings:
    "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.212-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
};

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  {
    id: "accounts",
    label: "Accounts",
    href: "/dashboard/accounts",
    icon: "accounts",
    always: true,
  },
  {
    id: "explorer",
    label: "Explorer",
    href: "/explorer",
    icon: "explorer",
    always: true,
  },
  {
    id: "assets",
    label: "Assets & Tokens",
    href: "/dashboard/assets",
    icon: "assets",
    always: true,
  },
  {
    id: "nfts",
    label: "NFTs",
    href: "/marketplace",
    icon: "nfts",
    always: true,
  },
  {
    id: "dex",
    label: "DEX Trading",
    href: "/dashboard/trading",
    icon: "dex",
    always: true,
  },
  {
    id: "payments",
    label: "Payments",
    href: "/dashboard/payments",
    icon: "payments",
    always: true,
  },
  {
    id: "escrow",
    label: "Escrow",
    href: "/dashboard/escrow",
    icon: "escrow",
    always: true,
  },
  {
    id: "trustlines",
    label: "Trust Lines",
    href: "/dashboard/trustlines",
    icon: "trustlines",
    always: true,
  },
  {
    id: "amm",
    label: "AMM Pools",
    href: "/dashboard/amm",
    icon: "amm",
    networkOnly: "xrpl",
  },
  {
    id: "xchain",
    label: "Cross-Chain",
    href: "/dashboard/bridging",
    icon: "xchain",
    networkOnly: "xrpl",
  },
  {
    id: "did",
    label: "DID / Identity",
    href: "/dashboard/identity",
    icon: "did",
    networkOnly: "xrpl",
  },
  {
    id: "oracles",
    label: "Oracles",
    href: "/dashboard/oracles",
    icon: "oracles",
    networkOnly: "xrpl",
  },
  {
    id: "rewards",
    label: "Claim Rewards",
    href: "/dashboard/rewards",
    icon: "rewards",
    networkOnly: "xahau",
  },
  {
    id: "hooks",
    label: "Hooks & Cron",
    href: "/dashboard/hooks",
    icon: "hooks",
    networkOnly: "xahau",
  },
  {
    id: "import",
    label: "Import Account",
    href: "/dashboard/import",
    icon: "import",
    networkOnly: "xahau",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/dashboard/settings",
    icon: "settings",
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

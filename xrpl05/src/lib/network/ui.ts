import type { Network } from "../store/network";
import { XRPL_TX_TYPES } from "./xrpl/tx-types";
import { XAHAU_TX_TYPES } from "./xahau/tx-types";

export function getTxTypesForNetwork(network: Network): readonly string[] {
  return network === "xahau" ? XAHAU_TX_TYPES : XRPL_TX_TYPES;
}

export function isTxTypeSupported(txType: string, network: Network): boolean {
  const types = getTxTypesForNetwork(network);
  return (types as readonly string[]).includes(txType);
}

export interface TxCategory {
  id: string;
  label: string;
  icon: string;
  types: string[];
  networkOnly?: Network;
}

export const TX_CATEGORIES: TxCategory[] = [
  { id: "payment", label: "Payments", icon: "💸", types: ["Payment"] },
  { id: "nft", label: "NFTokens", icon: "🖼️", types: ["NFTokenMint", "NFTokenBurn", "NFTokenCreateOffer", "NFTokenAcceptOffer", "NFTokenCancelOffer", "NFTokenModify"] },
  { id: "dex", label: "DEX / Offers", icon: "📊", types: ["OfferCreate", "OfferCancel"] },
  { id: "trustline", label: "Trust Lines", icon: "🔗", types: ["TrustSet", "Clawback"] },
  { id: "escrow", label: "Escrow", icon: "🔒", types: ["EscrowCreate", "EscrowFinish", "EscrowCancel"] },
  { id: "checks", label: "Checks", icon: "📝", types: ["CheckCreate", "CheckCash", "CheckCancel"] },
  { id: "paychan", label: "Payment Channels", icon: "📡", types: ["PaymentChannelCreate", "PaymentChannelFund", "PaymentChannelClaim"] },
  { id: "account", label: "Account", icon: "👤", types: ["AccountSet", "AccountDelete", "SetRegularKey", "SignerListSet", "DepositPreauth", "TicketCreate"] },
  { id: "amm", label: "AMM", icon: "🏦", types: ["AMMCreate", "AMMDelete", "AMMDeposit", "AMMWithdraw", "AMMBid", "AMMVote", "AMMClawback"], networkOnly: "xrpl" },
  { id: "mptoken", label: "Multi-Purpose Tokens", icon: "🪙", types: ["MPTokenAuthorize", "MPTokenIssuanceCreate", "MPTokenIssuanceDestroy", "MPTokenIssuanceSet"], networkOnly: "xrpl" },
  { id: "did", label: "DID / Identity", icon: "🆔", types: ["DIDSet", "DIDDelete", "CredentialAccept", "CredentialCreate", "CredentialDelete"], networkOnly: "xrpl" },
  { id: "oracle", label: "Oracles", icon: "🔮", types: ["OracleSet", "OracleDelete"], networkOnly: "xrpl" },
  { id: "xchain", label: "Cross-Chain Bridge", icon: "🌉", types: ["XChainAccountCreateCommit", "XChainAddAccountCreateAttestation", "XChainAddClaimAttestation", "XChainClaim", "XChainCommit", "XChainCreateBridge", "XChainCreateClaimID", "XChainModifyBridge"], networkOnly: "xrpl" },
  { id: "batch", label: "Batch", icon: "📦", types: ["Batch"], networkOnly: "xrpl" },
  { id: "permissions", label: "Permissions", icon: "🛡️", types: ["PermissionSet", "PermissionDelete", "DelegateSet"], networkOnly: "xrpl" },
  { id: "hooks", label: "Hooks / Import", icon: "⚡", types: ["Import", "CronSet"], networkOnly: "xahau" },
  { id: "rewards", label: "Rewards", icon: "🎁", types: ["ClaimReward"], networkOnly: "xahau" },
];

export function getTxCategoriesForNetwork(network: Network): TxCategory[] {
  return TX_CATEGORIES.filter((cat) => !cat.networkOnly || cat.networkOnly === network);
}

export function canSignTransaction(
  txType: string,
  network: Network,
  walletConnected: boolean,
): { allowed: boolean; reason?: string } {
  if (!walletConnected) return { allowed: false, reason: "No wallet connected" };
  if (!isTxTypeSupported(txType, network)) return { allowed: false, reason: `${txType} is not supported on this network` };
  return { allowed: true };
}

import { SIDEBAR_NAV_ITEMS, type SidebarNavItem } from "./ui-constants";

export function getSidebarNavItems(network: Network): SidebarNavItem[] {
  return SIDEBAR_NAV_ITEMS.filter(
    (item) => item.always || !item.networkOnly || item.networkOnly === network,
  );
}

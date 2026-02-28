import { SHARED_TX_TYPES } from "../shared-tx-types";

// XRPL-only transaction types (not on Xahau)
export const XRPL_ONLY_TX_TYPES = [
  "AMMBid",
  "AMMClawback",
  "AMMCreate",
  "AMMDelete",
  "AMMDeposit",
  "AMMVote",
  "AMMWithdraw",
  "Batch",
  "CredentialAccept",
  "CredentialCreate",
  "CredentialDelete",
  "DIDDelete",
  "DIDSet",
  "DelegateSet",
  "LedgerStateFix",
  "MPTokenAuthorize",
  "MPTokenIssuanceCreate",
  "MPTokenIssuanceDestroy",
  "MPTokenIssuanceSet",
  "NFTokenModify",
  "OracleDelete",
  "OracleSet",
  "PermissionDelete",
  "PermissionSet",
  "TicketCreate",
  "XChainAccountCreateCommit",
  "XChainAddAccountCreateAttestation",
  "XChainAddClaimAttestation",
  "XChainClaim",
  "XChainCommit",
  "XChainCreateBridge",
  "XChainCreateClaimID",
  "XChainModifyBridge",
] as const;

export const XRPL_TX_TYPES = [
  ...SHARED_TX_TYPES,
  ...XRPL_ONLY_TX_TYPES,
] as const;

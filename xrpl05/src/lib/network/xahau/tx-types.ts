import { SHARED_TX_TYPES } from "../shared-tx-types";

// Xahau-only transaction types (not on XRPL mainnet)
export const XAHAU_ONLY_TX_TYPES = [
  "ClaimReward",
  "CronSet",
  "Import",
] as const;

export const XAHAU_TX_TYPES = [
  ...SHARED_TX_TYPES,
  ...XAHAU_ONLY_TX_TYPES,
] as const;

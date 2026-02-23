/**
 * Xahau NFT Transaction Types
 *
 * This file defines all Xahau NFT-related transaction types and interfaces.
 * Xahau is a fork of XRPL with additional features and modifications.
 *
 * Note: Xahau maintains backward compatibility with XRPL NFT transactions
 * but adds additional fields and functionality specific to the Xahau network.
 *
 * @see https://docs.xahau.network/
 */

/**
 * Base transaction interface for Xahau transactions
 * Extends XRPL base with Xahau-specific fields
 */
export interface XahauBaseTransaction {
  TransactionType: string;
  Account: string;
  Fee?: string;
  Sequence?: number;
  AccountTxnID?: string;
  LastLedgerSequence?: number;
  Memos?: XahauMemo[];
  Signers?: XahauSigner[];
  SourceTag?: number;
  SigningPubKey?: string;
  TxnSignature?: string;
  NetworkID?: number;             // Xahau-specific: Network identifier
  HookParameters?: HookParameter[]; // Xahau-specific: Hook parameters
}

/**
 * Memo structure for Xahau transactions
 */
export interface XahauMemo {
  Memo: {
    MemoType?: string;
    MemoData?: string;
    MemoFormat?: string;
  };
}

/**
 * Signer structure for Xahau multi-signature transactions
 */
export interface XahauSigner {
  Signer: {
    Account: string;
    TxnSignature: string;
    SigningPubKey: string;
  };
}

/**
 * Hook parameter for Xahau smart contracts
 */
export interface HookParameter {
  HookParameter: {
    HookParameterName: string;
    HookParameterValue: string;
  };
}

/**
 * Xahau NFToken flags (same as XRPL with potential extensions)
 */
export enum XahauNFTokenMintFlags {
  tfBurnable = 0x00000001,
  tfOnlyXRP = 0x00000002,
  tfTrustLine = 0x00000004,
  tfTransferable = 0x00000008,
  tfXahauExtended = 0x00000010,   // Xahau-specific flag for extended features
}

/**
 * Xahau NFTokenMint Transaction
 * Creates a new NFToken on the Xahau ledger
 */
export interface XahauNFTokenMint extends XahauBaseTransaction {
  TransactionType: 'NFTokenMint';
  NFTokenTaxon: number;
  Issuer?: string;
  TransferFee?: number;
  URI?: string;
  Flags?: number;
  Metadata?: string;              // Xahau-specific: Optional on-chain metadata
  RoyaltyDestination?: string;    // Xahau-specific: Destination for royalty payments
}

/**
 * Xahau NFTokenBurn Transaction
 * Destroys an NFToken from the Xahau ledger
 */
export interface XahauNFTokenBurn extends XahauBaseTransaction {
  TransactionType: 'NFTokenBurn';
  NFTokenID: string;
  Owner?: string;
  BurnReason?: string;            // Xahau-specific: Optional reason for burning
}

/**
 * Xahau NFTokenCreateOffer Transaction
 * Creates a sell or buy offer for an NFToken on Xahau
 */
export interface XahauNFTokenCreateOffer extends XahauBaseTransaction {
  TransactionType: 'NFTokenCreateOffer';
  NFTokenID: string;
  Amount: string | XahauIssuedCurrency;
  Owner?: string;
  Expiration?: number;
  Destination?: string;
  Flags?: number;
  OfferMetadata?: string;         // Xahau-specific: Additional offer metadata
  RoyaltyAmount?: string;         // Xahau-specific: Explicit royalty amount
}

/**
 * Xahau issued currency amount structure
 */
export interface XahauIssuedCurrency {
  currency: string;
  issuer: string;
  value: string;
}

/**
 * Xahau NFTokenCancelOffer Transaction
 * Cancels existing NFToken offers on Xahau
 */
export interface XahauNFTokenCancelOffer extends XahauBaseTransaction {
  TransactionType: 'NFTokenCancelOffer';
  NFTokenOffers: string[];
  CancelReason?: string;          // Xahau-specific: Optional cancellation reason
}

/**
 * Xahau NFTokenAcceptOffer Transaction
 * Accepts an NFToken buy or sell offer on Xahau
 */
export interface XahauNFTokenAcceptOffer extends XahauBaseTransaction {
  TransactionType: 'NFTokenAcceptOffer';
  NFTokenSellOffer?: string;
  NFTokenBuyOffer?: string;
  NFTokenBrokerFee?: string | XahauIssuedCurrency;
  AcceptanceMetadata?: string;    // Xahau-specific: Metadata for acceptance
}

/**
 * Xahau NFToken object as stored on the ledger
 */
export interface XahauNFToken {
  NFTokenID: string;
  URI?: string;
  Flags: number;
  Issuer: string;
  NFTokenTaxon: number;
  TransferFee?: number;
  nft_serial: number;
  Metadata?: string;              // Xahau-specific: On-chain metadata
  RoyaltyDestination?: string;    // Xahau-specific: Royalty destination
  MintedAt?: number;              // Xahau-specific: Ledger index when minted
}

/**
 * Xahau NFToken offer object as stored on the ledger
 */
export interface XahauNFTokenOffer {
  Amount: string | XahauIssuedCurrency;
  Flags: number;
  NFTokenID: string;
  NFTokenOfferNode: string;
  Owner: string;
  OwnerNode: string;
  Destination?: string;
  Expiration?: number;
  PreviousTxnID: string;
  PreviousTxnLgrSeq: number;
  index: string;
  OfferMetadata?: string;         // Xahau-specific
  RoyaltyAmount?: string;         // Xahau-specific
  CreatedAt?: number;             // Xahau-specific: Ledger index when created
}

/**
 * Response from Xahau NFT transactions
 */
export interface XahauNFTTransactionResponse {
  result: {
    engine_result: string;
    engine_result_code: number;
    engine_result_message: string;
    tx_blob: string;
    tx_json: any;
    hash?: string;
    ledger_index?: number;
    validated?: boolean;
    network_id?: number;          // Xahau-specific
    hook_executions?: HookExecution[]; // Xahau-specific: Hook execution results
  };
}

/**
 * Hook execution result
 */
export interface HookExecution {
  HookExecution: {
    HookAccount: string;
    HookHash: string;
    HookResult: number;
    HookReturnCode: number;
    HookReturnString?: string;
  };
}

/**
 * Request to fetch account NFTs from Xahau
 */
export interface XahauAccountNFTsRequest {
  account: string;
  ledger_index?: string | number;
  limit?: number;
  marker?: unknown;
  include_metadata?: boolean;     // Xahau-specific: Include on-chain metadata
}

/**
 * Response from account_nfts request on Xahau
 */
export interface XahauAccountNFTsResponse {
  account: string;
  account_nfts: XahauNFToken[];
  ledger_index?: number;
  ledger_hash?: string;
  ledger_current_index?: number;
  validated?: boolean;
  marker?: unknown;
  network_id?: number;            // Xahau-specific
}

/**
 * Request to fetch NFToken offers from Xahau
 */
export interface XahauNFTOffersRequest {
  nft_id: string;
  ledger_index?: string | number;
  limit?: number;
  marker?: unknown;
  include_metadata?: boolean;     // Xahau-specific
}

/**
 * Response from nft_sell_offers or nft_buy_offers request on Xahau
 */
export interface XahauNFTOffersResponse {
  nft_id: string;
  offers: XahauNFTokenOffer[];
  ledger_index?: number;
  ledger_hash?: string;
  ledger_current_index?: number;
  validated?: boolean;
  marker?: unknown;
  network_id?: number;            // Xahau-specific
}

/**
 * Union type of all Xahau NFT transaction types
 */
export type XahauNFTTransaction =
  | XahauNFTokenMint
  | XahauNFTokenBurn
  | XahauNFTokenCreateOffer
  | XahauNFTokenCancelOffer
  | XahauNFTokenAcceptOffer;

/**
 * Helper type to extract transaction type from Xahau transaction object
 */
export type XahauTransactionType<T extends XahauNFTTransaction> = T['TransactionType'];

/**
 * Extended metadata for Xahau NFTs (off-chain)
 */
export interface XahauNFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  external_url?: string;
  animation_url?: string;
  properties?: Record<string, any>;
  xahau_specific?: {
    royalty_info?: {
      recipient: string;
      percentage: number;
    };
    hooks?: string[];             // Hook hashes associated with this NFT
    governance?: {
      voting_power?: number;
      dao_address?: string;
    };
  };
}

/**
 * Network configuration for Xahau
 */
export interface XahauNetworkConfig {
  networkID: number;
  rpcUrl: string;
  websocketUrl: string;
  explorerUrl: string;
}

/**
 * Common Xahau network IDs
 */
export enum XahauNetworkID {
  Mainnet = 21337,
  Testnet = 21338,
  Devnet = 21339,
}

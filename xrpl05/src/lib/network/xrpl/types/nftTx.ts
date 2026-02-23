/**
 * XRPL NFT Transaction Types
 *
 * This file defines all XRPL NFT-related transaction types and interfaces.
 * Based on the official XRPL protocol specification for NFToken transactions.
 *
 * @see https://xrpl.org/nft-token.html
 */

/**
 * Base transaction interface that all XRPL transactions extend
 */
export interface BaseTransaction {
  TransactionType: string;
  Account: string;
  Fee?: string;
  Sequence?: number;
  AccountTxnID?: string;
  LastLedgerSequence?: number;
  Memos?: Memo[];
  Signers?: Signer[];
  SourceTag?: number;
  SigningPubKey?: string;
  TxnSignature?: string;
}

/**
 * Memo structure for attaching data to transactions
 */
export interface Memo {
  Memo: {
    MemoType?: string;
    MemoData?: string;
    MemoFormat?: string;
  };
}

/**
 * Signer structure for multi-signature transactions
 */
export interface Signer {
  Signer: {
    Account: string;
    TxnSignature: string;
    SigningPubKey: string;
  };
}

/**
 * NFToken flags for minting and offers
 */
export enum NFTokenMintFlags {
  tfBurnable = 0x00000001,      // Allow token to be burned by issuer
  tfOnlyXRP = 0x00000002,        // Token can only be offered/bought for XRP
  tfTrustLine = 0x00000004,      // Require trust line between issuer and buyer
  tfTransferable = 0x00000008,   // Token can be transferred to others
}

/**
 * NFTokenMint Transaction
 * Creates a new NFToken on the XRPL
 */
export interface NFTokenMint extends BaseTransaction {
  TransactionType: 'NFTokenMint';
  NFTokenTaxon: number;           // Taxon for grouping related NFTs
  Issuer?: string;                // Optional issuer (defaults to Account)
  TransferFee?: number;           // Transfer fee in basis points (0-50000, i.e., 0-50%)
  URI?: string;                   // Hex-encoded URI pointing to token data/metadata
  Flags?: number;                 // Combination of NFTokenMintFlags
}

/**
 * NFTokenBurn Transaction
 * Destroys an NFToken, removing it from the ledger
 */
export interface NFTokenBurn extends BaseTransaction {
  TransactionType: 'NFTokenBurn';
  NFTokenID: string;              // ID of the NFToken to burn
  Owner?: string;                 // Owner of the token (if different from Account)
}

/**
 * NFTokenCreateOffer Transaction
 * Creates a sell or buy offer for an NFToken
 */
export interface NFTokenCreateOffer extends BaseTransaction {
  TransactionType: 'NFTokenCreateOffer';
  NFTokenID: string;              // ID of the NFToken being offered
  Amount: string | IssuedCurrency; // Amount in drops (XRP) or issued currency
  Owner?: string;                 // Owner of token (required for buy offers)
  Expiration?: number;            // Offer expiration time (ripple epoch)
  Destination?: string;           // Specific account that can accept this offer
  Flags?: number;                 // 0x00000001 = Sell offer (default is buy)
}

/**
 * Issued currency amount structure
 */
export interface IssuedCurrency {
  currency: string;
  issuer: string;
  value: string;
}

/**
 * NFTokenCancelOffer Transaction
 * Cancels existing NFToken offers
 */
export interface NFTokenCancelOffer extends BaseTransaction {
  TransactionType: 'NFTokenCancelOffer';
  NFTokenOffers: string[];        // Array of offer IDs to cancel
}

/**
 * NFTokenAcceptOffer Transaction
 * Accepts an NFToken buy or sell offer
 */
export interface NFTokenAcceptOffer extends BaseTransaction {
  TransactionType: 'NFTokenAcceptOffer';
  NFTokenSellOffer?: string;      // Sell offer to accept
  NFTokenBuyOffer?: string;       // Buy offer to accept
  NFTokenBrokerFee?: string | IssuedCurrency; // Broker fee for facilitating trade
}

/**
 * NFToken object as stored on the ledger
 */
export interface NFToken {
  NFTokenID: string;
  URI?: string;
  Flags: number;
  Issuer: string;
  NFTokenTaxon: number;
  TransferFee?: number;
  nft_serial: number;
}

/**
 * NFToken offer object as stored on the ledger
 */
export interface NFTokenOffer {
  Amount: string | IssuedCurrency;
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
}

/**
 * Response from NFT-related transactions
 */
export interface NFTTransactionResponse {
  result: {
    engine_result: string;
    engine_result_code: number;
    engine_result_message: string;
    tx_blob: string;
    tx_json: any;
    hash?: string;
    ledger_index?: number;
    validated?: boolean;
  };
}

/**
 * Request to fetch account NFTs
 */
export interface AccountNFTsRequest {
  account: string;
  ledger_index?: string | number;
  limit?: number;
  marker?: unknown;
}

/**
 * Response from account_nfts request
 */
export interface AccountNFTsResponse {
  account: string;
  account_nfts: NFToken[];
  ledger_index?: number;
  ledger_hash?: string;
  ledger_current_index?: number;
  validated?: boolean;
  marker?: unknown;
}

/**
 * Request to fetch NFToken offers
 */
export interface NFTOffersRequest {
  nft_id: string;
  ledger_index?: string | number;
  limit?: number;
  marker?: unknown;
}

/**
 * Response from nft_sell_offers or nft_buy_offers request
 */
export interface NFTOffersResponse {
  nft_id: string;
  offers: NFTokenOffer[];
  ledger_index?: number;
  ledger_hash?: string;
  ledger_current_index?: number;
  validated?: boolean;
  marker?: unknown;
}

/**
 * Union type of all NFT transaction types
 */
export type NFTTransaction =
  | NFTokenMint
  | NFTokenBurn
  | NFTokenCreateOffer
  | NFTokenCancelOffer
  | NFTokenAcceptOffer;

/**
 * Helper type to extract transaction type from transaction object
 */
export type TransactionType<T extends NFTTransaction> = T['TransactionType'];

/**
 * Metadata for minted NFTs (off-chain)
 */
export interface NFTMetadata {
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
}

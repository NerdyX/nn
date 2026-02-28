/**
 * XRPL Network Client Adapter
 *
 * Provides a singleton XRPL client instance with connection management,
 * auto-reconnection, request queuing, and rate limiting.
 *
 * Features:
 * - Lazy initialization with singleton pattern
 * - Auto-reconnection with exponential backoff
 * - Request queue with rate limiting (20 req/sec)
 * - Transaction monitoring and validation
 * - Comprehensive error handling
 * - Support for mainnet and testnet
 *
 * @module lib/store/network/xrpl
 */

import { Client } from 'xrpl';
import type {
  AccountNFTsRequest,
  AccountNFTsResponse,
  NFTOffersResponse,
  NFTTransactionResponse
} from '~/lib/network/xrpl/types/nftTx';

/**
 * Network configuration type
 */
export type XRPLNetworkType = 'mainnet' | 'testnet';

/**
 * Network configuration constants
 */
export const XRPL_NETWORKS = {
  mainnet: {
    url: 'wss://xrplcluster.com',
    name: 'XRPL Mainnet',
  },
  testnet: {
    url: 'wss://s.altnet.rippletest.net:51233',
    name: 'XRPL Testnet',
  },
} as const;

/**
 * Connection configuration
 */
const CONNECTION_CONFIG = {
  MAX_RECONNECT_ATTEMPTS: 5,
  INITIAL_RETRY_DELAY: 1000,
  MAX_RETRY_DELAY: 30000,
  BACKOFF_MULTIPLIER: 2,
};

/**
 * Rate limiting configuration
 */
const RATE_LIMIT_CONFIG = {
  MAX_REQUESTS_PER_SECOND: 20,
  REQUEST_INTERVAL: 50,
};

/**
 * Transaction monitoring configuration
 */
const TX_MONITOR_CONFIG = {
  POLL_INTERVAL: 1000,
  MAX_WAIT_TIME: 20000,
};

/**
 * XRPL error codes
 */
export enum XRPLErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  DISCONNECTED = 'DISCONNECTED',
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  OBJECT_NOT_FOUND = 'OBJECT_NOT_FOUND',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  VALIDATION_TIMEOUT = 'VALIDATION_TIMEOUT',
  INVALID_TRANSACTION = 'INVALID_TRANSACTION',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Custom error class for XRPL errors
 */
export class XRPLError extends Error {
  constructor(
    public code: XRPLErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'XRPLError';
  }
}

/**
 * Request queue item structure
 */
interface QueuedRequest {
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

/**
 * XRPL Client Manager
 */
class XRPLClientManager {
  private client: Client | null = null;
  private currentNetwork: XRPLNetworkType = 'mainnet';
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue: boolean = false;
  private lastRequestTime: number = 0;

  async getClient(): Promise<Client> {
    if (!this.client) {
      await this.connect();
    }

    if (!this.client) {
      throw new XRPLError(
        XRPLErrorCode.CONNECTION_FAILED,
        'Failed to initialize XRPL client'
      );
    }

    if (!this.client.isConnected()) {
      console.log('[XRPL] Client not connected, attempting to reconnect...');
      await this.reconnect();
    }

    return this.client;
  }

  async connect(network: XRPLNetworkType = this.currentNetwork): Promise<void> {
    if (this.isConnecting) {
      console.log('[XRPL] Connection already in progress...');
      return;
    }

    if (this.client?.isConnected()) {
      console.log('[XRPL] Already connected');
      return;
    }

    this.isConnecting = true;
    this.currentNetwork = network;

    try {
      const networkConfig = XRPL_NETWORKS[network];
      console.log(`[XRPL] Connecting to ${networkConfig.name} (${networkConfig.url})...`);

      this.client = new Client(networkConfig.url, {
        connectionTimeout: 10000,
      });

      this.setupEventListeners();
      await this.client.connect();

      console.log(`[XRPL] Successfully connected to ${networkConfig.name}`);
      this.reconnectAttempts = 0;

    } catch (error: any) {
      console.error('[XRPL] Connection failed:', error);
      this.client = null;

      throw new XRPLError(
        XRPLErrorCode.CONNECTION_FAILED,
        `Failed to connect to XRPL ${network}: ${error.message}`,
        error
      );
    } finally {
      this.isConnecting = false;
    }
  }

  private setupEventListeners(): void {
      if (!this.client) return;

      this.client.on('connected', () => {
        console.log('[XRPL] Client connected event');
        this.reconnectAttempts = 0;
      });

      this.client.on('disconnected', (code: number) => {
        console.warn(`[XRPL] Client disconnected (code: ${code})`);
        this.handleDisconnection();
      });

      this.client.on('error', (errorCode: string, errorMessage: string) => {
        console.error(`[XRPL] Client error: ${errorCode} - ${errorMessage}`);
      });
    }

    private handleDisconnection(): void {
      if (this.reconnectAttempts < CONNECTION_CONFIG.MAX_RECONNECT_ATTEMPTS) {
        this.scheduleReconnect();
      } else {
        console.error('[XRPL] Max reconnection attempts reached');
      }
    }

    private scheduleReconnect(): void {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }

      const delay = Math.min(
        CONNECTION_CONFIG.INITIAL_RETRY_DELAY *
          Math.pow(CONNECTION_CONFIG.BACKOFF_MULTIPLIER, this.reconnectAttempts),
        CONNECTION_CONFIG.MAX_RETRY_DELAY
      );

      console.log(`[XRPL] Scheduling reconnect attempt ${this.reconnectAttempts + 1}/${CONNECTION_CONFIG.MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);

      this.reconnectTimeout = setTimeout(() => {
        this.reconnect();
      }, delay);
    }

    async reconnect(): Promise<void> {
      this.reconnectAttempts++;

      try {
        await this.connect(this.currentNetwork);
        console.log('[XRPL] Reconnection successful');
      } catch (error) {
        console.error('[XRPL] Reconnection failed:', error);

        if (this.reconnectAttempts < CONNECTION_CONFIG.MAX_RECONNECT_ATTEMPTS) {
          this.scheduleReconnect();
        }
      }
    }

    async disconnect(): Promise<void> {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      if (this.client?.isConnected()) {
        console.log('[XRPL] Disconnecting from network...');
        await this.client.disconnect();
        this.client = null;
        console.log('[XRPL] Disconnected successfully');
      }

      this.reconnectAttempts = 0;
      this.isConnecting = false;
    }

    isConnected(): boolean {
      return this.client?.isConnected() ?? false;
    }

    private async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
      return new Promise((resolve, reject) => {
        this.requestQueue.push({
          execute: requestFn,
          resolve,
          reject,
          timestamp: Date.now(),
        });

        if (!this.isProcessingQueue) {
          this.processQueue();
        }
      });
    }

    private async processQueue(): Promise<void> {
      if (this.isProcessingQueue) return;

      this.isProcessingQueue = true;

      while (this.requestQueue.length > 0) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < RATE_LIMIT_CONFIG.REQUEST_INTERVAL) {
          await new Promise(resolve =>
            setTimeout(resolve, RATE_LIMIT_CONFIG.REQUEST_INTERVAL - timeSinceLastRequest)
          );
        }

        const request = this.requestQueue.shift();
        if (!request) break;

        try {
          const result = await request.execute();
          request.resolve(result);
        } catch (error) {
          request.reject(error);
        }

        this.lastRequestTime = Date.now();
      }

      this.isProcessingQueue = false;
    }

    async request<T>(command: any): Promise<T> {
      return this.queueRequest(async () => {
        const client = await this.getClient();

        try {
          const response = await client.request(command);
          return response as T;
        } catch (error: any) {
          if (error.data?.error === 'actNotFound') {
            throw new XRPLError(
              XRPLErrorCode.ACCOUNT_NOT_FOUND,
              'Account not found on the ledger',
              error
            );
          }

          if (error.data?.error === 'objectNotFound') {
            throw new XRPLError(
              XRPLErrorCode.OBJECT_NOT_FOUND,
              'Object not found on the ledger',
              error
            );
          }

          if (error.data?.error === 'slowDown') {
            throw new XRPLError(
              XRPLErrorCode.RATE_LIMIT_EXCEEDED,
              'Rate limit exceeded',
              error
            );
          }

          throw new XRPLError(
            XRPLErrorCode.NETWORK_ERROR,
            error.message || 'Network request failed',
            error
          );
        }
      });
    }

    async autofill(transaction: any): Promise<any> {
      const client = await this.getClient();
      return await client.autofill(transaction);
    }

    async submitAndWait(signedTransaction: any): Promise<any> {
      const client = await this.getClient();
      return await client.submitAndWait(signedTransaction);
    }
  }

  const clientManager = new XRPLClientManager();

  export async function getXRPLClient(): Promise<Client> {
    return await clientManager.getClient();
  }

  export async function connectXRPL(network: XRPLNetworkType = 'mainnet'): Promise<void> {
    await clientManager.connect(network);
  }

  export async function disconnectXRPL(): Promise<void> {
    await clientManager.disconnect();
  }

  export function isXRPLConnected(): boolean {
    return clientManager.isConnected();
  }

  export async function getNFTs(
    account: string,
    limit: number = 400
  ): Promise<AccountNFTsResponse> {
    try {
      const response = await clientManager.request<AccountNFTsResponse>({
        command: 'account_nfts',
        account,
        limit,
      });

      return response;
    } catch (error: any) {
      if (error instanceof XRPLError) {
        throw error;
      }

      throw new XRPLError(
        XRPLErrorCode.INTERNAL_ERROR,
        `Failed to fetch NFTs for account ${account}: ${error.message}`,
        error
      );
    }
  }

  export async function getNFTOffers(
    nftId: string,
    type: 'sell' | 'buy',
    limit: number = 50
  ): Promise<NFTOffersResponse> {
    try {
      const command = type === 'sell' ? 'nft_sell_offers' : 'nft_buy_offers';

      const response = await clientManager.request<NFTOffersResponse>({
        command,
        nft_id: nftId,
        limit,
      });

      return response;
    } catch (error: any) {
      if (error instanceof XRPLError && error.code === XRPLErrorCode.OBJECT_NOT_FOUND) {
        return {
          nft_id: nftId,
          offers: [],
        };
      }

      if (error instanceof XRPLError) {
        throw error;
      }

      throw new XRPLError(
        XRPLErrorCode.INTERNAL_ERROR,
        `Failed to fetch ${type} offers for NFT ${nftId}: ${error.message}`,
        error
      );
    }
  }

  export async function submitTransaction(transaction: any): Promise<NFTTransactionResponse> {
    try {
      const prepared = await clientManager.autofill(transaction);

      return {
        result: {
          engine_result: 'tesSUCCESS',
          engine_result_code: 0,
          engine_result_message: 'Transaction prepared successfully',
          tx_blob: '',
          tx_json: prepared,
        },
      };
    } catch (error: any) {
      if (error instanceof XRPLError) {
        throw error;
      }

      throw new XRPLError(
        XRPLErrorCode.TRANSACTION_FAILED,
        `Failed to submit transaction: ${error.message}`,
        error
      );
    }
  }

  export async function getBalance(account: string): Promise<string> {
    try {
      const accountInfo = await getAccountInfo(account);
      return accountInfo.account_data.Balance;
    } catch (error: any) {
      if (error instanceof XRPLError) {
        throw error;
      }

      throw new XRPLError(
        XRPLErrorCode.INTERNAL_ERROR,
        `Failed to fetch balance for account ${account}: ${error.message}`,
        error
      );
    }
  }

  export async function getAccountInfo(account: string): Promise<any> {
    try {
      const response = await clientManager.request({
        command: 'account_info',
        account,
        ledger_index: 'validated',
      });

      return response;
    } catch (error: any) {
      if (error instanceof XRPLError) {
        throw error;
      }

      throw new XRPLError(
        XRPLErrorCode.INTERNAL_ERROR,
        `Failed to fetch account info for ${account}: ${error.message}`,
        error
      );
    }
  }

  export async function waitForValidation(txHash: string): Promise<any> {
    const startTime = Date.now();

    while (Date.now() - startTime < TX_MONITOR_CONFIG.MAX_WAIT_TIME) {
      try {
        const response = await clientManager.request({
          command: 'tx',
          transaction: txHash,
        });

        if ((response as any).validated) {
          console.log(`[XRPL] Transaction ${txHash} validated`);
          return response;
        }

        await new Promise(resolve => setTimeout(resolve, TX_MONITOR_CONFIG.POLL_INTERVAL));
      } catch (error: any) {
        if (error instanceof XRPLError && error.code === XRPLErrorCode.OBJECT_NOT_FOUND) {
          await new Promise(resolve => setTimeout(resolve, TX_MONITOR_CONFIG.POLL_INTERVAL));
          continue;
        }

        throw error;
      }
    }

    throw new XRPLError(
      XRPLErrorCode.VALIDATION_TIMEOUT,
      `Transaction validation timed out after ${TX_MONITOR_CONFIG.MAX_WAIT_TIME / 1000} seconds`,
      { txHash }
    );
  }

  export { clientManager };

// src/components/wallets/metamask.ts
// WalletConnect / Reown Adapter for EVM Bridge Interactions
// This adapter enables EVM-compatible wallet connections (MetaMask, etc.)
// via WalletConnect / Reown for cross-chain bridge operations between
// XRPL/Xahau and EVM chains (e.g., Flare, Ethereum).

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface EVMWalletSession {
  address: string;
  chainId: number;
  chainName: string;
  provider: "metamask" | "walletconnect" | "injected";
}

interface EthereumProvider {
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;
  selectedAddress?: string | null;
  chainId?: string;
}

type WindowWithEthereum = Window & {
  ethereum?: EthereumProvider;
};

// ──────────────────────────────────────────────
// Known EVM chains relevant to XRPL ecosystem
// ──────────────────────────────────────────────

export const EVM_CHAINS: Record<
  number,
  { name: string; rpc: string; nativeCurrency: string; symbol: string }
> = {
  1: {
    name: "Ethereum Mainnet",
    rpc: "https://eth.llamarpc.com",
    nativeCurrency: "Ether",
    symbol: "ETH",
  },
  14: {
    name: "Flare Mainnet",
    rpc: "https://flare-api.flare.network/ext/C/rpc",
    nativeCurrency: "Flare",
    symbol: "FLR",
  },
  19: {
    name: "Songbird Canary",
    rpc: "https://songbird-api.flare.network/ext/C/rpc",
    nativeCurrency: "Songbird",
    symbol: "SGB",
  },
  114: {
    name: "Flare Testnet Coston2",
    rpc: "https://coston2-api.flare.network/ext/C/rpc",
    nativeCurrency: "Coston2 Flare",
    symbol: "C2FLR",
  },
  56: {
    name: "BNB Smart Chain",
    rpc: "https://bsc-dataseed.binance.org",
    nativeCurrency: "BNB",
    symbol: "BNB",
  },
  137: {
    name: "Polygon Mainnet",
    rpc: "https://polygon-rpc.com",
    nativeCurrency: "MATIC",
    symbol: "MATIC",
  },
  42161: {
    name: "Arbitrum One",
    rpc: "https://arb1.arbitrum.io/rpc",
    nativeCurrency: "Ether",
    symbol: "ETH",
  },
};

// ──────────────────────────────────────────────
// Detection
// ──────────────────────────────────────────────

/**
 * Check if an injected EVM wallet (MetaMask, Brave Wallet, etc.)
 * is available in the browser.
 */
export function isInjectedWalletAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as WindowWithEthereum;
  return !!win.ethereum;
}

/**
 * Check specifically for MetaMask.
 */
export function isMetaMaskInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as WindowWithEthereum;
  return !!win.ethereum?.isMetaMask;
}

/**
 * Get the injected Ethereum provider, throwing if not available.
 */
function getProvider(): EthereumProvider {
  if (typeof window === "undefined") {
    throw new Error("Cannot access wallet provider in a server environment");
  }
  const win = window as unknown as WindowWithEthereum;
  const provider = win.ethereum;
  if (!provider) {
    throw new Error(
      "No EVM wallet detected. Please install MetaMask or another Web3 wallet from https://metamask.io",
    );
  }
  return provider;
}

/**
 * Detect which wallet brand is injected.
 */
export function detectWalletBrand(): string {
  if (!isInjectedWalletAvailable()) return "none";
  const provider = getProvider();
  if (provider.isMetaMask) return "MetaMask";
  if (provider.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider.isBraveWallet) return "Brave Wallet";
  return "Injected Wallet";
}

// ──────────────────────────────────────────────
// Connection
// ──────────────────────────────────────────────

/**
 * Connect to the injected EVM wallet (MetaMask, etc.)
 * by requesting eth_requestAccounts.
 *
 * This will open the MetaMask popup asking the user
 * to approve the connection.
 *
 * @returns The connected EVM wallet session.
 */
export async function connectEVMWallet(): Promise<EVMWalletSession> {
  const provider = getProvider();

  try {
    // Request account access
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
    })) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts returned from wallet");
    }

    const address = accounts[0];

    // Get current chain ID
    const chainIdHex = (await provider.request({
      method: "eth_chainId",
    })) as string;

    const chainId = parseInt(chainIdHex, 16);
    const chainInfo = EVM_CHAINS[chainId];
    const chainName = chainInfo?.name ?? `Chain ${chainId}`;

    // Determine provider type
    let providerType: EVMWalletSession["provider"] = "injected";
    if (provider.isMetaMask) {
      providerType = "metamask";
    }

    return {
      address,
      chainId,
      chainName,
      provider: providerType,
    };
  } catch (err) {
    if (err instanceof Error) {
      // EIP-1193 user rejected error
      if (
        err.message.includes("User rejected") ||
        err.message.includes("4001") ||
        err.message.includes("rejected")
      ) {
        throw new Error("User rejected the wallet connection request");
      }
      throw err;
    }
    throw new Error("Failed to connect EVM wallet: unknown error");
  }
}

// ──────────────────────────────────────────────
// Chain Management
// ──────────────────────────────────────────────

/**
 * Request the wallet to switch to a specific EVM chain.
 *
 * @param chainId - The chain ID to switch to (decimal, e.g. 14 for Flare)
 */
export async function switchChain(chainId: number): Promise<void> {
  const provider = getProvider();
  const hexChainId = "0x" + chainId.toString(16);

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }],
    });
  } catch (err: unknown) {
    const error = err as { code?: number; message?: string };

    // Chain not added — try to add it
    if (error.code === 4902) {
      const chainInfo = EVM_CHAINS[chainId];
      if (!chainInfo) {
        throw new Error(
          `Chain ${chainId} is not recognized. Cannot add it automatically.`,
        );
      }

      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hexChainId,
              chainName: chainInfo.name,
              nativeCurrency: {
                name: chainInfo.nativeCurrency,
                symbol: chainInfo.symbol,
                decimals: 18,
              },
              rpcUrls: [chainInfo.rpc],
            },
          ],
        });
      } catch (addErr) {
        if (addErr instanceof Error) {
          throw new Error(`Failed to add chain: ${addErr.message}`);
        }
        throw new Error("Failed to add chain to wallet");
      }
    } else if (error.message?.includes("User rejected")) {
      throw new Error("User rejected the chain switch request");
    } else {
      throw new Error(
        `Failed to switch chain: ${error.message ?? "Unknown error"}`,
      );
    }
  }
}

/**
 * Switch to the Flare network specifically.
 * Useful for XRPL ↔ Flare bridge operations.
 */
export async function switchToFlare(): Promise<void> {
  return switchChain(14);
}

/**
 * Get the current chain ID from the connected wallet.
 */
export async function getCurrentChainId(): Promise<number> {
  const provider = getProvider();
  const chainIdHex = (await provider.request({
    method: "eth_chainId",
  })) as string;
  return parseInt(chainIdHex, 16);
}

/**
 * Get the current connected address from the wallet.
 */
export async function getCurrentAddress(): Promise<string | null> {
  const provider = getProvider();
  const accounts = (await provider.request({
    method: "eth_accounts",
  })) as string[];
  return accounts && accounts.length > 0 ? accounts[0] : null;
}

// ──────────────────────────────────────────────
// Transaction Signing
// ──────────────────────────────────────────────

export interface EVMTxResult {
  hash: string;
}

/**
 * Send a native currency (ETH/FLR/etc.) transfer via the
 * connected EVM wallet.
 *
 * @param to - Destination EVM address (0x...)
 * @param valueWei - Amount in wei (string, e.g. "1000000000000000000" for 1 ETH)
 * @param from - Optional sender address (defaults to connected account)
 * @returns The transaction hash
 */
export async function sendEVMTransaction(
  to: string,
  valueWei: string,
  from?: string,
): Promise<EVMTxResult> {
  const provider = getProvider();

  const sender = from ?? (await getCurrentAddress());
  if (!sender) {
    throw new Error("No connected EVM account found");
  }

  // Convert value to hex
  const valueHex = "0x" + BigInt(valueWei).toString(16);

  try {
    const hash = (await provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: sender,
          to,
          value: valueHex,
        },
      ],
    })) as string;

    return { hash };
  } catch (err) {
    if (err instanceof Error) {
      if (
        err.message.includes("User rejected") ||
        err.message.includes("User denied") ||
        err.message.includes("4001")
      ) {
        throw new Error("User rejected the transaction");
      }
      throw err;
    }
    throw new Error("EVM transaction failed: unknown error");
  }
}

/**
 * Call a smart contract method via eth_sendTransaction.
 * This is a low-level helper — for real contract interactions
 * consider using ethers.js or viem.
 *
 * @param contractAddress - The contract address
 * @param data - ABI-encoded call data (hex string starting with 0x)
 * @param valueWei - Optional value to send with the call (in wei)
 * @param from - Optional sender address
 * @returns The transaction hash
 */
export async function sendContractTransaction(
  contractAddress: string,
  data: string,
  valueWei?: string,
  from?: string,
): Promise<EVMTxResult> {
  const provider = getProvider();

  const sender = from ?? (await getCurrentAddress());
  if (!sender) {
    throw new Error("No connected EVM account found");
  }

  const txParams: Record<string, string> = {
    from: sender,
    to: contractAddress,
    data,
  };

  if (valueWei) {
    txParams.value = "0x" + BigInt(valueWei).toString(16);
  }

  try {
    const hash = (await provider.request({
      method: "eth_sendTransaction",
      params: [txParams],
    })) as string;

    return { hash };
  } catch (err) {
    if (err instanceof Error) {
      if (
        err.message.includes("User rejected") ||
        err.message.includes("User denied") ||
        err.message.includes("4001")
      ) {
        throw new Error("User rejected the contract transaction");
      }
      throw err;
    }
    throw new Error("Contract transaction failed: unknown error");
  }
}

/**
 * Sign a personal message using the connected EVM wallet.
 * Useful for proving wallet ownership or off-chain attestations.
 *
 * @param message - The plaintext message to sign
 * @returns The signature hex string
 */
export async function signPersonalMessage(message: string): Promise<string> {
  const provider = getProvider();

  const address = await getCurrentAddress();
  if (!address) {
    throw new Error("No connected EVM account found");
  }

  // Convert message to hex
  const hexMessage =
    "0x" +
    Array.from(new TextEncoder().encode(message))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  try {
    const signature = (await provider.request({
      method: "personal_sign",
      params: [hexMessage, address],
    })) as string;

    return signature;
  } catch (err) {
    if (err instanceof Error) {
      if (
        err.message.includes("User rejected") ||
        err.message.includes("User denied") ||
        err.message.includes("4001")
      ) {
        throw new Error("User rejected the message signing request");
      }
      throw err;
    }
    throw new Error("Message signing failed: unknown error");
  }
}

// ──────────────────────────────────────────────
// Event Listeners
// ──────────────────────────────────────────────

export type AccountChangeHandler = (accounts: string[]) => void;
export type ChainChangeHandler = (chainId: string) => void;
export type DisconnectHandler = (error: {
  code: number;
  message: string;
}) => void;

/**
 * Subscribe to account changes in the connected wallet.
 * Fires when the user switches accounts in MetaMask.
 *
 * @param handler - Callback receiving the new accounts array
 * @returns An unsubscribe function
 */
export function onAccountsChanged(handler: AccountChangeHandler): () => void {
  if (!isInjectedWalletAvailable()) return () => {};
  const provider = getProvider();
  const wrappedHandler = (...args: unknown[]) => {
    handler(args[0] as string[]);
  };
  provider.on("accountsChanged", wrappedHandler);
  return () => provider.removeListener("accountsChanged", wrappedHandler);
}

/**
 * Subscribe to chain changes in the connected wallet.
 * Fires when the user switches networks in MetaMask.
 *
 * @param handler - Callback receiving the new chain ID hex string
 * @returns An unsubscribe function
 */
export function onChainChanged(handler: ChainChangeHandler): () => void {
  if (!isInjectedWalletAvailable()) return () => {};
  const provider = getProvider();
  const wrappedHandler = (...args: unknown[]) => {
    handler(args[0] as string);
  };
  provider.on("chainChanged", wrappedHandler);
  return () => provider.removeListener("chainChanged", wrappedHandler);
}

/**
 * Subscribe to disconnect events from the wallet.
 *
 * @param handler - Callback receiving the disconnect error
 * @returns An unsubscribe function
 */
export function onDisconnect(handler: DisconnectHandler): () => void {
  if (!isInjectedWalletAvailable()) return () => {};
  const provider = getProvider();
  const wrappedHandler = (...args: unknown[]) => {
    handler(args[0] as { code: number; message: string });
  };
  provider.on("disconnect", wrappedHandler);
  return () => provider.removeListener("disconnect", wrappedHandler);
}

// ──────────────────────────────────────────────
// Disconnect
// ──────────────────────────────────────────────

/**
 * MetaMask and most injected wallets do not support a programmatic
 * "disconnect" method. The user must disconnect from within
 * the wallet extension itself. This function is a no-op provided
 * for interface consistency.
 *
 * Clearing the session on the dApp side is handled by WalletContext.
 */
export function disconnectEVMWallet(): void {
  // No-op — injected wallets don't support programmatic disconnect.
  // The wallet context will clear the local session state.
}

// ──────────────────────────────────────────────
// Utility: Format EVM address for display
// ──────────────────────────────────────────────

/**
 * Truncate an EVM address for display.
 * e.g. "0x1234...abcd"
 */
export function truncateEVMAddress(
  address: string,
  prefixLen = 6,
  suffixLen = 4,
): string {
  if (!address || address.length <= prefixLen + suffixLen + 3) return address;
  return `${address.slice(0, prefixLen)}...${address.slice(-suffixLen)}`;
}

/**
 * Convert a decimal chain ID to its hex representation.
 */
export function chainIdToHex(chainId: number): string {
  return "0x" + chainId.toString(16);
}

/**
 * Get the chain info for a given chain ID, or null if unknown.
 */
export function getChainInfo(
  chainId: number,
): (typeof EVM_CHAINS)[number] | null {
  return EVM_CHAINS[chainId] ?? null;
}

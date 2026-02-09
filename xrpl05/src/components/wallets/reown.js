// src/components/wallets/reown.js
// ──────────────────────────────────────────────────────────────
// Reown (WalletConnect) — Wallet Adapter for XRPL / Xahau
//
// This module re-exports the WalletConnect / Reown Universal
// Connector configuration from AppKitProvider.tsx and provides
// thin convenience wrappers that integrate with the shared
// WalletContext used throughout the application.
//
// Reown enables connections from mobile wallets that support the
// WalletConnect protocol — including Xaman, Trust Wallet, and
// other WC-compatible XRPL wallets.
//
// To use this adapter you need a Reown project ID from:
//   https://dashboard.reown.com
//
// Set it in your .env as:
//   VITE_PROJECT_ID=your-project-id-here
// ──────────────────────────────────────────────────────────────

import { projectId, getUniversalConnector } from "./AppKitProvider";

// ──────────────────────────────────────────────
// Singleton connector instance
// ──────────────────────────────────────────────

/** @type {import("@reown/appkit-universal-connector").UniversalConnector | null} */
let _connector = null;

/** @type {(() => void) | null} */
let _disconnectHandler = null;

// ──────────────────────────────────────────────
// Detection
// ──────────────────────────────────────────────

/**
 * Check whether the Reown / WalletConnect configuration is
 * available (i.e. a valid project ID has been set).
 *
 * @returns {boolean}
 */
export function isReownAvailable() {
  return !!projectId && projectId !== "your-reown-project-id-here";
}

// ──────────────────────────────────────────────
// Initialisation
// ──────────────────────────────────────────────

/**
 * Lazily initialise and return the Universal Connector singleton.
 * The first call performs the async init; subsequent calls return
 * the cached instance.
 *
 * @returns {Promise<import("@reown/appkit-universal-connector").UniversalConnector>}
 */
export async function getConnector() {
  if (_connector) return _connector;

  if (!isReownAvailable()) {
    throw new Error(
      "Reown project ID is not configured. " +
        "Set VITE_PROJECT_ID in your .env file. " +
        "Get one at https://dashboard.reown.com",
    );
  }

  _connector = await getUniversalConnector();
  return _connector;
}

// ──────────────────────────────────────────────
// Connection
// ──────────────────────────────────────────────

/**
 * @typedef {Object} ReownConnectResult
 * @property {string} address  - The connected r-address (XRPL) or 0x address (EVM)
 * @property {string} chain    - The chain namespace, e.g. "xrpl" or "sui"
 * @property {string} provider - Always "reown"
 */

/**
 * Open the WalletConnect / Reown modal to let the user scan a
 * QR code or deep-link from a compatible mobile wallet.
 *
 * After the user approves the connection the returned promise
 * resolves with the connected address and chain info.
 *
 * @param {Object} [options]
 * @param {string} [options.namespace="xrpl"]  - The CAIP-2 namespace to request
 * @param {number} [options.timeoutMs=120000]  - Max time to wait for approval
 * @returns {Promise<ReownConnectResult>}
 */
export async function connectReown(options = {}) {
  const { namespace = "xrpl", timeoutMs = 120_000 } = options;
  const connector = await getConnector();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("WalletConnect connection timed out"));
    }, timeoutMs);

    // The Universal Connector emits session events.
    // We listen for the first successful session_update or
    // session_event that contains account information.
    const handleSession = (session) => {
      clearTimeout(timer);

      if (!session) {
        reject(new Error("WalletConnect session was not established"));
        return;
      }

      // Extract the first account from the approved namespaces
      const namespaces = session.namespaces || {};
      const ns = namespaces[namespace];

      if (!ns || !ns.accounts || ns.accounts.length === 0) {
        reject(
          new Error(
            `No ${namespace} accounts were approved by the wallet. ` +
              "Make sure your wallet supports the requested chain.",
          ),
        );
        return;
      }

      // CAIP-10 account format: "namespace:chainId:address"
      const caip10 = ns.accounts[0];
      const parts = caip10.split(":");
      const address = parts.length >= 3 ? parts[2] : caip10;

      resolve({
        address,
        chain: namespace,
        provider: "reown",
      });
    };

    try {
      // Attempt to connect — this opens the modal / QR
      if (typeof connector.connect === "function") {
        connector
          .connect({
            requiredNamespaces: {
              [namespace]: {
                methods:
                  namespace === "xrpl"
                    ? ["xrpl_signTransaction", "xrpl_signPersonalMessage"]
                    : [],
                chains: [], // filled by UniversalConnector from config
                events: [],
              },
            },
          })
          .then(handleSession)
          .catch((err) => {
            clearTimeout(timer);
            if (
              err?.message?.includes("rejected") ||
              err?.message?.includes("User") ||
              err?.code === 5000
            ) {
              reject(new Error("User rejected the WalletConnect request"));
            } else {
              reject(err);
            }
          });
      } else {
        // Fallback: some versions of the connector expose a
        // different API surface. Provide a helpful error.
        clearTimeout(timer);
        reject(
          new Error(
            "The Reown Universal Connector does not expose a connect() method. " +
              "Please check you are using a compatible version of @reown/appkit-universal-connector.",
          ),
        );
      }
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
}

// ──────────────────────────────────────────────
// Transaction Signing
// ──────────────────────────────────────────────

/**
 * @typedef {Object} ReownSignResult
 * @property {string|null} hash      - Transaction hash (if submitted)
 * @property {string|null} txBlob    - Signed transaction blob
 * @property {boolean}     signed    - Whether the transaction was signed
 */

/**
 * Sign an XRPL / Xahau transaction via the connected
 * WalletConnect wallet.
 *
 * The wallet will present the transaction details to the user
 * for approval. If the wallet supports auto-submit the
 * transaction may be submitted directly.
 *
 * @param {Record<string, unknown>} txjson - The XRPL transaction JSON
 * @returns {Promise<ReownSignResult>}
 */
export async function signWithReown(txjson) {
  const connector = await getConnector();

  if (!connector.session) {
    throw new Error(
      "No active WalletConnect session. Please connect a wallet first.",
    );
  }

  try {
    // Use the WC JSON-RPC method for XRPL signing
    const result = await connector.request({
      topic: connector.session.topic,
      chainId: "xrpl:mainnet",
      request: {
        method: "xrpl_signTransaction",
        params: {
          tx_json: txjson,
        },
      },
    });

    if (!result) {
      throw new Error("Wallet did not return a signing result");
    }

    return {
      hash: result.hash ?? result.tx_hash ?? null,
      txBlob: result.tx_blob ?? result.signedTransaction ?? null,
      signed: true,
    };
  } catch (err) {
    if (
      err?.message?.includes("rejected") ||
      err?.message?.includes("User") ||
      err?.code === 5000
    ) {
      throw new Error("User rejected the WalletConnect transaction");
    }
    throw err;
  }
}

/**
 * Sign a personal message via the connected WalletConnect wallet.
 * Useful for proving wallet ownership without submitting a
 * transaction.
 *
 * @param {string} message - The plaintext message to sign
 * @returns {Promise<string>} The signature hex
 */
export async function signMessageWithReown(message) {
  const connector = await getConnector();

  if (!connector.session) {
    throw new Error(
      "No active WalletConnect session. Please connect a wallet first.",
    );
  }

  try {
    const result = await connector.request({
      topic: connector.session.topic,
      chainId: "xrpl:mainnet",
      request: {
        method: "xrpl_signPersonalMessage",
        params: {
          message,
        },
      },
    });

    if (!result || !result.signature) {
      throw new Error("Wallet did not return a signature");
    }

    return result.signature;
  } catch (err) {
    if (
      err?.message?.includes("rejected") ||
      err?.message?.includes("User") ||
      err?.code === 5000
    ) {
      throw new Error("User rejected the message signing request");
    }
    throw err;
  }
}

// ──────────────────────────────────────────────
// Session Management
// ──────────────────────────────────────────────

/**
 * Check if there is an active WalletConnect session.
 *
 * @returns {boolean}
 */
export function hasActiveSession() {
  return !!_connector?.session;
}

/**
 * Get the address from the current active session, if any.
 *
 * @param {string} [namespace="xrpl"] - The CAIP-2 namespace
 * @returns {string|null} The connected address or null
 */
export function getSessionAddress(namespace = "xrpl") {
  if (!_connector?.session) return null;

  const ns = _connector.session.namespaces?.[namespace];
  if (!ns?.accounts || ns.accounts.length === 0) return null;

  const caip10 = ns.accounts[0];
  const parts = caip10.split(":");
  return parts.length >= 3 ? parts[2] : caip10;
}

/**
 * Register an event handler that fires when the WalletConnect
 * session is disconnected (either by the user or the wallet).
 *
 * @param {() => void} handler - Callback on disconnect
 */
export function onReownDisconnect(handler) {
  _disconnectHandler = handler;

  if (_connector && typeof _connector.on === "function") {
    _connector.on("session_delete", () => {
      if (_disconnectHandler) _disconnectHandler();
    });
    _connector.on("session_expire", () => {
      if (_disconnectHandler) _disconnectHandler();
    });
  }
}

// ──────────────────────────────────────────────
// Disconnect
// ──────────────────────────────────────────────

/**
 * Disconnect the active WalletConnect session.
 *
 * This sends a session_delete to the connected wallet,
 * cleans up the local connector state, and invokes the
 * registered disconnect handler (if any).
 *
 * @returns {Promise<void>}
 */
export async function disconnectReown() {
  if (!_connector) return;

  try {
    if (_connector.session && typeof _connector.disconnect === "function") {
      await _connector.disconnect({
        topic: _connector.session.topic,
        reason: {
          code: 6000,
          message: "User disconnected from dApp",
        },
      });
    }
  } catch (err) {
    // Log but don't throw — we still want to clear local state
    console.warn("Error during WalletConnect disconnect:", err);
  }

  // Clean up singleton
  _connector = null;

  // Fire disconnect handler
  if (_disconnectHandler) {
    _disconnectHandler();
    _disconnectHandler = null;
  }
}

// ──────────────────────────────────────────────
// Re-exports for convenience
// ──────────────────────────────────────────────

export { projectId };

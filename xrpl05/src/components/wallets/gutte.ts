// src/components/wallets/gutte.ts
// ─────────────────────────────────────────────────────────────
// Single source of truth for all Gutte Wallet integration.
// The header simply calls connectGutteAndBind() — everything
// else (detection, connection, context hydration, persistence,
// and live event binding) is handled here.
// ─────────────────────────────────────────────────────────────

import type { Signal } from "@builder.io/qwik";
import {
  persistWalletSession,
  clearWalletSession,
} from "~/context/wallet-context";

// ══════════════════════════════════════════════════════════════
//  Types
// ══════════════════════════════════════════════════════════════

/** Shape returned by the raw Gutte extension connect call. */
export interface GutteSession {
  address: string;
  gutteNetwork?: string | null;
}

/**
 * Minimal wallet-context contract that this module needs.
 * Mirrors the signals exposed by WalletContext in the app.
 * Using a standalone interface keeps this module decoupled
 * from the Qwik context definition itself.
 */
export interface WalletCtx {
  connected: Signal<boolean>;
  walletType: Signal<string | null>;
  address: Signal<string>;
  displayName: Signal<string>;
  gutteNetwork: Signal<string | null>;
}

/** Callback fired when the extension reports a disconnect. */
export type OnDisconnectFn = () => void;

// ══════════════════════════════════════════════════════════════
//  Internal helpers
// ══════════════════════════════════════════════════════════════

/**
 * Safely access the injected `window.gutte` object.
 * Returns `undefined` when running server-side or when the
 * extension hasn't injected yet.
 */
function getGutteProvider(): any | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as any).gutte;
}

// ══════════════════════════════════════════════════════════════
//  1.  Wait for extension injection
// ══════════════════════════════════════════════════════════════

/**
 * Poll for the Gutte browser extension to inject `window.gutte`.
 *
 * @param timeoutMs  Maximum wait time in milliseconds (default 3 000).
 * @returns          `true` if the extension was detected, `false` on timeout.
 */
export async function waitForGutte(timeoutMs = 3000): Promise<boolean> {
  // Already available — fast path
  if (getGutteProvider()) return true;

  return new Promise<boolean>((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (getGutteProvider()) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - start >= timeoutMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, 100);
  });
}

// ══════════════════════════════════════════════════════════════
//  2.  Raw connect (no context side-effects)
// ══════════════════════════════════════════════════════════════

/**
 * Invoke the Gutte extension's connect flow.
 *
 * Returns a lightweight {@link GutteSession} on success,
 * or `null` if the user rejected / cancelled.
 *
 * This function intentionally does **not** touch any Qwik
 * signals or localStorage — that's the job of
 * {@link connectGutteAndBind}.
 */
export async function connectGutte(): Promise<GutteSession | null> {
  const gutte = getGutteProvider();
  if (!gutte) return null;

  try {
    // The Gutte extension exposes a promise-based `.connect()` method.
    // Adjust the property names here if the real SDK differs.
    const result = await gutte.connect();

    if (!result?.address) return null;

    return {
      address: result.address,
      gutteNetwork: result.network ?? result.networkId ?? null,
    };
  } catch (err) {
    console.warn("[gutte] connect() rejected or threw:", err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
//  3.  Bind live extension events to keep context in sync
// ══════════════════════════════════════════════════════════════

/**
 * Subscribe to ongoing extension events so the UI stays in
 * sync when the user switches accounts, changes networks,
 * or disconnects from within the Gutte popup.
 *
 * Safe to call multiple times — but ideally called once right
 * after a successful connect.
 *
 * @param ctx           The wallet context signals to mutate.
 * @param onDisconnect  Optional callback (e.g. close the modal).
 */
export function bindGutteEvents(
  ctx: WalletCtx,
  onDisconnect?: OnDisconnectFn,
): void {
  const gutte = getGutteProvider();
  if (!gutte?.on) {
    console.warn(
      "[gutte] Extension does not expose an event emitter (.on). " +
        "Live account/network updates will not be tracked.",
    );
    return;
  }

  // ── Account changed ──
  gutte.on("accountChanged", (newAddress: string) => {
    if (!newAddress) return;
    ctx.address.value = newAddress;

    // Re-persist with the updated address
    persistWalletSession({
      address: newAddress,
      type: "gutte",
      connectedAt: new Date().toISOString(),
    });
  });

  // ── Network changed ──
  gutte.on("networkChanged", (newNetwork: string) => {
    ctx.gutteNetwork.value = newNetwork ?? null;
  });

  // ── Disconnect ──
  gutte.on("disconnect", () => {
    ctx.connected.value = false;
    ctx.walletType.value = null;
    ctx.address.value = "";
    ctx.displayName.value = "";
    ctx.gutteNetwork.value = null;

    clearWalletSession();

    onDisconnect?.();
  });
}

// ══════════════════════════════════════════════════════════════
//  4.  HIGH-LEVEL entry point used by the header
// ══════════════════════════════════════════════════════════════

/**
 * One-call entry point that performs the full lifecycle:
 *
 *   1. Wait for the extension to inject `window.gutte`.
 *   2. Invoke the user-facing connect prompt.
 *   3. Hydrate the Qwik wallet-context signals.
 *   4. Persist the session to localStorage.
 *   5. Bind live events (account change, network change, disconnect).
 *
 * Throws descriptive `Error`s for the two expected failure
 * modes so the header can surface them in `walletError`.
 *
 * @example
 * ```ts
 * // In header-modern.tsx
 * const connectGutteWallet = $(async () => {
 *   walletLoading.value = "gutte";
 *   walletError.value = "";
 *   try {
 *     const { connectGutteAndBind } = await import("../wallets/gutte");
 *     await connectGutteAndBind(walletCtx, () => {
 *       showWalletModal.value = false;
 *     });
 *     showWalletModal.value = false;
 *     walletLoading.value = null;
 *   } catch (e) {
 *     walletError.value = e instanceof Error ? e.message : "Connection failed";
 *     walletLoading.value = null;
 *   }
 * });
 * ```
 *
 * @param ctx           The wallet context signals to hydrate.
 * @param onDisconnect  Optional callback for extension-initiated disconnects.
 */
export async function connectGutteAndBind(
  ctx: WalletCtx,
  onDisconnect?: OnDisconnectFn,
): Promise<void> {
  // ── Step 1: Detect extension ──
  const installed = await waitForGutte(3000);
  if (!installed) {
    throw new Error(
      "Gutte wallet extension not detected. " +
        "Please install it and refresh the page.",
    );
  }

  // ── Step 2: Connect ──
  const session = await connectGutte();
  if (!session) {
    throw new Error("Connection was rejected or cancelled.");
  }

  // ── Step 3: Hydrate context (single source of truth) ──
  ctx.connected.value = true;
  ctx.walletType.value = "gutte";
  ctx.address.value = session.address;
  ctx.displayName.value = "Gutte Wallet";
  ctx.gutteNetwork.value = session.gutteNetwork ?? null;

  // ── Step 4: Persist to localStorage ──
  persistWalletSession({
    address: session.address,
    type: "gutte",
    connectedAt: new Date().toISOString(),
  });

  // ── Step 5: Bind live events ──
  bindGutteEvents(ctx, onDisconnect);
}

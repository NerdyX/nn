// src/context/wallet-context.tsx
import { createContextId, useContext, type Signal } from "@builder.io/qwik";

// ──────────────────────────────────────────────
// Wallet types
// ──────────────────────────────────────────────

export type WalletType = "xaman" | "crossmark" | "gem" | "reown" | null;

export interface WalletSession {
  /** The r-address of the connected wallet */
  address: string;
  /** Which wallet provider is in use */
  type: WalletType;
  /** ISO timestamp of when the session was established */
  connectedAt: string;
  /** Optional display name from Xaman user info */
  name?: string;
}

// ──────────────────────────────────────────────
// Context shape
// ──────────────────────────────────────────────

export interface WalletContextState {
  /** Whether a wallet is currently connected */
  connected: Signal<boolean>;
  /** The wallet provider type currently in use */
  walletType: Signal<WalletType>;
  /** The connected r-address (empty string when disconnected) */
  address: Signal<string>;
  /** Optional display name from the wallet provider */
  displayName: Signal<string>;
}

/**
 * Single source of truth for wallet connection state.
 * Provided in `src/routes/layout.tsx`, consumed by the
 * header, dashboard, marketplace, and any component that
 * needs to know about the connected wallet.
 */
export const WalletContext =
  createContextId<WalletContextState>("app.wallet-context");

// ──────────────────────────────────────────────
// Convenience hook
// ──────────────────────────────────────────────

/**
 * Read / write access to the wallet context.
 * Call inside any `component$` that renders under the root layout.
 */
export function useWalletContext(): WalletContextState {
  return useContext(WalletContext);
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Persist wallet session to localStorage so it can be
 * restored on page reload (client-side only).
 */
export function persistWalletSession(session: WalletSession): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem("xrpl_address", session.address);
  localStorage.setItem(
    "xaman_session",
    JSON.stringify({
      account: session.address,
      type: session.type,
      name: session.name ?? "",
      signedAt: session.connectedAt,
    }),
  );
}

/**
 * Remove stored wallet session from localStorage.
 */
export function clearWalletSession(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem("xrpl_address");
  localStorage.removeItem("xaman_session");
}

/**
 * Try to restore a previously-persisted wallet session
 * from localStorage. Returns null if nothing is stored.
 */
export function restoreWalletSession(): WalletSession | null {
  if (typeof localStorage === "undefined") return null;

  const address = localStorage.getItem("xrpl_address");
  const raw = localStorage.getItem("xaman_session");

  if (!address || !raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      account?: string;
      type?: WalletType;
      name?: string;
      signedAt?: string;
    };

    return {
      address: parsed.account ?? address,
      type: parsed.type ?? "xaman",
      connectedAt: parsed.signedAt ?? new Date().toISOString(),
      name: parsed.name,
    };
  } catch {
    return null;
  }
}

/**
 * Truncate an r-address for display, e.g. "rHb9CJ...wdtyTh"
 */
export function truncateAddress(addr: string, chars = 6): string {
  if (!addr || addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

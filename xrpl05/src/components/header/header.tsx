// src/components/header/header.tsx
import { component$, useSignal, $ } from "@builder.io/qwik";
import { useLocation, useNavigate } from "@builder.io/qwik-city";
import { Link } from "@builder.io/qwik-city";
import { useNetworkContext, NETWORK_CONFIG } from "~/context/network-context";
import {
  useWalletContext,
  truncateAddress,
  clearWalletSession,
  persistWalletSession,
} from "~/context/wallet-context";

import NetworkToggle from "../ui/network-toggle";

export type NavItem = {
  id: string;
  label: string;
  href?: string;
  pages?: string[];
  min?: "mobile" | "md" | "lg";
};

export const NAV_ITEMS: NavItem[] = [
  {
    id: "home",
    label: "Explorer",
    href: "/explorer",
    pages: ["*"],
    min: "mobile",
  },
  {
    id: "market",
    label: "Marketplace",
    href: "/marketplace",
    pages: ["*", "/marketplace"],
    min: "mobile",
  },
];

const minClass = (min?: NavItem["min"]) => {
  if (min === "md") return "hidden md:flex";
  if (min === "lg") return "hidden lg:flex";
  return "flex";
};

const shouldShowNetworkToggle = (pathname: string) => {
  const allowedRoutes = ["/explorer", "/marketplace", "/dashboard"];
  return allowedRoutes.some((route) => pathname.startsWith(route));
};

export const Header = component$(() => {
  const mobileOpen = useSignal(false);
  const showWalletModal = useSignal(false);
  const walletError = useSignal("");
  const walletLoading = useSignal<string | null>(null); // which wallet is loading
  const qrImage = useSignal("");
  const showQrModal = useSignal(false);

  const location = useLocation();
  const navigate = useNavigate();
  const showNetworkToggle = shouldShowNetworkToggle(location.url.pathname);

  // Shared contexts
  const { activeNetwork } = useNetworkContext();
  const wallet = useWalletContext();

  const networkConfig = NETWORK_CONFIG[activeNetwork.value];

  // ── Xaman (server-side payload via API) ──
  const connectXaman = $(async () => {
    walletLoading.value = "xaman";
    walletError.value = "";
    qrImage.value = "";

    try {
      const res = await fetch("/api/xaman/create-payload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txjson: { TransactionType: "SignIn" } }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        throw new Error(
          (errData.error as string) || "Failed to create Xaman payload",
        );
      }

      const { uuid, refs } = (await res.json()) as {
        uuid: string;
        refs: { qr_png: string; xapp: string; websocket: string };
      };

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.href = refs.xapp || refs.websocket;
        return;
      }

      // Show QR modal for desktop
      qrImage.value = refs.qr_png;
      showQrModal.value = true;
      showWalletModal.value = false;
      walletLoading.value = null;

      // Poll for payload status
      let attempts = 0;
      const maxAttempts = 150;
      const interval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
          clearInterval(interval);
          showQrModal.value = false;
          walletError.value = "Sign-in timed out. Please try again.";
          return;
        }

        try {
          const r = await fetch(`/api/xaman/check-payload?uuid=${uuid}`);
          if (!r.ok) return;
          const d = (await r.json()) as {
            meta: {
              signed: boolean;
              expired: boolean;
              cancelled: boolean;
              rejected: boolean;
            };
            response?: { account?: string };
          };

          if (d.meta.signed && d.response?.account) {
            clearInterval(interval);
            showQrModal.value = false;

            const account = d.response.account;

            // Update wallet context
            wallet.connected.value = true;
            wallet.walletType.value = "xaman";
            wallet.address.value = account;
            wallet.displayName.value = "";

            // Persist session
            persistWalletSession({
              address: account,
              type: "xaman",
              connectedAt: new Date().toISOString(),
            });

            navigate("/dashboard");
          } else if (d.meta.expired || d.meta.cancelled || d.meta.rejected) {
            clearInterval(interval);
            showQrModal.value = false;
            walletError.value = "Sign-in was cancelled or expired.";
          }
        } catch {
          // Silently retry on network errors
        }
      }, 2000);
    } catch (e) {
      console.error("Xaman connection failed", e);
      walletError.value = e instanceof Error ? e.message : "Connection failed";
      walletLoading.value = null;
    }
  });

  // ── Crossmark (browser extension) ──
  const connectCrossmark = $(async () => {
    walletLoading.value = "crossmark";
    walletError.value = "";

    try {
      // Dynamic import to avoid SSR issues
      const { isCrossmarkInstalled, connectCrossmark: connect } = await import(
        "../wallets/crossmark"
      );

      if (!isCrossmarkInstalled()) {
        throw new Error(
          "Crossmark extension not detected. Install it from https://crossmark.io",
        );
      }

      const result = await connect();

      wallet.connected.value = true;
      wallet.walletType.value = "crossmark";
      wallet.address.value = result.address;
      wallet.displayName.value = "";

      persistWalletSession({
        address: result.address,
        type: "crossmark",
        connectedAt: new Date().toISOString(),
      });

      showWalletModal.value = false;
      walletLoading.value = null;
      navigate("/dashboard");
    } catch (e) {
      console.error("Crossmark connection failed", e);
      walletError.value = e instanceof Error ? e.message : "Connection failed";
      walletLoading.value = null;
    }
  });

  // ── GemWallet (browser extension) ──
  const connectGem = $(async () => {
    walletLoading.value = "gem";
    walletError.value = "";

    try {
      const { isGemWalletAvailable, connectGemWallet } = await import(
        "../wallets/gem"
      );

      if (!isGemWalletAvailable()) {
        throw new Error(
          "GemWallet extension not detected. Install it from https://gemwallet.app",
        );
      }

      const result = await connectGemWallet();

      wallet.connected.value = true;
      wallet.walletType.value = "gem";
      wallet.address.value = result.address;
      wallet.displayName.value = "";

      persistWalletSession({
        address: result.address,
        type: "gem",
        connectedAt: new Date().toISOString(),
      });

      showWalletModal.value = false;
      walletLoading.value = null;
      navigate("/dashboard");
    } catch (e) {
      console.error("GemWallet connection failed", e);
      walletError.value = e instanceof Error ? e.message : "Connection failed";
      walletLoading.value = null;
    }
  });

  // ── Disconnect all sessions ──
  const handleDisconnect = $(() => {
    // Clear wallet context
    wallet.connected.value = false;
    wallet.walletType.value = null;
    wallet.address.value = "";
    wallet.displayName.value = "";

    // Clear persisted session
    clearWalletSession();

    // Clear server-side cookie by calling a simple endpoint
    // (or just clear localStorage — the cookie will expire)
    if (typeof document !== "undefined") {
      document.cookie =
        "xaman_jwt=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    }

    // Navigate home
    navigate("/");
  });

  // ── Wallet button label ──
  const isConnected = wallet.connected.value;
  const walletLabel = isConnected
    ? truncateAddress(wallet.address.value, 4)
    : "Connect Wallet";

  const walletTypeBadge = wallet.walletType.value
    ? wallet.walletType.value.charAt(0).toUpperCase() +
      wallet.walletType.value.slice(1)
    : "";

  return (
    <>
      {/* ---------------- HEADER ---------------- */}
      <header class="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <div class="flex h-14 md:h-16 max-w-5xl w-full items-center justify-between rounded-full bg-white/5 dark:bg-white/5 backdrop-blur-2xl border border-white/15 shadow-2xl px-5 md:px-8 transition-all duration-500 hover:bg-white/8 hover:border-white/25 hover:shadow-3xl">
          {/* Logo */}
          <Link
            href="/"
            class="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <span class="text-lg font-semibold text-black tracking-tight">{`{XRPL}OS`}</span>
          </Link>

          {/* Desktop Nav */}
          <nav class="hidden md:flex items-center gap-2">
            {NAV_ITEMS.map((item: NavItem) =>
              item.href ? (
                <Link
                  key={item.id}
                  href={item.href}
                  class={`px-4 py-1.5 rounded-full text-sm transition-all duration-300 ${minClass(item.min)} text-black/70 hover:bg-white/10 hover:text-black/90`}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  key={item.id}
                  class={`px-4 py-1.5 text-sm text-white/40 ${minClass(item.min)}`}
                >
                  {item.label}
                </span>
              ),
            )}
          </nav>

          {/* Desktop Actions */}
          <div class="hidden md:flex items-center gap-3">
            {showNetworkToggle && <NetworkToggle />}

            {isConnected ? (
              /* ── Connected state: address pill + disconnect ── */
              <div class="flex items-center gap-2">
                {/* Dashboard link with address */}
                <Link
                  href="/dashboard"
                  class="flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5 hover:bg-white/20 transition-all duration-300"
                >
                  <div
                    class={`w-2 h-2 rounded-full ${
                      activeNetwork.value === "xahau" ? "bg-xahau" : "bg-xrpl"
                    }`}
                  />
                  <span class="text-xs font-medium text-black/80">
                    {walletTypeBadge}
                  </span>
                  <span class="text-xs font-mono text-black/60">
                    {walletLabel}
                  </span>
                </Link>

                {/* Disconnect button */}
                <button
                  onClick$={handleDisconnect}
                  class="rounded-full bg-red-500/80 hover:bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-all duration-300 shadow-sm hover:shadow-md"
                  title="Disconnect wallet and end session"
                >
                  ✕
                </button>
              </div>
            ) : (
              /* ── Disconnected state: connect button ── */
              <button
                onClick$={() => {
                  walletError.value = "";
                  showWalletModal.value = true;
                }}
                class="rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-black hover:bg-amber-400 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                Connect Wallet
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            class="md:hidden flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all duration-300"
            onClick$={() => (mobileOpen.value = !mobileOpen.value)}
          >
            {mobileOpen.value ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {/* ---------------- MOBILE NAV ---------------- */}
      {mobileOpen.value && (
        <div class="fixed inset-x-4 top-20 z-40 rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/15 shadow-2xl p-4 md:hidden animate-slide-down">
          <div class="flex flex-col gap-2">
            {NAV_ITEMS.map((item: NavItem) =>
              item.href ? (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick$={() => (mobileOpen.value = false)}
                  class="rounded-xl px-4 py-3 text-black/80 hover:bg-white/20 transition-all duration-300"
                >
                  {item.label}
                </Link>
              ) : null,
            )}

            {showNetworkToggle && (
              <div class="pt-3 border-t border-white/10">
                <NetworkToggle />
              </div>
            )}

            <div class="pt-3 border-t border-white/10">
              {isConnected ? (
                <div class="flex flex-col gap-2">
                  {/* Connected info */}
                  <Link
                    href="/dashboard"
                    onClick$={() => (mobileOpen.value = false)}
                    class="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 transition-all"
                  >
                    <div
                      class={`w-2 h-2 rounded-full ${
                        activeNetwork.value === "xahau" ? "bg-xahau" : "bg-xrpl"
                      }`}
                    />
                    <span class="text-sm text-black/80">
                      {walletTypeBadge} · {walletLabel}
                    </span>
                    <span class="ml-auto text-xs text-black/50">
                      Dashboard →
                    </span>
                  </Link>

                  {/* Disconnect */}
                  <button
                    onClick$={() => {
                      mobileOpen.value = false;
                      handleDisconnect();
                    }}
                    class="w-full rounded-xl bg-red-500/80 hover:bg-red-500 px-4 py-3 text-white transition-all duration-300 font-medium text-sm"
                  >
                    Disconnect Wallet
                  </button>
                </div>
              ) : (
                <button
                  onClick$={() => {
                    walletError.value = "";
                    showWalletModal.value = true;
                    mobileOpen.value = false;
                  }}
                  class="w-full rounded-xl bg-amber-500 px-4 py-3 text-black hover:bg-amber-400 transition-all duration-300 shadow-lg font-medium"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- WALLET CONNECT MODAL ---------------- */}
      {showWalletModal.value && (
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick$={() => {
            showWalletModal.value = false;
            walletLoading.value = null;
          }}
        >
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            class="relative rounded-2xl bg-white border border-gray-200 shadow-2xl p-6 max-w-md w-full animate-scale-in"
            onClick$={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div class="flex items-center justify-between mb-6">
              <div>
                <h2 class="text-xl font-bold text-gray-900">Connect Wallet</h2>
                <p class="text-sm text-gray-500 mt-1">
                  Connect to {networkConfig.label}
                </p>
              </div>
              <button
                onClick$={() => {
                  showWalletModal.value = false;
                  walletLoading.value = null;
                }}
                class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-500 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Network badge */}
            <div class="mb-5 flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
              <div
                class={`w-3 h-3 rounded-full ${
                  activeNetwork.value === "xahau" ? "bg-xahau" : "bg-xrpl"
                }`}
              />
              <span class="text-sm font-medium text-gray-700">
                {networkConfig.label}
              </span>
              <span class="text-xs text-gray-400 ml-auto font-mono">
                {networkConfig.nativeCurrency}
              </span>
            </div>

            {/* Wallet Options */}
            <div class="flex flex-col gap-3 mb-5">
              {/* Xaman */}
              <button
                onClick$={connectXaman}
                disabled={walletLoading.value !== null}
                class="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div class="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  X
                </div>
                <div class="flex-1 text-left">
                  <div class="font-semibold text-gray-900 text-sm group-hover:text-blue-700 transition-colors">
                    Xaman (Xumm)
                  </div>
                  <div class="text-xs text-gray-500">
                    Mobile wallet · QR scan
                  </div>
                </div>
                {walletLoading.value === "xaman" ? (
                  <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg
                    class="w-5 h-5 text-gray-300 group-hover:text-blue-400 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </button>

              {/* Crossmark */}
              <button
                onClick$={connectCrossmark}
                disabled={walletLoading.value !== null}
                class="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white hover:bg-purple-50 hover:border-purple-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div class="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  C
                </div>
                <div class="flex-1 text-left">
                  <div class="font-semibold text-gray-900 text-sm group-hover:text-purple-700 transition-colors">
                    Crossmark
                  </div>
                  <div class="text-xs text-gray-500">Browser extension</div>
                </div>
                {walletLoading.value === "crossmark" ? (
                  <div class="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg
                    class="w-5 h-5 text-gray-300 group-hover:text-purple-400 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </button>

              {/* GemWallet */}
              <button
                onClick$={connectGem}
                disabled={walletLoading.value !== null}
                class="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white hover:bg-emerald-50 hover:border-emerald-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div class="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  G
                </div>
                <div class="flex-1 text-left">
                  <div class="font-semibold text-gray-900 text-sm group-hover:text-emerald-700 transition-colors">
                    GemWallet
                  </div>
                  <div class="text-xs text-gray-500">Browser extension</div>
                </div>
                {walletLoading.value === "gem" ? (
                  <div class="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg
                    class="w-5 h-5 text-gray-300 group-hover:text-emerald-400 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </button>
            </div>

            {/* Error message */}
            {walletError.value && (
              <div class="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200">
                <p class="text-sm text-red-700">{walletError.value}</p>
              </div>
            )}

            {/* Footer info */}
            <div class="text-center">
              <p class="text-xs text-gray-400">
                By connecting, you agree to the Terms of Service
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- XAMAN QR MODAL ---------------- */}
      {showQrModal.value && (
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick$={() => (showQrModal.value = false)}
        >
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            class="relative bg-white rounded-3xl p-10 max-w-md w-full text-center shadow-2xl animate-scale-in"
            onClick$={(e) => e.stopPropagation()}
          >
            <h2 class="text-2xl font-bold mb-2 text-gray-900">
              Scan with Xaman
            </h2>
            <p class="text-gray-500 text-sm mb-6">
              Open the Xaman app on your phone and scan this QR code to sign in
              to {networkConfig.label}.
            </p>

            <div class="bg-gray-50 rounded-2xl p-6 mb-6 inline-block">
              {qrImage.value && (
                <img
                  src={qrImage.value}
                  alt="Xaman QR Code"
                  class="w-56 h-56 mx-auto"
                  width={224}
                  height={224}
                />
              )}
            </div>

            <div class="flex items-center justify-center gap-3 text-gray-500 mb-6">
              <div class="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
              <span class="text-sm">Waiting for confirmation...</span>
            </div>

            <button
              onClick$={() => {
                showQrModal.value = false;
                walletError.value = "";
              }}
              class="text-gray-500 hover:text-gray-900 transition-colors font-medium text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
});

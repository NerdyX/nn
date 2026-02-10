import { component$, useSignal, $ } from "@builder.io/qwik";
import { useLocation, useNavigate } from "@builder.io/qwik-city";
import {
  WalletContext,
  truncateAddress,
  clearWalletSession,
  persistWalletSession,
} from "~/context/wallet-context";
import { useContext } from "@builder.io/qwik";

interface HeaderProps {
  transparent?: boolean;
}

export const HeaderModern = component$<HeaderProps>(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const mobileMenuOpen = useSignal(false);
  const showWalletModal = useSignal(false);
  const walletError = useSignal("");
  const walletLoading = useSignal<string | null>(null);
  const qrImage = useSignal("");
  const showQrModal = useSignal(false);

  const walletCtx = useContext(WalletContext);

  const isConnected = walletCtx.connected.value;

  const navItems = [
    { label: "Explorer", href: "/explorer" },
    { label: "Marketplace", href: "/marketplace" },
  ];

  // ── Xaman Connection ──
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
        let errData: Record<string, unknown> = {};
        try {
          errData = await res.json();
        } catch {
          errData = {};
        }
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

      qrImage.value = refs.qr_png;
      showQrModal.value = true;

      // Poll for signature
      const pollInterval = setInterval(async () => {
        try {
          const checkRes = await fetch(`/api/xaman/check-payload?uuid=${uuid}`);
          if (!checkRes.ok) return;

          const result = (await checkRes.json()) as {
            meta: {
              signed: boolean;
              expired: boolean;
              cancelled: boolean;
              rejected: boolean;
            };
            response?: { account?: string };
          };

          if (result.meta.signed && result.response?.account) {
            clearInterval(pollInterval);
            showQrModal.value = false;

            const account = result.response.account;
            walletCtx.connected.value = true;
            walletCtx.walletType.value = "xaman";
            walletCtx.address.value = account;
            walletCtx.displayName.value = "";

            persistWalletSession({
              address: account,
              type: "xaman",
              connectedAt: new Date().toISOString(),
            });

            showWalletModal.value = false;
            walletLoading.value = null;
          } else if (
            result.meta.expired ||
            result.meta.cancelled ||
            result.meta.rejected
          ) {
            clearInterval(pollInterval);
            walletError.value = "QR code expired or cancelled";
            walletLoading.value = null;
            showQrModal.value = false;
          }
        } catch {
          // Continue polling
        }
      }, 2000);

      setTimeout(() => {
        if (walletLoading.value === "xaman") {
          clearInterval(pollInterval);
          walletError.value = "Request timeout";
          walletLoading.value = null;
          showQrModal.value = false;
        }
      }, 60000);
    } catch (e) {
      console.error("Xaman connection failed", e);
      walletError.value = e instanceof Error ? e.message : "Connection failed";
      walletLoading.value = null;
    }
  });

  // ── Crossmark Connection ──
  const connectCrossmark = $(async () => {
    walletLoading.value = "crossmark";
    walletError.value = "";

    try {
      const { connectCrossmark } = await import("../wallets/crossmark");
      const result = await connectCrossmark();

      walletCtx.connected.value = true;
      walletCtx.walletType.value = "crossmark";
      walletCtx.address.value = result.address;
      walletCtx.displayName.value = "";

      persistWalletSession({
        address: result.address,
        type: "crossmark",
        connectedAt: new Date().toISOString(),
      });

      showWalletModal.value = false;
      walletLoading.value = null;
    } catch (e) {
      console.error("Crossmark connection failed", e);
      walletError.value = e instanceof Error ? e.message : "Connection failed";
      walletLoading.value = null;
    }
  });

  // ── GemWallet Connection ──
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

      walletCtx.connected.value = true;
      walletCtx.walletType.value = "gem";
      walletCtx.address.value = result.address;
      walletCtx.displayName.value = "";

      persistWalletSession({
        address: result.address,
        type: "gem",
        connectedAt: new Date().toISOString(),
      });

      showWalletModal.value = false;
      walletLoading.value = null;
    } catch (e) {
      console.error("GemWallet connection failed", e);
      walletError.value = e instanceof Error ? e.message : "Connection failed";
      walletLoading.value = null;
    }
  });

  // ── Disconnect ──
  const handleDisconnect = $(() => {
    walletCtx.connected.value = false;
    walletCtx.walletType.value = null;
    walletCtx.address.value = "";
    walletCtx.displayName.value = "";

    clearWalletSession();

    document.cookie =
      "xaman_jwt=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  });

  return (
    <>
      {/* Glassmorphic Pill Header */}
      <header class="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <div class="flex h-14 sm:h-16 max-w-6xl w-full items-center justify-between rounded-full bg-white/70 dark:bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg px-4 sm:px-6 md:px-8 transition-all duration-300 hover:bg-white/80 hover:shadow-xl">
          {/* Logo */}
          <div class="shrink-0">
            <button
              class="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-amber-500 bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition"
              onClick$={() => navigate("/")}
            >
              {"{XRPL}"}OS
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav class="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <button
                key={item.href}
                class={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  location.url.pathname.startsWith(item.href)
                    ? "bg-blue-500/10 text-blue-600"
                    : "text-gray-700 hover:bg-gray-100/50"
                }`}
                onClick$={() => navigate(item.href)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right Side Actions */}
          <div class="flex items-center gap-2 sm:gap-3">
            <div class="hidden sm:flex items-center gap-2">
              {isConnected ? (
                <div class="flex items-center gap-2">
                  <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 backdrop-blur-sm">
                    <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span class="text-xs font-medium text-green-700">
                      {truncateAddress(walletCtx.address.value, 4)}
                    </span>
                  </div>
                  <button
                    class="text-xs font-medium px-3 py-1.5 rounded-full text-red-600 hover:bg-red-50 transition"
                    onClick$={handleDisconnect}
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  class="px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-medium hover:shadow-lg transition-all duration-300"
                  onClick$={() => (showWalletModal.value = true)}
                >
                  Connect Wallet
                </button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              class="md:hidden p-2 rounded-full hover:bg-gray-100/50 transition"
              onClick$={() => (mobileMenuOpen.value = !mobileMenuOpen.value)}
              aria-label="Toggle menu"
            >
              <svg
                class="w-5 h-5 sm:w-6 sm:h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {mobileMenuOpen.value ? (
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen.value && (
        <div class="fixed inset-x-4 top-20 z-40 rounded-2xl bg-white/90 backdrop-blur-xl border border-white/20 shadow-xl p-4 md:hidden animate-slide-down">
          <nav class="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.href}
                class="block w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100/70 rounded-xl transition"
                onClick$={() => {
                  navigate(item.href);
                  mobileMenuOpen.value = false;
                }}
              >
                {item.label}
              </button>
            ))}
            {!isConnected && (
              <button
                class="w-full mt-4 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium"
                onClick$={() => {
                  showWalletModal.value = true;
                  mobileMenuOpen.value = false;
                }}
              >
                Connect Wallet
              </button>
            )}
            {isConnected && (
              <div class="space-y-2 pt-2 border-t border-gray-200">
                <div class="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50">
                  <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span class="text-xs font-medium text-green-700">
                    {truncateAddress(walletCtx.address.value, 4)}
                  </span>
                </div>
                <button
                  class="w-full px-4 py-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition font-medium"
                  onClick$={() => {
                    handleDisconnect();
                    mobileMenuOpen.value = false;
                  }}
                >
                  Disconnect
                </button>
              </div>
            )}
          </nav>
        </div>
      )}

      {/* Wallet Modal */}
      {showWalletModal.value && (
        <>
          <div
            class="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
            onClick$={() => (showWalletModal.value = false)}
          ></div>
          <div class="fixed inset-0 z-[201] flex items-center justify-center p-4 overflow-y-auto pointer-events-none">
            <div
              class="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full m-auto pointer-events-auto"
              onClick$={(e) => e.stopPropagation()}
            >
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-bold text-gray-900">Connect Wallet</h2>
                <button
                  class="text-gray-400 hover:text-gray-600 transition"
                  onClick$={() => (showWalletModal.value = false)}
                >
                  ✕
                </button>
              </div>

              {walletError.value && (
                <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {walletError.value}
                </div>
              )}

              <div class="space-y-3">
                {/* Xaman */}
                <button
                  onClick$={connectXaman}
                  disabled={walletLoading.value !== null}
                  class="w-full flex items-center gap-4 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-lg group-hover:bg-blue-200 transition">
                    🔐
                  </div>
                  <div class="text-left flex-1">
                    <div class="font-semibold text-gray-900 text-sm group-hover:text-blue-700 transition">
                      Xaman (Xumm)
                    </div>
                    <div class="text-xs text-gray-500">QR code signing</div>
                  </div>
                  {walletLoading.value === "xaman" && (
                    <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  )}
                </button>

                {/* Crossmark */}
                <button
                  onClick$={connectCrossmark}
                  disabled={walletLoading.value !== null}
                  class="w-full flex items-center gap-4 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-lg group-hover:bg-purple-200 transition">
                    ✓
                  </div>
                  <div class="text-left flex-1">
                    <div class="font-semibold text-gray-900 text-sm group-hover:text-blue-700 transition">
                      Crossmark
                    </div>
                    <div class="text-xs text-gray-500">Browser extension</div>
                  </div>
                  {walletLoading.value === "crossmark" && (
                    <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  )}
                </button>

                {/* GemWallet */}
                <button
                  onClick$={connectGem}
                  disabled={walletLoading.value !== null}
                  class="w-full flex items-center gap-4 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div class="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-lg group-hover:bg-amber-200 transition">
                    💎
                  </div>
                  <div class="text-left flex-1">
                    <div class="font-semibold text-gray-900 text-sm group-hover:text-blue-700 transition">
                      GemWallet
                    </div>
                    <div class="text-xs text-gray-500">Browser extension</div>
                  </div>
                  {walletLoading.value === "gem" && (
                    <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  )}
                </button>
              </div>

              <p class="text-xs text-gray-500 text-center mt-6">
                Your private keys are never shared. All transactions are signed
                on your device.
              </p>
            </div>
          </div>
        </>
      )}

      {/* QR Modal */}
      {showQrModal.value && qrImage.value && (
        <>
          <div
            class="fixed inset-0 z-[210] bg-black/50 backdrop-blur-sm"
            onClick$={() => (showQrModal.value = false)}
          ></div>
          <div class="fixed inset-0 z-[211] flex items-center justify-center p-4 overflow-y-auto pointer-events-none">
            <div
              class="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center m-auto pointer-events-auto"
              onClick$={(e) => e.stopPropagation()}
            >
              <h3 class="text-lg font-bold text-gray-900 mb-4">
                Scan with Xaman
              </h3>
              <div class="bg-white rounded-xl p-4 border border-gray-200 mb-4 inline-block">
                <img
                  src={qrImage.value}
                  alt="Xaman QR Code"
                  width={256}
                  height={256}
                  class="w-64 h-64"
                />
              </div>
              <p class="text-sm text-gray-600 mb-4">
                Open Xaman and scan this QR code to sign in
              </p>
              <button
                class="w-full px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition"
                onClick$={() => (showQrModal.value = false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
});

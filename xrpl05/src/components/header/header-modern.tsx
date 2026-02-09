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

export const HeaderModern = component$<HeaderProps>(({ transparent }) => {
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
    <header
      class={`sticky top-0 z-50 transition-all ${
        transparent
          ? "bg-transparent"
          : "bg-white/80 backdrop-blur-md border-b border-gray-200/50"
      }`}
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          {/* Logo */}
          <div class="flex-shrink-0">
            <button
              class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-amber-500 bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition"
              onClick$={() => navigate("/")}
            >
              {"{XRPL}"}OS
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav class="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <button
                key={item.href}
                class={`text-sm font-medium transition-colors ${
                  location.url.pathname.startsWith(item.href)
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                onClick$={() => navigate(item.href)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right Side Actions */}
          <div class="flex items-center gap-3">
            <div class="hidden sm:flex items-center gap-2">
              {isConnected ? (
                <div class="flex items-center gap-3">
                  <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 backdrop-blur-sm">
                    <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span class="text-xs font-medium text-green-700">
                      {truncateAddress(walletCtx.address.value, 4)}
                    </span>
                  </div>
                  <button
                    class="text-xs font-medium px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition"
                    onClick$={handleDisconnect}
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  class="btn btn-primary btn-sm"
                  onClick$={() => (showWalletModal.value = true)}
                >
                  Connect Wallet
                </button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              class="md:hidden p-2 rounded-lg hover:bg-gray-100 transition"
              onClick$={() => (mobileMenuOpen.value = !mobileMenuOpen.value)}
              aria-label="Toggle menu"
            >
              <svg
                class="w-6 h-6"
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

        {/* Mobile Menu */}
        {mobileMenuOpen.value && (
          <nav class="md:hidden pb-4 border-t border-gray-200 pt-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.href}
                class="block w-full text-left px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
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
                class="w-full mt-4 btn btn-primary"
                onClick$={() => {
                  showWalletModal.value = true;
                  mobileMenuOpen.value = false;
                }}
              >
                Connect Wallet
              </button>
            )}
            {isConnected && (
              <button
                class="w-full mt-4 btn btn-secondary"
                onClick$={() => {
                  handleDisconnect();
                  mobileMenuOpen.value = false;
                }}
              >
                Disconnect
              </button>
            )}
          </nav>
        )}
      </div>

      {/* Wallet Modal */}
      {showWalletModal.value && (
        <>
          <div
            class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick$={() => (showWalletModal.value = false)}
          ></div>
          <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 max-w-md w-full mx-4">
            <div class="bg-white rounded-2xl shadow-2xl p-6 backdrop-blur-xl">
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
            class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick$={() => (showQrModal.value = false)}
          ></div>
          <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 max-w-sm w-full mx-4">
            <div class="bg-white rounded-2xl shadow-2xl p-6 backdrop-blur-xl text-center">
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
                class="w-full btn btn-secondary"
                onClick$={() => (showQrModal.value = false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  );
});

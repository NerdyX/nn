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
    { label: "Explorer", href: "/search" },
    { label: "Marketplace", href: "/shop" },
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

  const isDashboard = location.url.pathname.startsWith("/dashboard");

  return (
    <>
      {/* ─── Glassmorphic Pill Header ─── */}
      <header
        class="fixed inset-x-0 top-0 z-50 flex justify-center px-3 sm:px-4 pt-3"
        style={{ pointerEvents: "none" }}
      >
        <div
          class="flex h-12 sm:h-14 max-w-5xl w-full items-center justify-between px-4 sm:px-6 transition-all duration-300"
          style={{
            pointerEvents: "auto",
            borderRadius: "9999px",
            background: "rgba(255,255,255,0.65)",
            backdropFilter: "blur(24px) saturate(1.4)",
            WebkitBackdropFilter: "blur(24px) saturate(1.4)",
            border: "1px solid rgba(255,255,255,0.35)",
            boxShadow:
              "0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6)",
          }}
        >
          {/* ── Logo ── */}
          <button
            class="shrink-0 text-lg sm:text-xl font-bold cursor-pointer hover:opacity-80 transition-opacity"
            style={{
              background: "linear-gradient(135deg, #2563eb, #f59e0b)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
            onClick$={() => navigate("/")}
          >
            {"{XRPL}"}OS
          </button>

          {/* ── Desktop Nav ── */}
          <nav class="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.url.pathname.startsWith(item.href);
              return (
                <button
                  key={item.href}
                  class="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer"
                  style={{
                    background: isActive
                      ? "rgba(37,99,235,0.1)"
                      : "transparent",
                    color: isActive ? "#2563eb" : "#374151",
                  }}
                  onClick$={() => navigate(item.href)}
                >
                  {item.label}
                </button>
              );
            })}
            {isConnected && (
              <button
                class="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{
                  background: isDashboard
                    ? "rgba(37,99,235,0.1)"
                    : "transparent",
                  color: isDashboard ? "#2563eb" : "#374151",
                }}
                onClick$={() => navigate("/dashboard")}
              >
                Dashboard
              </button>
            )}
          </nav>

          {/* ── Right Actions ── */}
          <div class="flex items-center gap-2">
            {/* Desktop wallet */}
            <div class="hidden sm:flex items-center gap-2">
              {isConnected ? (
                <div class="flex items-center gap-2">
                  {/* Connected badge */}
                  <div
                    class="flex items-center gap-2 px-3 py-1 rounded-full"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.08))",
                      border: "1px solid rgba(16,185,129,0.2)",
                    }}
                  >
                    <div
                      class="w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ background: "#10b981" }}
                    />
                    <span
                      class="text-xs font-medium"
                      style={{ color: "#059669" }}
                    >
                      {truncateAddress(walletCtx.address.value, 4)}
                    </span>
                  </div>
                  <button
                    class="text-xs font-medium px-3 py-1 rounded-full transition-colors cursor-pointer"
                    style={{ color: "#dc2626" }}
                    onClick$={handleDisconnect}
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  class="px-4 py-1.5 rounded-full text-white text-sm font-medium transition-all duration-300 cursor-pointer"
                  style={{
                    background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                    boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
                  }}
                  onClick$={() => (showWalletModal.value = true)}
                >
                  Connect Wallet
                </button>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              class="md:hidden p-2 rounded-full transition cursor-pointer"
              style={{ background: "rgba(0,0,0,0.04)" }}
              onClick$={() => (mobileMenuOpen.value = !mobileMenuOpen.value)}
              aria-label="Toggle menu"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: "#374151" }}
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

      {/* ─── Mobile Menu ─── */}
      {mobileMenuOpen.value && (
        <div
          class="fixed inset-x-3 z-40 md:hidden"
          style={{
            top: "64px",
            borderRadius: "20px",
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(24px) saturate(1.4)",
            WebkitBackdropFilter: "blur(24px) saturate(1.4)",
            border: "1px solid rgba(255,255,255,0.35)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
            animation: "slideDown 0.25s ease-out",
          }}
        >
          <style
            dangerouslySetInnerHTML={`
            @keyframes slideDown {
              from { opacity: 0; transform: translateY(-8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}
          />
          <nav class="p-3 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.href}
                class="block w-full text-left px-4 py-3 text-sm font-medium rounded-xl transition cursor-pointer"
                style={{
                  color: "#374151",
                  background: location.url.pathname.startsWith(item.href)
                    ? "rgba(37,99,235,0.08)"
                    : "transparent",
                }}
                onClick$={() => {
                  navigate(item.href);
                  mobileMenuOpen.value = false;
                }}
              >
                {item.label}
              </button>
            ))}
            {isConnected && (
              <button
                class="block w-full text-left px-4 py-3 text-sm font-medium rounded-xl transition cursor-pointer"
                style={{
                  color: "#374151",
                  background: isDashboard
                    ? "rgba(37,99,235,0.08)"
                    : "transparent",
                }}
                onClick$={() => {
                  navigate("/dashboard");
                  mobileMenuOpen.value = false;
                }}
              >
                Dashboard
              </button>
            )}
            <div
              class="mx-3 my-2"
              style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
            />
            {!isConnected ? (
              <button
                class="w-full px-4 py-3 rounded-xl text-white font-medium text-sm cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                }}
                onClick$={() => {
                  showWalletModal.value = true;
                  mobileMenuOpen.value = false;
                }}
              >
                Connect Wallet
              </button>
            ) : (
              <>
                <div
                  class="flex items-center gap-2 px-4 py-2 rounded-xl"
                  style={{
                    background: "rgba(16,185,129,0.06)",
                    border: "1px solid rgba(16,185,129,0.15)",
                  }}
                >
                  <div
                    class="w-2 h-2 rounded-full animate-pulse"
                    style={{ background: "#10b981" }}
                  />
                  <span
                    class="text-xs font-medium"
                    style={{ color: "#059669" }}
                  >
                    {truncateAddress(walletCtx.address.value, 6)}
                  </span>
                </div>
                <button
                  class="w-full px-4 py-3 rounded-xl font-medium text-sm transition cursor-pointer"
                  style={{
                    background: "rgba(239,68,68,0.06)",
                    color: "#dc2626",
                  }}
                  onClick$={() => {
                    handleDisconnect();
                    mobileMenuOpen.value = false;
                  }}
                >
                  Disconnect
                </button>
              </>
            )}
          </nav>
        </div>
      )}

      {/* ─── Wallet Connect Modal ─── */}
      {showWalletModal.value && (
        <>
          {/* Backdrop */}
          <div
            class="fixed inset-0 z-[9998]"
            style={{
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
            onClick$={() => {
              showWalletModal.value = false;
              walletError.value = "";
              walletLoading.value = null;
            }}
          />
          {/* Modal — centered with max-height constraint */}
          <div
            class="fixed z-[9999] overflow-y-auto"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(420px, calc(100vw - 32px))",
              maxHeight: "min(85vh, 560px)",
              background: "rgba(255,255,255,0.97)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: "24px",
              border: "1px solid rgba(255,255,255,0.4)",
              boxShadow:
                "0 25px 60px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08)",
              padding: "28px",
              animation: "modalIn 0.25s ease-out",
            }}
            onClick$={(e) => e.stopPropagation()}
          >
            <style
              dangerouslySetInnerHTML={`
              @keyframes modalIn {
                from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
                to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
              }
            `}
            />

            {/* Header */}
            <div
              class="flex items-center justify-between"
              style={{ marginBottom: "20px" }}
            >
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: "700",
                  color: "#111827",
                  margin: "0",
                }}
              >
                Connect Wallet
              </h2>
              <button
                class="cursor-pointer transition-colors"
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  border: "none",
                  background: "rgba(0,0,0,0.05)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#6b7280",
                  fontSize: "16px",
                }}
                onClick$={() => {
                  showWalletModal.value = false;
                  walletError.value = "";
                  walletLoading.value = null;
                }}
              >
                ✕
              </button>
            </div>

            {/* Error */}
            {walletError.value && (
              <div
                style={{
                  marginBottom: "16px",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.15)",
                  fontSize: "13px",
                  color: "#dc2626",
                  lineHeight: "1.5",
                }}
              >
                {walletError.value}
              </div>
            )}

            {/* Wallet Options */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {/* Xaman */}
              <button
                onClick$={connectXaman}
                disabled={walletLoading.value !== null}
                class="cursor-pointer"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "14px 16px",
                  borderRadius: "16px",
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "rgba(255,255,255,0.8)",
                  transition: "all 0.2s",
                  opacity:
                    walletLoading.value !== null &&
                    walletLoading.value !== "xaman"
                      ? "0.5"
                      : "1",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    flexShrink: "0",
                  }}
                >
                  🔐
                </div>
                <div style={{ textAlign: "left", flex: "1" }}>
                  <div
                    style={{
                      fontWeight: "600",
                      fontSize: "14px",
                      color: "#111827",
                      marginBottom: "2px",
                    }}
                  >
                    Xaman (Xumm)
                  </div>
                  <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                    QR code signing
                  </div>
                </div>
                {walletLoading.value === "xaman" && (
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      border: "2px solid #3b82f6",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                )}
              </button>

              {/* Crossmark */}
              <button
                onClick$={connectCrossmark}
                disabled={walletLoading.value !== null}
                class="cursor-pointer"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "14px 16px",
                  borderRadius: "16px",
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "rgba(255,255,255,0.8)",
                  transition: "all 0.2s",
                  opacity:
                    walletLoading.value !== null &&
                    walletLoading.value !== "crossmark"
                      ? "0.5"
                      : "1",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #ede9fe, #ddd6fe)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    flexShrink: "0",
                  }}
                >
                  ✓
                </div>
                <div style={{ textAlign: "left", flex: "1" }}>
                  <div
                    style={{
                      fontWeight: "600",
                      fontSize: "14px",
                      color: "#111827",
                      marginBottom: "2px",
                    }}
                  >
                    Crossmark
                  </div>
                  <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                    Browser extension
                  </div>
                </div>
                {walletLoading.value === "crossmark" && (
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      border: "2px solid #7c3aed",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                )}
              </button>

              {/* GemWallet */}
              <button
                onClick$={connectGem}
                disabled={walletLoading.value !== null}
                class="cursor-pointer"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "14px 16px",
                  borderRadius: "16px",
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "rgba(255,255,255,0.8)",
                  transition: "all 0.2s",
                  opacity:
                    walletLoading.value !== null &&
                    walletLoading.value !== "gem"
                      ? "0.5"
                      : "1",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #fef3c7, #fde68a)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    flexShrink: "0",
                  }}
                >
                  💎
                </div>
                <div style={{ textAlign: "left", flex: "1" }}>
                  <div
                    style={{
                      fontWeight: "600",
                      fontSize: "14px",
                      color: "#111827",
                      marginBottom: "2px",
                    }}
                  >
                    GemWallet
                  </div>
                  <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                    Browser extension
                  </div>
                </div>
                {walletLoading.value === "gem" && (
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      border: "2px solid #f59e0b",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                )}
              </button>
            </div>

            <style
              dangerouslySetInnerHTML={`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}
            />

            {/* Footer */}
            <p
              style={{
                textAlign: "center",
                marginTop: "20px",
                fontSize: "12px",
                color: "#9ca3af",
                lineHeight: "1.5",
              }}
            >
              Your private keys are never shared.
              <br />
              All transactions are signed on your device.
            </p>
          </div>
        </>
      )}

      {/* ─── QR Modal ─── */}
      {showQrModal.value && qrImage.value && (
        <>
          <div
            class="fixed inset-0 z-[10000]"
            style={{
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
            onClick$={() => (showQrModal.value = false)}
          />
          <div
            class="fixed z-[10001]"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(380px, calc(100vw - 32px))",
              maxHeight: "85vh",
              background: "rgba(255,255,255,0.97)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: "24px",
              border: "1px solid rgba(255,255,255,0.4)",
              boxShadow: "0 25px 60px rgba(0,0,0,0.15)",
              padding: "28px",
              textAlign: "center",
              animation: "modalIn 0.25s ease-out",
            }}
            onClick$={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: "18px",
                fontWeight: "700",
                color: "#111827",
                marginBottom: "16px",
              }}
            >
              Scan with Xaman
            </h3>
            <div
              style={{
                background: "#fff",
                borderRadius: "16px",
                padding: "16px",
                border: "1px solid #e5e7eb",
                display: "inline-block",
                marginBottom: "16px",
              }}
            >
              <img
                src={qrImage.value}
                alt="Xaman QR Code"
                width={220}
                height={220}
                style={{ width: "220px", height: "220px", display: "block" }}
              />
            </div>
            <p
              style={{
                fontSize: "14px",
                color: "#6b7280",
                marginBottom: "16px",
                lineHeight: "1.5",
              }}
            >
              Open Xaman and scan this QR code to sign in
            </p>
            <button
              class="cursor-pointer"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "14px",
                border: "none",
                background: "rgba(0,0,0,0.05)",
                color: "#374151",
                fontWeight: "500",
                fontSize: "14px",
                transition: "background 0.2s",
              }}
              onClick$={() => (showQrModal.value = false)}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </>
  );
});

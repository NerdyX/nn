import { component$, useSignal, $ } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import {
  useNetworkContext,
  NETWORK_CONFIG,
  getTxTypesForNetwork,
  getSidebarNavItems,
  getTxCategoriesForNetwork,
  canSignTransaction,
} from "~/context/network-context";
import {
  useWalletContext,
  truncateAddress,
  clearWalletSession,
} from "~/context/wallet-context";
import { signTransaction, waitForSignature } from "~/lib/xaman-auth";

import "./dashboard.css";

export default component$(() => {
  const activePage = useSignal<string>("accounts");

  // ── Consume shared contexts ──
  const { activeNetwork, wsUrl } = useNetworkContext();
  const wallet = useWalletContext();

  // These are reactive — they recompute when activeNetwork changes
  const networkConfig = NETWORK_CONFIG[activeNetwork.value];
  const txTypes = getTxTypesForNetwork(activeNetwork.value);
  const txCategories = getTxCategoriesForNetwork(activeNetwork.value);

  // ── Network-aware sidebar nav items ──
  // Automatically filters: Rewards only on Xahau, AMM/Oracles/DID/XChain only on XRPL, etc.
  const navItems = getSidebarNavItems(activeNetwork.value);

  // ── Transaction signing state ──
  const signingStatus = useSignal<"idle" | "signing" | "success" | "error">(
    "idle",
  );
  const signingMessage = useSignal("");
  const signingQr = useSignal("");
  const selectedTxType = useSignal("Payment");
  const selectedCategory = useSignal("payment");

  // ── Quick-send form state ──
  const sendDestination = useSignal("");
  const sendAmount = useSignal("");

  // ── Disconnect handler ──
  const handleDisconnect = $(() => {
    clearWalletSession();
    wallet.connected.value = false;
    wallet.address.value = "";
    wallet.walletType.value = null;
    wallet.displayName.value = "";

    // Clear server-side cookie
    if (typeof document !== "undefined") {
      document.cookie =
        "xaman_jwt=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    }

    // Navigate to home
    window.location.href = "/";
  });

  // ── Sign & submit a transaction via Xaman ──
  const handleSignTransaction = $(async (txjson: Record<string, unknown>) => {
    // Validate against network + wallet state
    const check = canSignTransaction(
      String(txjson.TransactionType ?? ""),
      activeNetwork.value,
      wallet.connected.value,
    );
    if (!check.allowed) {
      signingStatus.value = "error";
      signingMessage.value = check.reason ?? "Cannot sign transaction";
      return;
    }

    signingStatus.value = "signing";
    signingMessage.value = `Creating ${String(txjson.TransactionType)} payload on ${networkConfig.label}...`;
    signingQr.value = "";

    try {
      const payload = await signTransaction(
        txjson,
        activeNetwork.value,
        wallet.address.value,
      );

      signingQr.value = payload.refs.qr_png;
      signingMessage.value = "Scan the QR code with Xaman to sign...";

      const result = await waitForSignature(payload.uuid);

      if (result.meta.signed) {
        signingStatus.value = "success";
        signingMessage.value = `✅ Transaction signed on ${networkConfig.label}! TXID: ${result.response?.txid ?? "N/A"}`;
        signingQr.value = "";
      }
    } catch (err) {
      signingStatus.value = "error";
      signingMessage.value =
        err instanceof Error ? err.message : "Signing failed";
      signingQr.value = "";
    }
  });

  // ── Quick Send handler ──
  const handleQuickSend = $(() => {
    if (!sendDestination.value || !sendAmount.value) return;

    const amountDrops = String(
      Math.floor(parseFloat(sendAmount.value) * 1_000_000),
    );

    handleSignTransaction({
      TransactionType: "Payment",
      Destination: sendDestination.value,
      Amount: amountDrops,
    });
  });

  // ── Claim Reward handler (Xahau only) ──
  const handleClaimReward = $(() => {
    handleSignTransaction({
      TransactionType: "ClaimReward",
      Issuer: wallet.address.value,
    });
  });

  return (
    <div class="mt-14 app-layout">
      {/* Sidebar */}
      <aside class="sidebar">
        {/* Wallet info from shared WalletContext */}
        <section class="sidebar-section">
          <div class="mb-1 text-lg font-semibold text-gray-900">
            {wallet.displayName.value
              ? `Welcome, ${wallet.displayName.value}!`
              : "Dashboard"}
          </div>
          {/* Network indicator */}
          <div class="flex items-center gap-2 mb-3">
            <div
              class={`w-2.5 h-2.5 rounded-full ${
                activeNetwork.value === "xahau" ? "bg-xahau" : "bg-xrpl"
              }`}
            />
            <span
              class="text-xs font-semibold uppercase tracking-wide"
              style={{ color: networkConfig.color }}
            >
              {networkConfig.shortLabel}
            </span>
            <span class="text-[10px] text-gray-400 font-mono">
              {networkConfig.nativeCurrency}
            </span>
          </div>
        </section>

        {/* Connected wallet details */}
        {wallet.connected.value && (
          <div class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 mb-4">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span class="text-xs font-medium text-gray-600 uppercase">
                {wallet.walletType.value ?? "Unknown"} ·{" "}
                {networkConfig.shortLabel}
              </span>
            </div>
            <div class="font-mono text-sm text-gray-900 truncate">
              {truncateAddress(wallet.address.value)}
            </div>
            <div class="mt-1 text-xs text-gray-500">
              <code class="bg-gray-100 px-1 py-0.5 rounded text-[10px]">
                {wsUrl.value}
              </code>
            </div>
          </div>
        )}

        {!wallet.connected.value && (
          <div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
            <p class="text-sm text-amber-800">No wallet connected</p>
            <Link href="/" class="text-xs text-amber-600 hover:underline">
              Go home to connect &rarr;
            </Link>
          </div>
        )}

        <nav class="sidebar-nav">
          {/* Network-aware navigation: items auto-filter based on activeNetwork */}
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              class={{
                "nav-item": true,
                active: activePage.value === item.id,
              }}
              onClick$={() => (activePage.value = item.id)}
            >
              <span class="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {/* Show network badge for network-exclusive items */}
              {item.networkOnly && (
                <span
                  class="ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor:
                      item.networkOnly === "xahau"
                        ? "rgba(245,166,35,0.15)"
                        : "rgba(99,64,188,0.15)",
                    color: item.networkOnly === "xahau" ? "#c9871a" : "#6340bc",
                  }}
                >
                  {item.networkOnly === "xahau" ? "XAH" : "XRP"}
                </span>
              )}
            </Link>
          ))}

          {/* Disconnect */}
          <div class="mt-auto pt-4 border-t border-gray-200">
            {wallet.connected.value && (
              <button
                onClick$={handleDisconnect}
                class="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-red-500 hover:text-white rounded-full transition-all duration-200"
              >
                Disconnect
              </button>
            )}
          </div>

          <footer class="text-center border-t border-gray-200 font-extralight mb-1 pt-4 mt-2">
            <div class="flex gap-4 justify-center">
              <Link
                href="https://www.nrdxlab.com"
                target="_blank"
                rel="noopener noreferrer"
                class="text-gray-950/20 hover:text-blue-500 transition-colors"
                title="Home"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                </svg>
              </Link>
              <Link
                href="https://github.com/NerdyXLabs"
                target="_blank"
                rel="noopener noreferrer"
                class="text-gray-950/20 hover:text-blue-500 transition-colors"
                title="GitHub"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </Link>
              <Link
                href="https://twitter.com/NerdyXLabs"
                target="_blank"
                rel="noopener noreferrer"
                class="text-gray-950/20 hover:text-blue-500 transition-colors"
                title="Twitter"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 9-1 9-5.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
                </svg>
              </Link>
            </div>
            <Link
              href="https://x.com/NerdyXLabs"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center text-gray-950/35 hover:text-blue-500 transition-colors"
            >
              Created by {"{NRDX}Labs"}
            </Link>
            <div class="text-[8px] text-gray-950/35">
              Terms of Service | Privacy Policy | Contact Us
            </div>
          </footer>
        </nav>
      </aside>

      {/* Main content area */}
      <main class="main-content">
        <header class="topbar">
          <h1>
            {navItems.find((i) => i.id === activePage.value)?.label ||
              "Dashboard"}
          </h1>
          <div class="topbar-right">
            <span
              class="network-pill"
              style={{
                backgroundColor:
                  activeNetwork.value === "xahau"
                    ? "rgba(245,166,35,0.15)"
                    : "rgba(99,64,188,0.15)",
                color: networkConfig.color,
              }}
            >
              {networkConfig.shortLabel} · {networkConfig.nativeCurrency}
            </span>
          </div>
        </header>

        <div class="content-area">
          {/* Xahau Rewards Banner — only visible when Xahau is active */}
          {activeNetwork.value === "xahau" && wallet.connected.value && (
            <div class="mb-6 rounded-2xl border border-xahau/30 bg-xahau/5 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div class="flex items-center gap-3">
                <span class="text-2xl">🎁</span>
                <div>
                  <h3 class="font-bold text-gray-900">Xahau Rewards</h3>
                  <p class="text-sm text-gray-600">
                    Claim your XAH network rewards directly from the dashboard.
                  </p>
                </div>
              </div>
              <button
                onClick$={handleClaimReward}
                class="shrink-0 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: networkConfig.color }}
              >
                Claim Reward
              </button>
            </div>
          )}

          {/* Quick Send Card */}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 class="text-lg font-bold text-gray-900 mb-4">
                Quick Send ({networkConfig.nativeCurrency})
              </h2>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Destination Address
                  </label>
                  <input
                    type="text"
                    placeholder="rDestination..."
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={sendDestination.value}
                    onInput$={(e) =>
                      (sendDestination.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Amount ({networkConfig.nativeCurrency})
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="0.00"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={sendAmount.value}
                    onInput$={(e) =>
                      (sendAmount.value = (e.target as HTMLInputElement).value)
                    }
                  />
                </div>
                <button
                  class="w-full rounded-lg text-white font-semibold py-2.5 text-sm transition-colors disabled:opacity-50"
                  style={{ backgroundColor: networkConfig.color }}
                  disabled={
                    !wallet.connected.value ||
                    !sendDestination.value ||
                    !sendAmount.value
                  }
                  onClick$={handleQuickSend}
                >
                  Sign &amp; Send {networkConfig.nativeCurrency} via Xaman
                </button>
              </div>
            </div>

            {/* Transaction Category & Type Selector */}
            <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 class="text-lg font-bold text-gray-900 mb-1">
                Sign Transaction
              </h2>
              <p class="text-sm text-gray-500 mb-4">
                {txTypes.length} types available on{" "}
                <span style={{ color: networkConfig.color }}>
                  {networkConfig.shortLabel}
                </span>
              </p>

              {/* Category pills */}
              <div class="flex flex-wrap gap-1.5 mb-4">
                {txCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick$={() => {
                      selectedCategory.value = cat.id;
                      // Auto-select first type in category
                      const firstType = cat.types.find((t) =>
                        (txTypes as readonly string[]).includes(t),
                      );
                      if (firstType) selectedTxType.value = firstType;
                    }}
                    class={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      selectedCategory.value === cat.id
                        ? "text-white shadow-sm"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    style={
                      selectedCategory.value === cat.id
                        ? { backgroundColor: networkConfig.color }
                        : undefined
                    }
                  >
                    {cat.icon} {cat.label}
                    {cat.networkOnly && (
                      <span class="ml-1 opacity-70">
                        ({cat.networkOnly === "xahau" ? "XAH" : "XRP"})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Type selector filtered by selected category */}
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Transaction Type
                </label>
                <select
                  class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:border-transparent bg-white"
                  style={
                    { "--tw-ring-color": networkConfig.color } as Record<
                      string,
                      string
                    >
                  }
                  value={selectedTxType.value}
                  onChange$={(e) =>
                    (selectedTxType.value = (
                      e.target as HTMLSelectElement
                    ).value)
                  }
                >
                  {(() => {
                    const cat = txCategories.find(
                      (c) => c.id === selectedCategory.value,
                    );
                    const typesInCat = cat
                      ? cat.types.filter((t) =>
                          (txTypes as readonly string[]).includes(t),
                        )
                      : [...txTypes];
                    return typesInCat.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ));
                  })()}
                </select>
              </div>
              <button
                class="w-full mt-4 rounded-lg text-white font-semibold py-2.5 text-sm transition-colors disabled:opacity-50"
                style={{ backgroundColor: networkConfig.color }}
                disabled={!wallet.connected.value}
                onClick$={() => {
                  handleSignTransaction({
                    TransactionType: selectedTxType.value,
                  });
                }}
              >
                Sign {selectedTxType.value} on {networkConfig.shortLabel}
              </button>
            </div>
          </div>

          {/* Signing Status */}
          {signingStatus.value !== "idle" && (
            <div
              class={`mb-8 rounded-2xl border p-6 ${
                signingStatus.value === "success"
                  ? "border-green-200 bg-green-50"
                  : signingStatus.value === "error"
                    ? "border-red-200 bg-red-50"
                    : "border-blue-200 bg-blue-50"
              }`}
            >
              <div class="flex items-start gap-4">
                {signingQr.value && (
                  <div class="shrink-0 bg-white rounded-xl p-3 shadow">
                    <img
                      src={signingQr.value}
                      alt="Scan with Xaman"
                      width={180}
                      height={180}
                      class="w-44 h-44"
                    />
                  </div>
                )}
                <div>
                  <h3
                    class={`font-bold text-lg ${
                      signingStatus.value === "success"
                        ? "text-green-800"
                        : signingStatus.value === "error"
                          ? "text-red-800"
                          : "text-blue-800"
                    }`}
                  >
                    {signingStatus.value === "signing" &&
                      "Awaiting Signature..."}
                    {signingStatus.value === "success" && "Transaction Signed!"}
                    {signingStatus.value === "error" && "Signing Failed"}
                  </h3>
                  <p
                    class={`mt-1 text-sm ${
                      signingStatus.value === "success"
                        ? "text-green-700"
                        : signingStatus.value === "error"
                          ? "text-red-700"
                          : "text-blue-700"
                    }`}
                  >
                    {signingMessage.value}
                  </p>
                  {signingStatus.value !== "signing" && (
                    <button
                      class="mt-3 text-sm font-medium underline"
                      onClick$={() => {
                        signingStatus.value = "idle";
                        signingMessage.value = "";
                        signingQr.value = "";
                      }}
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Network Info Card */}
          <div
            class="rounded-2xl border bg-white p-6 shadow-sm"
            style={{ borderColor: networkConfig.color + "30" }}
          >
            <h2 class="text-lg font-bold text-gray-900 mb-4">
              Network Details
            </h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="rounded-lg bg-gray-50 p-4">
                <div class="text-xs text-gray-500 font-medium mb-1">
                  NETWORK
                </div>
                <div
                  class="text-lg font-bold"
                  style={{ color: networkConfig.color }}
                >
                  {networkConfig.shortLabel}
                </div>
                <div class="text-xs text-gray-400 mt-0.5">
                  {networkConfig.label}
                </div>
              </div>
              <div class="rounded-lg bg-gray-50 p-4">
                <div class="text-xs text-gray-500 font-medium mb-1">
                  CURRENCY
                </div>
                <div
                  class="text-lg font-bold"
                  style={{ color: networkConfig.color }}
                >
                  {networkConfig.nativeCurrency}
                </div>
                <div class="text-xs text-gray-400 mt-0.5">
                  {networkConfig.nativeCurrencyLong}
                </div>
              </div>
              <div class="rounded-lg bg-gray-50 p-4">
                <div class="text-xs text-gray-500 font-medium mb-1">
                  WEBSOCKET
                </div>
                <code class="text-xs text-emerald-600 break-all">
                  {wsUrl.value}
                </code>
              </div>
              <div class="rounded-lg bg-gray-50 p-4">
                <div class="text-xs text-gray-500 font-medium mb-1">
                  TX TYPES
                </div>
                <div
                  class="text-lg font-bold"
                  style={{ color: networkConfig.color }}
                >
                  {txTypes.length}
                </div>
                <div class="text-xs text-gray-400 mt-0.5">
                  {txCategories.length} categories
                </div>
              </div>
            </div>

            {/* Exclusive transaction types for this network */}
            <div class="mt-5 pt-4 border-t border-gray-100">
              <h3 class="text-sm font-semibold text-gray-700 mb-3">
                {networkConfig.shortLabel}-Exclusive Features
              </h3>
              <div class="flex flex-wrap gap-2">
                {txCategories
                  .filter((cat) => cat.networkOnly === activeNetwork.value)
                  .map((cat) => (
                    <div
                      key={cat.id}
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: networkConfig.color + "15",
                        color: networkConfig.color,
                      }}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </div>
                  ))}
                {txCategories.filter(
                  (cat) => cat.networkOnly === activeNetwork.value,
                ).length === 0 && (
                  <span class="text-xs text-gray-400 italic">
                    All features on {networkConfig.shortLabel} are shared with
                    the other network
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
});

export const head: DocumentHead = {
  title: "XRPL OS • Dashboard",
  meta: [
    {
      name: "description",
      content:
        "Modern XRPL dashboard — trade, explore DEX, browse NFTs, analyze charts, inspect ledger",
    },
  ],
};

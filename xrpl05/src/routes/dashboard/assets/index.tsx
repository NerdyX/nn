import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { useWalletContext } from "~/context/wallet-context";
import { useNetworkContext, NETWORK_CONFIG } from "~/context/network-context";
import { signTransaction, waitForSignature } from "~/lib/xaman-auth";

interface ExplorerResponse {
  account?: {
    balanceXrp?: string;
    ownerCount?: number;
  };
  recentTransactions?: unknown[];
}

export default component$(() => {
  const wallet = useWalletContext();
  const { activeNetwork } = useNetworkContext();
  const networkConfig = NETWORK_CONFIG[activeNetwork.value];

  const loading = useSignal(false);
  const errorMsg = useSignal("");
  const balanceXrp = useSignal("0");
  const reserveBase = useSignal(10);
  const reserveInc = useSignal(2);
  const ownerCount = useSignal(0);

  // TrustSet form
  const showTrustForm = useSignal(false);
  const trustCurrency = useSignal("");
  const trustIssuer = useSignal("");
  const trustLimit = useSignal("1000000");

  // Signing
  const signingStatus = useSignal<"idle" | "signing" | "success" | "error">(
    "idle",
  );
  const signingMessage = useSignal("");
  const signingQr = useSignal("");

  // Fetch lines via marketplace API as a workaround — or direct WS
  const fetchTrustLines = $(async () => {
    if (!wallet.connected.value || !wallet.address.value) return;

    loading.value = true;
    errorMsg.value = "";

    try {
      // We'll make a fetch to our explorer endpoint which includes trustLines count
      const res = await fetch(
        `/api/explorer?network=${activeNetwork.value}&address=${wallet.address.value}`,
      );

      if (!res.ok) throw new Error("Failed to fetch");

      const data = (await res.json()) as ExplorerResponse;

      balanceXrp.value = data.account?.balanceXrp || "0";
      ownerCount.value = data.account?.ownerCount || 0;

      // We don't have a dedicated trust lines endpoint yet — show count
      // The tokens tab in explorer has the full data via WebSocket
    } catch (err: any) {
      errorMsg.value = err.message || "Failed to load trust lines";
    } finally {
      loading.value = false;
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => wallet.connected.value);
    track(() => wallet.address.value);
    track(() => activeNetwork.value);

    if (wallet.connected.value && wallet.address.value) {
      fetchTrustLines();
    }
  });

  const handleSetTrustLine = $(async () => {
    if (!trustCurrency.value || !trustIssuer.value) {
      signingStatus.value = "error";
      signingMessage.value = "Please fill in currency and issuer address";
      return;
    }

    signingStatus.value = "signing";
    signingMessage.value = "Creating TrustSet transaction...";
    signingQr.value = "";

    try {
      const txjson: Record<string, unknown> = {
        TransactionType: "TrustSet",
        LimitAmount: {
          currency: trustCurrency.value.toUpperCase(),
          issuer: trustIssuer.value,
          value: trustLimit.value,
        },
      };

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
        signingMessage.value = `✅ TrustSet signed! TXID: ${result.response?.txid ?? "N/A"}`;
        signingQr.value = "";
        showTrustForm.value = false;
        trustCurrency.value = "";
        trustIssuer.value = "";
        trustLimit.value = "1000000";
        // Refresh
        setTimeout(() => fetchTrustLines(), 3000);
      }
    } catch (err: any) {
      signingStatus.value = "error";
      signingMessage.value = err.message || "TrustSet signing failed";
      signingQr.value = "";
    }
  });

  const totalReserve = reserveBase.value + ownerCount.value * reserveInc.value;
  const available = Math.max(0, parseFloat(balanceXrp.value) - totalReserve);

  return (
    <div>
      {/* Signing Overlay */}
      {signingStatus.value !== "idle" && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            class={`max-w-md w-full mx-4 rounded-2xl border p-6 shadow-2xl bg-white ${
              signingStatus.value === "success"
                ? "border-green-300"
                : signingStatus.value === "error"
                  ? "border-red-300"
                  : "border-blue-300"
            }`}
          >
            <div class="flex flex-col items-center text-center">
              {signingQr.value && (
                <div class="mb-4 bg-white rounded-xl p-3 shadow">
                  <img
                    src={signingQr.value}
                    alt="Scan with Xaman"
                    width={200}
                    height={200}
                    class="w-48 h-48"
                  />
                </div>
              )}
              <div class="text-3xl mb-3">
                {signingStatus.value === "signing" && "⏳"}
                {signingStatus.value === "success" && "✅"}
                {signingStatus.value === "error" && "❌"}
              </div>
              <p class="text-sm text-gray-600 break-all">
                {signingMessage.value}
              </p>
              {signingStatus.value !== "signing" && (
                <button
                  class="mt-4 px-6 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition"
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

      {/* Header */}
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-bold text-gray-900">Assets & Tokens</h2>
          <p class="text-sm text-gray-500">
            Manage your {networkConfig.nativeCurrency} balance and trust lines
            on{" "}
            <span style={{ color: networkConfig.color }}>
              {networkConfig.shortLabel}
            </span>
          </p>
        </div>
        <div class="flex gap-2">
          <button
            class="px-4 py-2 text-sm font-medium bg-gray-100 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
            disabled={loading.value || !wallet.connected.value}
            onClick$={fetchTrustLines}
          >
            {loading.value ? "Loading..." : "🔄 Refresh"}
          </button>
          <button
            class="px-4 py-2 text-sm font-medium text-white rounded-lg transition"
            style={{ backgroundColor: networkConfig.color }}
            onClick$={() => (showTrustForm.value = !showTrustForm.value)}
          >
            + Add Trust Line
          </button>
        </div>
      </div>

      {/* Error */}
      {errorMsg.value && (
        <div class="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {errorMsg.value}
        </div>
      )}

      {!wallet.connected.value ? (
        <div class="text-center py-20 text-gray-400">
          <div class="text-6xl mb-4">🔒</div>
          <p class="text-lg">Connect your wallet to view assets</p>
        </div>
      ) : (
        <div class="space-y-6">
          {/* Balance Cards */}
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="rounded-2xl border border-gray-200 bg-gradient-to-br from-blue-50 to-white p-6">
              <div class="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Total Balance
              </div>
              <div class="text-3xl font-bold text-gray-900 mt-2">
                {parseFloat(balanceXrp.value).toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}
              </div>
              <div
                class="text-sm font-medium mt-1"
                style={{ color: networkConfig.color }}
              >
                {networkConfig.nativeCurrency}
              </div>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-gradient-to-br from-amber-50 to-white p-6">
              <div class="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Reserved
              </div>
              <div class="text-3xl font-bold text-gray-900 mt-2">
                {totalReserve}
              </div>
              <div class="text-sm text-gray-500 mt-1">
                Base {reserveBase.value} + {ownerCount.value} ×{" "}
                {reserveInc.value} {networkConfig.nativeCurrency}
              </div>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-gradient-to-br from-green-50 to-white p-6">
              <div class="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Available
              </div>
              <div class="text-3xl font-bold text-green-700 mt-2">
                {available.toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}
              </div>
              <div
                class="text-sm font-medium mt-1"
                style={{ color: networkConfig.color }}
              >
                {networkConfig.nativeCurrency}
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div class="rounded-2xl border border-gray-200 bg-white p-6">
            <h3 class="text-sm font-bold text-gray-700 mb-3">
              Account Details
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="bg-gray-50 rounded-lg p-3">
                <div class="text-xs text-gray-500">Address</div>
                <div class="text-sm font-mono mt-1 truncate">
                  {wallet.address.value}
                </div>
              </div>
              <div class="bg-gray-50 rounded-lg p-3">
                <div class="text-xs text-gray-500">Wallet Type</div>
                <div class="text-sm font-medium mt-1 capitalize">
                  {wallet.walletType.value || "Unknown"}
                </div>
              </div>
              <div class="bg-gray-50 rounded-lg p-3">
                <div class="text-xs text-gray-500">Network</div>
                <div
                  class="text-sm font-medium mt-1"
                  style={{ color: networkConfig.color }}
                >
                  {networkConfig.label}
                </div>
              </div>
              <div class="bg-gray-50 rounded-lg p-3">
                <div class="text-xs text-gray-500">Owner Count (Objects)</div>
                <div class="text-sm font-bold mt-1">{ownerCount.value}</div>
              </div>
            </div>
          </div>

          {/* Add Trust Line Form */}
          {showTrustForm.value && (
            <div class="rounded-2xl border border-gray-200 bg-white p-6">
              <h3 class="text-lg font-bold text-gray-900 mb-4">
                Set Trust Line
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Currency Code
                  </label>
                  <input
                    type="text"
                    placeholder="USD, EUR, etc."
                    maxLength={40}
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                    value={trustCurrency.value}
                    onInput$={(e) =>
                      (trustCurrency.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Issuer Address
                  </label>
                  <input
                    type="text"
                    placeholder="rIssuer..."
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={trustIssuer.value}
                    onInput$={(e) =>
                      (trustIssuer.value = (e.target as HTMLInputElement).value)
                    }
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Limit
                  </label>
                  <input
                    type="number"
                    placeholder="1000000"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={trustLimit.value}
                    onInput$={(e) =>
                      (trustLimit.value = (e.target as HTMLInputElement).value)
                    }
                  />
                </div>
              </div>
              <div class="flex gap-3 mt-4">
                <button
                  class="px-6 py-2.5 text-sm font-semibold text-white rounded-lg transition disabled:opacity-50"
                  style={{ backgroundColor: networkConfig.color }}
                  disabled={!trustCurrency.value || !trustIssuer.value}
                  onClick$={handleSetTrustLine}
                >
                  Sign TrustSet via Xaman
                </button>
                <button
                  class="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                  onClick$={() => (showTrustForm.value = false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Tip */}
          <div class="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
            <strong>💡 Tip:</strong> For full trust line details with balances,
            visit the{" "}
            <a href="/explorer" class="underline font-semibold">
              Explorer → Tokens tab
            </a>{" "}
            and enter your address. It uses{" "}
            <code class="bg-blue-100 px-1 py-0.5 rounded text-xs">
              account_lines
            </code>{" "}
            and{" "}
            <code class="bg-blue-100 px-1 py-0.5 rounded text-xs">
              gateway_balances
            </code>{" "}
            for full detail.
          </div>
        </div>
      )}
    </div>
  );
});

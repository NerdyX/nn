import { component$, useSignal, $ } from "@builder.io/qwik";
import { useWalletContext } from "~/context/wallet-context";
import { useNetworkContext, NETWORK_CONFIG } from "~/context/network-context";
import { signTransaction, waitForSignature } from "~/lib/xaman-auth";

export default component$(() => {
  const wallet = useWalletContext();
  const { activeNetwork } = useNetworkContext();
  const networkConfig = NETWORK_CONFIG[activeNetwork.value];

  // TrustSet form
  const currency = useSignal("");
  const issuer = useSignal("");
  const limit = useSignal("1000000");
  const qualityIn = useSignal("");
  const qualityOut = useSignal("");
  const noRipple = useSignal(true);
  const setFreeze = useSignal(false);

  // Remove trust line form
  const removeCurrency = useSignal("");
  const removeIssuer = useSignal("");

  // Active sub-tab
  const activeAction = useSignal<"set" | "remove">("set");

  // Signing state
  const signingStatus = useSignal<"idle" | "signing" | "success" | "error">(
    "idle",
  );
  const signingMessage = useSignal("");
  const signingQr = useSignal("");

  const dismissSigning = $(() => {
    signingStatus.value = "idle";
    signingMessage.value = "";
    signingQr.value = "";
  });

  const signTx = $(async (txjson: Record<string, unknown>) => {
    if (!wallet.connected.value) {
      signingStatus.value = "error";
      signingMessage.value = "Please connect a wallet first";
      return null;
    }

    signingStatus.value = "signing";
    signingMessage.value = `Creating ${String(txjson.TransactionType)} payload...`;
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
        signingMessage.value = `✅ Transaction signed! TXID: ${result.response?.txid ?? "N/A"}`;
        signingQr.value = "";
        return result;
      }

      return null;
    } catch (err: any) {
      signingStatus.value = "error";
      signingMessage.value = err.message || "Transaction signing failed";
      signingQr.value = "";
      return null;
    }
  });

  const handleSetTrustLine = $(async () => {
    if (!currency.value || !issuer.value) {
      signingStatus.value = "error";
      signingMessage.value =
        "Please enter a currency code and issuer address";
      return;
    }

    if (!issuer.value.startsWith("r") || issuer.value.length < 25) {
      signingStatus.value = "error";
      signingMessage.value = "Invalid issuer address";
      return;
    }

    let flags = 0;
    // tfSetNoRipple = 0x00020000
    if (noRipple.value) flags |= 0x00020000;
    // tfSetFreeze = 0x00100000
    if (setFreeze.value) flags |= 0x00100000;

    const tx: Record<string, unknown> = {
      TransactionType: "TrustSet",
      LimitAmount: {
        currency: currency.value.toUpperCase(),
        issuer: issuer.value.trim(),
        value: limit.value || "0",
      },
    };

    if (flags > 0) tx.Flags = flags;

    if (qualityIn.value) {
      const qi = parseInt(qualityIn.value);
      if (!isNaN(qi) && qi > 0) tx.QualityIn = qi;
    }

    if (qualityOut.value) {
      const qo = parseInt(qualityOut.value);
      if (!isNaN(qo) && qo > 0) tx.QualityOut = qo;
    }

    const result = await signTx(tx);

    if (result) {
      currency.value = "";
      issuer.value = "";
      limit.value = "1000000";
      qualityIn.value = "";
      qualityOut.value = "";
    }
  });

  const handleRemoveTrustLine = $(async () => {
    if (!removeCurrency.value || !removeIssuer.value) {
      signingStatus.value = "error";
      signingMessage.value =
        "Please enter the currency code and issuer to remove";
      return;
    }

    const result = await signTx({
      TransactionType: "TrustSet",
      LimitAmount: {
        currency: removeCurrency.value.toUpperCase(),
        issuer: removeIssuer.value.trim(),
        value: "0",
      },
    });

    if (result) {
      removeCurrency.value = "";
      removeIssuer.value = "";
    }
  });

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
                  onClick$={dismissSigning}
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div class="mb-6">
        <h2 class="text-xl font-bold text-gray-900">Trust Lines</h2>
        <p class="text-sm text-gray-500">
          Manage trust lines for issued currencies on{" "}
          <span style={{ color: networkConfig.color }}>
            {networkConfig.shortLabel}
          </span>
        </p>
      </div>

      {!wallet.connected.value ? (
        <div class="text-center py-20 text-gray-400">
          <div class="text-6xl mb-4">🔒</div>
          <p class="text-lg">Connect your wallet to manage trust lines</p>
        </div>
      ) : (
        <div class="space-y-6">
          {/* Action Tabs */}
          <div class="flex gap-2">
            <button
              class={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition ${
                activeAction.value === "set"
                  ? "bg-blue-600 text-white shadow"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              onClick$={() => (activeAction.value = "set")}
            >
              🔗 Set Trust Line
            </button>
            <button
              class={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition ${
                activeAction.value === "remove"
                  ? "bg-red-600 text-white shadow"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              onClick$={() => (activeAction.value = "remove")}
            >
              ✂️ Remove Trust Line
            </button>
          </div>

          {/* ── Set Trust Line ── */}
          {activeAction.value === "set" && (
            <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 class="text-lg font-bold text-gray-900 mb-4">
                Set a Trust Line
              </h3>
              <p class="text-sm text-gray-500 mb-6">
                A trust line allows your account to hold issued currencies from a
                specific issuer. You must set one before you can receive tokens.
              </p>

              <div class="space-y-4">
                {/* Currency */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Currency Code *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., USD, EUR, BTC, or 40-char hex"
                    maxLength={40}
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                    value={currency.value}
                    onInput$={(e) =>
                      (currency.value = (e.target as HTMLInputElement).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    Standard 3-character code (e.g., USD) or 40-character hex for
                    non-standard currencies.
                  </p>
                </div>

                {/* Issuer */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Issuer Address *
                  </label>
                  <input
                    type="text"
                    placeholder="rIssuer..."
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={issuer.value}
                    onInput$={(e) =>
                      (issuer.value = (e.target as HTMLInputElement).value)
                    }
                  />
                </div>

                {/* Limit */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Trust Limit
                  </label>
                  <input
                    type="text"
                    placeholder="1000000"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={limit.value}
                    onInput$={(e) =>
                      (limit.value = (e.target as HTMLInputElement).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    Maximum amount of this currency you are willing to hold from
                    this issuer.
                  </p>
                </div>

                {/* Quality In / Out */}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      Quality In (optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g., 1000000000"
                      class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={qualityIn.value}
                      onInput$={(e) =>
                        (qualityIn.value = (
                          e.target as HTMLInputElement
                        ).value)
                      }
                    />
                    <p class="text-xs text-gray-500 mt-1">
                      Incoming quality ratio (1,000,000,000 = par).
                    </p>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      Quality Out (optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g., 1000000000"
                      class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={qualityOut.value}
                      onInput$={(e) =>
                        (qualityOut.value = (
                          e.target as HTMLInputElement
                        ).value)
                      }
                    />
                    <p class="text-xs text-gray-500 mt-1">
                      Outgoing quality ratio (1,000,000,000 = par).
                    </p>
                  </div>
                </div>

                {/* Flags */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Flags
                  </label>
                  <div class="flex flex-wrap gap-4">
                    <label class="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={noRipple.value}
                        onChange$={() => (noRipple.value = !noRipple.value)}
                        class="rounded accent-blue-600"
                      />
                      No Ripple (tfSetNoRipple)
                    </label>
                    <label class="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={setFreeze.value}
                        onChange$={() => (setFreeze.value = !setFreeze.value)}
                        class="rounded accent-blue-600"
                      />
                      Freeze (tfSetFreeze)
                    </label>
                  </div>
                  <p class="text-xs text-gray-500 mt-2">
                    <strong>No Ripple:</strong> Prevents your balances from being
                    used for rippling paths (recommended for most users).{" "}
                    <strong>Freeze:</strong> Freezes the trust line (only
                    available to issuers).
                  </p>
                </div>

                <button
                  class="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg text-sm disabled:opacity-50"
                  disabled={!currency.value || !issuer.value}
                  onClick$={handleSetTrustLine}
                >
                  🔗 Set Trust Line via Xaman
                </button>
              </div>
            </div>
          )}

          {/* ── Remove Trust Line ── */}
          {activeAction.value === "remove" && (
            <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 class="text-lg font-bold text-gray-900 mb-4">
                Remove a Trust Line
              </h3>
              <p class="text-sm text-gray-500 mb-6">
                To remove a trust line, set its limit to 0. Note: your balance
                for that currency must already be 0 before you can remove the
                trust line. This frees up the owner reserve ({networkConfig.nativeCurrency}).
              </p>

              <div class="space-y-4">
                {/* Currency */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Currency Code *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., USD"
                    maxLength={40}
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent uppercase"
                    value={removeCurrency.value}
                    onInput$={(e) =>
                      (removeCurrency.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                </div>

                {/* Issuer */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Issuer Address *
                  </label>
                  <input
                    type="text"
                    placeholder="rIssuer..."
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    value={removeIssuer.value}
                    onInput$={(e) =>
                      (removeIssuer.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                </div>

                <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  <strong>⚠️ Important:</strong> You must have a zero balance in
                  this currency before you can remove the trust line. If you
                  still hold tokens, send them back to the issuer or trade them
                  on the DEX first.
                </div>

                <button
                  class="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg text-sm disabled:opacity-50"
                  disabled={!removeCurrency.value || !removeIssuer.value}
                  onClick$={handleRemoveTrustLine}
                >
                  ✂️ Remove Trust Line via Xaman
                </button>
              </div>
            </div>
          )}

          {/* View trust lines info */}
          <div class="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
            <strong>💡 View All Trust Lines:</strong> To see a full table of all
            trust lines with balances, limits, and flags, visit the{" "}
            <a href="/explorer" class="underline font-semibold">
              Explorer → Tokens tab
            </a>{" "}
            and enter your address. It queries{" "}
            <code class="bg-blue-100 px-1 py-0.5 rounded text-xs">
              account_lines
            </code>{" "}
            and{" "}
            <code class="bg-blue-100 px-1 py-0.5 rounded text-xs">
              gateway_balances
            </code>{" "}
            from the ledger in real time.
          </div>

          {/* Common Issuers Quick-Add */}
          <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="text-sm font-bold text-gray-700 mb-3">
              Popular Issuers (Quick Fill)
            </h3>
            <p class="text-xs text-gray-500 mb-4">
              Click to pre-fill the trust line form. Always verify issuer
              addresses independently before trusting.
            </p>
            <div class="flex flex-wrap gap-2">
              {[
                {
                  label: "USD (Bitstamp)",
                  currency: "USD",
                  issuer: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
                },
                {
                  label: "BTC (Bitstamp)",
                  currency: "BTC",
                  issuer: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
                },
                {
                  label: "USD (GateHub)",
                  currency: "USD",
                  issuer: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
                },
                {
                  label: "EUR (GateHub)",
                  currency: "EUR",
                  issuer: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
                },
              ].map((item) => (
                <button
                  key={`${item.currency}-${item.issuer}`}
                  class="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition"
                  onClick$={() => {
                    activeAction.value = "set";
                    currency.value = item.currency;
                    issuer.value = item.issuer;
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

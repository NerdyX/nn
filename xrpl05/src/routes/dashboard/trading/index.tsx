import { component$, useSignal, $ } from "@builder.io/qwik";
import { useWalletContext } from "~/context/wallet-context";
import { useNetworkContext, NETWORK_CONFIG } from "~/context/network-context";
import { signTransaction, waitForSignature } from "~/lib/xaman-auth";

export default component$(() => {
  const wallet = useWalletContext();
  const { activeNetwork } = useNetworkContext();
  const networkConfig = NETWORK_CONFIG[activeNetwork.value];

  // Order form state
  const orderType = useSignal<"buy" | "sell">("buy");
  const takerPaysCurrency = useSignal("XRP");
  const takerPaysIssuer = useSignal("");
  const takerPaysAmount = useSignal("");
  const takerGetsCurrency = useSignal("");
  const takerGetsIssuer = useSignal("");
  const takerGetsAmount = useSignal("");

  // Cancel form
  const cancelOfferSequence = useSignal("");

  // Signing state
  const signingStatus = useSignal<"idle" | "signing" | "success" | "error">("idle");
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

  const handleCreateOffer = $(async () => {
    const isNativePayCurrency =
      takerPaysCurrency.value.toUpperCase() === "XRP" ||
      takerPaysCurrency.value.toUpperCase() === "XAH";
    const isNativeGetCurrency =
      takerGetsCurrency.value.toUpperCase() === "XRP" ||
      takerGetsCurrency.value.toUpperCase() === "XAH" ||
      takerGetsCurrency.value === "";

    if (!takerPaysAmount.value || !takerGetsAmount.value) {
      signingStatus.value = "error";
      signingMessage.value = "Please fill in both amounts";
      return;
    }

    let takerPays: string | Record<string, unknown>;
    let takerGets: string | Record<string, unknown>;

    if (isNativePayCurrency) {
      // Native currency in drops
      takerPays = String(Math.floor(parseFloat(takerPaysAmount.value) * 1_000_000));
    } else {
      takerPays = {
        currency: takerPaysCurrency.value.toUpperCase(),
        issuer: takerPaysIssuer.value,
        value: takerPaysAmount.value,
      };
    }

    if (isNativeGetCurrency) {
      takerGets = String(Math.floor(parseFloat(takerGetsAmount.value) * 1_000_000));
    } else {
      takerGets = {
        currency: takerGetsCurrency.value.toUpperCase(),
        issuer: takerGetsIssuer.value,
        value: takerGetsAmount.value,
      };
    }

    const tx: Record<string, unknown> = {
      TransactionType: "OfferCreate",
      TakerPays: orderType.value === "buy" ? takerGets : takerPays,
      TakerGets: orderType.value === "buy" ? takerPays : takerGets,
    };

    await signTx(tx);
  });

  const handleCancelOffer = $(async () => {
    if (!cancelOfferSequence.value) {
      signingStatus.value = "error";
      signingMessage.value = "Enter an offer sequence number to cancel";
      return;
    }

    await signTx({
      TransactionType: "OfferCancel",
      OfferSequence: parseInt(cancelOfferSequence.value),
    });
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
        <h2 class="text-xl font-bold text-gray-900">DEX Trading</h2>
        <p class="text-sm text-gray-500">
          Create and manage offers on the{" "}
          <span style={{ color: networkConfig.color }}>
            {networkConfig.shortLabel}
          </span>{" "}
          decentralized exchange
        </p>
      </div>

      {!wallet.connected.value ? (
        <div class="text-center py-20 text-gray-400">
          <div class="text-6xl mb-4">🔒</div>
          <p class="text-lg">Connect your wallet to start trading</p>
        </div>
      ) : (
        <div class="space-y-6">
          {/* Create Offer */}
          <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="text-lg font-bold text-gray-900 mb-4">Create Offer</h3>

            {/* Buy / Sell Toggle */}
            <div class="flex gap-2 mb-6">
              <button
                class={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition ${
                  orderType.value === "buy"
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                onClick$={() => (orderType.value = "buy")}
              >
                Buy
              </button>
              <button
                class={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition ${
                  orderType.value === "sell"
                    ? "bg-red-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                onClick$={() => (orderType.value = "sell")}
              >
                Sell
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* You Pay */}
              <div class="rounded-xl border border-gray-200 p-5 bg-gray-50">
                <div class="text-sm font-bold text-gray-700 mb-3">
                  {orderType.value === "buy" ? "💸 You Pay" : "📤 You Sell"}
                </div>
                <div class="space-y-3">
                  <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">
                      Currency
                    </label>
                    <input
                      type="text"
                      placeholder={`${networkConfig.nativeCurrency}, USD, EUR...`}
                      class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                      value={takerPaysCurrency.value}
                      onInput$={(e) =>
                        (takerPaysCurrency.value = (
                          e.target as HTMLInputElement
                        ).value)
                      }
                    />
                  </div>
                  {takerPaysCurrency.value.toUpperCase() !== "XRP" &&
                    takerPaysCurrency.value.toUpperCase() !== "XAH" &&
                    takerPaysCurrency.value !== "" && (
                      <div>
                        <label class="block text-xs font-medium text-gray-500 mb-1">
                          Issuer Address
                        </label>
                        <input
                          type="text"
                          placeholder="rIssuer..."
                          class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={takerPaysIssuer.value}
                          onInput$={(e) =>
                            (takerPaysIssuer.value = (
                              e.target as HTMLInputElement
                            ).value)
                          }
                        />
                      </div>
                    )}
                  <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">
                      Amount
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      placeholder="0.00"
                      class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={takerPaysAmount.value}
                      onInput$={(e) =>
                        (takerPaysAmount.value = (
                          e.target as HTMLInputElement
                        ).value)
                      }
                    />
                  </div>
                </div>
              </div>

              {/* You Receive */}
              <div class="rounded-xl border border-gray-200 p-5 bg-gray-50">
                <div class="text-sm font-bold text-gray-700 mb-3">
                  {orderType.value === "buy"
                    ? "📥 You Receive"
                    : "💰 You Receive"}
                </div>
                <div class="space-y-3">
                  <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">
                      Currency
                    </label>
                    <input
                      type="text"
                      placeholder={`${networkConfig.nativeCurrency}, USD, EUR...`}
                      class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                      value={takerGetsCurrency.value}
                      onInput$={(e) =>
                        (takerGetsCurrency.value = (
                          e.target as HTMLInputElement
                        ).value)
                      }
                    />
                  </div>
                  {takerGetsCurrency.value.toUpperCase() !== "XRP" &&
                    takerGetsCurrency.value.toUpperCase() !== "XAH" &&
                    takerGetsCurrency.value !== "" && (
                      <div>
                        <label class="block text-xs font-medium text-gray-500 mb-1">
                          Issuer Address
                        </label>
                        <input
                          type="text"
                          placeholder="rIssuer..."
                          class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={takerGetsIssuer.value}
                          onInput$={(e) =>
                            (takerGetsIssuer.value = (
                              e.target as HTMLInputElement
                            ).value)
                          }
                        />
                      </div>
                    )}
                  <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">
                      Amount
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      placeholder="0.00"
                      class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={takerGetsAmount.value}
                      onInput$={(e) =>
                        (takerGetsAmount.value = (
                          e.target as HTMLInputElement
                        ).value)
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Calculated Price */}
            {takerPaysAmount.value && takerGetsAmount.value && (
              <div class="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                <strong>Price:</strong>{" "}
                {(
                  parseFloat(takerPaysAmount.value) /
                  parseFloat(takerGetsAmount.value)
                ).toFixed(8)}{" "}
                {takerPaysCurrency.value || networkConfig.nativeCurrency} per{" "}
                {takerGetsCurrency.value || networkConfig.nativeCurrency}
              </div>
            )}

            <button
              class={`w-full mt-4 py-3 text-white font-bold rounded-xl transition shadow-lg text-sm disabled:opacity-50 ${
                orderType.value === "buy"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
              disabled={!takerPaysAmount.value || !takerGetsAmount.value}
              onClick$={handleCreateOffer}
            >
              {orderType.value === "buy" ? "🛒 Place Buy Order" : "📤 Place Sell Order"} via Xaman
            </button>
          </div>

          {/* Cancel Offer */}
          <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="text-lg font-bold text-gray-900 mb-4">Cancel Offer</h3>
            <div class="flex gap-3">
              <input
                type="number"
                placeholder="Offer Sequence Number"
                class="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                value={cancelOfferSequence.value}
                onInput$={(e) =>
                  (cancelOfferSequence.value = (
                    e.target as HTMLInputElement
                  ).value)
                }
              />
              <button
                class="px-6 py-2.5 bg-red-600 text-white font-semibold text-sm rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                disabled={!cancelOfferSequence.value}
                onClick$={handleCancelOffer}
              >
                Cancel Offer
              </button>
            </div>
            <p class="text-xs text-gray-500 mt-2">
              You can find offer sequence numbers in the Explorer by looking at
              your account's OfferCreate transactions.
            </p>
          </div>

          {/* Info */}
          <div class="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
            <strong>💡 How DEX Trading Works:</strong> The XRPL has a built-in
            decentralized exchange. When you create an offer, it's matched
            against existing offers on the order book. If no match is found, your
            offer is placed on the book until filled or cancelled. All offers are
            fully on-ledger — no custodians involved.
          </div>
        </div>
      )}
    </div>
  );
});

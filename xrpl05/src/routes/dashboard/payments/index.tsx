import { component$, useSignal, $ } from "@builder.io/qwik";
import { useWalletContext } from "~/context/wallet-context";
import { useNetworkContext, NETWORK_CONFIG } from "~/context/network-context";
import { signTransaction, waitForSignature } from "~/lib/xaman-auth";

export default component$(() => {
  const wallet = useWalletContext();
  const { activeNetwork } = useNetworkContext();
  const networkConfig = NETWORK_CONFIG[activeNetwork.value];

  // Payment form
  const destination = useSignal("");
  const amount = useSignal("");
  const destinationTag = useSignal("");
  const memo = useSignal("");

  // Invoice / request form
  const invoiceCurrency = useSignal("");
  const invoiceIssuer = useSignal("");

  // Signing state
  const signingStatus = useSignal<"idle" | "signing" | "success" | "error">(
    "idle",
  );
  const signingMessage = useSignal("");
  const signingQr = useSignal("");

  // Recent payments (local state for this session)
  const recentPayments = useSignal<
    Array<{
      txid: string;
      to: string;
      amount: string;
      currency: string;
      date: string;
    }>
  >([]);

  const dismissSigning = $(() => {
    signingStatus.value = "idle";
    signingMessage.value = "";
    signingQr.value = "";
  });

  const handleSendPayment = $(async () => {
    if (!destination.value || !amount.value) {
      signingStatus.value = "error";
      signingMessage.value = "Please enter a destination address and amount";
      return;
    }

    if (
      !destination.value.startsWith("r") ||
      destination.value.length < 25
    ) {
      signingStatus.value = "error";
      signingMessage.value = "Invalid destination address";
      return;
    }

    const parsedAmount = parseFloat(amount.value);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      signingStatus.value = "error";
      signingMessage.value = "Please enter a valid amount greater than 0";
      return;
    }

    signingStatus.value = "signing";
    signingMessage.value = "Creating Payment transaction...";
    signingQr.value = "";

    try {
      const isNative =
        !invoiceCurrency.value ||
        invoiceCurrency.value.toUpperCase() === "XRP" ||
        invoiceCurrency.value.toUpperCase() === "XAH";

      let paymentAmount: string | Record<string, unknown>;

      if (isNative) {
        // Native currency — amount in drops
        paymentAmount = String(Math.floor(parsedAmount * 1_000_000));
      } else {
        paymentAmount = {
          currency: invoiceCurrency.value.toUpperCase(),
          issuer: invoiceIssuer.value,
          value: amount.value,
        };
      }

      const txjson: Record<string, unknown> = {
        TransactionType: "Payment",
        Destination: destination.value.trim(),
        Amount: paymentAmount,
      };

      // Add optional destination tag
      if (destinationTag.value) {
        const tag = parseInt(destinationTag.value);
        if (!isNaN(tag) && tag >= 0) {
          txjson.DestinationTag = tag;
        }
      }

      // Add optional memo
      if (memo.value.trim()) {
        const memoHex = Array.from(new TextEncoder().encode(memo.value.trim()))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase();

        txjson.Memos = [
          {
            Memo: {
              MemoType: "746578742F706C61696E", // text/plain in hex
              MemoData: memoHex,
            },
          },
        ];
      }

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
        signingMessage.value = `✅ Payment signed! TXID: ${result.response?.txid ?? "N/A"}`;
        signingQr.value = "";

        // Add to recent payments
        recentPayments.value = [
          {
            txid: result.response?.txid ?? "unknown",
            to: destination.value,
            amount: amount.value,
            currency: isNative
              ? networkConfig.nativeCurrency
              : invoiceCurrency.value.toUpperCase(),
            date: new Date().toLocaleString(),
          },
          ...recentPayments.value.slice(0, 19),
        ];

        // Clear form
        destination.value = "";
        amount.value = "";
        destinationTag.value = "";
        memo.value = "";
      }
    } catch (err: any) {
      signingStatus.value = "error";
      signingMessage.value = err.message || "Payment signing failed";
      signingQr.value = "";
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
        <h2 class="text-xl font-bold text-gray-900">Payments</h2>
        <p class="text-sm text-gray-500">
          Send {networkConfig.nativeCurrency} and issued currencies on{" "}
          <span style={{ color: networkConfig.color }}>
            {networkConfig.shortLabel}
          </span>
        </p>
      </div>

      {!wallet.connected.value ? (
        <div class="text-center py-20 text-gray-400">
          <div class="text-6xl mb-4">🔒</div>
          <p class="text-lg">Connect your wallet to send payments</p>
        </div>
      ) : (
        <div class="space-y-6">
          {/* Send Payment Form */}
          <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="text-lg font-bold text-gray-900 mb-4">
              💸 Send Payment
            </h3>

            <div class="space-y-4">
              {/* Destination */}
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Destination Address *
                </label>
                <input
                  type="text"
                  placeholder="rDestination..."
                  class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={destination.value}
                  onInput$={(e) =>
                    (destination.value = (e.target as HTMLInputElement).value)
                  }
                />
              </div>

              {/* Amount + Currency */}
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="md:col-span-1">
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Amount *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    placeholder="0.00"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={amount.value}
                    onInput$={(e) =>
                      (amount.value = (e.target as HTMLInputElement).value)
                    }
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Currency (blank = {networkConfig.nativeCurrency})
                  </label>
                  <input
                    type="text"
                    placeholder={networkConfig.nativeCurrency}
                    maxLength={40}
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                    value={invoiceCurrency.value}
                    onInput$={(e) =>
                      (invoiceCurrency.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                </div>
                {invoiceCurrency.value &&
                  invoiceCurrency.value.toUpperCase() !== "XRP" &&
                  invoiceCurrency.value.toUpperCase() !== "XAH" && (
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">
                        Issuer Address
                      </label>
                      <input
                        type="text"
                        placeholder="rIssuer..."
                        class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={invoiceIssuer.value}
                        onInput$={(e) =>
                          (invoiceIssuer.value = (
                            e.target as HTMLInputElement
                          ).value)
                        }
                      />
                    </div>
                  )}
              </div>

              {/* Destination Tag */}
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Destination Tag (optional)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g., 12345"
                  class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={destinationTag.value}
                  onInput$={(e) =>
                    (destinationTag.value = (
                      e.target as HTMLInputElement
                    ).value)
                  }
                />
                <p class="text-xs text-gray-500 mt-1">
                  Required by some exchanges and services to identify your
                  deposit.
                </p>
              </div>

              {/* Memo */}
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Memo (optional)
                </label>
                <textarea
                  placeholder="Add a memo to your payment..."
                  class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-20"
                  value={memo.value}
                  onInput$={(e) =>
                    (memo.value = (e.target as HTMLTextAreaElement).value)
                  }
                />
                <p class="text-xs text-gray-500 mt-1">
                  Stored on-ledger as hex-encoded text. Keep it short.
                </p>
              </div>

              {/* Preview */}
              {destination.value && amount.value && (
                <div class="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div class="text-xs text-gray-500 font-medium mb-2">
                    Transaction Preview
                  </div>
                  <div class="grid grid-cols-2 gap-2 text-sm">
                    <div class="text-gray-500">To:</div>
                    <div class="font-mono text-gray-900 truncate">
                      {destination.value}
                    </div>
                    <div class="text-gray-500">Amount:</div>
                    <div class="font-bold text-gray-900">
                      {amount.value}{" "}
                      {invoiceCurrency.value || networkConfig.nativeCurrency}
                    </div>
                    {destinationTag.value && (
                      <>
                        <div class="text-gray-500">Tag:</div>
                        <div class="text-gray-900">{destinationTag.value}</div>
                      </>
                    )}
                    {memo.value && (
                      <>
                        <div class="text-gray-500">Memo:</div>
                        <div class="text-gray-900 truncate">{memo.value}</div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Send Button */}
              <button
                class="w-full py-3 text-white font-bold rounded-xl transition shadow-lg text-sm disabled:opacity-50"
                style={{ backgroundColor: networkConfig.color }}
                disabled={!destination.value || !amount.value}
                onClick$={handleSendPayment}
              >
                Sign &amp; Send via Xaman
              </button>
            </div>
          </div>

          {/* Recent Payments */}
          {recentPayments.value.length > 0 && (
            <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 class="text-lg font-bold text-gray-900 mb-4">
                Recent Payments (This Session)
              </h3>
              <div class="space-y-3">
                {recentPayments.value.map((p, i) => (
                  <div
                    key={`${p.txid}-${i}`}
                    class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div class="min-w-0 flex-1">
                      <div class="text-sm font-mono text-gray-900 truncate">
                        → {p.to.slice(0, 10)}…{p.to.slice(-6)}
                      </div>
                      <div class="text-xs text-gray-500">{p.date}</div>
                    </div>
                    <div class="text-right">
                      <div class="text-sm font-bold text-gray-900">
                        {p.amount} {p.currency}
                      </div>
                      <div class="text-xs text-green-600 font-medium">
                        ✓ Signed
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div class="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
            <strong>💡 Tip:</strong> Payments are the most common transaction
            type on the XRPL. You can send the native currency (
            {networkConfig.nativeCurrency}) or any issued token you hold a trust
            line for. All transactions are signed by your wallet — your keys
            never leave your device.
          </div>
        </div>
      )}
    </div>
  );
});

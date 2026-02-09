import { component$, useSignal, $ } from "@builder.io/qwik";
import { useWalletContext } from "~/context/wallet-context";
import { useNetworkContext, NETWORK_CONFIG } from "~/context/network-context";
import { signTransaction, waitForSignature } from "~/lib/xaman-auth";

// Helper function to convert datetime string to Ripple epoch
const toRippleEpoch = (datetimeStr: string): number | null => {
  if (!datetimeStr) return null;
  const ms = new Date(datetimeStr).getTime();
  if (isNaN(ms)) return null;
  // Ripple epoch = Unix epoch - 946684800
  return Math.floor(ms / 1000) - 946684800;
};

export default component$(() => {
  const wallet = useWalletContext();
  const { activeNetwork } = useNetworkContext();
  const networkConfig = NETWORK_CONFIG[activeNetwork.value];

  // Escrow Create form
  const escrowDestination = useSignal("");
  const escrowAmount = useSignal("");
  const escrowFinishAfter = useSignal("");
  const escrowCancelAfter = useSignal("");
  const escrowCondition = useSignal("");

  // Escrow Finish form
  const finishOwner = useSignal("");
  const finishSequence = useSignal("");
  const finishCondition = useSignal("");
  const finishFulfillment = useSignal("");

  // Escrow Cancel form
  const cancelOwner = useSignal("");
  const cancelSequence = useSignal("");

  // Active sub-tab
  const activeAction = useSignal<"create" | "finish" | "cancel">("create");

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
  const handleCreateEscrow = $(async () => {
    if (!escrowDestination.value || !escrowAmount.value) {
      signingStatus.value = "error";
      signingMessage.value = "Please enter a destination address and amount";
      return;
    }

    const amountDrops = String(
      Math.floor(parseFloat(escrowAmount.value) * 1_000_000),
    );

    const tx: Record<string, unknown> = {
      TransactionType: "EscrowCreate",
      Destination: escrowDestination.value.trim(),
      Amount: amountDrops,
    };

    if (escrowFinishAfter.value) {
      const epoch = toRippleEpoch(escrowFinishAfter.value);
      if (epoch !== null) tx.FinishAfter = epoch;
    }

    if (escrowCancelAfter.value) {
      const epoch = toRippleEpoch(escrowCancelAfter.value);
      if (epoch !== null) tx.CancelAfter = epoch;
    }

    if (escrowCondition.value.trim()) {
      tx.Condition = escrowCondition.value.trim();
    }

    const result = await signTx(tx);

    if (result) {
      escrowDestination.value = "";
      escrowAmount.value = "";
      escrowFinishAfter.value = "";
      escrowCancelAfter.value = "";
      escrowCondition.value = "";
    }
  });

  const handleFinishEscrow = $(async () => {
    if (!finishOwner.value || !finishSequence.value) {
      signingStatus.value = "error";
      signingMessage.value =
        "Please enter the escrow owner address and sequence number";
      return;
    }

    const tx: Record<string, unknown> = {
      TransactionType: "EscrowFinish",
      Owner: finishOwner.value.trim(),
      OfferSequence: parseInt(finishSequence.value),
    };

    if (finishCondition.value.trim()) {
      tx.Condition = finishCondition.value.trim();
    }

    if (finishFulfillment.value.trim()) {
      tx.Fulfillment = finishFulfillment.value.trim();
    }

    const result = await signTx(tx);

    if (result) {
      finishOwner.value = "";
      finishSequence.value = "";
      finishCondition.value = "";
      finishFulfillment.value = "";
    }
  });

  const handleCancelEscrow = $(async () => {
    if (!cancelOwner.value || !cancelSequence.value) {
      signingStatus.value = "error";
      signingMessage.value =
        "Please enter the escrow owner address and sequence number";
      return;
    }

    const result = await signTx({
      TransactionType: "EscrowCancel",
      Owner: cancelOwner.value.trim(),
      OfferSequence: parseInt(cancelSequence.value),
    });

    if (result) {
      cancelOwner.value = "";
      cancelSequence.value = "";
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
        <h2 class="text-xl font-bold text-gray-900">Escrow</h2>
        <p class="text-sm text-gray-500">
          Create, finish, or cancel conditional escrows on{" "}
          <span style={{ color: networkConfig.color }}>
            {networkConfig.shortLabel}
          </span>
        </p>
      </div>

      {!wallet.connected.value ? (
        <div class="text-center py-20 text-gray-400">
          <div class="text-6xl mb-4">🔒</div>
          <p class="text-lg">Connect your wallet to manage escrows</p>
        </div>
      ) : (
        <div class="space-y-6">
          {/* Action Tabs */}
          <div class="flex gap-2">
            {(
              [
                {
                  id: "create",
                  label: "🔐 Create Escrow",
                  color: "bg-blue-600",
                },
                {
                  id: "finish",
                  label: "✅ Finish Escrow",
                  color: "bg-green-600",
                },
                {
                  id: "cancel",
                  label: "❌ Cancel Escrow",
                  color: "bg-red-600",
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                class={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition ${
                  activeAction.value === tab.id
                    ? `${tab.color} text-white shadow`
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                onClick$={() => (activeAction.value = tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Create Escrow ── */}
          {activeAction.value === "create" && (
            <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 class="text-lg font-bold text-gray-900 mb-4">
                Create a New Escrow
              </h3>
              <p class="text-sm text-gray-500 mb-6">
                Lock {networkConfig.nativeCurrency} in escrow until a condition
                is met or a time elapses. Optionally set a crypto-condition for
                additional security.
              </p>

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
                    value={escrowDestination.value}
                    onInput$={(e) =>
                      (escrowDestination.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                </div>

                {/* Amount */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Amount ({networkConfig.nativeCurrency}) *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    placeholder="0.00"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={escrowAmount.value}
                    onInput$={(e) =>
                      (escrowAmount.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                </div>

                {/* Finish After */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Finish After (earliest release time)
                  </label>
                  <input
                    type="datetime-local"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={escrowFinishAfter.value}
                    onInput$={(e) =>
                      (escrowFinishAfter.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    The escrow cannot be finished before this time.
                  </p>
                </div>

                {/* Cancel After */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Cancel After (expiration time)
                  </label>
                  <input
                    type="datetime-local"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={escrowCancelAfter.value}
                    onInput$={(e) =>
                      (escrowCancelAfter.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    After this time, the escrow can be cancelled by the sender.
                  </p>
                </div>

                {/* Condition (optional crypto-condition) */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Condition (optional, hex-encoded crypto-condition)
                  </label>
                  <input
                    type="text"
                    placeholder="A0258020..."
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={escrowCondition.value}
                    onInput$={(e) =>
                      (escrowCondition.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    If set, a matching fulfillment must be provided to finish
                    the escrow. Uses PREIMAGE-SHA-256 crypto-conditions.
                  </p>
                </div>

                <button
                  class="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg text-sm disabled:opacity-50"
                  disabled={!escrowDestination.value || !escrowAmount.value}
                  onClick$={handleCreateEscrow}
                >
                  🔐 Create Escrow via Xaman
                </button>
              </div>
            </div>
          )}

          {/* ── Finish Escrow ── */}
          {activeAction.value === "finish" && (
            <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 class="text-lg font-bold text-gray-900 mb-4">
                Finish (Release) an Escrow
              </h3>
              <p class="text-sm text-gray-500 mb-6">
                Release funds from an escrow whose time condition has been met.
                If the escrow has a crypto-condition, provide the fulfillment.
              </p>

              <div class="space-y-4">
                {/* Owner */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Escrow Owner Address *
                  </label>
                  <input
                    type="text"
                    placeholder="rOwner..."
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={finishOwner.value}
                    onInput$={(e) =>
                      (finishOwner.value = (e.target as HTMLInputElement).value)
                    }
                  />
                </div>

                {/* Sequence */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Escrow Sequence Number *
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g., 42"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={finishSequence.value}
                    onInput$={(e) =>
                      (finishSequence.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    The sequence number of the EscrowCreate transaction.
                  </p>
                </div>

                {/* Condition (optional, must match what was set on create) */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Condition (if escrow was conditional)
                  </label>
                  <input
                    type="text"
                    placeholder="A0258020..."
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={finishCondition.value}
                    onInput$={(e) =>
                      (finishCondition.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                </div>

                {/* Fulfillment */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Fulfillment (if escrow was conditional)
                  </label>
                  <input
                    type="text"
                    placeholder="A0228020..."
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={finishFulfillment.value}
                    onInput$={(e) =>
                      (finishFulfillment.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    The PREIMAGE-SHA-256 fulfillment that corresponds to the
                    condition.
                  </p>
                </div>

                <button
                  class="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition shadow-lg text-sm disabled:opacity-50"
                  disabled={!finishOwner.value || !finishSequence.value}
                  onClick$={handleFinishEscrow}
                >
                  ✅ Finish Escrow via Xaman
                </button>
              </div>
            </div>
          )}

          {/* ── Cancel Escrow ── */}
          {activeAction.value === "cancel" && (
            <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 class="text-lg font-bold text-gray-900 mb-4">
                Cancel an Escrow
              </h3>
              <p class="text-sm text-gray-500 mb-6">
                Cancel an escrow and return the funds to the sender. The escrow
                must have a CancelAfter time that has already passed.
              </p>

              <div class="space-y-4">
                {/* Owner */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Escrow Owner Address *
                  </label>
                  <input
                    type="text"
                    placeholder="rOwner..."
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    value={cancelOwner.value}
                    onInput$={(e) =>
                      (cancelOwner.value = (e.target as HTMLInputElement).value)
                    }
                  />
                </div>

                {/* Sequence */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Escrow Sequence Number *
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g., 42"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    value={cancelSequence.value}
                    onInput$={(e) =>
                      (cancelSequence.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    The sequence number of the original EscrowCreate
                    transaction.
                  </p>
                </div>

                <button
                  class="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg text-sm disabled:opacity-50"
                  disabled={!cancelOwner.value || !cancelSequence.value}
                  onClick$={handleCancelEscrow}
                >
                  ❌ Cancel Escrow via Xaman
                </button>
              </div>
            </div>
          )}

          {/* Info */}
          <div class="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
            <strong>💡 How Escrows Work:</strong> Escrows lock{" "}
            {networkConfig.nativeCurrency} on the ledger until conditions are
            met. You can set a time-based condition (FinishAfter/CancelAfter)
            and/or a crypto-condition that requires a secret preimage to
            release. Escrows are fully trustless — only the ledger controls the
            release of funds.
          </div>
        </div>
      )}
    </div>
  );
});

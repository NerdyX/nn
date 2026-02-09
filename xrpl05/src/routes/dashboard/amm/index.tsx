import { component$, useSignal, $ } from "@builder.io/qwik";
import { useWalletContext } from "~/context/wallet-context";
import { useNetworkContext } from "~/context/network-context";
import { signTransaction, waitForSignature } from "~/lib/xaman-auth";

// Helper function to build asset field for AMM transactions
const buildAssetField = (currency: string, issuer: string, amount?: string) => {
  const isNative =
    currency.toUpperCase() === "XRP" ||
    currency.toUpperCase() === "XAH" ||
    currency === "";

  if (isNative && amount) {
    return String(Math.floor(parseFloat(amount) * 1_000_000));
  }

  if (isNative) {
    return { currency: "XRP" };
  }

  if (amount) {
    return {
      currency: currency.toUpperCase(),
      issuer: issuer.trim(),
      value: amount,
    };
  }

  return {
    currency: currency.toUpperCase(),
    issuer: issuer.trim(),
  };
};

export default component$(() => {
  const wallet = useWalletContext();
  const { activeNetwork } = useNetworkContext();

  const activeAction = useSignal<"deposit" | "withdraw" | "create" | "vote">(
    "create",
  );

  const createAsset1Currency = useSignal("XRP");
  const createAsset1Issuer = useSignal("");
  const createAsset1Amount = useSignal("");
  const createAsset2Currency = useSignal("");
  const createAsset2Issuer = useSignal("");
  const createAsset2Amount = useSignal("");
  const createTradingFee = useSignal("500");

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

  const handleCreateAMM = $(async () => {
    if (
      !createAsset1Amount.value ||
      !createAsset2Amount.value ||
      !createAsset2Currency.value
    ) {
      signingStatus.value = "error";
      signingMessage.value =
        "Please fill in both asset amounts and currency codes";
      return;
    }

    const fee = parseInt(createTradingFee.value);
    if (isNaN(fee) || fee < 0 || fee > 1000) {
      signingStatus.value = "error";
      signingMessage.value =
        "Trading fee must be between 0 and 1000 basis points (0%–1%)";
      return;
    }

    await signTx({
      TransactionType: "AMMCreate",
      Amount: buildAssetField(
        createAsset1Currency.value,
        createAsset1Issuer.value,
        createAsset1Amount.value,
      ),
      Amount2: buildAssetField(
        createAsset2Currency.value,
        createAsset2Issuer.value,
        createAsset2Amount.value,
      ),
      TradingFee: fee,
    });
  });

  if (activeNetwork.value !== "xrpl") {
    return (
      <div class="min-h-[400px] flex items-center justify-center">
        <div class="text-center p-8">
          <div class="text-5xl mb-4">🏦</div>
          <h2 class="text-xl font-bold text-gray-900 mb-2">
            AMM Pools Available on XRPL Only
          </h2>
          <p class="text-gray-600">
            Switch to XRPL using the network toggle in the header.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div class="space-y-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">AMM Pools</h1>
        <p class="text-gray-600 mt-1">
          Manage Automated Market Maker pools on XRPL
        </p>
      </div>

      {!wallet.connected.value ? (
        <div class="card card-elevated flex items-center justify-center py-12">
          <div class="text-center">
            <div class="text-5xl mb-4">🔓</div>
            <h2 class="text-lg font-semibold text-gray-900 mb-2">
              Connect Your Wallet
            </h2>
            <p class="text-gray-600">
              Please connect a wallet to manage AMM pools.
            </p>
          </div>
        </div>
      ) : (
        <div class="space-y-6">
          <div class="flex gap-2 flex-wrap">
            {(
              [
                { id: "create", label: "🆕 Create Pool" },
                { id: "deposit", label: "📥 Deposit" },
                { id: "withdraw", label: "📤 Withdraw" },
                { id: "vote", label: "🗳️ Vote Fee" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                class={`btn ${
                  activeAction.value === tab.id
                    ? "btn-primary"
                    : "btn-secondary"
                }`}
                onClick$={() => (activeAction.value = tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div class="card card-elevated">
            {activeAction.value === "create" && (
              <div class="space-y-6">
                <div>
                  <h2 class="text-xl font-bold text-gray-900 mb-2">
                    Create New AMM Pool
                  </h2>
                  <p class="text-gray-600">
                    Initialize a new AMM with two assets and initial liquidity.
                  </p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div class="space-y-3">
                    <label class="block">
                      <span class="text-sm font-medium text-gray-700 mb-1 block">
                        Asset 1 Currency
                      </span>
                      <input
                        type="text"
                        placeholder="XRP"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={createAsset1Currency.value}
                        onInput$={(e) =>
                          (createAsset1Currency.value = (
                            e.target as HTMLInputElement
                          ).value)
                        }
                      />
                    </label>

                    {createAsset1Currency.value.toUpperCase() !== "XRP" &&
                      createAsset1Currency.value.toUpperCase() !== "XAH" &&
                      createAsset1Currency.value !== "" && (
                        <label class="block">
                          <span class="text-sm font-medium text-gray-700 mb-1 block">
                            Asset 1 Issuer
                          </span>
                          <input
                            type="text"
                            placeholder="rIssuer..."
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={createAsset1Issuer.value}
                            onInput$={(e) =>
                              (createAsset1Issuer.value = (
                                e.target as HTMLInputElement
                              ).value)
                            }
                          />
                        </label>
                      )}

                    <label class="block">
                      <span class="text-sm font-medium text-gray-700 mb-1 block">
                        Asset 1 Amount
                      </span>
                      <input
                        type="number"
                        step="0.000001"
                        placeholder="0.00"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={createAsset1Amount.value}
                        onInput$={(e) =>
                          (createAsset1Amount.value = (
                            e.target as HTMLInputElement
                          ).value)
                        }
                      />
                    </label>
                  </div>

                  <div class="space-y-3">
                    <label class="block">
                      <span class="text-sm font-medium text-gray-700 mb-1 block">
                        Asset 2 Currency
                      </span>
                      <input
                        type="text"
                        placeholder="USD, EUR..."
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                        value={createAsset2Currency.value}
                        onInput$={(e) =>
                          (createAsset2Currency.value = (
                            e.target as HTMLInputElement
                          ).value.toUpperCase())
                        }
                      />
                    </label>

                    {createAsset2Currency.value.toUpperCase() !== "XRP" &&
                      createAsset2Currency.value.toUpperCase() !== "XAH" &&
                      createAsset2Currency.value !== "" && (
                        <label class="block">
                          <span class="text-sm font-medium text-gray-700 mb-1 block">
                            Asset 2 Issuer
                          </span>
                          <input
                            type="text"
                            placeholder="rIssuer..."
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={createAsset2Issuer.value}
                            onInput$={(e) =>
                              (createAsset2Issuer.value = (
                                e.target as HTMLInputElement
                              ).value)
                            }
                          />
                        </label>
                      )}

                    <label class="block">
                      <span class="text-sm font-medium text-gray-700 mb-1 block">
                        Asset 2 Amount
                      </span>
                      <input
                        type="number"
                        step="0.000001"
                        placeholder="0.00"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={createAsset2Amount.value}
                        onInput$={(e) =>
                          (createAsset2Amount.value = (
                            e.target as HTMLInputElement
                          ).value)
                        }
                      />
                    </label>
                  </div>
                </div>

                <label class="block">
                  <span class="text-sm font-medium text-gray-700 mb-1 block">
                    Trading Fee (basis points, 0-1000)
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    step="1"
                    placeholder="500"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={createTradingFee.value}
                    onInput$={(e) =>
                      (createTradingFee.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">500 = 0.5% fee</p>
                </label>

                <button
                  class="btn btn-primary w-full"
                  onClick$={handleCreateAMM}
                  disabled={signingStatus.value === "signing"}
                >
                  {signingStatus.value === "signing"
                    ? "Processing..."
                    : "Create AMM Pool"}
                </button>
              </div>
            )}

            {activeAction.value === "deposit" && (
              <div class="space-y-4 text-center py-8 text-gray-600">
                <p>Deposit functionality coming soon</p>
              </div>
            )}

            {activeAction.value === "withdraw" && (
              <div class="space-y-4 text-center py-8 text-gray-600">
                <p>Withdraw functionality coming soon</p>
              </div>
            )}

            {activeAction.value === "vote" && (
              <div class="space-y-4 text-center py-8 text-gray-600">
                <p>Vote functionality coming soon</p>
              </div>
            )}
          </div>
        </div>
      )}

      {signingStatus.value !== "idle" && (
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="card card-elevated max-w-md w-full mx-4">
            <div class="space-y-4 text-center">
              {signingQr.value && (
                <img
                  src={signingQr.value}
                  alt="Scan with Xaman"
                  width={256}
                  height={256}
                  class="w-full max-w-xs mx-auto"
                />
              )}

              <div class="text-4xl">
                {signingStatus.value === "signing" && "⏳"}
                {signingStatus.value === "success" && "✅"}
                {signingStatus.value === "error" && "❌"}
              </div>

              <p class="text-sm text-gray-600 break-words">
                {signingMessage.value}
              </p>

              {signingStatus.value !== "signing" && (
                <button
                  class="btn btn-secondary w-full"
                  onClick$={dismissSigning}
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

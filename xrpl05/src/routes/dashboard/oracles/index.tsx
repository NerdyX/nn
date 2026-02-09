import { component$, useSignal, $ } from "@builder.io/qwik";
import { useWalletContext } from "~/context/wallet-context";
import { useNetworkContext, NETWORK_CONFIG } from "~/context/network-context";
import { signTransaction, waitForSignature } from "~/lib/xaman-auth";

// Helper function to convert string to hex
const toHex = (str: string): string => {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
};

export default component$(() => {
  const wallet = useWalletContext();
  const { activeNetwork } = useNetworkContext();
  const networkConfig = NETWORK_CONFIG[activeNetwork.value];

  const activeAction = useSignal<"set" | "delete">("set");

  // OracleSet form
  const oracleDocumentId = useSignal("");
  const providerName = useSignal("");
  const assetClass = useSignal("");
  const lastUpdateTime = useSignal("");
  // Data series entries
  const dataEntries = useSignal<
    Array<{
      baseAsset: string;
      quoteAsset: string;
      price: string;
      scale: string;
    }>
  >([{ baseAsset: "XRP", quoteAsset: "USD", price: "", scale: "0" }]);

  // OracleDelete form
  const deleteOracleDocumentId = useSignal("");

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

  const handleOracleSet = $(async () => {
    if (!oracleDocumentId.value) {
      signingStatus.value = "error";
      signingMessage.value = "Please enter an Oracle Document ID";
      return;
    }

    const validEntries = dataEntries.value.filter(
      (e) => e.baseAsset && e.quoteAsset && e.price,
    );

    if (validEntries.length === 0) {
      signingStatus.value = "error";
      signingMessage.value =
        "Please add at least one data entry with base asset, quote asset, and price";
      return;
    }

    const tx: Record<string, unknown> = {
      TransactionType: "OracleSet",
      OracleDocumentID: parseInt(oracleDocumentId.value),
      PriceDataSeries: validEntries.map((e) => ({
        PriceData: {
          BaseAsset: e.baseAsset.toUpperCase(),
          QuoteAsset: e.quoteAsset.toUpperCase(),
          AssetPrice: e.price,
          Scale: parseInt(e.scale) || 0,
        },
      })),
    };

    if (providerName.value.trim()) {
      tx.Provider = toHex(providerName.value.trim());
    }

    if (assetClass.value.trim()) {
      tx.AssetClass = toHex(assetClass.value.trim());
    }

    if (lastUpdateTime.value) {
      const ms = new Date(lastUpdateTime.value).getTime();
      if (!isNaN(ms)) {
        tx.LastUpdateTime = Math.floor(ms / 1000) - 946684800;
      }
    }

    const result = await signTx(tx);

    if (result) {
      oracleDocumentId.value = "";
      providerName.value = "";
      assetClass.value = "";
      lastUpdateTime.value = "";
      dataEntries.value = [
        { baseAsset: "XRP", quoteAsset: "USD", price: "", scale: "0" },
      ];
    }
  });

  const handleOracleDelete = $(async () => {
    if (!deleteOracleDocumentId.value) {
      signingStatus.value = "error";
      signingMessage.value = "Please enter the Oracle Document ID to delete";
      return;
    }

    const result = await signTx({
      TransactionType: "OracleDelete",
      OracleDocumentID: parseInt(deleteOracleDocumentId.value),
    });

    if (result) {
      deleteOracleDocumentId.value = "";
    }
  });

  const addDataEntry = $(() => {
    dataEntries.value = [
      ...dataEntries.value,
      { baseAsset: "", quoteAsset: "", price: "", scale: "0" },
    ];
  });

  const removeDataEntry = $((idx: number) => {
    dataEntries.value = dataEntries.value.filter((_, i) => i !== idx);
  });

  // Show warning if not on XRPL
  if (activeNetwork.value !== "xrpl") {
    return (
      <div class="text-center py-20 text-gray-400">
        <div class="text-6xl mb-4">🔮</div>
        <p class="text-lg">Oracles are only available on XRPL Mainnet</p>
        <p class="text-sm mt-2">
          Switch to XRPL using the network toggle in the header.
        </p>
      </div>
    );
  }

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
        <h2 class="text-xl font-bold text-gray-900">Oracles</h2>
        <p class="text-sm text-gray-500">
          Publish and manage on-ledger price oracle data on{" "}
          <span style={{ color: networkConfig.color }}>
            {networkConfig.shortLabel}
          </span>
        </p>
      </div>

      {!wallet.connected.value ? (
        <div class="text-center py-20 text-gray-400">
          <div class="text-6xl mb-4">🔒</div>
          <p class="text-lg">Connect your wallet to manage oracles</p>
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
              🔮 Set Oracle
            </button>
            <button
              class={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition ${
                activeAction.value === "delete"
                  ? "bg-red-600 text-white shadow"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              onClick$={() => (activeAction.value = "delete")}
            >
              🗑️ Delete Oracle
            </button>
          </div>

          {/* ── OracleSet ── */}
          {activeAction.value === "set" && (
            <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 class="text-lg font-bold text-gray-900 mb-2">
                Set / Update an Oracle
              </h3>
              <p class="text-sm text-gray-500 mb-6">
                Create or update an on-ledger price oracle. Oracles provide
                price feeds that other XRPL features (like AMMs and DeFi hooks)
                can consume. Each oracle can publish multiple price data series.
              </p>

              <div class="space-y-4">
                {/* Oracle Document ID */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Oracle Document ID *
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g., 1"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={oracleDocumentId.value}
                    onInput$={(e) =>
                      (oracleDocumentId.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    A unique identifier for this oracle document. Use the same
                    ID to update an existing oracle.
                  </p>
                </div>

                {/* Provider Name */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Provider Name (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., MyOracleService"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={providerName.value}
                    onInput$={(e) =>
                      (providerName.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    A human-readable name identifying the data provider. Stored
                    as hex on the ledger.
                  </p>
                </div>

                {/* Asset Class */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Asset Class (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., currency, commodity, stock"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={assetClass.value}
                    onInput$={(e) =>
                      (assetClass.value = (e.target as HTMLInputElement).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    The class of assets this oracle provides data for. Stored as
                    hex.
                  </p>
                </div>

                {/* Last Update Time */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Last Update Time (optional)
                  </label>
                  <input
                    type="datetime-local"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={lastUpdateTime.value}
                    onInput$={(e) =>
                      (lastUpdateTime.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    Timestamp of the last price update. Defaults to current time
                    if omitted.
                  </p>
                </div>

                {/* Price Data Series */}
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <label class="text-sm font-medium text-gray-700">
                      Price Data Series *
                    </label>
                    <button
                      class="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition"
                      onClick$={addDataEntry}
                    >
                      + Add Entry
                    </button>
                  </div>

                  <div class="space-y-3">
                    {dataEntries.value.map((entry, idx) => (
                      <div
                        key={`entry-${idx}`}
                        class="grid grid-cols-1 sm:grid-cols-5 gap-2 bg-gray-50 rounded-xl p-3 border border-gray-100"
                      >
                        <div>
                          <label class="block text-[10px] font-medium text-gray-500 mb-0.5">
                            Base Asset
                          </label>
                          <input
                            type="text"
                            placeholder="XRP"
                            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                            value={entry.baseAsset}
                            onInput$={(e) => {
                              const newEntries = [...dataEntries.value];
                              newEntries[idx] = {
                                ...newEntries[idx],
                                baseAsset: (e.target as HTMLInputElement).value,
                              };
                              dataEntries.value = newEntries;
                            }}
                          />
                        </div>
                        <div>
                          <label class="block text-[10px] font-medium text-gray-500 mb-0.5">
                            Quote Asset
                          </label>
                          <input
                            type="text"
                            placeholder="USD"
                            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                            value={entry.quoteAsset}
                            onInput$={(e) => {
                              const newEntries = [...dataEntries.value];
                              newEntries[idx] = {
                                ...newEntries[idx],
                                quoteAsset: (e.target as HTMLInputElement)
                                  .value,
                              };
                              dataEntries.value = newEntries;
                            }}
                          />
                        </div>
                        <div>
                          <label class="block text-[10px] font-medium text-gray-500 mb-0.5">
                            Price (integer)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., 50000"
                            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={entry.price}
                            onInput$={(e) => {
                              const newEntries = [...dataEntries.value];
                              newEntries[idx] = {
                                ...newEntries[idx],
                                price: (e.target as HTMLInputElement).value,
                              };
                              dataEntries.value = newEntries;
                            }}
                          />
                        </div>
                        <div>
                          <label class="block text-[10px] font-medium text-gray-500 mb-0.5">
                            Scale
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            placeholder="0"
                            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={entry.scale}
                            onInput$={(e) => {
                              const newEntries = [...dataEntries.value];
                              newEntries[idx] = {
                                ...newEntries[idx],
                                scale: (e.target as HTMLInputElement).value,
                              };
                              dataEntries.value = newEntries;
                            }}
                          />
                        </div>
                        <div class="flex items-end">
                          {dataEntries.value.length > 1 && (
                            <button
                              class="w-full py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
                              onClick$={() => removeDataEntry(idx)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p class="text-xs text-gray-500 mt-2">
                    <strong>Price</strong> is an unsigned integer.{" "}
                    <strong>Scale</strong> determines the decimal shift: actual
                    price = Price × 10^(-Scale). For example, XRP at $0.50 could
                    be Price=50000, Scale=5 (50000 × 10^-5 = 0.50).
                  </p>
                </div>

                <button
                  class="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg text-sm disabled:opacity-50"
                  disabled={
                    !oracleDocumentId.value ||
                    dataEntries.value.filter(
                      (e) => e.baseAsset && e.quoteAsset && e.price,
                    ).length === 0
                  }
                  onClick$={handleOracleSet}
                >
                  🔮 Set Oracle via Xaman
                </button>
              </div>
            </div>
          )}

          {/* ── OracleDelete ── */}
          {activeAction.value === "delete" && (
            <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 class="text-lg font-bold text-gray-900 mb-2">
                Delete an Oracle
              </h3>
              <p class="text-sm text-gray-500 mb-6">
                Remove an oracle document from the ledger. This will delete all
                price data associated with this oracle and free up the owner
                reserve.
              </p>

              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Oracle Document ID *
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g., 1"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    value={deleteOracleDocumentId.value}
                    onInput$={(e) =>
                      (deleteOracleDocumentId.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                </div>

                <div class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
                  <strong>⚠️ Warning:</strong> This will permanently delete the
                  oracle and all associated price data from the ledger. Any
                  consumers relying on this oracle will lose their data source.
                </div>

                <button
                  class="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg text-sm disabled:opacity-50"
                  disabled={!deleteOracleDocumentId.value}
                  onClick$={handleOracleDelete}
                >
                  🗑️ Delete Oracle via Xaman
                </button>
              </div>
            </div>
          )}

          {/* Info */}
          <div class="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
            <strong>💡 About XRPL Oracles:</strong>
            <ul class="list-disc ml-5 mt-2 space-y-1">
              <li>
                Oracles publish price data directly on the XRPL ledger, making
                it available to AMMs, Hooks, and other on-ledger consumers.
              </li>
              <li>
                Each oracle is identified by an{" "}
                <code class="bg-blue-100 px-1 py-0.5 rounded text-xs">
                  OracleDocumentID
                </code>{" "}
                unique to the publishing account.
              </li>
              <li>
                The <strong>PriceDataSeries</strong> can contain up to 10 price
                entries per oracle, each with a base/quote asset pair, price,
                and scaling factor.
              </li>
              <li>
                Oracle data is consumed by the{" "}
                <code class="bg-blue-100 px-1 py-0.5 rounded text-xs">
                  get_aggregate_price
                </code>{" "}
                API command, which aggregates across multiple oracle providers.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
});

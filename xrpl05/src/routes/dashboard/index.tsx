import { component$, useSignal, $ } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";
import {
  useNetworkContext,
  NETWORK_CONFIG,
  getTxTypesForNetwork,
  getTxCategoriesForNetwork,
  canSignTransaction,
} from "~/context/network-context";
import { useWalletContext } from "~/context/wallet-context";
import { signTransaction, waitForSignature } from "~/lib/xaman-auth";

import "./dashboard.css";

export default component$(() => {
  const { activeNetwork, wsUrl } = useNetworkContext();
  const wallet = useWalletContext();

  const networkConfig = NETWORK_CONFIG[activeNetwork.value];
  const txTypes = getTxTypesForNetwork(activeNetwork.value);
  const txCategories = getTxCategoriesForNetwork(activeNetwork.value);

  // Transaction signing state
  const signingStatus = useSignal<"idle" | "signing" | "success" | "error">(
    "idle",
  );
  const signingMessage = useSignal("");
  const signingQr = useSignal("");
  const selectedTxType = useSignal("Payment");
  const selectedCategory = useSignal("payment");

  // Quick-send form state
  const sendDestination = useSignal("");
  const sendAmount = useSignal("");

  // Sign & submit a transaction via Xaman
  const handleSignTransaction = $(async (txjson: Record<string, unknown>) => {
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
        signingMessage.value = `Transaction signed on ${networkConfig.label}. TXID: ${result.response?.txid ?? "N/A"}`;
        signingQr.value = "";
      }
    } catch (err) {
      signingStatus.value = "error";
      signingMessage.value =
        err instanceof Error ? err.message : "Signing failed";
      signingQr.value = "";
    }
  });

  // Quick Send handler
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

  // Claim Reward handler (Xahau only)
  const handleClaimReward = $(() => {
    handleSignTransaction({
      TransactionType: "ClaimReward",
      Issuer: wallet.address.value,
    });
  });

  return (
    <>
      {/* Xahau Rewards Banner */}
      {activeNetwork.value === "xahau" && wallet.connected.value && (
        <div
          class="bento-card bento-col-12"
          style={{
            background: "rgba(245,166,35,0.04)",
            borderColor: "rgba(245,166,35,0.2)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <h3 class="bento-card-title" style={{ marginBottom: "4px" }}>
                Xahau Rewards
              </h3>
              <p class="bento-card-subtitle" style={{ margin: 0 }}>
                Claim your XAH network rewards directly from the dashboard.
              </p>
            </div>
            <button
              onClick$={handleClaimReward}
              style={{
                padding: "10px 24px",
                borderRadius: "8px",
                border: "none",
                background: networkConfig.color,
                color: "white",
                fontWeight: "600",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Claim Reward
            </button>
          </div>
        </div>
      )}

      {/* Bento Grid */}
      <div class="bento-grid">
        {/* Quick Send */}
        <div class="bento-card bento-col-6">
          <h2 class="bento-card-title">
            Quick Send ({networkConfig.nativeCurrency})
          </h2>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "6px",
                }}
              >
                Destination Address
              </label>
              <input
                type="text"
                placeholder="rDestination..."
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                value={sendDestination.value}
                onInput$={(e) =>
                  (sendDestination.value = (e.target as HTMLInputElement).value)
                }
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "6px",
                }}
              >
                Amount ({networkConfig.nativeCurrency})
              </label>
              <input
                type="number"
                step="0.000001"
                placeholder="0.00"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                value={sendAmount.value}
                onInput$={(e) =>
                  (sendAmount.value = (e.target as HTMLInputElement).value)
                }
              />
            </div>
            <button
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: "8px",
                border: "none",
                background:
                  !wallet.connected.value ||
                  !sendDestination.value ||
                  !sendAmount.value
                    ? "#d1d5db"
                    : networkConfig.color,
                color: "white",
                fontWeight: "600",
                fontSize: "13px",
                cursor:
                  !wallet.connected.value ||
                  !sendDestination.value ||
                  !sendAmount.value
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  !wallet.connected.value ||
                  !sendDestination.value ||
                  !sendAmount.value
                    ? "0.5"
                    : "1",
              }}
              disabled={
                !wallet.connected.value ||
                !sendDestination.value ||
                !sendAmount.value
              }
              onClick$={handleQuickSend}
            >
              Sign & Send {networkConfig.nativeCurrency} via Xaman
            </button>
          </div>
        </div>

        {/* Transaction Type Selector */}
        <div class="bento-card bento-col-6">
          <h2 class="bento-card-title">Sign Transaction</h2>
          <p class="bento-card-subtitle">
            {txTypes.length} types available on{" "}
            <span style={{ color: networkConfig.color }}>
              {networkConfig.shortLabel}
            </span>
          </p>

          {/* Category pills */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              marginBottom: "14px",
            }}
          >
            {txCategories.map((cat) => (
              <button
                key={cat.id}
                onClick$={() => {
                  selectedCategory.value = cat.id;
                  const firstType = cat.types.find((t) =>
                    (txTypes as readonly string[]).includes(t),
                  );
                  if (firstType) selectedTxType.value = firstType;
                }}
                style={{
                  padding: "5px 12px",
                  borderRadius: "999px",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: "500",
                  cursor: "pointer",
                  background:
                    selectedCategory.value === cat.id
                      ? networkConfig.color
                      : "#f3f4f6",
                  color:
                    selectedCategory.value === cat.id ? "white" : "#4b5563",
                  transition: "all 0.15s ease",
                }}
              >
                {cat.label}
                {cat.networkOnly && (
                  <span style={{ marginLeft: "4px", opacity: "0.7" }}>
                    ({cat.networkOnly === "xahau" ? "XAH" : "XRP"})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Type selector */}
          <div style={{ marginBottom: "14px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "500",
                color: "#374151",
                marginBottom: "6px",
              }}
            >
              Transaction Type
            </label>
            <select
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "13px",
                background: "white",
                outline: "none",
                boxSizing: "border-box",
              }}
              value={selectedTxType.value}
              onChange$={(e) =>
                (selectedTxType.value = (e.target as HTMLSelectElement).value)
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
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: "8px",
              border: "none",
              background: !wallet.connected.value
                ? "#d1d5db"
                : networkConfig.color,
              color: "white",
              fontWeight: "600",
              fontSize: "13px",
              cursor: !wallet.connected.value ? "not-allowed" : "pointer",
              opacity: !wallet.connected.value ? "0.5" : "1",
            }}
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

        {/* Signing Status */}
        {signingStatus.value !== "idle" && (
          <div
            class={`bento-col-12 dash-signing-banner ${signingStatus.value}`}
          >
            {signingQr.value && (
              <div
                style={{
                  flexShrink: "0",
                  background: "white",
                  borderRadius: "12px",
                  padding: "10px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              >
                <img
                  src={signingQr.value}
                  alt="Scan with Xaman"
                  width={160}
                  height={160}
                  style={{ display: "block" }}
                />
              </div>
            )}
            <div>
              <h3
                style={{
                  margin: "0 0 6px",
                  fontSize: "16px",
                  fontWeight: "700",
                  color:
                    signingStatus.value === "success"
                      ? "#166534"
                      : signingStatus.value === "error"
                        ? "#991b1b"
                        : "#1e40af",
                }}
              >
                {signingStatus.value === "signing" && "Awaiting Signature..."}
                {signingStatus.value === "success" && "Transaction Signed"}
                {signingStatus.value === "error" && "Signing Failed"}
              </h3>
              <p
                style={{
                  margin: "0",
                  fontSize: "13px",
                  color:
                    signingStatus.value === "success"
                      ? "#15803d"
                      : signingStatus.value === "error"
                        ? "#b91c1c"
                        : "#1d4ed8",
                }}
              >
                {signingMessage.value}
              </p>
              {signingStatus.value !== "signing" && (
                <button
                  style={{
                    marginTop: "10px",
                    background: "none",
                    border: "none",
                    fontSize: "13px",
                    fontWeight: "500",
                    textDecoration: "underline",
                    cursor: "pointer",
                    color: "inherit",
                    padding: "0",
                  }}
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
        )}

        {/* Network Info — spans full width */}
        <div
          class="bento-card bento-col-12"
          style={{ borderColor: networkConfig.color + "25" }}
        >
          <h2 class="bento-card-title">Network Details</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "14px",
            }}
          >
            <div class="bento-stat">
              <div class="bento-stat-label">Network</div>
              <div
                class="bento-stat-value"
                style={{ color: networkConfig.color }}
              >
                {networkConfig.shortLabel}
              </div>
              <div class="bento-stat-extra">{networkConfig.label}</div>
            </div>
            <div class="bento-stat">
              <div class="bento-stat-label">Currency</div>
              <div
                class="bento-stat-value"
                style={{ color: networkConfig.color }}
              >
                {networkConfig.nativeCurrency}
              </div>
              <div class="bento-stat-extra">
                {networkConfig.nativeCurrencyLong}
              </div>
            </div>
            <div class="bento-stat">
              <div class="bento-stat-label">WebSocket</div>
              <code
                style={{
                  fontSize: "12px",
                  color: "#059669",
                  wordBreak: "break-all",
                  lineHeight: "1.4",
                }}
              >
                {wsUrl.value}
              </code>
            </div>
            <div class="bento-stat">
              <div class="bento-stat-label">TX Types</div>
              <div
                class="bento-stat-value"
                style={{ color: networkConfig.color }}
              >
                {txTypes.length}
              </div>
              <div class="bento-stat-extra">
                {txCategories.length} categories
              </div>
            </div>
          </div>

          {/* Exclusive features */}
          <div
            style={{
              marginTop: "20px",
              paddingTop: "16px",
              borderTop: "1px solid #f3f4f6",
            }}
          >
            <h3
              style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "#374151",
                marginBottom: "10px",
              }}
            >
              {networkConfig.shortLabel}-Exclusive Features
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {txCategories
                .filter((cat) => cat.networkOnly === activeNetwork.value)
                .map((cat) => (
                  <span
                    key={cat.id}
                    class="dash-feature-pill"
                    style={{
                      backgroundColor: networkConfig.color + "12",
                      color: networkConfig.color,
                    }}
                  >
                    {cat.label}
                  </span>
                ))}
              {txCategories.filter(
                (cat) => cat.networkOnly === activeNetwork.value,
              ).length === 0 && (
                <span
                  style={{
                    fontSize: "13px",
                    color: "#9ca3af",
                    fontStyle: "italic",
                  }}
                >
                  All features on {networkConfig.shortLabel} are shared with the
                  other network
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

export const head: DocumentHead = {
  title: "XRPL OS - Dashboard",
  meta: [
    {
      name: "description",
      content:
        "Modern XRPL dashboard — trade, explore DEX, browse NFTs, analyze charts, inspect ledger",
    },
  ],
};

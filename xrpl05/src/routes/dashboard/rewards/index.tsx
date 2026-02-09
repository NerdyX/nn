import { component$, useSignal, $ } from "@builder.io/qwik";
import { useWalletContext } from "~/context/wallet-context";
import { useNetworkContext, NETWORK_CONFIG } from "~/context/network-context";
import { signTransaction, waitForSignature } from "~/lib/xaman-auth";

export default component$(() => {
  const wallet = useWalletContext();
  const { activeNetwork } = useNetworkContext();
  const networkConfig = NETWORK_CONFIG[activeNetwork.value];

  // ClaimReward form
  const issuerAddress = useSignal("");
  const useOwnAddress = useSignal(true);

  // Signing state
  const signingStatus = useSignal<"idle" | "signing" | "success" | "error">(
    "idle",
  );
  const signingMessage = useSignal("");
  const signingQr = useSignal("");

  // Claim history (session only)
  const claimHistory = useSignal<
    Array<{ txid: string; date: string; issuer: string }>
  >([]);

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

  const handleClaimReward = $(async () => {
    const issuer = useOwnAddress.value
      ? wallet.address.value
      : issuerAddress.value.trim();

    if (!issuer || !issuer.startsWith("r") || issuer.length < 25) {
      signingStatus.value = "error";
      signingMessage.value = "Please enter a valid issuer address";
      return;
    }

    const result = await signTx({
      TransactionType: "ClaimReward",
      Issuer: issuer,
    });

    if (result) {
      claimHistory.value = [
        {
          txid: result.response?.txid ?? "unknown",
          date: new Date().toLocaleString(),
          issuer,
        },
        ...claimHistory.value.slice(0, 19),
      ];
    }
  });

  const handleOptOut = $(async () => {
    // ClaimReward with Flags = 1 opts out of rewards
    const result = await signTx({
      TransactionType: "ClaimReward",
      Issuer: wallet.address.value,
      Flags: 1,
    });

    if (result) {
      claimHistory.value = [
        {
          txid: result.response?.txid ?? "unknown",
          date: new Date().toLocaleString(),
          issuer: `${wallet.address.value} (opt-out)`,
        },
        ...claimHistory.value.slice(0, 19),
      ];
    }
  });

  // Show warning if not on Xahau
  if (activeNetwork.value !== "xahau") {
    return (
      <div class="text-center py-20 text-gray-400">
        <div class="text-6xl mb-4">🎁</div>
        <p class="text-lg">Rewards are only available on Xahau Network</p>
        <p class="text-sm mt-2">
          Switch to Xahau using the network toggle in the header.
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
        <h2 class="text-xl font-bold text-gray-900">Claim Rewards</h2>
        <p class="text-sm text-gray-500">
          Claim your{" "}
          <span style={{ color: networkConfig.color }}>
            {networkConfig.nativeCurrency}
          </span>{" "}
          network rewards on{" "}
          <span style={{ color: networkConfig.color }}>
            {networkConfig.shortLabel}
          </span>
        </p>
      </div>

      {!wallet.connected.value ? (
        <div class="text-center py-20 text-gray-400">
          <div class="text-6xl mb-4">🔒</div>
          <p class="text-lg">Connect your wallet to claim rewards</p>
        </div>
      ) : (
        <div class="space-y-6">
          {/* Rewards Hero */}
          <div class="rounded-2xl bg-gradient-to-br from-amber-50 via-white to-orange-50 border border-amber-200 p-8 shadow-sm">
            <div class="flex items-start gap-4">
              <div class="text-5xl">🎁</div>
              <div class="flex-1">
                <h3 class="text-2xl font-bold text-gray-900 mb-2">
                  Xahau Network Rewards
                </h3>
                <p class="text-gray-600 text-sm leading-relaxed">
                  Xahau distributes network rewards to account holders based on
                  their balance and activity. Rewards accumulate over time and
                  can be claimed with a{" "}
                  <code class="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">
                    ClaimReward
                  </code>{" "}
                  transaction. The reward amount depends on your account balance,
                  the network's reward rate, and how long since your last claim.
                </p>
              </div>
            </div>
          </div>

          {/* Claim Form */}
          <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="text-lg font-bold text-gray-900 mb-4">
              🎁 Claim Your Rewards
            </h3>

            <div class="space-y-4">
              {/* Issuer Selection */}
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Reward Issuer
                </label>

                <div class="space-y-2">
                  <label class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200 cursor-pointer hover:bg-gray-100 transition">
                    <input
                      type="radio"
                      name="issuer-type"
                      checked={useOwnAddress.value}
                      onChange$={() => (useOwnAddress.value = true)}
                      class="accent-amber-600"
                    />
                    <div>
                      <div class="text-sm font-semibold text-gray-900">
                        Use My Address (Recommended)
                      </div>
                      <div class="text-xs text-gray-500 font-mono mt-0.5">
                        {wallet.address.value}
                      </div>
                    </div>
                  </label>

                  <label class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200 cursor-pointer hover:bg-gray-100 transition">
                    <input
                      type="radio"
                      name="issuer-type"
                      checked={!useOwnAddress.value}
                      onChange$={() => (useOwnAddress.value = false)}
                      class="accent-amber-600"
                    />
                    <div class="flex-1">
                      <div class="text-sm font-semibold text-gray-900">
                        Custom Issuer Address
                      </div>
                      <div class="text-xs text-gray-500 mt-0.5">
                        Specify a different issuer for the reward claim
                      </div>
                    </div>
                  </label>
                </div>

                {!useOwnAddress.value && (
                  <div class="mt-3">
                    <input
                      type="text"
                      placeholder="rIssuer..."
                      class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      value={issuerAddress.value}
                      onInput$={(e) =>
                        (issuerAddress.value = (
                          e.target as HTMLInputElement
                        ).value)
                      }
                    />
                  </div>
                )}
              </div>

              {/* Claim Button */}
              <button
                class="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition shadow-lg text-sm"
                onClick$={handleClaimReward}
              >
                🎁 Claim Rewards via Xaman
              </button>

              {/* Info about what happens */}
              <div class="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
                <strong>What happens when you claim:</strong>
                <ol class="list-decimal ml-5 mt-2 space-y-1">
                  <li>
                    A <code class="bg-amber-100 px-1 py-0.5 rounded text-xs">ClaimReward</code>{" "}
                    transaction is created and sent to Xaman for signing.
                  </li>
                  <li>
                    You sign the transaction in your Xaman wallet (scan the QR
                    code on desktop, or approve in the app on mobile).
                  </li>
                  <li>
                    The network calculates your accumulated rewards based on your
                    balance and time since last claim.
                  </li>
                  <li>
                    Rewards are credited directly to your {networkConfig.nativeCurrency}{" "}
                    balance.
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* Opt Out Section */}
          <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="text-lg font-bold text-gray-900 mb-2">
              Opt Out of Rewards
            </h3>
            <p class="text-sm text-gray-500 mb-4">
              If you no longer wish to participate in the Xahau reward program,
              you can opt out. This sends a ClaimReward transaction with the
              opt-out flag. You can always opt back in later by submitting a
              regular ClaimReward.
            </p>

            <button
              class="px-6 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-red-100 hover:text-red-700 transition text-sm"
              onClick$={handleOptOut}
            >
              Opt Out of Rewards
            </button>
          </div>

          {/* Claim History */}
          {claimHistory.value.length > 0 && (
            <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 class="text-lg font-bold text-gray-900 mb-4">
                Claim History (This Session)
              </h3>
              <div class="space-y-3">
                {claimHistory.value.map((claim, i) => (
                  <div
                    key={`${claim.txid}-${i}`}
                    class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div class="min-w-0 flex-1">
                      <div class="text-sm font-mono text-gray-900 truncate">
                        TXID: {claim.txid.slice(0, 12)}…
                        {claim.txid.length > 12
                          ? claim.txid.slice(-8)
                          : ""}
                      </div>
                      <div class="text-xs text-gray-500">{claim.date}</div>
                    </div>
                    <div class="text-right">
                      <div class="text-xs text-gray-500 font-mono truncate max-w-[140px]">
                        {claim.issuer.slice(0, 8)}…
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

          {/* How Rewards Work */}
          <div class="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
            <strong>💡 How Xahau Rewards Work:</strong>
            <ul class="list-disc ml-5 mt-2 space-y-1">
              <li>
                Xahau distributes rewards to account holders proportional to
                their balance and participation time.
              </li>
              <li>
                Rewards accumulate passively — you don't need to stake or lock
                your {networkConfig.nativeCurrency}.
              </li>
              <li>
                The <code class="bg-blue-100 px-1 py-0.5 rounded text-xs">ClaimReward</code>{" "}
                transaction triggers the network to calculate and distribute your
                pending rewards.
              </li>
              <li>
                There is no penalty for claiming frequently or infrequently.
                Rewards simply accumulate until you claim.
              </li>
              <li>
                The reward rate is determined by network consensus and may change
                over time based on governance decisions.
              </li>
            </ul>
          </div>

          {/* Reward Rate Info */}
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="rounded-2xl border border-gray-200 bg-gradient-to-br from-amber-50 to-white p-5">
              <div class="text-xs text-amber-600 font-medium uppercase tracking-wide">
                Network
              </div>
              <div
                class="text-2xl font-bold mt-1"
                style={{ color: networkConfig.color }}
              >
                {networkConfig.shortLabel}
              </div>
              <div class="text-xs text-gray-500 mt-1">
                {networkConfig.label}
              </div>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-gradient-to-br from-green-50 to-white p-5">
              <div class="text-xs text-green-600 font-medium uppercase tracking-wide">
                Currency
              </div>
              <div class="text-2xl font-bold text-gray-900 mt-1">
                {networkConfig.nativeCurrency}
              </div>
              <div class="text-xs text-gray-500 mt-1">
                {networkConfig.nativeCurrencyLong}
              </div>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-gradient-to-br from-blue-50 to-white p-5">
              <div class="text-xs text-blue-600 font-medium uppercase tracking-wide">
                Transaction Type
              </div>
              <div class="text-2xl font-bold text-gray-900 mt-1 font-mono">
                ClaimReward
              </div>
              <div class="text-xs text-gray-500 mt-1">Xahau-exclusive</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

import { component$, useSignal, $ } from "@builder.io/qwik";
import { useWalletContext } from "~/context/wallet-context";
import { useNetworkContext, NETWORK_CONFIG } from "~/context/network-context";
import { signTransaction, waitForSignature } from "~/lib/xaman-auth";

export default component$(() => {
  const wallet = useWalletContext();
  const { activeNetwork } = useNetworkContext();
  const networkConfig = NETWORK_CONFIG[activeNetwork.value];

  // Active sub-tab
  const activeAction = useSignal<"commit" | "claim" | "create-claim-id">(
    "commit",
  );

  // XChainCommit form
  const commitBridge = useSignal("");
  const commitAmount = useSignal("");
  const commitClaimId = useSignal("");
  const commitDestination = useSignal("");

  // XChainClaim form
  const claimBridge = useSignal("");
  const claimClaimId = useSignal("");
  const claimAmount = useSignal("");
  const claimDestination = useSignal("");

  // XChainCreateClaimID form
  const createClaimBridge = useSignal("");
  const createClaimOtherChainSource = useSignal("");

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

  const handleCommit = $(async () => {
    if (!commitAmount.value) {
      signingStatus.value = "error";
      signingMessage.value = "Please enter an amount to commit";
      return;
    }

    const amountDrops = String(
      Math.floor(parseFloat(commitAmount.value) * 1_000_000),
    );

    const tx: Record<string, unknown> = {
      TransactionType: "XChainCommit",
      Amount: amountDrops,
    };

    if (commitBridge.value.trim()) {
      tx.XChainBridge = commitBridge.value.trim();
    }

    if (commitClaimId.value.trim()) {
      tx.XChainClaimID = commitClaimId.value.trim();
    }

    if (commitDestination.value.trim()) {
      tx.OtherChainDestination = commitDestination.value.trim();
    }

    await signTx(tx);
  });

  const handleClaim = $(async () => {
    if (!claimClaimId.value || !claimAmount.value || !claimDestination.value) {
      signingStatus.value = "error";
      signingMessage.value =
        "Please fill in the Claim ID, amount, and destination";
      return;
    }

    const amountDrops = String(
      Math.floor(parseFloat(claimAmount.value) * 1_000_000),
    );

    const tx: Record<string, unknown> = {
      TransactionType: "XChainClaim",
      XChainClaimID: claimClaimId.value.trim(),
      Amount: amountDrops,
      Destination: claimDestination.value.trim(),
    };

    if (claimBridge.value.trim()) {
      tx.XChainBridge = claimBridge.value.trim();
    }

    await signTx(tx);
  });

  const handleCreateClaimId = $(async () => {
    if (!createClaimOtherChainSource.value) {
      signingStatus.value = "error";
      signingMessage.value =
        "Please enter the other chain source account address";
      return;
    }

    const tx: Record<string, unknown> = {
      TransactionType: "XChainCreateClaimID",
      OtherChainSource: createClaimOtherChainSource.value.trim(),
    };

    if (createClaimBridge.value.trim()) {
      tx.XChainBridge = createClaimBridge.value.trim();
    }

    await signTx(tx);
  });

  // Show warning if not on XRPL
  if (activeNetwork.value !== "xrpl") {
    return (
      <div class="text-center py-20 text-gray-400">
        <div class="text-6xl mb-4">🌉</div>
        <p class="text-lg">Cross-Chain Bridge is only available on XRPL Mainnet</p>
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
        <h2 class="text-xl font-bold text-gray-900">Cross-Chain Bridge</h2>
        <p class="text-sm text-gray-500">
          Bridge assets between XRPL chains using XChain transactions on{" "}
          <span style={{ color: networkConfig.color }}>
            {networkConfig.shortLabel}
          </span>
        </p>
      </div>

      {!wallet.connected.value ? (
        <div class="text-center py-20 text-gray-400">
          <div class="text-6xl mb-4">🔒</div>
          <p class="text-lg">Connect your wallet to use cross-chain bridge</p>
        </div>
      ) : (
        <div class="space-y-6">
          {/* Action Tabs */}
          <div class="flex gap-2">
            {(
              [
                { id: "commit", label: "📤 Commit" },
                { id: "claim", label: "📥 Claim" },
                { id: "create-claim-id", label: "🔑 Create Claim ID" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                class={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition ${
                  activeAction.value === tab.id
                    ? "bg-blue-600 text-white shadow"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                onClick$={() => (activeAction.value = tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── XChainCommit ── */}
          {activeAction.value === "commit" && (
            <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 class="text-lg font-bold text-gray-900 mb-2">
                Commit Assets to Bridge
              </h3>
              <p class="text-sm text-gray-500 mb-6">
                Lock {networkConfig.nativeCurrency} on this chain so it can be
                claimed on the destination chain. You'll need a Claim ID from the
                destination chain, or specify a destination address for account
                creation commits.
              </p>

              <div class="space-y-4">
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
                    value={commitAmount.value}
                    onInput$={(e) =>
                      (commitAmount.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    XChain Claim ID (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Claim ID from the destination chain"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={commitClaimId.value}
                    onInput$={(e) =>
                      (commitClaimId.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    Required for standard cross-chain transfers. Not needed for
                    account creation commits.
                  </p>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Other Chain Destination (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="rDestination on the other chain..."
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={commitDestination.value}
                    onInput$={(e) =>
                      (commitDestination.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    The destination account on the other chain. Used for account
                    creation commits.
                  </p>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Bridge Spec (optional, JSON or ledger object ID)
                  </label>
                  <input
                    type="text"
                    placeholder="Bridge specification..."
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={commitBridge.value}
                    onInput$={(e) =>
                      (commitBridge.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                </div>

                <button
                  class="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg text-sm disabled:opacity-50"
                  disabled={!commitAmount.value}
                  onClick$={handleCommit}
                >
                  📤 Commit to Bridge via Xaman
                </button>
              </div>
            </div>
          )}

          {/* ── XChainClaim ── */}
          {activeAction.value === "claim" && (
            <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 class="text-lg font-bold text-gray-900 mb-2">
                Claim Bridged Assets
              </h3>
              <p class="text-sm text-gray-500 mb-6">
                Claim assets that were committed on the other chain. You need the
                Claim ID that was created on this chain and the amount that was
                committed.
              </p>

              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    XChain Claim ID *
                  </label>
                  <input
                    type="text"
                    placeholder="Claim ID"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={claimClaimId.value}
                    onInput$={(e) =>
                      (claimClaimId.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Amount ({networkConfig.nativeCurrency}) *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    placeholder="0.00"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={claimAmount.value}
                    onInput$={(e) =>
                      (claimAmount.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Destination Address *
                  </label>
                  <input
                    type="text"
                    placeholder="rDestination..."
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={claimDestination.value}
                    onInput$={(e) =>
                      (claimDestination.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    The account on this chain that should receive the claimed
                    funds.
                  </p>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Bridge Spec (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Bridge specification..."
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={claimBridge.value}
                    onInput$={(e) =>
                      (claimBridge.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                </div>

                <button
                  class="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition shadow-lg text-sm disabled:opacity-50"
                  disabled={
                    !claimClaimId.value ||
                    !claimAmount.value ||
                    !claimDestination.value
                  }
                  onClick$={handleClaim}
                >
                  📥 Claim Assets via Xaman
                </button>
              </div>
            </div>
          )}

          {/* ── XChainCreateClaimID ── */}
          {activeAction.value === "create-claim-id" && (
            <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 class="text-lg font-bold text-gray-900 mb-2">
                Create a Cross-Chain Claim ID
              </h3>
              <p class="text-sm text-gray-500 mb-6">
                Create a new Claim ID on this chain, which is then referenced
                by an XChainCommit on the other chain. This reserves a spot for
                an incoming cross-chain transfer.
              </p>

              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Other Chain Source Address *
                  </label>
                  <input
                    type="text"
                    placeholder="rSource on the other chain..."
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    value={createClaimOtherChainSource.value}
                    onInput$={(e) =>
                      (createClaimOtherChainSource.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    The account on the other chain that will make the
                    XChainCommit referencing this Claim ID.
                  </p>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Bridge Spec (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Bridge specification..."
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    value={createClaimBridge.value}
                    onInput$={(e) =>
                      (createClaimBridge.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                </div>

                <button
                  class="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition shadow-lg text-sm disabled:opacity-50"
                  disabled={!createClaimOtherChainSource.value}
                  onClick$={handleCreateClaimId}
                >
                  🔑 Create Claim ID via Xaman
                </button>
              </div>
            </div>
          )}

          {/* Info */}
          <div class="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
            <strong>💡 How Cross-Chain Bridging Works:</strong>
            <ol class="list-decimal ml-5 mt-2 space-y-1">
              <li>
                <strong>Create Claim ID</strong> on the destination chain to
                reserve a slot.
              </li>
              <li>
                <strong>Commit</strong> assets on the source chain, referencing
                the Claim ID.
              </li>
              <li>
                Bridge witnesses verify the commit and submit attestations on
                the destination chain.
              </li>
              <li>
                <strong>Claim</strong> the assets on the destination chain once
                enough attestations have been submitted.
              </li>
            </ol>
            <p class="mt-2">
              For account creation bridges, you can skip the Claim ID step and
              use <code class="bg-blue-100 px-1 py-0.5 rounded text-xs">XChainAccountCreateCommit</code>{" "}
              instead.
            </p>
          </div>

          {/* Additional XChain tx types */}
          <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="text-sm font-bold text-gray-700 mb-3">
              Other Bridge Transaction Types
            </h3>
            <p class="text-xs text-gray-500 mb-4">
              These advanced operations are available via the Dashboard
              transaction signer. Select the appropriate category and type.
            </p>
            <div class="flex flex-wrap gap-2">
              {[
                "XChainCreateBridge",
                "XChainModifyBridge",
                "XChainAccountCreateCommit",
                "XChainAddAccountCreateAttestation",
                "XChainAddClaimAttestation",
              ].map((txType) => (
                <span
                  key={txType}
                  class="px-3 py-1.5 text-xs font-mono font-medium bg-gray-100 text-gray-600 rounded-full"
                >
                  {txType}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

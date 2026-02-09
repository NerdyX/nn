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

  // Active sub-tab
  const activeAction = useSignal<"did-set" | "did-delete" | "credential">(
    "did-set",
  );

  // DIDSet form
  const didUri = useSignal("");
  const didData = useSignal("");
  const didDocument = useSignal("");

  // CredentialCreate form
  const credSubject = useSignal("");
  const credType = useSignal("");
  const credExpiration = useSignal("");
  const credUri = useSignal("");

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

  const handleDIDSet = $(async () => {
    const tx: Record<string, unknown> = {
      TransactionType: "DIDSet",
    };

    if (didUri.value.trim()) {
      tx.URI = toHex(didUri.value.trim());
    }

    if (didData.value.trim()) {
      tx.Data = toHex(didData.value.trim());
    }

    if (didDocument.value.trim()) {
      tx.DIDDocument = toHex(didDocument.value.trim());
    }

    if (
      !didUri.value.trim() &&
      !didData.value.trim() &&
      !didDocument.value.trim()
    ) {
      signingStatus.value = "error";
      signingMessage.value =
        "Please provide at least one of: URI, Data, or DID Document";
      return;
    }

    const result = await signTx(tx);

    if (result) {
      didUri.value = "";
      didData.value = "";
      didDocument.value = "";
    }
  });

  const handleDIDDelete = $(async () => {
    await signTx({
      TransactionType: "DIDDelete",
    });
  });

  const handleCreateCredential = $(async () => {
    if (!credSubject.value || !credType.value) {
      signingStatus.value = "error";
      signingMessage.value =
        "Please enter a subject address and credential type";
      return;
    }

    const tx: Record<string, unknown> = {
      TransactionType: "CredentialCreate",
      Subject: credSubject.value.trim(),
      CredentialType: toHex(credType.value.trim()),
    };

    if (credExpiration.value) {
      const ms = new Date(credExpiration.value).getTime();
      if (!isNaN(ms)) {
        // Ripple epoch = Unix epoch - 946684800
        tx.Expiration = Math.floor(ms / 1000) - 946684800;
      }
    }

    if (credUri.value.trim()) {
      tx.URI = toHex(credUri.value.trim());
    }

    const result = await signTx(tx);

    if (result) {
      credSubject.value = "";
      credType.value = "";
      credExpiration.value = "";
      credUri.value = "";
    }
  });

  // Show warning if not on XRPL
  if (activeNetwork.value !== "xrpl") {
    return (
      <div class="text-center py-20 text-gray-400">
        <div class="text-6xl mb-4">🆔</div>
        <p class="text-lg">
          DID / Identity features are only available on XRPL Mainnet
        </p>
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
        <h2 class="text-xl font-bold text-gray-900">DID / Identity</h2>
        <p class="text-sm text-gray-500">
          Manage Decentralized Identifiers and Verifiable Credentials on{" "}
          <span style={{ color: networkConfig.color }}>
            {networkConfig.shortLabel}
          </span>
        </p>
      </div>

      {!wallet.connected.value ? (
        <div class="text-center py-20 text-gray-400">
          <div class="text-6xl mb-4">🔒</div>
          <p class="text-lg">Connect your wallet to manage your DID</p>
        </div>
      ) : (
        <div class="space-y-6">
          {/* Action Tabs */}
          <div class="flex gap-2">
            {(
              [
                { id: "did-set", label: "🆔 Set DID" },
                { id: "did-delete", label: "🗑️ Delete DID" },
                { id: "credential", label: "📜 Credentials" },
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

          {/* ── DIDSet ── */}
          {activeAction.value === "did-set" && (
            <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 class="text-lg font-bold text-gray-900 mb-2">
                Set Your Decentralized Identifier
              </h3>
              <p class="text-sm text-gray-500 mb-6">
                Create or update a DID document associated with your XRPL
                account. All fields are stored on-ledger as hex-encoded strings.
                At least one field must be provided.
              </p>

              <div class="space-y-4">
                {/* URI */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    URI
                  </label>
                  <input
                    type="text"
                    placeholder="https://example.com/did-document.json"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={didUri.value}
                    onInput$={(e) =>
                      (didUri.value = (e.target as HTMLInputElement).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    A URI that points to a DID document or related resource.
                    Stored as hex on the ledger.
                  </p>
                </div>

                {/* Data */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Data
                  </label>
                  <textarea
                    placeholder="Arbitrary identity data..."
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-24"
                    value={didData.value}
                    onInput$={(e) =>
                      (didData.value = (e.target as HTMLTextAreaElement).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    Custom identity data. Max 256 bytes when hex-encoded.
                  </p>
                </div>

                {/* DID Document */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    DID Document (JSON)
                  </label>
                  <textarea
                    placeholder='{"@context": "https://www.w3.org/ns/did/v1", ...}'
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-32"
                    value={didDocument.value}
                    onInput$={(e) =>
                      (didDocument.value = (
                        e.target as HTMLTextAreaElement
                      ).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    A W3C DID Document in JSON format. Stored as hex on the
                    ledger. Max 256 bytes when hex-encoded.
                  </p>
                </div>

                {/* Preview */}
                {(didUri.value || didData.value || didDocument.value) && (
                  <div class="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div class="text-xs text-gray-500 font-medium mb-2">
                      Hex Preview
                    </div>
                    {didUri.value && (
                      <div class="mb-2">
                        <span class="text-xs font-semibold text-gray-700">
                          URI:{" "}
                        </span>
                        <span class="text-xs font-mono text-gray-500 break-all">
                          {toHex(didUri.value).slice(0, 60)}...
                        </span>
                      </div>
                    )}
                    {didData.value && (
                      <div class="mb-2">
                        <span class="text-xs font-semibold text-gray-700">
                          Data:{" "}
                        </span>
                        <span class="text-xs font-mono text-gray-500 break-all">
                          {toHex(didData.value).slice(0, 60)}...
                        </span>
                      </div>
                    )}
                    {didDocument.value && (
                      <div>
                        <span class="text-xs font-semibold text-gray-700">
                          Document:{" "}
                        </span>
                        <span class="text-xs font-mono text-gray-500 break-all">
                          {toHex(didDocument.value).slice(0, 60)}...
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  class="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg text-sm disabled:opacity-50"
                  disabled={
                    !didUri.value.trim() &&
                    !didData.value.trim() &&
                    !didDocument.value.trim()
                  }
                  onClick$={handleDIDSet}
                >
                  🆔 Set DID via Xaman
                </button>
              </div>
            </div>
          )}

          {/* ── DIDDelete ── */}
          {activeAction.value === "did-delete" && (
            <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 class="text-lg font-bold text-gray-900 mb-2">
                Delete Your DID
              </h3>
              <p class="text-sm text-gray-500 mb-6">
                Permanently remove the DID object from your XRPL account. This
                will delete all associated identity data from the ledger and
                free up the owner reserve.
              </p>

              <div class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 mb-6">
                <strong>⚠️ Warning:</strong> This action is irreversible. Your
                DID document, URI, and data will be permanently deleted from the
                ledger. You can always create a new DID later, but any
                references to the old DID will be broken.
              </div>

              <button
                class="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg text-sm"
                onClick$={handleDIDDelete}
              >
                🗑️ Delete DID via Xaman
              </button>
            </div>
          )}

          {/* ── Credentials ── */}
          {activeAction.value === "credential" && (
            <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 class="text-lg font-bold text-gray-900 mb-2">
                Create a Verifiable Credential
              </h3>
              <p class="text-sm text-gray-500 mb-6">
                Issue a credential to another XRPL account. The subject must
                accept the credential before it becomes active. Credentials can
                be used for KYC, accreditation, membership, and more.
              </p>

              <div class="space-y-4">
                {/* Subject */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Subject Address *
                  </label>
                  <input
                    type="text"
                    placeholder="rSubject..."
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    value={credSubject.value}
                    onInput$={(e) =>
                      (credSubject.value = (e.target as HTMLInputElement).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    The XRPL account that this credential is issued to.
                  </p>
                </div>

                {/* Credential Type */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Credential Type *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., KYC, Accredited, Member"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    value={credType.value}
                    onInput$={(e) =>
                      (credType.value = (e.target as HTMLInputElement).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    A string identifying the type of credential. Stored as hex
                    on the ledger.
                  </p>
                </div>

                {/* Expiration */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Expiration (optional)
                  </label>
                  <input
                    type="datetime-local"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    value={credExpiration.value}
                    onInput$={(e) =>
                      (credExpiration.value = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    When this credential expires. After this time, the
                    credential is no longer valid.
                  </p>
                </div>

                {/* URI */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    URI (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="https://example.com/credential-details"
                    class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    value={credUri.value}
                    onInput$={(e) =>
                      (credUri.value = (e.target as HTMLInputElement).value)
                    }
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    A URI pointing to additional credential details off-ledger.
                  </p>
                </div>

                <button
                  class="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition shadow-lg text-sm disabled:opacity-50"
                  disabled={!credSubject.value || !credType.value}
                  onClick$={handleCreateCredential}
                >
                  📜 Create Credential via Xaman
                </button>
              </div>
            </div>
          )}

          {/* Info */}
          <div class="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
            <strong>💡 About DIDs on XRPL:</strong>
            <ul class="list-disc ml-5 mt-2 space-y-1">
              <li>
                <strong>DIDSet</strong> creates or updates a Decentralized
                Identifier associated with your account. It supports a URI, raw
                Data field, and a full DID Document.
              </li>
              <li>
                <strong>Credentials</strong> allow issuers to attest facts about
                other accounts (KYC status, membership, etc.). The subject must
                accept the credential with a{" "}
                <code class="bg-blue-100 px-1 py-0.5 rounded text-xs">
                  CredentialAccept
                </code>{" "}
                transaction.
              </li>
              <li>
                All string fields are stored as hex on the ledger. This page
                handles the hex encoding automatically.
              </li>
            </ul>
          </div>

          {/* Related transaction types */}
          <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="text-sm font-bold text-gray-700 mb-3">
              Related Transaction Types
            </h3>
            <div class="flex flex-wrap gap-2">
              {[
                "DIDSet",
                "DIDDelete",
                "CredentialCreate",
                "CredentialAccept",
                "CredentialDelete",
              ].map((txType) => (
                <span
                  key={txType}
                  class="px-3 py-1.5 text-xs font-mono font-medium bg-gray-100 text-gray-600 rounded-full"
                >
                  {txType}
                </span>
              ))}
            </div>
            <p class="text-xs text-gray-500 mt-3">
              Use the main Dashboard transaction signer to sign any of these
              transaction types with custom parameters.
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

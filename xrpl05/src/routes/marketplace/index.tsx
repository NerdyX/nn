import {
  component$,
  useSignal,
  useVisibleTask$,
  useTask$,
  $,
  useComputed$,
} from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { useWalletContext, truncateAddress } from "~/context/wallet-context";
import { useNetworkContext, NETWORK_CONFIG } from "~/context/network-context";
import { signTransaction, waitForSignature } from "~/lib/xaman-auth";

// ─── SSR pre-cache loader — returns cached NFTs from D1 if available ─────────

export const useCachedNfts = routeLoader$(async (requestEvent) => {
  try {
    const { loadNfts, getD1 } = await import("~/lib/marketplace-data");
    const db = getD1(requestEvent.platform as Record<string, any> | undefined);
    const network = (requestEvent.query.get("network") || "xrpl").toLowerCase();
    const data = await loadNfts(network, 60, db);
    return {
      success: data.success,
      nfts: (data as any).nfts || ([] as NftItem[]),
      network,
      timestamp: (data as any).timestamp || new Date().toISOString(),
      fromCache: true,
    };
  } catch (err) {
    console.warn("[marketplace] pre-cache loader failed:", err);
    return {
      success: false,
      nfts: [] as NftItem[],
      network: "xrpl",
      timestamp: new Date().toISOString(),
      fromCache: false,
    };
  }
});

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface SellOffer {
  index: string;
  amount: string | { value: string; currency: string; issuer: string };
  owner: string;
  destination?: string;
  expiration?: number;
}

interface BuyOffer {
  index: string;
  amount: string | { value: string; currency: string; issuer: string };
  owner: string;
  expiration?: number;
}

interface NftItem {
  nftokenId: string;
  issuer: string;
  owner: string;
  taxon: number;
  serial: number;
  uri: string;
  resolvedUri: string;
  image: string;
  name: string;
  description: string;
  collection: string;
  flags: number;
  transferFee: number;
  nftStandard?: "XLS-20" | "XLS-14" | string;
  sellOffers: SellOffer[];
  buyOffers: BuyOffer[];
}

interface MarketplaceData {
  success: boolean;
  network: string;
  address: string;
  balance: string;
  totalNfts: number;
  listedCount: number;
  totalSellOffers: number;
  totalBuyOffers: number;
  nfts: NftItem[];
  queriedAt: string;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function formatAmount(
  amount: string | { value: string; currency: string; issuer: string },
  nativeCurrency: string,
): string {
  if (typeof amount === "string") {
    const xrp = Number(amount) / 1_000_000;
    return `${xrp.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${nativeCurrency}`;
  }
  return `${amount.value} ${amount.currency}`;
}

function getLowestSellPrice(
  offers: SellOffer[],
  nativeCurrency: string,
): string | null {
  if (!offers.length) return null;
  let lowest = Infinity;
  let lowestFormatted = "";
  for (const o of offers) {
    const val =
      typeof o.amount === "string"
        ? Number(o.amount) / 1_000_000
        : Number(o.amount.value);
    if (val < lowest) {
      lowest = val;
      lowestFormatted = formatAmount(o.amount, nativeCurrency);
    }
  }
  return lowestFormatted;
}

function getHighestBuyPrice(
  offers: BuyOffer[],
  nativeCurrency: string,
): string | null {
  if (!offers.length) return null;
  let highest = -Infinity;
  let highestFormatted = "";
  for (const o of offers) {
    const val =
      typeof o.amount === "string"
        ? Number(o.amount) / 1_000_000
        : Number(o.amount.value);
    if (val > highest) {
      highest = val;
      highestFormatted = formatAmount(o.amount, nativeCurrency);
    }
  }
  return highestFormatted;
}

const PLACEHOLDER_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' fill='%23e5e7eb'%3E%3Crect width='400' height='400'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='48' fill='%239ca3af'%3ENFT%3C/text%3E%3C/svg%3E";

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default component$(() => {
  const wallet = useWalletContext();
  const { activeNetwork } = useNetworkContext();
  const networkConfig = useComputed$(() => NETWORK_CONFIG[activeNetwork.value]);
  const cachedNfts = useCachedNfts();

  // Data state
  const nfts = useSignal<NftItem[]>([]);
  const loading = useSignal(false);
  const errorMsg = useSignal("");
  const marketData = useSignal<MarketplaceData | null>(null);

  // Browse-mode: shows pre-cached ledger NFTs before any address is entered
  const browseNfts = useSignal<NftItem[]>([]);
  const browseLoaded = useSignal(false);

  // Search / filter state
  const searchQuery = useSignal("");
  const selectedCollection = useSignal<string | null>(null);
  const currentPage = useSignal(1);
  const pageSize = 12;

  // Tabs
  const activeTab = useSignal<"explore" | "my-nfts" | "mint">("explore");

  // Modal state
  const selectedNft = useSignal<NftItem | null>(null);
  const showOfferModal = useSignal(false);
  const offerAmount = useSignal("");

  // Signing state
  const signingStatus = useSignal<"idle" | "signing" | "success" | "error">(
    "idle",
  );
  const signingMessage = useSignal("");
  const signingQr = useSignal("");

  // Explore address (for browsing other accounts' NFTs)
  const exploreAddress = useSignal("");

  // Mint form
  const mintUri = useSignal("");
  const mintTaxon = useSignal("0");
  const mintTransferFee = useSignal("0");
  const mintFlags = useSignal(8); // tfTransferable

  // ── Hydrate browse NFTs from SSR cache ──
  useTask$(({ track }) => {
    const cached = track(() => cachedNfts.value);
    if (cached.success && cached.nfts.length > 0 && !browseLoaded.value) {
      browseNfts.value = cached.nfts as NftItem[];
      browseLoaded.value = true;
    }
  });

  // ── Fetch NFTs ──
  const fetchNfts = $(async (address: string) => {
    if (!address) return;
    loading.value = true;
    errorMsg.value = "";

    try {
      const res = await fetch(
        `/api/marketplace?network=${activeNetwork.value}&address=${address}&limit=100`,
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          (errData as any).message || `Failed to fetch NFTs (${res.status})`,
        );
      }

      const data: MarketplaceData = await res.json();
      marketData.value = data;
      nfts.value = data.nfts;
      currentPage.value = 1;
    } catch (err: any) {
      errorMsg.value = err.message || "Failed to fetch NFT data";
      nfts.value = [];
      marketData.value = null;
    } finally {
      loading.value = false;
    }
  });

  // Auto-fetch when wallet is connected and tab is "my-nfts"
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const connected = track(() => wallet.connected.value);
    const addr = track(() => wallet.address.value);
    const tab = track(() => activeTab.value);
    track(() => activeNetwork.value);

    if (connected && addr && tab === "my-nfts") {
      fetchNfts(addr);
    }
  });

  // ── Sign transaction through the connected wallet ──
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
      // For Xaman wallet, use the API-based signing
      if (wallet.walletType.value === "xaman" || !wallet.walletType.value) {
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
      } else if (wallet.walletType.value === "crossmark") {
        const { signWithCrossmark } = await import(
          "~/components/wallets/crossmark"
        );
        const result = await signWithCrossmark(txjson);
        if (result.signed) {
          signingStatus.value = "success";
          signingMessage.value = `✅ Transaction signed via Crossmark! Hash: ${result.hash ?? "N/A"}`;
          return result;
        }
      } else if (wallet.walletType.value === "gem") {
        const { signWithGemWallet } = await import("~/components/wallets/gem");
        const result = await signWithGemWallet(txjson);
        if (result.signed) {
          signingStatus.value = "success";
          signingMessage.value = `✅ Transaction signed via GemWallet! Hash: ${result.hash ?? "N/A"}`;
          return result;
        }
      }

      return null;
    } catch (err: any) {
      signingStatus.value = "error";
      signingMessage.value = err.message || "Transaction signing failed";
      signingQr.value = "";
      return null;
    }
  });

  // ── Buy NFT (accept sell offer) ──
  const handleBuy = $(async (nft: NftItem, offer: SellOffer) => {
    const result = await signTx({
      TransactionType: "NFTokenAcceptOffer",
      NFTokenSellOffer: offer.index,
    });
    if (result) {
      // Refresh NFTs after successful buy
      if (wallet.address.value) {
        setTimeout(() => fetchNfts(wallet.address.value), 3000);
      }
    }
  });

  // ── Make Offer (create buy offer) ──
  const handleMakeOffer = $(async (nft: NftItem, amountXrp: string) => {
    if (!amountXrp || parseFloat(amountXrp) <= 0) {
      signingStatus.value = "error";
      signingMessage.value = "Please enter a valid offer amount";
      return;
    }

    const amountDrops = String(Math.floor(parseFloat(amountXrp) * 1_000_000));
    const result = await signTx({
      TransactionType: "NFTokenCreateOffer",
      NFTokenID: nft.nftokenId,
      Amount: amountDrops,
      Owner: nft.owner,
      Flags: 0, // Buy offer
    });

    if (result) {
      showOfferModal.value = false;
      offerAmount.value = "";
    }
  });

  // ── Mint NFT ──
  const handleMint = $(async () => {
    if (!mintUri.value) {
      signingStatus.value = "error";
      signingMessage.value = "Please provide a URI for the NFT";
      return;
    }

    // Convert URI to hex
    const uriHex = Array.from(new TextEncoder().encode(mintUri.value))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

    const tx: Record<string, unknown> = {
      TransactionType: "NFTokenMint",
      URI: uriHex,
      NFTokenTaxon: parseInt(mintTaxon.value) || 0,
      Flags: mintFlags.value,
    };

    const transferFee = parseInt(mintTransferFee.value);
    if (transferFee > 0 && transferFee <= 50000) {
      tx.TransferFee = transferFee;
    }

    const result = await signTx(tx);
    if (result) {
      mintUri.value = "";
      mintTaxon.value = "0";
      mintTransferFee.value = "0";
      // Refresh NFTs
      if (wallet.address.value) {
        setTimeout(() => fetchNfts(wallet.address.value), 3000);
      }
    }
  });

  // ── Create Sell Offer ──
  const handleCreateSellOffer = $(async (nft: NftItem, amountXrp: string) => {
    if (!amountXrp || parseFloat(amountXrp) <= 0) {
      signingStatus.value = "error";
      signingMessage.value = "Please enter a valid sale amount";
      return;
    }

    const amountDrops = String(Math.floor(parseFloat(amountXrp) * 1_000_000));

    await signTx({
      TransactionType: "NFTokenCreateOffer",
      NFTokenID: nft.nftokenId,
      Amount: amountDrops,
      Flags: 1, // tfSellNFToken
    });
  });

  // ── Explore NFTs ──
  const handleExplore = $(() => {
    if (exploreAddress.value.trim()) {
      fetchNfts(exploreAddress.value.trim());
    }
  });

  // Filtered NFTs
  const filtered = useComputed$(() => {
    return nfts.value.filter((nft) => {
      const q = searchQuery.value.toLowerCase();
      const matchesSearch =
        !q ||
        nft.name.toLowerCase().includes(q) ||
        nft.collection.toLowerCase().includes(q) ||
        nft.nftokenId.toLowerCase().includes(q) ||
        nft.issuer.toLowerCase().includes(q);

      const matchesCollection =
        !selectedCollection.value ||
        nft.collection === selectedCollection.value;

      return matchesSearch && matchesCollection;
    });
  });

  // Paginated NFTs
  const paginated = useComputed$(() => {
    const start = (currentPage.value - 1) * pageSize;
    return filtered.value.slice(start, start + pageSize);
  });

  // Unique collections
  const collections = useComputed$(() => {
    const cols = new Set<string>();
    nfts.value.forEach((n) => {
      if (n.collection) cols.add(n.collection);
    });
    return Array.from(cols).sort();
  });

  const totalPages = useComputed$(() =>
    Math.max(1, Math.ceil(filtered.value.length / pageSize)),
  );

  const nativeCurrency = useComputed$(
    () => NETWORK_CONFIG[activeNetwork.value].nativeCurrency,
  );

  return (
    <div class="min-h-screen bg-white text-gray-900 mt-20 pb-20">
      {/* Signing Status Overlay */}
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
              <h3
                class={`font-bold text-lg mb-2 ${
                  signingStatus.value === "success"
                    ? "text-green-700"
                    : signingStatus.value === "error"
                      ? "text-red-700"
                      : "text-blue-700"
                }`}
              >
                {signingStatus.value === "signing" && "Awaiting Signature..."}
                {signingStatus.value === "success" && "Transaction Signed!"}
                {signingStatus.value === "error" && "Transaction Failed"}
              </h3>
              <p class="text-sm text-gray-600 break-all">
                {signingMessage.value}
              </p>
              {signingStatus.value !== "signing" && (
                <button
                  class="mt-4 px-6 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition"
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
        </div>
      )}

      {/* NFT Detail Modal */}
      {selectedNft.value && (
        <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div class="max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-gray-200 shadow-2xl">
            <div class="relative">
              <button
                class="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 text-gray-700 hover:bg-white transition shadow"
                onClick$={() => {
                  selectedNft.value = null;
                  showOfferModal.value = false;
                  offerAmount.value = "";
                }}
              >
                ✕
              </button>
              <img
                src={selectedNft.value.image || PLACEHOLDER_IMG}
                alt={selectedNft.value.name}
                width={600}
                height={600}
                class="w-full aspect-square object-cover"
                onError$={(e: any) => {
                  e.target.src = PLACEHOLDER_IMG;
                }}
              />
            </div>
            <div class="p-6">
              <h2 class="text-2xl font-bold text-gray-900">
                {selectedNft.value.name}
              </h2>
              {selectedNft.value.collection && (
                <p class="text-sm text-blue-600 font-medium mt-1">
                  {selectedNft.value.collection}
                </p>
              )}
              {selectedNft.value.description && (
                <p class="text-sm text-gray-600 mt-2">
                  {selectedNft.value.description}
                </p>
              )}

              <div class="grid grid-cols-2 gap-3 mt-4">
                <div class="bg-gray-50 rounded-xl p-3">
                  <div class="text-xs text-gray-500">Owner</div>
                  <div class="text-sm font-mono font-medium truncate">
                    {truncateAddress(selectedNft.value.owner)}
                  </div>
                </div>
                <div class="bg-gray-50 rounded-xl p-3">
                  <div class="text-xs text-gray-500">Issuer</div>
                  <div class="text-sm font-mono font-medium truncate">
                    {truncateAddress(selectedNft.value.issuer)}
                  </div>
                </div>
                <div class="bg-gray-50 rounded-xl p-3">
                  <div class="text-xs text-gray-500">Transfer Fee</div>
                  <div class="text-sm font-medium">
                    {selectedNft.value.transferFee}%
                  </div>
                </div>
                <div class="bg-gray-50 rounded-xl p-3">
                  <div class="text-xs text-gray-500">Taxon</div>
                  <div class="text-sm font-medium">
                    {selectedNft.value.taxon}
                  </div>
                </div>
              </div>

              <div class="mt-3 bg-gray-50 rounded-xl p-3">
                <div class="text-xs text-gray-500 mb-1">NFToken ID</div>
                <div class="text-xs font-mono break-all text-gray-700">
                  {selectedNft.value.nftokenId}
                </div>
              </div>

              {/* Sell Offers */}
              {selectedNft.value.sellOffers.length > 0 && (
                <div class="mt-4">
                  <h3 class="text-sm font-bold text-gray-700 mb-2">
                    Sell Offers ({selectedNft.value.sellOffers.length})
                  </h3>
                  <div class="space-y-2 max-h-40 overflow-y-auto">
                    {selectedNft.value.sellOffers.map((offer) => (
                      <div
                        key={offer.index}
                        class="flex items-center justify-between bg-green-50 rounded-lg p-3"
                      >
                        <div>
                          <div class="text-sm font-semibold text-green-700">
                            {formatAmount(offer.amount, nativeCurrency.value)}
                          </div>
                          <div class="text-xs text-gray-500">
                            by {truncateAddress(offer.owner)}
                          </div>
                        </div>
                        {wallet.connected.value &&
                          offer.owner !== wallet.address.value && (
                            <button
                              class="px-4 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition"
                              onClick$={() =>
                                handleBuy(selectedNft.value!, offer)
                              }
                            >
                              Buy Now
                            </button>
                          )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Buy Offers */}
              {selectedNft.value.buyOffers.length > 0 && (
                <div class="mt-4">
                  <h3 class="text-sm font-bold text-gray-700 mb-2">
                    Buy Offers ({selectedNft.value.buyOffers.length})
                  </h3>
                  <div class="space-y-2 max-h-40 overflow-y-auto">
                    {selectedNft.value.buyOffers.map((offer) => (
                      <div
                        key={offer.index}
                        class="flex items-center justify-between bg-blue-50 rounded-lg p-3"
                      >
                        <div>
                          <div class="text-sm font-semibold text-blue-700">
                            {formatAmount(offer.amount, nativeCurrency.value)}
                          </div>
                          <div class="text-xs text-gray-500">
                            by {truncateAddress(offer.owner)}
                          </div>
                        </div>
                        {/* Owner can accept buy offers */}
                        {wallet.connected.value &&
                          selectedNft.value?.owner === wallet.address.value && (
                            <button
                              class="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
                              onClick$={() =>
                                signTx({
                                  TransactionType: "NFTokenAcceptOffer",
                                  NFTokenBuyOffer: offer.index,
                                })
                              }
                            >
                              Accept Offer
                            </button>
                          )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div class="flex gap-3 mt-6">
                {/* Buy cheapest sell offer */}
                {selectedNft.value.sellOffers.length > 0 &&
                  wallet.connected.value &&
                  selectedNft.value.owner !== wallet.address.value && (
                    <button
                      class="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition shadow-lg"
                      onClick$={() => {
                        const cheapest = selectedNft.value!.sellOffers.reduce(
                          (min, o) => {
                            const val =
                              typeof o.amount === "string"
                                ? Number(o.amount)
                                : Number(o.amount.value);
                            const minVal =
                              typeof min.amount === "string"
                                ? Number(min.amount)
                                : Number(min.amount.value);
                            return val < minVal ? o : min;
                          },
                          selectedNft.value!.sellOffers[0],
                        );
                        handleBuy(selectedNft.value!, cheapest);
                      }}
                    >
                      🛒 Buy for{" "}
                      {getLowestSellPrice(
                        selectedNft.value.sellOffers,
                        nativeCurrency.value,
                      )}
                    </button>
                  )}

                {/* Make offer on someone else's NFT */}
                {wallet.connected.value &&
                  selectedNft.value.owner !== wallet.address.value && (
                    <button
                      class="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg"
                      onClick$={() => (showOfferModal.value = true)}
                    >
                      💰 Make Offer
                    </button>
                  )}

                {/* Owner: Create sell offer */}
                {wallet.connected.value &&
                  selectedNft.value.owner === wallet.address.value && (
                    <button
                      class="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition shadow-lg"
                      onClick$={() => (showOfferModal.value = true)}
                    >
                      📤 List for Sale
                    </button>
                  )}

                {!wallet.connected.value && (
                  <div class="flex-1 py-3 bg-gray-100 text-gray-500 font-bold rounded-xl text-center">
                    Connect wallet to trade
                  </div>
                )}
              </div>

              {/* Make Offer / List for Sale Form */}
              {showOfferModal.value && (
                <div class="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <h3 class="text-sm font-bold text-gray-700 mb-3">
                    {selectedNft.value?.owner === wallet.address.value
                      ? "Set Sale Price"
                      : "Make an Offer"}
                  </h3>
                  <div class="flex gap-2">
                    <input
                      type="number"
                      step="0.000001"
                      min="0"
                      placeholder={`Amount in ${nativeCurrency.value}`}
                      class="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={offerAmount.value}
                      onInput$={(e) =>
                        (offerAmount.value = (
                          e.target as HTMLInputElement
                        ).value)
                      }
                    />
                    <button
                      class="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm disabled:opacity-50"
                      disabled={!offerAmount.value}
                      onClick$={() => {
                        if (selectedNft.value?.owner === wallet.address.value) {
                          handleCreateSellOffer(
                            selectedNft.value!,
                            offerAmount.value,
                          );
                        } else {
                          handleMakeOffer(
                            selectedNft.value!,
                            offerAmount.value,
                          );
                        }
                      }}
                    >
                      {selectedNft.value?.owner === wallet.address.value
                        ? "List"
                        : "Offer"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <section class="max-w-7xl mx-auto px-6 pt-8">
        {/* Tab Bar */}
        <div class="flex gap-1 border-b border-gray-200 mb-8">
          {(
            [
              { id: "explore", label: "Explore NFTs", always: true },
              {
                id: "my-nfts",
                label: "My NFTs",
                always: false,
              },
              { id: "mint", label: "Mint NFT", always: false },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              class={`px-6 py-3 font-semibold text-sm transition-all whitespace-nowrap border-b-2 ${
                activeTab.value === tab.id
                  ? "text-blue-600 border-blue-600"
                  : "text-gray-500 border-transparent hover:text-gray-800"
              } ${!tab.always && !wallet.connected.value ? "opacity-40 cursor-not-allowed" : ""}`}
              onClick$={() => {
                if (!tab.always && !wallet.connected.value) return;
                activeTab.value = tab.id;
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── EXPLORE TAB ── */}
        {activeTab.value === "explore" && (
          <div>
            {/* Search by address */}
            <div class="rounded-2xl bg-gradient-to-br from-blue-50 via-white to-purple-50 border border-gray-200 p-8 mb-8 shadow-sm">
              <h1 class="text-3xl font-bold text-gray-900 mb-2">
                NFT Marketplace
              </h1>
              <p class="text-gray-600 mb-6">
                Browse NFTs on the{" "}
                <span
                  class="font-semibold"
                  style={{ color: networkConfig.value.color }}
                >
                  {networkConfig.value.label}
                </span>
                . Enter any r-address to explore their collection, or browse
                recent ledger NFTs below.
              </p>
              <div class="flex gap-3">
                <input
                  type="text"
                  placeholder="Enter r-address to explore NFTs..."
                  class="flex-1 rounded-xl border border-gray-300 px-5 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                  value={exploreAddress.value}
                  onInput$={(e) =>
                    (exploreAddress.value = (
                      e.target as HTMLInputElement
                    ).value)
                  }
                  onKeyDown$={(e) => {
                    if (e.key === "Enter") handleExplore();
                  }}
                />
                <button
                  class="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
                  disabled={loading.value || !exploreAddress.value.trim()}
                  onClick$={handleExplore}
                >
                  {loading.value ? "Loading..." : "Explore"}
                </button>
              </div>
              {wallet.connected.value && (
                <button
                  class="mt-3 text-sm text-blue-600 hover:underline"
                  onClick$={() => {
                    exploreAddress.value = wallet.address.value;
                    fetchNfts(wallet.address.value);
                  }}
                >
                  Use my address: {truncateAddress(wallet.address.value)}
                </button>
              )}
            </div>

            {/* Error */}
            {errorMsg.value && (
              <div class="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {errorMsg.value}
              </div>
            )}

            {/* Live Stats */}
            {marketData.value && (
              <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <div class="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div class="text-xs text-gray-500 font-medium">
                    Total NFTs
                  </div>
                  <div class="text-2xl font-bold text-gray-900 mt-1">
                    {marketData.value.totalNfts}
                  </div>
                </div>
                <div class="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div class="text-xs text-gray-500 font-medium">Listed</div>
                  <div class="text-2xl font-bold text-green-600 mt-1">
                    {marketData.value.listedCount}
                  </div>
                </div>
                <div class="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div class="text-xs text-gray-500 font-medium">
                    Sell Offers
                  </div>
                  <div class="text-2xl font-bold text-blue-600 mt-1">
                    {marketData.value.totalSellOffers}
                  </div>
                </div>
                <div class="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div class="text-xs text-gray-500 font-medium">
                    Buy Offers
                  </div>
                  <div class="text-2xl font-bold text-purple-600 mt-1">
                    {marketData.value.totalBuyOffers}
                  </div>
                </div>
                <div class="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div class="text-xs text-gray-500 font-medium">Balance</div>
                  <div class="text-2xl font-bold text-gray-900 mt-1">
                    {parseFloat(marketData.value.balance).toFixed(2)}{" "}
                    <span class="text-sm font-normal">
                      {nativeCurrency.value}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Filters */}
            {nfts.value.length > 0 && (
              <div class="flex flex-col sm:flex-row gap-3 mb-6">
                <input
                  type="text"
                  placeholder="Filter by name, collection, ID..."
                  class="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={searchQuery.value}
                  onInput$={(e) =>
                    (searchQuery.value = (e.target as HTMLInputElement).value)
                  }
                />
                {collections.value.length > 0 && (
                  <select
                    class="rounded-lg border border-gray-300 px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={selectedCollection.value || ""}
                    onChange$={(e) =>
                      (selectedCollection.value =
                        (e.target as HTMLSelectElement).value || null)
                    }
                  >
                    <option value="">All Collections</option>
                    {collections.value.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
                {(searchQuery.value || selectedCollection.value) && (
                  <button
                    class="px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
                    onClick$={() => {
                      searchQuery.value = "";
                      selectedCollection.value = null;
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            {/* Loading */}
            {loading.value && (
              <div class="flex items-center justify-center py-20">
                <div class="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
                <span class="ml-4 text-gray-500">
                  Fetching NFTs from the ledger...
                </span>
              </div>
            )}

            {/* Pre-cached browse NFTs (show when no address searched yet) */}
            {!loading.value &&
              nfts.value.length === 0 &&
              browseNfts.value.length > 0 &&
              !errorMsg.value && (
                <div>
                  <h2 class="text-lg font-bold text-gray-900 mb-4">
                    Recent NFTs on the Ledger
                  </h2>
                  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                    {browseNfts.value.slice(0, 24).map((nft) => (
                      <div
                        key={nft.nftokenId}
                        class="group rounded-2xl overflow-hidden bg-white border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1"
                        onClick$={() => (selectedNft.value = nft)}
                      >
                        <div class="relative aspect-square overflow-hidden bg-gray-100">
                          <img
                            src={nft.image || PLACEHOLDER_IMG}
                            alt={nft.name}
                            width={400}
                            height={400}
                            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                            onError$={(e: any) => {
                              e.target.src = PLACEHOLDER_IMG;
                            }}
                          />
                        </div>
                        <div class="p-4">
                          <h3 class="font-bold text-gray-900 truncate">
                            {nft.name}
                          </h3>
                          {nft.collection && (
                            <p class="text-xs text-blue-600 font-medium mt-0.5 truncate">
                              {nft.collection}
                            </p>
                          )}
                          <div class="mt-2 text-xs text-gray-400">
                            {nft.nftStandard || "XLS-20"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Skeleton placeholders while SSR cache loads */}
            {!loading.value &&
              nfts.value.length === 0 &&
              browseNfts.value.length === 0 &&
              !errorMsg.value &&
              !browseLoaded.value && (
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      class="rounded-2xl overflow-hidden bg-white border border-gray-200"
                    >
                      <div
                        class="aspect-square bg-gray-100"
                        style={{ animation: "pulse 2s ease-in-out infinite" }}
                      />
                      <div class="p-4 space-y-2">
                        <div
                          class="h-4 bg-gray-100 rounded"
                          style={{
                            width: "70%",
                            animation: "pulse 2s ease-in-out infinite",
                          }}
                        />
                        <div
                          class="h-3 bg-gray-100 rounded"
                          style={{
                            width: "50%",
                            animation: "pulse 2s ease-in-out infinite",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

            {/* NFT Grid */}
            {!loading.value && paginated.value.length > 0 && (
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {paginated.value.map((nft) => {
                  const price = getLowestSellPrice(
                    nft.sellOffers,
                    nativeCurrency.value,
                  );
                  const bestOffer = getHighestBuyPrice(
                    nft.buyOffers,
                    nativeCurrency.value,
                  );
                  return (
                    <div
                      key={nft.nftokenId}
                      class="group rounded-2xl overflow-hidden bg-white border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1"
                      onClick$={() => (selectedNft.value = nft)}
                    >
                      <div class="relative aspect-square overflow-hidden bg-gray-100">
                        <img
                          src={nft.image || PLACEHOLDER_IMG}
                          alt={nft.name}
                          width={400}
                          height={400}
                          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                          onError$={(e: any) => {
                            e.target.src = PLACEHOLDER_IMG;
                          }}
                        />
                        {nft.sellOffers.length > 0 && (
                          <div class="absolute top-3 left-3 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
                            FOR SALE
                          </div>
                        )}
                        {nft.buyOffers.length > 0 && (
                          <div class="absolute top-3 right-3 bg-blue-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
                            {nft.buyOffers.length} offer
                            {nft.buyOffers.length > 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                      <div class="p-4">
                        <h3 class="font-bold text-gray-900 truncate">
                          {nft.name}
                        </h3>
                        {nft.collection && (
                          <p class="text-xs text-blue-600 font-medium mt-0.5 truncate">
                            {nft.collection}
                          </p>
                        )}
                        <div class="flex items-center justify-between mt-3">
                          <div>
                            {price ? (
                              <div>
                                <div class="text-xs text-gray-500">Price</div>
                                <div class="text-sm font-bold text-green-700">
                                  {price}
                                </div>
                              </div>
                            ) : (
                              <div class="text-xs text-gray-400">
                                Not listed
                              </div>
                            )}
                          </div>
                          {bestOffer && (
                            <div class="text-right">
                              <div class="text-xs text-gray-500">
                                Best Offer
                              </div>
                              <div class="text-sm font-bold text-blue-700">
                                {bestOffer}
                              </div>
                            </div>
                          )}
                        </div>
                        <div class="flex gap-2 mt-3">
                          {nft.sellOffers.length > 0 &&
                            wallet.connected.value &&
                            nft.owner !== wallet.address.value && (
                              <button
                                class="flex-1 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition"
                                onClick$={(e) => {
                                  e.stopPropagation();
                                  const cheapest = nft.sellOffers.reduce(
                                    (min, o) => {
                                      const val =
                                        typeof o.amount === "string"
                                          ? Number(o.amount)
                                          : Number(o.amount.value);
                                      const minVal =
                                        typeof min.amount === "string"
                                          ? Number(min.amount)
                                          : Number(min.amount.value);
                                      return val < minVal ? o : min;
                                    },
                                    nft.sellOffers[0],
                                  );
                                  handleBuy(nft, cheapest);
                                }}
                              >
                                Buy
                              </button>
                            )}
                          {wallet.connected.value &&
                            nft.owner !== wallet.address.value && (
                              <button
                                class="flex-1 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition"
                                onClick$={(e) => {
                                  e.stopPropagation();
                                  selectedNft.value = nft;
                                  showOfferModal.value = true;
                                }}
                              >
                                Make Offer
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {!loading.value &&
              nfts.value.length === 0 &&
              marketData.value === null && (
                <div class="text-center py-20 text-gray-400">
                  <div class="text-6xl mb-4">🖼️</div>
                  <p class="text-lg">
                    Enter an r-address above to explore NFTs
                  </p>
                </div>
              )}

            {!loading.value &&
              nfts.value.length === 0 &&
              marketData.value !== null && (
                <div class="text-center py-20 text-gray-400">
                  <div class="text-6xl mb-4">📭</div>
                  <p class="text-lg">This account has no NFTs</p>
                </div>
              )}

            {/* Pagination */}
            {totalPages.value > 1 && (
              <div class="flex justify-center items-center gap-4 mt-10">
                <button
                  class="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={currentPage.value <= 1}
                  onClick$={() => currentPage.value--}
                >
                  ← Previous
                </button>
                <span class="text-sm font-semibold text-gray-700">
                  {currentPage.value} / {totalPages.value}
                </span>
                <button
                  class="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={currentPage.value >= totalPages.value}
                  onClick$={() => currentPage.value++}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── MY NFTS TAB ── */}
        {activeTab.value === "my-nfts" && (
          <div>
            {!wallet.connected.value ? (
              <div class="text-center py-20 text-gray-400">
                <div class="text-6xl mb-4">🔒</div>
                <p class="text-lg">Connect your wallet to view your NFTs</p>
              </div>
            ) : (
              <div>
                {/* My Stats */}
                {marketData.value && (
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div class="bg-gradient-to-br from-blue-50 to-white rounded-xl p-5 border border-blue-100">
                      <div class="text-xs text-blue-600 font-medium">
                        My NFTs
                      </div>
                      <div class="text-3xl font-bold text-gray-900 mt-1">
                        {marketData.value.totalNfts}
                      </div>
                    </div>
                    <div class="bg-gradient-to-br from-green-50 to-white rounded-xl p-5 border border-green-100">
                      <div class="text-xs text-green-600 font-medium">
                        Listed
                      </div>
                      <div class="text-3xl font-bold text-gray-900 mt-1">
                        {marketData.value.listedCount}
                      </div>
                    </div>
                    <div class="bg-gradient-to-br from-purple-50 to-white rounded-xl p-5 border border-purple-100">
                      <div class="text-xs text-purple-600 font-medium">
                        Incoming Offers
                      </div>
                      <div class="text-3xl font-bold text-gray-900 mt-1">
                        {marketData.value.totalBuyOffers}
                      </div>
                    </div>
                    <div class="bg-gradient-to-br from-amber-50 to-white rounded-xl p-5 border border-amber-100">
                      <div class="text-xs text-amber-600 font-medium">
                        Balance
                      </div>
                      <div class="text-3xl font-bold text-gray-900 mt-1">
                        {parseFloat(marketData.value.balance).toFixed(2)}{" "}
                        <span class="text-sm font-normal">
                          {nativeCurrency.value}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  class="mb-6 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  disabled={loading.value}
                  onClick$={() => fetchNfts(wallet.address.value)}
                >
                  {loading.value ? "Refreshing..." : "🔄 Refresh My NFTs"}
                </button>

                {/* Filters */}
                {nfts.value.length > 0 && (
                  <div class="flex gap-3 mb-6">
                    <input
                      type="text"
                      placeholder="Filter your NFTs..."
                      class="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      value={searchQuery.value}
                      onInput$={(e) =>
                        (searchQuery.value = (
                          e.target as HTMLInputElement
                        ).value)
                      }
                    />
                  </div>
                )}

                {/* Loading */}
                {loading.value && (
                  <div class="flex items-center justify-center py-20">
                    <div class="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
                    <span class="ml-4 text-gray-500">Loading your NFTs...</span>
                  </div>
                )}

                {/* Error */}
                {errorMsg.value && (
                  <div class="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    {errorMsg.value}
                  </div>
                )}

                {/* My NFT Grid */}
                {!loading.value && paginated.value.length > 0 && (
                  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {paginated.value.map((nft) => {
                      const price = getLowestSellPrice(
                        nft.sellOffers,
                        nativeCurrency.value,
                      );
                      return (
                        <div
                          key={nft.nftokenId}
                          class="group rounded-2xl overflow-hidden bg-white border border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1"
                          onClick$={() => (selectedNft.value = nft)}
                        >
                          <div class="relative aspect-square overflow-hidden bg-gray-100">
                            <img
                              src={nft.image || PLACEHOLDER_IMG}
                              alt={nft.name}
                              width={400}
                              height={400}
                              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              loading="lazy"
                              onError$={(e: any) => {
                                e.target.src = PLACEHOLDER_IMG;
                              }}
                            />
                            {price && (
                              <div class="absolute top-3 left-3 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
                                Listed: {price}
                              </div>
                            )}
                            {nft.buyOffers.length > 0 && (
                              <div class="absolute top-3 right-3 bg-blue-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
                                {nft.buyOffers.length} offer
                                {nft.buyOffers.length > 1 ? "s" : ""}
                              </div>
                            )}
                          </div>
                          <div class="p-4">
                            <h3 class="font-bold text-gray-900 truncate">
                              {nft.name}
                            </h3>
                            {nft.collection && (
                              <p class="text-xs text-purple-600 font-medium mt-0.5 truncate">
                                {nft.collection}
                              </p>
                            )}
                            <div class="flex gap-2 mt-3">
                              <button
                                class="flex-1 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 transition"
                                onClick$={(e) => {
                                  e.stopPropagation();
                                  selectedNft.value = nft;
                                  showOfferModal.value = true;
                                }}
                              >
                                {price ? "Update Listing" : "List for Sale"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!loading.value &&
                  nfts.value.length === 0 &&
                  !errorMsg.value && (
                    <div class="text-center py-20 text-gray-400">
                      <div class="text-6xl mb-4">📭</div>
                      <p class="text-lg">You don't have any NFTs yet</p>
                      <button
                        class="mt-4 px-6 py-2.5 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition"
                        onClick$={() => (activeTab.value = "mint")}
                      >
                        Mint your first NFT
                      </button>
                    </div>
                  )}

                {/* Pagination */}
                {totalPages.value > 1 && (
                  <div class="flex justify-center items-center gap-4 mt-10">
                    <button
                      class="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-40"
                      disabled={currentPage.value <= 1}
                      onClick$={() => currentPage.value--}
                    >
                      ← Previous
                    </button>
                    <span class="text-sm font-semibold text-gray-700">
                      {currentPage.value} / {totalPages.value}
                    </span>
                    <button
                      class="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-40"
                      disabled={currentPage.value >= totalPages.value}
                      onClick$={() => currentPage.value++}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── MINT TAB ── */}
        {activeTab.value === "mint" && (
          <div>
            {!wallet.connected.value ? (
              <div class="text-center py-20 text-gray-400">
                <div class="text-6xl mb-4">🔒</div>
                <p class="text-lg">Connect your wallet to mint NFTs</p>
              </div>
            ) : (
              <div class="max-w-2xl mx-auto">
                <div class="rounded-2xl bg-gradient-to-br from-purple-50 via-white to-pink-50 border border-gray-200 p-8 mb-8 shadow-sm">
                  <h2 class="text-2xl font-bold text-gray-900 mb-2">
                    ✨ Mint a New NFT
                  </h2>
                  <p class="text-gray-600 text-sm">
                    Create an NFT on the{" "}
                    <span
                      class="font-semibold"
                      style={{ color: networkConfig.value.color }}
                    >
                      {networkConfig.value.label}
                    </span>
                    . Your connected wallet (
                    {truncateAddress(wallet.address.value)}) will sign the
                    transaction.
                  </p>
                </div>

                <div class="rounded-2xl bg-white border border-gray-200 p-8 shadow-sm space-y-6">
                  {/* URI */}
                  <div>
                    <label class="block text-sm font-semibold text-gray-900 mb-2">
                      NFT URI (IPFS, HTTP, or data URI) *
                    </label>
                    <input
                      type="text"
                      placeholder="ipfs://QmYour... or https://..."
                      class="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
                      value={mintUri.value}
                      onInput$={(e) =>
                        (mintUri.value = (e.target as HTMLInputElement).value)
                      }
                    />
                    <p class="text-xs text-gray-500 mt-1">
                      This is stored on-ledger as hex. Point it to your NFT
                      metadata JSON or image.
                    </p>
                  </div>

                  {/* Taxon */}
                  <div>
                    <label class="block text-sm font-semibold text-gray-900 mb-2">
                      NFToken Taxon
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      class="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
                      value={mintTaxon.value}
                      onInput$={(e) =>
                        (mintTaxon.value = (e.target as HTMLInputElement).value)
                      }
                    />
                    <p class="text-xs text-gray-500 mt-1">
                      Group NFTs into collections by giving them the same taxon
                      number.
                    </p>
                  </div>

                  {/* Transfer Fee */}
                  <div>
                    <label class="block text-sm font-semibold text-gray-900 mb-2">
                      Transfer Fee:{" "}
                      {(parseInt(mintTransferFee.value) / 1000 || 0).toFixed(1)}
                      %
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="50000"
                      step="1000"
                      value={mintTransferFee.value}
                      onInput$={(e) =>
                        (mintTransferFee.value = (
                          e.target as HTMLInputElement
                        ).value)
                      }
                      class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                    <p class="text-xs text-gray-500 mt-1">
                      Royalty percentage earned on secondary sales (0–50%).
                    </p>
                  </div>

                  {/* Flags */}
                  <div>
                    <label class="block text-sm font-semibold text-gray-900 mb-2">
                      Flags
                    </label>
                    <div class="flex flex-wrap gap-3">
                      <label class="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={!!(mintFlags.value & 8)}
                          onChange$={() =>
                            (mintFlags.value = mintFlags.value ^ 8)
                          }
                          class="rounded accent-purple-600"
                        />
                        Transferable
                      </label>
                      <label class="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={!!(mintFlags.value & 2)}
                          onChange$={() =>
                            (mintFlags.value = mintFlags.value ^ 2)
                          }
                          class="rounded accent-purple-600"
                        />
                        Burnable by Issuer
                      </label>
                      <label class="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={!!(mintFlags.value & 1)}
                          onChange$={() =>
                            (mintFlags.value = mintFlags.value ^ 1)
                          }
                          class="rounded accent-purple-600"
                        />
                        Only Issuer Can Sell
                      </label>
                    </div>
                  </div>

                  {/* Preview */}
                  {mintUri.value && (
                    <div class="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div class="text-xs text-gray-500 font-medium mb-2">
                        Preview
                      </div>
                      <div class="text-xs font-mono break-all text-gray-600">
                        URI (hex):{" "}
                        {Array.from(new TextEncoder().encode(mintUri.value))
                          .map((b) => b.toString(16).padStart(2, "0"))
                          .join("")
                          .toUpperCase()
                          .slice(0, 80)}
                        ...
                      </div>
                    </div>
                  )}

                  <button
                    class="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition shadow-lg disabled:opacity-50 text-lg"
                    disabled={!mintUri.value}
                    onClick$={handleMint}
                  >
                    🚀 Mint NFT
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <footer class="text-center mt-36 -mb-10 font-extralight">
        © 2025 – Product of <a href="https://nrdxlab.com">{"{NRDX}"}Labs</a>.
        All rights reserved.
      </footer>
    </div>
  );
});

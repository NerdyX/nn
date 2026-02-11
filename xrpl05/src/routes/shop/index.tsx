import {
  component$,
  useSignal,
  useVisibleTask$,
  $,
  useComputed$,
} from "@builder.io/qwik";
import { useWalletContext, truncateAddress } from "~/context/wallet-context";
import { useNetworkContext, NETWORK_CONFIG } from "~/context/network-context";
import { signTransaction, waitForSignature } from "~/lib/xaman-auth";

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
  sellOffers: SellOffer[];
  buyOffers: BuyOffer[];
}

interface MarketplaceStats {
  totalNfts: number;
  listedCount: number;
  totalSellOffers: number;
  totalBuyOffers: number;
  collections: number;
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

  // Data state
  const nfts = useSignal<NftItem[]>([]);
  const loading = useSignal(false);
  const errorMsg = useSignal("");
  const stats = useSignal<MarketplaceStats>({
    totalNfts: 0,
    listedCount: 0,
    totalSellOffers: 0,
    totalBuyOffers: 0,
    collections: 0,
  });

  // Search / filter state
  const searchQuery = useSignal("");
  const selectedCollection = useSignal<string | null>(null);
  const showOnlyListed = useSignal(false);
  const currentPage = useSignal(1);
  const pageSize = 32; // 4 columns x 8 rows = 32 items per page

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

  // ── Fetch Marketplace NFTs ──
  const fetchMarketplaceNfts = $(async () => {
    loading.value = true;
    errorMsg.value = "";

    try {
      // Call your API endpoint that fetches all NFTs from the network
      const res = await fetch(
        `/api/marketplace/all?network=${activeNetwork.value}&limit=1000`,
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          (errData as any).message ||
            `Failed to fetch marketplace NFTs (${res.status})`,
        );
      }

      const data = await res.json();
      nfts.value = data.nfts || [];

      // Calculate stats
      const collections = new Set(
        nfts.value.map((n) => n.collection).filter(Boolean),
      );
      stats.value = {
        totalNfts: nfts.value.length,
        listedCount: nfts.value.filter((n) => n.sellOffers.length > 0).length,
        totalSellOffers: nfts.value.reduce(
          (sum, n) => sum + n.sellOffers.length,
          0,
        ),
        totalBuyOffers: nfts.value.reduce(
          (sum, n) => sum + n.buyOffers.length,
          0,
        ),
        collections: collections.size,
      };

      currentPage.value = 1;
    } catch (err: any) {
      errorMsg.value = err.message || "Failed to fetch marketplace data";
      nfts.value = [];
    } finally {
      loading.value = false;
    }
  });

  // Auto-fetch on mount and network change
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => activeNetwork.value);
    fetchMarketplaceNfts();
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
      setTimeout(() => fetchMarketplaceNfts(), 3000);
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
      Flags: 0,
    });

    if (result) {
      showOfferModal.value = false;
      offerAmount.value = "";
      setTimeout(() => fetchMarketplaceNfts(), 3000);
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

      const matchesListed = !showOnlyListed.value || nft.sellOffers.length > 0;

      return matchesSearch && matchesCollection && matchesListed;
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
      if (n.collection && n.collection !== "Unknown Collection")
        cols.add(n.collection);
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
                    {selectedNft.value.transferFee / 1000}%
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

                {wallet.connected.value &&
                  selectedNft.value.owner !== wallet.address.value && (
                    <button
                      class="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg"
                      onClick$={() => (showOfferModal.value = true)}
                    >
                      💰 Make Offer
                    </button>
                  )}

                {!wallet.connected.value && (
                  <div class="flex-1 py-3 bg-gray-100 text-gray-500 font-bold rounded-xl text-center">
                    Connect wallet to trade
                  </div>
                )}
              </div>

              {/* Make Offer Form */}
              {showOfferModal.value && (
                <div class="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <h3 class="text-sm font-bold text-gray-700 mb-3">
                    Make an Offer
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
                      onClick$={() =>
                        handleMakeOffer(selectedNft.value!, offerAmount.value)
                      }
                    >
                      Offer
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
        {/* Hero Section */}
        <div class="rounded-2xl bg-linear-to-br from-blue-50 via-white to-purple-50 border border-gray-200 p-8 mb-8 shadow-sm">
          <h1 class="text-4xl font-bold text-gray-900 mb-2">
            🌐 NFT Marketplace
          </h1>
          <p class="text-gray-600 mb-4">
            Discover, collect, and trade NFTs on the{" "}
            <span
              class="font-semibold"
              style={{ color: networkConfig.value.color }}
            >
              {networkConfig.value.label}
            </span>
          </p>

          {/* Stats */}
          <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
            <div class="bg-white/80 backdrop-blur rounded-xl p-4 border border-gray-100">
              <div class="text-xs text-gray-500 font-medium">Total NFTs</div>
              <div class="text-2xl font-bold text-gray-900 mt-1">
                {stats.value.totalNfts.toLocaleString()}
              </div>
            </div>
            <div class="bg-white/80 backdrop-blur rounded-xl p-4 border border-gray-100">
              <div class="text-xs text-gray-500 font-medium">Listed</div>
              <div class="text-2xl font-bold text-green-600 mt-1">
                {stats.value.listedCount.toLocaleString()}
              </div>
            </div>
            <div class="bg-white/80 backdrop-blur rounded-xl p-4 border border-gray-100">
              <div class="text-xs text-gray-500 font-medium">Sell Offers</div>
              <div class="text-2xl font-bold text-blue-600 mt-1">
                {stats.value.totalSellOffers.toLocaleString()}
              </div>
            </div>
            <div class="bg-white/80 backdrop-blur rounded-xl p-4 border border-gray-100">
              <div class="text-xs text-gray-500 font-medium">Buy Offers</div>
              <div class="text-2xl font-bold text-purple-600 mt-1">
                {stats.value.totalBuyOffers.toLocaleString()}
              </div>
            </div>
            <div class="bg-white/80 backdrop-blur rounded-xl p-4 border border-gray-100">
              <div class="text-xs text-gray-500 font-medium">Collections</div>
              <div class="text-2xl font-bold text-gray-900 mt-1">
                {stats.value.collections.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {errorMsg.value && (
          <div class="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {errorMsg.value}
          </div>
        )}

        {/* Filters */}
        <div class="flex flex-col lg:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by name, collection, ID, or issuer..."
            class="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={searchQuery.value}
            onInput$={(e) =>
              (searchQuery.value = (e.target as HTMLInputElement).value)
            }
          />

          {collections.value.length > 0 && (
            <select
              class="rounded-lg border border-gray-300 px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 lg:w-64"
              value={selectedCollection.value || ""}
              onChange$={(e) => {
                selectedCollection.value =
                  (e.target as HTMLSelectElement).value || null;
                currentPage.value = 1;
              }}
            >
              <option value="">All Collections ({nfts.value.length})</option>
              {collections.value.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <label class="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm cursor-pointer hover:bg-gray-50 transition whitespace-nowrap">
            <input
              type="checkbox"
              checked={showOnlyListed.value}
              onChange$={() => {
                showOnlyListed.value = !showOnlyListed.value;
                currentPage.value = 1;
              }}
              class="rounded accent-blue-600"
            />
            <span class="font-medium text-gray-700">For Sale Only</span>
          </label>

          {(searchQuery.value ||
            selectedCollection.value ||
            showOnlyListed.value) && (
            <button
              class="px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition whitespace-nowrap"
              onClick$={() => {
                searchQuery.value = "";
                selectedCollection.value = null;
                showOnlyListed.value = false;
                currentPage.value = 1;
              }}
            >
              Clear Filters
            </button>
          )}

          <button
            class="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 whitespace-nowrap"
            disabled={loading.value}
            onClick$={fetchMarketplaceNfts}
          >
            {loading.value ? "Refreshing..." : "🔄 Refresh"}
          </button>
        </div>

        {/* Results Info */}
        {!loading.value && nfts.value.length > 0 && (
          <div class="mb-4 text-sm text-gray-600">
            Showing {(currentPage.value - 1) * pageSize + 1}-
            {Math.min(currentPage.value * pageSize, filtered.value.length)} of{" "}
            {filtered.value.length.toLocaleString()} NFTs
          </div>
        )}

        {/* Loading */}
        {loading.value && (
          <div class="flex items-center justify-center py-20">
            <div class="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
            <span class="ml-4 text-gray-500">
              Loading NFTs from the {networkConfig.value.label}...
            </span>
          </div>
        )}

        {/* NFT Grid - 4 columns x 8 rows */}
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
                    {nft.collection &&
                      nft.collection !== "Unknown Collection" && (
                        <div class="absolute top-3 right-3 bg-blue-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
                          {nft.collection}
                        </div>
                      )}
                  </div>
                  <div class="p-4">
                    <h3 class="font-bold text-gray-900 truncate">{nft.name}</h3>
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
                          <div class="text-xs text-gray-400">Not listed</div>
                        )}
                      </div>
                      {bestOffer && (
                        <div class="text-right">
                          <div class="text-xs text-gray-500">Best Offer</div>
                          <div class="text-sm font-bold text-blue-700">
                            {bestOffer}
                          </div>
                        </div>
                      )}
                    </div>
                    {nft.sellOffers.length > 0 &&
                      wallet.connected.value &&
                      nft.owner !== wallet.address.value && (
                        <button
                          class="w-full mt-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition"
                          onClick$={(e) => {
                            e.stopPropagation();
                            const cheapest = nft.sellOffers.reduce((min, o) => {
                              const val =
                                typeof o.amount === "string"
                                  ? Number(o.amount)
                                  : Number(o.amount.value);
                              const minVal =
                                typeof min.amount === "string"
                                  ? Number(min.amount)
                                  : Number(min.amount.value);
                              return val < minVal ? o : min;
                            }, nft.sellOffers[0]);
                            handleBuy(nft, cheapest);
                          }}
                        >
                          Buy Now
                        </button>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading.value && nfts.value.length === 0 && (
          <div class="text-center py-20 text-gray-400">
            <div class="text-6xl mb-4">🖼️</div>
            <p class="text-lg">No NFTs found on this network</p>
            <button
              class="mt-4 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
              onClick$={fetchMarketplaceNfts}
            >
              Try Refreshing
            </button>
          </div>
        )}

        {!loading.value &&
          filtered.value.length === 0 &&
          nfts.value.length > 0 && (
            <div class="text-center py-20 text-gray-400">
              <div class="text-6xl mb-4">🔍</div>
              <p class="text-lg">No NFTs match your filters</p>
              <button
                class="mt-4 px-6 py-2.5 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition"
                onClick$={() => {
                  searchQuery.value = "";
                  selectedCollection.value = null;
                  showOnlyListed.value = false;
                  currentPage.value = 1;
                }}
              >
                Clear Filters
              </button>
            </div>
          )}

        {/* Pagination */}
        {totalPages.value > 1 && (
          <div class="flex flex-col sm:flex-row justify-center items-center gap-4 mt-10">
            <button
              class="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={currentPage.value <= 1}
              onClick$={() => {
                currentPage.value--;
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              ← Previous
            </button>

            <div class="flex items-center gap-2">
              {/* Show first page */}
              {currentPage.value > 3 && (
                <>
                  <button
                    class="w-10 h-10 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                    onClick$={() => {
                      currentPage.value = 1;
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    1
                  </button>
                  {currentPage.value > 4 && (
                    <span class="text-gray-400">...</span>
                  )}
                </>
              )}

              {/* Show surrounding pages */}
              {Array.from({ length: totalPages.value }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === currentPage.value ||
                    p === currentPage.value - 1 ||
                    p === currentPage.value + 1 ||
                    p === currentPage.value - 2 ||
                    p === currentPage.value + 2,
                )
                .map((p) => (
                  <button
                    key={p}
                    class={`w-10 h-10 rounded-lg border text-sm font-medium transition ${
                      p === currentPage.value
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick$={() => {
                      currentPage.value = p;
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    {p}
                  </button>
                ))}

              {/* Show last page */}
              {currentPage.value < totalPages.value - 2 && (
                <>
                  {currentPage.value < totalPages.value - 3 && (
                    <span class="text-gray-400">...</span>
                  )}
                  <button
                    class="w-10 h-10 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                    onClick$={() => {
                      currentPage.value = totalPages.value;
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    {totalPages.value}
                  </button>
                </>
              )}
            </div>

            <button
              class="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={currentPage.value >= totalPages.value}
              onClick$={() => {
                currentPage.value++;
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Next →
            </button>
          </div>
        )}

        <div class="text-center text-sm text-gray-500 mt-8">
          Page {currentPage.value} of {totalPages.value}
        </div>
      </section>

      <footer class="text-center mt-36 -mb-10 font-extralight">
        © 2025 – Product of <a href="https://nrdxlab.com">{"{NRDX}"}Labs</a>.
        All rights reserved.
      </footer>
    </div>
  );
});

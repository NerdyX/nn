import {
  component$,
  useSignal,
  useTask$,
  useStylesScoped$,
  useComputed$,
  $,
} from "@builder.io/qwik";
import { useWalletContext, truncateAddress } from "~/context/wallet-context";
import { useNetworkContext, NETWORK_CONFIG } from "~/context/network-context";

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────
interface AccountRoot {
  Account: string;
  Balance: string;
  OwnerCount: number;
  Sequence: number;
  Flags: number;
  Domain?: string;
  EmailHash?: string;
  PreviousTxnID: string;
  PreviousTxnLgrSeq: number;
  LedgerEntryType?: string;
  RegularKey?: string;
  index?: string;
  urlgravatar?: string;
}

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

interface TokenLine {
  currency: string;
  balance: string;
  peer: string;
  limit: string;
  type: "token" | "trustline";
}

interface Transaction {
  hash: string;
  TransactionType: string;
  Amount?: any;
  Account: string;
  Destination?: string;
  meta: { TransactionResult: string };
  date?: string;
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

// ────────────────────────────────────────────────
// Helper Functions
// ────────────────────────────────────────────────
const XRPL_WS = "wss://xrplcluster.com";
const XAHAU_WS = "wss://xahau.network";
const FALLBACK_IMG = "https://placehold.co/400x400/eeeeee/999999?text=NFT";
const PLACEHOLDER_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' fill='%23e5e7eb'%3E%3Crect width='400' height='400'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='48' fill='%239ca3af'%3ENFT%3C/text%3E%3C/svg%3E";

const truncate = (v?: string) => (v ? `${v.slice(0, 6)}…${v.slice(-6)}` : "—");

const formatAmount = (amt: any, native: string) => {
  if (!amt) return "—";
  if (typeof amt === "string") {
    return `${(Number(amt) / 1_000_000).toLocaleString(undefined, {
      maximumFractionDigits: 6,
    })} ${native}`;
  }
  return `${amt.value} ${amt.currency}`;
};

const ipfsToHttp = (uri?: string) => {
  if (!uri) return FALLBACK_IMG;

  if (uri.match(/^[0-9A-Fa-f]+$/)) {
    try {
      const bytes = new Uint8Array(
        uri.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)),
      );
      const decoded = new TextDecoder().decode(bytes).trim();

      if (decoded.startsWith("ipfs://"))
        return `https://ipfs.io/ipfs/${decoded.slice(7)}`;
      if (decoded.startsWith("https://") || decoded.startsWith("http://"))
        return decoded;
      if (decoded.startsWith("Qm") || decoded.startsWith("bafy"))
        return `https://ipfs.io/ipfs/${decoded}`;
    } catch (e) {
      console.warn("Failed to decode hex URI:", uri, e);
    }
  }

  if (uri.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  if (uri.startsWith("https://") || uri.startsWith("http://")) return uri;
  if (uri.startsWith("Qm") || uri.startsWith("bafy"))
    return `https://ipfs.io/ipfs/${uri}`;

  return FALLBACK_IMG;
};

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

// ────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────
export default component$(() => {
  const wallet = useWalletContext();
  const { activeNetwork } = useNetworkContext();
  const networkConfig = useComputed$(() => NETWORK_CONFIG[activeNetwork.value]);
  const nativeCurrency = useComputed$(() =>
    activeNetwork.value === "xrpl" ? "XRP" : "XAH",
  );

  useStylesScoped$(`
    :root { --gap: 20px; }

    .page {
      min-height: 100vh;
      background: white;
      padding-top: var(--gap);
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .hero-search {
      margin-top: 30vh;
      width: 100%;
      max-width: 700px;
      padding: 0 1rem;
      transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      transform: translateY(0);
    }

    .hero-search.moved {
      margin-top: 1rem;
      position: sticky;
      top: 0;
      z-index: 100;
      background: white;
      padding: 1rem;
      box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    }

    .pill-input {
      width: 100%;
      padding: 1.25rem 2rem;
      border-radius: 9999px;
      border: 2px solid #d1d5db;
      font-size: 1.25rem;
      outline: none;
      transition: all 0.3s;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15), 0 10px 30px rgba(0,0,0,0.1);
    }

    .pill-input:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.3), 0 10px 30px rgba(0,0,0,0.1);
    }

    .content {
      width: 100%;
      max-width: 1280px;
      padding: 2rem 1rem;
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.8s ease-out;
    }

    .content.loaded {
      opacity: 1;
      transform: translateY(0);
    }

    .bento {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }

    .account-tokens-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      grid-column: 1 / -1;
    }

    .card {
      border: 1px solid #e5e7eb;
      border-radius: 1.25rem;
      background: white;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    }

    .square-card {
      aspect-ratio: 1 / 1;
      display: flex;
      flex-direction: column;
    }

    .square-card .body {
      flex: 1;
      overflow-y: auto;
    }

    .header {
      padding: 1.25rem 1.5rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: #6b7280;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }

    .body {
      padding: 1.5rem;
    }

    .txs .body {
      max-height: 400px;
      overflow-y: auto;
    }

    .tx-item {
      padding: 0.75rem 0;
      border-bottom: 1px solid #f3f4f6;
    }

    .tx-item:nth-child(even) {
      background: #f9fafb;
    }

    /* NFT Card - Scrollable */
    .nft-card-wrapper {
      grid-column: 1 / -1;
    }

    .nft-scroll-body {
      max-height: 600px;
      overflow-y: auto;
      padding: 1.5rem;
    }

    .nft-scroll-body::-webkit-scrollbar {
      width: 8px;
    }

    .nft-scroll-body::-webkit-scrollbar-track {
      background: #f3f4f6;
      border-radius: 4px;
    }

    .nft-scroll-body::-webkit-scrollbar-thumb {
      background: #d1d5db;
      border-radius: 4px;
    }

    .nft-scroll-body::-webkit-scrollbar-thumb:hover {
      background: #9ca3af;
    }

    .nft-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .spinner {
      width: 56px;
      height: 56px;
      border: 6px solid #d1d5db;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 1024px) {
      .bento {
        grid-template-columns: 1fr;
      }
      .account-tokens-row {
        grid-template-columns: 1fr;
      }
      .square-card {
        aspect-ratio: auto;
      }
    }

    @media (max-width: 768px) {
      .nft-grid {
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      }
    }

    @media (max-width: 640px) {
      .nft-grid {
        grid-template-columns: 1fr;
      }
    }
  `);

  // Search state
  const query = useSignal("");
  const debounced = useSignal("");
  const network = useSignal<"xrpl" | "xahau">("xrpl");

  // Account data
  const account = useSignal<AccountRoot | null>(null);
  const lines = useSignal<TokenLine[]>([]);
  const txs = useSignal<Transaction[]>([]);

  // NFT data
  const nfts = useSignal<NftItem[]>([]);
  const loading = useSignal(false);
  const errorMsg = useSignal("");
  const marketData = useSignal<MarketplaceData | null>(null);

  // Search / filter state
  const searchQuery = useSignal("");
  const selectedCollection = useSignal<string | null>(null);
  const currentPage = useSignal(1);
  const pageSize = 12;

  // Modal state
  const selectedNft = useSignal<NftItem | null>(null);
  const showOfferModal = useSignal(false);
  const offerAmount = useSignal("");

  /* ── Debounce search ── */
  useTask$(({ track, cleanup }) => {
    track(() => query.value);
    const t = setTimeout(() => (debounced.value = query.value.trim()), 500);
    cleanup(() => clearTimeout(t));
  });

  // ── Fetch NFTs from API ──
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

  /* ── Load data when address changes ── */
  useTask$(({ track, cleanup }) => {
    track(() => debounced.value);
    if (!debounced.value) return;

    account.value = null;
    lines.value = [];
    txs.value = [];
    nfts.value = [];
    marketData.value = null;

    const addr = debounced.value;

    // Fetch NFTs via API
    fetchNfts(addr);

    // Fetch account info via WebSocket
    const ws = new WebSocket(network.value === "xrpl" ? XRPL_WS : XAHAU_WS);
    let id = 1;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({ id: id++, command: "account_info", account: addr }),
      );
      ws.send(
        JSON.stringify({ id: id++, command: "account_lines", account: addr }),
      );
      ws.send(
        JSON.stringify({
          id: id++,
          command: "account_tx",
          account: addr,
          limit: 50,
        }),
      );
    };

    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.result?.account_data) account.value = m.result.account_data;
      if (m.result?.lines) lines.value = m.result.lines;
      if (m.result?.transactions)
        txs.value = m.result.transactions.map((t: any) => t.tx || t);
    };

    cleanup(() => ws.close());
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

  // Buy handler (placeholder)
  const handleBuy = $((nft: NftItem, offer: SellOffer) => {
    console.log("Buy NFT:", nft.nftokenId, "Offer:", offer.index);
    // Implement buy logic here
  });

  return (
    <div class="page mt-20">
      {/* Pill-shaped search bar - centered in middle initially */}
      <div class={`hero-search ${debounced.value ? "moved" : ""}`}>
        <input
          class="pill-input"
          placeholder="Paste account address…"
          value={query.value}
          onInput$={(e) => (query.value = (e.target as HTMLInputElement).value)}
        />
      </div>

      {debounced.value && (
        <div class="content loaded">
          <div class="bento">
            {/* Account and Tokens - Square Cards Row */}
            <div class="account-tokens-row">
              {/* Account Information */}
              <div class="card square-card">
                <div class="header">Account Information</div>
                <div class="body">
                  {!account.value ? (
                    <div>Loading...</div>
                  ) : (
                    <div>
                      {account.value.urlgravatar && (
                        <img
                          src={account.value.urlgravatar}
                          alt="Avatar"
                          width={100}
                          height={100}
                          style={{
                            borderRadius: "50%",
                            marginBottom: "1rem",
                            display: "block",
                          }}
                        />
                      )}

                      <div style={{ marginBottom: "0.75rem" }}>
                        <strong
                          style={{
                            color: "#6b7280",
                            fontSize: "0.75rem",
                            display: "block",
                            marginBottom: "0.25rem",
                          }}
                        >
                          ACCOUNT
                        </strong>
                        <span
                          style={{
                            fontSize: "0.8125rem",
                            wordBreak: "break-all",
                            display: "block",
                          }}
                        >
                          {account.value.Account}
                        </span>
                      </div>

                      <div style={{ marginBottom: "0.75rem" }}>
                        <strong
                          style={{
                            color: "#6b7280",
                            fontSize: "0.75rem",
                            display: "block",
                            marginBottom: "0.25rem",
                          }}
                        >
                          BALANCE
                        </strong>
                        <span style={{ fontSize: "0.875rem" }}>
                          {formatAmount(
                            account.value.Balance,
                            network.value === "xrpl" ? "XRP" : "XAH",
                          )}
                        </span>
                      </div>

                      {account.value.Domain && (
                        <div style={{ marginBottom: "0.75rem" }}>
                          <strong
                            style={{
                              color: "#6b7280",
                              fontSize: "0.75rem",
                              display: "block",
                              marginBottom: "0.25rem",
                            }}
                          >
                            DOMAIN
                          </strong>
                          <span
                            style={{
                              fontSize: "0.875rem",
                              wordBreak: "break-all",
                            }}
                          >
                            {account.value.Domain}
                          </span>
                        </div>
                      )}

                      <div style={{ marginBottom: "0.75rem" }}>
                        <strong
                          style={{
                            color: "#6b7280",
                            fontSize: "0.75rem",
                            display: "block",
                            marginBottom: "0.25rem",
                          }}
                        >
                          SEQUENCE
                        </strong>
                        <span style={{ fontSize: "0.875rem" }}>
                          {account.value.Sequence}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tokens & Trustlines */}
              <div class="card square-card">
                <div class="header">Tokens & Trustlines</div>
                <div class="body">
                  {lines.value.length === 0 ? (
                    <div>No tokens or trustlines</div>
                  ) : (
                    lines.value.map((l, i) => (
                      <div key={i} style={{ marginBottom: "1rem" }}>
                        <strong>{l.currency}</strong>: {l.balance} (limit:{" "}
                        {l.limit})
                        <br />
                        <small>
                          {l.type} with {truncate(l.peer)}
                        </small>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Transaction History - full width */}
            <div class="card txs" style={{ gridColumn: "1 / -1" }}>
              <div class="header">Transaction History</div>
              <div class="body">
                {txs.value.length === 0 ? (
                  <div>No recent transactions</div>
                ) : (
                  txs.value.map((t, i) => (
                    <div key={i} class="tx-item">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>{t.TransactionType}</span>
                        <span
                          style={{
                            color:
                              t.meta?.TransactionResult === "tesSUCCESS"
                                ? "green"
                                : "red",
                          }}
                        >
                          {t.meta?.TransactionResult || "unknown"}
                        </span>
                      </div>
                      <div>
                        {new Date(t.date || Date.now()).toLocaleString()}
                      </div>
                      <div>
                        {truncate(t.Account)} → {truncate(t.Destination || "")}
                      </div>
                      <div>
                        {t.Amount
                          ? formatAmount(
                              t.Amount,
                              network.value === "xrpl" ? "XRP" : "XAH",
                            )
                          : "—"}
                      </div>
                      <div>Hash: {truncate(t.hash)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* NFTs Card - full width with dropdown filtering and pagination */}
            <div class="card nft-card-wrapper">
              <div class="header">NFTs ({nfts.value.length})</div>

              {/* Filters */}
              {nfts.value.length > 0 && (
                <div class="flex flex-col sm:flex-row gap-3 mb-6 px-6 pt-4">
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
                  <div class="spinner" />
                  <span class="ml-4 text-gray-500">
                    Fetching NFTs from the ledger...
                  </span>
                </div>
              )}

              {/* Scrollable NFT Body */}
              {!loading.value && paginated.value.length > 0 && (
                <div class="nft-scroll-body">
                  <div class="nft-grid">
                    {paginated.value.map((nft) => {
                      const price = getLowestSellPrice(
                        nft.sellOffers || [],
                        nativeCurrency.value,
                      );
                      const bestOffer = getHighestBuyPrice(
                        nft.buyOffers || [],
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
                            {nft.sellOffers && nft.sellOffers.length > 0 && (
                              <div class="absolute top-3 left-3 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
                                FOR SALE
                              </div>
                            )}
                            {nft.buyOffers && nft.buyOffers.length > 0 && (
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
                                    <div class="text-xs text-gray-500">
                                      Price
                                    </div>
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
                              {nft.sellOffers &&
                                nft.sellOffers.length > 0 &&
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
                <div class="flex justify-center items-center gap-4 mt-6 pb-4">
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
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

import {
  component$,
  useSignal,
  useTask$,
  useStylesScoped$,
  useComputed$,
  $,
} from "@builder.io/qwik";
import { useWalletContext } from "~/context/wallet-context";
import { useNetworkContext } from "~/context/network-context";
import { truncateAddress } from "~/lib/store/wallet";

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
  marker?: string;
  queriedAt: string;
}

interface TokenLine {
  currency: string;
  balance: string;
  peer: string;
  limit: string;
  type: "token" | "trustline";
  currency_code?: string;
  icon?: string;
}

interface Transaction {
  hash: string;
  TransactionType: string;
  Amount?: any;
  Account: string;
  Destination?: string;
  meta: { TransactionResult: string };
  date?: string;
  validated?: boolean;
  ledger_index?: number;
  NFTokenID?: string;
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

// Get token icon from currency code
import { parseCurrencyCode } from "~/lib/utils/hex";

const getTokenIcon = (currency: string, issuer: string) => {
  const parsedCurrency = parseCurrencyCode(currency);
  return `https://cdn.bithomp.com/issued-token/${issuer}/${parsedCurrency}/.png/jpeg/icon`;
};

// ────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────
export default component$(() => {
  const walletCtx = useWalletContext();
  const networkCtx = useNetworkContext();

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

    .token-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      border-radius: 0.5rem;
      margin-bottom: 0.75rem;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
    }

    .token-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
      background: white;
      border: 1px solid #e5e7eb;
    }

    .token-info {
      flex: 1;
      min-width: 0;
    }

    .token-currency {
      font-weight: 600;
      font-size: 0.875rem;
      color: #111827;
    }

    .token-issuer {
      font-size: 0.75rem;
      color: #6b7280;
      font-family: monospace;
    }

    .token-balance {
      text-align: right;
      font-weight: 600;
      color: #111827;
      font-size: 0.875rem;
    }

    .txs .body {
      max-height: 400px;
      overflow-y: auto;
      padding: 0;
    }

    .tx-table {
      width: 100%;
      border-collapse: collapse;
    }

    .tx-table thead {
      background: #f9fafb;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .tx-table th {
      padding: 0.75rem 1rem;
      text-align: left;
      font-size: 0.75rem;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      border-bottom: 1px solid #e5e7eb;
    }

    .tx-table td {
      padding: 0.75rem 1rem;
      font-size: 0.8125rem;
      border-bottom: 1px solid #f3f4f6;
    }

    .tx-table tbody tr:hover {
      background: #f9fafb;
    }

    .tx-status {
      color: #10b981;
      font-weight: 600;
    }

    .tx-type {
      font-weight: 500;
      color: #111827;
    }

    .tx-hash {
      color: #3b82f6;
      text-decoration: none;
      font-family: monospace;
      font-size: 0.75rem;
    }

    .tx-hash:hover {
      text-decoration: underline;
    }

    .tx-change-positive {
      color: #10b981;
      font-weight: 600;
    }

    .tx-change-negative {
      color: #ef4444;
      font-weight: 600;
    }

    .tx-nft-added {
      color: #10b981;
      font-size: 0.75rem;
    }

    /* NFT Tabs */
    .nft-tabs {
      display: flex;
      gap: 0.5rem;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #e5e7eb;
      background: #fafbfc;
    }

    .nft-tab {
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      border: none;
      background: transparent;
      color: #6b7280;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .nft-tab:hover {
      background: #f3f4f6;
      color: #111827;
    }

    .nft-tab.active {
      background: #3b82f6;
      color: white;
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
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 1rem;
    }

    .nft-item {
      border-radius: 1rem;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      background: white;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .nft-item:hover {
      border-color: #3b82f6;
      box-shadow: 0 10px 30px rgba(0,0,0,0.12);
      transform: translateY(-2px);
    }

    .nft-image-wrapper {
      position: relative;
      aspect-ratio: 1 / 1;
      overflow: hidden;
      background: #f3f4f6;
    }

    .nft-image-wrapper img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }

    .nft-item:hover .nft-image-wrapper img {
      transform: scale(1.05);
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
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      }
    }

    @media (max-width: 640px) {
      .nft-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `);

  // Search state
  const query = useSignal("");
  const debounced = useSignal("");
  

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
  
  

  // NFT Tab state
  const nftTab = useSignal<
    "owned" | "sold" | "offers-created" | "offers-received"
  >("owned");

  // Modal state
  const selectedNft = useSignal<NftItem | null>(null);
  const nftHistory = useSignal<any[]>([]);
  const loadingHistory = useSignal(false);
  
  useTask$(({ track }) => {
    const nft = track(() => selectedNft.value);
    if (!nft) return;
    
    nftHistory.value = [];
    loadingHistory.value = true;
    
    const ws = new WebSocket(networkCtx.activeNetwork.value === "xrpl" ? XRPL_WS : XAHAU_WS);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        command: "nft_history",
        nft_id: nft.nftokenId,
        limit: 20
      }));
    };
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.result?.transactions) {
        nftHistory.value = data.result.transactions;
      }
      loadingHistory.value = false;
      ws.close();
    };
    ws.onerror = () => {
      loadingHistory.value = false;
    };
  });
  const showOfferModal = useSignal(false);
  const offerAmount = useSignal("");

  /* ── Debounce search ── */
  useTask$(({ track, cleanup }) => {
    track(() => query.value);
    const t = setTimeout(() => (debounced.value = query.value.trim()), 500);
    cleanup(() => clearTimeout(t));
  });

  // ── Fetch NFTs from API ──
  const loadingMore = useSignal(false);

  const fetchNfts = $(async (address: string, loadMore = false) => {
    if (!address) return;
    if (loadMore) {
      loadingMore.value = true;
    } else {
      loading.value = true;
      errorMsg.value = "";
    }

    try {
      const markerParam = loadMore && marketData.value?.marker ? `&marker=${marketData.value.marker}` : '';
      const res = await fetch(
        `/api/marketplace?network=${networkCtx.activeNetwork.value}&address=${address}&limit=5${markerParam}`,
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          (errData as any).message || `Failed to fetch NFTs (${res.status})`,
        );
      }

      const data: MarketplaceData = await res.json();
      if (loadMore) {
        marketData.value = { ...marketData.value, marker: data.marker } as any;
        nfts.value = [...nfts.value, ...data.nfts];
      } else {
        marketData.value = data;
        nfts.value = data.nfts;
      }
    } catch (err: any) {
      if (!loadMore) {
        errorMsg.value = err.message || "Failed to fetch NFT data";
        nfts.value = [];
        marketData.value = null;
      }
    } finally {
      loading.value = false;
      loadingMore.value = false;
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
    const ws = new WebSocket(networkCtx.activeNetwork.value === "xrpl" ? XRPL_WS : XAHAU_WS);
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
      if (m.result?.lines) {
        lines.value = m.result.lines.map((line: any) => ({
          ...line,
          icon: getTokenIcon(line.currency, line.account),
        }));
      }
      if (m.result?.transactions) {
        txs.value = m.result.transactions.map((t: any) => ({
          ...(t.tx || t),
          validated: t.validated,
          ledger_index: t.ledger_index,
        }));
      }
    };

    cleanup(() => ws.close());
  });

  // Filtered NFTs based on active tab
  const filtered = useComputed$(() => {
    let tabFiltered = nfts.value;

    // Filter by tab
    if (nftTab.value === "sold") {
      // This would need to come from transaction history
      tabFiltered = [];
    } else if (nftTab.value === "offers-created") {
      tabFiltered = nfts.value.filter(
        (nft) => nft.sellOffers && nft.sellOffers.length > 0,
      );
    } else if (nftTab.value === "offers-received") {
      tabFiltered = nfts.value.filter(
        (nft) => nft.buyOffers && nft.buyOffers.length > 0,
      );
    }

    // Apply search and collection filters
    return tabFiltered.filter((nft) => {
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

  // Pagination
  const paginated = useComputed$(() => {
    return filtered.value;
  });

  

  return (
    <div class="page mt-16">
      {/* ── SEARCH HERO ── */}
      <div class={["hero-search", debounced.value && "moved"].join(" ")}>
        {!debounced.value && (
          <h1 class="text-center text-4xl md:text-5xl font-extrabold text-gray-900 mb-8 tracking-tight">
            Explore the <span class="text-blue-600">Ledger</span>
          </h1>
        )}
        <div class="relative max-w-2xl mx-auto">
          <input
            type="text"
            class="pill-input pr-32"
            placeholder="Enter r-address or domain..."
            value={query.value}
            onInput$={(e) =>
              (query.value = (e.target as HTMLInputElement).value)
            }
          />
          <div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <select
              value={networkCtx.activeNetwork.value}
              onChange$={(e) => {
                const net = (e.target as HTMLSelectElement).value as
                  | "xrpl"
                  | "xahau";
                networkCtx.activeNetwork.value = net;
                import("~/lib/store/network").then(({ networkActions }) => {
                  networkActions.setActiveNetwork(net);
                });
              }}
              class="bg-gray-100 border-none text-sm font-medium rounded-full px-4 py-2 focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="xrpl">XRPL</option>
              <option value="xahau">Xahau</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── RESULTS AREA ── */}
      <div class={["content", debounced.value && "loaded"].join(" ")}>
        {debounced.value && !account.value && !lines.value.length && (
          <div class="py-20 flex flex-col items-center">
            <div class="spinner"></div>
            <p class="mt-6 text-gray-500 font-medium animate-pulse">
              Scanning the ledger...
            </p>
          </div>
        )}

        {account.value && (
          <div class="bento">
            {/* Account Card */}
            <div class="card p-6 md:p-8 bg-linear-to-br from-blue-50 to-white">
              <div class="flex items-center gap-4 mb-6">
                <div class="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
                  <svg
                    class="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 class="text-2xl font-bold text-gray-900 break-all">
                    {account.value.Account}
                  </h2>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {networkCtx.activeNetwork.value.toUpperCase()}
                    </span>
                    {account.value.Domain && (
                      <a
                        href={`https://${Buffer.from(account.value.Domain, "hex").toString()}`}
                        target="_blank"
                        rel="noopener"
                        class="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <svg
                          class="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                          />
                        </svg>
                        {Buffer.from(account.value.Domain, "hex").toString()}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="bg-white rounded-xl p-4 border border-blue-100 shadow-sm">
                  <p class="text-sm text-gray-500 font-medium mb-1">Balance</p>
                  <p class="text-2xl font-bold text-gray-900">
                    {(Number(account.value.Balance) / 1_000_000).toLocaleString(
                      undefined,
                      { maximumFractionDigits: 2 },
                    )}
                    <span class="text-base font-medium text-gray-500 ml-1">
                      {networkCtx.activeNetwork.value === "xrpl" ? "XRP" : "XAH"}
                    </span>
                  </p>
                </div>
                <div class="bg-white rounded-xl p-4 border border-blue-100 shadow-sm">
                  <p class="text-sm text-gray-500 font-medium mb-1">Sequence</p>
                  <p class="text-2xl font-bold text-gray-900">
                    {account.value.Sequence.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Tokens Card */}
            <div class="card square-card">
              <div class="header flex justify-between items-center bg-white border-b-0 pb-0 pt-6">
                <span class="text-lg text-gray-900">Assets</span>
                <span class="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs">
                  {lines.value.length} Total
                </span>
              </div>
              <div class="body pt-4">
                {lines.value.length > 0 ? (
                  lines.value.map((l, i) => (
                    <div key={i} class="token-item hover:bg-gray-50 transition">
                      <img
                        src={l.icon}
                        alt=""
                        width={24}
                        height={24}
                        class="token-icon"
                        onError$={(e) => {
                          (e.target as HTMLImageElement).src =
                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239ca3af'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z'/%3E%3C/svg%3E";
                        }}
                      />
                      <div class="token-info">
                        <div class="flex justify-between items-baseline">
                          <p class="token-currency truncate">
                            {(() => {
                              let c = l.currency;
                              if (c.length === 40) {
                                try {
                                  c = Buffer.from(c, "hex")
                                    .toString()
                                    .replace(/\0/g, "");
                                } catch {
                                  /* ignore */
                                }
                              }
                              return c;
                            })()}
                          </p>
                          <p class="token-balance">
                            {Number(l.balance).toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })}
                          </p>
                        </div>
                        <p class="token-issuer">{truncate(l.peer)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div class="h-full flex items-center justify-center text-gray-400 text-sm">
                    No tokens found
                  </div>
                )}
              </div>
            </div>

            {/* Transactions Card */}
            <div class="card txs account-tokens-row">
              <div class="header bg-white pt-6 border-b-0">
                <span class="text-lg text-gray-900">Recent Activity</span>
              </div>
              <div class="body">
                {txs.value.length > 0 ? (
                  <table class="tx-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Details</th>
                        <th class="text-right">Hash</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txs.value.map((t, i) => (
                        <tr key={i}>
                          <td>
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {t.TransactionType}
                            </span>
                          </td>
                          <td>
                            <span
                              class={
                                t.meta?.TransactionResult === "tesSUCCESS"
                                  ? "text-emerald-600 font-medium"
                                  : "text-red-500 font-medium"
                              }
                            >
                              {t.meta?.TransactionResult === "tesSUCCESS"
                                ? "Success"
                                : "Failed"}
                            </span>
                          </td>
                          <td>
                            {t.TransactionType === "Payment" && (
                              <span
                                class={
                                  t.Account === account.value?.Account
                                    ? "text-red-500"
                                    : "text-emerald-600"
                                }
                              >
                                {t.Account === account.value?.Account
                                  ? "-"
                                  : "+"}
                                {formatAmount(
                                  t.Amount,
                                  networkCtx.activeNetwork.value === "xrpl" ? "XRP" : "XAH",
                                )}
                              </span>
                            )}
                            {t.TransactionType === "NFTokenMint" && (
                              <span class="text-blue-600 text-xs font-medium flex items-center gap-1">
                                <svg
                                  class="w-3 h-3"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                                  <path
                                    fill-rule="evenodd"
                                    d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                                    clip-rule="evenodd"
                                  />
                                </svg>
                                Minted
                              </span>
                            )}
                          </td>
                          <td class="text-right">
                            <a
                              href={
                                networkCtx.activeNetwork.value === "xrpl"
                                  ? `https://livenet.xrpl.org/transactions/${t.hash}`
                                  : `https://explorer.xahau.network/tx/${t.hash}`
                              }
                              target="_blank"
                              class="text-blue-600 hover:text-blue-800 hover:underline font-mono text-xs"
                            >
                              {truncate(t.hash)}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div class="p-8 text-center text-gray-500">
                    No recent transactions
                  </div>
                )}
              </div>
            </div>

            {/* Complete NFT Portfolio Redesign */}
            <div class="card nft-card-wrapper mt-6 shadow-md border-gray-200">
              <div class="header bg-white px-6 py-5 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 class="text-xl font-bold text-gray-900">NFT Portfolio</h3>
                  <p class="text-sm text-gray-500 mt-1">
                    {marketData.value?.totalNfts || 0} Assets •{" "}
                    {marketData.value?.listedCount || 0} Listed
                  </p>
                </div>

                <div class="flex items-center gap-3 w-full sm:w-auto">
                  <div class="relative flex-1 sm:w-64">
                    <svg
                      class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search NFTs..."
                      value={searchQuery.value}
                      onInput$={(e) => {
                        searchQuery.value = (
                          e.target as HTMLInputElement
                        ).value;
                        
                      }}
                      class="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                    />
                  </div>
                  <button
                    class="p-2 bg-gray-50 border border-gray-200 rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
                    title="Refresh Portfolio"
                    onClick$={() => {
                      if (account.value) fetchNfts(account.value.Account);
                    }}
                  >
                    <svg
                      class={["w-4 h-4", loading.value && "animate-spin"].join(
                        " ",
                      )}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Enhanced Tabs */}
              <div class="nft-tabs">
                <button
                  class={["nft-tab", nftTab.value === "owned" && "active"].join(
                    " ",
                  )}
                  onClick$={() => {
                    nftTab.value = "owned";
                    
                  }}
                >
                  Owned ({marketData.value?.totalNfts || 0})
                </button>
                <button
                  class={[
                    "nft-tab",
                    nftTab.value === "offers-created" && "active",
                  ].join(" ")}
                  onClick$={() => {
                    nftTab.value = "offers-created";
                    
                  }}
                >
                  Listed ({marketData.value?.listedCount || 0})
                </button>
                <button
                  class={[
                    "nft-tab",
                    nftTab.value === "offers-received" && "active",
                  ].join(" ")}
                  onClick$={() => {
                    nftTab.value = "offers-received";
                    
                  }}
                >
                  Offers Received
                </button>
                <button
                  class={["nft-tab", nftTab.value === "sold" && "active"].join(
                    " ",
                  )}
                  onClick$={() => {
                    nftTab.value = "sold";
                    
                  }}
                >
                  Activity
                </button>
              </div>

              {/* Grid View */}
              <div class="nft-scroll-body bg-gray-50/50">
                {loading.value ? (
                  <div class="flex flex-col justify-center items-center py-20">
                    <div class="spinner border-blue-500"></div>
                    <p class="mt-4 text-gray-500 font-medium">
                      Loading assets...
                    </p>
                  </div>
                ) : filtered.value.length > 0 ? (
                  <>
                    <div class="nft-grid">
                      {paginated.value.map((nft) => (
                        <div
                          key={nft.nftokenId}
                          class="nft-item group"
                          onClick$={() => {
                            selectedNft.value = nft;
                          }}
                        >
                          <div class="nft-image-wrapper">
                            <img
                              src={nft.image || FALLBACK_IMG}
                              alt={nft.name}
                              width={128} height={128}
                              loading="lazy"
                              onError$={(e) => {
                                (e.target as HTMLImageElement).src =
                                  FALLBACK_IMG;
                              }}
                            />
                            {/* Badges Overlay */}
                            <div class="absolute top-2 left-2 flex flex-col gap-1">
                              {nft.sellOffers && nft.sellOffers.length > 0 && (
                                <span class="bg-blue-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                                  Listed:{" "}
                                  {formatAmount(
                                    nft.sellOffers[0].amount,
                                    networkCtx.activeNetwork.value === "xrpl" ? "XRP" : "XAH",
                                  )}
                                </span>
                              )}
                              {nft.buyOffers && nft.buyOffers.length > 0 && (
                                <span class="bg-emerald-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                                  Top Offer:{" "}
                                  {formatAmount(
                                    nft.buyOffers[0].amount,
                                    networkCtx.activeNetwork.value === "xrpl" ? "XRP" : "XAH",
                                  )}
                                </span>
                              )}
                            </div>
                            {/* Transfer fee badge */}
                            {nft.transferFee > 0 && (
                              <div class="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded">
                                {(nft.transferFee / 1000).toFixed(1)}% Royalty
                              </div>
                            )}
                          </div>
                          <div class="p-4 bg-white">
                            <div class="text-xs text-blue-600 font-medium mb-1 truncate">
                              {nft.collection}
                            </div>
                            <h4 class="font-bold text-gray-900 text-sm truncate mb-2">
                              {nft.name}
                            </h4>
                            <div class="flex justify-between items-center text-xs">
                              <span class="text-gray-500 font-mono">
                                #{nft.serial}
                              </span>
                              <span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px]">
                                Taxon {nft.taxon}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {marketData.value?.marker && (
    <div class="mt-8 flex justify-center items-center">
      <button
        class="px-6 py-2 bg-blue-50 text-blue-600 font-medium rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50"
        disabled={loadingMore.value}
        onClick$={() => account.value && fetchNfts(account.value.Account, true)}
      >
        {loadingMore.value ? "Loading..." : "Load More"}
      </button>
    </div>
  )}
                  </>
                ) : (
                  <div class="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                    <svg
                      class="w-16 h-16 text-gray-300 mx-auto mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p class="text-gray-500 text-lg font-medium">
                      No NFTs found
                    </p>
                    <p class="text-gray-400 text-sm mt-1">
                      {searchQuery.value
                        ? "Try adjusting your search filters."
                        : "This account doesn't own any matching assets."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── NFT Details Modal ── */}
            {selectedNft.value && (
              <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div
                  class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
                  onClick$={() => {
                    selectedNft.value = null;
                    showOfferModal.value = false;
                  }}
                />
                <div class="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row">
                  {/* Close button */}
                  <button
                    class="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 text-gray-800 transition-colors"
                    onClick$={() => {
                      selectedNft.value = null;
                      showOfferModal.value = false;
                    }}
                  >
                    <svg
                      class="w-5 h-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>

                  {/* Left side: Image */}
                  <div class="w-full md:w-1/2 bg-gray-50 flex items-center justify-center p-8 border-r">
                    <img
                      src={selectedNft.value.image || FALLBACK_IMG}
                      width={600}
                      height={600}
                      class="max-w-full max-h-[50vh] md:max-h-[80vh] object-contain rounded-lg shadow-lg"
                      alt={selectedNft.value.name}
                      onError$={(e) => {
                        (e.target as HTMLImageElement).src = FALLBACK_IMG;
                      }}
                    />
                  </div>

                  {/* Right side: Details */}
                  <div class="w-full md:w-1/2 flex flex-col h-full max-h-[50vh] md:max-h-[90vh]">
                    <div class="p-6 md:p-8 flex-1 overflow-y-auto">
                      
                      <div class="text-sm font-bold text-blue-600 mb-2 uppercase tracking-wide">
                        {selectedNft.value.collection}
                      </div>
                      <h2 class="text-3xl font-extrabold text-gray-900 mb-6 leading-tight">
                        {selectedNft.value.name}
                      </h2>

                      <div class="grid grid-cols-2 gap-4 mb-8">
                        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                          <p class="text-xs text-gray-500 uppercase font-semibold mb-1">
                            Owner
                          </p>
                          <p class="font-mono text-sm text-gray-900 break-all">
                            {truncateAddress(selectedNft.value.owner)}
                          </p>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                          <p class="text-xs text-gray-500 uppercase font-semibold mb-1">
                            Issuer
                          </p>
                          <p class="font-mono text-sm text-gray-900 break-all">
                            {truncateAddress(selectedNft.value.issuer)}
                          </p>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                          <p class="text-xs text-gray-500 uppercase font-semibold mb-1">
                            Taxon
                          </p>
                          <p class="font-semibold text-gray-900">
                            {selectedNft.value.taxon}
                          </p>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                          <p class="text-xs text-gray-500 uppercase font-semibold mb-1">
                            Royalty
                          </p>
                          <p class="font-semibold text-gray-900">
                            {(selectedNft.value.transferFee / 1000).toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      {/* Offers Section */}
                      <div class="mb-6">
                        <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <svg
                            class="w-5 h-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                            />
                          </svg>
                          Active Listings
                        </h3>
                        {selectedNft.value.sellOffers?.length > 0 ? (
                          <div class="space-y-3">
                            {selectedNft.value.sellOffers.map((offer, idx) => (
                              <div
                                key={idx}
                                class="flex items-center justify-between p-4 rounded-xl border border-blue-100 bg-blue-50/50"
                              >
                                <div>
                                  <p class="text-2xl font-bold text-blue-600">
                                    {formatAmount(
                                      offer.amount,
                                      networkCtx.activeNetwork.value === "xrpl" ? "XRP" : "XAH",
                                    )}
                                  </p>
                                  <p class="text-xs text-gray-500 mt-1">
                                    Listed by {truncate(offer.owner)}
                                  </p>
                                </div>
                                <button class="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition-all transform hover:-translate-y-0.5">
                                  Buy Now
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div class="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                            <p class="text-gray-500 text-sm">
                              Not currently listed for sale
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Token ID */}
                      <div class="mt-8 pt-6 border-t border-gray-100">
                        <p class="text-xs text-gray-500 uppercase font-semibold mb-2">
                          Token ID
                        </p>
                        <div class="bg-gray-100 p-3 rounded-lg flex items-center justify-between">
                          <code class="text-xs text-gray-600 break-all select-all">
                            {selectedNft.value.nftokenId}
                          </code>
                          <button
                            class="ml-3 p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors"
                            onClick$={() =>
                              navigator.clipboard.writeText(
                                selectedNft.value!.nftokenId,
                              )
                            }
                            title="Copy ID"
                          >
                            <svg
                              class="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    
                      
                      <div class="mt-8">
                        <h3 class="text-lg font-bold text-gray-900 mb-4">Transaction History</h3>
                        {loadingHistory.value ? (
                          <div class="flex justify-center py-8">
                            <div class="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                          </div>
                        ) : nftHistory.value.length === 0 ? (
                          <p class="text-sm text-gray-500 text-center py-4">No history found</p>
                        ) : (
                          <div class="space-y-3">
                            {nftHistory.value.map((tx: any) => (
                              <div key={tx.tx?.hash || tx.hash} class="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                                <div>
                                  <span class="text-xs font-bold uppercase text-gray-500">{tx.tx?.TransactionType || 'Unknown'}</span>
                                  <p class="text-sm text-gray-900 font-mono mt-0.5">{truncate(tx.tx?.Account || tx.Account)}</p>
                                </div>
                                <div class="text-right">
                                  {tx.tx?.Amount && (
                                    <p class="text-sm font-bold text-blue-600">
                                      {formatAmount(tx.tx.Amount, networkCtx.activeNetwork.value === "xrpl" ? "XRP" : "XAH")}
                                    </p>
                                  )}
                                  <p class="text-xs text-gray-400 mt-0.5">Lgr {tx.tx?.ledger_index || tx.ledger_index}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div class="p-6 border-t bg-gray-50 rounded-br-2xl flex gap-3">
                      {walletCtx.connected.value && (
                        <button
                          class="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 shadow-sm transition-colors"
                          onClick$={() => (showOfferModal.value = true)}
                        >
                          Make Offer
                        </button>
                      )}
                      {walletCtx.connected.value &&
                        selectedNft.value.owner === account.value?.Account && (
                          <button class="flex-1 px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-sm transition-colors">
                            List for Sale
                          </button>
                        )}
                    </div>
                  </div>
                </div>

                {/* nested Make Offer modal */}
                {showOfferModal.value && (
                  <div class="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative">
                      <button
                        class="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                        onClick$={() => (showOfferModal.value = false)}
                      >
                        ✕
                      </button>
                      <h3 class="text-xl font-bold mb-4">Make an Offer</h3>
                      <p class="text-sm text-gray-500 mb-4">
                        Enter the amount you want to offer for "
                        {selectedNft.value.name}".
                      </p>

                      <div class="relative mb-6">
                        <input
                          type="number"
                          value={offerAmount.value}
                          onInput$={(e) =>
                            (offerAmount.value = (
                              e.target as HTMLInputElement
                            ).value)
                          }
                          class="w-full text-2xl font-bold p-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16"
                          placeholder="0.00"
                        />
                        <div class="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">
                          {networkCtx.activeNetwork.value === "xrpl" ? "XRP" : "XAH"}
                        </div>
                      </div>

                      <button class="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md transition-all active:scale-95 disabled:opacity-50">
                        Sign Offer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

import {
  component$,
  useSignal,
  useTask$,
  useStylesScoped$,
  useComputed$,
  $,
} from "@builder.io/qwik";
import { useWalletContext, truncateAddress } from "~/context/wallet-context";
import { useNetworkContext } from "~/context/network-context";

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

// Get token icon from currency code

const getTokenIcon = (currency: string, issuer: string) => {
  // Check if it's a hex currency code
  if (currency.length === 40) {
    try {
      const decoded = Buffer.from(currency, "hex")
        .toString("utf-8")
        .replace(/\0/g, "");
      currency = decoded;
    } catch (e) {
      console.error("Failed to decode currency:", e); // Log the error
      // Keeps original currency if decode fails
    }
  }

  // Use a token icon service or return a default icon
  return `https://cdn.bithomp.com/issued-token/${issuer}/${currency}/.png/jpeg/icon`;
};

const formatDate = (dateInput?: string | number) => {
  if (!dateInput) return "—";

  let date: Date;
  if (typeof dateInput === "number") {
    // XRPL epoch (946684800 seconds between Unix and Ripple epoch)
    date = new Date((dateInput + 946684800) * 1000);
  } else {
    date = new Date(dateInput);
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
};

// ────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────
export default component$(() => {
  const wallet = useWalletContext();
  const { activeNetwork } = useNetworkContext();

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
  const pageSize = 24;

  // NFT Tab state
  const nftTab = useSignal<
    "owned" | "sold" | "offers-created" | "offers-received"
  >("owned");

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

  // NFT count by tab
  const nftCounts = useComputed$(() => {
    const owned = nfts.value.length;
    const offersCreated = nfts.value.filter(
      (nft) => nft.sellOffers && nft.sellOffers.length > 0,
    ).length;
    const offersReceived = nfts.value.filter(
      (nft) => nft.buyOffers && nft.buyOffers.length > 0,
    ).length;

    return {
      owned,
      sold: 0, // Would need transaction history
      offersCreated,
      offersReceived,
    };
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
                    <div class="flex items-center justify-center py-10">
                      <div class="spinner" />
                    </div>
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

                      {account.value.EmailHash && (
                        <div style={{ marginBottom: "0.75rem" }}>
                          <strong
                            style={{
                              color: "#6b7280",
                              fontSize: "0.75rem",
                              display: "block",
                              marginBottom: "0.25rem",
                            }}
                          >
                            EMAIL HASH
                          </strong>
                          <span
                            style={{
                              fontSize: "0.875rem",
                              wordBreak: "break-all",
                            }}
                          >
                            {account.value.EmailHash}
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
                          FLAGS
                        </strong>
                        <span style={{ fontSize: "0.875rem" }}>
                          {account.value.Flags}
                        </span>
                      </div>

                      {account.value.LedgerEntryType && (
                        <div style={{ marginBottom: "0.75rem" }}>
                          <strong
                            style={{
                              color: "#6b7280",
                              fontSize: "0.75rem",
                              display: "block",
                              marginBottom: "0.25rem",
                            }}
                          >
                            LEDGER ENTRY TYPE
                          </strong>
                          <span style={{ fontSize: "0.875rem" }}>
                            {account.value.LedgerEntryType}
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
                          OWNER COUNT
                        </strong>
                        <span style={{ fontSize: "0.875rem" }}>
                          {account.value.OwnerCount}
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
                          PREVIOUS TXN ID
                        </strong>
                        <span
                          style={{
                            fontSize: "0.8125rem",
                            wordBreak: "break-all",
                            display: "block",
                            fontFamily: "monospace",
                          }}
                        >
                          {truncate(account.value.PreviousTxnID)}
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
                          PREVIOUS TXN LEDGER SEQ
                        </strong>
                        <span style={{ fontSize: "0.875rem" }}>
                          {account.value.PreviousTxnLgrSeq}
                        </span>
                      </div>

                      {account.value.RegularKey && (
                        <div style={{ marginBottom: "0.75rem" }}>
                          <strong
                            style={{
                              color: "#6b7280",
                              fontSize: "0.75rem",
                              display: "block",
                              marginBottom: "0.25rem",
                            }}
                          >
                            REGULAR KEY
                          </strong>
                          <span
                            style={{
                              fontSize: "0.8125rem",
                              wordBreak: "break-all",
                              display: "block",
                              fontFamily: "monospace",
                            }}
                          >
                            {account.value.RegularKey}
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

                      {account.value.index && (
                        <div style={{ marginBottom: "0.75rem" }}>
                          <strong
                            style={{
                              color: "#6b7280",
                              fontSize: "0.75rem",
                              display: "block",
                              marginBottom: "0.25rem",
                            }}
                          >
                            INDEX
                          </strong>
                          <span
                            style={{
                              fontSize: "0.8125rem",
                              wordBreak: "break-all",
                              display: "block",
                              fontFamily: "monospace",
                            }}
                          >
                            {truncate(account.value.index)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Tokens & Trustlines */}
              <div class="card square-card">
                <div class="header">
                  {!account.value ? (
                    "TOKENS"
                  ) : (
                    <>
                      {lines.value.length} TOKENS{" "}
                      {wallet.connected.value && (
                        <a
                          href="#"
                          style={{ color: "#3b82f6", fontSize: "0.75rem" }}
                        >
                          [SIGN IN]
                        </a>
                      )}
                    </>
                  )}
                </div>
                <div class="body">
                  {!account.value ? (
                    <div class="flex items-center justify-center py-10">
                      <div class="spinner" />
                    </div>
                  ) : lines.value.length === 0 ? (
                    <div>No tokens or trustlines</div>
                  ) : (
                    lines.value.map((l, i) => (
                      <div key={i} class="token-item">
                        <img
                          height={100}
                          width={100}
                          src={l.icon || FALLBACK_IMG}
                          alt={l.currency}
                          class="token-icon"
                          onError$={(e: any) => {
                            e.target.src = FALLBACK_IMG;
                          }}
                        />
                        <div class="token-info">
                          <div class="token-currency">{l.currency}</div>
                          <div class="token-issuer">{truncate(l.peer)}</div>
                        </div>
                        <div class="token-balance">
                          {Number(l.balance).toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Transaction History - full width */}
            <div class="card txs" style={{ gridColumn: "1 / -1" }}>
              <div class="header">
                {!account.value ? (
                  "TRANSACTIONS"
                ) : (
                  <>
                    LAST {txs.value.length} TRANSACTIONS{" "}
                    <a
                      href="#"
                      style={{ color: "#3b82f6", fontSize: "0.75rem" }}
                    >
                      [VIEW ALL]
                    </a>
                  </>
                )}
              </div>
              <div class="body">
                {!account.value ? (
                  <div
                    style={{
                      padding: "1.5rem",
                      textAlign: "center",
                      color: "#6b7280",
                    }}
                  >
                    <div class="flex items-center justify-center py-10">
                      <div class="spinner" />
                    </div>
                  </div>
                ) : txs.value.length === 0 ? (
                  <div
                    style={{
                      padding: "1.5rem",
                      textAlign: "center",
                      color: "#6b7280",
                    }}
                  >
                    No recent transactions
                  </div>
                ) : (
                  <table class="tx-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Validated</th>
                        <th>Type</th>
                        <th>Hash</th>
                        <th>Changes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txs.value.map((t, i) => (
                        <tr key={i}>
                          <td>
                            <span class="tx-status">✓</span>
                          </td>
                          <td>{formatDate(t.date)}</td>
                          <td class="tx-type">{t.TransactionType}</td>
                          <td>
                            <a
                              href={`https://${network.value === "xrpl" ? "livenet" : "xahau"}.xrpl.org/transactions/${t.hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="tx-hash"
                            >
                              {truncate(t.hash)}
                            </a>
                          </td>
                          <td>
                            {t.TransactionType === "NFTokenAcceptOffer" &&
                              t.NFTokenID && (
                                <div class="tx-nft-added">
                                  NFT added: {truncate(t.NFTokenID)}
                                </div>
                              )}
                            {t.Amount && (
                              <span
                                class={
                                  t.Account === debounced.value
                                    ? "tx-change-negative"
                                    : "tx-change-positive"
                                }
                              >
                                {t.Account === debounced.value ? "-" : "+"}
                                {formatAmount(
                                  t.Amount,
                                  network.value === "xrpl" ? "XRP" : "XAH",
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* NFTs Card - full width with tabs, filtering and pagination */}
            <div class="card nft-card-wrapper">
              <div class="header">
                {nftCounts.value.owned} OWNED NFTS{" "}
                <a href="#" style={{ color: "#3b82f6", fontSize: "0.75rem" }}>
                  [VIEW ALL]
                </a>
              </div>

              {/* NFT Tabs */}
              <div class="nft-tabs">
                <button
                  class={`nft-tab ${nftTab.value === "owned" ? "active" : ""}`}
                  onClick$={() => {
                    nftTab.value = "owned";
                    currentPage.value = 1;
                  }}
                >
                  Owned ({nftCounts.value.owned})
                </button>
                <button
                  class={`nft-tab ${nftTab.value === "sold" ? "active" : ""}`}
                  onClick$={() => {
                    nftTab.value = "sold";
                    currentPage.value = 1;
                  }}
                >
                  Sold ({nftCounts.value.sold})
                </button>
                <button
                  class={`nft-tab ${nftTab.value === "offers-created" ? "active" : ""}`}
                  onClick$={() => {
                    nftTab.value = "offers-created";
                    currentPage.value = 1;
                  }}
                >
                  Offers Created ({nftCounts.value.offersCreated})
                </button>
                <button
                  class={`nft-tab ${nftTab.value === "offers-received" ? "active" : ""}`}
                  onClick$={() => {
                    nftTab.value = "offers-received";
                    currentPage.value = 1;
                  }}
                >
                  Offers Received ({nftCounts.value.offersReceived})
                </button>
              </div>

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
                    {paginated.value.map((nft) => (
                      <div
                        key={nft.nftokenId}
                        class="nft-item"
                        onClick$={() => (selectedNft.value = nft)}
                      >
                        <div class="nft-image-wrapper">
                          <img
                            src={nft.image || PLACEHOLDER_IMG}
                            alt={nft.name}
                            width={200}
                            height={200}
                            loading="eager"
                            decoding="async"
                            onError$={(e: any) => {
                              e.target.src = PLACEHOLDER_IMG;
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!loading.value &&
                filtered.value.length === 0 &&
                nfts.value.length === 0 && (
                  <div class="text-center py-20 text-gray-400">
                    <div class="text-6xl mb-4">🖼️</div>
                    <p class="text-lg">
                      {nftTab.value === "owned" && "This account has no NFTs"}
                      {nftTab.value === "sold" && "No sold NFTs found"}
                      {nftTab.value === "offers-created" &&
                        "No sell offers created"}
                      {nftTab.value === "offers-received" &&
                        "No buy offers received"}
                    </p>
                  </div>
                )}

              {!loading.value &&
                filtered.value.length === 0 &&
                nfts.value.length > 0 && (
                  <div class="text-center py-20 text-gray-400">
                    <div class="text-6xl mb-4">🔍</div>
                    <p class="text-lg">No NFTs match your filters</p>
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

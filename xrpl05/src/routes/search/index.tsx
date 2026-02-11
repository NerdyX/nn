import {
  component$,
  useSignal,
  useTask$,
  useStylesScoped$,
  useComputed$,
} from "@builder.io/qwik";

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

interface NFTView {
  id: string;
  nftokenId: string;
  issuer: string;
  taxon: number;
  image: string;
  name: string;
  collection: string;
  description?: string;
  attributes?: Array<{ trait_type: string; value: any }>;
  uri?: string;
}

// ────────────────────────────────────────────────
// Helpers
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

// ────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────
export default component$(() => {
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

    /* NFT Dropdown Filter */
    .nft-filter-dropdown {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #e5e7eb;
      background: #fafbfc;
    }

    .filter-select {
      width: 100%;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      border: 1px solid #d1d5db;
      background: white;
      font-size: 0.9375rem;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      outline: none;
      transition: all 0.2s;
    }

    .filter-select:hover {
      border-color: #3b82f6;
    }

    .filter-select:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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

    .nft {
      border-radius: 1.5rem;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      background: white;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .nft:hover {
      border-color: #3b82f6;
      box-shadow: 0 20px 40px rgba(0,0,0,0.12);
      transform: translateY(-4px);
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
      transition: transform 0.5s ease;
    }

    .nft:hover .nft-image-wrapper img {
      transform: scale(1.1);
    }

    .nft-badge {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      background: #3b82f6;
      color: white;
      font-size: 0.6875rem;
      font-weight: 700;
      padding: 0.375rem 0.625rem;
      border-radius: 9999px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }

    .nft-info {
      padding: 1rem;
      background: white;
    }

    .nft-name {
      font-size: 0.9375rem;
      font-weight: 700;
      color: #111827;
      margin-bottom: 0.25rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .nft-collection {
      font-size: 0.75rem;
      color: #3b82f6;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-top: 0.125rem;
    }

    /* NFT Modal */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 2rem;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-content {
      background: white;
      border-radius: 1.5rem;
      max-width: 900px;
      width: 100%;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 50px rgba(0,0,0,0.3);
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .modal-header {
      padding: 1.5rem 2rem;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f9fafb;
    }

    .modal-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #111827;
    }

    .modal-close {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.5rem;
      border: none;
      background: white;
      color: #6b7280;
      font-size: 1.5rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .modal-close:hover {
      background: #f3f4f6;
      color: #111827;
    }

    .modal-body {
      padding: 2rem;
      overflow-y: auto;
      flex: 1;
    }

    .modal-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }

    .modal-image {
      width: 100%;
      border-radius: 1rem;
      border: 1px solid #e5e7eb;
    }

    .modal-details {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .detail-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .detail-label {
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #6b7280;
      letter-spacing: 0.05em;
    }

    .detail-value {
      font-size: 0.875rem;
      color: #111827;
      word-break: break-all;
      line-height: 1.5;
    }

    .detail-box {
      background: #f9fafb;
      border-radius: 0.75rem;
      padding: 0.75rem;
      border: 1px solid #e5e7eb;
    }

    .detail-box .detail-label {
      font-size: 0.6875rem;
      color: #6b7280;
      margin-bottom: 0.25rem;
    }

    .detail-box .detail-value {
      font-size: 0.8125rem;
      font-family: monospace;
      font-weight: 500;
      color: #374151;
    }

    .attributes-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
      margin-top: 0.5rem;
    }

    .attribute-card {
      padding: 0.75rem;
      background: #f9fafb;
      border-radius: 0.5rem;
      border: 1px solid #e5e7eb;
    }

    .attribute-label {
      font-size: 0.75rem;
      color: #6b7280;
      margin-bottom: 0.25rem;
    }

    .attribute-value {
      font-size: 0.875rem;
      font-weight: 600;
      color: #111827;
    }

    .nft-loading-state {
      text-align: center;
      padding: 4rem 0;
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

    .empty-state {
      text-align: center;
      padding: 3rem 0;
      color: #6b7280;
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
      .modal-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .nft-grid {
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      }
      .attributes-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .nft-grid {
        grid-template-columns: 1fr;
      }
      .modal-overlay {
        padding: 1rem;
      }
      .modal-body {
        padding: 1.5rem;
      }
    }
  `);

  const query = useSignal("");
  const debounced = useSignal("");
  const network = useSignal<"xrpl" | "xahau">("xrpl");

  const account = useSignal<AccountRoot | null>(null);
  const lines = useSignal<TokenLine[]>([]);
  const txs = useSignal<Transaction[]>([]);

  const nfts = useSignal<NFTView[]>([]);
  const nftLoaded = useSignal(false);

  const searchQuery = useSignal("");
  const selectedCollection = useSignal<string | null>(null);
  const selectedNFT = useSignal<NFTView | null>(null);

  /* ── Debounce search ── */
  useTask$(({ track, cleanup }) => {
    track(() => query.value);
    const t = setTimeout(() => (debounced.value = query.value.trim()), 500);
    cleanup(() => clearTimeout(t));
  });

  /* ── Load data when address changes ── */
  useTask$(({ track, cleanup }) => {
    track(() => debounced.value);
    if (!debounced.value) return;

    account.value = null;
    lines.value = [];
    txs.value = [];
    nfts.value = [];
    nftLoaded.value = false;
    selectedCollection.value = null;

    const addr = debounced.value;

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
      ws.send(
        JSON.stringify({
          id: id++,
          command: "account_nfts",
          account: addr,
          limit: 200,
        }),
      );
    };

    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.result?.account_data) account.value = m.result.account_data;
      if (m.result?.lines) lines.value = m.result.lines;
      if (m.result?.transactions)
        txs.value = m.result.transactions.map((t: any) => t.tx || t);
      if (m.result?.account_nfts) {
        const promises = m.result.account_nfts.map(async (nft: any) => {
          const metaUrl = ipfsToHttp(nft.URI);
          let image = FALLBACK_IMG;
          let name = "Unnamed NFT";
          let collection = "Unknown Collection";
          let description: string | undefined;
          let attributes: Array<{ trait_type: string; value: any }> | undefined;

          if (metaUrl && metaUrl !== FALLBACK_IMG) {
            try {
              const meta: any = await fetch(metaUrl).then((r) => r.json());
              if (meta.image) image = ipfsToHttp(meta.image) || FALLBACK_IMG;
              if (meta.name) name = meta.name;
              if (meta.collection) collection = meta.collection;
              // Some metadata uses "collection_name" instead
              if (!collection && meta.collection_name)
                collection = meta.collection_name;
              if (meta.description) description = meta.description;
              if (meta.attributes) attributes = meta.attributes;
            } catch (err) {
              console.warn("Failed to fetch NFT metadata:", metaUrl, err);
            }
          }

          return {
            id: nft.NFTokenID,
            nftokenId: nft.NFTokenID,
            issuer: nft.Issuer,
            taxon: nft.NFTokenTaxon,
            image,
            name,
            collection,
            description,
            attributes,
            uri: metaUrl,
          };
        });

        Promise.all(promises).then((views) => {
          nfts.value = views;
          nftLoaded.value = true;
        });
      }
    };

    cleanup(() => ws.close());
  });

  // Group NFTs by collection
  const nftsByCollection = useComputed$(() => {
    const map = new Map<string, NFTView[]>();

    nfts.value.forEach((nft) => {
      const key = nft.collection;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(nft);
    });

    return map;
  });

  // Get unique collection names for filtering
  const collectionNames = useComputed$(() => {
    return Array.from(nftsByCollection.value.keys()).sort();
  });

  // Filtered NFTs
  const filteredNFTs = useComputed$(() => {
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
                              fontSize: "0.8125rem",
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
                            fontSize: "0.75rem",
                            wordBreak: "break-all",
                            display: "block",
                          }}
                        >
                          {account.value.PreviousTxnID}
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
                              fontSize: "0.75rem",
                              wordBreak: "break-all",
                              display: "block",
                            }}
                          >
                            {account.value.index}
                          </span>
                        </div>
                      )}
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

            {/* NFTs Card - full width with dropdown filtering */}
            <div class="card nft-card-wrapper">
              <div class="header">NFTs ({nfts.value.length})</div>

              {/* Dropdown Filter */}
              {nftLoaded.value && nfts.value.length > 0 && (
                <div class="nft-filter-dropdown">
                  <select
                    class="filter-select"
                    value={selectedCollection.value || ""}
                    onChange$={(e) => {
                      const val = (e.target as HTMLSelectElement).value;
                      selectedCollection.value = val === "" ? null : val;
                    }}
                  >
                    <option value="">
                      All Collections ({nfts.value.length})
                    </option>
                    {collectionNames.value.map((collectionName) => (
                      <option key={collectionName} value={collectionName}>
                        {collectionName} (
                        {String(
                          nftsByCollection.value.get(collectionName)?.length ||
                            0,
                        )}
                        )
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Scrollable NFT Body */}
              <div class="nft-scroll-body">
                {!nftLoaded.value ? (
                  <div class="nft-loading-state">
                    <div class="spinner" />
                    <p style={{ marginTop: "1rem", color: "#6b7280" }}>
                      Loading NFTs...
                    </p>
                  </div>
                ) : nfts.value.length === 0 ? (
                  <div class="empty-state">No NFTs found</div>
                ) : (
                  <div class="nft-grid">
                    {filteredNFTs.value.map((nft) => (
                      <div
                        key={nft.id}
                        class="nft"
                        onClick$={() => (selectedNFT.value = nft)}
                      >
                        <div class="nft-image-wrapper">
                          <img
                            height="100"
                            width="100"
                            src={nft.image}
                            alt={nft.name}
                            loading="lazy"
                            onError$={(e: any) => {
                              e.target.src =
                                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' fill='%23e5e7eb'%3E%3Crect width='400' height='400'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='48' fill='%239ca3af'%3ENFT%3C/text%3E%3C/svg%3E";
                            }}
                          />
                          {nft.collection !== "Unknown Collection" && (
                            <div class="nft-badge">{nft.collection}</div>
                          )}
                        </div>
                        <div class="nft-info">
                          <h3 class="nft-name">{nft.name}</h3>
                          <div class="nft-collection">{nft.collection}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* NFT Modal */}
          {selectedNFT.value && (
            <div
              class="modal-overlay"
              onClick$={() => (selectedNFT.value = null)}
            >
              <div class="modal-content" onClick$={(e) => e.stopPropagation()}>
                <div class="modal-header">
                  <div class="modal-title">{selectedNFT.value.name}</div>
                  <button
                    class="modal-close"
                    onClick$={() => (selectedNFT.value = null)}
                  >
                    ×
                  </button>
                </div>

                <div class="modal-body">
                  <div class="modal-grid">
                    <div>
                      <img
                        height="100"
                        width="100"
                        src={selectedNFT.value.image}
                        alt={selectedNFT.value.name}
                        class="modal-image"
                        onError$={(e: any) => {
                          e.target.src =
                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' fill='%23e5e7eb'%3E%3Crect width='400' height='400'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='48' fill='%239ca3af'%3ENFT%3C/text%3E%3C/svg%3E";
                        }}
                      />
                    </div>

                    <div class="modal-details">
                      <div class="detail-section">
                        <div class="detail-label">Collection</div>
                        <div class="detail-value">
                          {selectedNFT.value.collection}
                        </div>
                      </div>

                      {selectedNFT.value.description && (
                        <div class="detail-section">
                          <div class="detail-label">Description</div>
                          <div class="detail-value">
                            {selectedNFT.value.description}
                          </div>
                        </div>
                      )}

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "0.75rem",
                          marginTop: "0.5rem",
                        }}
                      >
                        <div class="detail-box">
                          <div class="detail-label">Issuer</div>
                          <div
                            class="detail-value"
                            style={{ fontSize: "0.6875rem" }}
                          >
                            {truncate(selectedNFT.value.issuer)}
                          </div>
                        </div>
                        <div class="detail-box">
                          <div class="detail-label">Taxon</div>
                          <div class="detail-value">
                            {selectedNFT.value.taxon}
                          </div>
                        </div>
                      </div>

                      <div class="detail-box" style={{ marginTop: "0.25rem" }}>
                        <div class="detail-label">NFToken ID</div>
                        <div
                          class="detail-value"
                          style={{ fontSize: "0.625rem" }}
                        >
                          {selectedNFT.value.nftokenId}
                        </div>
                      </div>

                      {selectedNFT.value.uri && (
                        <div
                          class="detail-section"
                          style={{ marginTop: "0.5rem" }}
                        >
                          <div class="detail-label">Metadata URI</div>
                          <div
                            class="detail-value"
                            style={{
                              fontSize: "0.6875rem",
                              wordBreak: "break-all",
                            }}
                          >
                            <a
                              href={selectedNFT.value.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: "#3b82f6",
                                textDecoration: "underline",
                              }}
                            >
                              {selectedNFT.value.uri.length > 60
                                ? selectedNFT.value.uri.substring(0, 60) + "..."
                                : selectedNFT.value.uri}
                            </a>
                          </div>
                        </div>
                      )}

                      {selectedNFT.value.attributes &&
                        selectedNFT.value.attributes.length > 0 && (
                          <div
                            class="detail-section"
                            style={{ marginTop: "0.5rem" }}
                          >
                            <div class="detail-label">Attributes</div>
                            <div class="attributes-grid">
                              {selectedNFT.value.attributes.map((attr, i) => (
                                <div key={i} class="attribute-card">
                                  <div class="attribute-label">
                                    {attr.trait_type}
                                  </div>
                                  <div class="attribute-value">
                                    {attr.value}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

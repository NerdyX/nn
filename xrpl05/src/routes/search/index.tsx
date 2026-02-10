import {
  component$,
  useSignal,
  useTask$,
  useStylesScoped$,
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
  date?: string; // added for safety
}

interface NFToken {
  NFTokenID: string;
  Issuer: string;
  URI?: string;
  NFTokenTaxon: number;
}

interface NFTView {
  id: string;
  issuer: string;
  taxon: number;
  image: string;
}

// ────────────────────────────────────────────────
// Constants & Helpers
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

  // Handle hex-encoded URI from XRPL (most common case)
  if (uri.match(/^[0-9A-Fa-f]+$/)) {
    try {
      const bytes = new Uint8Array(
        uri.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)),
      );
      const decoded = new TextDecoder().decode(bytes).trim();

      if (decoded.startsWith("ipfs://")) {
        return `https://ipfs.io/ipfs/${decoded.slice(7)}`;
      }
      if (decoded.startsWith("https://") || decoded.startsWith("http://")) {
        return decoded;
      }
      // Raw CID
      if (decoded.startsWith("Qm") || decoded.startsWith("bafy")) {
        return `https://ipfs.io/ipfs/${decoded}`;
      }
    } catch (e) {
      console.warn("Failed to decode hex URI:", uri, e);
    }
  }

  // Direct URI
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
    }

    /* ── Search ── */
    .top {
      position: sticky;
      top: var(--gap);
      z-index: 20;
      background: white;
    }

    .search {
      max-width: 1100px;
      margin: 0 auto;
      padding: 1.5rem 1rem;
      display: flex;
      gap: .75rem;
    }

    input, select {
      padding: 1.25rem 1.75rem;
      border-radius: 999px;
      border: 1px solid #e5e7eb;
      font-size: 1.125rem;
    }

    input { flex: 1; }

    /* ── Tabs ── */
    .tabs {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 1rem;
      display: flex;
      gap: 1.5rem;
      border-bottom: 1px solid #eee;
    }

    .tabs button {
      padding: .75rem 0;
      font-size: .875rem;
      font-weight: 500;
      background: none;
      border: none;
      cursor: pointer;
      color: #6b7280;
      border-bottom: 2px solid transparent;
    }

    .tabs button.active {
      color: #111827;
      border-bottom-color: #111827;
    }

    /* ── Bento Grid ── */
    .bento {
      max-width: 1280px;
      margin: 0 auto;
      padding: 3rem 1rem;
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 1.25rem;
    }

    .account { grid-column: 1; }
    .tokens  { grid-column: 2; max-height: 520px; overflow-y: auto; }
    .txs     { grid-column: 1 / -1; }

    .account-header {
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 999px;
      border: 1px solid #eee;
    }

    .title {
      font-weight: 600;
    }

    .sub {
      font-size: .75rem;
      color: #6b7280;
    }

    /* ── Cards ── */
    .card {
      border: 1px solid #f1f1f1;
      border-radius: 1.25rem;
      background: white;
    }

    .header {
      padding: 1rem 1.25rem;
      font-size: .75rem;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: #6b7280;
      border-bottom: 1px solid #f3f4f6;
    }

    .body { padding: 1.25rem; }

    /* ── NFT Grid ── */
    .nft-wrap {
      max-width: 1280px;
      margin: 0 auto;
      padding: 2rem 1rem 4rem;
    }

    .collection {
      margin-bottom: 2rem;
    }

    .collection h3 {
      font-size: .875rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: .75rem;
    }

    .nft-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.25rem;
    }

    .nft {
      aspect-ratio: 1 / 1;
      border-radius: 1rem;
      overflow: hidden;
      border: 1px solid #eee;
      background: #fafafa;
    }

    .nft img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .txs .body::-webkit-scrollbar {
      width: 6px;
    }
    .txs .body::-webkit-scrollbar-thumb {
      background: #e5e7eb;
      border-radius: 999px;
    }

    .txs .body {
      max-height: 360px;
      overflow-y: auto;
      padding-right: .25rem;
    }

    .tx-row {
      display: flex;
      justify-content: space-between;
      font-size: .75rem;
      padding: .4rem 0;
      border-bottom: 1px solid #f3f4f6;
    }

    @media (max-width: 1024px) {
      .bento { grid-template-columns: 1fr; }
      .tokens { max-height: none; }
      .nft-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 640px) {
      .nft-grid { grid-template-columns: 1fr; }
    }
  `);

  /* ── State ── */
  const query = useSignal("");
  const debounced = useSignal("");
  const network = useSignal<"xrpl" | "xahau">("xrpl");
  const tab = useSignal<"info" | "nfts">("info");

  const account = useSignal<AccountRoot | null>(null);
  const lines = useSignal<TokenLine[]>([]);
  const txs = useSignal<Transaction[]>([]);

  const nfts = useSignal<NFTView[]>([]);
  const nftLoaded = useSignal(false);

  /* ── Debounce ── */
  useTask$(({ track, cleanup }) => {
    track(() => query.value);
    const t = setTimeout(() => (debounced.value = query.value.trim()), 400);
    cleanup(() => clearTimeout(t));
  });

  /* ── Info WS ── */
  useTask$(({ track, cleanup }) => {
    track(() => [debounced.value, network.value]);
    if (!debounced.value) return;

    account.value = null;
    lines.value = [];
    txs.value = [];
    nftLoaded.value = false;
    nfts.value = [];

    const ws = new WebSocket(network.value === "xrpl" ? XRPL_WS : XAHAU_WS);
    let id = 1;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          id: id++,
          command: "account_info",
          account: debounced.value,
        }),
      );
      ws.send(
        JSON.stringify({
          id: id++,
          command: "account_lines",
          account: debounced.value,
        }),
      );
      ws.send(
        JSON.stringify({
          id: id++,
          command: "account_tx",
          account: debounced.value,
          limit: 50,
        }),
      );
    };

    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.result?.account_data) account.value = m.result.account_data;
      if (m.result?.lines)
        lines.value = m.result.lines.map((l: any) => ({
          ...l,
          type: Number(l.balance) > 0 ? "token" : "trustline",
        }));
      if (m.result?.transactions)
        txs.value = m.result.transactions.map((t: any) => t.tx || t);
    };

    cleanup(() => ws.close());
  });

  /* ── Lazy NFT Fetch ── */
  useTask$(async ({ track }) => {
    track(() => tab.value);
    if (tab.value !== "nfts" || nftLoaded.value || !debounced.value) return;

    nftLoaded.value = true;

    const ws = new WebSocket(network.value === "xrpl" ? XRPL_WS : XAHAU_WS);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          id: 1,
          command: "account_nfts",
          account: debounced.value,
          limit: 200, // increase if you want more NFTs loaded
        }),
      );
    };

    ws.onmessage = async (e) => {
      const m = JSON.parse(e.data);
      if (!m.result?.account_nfts) return;

      const views: NFTView[] = [];

      for (const nft of m.result.account_nfts as NFToken[]) {
        const metaUrl = ipfsToHttp(nft.URI);
        let image = FALLBACK_IMG;

        if (metaUrl) {
          try {
            const meta = await fetch(metaUrl).then((r) => r.json());
            if (meta.image) {
              image = ipfsToHttp(meta.image) || FALLBACK_IMG;
            }
          } catch (err) {
            console.warn("Failed to fetch NFT metadata:", metaUrl, err);
          }
        }

        views.push({
          id: nft.NFTokenID,
          issuer: nft.Issuer,
          taxon: nft.NFTokenTaxon,
          image,
        });
      }

      nfts.value = views;
      ws.close();
    };
  });

  /* ── Group NFTs by issuer + taxon ── */
  const collections = () => {
    const map = new Map<string, NFTView[]>();
    for (const nft of nfts.value) {
      const key = `${truncate(nft.issuer)} · Taxon ${nft.taxon}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(nft);
    }
    return [...map.entries()];
  };

  /* ── Render ── */
  return (
    <div class="page">
      <div class="top">
        <div class="search">
          <select
            value={network.value}
            onChange$={(e) =>
              (network.value = (e.target as HTMLSelectElement).value as any)
            }
          >
            <option value="xrpl">XRPL</option>
            <option value="xahau">Xahau</option>
          </select>

          <input
            placeholder="Paste account address…"
            value={query.value}
            onInput$={(e) =>
              (query.value = (e.target as HTMLInputElement).value)
            }
          />
        </div>
      </div>

      <div class="tabs">
        <button
          class={tab.value === "info" ? "active" : ""}
          onClick$={() => (tab.value = "info")}
        >
          Info
        </button>
        <button
          class={tab.value === "nfts" ? "active" : ""}
          onClick$={() => (tab.value = "nfts")}
        >
          NFTs
        </button>
      </div>

      {tab.value === "info" && (
        <div class="bento">
          {/* Account Information – left, larger */}
          <div class="card account">
            <div class="header">Account Information</div>
            <div class="body">
              {!account.value ? (
                <div>Loading account info…</div>
              ) : (
                <div class="account-grid">
                  <div class="flex flex-col items-center">
                    <img
                      height={100}
                      width={100}
                      src={account.value.urlgravatar || FALLBACK_IMG}
                      alt="Profile"
                      class="w-32 h-32 rounded-full border-4 border-gray-200 shadow-xl object-cover"
                      loading="lazy"
                      onError$={(e) =>
                        ((e.target as HTMLImageElement).src = FALLBACK_IMG)
                      }
                    />
                  </div>
                  <dl class="space-y-3 text-base">
                    <div class="flex justify-between border-b pb-2">
                      <dt class="font-medium text-gray-700">Address</dt>
                      <dd class="font-mono break-all">
                        {account.value.Account}
                      </dd>
                    </div>
                    <div class="flex justify-between border-b pb-2">
                      <dt class="font-medium text-gray-700">Balance</dt>
                      <dd class="font-bold text-2xl">
                        {formatAmount(account.value.Balance, "XRP")}
                      </dd>
                    </div>
                    <div class="flex justify-between border-b pb-2">
                      <dt class="font-medium text-gray-700">Owner Count</dt>
                      <dd>{account.value.OwnerCount}</dd>
                    </div>
                    <div class="flex justify-between border-b pb-2">
                      <dt class="font-medium text-gray-700">Sequence</dt>
                      <dd>{account.value.Sequence}</dd>
                    </div>
                    <div class="flex justify-between border-b pb-2">
                      <dt class="font-medium text-gray-700">Flags</dt>
                      <dd>{account.value.Flags}</dd>
                    </div>
                    <div class="flex justify-between border-b pb-2">
                      <dt class="font-medium text-gray-700">Domain</dt>
                      <dd>{account.value.Domain || "—"}</dd>
                    </div>
                    <div class="flex justify-between border-b pb-2">
                      <dt class="font-medium text-gray-700">EmailHash</dt>
                      <dd>{account.value.EmailHash || "—"}</dd>
                    </div>
                    <div class="flex justify-between border-b pb-2">
                      <dt class="font-medium text-gray-700">Prev Txn ID</dt>
                      <dd class="font-mono break-all">
                        {truncate(account.value.PreviousTxnID)}
                      </dd>
                    </div>
                    <div class="flex justify-between">
                      <dt class="font-medium text-gray-700">Prev Ledger</dt>
                      <dd>{account.value.PreviousTxnLgrSeq}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          </div>

          {/* Tokens / Trustlines – right */}
          <div class="card tokens">
            <div class="header">Tokens & Trustlines</div>
            <div class="body">
              {lines.value.length === 0 && <div>No trustlines or tokens</div>}
              {lines.value.map((l, i) => (
                <div key={i} class="token-item">
                  <div class="font-medium">{l.currency}</div>
                  <div class="font-bold">{l.balance}</div>
                  <div class="text-sm text-gray-600">
                    {l.type === "token" ? "Issued by" : "Trust to"}{" "}
                    {truncate(l.peer)}
                  </div>
                  <div class="text-sm text-gray-500">Limit: {l.limit}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction History – full width */}
          <div class="card txs">
            <div class="header">Transaction History</div>
            <div class="body">
              {txs.value.length === 0 && <div>No recent transactions</div>}
              {txs.value.map((t, i) => (
                <div key={i} class="tx-item">
                  <div class="flex justify-between">
                    <span class="font-medium">{t.TransactionType}</span>
                    <span
                      class={
                        t.meta.TransactionResult === "tesSUCCESS"
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      {t.meta.TransactionResult}
                    </span>
                  </div>
                  <div class="text-sm text-gray-600 mt-1">
                    {new Date(t.date).toLocaleString()}
                  </div>
                  <div class="text-sm mt-1">
                    From: {truncate(t.Account)} → To: {truncate(t.Destination)}
                  </div>
                  <div class="font-bold mt-1">
                    {t.Amount ? formatAmount(t.Amount, "XRP") : "—"}
                  </div>
                  <div class="text-xs text-gray-500 mt-2 break-all">
                    Hash: {truncate(t.hash)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab.value === "nfts" && (
        <div class="nft-wrap">
          {collections().map(([label, items]) => (
            <div key={label} class="collection">
              <h3>{label}</h3>
              <div class="nft-grid">
                {items.map((nft) => (
                  <div key={nft.id} class="nft">
                    <img
                      height={100}
                      width={100}
                      src={nft.image}
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

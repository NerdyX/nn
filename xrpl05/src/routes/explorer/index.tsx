import {
  component$,
  useSignal,
  useTask$,
  useResource$,
  Resource,
} from "@builder.io/qwik";

// -- Network selection --
type Network = "xrpl" | "xahau";
type XRPLResponse = any;

let ws: WebSocket | null = null;
let nextId = 1;

// -- Network Search --
const NETWORKS = [
  { label: "Mainnet", url: "wss://s1.ripple.com" },
  { label: "Testnet", url: "wss://s.altnet.rippletest.net:51233" },
  { label: "Devnet", url: "wss://s.devnet.rippletest.net:51233" },
];

interface TxEvent {
  hash: string;
  TransactionType: string;
  Account: string;
  date?: string;
  amount?: string;
  destination?: string;
}

interface AccountInfo {
  account: string;
  balance: string;
  sequence: number;
  owner_count: number;
}

function connectAndQuery(
  wsUrl: string,
  queryType: string,
  accountOrParam: string,
  onResult: (res: XRPLResponse) => void,
  onError: (err: string) => void,
) {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      const req: any = {
        id: nextId++,
        command: queryType as string,
        account: accountOrParam,
        strict: true,
        ledger_index: "validated",
      };

      // Special params for specific queries
      if (queryType === "ledger")
        req.ledger_index = accountOrParam || "validated";
      if (queryType === "tx_history") req.limit = 20;
      if (queryType === "account_nft") req.limit = 100;

      ws!.send(JSON.stringify(req));
    };

    ws.onerror = () => onError("WebSocket connection failed");
  } catch (e: any) {
    onError(e?.message || "Connection failed");
  }
}

export default component$(() => {
  // --- Signals ---
  const network = useSignal<Network>("xrpl");
  const address = useSignal("");
  const searchQuery = useSignal("");

  const status = useSignal("disconnected");
  const ledgers = useSignal<any[]>([]);
  const txs = useSignal<TxEvent[]>([]);

  const quorum = useSignal<number | null>(null);
  const loadFee = useSignal<number | null>(null);

  const ledgerIntervals = useSignal<number[]>([]);
  const txnCounts = useSignal<number[]>([]);
  const feeSamples = useSignal<number[]>([]);

  const lastLedgerClose = useSignal<number | null>(null);
  //const lastLedgerIndex = useSignal<number | null>(null);
  //const lastLedgerHash = useSignal<string | null>(null);
  //const lastLedgerTime = useSignal<Date | null>(null);

  const queryType = useSignal("account_info");
  const result = useSignal<XRPLResponse | null>(null);
  const detailedResult = useSignal<XRPLResponse | null>(null);

  // -- Colour Legend --
  const txColor = (type?: string) => {
    switch (type) {
      case "Payment":
        return "bg-green-400";
      case "OfferCreate":
      case "OfferCancel":
        return "bg-blue-400";
      case "TrustSet":
        return "bg-cyan-400";
      case "NFTokenMint":
      case "NFTokenBurn":
        return "bg-purple-400";
      case "AccountSet":
        return "bg-yellow-400";
      default:
        return "bg-white/20";
    }
  };

  // --- Resource for account info + txs ---
  const resource = useResource$<{
    account?: AccountInfo;
    transactions?: TxEvent[];
  }>(async ({ track }) => {
    track(() => searchQuery.value);

    if (typeof window === "undefined") return {}; // client-only
    if (!searchQuery.value) return {};

    try {
      const res = await fetch(
        `/api/explorer?network=${network.value}&address=${searchQuery.value}`,
      );
      if (!res.ok) throw new Error(`Failed to fetch account`);

      return res.json();
    } catch (e) {
      console.error("Explorer fetch error:", e);
      return {};
    }
  });

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const avgLedgerInterval = () => avg(ledgerIntervals.value);
  const avgTxnPerLedger = () => avg(txnCounts.value);
  const avgTxnFee = () => avg(feeSamples.value);

  const txnPerSec = () => {
    const interval = avgLedgerInterval();
    return interval > 0 ? avgTxnPerLedger() / interval : 0;
  };

  // --- WebSocket for live ledger & tx events ---
  useTask$(({ cleanup }) => {
    let ws: WebSocket | null = null;

    const connect = () => {
      const url =
        network.value === "xrpl"
          ? "wss://xrplcluster.com"
          : "wss://xahau.network";

      ws = new WebSocket(url);

      ws.onopen = () => {
        status.value = "connected";

        ws?.send(
          JSON.stringify({
            command: "subscribe",
            streams: ["ledger", "transactions"],
          }),
        );

        ws?.send(
          JSON.stringify({
            command: "server_info",
          }),
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // ---- SERVER INFO ----
          if (msg.result?.info) {
            quorum.value = msg.result.info.quorum ?? null;
            loadFee.value = msg.result.info.load_factor ?? null;
          }

          // ---- LEDGER CLOSED ----
          if (msg.type === "ledgerClosed") {
            const now = Date.now();

            if (lastLedgerClose.value) {
              const interval = (now - lastLedgerClose.value) / 1000;

              ledgerIntervals.value = [
                interval,
                ...ledgerIntervals.value.slice(0, 19),
              ];
            }

            lastLedgerClose.value = now;

            if (msg.txn_count != null) {
              txnCounts.value = [
                msg.txn_count,
                ...txnCounts.value.slice(0, 19),
              ];
            }

            ledgers.value = [
              {
                ledger_index: msg.ledger_index,
                ledger_hash: msg.ledger_hash,
                close_time_human: msg.ledger_time || msg.ledger_close_time,
                txn_count: msg.txn_count ?? 0,
              },
              ...ledgers.value.slice(0, 11),
            ];
          }

          // ---- TRANSACTIONS (fees) ----
          if (msg.transaction?.Fee) {
            const feeXrp = Number(msg.transaction.Fee) / 1_000_000;

            feeSamples.value = [feeXrp, ...feeSamples.value.slice(0, 49)];
          }
          if (msg.transaction) {
            txs.value = [
              {
                hash: msg.transaction.hash,
                TransactionType: msg.transaction.TransactionType,
                Account: msg.transaction.Account,
                date: msg.transaction.date,
                amount: msg.transaction.Amount,
                destination: msg.transaction.Destination,
              },
              ...txs.value.slice(0, 19),
            ];
          }
        } catch (e) {
          console.error("WS message parse error:", e);
        }
      };

      ws.onclose = () => {
        status.value = "disconnected";
      };
    };

    connect();

    cleanup(() => {
      ws?.close();
    });
  });

  return (
    <main class="mx-auto max-w-5xl px-6 py-10">
      <h1 class="text-2xl font-semibold mb-4">Account Explorer</h1>

      {/* Bloomberg-style Search Bar */}
      <div class="flex gap-3 mb-8 max-w-4xl mx-auto">
        {/* Main Search */}
        <div class="relative flex-1">
          <input
            type="text"
            placeholder={
              queryType.value === "ledger"
                ? "Ledger index or hash..."
                : "Account address (r...), tx hash, etc."
            }
            class="w-full rounded-xl border-2 border-slate-200 bg-white/90 backdrop-blur-sm px-5 py-4 pr-14 text-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-3 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200"
            value={address.value}
            onInput$={(e) =>
              (address.value = (e.target as HTMLInputElement).value)
            }
          />
          <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg
              class="w-6 h-6 text-slate-400"
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
          </div>
        </div>

        {/* Search Button */}
        <button
          class="group relative rounded-xl bg-liear-to-r from-slate-900 to-slate-800 px-8 py-4 text-black font-bold text-lg shadow-xl hover:shadow-2xl hover:from-slate-800 hover:to-slate-700 active:scale-[0.98] transition-all duration-200 flex items-center gap-2 hover:gap-3 disabled:opacity-50"
          onClick$={() => {
            searchQuery.value = address.value; // YOUR EXISTING LOGIC
            // NEW: Run detailed query
            const url =
              network.value === "xrpl"
                ? NETWORKS[0].url
                : "wss://xahau.network:51234";
            connectAndQuery(
              url,
              queryType.value,
              address.value,
              (res) => {
                detailedResult.value = res;
              },
              (err) => {
                console.error(err);
              },
            );
          }}
          disabled={!address.value.trim()}
        >
          <svg
            class="w-5 h-5 group-hover:scale-110 transition-transform"
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
          <span>Search</span>
        </button>
      </div>

      <section class="sticky top-0 z-40 bg-white backdrop-blur border-b border-white/10 mt-6">
        <div class="grid grid-cols-6 divide-x divide-white/10 text-black">
          <div class="px-4 py-3 text-center">
            <div class="text-xs text-black">QUORUM</div>
            <div class="text-lg font-mono">{quorum.value ?? "--"}</div>
          </div>

          <div class="px-4 py-3 text-center">
            <div class="text-xs text-black">AVG. TXN FEE</div>
            <div class="text-lg font-mono">{avgTxnFee().toFixed(6)} XRP</div>
          </div>

          <div class="px-4 py-3 text-center">
            <div class="text-xs text-black">AVG. LEDGER INTERVAL</div>
            <div class="text-lg font-mono">
              {avgLedgerInterval().toFixed(2)} sec
            </div>
          </div>

          <div class="px-4 py-3 text-center">
            <div class="text-xs text-black">AVG. TXN / LEDGER</div>
            <div class="text-lg font-mono">{avgTxnPerLedger().toFixed(2)}</div>
          </div>

          <div class="px-4 py-3 text-center">
            <div class="text-xs text-black">TXN / SEC</div>
            <div class="text-lg font-mono">{txnPerSec().toFixed(2)}</div>
          </div>

          <div class="px-4 py-3 text-center">
            <div class="text-xs text-black">LOAD FEE</div>
            <div class="text-lg font-mono">{loadFee.value ?? "--"}</div>
          </div>
        </div>
      </section>

      <section class="mt-8">
        <div class="relative w-full overflow-hidden">
          <h2 class="text-lg font-semibold mb-2">
            Live Ledgers: {status.value}
          </h2>
          <div class="flex gap-6">
            {ledgers.value.map((ledger) => (
              <div
                key={ledger.ledger_hash}
                class="border border-white/10 bg-black/5 rounded-lg p-4 min-w-55 shrink-0
                       transition-transform duration-10 ease-out"
              >
                {/* Header */}
                <div class="mb-3">
                  <div class="text-black font-mono text-sm">
                    {ledger.ledger_index}
                  </div>
                  <div class="text-xs text-black">
                    {ledger.close_time_human}
                  </div>
                </div>

                {/* Meta */}
                <div class="text-xs text-black">
                  TXN COUNT: <span class="text-black">{ledger.txn_count}</span>
                </div>

                {/* Matrix */}
                <div class="grid grid-cols-5 gap-1">
                  {txs.value.slice(0, 36).map((tx) => (
                    <span
                      key={tx.hash}
                      title={tx.TransactionType}
                      class={`w-3 h-3 rounded-full ${txColor(tx.TransactionType)}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Account Info + Transactions */}
      <div>
        <Resource
          value={resource}
          onPending={() => <p>Loading account info...</p>}
          onRejected={(err) => (
            <p class="text-red-500">Error fetching data: {String(err)}</p>
          )}
          onResolved={(data) => (
            <>
              {data.account ? (
                <section class="mb-6 rounded border bg-white p-6">
                  <h2 class="text-lg font-semibold mb-2">Account Info</h2>
                  <ul class="text-sm space-y-1">
                    <li>
                      <strong>Account:</strong> {data.account.account}
                    </li>
                    <li>
                      <strong>Balance:</strong> {data.account.balance} XRP
                    </li>
                    <li>
                      <strong>Sequence:</strong> {data.account.sequence}
                    </li>
                    <li>
                      <strong>Owner Count:</strong> {data.account.owner_count}
                    </li>
                  </ul>
                </section>
              ) : (
                <p>No account found.</p>
              )}

              {data.transactions && data.transactions.length > 0 && (
                <section class="rounded border bg-white p-6">
                  <h2 class="text-lg font-semibold mb-2">
                    Recent Transactions
                  </h2>
                  <ul class="text-sm space-y-2">
                    {data.transactions.map((tx) => (
                      <li key={tx.hash} class="rounded bg-gray-50 px-3 py-2">
                        <div class="flex justify-between">
                          <span>{tx.TransactionType}</span>
                          <span class="text-gray-500">{tx.date}</span>
                        </div>
                        {tx.amount && tx.destination && (
                          <div class="text-xs text-gray-500">
                            {tx.amount} → {tx.destination}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        />
      </div>
      {result.value && (
        <div class="mt-8 p-6 bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/50">
          <h3 class="text-xl font-bold text-slate-900 mb-4">
            Query Results ({queryType.value})
          </h3>
          {detailedResult.value?.status === "success" ? (
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 p-6 bg-linear-to-r from-blue-50 to-indigo-50 rounded-2xl">
              <div>
                <div class="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Status
                </div>
                <div class="text-2xl font-bold text-emerald-600">Success</div>
              </div>
              {detailedResult.value.result?.account && (
                <div>
                  <div class="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Account
                  </div>
                  <div class="text-lg font-mono font-semibold">
                    {detailedResult.value.result.account.slice(0, 8)}...
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <pre class="max-h-96 overflow-auto rounded-2xl bg-slate-900/95 p-6 text-xs text-slate-100 font-mono border backdrop-blur-sm">
            {JSON.stringify(detailedResult.value, null, 2)}
          </pre>
        </div>
      )}

      {/* Live Ledger Feed */}
    </main>
  );
});

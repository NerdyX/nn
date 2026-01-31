import {
  component$,
  useSignal,
  useTask$,
  useResource$,
  Resource,
} from "@builder.io/qwik";

type Network = "xrpl" | "xahau";

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

      {/* Search bar */}
      <div class="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Enter XRPL or Xahau address"
          class="flex-1 rounded border px-3 py-2"
          value={address.value}
          onInput$={(e) =>
            (address.value = (e.target as HTMLInputElement).value)
          }
        />

        <select
          class="rounded border px-3 py-2"
          value={network.value}
          onChange$={(e) =>
            (network.value = (e.target as HTMLSelectElement).value as Network)
          }
        >
          <option value="xrpl">XRPL</option>
          <option value="xahau">Xahau</option>
        </select>

        <button
          class="rounded bg-black px-4 py-2 text-white"
          onClick$={() => (searchQuery.value = address.value)}
        >
          Search
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

      {/* Live Ledger Feed */}
      <section class="mt-8 rounded border bg-white p-6">
        <h2 class="text-lg font-semibold mb-2">Live Ledgers</h2>
        <p>Status: {status.value}</p>
        <ul class="space-y-1 text-sm">
          {ledgers.value.map((l) => (
            <li
              key={l.ledger_hash}
              class="flex justify-between bg-gray-50 px-3 py-1 rounded"
            >
              <span>#{l.ledger_index}</span>
              <span class="truncate text-gray-500">
                {l.ledger_hash.slice(0, 12)}…
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
});

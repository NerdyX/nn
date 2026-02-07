import {
  component$,
  useSignal,
  useTask$,
  useResource$,
  Resource,
  $,
  noSerialize,
  type NoSerialize,
} from "@builder.io/qwik";

import { Client, dropsToXrp } from "xrpl";

import type { LedgerStream, TransactionStream } from "xrpl";

// ──────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────

const NETWORKS = [
  { key: "mainnet", label: "Mainnet", url: "wss://xrplcluster.com" },
  { key: "xahau", label: "Xahau", url: "wss://xahau.network" },
  {
    key: "testnet",
    label: "Testnet",
    url: "wss://s.altnet.rippletest.net:51233",
  },
  {
    key: "devnet",
    label: "Devnet",
    url: "wss://s.devnet.rippletest.net:51233",
  },
] as const;

type NetworkKey = (typeof NETWORKS)[number]["key"];

// ──────────────────────────────────────────────
// Types (from your original + improvements)
// ──────────────────────────────────────────────

interface TxEvent {
  hash?: string;
  TransactionType?: string;
  Account?: string;
  date?: number;
  amount?: string; // human readable
  destination?: string;
}

interface AccountInfo {
  account: string;
  balance?: string;
  balanceXrp?: string;
  sequence?: number;
  owner_count?: number;
  ownerCount?: number;
  flagsDecoded?: Record<string, boolean>;
  trustLines?: number;
  issuedCurrencies?: number;
  ownedNFTs?: number;
  activeOffers?: number;
  ammPositions?: number;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default component$(() => {
  const network = useSignal<NetworkKey>("testnet"); // safe default
  const address = useSignal("");
  const searchQuery = useSignal("");
  const queryType = useSignal<"account_info" | "tx" | "ledger">("account_info");

  const status = useSignal<"disconnected" | "connecting" | "connected">(
    "disconnected",
  );
  const ledgers = useSignal<any[]>([]);
  const txs = useSignal<TxEvent[]>([]);

  const loadFee = useSignal<number | null>(null);

  const ledgerIntervals = useSignal<number[]>([]);
  const txnCounts = useSignal<number[]>([]);
  const feeSamples = useSignal<number[]>([]);

  const lastLedgerClose = useSignal<number | null>(null);

  const detailedResult = useSignal<any>(null);
  const queryError = useSignal<string | null>(null);

  // Client (noSerialize prevents Qwik crash)
  const client = useSignal<NoSerialize<Client> | null>(null);

  // ─── Utils ─────────────────────────────────────

  const avg = $((arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0,
  );

  const avgLedgerInterval = $(async () =>
    (await avg(ledgerIntervals.value)).toFixed(2),
  );
  const avgTxnPerLedger = $(async () =>
    (await avg(txnCounts.value)).toFixed(0),
  );
  const avgTxnFee = $(async () => (await avg(feeSamples.value)).toFixed(6));

  const txnPerSec = $(async () => {
    const interval = await avg(ledgerIntervals.value);
    return interval > 0
      ? ((await avg(txnCounts.value)) / interval).toFixed(2)
      : "0.00";
  });

  const txColor = (type?: string) => {
    switch (type) {
      case "Payment":
        return "bg-green-400";
      case "OfferCreate":
      case "OfferCancel":
        return "bg-blue-400";
      case "TrustSet":
        return "bg-red-400";
      case "NFTokenMint":
      case "NFTokenBurn":
        return "bg-purple-400";
      case "AccountSet":
        return "bg-yellow-400";
      default:
        return "bg-white/20";
    }
  };

  // ─── Live Data Subscription ────────────────────

  useTask$(async ({ track, cleanup }) => {
    track(() => network.value);

    // Cleanup old client
    if (client.value) {
      try {
        await client.value.disconnect();
      } catch (e) {
        console.warn("Error disconnecting previous client", e);
      }
      client.value = null;
    }

    status.value = "connecting";

    const net = NETWORKS.find((n) => n.key === network.value)!;
    const newClient = new Client(net.url);

    try {
      await newClient.connect();
      status.value = "connected";

      // Subscribe to streams
      await newClient.request({
        command: "subscribe",
        streams: ["ledger", "transactions"], // validated tx only; use "transactions_proposed" if you want unconfirmed
      });

      // Try to fetch server info (non-fatal)
      newClient
        .request({ command: "server_info" })
        .then((info) => {
          loadFee.value = info.result?.info?.load_factor ?? null;
        })
        .catch((err) => {
          console.warn("server_info fetch failed", err);
        });

      // Initial server info
      try {
        const info = await newClient.request({ command: "server_info" });
        loadFee.value = info.result?.info?.load_factor ?? null;
      } catch (e) {
        console.warn("server_info initial fetch failed", e);
      }

      client.value = noSerialize(newClient);

      // Ledger closed events
      newClient.on("ledgerClosed", (msg: LedgerStream) => {
        const now = Date.now();
        if (lastLedgerClose.value) {
          // convert ms -> seconds
          const interval = (now - lastLedgerClose.value) / 1000;
          ledgerIntervals.value = [
            interval,
            ...ledgerIntervals.value.slice(0, 19),
          ];
        }
        lastLedgerClose.value = now;

        txnCounts.value = [msg.txn_count ?? 0, ...txnCounts.value.slice(0, 19)];

        ledgers.value = [
          {
            ledger_index: msg.ledger_index,
            ledger_hash: msg.ledger_hash,
            close_time_human: new Date(
              (msg.ledger_time + 946684800) * 1000,
            ).toLocaleString(),
            txn_count: msg.txn_count ?? 0,
          },
          ...ledgers.value.slice(0, 11),
        ];
      });

      // Validated transaction events
      newClient.on("transaction", (msg: TransactionStream) => {
        if (!msg.validated) return;

        const tx = (msg.transaction as any) ?? {};
        if (!tx) return;

        let amountStr: string | undefined;

        // Prefer delivered_amount from meta (for partial payments), fall back to tx.Amount
        const deliveredAmount = (msg as any).meta?.delivered_amount;
        const displayAmount = deliveredAmount ?? tx.Amount;

        if (displayAmount !== undefined && displayAmount !== null) {
          if (typeof displayAmount === "string") {
            // Native XRP amount in drops -> convert to XRP and append currency label
            try {
              amountStr = `${dropsToXrp(displayAmount)} XRP`;
            } catch {
              const dropsNum = Number(displayAmount);
              if (!Number.isNaN(dropsNum)) {
                amountStr = `${dropsNum / 1_000_000} XRP`;
              }
            }
          } else if (
            typeof displayAmount === "object" &&
            displayAmount !== null &&
            "value" in displayAmount
          ) {
            // Issued currency
            const currency = displayAmount.currency ?? "XRP";
            amountStr = `${displayAmount.value} ${currency}`;
          }
        }

        const computedHash =
          (msg as any).hash ??
          (tx && (tx.hash ?? tx.TransactionHash)) ??
          undefined;

        txs.value = [
          {
            hash: computedHash,
            TransactionType: tx.TransactionType,
            Account: tx.Account,
            date: tx.date,
            amount: amountStr,
            destination: tx.Destination,
          },
          ...txs.value.slice(0, 19),
        ];

        if (tx.Fee) {
          const feeXrp = Number(tx.Fee) / 1_000_000;
          feeSamples.value = [feeXrp, ...feeSamples.value.slice(0, 49)];
        }
      });
    } catch (err: any) {
      console.error("Connection failed:", err);
      status.value = "disconnected";
    }

    cleanup(async () => {
      if (client.value) {
        try {
          await client.value.disconnect();
        } catch (e) {
          console.warn("Error during cleanup disconnect", e);
        }
      }
    });
  });

  // ─── Manual Query ──────────────────────────────

  const runQuery = $(async () => {
    if (!client.value || !address.value.trim()) return;

    queryError.value = null;
    detailedResult.value = null;

    try {
      const input = address.value.trim();
      let req: any;

      if (queryType.value === "account_info") {
        req = {
          command: "account_info",
          account: input,
          ledger_index: "validated",
        };
      } else if (queryType.value === "tx") {
        req = { command: "tx", transaction: input };
      } else if (queryType.value === "ledger") {
        const isHash = Boolean(input.match(/^[A-Fa-f0-9]{64}$/));
        req = {
          command: "ledger",
          ledger_hash: isHash ? input : undefined,
          ledger_index: isHash ? undefined : input,
          transactions: true,
        };
      }

      const resp = await (client.value as any).request(req);
      detailedResult.value = resp.result;
    } catch (err: any) {
      queryError.value = err?.message ?? "Query failed";
    }
  });

  // ─── Account Resource (your original backend fetch) ───

  const resource = useResource$<{
    account?: AccountInfo;
    transactions?: TxEvent[];
  }>(async ({ track }) => {
    track(() => searchQuery.value);

    if (typeof window === "undefined" || !searchQuery.value) return {};

    try {
      const res = await fetch(
        `/api/explorer?network=${network.value}&address=${searchQuery.value}`,
      );
      if (!res.ok) throw new Error("Failed to fetch account data");
      return await res.json();
    } catch (e) {
      console.error("Explorer fetch error:", e);
      return {};
    }
  });

  return (
    <main class="mx-auto max-w-5xl px-6 py-10">
      <h1 class="text-2xl font-semibold mb-4">Account Explorer</h1>

      {/* Search Bar */}
      <div class="flex flex-col sm:flex-row gap-3 mb-8 max-w-4xl mx-auto">
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

        <select
          class="px-5 py-4 rounded-xl border-2 border-slate-200 bg-white text-slate-900 min-w-45"
          value={queryType.value}
          onChange$={(e) =>
            (queryType.value = (e.target as HTMLSelectElement).value as any)
          }
        >
          <option value="account_info">Account Info</option>
          <option value="tx">Transaction</option>
          <option value="ledger">Ledger</option>
        </select>

        <button
          class="group relative rounded-xl bg-linear-to-r from-slate-900 to-slate-800 px-8 py-4 text-white font-bold text-lg shadow-xl hover:shadow-2xl hover:from-slate-800 hover:to-slate-700 active:scale-[0.98] transition-all duration-200 flex items-center gap-2 hover:gap-3 disabled:opacity-50"
          onClick$={() => {
            searchQuery.value = address.value;
            runQuery();
          }}
          disabled={!address.value.trim() || status.value !== "connected"}
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

      {/* Stats Bar */}
      <section class="sticky top-0 z-40 bg-white backdrop-blur border-b border-slate-200 mt-6">
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-slate-200 text-center">
          <div class="px-4 py-3">
            <div class="text-xs text-slate-600">Ledger</div>
            <div class="text-lg font-mono">{status.value}</div>
          </div>
          <div class="px-4 py-3">
            <div class="text-xs text-slate-600">AVG. TXN FEE</div>
            <div class="text-lg font-mono">{avgTxnFee()} XRP</div>
          </div>
          <div class="px-4 py-3">
            <div class="text-xs text-slate-600">AVG. LEDGER INTERVAL</div>
            <div class="text-lg font-mono">{avgLedgerInterval()} sec</div>
          </div>
          <div class="px-4 py-3">
            <div class="text-xs text-slate-600">AVG. TXN / LEDGER</div>
            <div class="text-lg font-mono">{avgTxnPerLedger()}</div>
          </div>
          <div class="px-4 py-3">
            <div class="text-xs text-slate-600">TXN / SEC</div>
            <div class="text-lg font-mono">{txnPerSec()}</div>
          </div>
          <div class="px-4 py-3">
            <div class="text-xs text-slate-600">LOAD FEE</div>
            <div class="text-lg font-mono">{loadFee.value ?? "--"}</div>
          </div>
        </div>
        <div class="flex mt-1.5 overflow-x-auto gap-6 pb-4">
          {ledgers.value.map((ledger) => (
            <div
              key={ledger.ledger_hash ?? ledger.ledger_index}
              class="border border-slate-200 bg-white rounded-lg p-4 min-w-55
              shrink-0 shadow-sm"
            >
              <div class="mb-3">
                <div class="font-mono text-sm font-semibold">
                  {ledger.ledger_index}
                </div>
                <div class="text-xs text-slate-500">
                  {ledger.close_time_human}
                </div>
              </div>
              <div class="text-xs text-slate-600">
                TXN COUNT: <span class="font-medium">{ledger.txn_count}</span>
              </div>
              <div class="grid grid-cols-6 gap-1 mt-3">
                {txs.value.slice(0, 36).map((tx, i) => (
                  <span
                    key={tx.hash ?? `tx-${i}`}
                    title={tx.TransactionType}
                    class={`w-3 h-3 rounded-full ${txColor(tx.TransactionType)}`}
                  />
                ))}
              </div>
            </div>
          ))}
          {ledgers.value.length === 0 && (
            <p class="text-slate-400">Waiting for ledger updates...</p>
          )}
        </div>
      </section>

      {/* Account Info + Transactions from API */}
      <Resource
        value={resource}
        onPending={() => (
          <p class="text-center py-8 text-slate-500">Loading account info...</p>
        )}
        onRejected={(err) => (
          <p class="text-red-500 text-center py-8">
            Error fetching data: {String(err)}
          </p>
        )}
        onResolved={(data) => (
          <>
            {data.account && (
              <section class="mb-8 rounded-2xl border bg-white p-6 shadow-sm">
                <h2 class="text-xl font-bold mb-6">Account Details</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Basic */}
                  <div class="p-5 bg-slate-50 rounded-xl">
                    <h3 class="font-semibold mb-3">Basic</h3>
                    <p>
                      <strong>Balance:</strong>{" "}
                      {data.account.balanceXrp ?? data.account.balance ?? "--"}
                    </p>
                    <p>
                      <strong>Sequence:</strong> {data.account.sequence ?? "--"}
                    </p>
                    <p>
                      <strong>Owner Count:</strong>{" "}
                      {data.account.ownerCount ??
                        data.account.owner_count ??
                        "--"}
                    </p>
                  </div>

                  {/* Flags */}
                  <div class="p-5 bg-slate-50 rounded-xl">
                    <h3 class="font-semibold mb-3">Flags</h3>
                    <ul class="text-sm space-y-1">
                      {Object.entries(data.account.flagsDecoded ?? {})
                        .filter(([, val]) => Boolean(val))
                        .map(([key]) => (
                          <li key={key}>
                            ✓ {key.replace(/([A-Z])/g, " $1").trim()}
                          </li>
                        ))}
                    </ul>
                  </div>

                  {/* Assets / Counts */}
                  <div class="p-5 bg-slate-50 rounded-xl">
                    <h3 class="font-semibold mb-3">Assets & Activity</h3>
                    <p>Trust Lines: {data.account.trustLines ?? 0}</p>
                    <p>
                      Issued Currencies: {data.account.issuedCurrencies ?? 0}
                    </p>
                    <p>Owned NFTs: {data.account.ownedNFTs ?? 0}</p>
                    <p>Active Offers: {data.account.activeOffers ?? 0}</p>
                    <p>AMM Positions: {data.account.ammPositions ?? 0}</p>
                  </div>
                </div>
              </section>
            )}

            {data.transactions && data.transactions.length > 0 && (
              <section class="rounded border bg-white p-6 shadow-sm">
                <h2 class="text-lg font-semibold mb-2">Recent Transactions</h2>
                <ul class="text-sm space-y-2">
                  {data.transactions.map((tx, idx) => (
                    <li
                      key={tx.hash ?? `tx-${idx}`}
                      class="rounded bg-gray-50 px-3 py-2"
                    >
                      <div class="flex justify-between">
                        <span>{tx.TransactionType}</span>
                        <span class="text-gray-500">
                          {tx.date
                            ? new Date(
                                (tx.date + 946684800) * 1000,
                              ).toLocaleString()
                            : ""}
                        </span>
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

      {/* Query Results */}
      {detailedResult.value && (
        <div class="mt-8 p-6 bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/50">
          <h3 class="text-xl font-bold text-slate-900 mb-4">
            Query Results ({queryType.value})
          </h3>
          <pre class="max-h-96 overflow-auto rounded-2xl bg-slate-900/95 p-6 text-xs text-slate-100 font-mono border backdrop-blur-sm">
            {JSON.stringify(detailedResult.value, null, 2)}
          </pre>
        </div>
      )}
      {queryError.value && (
        <div class="mt-8 p-6 bg-red-50 rounded-3xl border border-red-200 text-red-700">
          {queryError.value}
        </div>
      )}
    </main>
  );
});

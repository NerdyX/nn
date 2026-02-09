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
import XrplLiveFeed from "~/components/ui/XrplLiveFeed";
import { useNetworkContext } from "~/context/network-context";

{
  /*const XRPL_TX_TYPES = [
  "AccountDelete",
  "AccountSet",
  "AMMBid",
  "AMMClawback",
  "AMMCreate",
  "AMMDelete",
  "AMMDeposit",
  "AMMVote",
  "AMMWithdraw",
  "Batch",
  "CredentialAccept",
  "CredentialCreate",
  "CredentialDelete",
  "CheckCancel",
  "CheckCash",
  "CheckCreate",
  "Clawback",
  "DepositPreauth",
  "DelegateSet",
  "DIDDelete",
  "DIDSet",
  "EscrowCancel",
  "EscrowCreate",
  "EscrowFinish",
  "LedgerStateFix",
  "MPTokenAuthorize",
  "MPTokenIssuanceCreate",
  "MPTokenIssuanceDestroy",
  "MPTokenIssuanceSet",
  "NFTokenAcceptOffer",
  "NFTokenBurn",
  "NFTokenCancelOffer",
  "NFTokenCreateOffer",
  "NFTokenMint",
  "NFTokenModify",
  "OfferCancel",
  "OfferCreate",
  "OracleDelete",
  "OracleSet",
  "Payment",
  "PaymentChannelClaim",
  "PaymentChannelCreate",
  "PaymentChannelFund",
  "PermissionDelete",
  "PermissionSet",
  "SetRegularKey",
  "SignerListSet",
  "TicketCreate",
  "TrustSet",
  "XChainAccountCreateCommit",
  "XChainAddAccountCreateAttestation",
  "XChainAddClaimAttestation",
  "XChainClaim",
  "XChainCommit",
  "XChainCreateBridge",
  "XChainCreateClaimID",
  "XChainModifyBridge",
];

{/*const XAHAU_TX_TYPES = [
  "AccountSet",
  "CheckCancel",
  "CheckCash",
  "CheckCreate",
  "Clawback",
  "DepositPreauth",
  "EscrowCancel",
  "EscrowCreate",
  "EscrowFinish",
  "NFTokenAcceptOffer",
  "NFTokenBurn",
  "NFTokenCancelOffer",
  "NFTokenCreateOffer",
  "NFTokenMint",
  "OfferCancel",
  "OfferCreate",
  "Payment",
  "PaymentChannelClaim",
  "PaymentChannelCreate",
  "PaymentChannelFund",
  "SetFee",
  "SetRegularKey",
  "SignerListSet",
  "TrustSet",
  "ClaimReward",
  "CronSet",
  "Import",
];*/
}

const TX_TYPE_COLORS: Record<
  string,
  { bg: string; dot: string; label: string }
> = {
  Payment: { bg: "bg-green-50", dot: "bg-green-500", label: "Payment" },
  OfferCreate: { bg: "bg-blue-50", dot: "bg-blue-500", label: "Offer Create" },
  OfferCancel: { bg: "bg-blue-50", dot: "bg-cyan-500", label: "Offer Cancel" },
  TrustSet: { bg: "bg-red-50", dot: "bg-red-500", label: "Trust Set" },
  NFTokenMint: { bg: "bg-purple-50", dot: "bg-purple-500", label: "NFT Mint" },
  NFTokenBurn: { bg: "bg-purple-50", dot: "bg-violet-500", label: "NFT Burn" },
  AccountSet: { bg: "bg-amber-50", dot: "bg-amber-500", label: "Account Set" },
  EscrowCreate: { bg: "bg-pink-50", dot: "bg-pink-500", label: "Escrow" },
  CheckCreate: { bg: "bg-cyan-50", dot: "bg-cyan-500", label: "Check" },
  Default: { bg: "bg-slate-50", dot: "bg-slate-400", label: "Other" },
};

const AMENDMENTS_DATA = [
  {
    name: "Hooks Amendment",
    status: "active",
    description:
      "Enable smart contracts and programmable escrow on the XRP Ledger",
  },
  {
    name: "Enhanced Clawback",
    status: "active",
    description:
      "Allows token issuers to reclaim issued tokens in certain scenarios",
  },
  {
    name: "DID Objects",
    status: "active",
    description: "Support for Decentralized Identifiers on the ledger",
  },
  {
    name: "Issued Currency Precision",
    status: "active",
    description: "Improved precision for issued currency calculations",
  },
  {
    name: "XChainBridge Enhancement",
    status: "pending",
    description: "Enhanced cross-chain bridge capabilities",
  },
  {
    name: "Multi-Signing Improvements",
    status: "pending",
    description: "Better support for multi-signature transactions",
  },
  {
    name: "Fee Structure Optimization",
    status: "pending",
    description: "Dynamic fee adjustment mechanism",
  },
];

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface TxEvent {
  hash?: string;
  TransactionType?: string;
  Account?: string;
  date?: number;
  amount?: string;
  destination?: string;
  fee?: string;
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

interface DexTrade {
  pair: string;
  price: number;
  volume: number;
  change24h: number;
  account?: string;
  timestamp: number;
  transactionType?: string;
}

{
  /*interface GlobeConnection {
  from: string;
  to: string;
  trades: number;
  volume: number;
}*/
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default component$(() => {
  // ── Use the shared network context from layout ──
  const { activeNetwork, wsUrl } = useNetworkContext();
  const address = useSignal("");
  const searchQuery = useSignal("");
  const queryType = useSignal<"account_info" | "tx" | "ledger">("account_info");
  const activeTab = useSignal<
    "explorer" | "tokens" | "amendments" | "etf" | "globe"
  >("explorer");

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

  const client = useSignal<NoSerialize<Client> | null>(null);

  // DEX & ETF Data
  const dexTrades = useSignal<DexTrade[]>([]);
  const amendments = useSignal<typeof AMENDMENTS_DATA>([...AMENDMENTS_DATA]);

  // ── Tokens tab state ──
  const tokenAddress = useSignal("");
  const tokenLoading = useSignal(false);
  const tokenError = useSignal<string | null>(null);
  const accountLines = useSignal<any[]>([]);
  const gatewayBalances = useSignal<any>(null);
  const tokenTab = useSignal<"lines" | "gateway">("lines");

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

  const getTxColorData = (type?: string) => {
    return TX_TYPE_COLORS[type ?? "Default"] || TX_TYPE_COLORS.Default;
  };

  // ─── Live Data Subscription ────────────────────
  // Tracks the shared wsUrl from NetworkContext so switching the
  // network toggle in the header reconnects the WebSocket here.

  useTask$(async ({ track, cleanup }) => {
    const currentWsUrl = track(() => wsUrl.value);

    if (client.value) {
      try {
        await client.value.disconnect();
      } catch (e) {
        console.warn("Error disconnecting previous client", e);
      }
      client.value = null;
    }

    status.value = "connecting";

    const newClient = new Client(currentWsUrl);

    try {
      await newClient.connect();
      status.value = "connected";

      await newClient.request({
        command: "subscribe",
        streams: ["ledger", "transactions"],
      });

      newClient
        .request({ command: "server_info" })
        .then((info) => {
          loadFee.value = info.result?.info?.load_factor ?? null;
        })
        .catch((err) => {
          console.warn("server_info fetch failed", err);
        });

      try {
        const info = await newClient.request({ command: "server_info" });
        loadFee.value = info.result?.info?.load_factor ?? null;
      } catch (e) {
        console.warn("server_info initial fetch failed", e);
      }

      client.value = noSerialize(newClient);

      newClient.on("ledgerClosed", (msg: LedgerStream) => {
        const now = Date.now();
        if (lastLedgerClose.value) {
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

      newClient.on("transaction", (msg: TransactionStream) => {
        if (!msg.validated) return;

        const tx = (msg.transaction as any) ?? {};
        if (!tx) return;

        let amountStr: string | undefined;
        let feeStr: string | undefined;

        const deliveredAmount = (msg as any).meta?.delivered_amount;
        const displayAmount = deliveredAmount ?? tx.Amount;

        if (displayAmount !== undefined && displayAmount !== null) {
          if (typeof displayAmount === "string") {
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
            const currency = displayAmount.currency ?? "XRP";
            amountStr = `${displayAmount.value} ${currency}`;
          }
        }

        if (tx.Fee) {
          const feeXrp = Number(tx.Fee) / 1_000_000;
          feeStr = feeXrp.toFixed(6);
        }

        const computedHash =
          (msg as any).hash ??
          (tx && (tx.hash ?? tx.TransactionHash)) ??
          undefined;

        const dexTrade: DexTrade = {
          pair: `${tx.Account?.slice(0, 4)}...`,
          price: Number(tx.Fee ?? 0) / 1_000_000,
          volume: Number(
            displayAmount && typeof displayAmount === "string"
              ? dropsToXrp(displayAmount)
              : (displayAmount?.value ?? 0),
          ),
          change24h: 0,
          account: tx.Account,
          timestamp: Date.now(),
          transactionType: tx.TransactionType,
        };

        dexTrades.value = [dexTrade, ...dexTrades.value.slice(0, 49)];

        txs.value = [
          {
            hash: computedHash,
            TransactionType: tx.TransactionType,
            Account: tx.Account,
            date: tx.date,
            amount: amountStr,
            destination: tx.Destination,
            fee: feeStr,
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

  // ─── Account Resource ───

  const resource = useResource$<{
    account?: AccountInfo;
    transactions?: TxEvent[];
  }>(async ({ track }) => {
    track(() => searchQuery.value);
    const net = track(() => activeNetwork.value);

    if (typeof window === "undefined" || !searchQuery.value) return {};

    try {
      const res = await fetch(
        `/api/explorer?network=${net}&address=${searchQuery.value}`,
      );
      if (!res.ok) throw new Error("Failed to fetch account data");
      return await res.json();
    } catch (e) {
      console.error("Explorer fetch error:", e);
      return {};
    }
  });

  // ── Fetch account_lines & gateway_balances for Tokens tab ──
  const fetchTokenData = $(async () => {
    const addr = tokenAddress.value.trim();
    if (!addr || !addr.startsWith("r") || addr.length < 25) {
      tokenError.value = "Enter a valid r-address";
      return;
    }
    if (!client.value) {
      tokenError.value = "WebSocket not connected — wait a moment and retry";
      return;
    }

    tokenLoading.value = true;
    tokenError.value = null;
    accountLines.value = [];
    gatewayBalances.value = null;

    try {
      // account_lines — paginate to get all trust lines
      let allLines: any[] = [];
      let marker: any = undefined;
      do {
        const req: any = {
          command: "account_lines",
          account: addr,
          ledger_index: "validated",
          limit: 400,
        };
        if (marker) req.marker = marker;
        const res = await (client.value as any).request(req);
        allLines = allLines.concat(res.result.lines || []);
        marker = res.result.marker;
      } while (marker && allLines.length < 2000);

      accountLines.value = allLines;

      // gateway_balances
      try {
        const gwRes = await (client.value as any).request({
          command: "gateway_balances",
          account: addr,
          ledger_index: "validated",
        });
        gatewayBalances.value = gwRes.result;
      } catch (gwErr: any) {
        // Some accounts aren't gateways — that's fine
        if (
          gwErr?.data?.error === "invalidParams" ||
          gwErr?.message?.includes("invalidParams")
        ) {
          gatewayBalances.value = null;
        } else {
          console.warn("gateway_balances error:", gwErr);
          gatewayBalances.value = null;
        }
      }
    } catch (err: any) {
      tokenError.value = err?.message ?? "Failed to fetch token data";
    } finally {
      tokenLoading.value = false;
    }
  });

  return (
    <main class=" mt-24 bg-white text-gray-900">
      {/* Header */}
      <div>
        {/* Tab Navigation */}
        <div class="px-6">
          <div class="max-w-7xl mx-auto flex gap-1 overflow-x-auto">
            {[
              { id: "explorer", label: "Explorer", icon: "📊" },
              { id: "tokens", label: "Tokens", icon: "🪙" },
              { id: "amendments", label: "Amendments", icon: "⚙️" },
              { id: "etf", label: "ETF Tracker", icon: "💹" },
              { id: "globe", label: "DEX Map", icon: "🌐" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick$={() => (activeTab.value = tab.id as any)}
                class={`px-6 py-4 font-semibold text-sm transition-all whitespace-nowrap ${
                  activeTab.value === tab.id
                    ? "text-cyan-600 border-b-2 border-cyan-600"
                    : "text-gray-600 hover:text-gray-900 border-b-2 border-transparent"
                }`}
              >
                <span class="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div class="mx-auto max-w-7xl px-6 py-8">
        {/* ── Tokens Tab ── */}
        {activeTab.value === "tokens" && (
          <div class="space-y-6">
            {/* Search */}
            <div class="flex flex-col sm:flex-row gap-3">
              <div class="relative flex-1">
                <input
                  type="text"
                  placeholder="Enter r-address to view trust lines & gateway balances..."
                  class="w-full rounded-lg border border-gray-300 bg-white px-5 py-4 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  value={tokenAddress.value}
                  onInput$={(e) =>
                    (tokenAddress.value = (e.target as HTMLInputElement).value)
                  }
                  onKeyDown$={(e) => {
                    if (e.key === "Enter") fetchTokenData();
                  }}
                />
              </div>
              <button
                class="px-8 py-4 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition disabled:opacity-50"
                disabled={tokenLoading.value || !tokenAddress.value.trim()}
                onClick$={fetchTokenData}
              >
                {tokenLoading.value ? "Loading..." : "🔍 Fetch Tokens"}
              </button>
            </div>

            {/* Error */}
            {tokenError.value && (
              <div class="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {tokenError.value}
              </div>
            )}

            {/* Loading */}
            {tokenLoading.value && (
              <div class="flex items-center justify-center py-16">
                <div class="animate-spin w-8 h-8 border-4 border-cyan-200 border-t-cyan-600 rounded-full" />
                <span class="ml-3 text-gray-500">
                  Fetching token data from the ledger...
                </span>
              </div>
            )}

            {/* Results */}
            {!tokenLoading.value &&
              (accountLines.value.length > 0 || gatewayBalances.value) && (
                <div>
                  {/* Sub-tabs: account_lines vs gateway_balances */}
                  <div class="flex gap-1 border-b border-gray-200 mb-6">
                    <button
                      class={`px-5 py-3 text-sm font-semibold transition-all border-b-2 ${
                        tokenTab.value === "lines"
                          ? "text-cyan-600 border-cyan-600"
                          : "text-gray-500 border-transparent hover:text-gray-800"
                      }`}
                      onClick$={() => (tokenTab.value = "lines")}
                    >
                      Trust Lines ({accountLines.value.length})
                    </button>
                    <button
                      class={`px-5 py-3 text-sm font-semibold transition-all border-b-2 ${
                        tokenTab.value === "gateway"
                          ? "text-cyan-600 border-cyan-600"
                          : "text-gray-500 border-transparent hover:text-gray-800"
                      }`}
                      onClick$={() => (tokenTab.value = "gateway")}
                    >
                      Gateway Balances
                    </button>
                  </div>

                  {/* ── account_lines ── */}
                  {tokenTab.value === "lines" && (
                    <div>
                      {accountLines.value.length === 0 ? (
                        <div class="text-center py-12 text-gray-400">
                          <div class="text-4xl mb-2">🔗</div>
                          <p>No trust lines found for this account</p>
                        </div>
                      ) : (
                        <div class="overflow-x-auto rounded-xl border border-gray-200">
                          <table class="w-full text-sm">
                            <thead class="bg-gray-50">
                              <tr>
                                <th class="px-4 py-3 text-left font-semibold text-gray-700">
                                  Currency
                                </th>
                                <th class="px-4 py-3 text-right font-semibold text-gray-700">
                                  Balance
                                </th>
                                <th class="px-4 py-3 text-right font-semibold text-gray-700">
                                  Limit
                                </th>
                                <th class="px-4 py-3 text-right font-semibold text-gray-700">
                                  Peer Limit
                                </th>
                                <th class="px-4 py-3 text-left font-semibold text-gray-700">
                                  Issuer / Peer
                                </th>
                                <th class="px-4 py-3 text-center font-semibold text-gray-700">
                                  Quality
                                </th>
                                <th class="px-4 py-3 text-center font-semibold text-gray-700">
                                  Flags
                                </th>
                              </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">
                              {accountLines.value.map(
                                (line: any, idx: number) => {
                                  const bal = parseFloat(line.balance || "0");
                                  const isNegative = bal < 0;
                                  const isZero = bal === 0;
                                  const currency =
                                    line.currency?.length === 40
                                      ? `${line.currency.slice(0, 8)}…`
                                      : line.currency;

                                  return (
                                    <tr
                                      key={`${line.account}-${line.currency}-${idx}`}
                                      class="hover:bg-gray-50 transition"
                                    >
                                      <td class="px-4 py-3">
                                        <span class="font-mono font-bold text-gray-900">
                                          {currency}
                                        </span>
                                      </td>
                                      <td
                                        class={`px-4 py-3 text-right font-mono font-semibold ${isNegative ? "text-red-600" : isZero ? "text-gray-400" : "text-green-700"}`}
                                      >
                                        {bal.toLocaleString(undefined, {
                                          maximumFractionDigits: 8,
                                        })}
                                      </td>
                                      <td class="px-4 py-3 text-right font-mono text-gray-600">
                                        {parseFloat(
                                          line.limit || "0",
                                        ).toLocaleString()}
                                      </td>
                                      <td class="px-4 py-3 text-right font-mono text-gray-600">
                                        {parseFloat(
                                          line.limit_peer || "0",
                                        ).toLocaleString()}
                                      </td>
                                      <td
                                        class="px-4 py-3 font-mono text-xs text-gray-500 max-w-[180px] truncate"
                                        title={line.account}
                                      >
                                        {line.account
                                          ? `${line.account.slice(0, 8)}…${line.account.slice(-6)}`
                                          : "—"}
                                      </td>
                                      <td class="px-4 py-3 text-center text-xs text-gray-500">
                                        {line.quality_in &&
                                        line.quality_in !== 0
                                          ? `In: ${line.quality_in}`
                                          : ""}
                                        {line.quality_out &&
                                        line.quality_out !== 0
                                          ? ` Out: ${line.quality_out}`
                                          : ""}
                                        {(!line.quality_in ||
                                          line.quality_in === 0) &&
                                        (!line.quality_out ||
                                          line.quality_out === 0)
                                          ? "—"
                                          : ""}
                                      </td>
                                      <td class="px-4 py-3 text-center">
                                        <div class="flex gap-1 justify-center flex-wrap">
                                          {line.no_ripple && (
                                            <span class="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                                              NoRipple
                                            </span>
                                          )}
                                          {line.freeze && (
                                            <span class="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                                              Frozen
                                            </span>
                                          )}
                                          {line.authorized && (
                                            <span class="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                                              Auth
                                            </span>
                                          )}
                                          {!line.no_ripple &&
                                            !line.freeze &&
                                            !line.authorized && (
                                              <span class="text-[10px] text-gray-400">
                                                —
                                              </span>
                                            )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                },
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Summary stats */}
                      {accountLines.value.length > 0 && (
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                          <div class="rounded-xl bg-gray-50 border border-gray-100 p-4">
                            <div class="text-xs text-gray-500 font-medium">
                              Total Lines
                            </div>
                            <div class="text-2xl font-bold text-gray-900 mt-1">
                              {accountLines.value.length}
                            </div>
                          </div>
                          <div class="rounded-xl bg-gray-50 border border-gray-100 p-4">
                            <div class="text-xs text-gray-500 font-medium">
                              Unique Currencies
                            </div>
                            <div class="text-2xl font-bold text-gray-900 mt-1">
                              {
                                new Set(
                                  accountLines.value.map(
                                    (l: any) => l.currency,
                                  ),
                                ).size
                              }
                            </div>
                          </div>
                          <div class="rounded-xl bg-gray-50 border border-gray-100 p-4">
                            <div class="text-xs text-gray-500 font-medium">
                              Positive Balances
                            </div>
                            <div class="text-2xl font-bold text-green-600 mt-1">
                              {
                                accountLines.value.filter(
                                  (l: any) => parseFloat(l.balance || "0") > 0,
                                ).length
                              }
                            </div>
                          </div>
                          <div class="rounded-xl bg-gray-50 border border-gray-100 p-4">
                            <div class="text-xs text-gray-500 font-medium">
                              Frozen Lines
                            </div>
                            <div class="text-2xl font-bold text-blue-600 mt-1">
                              {
                                accountLines.value.filter((l: any) => l.freeze)
                                  .length
                              }
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── gateway_balances ── */}
                  {tokenTab.value === "gateway" && (
                    <div>
                      {!gatewayBalances.value ? (
                        <div class="text-center py-12 text-gray-400">
                          <div class="text-4xl mb-2">🏦</div>
                          <p>
                            No gateway balance data available for this account
                          </p>
                          <p class="text-xs mt-1">
                            This command works best with issuer / gateway
                            accounts
                          </p>
                        </div>
                      ) : (
                        <div class="space-y-6">
                          {/* Obligations */}
                          {gatewayBalances.value.obligations &&
                            Object.keys(gatewayBalances.value.obligations)
                              .length > 0 && (
                              <div>
                                <h3 class="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                  <span class="text-red-500">📤</span>{" "}
                                  Obligations (Issued to Others)
                                </h3>
                                <div class="overflow-x-auto rounded-xl border border-red-100">
                                  <table class="w-full text-sm">
                                    <thead class="bg-red-50">
                                      <tr>
                                        <th class="px-4 py-3 text-left font-semibold text-red-800">
                                          Currency
                                        </th>
                                        <th class="px-4 py-3 text-right font-semibold text-red-800">
                                          Total Outstanding
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody class="divide-y divide-red-50">
                                      {Object.entries(
                                        gatewayBalances.value.obligations,
                                      ).map(
                                        ([currency, amount]: [string, any]) => (
                                          <tr
                                            key={`obl-${currency}`}
                                            class="hover:bg-red-50/50 transition"
                                          >
                                            <td class="px-4 py-3 font-mono font-bold text-gray-900">
                                              {currency.length === 40
                                                ? `${currency.slice(0, 8)}…`
                                                : currency}
                                            </td>
                                            <td class="px-4 py-3 text-right font-mono font-semibold text-red-700">
                                              {parseFloat(
                                                amount,
                                              ).toLocaleString(undefined, {
                                                maximumFractionDigits: 8,
                                              })}
                                            </td>
                                          </tr>
                                        ),
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                          {/* Balances (held by this account from other issuers) */}
                          {gatewayBalances.value.balances &&
                            Object.keys(gatewayBalances.value.balances).length >
                              0 && (
                              <div>
                                <h3 class="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                  <span class="text-green-500">📥</span>{" "}
                                  Balances (Held by Account)
                                </h3>
                                <div class="overflow-x-auto rounded-xl border border-green-100">
                                  <table class="w-full text-sm">
                                    <thead class="bg-green-50">
                                      <tr>
                                        <th class="px-4 py-3 text-left font-semibold text-green-800">
                                          Counterparty
                                        </th>
                                        <th class="px-4 py-3 text-left font-semibold text-green-800">
                                          Currency
                                        </th>
                                        <th class="px-4 py-3 text-right font-semibold text-green-800">
                                          Balance
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody class="divide-y divide-green-50">
                                      {Object.entries(
                                        gatewayBalances.value.balances,
                                      ).flatMap(
                                        ([peer, currencies]: [string, any]) =>
                                          (currencies as any[]).map(
                                            (c: any, i: number) => (
                                              <tr
                                                key={`bal-${peer}-${i}`}
                                                class="hover:bg-green-50/50 transition"
                                              >
                                                <td
                                                  class="px-4 py-3 font-mono text-xs text-gray-500"
                                                  title={peer}
                                                >
                                                  {peer
                                                    ? `${peer.slice(0, 8)}…${peer.slice(-6)}`
                                                    : "—"}
                                                </td>
                                                <td class="px-4 py-3 font-mono font-bold text-gray-900">
                                                  {c.currency?.length === 40
                                                    ? `${c.currency.slice(0, 8)}…`
                                                    : c.currency}
                                                </td>
                                                <td class="px-4 py-3 text-right font-mono font-semibold text-green-700">
                                                  {parseFloat(
                                                    c.value || "0",
                                                  ).toLocaleString(undefined, {
                                                    maximumFractionDigits: 8,
                                                  })}
                                                </td>
                                              </tr>
                                            ),
                                          ),
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                          {/* Assets (frozen balances held by others) */}
                          {gatewayBalances.value.assets &&
                            Object.keys(gatewayBalances.value.assets).length >
                              0 && (
                              <div>
                                <h3 class="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                  <span class="text-blue-500">🧊</span> Frozen
                                  Assets
                                </h3>
                                <div class="overflow-x-auto rounded-xl border border-blue-100">
                                  <table class="w-full text-sm">
                                    <thead class="bg-blue-50">
                                      <tr>
                                        <th class="px-4 py-3 text-left font-semibold text-blue-800">
                                          Counterparty
                                        </th>
                                        <th class="px-4 py-3 text-left font-semibold text-blue-800">
                                          Currency
                                        </th>
                                        <th class="px-4 py-3 text-right font-semibold text-blue-800">
                                          Amount
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody class="divide-y divide-blue-50">
                                      {Object.entries(
                                        gatewayBalances.value.assets,
                                      ).flatMap(
                                        ([peer, currencies]: [string, any]) =>
                                          (currencies as any[]).map(
                                            (c: any, i: number) => (
                                              <tr
                                                key={`asset-${peer}-${i}`}
                                                class="hover:bg-blue-50/50 transition"
                                              >
                                                <td
                                                  class="px-4 py-3 font-mono text-xs text-gray-500"
                                                  title={peer}
                                                >
                                                  {peer
                                                    ? `${peer.slice(0, 8)}…${peer.slice(-6)}`
                                                    : "—"}
                                                </td>
                                                <td class="px-4 py-3 font-mono font-bold text-gray-900">
                                                  {c.currency?.length === 40
                                                    ? `${c.currency.slice(0, 8)}…`
                                                    : c.currency}
                                                </td>
                                                <td class="px-4 py-3 text-right font-mono font-semibold text-blue-700">
                                                  {parseFloat(
                                                    c.value || "0",
                                                  ).toLocaleString(undefined, {
                                                    maximumFractionDigits: 8,
                                                  })}
                                                </td>
                                              </tr>
                                            ),
                                          ),
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                          {/* No data message */}
                          {!gatewayBalances.value.obligations &&
                            !gatewayBalances.value.balances &&
                            !gatewayBalances.value.assets && (
                              <div class="text-center py-12 text-gray-400">
                                <div class="text-4xl mb-2">📊</div>
                                <p>Gateway returned no balance data</p>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            {/* Empty state */}
            {!tokenLoading.value &&
              accountLines.value.length === 0 &&
              !gatewayBalances.value &&
              !tokenError.value &&
              tokenAddress.value.trim() === "" && (
                <div class="text-center py-16 text-gray-400">
                  <div class="text-6xl mb-4">🪙</div>
                  <p class="text-lg">
                    Enter an r-address to view trust lines &amp; gateway
                    balances
                  </p>
                  <p class="text-sm mt-2">
                    Uses{" "}
                    <code class="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                      account_lines
                    </code>{" "}
                    and{" "}
                    <code class="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                      gateway_balances
                    </code>{" "}
                    commands
                  </p>
                </div>
              )}
          </div>
        )}

        {/* Explorer Tab */}
        {activeTab.value === "explorer" && (
          <div class="space-y-8">
            {/* Search Bar */}
            <div class="flex flex-col sm:flex-row gap-3">
              <div class="relative flex-1">
                <input
                  type="text"
                  placeholder={
                    queryType.value === "ledger"
                      ? "Ledger index or hash..."
                      : "Account address (r...), tx hash, etc."
                  }
                  class="w-full rounded-lg border border-gray-300 bg-white px-5 py-4 pr-14 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  value={address.value}
                  onInput$={(e) =>
                    (address.value = (e.target as HTMLInputElement).value)
                  }
                />
                <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
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
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>

              <select
                class="px-4 py-4 rounded-lg border border-gray-300 bg-white text-gray-900 hover:border-gray-400 transition-colors"
                value={queryType.value}
                onChange$={(e) =>
                  (queryType.value = (e.target as HTMLSelectElement)
                    .value as any)
                }
              >
                <option value="account_info">Account Info</option>
                <option value="tx">Transaction</option>
                <option value="ledger">Ledger</option>
              </select>

              <button
                class="px-8 py-4 rounded-lg bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold transition-all hover:shadow-lg hover:shadow-cyan-500/20 active:scale-95"
                onClick$={() => {
                  searchQuery.value = address.value;
                  runQuery();
                }}
                disabled={!address.value.trim() || status.value !== "connected"}
              >
                Search
              </button>
            </div>

            {/* Stats Grid - Bento Layout */}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status Card */}
              <div class="p-6 rounded-xl border border-gray-200 bg-linear-to-br from-gray-50 to-gray-100 hover:border-gray-300 transition-colors">
                <div class="text-xs text-gray-600 font-medium mb-2">STATUS</div>
                <div class="flex items-center gap-3">
                  <div
                    class={`w-3 h-3 rounded-full animate-pulse ${
                      status.value === "connected"
                        ? "bg-green-500"
                        : status.value === "connecting"
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                  />
                  <div class="text-2xl font-bold capitalize text-gray-900">
                    {status.value}
                  </div>
                </div>
              </div>

              {/* TXN Fee Card */}
              <div class="p-6 rounded-xl border border-gray-200 bg-linear-to-br from-gray-50 to-gray-100 hover:border-gray-300 transition-colors">
                <div class="text-xs text-gray-600 font-medium mb-2">
                  AVG TXN FEE
                </div>
                <div class="text-2xl font-bold text-cyan-600 font-mono">
                  {avgTxnFee()} XRP
                </div>
              </div>

              {/* Ledger Interval Card */}
              <div class="p-6 rounded-xl border border-gray-200 bg-linear-to-br from-gray-50 to-gray-100 hover:border-gray-300 transition-colors">
                <div class="text-xs text-gray-600 font-medium mb-2">
                  AVG LEDGER INTERVAL
                </div>
                <div class="text-2xl font-bold text-blue-600 font-mono">
                  {avgLedgerInterval()} s
                </div>
              </div>

              {/* TXN/SEC Card */}
              <div class="p-6 rounded-xl border border-gray-200 bg-linear-to-br from-gray-50 to-gray-100 hover:border-gray-300 transition-colors">
                <div class="text-xs text-gray-600 font-medium mb-2">
                  TXN/SEC
                </div>
                <div class="text-2xl font-bold text-teal-600 font-mono">
                  {txnPerSec()}
                </div>
              </div>

              {/* Load Factor */}
              <div class="p-6 rounded-xl border border-gray-200 bg-linear-to-br from-gray-50 to-gray-100 hover:border-gray-300 transition-colors">
                <div class="text-xs text-gray-600 font-medium mb-2">
                  LOAD FACTOR
                </div>
                <div class="text-2xl font-bold text-purple-600 font-mono">
                  {loadFee.value ?? "--"}
                </div>
              </div>

              {/* AVG TXN/LEDGER */}
              <div class="p-6 rounded-xl border border-gray-200 bg-linear-to-br from-gray-50 to-gray-100 hover:border-gray-300 transition-colors">
                <div class="text-xs text-gray-600 font-medium mb-2">
                  AVG TXN/LEDGER
                </div>
                <div class="text-2xl font-bold text-green-600 font-mono">
                  {avgTxnPerLedger()}
                </div>
              </div>

              {/* Total Ledgers */}
              <div class="p-6 rounded-xl border border-gray-200 bg-linear-to-br from-gray-50 to-gray-100 hover:border-gray-300 transition-colors">
                <div class="text-xs text-gray-600 font-medium mb-2">
                  TOTAL LEDGERS
                </div>
                <div class="text-2xl font-bold text-orange-600 font-mono">
                  {ledgers.value.length > 0
                    ? ledgers.value[0]?.ledger_index
                    : "--"}
                </div>
              </div>

              {/* Total Txns */}
              <div class="p-6 rounded-xl border border-gray-200 bg-linear-to-br from-gray-50 to-gray-100 hover:border-gray-300 transition-colors">
                <div class="text-xs text-gray-600 font-medium mb-2">
                  TOTAL TXN COUNT
                </div>
                <div class="text-2xl font-bold text-indigo-600 font-mono">
                  {txnCounts.value.reduce((a, b) => a + b, 0)}
                </div>
              </div>
            </div>

            {/* Live Ledger Stream with Legend */}
            <div class="rounded-xl border border-gray-200 bg-linear-to-br from-gray-50 to-gray-100 p-8">
              <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 class="text-xl font-bold text-gray-900">
                    Live Ledger Stream
                  </h2>
                  <p class="text-sm text-gray-600 mt-1">
                    Real-time ledger closes and transactions
                  </p>
                </div>
              </div>

              {/* Transaction Type Legend */}
              <div class="mb-6 p-4 rounded-lg bg-white border border-gray-200">
                <div class="text-xs font-semibold text-gray-600 mb-3">
                  TRANSACTION TYPES
                </div>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {Object.entries(TX_TYPE_COLORS).map(([key, data]) => (
                    <div key={key} class="flex items-center gap-2">
                      <div class={`w-2.5 h-2.5 rounded-full ${data.dot}`} />
                      <span class="text-xs text-gray-700">{data.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ledger Cards with Animation */}
              <div class="overflow-x-auto pb-4">
                <div class="flex gap-4 min-w-min">
                  {ledgers.value.length > 0 ? (
                    ledgers.value.map((ledger, idx) => (
                      <div
                        key={ledger.ledger_hash ?? ledger.ledger_index}
                        class={`shrink-0 w-72 p-5 rounded-lg border border-gray-200 bg-linear-to-br from-white to-gray-50 hover:border-gray-300 transition-all duration-300 ${
                          idx === 0
                            ? "ring-2 ring-cyan-500/50 animate-pulse"
                            : ""
                        }`}
                      >
                        <div class="flex justify-between items-start mb-4">
                          <div>
                            <div class="font-mono text-lg font-bold text-cyan-600">
                              #{ledger.ledger_index}
                            </div>
                            <div class="text-xs text-gray-500 mt-1">
                              {ledger.close_time_human}
                            </div>
                          </div>
                          {idx === 0 && (
                            <span class="px-2 py-1 rounded text-xs font-semibold bg-cyan-100 text-cyan-700 border border-cyan-300">
                              LATEST
                            </span>
                          )}
                        </div>

                        <div class="mb-4 p-3 rounded bg-white border border-gray-200">
                          <div class="text-xs text-gray-600 mb-1">
                            TRANSACTIONS
                          </div>
                          <div class="text-2xl font-bold text-gray-900">
                            {ledger.txn_count}
                          </div>
                        </div>

                        {/* Mini Visualization */}
                        <div class="grid grid-cols-6 gap-2">
                          {txs.value.slice(0, 36).map((tx, i) => {
                            const colorData = getTxColorData(
                              tx.TransactionType,
                            );
                            return (
                              <div
                                key={tx.hash ?? `tx-${i}`}
                                title={tx.TransactionType}
                                class={`w-4 h-4 rounded-sm ${colorData.dot} opacity-70 hover:opacity-100 transition-opacity cursor-pointer`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div class="w-full text-center py-8 text-gray-500">
                      Waiting for ledger updates...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div class="rounded-xl border border-gray-200 bg-linear-to-br from-gray-50 to-gray-100 p-8">
              <h2 class="text-xl font-bold text-gray-900 mb-6">
                Recent Transactions
              </h2>
              <div class="space-y-3">
                {txs.value.slice(0, 10).map((tx, idx) => {
                  const colorData = getTxColorData(tx.TransactionType);
                  return (
                    <div
                      key={tx.hash ?? `tx-${idx}`}
                      class="p-4 rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-all hover:shadow-lg hover:shadow-gray-200"
                    >
                      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div class="flex items-center gap-3 flex-1">
                          <div
                            class={`w-3 h-3 rounded-full ${colorData.dot} shrink-0`}
                          />
                          <div class="min-w-0 flex-1">
                            <div class="font-semibold text-gray-900 truncate">
                              {colorData.label}
                            </div>
                            <div class="text-xs text-gray-600 truncate">
                              {tx.hash ?? "N/A"}
                            </div>
                          </div>
                        </div>
                        <div class="text-right">
                          {tx.amount && (
                            <div class="text-sm font-mono font-bold text-cyan-600">
                              {tx.amount}
                            </div>
                          )}
                          {tx.fee && (
                            <div class="text-xs text-gray-600">
                              Fee: {tx.fee} XRP
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Account Search Results */}
            <Resource
              value={resource}
              onPending={() => (
                <div class="text-center py-8 text-gray-500">
                  Loading account info...
                </div>
              )}
              onRejected={(err) => (
                <div class="text-red-600 text-center py-8">
                  Error fetching data: {String(err)}
                </div>
              )}
              onResolved={(data) => (
                <>
                  {data.account && (
                    <div class="rounded-xl border border-gray-200 bg-linear-to-br from-gray-50 to-gray-100 p-8">
                      <h2 class="text-xl font-bold text-gray-900 mb-6">
                        Account Details
                      </h2>
                      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div class="p-4 rounded-lg bg-white border border-gray-200">
                          <div class="text-xs text-gray-600 font-semibold mb-3">
                            BALANCE
                          </div>
                          <div class="text-2xl font-bold text-cyan-600 font-mono">
                            {data.account.balanceXrp ??
                              data.account.balance ??
                              "--"}{" "}
                            XRP
                          </div>
                        </div>

                        <div class="p-4 rounded-lg bg-white border border-gray-200">
                          <div class="text-xs text-gray-600 font-semibold mb-3">
                            SEQUENCE
                          </div>
                          <div class="text-2xl font-bold text-blue-600 font-mono">
                            {data.account.sequence ?? "--"}
                          </div>
                        </div>

                        <div class="p-4 rounded-lg bg-white border border-gray-200">
                          <div class="text-xs text-gray-600 font-semibold mb-3">
                            OWNER COUNT
                          </div>
                          <div class="text-2xl font-bold text-purple-600 font-mono">
                            {data.account.ownerCount ??
                              data.account.owner_count ??
                              "--"}
                          </div>
                        </div>

                        <div class="p-4 rounded-lg bg-white border border-gray-200">
                          <div class="text-xs text-gray-600 font-semibold mb-3">
                            TRUST LINES
                          </div>
                          <div class="text-2xl font-bold text-green-600 font-mono">
                            {data.account.trustLines ?? 0}
                          </div>
                        </div>

                        <div class="p-4 rounded-lg bg-white border border-gray-200">
                          <div class="text-xs text-gray-600 font-semibold mb-3">
                            ISSUED CURRENCIES
                          </div>
                          <div class="text-2xl font-bold text-orange-600 font-mono">
                            {data.account.issuedCurrencies ?? 0}
                          </div>
                        </div>

                        <div class="p-4 rounded-lg bg-white border border-gray-200">
                          <div class="text-xs text-gray-600 font-semibold mb-3">
                            NFT HOLDINGS
                          </div>
                          <div class="text-2xl font-bold text-indigo-600 font-mono">
                            {data.account.ownedNFTs ?? 0}
                          </div>
                        </div>
                      </div>

                      {Object.keys(data.account.flagsDecoded ?? {}).length >
                        0 && (
                        <div class="mt-6 p-4 rounded-lg bg-white border border-gray-200">
                          <div class="text-xs text-gray-600 font-semibold mb-3">
                            ACCOUNT FLAGS
                          </div>
                          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {Object.entries(data.account.flagsDecoded ?? {})
                              .filter(([, val]) => Boolean(val))
                              .map(([key]) => (
                                <div key={key} class="flex items-center gap-2">
                                  <span class="text-green-600">✓</span>
                                  <span class="text-sm text-gray-700">
                                    {key.replace(/([A-Z])/g, " $1").trim()}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {data.transactions && data.transactions.length > 0 && (
                    <div class="rounded-xl border border-gray-200 bg-linear-to-br from-gray-50 to-gray-100 p-8">
                      <h2 class="text-xl font-bold text-gray-900 mb-6">
                        Account Transactions
                      </h2>
                      <div class="space-y-3">
                        {data.transactions.map((tx, idx) => (
                          <div
                            key={tx.hash ?? `tx-${idx}`}
                            class="p-4 rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-all"
                          >
                            <div class="flex justify-between items-start gap-4 mb-2">
                              <span class="font-semibold text-gray-900">
                                {tx.TransactionType}
                              </span>
                              <span class="text-xs text-gray-600">
                                {tx.date
                                  ? new Date(
                                      (tx.date + 946684800) * 1000,
                                    ).toLocaleString()
                                  : ""}
                              </span>
                            </div>
                            {tx.amount && (
                              <div class="text-sm text-cyan-600 font-mono">
                                {tx.amount}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            />

            {/* Query Results */}
            {detailedResult.value && (
              <div class="rounded-xl border border-gray-200 bg-linear-to-br from-gray-50 to-gray-100 p-8">
                <h3 class="text-xl font-bold text-gray-900 mb-4">
                  Query Results ({queryType.value})
                </h3>
                <div class="overflow-auto rounded-lg bg-gray-900 p-4 border border-gray-300">
                  <pre class="text-xs text-gray-100 font-mono wrap-break-word">
                    {JSON.stringify(detailedResult.value, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {queryError.value && (
              <div class="p-6 rounded-xl border border-red-300 bg-red-50 text-red-700">
                <div class="font-semibold mb-2">Error</div>
                {queryError.value}
              </div>
            )}
          </div>
        )}

        {/* Amendments Tab */}
        {activeTab.value === "amendments" && (
          <div class="space-y-8">
            <div class="rounded-xl border border-gray-200 bg-linear-to-br from-gray-50 to-gray-100 p-8">
              <h2 class="text-2xl font-bold text-gray-900 mb-6">
                XRP Ledger Amendments
              </h2>
              <div class="space-y-3">
                {amendments.value.map((amendment) => (
                  <div
                    key={amendment.name}
                    class="p-6 rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-all"
                  >
                    <div class="flex items-start gap-4">
                      <div
                        class={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                          amendment.status === "active"
                            ? "bg-green-500"
                            : "bg-amber-500"
                        }`}
                      />
                      <div class="flex-1">
                        <div class="flex justify-between items-start gap-4">
                          <div>
                            <h3 class="text-lg font-bold text-gray-900">
                              {amendment.name}
                            </h3>
                            <p class="text-sm text-gray-600 mt-2">
                              {amendment.description}
                            </p>
                          </div>
                          <span
                            class={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
                              amendment.status === "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {amendment.status.charAt(0).toUpperCase() +
                              amendment.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ETF Tracker Tab */}
        {activeTab.value === "etf" && (
          <div class="space-y-8">
            {/* Market Stats */}
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
              <div class="p-6 rounded-lg bg-white border border-gray-200">
                <div class="text-xs text-gray-600 font-semibold mb-2">
                  TOTAL AUM
                </div>
                <div class="text-2xl font-bold text-cyan-600">$2.4B</div>
              </div>
              <div class="p-6 rounded-lg bg-white border border-gray-200">
                <div class="text-xs text-gray-600 font-semibold mb-2">
                  24H VOLUME
                </div>
                <div class="text-2xl font-bold text-blue-600">$342M</div>
              </div>
              <div class="p-6 rounded-lg bg-white border border-gray-200">
                <div class="text-xs text-gray-600 font-semibold mb-2">
                  AVG EXPENSE RATIO
                </div>
                <div class="text-2xl font-bold text-purple-600">0.24%</div>
              </div>
              <div class="p-6 rounded-lg bg-white border border-gray-200">
                <div class="text-xs text-gray-600 font-semibold mb-2">
                  YTD PERFORMANCE
                </div>
                <div class="text-2xl font-bold text-green-600">+142%</div>
              </div>
            </div>
            <div class="rounded-xl border border-gray-200 bg-linear-to-br from-gray-50 to-gray-100 p-8">
              <h2 class="text-2xl font-bold text-gray-900 mb-6">
                XRP ETF Live Tracker
              </h2>

              {/* ETF Performance List */}
              <div class="space-y-3">
                {[
                  {
                    name: "iShares XRP Trust",
                    ticker: "IXRP",
                    price: 2124.56,
                    change: 5.3,
                  },
                  {
                    name: "Grayscale XRP Mini",
                    ticker: "GXRPM",
                    price: 987.23,
                    change: 3.8,
                  },
                  {
                    name: "Fidelity XRP Fund",
                    ticker: "FXRP",
                    price: 1856.41,
                    change: 6.1,
                  },
                  {
                    name: "Vanguard XRP ETF",
                    ticker: "VXRP",
                    price: 2345.89,
                    change: 4.5,
                  },
                  {
                    name: "BlackRock XRP iShares",
                    ticker: "BRXP",
                    price: 3421.75,
                    change: -1.2,
                  },
                  {
                    name: "Invesco XRP Pro",
                    ticker: "IXPP",
                    price: 1654.32,
                    change: 7.8,
                  },
                ].map((etf) => (
                  <div
                    key={etf.ticker}
                    class="p-5 rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-all"
                  >
                    <div class="flex justify-between items-center">
                      <div class="flex-1">
                        <div class="font-semibold text-gray-900">
                          {etf.ticker}
                        </div>
                        <div class="text-sm text-gray-600">{etf.name}</div>
                      </div>
                      <div class="text-right">
                        <div class="text-2xl font-bold text-cyan-600 font-mono">
                          ${etf.price.toFixed(2)}
                        </div>
                        <div
                          class={`text-sm font-bold ${
                            etf.change >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {etf.change >= 0 ? "+" : ""}
                          {etf.change}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DEX Map Tab */}
        {activeTab.value === "globe" && (
          <div class="space-y-8">
            {/* Stats Summary */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div class="p-6 rounded-lg bg-white border border-gray-200">
                <div class="text-xs text-gray-600 font-semibold mb-2">
                  ACTIVE TRADES
                </div>
                <div class="text-3xl font-bold text-cyan-600">
                  {dexTrades.value.length}
                </div>
              </div>
              <div class="p-6 rounded-lg bg-white border border-gray-200">
                <div class="text-xs text-gray-600 font-semibold mb-2">
                  TOTAL VOLUME
                </div>
                <div class="text-3xl font-bold text-blue-600">
                  {dexTrades.value.reduce((a, b) => a + b.volume, 0).toFixed(2)}
                </div>
              </div>
              <div class="p-6 rounded-lg bg-white border border-gray-200">
                <div class="text-xs text-gray-600 font-semibold mb-2">
                  AVG PRICE
                </div>
                <div class="text-3xl font-bold text-purple-600">
                  {(
                    dexTrades.value.reduce((a, b) => a + b.price, 0) /
                    Math.max(dexTrades.value.length, 1)
                  ).toFixed(6)}
                </div>
              </div>
            </div>
            <XrplLiveFeed />
          </div>
        )}
      </div>
    </main>
  );
});

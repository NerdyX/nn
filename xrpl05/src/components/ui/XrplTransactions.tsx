// XrplTransactions.tsx - Live WebSocket feed using shared NetworkContext
import { component$, useVisibleTask$, useStore } from "@builder.io/qwik";
import { useNetworkContext, NETWORK_CONFIG } from "~/context/network-context";

export default component$(() => {
  const { activeNetwork, wsUrl } = useNetworkContext();

  const txs = useStore<
    {
      hash: string;
      amount: string;
      from: string;
      to: string;
      type: string;
    }[]
  >([]);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    // Track the shared wsUrl so we reconnect when the user toggles network
    const currentWsUrl = track(() => wsUrl.value);
    const currentNetwork = track(() => activeNetwork.value);
    const nativeCurrency = NETWORK_CONFIG[currentNetwork].nativeCurrency;

    // Clear previous transactions on network switch
    txs.length = 0;

    const ws = new WebSocket(currentWsUrl);

    ws.onopen = () => {
      console.log(`✅ Connected to ${currentNetwork} (${currentWsUrl})`);
      ws.send(
        JSON.stringify({
          id: 1,
          command: "subscribe",
          streams: ["transactions"],
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Only validated transactions
        if (data.type === "transaction" && data.validated && data.transaction) {
          const tx = data.transaction;

          txs.unshift({
            hash: tx.hash?.slice(0, 16) + "..." || "N/A",
            amount: tx.Amount
              ? `${(parseInt(tx.Amount) / 1_000_000).toFixed(2)} ${nativeCurrency}`
              : `0 ${nativeCurrency}`,
            from: tx.Account?.slice(0, 12) + "..." || "N/A",
            to: tx.Destination?.slice(0, 12) + "..." || "N/A",
            type: tx.TransactionType || "Payment",
          });

          // Keep only 15 latest
          if (txs.length > 15) {
            txs.pop();
          }
        }
      } catch (e) {
        console.log("Parse error:", e);
      }
    };

    ws.onerror = () => console.log("WS error");
    ws.onclose = () => console.log("WS closed");

    // Cleanup on network switch or unmount
    cleanup(() => ws.close());
  });

  return (
    <div class="bg-transparent border border-white/10 rounded-2xl p-6 max-h-105 overflow-hidden shadow-2xl">
      {/* Header */}
      <div class="flex items-center justify-between mb-5 pb-3 border-b border-white/5">
        <div class="flex items-center gap-2">
          <div class="w-2.5 h-2.5 bg-green-400 rounded-full animate-ping" />
          <span class="text-lg font-bold text-black">
            Live {NETWORK_CONFIG[activeNetwork.value].label} Transactions
          </span>
        </div>
        <span class="text-xs text-black font-mono">{txs.length}</span>
      </div>

      {/* List */}
      <div class="space-y-1 max-h-85 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 pr-1">
        {txs.map((tx, index) => (
          <div
            key={index}
            class="p-3 bg-white/3 hover:bg-white/5 rounded-lg border border-white/10 transition-all cursor-pointer group"
          >
            <div class="flex justify-between items-start mb-1">
              <span class="text-emerald-400 font-bold text-sm font-mono">
                {tx.amount}
              </span>
              <span class="text-xs bg-black/50 px-2 py-0.5 rounded-full text-black font-mono">
                {tx.type}
              </span>
            </div>

            <div class="flex items-center gap-2 text-xs text-black font-mono">
              <span>{tx.from}</span>
              <span class="text-emerald-400 text-[11px]">→</span>
              <span>{tx.to}</span>
            </div>

            <div class="mt-1.5 pt-1.5 border-t border-white/10 text-xs text-white/40 font-mono">
              {tx.hash}
            </div>
          </div>
        ))}

        {txs.length === 0 && (
          <div class="text-center py-16 text-black">
            <div class="w-12 h-12 border-2 border-dashed border-white/20 border-t-white/40 rounded-full animate-spin mx-auto mb-3" />
            <p class="text-sm">
              Connecting to {NETWORK_CONFIG[activeNetwork.value].label}...
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

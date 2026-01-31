import { component$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";

export const useLedgerStats = routeLoader$(async () => {
  try {
    const res = await fetch("https://xrplcluster.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "ledger_current",
        params: [{}],
      }),
    });

    const json = await res.json();

    return {
      ledgerIndex: json.result.ledger_current_index,
      status: "CONNECTED",
    };
  } catch {
    return {
      ledgerIndex: "UNKNOWN",
      status: "DISCONNECTED",
    };
  }
});

export default component$(() => {
  const stats = useLedgerStats();

  return (
    <section class="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center px-6">
      <div class="max-w-xl w-full">
        {/* Terminal Header */}
        <div class="mb-4 text-green-500">XRPL-OS :: TERMINAL v0.404</div>

        {/* Typing Lines */}
        <div class="space-y-2">
          <p class="typing typing-1">&gt; INIT ROUTE RESOLUTION...</p>
          <p class="typing typing-2">&gt; QUERY LEDGER PATH</p>
          <p class="typing typing-3 text-red-400">&gt; ERROR: PATH_NOT_FOUND</p>
        </div>

        {/* Divider */}
        <div class="my-6 border-t border-green-700 opacity-50"></div>

        {/* Live XRPL Stats */}
        <div class="space-y-1 text-sm">
          <p>
            NETWORK STATUS:{" "}
            <span class="text-green-300">{stats.value.status}</span>
          </p>
          <p>
            CURRENT LEDGER:{" "}
            <span class="text-green-300">{stats.value.ledgerIndex}</span>
          </p>
          <p>
            ROUTE HASH: <span class="text-green-300">0x404_NOT_FOUND</span>
          </p>
        </div>

        {/* Action */}
        <div class="mt-8">
          <a
            href="/"
            class="inline-block text-green-400 border border-green-600 px-4 py-2 hover:bg-green-900/30 transition"
          >
            &gt; RETURN TO GENESIS
          </a>
        </div>
      </div>

      {/* CSS */}
      <style>
        {`
          .typing {
            white-space: nowrap;
            overflow: hidden;
            border-right: 2px solid rgba(0,255,0,0.75);
            width: 0;
            animation: typing 2s steps(30, end) forwards,
                       blink 0.75s step-end infinite;
          }

          .typing-1 { animation-delay: 0.5s; }
          .typing-2 { animation-delay: 2.8s; }
          .typing-3 { animation-delay: 5.2s; }

          @keyframes typing {
            from { width: 0; }
            to { width: 100%; }
          }

          @keyframes blink {
            50% { border-color: transparent; }
          }
        `}
      </style>
    </section>
  );
});

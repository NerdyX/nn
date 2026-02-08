// XrplLiveFeed.tsx - Combined Globe + Transactions Header
import {
  component$,
  useVisibleTask$,
  useStore,
  useSignal,
} from "@builder.io/qwik";

interface Transaction {
  hash: string;
  amount: string;
  from: string;
  to: string;
  type: string;
}

export default component$(() => {
  const containerRef = useSignal<HTMLDivElement>();
  const globeRef = useSignal<any>(null);
  const txs = useStore<Transaction[]>([]);

  useVisibleTask$(() => {
    const container = containerRef.value;
    if (!container) return;

    let globeWs: WebSocket | null = null;
    let txWs: WebSocket | null = null;

    // Globe WebSocket + Arcs
    if (!(window as any).Globe) {
      const script = document.createElement("script");
      script.src = "//cdn.jsdelivr.net/npm/globe.gl";
      document.head.appendChild(script);
      script.onload = initGlobe;
    } else {
      initGlobe();
    }

    function initGlobe() {
      const world = new (window as any).Globe(container)
        .backgroundColor("rgba(0,0,0,0.1)")
        .showGlobe(true)
        .showAtmosphere(true)
        .globeImageUrl("//unpkg.com/three-globe/example/img/earth-night.jpg")
        .atmosphereColor("lightblue")
        .atmosphereAltitude(0.2)
        .pointOfView({ altitude: 2.2 }, 1000);

      globeRef.value = world;

      const arcsData: any[] = Array.from({ length: 8 }, () => ({
        startLat: (Math.random() - 0.5) * 180,
        startLng: (Math.random() - 0.5) * 360,
        endLat: (Math.random() - 0.5) * 180,
        endLng: (Math.random() - 0.5) * 360,
        color: ["#3b82f6", "#10b981"],
      }));

      world
        .arcsData(arcsData)
        .arcColor("color")
        .arcDashLength(0.12)
        .arcDashGap(0.04)
        .arcDashAnimateTime(() => Math.random() * 6000 + 2000);

      globeWs = new WebSocket("wss://s1.ripple.com:51234");
      globeWs.onopen = () =>
        globeWs?.send(
          JSON.stringify({
            command: "subscribe",
            streams: ["transactions"],
          }),
        );

      globeWs.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.transaction?.TransactionType === "Payment") {
            arcsData.push({
              startLat: Math.random() * 180 - 90,
              startLng: Math.random() * 360 - 180,
              endLat: Math.random() * 180 - 90,
              endLng: Math.random() * 360 - 180,
              color: ["#ef4444", "#f59e0b"],
            });
            if (arcsData.length > 25) arcsData.shift();
            world.arcsData(arcsData);
          }
        } catch (e) {}
      };
    }

    // Transactions WebSocket
    txWs = new WebSocket("wss://s1.ripple.com:51234");
    txWs.onopen = () => {
      txWs?.send(
        JSON.stringify({
          id: 1,
          command: "subscribe",
          streams: ["transactions"],
        }),
      );
    };

    txWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "transaction" && data.validated && data.transaction) {
          const tx = data.transaction;

          txs.unshift({
            hash: tx.hash?.slice(0, 16) + "..." || "N/A",
            amount: tx.Amount
              ? `${(parseInt(tx.Amount) / 1_000_000).toFixed(2)} XRP`
              : "0 XRP",
            from: tx.Account?.slice(0, 12) + "..." || "N/A",
            to: tx.Destination?.slice(0, 12) + "..." || "N/A",
            type: tx.TransactionType || "Payment",
          });

          if (txs.length > 12) txs.pop();
        }
      } catch (e) {}
    };

    return () => {
      globeWs?.close();
      txWs?.close();
    };
  });

  return (
    <div class="w-full bg-transparent border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-xl max-w-7xl mx-auto">
      {/* Header */}
      <div class="flex flex-col lg:flex-row gap-8 items-center justify-between mb-8 pb-8 border-b border-white/5">
        <div class="flex flex-col items-center lg:items-start gap-3">
          <div class="flex items-center gap-3">
            <div class="w-3 h-3 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full animate-ping" />
            <h1 class="text-3xl lg:text-4xl font-black bg-gradient-to-r from-black via-emerald-100 to-cyan-100 bg-clip-text text-transparent">
              Real-time XRPL transactions & global activity
            </h1>
          </div>
        </div>

        <div class="text-center">
          <div class="text-2xl font-mono font-bold text-emerald-400">
            {txs.length}
          </div>
          <div class="text-sm text-black/50 font-mono">live tx/s</div>
        </div>
      </div>

      {/* Globe + Transactions Grid */}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        {/* Globe */}
        <div class="lg:col-span-2 h-[400px] lg:h-[500px] relative group">
          <div
            ref={containerRef}
            class="absolute inset-0 w-full h-full rounded-2xl bg-transparent border-2 border-white/10 shadow-2xl flex items-center justify-center overflow-hidden"
          />
          <div class="absolute top-4 left-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-medium border border-emerald-500/50">
            🌍 Global Network
          </div>
        </div>

        {/* Live Transactions */}
        <div class="bg-transparent backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[500px] flex flex-col">
          <div class="flex items-center justify-between mb-5 pb-3 border-b border-white/10">
            <div class="flex items-center gap-2">
              <div class="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
              <span class="text-lg font-bold text-black">Live TX</span>
            </div>
            <span class="text-xs text-black/50 font-mono">{txs.length}</span>
          </div>

          <div class="flex-1 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 pr-1">
            {txs.map((tx, i) => (
              <div
                key={i}
                class="p-2.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all group"
              >
                <div class="flex justify-between items-start mb-1">
                  <span class="text-emerald-400 font-bold text-sm font-mono">
                    {tx.amount}
                  </span>
                  <span class="text-xs bg-black/60 px-1.5 py-0.5 rounded text-white font-mono">
                    {tx.type}
                  </span>
                </div>
                <div class="flex items-center gap-1.5 text-xs text-black/60 font-mono">
                  <span>{tx.from}</span>
                  <span class="text-emerald-400">→</span>
                  <span>{tx.to}</span>
                </div>
              </div>
            ))}

            {txs.length === 0 && (
              <div class="text-center py-12 flex flex-col items-center text-white/30">
                <div class="w-10 h-10 border-2 border-dashed border-white/20 border-t-emerald-400 rounded-full animate-spin mb-3" />
                <p class="text-sm">Awaiting transactions...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

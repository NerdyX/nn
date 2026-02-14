import {
  component$,
  useSignal,
  useStore,
  useVisibleTask$,
  $,
  type QRL,
} from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

// ─── Types ───────────────────────────────────────────────────
interface TokenData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: string;
  volume: string;
  sparkline: number[];
  issuer?: string;
  currency?: string;
  network?: "xrpl" | "xahau";
}

interface LedgerStats {
  ledgerIndex: number;
  txCount: number;
  closeTime: string;
  baseFee: string;
  validatedCount: number;
  tps: number;
  quorum: number;
  loadFee: number;
  avgTxnFee: number;
  avgLedgerInterval: number;
  avgTxnPerLedger: number;
}

interface LiveTx {
  hash: string;
  fullHash: string;
  type: string;
  amount: string;
  from: string;
  fullFrom: string;
  to: string;
  fullTo: string;
  timestamp: number;
  fee: string;
  sequence: number;
  currency: string;
  destinationTag?: number;
}

interface LedgerCard {
  ledgerIndex: number;
  closeTime: string;
  closeTimeMs: number;
  txnCount: number;
  totalFee: number;
  baseFee: number;
  transactions: LiveTx[];
}

interface GlobeArc {
  id: number;
  startAngle: number;
  endAngle: number;
  color: string;
  type: string;
}

// ─── Sparkline SVG Component ──────────────────────────────────
const Sparkline = component$<{
  data: number[];
  color: string;
  width?: number;
  height?: number;
}>(({ data, color, width = 120, height = 40 }) => {
  if (!data || data.length < 2)
    return <div style={{ width: `${width}px`, height: `${height}px` }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  const gradId = `sg-${color.replace("#", "").replace("/", "")}`;
  return (
    <svg width={width} height={height} class="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color={color} stop-opacity="0.3" />
          <stop offset="100%" stop-color={color} stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
});

// ─── XRP Logo ────────────────────────────────────────────────
const XrpLogo = component$<{ size?: number; color?: string }>(
  ({ size = 14, color = "currentColor" }) => (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      width={size}
      height={size}
      class="inline-block"
      style={{ verticalAlign: "middle" }}
    >
      <path
        d="M25 20L50 40M75 20L50 40M25 80L50 60M75 80L50 60"
        stroke={color}
        stroke-width="8"
        stroke-linecap="round"
      />
    </svg>
  ),
);

// ─── Helpers ─────────────────────────────────────────────────
function fmtNum(n: number, decimals = 2): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(decimals)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(decimals)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(decimals)}K`;
  return `$${n.toFixed(decimals)}`;
}

function generateSparkline(seed: number, trend: number): number[] {
  const points: number[] = [];
  let value = seed;
  for (let i = 0; i < 24; i++) {
    value += (Math.random() - 0.48 + trend * 0.02) * seed * 0.03;
    if (value < seed * 0.7) value = seed * 0.7;
    points.push(value);
  }
  return points;
}

// ─── Ledger Modal ─────────────────────────────────────────────
const LedgerModal = component$<{
  ledger: LedgerCard;
  xrpPrice: number;
  quorum: number;
  onClose$: QRL<() => void>;
}>(({ ledger, xrpPrice, quorum, onClose$ }) => {
  return (
    <div
      class="fixed inset-0 z-9999 flex items-center justify-center p-4"
      onClick$={() => onClose$()}
    >
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" />
      <div
        class="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[85vh] overflow-hidden animate-slideUp"
        onClick$={(e) => e.stopPropagation()}
      >
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <svg
                class="w-5 h-5 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <div>
              <h3 class="font-bold text-gray-900 text-lg">
                Ledger #{ledger.ledgerIndex.toLocaleString()}
              </h3>
              <p class="text-xs text-gray-400 font-mono">
                {new Date(ledger.closeTime).toUTCString()}
              </p>
            </div>
          </div>
          <button
            onClick$={() => onClose$()}
            class="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all"
          >
            ✕
          </button>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 border-b border-gray-50">
          {[
            {
              label: "Ledger Index",
              value: ledger.ledgerIndex.toLocaleString(),
            },
            { label: "# of TXN", value: String(ledger.txnCount) },
          ].map((s) => (
            <div key={s.label} class="bg-gray-50 rounded-xl p-3">
              <div class="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                {s.label}
              </div>
              <div class="text-sm font-bold text-gray-900 tabular-nums">
                {s.value}
              </div>
            </div>
          ))}
          <div class="bg-gray-50 rounded-xl p-3">
            <div class="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
              Total Fee
            </div>
            <div class="text-sm font-bold text-gray-900 tabular-nums flex items-center gap-1">
              <XrpLogo size={10} color="#111827" />
              {ledger.totalFee.toFixed(6)}
            </div>
            <div class="text-[9px] text-gray-400 mt-0.5">
              Base {ledger.baseFee.toFixed(6)} + Txn{" "}
              {(ledger.totalFee - ledger.baseFee * ledger.txnCount).toFixed(6)}
            </div>
          </div>
          <div class="bg-gray-50 rounded-xl p-3">
            <div class="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
              Date + Time UTC
            </div>
            <div class="text-sm font-bold text-gray-900 tabular-nums">
              {new Date(ledger.closeTime).toISOString().slice(11, 19)}
            </div>
            <div class="text-[9px] text-gray-400">
              {new Date(ledger.closeTime).toISOString().slice(0, 10)}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-12 gap-2 px-6 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/30">
          <div class="col-span-3">Transaction Type</div>
          <div class="col-span-3">Account</div>
          <div class="col-span-2 text-right">Sequence</div>
          <div class="col-span-2 text-right">TXN. Cost</div>
          <div class="col-span-2 text-right">Amount</div>
        </div>

        <div class="max-h-72 overflow-y-auto">
          {ledger.transactions.length === 0 && (
            <div class="text-center py-8 text-gray-300 text-sm">
              No transactions captured for this ledger
            </div>
          )}
          {ledger.transactions.map((tx, i) => (
            <div
              key={i}
              class="grid grid-cols-12 gap-2 px-6 py-2.5 items-center border-b border-gray-50/80 hover:bg-blue-50/30 transition-colors text-xs"
            >
              <div class="col-span-3 flex items-center gap-1.5">
                <span
                  class={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${tx.type === "Payment" ? "bg-blue-500" : tx.type === "OfferCreate" ? "bg-amber-500" : tx.type === "TrustSet" ? "bg-purple-500" : "bg-gray-400"}`}
                />
                <span class="font-medium text-gray-900 truncate">
                  {tx.type}
                </span>
              </div>
              <div class="col-span-3 font-mono text-gray-500 truncate">
                {tx.from}
              </div>
              <div class="col-span-2 text-right font-mono text-gray-500 tabular-nums">
                {tx.sequence}
              </div>
              <div class="col-span-2 text-right tabular-nums text-gray-700 flex items-center justify-end gap-0.5">
                <XrpLogo size={9} color="#6b7280" />
                {tx.fee}
              </div>
              <div class="col-span-2 text-right font-semibold text-gray-900 tabular-nums truncate">
                {tx.amount}
              </div>
            </div>
          ))}
        </div>

        <div class="px-6 py-3 border-t border-gray-100 bg-gray-50/30">
          <div class="text-[10px] text-gray-400 uppercase tracking-wider mb-1 font-semibold">
            Trade Details
          </div>
          <div class="flex flex-wrap gap-3 text-[11px] text-gray-500">
            <span>Price: ${xrpPrice.toFixed(4)}</span>
            <span class="text-gray-300">|</span>
            <span>
              Buy:{" "}
              <span class="text-green-600 font-medium">
                {
                  ledger.transactions.filter((t) => t.type === "OfferCreate")
                    .length
                }{" "}
                offers
              </span>
            </span>
            <span class="text-gray-300">|</span>
            <span>
              Sell:{" "}
              <span class="text-red-500 font-medium">
                {ledger.transactions.filter((t) => t.type === "Payment").length}{" "}
                payments
              </span>
            </span>
            <span class="text-gray-300">|</span>
            <span>UNL: {quorum} validators</span>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── XRP Chart Canvas ─────────────────────────────────────────
const XrpChart = component$<{
  points: number[];
  price: number;
  change: number;
  volume: string;
  marketCap: string;
}>(({ points, price, change, volume, marketCap }) => {
  const canvasRef = useSignal<HTMLCanvasElement>();

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    track(() => points.length);
    const canvas = canvasRef.value;
    if (!canvas || points.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;

    function draw() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const W = rect.width;
      const H = rect.height;
      ctx!.clearRect(0, 0, W, H);

      const data = points;
      if (data.length < 2) return;
      const minP = Math.min(...data) - 0.05;
      const maxP = Math.max(...data) + 0.05;
      const rangeP = maxP - minP || 1;

      ctx!.strokeStyle = "rgba(0,0,0,0.04)";
      ctx!.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = (i / 4) * H;
        ctx!.beginPath();
        ctx!.moveTo(0, y);
        ctx!.lineTo(W, y);
        ctx!.stroke();
      }

      ctx!.fillStyle = "rgba(0,0,0,0.25)";
      ctx!.font = "10px monospace";
      ctx!.textAlign = "right";
      for (let i = 0; i <= 4; i++) {
        const val = maxP - (i / 4) * rangeP;
        const y = (i / 4) * H;
        ctx!.fillText(`$${val.toFixed(4)}`, W - 4, y + 12);
      }

      const grd = ctx!.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, "rgba(37,99,235,0.15)");
      grd.addColorStop(1, "rgba(37,99,235,0.01)");

      ctx!.beginPath();
      ctx!.moveTo(0, H);
      for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * (W - 50);
        const y = H - ((data[i] - minP) / rangeP) * (H - 20) - 10;
        ctx!.lineTo(x, y);
      }
      const lastX = ((data.length - 1) / (data.length - 1)) * (W - 50);
      ctx!.lineTo(lastX, H);
      ctx!.closePath();
      ctx!.fillStyle = grd;
      ctx!.fill();

      ctx!.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * (W - 50);
        const y = H - ((data[i] - minP) / rangeP) * (H - 20) - 10;
        if (i === 0) ctx!.moveTo(x, y);
        else ctx!.lineTo(x, y);
      }
      ctx!.strokeStyle = "#2563eb";
      ctx!.lineWidth = 2;
      ctx!.lineJoin = "round";
      ctx!.stroke();

      const ex = W - 50;
      const ey = H - ((data[data.length - 1] - minP) / rangeP) * (H - 20) - 10;
      const pulse = 1 + 0.3 * Math.sin(Date.now() / 500);
      ctx!.beginPath();
      ctx!.arc(ex, ey, 8 * pulse, 0, Math.PI * 2);
      ctx!.fillStyle = "rgba(37,99,235,0.15)";
      ctx!.fill();
      ctx!.beginPath();
      ctx!.arc(ex, ey, 4, 0, Math.PI * 2);
      ctx!.fillStyle = "#2563eb";
      ctx!.fill();

      ctx!.fillStyle = "#2563eb";
      ctx!.font = "bold 11px monospace";
      ctx!.textAlign = "left";
      ctx!.fillText(`$${data[data.length - 1].toFixed(4)}`, ex + 12, ey + 4);

      ctx!.fillStyle = "rgba(0,0,0,0.2)";
      ctx!.font = "9px monospace";
      ctx!.textAlign = "center";
      ["24h ago", "18h", "12h", "6h", "Now"].forEach((lbl, i, arr) => {
        ctx!.fillText(lbl, (i / (arr.length - 1)) * (W - 50), H - 2);
      });

      raf = requestAnimationFrame(draw);
    }

    draw();
    cleanup(() => cancelAnimationFrame(raf));
  });

  return (
    <div class="reveal-up group relative bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden p-6 min-h-120">
      <div class="flex items-center justify-between mb-6">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <div class="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center">
              <svg viewBox="0 0 100 100" class="w-3.5 h-3.5" fill="none">
                <path
                  d="M25 22L50 40M75 22L50 40M25 78L50 60M75 78L50 60"
                  stroke="white"
                  stroke-width="8"
                  stroke-linecap="round"
                />
              </svg>
            </div>
            <span class="font-bold text-gray-900">XRP / USD</span>
            <span class="text-xs text-gray-400 font-light">DEX</span>
            <span class="inline-flex items-center gap-1.5 ml-2 px-2.5 py-0.5 rounded-full bg-green-50 border border-green-200/60">
              <span class="relative flex h-1.5 w-1.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              <span class="text-[10px] font-semibold text-green-700 uppercase tracking-wider">
                Live
              </span>
            </span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-5xl sm:text-7xl lg:text-9xl font-bold text-gray-900 tabular-nums">
              ${price.toFixed(4)}
            </span>
            <span
              class={`text-sm font-semibold ${change >= 0 ? "text-green-500" : "text-red-500"}`}
            >
              {change >= 0 ? "+" : ""}
              {change.toFixed(4)}%
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-gray-400 tabular-nums font-mono hidden sm:inline">
            {points.length} data points
          </span>
          <button class="px-3 py-1 rounded-lg text-xs font-medium bg-gray-900 text-white">
            1D
          </button>
        </div>
      </div>
      <div class="h-90">
        <canvas ref={canvasRef} class="w-full h-full" />
      </div>
      <div class="flex items-center justify-between mt-4 text-xs text-gray-400">
        <div class="flex items-center gap-4">
          <span>Vol: {volume}</span>
          <span>MCap: {marketCap}</span>
        </div>
        <span class="text-[10px] font-mono text-gray-300">
          Updates every 30s · Source: CoinGecko
        </span>
      </div>
    </div>
  );
});

// ─── Main Component ───────────────────────────────────────────
export default component$(() => {
  // ── Price State ──
  const xrpPrice = useSignal(1.39);
  const xrpChange = useSignal(1.27);
  const xrpMarketCap = useSignal("$138.2B");
  const xrpVolume = useSignal("$4.8B");
  const xahauPrice = useSignal(0.0087);
  const xahauChange = useSignal(3.12);

  // ── Token Lists ──
  const xrplTokens = useStore<{ list: TokenData[] }>({
    list: [
      {
        symbol: "SOLO",
        name: "Sologenic",
        price: 0.318,
        change24h: 5.82,
        marketCap: "$127.2M",
        volume: "$8.4M",
        sparkline: generateSparkline(0.318, 1),
        currency: "534F4C4F00000000000000000000000000000000",
        issuer: "rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz",
        network: "xrpl",
      },
      {
        symbol: "CORE",
        name: "Coreum",
        price: 0.089,
        change24h: -2.14,
        marketCap: "$89.1M",
        volume: "$3.2M",
        sparkline: generateSparkline(0.089, -1),
        currency: "434F524500000000000000000000000000000000",
        issuer: "rcoreNywaoz2ZCQ8Lg2EbSLnGuRBmun6D",
        network: "xrpl",
      },
      {
        symbol: "CSC",
        name: "CasinoCoin",
        price: 0.0047,
        change24h: 12.33,
        marketCap: "$42.5M",
        volume: "$1.8M",
        sparkline: generateSparkline(0.0047, 1),
        currency: "4353430000000000000000000000000000000000",
        issuer: "rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr",
        network: "xrpl",
      },
      {
        symbol: "ELS",
        name: "Elysian",
        price: 0.0213,
        change24h: -0.87,
        marketCap: "$21.3M",
        volume: "$890K",
        sparkline: generateSparkline(0.0213, 0),
        currency: "454C530000000000000000000000000000000000",
        issuer: "rHXuEaRYnnJHbDeuBH5w8yPh5uwNVh5zAg",
        network: "xrpl",
      },
      {
        symbol: "XPM",
        name: "XPMarket",
        price: 0.0089,
        change24h: 7.41,
        marketCap: "$18.7M",
        volume: "$620K",
        sparkline: generateSparkline(0.0089, 1),
        currency: "58504D0000000000000000000000000000000000",
        issuer: "rXPMxBeefHGxx3qjLAFx2tPHhBGnNsFNrt",
        network: "xrpl",
      },
    ],
  });

  const xahauTokens = useStore<{ list: TokenData[] }>({
    list: [
      {
        symbol: "EVR",
        name: "Evernode",
        price: 0.1442,
        change24h: -3.82,
        marketCap: "$10.4M",
        volume: "$789",
        sparkline: generateSparkline(0.1442, -1),
        currency: "4556520000000000000000000000000000000000",
        issuer: "rEvernodee8dJLaFsujS6q1EiXvZYmHXr8",
        network: "xahau",
      },
      {
        symbol: "MAG",
        name: "Magnetic",
        price: 56.51,
        change24h: 1.24,
        marketCap: "$232.0K",
        volume: "$1.2K",
        sparkline: generateSparkline(56.51, 1),
        currency: "4D41470000000000000000000000000000000000",
        issuer: "rMagnETjciGSPmro3Mfa84sPHRHHE5UTpz",
        network: "xahau",
      },
      {
        symbol: "XRP",
        name: "GateHub Wrapped",
        price: 2.39,
        change24h: 4.27,
        marketCap: "$296.3K",
        volume: "$420",
        sparkline: generateSparkline(2.39, 1),
        currency: "5852500000000000000000000000000000000000",
        issuer: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
        network: "xahau",
      },
      {
        symbol: "USD",
        name: "GateHub USD",
        price: 0.8293,
        change24h: 0.02,
        marketCap: "$393.2K",
        volume: "$210",
        sparkline: generateSparkline(0.8293, 0),
        currency: "5553440000000000000000000000000000000000",
        issuer: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
        network: "xahau",
      },
      {
        symbol: "EUR",
        name: "GateHub EUR",
        price: 1.1857,
        change24h: -0.14,
        marketCap: "$459.5K",
        volume: "$180",
        sparkline: generateSparkline(1.1857, 0),
        currency: "4555520000000000000000000000000000000000",
        issuer: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
        network: "xahau",
      },
    ],
  });

  // ── Ledger Stats ──
  const ledgerStats = useStore<LedgerStats>({
    ledgerIndex: 91847523,
    txCount: 1892437,
    closeTime: "3.7s",
    baseFee: "0.00001",
    validatedCount: 0,
    tps: 24,
    quorum: 28,
    loadFee: 0.00001,
    avgTxnFee: 0.000012,
    avgLedgerInterval: 3.72,
    avgTxnPerLedger: 42.5,
  });

  const liveTxs = useStore<{ list: LiveTx[] }>({ list: [] });
  const ledgerCards = useStore<{ list: LedgerCard[] }>({ list: [] });
  const chartData = useStore<{ points: number[] }>({ points: [] });
  const wsConnected = useSignal(false);
  const isPaused = useSignal(false);
  const showLedgerModal = useSignal(false);
  const selectedLedger = useSignal<LedgerCard | null>(null);
  const globeArcs = useStore<{ list: GlobeArc[] }>({ list: [] });
  const globeArcId = useSignal(0);
  const globeTxCount = useSignal(0);

  // Internal tracking stores (not reactive UI, just logic)
  const ledgerIntervals = useStore<{ list: number[] }>({ list: [] });
  const txnFeeSamples = useStore<{ list: number[] }>({ list: [] });
  const lastLedgerCloseTime = useSignal(0);

  const openLedgerModal = $((ledger: LedgerCard) => {
    isPaused.value = true;
    selectedLedger.value = ledger;
    showLedgerModal.value = true;
  });

  const closeLedgerModal = $(() => {
    showLedgerModal.value = false;
    selectedLedger.value = null;
    isPaused.value = false;
  });

  // ── Fetch live XRP price + chart data ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ cleanup }) => {
    const controller = new AbortController();
    async function fetchPrice() {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=ripple,xahau&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true",
          { signal: controller.signal },
        );
        if (res.ok) {
          const data = (await res.json()) as Record<
            string,
            Record<string, number>
          >;
          if (data.ripple) {
            xrpPrice.value = data.ripple.usd ?? xrpPrice.value;
            xrpChange.value = data.ripple.usd_24h_change ?? xrpChange.value;
            if (data.ripple.usd_market_cap)
              xrpMarketCap.value = fmtNum(data.ripple.usd_market_cap, 1);
            if (data.ripple.usd_24h_vol)
              xrpVolume.value = fmtNum(data.ripple.usd_24h_vol, 1);
          }
          if (data.xahau) {
            xahauPrice.value = data.xahau.usd ?? xahauPrice.value;
            xahauChange.value = data.xahau.usd_24h_change ?? xahauChange.value;
          }
        }
      } catch {
        /* use fallback */
      }
    }

    await fetchPrice();

    try {
      const chartRes = await fetch(
        "https://api.coingecko.com/api/v3/coins/ripple/market_chart?vs_currency=usd&days=1",
        { signal: controller.signal },
      );
      if (chartRes.ok) {
        const chartJson = (await chartRes.json()) as {
          prices: [number, number][];
        };
        if (chartJson.prices?.length > 0) {
          chartData.points = chartJson.prices.map((p) => p[1]);
        }
      }
    } catch {
      const fallback: number[] = [];
      let p = xrpPrice.value;
      for (let i = 0; i < 96; i++) {
        p += (Math.random() - 0.47) * 0.04;
        fallback.push(Math.max(p * 0.9, Math.min(p * 1.1, p)));
      }
      chartData.points = fallback;
    }

    const priceInterval = setInterval(async () => {
      try {
        const r = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=ripple,xahau&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true",
          { signal: controller.signal },
        );
        if (r.ok) {
          const d = (await r.json()) as Record<string, Record<string, number>>;
          if (d.ripple) {
            xrpPrice.value = d.ripple.usd ?? xrpPrice.value;
            xrpChange.value = d.ripple.usd_24h_change ?? xrpChange.value;
            if (d.ripple.usd_market_cap)
              xrpMarketCap.value = fmtNum(d.ripple.usd_market_cap, 1);
            if (d.ripple.usd_24h_vol)
              xrpVolume.value = fmtNum(d.ripple.usd_24h_vol, 1);
            if (chartData.points.length > 0) {
              chartData.points = [
                ...chartData.points.slice(-287),
                d.ripple.usd,
              ];
            }
          }
          if (d.xahau) {
            xahauPrice.value = d.xahau.usd ?? xahauPrice.value;
            xahauChange.value = d.xahau.usd_24h_change ?? xahauChange.value;
          }
        }
      } catch {
        /* skip */
      }
    }, 30000);

    cleanup(() => {
      controller.abort();
      clearInterval(priceInterval);
    });
  });

  // ── XRPL WebSocket ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let currentLedgerTxs: LiveTx[] = [];
    let currentLedgerFeeSum = 0;

    function connect() {
      ws = new WebSocket("wss://xrplcluster.com");
      ws.onopen = () => {
        wsConnected.value = true;
        ws?.send(
          JSON.stringify({
            id: 1,
            command: "subscribe",
            streams: ["ledger", "transactions"],
          }),
        );
        ws?.send(JSON.stringify({ id: 2, command: "server_info" }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.id === 2 && msg.result?.info) {
            const info = msg.result.info;
            if (info.validation_quorum)
              ledgerStats.quorum = info.validation_quorum;
            if (info.load_factor)
              ledgerStats.loadFee = (10 * info.load_factor) / 1_000_000;
          }

          if (msg.type === "ledgerClosed") {
            const now = Date.now();
            if (lastLedgerCloseTime.value > 0) {
              const interval = (now - lastLedgerCloseTime.value) / 1000;
              ledgerIntervals.list.push(interval);
              if (ledgerIntervals.list.length > 20)
                ledgerIntervals.list.shift();
              ledgerStats.avgLedgerInterval =
                ledgerIntervals.list.reduce((a, b) => a + b, 0) /
                ledgerIntervals.list.length;
            }
            lastLedgerCloseTime.value = now;
            ledgerStats.ledgerIndex = msg.ledger_index;
            ledgerStats.txCount = msg.txn_count || ledgerStats.txCount;
            ledgerStats.validatedCount += 1;

            const txnCount = msg.txn_count || currentLedgerTxs.length;
            const card: LedgerCard = {
              ledgerIndex: msg.ledger_index,
              closeTime: new Date().toISOString(),
              closeTimeMs: now,
              txnCount,
              totalFee: currentLedgerFeeSum,
              baseFee: 0.00001,
              transactions: [...currentLedgerTxs],
            };
            ledgerCards.list.unshift(card);
            if (ledgerCards.list.length > 30) ledgerCards.list.pop();

            if (txnCount > 0) {
              ledgerStats.avgTxnPerLedger =
                ledgerCards.list
                  .map((c) => c.txnCount)
                  .reduce((a, b) => a + b, 0) / ledgerCards.list.length;
            }
            currentLedgerTxs = [];
            currentLedgerFeeSum = 0;
            if (ledgerStats.avgLedgerInterval > 0) {
              ledgerStats.tps = parseFloat(
                (
                  ledgerStats.avgTxnPerLedger / ledgerStats.avgLedgerInterval
                ).toFixed(2),
              );
            }
          }

          if (msg.type === "transaction" && msg.validated && msg.transaction) {
            const tx = msg.transaction;
            const feeXrp = tx.Fee ? parseInt(tx.Fee) / 1_000_000 : 0.000012;
            txnFeeSamples.list.push(feeXrp);
            if (txnFeeSamples.list.length > 100) txnFeeSamples.list.shift();
            ledgerStats.avgTxnFee =
              txnFeeSamples.list.reduce((a, b) => a + b, 0) /
              txnFeeSamples.list.length;
            currentLedgerFeeSum += feeXrp;

            const amount = tx.Amount
              ? typeof tx.Amount === "string"
                ? `${(parseInt(tx.Amount) / 1_000_000).toFixed(2)} XRP`
                : `${tx.Amount.value} ${tx.Amount.currency}`
              : "—";

            const liveTx: LiveTx = {
              hash: (tx.hash?.slice(0, 12) || "N/A") + "…",
              fullHash: tx.hash || "",
              type: tx.TransactionType || "Unknown",
              amount,
              from: (tx.Account?.slice(0, 10) || "—") + "…",
              fullFrom: tx.Account || "",
              to: (tx.Destination?.slice(0, 10) || "—") + "…",
              fullTo: tx.Destination || "",
              timestamp: Date.now(),
              fee: feeXrp.toFixed(6),
              sequence: tx.Sequence || 0,
              currency: tx.Amount
                ? typeof tx.Amount === "string"
                  ? "XRP"
                  : tx.Amount.currency || "?"
                : "—",
              destinationTag: tx.DestinationTag,
            };

            liveTxs.list.unshift(liveTx);
            if (liveTxs.list.length > 25) liveTxs.list.pop();
            currentLedgerTxs.push(liveTx);
            if (currentLedgerTxs.length > 200) currentLedgerTxs.shift();

            globeTxCount.value += 1;
            const arcId = globeArcId.value++;
            globeArcs.list.push({
              id: arcId,
              startAngle: Math.random() * 360,
              endAngle: Math.random() * 360,
              color:
                tx.TransactionType === "Payment"
                  ? "#3b82f6"
                  : tx.TransactionType === "OfferCreate"
                    ? "#f59e0b"
                    : tx.TransactionType === "TrustSet"
                      ? "#8b5cf6"
                      : "#10b981",
              type: tx.TransactionType || "Unknown",
            });
            if (globeArcs.list.length > 40) globeArcs.list.shift();
          }
        } catch {
          /* parse error */
        }
      };

      ws.onclose = () => {
        wsConnected.value = false;
        reconnectTimer = setTimeout(connect, 5000);
      };
      ws.onerror = () => ws?.close();
    }

    connect();

    const serverInfoInterval = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ id: 2, command: "server_info" }));
      }
    }, 30000);

    cleanup(() => {
      clearTimeout(reconnectTimer);
      clearInterval(serverInfoInterval);
      ws?.close();
    });
  });

  const allTokens = [...xrplTokens.list, ...xahauTokens.list];

  return (
    <div
      class="landing-page"
      style={{
        width: "100vw",
        position: "relative",
        left: "50%",
        marginLeft: "-50vw",
        marginTop: "-2rem",
        marginBottom: "-2rem",
      }}
    >
      <style
        dangerouslySetInnerHTML={`
        @keyframes float { 0%,100%{transform:translateY(0) rotate(0)} 33%{transform:translateY(-12px) rotate(1deg)} 66%{transform:translateY(6px) rotate(-1deg)} }
        @keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes ledger-scroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes globe-spin { 0%{transform:rotateY(0)} 100%{transform:rotateY(360deg)} }
        @keyframes arc-travel { 0%{stroke-dashoffset:200;opacity:0} 20%{opacity:1} 80%{opacity:1} 100%{stroke-dashoffset:0;opacity:0} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes revealUp { from{transform:translateY(40px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes staggerIn { from{transform:translateY(30px) translateX(-10px);opacity:0} to{transform:translateY(0) translateX(0);opacity:1} }
        @keyframes gridPulse { 0%,100%{opacity:.03} 50%{opacity:.06} }

        .animate-fadeIn { animation: fadeIn 0.3s ease forwards; }
        .animate-slideUp { animation: slideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards; }
        .animate-marquee { animation: marquee 45s linear infinite; }
        .animate-marquee:hover { animation-play-state: paused; }
        .animate-ledger-scroll { animation: ledger-scroll 60s linear infinite; }
        .animate-ledger-scroll.paused { animation-play-state: paused; }
        .animate-globe-spin { animation: globe-spin 30s linear infinite; }
        .animate-float-1 { animation: float 8s ease-in-out infinite; }
        .animate-float-2 { animation: float 10s ease-in-out infinite 2s; }
        .animate-float-3 { animation: float 7s ease-in-out infinite 1s; }
        .grid-bg {
          background-image: linear-gradient(rgba(0,0,0,0.03) 1px,transparent 1px), linear-gradient(90deg,rgba(0,0,0,0.03) 1px,transparent 1px);
          background-size: 60px 60px;
          animation: gridPulse 6s ease-in-out infinite;
        }
        .reveal-section {
          animation: revealUp 0.7s cubic-bezier(0.16,1,0.3,1) both;
          animation-timeline: view();
          animation-range: entry 0% entry 30%;
        }
        .stagger-card {
          animation: staggerIn 0.6s cubic-bezier(0.16,1,0.3,1) both;
          animation-timeline: view();
          animation-range: entry 0% entry 30%;
        }
        .stagger-card:nth-child(1) { animation-delay: 0ms; }
        .stagger-card:nth-child(2) { animation-delay: 80ms; }
        .stagger-card:nth-child(3) { animation-delay: 160ms; }
        .stagger-card:nth-child(4) { animation-delay: 240ms; }
        .stagger-card:nth-child(5) { animation-delay: 320ms; }
        .stagger-card:nth-child(6) { animation-delay: 400ms; }
        .hero-title { animation: slideUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.1s both; }
        .hero-sub { animation: slideUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.3s both; }
        .hero-price { animation: slideUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.5s both; }
        .hero-badge { animation: slideUp 0.7s cubic-bezier(0.16,1,0.3,1) 0s both; }
        .globe-atmosphere {
          position:absolute;inset:-12px;border-radius:50%;
          background:radial-gradient(circle at 35% 35%,transparent 60%,rgba(59,130,246,0.08) 80%,rgba(59,130,246,0.15) 100%);
          pointer-events:none;
        }
        .globe-highlight {
          position:absolute;width:45%;height:45%;top:8%;left:15%;border-radius:50%;
          background:radial-gradient(ellipse,rgba(255,255,255,0.08) 0%,transparent 70%);
          pointer-events:none;
        }
        .token-row { transition: all 0.2s ease; }
        .token-row:hover { background: rgba(37,99,235,0.04); transform: translateX(3px); }
        .tilt-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .tilt-card:hover { transform: translateY(-2px); }
        @supports not (animation-timeline: view()) {
          .reveal-section, .stagger-card { animation: revealUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s both; }
        }
      `}
      />

      {/* ═══ MODAL ═══ */}
      {showLedgerModal.value && selectedLedger.value && (
        <LedgerModal
          ledger={selectedLedger.value}
          xrpPrice={xrpPrice.value}
          quorum={ledgerStats.quorum}
          onClose$={closeLedgerModal}
        />
      )}

      {/* ═══ HERO ═══ */}
      <section class="relative min-h-screen flex items-center justify-center overflow-hidden bg-white">
        <div class="absolute inset-0 grid-bg" />
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          <div class="animate-float-1 absolute -top-40 -left-40 w-125 h-125 bg-blue-500/4 rounded-full blur-[100px]" />
          <div class="animate-float-2 absolute -bottom-40 -right-40 w-150 h-150 bg-amber-400/4 rounded-full blur-[120px]" />
          <div class="animate-float-3 absolute top-1/4 right-1/3 w-75 h-75 bg-blue-400/3 rounded-full blur-[80px]" />
        </div>

        <div class="relative z-10 w-full max-w-6xl mx-auto px-6 lg:px-8 text-center pt-24 pb-16">
          <h1 class="hero-title mb-6">
            <span class="block font-extralight text-6xl sm:text-7xl lg:text-[8rem] bg-linear-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent leading-[0.9] tracking-tighter">
              {"{XRPL}"}OS
            </span>
            <span class="block text-2xl sm:text-3xl lg:text-4xl font-light text-gray-500 mt-4 tracking-wide">
              The Pulse of the{" "}
              <span class="font-semibold bg-linear-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                XRP Ecosystem
              </span>
            </span>
          </h1>

          <p class="hero-sub text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-12 font-light leading-relaxed">
            Your one-stop interface for live stats, trading, and direct ledger
            interaction across XRP Ledger and Xahau — all wallets, one platform.
          </p>

          <div class="hero-price inline-flex flex-col sm:flex-row items-center gap-6 sm:gap-10 bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-2xl px-8 py-6 shadow-lg shadow-gray-200/50">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center shadow-lg">
                <svg viewBox="0 0 100 100" class="w-7 h-7" fill="none">
                  <path
                    d="M25 22L50 40M75 22L50 40M25 78L50 60M75 78L50 60"
                    stroke="white"
                    stroke-width="6"
                    stroke-linecap="round"
                  />
                </svg>
              </div>
              <div class="text-left">
                <div class="text-xs text-gray-400 font-medium uppercase tracking-wider">
                  XRP / USD
                </div>
                <div class="flex items-baseline gap-2">
                  <span class="text-3xl font-bold text-gray-900 tabular-nums">
                    ${xrpPrice.value.toFixed(4)}
                  </span>
                  <span
                    class={`text-sm font-semibold ${xrpChange.value >= 0 ? "text-green-500" : "text-red-500"}`}
                  >
                    {xrpChange.value >= 0 ? "+" : ""}
                    {xrpChange.value.toFixed(4)}%
                  </span>
                </div>
              </div>
            </div>
            <div class="hidden sm:block w-px h-12 bg-gray-200" />
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-full bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                <span class="text-white font-bold text-lg">X</span>
              </div>
              <div class="text-left">
                <div class="text-xs text-gray-400 font-medium uppercase tracking-wider">
                  XAH / USD
                </div>
                <div class="flex items-baseline gap-2">
                  <span class="text-3xl font-bold text-gray-900 tabular-nums">
                    ${xahauPrice.value.toFixed(4)}
                  </span>
                  <span
                    class={`text-sm font-semibold ${xahauChange.value >= 0 ? "text-green-500" : "text-red-500"}`}
                  >
                    {xahauChange.value >= 0 ? "+" : ""}
                    {xahauChange.value.toFixed(4)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <span class="text-xs text-gray-500 font-medium tracking-widest uppercase">
            Scroll
          </span>
          <div class="w-5 h-8 rounded-full border-2 border-gray-400 flex items-start justify-center p-1">
            <div class="w-1 h-2 bg-gray-400 rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* ═══ TICKER BAR ═══ */}
      <section class="relative bg-gray-50/80 border-y border-gray-100 py-4 overflow-hidden">
        <div class="flex overflow-hidden">
          <div class="animate-marquee flex gap-8 shrink-0">
            {[...allTokens, ...allTokens].map((t, i) => (
              <div key={i} class="flex items-center gap-3 px-4 shrink-0">
                <span class="font-bold text-gray-900 text-sm">{t.symbol}</span>
                <span class="text-gray-500 text-sm tabular-nums">
                  ${t.price < 0.01 ? t.price.toFixed(5) : t.price.toFixed(3)}
                </span>
                <span
                  class={`text-xs font-semibold ${t.change24h >= 0 ? "text-green-500" : "text-red-500"}`}
                >
                  {t.change24h >= 0 ? "▲" : "▼"}{" "}
                  {Math.abs(t.change24h).toFixed(1)}%
                </span>
                <div class="w-16">
                  <Sparkline
                    data={t.sparkline}
                    color={t.change24h >= 0 ? "#22c55e" : "#ef4444"}
                    width={64}
                    height={20}
                  />
                </div>
                <span class="text-gray-200 ml-2">|</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ LIVE NETWORK INTELLIGENCE ═══ */}
      <section class="py-20 px-6 lg:px-8 bg-white">
        <div class="max-w-7xl mx-auto">
          <div class="text-center mb-10 reveal-section">
            <h2 class="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
              Live Network{" "}
              <span class="bg-linear-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                Intelligence
              </span>
            </h2>
            <p class="text-lg text-gray-500 max-w-xl mx-auto font-light">
              Real-time metrics from the XRP Ledger mainnet
            </p>
          </div>

          {/* Bloomberg Stats Bar */}
          <div class="reveal-section bg-white rounded-2xl px-5 py-3.5 mb-6 shadow-xl">
            <div class="flex items-center justify-between gap-3 overflow-x-auto">
              {[
                {
                  label: "Quorum",
                  value: String(ledgerStats.quorum),
                  color: "text-green-400",
                },
                null,
                {
                  label: "Avg. Txn. Fee",
                  value: `${ledgerStats.avgTxnFee.toFixed(7)}`,
                  color: "text-indigo-400",
                  prefix: true,
                },
                null,
                {
                  label: "Avg. Ledger Interval",
                  value: `${ledgerStats.avgLedgerInterval.toFixed(3)}sec`,
                  color: "text-blue-400",
                },
                null,
                {
                  label: "Avg. Txn/Ledger",
                  value: `${ledgerStats.avgTxnPerLedger.toFixed(2)}`,
                  color: "text-amber-400",
                },
                null,
                {
                  label: "Txn/Sec",
                  value: `${ledgerStats.tps.toFixed(2)}`,
                  color: "text-purple-400",
                },
                null,
                {
                  label: "Load Fee",
                  value: `${ledgerStats.loadFee.toFixed(5)}`,
                  color: "text-red-400",
                  prefix: true,
                },
              ].map((item, i) =>
                item === null ? (
                  <div key={i} class="w-px h-6 bg-white/15 shrink-0" />
                ) : (
                  <div key={i} class="flex items-center gap-1.5 shrink-0">
                    <span class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                      {item.label}
                    </span>
                    {(item as any).prefix && (
                      <XrpLogo size={12} color="#9ca3af" />
                    )}
                    <span
                      class={`text-sm font-bold tabular-nums ${item.color}`}
                    >
                      {item.value}
                    </span>
                  </div>
                ),
              )}
              <div class="flex items-center gap-1.5 shrink-0 ml-auto pl-3">
                <span class="relative flex h-2 w-2">
                  <span
                    class={`animate-ping absolute inline-flex h-full w-full rounded-full ${wsConnected.value ? "bg-green-400" : "bg-yellow-400"} opacity-75`}
                  />
                  <span
                    class={`relative inline-flex rounded-full h-2 w-2 ${wsConnected.value ? "bg-green-500" : "bg-yellow-500"}`}
                  />
                </span>
                <span class="text-[10px] text-gray-500 font-medium">LIVE</span>
              </div>
            </div>
          </div>

          {/* Ledger Card Feed */}
          <div class="reveal-section bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div class="border-b border-gray-100 px-5 py-3 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="relative flex h-2 w-2">
                  <span
                    class={`animate-ping absolute inline-flex h-full w-full rounded-full ${wsConnected.value ? "bg-green-400" : "bg-yellow-400"} opacity-75`}
                  />
                  <span
                    class={`relative inline-flex rounded-full h-2 w-2 ${wsConnected.value ? "bg-green-500" : "bg-yellow-500"}`}
                  />
                </span>
                <span class="text-sm font-semibold text-gray-700">
                  Live Ledger Feed
                </span>
                {isPaused.value && (
                  <span class="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                    PAUSED
                  </span>
                )}
              </div>
              <div class="flex items-center gap-3">
                <button
                  onClick$={() => {
                    isPaused.value = !isPaused.value;
                  }}
                  class="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
                >
                  {isPaused.value ? "▶ Resume" : "⏸ Pause"}
                </button>
                <span class="text-xs text-gray-400 tabular-nums font-mono">
                  {ledgerCards.list.length} ledgers
                </span>
              </div>
            </div>
            <div class="overflow-x-auto py-4 px-4">
              <div
                class={`flex gap-3 min-w-max ${!isPaused.value && ledgerCards.list.length > 6 ? "animate-ledger-scroll" : ""}`}
              >
                {ledgerCards.list.length === 0 && (
                  <div class="flex items-center py-6 text-gray-300 w-96">
                    <div class="w-6 h-6 border-2 border-gray-200 border-t-blue-400 rounded-full animate-spin mr-3" />
                    <span class="text-sm">Waiting for ledgers...</span>
                  </div>
                )}
                {ledgerCards.list.map((ledger, i) => (
                  <button
                    key={`${ledger.ledgerIndex}-${i}`}
                    onClick$={() => openLedgerModal(ledger)}
                    class="shrink-0 group bg-white hover:bg-blue-50/50 border border-gray-100 hover:border-blue-200 rounded-xl px-4 py-3 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md text-left min-w-45"
                  >
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-xs font-bold text-gray-900 tabular-nums group-hover:text-blue-600 transition-colors">
                        #{ledger.ledgerIndex.toLocaleString()}
                      </span>
                      <span class="text-[10px] text-gray-400 tabular-nums font-mono">
                        {new Date(ledger.closeTime).toISOString().slice(11, 19)}{" "}
                        UTC
                      </span>
                    </div>
                    <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                      <div>
                        <div class="text-[9px] text-gray-400 uppercase tracking-wider">
                          Txn Count
                        </div>
                        <div class="text-xs font-semibold text-gray-700 tabular-nums">
                          {ledger.txnCount}
                        </div>
                      </div>
                      <div>
                        <div class="text-[9px] text-gray-400 uppercase tracking-wider">
                          Total Fee
                        </div>
                        <div class="text-xs font-semibold text-gray-700 tabular-nums flex items-center gap-0.5">
                          <XrpLogo size={8} color="#374151" />
                          {ledger.totalFee.toFixed(5)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ DEX CHART ═══ */}
      <section class="py-20 px-6 lg:px-8 bg-linear-to-b from-white to-gray-50/50">
        <div class="max-w-7xl mx-auto reveal-section">
          <XrpChart
            points={chartData.points}
            price={xrpPrice.value}
            change={xrpChange.value}
            volume={xrpVolume.value}
            marketCap={xrpMarketCap.value}
          />
        </div>
      </section>

      {/* ═══ TOP DEX TOKENS ═══ */}
      <section class="py-20 px-6 lg:px-8 bg-white">
        <div class="max-w-7xl mx-auto">
          <div class="flex items-end justify-between mb-10 reveal-section">
            <div>
              <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                Top DEX Tokens
              </h2>
              <p class="text-gray-500 mt-2 font-light">
                Highest market cap tokens across both networks
              </p>
            </div>
            <a
              href="/search"
              class="hidden sm:flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              View all →
            </a>
          </div>

          <div class="grid md:grid-cols-2 gap-6">
            {/* XRPL */}
            <div
              class="stagger-card bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col"
              style={{ aspectRatio: "1/1" }}
            >
              <div class="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <div class="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center shadow">
                  <svg viewBox="0 0 100 100" class="w-4 h-4" fill="none">
                    <path
                      d="M25 22L50 40M75 22L50 40M25 78L50 60M75 78L50 60"
                      stroke="white"
                      stroke-width="7"
                      stroke-linecap="round"
                    />
                  </svg>
                </div>
                <div>
                  <h3 class="font-bold text-gray-900 text-sm">XRP Ledger</h3>
                  <p class="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                    Top 5 Tokens
                  </p>
                </div>
              </div>
              <div class="flex-1 flex flex-col divide-y divide-gray-50">
                {xrplTokens.list.slice(0, 5).map((token, idx) => (
                  <div
                    key={idx}
                    class="token-row flex items-center gap-3 px-6 py-3.5 hover:bg-blue-50/30 transition-colors cursor-pointer flex-1"
                  >
                    <span class="text-xs text-gray-400 font-medium tabular-nums w-5 shrink-0">
                      {idx + 1}
                    </span>
                    <div class="w-8 h-8 rounded-full bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                      <img
                        src={`https://cdn.bithomp.com/issued-token/${token.issuer}/${token.currency}`}
                        alt={token.symbol}
                        width={32}
                        height={32}
                        class="w-full h-full object-cover"
                        onError$={(e: Event) => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = "none";
                          if (img.parentElement)
                            img.parentElement.innerHTML = `<span class="text-xs font-bold text-gray-500">${token.symbol.slice(0, 2)}</span>`;
                        }}
                      />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold text-gray-900 text-sm">
                        {token.symbol}
                      </div>
                      <div class="text-[11px] text-gray-400 truncate">
                        {token.name}
                      </div>
                    </div>
                    <div class="text-right shrink-0">
                      <div class="font-medium text-gray-900 text-sm tabular-nums">
                        $
                        {token.price < 0.01
                          ? token.price.toFixed(5)
                          : token.price.toFixed(4)}
                      </div>
                      <div
                        class={`text-[11px] font-semibold tabular-nums ${token.change24h >= 0 ? "text-green-500" : "text-red-500"}`}
                      >
                        {token.change24h >= 0 ? "+" : ""}
                        {token.change24h.toFixed(2)}%
                      </div>
                    </div>
                    <div class="hidden sm:block shrink-0">
                      <Sparkline
                        data={token.sparkline}
                        color={token.change24h >= 0 ? "#22c55e" : "#ef4444"}
                        width={64}
                        height={28}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Xahau */}
            <div
              class="stagger-card bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col"
              style={{ aspectRatio: "1/1" }}
            >
              <div class="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <div class="w-8 h-8 rounded-xl bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow">
                  <span class="text-white font-bold text-sm">X</span>
                </div>
                <div>
                  <h3 class="font-bold text-gray-900 text-sm">Xahau</h3>
                  <p class="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                    Top 5 Tokens
                  </p>
                </div>
              </div>
              <div class="flex-1 flex flex-col divide-y divide-gray-50">
                {xahauTokens.list.slice(0, 5).map((token, idx) => (
                  <div
                    key={idx}
                    class="token-row flex items-center gap-3 px-6 py-3.5 hover:bg-amber-50/30 transition-colors cursor-pointer flex-1"
                  >
                    <span class="text-xs text-gray-400 font-medium tabular-nums w-5 shrink-0">
                      {idx + 1}
                    </span>
                    <div class="w-8 h-8 rounded-full bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                      <img
                        src={`https://cdn.bithomp.com/issued-token/${token.issuer}/${token.currency}`}
                        alt={token.symbol}
                        width={32}
                        height={32}
                        class="w-full h-full object-cover"
                        onError$={(e: Event) => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = "none";
                          if (img.parentElement)
                            img.parentElement.innerHTML = `<span class="text-xs font-bold text-gray-500">${token.symbol.slice(0, 2)}</span>`;
                        }}
                      />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold text-gray-900 text-sm">
                        {token.symbol}
                      </div>
                      <div class="text-[11px] text-gray-400 truncate">
                        {token.name}
                      </div>
                    </div>
                    <div class="text-right shrink-0">
                      <div class="font-medium text-gray-900 text-sm tabular-nums">
                        $
                        {token.price < 0.01
                          ? token.price.toFixed(5)
                          : token.price.toFixed(4)}
                      </div>
                      <div
                        class={`text-[11px] font-semibold tabular-nums ${token.change24h >= 0 ? "text-green-500" : "text-red-500"}`}
                      >
                        {token.change24h >= 0 ? "+" : ""}
                        {token.change24h.toFixed(2)}%
                      </div>
                    </div>
                    <div class="hidden sm:block shrink-0">
                      <Sparkline
                        data={token.sparkline}
                        color={token.change24h >= 0 ? "#22c55e" : "#ef4444"}
                        width={64}
                        height={28}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ GLOBE / LIVE TX STREAM ═══ */}
      <section class="py-20 px-6 lg:px-8 bg-linear-to-b from-white to-gray-50/50">
        <div class="max-w-7xl mx-auto">
          <div class="text-center mb-12 reveal-section">
            <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
              Live Transaction{" "}
              <span class="bg-linear-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                Stream
              </span>
            </h2>
            <p class="text-gray-500 mt-2 font-light">
              Validated transactions flowing through the XRP Ledger in real-time
            </p>
          </div>

          <div class="reveal-section relative rounded-3xl overflow-hidden bg-[#080816] shadow-2xl min-h-140">
            <div class="flex items-center justify-center py-12 relative">
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div class="w-100 h-100 bg-blue-500/8 rounded-full blur-[80px]" />
              </div>
              <div class="relative z-10 w-90 h-90">
                <div
                  class="animate-globe-spin w-full h-full rounded-full relative"
                  style={{
                    background:
                      "radial-gradient(circle at 35% 35%, rgba(59,130,246,0.12) 0%, rgba(16,185,129,0.06) 40%, rgba(17,24,39,0.95) 70%, #0a0a1a 100%)",
                    boxShadow:
                      "0 0 80px rgba(59,130,246,0.15), inset 0 0 60px rgba(59,130,246,0.08)",
                  }}
                >
                  <div class="globe-atmosphere" />
                  <div class="globe-highlight" />
                  {[0, 30, 60, 90, 120, 150].map((deg) => (
                    <div
                      key={`lng-${deg}`}
                      class="absolute inset-0 rounded-full border border-blue-500/8"
                      style={{ transform: `rotateY(${deg}deg)` }}
                    />
                  ))}
                  <svg
                    class="absolute inset-0 w-full h-full"
                    viewBox="0 0 340 340"
                  >
                    {globeArcs.list.slice(-20).map((arc) => {
                      const r = 140,
                        cx = 170,
                        cy = 170;
                      const x1 =
                        cx +
                        r * Math.cos((arc.startAngle * Math.PI) / 180) * 0.85;
                      const y1 =
                        cy +
                        r * Math.sin((arc.startAngle * Math.PI) / 180) * 0.85;
                      const x2 =
                        cx +
                        r * Math.cos((arc.endAngle * Math.PI) / 180) * 0.85;
                      const y2 =
                        cy +
                        r * Math.sin((arc.endAngle * Math.PI) / 180) * 0.85;
                      const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * 40;
                      const midY = (y1 + y2) / 2 - 30 - Math.random() * 30;
                      return (
                        <g key={arc.id}>
                          <path
                            d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                            fill="none"
                            stroke={arc.color}
                            stroke-width="1.5"
                            stroke-dasharray="200"
                            opacity="0.6"
                            style={{
                              animation: `arc-travel ${2 + Math.random() * 2}s ease-in-out forwards`,
                            }}
                          />
                          <circle
                            cx={x1}
                            cy={y1}
                            r="2.5"
                            fill={arc.color}
                            opacity="0.8"
                          >
                            <animate
                              attributeName="r"
                              values="2;4;2"
                              dur="2s"
                              repeatCount="indefinite"
                            />
                          </circle>
                          <circle
                            cx={x2}
                            cy={y2}
                            r="2"
                            fill={arc.color}
                            opacity="0.5"
                          />
                        </g>
                      );
                    })}
                    {Array.from({ length: 18 }).map((_, i) => {
                      const angle = (i / 18) * 360;
                      const rv = 100 + (i % 3) * 25;
                      return (
                        <circle
                          key={`node-${i}`}
                          cx={170 + rv * Math.cos((angle * Math.PI) / 180)}
                          cy={170 + rv * Math.sin((angle * Math.PI) / 180)}
                          r="1.5"
                          fill={
                            i % 3 === 0
                              ? "#3b82f6"
                              : i % 3 === 1
                                ? "#10b981"
                                : "#8b5cf6"
                          }
                          opacity="0.4"
                        >
                          <animate
                            attributeName="opacity"
                            values="0.2;0.7;0.2"
                            dur={`${2 + i * 0.3}s`}
                            repeatCount="indefinite"
                          />
                        </circle>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </div>

            <div class="absolute top-5 left-5 z-20 flex items-center gap-2 bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <span class="relative flex h-2 w-2">
                <span
                  class={`animate-ping absolute inline-flex h-full w-full rounded-full ${wsConnected.value ? "bg-green-400" : "bg-yellow-400"} opacity-75`}
                />
                <span
                  class={`relative inline-flex rounded-full h-2 w-2 ${wsConnected.value ? "bg-green-500" : "bg-yellow-500"}`}
                />
              </span>
              <span class="text-xs font-medium text-white/70">
                Live Transactions
              </span>
            </div>
            <div class="absolute top-5 right-5 z-20 text-xs font-mono text-white/40 bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              XRPL Mainnet
            </div>

            <div class="absolute bottom-0 left-0 right-0 z-20">
              <div class="mx-4 mb-4 rounded-2xl overflow-hidden bg-white/6 backdrop-blur-[20px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <div class="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold text-white/80">
                      Transaction Flow
                    </span>
                    <span class="text-[10px] bg-white/10 text-white/50 px-2 py-0.5 rounded-full tabular-nums">
                      {globeTxCount.value.toLocaleString()} total
                    </span>
                  </div>
                  <div class="flex items-center gap-3 text-[10px] text-white/40">
                    {[
                      ["#3b82f6", "Payment"],
                      ["#f59e0b", "DEX"],
                      ["#8b5cf6", "TrustSet"],
                      ["#10b981", "Other"],
                    ].map(([c, l]) => (
                      <span key={l} class="flex items-center gap-1">
                        <span
                          class="w-1.5 h-1.5 rounded-full"
                          style={{ background: c }}
                        />{" "}
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
                <div class="divide-y divide-white/5 max-h-36 overflow-y-auto">
                  {liveTxs.list.slice(0, 6).map((tx, i) => (
                    <div
                      key={i}
                      class="flex items-center gap-3 px-5 py-2 hover:bg-white/5 transition-colors"
                    >
                      <div
                        class={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0 ${tx.type === "Payment" ? "bg-blue-500/20 text-blue-400" : tx.type === "OfferCreate" ? "bg-amber-500/20 text-amber-400" : tx.type === "TrustSet" ? "bg-purple-500/20 text-purple-400" : "bg-green-500/20 text-green-400"}`}
                      >
                        {tx.type === "Payment"
                          ? "PAY"
                          : tx.type === "OfferCreate"
                            ? "DEX"
                            : tx.type === "TrustSet"
                              ? "TL"
                              : tx.type.slice(0, 3).toUpperCase()}
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="text-xs font-medium text-white/80">
                            {tx.type}
                          </span>
                          <span class="text-[10px] font-mono text-white/30">
                            {tx.hash}
                          </span>
                        </div>
                        <div class="flex items-center gap-1 text-[10px] text-white/30 mt-0.5">
                          <span class="font-mono">{tx.from}</span>
                          <span class="text-blue-400/60">→</span>
                          <span class="font-mono">{tx.to}</span>
                        </div>
                      </div>
                      <div class="text-right shrink-0">
                        <div class="text-xs font-semibold text-white/80 tabular-nums">
                          {tx.amount}
                        </div>
                        <div class="text-[9px] text-white/30 tabular-nums flex items-center justify-end gap-0.5">
                          Fee:{" "}
                          <XrpLogo size={7} color="rgba(255,255,255,0.3)" />
                          {tx.fee}
                        </div>
                      </div>
                    </div>
                  ))}
                  {liveTxs.list.length === 0 && (
                    <div class="flex items-center justify-center py-6">
                      <div class="w-5 h-5 border-2 border-white/10 border-t-blue-400/50 rounded-full animate-spin mr-2" />
                      <span class="text-xs text-white/30">
                        Connecting to ledger...
                      </span>
                    </div>
                  )}
                </div>
                <div class="px-5 py-2 border-t border-white/5 flex items-center justify-between text-[10px] text-white/30">
                  <span>
                    Ledger #{ledgerStats.ledgerIndex.toLocaleString()}
                  </span>
                  <span>{ledgerStats.tps.toFixed(1)} TPS</span>
                  <span class="font-mono">wss://xrplcluster.com</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TWO NETWORKS ═══ */}
      <section class="py-24 px-6 lg:px-8 bg-white">
        <div class="max-w-7xl mx-auto">
          <div class="text-center mb-16 reveal-section">
            <h2 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight">
              Two Networks.
              <span class="bg-linear-to-r from-blue-600 to-amber-500 bg-clip-text text-transparent">
                {" "}
                One Platform.
              </span>
            </h2>
            <p class="text-lg text-gray-500 max-w-2xl mx-auto mt-4 font-light">
              Seamlessly interact with multiple blockchain networks through a
              single, unified interface
            </p>
          </div>
          <div class="grid md:grid-cols-2 gap-6">
            {[
              {
                gradient: "from-blue-500/0 to-blue-600/0",
                hoverGradient:
                  "hover:from-blue-500/[0.03] hover:to-blue-600/[0.03]",
                bar: "from-blue-500 to-blue-400",
                hoverText: "hover:text-blue-600",
                icon: (
                  <div class="w-12 h-12 rounded-2xl bg-gray-900 flex items-center justify-center shadow-lg">
                    <svg viewBox="0 0 100 100" class="w-6 h-6" fill="none">
                      <path
                        d="M25 22L50 40M75 22L50 40M25 78L50 60M75 78L50 60"
                        stroke="white"
                        stroke-width="6"
                        stroke-linecap="round"
                      />
                    </svg>
                  </div>
                ),
                name: "XRP Ledger",
                sub: "Layer 1 Blockchain",
                desc: "The XRP Ledger is a decentralized, open-source blockchain powering fast, low-cost, energy-efficient transactions. Built-in DEX, tokenization, NFTs, and cross-border payments - all settling in 3-5 seconds.",
                tags: [
                  "DEX",
                  "Payments",
                  "NFTs",
                  "AMM",
                  "Escrow",
                  "Oracles",
                  "DID",
                ],
              },
              {
                gradient: "from-amber-500/0 to-orange-600/0",
                hoverGradient:
                  "hover:from-amber-500/[0.03] hover:to-orange-600/[0.03]",
                bar: "from-amber-500 to-orange-500",
                hoverText: "hover:text-amber-600",
                icon: (
                  <div class="w-12 h-12 rounded-2xl bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                    <span class="text-white font-bold text-xl">X</span>
                  </div>
                ),
                name: "Xahau",
                sub: "Layer 1 + Hooks",
                desc: "Xahau Network is a Layer 1 blockchain built on the XRPL codebase, adding smart-contract-like functionality through Hooks - small, efficient pieces of on-chain logic that automate account behavior and enable programmable money.",
                tags: [
                  "Hooks",
                  "Rewards",
                  "Import",
                  "Smart Logic",
                  "B2M",
                  "Governance",
                ],
              },
            ].map((net) => (
              <div
                key={net.name}
                class={`stagger-card tilt-card group relative bg-white rounded-3xl p-8 lg:p-10 border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden bg-linear-to-br ${net.gradient} ${net.hoverGradient}`}
              >
                <div class="relative z-10">
                  <div class="flex items-center gap-3 mb-6">
                    {net.icon}
                    <div>
                      <h3
                        class={`text-2xl font-bold text-gray-900 transition-colors ${net.hoverText}`}
                      >
                        {net.name}
                      </h3>
                      <span class="text-xs text-gray-400 font-medium uppercase tracking-wider">
                        {net.sub}
                      </span>
                    </div>
                  </div>
                  <p class="text-gray-600 leading-relaxed font-light mb-6">
                    {net.desc}
                  </p>
                  <div class="flex flex-wrap gap-2">
                    {net.tags.map((tag) => (
                      <span
                        key={tag}
                        class="px-3 py-1 text-xs font-medium text-gray-500 bg-gray-50 rounded-full border border-gray-100"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div
                  class={`absolute bottom-0 left-0 w-full h-1 bg-linear-to-r ${net.bar} scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left`}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ WALLET INTEGRATIONS ═══ */}
      <section class="py-24 px-6 lg:px-8 bg-linear-to-b from-gray-50/50 to-white">
        <div class="max-w-7xl mx-auto">
          <div class="text-center mb-16 reveal-section">
            <h2 class="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
              Connect Your{" "}
              <span class="bg-linear-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                Wallet
              </span>
            </h2>
            <p class="text-lg text-gray-500 max-w-xl mx-auto mt-4 font-light">
              All major XRPL wallets supported - interact directly with both
              ledgers
            </p>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 max-w-4xl mx-auto">
            {[
              {
                name: "Xaman",
                desc: "Mobile & Desktop",
                icon: "🔐",
                color: "from-blue-500 to-blue-600",
              },
              {
                name: "GemWallet",
                desc: "Browser Extension",
                icon: "💎",
                color: "from-purple-500 to-purple-600",
              },
              {
                name: "Crossmark",
                desc: "Browser Extension",
                icon: "✕",
                color: "from-gray-700 to-gray-900",
              },
              {
                name: "Ledger",
                desc: "Hardware Wallet",
                icon: "🔒",
                color: "from-gray-600 to-gray-800",
              },
              {
                name: "WalletConnect",
                desc: "Multi-Wallet",
                icon: "🔗",
                color: "from-blue-400 to-blue-500",
              },
            ].map((wallet) => (
              <div
                key={wallet.name}
                class="stagger-card tilt-card group flex flex-col items-center gap-3 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 cursor-pointer"
              >
                <div
                  class={`w-14 h-14 rounded-2xl bg-linear-to-br ${wallet.color} flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform duration-300`}
                >
                  {wallet.icon}
                </div>
                <div class="text-center">
                  <div class="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                    {wallet.name}
                  </div>
                  <div class="text-xs text-gray-400 mt-0.5">{wallet.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES GRID ═══ */}
      <section class="py-24 px-6 lg:px-8 bg-white">
        <div class="max-w-7xl mx-auto">
          <div class="text-center mb-16 reveal-section">
            <h2 class="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
              Built for{" "}
              <span class="bg-linear-to-r from-blue-600 to-amber-500 bg-clip-text text-transparent">
                Everything
              </span>
            </h2>
            <p class="text-lg text-gray-500 max-w-xl mx-auto mt-4 font-light">
              Every tool you need, all in one place
            </p>
          </div>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: "🪙",
                title: "Token Issuance",
                desc: "Launch and manage fungible tokens, stablecoins, and community currencies directly on-chain",
              },
              {
                icon: "💱",
                title: "On-Chain DEX",
                desc: "Trade natively on the XRPL decentralized exchange with limit orders, AMM pools, and instant swaps",
              },
              {
                icon: "🖼️",
                title: "NFT Studio",
                desc: "Mint, trade, and manage NFTs with built-in marketplace integration and royalty enforcement",
              },
              {
                icon: "⚡",
                title: "Instant Payments",
                desc: "Send cross-border payments settling in 3-5 seconds with near-zero fees",
              },
              {
                icon: "🔐",
                title: "Escrow & Checks",
                desc: "Time-locked escrows, conditional payments, and on-chain check issuance",
              },
              {
                icon: "📊",
                title: "Oracle Integration",
                desc: "Access price feeds and off-chain data through the native Oracle amendment",
              },
              {
                icon: "🌉",
                title: "Cross-Chain Bridge",
                desc: "Move assets between XRPL and Xahau with native XChain bridge transactions",
              },
              {
                icon: "🪝",
                title: "Hooks (Xahau)",
                desc: "Deploy lightweight smart contracts that trigger on transaction events automatically",
              },
              {
                icon: "🆔",
                title: "Decentralized Identity",
                desc: "Set up and manage on-chain DID documents and verifiable credentials",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                class="stagger-card tilt-card group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300"
              >
                <div class="text-3xl mb-4 group-hover:scale-110 transition-transform duration-300 inline-block">
                  {feature.icon}
                </div>
                <h3 class="font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                  {feature.title}
                </h3>
                <p class="text-sm text-gray-500 leading-relaxed font-light">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PHILOSOPHY / CTA ═══ */}
      <section class="py-24 px-6 lg:px-8 bg-linear-to-b from-white to-gray-50/50">
        <div class="max-w-4xl mx-auto reveal-section">
          <div class="relative bg-linear-to-br from-gray-900 to-gray-800 rounded-3xl p-10 lg:p-14 overflow-hidden shadow-2xl">
            <div class="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
            <div class="absolute bottom-0 left-0 w-60 h-60 bg-amber-500/10 rounded-full blur-[80px] pointer-events-none" />
            <div class="relative z-10">
              <span class="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 border border-white/10 text-white/80 text-xs font-semibold rounded-full mb-6 backdrop-blur-sm">
                Our Philosophy
              </span>
              <h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight tracking-tight">
                Designed for Sovereignty
              </h2>
              <p class="text-gray-300 text-lg leading-relaxed font-light mb-8 max-w-2xl">
                Every action in {"{XRPL}"}OS is explicit and intentional.
                Transactions are grouped by purpose - Create, Set, Claim,
                Deposit, Cancel - so you always understand exactly what you're
                signing. No hidden state. No dark UX patterns. Full
                transparency, total control.
              </p>
              <div class="flex flex-col sm:flex-row gap-4">
                <a
                  href="/dashboard"
                  class="group inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-gray-900 font-semibold rounded-xl hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  Get Started{" "}
                  <span class="inline-block transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </a>
                <a
                  href="/search"
                  class="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/10 text-white font-semibold rounded-xl border border-white/10 hover:bg-white/20 transition-all duration-300 backdrop-blur-sm"
                >
                  Explore Ledger
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer class="bg-white text-gray-600 border-t border-gray-100">
        <div class="max-w-7xl mx-auto px-6 lg:px-8 py-16">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12 mb-12">
            <div class="lg:col-span-2">
              <div class="mb-4">
                <a
                  href="/"
                  class="text-2xl font-bold bg-linear-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
                >
                  {"{XRPL}"}OS
                </a>
              </div>
              <p class="text-gray-500 mb-6 text-sm leading-relaxed font-light">
                The one-stop operating system for the XRP Ledger and Xahau
                ecosystem. Create, manage, and trade digital assets with
                sovereignty and security at its core.
              </p>
              <div class="flex gap-3">
                {[
                  {
                    name: "Twitter",
                    d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
                  },
                  {
                    name: "GitHub",
                    d: "M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z",
                  },
                  {
                    name: "Discord",
                    d: "M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286z",
                  },
                ].map((s) => (
                  <a
                    key={s.name}
                    href="#"
                    target="_blank"
                    class="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all duration-300"
                    aria-label={s.name}
                  >
                    <svg
                      class="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d={s.d} />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
            {[
              {
                title: "Products",
                links: [
                  "Dashboard",
                  "Explorer",
                  "DEX",
                  "NFT Studio",
                  "Token Tools",
                ],
              },
              {
                title: "Developers",
                links: [
                  "Documentation",
                  "API Reference",
                  "Hooks SDK",
                  "GitHub",
                ],
              },
              {
                title: "Company",
                links: ["About", "Blog", "Careers", "Contact"],
              },
              {
                title: "Legal",
                links: [
                  "Terms of Service",
                  "Privacy Policy",
                  "Cookie Settings",
                ],
              },
            ].map((section) => (
              <div key={section.title}>
                <h3 class="text-gray-900 font-semibold text-xs uppercase tracking-widest mb-4">
                  {section.title}
                </h3>
                <nav class="flex flex-col gap-2.5">
                  {section.links.map((link) => (
                    <a
                      key={link}
                      href="#"
                      class="text-gray-500 hover:text-blue-600 transition-colors text-sm font-light"
                    >
                      {link}
                    </a>
                  ))}
                </nav>
              </div>
            ))}
          </div>
          <div class="border-t border-gray-100 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p class="text-gray-400 text-sm font-light">
              © 2025 - Product of{" "}
              <a
                href="https://nrdxlab.com"
                class="text-gray-600 hover:text-blue-600 transition-colors"
              >
                {"{NRDX}"}Labs
              </a>
              . All rights reserved.
            </p>
            <div class="flex gap-6">
              <a
                href="#"
                class="text-gray-400 hover:text-blue-600 text-sm transition-colors font-light"
              >
                Status
              </a>
              <a
                href="#"
                class="text-gray-400 hover:text-blue-600 text-sm transition-colors font-light"
              >
                Changelog
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
});

export const head: DocumentHead = {
  title: "{XRPL}OS — The Pulse of the XRP Ecosystem",
  meta: [
    {
      name: "description",
      content:
        "The one-stop operating system for the XRP Ledger and Xahau ecosystem. Live stats, DEX trading, token management, and direct ledger interaction - all wallets, one platform. Built by {NRDX}Labs.",
    },
  ],
};

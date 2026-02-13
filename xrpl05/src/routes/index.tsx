import {
  component$,
  useSignal,
  useStore,
  useVisibleTask$,
  $,
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

// ─── Sparkline Mini Component ────────────────────────────────
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
  return (
    <svg width={width} height={height} class="overflow-visible">
      <defs>
        <linearGradient
          id={`sg-${color.replace("#", "")}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stop-color={color} stop-opacity="0.3" />
          <stop offset="100%" stop-color={color} stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <polygon
        points={areaPoints}
        fill={`url(#sg-${color.replace("#", "")})`}
      />
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

// ─── XRP Logo Inline SVG Component ──────────────────────────
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

// ─── Helper: format number ───────────────────────────────────
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

// ─── Main Landing Page ───────────────────────────────────────
export default component$(() => {
  // ── Reactive State ──
  const xrpPrice = useSignal(2.39);
  const xrpChange = useSignal(4.27);
  const xrpMarketCap = useSignal("$138.2B");
  const xrpVolume = useSignal("$4.8B");
  const tokens = useStore<{ list: TokenData[] }>({
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
      },
      {
        symbol: "CSC",
        name: "CasinoCoin",
        price: 0.0047,
        change24h: 12.33,
        marketCap: "$42.5M",
        volume: "$1.8M",
        sparkline: generateSparkline(0.0047, 1),
        currency: "CSC",
        issuer: "rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr",
      },
      {
        symbol: "ELS",
        name: "Elysian",
        price: 0.0213,
        change24h: -0.87,
        marketCap: "$21.3M",
        volume: "$890K",
        sparkline: generateSparkline(0.0213, 0),
        currency: "454C5300000000000000000000000000000000000",
        issuer: "rHXuEaRYnnJHbDeuBH5w8yPh5uwNVh5zAg",
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
      },
      {
        symbol: "RPR",
        name: "Rippler",
        price: 0.00142,
        change24h: 22.7,
        marketCap: "$14.2M",
        volume: "$420K",
        sparkline: generateSparkline(0.00142, 1),
        currency: "RPR",
        issuer: "r3qWgpz2ry3BhcRJ8JE6rxM8esrfhuKp4R",
      },
    ],
  });

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
  const chartData = useSignal<number[]>([]);
  const chartCanvasRef = useSignal<HTMLCanvasElement>();
  const coinRef = useSignal<HTMLDivElement>();
  const wsConnected = useSignal(false);
  const xahauPrice = useSignal(0.0087);
  const xahauChange = useSignal(3.12);

  // Ledger card + modal state
  const isPaused = useSignal(false);
  const showLedgerModal = useSignal(false);
  const selectedLedger = useSignal<LedgerCard | null>(null);

  // For tracking intervals
  const ledgerIntervals = useStore<{ list: number[] }>({ list: [] });
  const txnFeeSamples = useStore<{ list: number[] }>({ list: [] });
  const lastLedgerCloseTime = useSignal(0);

  // Globe transaction arcs for CSS globe
  const globeArcs = useStore<{
    list: {
      id: number;
      startAngle: number;
      endAngle: number;
      color: string;
      type: string;
    }[];
  }>({ list: [] });
  const globeArcId = useSignal(0);
  const globeTxCount = useSignal(0);
  const globeLastTx = useSignal<LiveTx | null>(null);

  // open ledger modal
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

  // ── Fetch live XRP price ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ cleanup }) => {
    const controller = new AbortController();
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true",
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
      }
    } catch {
      // Use fallback values
    }
    cleanup(() => controller.abort());
  });

  // ── GSAP Scroll Animations + Coin ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ cleanup }) => {
    const { gsap } = await import("gsap");
    const { ScrollTrigger } = await import("gsap/ScrollTrigger");
    gsap.registerPlugin(ScrollTrigger);

    // — Hero entrance animations —
    const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
    heroTl
      .from(".hero-badge", { y: -30, opacity: 0, duration: 0.7 })
      .from(
        ".hero-title-line",
        { y: 80, opacity: 0, duration: 0.9, stagger: 0.15 },
        "-=0.3",
      )
      .from(".hero-subtitle", { y: 40, opacity: 0, duration: 0.7 }, "-=0.4")
      .from(
        ".hero-price-block",
        { scale: 0.8, opacity: 0, duration: 0.8, ease: "back.out(1.4)" },
        "-=0.3",
      )
      .from(
        ".hero-cta",
        { y: 30, opacity: 0, duration: 0.6, stagger: 0.1 },
        "-=0.4",
      );

    // — 3D Coin scroll animation —
    const coin = document.getElementById("coin-3d");
    const coinWrap = document.getElementById("coin-container");
    if (coin && coinWrap) {
      gsap.to(coin, {
        rotateY: 15,
        rotateX: -5,
        duration: 3,
        ease: "power1.inOut",
        yoyo: true,
        repeat: -1,
      });

      gsap
        .timeline({
          scrollTrigger: {
            trigger: ".landing-page",
            start: "top top",
            end: "bottom bottom",
            scrub: 1.5,
          },
        })
        .to(coin, { rotateY: 1080, rotateX: 360, ease: "none" }, 0)
        .to(
          coinWrap,
          {
            y: () => window.innerHeight * 0.3,
            scale: 0.6,
            opacity: 0.4,
            ease: "none",
          },
          0,
        );
    }

    // — Bloomberg bar entrance —
    gsap.from(".bloomberg-bar", {
      y: -20,
      opacity: 0,
      duration: 0.8,
      ease: "power3.out",
      scrollTrigger: {
        trigger: ".bloomberg-bar",
        start: "top 90%",
        toggleActions: "play none none reverse",
      },
    });

    // — Ledger ticker entrance —
    gsap.from(".ledger-ticker-section", {
      y: 30,
      opacity: 0,
      duration: 0.7,
      ease: "power3.out",
      scrollTrigger: {
        trigger: ".ledger-ticker-section",
        start: "top 88%",
        toggleActions: "play none none reverse",
      },
    });

    // — Globe section entrance —
    gsap.from(".globe-section-wrapper", {
      scale: 0.95,
      opacity: 0,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: {
        trigger: ".globe-section-wrapper",
        start: "top 85%",
        toggleActions: "play none none reverse",
      },
    });

    // — Section reveal animations —
    gsap.utils.toArray<HTMLElement>(".reveal-up").forEach((el) => {
      gsap.from(el, {
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          toggleActions: "play none none reverse",
        },
        y: 60,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
      });
    });

    gsap.utils.toArray<HTMLElement>(".reveal-left").forEach((el) => {
      gsap.from(el, {
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
        x: -80,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
      });
    });

    gsap.utils.toArray<HTMLElement>(".reveal-right").forEach((el) => {
      gsap.from(el, {
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
        x: 80,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
      });
    });

    // — Stagger card reveals —
    gsap.utils.toArray<HTMLElement>(".stagger-group").forEach((group) => {
      const cards = group.querySelectorAll(".stagger-item");
      gsap.from(cards, {
        scrollTrigger: {
          trigger: group,
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
        y: 50,
        opacity: 0,
        duration: 0.7,
        stagger: 0.12,
        ease: "power3.out",
      });
    });

    // — Stats counter animation —
    gsap.utils.toArray<HTMLElement>(".count-up").forEach((el) => {
      const target = parseInt(el.dataset.target || "0", 10);
      const obj = { val: 0 };
      gsap.to(obj, {
        val: target,
        duration: 2.5,
        ease: "power2.out",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          toggleActions: "play none none none",
        },
        onUpdate: () => {
          el.textContent = Math.floor(obj.val).toLocaleString();
        },
      });
    });

    // — Parallax elements —
    gsap.utils.toArray<HTMLElement>(".parallax-slow").forEach((el) => {
      gsap.to(el, {
        y: -60,
        scrollTrigger: {
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });
    });

    // — Token row reveals —
    const tokenRows = document.querySelectorAll(".token-row");
    gsap.from(tokenRows, {
      scrollTrigger: {
        trigger: ".token-table",
        start: "top 80%",
        toggleActions: "play none none reverse",
      },
      x: -40,
      opacity: 0,
      duration: 0.6,
      stagger: 0.08,
      ease: "power3.out",
    });

    // — Feature card hover tilt (non-GSAP, pure listener) —
    document.querySelectorAll<HTMLElement>(".tilt-card").forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        gsap.to(card, {
          rotateY: x * 10,
          rotateX: -y * 10,
          duration: 0.4,
          ease: "power2.out",
        });
      });
      card.addEventListener("mouseleave", () => {
        gsap.to(card, {
          rotateY: 0,
          rotateX: 0,
          duration: 0.6,
          ease: "elastic.out(1, 0.5)",
        });
      });
    });

    cleanup(() => {
      ScrollTrigger.getAll().forEach((st) => st.kill());
      gsap.killTweensOf("*");
    });
  });

  // ── XRPL WebSocket for live ledger + transactions ──
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
        // Request server_info for quorum + load_fee
        ws?.send(
          JSON.stringify({
            id: 2,
            command: "server_info",
          }),
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // Handle server_info response
          if (msg.id === 2 && msg.result?.info) {
            const info = msg.result.info;
            if (info.validation_quorum)
              ledgerStats.quorum = info.validation_quorum;
            if (info.load_factor) {
              const baseFeeDrops = 10;
              ledgerStats.loadFee =
                (baseFeeDrops * info.load_factor) / 1_000_000;
            }
          }

          if (msg.type === "ledgerClosed") {
            const now = Date.now();

            // Calculate ledger interval
            if (lastLedgerCloseTime.value > 0) {
              const interval = (now - lastLedgerCloseTime.value) / 1000;
              ledgerIntervals.list.push(interval);
              if (ledgerIntervals.list.length > 20)
                ledgerIntervals.list.shift();

              // Update average
              const sum = ledgerIntervals.list.reduce((a, b) => a + b, 0);
              ledgerStats.avgLedgerInterval =
                sum / ledgerIntervals.list.length;
            }
            lastLedgerCloseTime.value = now;

            ledgerStats.ledgerIndex = msg.ledger_index;
            ledgerStats.txCount = msg.txn_count || ledgerStats.txCount;
            ledgerStats.validatedCount += 1;

            const txnCount = msg.txn_count || currentLedgerTxs.length;

            // Build ledger card
            const card: LedgerCard = {
              ledgerIndex: msg.ledger_index,
              closeTime: new Date().toISOString(),
              closeTimeMs: now,
              txnCount: txnCount,
              totalFee: currentLedgerFeeSum,
              baseFee: 0.00001,
              transactions: [...currentLedgerTxs],
            };

            ledgerCards.list.unshift(card);
            if (ledgerCards.list.length > 30) ledgerCards.list.pop();

            // Update avg txn per ledger
            if (txnCount > 0) {
              const txnCounts = ledgerCards.list.map((c) => c.txnCount);
              ledgerStats.avgTxnPerLedger =
                txnCounts.reduce((a, b) => a + b, 0) / txnCounts.length;
            }

            // Reset for next ledger
            currentLedgerTxs = [];
            currentLedgerFeeSum = 0;

            // Update TPS
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
            const feeXrp = tx.Fee
              ? parseInt(tx.Fee) / 1_000_000
              : 0.000012;

            // Track fee samples
            txnFeeSamples.list.push(feeXrp);
            if (txnFeeSamples.list.length > 100) txnFeeSamples.list.shift();
            const feeSum = txnFeeSamples.list.reduce((a, b) => a + b, 0);
            ledgerStats.avgTxnFee = feeSum / txnFeeSamples.list.length;

            currentLedgerFeeSum += feeXrp;

            const amount = tx.Amount
              ? typeof tx.Amount === "string"
                ? `${(parseInt(tx.Amount) / 1_000_000).toFixed(2)} XRP`
                : `${tx.Amount.value} ${tx.Amount.currency}`
              : "—";

            const currency = tx.Amount
              ? typeof tx.Amount === "string"
                ? "XRP"
                : tx.Amount.currency || "?"
              : "—";

            const liveTx: LiveTx = {
              hash: tx.hash?.slice(0, 12) + "…" || "N/A",
              fullHash: tx.hash || "",
              type: tx.TransactionType || "Unknown",
              amount,
              from: tx.Account?.slice(0, 10) + "…" || "—",
              fullFrom: tx.Account || "",
              to: tx.Destination?.slice(0, 10) + "…" || "—",
              fullTo: tx.Destination || "",
              timestamp: Date.now(),
              fee: feeXrp.toFixed(6),
              sequence: tx.Sequence || 0,
              currency,
              destinationTag: tx.DestinationTag,
            };

            liveTxs.list.unshift(liveTx);
            if (liveTxs.list.length > 25) liveTxs.list.pop();

            currentLedgerTxs.push(liveTx);
            if (currentLedgerTxs.length > 200) currentLedgerTxs.shift();

            // Feed globe arcs
            globeTxCount.value += 1;
            globeLastTx.value = liveTx;
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
          // parse error
        }
      };

      ws.onclose = () => {
        wsConnected.value = false;
        reconnectTimer = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    connect();

    // Periodically request server_info for quorum updates
    const serverInfoInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ id: 2, command: "server_info" }));
      }
    }, 30000);

    cleanup(() => {
      clearTimeout(reconnectTimer);
      clearInterval(serverInfoInterval);
      ws?.close();
    });
  });

  // ── DEX Chart Canvas ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    async ({ cleanup }) => {
      const canvas = chartCanvasRef.value;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      const W = rect.width;
      const H = rect.height;

      const dataPoints: number[] = [];
      let price = 2.1;
      for (let i = 0; i < 96; i++) {
        price += (Math.random() - 0.47) * 0.04;
        price = Math.max(1.9, Math.min(2.6, price));
        dataPoints.push(price);
      }
      chartData.value = dataPoints;

      const minP = Math.min(...dataPoints) - 0.05;
      const maxP = Math.max(...dataPoints) + 0.05;
      const rangeP = maxP - minP;

      let animProgress = 0;
      let animFrame: number;

      function draw() {
        ctx!.clearRect(0, 0, W, H);
        const visibleCount = Math.floor(animProgress * dataPoints.length);
        if (visibleCount < 2) {
          animProgress += 0.02;
          animFrame = requestAnimationFrame(draw);
          return;
        }

        ctx!.strokeStyle = "rgba(0,0,0,0.04)";
        ctx!.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
          const y = (i / 4) * H;
          ctx!.beginPath();
          ctx!.moveTo(0, y);
          ctx!.lineTo(W, y);
          ctx!.stroke();
        }

        ctx!.fillStyle = "rgba(0,0,0,0.3)";
        ctx!.font = "10px Inter, sans-serif";
        ctx!.textAlign = "right";
        for (let i = 0; i <= 4; i++) {
          const val = maxP - (i / 4) * rangeP;
          const y = (i / 4) * H;
          ctx!.fillText(`$${val.toFixed(3)}`, W - 4, y + 12);
          }

          const gradient = ctx!.createLinearGradient(0, 0, 0, H);
          gradient.addColorStop(0, "rgba(37, 99, 235, 0.15)");
          gradient.addColorStop(1, "rgba(37, 99, 235, 0.01)");

          ctx!.beginPath();
          ctx!.moveTo(0, H);
          for (let i = 0; i < visibleCount; i++) {
            const x = (i / (dataPoints.length - 1)) * (W - 50);
            const y = H - ((dataPoints[i] - minP) / rangeP) * (H - 20) - 10;
            ctx!.lineTo(x, y);
          }
          const lastX = ((visibleCount - 1) / (dataPoints.length - 1)) * (W - 50);
          ctx!.lineTo(lastX, H);
          ctx!.closePath();
          ctx!.fillStyle = gradient;
          ctx!.fill();

          ctx!.beginPath();
          for (let i = 0; i < visibleCount; i++) {
            const x = (i / (dataPoints.length - 1)) * (W - 50);
            const y = H - ((dataPoints[i] - minP) / rangeP) * (H - 20) - 10;
            if (i === 0) ctx!.moveTo(x, y);
            else ctx!.lineTo(x, y);
          }
          ctx!.strokeStyle = "#2563eb";
          ctx!.lineWidth = 2;
          ctx!.lineJoin = "round";
          ctx!.stroke();

          if (visibleCount > 0) {
            const ex = ((visibleCount - 1) / (dataPoints.length - 1)) * (W - 50);
            const ey =
              H -
              ((dataPoints[visibleCount - 1] - minP) / rangeP) * (H - 20) -
              10;
            ctx!.beginPath();
            ctx!.arc(ex, ey, 4, 0, Math.PI * 2);
            ctx!.fillStyle = "#2563eb";
            ctx!.fill();
            ctx!.beginPath();
            ctx!.arc(ex, ey, 8, 0, Math.PI * 2);
            ctx!.fillStyle = "rgba(37, 99, 235, 0.2)";
            ctx!.fill();
          }

          if (animProgress < 1) {
            animProgress += 0.015;
            animFrame = requestAnimationFrame(draw);
          }
        }

        const observer = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting) {
              animProgress = 0;
              draw();
              observer.disconnect();
            }
          },
          { threshold: 0.3 },
        );
        observer.observe(canvas);

        cleanup(() => {
          observer.disconnect();
          cancelAnimationFrame(animFrame);
        });
      },
      { strategy: "intersection-observer" },
    );

    // ─── JSX ────────────────────────────────────────────────────
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
            @keyframes float {
              0%, 100% { transform: translateY(0px) rotate(0deg); }
              33% { transform: translateY(-12px) rotate(1deg); }
              66% { transform: translateY(6px) rotate(-1deg); }
            }
            @keyframes pulse-ring {
              0% { transform: scale(1); opacity: 1; }
              100% { transform: scale(1.8); opacity: 0; }
            }
            @keyframes shimmer {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
            @keyframes marquee-scroll {
              0% { transform: translateX(0%); }
              100% { transform: translateX(-50%); }
            }
            @keyframes grid-pulse {
              0%, 100% { opacity: 0.03; }
              50% { opacity: 0.06; }
            }
            @keyframes globe-rotate {
              0% { transform: rotateY(0deg); }
              100% { transform: rotateY(360deg); }
            }
            @keyframes globe-pulse-ring {
              0% { transform: scale(1); opacity: 0.5; }
              100% { transform: scale(1.6); opacity: 0; }
            }
            @keyframes arc-travel {
              0% { stroke-dashoffset: 200; opacity: 0; }
              20% { opacity: 1; }
              80% { opacity: 1; }
              100% { stroke-dashoffset: 0; opacity: 0; }
            }
            @keyframes ledger-slide {
              0% { transform: translateX(100%); opacity: 0; }
              100% { transform: translateX(0); opacity: 1; }
            }
            @keyframes ledger-ticker-scroll {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            @keyframes dot-pulse {
              0%, 100% { r: 2; opacity: 0.6; }
              50% { r: 4; opacity: 1; }
            }
            .coin-face {
              position: absolute;
              inset: 0;
              border-radius: 50%;
              backface-visibility: hidden;
              -webkit-backface-visibility: hidden;
            }
            .coin-shine {
              background: conic-gradient(
                from 0deg,
                rgba(255,255,255,0) 0deg,
                rgba(255,255,255,0.15) 60deg,
                rgba(255,255,255,0) 120deg,
                rgba(255,255,255,0.08) 240deg,
                rgba(255,255,255,0) 360deg
              );
            }
            .metal-gradient {
              background: linear-gradient(135deg, #1a1a2e 0%, #2d2d44 25%, #16213e 50%, #2d2d44 75%, #1a1a2e 100%);
            }
            .metal-gradient-back {
              background: linear-gradient(135deg, #16213e 0%, #1a1a2e 30%, #2d2d44 60%, #1a1a2e 100%);
            }
            .ticker-track {
              display: flex;
              gap: 2rem;
              animation: marquee-scroll 45s linear infinite;
              flex-shrink: 0;
            }
            .ticker-track:hover { animation-play-state: paused; }
            .ledger-ticker-track {
              display: flex;
              gap: 1rem;
              animation: ledger-ticker-scroll 60s linear infinite;
              flex-shrink: 0;
            }
            .ledger-ticker-track.paused { animation-play-state: paused; }
            .grid-bg {
              background-image:
                linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px);
              background-size: 60px 60px;
              animation: grid-pulse 6s ease-in-out infinite;
            }
            .token-row { transition: all 0.3s cubic-bezier(0.4,0,0.2,1); }
            .token-row:hover { background: rgba(37,99,235,0.03); transform: translateX(4px); }
            .live-dot { position: relative; }
            .live-dot::after {
              content: '';
              position: absolute;
              inset: -3px;
              border-radius: 50%;
              border: 2px solid currentColor;
              animation: pulse-ring 2s cubic-bezier(0,0,0.2,1) infinite;
            }
            .css-globe {
              width: 100%;
              height: 100%;
              position: relative;
              perspective: 1200px;
            }
            .css-globe-sphere {
              width: 340px;
              height: 340px;
              border-radius: 50%;
              position: relative;
              margin: 0 auto;
              transform-style: preserve-3d;
              animation: globe-rotate 30s linear infinite;
              background: radial-gradient(circle at 35% 35%,
                rgba(59,130,246,0.12) 0%,
                rgba(16,185,129,0.06) 40%,
                rgba(17,24,39,0.95) 70%,
                #0a0a1a 100%
              );
              box-shadow:
                0 0 80px rgba(59,130,246,0.15),
                inset 0 0 60px rgba(59,130,246,0.08),
                0 0 120px rgba(59,130,246,0.05);
            }
            .globe-grid-line {
              position: absolute;
              inset: 0;
              border-radius: 50%;
              border: 1px solid rgba(59,130,246,0.08);
            }
            .globe-lat {
              position: absolute;
              left: 50%;
              transform: translateX(-50%);
              border-radius: 50%;
              border: 1px solid rgba(59,130,246,0.06);
            }
            .globe-atmosphere {
              position: absolute;
              inset: -12px;
              border-radius: 50%;
              background: radial-gradient(circle at 35% 35%,
                transparent 60%,
                rgba(59,130,246,0.08) 80%,
                rgba(59,130,246,0.15) 100%
              );
              pointer-events: none;
            }
            .globe-highlight {
              position: absolute;
              width: 45%;
              height: 45%;
              top: 8%;
              left: 15%;
              border-radius: 50%;
              background: radial-gradient(ellipse,
                rgba(255,255,255,0.08) 0%,
                transparent 70%
              );
              pointer-events: none;
            }
            .bloomberg-stat-separator {
              width: 1px;
              height: 24px;
              background: rgba(255,255,255,0.15);
              flex-shrink: 0;
            }
            @media (max-width: 768px) {
              .css-globe-sphere { width: 240px; height: 240px; }
              .bloomberg-bar-inner { flex-wrap: wrap; gap: 8px; }
            }
          `}
        />

        {/* ═══════════════ LEDGER DETAIL MODAL ═══════════════ */}
        {showLedgerModal.value && selectedLedger.value && (
          <div
            class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            onClick$={() => closeLedgerModal()}
          >
            <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div
              class="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[85vh] overflow-hidden"
              onClick$={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <svg class="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <h3 class="font-bold text-gray-900 text-lg">Ledger #{selectedLedger.value.ledgerIndex.toLocaleString()}</h3>
                    <p class="text-xs text-gray-400 font-mono">
                      {new Date(selectedLedger.value.closeTime).toUTCString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick$={() => closeLedgerModal()}
                  class="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Modal Stats */}
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 border-b border-gray-50">
                <div class="bg-gray-50 rounded-xl p-3">
                  <div class="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Ledger Index</div>
                  <div class="text-sm font-bold text-gray-900 tabular-nums">{selectedLedger.value.ledgerIndex.toLocaleString()}</div>
                </div>
                <div class="bg-gray-50 rounded-xl p-3">
                  <div class="text-[10px] text-gray-400 font-medium uppercase tracking-wider"># of TXN</div>
                  <div class="text-sm font-bold text-gray-900 tabular-nums">{selectedLedger.value.txnCount}</div>
                </div>
                <div class="bg-gray-50 rounded-xl p-3">
                  <div class="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Total Fee</div>
                  <div class="text-sm font-bold text-gray-900 tabular-nums flex items-center gap-1">
                    <XrpLogo size={10} color="#111827" />
                    {selectedLedger.value.totalFee.toFixed(6)}
                  </div>
                  <div class="text-[9px] text-gray-400 mt-0.5">
                    Base {selectedLedger.value.baseFee.toFixed(6)} + Txn {(selectedLedger.value.totalFee - selectedLedger.value.baseFee * selectedLedger.value.txnCount).toFixed(6)}
                  </div>
                </div>
                <div class="bg-gray-50 rounded-xl p-3">
                  <div class="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Date + Time UTC</div>
                  <div class="text-sm font-bold text-gray-900 tabular-nums">
                    {new Date(selectedLedger.value.closeTime).toISOString().slice(11, 19)}
                  </div>
                  <div class="text-[9px] text-gray-400">{new Date(selectedLedger.value.closeTime).toISOString().slice(0, 10)}</div>
                </div>
              </div>

              {/* Transaction List Header */}
              <div class="grid grid-cols-12 gap-2 px-6 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/30">
                <div class="col-span-3">Transaction Type</div>
                <div class="col-span-3">Account</div>
                <div class="col-span-2 text-right">Sequence</div>
                <div class="col-span-2 text-right">TXN. Cost</div>
                <div class="col-span-2 text-right">Amount</div>
              </div>

              {/* Transaction Rows */}
              <div class="max-h-72 overflow-y-auto scrollbar-thin">
                {selectedLedger.value.transactions.length === 0 && (
                  <div class="text-center py-8 text-gray-300 text-sm">No transactions captured for this ledger</div>
                )}
                {selectedLedger.value.transactions.map((tx, i) => (
                  <div key={i} class="grid grid-cols-12 gap-2 px-6 py-2.5 items-center border-b border-gray-50/80 hover:bg-blue-50/30 transition-colors text-xs">
                    <div class="col-span-3 flex items-center gap-1.5">
                      <span class={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                        tx.type === "Payment" ? "bg-blue-500" :
                        tx.type === "OfferCreate" ? "bg-amber-500" :
                        tx.type === "TrustSet" ? "bg-purple-500" :
                        "bg-gray-400"
                      }`} />
                      <span class="font-medium text-gray-900 truncate">{tx.type}</span>
                    </div>
                    <div class="col-span-3 font-mono text-gray-500 truncate">{tx.from}</div>
                    <div class="col-span-2 text-right font-mono text-gray-500 tabular-nums">{tx.sequence}</div>
                    <div class="col-span-2 text-right tabular-nums text-gray-700 flex items-center justify-end gap-0.5">
                      <XrpLogo size={9} color="#6b7280" />{tx.fee}
                    </div>
                    <div class="col-span-2 text-right font-semibold text-gray-900 tabular-nums truncate">
                      {tx.amount}
                    </div>
                  </div>
                ))}
              </div>

              {/* Modal Footer - trade info */}
              <div class="px-6 py-3 border-t border-gray-100 bg-gray-50/30">
                <div class="text-[10px] text-gray-400 uppercase tracking-wider mb-1 font-semibold">Trade Details</div>
                <div class="flex flex-wrap gap-3 text-[11px] text-gray-500">
                  <span>Price: ${xrpPrice.value.toFixed(4)}</span>
                  <span class="text-gray-300">|</span>
                  <span>Buy: <span class="text-green-600 font-medium">{selectedLedger.value.transactions.filter(t => t.type === "OfferCreate").length} offers</span></span>
                  <span class="text-gray-300">|</span>
                  <span>Sell: <span class="text-red-500 font-medium">{selectedLedger.value.transactions.filter(t => t.type === "Payment").length} payments</span></span>
                  <span class="text-gray-300">|</span>
                  <span>UNL: {ledgerStats.quorum} validators</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ 3D COIN (Fixed Position) ═══════════════ */}
        <div
          id="coin-container"
          class="fixed top-1/2 right-8 -translate-y-1/2 z-30 pointer-events-none hidden lg:block"
          style={{ perspective: "1200px" }}
        >
          <div
            id="coin-3d"
            ref={coinRef}
            class="relative"
            style={{
              width: "180px",
              height: "180px",
              transformStyle: "preserve-3d",
            }}
          >
            <div
              class="coin-face metal-gradient flex items-center justify-center"
              style={{
                boxShadow:
                  "0 0 40px rgba(37,99,235,0.15), inset 0 0 30px rgba(255,255,255,0.05)",
                border: "2px solid rgba(255,255,255,0.08)",
              }}
            >
              <div class="coin-shine coin-face" />
              <svg viewBox="0 0 100 100" class="w-24 h-24" fill="none">
                <path
                  d="M28 25L50 42M72 25L50 42M28 75L50 58M72 75L50 58"
                  stroke="white"
                  stroke-width="3.5"
                  stroke-linecap="round"
                />
                <text x="50" y="95" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="8" font-weight="600">
                  XRP LEDGER
                </text>
              </svg>
            </div>
            <div
              class="coin-face metal-gradient-back flex items-center justify-center"
              style={{
                transform: "rotateY(180deg)",
                boxShadow:
                  "0 0 40px rgba(37,99,235,0.15), inset 0 0 30px rgba(255,255,255,0.05)",
                border: "2px solid rgba(255,255,255,0.08)",
              }}
            >
              <div class="coin-shine coin-face" />
              <div class="text-center">
                <span class="text-white/80 text-2xl font-bold tracking-widest block">XRP</span>
                <span class="text-white/30 text-[10px] tracking-[0.3em] mt-1 block">LEDGER</span>
              </div>
            </div>
            <div
              class="absolute inset-0 rounded-full pointer-events-none"
              style={{
                border: "3px solid rgba(45,45,68,0.8)",
                transform: "translateZ(-2px)",
              }}
            />
          </div>
        </div>

        {/* ═══════════════ HERO SECTION ═══════════════ */}
        <section class="relative min-h-screen flex items-center justify-center overflow-hidden bg-white">
          <div class="absolute inset-0 grid-bg" />
          <div class="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              class="parallax-slow absolute -top-40 -left-40 w-125 h-125 bg-blue-500/4 rounded-full blur-[100px]"
              style={{ animation: "float 8s ease-in-out infinite" }}
            />
            <div
              class="parallax-slow absolute -bottom-40 -right-40 w-150 h-150 bg-amber-400/4 rounded-full blur-[120px]"
              style={{ animation: "float 10s ease-in-out infinite 2s" }}
            />
            <div
              class="parallax-slow absolute top-1/4 right-1/3 w-75 h-75 bg-blue-400/3 rounded-full blur-[80px]"
              style={{ animation: "float 7s ease-in-out infinite 1s" }}
            />
          </div>

          <div class="relative z-10 w-full max-w-6xl mx-auto px-6 lg:px-8 text-center pt-24 pb-16">
            <div class="hero-badge inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-200/60 bg-white/80 backdrop-blur-sm mb-8 shadow-sm">
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span class="text-sm font-medium text-gray-700">Live on XRP Ledger & Xahau</span>
            </div>

            <h1 class="mb-6">
              <span class="hero-title-line block text-6xl sm:text-7xl lg:text-[8rem] font-black bg-linear-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent leading-[0.9] tracking-tighter">
                {"{XRPL}"}OS
              </span>
              <span class="hero-title-line block text-2xl sm:text-3xl lg:text-4xl font-light text-gray-500 mt-4 tracking-wide">
                The Pulse of the{" "}
                <span class="font-semibold bg-linear-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                  XRP Ecosystem
                </span>
              </span>
            </h1>

            <p class="hero-subtitle text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-12 font-light leading-relaxed">
              Your one-stop interface for live stats, trading, and direct ledger
              interaction across XRP Ledger and Xahau — all wallets, one platform.
            </p>

            <div class="hero-price-block inline-flex flex-col sm:flex-row items-center gap-6 sm:gap-10 bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-2xl px-8 py-6 shadow-lg shadow-gray-200/50">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center shadow-lg">
                  <svg viewBox="0 0 100 100" class="w-7 h-7" fill="none">
                    <path d="M25 22L50 40M75 22L50 40M25 78L50 60M75 78L50 60" stroke="white" stroke-width="6" stroke-linecap="round" />
                  </svg>
                </div>
                <div class="text-left">
                  <div class="text-xs text-gray-400 font-medium uppercase tracking-wider">XRP / USD</div>
                  <div class="flex items-baseline gap-2">
                    <span class="text-3xl font-bold text-gray-900 tabular-nums">${xrpPrice.value.toFixed(4)}</span>
                    <span class={`text-sm font-semibold ${xrpChange.value >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {xrpChange.value >= 0 ? "+" : ""}{xrpChange.value.toFixed(2)}%
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
                  <div class="text-xs text-gray-400 font-medium uppercase tracking-wider">XAH / USD</div>
                  <div class="flex items-baseline gap-2">
                    <span class="text-3xl font-bold text-gray-900 tabular-nums">${xahauPrice.value.toFixed(4)}</span>
                    <span class={`text-sm font-semibold ${xahauChange.value >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {xahauChange.value >= 0 ? "+" : ""}{xahauChange.value.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
              <a href="/dashboard" class="hero-cta group relative px-8 py-3.5 bg-gray-900 text-white font-semibold rounded-xl shadow-xl shadow-gray-900/20 hover:shadow-2xl hover:shadow-gray-900/30 transition-all duration-300 hover:-translate-y-0.5">
                Launch Dashboard
                <span class="inline-block ml-2 transition-transform group-hover:translate-x-1">→</span>
              </a>
              <a href="/search" class="hero-cta px-8 py-3.5 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                Explore Ledger
              </a>
            </div>
          </div>

          <div class="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
            <span class="text-xs text-gray-500 font-medium tracking-widest uppercase">Scroll</span>
            <div class="w-5 h-8 rounded-full border-2 border-gray-400 flex items-start justify-center p-1">
              <div class="w-1 h-2 bg-gray-400 rounded-full animate-bounce" />
            </div>
          </div>
        </section>

        {/* LIVE TICKER BAR */}
        <section class="relative bg-gray-50/80 border-y border-gray-100 py-4 overflow-hidden">
          <div class="flex overflow-hidden">
            <div class="ticker-track">
              {[...tokens.list, ...tokens.list].map((t, i) => (
                <div key={i} class="flex items-center gap-3 px-4 shrink-0">
                  <span class="font-bold text-gray-900 text-sm">{t.symbol}</span>
                  <span class="text-gray-500 text-sm tabular-nums">
                    ${t.price < 0.01 ? t.price.toFixed(5) : t.price.toFixed(3)}
                  </span>
                  <span class={`text-xs font-semibold ${t.change24h >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {t.change24h >= 0 ? "\u25B2" : "\u25BC"} {Math.abs(t.change24h).toFixed(1)}%
                  </span>
                  <div class="w-16">
                    <Sparkline data={t.sparkline} color={t.change24h >= 0 ? "#22c55e" : "#ef4444"} width={64} height={20} />
                  </div>
                  {i < tokens.list.length * 2 - 1 && <span class="text-gray-200 ml-2">|</span>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* LIVE NETWORK INTELLIGENCE */}
        <section class="py-20 px-6 lg:px-8 bg-white">
          <div class="max-w-7xl mx-auto">
            <div class="text-center mb-10 reveal-up">
              <h2 class="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                Live Network{" "}
                <span class="bg-linear-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">Intelligence</span>
              </h2>
              <p class="text-lg text-gray-500 max-w-xl mx-auto font-light">Real-time metrics from the XRP Ledger mainnet</p>
            </div>

            {/* Bloomberg-Style Horizontal Stats Bar */}
            <div class="bloomberg-bar bg-gray-900 rounded-2xl px-5 py-3.5 mb-6 shadow-xl shadow-gray-900/10 border border-gray-800">
              <div class="bloomberg-bar-inner flex items-center justify-between gap-3 overflow-x-auto scrollbar-thin">
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Quorum</span>
                  <span class="text-sm font-bold text-green-400 tabular-nums">{ledgerStats.quorum}</span>
                </div>
                <div class="bloomberg-stat-separator" />
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Avg. Txn. Fee</span>
                  <XrpLogo size={12} color="#9ca3af" />
                  <span class="text-sm font-bold text-white tabular-nums">{ledgerStats.avgTxnFee.toFixed(7)}</span>
                </div>
                <div class="bloomberg-stat-separator" />
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Avg. Ledger Interval</span>
                  <span class="text-sm font-bold text-blue-400 tabular-nums">{ledgerStats.avgLedgerInterval.toFixed(3)}sec</span>
                </div>
                <div class="bloomberg-stat-separator" />
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Avg. Txn/Ledger</span>
                  <span class="text-sm font-bold text-amber-400 tabular-nums">{ledgerStats.avgTxnPerLedger.toFixed(2)}</span>
                </div>
                <div class="bloomberg-stat-separator" />
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Txn/Sec</span>
                  <span class="text-sm font-bold text-purple-400 tabular-nums">{ledgerStats.tps.toFixed(2)}</span>
                </div>
                <div class="bloomberg-stat-separator" />
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Load Fee</span>
                  <XrpLogo size={12} color="#9ca3af" />
                  <span class="text-sm font-bold text-red-400 tabular-nums">{ledgerStats.loadFee.toFixed(5)}</span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0 ml-auto pl-3">
                  <span class="relative flex h-2 w-2">
                    <span class={`animate-ping absolute inline-flex h-full w-full rounded-full ${wsConnected.value ? "bg-green-400" : "bg-yellow-400"} opacity-75`} />
                    <span class={`relative inline-flex rounded-full h-2 w-2 ${wsConnected.value ? "bg-green-500" : "bg-yellow-500"}`} />
                  </span>
                  <span class="text-[10px] text-gray-500 font-medium">LIVE</span>
                </div>
              </div>
            </div>

            {/* Live Ledger Ticker Cards */}
            <div class="ledger-ticker-section bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div class="border-b border-gray-100 px-5 py-3 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="relative flex h-2 w-2">
                    <span class={`animate-ping absolute inline-flex h-full w-full rounded-full ${wsConnected.value ? "bg-green-400" : "bg-yellow-400"} opacity-75`} />
                    <span class={`relative inline-flex rounded-full h-2 w-2 ${wsConnected.value ? "bg-green-500" : "bg-yellow-500"}`} />
                  </span>
                  <span class="text-sm font-semibold text-gray-700">Live Ledger Feed</span>
                  {isPaused.value && (
                    <span class="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">PAUSED</span>
                  )}
                </div>
                <div class="flex items-center gap-3">
                  <button onClick$={() => { isPaused.value = !isPaused.value; }} class="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors">
                    {isPaused.value ? "\u25B6 Resume" : "\u23F8 Pause"}
                  </button>
                  <span class="text-xs text-gray-400 tabular-nums font-mono">{ledgerCards.list.length} ledgers</span>
                </div>
              </div>
              <div class="overflow-x-auto scrollbar-thin py-4 px-4">
                <div class="flex gap-3" style={{ minWidth: "max-content" }}>
                  {ledgerCards.list.length === 0 && (
                    <div class="flex items-center justify-center py-6 text-gray-300 w-full">
                      <div class="w-6 h-6 border-2 border-gray-200 border-t-blue-400 rounded-full animate-spin mr-3" />
                      <span class="text-sm">Waiting for ledgers...</span>
                    </div>
                  )}
                  {ledgerCards.list.map((ledger, i) => (
                    <button key={`${ledger.ledgerIndex}-${i}`} onClick$={() => openLedgerModal(ledger)} class="shrink-0 group bg-white hover:bg-blue-50/50 border border-gray-100 hover:border-blue-200 rounded-xl px-4 py-3 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md text-left" style={{ minWidth: "180px" }}>
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-bold text-gray-900 tabular-nums group-hover:text-blue-600 transition-colors">#{ledger.ledgerIndex.toLocaleString()}</span>
                        <span class="text-[10px] text-gray-400 tabular-nums font-mono">{new Date(ledger.closeTime).toISOString().slice(11, 19)} UTC</span>
                      </div>
                      <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div>
                          <div class="text-[9px] text-gray-400 uppercase tracking-wider">Txn Count</div>
                          <div class="text-xs font-semibold text-gray-700 tabular-nums">{ledger.txnCount}</div>
                        </div>
                        <div>
                          <div class="text-[9px] text-gray-400 uppercase tracking-wider">Total Fee</div>
                          <div class="text-xs font-semibold text-gray-700 tabular-nums flex items-center gap-0.5">
                            <XrpLogo size={8} color="#374151" />{ledger.totalFee.toFixed(5)}
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

        {/* DEX CHART (Full Width) */}
        <section class="py-20 px-6 lg:px-8 bg-linear-to-b from-white to-gray-50/50">
          <div class="max-w-7xl mx-auto">
            <div class="reveal-up group relative bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden p-6" style={{ minHeight: "480px" }}>
              <div class="flex items-center justify-between mb-6">
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <div class="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center">
                      <svg viewBox="0 0 100 100" class="w-3.5 h-3.5" fill="none">
                        <path d="M25 22L50 40M75 22L50 40M25 78L50 60M75 78L50 60" stroke="white" stroke-width="8" stroke-linecap="round" />
                      </svg>
                    </div>
                    <span class="font-bold text-gray-900">XRP / USD</span>
                    <span class="text-xs text-gray-400 font-light">DEX</span>
                  </div>
                  <div class="flex items-baseline gap-2">
                    <span class="text-2xl font-bold text-gray-900 tabular-nums">${xrpPrice.value.toFixed(4)}</span>
                    <span class={`text-sm font-semibold ${xrpChange.value >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {xrpChange.value >= 0 ? "+" : ""}{xrpChange.value.toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div class="flex gap-1">
                  {["1H", "4H", "1D", "1W"].map((tf) => (
                    <button key={tf} class={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${tf === "1D" ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"}`}>{tf}</button>
                  ))}
                </div>
              </div>
              <div class="flex-1" style={{ height: "360px" }}>
                <canvas ref={chartCanvasRef} class="w-full h-full" style={{ width: "100%", height: "100%" }} />
              </div>
              <div class="flex items-center justify-between mt-4 text-xs text-gray-400">
                <span>Vol: {xrpVolume.value}</span>
                <span>MCap: {xrpMarketCap.value}</span>
              </div>
            </div>
          </div>
        </section>

        {/* TOP DEX TOKENS */}
        <section class="py-20 px-6 lg:px-8 bg-white">
          <div class="max-w-7xl mx-auto">
            <div class="flex items-end justify-between mb-10 reveal-up">
              <div>
                <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">Top DEX Tokens</h2>
                <p class="text-gray-500 mt-2 font-light">Highest market cap on the XRP Ledger DEX</p>
              </div>
              <a href="/search" class="hidden sm:flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">View all <span>&rarr;</span></a>
            </div>
            <div class="token-table bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div class="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-50">
                <div class="col-span-1">#</div>
                <div class="col-span-3">Token</div>
                <div class="col-span-2 text-right">Price</div>
                <div class="col-span-2 text-right">24h Change</div>
                <div class="col-span-2 text-right hidden sm:block">Market Cap</div>
                <div class="col-span-2 text-right hidden md:block">Chart (24h)</div>
              </div>
              {tokens.list.map((token, idx) => (
                <div key={idx} class="token-row grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-gray-50/80 last:border-0 cursor-pointer">
                  <div class="col-span-1 text-sm text-gray-400 font-medium tabular-nums">{idx + 1}</div>
                  <div class="col-span-3 flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-linear-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">{token.symbol.slice(0, 2)}</div>
                    <div>
                      <div class="font-semibold text-gray-900 text-sm">{token.symbol}</div>
                      <div class="text-xs text-gray-400">{token.name}</div>
                    </div>
                  </div>
                  <div class="col-span-2 text-right font-medium text-gray-900 text-sm tabular-nums">${token.price < 0.01 ? token.price.toFixed(5) : token.price.toFixed(4)}</div>
                  <div class={`col-span-2 text-right text-sm font-semibold tabular-nums ${token.change24h >= 0 ? "text-green-500" : "text-red-500"}`}>{token.change24h >= 0 ? "+" : ""}{token.change24h.toFixed(2)}%</div>
                  <div class="col-span-2 text-right text-sm text-gray-500 hidden sm:block">{token.marketCap}</div>
                  <div class="col-span-2 hidden md:flex justify-end">
                    <Sparkline data={token.sparkline} color={token.change24h >= 0 ? "#22c55e" : "#ef4444"} width={100} height={32} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* LIVE TRANSACTION GLOBE (CSS/HTML) */}
        <section class="py-20 px-6 lg:px-8 bg-linear-to-b from-white to-gray-50/50">
          <div class="max-w-7xl mx-auto">
            <div class="text-center mb-12 reveal-up">
              <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                Live Transaction{" "}
                <span class="bg-linear-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">Stream</span>
              </h2>
              <p class="text-gray-500 mt-2 font-light">Validated transactions flowing through the XRP Ledger in real-time</p>
            </div>

            <div class="globe-section-wrapper reveal-up relative rounded-3xl overflow-hidden bg-[#080816] shadow-2xl" style={{ minHeight: "560px" }}>
              {/* Globe Container */}
              <div class="flex items-center justify-center py-12 relative">
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div class="w-[400px] h-[400px] bg-blue-500/8 rounded-full blur-[80px]" />
                </div>
                <div class="css-globe relative z-10" style={{ width: "360px", height: "360px" }}>
                  <div class="css-globe-sphere">
                    <div class="globe-atmosphere" />
                    <div class="globe-highlight" />
                    {[0, 30, 60, 90, 120, 150].map((deg) => (
                      <div key={`lng-${deg}`} class="globe-grid-line" style={{ transform: `rotateY(${deg}deg)` }} />
                    ))}
                    {[-60, -30, 0, 30, 60].map((lat, i) => (
                      <div key={`lat-${i}`} class="globe-lat" style={{
                        width: `${Math.cos((lat * Math.PI) / 180) * 100}%`,
                        height: `${Math.cos((lat * Math.PI) / 180) * 100}%`,
                        top: `${50 - (Math.sin((lat * Math.PI) / 180) * 50)}%`,
                        transform: "translateX(-50%) translateY(-50%) rotateX(75deg)",
                      }} />
                    ))}
                    <svg class="absolute inset-0 w-full h-full" viewBox="0 0 340 340" style={{ transform: "rotateY(0deg)" }}>
                      {globeArcs.list.slice(-20).map((arc) => {
                        const r = 140;
                        const cx = 170;
                        const cy = 170;
                        const x1 = cx + r * Math.cos((arc.startAngle * Math.PI) / 180) * 0.85;
                        const y1 = cy + r * Math.sin((arc.startAngle * Math.PI) / 180) * 0.85;
                        const x2 = cx + r * Math.cos((arc.endAngle * Math.PI) / 180) * 0.85;
                        const y2 = cy + r * Math.sin((arc.endAngle * Math.PI) / 180) * 0.85;
                        const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * 40;
                        const midY = (y1 + y2) / 2 - 30 - Math.random() * 30;
                        return (
                          <g key={arc.id}>
                            <path d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`} fill="none" stroke={arc.color} stroke-width="1.5" stroke-dasharray="200" opacity="0.6" style={{ animation: `arc-travel ${2 + Math.random() * 2}s ease-in-out forwards` }} />
                            <circle cx={x1} cy={y1} r="2.5" fill={arc.color} opacity="0.8"><animate attributeName="r" values="2;4;2" dur="2s" repeatCount="indefinite" /></circle>
                            <circle cx={x2} cy={y2} r="2" fill={arc.color} opacity="0.5" />
                          </g>
                        );
                      })}
                      {Array.from({ length: 18 }).map((_, i) => {
                        const angle = (i / 18) * 360;
                        const radiusVar = 100 + (i % 3) * 25;
                        const x = 170 + radiusVar * Math.cos((angle * Math.PI) / 180);
                        const y = 170 + radiusVar * Math.sin((angle * Math.PI) / 180);
                        return (
                          <circle key={`node-${i}`} cx={x} cy={y} r="1.5" fill={i % 3 === 0 ? "#3b82f6" : i % 3 === 1 ? "#10b981" : "#8b5cf6"} opacity="0.4">
                            <animate attributeName="opacity" values="0.2;0.7;0.2" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
                          </circle>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              </div>

              {/* Top badges */}
              <div class="absolute top-5 left-5 z-20 flex items-center gap-2 bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                <span class="relative flex h-2 w-2">
                  <span class={`animate-ping absolute inline-flex h-full w-full rounded-full ${wsConnected.value ? "bg-green-400" : "bg-yellow-400"} opacity-75`} />
                  <span class={`relative inline-flex rounded-full h-2 w-2 ${wsConnected.value ? "bg-green-500" : "bg-yellow-500"}`} />
                </span>
                <span class="text-xs font-medium text-white/70">Live Transactions</span>
              </div>
              <div class="absolute top-5 right-5 z-20 text-xs font-mono text-white/40 bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">XRPL Mainnet</div>

              {/* Glassmorphic Bottom Info Card Overlay */}
              <div class="absolute bottom-0 left-0 right-0 z-20">
                <div class="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
                  <div class="px-5 py-3 border-b border-white/5">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-semibold text-white/80">Transaction Flow</span>
                        <span class="text-[10px] bg-white/10 text-white/50 px-2 py-0.5 rounded-full tabular-nums">{globeTxCount.value.toLocaleString()} total</span>
                      </div>
                      <div class="flex items-center gap-3 text-[10px] text-white/40">
                        <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-blue-500" /> Payment</span>
                        <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-amber-500" /> DEX</span>
                        <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-purple-500" /> TrustSet</span>
                        <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-green-500" /> Other</span>
                      </div>
                    </div>
                  </div>
                  <div class="divide-y divide-white/5 max-h-36 overflow-y-auto scrollbar-thin">
                    {liveTxs.list.slice(0, 6).map((tx, i) => (
                      <div key={i} class="flex items-center gap-3 px-5 py-2 hover:bg-white/5 transition-colors">
                        <div class={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0 ${
                          tx.type === "Payment" ? "bg-blue-500/20 text-blue-400" :
                          tx.type === "OfferCreate" ? "bg-amber-500/20 text-amber-400" :
                          tx.type === "TrustSet" ? "bg-purple-500/20 text-purple-400" :
                          "bg-green-500/20 text-green-400"
                        }`}>
                          {tx.type === "Payment" ? "PAY" : tx.type === "OfferCreate" ? "DEX" : tx.type === "TrustSet" ? "TL" : tx.type.slice(0, 3).toUpperCase()}
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <span class="text-xs font-medium text-white/80">{tx.type}</span>
                            <span class="text-[10px] font-mono text-white/30">{tx.hash}</span>
                          </div>
                          <div class="flex items-center gap-1 text-[10px] text-white/30 mt-0.5">
                            <span class="font-mono">{tx.from}</span>
                            <span class="text-blue-400/60">&rarr;</span>
                            <span class="font-mono">{tx.to}</span>
                          </div>
                        </div>
                        <div class="text-right shrink-0">
                          <div class="text-xs font-semibold text-white/80 tabular-nums">{tx.amount}</div>
                          <div class="text-[9px] text-white/30 tabular-nums flex items-center justify-end gap-0.5">Fee: <XrpLogo size={7} color="rgba(255,255,255,0.3)" />{tx.fee}</div>
                        </div>
                      </div>
                    ))}
                    {liveTxs.list.length === 0 && (
                      <div class="flex items-center justify-center py-6">
                        <div class="w-5 h-5 border-2 border-white/10 border-t-blue-400/50 rounded-full animate-spin mr-2" />
                        <span class="text-xs text-white/30">Connecting to ledger...</span>
                      </div>
                    )}
                  </div>
                  <div class="px-5 py-2 border-t border-white/5 flex items-center justify-between text-[10px] text-white/30">
                    <span>Ledger #{ledgerStats.ledgerIndex.toLocaleString()}</span>
                    <span>{ledgerStats.tps.toFixed(1)} TPS</span>
                    <span class="font-mono">wss://xrplcluster.com</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TWO NETWORKS */}
        <section class="py-24 px-6 lg:px-8 bg-white">
          <div class="max-w-7xl mx-auto">
            <div class="text-center mb-16 reveal-up">
              <h2 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight">
                Two Networks.
                <span class="bg-linear-to-r from-blue-600 to-amber-500 bg-clip-text text-transparent"> One Platform.</span>
              </h2>
              <p class="text-lg text-gray-500 max-w-2xl mx-auto mt-4 font-light">Seamlessly interact with multiple blockchain networks through a single, unified interface</p>
            </div>
            <div class="grid md:grid-cols-2 gap-6 stagger-group">
              <div class="stagger-item tilt-card group relative bg-white rounded-3xl p-8 lg:p-10 border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 overflow-hidden" style={{ transformStyle: "preserve-3d" }}>
                <div class="absolute inset-0 bg-linear-to-br from-blue-500/0 to-blue-600/0 group-hover:from-blue-500/3 group-hover:to-blue-600/3 transition-all duration-700" />
                <div class="relative z-10">
                  <div class="flex items-center gap-3 mb-6">
                    <div class="w-12 h-12 rounded-2xl bg-gray-900 flex items-center justify-center shadow-lg">
                      <svg viewBox="0 0 100 100" class="w-6 h-6" fill="none"><path d="M25 22L50 40M75 22L50 40M25 78L50 60M75 78L50 60" stroke="white" stroke-width="6" stroke-linecap="round" /></svg>
                    </div>
                    <div>
                      <h3 class="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">XRP Ledger</h3>
                      <span class="text-xs text-gray-400 font-medium uppercase tracking-wider">Layer 1 Blockchain</span>
                    </div>
                  </div>
                  <p class="text-gray-600 leading-relaxed font-light mb-6">The XRP Ledger is a decentralized, open-source blockchain powering fast, low-cost, energy-efficient transactions. Built-in DEX, tokenization, NFTs, and cross-border payments - all settling in 3-5 seconds.</p>
                  <div class="flex flex-wrap gap-2">
                    {["DEX", "Payments", "NFTs", "AMM", "Escrow", "Oracles", "DID"].map((tag) => (
                      <span key={tag} class="px-3 py-1 text-xs font-medium text-gray-500 bg-gray-50 rounded-full border border-gray-100">{tag}</span>
                    ))}
                  </div>
                </div>
                <div class="absolute bottom-0 left-0 w-full h-1 bg-linear-to-r from-blue-500 to-blue-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left" />
              </div>
              <div class="stagger-item tilt-card group relative bg-white rounded-3xl p-8 lg:p-10 border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-500 overflow-hidden" style={{ transformStyle: "preserve-3d" }}>
                <div class="absolute inset-0 bg-linear-to-br from-amber-500/0 to-orange-600/0 group-hover:from-amber-500/3 group-hover:to-orange-600/3 transition-all duration-700" />
                <div class="relative z-10">
                  <div class="flex items-center gap-3 mb-6">
                    <div class="w-12 h-12 rounded-2xl bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg"><span class="text-white font-bold text-xl">X</span></div>
                    <div>
                      <h3 class="text-2xl font-bold text-gray-900 group-hover:text-amber-600 transition-colors">Xahau</h3>
                      <span class="text-xs text-gray-400 font-medium uppercase tracking-wider">Layer 1 + Hooks</span>
                    </div>
                  </div>
                  <p class="text-gray-600 leading-relaxed font-light mb-6">Xahau Network is a Layer 1 blockchain built on the XRPL codebase, adding smart-contract-like functionality through Hooks - small, efficient pieces of on-chain logic that automate account behavior and enable programmable money.</p>
                  <div class="flex flex-wrap gap-2">
                    {["Hooks", "Rewards", "Import", "Smart Logic", "B2M", "Governance"].map((tag) => (
                      <span key={tag} class="px-3 py-1 text-xs font-medium text-gray-500 bg-gray-50 rounded-full border border-gray-100">{tag}</span>
                    ))}
                  </div>
                </div>
                <div class="absolute bottom-0 left-0 w-full h-1 bg-linear-to-r from-amber-500 to-orange-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left" />
              </div>
            </div>
          </div>
        </section>

        {/* WALLET INTEGRATIONS */}
        <section class="py-24 px-6 lg:px-8 bg-linear-to-b from-gray-50/50 to-white">
          <div class="max-w-7xl mx-auto">
            <div class="text-center mb-16 reveal-up">
              <h2 class="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">Connect Your{" "}<span class="bg-linear-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">Wallet</span></h2>
              <p class="text-lg text-gray-500 max-w-xl mx-auto mt-4 font-light">All major XRPL wallets supported - interact directly with both ledgers</p>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 stagger-group max-w-4xl mx-auto">
              {[
                { name: "Xaman", desc: "Mobile & Desktop", icon: "\uD83D\uDD10", color: "from-blue-500 to-blue-600" },
                { name: "GemWallet", desc: "Browser Extension", icon: "\uD83D\uDC8E", color: "from-purple-500 to-purple-600" },
                { name: "Crossmark", desc: "Browser Extension", icon: "\u2715", color: "from-gray-700 to-gray-900" },
                { name: "Ledger", desc: "Hardware Wallet", icon: "\uD83D\uDD12", color: "from-gray-600 to-gray-800" },
                { name: "WalletConnect", desc: "Multi-Wallet", icon: "\uD83D\uDD17", color: "from-blue-400 to-blue-500" },
              ].map((wallet) => (
                <div key={wallet.name} class="stagger-item tilt-card group flex flex-col items-center gap-3 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-500 cursor-pointer" style={{ transformStyle: "preserve-3d" }}>
                  <div class={`w-14 h-14 rounded-2xl bg-linear-to-br ${wallet.color} flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>{wallet.icon}</div>
                  <div class="text-center">
                    <div class="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">{wallet.name}</div>
                    <div class="text-xs text-gray-400 mt-0.5">{wallet.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES GRID */}
        <section class="py-24 px-6 lg:px-8 bg-white">
          <div class="max-w-7xl mx-auto">
            <div class="text-center mb-16 reveal-up">
              <h2 class="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">Built for{" "}<span class="bg-linear-to-r from-blue-600 to-amber-500 bg-clip-text text-transparent">Everything</span></h2>
              <p class="text-lg text-gray-500 max-w-xl mx-auto mt-4 font-light">Every tool you need, all in one place</p>
            </div>
            <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-group">
              {[
                { icon: "\uD83E\uDE99", title: "Token Issuance", desc: "Launch and manage fungible tokens, stablecoins, and community currencies directly on-chain" },
                { icon: "\uD83D\uDCB1", title: "On-Chain DEX", desc: "Trade natively on the XRPL decentralized exchange with limit orders, AMM pools, and instant swaps" },
                { icon: "\uD83D\uDDBC\uFE0F", title: "NFT Studio", desc: "Mint, trade, and manage NFTs with built-in marketplace integration and royalty enforcement" },
                { icon: "\u26A1", title: "Instant Payments", desc: "Send cross-border payments settling in 3-5 seconds with near-zero fees" },
                { icon: "\uD83D\uDD10", title: "Escrow & Checks", desc: "Time-locked escrows, conditional payments, and on-chain check issuance" },
                { icon: "\uD83D\uDCCA", title: "Oracle Integration", desc: "Access price feeds and off-chain data through the native Oracle amendment" },
                { icon: "\uD83C\uDF09", title: "Cross-Chain Bridge", desc: "Move assets between XRPL and Xahau with native XChain bridge transactions" },
                { icon: "\uD83E\uDE9D", title: "Hooks (Xahau)", desc: "Deploy lightweight smart contracts that trigger on transaction events automatically" },
                { icon: "\uD83C\uDD94", title: "Decentralized Identity", desc: "Set up and manage on-chain DID documents and verifiable credentials" },
              ].map((feature) => (
                <div key={feature.title} class="stagger-item tilt-card group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-500" style={{ transformStyle: "preserve-3d" }}>
                  <div class="text-3xl mb-4 group-hover:scale-110 transition-transform duration-300 inline-block">{feature.icon}</div>
                  <h3 class="font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">{feature.title}</h3>
                  <p class="text-sm text-gray-500 leading-relaxed font-light">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PHILOSOPHY / CTA */}
        <section class="py-24 px-6 lg:px-8 bg-linear-to-b from-white to-gray-50/50">
          <div class="max-w-4xl mx-auto reveal-up">
            <div class="relative bg-linear-to-br from-gray-900 to-gray-800 rounded-3xl p-10 lg:p-14 overflow-hidden shadow-2xl">
              <div class="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
              <div class="absolute bottom-0 left-0 w-60 h-60 bg-amber-500/10 rounded-full blur-[80px] pointer-events-none" />
              <div class="relative z-10">
                <span class="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 border border-white/10 text-white/80 text-xs font-semibold rounded-full mb-6 backdrop-blur-sm">
                  Our Philosophy
                </span>
                <h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight tracking-tight">Designed for Sovereignty</h2>
                <p class="text-gray-300 text-lg leading-relaxed font-light mb-8 max-w-2xl">
                  Every action in {"{XRPL}"}OS is explicit and intentional. Transactions are grouped by purpose - Create, Set, Claim, Deposit, Cancel - so you always understand exactly what you're signing. No hidden state. No dark UX patterns. Full transparency, total control.
                </p>
                <div class="flex flex-col sm:flex-row gap-4">
                  <a href="/dashboard" class="group inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-gray-900 font-semibold rounded-xl hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl">
                    Get Started <span class="inline-block transition-transform group-hover:translate-x-1">&rarr;</span>
                  </a>
                  <a href="/search" class="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/10 text-white font-semibold rounded-xl border border-white/10 hover:bg-white/20 transition-all duration-300 backdrop-blur-sm">Explore Ledger</a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer class="bg-white text-gray-600 border-t border-gray-100">
          <div class="max-w-7xl mx-auto px-6 lg:px-8 py-16">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12 mb-12">
              <div class="lg:col-span-2">
                <div class="mb-4">
                  <a href="/" class="text-2xl font-bold bg-linear-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent hover:opacity-80 transition-opacity" aria-label="logo">{"{XRPL}"}OS</a>
                </div>
                <p class="text-gray-500 mb-6 text-sm leading-relaxed font-light">The one-stop operating system for the XRP Ledger and Xahau ecosystem. Create, manage, and trade digital assets with sovereignty and security at its core.</p>
                <div class="flex gap-3">
                  {[
                    { name: "Twitter", path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" },
                    { name: "GitHub", path: "M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" },
                    { name: "Discord", path: "M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286z" },
                  ].map((social) => (
                    <a key={social.name} href="#" target="_blank" class="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all duration-300" aria-label={social.name}>
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d={social.path} /></svg>
                    </a>
                  ))}
                </div>
              </div>
              {[
                { title: "Products", links: ["Dashboard", "Explorer", "DEX", "NFT Studio", "Token Tools"] },
                { title: "Developers", links: ["Documentation", "API Reference", "Hooks SDK", "GitHub"] },
                { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
                { title: "Legal", links: ["Terms of Service", "Privacy Policy", "Cookie Settings"] },
              ].map((section) => (
                <div key={section.title}>
                  <h3 class="text-gray-900 font-semibold text-xs uppercase tracking-widest mb-4">{section.title}</h3>
                  <nav class="flex flex-col gap-2.5">
                    {section.links.map((link) => (
                      <a key={link} href="#" class="text-gray-500 hover:text-blue-600 transition-colors text-sm font-light">{link}</a>
                    ))}
                  </nav>
                </div>
              ))}
            </div>
            <div class="border-t border-gray-100 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p class="text-gray-400 text-sm font-light">&copy; 2025 - Product of{" "}<a href="https://nrdxlab.com" class="text-gray-600 hover:text-blue-600 transition-colors">{"{NRDX}"}Labs</a>. All rights reserved.</p>
              <div class="flex gap-6">
                <a href="#" class="text-gray-400 hover:text-blue-600 text-sm transition-colors font-light">Status</a>
                <a href="#" class="text-gray-400 hover:text-blue-600 text-sm transition-colors font-light">Changelog</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  });

export const head: DocumentHead = {
  title: "{XRPL}OS \u2014 The Pulse of the XRP Ecosystem",
  meta: [
    {
      name: "description",
      content: "The one-stop operating system for the XRP Ledger and Xahau ecosystem. Live stats, DEX trading, token management, and direct ledger interaction - all wallets, one platform. Built by {NRDX}Labs.",
    },
  ],
};

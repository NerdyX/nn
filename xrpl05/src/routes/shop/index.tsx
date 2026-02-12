// src/routes/shop/index.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Marketplace page — SSR-first with routeLoader$ for instant rendering.
// Uses D1 cache + multi-source data from marketplace-data library.
// ─────────────────────────────────────────────────────────────────────────────

import {
  component$,
  useSignal,
  useComputed$,
  useVisibleTask$,
  useTask$,
  $,
  type PropFunction,
} from "@builder.io/qwik";
import {
  type DocumentHead,
  routeLoader$,
  server$,
} from "@builder.io/qwik-city";
import { useNetworkContext, NETWORK_CONFIG } from "~/context/network-context";
import { useWalletContext } from "~/context/wallet-context";
import type {
  NftItem,
  TokenItem,
  SellOffer,
  BuyOffer,
  TokenChartData,
} from "~/lib/marketplace-data";

// ─── SSR Loaders — run on the server, data arrives with HTML ─────────────────

export const useTokenLoader = routeLoader$(async (requestEvent) => {
  const { loadTokens, getD1 } = await import("~/lib/marketplace-data");
  const db = getD1(requestEvent.platform as Record<string, any> | undefined);
  const network = (requestEvent.query.get("network") || "xrpl").toLowerCase();
  try {
    return await loadTokens(network, 100, db);
  } catch (err) {
    console.error("[shop/routeLoader$] token load failed:", err);
    return {
      success: false,
      network,
      type: "tokens" as const,
      count: 0,
      tokens: [] as TokenItem[],
      timestamp: new Date().toISOString(),
      xrpPriceUsd: 2.3,
    };
  }
});

export const useNftLoader = routeLoader$(async (requestEvent) => {
  const { loadNfts, getD1 } = await import("~/lib/marketplace-data");
  const db = getD1(requestEvent.platform as Record<string, any> | undefined);
  const network = (requestEvent.query.get("network") || "xrpl").toLowerCase();
  try {
    return await loadNfts(network, 50, db);
  } catch (err) {
    console.error("[shop/routeLoader$] nft load failed:", err);
    return {
      success: false,
      network,
      type: "nfts" as const,
      count: 0,
      nfts: [] as NftItem[],
      timestamp: new Date().toISOString(),
    };
  }
});

// ─── Server function for chart data (called on-demand from modal) ────────────

const fetchChartServer = server$(async function (
  network: string,
  currency: string,
  issuer: string,
): Promise<TokenChartData | null> {
  const { fetchTokenChartData } = await import("~/lib/marketplace-data");
  try {
    return await fetchTokenChartData(network, currency, issuer);
  } catch {
    return null;
  }
});

// ─── Server function for submitting Xaman transaction payloads ───────────────

const createXamanPayload = server$(async function (
  txjson: Record<string, unknown>,
): Promise<{
  success: boolean;
  uuid?: string;
  qrPng?: string;
  error?: string;
}> {
  try {
    const { Xumm } = await import("xumm");
    const apiKey =
      this.env.get("PUBLIC_XAMAN_API_KEY") ?? process.env.PUBLIC_XAMAN_API_KEY;
    const apiSecret =
      this.env.get("XAMAN_API_SECRET") ?? process.env.XAMAN_API_SECRET;

    if (!apiKey || !apiSecret) {
      return { success: false, error: "Missing Xaman API credentials" };
    }

    const xumm = new Xumm(apiKey, apiSecret);
    const appUrl = this.env.get("PUBLIC_APP_URL") ?? "http://localhost:5173";

    const payload = await xumm.payload?.create({
      txjson,
      options: {
        submit: true,
        return_url: {
          app: `${appUrl}/shop`,
          web: `${appUrl}/shop`,
        },
      },
    } as any);

    if (!payload) {
      return { success: false, error: "Failed to create payload" };
    }

    return {
      success: true,
      uuid: payload.uuid,
      qrPng: payload.refs.qr_png,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLACEHOLDER_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' fill='%23e5e7eb'%3E%3Crect width='300' height='300' rx='12'/%3E%3Ctext x='150' y='158' text-anchor='middle' font-family='sans-serif' font-size='40' fill='%239ca3af'%3ENFT%3C/text%3E%3C/svg%3E";

const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://nftstorage.link/ipfs/",
];

function resolveImageUrl(url: string): string {
  if (!url) return PLACEHOLDER_IMG;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("ipfs://")) return IPFS_GATEWAYS[0] + url.slice(7);
  if (url.startsWith("Qm") || url.startsWith("bafy"))
    return IPFS_GATEWAYS[0] + url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (/^[0-9a-fA-F]+$/.test(url) && url.length > 20) {
    try {
      let decoded = "";
      for (let i = 0; i < url.length; i += 2) {
        const c = parseInt(url.substring(i, i + 2), 16);
        if (c) decoded += String.fromCharCode(c);
      }
      return resolveImageUrl(decoded);
    } catch {
      return PLACEHOLDER_IMG;
    }
  }
  return IPFS_GATEWAYS[0] + url;
}

function decodeCurrency(currency: string): string {
  if (!currency || currency.length <= 3) return currency;
  if (/^[0-9A-Fa-f]{40}$/.test(currency)) {
    try {
      const hex = currency.replace(/^0{2}/, "");
      let result = "";
      for (let i = 0; i < hex.length; i += 2) {
        const c = parseInt(hex.substring(i, i + 2), 16);
        if (c === 0) break;
        if (c >= 0x20 && c <= 0x7e) result += String.fromCharCode(c);
      }
      if (result) return result.trim();
    } catch {
      /* ignore */
    }
  }
  return currency;
}

function formatXrpAmount(
  amount: string | { value: string; currency: string; issuer: string },
  nativeCurrency: string,
): string {
  if (typeof amount === "string") {
    const xrp = Number(amount) / 1_000_000;
    return `${xrp.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${nativeCurrency}`;
  }
  const val = Number(amount.value);
  const cur = decodeCurrency(amount.currency);
  return `${val.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${cur}`;
}

function getLowestSellPrice(
  offers: SellOffer[],
  nativeCurrency: string,
): { raw: number; formatted: string } | null {
  if (!offers.length) return null;
  let lowest = Infinity;
  let formatted = "";
  for (const o of offers) {
    const val =
      typeof o.amount === "string"
        ? Number(o.amount) / 1_000_000
        : Number(o.amount.value);
    if (val < lowest) {
      lowest = val;
      formatted = formatXrpAmount(o.amount, nativeCurrency);
    }
  }
  return lowest === Infinity ? null : { raw: lowest, formatted };
}

function getHighestBuyPrice(
  offers: BuyOffer[],
  nativeCurrency: string,
): { raw: number; formatted: string } | null {
  if (!offers.length) return null;
  let highest = -Infinity;
  let formatted = "";
  for (const o of offers) {
    const val =
      typeof o.amount === "string"
        ? Number(o.amount) / 1_000_000
        : Number(o.amount.value);
    if (val > highest) {
      highest = val;
      formatted = formatXrpAmount(o.amount, nativeCurrency);
    }
  }
  return highest === -Infinity ? null : { raw: highest, formatted };
}

function formatSupply(supply: string): string {
  const n = Number(supply);
  if (isNaN(n)) return supply;
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatUsd(n: number): string {
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(2) + "K";
  if (n >= 1) return "$" + n.toFixed(2);
  if (n >= 0.001) return "$" + n.toFixed(4);
  if (n > 0) return "$" + n.toFixed(8);
  return "$0.00";
}

function truncAddr(addr: string): string {
  if (!addr || addr.length <= 14) return addr;
  return addr.slice(0, 6) + "\u2026" + addr.slice(-4);
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

/** NFT image with IPFS fallback */
const NftImage = component$<{
  src: string;
  alt: string;
  class?: string;
  style?: Record<string, string>;
}>(({ src, alt, style }) => {
  const imgSrc = useSignal(resolveImageUrl(src));
  const fallbackIdx = useSignal(0);
  const errored = useSignal(false);

  const handleError = $(() => {
    if (errored.value) return;
    const originalSrc = resolveImageUrl(src);
    if (originalSrc.includes("/ipfs/")) {
      const cid = originalSrc.split("/ipfs/").pop() || "";
      if (cid && fallbackIdx.value < IPFS_GATEWAYS.length - 1) {
        fallbackIdx.value++;
        imgSrc.value = IPFS_GATEWAYS[fallbackIdx.value] + cid;
        return;
      }
    }
    errored.value = true;
    imgSrc.value = PLACEHOLDER_IMG;
  });

  return (
    <img
      src={imgSrc.value}
      alt={alt}
      width={300}
      height={300}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
        ...style,
      }}
      loading="lazy"
      onError$={handleError}
    />
  );
});

/** NFT Card for marketplace grid */
const NftCard = component$<{
  nft: NftItem;
  nativeCurrency: string;
  onSelect$: PropFunction<(nft: NftItem) => void>;
}>(({ nft, nativeCurrency, onSelect$ }) => {
  const price = getLowestSellPrice(nft.sellOffers, nativeCurrency);
  const bestOffer = getHighestBuyPrice(nft.buyOffers, nativeCurrency);

  return (
    <div
      class="group cursor-pointer"
      style={{
        borderRadius: "16px",
        overflow: "hidden",
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.06)",
        transition: "all 0.3s ease",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
      onClick$={() => onSelect$(nft)}
    >
      <div
        style={{
          aspectRatio: "1",
          overflow: "hidden",
          background: "#f3f4f6",
          position: "relative",
        }}
      >
        <NftImage src={nft.image || nft.resolvedUri} alt={nft.name} />
        {nft.nftStandard && (
          <div
            style={{
              position: "absolute",
              top: "8px",
              left: "8px",
              background: nft.nftStandard === "XLS-20" ? "#2563eb" : "#f59e0b",
              color: "#fff",
              fontSize: "10px",
              fontWeight: "700",
              padding: "3px 8px",
              borderRadius: "6px",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {nft.nftStandard}
          </div>
        )}
        {nft.collection && (
          <div
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(8px)",
              color: "#fff",
              fontSize: "10px",
              fontWeight: "600",
              padding: "3px 8px",
              borderRadius: "6px",
              maxWidth: "120px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {nft.collection}
          </div>
        )}
        {price && (
          <div
            style={{
              position: "absolute",
              bottom: "8px",
              right: "8px",
              background: "rgba(37,99,235,0.9)",
              backdropFilter: "blur(8px)",
              color: "#fff",
              fontSize: "11px",
              fontWeight: "700",
              padding: "4px 10px",
              borderRadius: "8px",
            }}
          >
            {price.formatted}
          </div>
        )}
      </div>
      <div style={{ padding: "12px 14px 14px" }}>
        <div
          style={{
            fontSize: "14px",
            fontWeight: "600",
            color: "#111827",
            marginBottom: "4px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            letterSpacing: "-0.01em",
          }}
        >
          {nft.name || `NFT #${nft.serial}`}
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "#6b7280",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginBottom: "8px",
          }}
        >
          by {truncAddr(nft.issuer)}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "10px",
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {price ? "Price" : "Best Offer"}
            </div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: "700",
                color: price ? "#2563eb" : bestOffer ? "#059669" : "#9ca3af",
              }}
            >
              {price
                ? price.formatted
                : bestOffer
                  ? bestOffer.formatted
                  : "No offers"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: "10px",
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Offers
            </div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "#374151",
              }}
            >
              {nft.sellOffers.length + nft.buyOffers.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

/** Token row for the token explorer */
const TokenRow = component$<{
  token: TokenItem;
  index: number;
  sparkData: number[];
  onSelect$: PropFunction<(t: TokenItem) => void>;
}>(({ token, index, sparkData, onSelect$ }) => {
  return (
    <div
      class="group cursor-pointer"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px",
        borderRadius: "12px",
        background: index % 2 === 0 ? "rgba(0,0,0,0.01)" : "transparent",
        transition: "background 0.2s",
      }}
      onClick$={() => onSelect$(token)}
    >
      {/* Rank */}
      <div
        style={{
          width: "28px",
          fontSize: "13px",
          fontWeight: "600",
          color: "#9ca3af",
          textAlign: "center",
          flexShrink: "0",
        }}
      >
        {index + 1}
      </div>

      {/* Logo */}
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          flexShrink: "0",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        {token.logoUrl ? (
          <img
            src={token.logoUrl}
            alt={token.currencyDisplay}
            width={36}
            height={36}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "50%",
            }}
            loading="lazy"
          />
        ) : (
          <span
            style={{
              fontSize: "13px",
              fontWeight: "700",
              color: "#3b82f6",
            }}
          >
            {token.currencyDisplay.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      {/* Name & Issuer */}
      <div style={{ flex: "1", minWidth: "0" }}>
        <div
          style={{
            fontSize: "14px",
            fontWeight: "600",
            color: "#111827",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {token.currencyDisplay}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "#9ca3af",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {token.domain || truncAddr(token.issuer)}
        </div>
      </div>

      {/* Price */}
      <div
        style={{
          textAlign: "right",
          minWidth: "80px",
          flexShrink: "0",
        }}
      >
        <div style={{ fontSize: "11px", color: "#9ca3af" }}>Price</div>
        <div
          style={{
            fontSize: "13px",
            fontWeight: "600",
            color: "#111827",
          }}
        >
          {token.priceUsd ? formatUsd(token.priceUsd) : "\u2014"}
        </div>
      </div>

      {/* 24h Change */}
      <div
        class="hidden sm:block"
        style={{
          textAlign: "right",
          minWidth: "65px",
          flexShrink: "0",
        }}
      >
        <div style={{ fontSize: "11px", color: "#9ca3af" }}>24h</div>
        <div
          style={{
            fontSize: "13px",
            fontWeight: "600",
            color:
              token.change24h && token.change24h > 0
                ? "#10b981"
                : token.change24h && token.change24h < 0
                  ? "#ef4444"
                  : "#6b7280",
          }}
        >
          {token.change24h
            ? `${token.change24h > 0 ? "+" : ""}${token.change24h.toFixed(1)}%`
            : "\u2014"}
        </div>
      </div>

      {/* Sparkline */}
      <div
        class="hidden md:block"
        style={{ flexShrink: "0", minWidth: "80px" }}
      >
        {sparkData && sparkData.length > 2 ? (
          <MiniChart data={sparkData} width={80} height={28} />
        ) : (
          <div
            style={{
              width: "80px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "9px",
              color: "#d1d5db",
            }}
          >
            \u2014
          </div>
        )}
      </div>

      {/* Trustlines */}
      <div
        style={{
          textAlign: "right",
          minWidth: "70px",
          flexShrink: "0",
        }}
      >
        <div style={{ fontSize: "11px", color: "#9ca3af" }}>Trustlines</div>
        <div
          style={{
            fontSize: "13px",
            fontWeight: "600",
            color: "#111827",
          }}
        >
          {token.trustlines.toLocaleString()}
        </div>
      </div>
    </div>
  );
});

/** Mini SVG chart for token sparkline */
const MiniChart = component$<{
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}>(({ data, width = 120, height = 40, color }) => {
  if (!data || data.length < 2) {
    return (
      <div
        style={{
          width: width + "px",
          height: height + "px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "10px",
          color: "#9ca3af",
        }}
      >
        No data
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const isPositive = data[data.length - 1] >= data[0];
  const lineColor = color || (isPositive ? "#10b981" : "#ef4444");

  const points = data
    .map((v, i) => {
      const x = pad + ((width - 2 * pad) * i) / (data.length - 1);
      const y = height - pad - ((height - 2 * pad) * (v - min)) / range;
      return `${x},${y}`;
    })
    .join(" ");

  const fillPoints = `${pad},${height - pad} ${points} ${width - pad},${height - pad}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={`grad-${lineColor}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color={lineColor} stop-opacity="0.2" />
          <stop offset="100%" stop-color={lineColor} stop-opacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#grad-${lineColor})`} />
      <polyline
        points={points}
        fill="none"
        stroke={lineColor}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
});

/** Larger chart for detail modal */
const DetailChart = component$<{
  data: { time: number; value: number }[];
  width?: number;
  height?: number;
  change24h?: number;
}>(({ data, width = 560, height = 200, change24h }) => {
  if (!data || data.length < 2) {
    return (
      <div
        style={{
          width: "100%",
          height: height + "px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "13px",
          color: "#9ca3af",
          background: "rgba(0,0,0,0.02)",
          borderRadius: "12px",
        }}
      >
        Chart data unavailable
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 4;
  const isPositive = (change24h ?? 0) >= 0;
  const lineColor = isPositive ? "#10b981" : "#ef4444";

  const points = values
    .map((v, i) => {
      const x = pad + ((width - 2 * pad) * i) / (values.length - 1);
      const y = height - pad - ((height - 2 * pad) * (v - min)) / range;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const fillPoints = `${pad},${height - pad} ${points} ${width - pad},${height - pad}`;

  // Time labels
  const firstTime = data[0]?.time ?? 0;
  const lastTime = data[data.length - 1]?.time ?? 0;
  const midTime = (firstTime + lastTime) / 2;
  const fmt = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ display: "block", borderRadius: "12px" }}
      >
        <defs>
          <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color={lineColor} stop-opacity="0.15" />
            <stop offset="100%" stop-color={lineColor} stop-opacity="0" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} fill="rgba(0,0,0,0.02)" rx="12" />
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <line
            key={frac}
            x1={pad}
            y1={pad + (height - 2 * pad) * frac}
            x2={width - pad}
            y2={pad + (height - 2 * pad) * frac}
            stroke="rgba(0,0,0,0.05)"
            stroke-width="1"
            stroke-dasharray="4,4"
          />
        ))}
        <polygon points={fillPoints} fill="url(#chart-grad)" />
        <polyline
          points={points}
          fill="none"
          stroke={lineColor}
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        {/* Current price dot */}
        {values.length > 0 && (
          <circle
            cx={width - pad}
            cy={
              height -
              pad -
              ((height - 2 * pad) * (values[values.length - 1] - min)) / range
            }
            r="4"
            fill={lineColor}
            stroke="#fff"
            stroke-width="2"
          />
        )}
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "10px",
          color: "#9ca3af",
          marginTop: "6px",
          padding: "0 4px",
        }}
      >
        <span>{fmt(firstTime)}</span>
        <span>{fmt(midTime)}</span>
        <span>{fmt(lastTime)}</span>
      </div>
    </div>
  );
});

// ─── Action Buttons Component ─────────────────────────────────────────────────

const ActionButtons = component$<{
  token: TokenItem;
  walletAddress: string;
  walletType: string | null;
  network: string;
}>(({ token, walletAddress, walletType, network }) => {
  const txStatus = useSignal<"idle" | "pending" | "success" | "error">("idle");
  const txMessage = useSignal("");
  const showQr = useSignal(false);
  const qrImage = useSignal("");

  const handleTrustline = $(async () => {
    if (!walletAddress) {
      txMessage.value = "Connect a wallet first";
      txStatus.value = "error";
      return;
    }
    txStatus.value = "pending";
    txMessage.value = "Creating trustline request\u2026";

    const limitValue = "1000000000";
    const txjson: Record<string, unknown> = {
      TransactionType: "TrustSet",
      Account: walletAddress,
      LimitAmount: {
        currency: token.currency,
        issuer: token.issuer,
        value: limitValue,
      },
    };

    if (walletType === "xaman") {
      const result = await createXamanPayload(txjson);
      if (result.success && result.qrPng) {
        qrImage.value = result.qrPng;
        showQr.value = true;
        txStatus.value = "pending";
        txMessage.value = "Scan QR with Xaman to approve";
      } else {
        txStatus.value = "error";
        txMessage.value = result.error || "Failed to create payload";
      }
    } else {
      txStatus.value = "error";
      txMessage.value = "Trustline signing is only supported via Xaman wallet";
    }
  });

  const handleBuy = $(async () => {
    if (!walletAddress) {
      txMessage.value = "Connect a wallet first";
      txStatus.value = "error";
      return;
    }
    txStatus.value = "pending";

    const buyAmount = token.priceXrp
      ? String(Math.ceil(token.priceXrp * 1_000_000 * 1.02))
      : "1000000";

    const txjson: Record<string, unknown> = {
      TransactionType: "OfferCreate",
      Account: walletAddress,
      TakerPays: {
        currency: token.currency,
        issuer: token.issuer,
        value: "1",
      },
      TakerGets: buyAmount,
    };

    if (walletType === "xaman") {
      const result = await createXamanPayload(txjson);
      if (result.success && result.qrPng) {
        qrImage.value = result.qrPng;
        showQr.value = true;
        txMessage.value = "Scan QR with Xaman to buy";
      } else {
        txStatus.value = "error";
        txMessage.value = result.error || "Failed to create payload";
      }
    } else {
      txStatus.value = "error";
      txMessage.value = "Buy via Xaman wallet or use an external DEX";
    }
  });

  const handleSwap = $(() => {
    const displayName = decodeCurrency(token.currency);
    const dexUrls: Record<string, string> = {
      xrpl: `https://sologenic.org/trade?market=${encodeURIComponent(displayName)}%2BXRP&network=mainnet`,
      xahau: `https://xahau.dex.trade/`,
    };
    const url = dexUrls[network] || dexUrls.xrpl;
    window.open(url, "_blank", "noopener");
  });

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
        {/* + Trustline */}
        <button
          class="cursor-pointer"
          onClick$={handleTrustline}
          disabled={txStatus.value === "pending"}
          style={{
            flex: "1",
            padding: "10px 0",
            borderRadius: "12px",
            border: "1px solid rgba(37,99,235,0.3)",
            background: "rgba(37,99,235,0.06)",
            color: "#2563eb",
            fontSize: "13px",
            fontWeight: "700",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            transition: "all 0.2s",
          }}
        >
          <span style={{ fontSize: "16px" }}>+</span> Trustline
        </button>

        {/* Buy */}
        <button
          class="cursor-pointer"
          onClick$={handleBuy}
          disabled={txStatus.value === "pending"}
          style={{
            flex: "1",
            padding: "10px 0",
            borderRadius: "12px",
            border: "none",
            background: "#10b981",
            color: "#fff",
            fontSize: "13px",
            fontWeight: "700",
            transition: "all 0.2s",
          }}
        >
          Buy
        </button>

        {/* Swap */}
        <button
          class="cursor-pointer"
          onClick$={handleSwap}
          style={{
            flex: "1",
            padding: "10px 0",
            borderRadius: "12px",
            border: "1px solid rgba(124,58,237,0.3)",
            background: "rgba(124,58,237,0.06)",
            color: "#7c3aed",
            fontSize: "13px",
            fontWeight: "700",
            transition: "all 0.2s",
          }}
        >
          Swap
        </button>
      </div>

      {/* Status message */}
      {txMessage.value && (
        <div
          style={{
            marginTop: "10px",
            padding: "8px 12px",
            borderRadius: "10px",
            fontSize: "12px",
            background:
              txStatus.value === "error"
                ? "rgba(239,68,68,0.06)"
                : txStatus.value === "success"
                  ? "rgba(16,185,129,0.06)"
                  : "rgba(37,99,235,0.06)",
            color:
              txStatus.value === "error"
                ? "#dc2626"
                : txStatus.value === "success"
                  ? "#059669"
                  : "#2563eb",
          }}
        >
          {txMessage.value}
        </div>
      )}

      {/* QR Modal */}
      {showQr.value && qrImage.value && (
        <>
          <div
            class="fixed inset-0 z-[10000]"
            style={{
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(6px)",
            }}
            onClick$={() => {
              showQr.value = false;
              txStatus.value = "idle";
              txMessage.value = "";
            }}
          />
          <div
            class="fixed z-[10001]"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "#fff",
              borderRadius: "20px",
              padding: "28px",
              textAlign: "center",
              boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
            }}
          >
            <h4
              style={{
                fontSize: "16px",
                fontWeight: "700",
                marginBottom: "16px",
                color: "#111827",
              }}
            >
              Scan with Xaman
            </h4>
            <img
              src={qrImage.value}
              alt="Xaman QR"
              width={220}
              height={220}
              style={{ display: "block", margin: "0 auto 16px" }}
            />
            <p style={{ fontSize: "12px", color: "#6b7280" }}>
              Open Xaman and scan this QR code
            </p>
            <button
              class="cursor-pointer"
              onClick$={() => {
                showQr.value = false;
                txStatus.value = "idle";
                txMessage.value = "";
              }}
              style={{
                marginTop: "16px",
                padding: "8px 24px",
                borderRadius: "10px",
                border: "1px solid rgba(0,0,0,0.1)",
                background: "#fff",
                fontSize: "13px",
                color: "#374151",
              }}
            >
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
});

// ─── Token Detail Modal ──────────────────────────────────────────────────────

const TokenDetailModal = component$<{
  token: TokenItem;
  network: string;
  nativeCurrency: string;
  walletAddress: string;
  walletType: string | null;
  onClose$: PropFunction<() => void>;
}>(
  ({ token, network, nativeCurrency, walletAddress, walletType, onClose$ }) => {
    const chartData = useSignal<TokenChartData | null>(null);
    const chartLoading = useSignal(true);

    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(async () => {
      chartLoading.value = true;
      try {
        const data = await fetchChartServer(
          network,
          token.currency,
          token.issuer,
        );
        chartData.value = data;
      } catch {
        chartData.value = null;
      }
      chartLoading.value = false;
    });

    return (
      <>
        <div
          class="fixed inset-0 z-[9998]"
          style={{
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
          onClick$={onClose$}
        />
        <div
          class="fixed z-[9999] overflow-y-auto"
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(640px, calc(100vw - 32px))",
            maxHeight: "85vh",
            background: "#fff",
            borderRadius: "24px",
            boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
            animation: "modalIn 0.25s ease-out",
          }}
          onClick$={(e) => e.stopPropagation()}
        >
          <style>{`
          @keyframes modalIn {
            from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          }
        `}</style>

          <div style={{ padding: "28px" }}>
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  flexShrink: "0",
                  border: "2px solid rgba(0,0,0,0.06)",
                }}
              >
                {token.logoUrl ? (
                  <img
                    src={token.logoUrl}
                    alt={token.currencyDisplay}
                    width={52}
                    height={52}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: "50%",
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: "18px",
                      fontWeight: "800",
                      color: "#3b82f6",
                    }}
                  >
                    {token.currencyDisplay.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div style={{ flex: "1", minWidth: "0" }}>
                <h2
                  style={{
                    fontSize: "22px",
                    fontWeight: "800",
                    color: "#111827",
                    lineHeight: "1.2",
                  }}
                >
                  {token.currencyDisplay}
                </h2>
                <div style={{ fontSize: "13px", color: "#6b7280" }}>
                  {token.domain || truncAddr(token.issuer)}
                </div>
              </div>
              {/* Price + change */}
              <div style={{ textAlign: "right", flexShrink: "0" }}>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: "800",
                    color: "#111827",
                  }}
                >
                  {token.priceUsd ? formatUsd(token.priceUsd) : "\u2014"}
                </div>
                {token.change24h !== undefined && token.change24h !== 0 && (
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "700",
                      color: token.change24h > 0 ? "#10b981" : "#ef4444",
                    }}
                  >
                    {token.change24h > 0 ? "+" : ""}
                    {token.change24h.toFixed(2)}%
                  </div>
                )}
              </div>
              <button
                class="cursor-pointer"
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.04)",
                  border: "none",
                  color: "#6b7280",
                  fontSize: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: "0",
                }}
                onClick$={onClose$}
              >
                ✕
              </button>
            </div>

            {/* Chart */}
            <div style={{ marginBottom: "20px" }}>
              {chartLoading.value ? (
                <div
                  style={{
                    height: "200px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0,0,0,0.02)",
                    borderRadius: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      border: "2px solid #e5e7eb",
                      borderTopColor: "#2563eb",
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                </div>
              ) : chartData.value ? (
                <DetailChart
                  data={chartData.value.prices}
                  change24h={chartData.value.change24h}
                />
              ) : (
                <div
                  style={{
                    height: "100px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    color: "#9ca3af",
                    background: "rgba(0,0,0,0.02)",
                    borderRadius: "12px",
                  }}
                >
                  No chart data available
                </div>
              )}
            </div>

            {/* Stats grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "10px",
                marginBottom: "20px",
              }}
            >
              {[
                {
                  label: "Market Cap",
                  value: token.marketCap
                    ? formatUsd(token.marketCap)
                    : "\u2014",
                },
                {
                  label: "24h Volume",
                  value: token.volume24h
                    ? formatUsd(token.volume24h)
                    : "\u2014",
                },
                {
                  label: "Price (" + nativeCurrency + ")",
                  value: token.priceXrp
                    ? token.priceXrp < 0.001
                      ? token.priceXrp.toExponential(2)
                      : token.priceXrp.toFixed(6)
                    : "\u2014",
                },
                {
                  label: "Total Supply",
                  value: formatSupply(token.totalSupply),
                },
                {
                  label: "Trustlines",
                  value: token.trustlines.toLocaleString(),
                },
                {
                  label: "Holders",
                  value: token.holders.toLocaleString(),
                },
                {
                  label: "Transfer Fee",
                  value: token.transferRate
                    ? token.transferRate.toFixed(2) + "%"
                    : "0%",
                },
                {
                  label: "Domain",
                  value: token.domain || "\u2014",
                },
                {
                  label: "Issuer",
                  value: truncAddr(token.issuer),
                },
              ].map((item, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "12px",
                    background: "rgba(0,0,0,0.02)",
                    border: "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "9px",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "#9ca3af",
                      marginBottom: "4px",
                      fontWeight: "600",
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "700",
                      color: "#111827",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* External links */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginBottom: "16px",
                flexWrap: "wrap",
              }}
            >
              {[
                {
                  label: "Bithomp",
                  url: `https://bithomp.com/explorer/${token.issuer}`,
                },
                {
                  label: "XRPScan",
                  url: `https://xrpscan.com/account/${token.issuer}`,
                },
                {
                  label: "DexScreener",
                  url: `https://dexscreener.com/xrpl`,
                },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(0,0,0,0.08)",
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#6b7280",
                    textDecoration: "none",
                    transition: "all 0.2s",
                  }}
                >
                  {link.label} ↗
                </a>
              ))}
            </div>

            {/* Action buttons */}
            <ActionButtons
              token={token}
              walletAddress={walletAddress}
              walletType={walletType}
              network={network}
            />
          </div>
        </div>
      </>
    );
  },
);

// ─── NFT Detail Modal ────────────────────────────────────────────────────────

const NftDetailModal = component$<{
  nft: NftItem;
  nativeCurrency: string;
  walletAddress: string;
  walletType: string | null;
  onClose$: PropFunction<() => void>;
}>(({ nft, nativeCurrency, walletAddress, walletType, onClose$ }) => {
  const price = getLowestSellPrice(nft.sellOffers, nativeCurrency);
  const bestOffer = getHighestBuyPrice(nft.buyOffers, nativeCurrency);
  const txStatus = useSignal<"idle" | "pending" | "error">("idle");
  const txMessage = useSignal("");
  const showQr = useSignal(false);
  const qrImage = useSignal("");

  const handleBuyNft = $(async () => {
    if (!walletAddress) {
      txMessage.value = "Connect a wallet first";
      txStatus.value = "error";
      return;
    }
    if (!nft.sellOffers.length) {
      txMessage.value = "No sell offers available";
      txStatus.value = "error";
      return;
    }
    txStatus.value = "pending";

    const offer = nft.sellOffers[0];
    const txjson: Record<string, unknown> = {
      TransactionType: "NFTokenAcceptOffer",
      Account: walletAddress,
      NFTokenSellOffer: offer.index,
    };

    if (walletType === "xaman") {
      const result = await createXamanPayload(txjson);
      if (result.success && result.qrPng) {
        qrImage.value = result.qrPng;
        showQr.value = true;
        txMessage.value = "Scan QR with Xaman to buy NFT";
      } else {
        txStatus.value = "error";
        txMessage.value = result.error || "Failed to create payload";
      }
    } else {
      txStatus.value = "error";
      txMessage.value = "NFT purchase only supported via Xaman wallet";
    }
  });

  return (
    <>
      <div
        class="fixed inset-0 z-[9998]"
        style={{
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        onClick$={onClose$}
      />
      <div
        class="fixed z-[9999] overflow-y-auto"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(640px, calc(100vw - 32px))",
          maxHeight: "85vh",
          background: "#fff",
          borderRadius: "24px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
          animation: "modalIn 0.25s ease-out",
        }}
        onClick$={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes modalIn {
            from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>

        {/* Header image */}
        <div
          style={{
            width: "100%",
            aspectRatio: "16/9",
            overflow: "hidden",
            background: "#f3f4f6",
            borderRadius: "24px 24px 0 0",
            position: "relative",
          }}
        >
          <NftImage
            src={nft.image || nft.resolvedUri}
            alt={nft.name}
            style={{ objectFit: "contain" }}
          />
          <button
            class="cursor-pointer"
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(8px)",
              border: "none",
              color: "#fff",
              fontSize: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick$={onClose$}
          >
            ✕
          </button>
          {nft.nftStandard && (
            <div
              style={{
                position: "absolute",
                top: "12px",
                left: "12px",
                background:
                  nft.nftStandard === "XLS-20" ? "#2563eb" : "#f59e0b",
                color: "#fff",
                fontSize: "11px",
                fontWeight: "700",
                padding: "4px 10px",
                borderRadius: "8px",
              }}
            >
              {nft.nftStandard}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: "24px" }}>
          <h2
            style={{
              fontSize: "22px",
              fontWeight: "700",
              color: "#111827",
              marginBottom: "4px",
              lineHeight: "1.3",
            }}
          >
            {nft.name || `NFT #${nft.serial}`}
          </h2>
          {nft.collection && (
            <div
              style={{
                fontSize: "13px",
                color: "#6b7280",
                marginBottom: "16px",
              }}
            >
              Collection: <strong>{nft.collection}</strong>
            </div>
          )}
          {nft.description && (
            <p
              style={{
                fontSize: "14px",
                color: "#374151",
                lineHeight: "1.6",
                marginBottom: "20px",
              }}
            >
              {nft.description}
            </p>
          )}

          {/* Properties grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
              marginBottom: "20px",
            }}
          >
            {[
              { label: "Price", value: price?.formatted || "Not listed" },
              {
                label: "Best Offer",
                value: bestOffer?.formatted || "No offers",
              },
              { label: "Issuer", value: truncAddr(nft.issuer) },
              { label: "Owner", value: truncAddr(nft.owner) },
              { label: "Taxon", value: String(nft.taxon) },
              { label: "Serial", value: String(nft.serial) },
              {
                label: "Transfer Fee",
                value: nft.transferFee
                  ? (nft.transferFee / 1000).toFixed(2) + "%"
                  : "0%",
              },
              {
                label: "Offers",
                value: String(nft.sellOffers.length + nft.buyOffers.length),
              },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 14px",
                  borderRadius: "12px",
                  background: "rgba(0,0,0,0.02)",
                  border: "1px solid rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    fontSize: "9px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#9ca3af",
                    marginBottom: "4px",
                    fontWeight: "600",
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#111827",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* NFToken ID */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "12px",
              background: "rgba(0,0,0,0.02)",
              border: "1px solid rgba(0,0,0,0.04)",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                fontSize: "9px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#9ca3af",
                marginBottom: "4px",
                fontWeight: "600",
              }}
            >
              NFToken ID
            </div>
            <div
              style={{
                fontSize: "11px",
                fontFamily: "monospace",
                color: "#374151",
                wordBreak: "break-all",
                lineHeight: "1.5",
              }}
            >
              {nft.nftokenId}
            </div>
          </div>

          {/* Sell Offers */}
          {nft.sellOffers.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <h4
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#111827",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "8px",
                }}
              >
                Sell Offers ({nft.sellOffers.length})
              </h4>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  maxHeight: "120px",
                  overflowY: "auto",
                }}
              >
                {nft.sellOffers.map((o) => (
                  <div
                    key={o.index}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      borderRadius: "10px",
                      background: "rgba(37,99,235,0.04)",
                      fontSize: "12px",
                    }}
                  >
                    <span style={{ color: "#6b7280" }}>
                      {truncAddr(o.owner)}
                    </span>
                    <span style={{ fontWeight: "700", color: "#2563eb" }}>
                      {formatXrpAmount(o.amount, nativeCurrency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buy Offers */}
          {nft.buyOffers.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <h4
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#111827",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "8px",
                }}
              >
                Buy Offers ({nft.buyOffers.length})
              </h4>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  maxHeight: "120px",
                  overflowY: "auto",
                }}
              >
                {nft.buyOffers.map((o) => (
                  <div
                    key={o.index}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      borderRadius: "10px",
                      background: "rgba(16,185,129,0.04)",
                      fontSize: "12px",
                    }}
                  >
                    <span style={{ color: "#6b7280" }}>
                      {truncAddr(o.owner)}
                    </span>
                    <span style={{ fontWeight: "700", color: "#059669" }}>
                      {formatXrpAmount(o.amount, nativeCurrency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buy NFT button */}
          {nft.sellOffers.length > 0 && (
            <button
              class="cursor-pointer"
              onClick$={handleBuyNft}
              disabled={txStatus.value === "pending" || !walletAddress}
              style={{
                width: "100%",
                padding: "12px 0",
                borderRadius: "14px",
                border: "none",
                background: walletAddress ? "#10b981" : "#d1d5db",
                color: "#fff",
                fontSize: "14px",
                fontWeight: "700",
                marginBottom: "8px",
                transition: "all 0.2s",
              }}
            >
              {txStatus.value === "pending"
                ? "Processing\u2026"
                : walletAddress
                  ? `Buy for ${price?.formatted || "listed price"}`
                  : "Connect wallet to buy"}
            </button>
          )}

          {/* Status message */}
          {txMessage.value && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "10px",
                fontSize: "12px",
                background:
                  txStatus.value === "error"
                    ? "rgba(239,68,68,0.06)"
                    : "rgba(37,99,235,0.06)",
                color: txStatus.value === "error" ? "#dc2626" : "#2563eb",
              }}
            >
              {txMessage.value}
            </div>
          )}

          {/* External links */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "16px",
              flexWrap: "wrap",
            }}
          >
            {[
              {
                label: "Bithomp",
                url: `https://bithomp.com/nft/${nft.nftokenId}`,
              },
              {
                label: "XRPScan",
                url: `https://xrpscan.com/nft/${nft.nftokenId}`,
              },
            ].map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "1px solid rgba(0,0,0,0.08)",
                  fontSize: "11px",
                  fontWeight: "600",
                  color: "#6b7280",
                  textDecoration: "none",
                }}
              >
                {link.label} ↗
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* QR modal for NFT buy */}
      {showQr.value && qrImage.value && (
        <>
          <div
            class="fixed inset-0 z-[10000]"
            style={{
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(6px)",
            }}
            onClick$={() => {
              showQr.value = false;
              txStatus.value = "idle";
              txMessage.value = "";
            }}
          />
          <div
            class="fixed z-[10001]"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "#fff",
              borderRadius: "20px",
              padding: "28px",
              textAlign: "center",
              boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
            }}
          >
            <h4
              style={{
                fontSize: "16px",
                fontWeight: "700",
                marginBottom: "16px",
                color: "#111827",
              }}
            >
              Scan with Xaman
            </h4>
            <img
              src={qrImage.value}
              alt="Xaman QR"
              width={220}
              height={220}
              style={{ display: "block", margin: "0 auto 16px" }}
            />
            <p style={{ fontSize: "12px", color: "#6b7280" }}>
              Open Xaman and scan this QR code to buy
            </p>
            <button
              class="cursor-pointer"
              onClick$={() => {
                showQr.value = false;
                txStatus.value = "idle";
                txMessage.value = "";
              }}
              style={{
                marginTop: "16px",
                padding: "8px 24px",
                borderRadius: "10px",
                border: "1px solid rgba(0,0,0,0.1)",
                background: "#fff",
                fontSize: "13px",
                color: "#374151",
              }}
            >
              Close
            </button>
          </div>
        </>
      )}
    </>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Main Marketplace Component
// ═══════════════════════════════════════════════════════════════════════════════

export default component$(() => {
  const { activeNetwork } = useNetworkContext();
  const wallet = useWalletContext();
  const networkConfig = useComputed$(() => NETWORK_CONFIG[activeNetwork.value]);
  const nativeCurrency = useComputed$(
    () => NETWORK_CONFIG[activeNetwork.value].nativeCurrency,
  );

  // SSR data from routeLoaders
  const tokenData = useTokenLoader();
  const nftData = useNftLoader();

  // Mode toggle
  const marketMode = useSignal<"nfts" | "tokens">("tokens");

  // NFT state
  const nfts = useSignal<NftItem[]>([]);
  const nftLoading = useSignal(false);
  const nftError = useSignal("");
  const nftSearch = useSignal("");
  const nftPage = useSignal(1);
  const NFT_PAGE_SIZE = 24;
  const selectedNft = useSignal<NftItem | null>(null);

  // Token state
  const tokens = useSignal<TokenItem[]>([]);
  const tokLoading = useSignal(false);
  const tokError = useSignal("");
  const tokSearch = useSignal("");
  const tokPage = useSignal(1);
  const TOK_PAGE_SIZE = 50;
  const selectedToken = useSignal<TokenItem | null>(null);

  // Hydrate from SSR loaders (instant — no network round-trip)
  useTask$(({ track }) => {
    track(() => tokenData.value);
    if (tokenData.value?.tokens?.length) {
      tokens.value = tokenData.value.tokens;
    }
  });

  useTask$(({ track }) => {
    track(() => nftData.value);
    if (nftData.value?.nfts?.length) {
      nfts.value = nftData.value.nfts;
    }
  });

  // Client-side refresh on network change
  const fetchNfts = $(async () => {
    nftLoading.value = true;
    nftError.value = "";
    try {
      const res = await fetch(
        `/api/marketplace/all?network=${activeNetwork.value}&type=nfts&limit=50`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { nfts?: NftItem[] };
      nfts.value = data.nfts || [];
      nftPage.value = 1;
    } catch (err: any) {
      nftError.value = err.message || "Failed to load NFTs";
    } finally {
      nftLoading.value = false;
    }
  });

  const fetchTokens = $(async () => {
    tokLoading.value = true;
    tokError.value = "";
    try {
      const res = await fetch(
        `/api/marketplace/all?network=${activeNetwork.value}&type=tokens&limit=100`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { tokens?: TokenItem[] };
      tokens.value = (data.tokens || []).map((t) => ({
        ...t,
        currencyDisplay: t.currencyDisplay || decodeCurrency(t.currency),
      }));
      tokPage.value = 1;
    } catch (err: any) {
      tokError.value = err.message || "Failed to load tokens";
    } finally {
      tokLoading.value = false;
    }
  });

  // Refresh when network changes (client-side only)
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const net = track(() => activeNetwork.value);
    // Only re-fetch if network changed from the SSR default
    if (net !== (tokenData.value?.network || "xrpl")) {
      fetchNfts();
      fetchTokens();
    }
  });

  // ── NFT computed values ──────────────────────────────────────────────────
  const featuredNfts = useComputed$(() =>
    nfts.value.filter((n) => n.sellOffers?.length > 0 && n.image).slice(0, 6),
  );

  const nftFiltered = useComputed$(() => {
    const q = nftSearch.value.toLowerCase();
    if (!q) return nfts.value;
    return nfts.value.filter(
      (n) =>
        n.name?.toLowerCase().includes(q) ||
        n.collection?.toLowerCase().includes(q) ||
        n.nftokenId?.toLowerCase().includes(q) ||
        n.issuer?.toLowerCase().includes(q),
    );
  });

  const nftPaginated = useComputed$(() => {
    const s = (nftPage.value - 1) * NFT_PAGE_SIZE;
    return nftFiltered.value.slice(s, s + NFT_PAGE_SIZE);
  });

  const nftTotalPages = useComputed$(() =>
    Math.max(1, Math.ceil(nftFiltered.value.length / NFT_PAGE_SIZE)),
  );

  const nftStats = useComputed$(() => ({
    total: nfts.value.length,
    listed: nfts.value.filter((n) => n.sellOffers?.length > 0).length,
    collections: new Set(nfts.value.map((n) => n.collection).filter(Boolean))
      .size,
  }));

  // ── Token computed values ────────────────────────────────────────────────
  const tokFiltered = useComputed$(() => {
    const q = tokSearch.value.toLowerCase();
    if (!q) return tokens.value;
    return tokens.value.filter(
      (t) =>
        t.currencyDisplay?.toLowerCase().includes(q) ||
        t.currency?.toLowerCase().includes(q) ||
        t.issuer?.toLowerCase().includes(q) ||
        (t.domain && t.domain.toLowerCase().includes(q)),
    );
  });

  const tokPaginated = useComputed$(() => {
    const s = (tokPage.value - 1) * TOK_PAGE_SIZE;
    return tokFiltered.value.slice(s, s + TOK_PAGE_SIZE);
  });

  const tokTotalPages = useComputed$(() =>
    Math.max(1, Math.ceil(tokFiltered.value.length / TOK_PAGE_SIZE)),
  );

  const tokenSparklines = useComputed$(() => {
    const map: Record<string, number[]> = {};
    tokens.value.forEach((t) => {
      const key = `${t.currency}:${t.issuer}`;
      if (t.sparkline && t.sparkline.length > 0) {
        map[key] = t.sparkline;
      } else {
        const seed = t.trustlines || 1;
        const pts: number[] = [];
        let val = seed;
        for (let i = 0; i < 20; i++) {
          val = val + ((((seed * (i + 1) * 7) % 100) - 50) / 50) * (seed * 0.1);
          pts.push(Math.max(0, val));
        }
        map[key] = pts;
      }
    });
    return map;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div class="mt-16" style={{ minHeight: "100vh" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes modalIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>

      {/* NFT Detail Modal */}
      {selectedNft.value && (
        <NftDetailModal
          nft={selectedNft.value}
          nativeCurrency={nativeCurrency.value}
          walletAddress={wallet.address.value}
          walletType={wallet.walletType.value}
          onClose$={() => {
            selectedNft.value = null;
          }}
        />
      )}

      {/* Token Detail Modal */}
      {selectedToken.value && (
        <TokenDetailModal
          token={selectedToken.value}
          network={activeNetwork.value}
          nativeCurrency={nativeCurrency.value}
          walletAddress={wallet.address.value}
          walletType={wallet.walletType.value}
          onClose$={() => {
            selectedToken.value = null;
          }}
        />
      )}

      {/* ── Page Header ── */}
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "32px",
            fontWeight: "800",
            color: "#111827",
            letterSpacing: "-0.03em",
            marginBottom: "8px",
          }}
        >
          Marketplace
        </h1>
        <p style={{ fontSize: "16px", color: "#6b7280", lineHeight: "1.5" }}>
          Explore NFTs and tokens on{" "}
          <strong style={{ color: networkConfig.value.color }}>
            {networkConfig.value.label}
          </strong>
        </p>
      </div>

      {/* ── Mode Toggle + Refresh ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "32px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            background: "rgba(0,0,0,0.04)",
            borderRadius: "12px",
            padding: "4px",
            gap: "4px",
          }}
        >
          {(["tokens", "nfts"] as const).map((mode) => (
            <button
              key={mode}
              class="cursor-pointer"
              style={{
                padding: "8px 20px",
                borderRadius: "10px",
                border: "none",
                fontSize: "13px",
                fontWeight: "600",
                background:
                  marketMode.value === mode ? "#111827" : "transparent",
                color: marketMode.value === mode ? "#fff" : "#6b7280",
                transition: "all 0.2s",
              }}
              onClick$={() => (marketMode.value = mode)}
            >
              {mode === "nfts" ? "\uD83D\uDDBC NFTs" : "\uD83E\uDE99 Tokens"}
            </button>
          ))}
        </div>

        <button
          class="cursor-pointer"
          style={{
            padding: "8px 16px",
            borderRadius: "10px",
            border: "1px solid rgba(0,0,0,0.08)",
            background: "#fff",
            fontSize: "13px",
            fontWeight: "500",
            color: "#374151",
          }}
          onClick$={() => {
            if (marketMode.value === "nfts") fetchNfts();
            else fetchTokens();
          }}
        >
          \u21BB Refresh
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
           TOKEN MODE
         ══════════════════════════════════════════════════════════════════════ */}
      {marketMode.value === "tokens" && (
        <div>
          {/* Stats bar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "12px",
              marginBottom: "32px",
            }}
          >
            {[
              {
                label: "Total Tokens",
                value: tokens.value.length.toLocaleString(),
                color: "#2563eb",
              },
              {
                label: "Total Trustlines",
                value: tokens.value
                  .reduce((s, t) => s + (t.trustlines || 0), 0)
                  .toLocaleString(),
                color: "#7c3aed",
              },
              {
                label: "With Price Data",
                value: tokens.value
                  .filter((t) => t.priceUsd && t.priceUsd > 0)
                  .length.toLocaleString(),
                color: "#10b981",
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  padding: "16px 20px",
                  borderRadius: "16px",
                  background: "rgba(0,0,0,0.02)",
                  border: "1px solid rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#9ca3af",
                    fontWeight: "600",
                    marginBottom: "6px",
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "800",
                    color: s.color,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Loading state */}
          {tokLoading.value && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "80px 0",
                gap: "16px",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  border: "3px solid #e5e7eb",
                  borderTopColor: "#2563eb",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                }}
              />
              <div style={{ fontSize: "14px", color: "#9ca3af" }}>
                Loading tokens from {networkConfig.value.label}\u2026
              </div>
            </div>
          )}

          {/* Error state */}
          {tokError.value && (
            <div
              style={{
                padding: "16px 20px",
                borderRadius: "12px",
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.15)",
                color: "#dc2626",
                fontSize: "14px",
                marginBottom: "24px",
              }}
            >
              {tokError.value}
            </div>
          )}

          {!tokLoading.value && !tokError.value && (
            <>
              {/* Search + header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <h2
                  style={{
                    fontSize: "20px",
                    fontWeight: "700",
                    color: "#111827",
                  }}
                >
                  All Tokens
                </h2>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flex: "1",
                    maxWidth: "400px",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Search currency, issuer, domain\u2026"
                    value={tokSearch.value}
                    onInput$={(e: any) => {
                      tokSearch.value = e.target.value;
                      tokPage.value = 1;
                    }}
                    style={{
                      flex: "1",
                      padding: "8px 14px",
                      borderRadius: "10px",
                      border: "1px solid rgba(0,0,0,0.1)",
                      fontSize: "13px",
                      outline: "none",
                      background: "#fff",
                      color: "#111827",
                    }}
                  />
                </div>
              </div>

              {/* Column headers */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "8px 16px",
                  borderBottom: "1px solid rgba(0,0,0,0.06)",
                  marginBottom: "4px",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontWeight: "700",
                  color: "#9ca3af",
                }}
              >
                <div style={{ width: "28px", textAlign: "center" }}>#</div>
                <div style={{ width: "36px" }} />
                <div style={{ flex: "1" }}>Token</div>
                <div style={{ minWidth: "80px", textAlign: "right" }}>
                  Price
                </div>
                <div
                  class="hidden sm:block"
                  style={{ minWidth: "65px", textAlign: "right" }}
                >
                  24h
                </div>
                <div
                  class="hidden md:block"
                  style={{ minWidth: "80px", textAlign: "center" }}
                >
                  Chart
                </div>
                <div style={{ minWidth: "70px", textAlign: "right" }}>
                  Trustlines
                </div>
              </div>

              {tokPaginated.value.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "60px 0",
                    color: "#9ca3af",
                  }}
                >
                  <div style={{ fontSize: "40px", marginBottom: "12px" }}>
                    \uD83D\uDD0D
                  </div>
                  <div style={{ fontSize: "15px", fontWeight: "600" }}>
                    No tokens found
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    {tokPaginated.value.map((tok, idx) => {
                      const globalIdx =
                        (tokPage.value - 1) * TOK_PAGE_SIZE + idx;
                      const key = `${tok.currency}:${tok.issuer}`;
                      return (
                        <TokenRow
                          key={key}
                          token={tok}
                          index={globalIdx}
                          sparkData={tokenSparklines.value[key] || []}
                          onSelect$={(t: TokenItem) => {
                            selectedToken.value = t;
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {tokTotalPages.value > 1 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        paddingTop: "20px",
                        marginTop: "16px",
                        borderTop: "1px solid rgba(0,0,0,0.06)",
                      }}
                    >
                      <button
                        class="cursor-pointer"
                        disabled={tokPage.value <= 1}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "8px",
                          border: "1px solid rgba(0,0,0,0.1)",
                          background: "#fff",
                          fontSize: "13px",
                          opacity: tokPage.value <= 1 ? "0.3" : "1",
                        }}
                        onClick$={() => {
                          tokPage.value = Math.max(1, tokPage.value - 1);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        \u2190 Prev
                      </button>
                      <span
                        style={{
                          fontSize: "13px",
                          color: "#6b7280",
                          padding: "0 12px",
                        }}
                      >
                        Page {tokPage.value} of {tokTotalPages.value}
                      </span>
                      <button
                        class="cursor-pointer"
                        disabled={tokPage.value >= tokTotalPages.value}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "8px",
                          border: "1px solid rgba(0,0,0,0.1)",
                          background: "#fff",
                          fontSize: "13px",
                          opacity:
                            tokPage.value >= tokTotalPages.value ? "0.3" : "1",
                        }}
                        onClick$={() => {
                          tokPage.value = Math.min(
                            tokTotalPages.value,
                            tokPage.value + 1,
                          );
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Next \u2192
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           NFT MODE
         ══════════════════════════════════════════════════════════════════════ */}
      {marketMode.value === "nfts" && (
        <div>
          {/* Stats bar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "12px",
              marginBottom: "40px",
            }}
          >
            {[
              {
                label: "Total NFTs",
                value: nftStats.value.total.toLocaleString(),
                color: "#2563eb",
              },
              {
                label: "Listed for Sale",
                value: nftStats.value.listed.toLocaleString(),
                color: "#10b981",
              },
              {
                label: "Collections",
                value: nftStats.value.collections.toLocaleString(),
                color: "#7c3aed",
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  padding: "16px 20px",
                  borderRadius: "16px",
                  background: "rgba(0,0,0,0.02)",
                  border: "1px solid rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#9ca3af",
                    fontWeight: "600",
                    marginBottom: "6px",
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "800",
                    color: s.color,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Loading state */}
          {nftLoading.value && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "80px 0",
                gap: "16px",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  border: "3px solid #e5e7eb",
                  borderTopColor: "#2563eb",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                }}
              />
              <div style={{ fontSize: "14px", color: "#9ca3af" }}>
                Loading NFTs from {networkConfig.value.label}
                {"\u2026"}
              </div>
            </div>
          )}

          {/* Error state */}
          {nftError.value && (
            <div
              style={{
                padding: "16px 20px",
                borderRadius: "12px",
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.15)",
                color: "#dc2626",
                fontSize: "14px",
                marginBottom: "24px",
              }}
            >
              {nftError.value}
            </div>
          )}

          {!nftLoading.value && !nftError.value && (
            <>
              {/* ── Featured NFTs ── */}
              {featuredNfts.value.length > 0 && (
                <section style={{ marginBottom: "48px" }}>
                  <h2
                    style={{
                      fontSize: "20px",
                      fontWeight: "700",
                      color: "#111827",
                      marginBottom: "4px",
                    }}
                  >
                    {"\u2728"} Featured
                  </h2>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#9ca3af",
                      marginBottom: "16px",
                    }}
                  >
                    Listed NFTs on {networkConfig.value.label}
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(200px, 1fr))",
                      gap: "16px",
                    }}
                  >
                    {featuredNfts.value.map((nft) => (
                      <NftCard
                        key={nft.nftokenId}
                        nft={nft}
                        nativeCurrency={nativeCurrency.value}
                        onSelect$={(n: NftItem) => (selectedNft.value = n)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Browse All NFTs ── */}
              <section>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "16px",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <h2
                    style={{
                      fontSize: "20px",
                      fontWeight: "700",
                      color: "#111827",
                    }}
                  >
                    Browse All NFTs
                  </h2>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flex: "1",
                      maxWidth: "400px",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Search name, collection, ID\u2026"
                      value={nftSearch.value}
                      onInput$={(e: any) => {
                        nftSearch.value = e.target.value;
                        nftPage.value = 1;
                      }}
                      style={{
                        flex: "1",
                        padding: "8px 14px",
                        borderRadius: "10px",
                        border: "1px solid rgba(0,0,0,0.1)",
                        fontSize: "13px",
                        outline: "none",
                        background: "#fff",
                        color: "#111827",
                      }}
                    />
                  </div>
                </div>

                {nftPaginated.value.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "60px 0",
                      color: "#9ca3af",
                    }}
                  >
                    <div style={{ fontSize: "40px", marginBottom: "12px" }}>
                      {"\uD83D\uDD0D"}
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: "600" }}>
                      No NFTs found
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(200px, 1fr))",
                        gap: "16px",
                        marginBottom: "24px",
                      }}
                    >
                      {nftPaginated.value.map((nft) => (
                        <NftCard
                          key={nft.nftokenId}
                          nft={nft}
                          nativeCurrency={nativeCurrency.value}
                          onSelect$={(n: NftItem) => (selectedNft.value = n)}
                        />
                      ))}
                    </div>

                    {/* Pagination */}
                    {nftTotalPages.value > 1 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          paddingTop: "20px",
                          borderTop: "1px solid rgba(0,0,0,0.06)",
                        }}
                      >
                        <button
                          class="cursor-pointer"
                          disabled={nftPage.value <= 1}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: "1px solid rgba(0,0,0,0.1)",
                            background: "#fff",
                            fontSize: "13px",
                            opacity: nftPage.value <= 1 ? "0.3" : "1",
                          }}
                          onClick$={() => {
                            nftPage.value = Math.max(1, nftPage.value - 1);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          {"\u2190"} Prev
                        </button>
                        <span
                          style={{
                            fontSize: "13px",
                            color: "#6b7280",
                            padding: "0 12px",
                          }}
                        >
                          Page {nftPage.value} of {nftTotalPages.value}
                        </span>
                        <button
                          class="cursor-pointer"
                          disabled={nftPage.value >= nftTotalPages.value}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: "1px solid rgba(0,0,0,0.1)",
                            background: "#fff",
                            fontSize: "13px",
                            opacity:
                              nftPage.value >= nftTotalPages.value
                                ? "0.3"
                                : "1",
                          }}
                          onClick$={() => {
                            nftPage.value = Math.min(
                              nftTotalPages.value,
                              nftPage.value + 1,
                            );
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          Next {"\u2192"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <footer
        style={{
          textAlign: "center",
          padding: "40px 0 24px",
          marginTop: "48px",
          borderTop: "1px solid rgba(0,0,0,0.06)",
          fontSize: "12px",
          color: "#9ca3af",
          letterSpacing: "0.02em",
        }}
      >
        {"\u00A9"} 2025 {"\u2013"} Product of{" "}
        <a
          href="https://nrdxlab.com"
          style={{ color: "#6b7280", textDecoration: "none" }}
        >
          {"{NRDX}"}Labs
        </a>
        . All rights reserved.
      </footer>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Marketplace | {XRPL}OS",
  meta: [
    {
      name: "description",
      content:
        "Explore NFTs and tokens on the XRP Ledger and Xahau networks. Browse, buy, and trade digital assets.",
    },
  ],
};

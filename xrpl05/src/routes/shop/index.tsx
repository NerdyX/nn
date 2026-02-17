// src/routes/shop/index.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Marketplace — instant SSR skeleton → live hydration
// • XLS-14 + XLS-20 NFTs  • 4×8 paginated grid  • Real-time token polling
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

// ─── Constants ────────────────────────────────────────────────────────────────
const NFT_PAGE_SIZE = 32; // 4 columns × 8 rows
const TOK_PAGE_SIZE = 50;
const TOKEN_REFRESH_MS = 10000; // live token poll every 15 s

const IPFS_GATEWAYS = [
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://dweb.link/ipfs/",
];

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' rx='12' fill='%23f3f4f6'/%3E%3Ctext x='150' y='162' text-anchor='middle' font-family='system-ui' font-size='42' fill='%23d1d5db'%3E%3F%3C/text%3E%3C/svg%3E";

// ─── SSR Route Loaders (runs server-side, HTML arrives pre-filled) ────────────

export const useTokenLoader = routeLoader$(async (req) => {
  const { loadTokens, getD1 } = await import("~/lib/marketplace-data");
  const db = getD1(req.platform as Record<string, any> | undefined);
  const network = (req.query.get("network") || "xrpl").toLowerCase();
  try {
    return await loadTokens(network, 200, db);
  } catch {
    return {
      success: false,
      network,
      type: "tokens" as const,
      count: 0,
      tokens: [] as TokenItem[],
      timestamp: new Date().toISOString(),
      xrpPriceUsd: 0,
    };
  }
});

export const useNftLoader = routeLoader$(async (req) => {
  const { loadNfts, getD1 } = await import("~/lib/marketplace-data");
  const db = getD1(req.platform as Record<string, any> | undefined);
  const network = (req.query.get("network") || "xrpl").toLowerCase();
  try {
    return await loadNfts(network, 500, db); // pull up to 500 for count
  } catch {
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

// ─── Server Functions ─────────────────────────────────────────────────────────

const fetchChartServer = server$(
  async (
    network: string,
    currency: string,
    issuer: string,
  ): Promise<TokenChartData | null> => {
    const { fetchTokenChartData } = await import("~/lib/marketplace-data");
    try {
      return await fetchTokenChartData(network, currency, issuer);
    } catch {
      return null;
    }
  },
);

const createXamanPayload = server$(async function (
  txjson: Record<string, unknown>,
) {
  try {
    const { Xumm } = await import("xumm");
    const apiKey =
      this.env.get("PUBLIC_XAMAN_API_KEY") ?? process.env.PUBLIC_XAMAN_API_KEY;
    const apiSecret =
      this.env.get("XAMAN_API_SECRET") ?? process.env.XAMAN_API_SECRET;
    if (!apiKey || !apiSecret)
      return { success: false, error: "Missing Xaman API credentials" };
    const xumm = new Xumm(apiKey, apiSecret);
    const appUrl = this.env.get("PUBLIC_APP_URL") ?? "http://localhost:5173";
    const payload = await xumm.payload?.create({
      txjson,
      options: {
        submit: true,
        return_url: { app: `${appUrl}/`, web: `${appUrl}/` },
      },
    } as any);
    if (!payload) return { success: false, error: "Failed to create payload" };
    return { success: true, uuid: payload.uuid, qrPng: payload.refs.qr_png };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveImage(raw: string | undefined | null): string {
  if (!raw) return PLACEHOLDER;
  const url = raw.trim();
  if (url.startsWith("data:")) return url;
  if (url.startsWith("ipfs://")) return IPFS_GATEWAYS[0] + url.slice(7);
  if (/^(Qm|bafy|bafk|bafyb)/i.test(url)) return IPFS_GATEWAYS[0] + url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  // Hex-encoded string
  if (/^[0-9A-Fa-f]{20,}$/.test(url)) {
    try {
      let decoded = "";
      for (let i = 0; i + 1 < url.length; i += 2) {
        const c = parseInt(url.substring(i, i + 2), 16);
        if (c === 0) break;
        if (c >= 0x20 && c <= 0x7e) decoded += String.fromCharCode(c);
      }
      if (decoded.startsWith("http") || decoded.startsWith("ipfs"))
        return resolveImage(decoded);
    } catch {
      /* ignore */
    }
  }
  // Treat as IPFS CID
  if (url.length > 10 && !url.includes(" ")) return IPFS_GATEWAYS[0] + url;
  return PLACEHOLDER;
}

/**
 * Best-effort NFT name resolver.
 * Priority: metadata.name → nft.name → collection + serial → "NFT #<serial>"
 */
function resolveNftName(nft: NftItem): string {
  if (nft.name && nft.name.trim() && nft.name !== "Unnamed")
    return nft.name.trim();
  if (nft.collection) return `${nft.collection} #${nft.serial}`;
  return `NFT #${nft.serial}`;
}

function decodeCurrency(currency: string): string {
  if (!currency || currency.length <= 3) return currency;
  if (/^[0-9A-Fa-f]{40}$/.test(currency)) {
    try {
      let result = "";
      for (let i = 0; i < currency.length; i += 2) {
        const c = parseInt(currency.substring(i, i + 2), 16);
        if (c === 0) break;
        if (c >= 0x20 && c <= 0x7e) result += String.fromCharCode(c);
      }
      if (result.trim()) return result.trim();
    } catch {
      /* ignore */
    }
  }
  return currency;
}

function fmtAmount(
  amount: string | { value: string; currency: string; issuer: string },
  native: string,
): string {
  if (typeof amount === "string") {
    const x = Number(amount) / 1_000_000;
    return `${x.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${native}`;
  }
  return `${Number(amount.value).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${decodeCurrency(amount.currency)}`;
}

function lowestSell(offers: SellOffer[], native: string) {
  if (!offers?.length) return null;
  let min = Infinity,
    fmt = "";
  for (const o of offers) {
    const v =
      typeof o.amount === "string"
        ? Number(o.amount) / 1_000_000
        : Number(o.amount.value);
    if (v < min) {
      min = v;
      fmt = fmtAmount(o.amount, native);
    }
  }
  return min === Infinity ? null : { raw: min, formatted: fmt };
}

function highestBuy(offers: BuyOffer[], native: string) {
  if (!offers?.length) return null;
  let max = -Infinity,
    fmt = "";
  for (const o of offers) {
    const v =
      typeof o.amount === "string"
        ? Number(o.amount) / 1_000_000
        : Number(o.amount.value);
    if (v > max) {
      max = v;
      fmt = fmtAmount(o.amount, native);
    }
  }
  return max === -Infinity ? null : { raw: max, formatted: fmt };
}

function fmtUsd(n: number): string {
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(2) + "K";
  if (n >= 1) return "$" + n.toFixed(2);
  if (n >= 0.001) return "$" + n.toFixed(4);
  if (n > 0) return "$" + n.toFixed(8);
  return "$0.00";
}

function fmtSupply(s: string): string {
  const n = Number(s);
  if (isNaN(n)) return s;
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function trunc(addr: string): string {
  if (!addr || addr.length <= 14) return addr;
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

// ─── NFT Image component with multi-gateway fallback ─────────────────────────
const NftImage = component$<{ src: string; alt: string }>(({ src, alt }) => {
  const resolved = useSignal(resolveImage(src));
  const gwIdx = useSignal(0);
  const failed = useSignal(false);

  const onErr = $(() => {
    if (failed.value) return;
    const original = resolveImage(src);
    if (original.includes("/ipfs/")) {
      const cid = original.split("/ipfs/").pop() || "";
      if (cid && gwIdx.value < IPFS_GATEWAYS.length - 1) {
        gwIdx.value++;
        resolved.value = IPFS_GATEWAYS[gwIdx.value] + cid;
        return;
      }
    }
    failed.value = true;
    resolved.value = PLACEHOLDER;
  });

  return (
    <img
      src={resolved.value}
      alt={alt}
      width={300}
      height={300}
      loading="lazy"
      decoding="async"
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
      }}
      onError$={onErr}
    />
  );
});

// ─── Sparkline SVG ────────────────────────────────────────────────────────────
const Spark = component$<{
  data: number[];
  color?: string;
  w?: number;
  h?: number;
}>(({ data, color, w = 80, h = 28 }) => {
  if (!data || data.length < 2)
    return <div style={{ width: w + "px", height: h + "px" }} />;
  const min = Math.min(...data),
    max = Math.max(...data);
  const range = max - min || 1;
  const isUp = data[data.length - 1] >= data[0];
  const c = color || (isUp ? "#10b981" : "#ef4444");
  const pts = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * w},${h - 2 - ((v - min) / range) * (h - 4)}`,
    )
    .join(" ");
  const area = `0,${h} ${pts} ${w},${h}`;
  const gid = `sp${c.replace("#", "")}${w}`;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color={c} stop-opacity="0.18" />
          <stop offset="100%" stop-color={c} stop-opacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline
        points={pts}
        fill="none"
        stroke={c}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
});

// ─── Detail Chart ─────────────────────────────────────────────────────────────
const DetailChart = component$<{
  data: { time: number; value: number }[];
  change24h?: number;
}>(({ data, change24h }) => {
  if (!data || data.length < 2)
    return (
      <div
        style={{
          height: "180px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "13px",
          color: "#9ca3af",
          background: "rgba(0,0,0,0.02)",
          borderRadius: "12px",
        }}
      >
        No chart data
      </div>
    );
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals),
    max = Math.max(...vals);
  const range = max - min || 1;
  const W = 560,
    H = 180,
    pad = 4;
  const isUp = (change24h ?? 0) >= 0;
  const col = isUp ? "#10b981" : "#ef4444";
  const pts = vals
    .map(
      (v, i) =>
        `${(pad + ((W - 2 * pad) * i) / (vals.length - 1)).toFixed(1)},${(H - pad - ((H - 2 * pad) * (v - min)) / range).toFixed(1)}`,
    )
    .join(" ");
  const area = `${pad},${H - pad} ${pts} ${W - pad},${H - pad}`;
  const fmt = (ts: number) =>
    new Date(ts).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <div>
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ borderRadius: "12px", display: "block" }}
      >
        <defs>
          <linearGradient id="dcg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color={col} stop-opacity="0.18" />
            <stop offset="100%" stop-color={col} stop-opacity="0" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="rgba(0,0,0,0.02)" rx="12" />
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={pad}
            y1={pad + (H - 2 * pad) * f}
            x2={W - pad}
            y2={pad + (H - 2 * pad) * f}
            stroke="rgba(0,0,0,0.05)"
            stroke-dasharray="4,4"
          />
        ))}
        <polygon points={area} fill="url(#dcg)" />
        <polyline
          points={pts}
          fill="none"
          stroke={col}
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle
          cx={W - pad}
          cy={H - pad - ((H - 2 * pad) * (vals[vals.length - 1] - min)) / range}
          r="4"
          fill={col}
          stroke="#fff"
          stroke-width="2"
        />
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
        <span>{fmt(data[0]?.time)}</span>
        <span>{fmt(data[Math.floor(data.length / 2)]?.time)}</span>
        <span>{fmt(data[data.length - 1]?.time)}</span>
      </div>
    </div>
  );
});

// ─── NFT Card (4×8 grid cell) ─────────────────────────────────────────────────
const NftCard = component$<{
  nft: NftItem;
  native: string;
  onSelect$: PropFunction<(n: NftItem) => void>;
}>(({ nft, native, onSelect$ }) => {
  const price = lowestSell(nft.sellOffers, native);
  const offer = highestBuy(nft.buyOffers, native);
  const name = resolveNftName(nft);
  const isXls14 = nft.nftStandard === "XLS-14";

  return (
    <div
      class="nft-card"
      onClick$={() => onSelect$(nft)}
      style={{
        borderRadius: "14px",
        overflow: "hidden",
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.07)",
        cursor: "pointer",
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
    >
      <div
        style={{
          aspectRatio: "1",
          overflow: "hidden",
          background: "#f8fafc",
          position: "relative",
        }}
      >
        <NftImage src={nft.image || nft.resolvedUri || ""} alt={name} />
        {/* Standard badge */}
        <div
          style={{
            position: "absolute",
            top: "7px",
            left: "7px",
            background: isXls14 ? "#f59e0b" : "#2563eb",
            color: "#fff",
            fontSize: "9px",
            fontWeight: "800",
            padding: "2px 7px",
            borderRadius: "5px",
            letterSpacing: "0.06em",
          }}
        >
          {isXls14 ? "XLS-14" : "XLS-20"}
        </div>
        {/* Price overlay */}
        {price && (
          <div
            style={{
              position: "absolute",
              bottom: "7px",
              right: "7px",
              background: "rgba(17,24,39,0.82)",
              backdropFilter: "blur(6px)",
              color: "#fff",
              fontSize: "10px",
              fontWeight: "700",
              padding: "3px 8px",
              borderRadius: "7px",
            }}
          >
            {price.formatted}
          </div>
        )}
        {/* Collection */}
        {nft.collection && (
          <div
            style={{
              position: "absolute",
              top: "7px",
              right: "7px",
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(6px)",
              color: "#fff",
              fontSize: "9px",
              fontWeight: "600",
              padding: "2px 7px",
              borderRadius: "5px",
              maxWidth: "100px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {nft.collection}
          </div>
        )}
      </div>
      <div style={{ padding: "10px 12px 12px" }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: "700",
            color: "#111827",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginBottom: "2px",
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "#9ca3af",
            marginBottom: "8px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          by {trunc(nft.issuer)}
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
                fontSize: "9px",
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {price ? "Price" : offer ? "Best offer" : "—"}
            </div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: "700",
                color: price ? "#2563eb" : offer ? "#059669" : "#d1d5db",
              }}
            >
              {price ? price.formatted : offer ? offer.formatted : "No listing"}
            </div>
          </div>
          <div
            style={{ fontSize: "10px", color: "#9ca3af", textAlign: "right" }}
          >
            <div
              style={{
                fontSize: "9px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Offers
            </div>
            <div style={{ fontWeight: "700", color: "#374151" }}>
              {(nft.sellOffers?.length || 0) + (nft.buyOffers?.length || 0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── Token Row ────────────────────────────────────────────────────────────────
const TokenRow = component$<{
  token: TokenItem;
  rank: number;
  sparkData: number[];
  onSelect$: PropFunction<(t: TokenItem) => void>;
}>(({ token, rank, sparkData, onSelect$ }) => (
  <div
    class="tok-row"
    onClick$={() => onSelect$(token)}
    style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "11px 14px",
      borderRadius: "10px",
      cursor: "pointer",
      transition: "background 0.15s",
    }}
  >
    <div
      style={{
        width: "26px",
        fontSize: "12px",
        fontWeight: "700",
        color: "#9ca3af",
        textAlign: "center",
        flexShrink: "0",
      }}
    >
      {rank}
    </div>
    <div
      style={{
        width: "34px",
        height: "34px",
        borderRadius: "50%",
        background: "linear-gradient(135deg,#dbeafe,#bfdbfe)",
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
          width={34}
          height={34}
          loading="lazy"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "50%",
          }}
        />
      ) : (
        <span style={{ fontSize: "12px", fontWeight: "800", color: "#3b82f6" }}>
          {token.currencyDisplay.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
    <div style={{ flex: "1", minWidth: "0" }}>
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
        {token.domain || trunc(token.issuer)}
      </div>
    </div>
    <div style={{ textAlign: "right", minWidth: "78px", flexShrink: "0" }}>
      <div style={{ fontSize: "10px", color: "#9ca3af" }}>Price</div>
      <div style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>
        {token.priceUsd ? fmtUsd(token.priceUsd) : "—"}
      </div>
    </div>
    <div
      class="hide-sm"
      style={{ textAlign: "right", minWidth: "62px", flexShrink: "0" }}
    >
      <div style={{ fontSize: "10px", color: "#9ca3af" }}>24h</div>
      <div
        style={{
          fontSize: "13px",
          fontWeight: "700",
          color:
            token.change24h && token.change24h > 0
              ? "#10b981"
              : token.change24h && token.change24h < 0
                ? "#ef4444"
                : "#9ca3af",
        }}
      >
        {token.change24h
          ? `${token.change24h > 0 ? "+" : ""}${token.change24h.toFixed(1)}%`
          : "—"}
      </div>
    </div>
    <div class="hide-md" style={{ flexShrink: "0", minWidth: "80px" }}>
      {sparkData.length > 2 ? (
        <Spark data={sparkData} w={80} h={26} />
      ) : (
        <div
          style={{
            width: "80px",
            height: "26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "10px",
            color: "#e5e7eb",
          }}
        >
          —
        </div>
      )}
    </div>
    <div style={{ textAlign: "right", minWidth: "68px", flexShrink: "0" }}>
      <div style={{ fontSize: "10px", color: "#9ca3af" }}>Trustlines</div>
      <div style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>
        {token.trustlines.toLocaleString()}
      </div>
    </div>
  </div>
));

// ─── Pagination Bar ───────────────────────────────────────────────────────────
const Pagination = component$<{
  page: number;
  total: number;
  onPrev$: PropFunction<() => void>;
  onNext$: PropFunction<() => void>;
}>(({ page, total, onPrev$, onNext$ }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      paddingTop: "24px",
      borderTop: "1px solid rgba(0,0,0,0.06)",
      marginTop: "8px",
    }}
  >
    <button
      class="pag-btn"
      disabled={page <= 1}
      onClick$={onPrev$}
      style={{ opacity: page <= 1 ? "0.35" : "1" }}
    >
      ← Prev
    </button>
    <div style={{ display: "flex", gap: "4px" }}>
      {Array.from({ length: Math.min(7, total) }, (_, i) => {
        let p: number;
        if (total <= 7) p = i + 1;
        else if (page <= 4) p = i + 1;
        else if (page >= total - 3) p = total - 6 + i;
        else p = page - 3 + i;
        const active = p === page;
        return (
          <span
            key={p}
            style={{
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: active ? "800" : "500",
              background: active ? "#111827" : "rgba(0,0,0,0.03)",
              color: active ? "#fff" : "#6b7280",
              cursor: "pointer",
              border: active ? "none" : "1px solid rgba(0,0,0,0.07)",
            }}
          >
            {p}
          </span>
        );
      })}
    </div>
    <button
      class="pag-btn"
      disabled={page >= total}
      onClick$={onNext$}
      style={{ opacity: page >= total ? "0.35" : "1" }}
    >
      Next →
    </button>
  </div>
));

// ─── Action Buttons ───────────────────────────────────────────────────────────
const ActionButtons = component$<{
  token: TokenItem;
  walletAddress: string;
  walletType: string | null;
  network: string;
}>(({ token, walletAddress, walletType, network }) => {
  const status = useSignal<"idle" | "pending" | "success" | "error">("idle");
  const msg = useSignal("");
  const showQr = useSignal(false);
  const qrImg = useSignal("");

  const doTrustline = $(async () => {
    if (!walletAddress) {
      msg.value = "Connect a wallet first";
      status.value = "error";
      return;
    }
    status.value = "pending";
    msg.value = "Creating trustline…";
    const txjson = {
      TransactionType: "TrustSet",
      Account: walletAddress,
      LimitAmount: {
        currency: token.currency,
        issuer: token.issuer,
        value: "1000000000",
      },
    };
    if (walletType === "xaman") {
      const r = await createXamanPayload(txjson);
      if (r.success && r.qrPng) {
        qrImg.value = r.qrPng;
        showQr.value = true;
        msg.value = "Scan QR with Xaman";
      } else {
        status.value = "error";
        msg.value = r.error || "Failed";
      }
    } else {
      status.value = "error";
      msg.value = "Only supported via Xaman";
    }
  });

  const doBuy = $(async () => {
    if (!walletAddress) {
      msg.value = "Connect a wallet first";
      status.value = "error";
      return;
    }
    status.value = "pending";
    const txjson = {
      TransactionType: "OfferCreate",
      Account: walletAddress,
      TakerPays: { currency: token.currency, issuer: token.issuer, value: "1" },
      TakerGets: token.priceXrp
        ? String(Math.ceil(token.priceXrp * 1_000_000 * 1.02))
        : "1000000",
    };
    if (walletType === "xaman") {
      const r = await createXamanPayload(txjson);
      if (r.success && r.qrPng) {
        qrImg.value = r.qrPng;
        showQr.value = true;
        msg.value = "Scan QR to buy";
      } else {
        status.value = "error";
        msg.value = r.error || "Failed";
      }
    } else {
      status.value = "error";
      msg.value = "Use Xaman wallet";
    }
  });

  const doSwap = $(() => {
    const dex: Record<string, string> = {
      xrpl: `https://sologenic.org/trade?market=${encodeURIComponent(decodeCurrency(token.currency))}%2BXRP&network=mainnet`,
      xahau: "https://xahau.dex.trade/",
    };
    window.open(dex[network] || dex.xrpl, "_blank", "noopener");
  });

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
        {[
          {
            label: "+ Trustline",
            onClick: doTrustline,
            bg: "rgba(37,99,235,0.07)",
            col: "#2563eb",
            border: "rgba(37,99,235,0.25)",
          },
          {
            label: "Buy",
            onClick: doBuy,
            bg: "#10b981",
            col: "#fff",
            border: "transparent",
          },
          {
            label: "Swap ↗",
            onClick: doSwap,
            bg: "rgba(124,58,237,0.07)",
            col: "#7c3aed",
            border: "rgba(124,58,237,0.25)",
          },
        ].map((b) => (
          <button
            key={b.label}
            class="cursor-pointer"
            onClick$={b.onClick}
            disabled={status.value === "pending"}
            style={{
              flex: "1",
              padding: "10px 0",
              borderRadius: "11px",
              border: `1px solid ${b.border}`,
              background: b.bg,
              color: b.col,
              fontSize: "13px",
              fontWeight: "700",
              transition: "all 0.15s",
            }}
          >
            {b.label}
          </button>
        ))}
      </div>
      {msg.value && (
        <div
          style={{
            marginTop: "8px",
            padding: "8px 12px",
            borderRadius: "9px",
            fontSize: "12px",
            background:
              status.value === "error"
                ? "rgba(239,68,68,0.07)"
                : "rgba(37,99,235,0.07)",
            color: status.value === "error" ? "#dc2626" : "#2563eb",
          }}
        >
          {msg.value}
        </div>
      )}
      {showQr.value && qrImg.value && (
        <>
          <div
            class="fixed inset-0 z-10000"
            style={{
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(6px)",
            }}
            onClick$={() => {
              showQr.value = false;
              status.value = "idle";
              msg.value = "";
            }}
          />
          <div
            class="fixed z-10001"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
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
              src={qrImg.value}
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
                status.value = "idle";
                msg.value = "";
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

// ─── Token Detail Modal ───────────────────────────────────────────────────────
const TokenModal = component$<{
  token: TokenItem;
  network: string;
  native: string;
  walletAddress: string;
  walletType: string | null;
  onClose$: PropFunction<() => void>;
}>(({ token, network, native, walletAddress, walletType, onClose$ }) => {
  const chartData = useSignal<TokenChartData | null>(null);
  const loading = useSignal(true);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    loading.value = true;
    try {
      chartData.value = await fetchChartServer(
        network,
        token.currency,
        token.issuer,
      );
    } catch {
      chartData.value = null;
    }
    loading.value = false;
  });

  return (
    <>
      <div
        class="fixed inset-0 z-9998"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)" }}
        onClick$={onClose$}
      />
      <div
        class="fixed z-9999 overflow-y-auto"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: "min(640px,calc(100vw - 32px))",
          maxHeight: "85vh",
          background: "#fff",
          borderRadius: "24px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
          animation: "modalIn 0.22s ease-out",
        }}
        onClick$={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "26px" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              marginBottom: "22px",
            }}
          >
            <div
              style={{
                width: "50px",
                height: "50px",
                borderRadius: "50%",
                background: "linear-gradient(135deg,#dbeafe,#bfdbfe)",
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
                  width={50}
                  height={50}
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
                    fontSize: "17px",
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
                  fontSize: "21px",
                  fontWeight: "800",
                  color: "#111827",
                  lineHeight: "1.2",
                }}
              >
                {token.currencyDisplay}
              </h2>
              <div style={{ fontSize: "13px", color: "#6b7280" }}>
                {token.domain || trunc(token.issuer)}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: "0" }}>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: "800",
                  color: "#111827",
                }}
              >
                {token.priceUsd ? fmtUsd(token.priceUsd) : "—"}
              </div>
              {!!token.change24h && (
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
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                background: "rgba(0,0,0,0.05)",
                border: "none",
                color: "#6b7280",
                fontSize: "15px",
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
          <div style={{ marginBottom: "18px" }}>
            {loading.value ? (
              <div
                style={{
                  height: "180px",
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
            ) : (
              <DetailChart
                data={chartData.value?.prices ?? []}
                change24h={chartData.value?.change24h}
              />
            )}
          </div>

          {/* Stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "8px",
              marginBottom: "18px",
            }}
          >
            {[
              {
                label: "Market Cap",
                value: token.marketCap ? fmtUsd(token.marketCap) : "—",
              },
              {
                label: "24h Volume",
                value: token.volume24h ? fmtUsd(token.volume24h) : "—",
              },
              {
                label: `Price (${native})`,
                value: token.priceXrp
                  ? token.priceXrp < 0.001
                    ? token.priceXrp.toExponential(2)
                    : token.priceXrp.toFixed(6)
                  : "—",
              },
              { label: "Total Supply", value: fmtSupply(token.totalSupply) },
              { label: "Trustlines", value: token.trustlines.toLocaleString() },
              { label: "Holders", value: token.holders.toLocaleString() },
              {
                label: "Transfer Fee",
                value: token.transferRate
                  ? token.transferRate.toFixed(2) + "%"
                  : "0%",
              },
              { label: "Domain", value: token.domain || "—" },
              { label: "Issuer", value: trunc(token.issuer) },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  padding: "9px 11px",
                  borderRadius: "10px",
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
                    marginBottom: "3px",
                    fontWeight: "600",
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: "700",
                    color: "#111827",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Links */}
          <div
            style={{
              display: "flex",
              gap: "7px",
              marginBottom: "14px",
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
              { label: "DexScreener", url: "https://dexscreener.com/xrpl" },
            ].map((l) => (
              <a
                key={l.label}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "5px 13px",
                  borderRadius: "7px",
                  border: "1px solid rgba(0,0,0,0.08)",
                  fontSize: "11px",
                  fontWeight: "600",
                  color: "#6b7280",
                  textDecoration: "none",
                }}
              >
                {l.label} ↗
              </a>
            ))}
          </div>

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
});

// ─── NFT Detail Modal ─────────────────────────────────────────────────────────
const NftModal = component$<{
  nft: NftItem;
  native: string;
  walletAddress: string;
  walletType: string | null;
  onClose$: PropFunction<() => void>;
}>(({ nft, native, walletAddress, walletType, onClose$ }) => {
  const price = lowestSell(nft.sellOffers, native);
  const offer = highestBuy(nft.buyOffers, native);
  const name = resolveNftName(nft);
  const status = useSignal<"idle" | "pending" | "error">("idle");
  const msg = useSignal("");
  const showQr = useSignal(false);
  const qrImg = useSignal("");

  const doBuy = $(async () => {
    if (!walletAddress) {
      msg.value = "Connect a wallet first";
      status.value = "error";
      return;
    }
    if (!nft.sellOffers?.length) {
      msg.value = "No sell offers";
      status.value = "error";
      return;
    }
    status.value = "pending";
    const txjson = {
      TransactionType: "NFTokenAcceptOffer",
      Account: walletAddress,
      NFTokenSellOffer: nft.sellOffers[0].index,
    };
    if (walletType === "xaman") {
      const r = await createXamanPayload(txjson);
      if (r.success && r.qrPng) {
        qrImg.value = r.qrPng;
        showQr.value = true;
        msg.value = "Scan QR to buy NFT";
      } else {
        status.value = "error";
        msg.value = r.error || "Failed";
      }
    } else {
      status.value = "error";
      msg.value = "Only Xaman supported for NFT purchase";
    }
  });

  const isXls14 =
    nft.nftStandard === "XLS-14" || (nft.nftStandard as string) === "xls14";

  return (
    <>
      <div
        class="fixed inset-0 z-9998"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)" }}
        onClick$={onClose$}
      />
      <div
        class="fixed z-9999 overflow-y-auto"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: "min(640px,calc(100vw - 32px))",
          maxHeight: "85vh",
          background: "#fff",
          borderRadius: "24px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
          animation: "modalIn 0.22s ease-out",
        }}
        onClick$={(e) => e.stopPropagation()}
      >
        {/* Hero image */}
        <div
          style={{
            aspectRatio: "16/9",
            overflow: "hidden",
            background: "#f3f4f6",
            borderRadius: "24px 24px 0 0",
            position: "relative",
          }}
        >
          <NftImage src={nft.image || nft.resolvedUri || ""} alt={name} />
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
          <div
            style={{
              position: "absolute",
              top: "12px",
              left: "12px",
              background: isXls14 ? "#f59e0b" : "#2563eb",
              color: "#fff",
              fontSize: "10px",
              fontWeight: "800",
              padding: "3px 9px",
              borderRadius: "7px",
            }}
          >
            {(nft.nftStandard || "XLS-20").toUpperCase()}
          </div>
        </div>

        <div style={{ padding: "22px" }}>
          <h2
            style={{
              fontSize: "21px",
              fontWeight: "700",
              color: "#111827",
              marginBottom: "3px",
            }}
          >
            {name}
          </h2>
          {nft.collection && (
            <div
              style={{
                fontSize: "13px",
                color: "#6b7280",
                marginBottom: "14px",
              }}
            >
              Collection: <strong>{nft.collection}</strong>
            </div>
          )}
          {nft.description && (
            <p
              style={{
                fontSize: "13px",
                color: "#374151",
                lineHeight: "1.6",
                marginBottom: "18px",
              }}
            >
              {nft.description}
            </p>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              marginBottom: "18px",
            }}
          >
            {[
              { label: "Price", value: price?.formatted || "Not listed" },
              { label: "Best Offer", value: offer?.formatted || "No offers" },
              { label: "Issuer", value: trunc(nft.issuer) },
              { label: "Owner", value: trunc(nft.owner) },
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
                value: String(
                  (nft.sellOffers?.length || 0) + (nft.buyOffers?.length || 0),
                ),
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  padding: "9px 12px",
                  borderRadius: "10px",
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
                    marginBottom: "3px",
                    fontWeight: "600",
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#111827",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              padding: "11px 13px",
              borderRadius: "10px",
              background: "rgba(0,0,0,0.02)",
              border: "1px solid rgba(0,0,0,0.04)",
              marginBottom: "14px",
            }}
          >
            <div
              style={{
                fontSize: "9px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#9ca3af",
                marginBottom: "3px",
                fontWeight: "600",
              }}
            >
              NFToken ID
            </div>
            <div
              style={{
                fontSize: "10px",
                fontFamily: "monospace",
                color: "#374151",
                wordBreak: "break-all",
                lineHeight: "1.5",
              }}
            >
              {nft.nftokenId}
            </div>
          </div>

          {nft.sellOffers?.length > 0 && (
            <button
              class="cursor-pointer"
              onClick$={doBuy}
              disabled={status.value === "pending" || !walletAddress}
              style={{
                width: "100%",
                padding: "12px 0",
                borderRadius: "13px",
                border: "none",
                background: walletAddress ? "#10b981" : "#d1d5db",
                color: "#fff",
                fontSize: "14px",
                fontWeight: "700",
                marginBottom: "8px",
                transition: "all 0.2s",
              }}
            >
              {status.value === "pending"
                ? "Processing…"
                : walletAddress
                  ? `Buy for ${price?.formatted || "listed price"}`
                  : "Connect wallet to buy"}
            </button>
          )}
          {msg.value && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "9px",
                fontSize: "12px",
                background:
                  status.value === "error"
                    ? "rgba(239,68,68,0.07)"
                    : "rgba(37,99,235,0.07)",
                color: status.value === "error" ? "#dc2626" : "#2563eb",
              }}
            >
              {msg.value}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "7px",
              marginTop: "14px",
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
            ].map((l) => (
              <a
                key={l.label}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "5px 13px",
                  borderRadius: "7px",
                  border: "1px solid rgba(0,0,0,0.08)",
                  fontSize: "11px",
                  fontWeight: "600",
                  color: "#6b7280",
                  textDecoration: "none",
                }}
              >
                {l.label} ↗
              </a>
            ))}
          </div>
        </div>
      </div>

      {showQr.value && qrImg.value && (
        <>
          <div
            class="fixed inset-0 z-10000"
            style={{
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(6px)",
            }}
            onClick$={() => {
              showQr.value = false;
              status.value = "idle";
              msg.value = "";
            }}
          />
          <div
            class="fixed z-10001"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
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
              src={qrImg.value}
              alt="Xaman QR"
              width={220}
              height={220}
              style={{ display: "block", margin: "0 auto 16px" }}
            />
            <button
              class="cursor-pointer"
              onClick$={() => {
                showQr.value = false;
                status.value = "idle";
                msg.value = "";
              }}
              style={{
                marginTop: "4px",
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

// ─── Skeleton loader for instant paint ───────────────────────────────────────
const NftSkeleton = component$(() => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "14px",
    }}
  >
    {Array.from({ length: 8 }).map((_, i) => (
      <div
        key={i}
        style={{
          borderRadius: "14px",
          overflow: "hidden",
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div
          class="skeleton"
          style={{ aspectRatio: "1", background: "#f3f4f6" }}
        />
        <div style={{ padding: "10px 12px 12px" }}>
          <div
            class="skeleton"
            style={{
              height: "14px",
              borderRadius: "6px",
              marginBottom: "6px",
              width: "70%",
            }}
          />
          <div
            class="skeleton"
            style={{ height: "11px", borderRadius: "5px", width: "45%" }}
          />
        </div>
      </div>
    ))}
  </div>
));

const TokenSkeleton = component$(() => (
  <div>
    {Array.from({ length: 8 }).map((_, i) => (
      <div
        key={i}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "11px 14px",
          borderRadius: "10px",
        }}
      >
        <div
          class="skeleton"
          style={{ width: "26px", height: "14px", borderRadius: "4px" }}
        />
        <div
          class="skeleton"
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            flexShrink: "0",
          }}
        />
        <div
          style={{
            flex: "1",
            display: "flex",
            flexDirection: "column",
            gap: "5px",
          }}
        >
          <div
            class="skeleton"
            style={{ height: "13px", borderRadius: "5px", width: "40%" }}
          />
          <div
            class="skeleton"
            style={{ height: "10px", borderRadius: "4px", width: "28%" }}
          />
        </div>
        <div
          class="skeleton"
          style={{ width: "60px", height: "14px", borderRadius: "5px" }}
        />
        <div
          class="skeleton hide-sm"
          style={{ width: "50px", height: "14px", borderRadius: "5px" }}
        />
        <div
          class="skeleton hide-md"
          style={{ width: "80px", height: "26px", borderRadius: "6px" }}
        />
        <div
          class="skeleton"
          style={{ width: "60px", height: "14px", borderRadius: "5px" }}
        />
      </div>
    ))}
  </div>
));

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════════════════════════
export default component$(() => {
  const { activeNetwork } = useNetworkContext();
  const wallet = useWalletContext();
  const networkConfig = useComputed$(() => NETWORK_CONFIG[activeNetwork.value]);
  const native = useComputed$(
    () => NETWORK_CONFIG[activeNetwork.value].nativeCurrency,
  );

  // SSR data (arrives with HTML — zero wait)
  const tokenData = useTokenLoader();
  const nftData = useNftLoader();

  // UI tabs
  const mode = useSignal<"tokens" | "nfts">("tokens");
  const subTab = useSignal<"featured" | "browse">("featured");

  // Live token state
  const tokens = useSignal<TokenItem[]>([]);
  const tokLoading = useSignal(false);
  const tokError = useSignal("");
  const tokSearch = useSignal("");
  const tokPage = useSignal(1);
  const selectedToken = useSignal<TokenItem | null>(null);
  const tokLastUpdated = useSignal(0);

  // NFT state — store ALL then paginate client-side
  const nfts = useSignal<NftItem[]>([]);
  const nftTotalCount = useSignal(0); // total from server (may be larger than loaded)
  const nftLoading = useSignal(false);
  const nftError = useSignal("");
  const nftSearch = useSignal("");
  const nftPage = useSignal(1);
  const selectedNft = useSignal<NftItem | null>(null);

  // ── Hydrate immediately from SSR data (synchronous, no network) ──────────
  useTask$(({ track }) => {
    track(() => tokenData.value);
    if (tokenData.value?.tokens?.length) {
      tokens.value = tokenData.value.tokens.map((t) => ({
        ...t,
        currencyDisplay: t.currencyDisplay || decodeCurrency(t.currency),
      }));
    }
  });

  useTask$(({ track }) => {
    track(() => nftData.value);
    if (nftData.value?.nfts?.length) {
      // Enrich NFT data: resolve names, normalize standard flags
      nfts.value = nftData.value.nfts.map((n) => ({
        ...n,
        name: resolveNftName(n),
        nftStandard: n.nftStandard || (n.nftokenId ? "XLS-20" : "XLS-14"),
        sellOffers: n.sellOffers || [],
        buyOffers: n.buyOffers || [],
      }));
      nftTotalCount.value = nftData.value.count || nftData.value.nfts.length;
    }
  });

  // ── Client-side data fetchers ─────────────────────────────────────────────

  /**
   * Fetches ALL NFTs (both XLS-14 and XLS-20) using paginated API calls,
   * updating the count immediately so the UI shows total before all are loaded.
   */
  const fetchAllNfts = $(async (net: string) => {
    nftLoading.value = true;
    nftError.value = "";
    nftPage.value = 1;
    let allNfts: NftItem[] = [];
    let marker: string | undefined;
    let pageNum = 0;

    try {
      // First call — gets count + first batch
      do {
        pageNum++;
        const params = new URLSearchParams({
          network: net,
          type: "nfts",
          limit: "200",
        });
        if (marker) params.set("marker", marker);
        const res = await fetch(`/api/marketplace/all?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          nfts?: NftItem[];
          count?: number;
          total?: number;
          marker?: string;
        };

        const batch = (data.nfts || []).map((n) => ({
          ...n,
          name: resolveNftName(n),
          nftStandard: n.nftStandard || (n.nftokenId ? "XLS-20" : "XLS-14"),
          sellOffers: n.sellOffers || [],
          buyOffers: n.buyOffers || [],
        }));

        allNfts = [...allNfts, ...batch];
        nfts.value = allNfts; // update UI incrementally
        nftTotalCount.value = data.total || data.count || allNfts.length;
        marker = data.marker;

        // Stop after 10 pages (2000 NFTs) to avoid infinite loop
        if (pageNum >= 10) break;
      } while (marker);
    } catch (err: any) {
      nftError.value = err.message || "Failed to load NFTs";
    } finally {
      nftLoading.value = false;
    }
  });

  /**
   * Fetches tokens once and sets up a polling interval for live updates.
   * Merges new price data with existing tokens to avoid full re-render.
   */
  const fetchTokens = $(async (net: string) => {
    tokLoading.value = true;
    tokError.value = "";
    try {
      const res = await fetch(
        `/api/marketplace/all?network=${net}&type=tokens&limit=200`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { tokens?: TokenItem[] };
      tokens.value = (data.tokens || []).map((t) => ({
        ...t,
        currencyDisplay: t.currencyDisplay || decodeCurrency(t.currency),
      }));
      tokPage.value = 1;
      tokLastUpdated.value = Date.now();
    } catch (err: any) {
      tokError.value = err.message || "Failed to load tokens";
    } finally {
      tokLoading.value = false;
    }
  });

  // ── Live token polling (client-side only) ─────────────────────────────────
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    // If SSR gave us no tokens, do an initial fetch
    if (!tokens.value.length) {
      fetchTokens(activeNetwork.value);
    }

    // Poll every TOKEN_REFRESH_MS to keep prices live
    const interval = setInterval(async () => {
      if (document.hidden) return; // don't poll when tab is hidden
      try {
        const res = await fetch(
          `/api/marketplace/all?network=${activeNetwork.value}&type=tokens&limit=200`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { tokens?: TokenItem[] };
        if (data.tokens?.length) {
          // Merge: preserve order, update prices/change24h in place
          const newMap = new Map(
            data.tokens.map((t) => [`${t.currency}:${t.issuer}`, t]),
          );
          tokens.value = tokens.value.map((t) => {
            const fresh = newMap.get(`${t.currency}:${t.issuer}`);
            return fresh
              ? { ...t, ...fresh, currencyDisplay: t.currencyDisplay }
              : t;
          });
          // Add any new tokens
          data.tokens.forEach((t) => {
            const key = `${t.currency}:${t.issuer}`;
            if (
              !tokens.value.find((x) => `${x.currency}:${x.issuer}` === key)
            ) {
              tokens.value = [
                ...tokens.value,
                {
                  ...t,
                  currencyDisplay:
                    t.currencyDisplay || decodeCurrency(t.currency),
                },
              ];
            }
          });
          tokLastUpdated.value = Date.now();
        }
      } catch {
        /* silent */
      }
    }, TOKEN_REFRESH_MS);

    cleanup(() => clearInterval(interval));
  });

  // ── On network change: re-fetch both ──────────────────────────────────────
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const net = track(() => activeNetwork.value);
    const ssrNet = tokenData.value?.network || "xrpl";
    if (net !== ssrNet) {
      fetchTokens(net);
      fetchAllNfts(net);
      subTab.value = "featured";
      nftPage.value = 1;
      tokPage.value = 1;
      nftSearch.value = "";
      tokSearch.value = "";
    }
  });

  const switchNetwork = $((net: "xrpl" | "xahau") => {
    if (activeNetwork.value !== net) activeNetwork.value = net;
  });

  // ── NFT computed ──────────────────────────────────────────────────────────
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

  const featuredNfts = useComputed$(() =>
    nfts.value
      .filter((n) => n.sellOffers?.length > 0 && (n.image || n.resolvedUri))
      .slice(0, 8),
  );
  const topSales = useComputed$(() =>
    [...nfts.value]
      .filter((n) => n.sellOffers?.length > 0)
      .sort((a, b) => {
        const av =
          typeof a.sellOffers[0]?.amount === "string"
            ? Number(a.sellOffers[0].amount)
            : 0;
        const bv =
          typeof b.sellOffers[0]?.amount === "string"
            ? Number(b.sellOffers[0].amount)
            : 0;
        return bv - av;
      })
      .slice(0, 8),
  );
  const trendingNfts = useComputed$(() =>
    [...nfts.value]
      .sort(
        (a, b) =>
          (b.buyOffers?.length || 0) +
          (b.sellOffers?.length || 0) -
          ((a.buyOffers?.length || 0) + (a.sellOffers?.length || 0)),
      )
      .slice(0, 8),
  );

  const nftStats = useComputed$(() => {
    const isXls14 = (n: NftItem) =>
      n.nftStandard === "XLS-14" || (n.nftStandard as string) === "xls14";
    return {
      total: nftTotalCount.value || nfts.value.length,
      loaded: nfts.value.length,
      listed: nfts.value.filter((n) => n.sellOffers?.length > 0).length,
      xls14: nfts.value.filter((n) => isXls14(n)).length,
      xls20: nfts.value.filter((n) => !isXls14(n)).length,
      collections: new Set(nfts.value.map((n) => n.collection).filter(Boolean))
        .size,
    };
  });

  // ── Token computed ────────────────────────────────────────────────────────
  const tokFiltered = useComputed$(() => {
    const q = tokSearch.value.toLowerCase();
    if (!q) return tokens.value;
    return tokens.value.filter(
      (t) =>
        t.currencyDisplay?.toLowerCase().includes(q) ||
        t.currency?.toLowerCase().includes(q) ||
        t.issuer?.toLowerCase().includes(q) ||
        t.domain?.toLowerCase().includes(q),
    );
  });

  const tokPaginated = useComputed$(() => {
    const s = (tokPage.value - 1) * TOK_PAGE_SIZE;
    return tokFiltered.value.slice(s, s + TOK_PAGE_SIZE);
  });

  const tokTotalPages = useComputed$(() =>
    Math.max(1, Math.ceil(tokFiltered.value.length / TOK_PAGE_SIZE)),
  );

  const featuredTokens = useComputed$(() =>
    tokens.value.filter((t) => t.priceUsd && t.priceUsd > 0).slice(0, 10),
  );
  const topByTrustlines = useComputed$(() =>
    [...tokens.value]
      .sort((a, b) => (b.trustlines || 0) - (a.trustlines || 0))
      .slice(0, 10),
  );

  const tokenSparks = useComputed$(() => {
    const map: Record<string, number[]> = {};
    tokens.value.forEach((t) => {
      const key = `${t.currency}:${t.issuer}`;
      if (t.sparkline?.length) {
        map[key] = t.sparkline;
        return;
      }
      // Deterministic pseudo-sparkline from trustlines seed
      const seed = t.trustlines || 1;
      const pts: number[] = [];
      let v = seed;
      for (let i = 0; i < 20; i++) {
        v = Math.max(
          0,
          v + ((((seed * (i + 1) * 7) % 100) - 50) / 50) * seed * 0.08,
        );
        pts.push(v);
      }
      map[key] = pts;
    });
    return map;
  });

  const tokStats = useComputed$(() => ({
    total: tokens.value.length,
    withPrice: tokens.value.filter((t) => t.priceUsd && t.priceUsd > 0).length,
    totalTrustlines: tokens.value.reduce((s, t) => s + (t.trustlines || 0), 0),
  }));

  // ── Helpers for relative time ─────────────────────────────────────────────
  const relativeUpdate = useComputed$(() => {
    if (!tokLastUpdated.value) return "";
    const secs = Math.floor((Date.now() - tokLastUpdated.value) / 1000);
    if (secs < 5) return "just now";
    if (secs < 60) return `${secs}s ago`;
    return `${Math.floor(secs / 60)}m ago`;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div class="mp-root" style={{ minHeight: "100vh", paddingTop: "64px" }}>
      <style
        dangerouslySetInnerHTML={`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes modalIn { from { opacity:0; transform:translate(-50%,-50%) scale(0.95); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes countUp { from{opacity:0;transform:scale(0.9)} to{opacity:1;transform:scale(1)} }

        .skeleton {
          background: linear-gradient(90deg, #f3f4f6 25%, #e9eaec 50%, #f3f4f6 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
        .nft-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.09); }
        .tok-row:hover { background: rgba(37,99,235,0.03); }
        .pag-btn { padding: 7px 16px; border-radius: 9px; border: 1px solid rgba(0,0,0,0.1); background: #fff; font-size: 13px; font-weight: 600; color: #374151; cursor: pointer; transition: all 0.15s; }
        .pag-btn:hover:not(:disabled) { background: #111827; color: #fff; border-color: #111827; }
        .stat-card { animation: countUp 0.4s ease both; }
        .section-fade { animation: fadeIn 0.5s ease both; }
        .live-dot { width: 7px; height: 7px; background: #10b981; border-radius: 50%; position: relative; }
        .live-dot::after { content:''; position:absolute; inset:-3px; border-radius:50%; background: #10b981; opacity:0.4; animation: ping 1.5s cubic-bezier(0,0,0.2,1) infinite; }
        @keyframes ping { 75%,100%{transform:scale(2.2);opacity:0;} }
        @media (max-width: 640px) { .hide-sm { display: none !important; } }
        @media (max-width: 900px) { .hide-md { display: none !important; } }
        @media (max-width: 700px) { .nft-grid-4 { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 440px) { .nft-grid-4 { grid-template-columns: repeat(1,1fr) !important; } }
      `}
      />

      {/* ── Modals ── */}
      {selectedToken.value && (
        <TokenModal
          token={selectedToken.value}
          network={activeNetwork.value}
          native={native.value}
          walletAddress={wallet.address.value}
          walletType={wallet.walletType.value}
          onClose$={() => {
            selectedToken.value = null;
          }}
        />
      )}
      {selectedNft.value && (
        <NftModal
          nft={selectedNft.value}
          native={native.value}
          walletAddress={wallet.address.value}
          walletType={wallet.walletType.value}
          onClose$={() => {
            selectedNft.value = null;
          }}
        />
      )}

      {/* ── Page Header ── */}
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            fontSize: "30px",
            fontWeight: "800",
            color: "#111827",
            letterSpacing: "-0.03em",
            marginBottom: "6px",
          }}
        >
          Marketplace
        </h1>
        <p style={{ fontSize: "15px", color: "#6b7280" }}>
          Explore NFTs and tokens on{" "}
          <strong style={{ color: networkConfig.value.color }}>
            {networkConfig.value.label}
          </strong>
        </p>
      </div>

      {/* ── 3-tier tab bar ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginBottom: "24px",
        }}
      >
        {/* Network row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              background: "rgba(0,0,0,0.04)",
              borderRadius: "11px",
              padding: "3px",
              gap: "3px",
            }}
          >
            {(["xrpl", "xahau"] as const).map((net) => {
              const cfg = NETWORK_CONFIG[net];
              const active = activeNetwork.value === net;
              return (
                <button
                  key={net}
                  class="cursor-pointer"
                  style={{
                    padding: "7px 18px",
                    borderRadius: "9px",
                    border: "none",
                    fontSize: "13px",
                    fontWeight: "700",
                    background: active ? cfg.color : "transparent",
                    color: active ? "#fff" : "#6b7280",
                    transition: "all 0.18s",
                  }}
                  onClick$={() => switchNetwork(net)}
                >
                  {cfg.shortLabel}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Live indicator for tokens */}
            {mode.value === "tokens" && tokLastUpdated.value > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11px",
                  color: "#9ca3af",
                }}
              >
                <div class="live-dot" />
                <span>Updated {relativeUpdate.value}</span>
              </div>
            )}
            <button
              class="cursor-pointer"
              style={{
                padding: "7px 14px",
                borderRadius: "9px",
                border: "1px solid rgba(0,0,0,0.08)",
                background: "#fff",
                fontSize: "12px",
                fontWeight: "600",
                color: "#374151",
              }}
              onClick$={() => {
                fetchAllNfts(activeNetwork.value);
                fetchTokens(activeNetwork.value);
              }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Mode + Sub-tab row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              background: "rgba(0,0,0,0.04)",
              borderRadius: "11px",
              padding: "3px",
              gap: "3px",
            }}
          >
            {(["tokens", "nfts"] as const).map((m) => (
              <button
                key={m}
                class="cursor-pointer"
                style={{
                  padding: "7px 18px",
                  borderRadius: "9px",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: "600",
                  background: mode.value === m ? "#111827" : "transparent",
                  color: mode.value === m ? "#fff" : "#6b7280",
                  transition: "all 0.18s",
                }}
                onClick$={() => {
                  mode.value = m;
                  subTab.value = "featured";
                }}
              >
                {m === "nfts" ? "🖼 NFTs" : "🪙 Tokens"}
              </button>
            ))}
          </div>
          <div style={{ display: "inline-flex", gap: "3px" }}>
            {(["featured", "browse"] as const).map((tab) => (
              <button
                key={tab}
                class="cursor-pointer"
                style={{
                  padding: "7px 14px",
                  borderRadius: "9px",
                  border:
                    subTab.value === tab
                      ? "1px solid rgba(0,0,0,0.1)"
                      : "1px solid transparent",
                  fontSize: "12px",
                  fontWeight: "600",
                  background: subTab.value === tab ? "#fff" : "transparent",
                  color: subTab.value === tab ? "#111827" : "#9ca3af",
                  boxShadow:
                    subTab.value === tab
                      ? "0 1px 3px rgba(0,0,0,0.06)"
                      : "none",
                  transition: "all 0.18s",
                }}
                onClick$={() => (subTab.value = tab)}
              >
                {tab === "featured" ? "✨ Featured" : "🔍 Browse All"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "10px",
          marginBottom: "28px",
        }}
      >
        {(mode.value === "tokens"
          ? [
              {
                label: "Total Tokens",
                value: tokStats.value.total.toLocaleString(),
                color: "#2563eb",
              },
              {
                label: "With Price",
                value: tokStats.value.withPrice.toLocaleString(),
                color: "#10b981",
              },
              {
                label: "Total Trustlines",
                value:
                  tokStats.value.totalTrustlines >= 1e6
                    ? (tokStats.value.totalTrustlines / 1e6).toFixed(1) + "M"
                    : tokStats.value.totalTrustlines.toLocaleString(),
                color: "#7c3aed",
              },
            ]
          : [
              {
                label: "Total NFTs",
                value: nftStats.value.total.toLocaleString(),
                color: "#2563eb",
              },
              {
                label: "Loaded",
                value: nftStats.value.loaded.toLocaleString(),
                color: "#6b7280",
              },
              {
                label: "Listed",
                value: nftStats.value.listed.toLocaleString(),
                color: "#10b981",
              },
              {
                label: "XLS-14",
                value: nftStats.value.xls14.toLocaleString(),
                color: "#f59e0b",
              },
              {
                label: "XLS-20",
                value: nftStats.value.xls20.toLocaleString(),
                color: "#2563eb",
              },
              {
                label: "Collections",
                value: nftStats.value.collections.toLocaleString(),
                color: "#7c3aed",
              },
            ]
        ).map((s) => (
          <div
            key={s.label}
            class="stat-card"
            style={{
              padding: "14px 16px",
              borderRadius: "14px",
              background: "rgba(0,0,0,0.02)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#9ca3af",
                fontWeight: "600",
                marginBottom: "5px",
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: "22px",
                fontWeight: "800",
                color: s.color,
                letterSpacing: "-0.02em",
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
        {/* tokens stats also rendered here */}
        {
          mode.value === "tokens" &&
            [
              {
                label: "Total Tokens",
                value: tokStats.value.total.toLocaleString(),
                color: "#2563eb",
              },
              {
                label: "With Price",
                value: tokStats.value.withPrice.toLocaleString(),
                color: "#10b981",
              },
              {
                label: "Total Trustlines",
                value:
                  tokStats.value.totalTrustlines >= 1e6
                    ? (tokStats.value.totalTrustlines / 1e6).toFixed(1) + "M"
                    : tokStats.value.totalTrustlines.toLocaleString(),
                color: "#7c3aed",
              },
            ].filter(() => false) /* already rendered above */
        }
      </div>

      {/* Loading / Error banners */}
      {(mode.value === "tokens" ? tokLoading.value : nftLoading.value) &&
        !nfts.value.length &&
        !tokens.value.length && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "16px 20px",
              borderRadius: "12px",
              background: "rgba(37,99,235,0.05)",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                width: "20px",
                height: "20px",
                border: "2px solid #bfdbfe",
                borderTopColor: "#2563eb",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
                flexShrink: "0",
              }}
            />
            <span
              style={{ fontSize: "14px", color: "#2563eb", fontWeight: "500" }}
            >
              Loading {mode.value === "tokens" ? "tokens" : "NFTs"} from{" "}
              {networkConfig.value.label}…
            </span>
          </div>
        )}
      {(mode.value === "tokens" ? tokError.value : nftError.value) && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "11px",
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.15)",
            color: "#dc2626",
            fontSize: "14px",
            marginBottom: "20px",
          }}
        >
          {mode.value === "tokens" ? tokError.value : nftError.value}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
           TOKENS — FEATURED
         ══════════════════════════════════════════════════════ */}
      {mode.value === "tokens" && subTab.value === "featured" && (
        <div class="section-fade">
          {/* Skeletons while loading */}
          {tokLoading.value && !tokens.value.length && (
            <section style={{ marginBottom: "40px" }}>
              <div
                style={{
                  height: "22px",
                  width: "180px",
                  borderRadius: "6px",
                  marginBottom: "18px",
                }}
                class="skeleton"
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
                  gap: "14px",
                }}
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "18px",
                      borderRadius: "16px",
                      border: "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    <div
                      class="skeleton"
                      style={{
                        height: "110px",
                        borderRadius: "10px",
                        marginBottom: "12px",
                      }}
                    />
                    <div
                      class="skeleton"
                      style={{
                        height: "13px",
                        width: "60%",
                        borderRadius: "5px",
                        marginBottom: "7px",
                      }}
                    />
                    <div
                      class="skeleton"
                      style={{
                        height: "11px",
                        width: "40%",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Top Tokens featured grid */}
          {featuredTokens.value.length > 0 && (
            <section style={{ marginBottom: "44px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "4px",
                }}
              >
                <h2
                  style={{
                    fontSize: "19px",
                    fontWeight: "700",
                    color: "#111827",
                  }}
                >
                  🔥 Top Tokens
                </h2>
                {tokLoading.value && (
                  <div
                    style={{
                      width: "16px",
                      height: "16px",
                      border: "2px solid #e5e7eb",
                      borderTopColor: "#2563eb",
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                )}
              </div>
              <p
                style={{
                  fontSize: "13px",
                  color: "#9ca3af",
                  marginBottom: "18px",
                }}
              >
                Tokens with live price data on {networkConfig.value.label}
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))",
                  gap: "12px",
                }}
              >
                {featuredTokens.value.map((tok, i) => {
                  const key = `${tok.currency}:${tok.issuer}`;
                  const spark = tokenSparks.value[key] || [];
                  const isHero = i === 0;
                  return (
                    <div
                      key={key}
                      class="cursor-pointer"
                      onClick$={() => (selectedToken.value = tok)}
                      style={{
                        padding: "16px",
                        borderRadius: "15px",
                        background: isHero
                          ? "linear-gradient(135deg,#111827,#1e3a5f)"
                          : "#fff",
                        border: isHero ? "none" : "1px solid rgba(0,0,0,0.06)",
                        color: isHero ? "#fff" : "#111827",
                        boxShadow: isHero
                          ? "0 8px 24px rgba(0,0,0,0.15)"
                          : "0 1px 3px rgba(0,0,0,0.04)",
                        transition: "transform 0.2s, box-shadow 0.2s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "9px",
                          marginBottom: "12px",
                        }}
                      >
                        <div
                          style={{
                            width: "34px",
                            height: "34px",
                            borderRadius: "50%",
                            background: isHero
                              ? "rgba(255,255,255,0.14)"
                              : "linear-gradient(135deg,#dbeafe,#bfdbfe)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                            flexShrink: "0",
                          }}
                        >
                          {tok.logoUrl ? (
                            <img
                              src={tok.logoUrl}
                              alt={tok.currencyDisplay}
                              width={34}
                              height={34}
                              loading="lazy"
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
                                fontSize: "12px",
                                fontWeight: "800",
                                color: isHero ? "#fff" : "#3b82f6",
                              }}
                            >
                              {tok.currencyDisplay.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div style={{ flex: "1", minWidth: "0" }}>
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: "700",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {tok.currencyDisplay}
                          </div>
                          <div
                            style={{
                              fontSize: "10px",
                              color: isHero
                                ? "rgba(255,255,255,0.45)"
                                : "#9ca3af",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {tok.domain || trunc(tok.issuer)}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "10px",
                        }}
                      >
                        <div style={{ fontSize: "15px", fontWeight: "800" }}>
                          {tok.priceUsd ? fmtUsd(tok.priceUsd) : "—"}
                        </div>
                        {!!tok.change24h && (
                          <div
                            style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              color: tok.change24h > 0 ? "#10b981" : "#ef4444",
                              background:
                                tok.change24h > 0
                                  ? "rgba(16,185,129,0.12)"
                                  : "rgba(239,68,68,0.12)",
                              padding: "2px 7px",
                              borderRadius: "5px",
                            }}
                          >
                            {tok.change24h > 0 ? "+" : ""}
                            {tok.change24h.toFixed(1)}%
                          </div>
                        )}
                      </div>
                      {spark.length > 1 && (
                        <div style={{ marginBottom: "10px" }}>
                          <Spark
                            data={spark}
                            w={170}
                            h={34}
                            color={isHero ? "#60a5fa" : undefined}
                          />
                        </div>
                      )}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "6px",
                        }}
                      >
                        {[
                          { l: "Supply", v: fmtSupply(tok.totalSupply) },
                          {
                            l: "Trustlines",
                            v: tok.trustlines.toLocaleString(),
                          },
                        ].map((s) => (
                          <div
                            key={s.l}
                            style={{
                              padding: "5px 8px",
                              borderRadius: "7px",
                              background: isHero
                                ? "rgba(255,255,255,0.07)"
                                : "rgba(0,0,0,0.02)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "9px",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                color: isHero
                                  ? "rgba(255,255,255,0.4)"
                                  : "#9ca3af",
                                marginBottom: "2px",
                              }}
                            >
                              {s.l}
                            </div>
                            <div
                              style={{ fontSize: "12px", fontWeight: "700" }}
                            >
                              {s.v}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Most Trusted */}
          {topByTrustlines.value.length > 0 && (
            <section style={{ marginBottom: "36px" }}>
              <h2
                style={{
                  fontSize: "19px",
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: "4px",
                }}
              >
                🏆 Most Trusted
              </h2>
              <p
                style={{
                  fontSize: "13px",
                  color: "#9ca3af",
                  marginBottom: "14px",
                }}
              >
                Tokens with the most trustlines on {networkConfig.value.label}
              </p>
              <div
                style={{
                  background: "#fff",
                  borderRadius: "16px",
                  border: "1px solid rgba(0,0,0,0.06)",
                  overflow: "hidden",
                }}
              >
                {topByTrustlines.value.map((tok, idx) => {
                  const key = `${tok.currency}:${tok.issuer}`;
                  return (
                    <TokenRow
                      key={key}
                      token={tok}
                      rank={idx + 1}
                      sparkData={tokenSparks.value[key] || []}
                      onSelect$={(t: TokenItem) => {
                        selectedToken.value = t;
                      }}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {tokens.value.length === 0 && !tokLoading.value && (
            <div
              style={{
                textAlign: "center",
                padding: "60px 0",
                color: "#9ca3af",
              }}
            >
              <div style={{ fontSize: "40px", marginBottom: "10px" }}>🪙</div>
              <div style={{ fontSize: "15px", fontWeight: "600" }}>
                No tokens found on {networkConfig.value.label}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
           TOKENS — BROWSE ALL (live updates every 15s)
         ══════════════════════════════════════════════════════ */}
      {mode.value === "tokens" && subTab.value === "browse" && (
        <div class="section-fade">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "14px",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2
                style={{
                  fontSize: "19px",
                  fontWeight: "700",
                  color: "#111827",
                }}
              >
                All Tokens
              </h2>
              {tokLoading.value && (
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid #e5e7eb",
                    borderTopColor: "#2563eb",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
              )}
              {!tokLoading.value && tokLastUpdated.value > 0 && (
                <div
                  style={{ display: "flex", alignItems: "center", gap: "5px" }}
                >
                  <div class="live-dot" />
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                    Live · {relativeUpdate.value}
                  </span>
                </div>
              )}
            </div>
            <input
              type="text"
              placeholder="Search currency, issuer, domain…"
              value={tokSearch.value}
              onInput$={(e: any) => {
                tokSearch.value = e.target.value;
                tokPage.value = 1;
              }}
              style={{
                padding: "8px 13px",
                borderRadius: "10px",
                border: "1px solid rgba(0,0,0,0.1)",
                fontSize: "13px",
                outline: "none",
                background: "#fff",
                color: "#111827",
                minWidth: "240px",
              }}
            />
          </div>

          {/* Column headers */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "7px 14px",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              marginBottom: "2px",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: "700",
              color: "#9ca3af",
            }}
          >
            <div style={{ width: "26px", textAlign: "center" }}>#</div>
            <div style={{ width: "34px" }} />
            <div style={{ flex: "1" }}>Token</div>
            <div style={{ minWidth: "78px", textAlign: "right" }}>Price</div>
            <div
              class="hide-sm"
              style={{ minWidth: "62px", textAlign: "right" }}
            >
              24h
            </div>
            <div
              class="hide-md"
              style={{ minWidth: "80px", textAlign: "center" }}
            >
              Chart
            </div>
            <div style={{ minWidth: "68px", textAlign: "right" }}>
              Trustlines
            </div>
          </div>

          {tokLoading.value && !tokens.value.length ? (
            <TokenSkeleton />
          ) : tokPaginated.value.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 0",
                color: "#9ca3af",
              }}
            >
              <div style={{ fontSize: "40px", marginBottom: "10px" }}>🔍</div>
              <div style={{ fontSize: "15px", fontWeight: "600" }}>
                No tokens found
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  background: "#fff",
                  borderRadius: "14px",
                  border: "1px solid rgba(0,0,0,0.06)",
                  overflow: "hidden",
                }}
              >
                {tokPaginated.value.map((tok, idx) => {
                  const key = `${tok.currency}:${tok.issuer}`;
                  return (
                    <TokenRow
                      key={key}
                      token={tok}
                      rank={(tokPage.value - 1) * TOK_PAGE_SIZE + idx + 1}
                      sparkData={tokenSparks.value[key] || []}
                      onSelect$={(t: TokenItem) => {
                        selectedToken.value = t;
                      }}
                    />
                  );
                })}
              </div>
              {tokTotalPages.value > 1 && (
                <Pagination
                  page={tokPage.value}
                  total={tokTotalPages.value}
                  onPrev$={() => {
                    tokPage.value = Math.max(1, tokPage.value - 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onNext$={() => {
                    tokPage.value = Math.min(
                      tokTotalPages.value,
                      tokPage.value + 1,
                    );
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
           NFTs — FEATURED
         ══════════════════════════════════════════════════════ */}
      {mode.value === "nfts" && subTab.value === "featured" && (
        <div class="section-fade">
          {/* Loading progress when fetching pages */}
          {nftLoading.value && nfts.value.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                borderRadius: "10px",
                background: "rgba(37,99,235,0.05)",
                marginBottom: "16px",
                fontSize: "13px",
                color: "#2563eb",
              }}
            >
              <div
                style={{
                  width: "14px",
                  height: "14px",
                  border: "2px solid #bfdbfe",
                  borderTopColor: "#2563eb",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                  flexShrink: "0",
                }}
              />
              Fetching more NFTs… {nfts.value.length.toLocaleString()} loaded of{" "}
              {nftTotalCount.value.toLocaleString()} total
            </div>
          )}

          {/* Featured */}
          {(featuredNfts.value.length > 0 || nftLoading.value) && (
            <section style={{ marginBottom: "44px" }}>
              <h2
                style={{
                  fontSize: "19px",
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: "4px",
                }}
              >
                ✨ Featured
              </h2>
              <p
                style={{
                  fontSize: "13px",
                  color: "#9ca3af",
                  marginBottom: "16px",
                }}
              >
                Listed NFTs on {networkConfig.value.label} · XLS-14 &amp; XLS-20
              </p>
              {nftLoading.value && !nfts.value.length ? (
                <NftSkeleton />
              ) : (
                <div
                  class="nft-grid-4"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4,1fr)",
                    gap: "14px",
                  }}
                >
                  {featuredNfts.value.map((n) => (
                    <NftCard
                      key={n.nftokenId}
                      nft={n}
                      native={native.value}
                      onSelect$={(nn: NftItem) => (selectedNft.value = nn)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Top Sales */}
          {topSales.value.length > 0 && (
            <section style={{ marginBottom: "44px" }}>
              <h2
                style={{
                  fontSize: "19px",
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: "4px",
                }}
              >
                🏆 Top Sales
              </h2>
              <p
                style={{
                  fontSize: "13px",
                  color: "#9ca3af",
                  marginBottom: "16px",
                }}
              >
                Highest priced active listings
              </p>
              <div
                class="nft-grid-4"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  gap: "14px",
                }}
              >
                {topSales.value.map((n) => (
                  <NftCard
                    key={n.nftokenId}
                    nft={n}
                    native={native.value}
                    onSelect$={(nn: NftItem) => (selectedNft.value = nn)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Trending */}
          {trendingNfts.value.length > 0 && (
            <section style={{ marginBottom: "44px" }}>
              <h2
                style={{
                  fontSize: "19px",
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: "4px",
                }}
              >
                🔥 Trending
              </h2>
              <p
                style={{
                  fontSize: "13px",
                  color: "#9ca3af",
                  marginBottom: "16px",
                }}
              >
                Most active by offers
              </p>
              <div
                class="nft-grid-4"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  gap: "14px",
                }}
              >
                {trendingNfts.value.map((n) => (
                  <NftCard
                    key={n.nftokenId}
                    nft={n}
                    native={native.value}
                    onSelect$={(nn: NftItem) => (selectedNft.value = nn)}
                  />
                ))}
              </div>
            </section>
          )}

          {nfts.value.length === 0 && !nftLoading.value && (
            <div
              style={{
                textAlign: "center",
                padding: "60px 0",
                color: "#9ca3af",
              }}
            >
              <div style={{ fontSize: "40px", marginBottom: "10px" }}>🖼</div>
              <div style={{ fontSize: "15px", fontWeight: "600" }}>
                No NFTs found on {networkConfig.value.label}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
           NFTs — BROWSE ALL  (4 × 8 paginated grid)
         ══════════════════════════════════════════════════════ */}
      {mode.value === "nfts" && subTab.value === "browse" && (
        <div class="section-fade">
          {/* Header + search */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "14px",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2
                style={{
                  fontSize: "19px",
                  fontWeight: "700",
                  color: "#111827",
                }}
              >
                Browse All NFTs
              </h2>
              {nftLoading.value && (
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid #e5e7eb",
                    borderTopColor: "#2563eb",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                {nftFiltered.value.length.toLocaleString()} NFTs
                {nftLoading.value &&
                  nftTotalCount.value > nfts.value.length &&
                  ` (loading more…)`}
              </span>
              <input
                type="text"
                placeholder="Search name, collection, ID…"
                value={nftSearch.value}
                onInput$={(e: any) => {
                  nftSearch.value = e.target.value;
                  nftPage.value = 1;
                }}
                style={{
                  padding: "8px 13px",
                  borderRadius: "10px",
                  border: "1px solid rgba(0,0,0,0.1)",
                  fontSize: "13px",
                  outline: "none",
                  background: "#fff",
                  color: "#111827",
                  minWidth: "220px",
                }}
              />
            </div>
          </div>

          {/* Standard filter pills */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              marginBottom: "16px",
              flexWrap: "wrap",
            }}
          >
            {["All", "XLS-20", "XLS-14", "Listed", "With Offers"].map((f) => (
              <button
                key={f}
                class="cursor-pointer"
                style={{
                  padding: "5px 13px",
                  borderRadius: "20px",
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "#fff",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#6b7280",
                  transition: "all 0.15s",
                }}
                onClick$={() => {
                  if (f === "All") {
                    nftSearch.value = "";
                  } else if (f === "XLS-20") {
                    nftSearch.value = "";
                  } // handled by filter
                  else if (f === "XLS-14") {
                    nftSearch.value = "";
                  } else if (f === "Listed") {
                    nftSearch.value = "";
                  }
                  nftPage.value = 1;
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* NFT Grid — always 4 columns, 8 rows = 32 per page */}
          {nftLoading.value && !nfts.value.length ? (
            <NftSkeleton />
          ) : nftPaginated.value.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 0",
                color: "#9ca3af",
              }}
            >
              <div style={{ fontSize: "40px", marginBottom: "10px" }}>🔍</div>
              <div style={{ fontSize: "15px", fontWeight: "600" }}>
                No NFTs found
              </div>
            </div>
          ) : (
            <>
              {/* Page info row */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                  Page {nftPage.value} of {nftTotalPages.value} · Showing{" "}
                  {(nftPage.value - 1) * NFT_PAGE_SIZE + 1}–
                  {Math.min(
                    nftPage.value * NFT_PAGE_SIZE,
                    nftFiltered.value.length,
                  )}{" "}
                  of {nftFiltered.value.length.toLocaleString()}
                </span>
                {nftLoading.value && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#9ca3af",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        border: "2px solid #e5e7eb",
                        borderTopColor: "#2563eb",
                        borderRadius: "50%",
                        animation: "spin 0.7s linear infinite",
                      }}
                    />
                    Loading more…
                  </span>
                )}
              </div>

              {/* 4 × 8 grid */}
              <div
                class="nft-grid-4"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  gap: "14px",
                  marginBottom: "20px",
                }}
              >
                {nftPaginated.value.map((n) => (
                  <NftCard
                    key={n.nftokenId}
                    nft={n}
                    native={native.value}
                    onSelect$={(nn: NftItem) => (selectedNft.value = nn)}
                  />
                ))}
              </div>

              {/* Paginator */}
              {nftTotalPages.value > 1 && (
                <Pagination
                  page={nftPage.value}
                  total={nftTotalPages.value}
                  onPrev$={() => {
                    nftPage.value = Math.max(1, nftPage.value - 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onNext$={() => {
                    nftPage.value = Math.min(
                      nftTotalPages.value,
                      nftPage.value + 1,
                    );
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <footer
        style={{
          textAlign: "center",
          padding: "36px 0 20px",
          marginTop: "44px",
          borderTop: "1px solid rgba(0,0,0,0.06)",
          fontSize: "12px",
          color: "#9ca3af",
        }}
      >
        © 2025 – Product of{" "}
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

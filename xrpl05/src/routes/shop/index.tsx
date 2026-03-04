// src/routes/shop/index.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Marketplace — instant SSR skeleton → live hydration
// Updated to use enhanced /api/marketplace with total worth, escrow, activation, lazy offers, etc.
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
import { useNetworkContext, NETWORK_CONFIG } from "~/hooks/useNetwork";
import { useWalletContext } from "~/hooks/useWallet";
import type {
  NftItem,
  TokenItem,
  SellOffer,
  BuyOffer,
  TokenChartData,
  EnhancedToken,
  ActivationInfo,
  AccountSummary,
} from "~/lib/marketplace-data";

// ─── Constants ────────────────────────────────────────────────────────────────
const NFT_PAGE_SIZE = 32; // 4 columns × 8 rows
const TOK_PAGE_SIZE = 50;
const TOKEN_REFRESH_MS = 15000; // live token poll every 15s

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' rx='12' fill='%23f3f4f6'/%3E%3Ctext x='150' y='162' text-anchor='middle' font-family='system-ui' font-size='42' fill='%23d1d5db'%3E%3F%3C/text%3E%3C/svg%3E";

// ─── SSR Route Loaders ────────────────────────────────────────────────────────

export const useMarketplaceLoader = routeLoader$(async (req) => {
  const network = (req.query.get("network") || "xrpl").toLowerCase();
  const limit = 200;

  try {
    const res = await fetch(
      `/api/marketplace?network=${network}&limit=${limit}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as AccountSummary;
  } catch (err) {
    console.error("Marketplace SSR fetch failed:", err);
    return {
      success: false,
      network,
      address: "",
      balance: "0",
      totalWorthUsd: 0,
      totalEscrowValue: "0",
      accountInfo: {
        status: "error",
        masterKeyDisabled: false,
        nextSequence: 0,
        kycStatus: "unknown",
      },
      tokens: { totalCount: 0, list: [] as EnhancedToken[] },
      nfts: {
        totalOwned: 0,
        totalSoldApprox: 0,
        offersCreated: [],
        list: [] as NftItem[],
        listedCount: 0,
        totalSellOffers: 0,
        totalBuyOffers: 0,
      },
      queriedAt: new Date().toISOString(),
    } as AccountSummary;
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

const fetchNftOffersServer = server$(async (network: string, nftId: string) => {
  try {
    const res = await fetch(
      `/api/marketplace?network=${network}&mode=offers&nft_id=${nftId}`,
    );
    if (!res.ok) throw new Error("Offers fetch failed");
    return await res.json();
  } catch {
    return { sellOffers: [], buyOffers: [] };
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveImage(raw: string | undefined | null): string {
  if (!raw) return PLACEHOLDER;
  const url = raw.trim();
  if (url.startsWith("data:")) return url;
  if (url.startsWith("ipfs://"))
    return `https://cloudflare-ipfs.com/ipfs/${url.slice(7)}`;
  if (/^(Qm|bafy)/.test(url)) return `https://cloudflare-ipfs.com/ipfs/${url}`;
  if (url.startsWith("http")) return url;
  return PLACEHOLDER;
}

function resolveNftName(nft: NftItem): string {
  if (nft.name && nft.name.trim() !== "Unnamed") return nft.name.trim();
  if (nft.collection) return `${nft.collection} #${nft.serial}`;
  return `NFT #${nft.serial || nft.nftokenId.slice(-8)}`;
}

function fmtAmount(
  amount:
    | string
    | { value: string; currency: string; issuer: string }
    | undefined,
  native: string,
): string {
  if (!amount) return "—";
  if (typeof amount === "string") {
    const x = Number(amount) / 1_000_000;
    return `${x.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${native}`;
  }
  return `${Number(amount.value).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${amount.currency}`;
}

function fmtUsd(n?: number): string {
  if (!n || n <= 0) return "—";
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(2) + "K";
  return "$" + n.toFixed(2);
}

function trunc(str: string, len = 8): string {
  if (!str || str.length <= len * 2) return str;
  return str.slice(0, len) + "…" + str.slice(-len);
}

// ─── Components ───────────────────────────────────────────────────────────────

const NftImage = component$<{ src: string; alt: string }>(({ src, alt }) => {
  const resolved = useSignal(resolveImage(src));
  const failed = useSignal(false);

  const onError = $(() => {
    if (failed.value) return;
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
      onError$={onError}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
});

const NftCard = component$<{
  nft: NftItem;
  native: string;
  onSelect$: PropFunction<(nft: NftItem) => void>;
}>(({ nft, native, onSelect$ }) => {
  const name = resolveNftName(nft);
  const sellCount = nft.sellOffersCount || nft.sellOffers?.length || 0;
  const buyCount = nft.buyOffersCount || nft.buyOffers?.length || 0;
  const totalOffers = sellCount + buyCount;

  return (
    <div
      class="cursor-pointer nft-card"
      onClick$={() => onSelect$(nft)}
      style={{
        borderRadius: "14px",
        overflow: "hidden",
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.07)",
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
    >
      <div
        style={{
          aspectRatio: "1",
          position: "relative",
          background: "#f8fafc",
        }}
      >
        <NftImage src={nft.image || nft.resolvedUri || ""} alt={name} />
        {nft.collection && (
          <div
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              fontSize: "10px",
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
      </div>
      <div style={{ padding: "12px" }}>
        <div
          style={{
            fontSize: "14px",
            fontWeight: "700",
            color: "#111827",
            marginBottom: "4px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
        <div
          style={{ fontSize: "12px", color: "#6b7280", marginBottom: "10px" }}
        >
          {trunc(nft.issuer)}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "10px", color: "#9ca3af" }}>Offers</div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: "700",
                color: totalOffers > 0 ? "#10b981" : "#d1d5db",
              }}
            >
              {totalOffers || "—"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "10px", color: "#9ca3af" }}>Listed</div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: "700",
                color: sellCount > 0 ? "#2563eb" : "#d1d5db",
              }}
            >
              {sellCount > 0 ? "Yes" : "No"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const TokenRow = component$<{
  token: EnhancedToken;
  rank: number;
  onSelect$: PropFunction<(t: EnhancedToken) => void>;
}>(({ token, rank, onSelect$ }) => (
  <div
    class="cursor-pointer token-row"
    onClick$={() => onSelect$(token)}
    style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "12px 16px",
      borderRadius: "12px",
      transition: "background 0.15s",
    }}
  >
    <div
      style={{
        width: "28px",
        textAlign: "center",
        fontWeight: "700",
        color: "#9ca3af",
      }}
    >
      {rank}
    </div>
    <div
      style={{
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <img
        src={token.icon || PLACEHOLDER}
        alt={token.name}
        width={40}
        height={40}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: "15px", fontWeight: "700", color: "#111827" }}>
        {token.name}{" "}
        <span style={{ color: "#6b7280", fontSize: "13px" }}>
          ({token.symbol})
        </span>
      </div>
      <div style={{ fontSize: "12px", color: "#6b7280" }}>
        {token.ripplingEnabled ? "Rippling Enabled" : "Rippling Disabled"} •
        Max: {token.maxAmount}
      </div>
    </div>
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: "15px", fontWeight: "700", color: "#111827" }}>
        {Number(token.balance).toLocaleString()}
      </div>
      <div
        style={{
          fontSize: "12px",
          color: token.worthUsd ? "#10b981" : "#9ca3af",
        }}
      >
        {token.worthUsd ? fmtUsd(token.worthUsd) : "—"}
      </div>
    </div>
  </div>
));

// ─── Main Marketplace Page ────────────────────────────────────────────────────
export default component$(() => {
  const { activeNetwork } = useNetworkContext();
  const wallet = useWalletContext();
  const native = NETWORK_CONFIG[activeNetwork.value].nativeCurrency;

  // SSR data
  const marketData = useMarketplaceLoader();

  // Client state
  const mode = useSignal<"tokens" | "nfts">("nfts");
  const tokens = useSignal<EnhancedToken[]>([]);
  const nfts = useSignal<NftItem[]>([]);
  const loading = useSignal(true);
  const error = useSignal("");

  const selectedNft = useSignal<NftItem | null>(null);
  const selectedToken = useSignal<EnhancedToken | null>(null);

  // Hydrate from SSR
  useTask$(({ track }) => {
    track(() => marketData.value);
    if (marketData.value?.success) {
      tokens.value = marketData.value.tokens.list || [];
      nfts.value = marketData.value.nfts.list || [];
      loading.value = false;
    } else {
      error.value = "Failed to load marketplace data";
      loading.value = false;
    }
  });

  // Refresh on network change
  useVisibleTask$(({ track, cleanup }) => {
    track(() => activeNetwork.value);
    loading.value = true;

    const refresh = async () => {
      try {
        const res = await fetch(
          `/api/marketplace?network=${activeNetwork.value}&limit=200`,
        );
        if (!res.ok) throw new Error("Refresh failed");
        const data = await res.json();
        if (data.success) {
          tokens.value = data.tokens?.list || [];
          nfts.value = data.nfts?.list || [];
        }
      } catch (err) {
        error.value = String(err);
      } finally {
        loading.value = false;
      }
    };

    refresh();

    // Optional: live token price polling
    const interval = setInterval(refresh, 30000);
    cleanup(() => clearInterval(interval));
  });

  const nftFiltered = useComputed$(() => nfts.value);
  const nftPaginated = useComputed$(() => {
    const start = 0; // can add pagination later
    return nftFiltered.value.slice(start, start + NFT_PAGE_SIZE);
  });

  return (
    <div style={{ padding: "40px 20px", maxWidth: "1400px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "32px", fontWeight: "800", marginBottom: "8px" }}>
        Marketplace
      </h1>
      <p style={{ color: "#6b7280", marginBottom: "32px" }}>
        Explore tokens and NFTs on {activeNetwork.value.toUpperCase()}
      </p>

      {/* Summary Stats */}
      {marketData.value?.success && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              padding: "20px",
              background: "#f8fafc",
              borderRadius: "16px",
            }}
          >
            <div style={{ fontSize: "14px", color: "#6b7280" }}>
              Total Worth
            </div>
            <div style={{ fontSize: "28px", fontWeight: "800" }}>
              {fmtUsd(marketData.value.totalWorthUsd)}
            </div>
          </div>
          <div
            style={{
              padding: "20px",
              background: "#f8fafc",
              borderRadius: "16px",
            }}
          >
            <div style={{ fontSize: "14px", color: "#6b7280" }}>
              Escrow Locked
            </div>
            <div style={{ fontSize: "28px", fontWeight: "800" }}>
              {marketData.value.totalEscrowValue || "—"} {native}
            </div>
          </div>
          <div
            style={{
              padding: "20px",
              background: "#f8fafc",
              borderRadius: "16px",
            }}
          >
            <div style={{ fontSize: "14px", color: "#6b7280" }}>NFTs Owned</div>
            <div style={{ fontSize: "28px", fontWeight: "800" }}>
              {marketData.value.nfts.totalOwned}
            </div>
          </div>
          <div
            style={{
              padding: "20px",
              background: "#f8fafc",
              borderRadius: "16px",
            }}
          >
            <div style={{ fontSize: "14px", color: "#6b7280" }}>
              Tokens Held
            </div>
            <div style={{ fontSize: "28px", fontWeight: "800" }}>
              {marketData.value.tokens.totalCount}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ marginBottom: "24px" }}>
        <button
          onClick$={() => (mode.value = "nfts")}
          style={{
            padding: "10px 20px",
            marginRight: "12px",
            borderRadius: "12px",
            background: mode.value === "nfts" ? "#111827" : "#f3f4f6",
            color: mode.value === "nfts" ? "#fff" : "#111827",
            fontWeight: "700",
            border: "none",
          }}
        >
          NFTs
        </button>
        <button
          onClick$={() => (mode.value = "tokens")}
          style={{
            padding: "10px 20px",
            borderRadius: "12px",
            background: mode.value === "tokens" ? "#111827" : "#f3f4f6",
            color: mode.value === "tokens" ? "#fff" : "#111827",
            fontWeight: "700",
            border: "none",
          }}
        >
          Tokens
        </button>
      </div>

      {/* Loading / Error */}
      {loading.value && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⏳</div>
          <div>Loading marketplace data...</div>
        </div>
      )}

      {error.value && (
        <div
          style={{ color: "#dc2626", textAlign: "center", padding: "40px 0" }}
        >
          {error.value}
        </div>
      )}

      {/* NFTs Grid */}
      {!loading.value &&
        mode.value === "nfts" &&
        nftPaginated.value.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "24px",
            }}
          >
            {nftPaginated.value.map((nft) => (
              <NftCard
                key={nft.nftokenId}
                nft={nft}
                native={native}
                onSelect$={(n) => (selectedNft.value = n)}
              />
            ))}
          </div>
        )}

      {/* Tokens List */}
      {!loading.value && mode.value === "tokens" && tokens.value.length > 0 && (
        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            overflow: "hidden",
          }}
        >
          {tokens.value.map((token, i) => (
            <TokenRow
              key={`${token.currency}:${token.issuer}`}
              token={token}
              rank={i + 1}
              onSelect$={(t) => (selectedToken.value = t)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {selectedNft.value && (
        <NftModal
          nft={selectedNft.value}
          native={native}
          walletAddress={wallet.address.value || ""}
          walletType={wallet.walletType.value}
          onClose$={() => (selectedNft.value = null)}
        />
      )}

      {selectedToken.value && (
        <TokenModal
          token={selectedToken.value}
          network={activeNetwork.value}
          native={native}
          walletAddress={wallet.address.value || ""}
          walletType={wallet.walletType.value}
          onClose$={() => (selectedToken.value = null)}
        />
      )}
    </div>
  );
});

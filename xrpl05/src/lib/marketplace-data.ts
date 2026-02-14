// src/lib/marketplace-data.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared marketplace data layer — used by both the API route and routeLoader$.
// ─────────────────────────────────────────────────────────────────────────────

import { cachedFetch, cacheKey } from "~/lib/d1-cache";

// ─── Network config ───────────────────────────────────────────────────────────
export const NETWORK_NODES: Record<string, string[]> = {
  xrpl: [
    "https://xrplcluster.com",
    "https://s1.ripple.com:51234",
    "https://s2.ripple.com:51234",
  ],
  xahau: ["https://xahau.network", "https://xahau.org"],
  xrpl_testnet: [
    "https://s.altnet.rippletest.net:51234",
    "https://testnet.xrpl-labs.com",
  ],
  xahau_testnet: ["https://xahau-test.net/"],
};

export const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://nftstorage.link/ipfs/",
];

// Cache TTLs (ms)
const TTL_TOKENS = 5 * 60_000;   // 5 min — price data refreshes often
const TTL_NFTS   = 10 * 60_000;  // 10 min — NFT listings change less often

// Hard limits to keep responses fast
const MAX_LEDGER_PAGES   = 6;    // max ledger_data pages per scan (~2400 objects)
const MAX_NFTS_PER_PAGE  = 300;  // nft_page objects per ledger_data call
const MAX_ENRICH_TOKENS  = 40;   // only price-enrich the top N tokens
const META_BATCH         = 8;    // concurrent metadata fetches
const ENRICH_BATCH       = 6;    // concurrent token enrichment calls

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SellOffer {
  index: string;
  amount: string | { value: string; currency: string; issuer: string };
  owner: string;
  destination?: string;
  expiration?: number;
}

export interface BuyOffer {
  index: string;
  amount: string | { value: string; currency: string; issuer: string };
  owner: string;
  expiration?: number;
}

export interface NftItem {
  nftokenId: string;
  issuer: string;
  owner: string;
  taxon: number;
  serial: number;
  uri: string;
  resolvedUri: string;
  image: string;
  name: string;
  description: string;
  collection: string;
  flags: number;
  transferFee: number;
  nftStandard: "XLS-20" | "XLS-14";
  sellOffers: SellOffer[];
  buyOffers: BuyOffer[];
}

export interface TokenItem {
  currency: string;
  currencyDisplay: string;
  issuer: string;
  issuerName: string;
  totalSupply: string;
  holders: number;
  trustlines: number;
  domain?: string;
  website?: string;
  transferRate?: number;
  flags?: number;
  logoUrl?: string;
  priceXrp?: number;
  priceUsd?: number;
  change24h?: number;
  volume24h?: number;
  marketCap?: number;
  sparkline?: number[];
}

export interface TokenChartData {
  prices: { time: number; value: number }[];
  change24h: number;
  currentPrice: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

export interface NftResponse {
  success: boolean;
  network: string;
  type: "nfts";
  count: number;
  nfts: NftItem[];
  timestamp: string;
}

export interface TokenResponse {
  success: boolean;
  network: string;
  type: "tokens";
  count: number;
  tokens: TokenItem[];
  timestamp: string;
  xrpPriceUsd?: number;
}

interface RawNFToken {
  NFTokenID: string;
  Issuer?: string;
  NFTokenTaxon: number;
  nft_serial: number;
  URI?: string;
  Flags: number;
  TransferFee: number;
}

// ─── Well-known tokens (seed list — displayed instantly, enriched later) ──────
const WELL_KNOWN_TOKENS_XRPL: Omit<TokenItem, "holders" | "trustlines" | "totalSupply">[] = [
  { currency: "534F4C4F00000000000000000000000000000000", currencyDisplay: "SOLO", issuer: "rsoLo2S1kiGeCcn6hCUXPBGEUfpJocDBZt", issuerName: "Sologenic", domain: "sologenic.com", logoUrl: "https://cdn.bithomp.com/issued-token/rsoLo2S1kiGeCcn6hCUXPBGEUfpJocDBZt/534F4C4F00000000000000000000000000000000.png" },
  { currency: "CSC", currencyDisplay: "CSC", issuer: "rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr", issuerName: "CasinoCoin", domain: "casinocoin.im", logoUrl: "https://cdn.bithomp.com/issued-token/rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr/CSC.png" },
  { currency: "434F524500000000000000000000000000000000", currencyDisplay: "CORE", issuer: "rcoreNywaoz2ZCQ8Lg2EbSLnGuRBmun6D", issuerName: "Coreum", domain: "coreum.com", logoUrl: "https://cdn.bithomp.com/issued-token/rcoreNywaoz2ZCQ8Lg2EbSLnGuRBmun6D/434F524500000000000000000000000000000000.png" },
  { currency: "4772657968634F494E0000000000000000000000", currencyDisplay: "Greyhound", issuer: "rJWBaKCpQw47vF4rr7XUNqr34i4CoXqhKJ", issuerName: "Greyhound", domain: "greyhoundcoin.net", logoUrl: "https://cdn.bithomp.com/issued-token/rJWBaKCpQw47vF4rr7XUNqr34i4CoXqhKJ/4772657968634F494E0000000000000000000000.png" },
  { currency: "45717569006C69627269756D000000000000000000", currencyDisplay: "EQ", issuer: "rpakCr61Q92abPXJnhVq3Se7K3pnR3ixKq", issuerName: "Equilibrium", domain: "equilibrium-games.com", logoUrl: "https://cdn.bithomp.com/issued-token/rpakCr61Q92abPXJnhVq3Se7K3pnR3ixKq/45717569006C69627269756D000000000000000000.png" },
  { currency: "XRdoge", currencyDisplay: "XRdoge", issuer: "rLqUC2eCPohYvJCEBJ77eCCqVL2uEiczjA", issuerName: "XRdoge", domain: "xrdoge.com", logoUrl: "https://cdn.bithomp.com/issued-token/rLqUC2eCPohYvJCEBJ77eCCqVL2uEiczjA/XRdoge.png" },
  { currency: "4558454C4F4E0000000000000000000000000000", currencyDisplay: "EXELON", issuer: "rXExe1ULBskGULEcjy5TuMPbJCsrWHMjN", issuerName: "Exelon", logoUrl: "" },
  { currency: "USD", currencyDisplay: "USD", issuer: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B", issuerName: "Bitstamp", domain: "bitstamp.net", logoUrl: "https://cdn.bithomp.com/issued-token/rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B/USD.png" },
  { currency: "EUR", currencyDisplay: "EUR", issuer: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq", issuerName: "GateHub", domain: "gatehub.net", logoUrl: "https://cdn.bithomp.com/issued-token/rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq/EUR.png" },
  { currency: "4C50540000000000000000000000000000000000", currencyDisplay: "LPT", issuer: "r3qWgpz2ry3BhcRJ8JE6rxM8esrfhuKp4R", issuerName: "LPT Finance", domain: "lptfinance.com", logoUrl: "" },
];

const WELL_KNOWN_TOKENS_XAHAU: Omit<TokenItem, "holders" | "trustlines" | "totalSupply">[] = [
  { currency: "EVR", currencyDisplay: "EVR", issuer: "rEvernodee8dJLaFsujS6q1EiXvZYmHXr8", issuerName: "Evernode", domain: "evernode.org", logoUrl: "" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function decodeCurrency(currency: string): string {
  if (!currency || currency.length <= 3) return currency;
  if (/^[0-9A-Fa-f]{40}$/.test(currency)) {
    try {
      const bytes = Buffer.from(currency.padEnd(40, "0").slice(0, 40), "hex");
      const str = bytes.toString("utf8").replace(/\0/g, "").trim();
      if (str && /^[\x20-\x7E]+$/.test(str)) return str;
    } catch { /* fall through */ }
  }
  return currency;
}

export function decodeHexUri(hexUri: string): string {
  if (!hexUri) return "";
  try { return Buffer.from(hexUri, "hex").toString("utf8"); }
  catch { return hexUri; }
}

export function resolveIpfs(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return `${IPFS_GATEWAYS[0]}${uri.slice(7)}`;
  if (uri.startsWith("http")) return uri;
  if (/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy)/.test(uri)) return `${IPFS_GATEWAYS[0]}${uri}`;
  return uri;
}

// ─── RPC helper with node failover ───────────────────────────────────────────

export async function rpc(
  network: string,
  method: string,
  params: Record<string, unknown>,
): Promise<any> {
  const nodes = NETWORK_NODES[network] || NETWORK_NODES.xrpl;
  let lastErr: unknown;
  for (const node of nodes) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(node, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method, params: [params] }),
          signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { result?: any };
        if (json.result?.error)
          throw new Error(json.result.error_message || json.result.error);
        return json.result;
      } catch (e) {
        lastErr = e;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
      }
    }
  }
  throw lastErr!;
}

// ─── D1 accessor ──────────────────────────────────────────────────────────────

export function getD1(platform: Record<string, any> | undefined): D1Database | null {
  if (!platform) return null;
  const env = platform.env ?? platform;
  return env?.xrpl05_cache ?? null;
}

// ─── XRP/USD price ────────────────────────────────────────────────────────────

let _xrpPriceCache: { price: number; ts: number } | null = null;

export async function fetchXrpPriceUsd(): Promise<number> {
  if (_xrpPriceCache && Date.now() - _xrpPriceCache.ts < 300_000) {
    return _xrpPriceCache.price;
  }
  const apis = [
    { url: "https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd", extract: (d: any) => d?.ripple?.usd },
    { url: "https://api.coingecko.com/api/v3/simple/price?ids=xrp&vs_currencies=usd", extract: (d: any) => d?.xrp?.usd },
    { url: "https://api.dexscreener.com/latest/dex/tokens/xrp", extract: (d: any) => Number(d?.pairs?.[0]?.priceUsd) || undefined },
  ];
  for (const api of apis) {
    try {
      const res = await fetch(api.url, { signal: AbortSignal.timeout(5_000), headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const price = api.extract(await res.json());
      if (price && price > 0) { _xrpPriceCache = { price, ts: Date.now() }; return price; }
    } catch { continue; }
  }
  return _xrpPriceCache?.price ?? 2.3;
}

// ─── NFT metadata fetcher ────────────────────────────────────────────────────

async function fetchMeta(uri: string) {
  const empty = { image: "", name: "", description: "", collection: "" };
  if (!uri) return empty;
  const resolved = resolveIpfs(uri);
  // Try IPFS gateways in order
  const urls = resolved.includes("ipfs.io/ipfs/")
    ? IPFS_GATEWAYS.map((g) => resolved.replace(IPFS_GATEWAYS[0], g))
    : [resolved];
  for (const url of urls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (!r.ok) continue;
      const ct = r.headers.get("content-type") || "";
      if (ct.startsWith("image/")) return { ...empty, image: url };
      const m = (await r.json()) as Record<string, any>;
      const img = m.image || m.image_url || m.artwork?.uri || m.properties?.image || "";
      return {
        image: resolveIpfs(img),
        name: m.name || m.title || "",
        description: m.description || m.details || "",
        collection: m.collection?.name || m.collection || m.series || "",
      };
    } catch { continue; }
  }
  return empty;
}

// ─── Offer fetchers ──────────────────────────────────────────────────────────

async function getSellOffers(network: string, id: string): Promise<SellOffer[]> {
  try {
    const r = await rpc(network, "nft_sell_offers", { nft_id: id, ledger_index: "validated" });
    return (r.offers || []).map((o: any) => ({ index: o.nft_offer_index, amount: o.amount, owner: o.owner, destination: o.destination, expiration: o.expiration }));
  } catch { return []; }
}

async function getBuyOffers(network: string, id: string): Promise<BuyOffer[]> {
  try {
    const r = await rpc(network, "nft_buy_offers", { nft_id: id, ledger_index: "validated" });
    return (r.offers || []).map((o: any) => ({ index: o.nft_offer_index, amount: o.amount, owner: o.owner, expiration: o.expiration }));
  } catch { return []; }
}

// ─── isStaleMarker ───────────────────────────────────────────────────────────
// XRPL nodes invalidate pagination markers when the ledger advances.
// Detect this so we can stop cleanly instead of crashing.

function isStaleMarker(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err).toLowerCase();
  return (
    msg.includes("markerdoesnotexist") ||
    msg.includes("invalid marker") ||
    msg.includes("marker does not exist")
  );
}

// ─── Fetch XLS-20 NFTs ────────────────────────────────────────────────────────
// Strategy: collect raw token entries first (fast), then enrich in batches.
// This avoids blocking the scan loop with per-NFT network calls.

async function fetchXLS20Nfts(network: string, limit: number): Promise<NftItem[]> {
  // Phase 1: collect raw NFT entries
  const rawEntries: { token: RawNFToken; owner: string }[] = [];
  let marker: unknown;
  let pages = 0;

  do {
    const params: Record<string, unknown> = {
      ledger_index: "validated",
      type: "nft_page",
      limit: MAX_NFTS_PER_PAGE,
    };
    if (marker) params.marker = marker;

    let res: any;
    try {
      res = await rpc(network, "ledger_data", params);
    } catch (err) {
      if (isStaleMarker(err)) {
        console.warn("[marketplace] stale marker, stopping XLS-20 scan");
        break;
      }
      throw err;
    }

    marker = res.marker;
    pages++;

    for (const page of res.state || []) {
      if (!page.NFTokens) continue;
      const owner: string = page.Account || "";
      for (const { NFToken: t } of page.NFTokens as { NFToken: RawNFToken }[]) {
        if (rawEntries.length < limit) rawEntries.push({ token: t, owner });
      }
    }

    if (rawEntries.length >= limit) break;
    if (pages >= MAX_LEDGER_PAGES) {
      // Reached page cap — stop gracefully, no warning needed
      break;
    }
  } while (marker);

  // Phase 2: enrich in parallel batches (metadata + offers)
  const results: NftItem[] = [];
  for (let i = 0; i < rawEntries.length; i += META_BATCH) {
    const batch = rawEntries.slice(i, i + META_BATCH);
    const enriched = await Promise.allSettled(
      batch.map(async ({ token: t, owner }) => {
        const uri = decodeHexUri(t.URI || "");
        const [meta, sell, buy] = await Promise.all([
          fetchMeta(uri),
          getSellOffers(network, t.NFTokenID),
          getBuyOffers(network, t.NFTokenID),
        ]);
        return {
          nftokenId: t.NFTokenID,
          issuer: t.Issuer || owner,
          owner,
          taxon: t.NFTokenTaxon,
          serial: t.nft_serial,
          uri,
          resolvedUri: resolveIpfs(uri),
          image: meta.image,
          name: meta.name || `NFT #${t.nft_serial}`,
          description: meta.description,
          collection: meta.collection || `Taxon ${t.NFTokenTaxon}`,
          flags: t.Flags,
          transferFee: t.TransferFee,
          nftStandard: "XLS-20" as const,
          sellOffers: sell,
          buyOffers: buy,
        };
      }),
    );
    for (const r of enriched) {
      if (r.status === "fulfilled") results.push(r.value);
    }
  }

  return results;
}

// ─── Fetch XLS-14 NFTs (Xahau URITokens) ────────────────────────────────────

async function fetchXLS14Nfts(network: string, limit: number): Promise<NftItem[]> {
  const results: NftItem[] = [];
  let marker: unknown;
  let pages = 0;

  do {
    const params: Record<string, unknown> = {
      ledger_index: "validated",
      type: "uri_token",
      limit: Math.min(400, limit),
    };
    if (marker) params.marker = marker;

    let res: any;
    try {
      res = await rpc(network, "ledger_data", params);
    } catch (err) {
      if (isStaleMarker(err)) {
        console.warn("[marketplace] stale marker, stopping XLS-14 scan");
        break;
      }
      break; // uri_token not available on XRPL mainnet
    }

    marker = res.marker;
    pages++;

    // Collect raw objects first
    const batch: any[] = [];
    for (const obj of res.state || []) {
      if (results.length + batch.length >= limit) break;
      batch.push(obj);
    }

    // Enrich batch in parallel
    const enriched = await Promise.allSettled(
      batch.map(async (obj) => {
        const uri = decodeHexUri(obj.URI || "");
        const meta = await fetchMeta(uri);
        return {
          nftokenId: obj.index || obj.URITokenID || "",
          issuer: obj.Issuer || "",
          owner: obj.Owner || obj.Issuer || "",
          taxon: 0,
          serial: 0,
          uri,
          resolvedUri: resolveIpfs(uri),
          image: meta.image,
          name: meta.name || `URIToken ${(obj.index || "").slice(0, 8)}`,
          description: meta.description,
          collection: meta.collection || "XLS-14 URIToken",
          flags: obj.Flags || 0,
          transferFee: 0,
          nftStandard: "XLS-14" as const,
          sellOffers: [],
          buyOffers: [],
        };
      }),
    );
    for (const r of enriched) {
      if (r.status === "fulfilled") results.push(r.value);
    }

    if (pages >= MAX_LEDGER_PAGES) break;
  } while (marker && results.length < limit);

  return results;
}

// ─── Fetch tokens from ledger (trust lines via ledger_data state) ─────────────
// Cap both page count and total unique tokens to keep scan time bounded.

async function fetchTokensFromLedger(network: string, limit: number): Promise<TokenItem[]> {
  const map = new Map<string, TokenItem>();
  let marker: unknown;
  let pages = 0;

  do {
    const params: Record<string, unknown> = {
      ledger_index: "validated",
      type: "state",
      limit: 400,
    };
    if (marker) params.marker = marker;

    let res: any;
    try {
      res = await rpc(network, "ledger_data", params);
    } catch (err) {
      if (isStaleMarker(err)) {
        console.warn("[marketplace] stale marker, stopping ledger token scan");
        break;
      }
      throw err;
    }

    marker = res.marker;
    pages++;

    for (const line of res.state || []) {
      if (!line.HighLimit || !line.LowLimit) continue;
      const currency: string = line.Balance?.currency || line.LowLimit?.currency || "";
      if (!currency || currency === "XRP" || currency === "XAH") continue;

      const balVal = Number(line.Balance?.value || "0");
      const issuer: string = balVal < 0
        ? (line.HighLimit?.issuer || "")
        : (line.LowLimit?.issuer || "");
      if (!issuer) continue;

      const key = `${currency}:${issuer}`;
      const balAbs = Math.abs(balVal);

      if (map.has(key)) {
        const tok = map.get(key)!;
        tok.trustlines++;
        tok.holders = tok.trustlines;
        tok.totalSupply = String(Number(tok.totalSupply) + balAbs);
      } else {
        map.set(key, {
          currency,
          currencyDisplay: decodeCurrency(currency),
          issuer,
          issuerName: `${issuer.slice(0, 6)}…${issuer.slice(-4)}`,
          totalSupply: String(balAbs),
          holders: 1,
          trustlines: 1,
          logoUrl: "",
        });
      }
    }

    // Stop early once we have enough unique tokens
    if (map.size >= limit * 2) break;
    if (pages >= MAX_LEDGER_PAGES) break;
  } while (marker);

  return Array.from(map.values())
    .sort((a, b) => b.trustlines - a.trustlines)
    .slice(0, limit);
}

// ─── Enrich a single token with issuer RPC data ───────────────────────────────
// Fires account_info once per token. Bithomp icon check is skipped if logoUrl
// already exists (well-known tokens carry their URLs in the seed list).

async function enrichTokenNative(tok: TokenItem, network: string): Promise<void> {
  if (!tok.domain) {
    try {
      const info = await rpc(network, "account_info", { account: tok.issuer, ledger_index: "validated" });
      const acct = info.account_data;
      if (acct?.Domain) {
        try {
          tok.domain = Buffer.from(acct.Domain, "hex").toString("utf8");
          tok.website = tok.domain.startsWith("http") ? tok.domain : `https://${tok.domain}`;
        } catch { /* ignore */ }
      }
      if (acct?.TransferRate && acct.TransferRate > 1_000_000_000) {
        tok.transferRate = ((acct.TransferRate - 1_000_000_000) / 10_000_000) * 100;
      }
      tok.flags = acct?.Flags || 0;
    } catch { /* ignore */ }
  }

  // Only HEAD Bithomp if we have no logo yet — avoids N HEAD requests for seed tokens
  if (!tok.logoUrl) {
    try {
      const currencyHex = tok.currency.length === 40 ? tok.currency.toUpperCase() : tok.currency;
      const url = `https://cdn.bithomp.com/issued-token/${tok.issuer}/${currencyHex}.png`;
      const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(2_500) });
      tok.logoUrl = res.ok ? url : "";
    } catch { tok.logoUrl = ""; }
  }
}

// ─── Enrich tokens with DEX prices ───────────────────────────────────────────
// Only enriches the top MAX_ENRICH_TOKENS tokens by trustline count.

async function enrichTokenPrices(tokens: TokenItem[], network: string, xrpPriceUsd: number): Promise<void> {
  const slice = tokens.slice(0, MAX_ENRICH_TOKENS);
  for (let i = 0; i < slice.length; i += ENRICH_BATCH) {
    await Promise.allSettled(
      slice.slice(i, i + ENRICH_BATCH).map(async (tok) => {
        // DexScreener first (real USD price + change)
        try {
          const displayName = decodeCurrency(tok.currency);
          const res = await fetch(
            `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(displayName + " xrpl")}`,
            { signal: AbortSignal.timeout(5_000) },
          );
          if (res.ok) {
            const data = (await res.json()) as { pairs?: any[] };
            const pair = data.pairs?.find(
              (p) => p.chainId === "xrpl" && (p.baseToken.address?.includes(tok.issuer) || p.baseToken.symbol?.toUpperCase() === displayName.toUpperCase()),
            );
            if (pair && Number(pair.priceUsd) > 0) {
              tok.priceUsd    = Number(pair.priceUsd);
              tok.priceXrp    = tok.priceUsd / xrpPriceUsd;
              tok.change24h   = pair.priceChange?.h24 ?? 0;
              tok.volume24h   = pair.volume?.h24 ?? 0;
              tok.marketCap   = pair.fdv ?? 0;
              return;
            }
          }
        } catch { /* fall through */ }

        // XRPL native book_offers fallback
        try {
          const nativeCurrency = network.includes("xahau") ? "XAH" : "XRP";
          const askResult = await rpc(network, "book_offers", {
            taker_gets: { currency: tok.currency, issuer: tok.issuer },
            taker_pays: { currency: nativeCurrency, issuer: "" },
            limit: 5,
            ledger_index: "validated",
          });
          const offers = askResult?.offers || [];
          let bestPrice = Infinity;
          for (const offer of offers) {
            const gets = typeof offer.TakerGets === "string" ? Number(offer.TakerGets) / 1e6 : Number(offer.TakerGets?.value || 0);
            const pays = typeof offer.TakerPays === "string" ? Number(offer.TakerPays) / 1e6 : Number(offer.TakerPays?.value || 0);
            if (gets > 0 && pays > 0) bestPrice = Math.min(bestPrice, pays / gets);
          }
          if (bestPrice !== Infinity) {
            tok.priceXrp = bestPrice;
            tok.priceUsd = bestPrice * xrpPriceUsd;
          }
        } catch { /* ignore */ }
      }),
    );
  }
}

// ─── Sparkline generator ──────────────────────────────────────────────────────

function generateSparkline(tok: TokenItem): number[] {
  const baseVal = tok.priceXrp || tok.trustlines || 1;
  const seed = tok.currency.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + tok.issuer.length;
  const pts: number[] = [];
  let val = baseVal * (0.92 + ((seed % 16) / 100));
  for (let i = 0; i < 24; i++) {
    const drift = Math.sin(seed * 0.13 + i * 0.8) * 0.03 + Math.cos(seed * 0.07 + i * 1.3) * 0.02;
    val = val * (1 + drift);
    val = val + (baseVal - val) * 0.06;
    pts.push(Math.max(0, val));
  }
  pts.push(baseVal);
  return pts;
}

// ─── Token chart data (for detail modal) ────────────────────────────────────

export async function fetchTokenChartData(
  network: string,
  currency: string,
  issuer: string,
): Promise<TokenChartData | null> {
  const displayName = decodeCurrency(currency);

  // Try DexScreener
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(displayName + " xrpl")}`,
      { signal: AbortSignal.timeout(6_000) },
    );
    if (res.ok) {
      const data = (await res.json()) as { pairs?: any[] };
      const pair = data.pairs?.find(
        (p) => p.chainId === "xrpl" && (p.baseToken.address?.includes(issuer) || p.baseToken.symbol?.toUpperCase() === displayName.toUpperCase()),
      );
      if (pair) {
        const currentPrice = Number(pair.priceUsd) || 0;
        const change24h = pair.priceChange?.h24 ?? 0;
        const change1h  = pair.priceChange?.h1 ?? 0;
        const change6h  = pair.priceChange?.h6 ?? 0;
        const now = Date.now();
        const basePrice  = currentPrice / (1 + change24h / 100);
        const price6h    = currentPrice / (1 + change6h / 100);
        const price1h    = currentPrice / (1 + change1h / 100);
        const points: { time: number; value: number }[] = [];
        for (let i = 0; i <= 24; i++) {
          const t = i / 24;
          let price: number;
          if (t < 0.75)        price = basePrice  + (price6h   - basePrice)  * (t / 0.75);
          else if (t < 0.958)  price = price6h    + (price1h   - price6h)    * ((t - 0.75) / 0.208);
          else                 price = price1h    + (currentPrice - price1h) * ((t - 0.958) / 0.042);
          const noise = (Math.sin(i * 2.7 + i * i * 0.3) * 0.005 + 1) * price;
          points.push({ time: now - (24 - i) * 3_600_000, value: Math.max(0, noise) });
        }
        return {
          prices: points,
          change24h,
          currentPrice,
          volume24h: pair.volume?.h24 ?? 0,
          high24h: Math.max(...points.map((p) => p.value)),
          low24h:  Math.min(...points.map((p) => p.value)),
        };
      }
    }
  } catch { /* fall through */ }

  // Fallback: book_offers current price → synthesised chart
  try {
    const nativeCurrency = network.includes("xahau") ? "XAH" : "XRP";
    const askResult = await rpc(network, "book_offers", {
      taker_gets: { currency, issuer },
      taker_pays: { currency: nativeCurrency, issuer: "" },
      limit: 5,
      ledger_index: "validated",
    });
    const offers = askResult?.offers || [];
    let bestPrice = Infinity;
    for (const offer of offers) {
      const gets = typeof offer.TakerGets === "string" ? Number(offer.TakerGets) / 1e6 : Number(offer.TakerGets?.value || 0);
      const pays = typeof offer.TakerPays === "string" ? Number(offer.TakerPays) / 1e6 : Number(offer.TakerPays?.value || 0);
      if (gets > 0 && pays > 0) bestPrice = Math.min(bestPrice, pays / gets);
    }
    if (bestPrice !== Infinity) {
      const xrpUsd = await fetchXrpPriceUsd();
      const currentPrice = bestPrice * xrpUsd;
      const now = Date.now();
      const seed = currency.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + issuer.length;
      const points: { time: number; value: number }[] = [];
      let val = currentPrice * (0.95 + ((seed % 10) / 100));
      for (let i = 0; i <= 24; i++) {
        const noise = Math.sin(seed * 0.1 + i * 0.7) * 0.02 + Math.cos(seed * 0.3 + i * 1.1) * 0.015;
        val = val * (1 + noise);
        val = val + (currentPrice - val) * 0.08;
        points.push({ time: now - (24 - i) * 3_600_000, value: Math.max(0, val) });
      }
      points[points.length - 1].value = currentPrice;
      return {
        prices: points,
        change24h: ((currentPrice - points[0].value) / points[0].value) * 100,
        currentPrice,
        volume24h: 0,
        high24h: Math.max(...points.map((p) => p.value)),
        low24h:  Math.min(...points.map((p) => p.value)),
      };
    }
  } catch { /* no chart available */ }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

export async function loadTokens(
  network: string,
  limit: number,
  db: D1Database | null,
): Promise<TokenResponse> {
  const key = cacheKey("tokens_v3", network, limit);

  const { data } = await cachedFetch<TokenResponse>(
    db,
    key,
    async () => {
      const xrpPrice = await fetchXrpPriceUsd();
      const isXahau = network.includes("xahau");
      const seeds = isXahau ? WELL_KNOWN_TOKENS_XAHAU : WELL_KNOWN_TOKENS_XRPL;

      // Ledger scan + seed merge run in parallel
      const [ledgerTokens] = await Promise.allSettled([
        fetchTokensFromLedger(network, limit),
      ]);

      const merged = new Map<string, TokenItem>();
      for (const seed of seeds) {
        merged.set(`${seed.currency}:${seed.issuer}`, { ...seed, totalSupply: "0", holders: 0, trustlines: 0 });
      }
      for (const tok of (ledgerTokens.status === "fulfilled" ? ledgerTokens.value : [])) {
        const k = `${tok.currency}:${tok.issuer}`;
        if (merged.has(k)) {
          const ex = merged.get(k)!;
          ex.totalSupply = tok.totalSupply;
          ex.holders     = tok.holders;
          ex.trustlines  = tok.trustlines;
        } else {
          merged.set(k, tok);
        }
      }

      const tokens = Array.from(merged.values())
        .sort((a, b) => b.trustlines - a.trustlines)
        .slice(0, limit);

      // Enrichment: native RPC data + DEX prices in parallel
      await Promise.all([
        (async () => {
          for (let i = 0; i < tokens.length; i += ENRICH_BATCH) {
            await Promise.allSettled(tokens.slice(i, i + ENRICH_BATCH).map((t) => enrichTokenNative(t, network)));
          }
        })(),
        enrichTokenPrices(tokens, network, xrpPrice),
      ]);

      for (const tok of tokens) tok.sparkline = generateSparkline(tok);

      return {
        success: true,
        network,
        type: "tokens" as const,
        count: tokens.length,
        tokens,
        timestamp: new Date().toISOString(),
        xrpPriceUsd: xrpPrice,
      };
    },
    TTL_TOKENS,
  );

  return data;
}

export async function loadNfts(
  network: string,
  limit: number,
  db: D1Database | null,
): Promise<NftResponse> {
  const key = cacheKey("nfts_v3", network, limit);

  const { data } = await cachedFetch<NftResponse>(
    db,
    key,
    async () => {
      const isXahau = network.includes("xahau");
      const half = Math.ceil(limit / 2);

      const [xls20, xls14] = await Promise.allSettled([
        fetchXLS20Nfts(network, limit),
        isXahau ? fetchXLS14Nfts(network, half) : Promise.resolve([] as NftItem[]),
      ]);

      const nfts: NftItem[] = [
        ...(xls20.status === "fulfilled" ? xls20.value : []),
        ...(xls14.status === "fulfilled" ? xls14.value : []),
      ].slice(0, limit);

      return {
        success: true,
        network,
        type: "nfts" as const,
        count: nfts.length,
        nfts,
        timestamp: new Date().toISOString(),
      };
    },
    TTL_NFTS,
  );

  return data;
}

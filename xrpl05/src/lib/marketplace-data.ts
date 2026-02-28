import type { D1Database } from "@cloudflare/workers-types";
import {
  cacheKey,
  cachedFetch,
  readCache,
  writeCache,
  bustCache,
} from "~/lib/utils/d1-cache";

const NETWORK_NODES = {
  xrpl: [
    "https://xrplcluster.com",
    "https://s1.ripple.com",
    "https://s2.ripple.com",
  ],
  xahau: ["https://xahau.network"],
  xrpl_testnet: [
    "https://xrpl.link",
    "https://testnet.xrpl.org",
  ],
  xahau_testnet: ["https://ncl.xahau.org"],
};

const IPFS_GATEWAYS = [
  "https://cloudflare-ipfs.com/ipfs/",
  "https://bithomp.com/en/nft/",
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
  "https://gateway.ipfs.io/ipfs/",
  "https://infura-ipfs.io/ipfs/",
  "https://ipfs.fleek.co/ipfs/",
  "https://ipfs.eternum.tech/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://arweave.net/",
  "https://arweave.cloud/",
  "https://viewblock.io/arweave/",
  "https://ipfs.gazel.pro/ipfs/",
  "https://ipfs.works/ipfs/",
];

const BITHOMP_API_BASE = "https://bithomp.com/api";

const TTL_TOKENS = 60 * 60; // 1 hour
const TTL_NFTS = 5 * 60; // 5 minutes
const MAX_LEDGER_PAGES = 5;
const MAX_NFTS_PER_PAGE = 400;
const MAX_ENRICH_TOKENS = 10;
const META_BATCH = 5;
const ENRICH_BATCH = 2;

export interface SellOffer {
  index: string;
  amount: string | { currency: string; issuer: string; value: string };
  owner: string;
  destination?: string;
  expiration?: number;
}

export interface BuyOffer {
  index: string;
  amount: string | { currency: string; issuer: string; value: string };
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
  nftStandard: "XLS-14" | "XLS-20";
  sellOffers: SellOffer[];
  buyOffers: BuyOffer[];
}

export interface TokenItem {
  currency: string;
  currencyDisplay: string;
  issuer: string;
  issuerName?: string;
  domain?: string;
  logoUrl?: string;
  volume24h?: number;
  priceUsd?: number;
  change24h?: number;
  priceXrp?: number;
  changeXrp24h?: number;
  totalSupply?: string;
  holders?: number;
  trustlines?: number;
  sparkline?: number[];
  statsUpdatedAt?: string;
  network: string;
}

export interface TokenChartData {
  currency: string;
  issuer: string;
  network: string;
  currentPrice: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  prices: { time: number; value: number }[];
  updatedAt: string;
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
  xrpPriceUsd: number;
}

export interface RawNFToken {
  NFTokenID: string;
  NFTokenTaxon: number;
  URI?: string;
  Issuer?: string;
  Flags: number;
  TransferFee: number;
  nft_serial: number;
}

// Interfaces for Bithomp API responses
interface BithompNftMetadata {
  name?: string;
  title?: string;
  description?: string;
  details?: string;
  image?: string;
  image_url?: string;
  artwork?: { uri?: string };
  properties?: { image?: string };
  collection?: string | { name?: string };
}

interface BithompNftApiResponse {
  nft?: {
    metadata?: BithompNftMetadata;
    uri?: string;
  };
  meta?: BithompNftMetadata; // For CDN responses
}

interface BithompTokenApiResponse {
  name?: string;
  issuer: {
    name?: string;
    domain?: string;
  };
  meta?: {
    icon?: string;
  };
  gravatar?: string;
}

interface BithompTokenStatsApiResponse {
  pairs?: Array<{
    price: number;
    change_24h_percent: number;
    volume_24h_xrp: number;
    high_24h?: number;
    low_24h?: number;
    sparkline_24h?: number[];
    history?: Array<{ time: string; price: number }>;
  }>;
}

// Well-known tokens for XRPL
const WELL_KNOWN_TOKENS_XRPL: TokenItem[] = [
  {
    currency: "XRP",
    currencyDisplay: "XRP",
    issuer: "",
    issuerName: "Ripple",
    domain: "ripple.com",
    logoUrl: "https://xrp.art/img/xrp.png",
    network: "xrpl",
  },
  {
    currency: "USD",
    currencyDisplay: "USD",
    issuer: "rhub8F9FqPG5PKgLEQBw7oKuRtaMDLCnmL",
    issuerName: "Bitstamp",
    domain: "bitstamp.net",
    logoUrl: "https://xrp.art/img/bitstamp.png",
    network: "xrpl",
  },
  {
    currency: "EUR",
    currencyDisplay: "EUR",
    issuer: "rhub8F9FqPG5PKgLEQBw7oKuRtaMDLCnmL",
    issuerName: "Bitstamp",
    domain: "bitstamp.net",
    logoUrl: "https://xrp.art/img/bitstamp.png",
    network: "xrpl",
  },
  {
    currency: "USD",
    currencyDisplay: "USD",
    issuer: "rvYAfWj5gh67oV6fW32ZzP3Aw4EHRS71L",
    issuerName: "GateHub",
    domain: "gatehub.net",
    logoUrl: "https://xrp.art/img/gatehub.png",
    network: "xrpl",
  },
  {
    currency: "EUR",
    currencyDisplay: "EUR",
    issuer: "rvYAfWj5gh67oV6fW32ZzP3Aw4EHRS71L",
    issuerName: "GateHub",
    domain: "gatehub.net",
    logoUrl: "https://xrp.art/img/gatehub.png",
    network: "xrpl",
  },
  {
    currency: "JPY",
    currencyDisplay: "JPY",
    issuer: "r94s8px6kSw1uZ1T9ErlsykkDSgfXJMWp8",
    issuerName: "TokyoJPY",
    domain: "tokyojpy.com",
    logoUrl: "https://xrp.art/img/tokyojpy.png",
    network: "xrpl",
  },
  {
    currency: "BTC",
    currencyDisplay: "BTC",
    issuer: "rwyN3zM2PzQoT2i4fT3Y7Mds8gLw711d",
    issuerName: "GateHub",
    logoUrl: "https://xrp.art/img/gatehub.png",
    network: "xrpl",
  },
  {
    currency: "ETH",
    currencyDisplay: "ETH",
    issuer: "rP9jmr5Qh23gXf9dG6846B6E3eC7kQ2j",
    issuerName: "GateHub",
    domain: "gatehub.net",
    logoUrl: "https://xrp.art/img/gatehub.png",
    network: "xrpl",
  },
  {
    currency: "CSC",
    currencyDisplay: "CSC",
    issuer: "rCSCManR6DBoGvW1J1h725K3s9Rfn5m2y",
    issuerName: "CasinoCoin",
    domain: "casinocoin.org",
    logoUrl: "https://xrp.art/img/casinocoin.png",
    network: "xrpl",
  },
  {
    currency: "SOLO",
    currencyDisplay: "SOLO",
    issuer: "rsoLo2S1kiGeWUHWPTc27kCViHLNRamX3",
    issuerName: "Sologenic",
    domain: "sologenic.com",
    logoUrl: "https://xrp.art/img/sologenic.png",
    network: "xrpl",
  },
];

// Well-known tokens for Xahau
const WELL_KNOWN_TOKENS_XAHAU: TokenItem[] = [
  {
    currency: "XAH",
    currencyDisplay: "XAH",
    issuer: "",
    issuerName: "Xahau",
    domain: "xahau.network",
    logoUrl: "https://xahau.network/img/xahau_logo.png",
    network: "xahau",
  },
];

function decodeCurrency(currency: string): string {
  if (currency.length === 3) return currency;
  // XRPL standard for hex currency codes
  const bytes = new TextEncoder().encode(currency);
  const str = String.fromCharCode(...bytes).replace(/\0/g, "");
  return str;
}

function decodeHexUri(uri: string): string {
  if (!uri) return "";
  try {
    const hex = uri.startsWith("0x") ? uri.slice(2) : uri;
    return new TextDecoder().decode(
      Uint8Array.from(hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))),
    );
  } catch {
    return "";
  }
}

function resolveIpfs(url: string): string {
  if (url.startsWith("ipfs://")) {
    const hash = url.replace("ipfs://", "");
    return `${IPFS_GATEWAYS[0]}${hash}`;
  }
  return url;
}

async function rpc(network: string, method: string, params: any) {
  const nodes = NETWORK_NODES[network as keyof typeof NETWORK_NODES];
  let lastErr: any;

  // Try each node in order
  for (const url of nodes) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method,
          params: [params],
        }),
        signal: AbortSignal.timeout(30_000), // 10 second timeout
      });
      const json: any = await res.json(); // Explicitly type as any
      if (json.result) {
        return json.result;
      } else if (json.error) {
        lastErr = new Error(json.error.message);
        throw lastErr;
      }
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  throw lastErr || new Error(`Failed to fetch from any ${network} RPC node`);
}

export function getD1(platform: any): D1Database | null {
  const env = platform?.env;
  if (!env) return null;
  return env.DB;
}

let _xrpPriceCache: { price: number; ts: number } | null = null;
async function fetchXrpPriceUsd() {
  const now = Date.now();
  if (_xrpPriceCache && now - _xrpPriceCache.ts < 5 * 60 * 1000) {
    return _xrpPriceCache.price; // Cache for 5 minutes
  }

  const apis = [
    {
      url: "https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd",
      extract: (data: any) => data?.ripple?.usd,
    },
    {
      url: "https://min-api.cryptocompare.com/data/price?fsym=XRP&tsyms=USD",
      extract: (data: any) => data?.USD,
    },
    {
      url: "https://api.coinbase.com/v2/prices/XRP-USD/spot",
      extract: (data: any) => parseFloat(data?.data?.amount),
    },
  ];

  for (const api of apis) {
    try {
      const res = await fetch(api.url, {
        signal: AbortSignal.timeout(5_000),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const price = api.extract(data);
      if (typeof price === "number" && !isNaN(price)) {
        _xrpPriceCache = { price, ts: now };
        return price;
      }
    } catch (e) {
      console.warn(`Failed to fetch XRP price from ${api.url}:`, e);
    }
  }
  throw new Error("Failed to fetch XRP price from any API");
}

async function fetchMeta(uri: string, nftokenId?: string): Promise<{ image: string; name: string; description: string; collection: string; }> {
  const empty = { image: "", name: "", description: "", collection: "" };
  if (!uri && !nftokenId) return empty;

  // 1. Try Bithomp API for specific NFT metadata using nftokenId
  if (nftokenId) {
    try {
      const bithompNftApiUrl = `${BITHOMP_API_BASE}/v2/nfts/${nftokenId}`;
      const r = await fetch(bithompNftApiUrl, {
        signal: AbortSignal.timeout(5_000),
      });
      if (r.ok) {
        const m: BithompNftApiResponse = await r.json();
        if (m && m.nft && m.nft.metadata) {
          // Bithomp v2/nfts/{nftokenId} returns { nft: { metadata: { ... } } }
          const meta = m.nft.metadata;
          const img =
            meta.image ||
            meta.image_url ||
            meta.artwork?.uri ||
            meta.properties?.image ||
            "";
          return {
            image: resolveIpfs(img),
            name: meta.name || meta.title || "",
            description: meta.description || meta.details || "",
            collection: typeof meta.collection === 'string' ? meta.collection : meta.collection?.name || "",
          };
        } else if (m && m.nft && m.nft.uri) {
          // Sometimes it might return just the uri if metadata isn't directly embedded
          // In this case, we can try to use the Bithomp CDN for the URI
          const resolvedUriFromBithomp = decodeHexUri(m.nft.uri);
          if (resolvedUriFromBithomp) {
            const cdnMeta = await fetchMeta(resolvedUriFromBithomp); // Recursive call, but without nftokenId
            if (cdnMeta.name) return cdnMeta;
          }
        }
      }
    } catch (e) {
      console.warn(`[marketplace] Bithomp NFT API fetchMeta failed for ${nftokenId}:`, e);
      // Continue to next options if Bithomp API fails
    }
  }

  // 2. Try Bithomp CDN for IPFS URIs (if nftokenId didn't yield results or wasn't used)
  if (uri.startsWith("ipfs://") || uri.includes("ipfs.io/ipfs/")) {
    try {
      const ipfsHashMatch = uri.match(/(Qm[a-zA-Z0-9]{44}|bafy[a-zA-Z0-9]{55,})/);
      if (ipfsHashMatch && ipfsHashMatch[0]) {
        const ipfsHash = ipfsHashMatch[0];
        const bithompCdnUrl = `${BITHOMP_API_BASE}/cdn/nft/${ipfsHash}`;
        const r = await fetch(bithompCdnUrl, { signal: AbortSignal.timeout(5_000) });
        if (r.ok) {
          const m: BithompNftApiResponse = await r.json();
          if (m && m.meta) {
            // Bithomp CDN usually returns { meta: { ... } }
            const meta = m.meta;
            const img =
              meta.image ||
              meta.image_url ||
              meta.artwork?.uri ||
              meta.properties?.image ||
              "";
            return {
              image: resolveIpfs(img),
              name: meta.name || meta.title || "",
              description: meta.description || meta.details || "",
              collection:
                typeof meta.collection === 'string' ? meta.collection : meta.collection?.name || "",
            };
          }
        }
      }
    } catch (e) {
      console.warn("[marketplace] Bithomp CDN fetchMeta failed:", e);
      // Continue to IPFS gateways if Bithomp fails
    }
  }

  // 3. Fallback to IPFS gateways and generic URL fetching using the URI
  const resolved = resolveIpfs(uri);
  const urls = resolved.includes("ipfs.io/ipfs/")
    ? IPFS_GATEWAYS.map((g) => resolved.replace(IPFS_GATEWAYS[0], g))
    : [resolved];

  for (const url of urls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (!r.ok) continue;
      const ct = r.headers.get("content-type") || "";
      if (ct.startsWith("image/")) return { ...empty, image: url };
      const m: Record<string, any> = await r.json();
      const img =
        m.image || m.image_url || m.artwork?.uri || m.properties?.image || "";
      return {
        image: resolveIpfs(img),
        name: m.name || m.title || "",
        description: m.description || m.details || "",
        collection: m.collection?.name || m.collection || m.series || "",
      };
    } catch (e) {
      console.warn(`[marketplace] Generic fetchMeta failed for ${url}:`, e);
      continue;
    }
  }

  return empty;
}

async function getSellOffers(network: string, nft_id: string): Promise<SellOffer[]> {
  const r = await rpc(network, "nft_sell_offers", {
    nft_id,
    ledger_index: "validated",
  });
  return (r.offers || []).map((o: any) => ({
    index: o.nft_offer_index,
    amount: o.amount,
    owner: o.owner,
    destination: o.destination,
    expiration: o.expiration,
  }));
}

async function getBuyOffers(network: string, nft_id: string): Promise<BuyOffer[]> {
  const r = await rpc(network, "nft_buy_offers", {
    nft_id,
    ledger_index: "validated",
  });
  return (r.offers || []).map((o: any) => ({
    index: o.nft_offer_index,
    amount: o.amount,
    owner: o.owner,
    expiration: o.expiration,
  }));
}

function isStaleMarker(err: any): boolean {
  const msg = typeof err === "string" ? err : err.message || "";
  return msg.includes("stale marker");
}

const XRPL_MARKETPLACE_ACCOUNTS = [
  "rP9jmr5Qh23gXf9dG6846B6E3eC7kQ2j", // some known account, e.g., an NFT marketplace account
];

async function fetchXLS20Nfts(
  network: string,
  limit: number,
): Promise<NftItem[]> {
  // If we're on XRPL, querying ledger_data is way too slow for a generic feed.
  // Instead, we will simulate a global marketplace feed by aggregating NFTs from
  // well-known high-volume accounts or known escrows.
  const accountsToScan = XRPL_MARKETPLACE_ACCOUNTS; // Removed network specific accounts as the array is not an object.
  const rawEntries: { token: RawNFToken; owner: string }[] = [];

  for (const acc of accountsToScan) {
    try {
      const res = await rpc(network, "account_nfts", {
        account: acc,
        limit: Math.ceil(limit / 2),
      });
      const nfts = res.account_nfts || [];
      for (const t of nfts) {
        if (rawEntries.length < limit) rawEntries.push({ token: t, owner: acc });
      }
      if (rawEntries.length >= limit) break;
    } catch {
      continue; // Skip if account not found or error
    }
  }

  // If still empty (e.g., testnet or wrong network), fallback to a small ledger scan
  if (rawEntries.length === 0) {
    try {
      const res = await rpc(network, "ledger_data", {
        ledger_index: "validated",
        type: "nft_page",
        limit: limit * 2,
      });
      for (const page of res.state || []) {
        if (!page.NFTokens) continue;
        const owner: string = page.Account || "";
        for (const { NFToken: t } of page.NFTokens as { NFToken: RawNFToken }[]) {
          if (rawEntries.length < limit) rawEntries.push({ token: t, owner });
        }
      }
    } catch (e) {
      console.warn("[marketplace] Fallback scan failed", e);
    }
  }

  // Phase 2: enrich in parallel batches (metadata + offers)
  const results: NftItem[] = [];
  for (let i = 0; i < rawEntries.length; i += META_BATCH) {
    const batch = rawEntries.slice(i, i + META_BATCH);
    const enriched = await Promise.allSettled(
      batch.map(async ({ token: t, owner }) => {
        const uri = decodeHexUri(t.URI || "");
        const [meta, sell, buy] = await Promise.all([
          fetchMeta(uri, t.NFTokenID), // Pass nftokenId here
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
    for (const res of enriched) {
      if (res.status === "fulfilled") results.push(res.value);
    }
  }
  return results;
}

async function fetchXLS14Nfts(
  network: string,
  limit: number,
): Promise<NftItem[]> {
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
        const nftokenId = obj.index || obj.URITokenID || "";
        const meta = await fetchMeta(uri, nftokenId); // Pass nftokenId here
        return {
          nftokenId: nftokenId,
          issuer: obj.Issuer || "",
          owner: obj.Owner || obj.Issuer || "",
          taxon: 0,
          serial: 0,
          uri,
          resolvedUri: resolveIpfs(uri),
          image: meta.image,
          name: meta.name || `URIToken ${(nftokenId || "").slice(0, 8)}`,
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

async function fetchTokensFromLedger(
  network: string,
  limit: number,
): Promise<Map<string, TokenItem>> {
  const map = new Map<string, TokenItem>();
  let marker: unknown;
  let pages = 0;

  do {
    const params: Record<string, unknown> = {
      ledger_index: "validated",
      type: "state",
      limit: Math.min(400, limit),
    };
    if (marker) params.marker = marker;

    let res: any;
    try {
      res = await rpc(network, "ledger_data", params);
    } catch (err) {
      if (isStaleMarker(err)) {
        console.warn("[marketplace] stale marker, stopping token scan");
        break;
      }
      break;
    }

    marker = res.marker;
    pages++;

    // filter for trustlines and aggregate
    for (const obj of res.state || []) {
      if (obj.LedgerEntryType !== "rippleState") continue;
      const currency = decodeCurrency(obj.data?.currency || obj.currency); // Use optional chaining for obj.data
      if (currency === "XRP") continue; // Not a trustline asset

      const balVal = Number(obj.Balance.value);
      if (isNaN(balVal)) continue;

      const issuer = obj.HighLimit.issuer || obj.LowLimit.issuer;
      if (!issuer) continue;

      const key = `${currency}:${issuer}`;
      if (!map.has(key)) {
        const balAbs = Math.abs(balVal);
        const tok: TokenItem = {
          currency,
          currencyDisplay: currency,
          issuer,
          totalSupply: balAbs.toString(),
          holders: 1, // Start with 1 holder
          trustlines: 1, // Start with 1 trustline
          network,
        };
        map.set(key, tok);
      } else {
        const existing = map.get(key)!;
        existing.holders = (existing.holders || 0) + 1;
        existing.trustlines = (existing.trustlines || 0) + 1;
        // Simple aggregation of total supply (might be inaccurate for some cases)
        const currentSupply = Number(existing.totalSupply || "0");
        existing.totalSupply = (currentSupply + Math.abs(balVal)).toString();
      }
    }

    if (pages >= MAX_LEDGER_PAGES) break;
  } while (marker && map.size < limit);

  return map;
}

async function enrichTokenNative(
  network: string,
  token: TokenItem,
): Promise<TokenItem> {
  // Use Bithomp for token info
  try {
    const info = await rpc(network, "account_info", { account: token.issuer });
    const acct = info.account_data;
    if (acct?.Domain) {
      token.domain = new TextDecoder().decode(
        Uint8Array.from(acct.Domain.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))),
      );
    }
  } catch (e) {
    console.warn(`[marketplace] Failed to get account info for ${token.issuer}:`, e);
  }

  // Try Bithomp /v2/token API for additional info
  try {
    const currencyHex = token.currency.length === 3 ? "" : token.currency; // Bithomp uses hex for non-standard
    const url = `${BITHOMP_API_BASE}/v2/token/${token.issuer}/${token.currency}${currencyHex ? `?rh=${currencyHex}` : ''}`;
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      const data: BithompTokenApiResponse = await res.json();
      if (data) {
        token.currencyDisplay = data.name || token.currencyDisplay;
        token.issuerName = data.issuer.name || token.issuerName;
        token.logoUrl = data.meta?.icon || data.gravatar;
        token.domain = data.issuer.domain || token.domain;
      }
    }
  } catch (e) {
    console.warn(`[marketplace] Bithomp token info failed for ${token.currency}:${token.issuer}:`, e);
  }

  return token;
}

async function enrichTokenPrices(
  network: string,
  tokens: TokenItem[],
): Promise<TokenItem[]> {
  const xrpPriceUsd = await fetchXrpPriceUsd();
  const results: TokenItem[] = []; // Explicitly type results

  // Batch requests to external APIs
  for (let i = 0; i < tokens.length; i += ENRICH_BATCH) {
    const slice = tokens.slice(i, i + ENRICH_BATCH);
    await Promise.allSettled(
      slice.map(async (token) => {
        if (token.currency === "XRP") {
          token.priceUsd = xrpPriceUsd;
          token.priceXrp = 1;
          token.change24h = 0;
          token.changeXrp24h = 0;
          token.sparkline = generateSparkline(xrpPriceUsd);
          results.push(token);
          return;
        }

        const displayName = `${token.currencyDisplay || token.currency}:${token.issuer}`;
        try {
          // Fetch from Bithomp API for price data
          const res = await fetch(
            `${BITHOMP_API_BASE}/v2/token/${token.issuer}/${token.currency}/stats`,
            { signal: AbortSignal.timeout(5_000) },
          );
          if (res.ok) {
            const data: BithompTokenStatsApiResponse = await res.json();
            if (data?.pairs && data.pairs.length > 0) {
              const pair = data.pairs[0]; // Assuming the first pair is the most relevant
              token.priceXrp = pair.price;
              token.priceUsd = pair.price * xrpPriceUsd;
              token.change24h = pair.change_24h_percent;
              token.changeXrp24h = pair.change_24h_percent; // Assuming this is also XRP based change
              token.volume24h = pair.volume_24h_xrp; // Volume in XRP
              token.sparkline = pair.sparkline_24h || generateSparkline(token.priceXrp || 0);
              token.statsUpdatedAt = new Date().toISOString();
            }
          }
        } catch (e) {
          console.warn(`[marketplace] Bithomp token stats failed for ${displayName}:`, e);
          // Fallback to manual orderbook for XRP price if Bithomp fails
          try {
            const nativeCurrency = { currency: "XRP" };
            const askResult = await rpc(network, "book_offers", {
              taker_gets: nativeCurrency,
              taker_pays: { currency: token.currency, issuer: token.issuer },
              limit: 1,
              ledger_index: "validated",
            });

            const offers = askResult.offers || [];
            let bestPrice = 0;
            if (offers.length > 0) {
              const gets = offers[0].TakerGets;
              const pays = offers[0].TakerPays;
              if (typeof gets === "object" && gets !== null && "value" in gets && typeof pays === "object" && pays !== null && "value" in pays) {
                bestPrice = parseFloat(gets.value) / parseFloat(pays.value);
              } else if (typeof gets === "string" && typeof pays === "string") {
                bestPrice = Number(gets) / Number(pays);
              }
            }
            if (bestPrice) {
              token.priceXrp = bestPrice;
              token.priceUsd = bestPrice * xrpPriceUsd;
              token.sparkline = generateSparkline(bestPrice);
            }
          } catch (e) {
            console.warn(`[marketplace] Orderbook lookup failed for ${displayName}:`, e);
          }
        }
        results.push(token);
      }),
    );
  }
  return results;
}

function generateSparkline(baseVal: number): number[] {
  const seed = Math.random();
  const pts = Array(24).fill(0); // 24 points for 24 hours
  let val = baseVal * (1 + (Math.random() - 0.5) * 0.1); // Start with some variance

  for (let i = 0; i < pts.length; i++) {
    const drift = (Math.random() - 0.5) * 0.05; // Small random drift
    val = val * (1 + drift);
    pts[i] = Math.max(0, val); // Ensure non-negative
  }
  return pts;
}

async function fetchTokenChartData(
  network: string,
  currency: string,
  issuer: string,
): Promise<TokenChartData> {
  const xrpPriceUsd = await fetchXrpPriceUsd();
  const displayName = `${currency}:${issuer}`;
  const now = Date.now();
  const defaultSparkline = generateSparkline(0); // Default if no data

  try {
    const res = await fetch(
      `${BITHOMP_API_BASE}/v2/token/${issuer}/${currency}/stats?period=24h`, // Request 24h stats
      { signal: AbortSignal.timeout(5_000) },
    );
    if (res.ok) {
      const data: BithompTokenStatsApiResponse = await res.json();
      if (data?.pairs && data.pairs.length > 0) {
        const pair = data.pairs[0];
        const prices = pair.history?.map((h: any) => ({
          time: new Date(h.time).getTime(),
          value: h.price * xrpPriceUsd, // Convert to USD
        })) || defaultSparkline.map((val, i) => ({ time: now - (23 - i) * 3600 * 1000, value: val * xrpPriceUsd }));

        return {
          currency,
          issuer,
          network,
          currentPrice: pair.price * xrpPriceUsd,
          change24h: pair.change_24h_percent,
          volume24h: pair.volume_24h_xrp * xrpPriceUsd, // Convert volume to USD
          high24h: (pair.high_24h || 0) * xrpPriceUsd,
          low24h: (pair.low_24h || 0) * xrpPriceUsd,
          prices,
          updatedAt: new Date().toISOString(),
        };
      }
    }
  } catch (e) {
    console.warn(`[marketplace] Bithomp token chart data failed for ${displayName}:`, e);
  }

  // Fallback / mock data if Bithomp fails or not found
  let currentPrice = 0;
  if (currency === "XRP" && issuer === "") {
    currentPrice = xrpPriceUsd;
  } else {
    try {
      // Try to get current price from orderbook if Bithomp failed
      const nativeCurrency = { currency: "XRP" };
      const askResult = await rpc(network, "book_offers", {
        taker_gets: nativeCurrency,
        taker_pays: { currency: currency, issuer: issuer },
        limit: 1,
        ledger_index: "validated",
      });

      const offers = askResult.offers || [];
      let bestPrice = 0;
      if (offers.length > 0) {
        const gets = offers[0].TakerGets;
        const pays = offers[0].TakerPays;
        if (typeof gets === "object" && gets !== null && "value" in gets && typeof pays === "object" && pays !== null && "value" in pays) {
          bestPrice = parseFloat(gets.value) / parseFloat(pays.value);
        } else if (typeof gets === "string" && typeof pays === "string") {
          bestPrice = Number(gets) / Number(pays);
        }
      }
      currentPrice = bestPrice * xrpPriceUsd;
    } catch (e) {
      console.warn(`[marketplace] Fallback orderbook lookup for chart data failed for ${displayName}:`, e);
    }
  }

  // Generate synthetic data if no real data
  const seed = Math.random();
  const points = Array(24).fill(0); // 24 points for 24 hours
  let val = currentPrice > 0 ? currentPrice : (seed + 0.1) * 10; // Start with a plausible value

  const prices = [];
  for (let i = 0; i < points.length; i++) {
    const noise = (Math.random() - 0.5) * 0.1 * val;
    val = Math.max(0, val + noise);
    prices.push({ time: now - (23 - i) * 3600 * 1000, value: val });
  }

  return {
    currency,
    issuer,
    network,
    currentPrice: prices[prices.length - 1]?.value || 0,
    change24h: 0, // Cannot determine without historical data
    volume24h: 0,
    high24h: Math.max(...prices.map((p) => p.value)),
    low24h: Math.min(...prices.map((p) => p.value)),
    prices,
    updatedAt: new Date().toISOString(),
  };
}

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

      const seeds: TokenItem[] = isXahau
        ? [...WELL_KNOWN_TOKENS_XAHAU]
        : [...WELL_KNOWN_TOKENS_XRPL];

      const ledgerTokens = await fetchTokensFromLedger(network, limit - seeds.length);

      // Merge well-known tokens with ledger tokens, prioritizing well-known info
      for (const [k, v] of ledgerTokens.entries()) {
        const ex = seeds.find((t) => t.currency === v.currency && t.issuer === v.issuer);
        if (ex) {
          ex.totalSupply = v.totalSupply;
          ex.holders = v.holders;
          ex.trustlines = v.trustlines;
        } else {
          seeds.push(v);
        }
      }

      // Enrich tokens in parallel
      const tokens = (
        await Promise.all(
          seeds.map(async (token) => {
            const enrichedToken = await enrichTokenNative(network, token);
            return enrichedToken;
          }),
        )
      ).slice(0, limit);

      const tokensWithPrices = await enrichTokenPrices(network, tokens);

      return {
        success: true,
        network,
        type: "tokens" as const,
        count: tokensWithPrices.length,
        tokens: tokensWithPrices,
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

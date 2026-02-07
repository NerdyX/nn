import { RequestHandler } from "@builder.io/qwik-city";
import { Client, dropsToXrp } from "xrpl";

const NODE_TIMEOUT_MS = 8000;

export const onGet: RequestHandler = async ({
  query,
  json,
  error,
  headers,
}) => {
  const network = query.get("network") || "xrpl";
  const address = query.get("address")?.trim();

  if (!address || address.length < 25 || !address.startsWith("r")) {
    throw error(
      400,
      "Invalid or missing XRPL/Xahau address (must start with 'r')",
    );
  }

  // Network fallback nodes (public & reliable)
  const networkConfig: Record<string, string[]> = {
    xrpl: [
      "wss://xrplcluster.com",
      "wss://s1.ripple.com",
      "wss://s2.ripple.com",
      "wss://xrpl.link",
    ],
    xahau: [
      "wss://xahau.network",
      "wss://xahau-rpc.com",
      "wss://xahau-rpc2.com",
    ],
    testnet: ["wss://s.altnet.rippletest.net:51233"],
    devnet: ["wss://s.devnet.rippletest.net:51233"],
  };

  const urls = networkConfig[network] || networkConfig.xrpl;

  headers.set("Cache-Control", "public, max-age=10"); // cache 10s – balances change slowly

  let lastError: any = null;

  for (const url of urls) {
    const client = new Client(url);
    let domain: string | null = null;

    try {
      // Connect with timeout
      const connectPromise = client.connect();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Connection timeout")),
          NODE_TIMEOUT_MS,
        ),
      );
      await Promise.race([connectPromise, timeoutPromise]);

      // ──────────────────────────────────────────────
      // 1. Core: account_info
      // ──────────────────────────────────────────────
      const accountInfo = await client.request({
        command: "account_info",
        account: address,
        ledger_index: "validated",
        strict: true,
      });

      const acc = accountInfo.result.account_data || {};
      const ledgerIndex = accountInfo.result.ledger_index;

      // Decode domain if present
      if (acc.Domain) {
        try {
          domain = Buffer.from(acc.Domain, "hex").toString("utf8");
        } catch {
          domain = null;
        }
      }

      // ──────────────────────────────────────────────
      // 2. Trust lines (tokens / issued currencies)
      // ──────────────────────────────────────────────
      let trustLines = 0;
      let issuedCurrencies = 0;
      try {
        const lines = await client.request({
          command: "account_lines",
          account: address,
          ledger_index: "validated",
        });
        trustLines = lines.result.lines?.length || 0;
        issuedCurrencies =
          lines.result.lines?.filter((l: any) => l.limit_peer > 0)?.length || 0;
      } catch {
        domain = null;
      }

      // ──────────────────────────────────────────────
      // 3. Recent transactions (last 20)
      // ──────────────────────────────────────────────
      let transactions: any[] = [];
      try {
        const txRes = await client.request({
          command: "account_tx",
          account: address,
          limit: 20,
          forward: false, // newest first
          ledger_index_min: -1,
          ledger_index_max: -1,
        });

        transactions = (txRes.result.transactions || []).map((entry: any) => {
          const tx = entry.tx || entry;
          let amountStr: string | undefined;

          if (tx.Amount) {
            amountStr =
              typeof tx.Amount === "string"
                ? String(dropsToXrp(tx.Amount))
                : `${tx.Amount.value} ${tx.Amount.currency}${tx.Amount.issuer ? ` (${tx.Amount.issuer.slice(0, 8)}…)` : ""}`;
          }

          return {
            hash: tx.hash,
            type: tx.TransactionType,
            from: tx.Account,
            to: tx.Destination,
            amount: amountStr ?? tx.Amount?.value ?? null,
            fee: tx.Fee ? String(dropsToXrp(tx.Fee)) : null,
            date: tx.date
              ? new Date((tx.date + 946684800) * 1000).toISOString()
              : null,
            ledger: tx.ledger_index || entry.ledger_index,
            flags: tx.Flags,
            memos: tx.Memos || [],
            destinationTag: tx.DestinationTag || null,
            // Add more if needed: memos, destinationTag, etc.
          };
        });
      } catch {
        domain = null;
      }

      // ──────────────────────────────────────────────
      // 4. NFTs count
      // ──────────────────────────────────────────────
      let nftCount = 0;
      try {
        const nfts = await client.request({
          command: "account_nfts",
          account: address,
          limit: 1, // we only need count
        });
        nftCount = nfts.result.account_nfts?.length || 0;
      } catch {
        domain = null;
      }

      // ──────────────────────────────────────────────
      // 5. Active offers count
      // ──────────────────────────────────────────────
      let offerCount = 0;
      try {
        const offers = await client.request({
          command: "account_offers",
          account: address,
          limit: 1,
        });
        offerCount = offers.result.offers?.length || 0;
      } catch {
        domain = null;
      }

      // ──────────────────────────────────────────────
      // 6. AMM positions (count only)
      // ──────────────────────────────────────────────
      let ammCount = 0;
      try {
        const amm = await client.request({
          command: "account_amm",
          account: address,
          limit: 1,
        } as any);
        ammCount = (amm.result as any).amm?.length || 0;
      } catch {
        domain = null;
      }

      // ──────────────────────────────────────────────
      // Build clean response
      // ──────────────────────────────────────────────
      json(200, {
        success: true,
        network,
        address,
        validatedLedger: ledgerIndex,
        queriedAt: new Date().toISOString(),
        account: {
          address: acc.Account || address,
          balanceXrp: acc.Balance ? String(dropsToXrp(acc.Balance)) : "0",
          sequence: acc.Sequence || 0,
          ownerCount: acc.OwnerCount || 0,
          flags: acc.Flags || 0,
          flagsDecoded: {
            defaultRipple: !!(acc.Flags & 0x00800000),
            requireAuth: !!(acc.Flags & 0x00040000),
            requireDestTag: !!(acc.Flags & 0x00020000),
            freeze: !!(acc.Flags & 0x00400000),
            noFreeze: !!(acc.Flags & 0x00200000),
            globalFreeze: !!(acc.Flags & 0x00100000),
            disallowXRP: !!(acc.Flags & 0x00080000),
          },
          regularKey: acc.RegularKey || null,
          signerListCount: (acc as any).SignerLists?.length || 0,
          domain: domain || null,
          emailHash: acc.EmailHash || null,
          transferRate: acc.TransferRate
            ? (acc.TransferRate / 1_000_000_000).toFixed(9)
            : null,
          tickSize: acc.TickSize || null,
          // Counts / summaries
          trustLines,
          issuedCurrencies,
          ownedNFTs: nftCount,
          activeOffers: offerCount,
          ammPositions: ammCount,
        },
        recentTransactions: transactions,
        server: {
          url,
          latencyMs:
            Date.now() - ((globalThis as any).__startTime || Date.now()), // optional
        },
      });

      await client.disconnect();
      return;
    } catch (err: any) {
      lastError = err;
      console.warn(`Node ${url} failed:`, err.message);
      try {
        await client.disconnect();
      } catch {
        // ignore
      }
    }
  }

  // All nodes failed
  console.error(`All nodes failed for ${address} on ${network}`, lastError);
  throw error(
    503,
    "Temporarily unable to fetch account data — all nodes unreachable",
  );
};

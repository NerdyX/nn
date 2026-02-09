// src/routes/api/xaman/sign-transaction/index.ts

import type { RequestHandler } from "@builder.io/qwik-city";
import { Xumm } from "xumm";

export const onPost: RequestHandler = async (requestEvent) => {
  try {
    const apiKey =
      (requestEvent.env.get("PUBLIC_XAMAN_API_KEY") as string | undefined) ??
      process.env.PUBLIC_XAMAN_API_KEY;
    const apiSecret =
      (requestEvent.env.get("XAMAN_API_SECRET") as string | undefined) ??
      process.env.XAMAN_API_SECRET;

    if (!apiKey || !apiSecret) {
      requestEvent.json(500, {
        error: "Missing Xaman API credentials. Check environment variables.",
      });
      return;
    }

    const xumm = new Xumm(apiKey, apiSecret);

    const body = (await requestEvent.request.json()) as {
      txjson?: Record<string, unknown>;
      userAccount?: string;
      network?: "xrpl" | "xahau";
    };

    const { txjson, userAccount, network } = body;

    if (!txjson || !txjson.TransactionType) {
      requestEvent.json(400, {
        error:
          "Transaction JSON with a valid TransactionType is required",
      });
      return;
    }

    const appUrl =
      requestEvent.env.get("PUBLIC_APP_URL") ?? "http://localhost:5173";

    // Determine the network definition to pass to Xaman
    // Xahau requires the NetworkId field so Xaman routes the
    // signing request to the correct network endpoint.
    const networkId = network === "xahau" ? 21337 : undefined;

    const txjsonWithAccount: Record<string, unknown> = {
      ...txjson,
      Account: userAccount || txjson.Account,
    };

    // Attach NetworkID when signing on Xahau so Xaman knows which
    // network to submit against.
    if (networkId !== undefined) {
      txjsonWithAccount.NetworkID = networkId;
    }

    // Create a transaction payload for signing
    const payload = await xumm.payload?.create({
      txjson: txjsonWithAccount,
      options: {
        submit: true, // Auto-submit after signing
        return_url: {
          app: `${appUrl}/dashboard`,
          web: `${appUrl}/dashboard`,
        },
        expire: 5, // Expires in 5 minutes
      },
      custom_meta: {
        identifier: `tx-${Date.now()}`,
        blob: {
          purpose: "transaction",
          type: String(txjson.TransactionType),
          network: network ?? "xrpl",
          timestamp: new Date().toISOString(),
        },
      },
    } as any);

    if (!payload) {
      requestEvent.json(500, {
        error: "Failed to create transaction payload",
      });
      return;
    }

    requestEvent.json(200, {
      uuid: payload.uuid,
      refs: {
        qr_png: payload.refs.qr_png,
        qr_matrix: payload.refs.qr_matrix,
        websocket: payload.refs.websocket_status,
        xapp: payload.next.always,
      },
      pushed: payload.pushed,
    });
  } catch (error) {
    console.error("Xaman transaction signing error:", error);
    requestEvent.json(500, {
      error: "Failed to create transaction signing request",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// src/routes/api/xaman/create-payload/index.ts

import type { RequestHandler } from "@builder.io/qwik-city";
import { Xumm } from "xumm";

export const onPost: RequestHandler = async (requestEvent) => {
  try {
    // On Cloudflare Pages, env vars come from requestEvent.env
    // Fallback to process.env for local dev
    const apiKey =
      (requestEvent.env.get("PUBLIC_XAMAN_API_KEY") as string | undefined) ??
      process.env.XAMAN_CLIENT_ID;
    const apiSecret =
      (requestEvent.env.get("XAMAN_API_SECRET") as string | undefined) ??
      process.env.XAMAN_CLIENT_SECRET;

    if (!apiKey || !apiSecret) {
      requestEvent.json(500, {
        error: "Missing Xaman API credentials. Check environment variables.",
      });
      return;
    }

    const xumm = new Xumm(apiKey, apiSecret);

    const body = (await requestEvent.request.json()) as {
      txjson?: Record<string, unknown>;
    };

    const { txjson } = body;

    const appUrl =
      requestEvent.env.get("PUBLIC_APP_URL") ?? "https://xrpl05.pages.dev/";

    // Create a SignIn payload (or custom transaction)
    const payload = await xumm.payload?.create({
      txjson: txjson ?? {
        TransactionType: "SignIn",
      },
      options: {
        submit: false,
        return_url: {
          app: `${appUrl}dashboard`,
          web: `${appUrl}dashboard`,
        },
      },
      custom_meta: {
        identifier: `login-${Date.now()}`,
        blob: {
          purpose: "authentication",
          timestamp: new Date().toISOString(),
        },
      },
    } as any);

    if (!payload) {
      requestEvent.json(500, {
        error: "Failed to create payload",
      });
      return;
    }

    requestEvent.json(200, {
      uuid: payload.uuid,
      refs: {
        qr_png: payload.refs.qr_png,
        qr_matrix: payload.refs.qr_matrix,
        qr_uri_quality_opts: payload.refs.qr_uri_quality_opts,
        websocket: payload.refs.websocket_status,
        xapp: payload.next.always,
      },
    });
  } catch (error) {
    console.error("Xaman payload creation error:", error);
    requestEvent.json(500, {
      error: "Failed to create Xaman payload",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

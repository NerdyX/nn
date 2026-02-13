// src/routes/api/xaman/check-payload/index.ts

import type { RequestHandler } from "@builder.io/qwik-city";
import { Xumm } from "xumm";

export const onGet: RequestHandler = async (requestEvent) => {
  try {
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

    const uuid = requestEvent.query.get("uuid");

    if (!uuid) {
      requestEvent.json(400, {
        error: "UUID parameter is required",
      });
      return;
    }

    // Get payload status from Xaman
    const payload = await xumm.payload?.get(uuid);

    if (!payload) {
      requestEvent.json(500, {
        error: "Failed to retrieve payload",
        details: "Payload is null or undefined",
      });
      return;
    }

    // If signed, set JWT cookie for session persistence
    if (payload.meta.signed && payload.response?.account) {
      requestEvent.cookie.set("xaman_jwt", payload.response.account, {
        path: "dashboard",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: [7, "days"],
      });
    }

    // Return structured response
    requestEvent.json(200, {
      uuid: payload.meta.uuid,
      meta: {
        exists: payload.meta.exists,
        resolved: payload.meta.resolved,
        signed: payload.meta.signed,
        cancelled: payload.meta.cancelled,
        expired: payload.meta.expired,
        rejected: !payload.meta.signed && payload.meta.resolved,
        app_opened: payload.meta.app_opened,
        opened_by_deeplink: payload.meta.opened_by_deeplink,
      },
      response: payload.response
        ? {
            account: payload.response.account,
            txid: payload.response.txid,
            dispatched: payload.response.dispatched_result,
            multisign_account: payload.response.multisign_account,
            hex: payload.response.hex,
          }
        : null,
      custom_meta: payload.custom_meta,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Xaman payload check error:", message);

    requestEvent.json(500, {
      error: "Failed to check payload status",
      details: message,
    });
  }
};

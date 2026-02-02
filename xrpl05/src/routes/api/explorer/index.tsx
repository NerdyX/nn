// src/routes/api/explorer/index.tsx
import { RequestHandler } from "@builder.io/qwik-city";

export const onGet: RequestHandler = async ({ query, json }) => {
  const network = query.get("network") || "xrpl";
  const address = query.get("address") || "";

  if (!address || address.length < 25) {
    throw { status: 400 };
  }

  try {
    // Map network to WebSocket URL
    const wsUrls = {
      xrpl: "wss://s1.ripple.com",
      xahau: "wss://xahau.network:51234",
    };

    const wsUrl = wsUrls[network as keyof typeof wsUrls] || wsUrls.xrpl;

    // Connect to XRPL WebSocket
    const ws = new WebSocket(wsUrl);

    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("Request timeout"));
      }, 10000);

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            id: Date.now(),
            command: "account_info",
            account: address,
            strict: true,
            ledger_index: "validated",
          }),
        );
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        try {
          const data = JSON.parse(event.data);
          if (data.id === Date.now().toString().slice(-10)) {
            resolve(data);
            ws.close();
          }
        } catch (e) {
          reject(e);
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("WebSocket error"));
      };
    });

    const result = response as any;

    if (result.status === "error") {
      throw { status: 500 };
    }

    // Format response for your frontend
    const accountData = result.result?.account_data || {};
    const infoData = result.result || {};

    json(200, {
      account: {
        account: infoData.account || address,
        balance: (Number(accountData.Balance) / 1_000_000).toFixed(2) + " XRP",
        sequence: accountData.Sequence || 0,
        owner_count: accountData.OwnerCount || 0,
      },
      // Add more data as needed
      raw: result.result,
    });
  } catch (error: any) {
    console.error("Explorer API error:", error);
    throw { status: 500 };
  }
};

// lib/xaman-auth.ts

let pollInterval: ReturnType<typeof setInterval> | null = null;

interface CreatePayloadResponse {
  uuid: string;
  refs: {
    qr_png: string;
    qr_matrix: string;
    qr_uri_quality_opts: string[];
    websocket: string;
    xapp: string;
  };
}

interface CheckPayloadResponse {
  uuid: string;
  meta: {
    exists: boolean;
    resolved: boolean;
    signed: boolean;
    cancelled: boolean;
    expired: boolean;
    rejected: boolean;
    app_opened: boolean;
    opened_by_deeplink: boolean;
  };
  response: {
    account: string;
    txid: string | null;
    dispatched: string | null;
    multisign_account: string | null;
    hex: string | null;
  } | null;
  custom_meta: Record<string, unknown> | null;
}

export async function handleXamanLogin(): Promise<void> {
  if (pollInterval) clearInterval(pollInterval);

  const response = await fetch("/api/xaman/create-payload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txjson: { TransactionType: "SignIn" } }),
  });

  if (!response.ok) {
    const err = (await response
      .json()
      .catch(() => ({}))) as Record<string, unknown>;
    throw new Error(
      (err.error as string) || "Failed to create Xaman sign-in",
    );
  }

  const { uuid, refs }: CreatePayloadResponse = await response.json();
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile) {
    window.location.href = refs.xapp || refs.websocket;
    return;
  }

  // Desktop: poll for signature (QR handled by parent component or modal)
  await pollForSignature(uuid);
}

async function pollForSignature(uuid: string): Promise<void> {
  let attempts = 0;
  const maxAttempts = 150;

  return new Promise<void>((resolve, reject) => {
    pollInterval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        if (pollInterval) clearInterval(pollInterval);
        reject(new Error("Sign-in timed out"));
        return;
      }

      try {
        const res = await fetch(
          `/api/xaman/check-payload?uuid=${uuid}`,
        );
        if (!res.ok) return;

        const data: CheckPayloadResponse = await res.json();

        if (data.meta.signed) {
          if (pollInterval) clearInterval(pollInterval);

          const account = data.response?.account;
          if (account) {
            localStorage.setItem("xrpl_address", account);
            localStorage.setItem(
              "xaman_session",
              JSON.stringify({
                account,
                signedAt: new Date().toISOString(),
              }),
            );
          }

          window.location.href = "dashboard";
          resolve();
        } else if (
          data.meta.expired ||
          data.meta.cancelled ||
          data.meta.rejected
        ) {
          if (pollInterval) clearInterval(pollInterval);
          reject(new Error("Sign-in cancelled or expired"));
        }
      } catch {
        // Silently retry on transient network errors
      }
    }, 2000);
  });
}

/**
 * Submit an arbitrary XRPL / Xahau transaction through Xaman for signing.
 *
 * @param txjson     - The transaction JSON (must include TransactionType)
 * @param network    - "xrpl" | "xahau" — determines NetworkID routing
 * @param userAccount - Optional account to override txjson.Account
 * @returns The payload UUID and QR / deeplink refs
 */
export async function signTransaction(
  txjson: Record<string, unknown>,
  network: "xrpl" | "xahau" = "xrpl",
  userAccount?: string,
): Promise<CreatePayloadResponse> {
  const res = await fetch("/api/xaman/sign-transaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txjson, network, userAccount }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(
      (err.error as string) || "Failed to create transaction signing request",
    );
  }

  return res.json();
}

/**
 * Poll a previously-created Xaman payload until it resolves.
 *
 * @returns The check-payload response once signed, or throws on
 *          cancel / expiry / timeout.
 */
export async function waitForSignature(
  uuid: string,
  maxAttempts = 150,
): Promise<CheckPayloadResponse> {
  let attempts = 0;

  return new Promise<CheckPayloadResponse>((resolve, reject) => {
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        reject(new Error("Transaction signing timed out"));
        return;
      }

      try {
        const res = await fetch(
          `/api/xaman/check-payload?uuid=${uuid}`,
        );
        if (!res.ok) return;

        const data: CheckPayloadResponse = await res.json();

        if (data.meta.signed) {
          clearInterval(interval);
          resolve(data);
        } else if (
          data.meta.expired ||
          data.meta.cancelled ||
          data.meta.rejected
        ) {
          clearInterval(interval);
          reject(new Error("Transaction was cancelled or expired"));
        }
      } catch {
        // Silently retry on transient network errors
      }
    }, 2000);
  });
}

// src/components/header/header.tsx
import { component$, useSignal, $, useContext } from "@builder.io/qwik";
import { Link, useNavigate } from "@builder.io/qwik-city";
import { useXamanSession } from "~/routes/layout";
import { NetworkContext } from "~/routes/layout";

export const Header = component$(() => {
  const mobileOpen = useSignal(false);
  const connecting = useSignal(false);
  const session = useXamanSession();
  const nav = useNavigate();
  const { activeNetwork } = useContext(NetworkContext);

  const isConnected = session.value?.connected ?? false;
  const address = session.value?.address;
  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  const isXahau = useSignal(activeNetwork.value === "xahau");

  // Modal + QR state
  const modalOpen = useSignal(false);
  const qrCode = useSignal<string | null>(null);
  const pollError = useSignal<string | null>(null);
  const payloadUuid = useSignal<string | null>(null);

  const handleToggleNetwork = $((event: InputEvent) => {
    const checked = (event.target as HTMLInputElement).checked;
    activeNetwork.value = checked ? "xahau" : "xrpl";
    isXahau.value = checked;
  });

  const handleDisconnect = $(async () => {
    document.cookie = "xaman_jwt=; Max-Age=0; path=/;";
    nav("/");
  });

  // Icons
  const PowerOnIcon = () => (
    <svg
      class="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width={2}
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );

  const PowerOffIcon = () => (
    <svg
      class="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width={2}
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5.636 5.636L12 12"
      />
    </svg>
  );

  const Spinner = () => (
    <svg
      class="animate-spin h-4 w-4 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  const buttonContent = () => {
    if (connecting.value) {
      return (
        <div class="flex items-center justify-center gap-2">
          <Spinner />
          <span>Connecting...</span>
        </div>
      );
    }
    if (isConnected) {
      return (
        <div class="flex items-center gap-2">
          <PowerOffIcon />
          <span>Disconnect</span>
        </div>
      );
    }
    return (
      <div class="flex items-center gap-2">
        <PowerOnIcon />
        <span>Connect Wallet</span>
      </div>
    );
  };

  // Start connect flow with modal + QR
  const startXamanConnect = $(async () => {
    connecting.value = true;
    modalOpen.value = true;
    pollError.value = null;
    qrCode.value = null;

    try {
      const res = await fetch("/api/xaman/create-payload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txjson: { TransactionType: "SignIn" },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create sign-in request");
      }

      const { uuid, qr_png } = await res.json();

      payloadUuid.value = uuid;
      qrCode.value = qr_png;

      // Start polling
      pollForSignature(uuid);
    } catch (err: any) {
      pollError.value = err.message || "Connection failed";
      connecting.value = false;
    }
  });

  // Polling logic
  const pollForSignature = $(async (uuid: string) => {
    let attempts = 0;
    const maxAttempts = 150; // ~5 minutes @ 2s interval

    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        pollError.value = "Sign-in request timed out. Please try again.";
        connecting.value = false;
        qrCode.value = null;
        return;
      }

      try {
        const res = await fetch(`/api/xaman/check-payload?uuid=${uuid}`);
        if (!res.ok) return;

        const data = await res.json();

        if (data.meta?.signed) {
          clearInterval(interval);
          modalOpen.value = false;
          connecting.value = false;
          qrCode.value = null;

          // Session is updated via cookie/loader – just navigate/refresh
          nav("/dashboard");
          // Optional: force reload to ensure loader sees new cookie state
          // window.location.reload();
        } else if (
          data.meta?.expired ||
          data.meta?.cancelled ||
          data.meta?.rejected
        ) {
          clearInterval(interval);
          pollError.value = "Sign-in request expired or was cancelled.";
          connecting.value = false;
          qrCode.value = null;
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);
  });

  return (
    <>
      <header class="w-full bg-white border-b shadow-sm">
        <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          {/* Logo */}
          <Link class="flex items-center gap-2" href="/">
            <span class="text-lg font-semibold tracking-tight">
              {"{XRPL}"}OS
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav class="hidden items-center gap-6 md:flex">
            <Link
              href="/explorer"
              class="text-sm font-medium text-gray-700 hover:text-black"
            >
              Explorer
            </Link>
            <Link
              href="/marketplace"
              class="text-sm font-medium text-gray-700 hover:text-black"
            >
              Marketplace
            </Link>
          </nav>

          {/* Desktop Actions */}
          <div class="hidden md:flex items-center gap-6">
            {/* Network Toggle */}
            <div class="flex items-center gap-3">
              <span class="text-sm font-medium text-gray-700 min-w-12.5 text-right">
                {isXahau.value ? "Xahau" : "XRPL"}
              </span>

              <label class="toggle-switch">
                <input
                  type="checkbox"
                  checked={isXahau.value}
                  onInput$={(event) => {
                    const checked = (event.target as HTMLInputElement).checked;
                    activeNetwork.value = checked ? "xahau" : "xrpl";
                    isXahau.value = checked;
                  }}
                />
                <div class="toggle-switch-background">
                  <div class="toggle-switch-handle"></div>
                </div>
              </label>
            </div>

            {/* Wallet Button */}
            {isConnected ? (
              <div class="flex items-center gap-4">
                <span class="text-sm font-medium text-green-700 bg-green-50 px-3 py-1 rounded-full">
                  {shortAddress}
                </span>
                <button
                  onClick$={handleDisconnect}
                  class="rounded-md bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700 flex items-center gap-2"
                >
                  {buttonContent()}
                </button>
              </div>
            ) : (
              <button
                onClick$={startXamanConnect}
                disabled={connecting.value}
                class="rounded-md bg-black px-4 py-1.5 text-sm text-white hover:bg-green-300 flex items-center gap-2 disabled:opacity-50"
              >
                {buttonContent()}
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            class="md:hidden"
            onClick$={() => (mobileOpen.value = !mobileOpen.value)}
            aria-label="Toggle menu"
          >
            <svg
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen.value && (
          <div class="border-t border-gray-200 md:hidden">
            <nav class="flex flex-col gap-4 px-4 py-4">
              <Link href="/" class="text-base text-gray-700">
                Home
              </Link>
              <Link href="/dashboard" class="text-base text-gray-700">
                Dashboard
              </Link>
              <Link href="/explorer" class="text-base text-gray-700">
                Explorer
              </Link>
              <Link href="/marketplace" class="text-base text-gray-700">
                Marketplace
              </Link>

              {/* Mobile Network Toggle */}
              <div class="flex items-center justify-between mt-2">
                <span class="text-base font-medium text-gray-700">Network</span>
                <div class="flex items-center gap-3">
                  <span class="text-sm">
                    {isXahau.value ? "Xahau" : "XRPL"}
                  </span>
                  <label class="toggle-switch">
                    <input
                      type="checkbox"
                      checked={isXahau.value}
                      onInput$={handleToggleNetwork}
                    />
                    <div class="toggle-switch-background">
                      <div class="toggle-switch-handle"></div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Mobile Wallet */}
              <div class="mt-2">
                {isConnected ? (
                  <div class="flex flex-col gap-3">
                    <div class="text-base font-medium text-green-700">
                      Connected: {shortAddress}
                    </div>
                    <button
                      onClick$={handleDisconnect}
                      class="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 flex items-center justify-center gap-2"
                    >
                      {buttonContent()}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick$={startXamanConnect}
                    disabled={connecting.value}
                    class=" w-full rounded-md bg-black px-4 py-2 text-center text-white hover:bg-gray-800 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {buttonContent()}
                  </button>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* QR Modal */}
      {modalOpen.value && (
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div class="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div class="text-center">
              <h2 class="text-2xl font-bold text-gray-900 mb-2">
                Scan with Xaman
              </h2>
              <p class="text-sm text-gray-600 mb-6">
                Open the Xaman app and scan this QR code to sign in
              </p>

              <div class="bg-gray-50 p-6 rounded-xl mb-6 min-h-64 flex items-center justify-center">
                {qrCode.value ? (
                  <img
                    src={qrCode.value}
                    alt="Xaman QR Code"
                    height="64"
                    width="64"
                    class="mx-auto w-64 h-64 object-contain"
                  />
                ) : (
                  <div class="flex flex-col items-center gap-4">
                    <svg
                      class="animate-spin h-12 w-12 text-black"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                      />
                      <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span class="text-gray-600">Preparing QR code...</span>
                  </div>
                )}
              </div>

              <div class="flex items-center justify-center gap-2 text-sm text-gray-500 mb-6">
                <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                    fill="none"
                  />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Waiting for confirmation...
              </div>

              {pollError.value && (
                <p class="text-red-600 text-sm mb-4">{pollError.value}</p>
              )}

              <button
                onClick$={() => {
                  modalOpen.value = false;
                  connecting.value = false;
                  qrCode.value = null;
                  pollError.value = null;
                }}
                class="text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

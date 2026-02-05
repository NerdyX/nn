// src/components/header/header.tsx
import {
  component$,
  useSignal,
  $,
  useContext,
  useVisibleTask$,
} from "@builder.io/qwik";
import { Link, useNavigate } from "@builder.io/qwik-city";
import { useXamanSession } from "~/routes/layout";
import { NetworkContext } from "~/routes/layout";
//import headerStyles from "./header.css?inline";

//const CONTEXT_ROUTES = ["/dashboard", "/marketplace", "/explorer"];

type WalletType = "xaman" | "ledger" | "crossmark" | "walletconnect" | null;

interface ScrollWheelProps {
  items: string[];
  value: string;
  onChange$: (value: string) => void;
}

export type NavItem = {
  id: string;
  label: string;
  href?: string;
  icon?: string;
  pages?: string[]; // routes where it appears
  min?: "mobile" | "md" | "lg"; // breakpoint visibility
};

export const NAV_ITEMS: NavItem[] = [
  {
    id: "home",
    label: "Home",
    href: "/",
    pages: ["*"],
    min: "mobile",
  },
  {
    id: "market",
    label: "Marketplace",
    href: "/marketplace",
    pages: ["/marketplace"],
    min: "mobile",
  },
  {
    id: "featured",
    label: "Featured",
    pages: ["/marketplace"],
    min: "lg",
  },
  {
    id: "trending",
    label: "Trending",
    pages: ["/marketplace"],
    min: "lg",
  },
  {
    id: "stats",
    label: "Stats",
    pages: ["/marketplace"],
    min: "lg",
  },
  {
    id: "ledger",
    label: "Ledger",
    href: "/ledger",
    pages: ["/ledger", "/dashboard"],
    min: "md",
  },
];

export const ScrollWheel = component$<ScrollWheelProps>(
  ({ items, value, onChange$ }) => {
    const containerRef = useSignal<HTMLElement>();
    const activeIndex = useSignal(items.indexOf(value));

    useVisibleTask$(() => {
      const el = containerRef.value;
      if (!el) return;

      const itemHeight = 48;
      el.scrollTop = activeIndex.value * itemHeight;
    });

    return (
      <div class="wheel-wrapper">
        <div
          ref={containerRef}
          class="wheel"
          onScroll$={() => {
            const el = containerRef.value!;
            const index = Math.round(el.scrollTop / 48);

            if (index !== activeIndex.value) {
              activeIndex.value = index;
              onChange$(items[index]);

              // HAPTIC FEEDBACK
              if ("vibrate" in navigator) {
                navigator.vibrate(8);
              }
            }
          }}
        >
          {items.map((item, i) => (
            <div
              key={item}
              class={{
                "wheel-item": true,
                active: i === activeIndex.value,
              }}
            >
              {item}
            </div>
          ))}
        </div>

        {/* Center highlight */}
        <div class="wheel-highlight" />
      </div>
    );
  },
);

export const Header = component$(() => {
  const mobileOpen = useSignal(false);
  const connecting = useSignal(false);

  const session = useXamanSession();
  const nav = useNavigate();
  const { activeNetwork } = useContext(NetworkContext);

  const isConnected = session.value?.connected ?? false;
  const address = session.value?.address;
  const shortAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : "";

  const isXahau = useSignal(activeNetwork.value === "xahau");

  /* ---------------- MODAL STATE ---------------- */
  const modalOpen = useSignal(false);
  const selectedWallet = useSignal<WalletType>(null);

  // Xaman specific
  const qrCode = useSignal<string | null>(null);
  const pollError = useSignal<string | null>(null);

  /* ---------------- HANDLERS ---------------- */

  const openWalletModal = $(() => {
    modalOpen.value = true;
    selectedWallet.value = null;
    qrCode.value = null;
    pollError.value = null;
  });

  const closeModal = $(() => {
    modalOpen.value = false;
    connecting.value = false;
    selectedWallet.value = null;
    qrCode.value = null;
    pollError.value = null;
  });

  const handleToggleNetwork = $((event: InputEvent) => {
    const checked = (event.target as HTMLInputElement).checked;
    activeNetwork.value = checked ? "xahau" : "xrpl";
    isXahau.value = checked;
  });

  const handleDisconnect = $(async () => {
    document.cookie = "xaman_jwt=; Max-Age=0; path=/;";
    nav("/");
  });

  const selectWallet = $((wallet: WalletType) => {
    selectedWallet.value = wallet;

    if (wallet === "xaman") {
      connecting.value = true;
      // 🔴 Hook your existing Xaman QR init logic here
      // set qrCode.value = "...";
    }
  });

  /* ---------------- UI HELPERS ---------------- */

  const Spinner = () => (
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
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );

  const WalletButton = ({
    id,
    label,
    description,
  }: {
    id: WalletType;
    label: string;
    description: string;
  }) => (
    <button
      onClick$={() => selectWallet(id)}
      class="w-full rounded-xl border border-gray-200 px-4 py-4 text-left hover:bg-gray-50 transition"
    >
      <div class="font-semibold">{label}</div>
      <div class="text-sm text-gray-500">{description}</div>
    </button>
  );

  /* ---------------- RENDER ---------------- */

  return (
    <>
      <header class="w-full bg-transparent">
        <div class="mx-auto flex h-16 w-full items-center justify-between px-4 lg:px-6">
          {/* Logo */}
          <Link class="flex items-center gap-2 ml-5" href="/">
            <span class="text-lg font-semibold tracking-tight">
              {"{XRPL}"}OS
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav class="hidden md:flex items-center gap-6">
            <Link href="/explorer">Explorer</Link>
            <Link href="/marketplace">Marketplace</Link>
            <Link href="/about">About</Link>
            <Link href="/docs">Docs</Link>
          </nav>

          {/* Desktop Actions */}
          <div class="hidden md:flex items-center gap-6">
            {/* Network Toggle */}
            <div class="flex items-center gap-2">
              <span class="text-sm">{isXahau.value ? "Xahau" : "XRPL"}</span>
              <label class="toggle-switch">
                <input
                  type="checkbox"
                  checked={isXahau.value}
                  onInput$={handleToggleNetwork}
                />
                <div class="toggle-switch-background">
                  <div class="toggle-switch-handle" />
                </div>
              </label>
            </div>

            {/* Wallet */}
            {isConnected ? (
              <div class="flex items-center gap-3">
                <span class="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">
                  {shortAddress}
                </span>
                <button
                  onClick$={handleDisconnect}
                  class="bg-red-600 text-white px-4 py-1.5 rounded-md"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick$={openWalletModal}
                class="bg-black text-white px-6 py-1.5 rounded-md"
              >
                Connect Wallet
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            class="md:hidden"
            onClick$={() => (mobileOpen.value = !mobileOpen.value)}
          >
            ☰
          </button>
        </div>
      </header>

      {/* ---------------- WALLET MODAL ---------------- */}
      {modalOpen.value && (
        <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div class="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl">
            {!selectedWallet.value && (
              <>
                <h2 class="text-xl font-bold mb-4">Connect Wallet</h2>
                <div class="flex flex-col gap-3">
                  <WalletButton
                    id="xaman"
                    label="Xaman"
                    description="Mobile-first XRPL wallet"
                  />
                  <WalletButton
                    id="ledger"
                    label="Ledger"
                    description="Hardware wallet (coming soon)"
                  />
                  <WalletButton
                    id="crossmark"
                    label="Crossmark"
                    description="Browser extension wallet"
                  />
                  <WalletButton
                    id="walletconnect"
                    label="WalletConnect"
                    description="Connect via QR / mobile wallets"
                  />
                </div>
              </>
            )}

            {selectedWallet.value === "xaman" && (
              <>
                <h2 class="text-xl font-bold mb-2">Scan with Xaman</h2>
                <p class="text-sm text-gray-500 mb-4">
                  Open the Xaman app and scan to connect
                </p>

                <div class="bg-gray-100 rounded-xl p-6 flex items-center justify-center min-h-64">
                  {qrCode.value ? (
                    <img
                      src={qrCode.value}
                      height="100"
                      width="100"
                      class="w-56 h-56"
                    />
                  ) : (
                    <Spinner />
                  )}
                </div>

                {pollError.value && (
                  <p class="text-sm text-red-600 mt-3">{pollError.value}</p>
                )}
              </>
            )}

            <button
              onClick$={closeModal}
              class="mt-6 text-sm text-gray-500 hover:text-black"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
});

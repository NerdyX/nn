import { component$, useSignal, $, useContext } from "@builder.io/qwik";
import { Link, useNavigate, useLocation } from "@builder.io/qwik-city";
import { useXamanSession, NetworkContext } from "~/routes/layout";

import NetworkToggle from "../ui/network-toggle";
//import { ScrollWheel } from "../ui/scroll-wheel";

type WalletType =
  | "xaman"
  | "ledger"
  | "gem"
  | "grin"
  | "joey"
  | "crossmark"
  | "walletconnect"
  | null;

export type NavItem = {
  id: string;
  label: string;
  href?: string;
  pages?: string[];
  min?: "mobile" | "md" | "lg";
};

export const NAV_ITEMS: NavItem[] = [
  {
    id: "home",
    label: "Explorer",
    href: "/explorer",
    pages: ["*"],
    min: "mobile",
  },
  {
    id: "market",
    label: "Marketplace",
    href: "/marketplace",
    pages: ["*", "/marketplace"],
    min: "mobile",
  },
];

const minClass = (min?: NavItem["min"]) => {
  if (min === "md") return "hidden md:flex";
  if (min === "lg") return "hidden lg:flex";
  return "flex";
};

export const Header = component$(() => {
  const session = useXamanSession();
  const nav = useNavigate();
  const { activeNetwork } = useContext(NetworkContext);

  const mobileOpen = useSignal(false);
  const modalOpen = useSignal(false);
  const selectedWallet = useSignal<WalletType>(null);
  const qrCode = useSignal<string | null>(null);
  const pollError = useSignal<string | null>(null);
  const connecting = useSignal(false);

  const loc = useLocation();
  const pathname = loc.url.pathname;

  const isConnected = session.value?.connected ?? false;
  const address = session.value?.address ?? "";
  const shortAddress = `${address.slice(0, 6)}…${address.slice(-4)}`;

  const visibleNavItems = NAV_ITEMS.filter(
    (item) =>
      !item.pages || item.pages.includes("*") || item.pages.includes(pathname),
  );

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

  const handleDisconnect = $(() => {
    document.cookie = "xaman_jwt=; Max-Age=0; path=/;";
    nav("/");
  });

  const selectWallet = $(async (wallet: WalletType) => {
    selectedWallet.value = wallet;
    if (wallet === "xaman") {
      connecting.value = true;
      // 🔴 Hook your existing Xaman QR logic here
      // qrCode.value = "...";
    }
  });

  /* ---------------- UI HELPERS ---------------- */
  const Spinner = () => (
    <svg class="animate-spin h-6 w-6" viewBox="0 0 24 24">
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

  return (
    <>
      {/* ---------------- HEADER ---------------- */}
      <header class="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <div class="flex h-14 md:h-16 max-w-5xl w-full items-center justify-between rounded-full bg-white/10 dark:bg-black/40 backdrop-blur-xl border border-white/20 shadow-lg px-5 md:px-8 transition-all duration-300">
          {/* Logo */}
          <Link href="/" class="flex items-center gap-2">
            <span class="text-lg font-semibold text-white tracking-tight">{`{XRPL}OS`}</span>
          </Link>

          {/* Desktop Nav */}
          <nav class="hidden md:flex items-center gap-2">
            {visibleNavItems.map((item) =>
              item.href ? (
                <Link
                  key={item.id}
                  href={item.href}
                  class={`px-4 py-1.5 rounded-full text-sm transition ${minClass(item.min)} ${
                    pathname === item.href
                      ? "bg-white/20 text-white"
                      : "text-white/70 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  key={item.id}
                  class={`px-4 py-1.5 text-sm text-white/40 ${minClass(item.min)}`}
                >
                  {item.label}
                </span>
              ),
            )}
          </nav>

          {/* Desktop Actions */}
          <div class="hidden md:flex items-center gap-4">
            {pathname !== "/" && <NetworkToggle />}

            {isConnected ? (
              <button
                onClick$={handleDisconnect}
                class="rounded-full bg-emerald-500/90 px-4 py-1.5 text-sm font-medium text-black hover:bg-emerald-400 transition"
              >
                {shortAddress}
              </button>
            ) : (
              <button
                onClick$={openWalletModal}
                class="rounded-full bg-amber-500 px-8 py-1.5 text-sm font-medium text-black hover:bg-white transition"
              >
                Connect
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            class="md:hidden flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20"
            onClick$={() => (mobileOpen.value = !mobileOpen.value)}
          >
            ☰
          </button>
        </div>
      </header>

      {/* ---------------- MOBILE NAV ---------------- */}
      {mobileOpen.value && (
        <div class="fixed inset-x-4 top-20 z-40 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-xl p-4 md:hidden">
          <div class="flex flex-col gap-2">
            {visibleNavItems.map((item) =>
              item.href ? (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick$={() => (mobileOpen.value = false)}
                  class="rounded-xl px-4 py-3 text-white/90 hover:bg-white/10 transition"
                >
                  {item.label}
                </Link>
              ) : null,
            )}
            {pathname !== "/" && (
              <div class="pt-3 border-t border-white/10">
                <NetworkToggle />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- WALLET MODAL ---------------- */}
      {mobileOpen.value && (
        <div class="fixed inset-x-4 top-20 z-40 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-xl p-4 md:hidden">
          <div class="flex flex-col gap-2">
            {visibleNavItems.map((item) =>
              item.href ? (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick$={() => (mobileOpen.value = false)}
                  class="rounded-xl px-4 py-3 text-white/90 hover:bg-white/10 transition"
                >
                  {item.label}
                </Link>
              ) : null,
            )}

            {pathname !== "/" && (
              <div class="pt-3 border-t border-white/10">
                <NetworkToggle />
              </div>
            )}

            {/* Connect / Disconnect Button */}
            <div class="pt-3 border-t border-white/10">
              {isConnected ? (
                <button
                  onClick$={handleDisconnect}
                  class="w-full rounded-xl bg-emerald-500/90 px-4 py-3 text-black hover:bg-emerald-400 transition"
                >
                  {shortAddress}
                </button>
              ) : (
                <button
                  onClick$={openWalletModal}
                  class="w-full rounded-xl bg-white/90 px-4 py-3 text-black hover:bg-white transition"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
});

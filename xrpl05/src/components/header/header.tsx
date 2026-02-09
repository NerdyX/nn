import { component$, useSignal } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";
import { Link } from "@builder.io/qwik-city";
import { Xaman } from "../wallets/xaman";

import NetworkToggle from "../ui/network-toggle";

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

const shouldShowNetworkToggle = (pathname: string) => {
  const allowedRoutes = ["/explorer", "/marketplace", "/dashboard"];
  return allowedRoutes.some((route) => pathname.startsWith(route));
};

export const Header = component$(() => {
  const mobileOpen = useSignal(false);
  const showWalletModal = useSignal(false);
  const location = useLocation();
  const showNetworkToggle = shouldShowNetworkToggle(location.url.pathname);

  return (
    <>
      {/* ---------------- HEADER ---------------- */}
      <header class="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <div class="flex h-14 md:h-16 max-w-5xl w-full items-center justify-between rounded-full bg-white/5 dark:bg-white/5 backdrop-blur-2xl border border-white/15 shadow-2xl px-5 md:px-8 transition-all duration-500 hover:bg-white/8 hover:border-white/25 hover:shadow-3xl animate-in fade-in slide-in-from-top-2">
          {/* Logo */}
          <Link
            href="/"
            class="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <span class="text-lg font-semibold text-black tracking-tight">{`{XRPL}OS`}</span>
          </Link>

          {/* Desktop Nav */}
          <nav class="hidden md:flex items-center gap-2">
            {NAV_ITEMS.map((item: NavItem) =>
              item.href ? (
                <Link
                  key={item.id}
                  href={item.href}
                  class={`px-4 py-1.5 rounded-full text-sm transition-all duration-300 ${minClass(item.min)} text-black/70 hover:bg-white/10 hover:text-black/90`}
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
            {showNetworkToggle && <NetworkToggle />}
            <button
              onClick$={() => (showWalletModal.value = true)}
              class="rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-black hover:bg-amber-400 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Connect Wallet
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            class="md:hidden flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all duration-300"
            onClick$={() => (mobileOpen.value = !mobileOpen.value)}
          >
            ☰
          </button>
        </div>
      </header>

      {/* ---------------- MOBILE NAV ---------------- */}
      {mobileOpen.value && (
        <div class="fixed inset-x-4 top-20 z-40 rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/15 shadow-2xl p-4 md:hidden animate-in fade-in slide-in-from-top-2">
          <div class="flex flex-col gap-2">
            {NAV_ITEMS.map((item: NavItem) =>
              item.href ? (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick$={() => (mobileOpen.value = false)}
                  class="rounded-xl px-4 py-3 text-white/90 hover:bg-white/20 transition-all duration-300"
                >
                  {item.label}
                </Link>
              ) : null,
            )}
            {showNetworkToggle && (
              <div class="pt-3 border-t border-white/10">
                <NetworkToggle />
              </div>
            )}
            <div class="pt-3 border-t border-white/10">
              <button
                onClick$={() => {
                  showWalletModal.value = true;
                  mobileOpen.value = false;
                }}
                class="w-full rounded-xl bg-amber-500 px-4 py-3 text-black hover:bg-amber-400 transition-all duration-300 shadow-lg font-medium"
              >
                Connect Wallet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- WALLET MODAL ---------------- */}
      {showWalletModal.value && (
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick$={() => (showWalletModal.value = false)}
        >
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            class="relative rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl p-6 max-w-sm w-full animate-in fade-in zoom-in-95"
            onClick$={(e) => e.stopPropagation()}
          >
            <h2 class="text-xl font-semibold text-white mb-4">
              Connect Wallet
            </h2>
            <p class="text-white/70 text-sm mb-6">
              Choose your wallet provider to connect
            </p>
            <div class="mb-6 flex flex-col gap-3">
              <Xaman />
            </div>
            <button
              onClick$={() => (showWalletModal.value = false)}
              class="w-full rounded-xl bg-amber-500 px-4 py-3 text-black hover:bg-amber-400 transition-all duration-300 shadow-lg font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
});

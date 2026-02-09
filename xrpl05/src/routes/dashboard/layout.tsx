import { component$, Slot, useSignal, $ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import {
  useNetworkContext,
  NETWORK_CONFIG,
  getSidebarNavItems,
} from "~/context/network-context";
import {
  useWalletContext,
  truncateAddress,
  clearWalletSession,
} from "~/context/wallet-context";

import "./dashboard.css";

export default component$(() => {
  const { activeNetwork, wsUrl } = useNetworkContext();
  const wallet = useWalletContext();
  const location = useLocation();

  const networkConfig = NETWORK_CONFIG[activeNetwork.value];
  const navItems = getSidebarNavItems(activeNetwork.value);

  const sidebarOpen = useSignal(true);

  const handleDisconnect = $(() => {
    clearWalletSession();
    wallet.connected.value = false;
    wallet.address.value = "";
    wallet.walletType.value = null;
    wallet.displayName.value = "";

    if (typeof document !== "undefined") {
      document.cookie =
        "xaman_jwt=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    }

    window.location.href = "/";
  });

  // Determine active page from URL
  const activePage = (() => {
    const path = location.url.pathname;
    const match = navItems.find((item) => {
      if (item.href === "/dashboard" || item.href === "/dashboard/") {
        return path === "/dashboard" || path === "/dashboard/";
      }
      return path.startsWith(item.href);
    });
    return match?.id || "accounts";
  })();

  return (
    <div class="mt-14 app-layout">
      {/* Sidebar */}
      <aside class={`sidebar ${sidebarOpen.value ? "" : "sidebar-collapsed"}`}>
        {/* Wallet info */}
        <section class="sidebar-section">
          <div class="mb-1 text-lg font-semibold text-gray-900">
            {wallet.displayName.value
              ? `Welcome, ${wallet.displayName.value}!`
              : "Dashboard"}
          </div>
          <div class="flex items-center gap-2 mb-3">
            <div
              class={`w-2.5 h-2.5 rounded-full ${
                activeNetwork.value === "xahau" ? "bg-xahau" : "bg-xrpl"
              }`}
            />
            <span
              class="text-xs font-semibold uppercase tracking-wide"
              style={{ color: networkConfig.color }}
            >
              {networkConfig.shortLabel}
            </span>
            <span class="text-[10px] text-gray-400 font-mono">
              {networkConfig.nativeCurrency}
            </span>
          </div>
        </section>

        {/* Connected wallet details */}
        {wallet.connected.value && (
          <div class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 mb-4">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span class="text-xs font-medium text-gray-600 uppercase">
                {wallet.walletType.value ?? "Unknown"} ·{" "}
                {networkConfig.shortLabel}
              </span>
            </div>
            <div class="font-mono text-sm text-gray-900 truncate">
              {truncateAddress(wallet.address.value)}
            </div>
            <div class="mt-1 text-xs text-gray-500">
              <code class="bg-gray-100 px-1 py-0.5 rounded text-[10px]">
                {wsUrl.value}
              </code>
            </div>
          </div>
        )}

        {!wallet.connected.value && (
          <div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
            <p class="text-sm text-amber-800">No wallet connected</p>
            <Link href="/" class="text-xs text-amber-600 hover:underline">
              Go home to connect &rarr;
            </Link>
          </div>
        )}

        <nav class="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              class={{
                "nav-item": true,
                active: activePage === item.id,
              }}
            >
              <span class="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.networkOnly && (
                <span
                  class="ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor:
                      item.networkOnly === "xahau"
                        ? "rgba(245,166,35,0.15)"
                        : "rgba(99,64,188,0.15)",
                    color: item.networkOnly === "xahau" ? "#c9871a" : "#6340bc",
                  }}
                >
                  {item.networkOnly === "xahau" ? "XAH" : "XRP"}
                </span>
              )}
            </Link>
          ))}

          {/* Disconnect */}
          <div class="mt-auto pt-4 border-t border-gray-200">
            {wallet.connected.value && (
              <button
                onClick$={handleDisconnect}
                class="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-red-500 hover:text-white rounded-full transition-all duration-200"
              >
                Disconnect
              </button>
            )}
          </div>

          <footer class="text-center border-t border-gray-200 font-extralight mb-1 pt-4 mt-2">
            <div class="flex gap-4 justify-center">
              <Link
                href="https://www.nrdxlab.com"
                target="_blank"
                rel="noopener noreferrer"
                class="text-gray-950/20 hover:text-blue-500 transition-colors"
                title="Home"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                </svg>
              </Link>
              <Link
                href="https://github.com/NerdyXLabs"
                target="_blank"
                rel="noopener noreferrer"
                class="text-gray-950/20 hover:text-blue-500 transition-colors"
                title="GitHub"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </Link>
              <Link
                href="https://twitter.com/NerdyXLabs"
                target="_blank"
                rel="noopener noreferrer"
                class="text-gray-950/20 hover:text-blue-500 transition-colors"
                title="Twitter"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 9-1 9-5.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
                </svg>
              </Link>
            </div>
            <Link
              href="https://x.com/NerdyXLabs"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center text-gray-950/35 hover:text-blue-500 transition-colors"
            >
              Created by {"{NRDX}Labs"}
            </Link>
            <div class="text-[8px] text-gray-950/35">
              Terms of Service | Privacy Policy | Contact Us
            </div>
          </footer>
        </nav>
      </aside>

      {/* Main content area */}
      <main class="main-content">
        <header class="topbar">
          <h1>
            {navItems.find((i) => i.id === activePage)?.label || "Dashboard"}
          </h1>
          <div class="topbar-right">
            <span
              class="network-pill"
              style={{
                backgroundColor:
                  activeNetwork.value === "xahau"
                    ? "rgba(245,166,35,0.15)"
                    : "rgba(99,64,188,0.15)",
                color: networkConfig.color,
              }}
            >
              {networkConfig.shortLabel} · {networkConfig.nativeCurrency}
            </span>
          </div>
        </header>

        <div class="content-area">
          <Slot />
        </div>
      </main>
    </div>
  );
});

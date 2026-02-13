import { component$, Slot, useSignal, $ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import {
  useNetworkContext,
  NETWORK_CONFIG,
  getSidebarNavItems,
  SIDEBAR_ICONS,
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

  const sidebarOpen = useSignal(false);

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

  const closeSidebar = $(() => {
    sidebarOpen.value = false;
  });

  const toggleSidebar = $(() => {
    sidebarOpen.value = !sidebarOpen.value;
  });

  // Determine active page from URL
  const getActivePage = () => {
    const path = location.url.pathname;
    const match = navItems.find((item) => {
      if (item.href === "/dashboard" || item.href === "/dashboard/") {
        return path === "/dashboard" || path === "/dashboard/";
      }
      return path.startsWith(item.href);
    });
    return match?.id || "accounts";
  };

  const activePage = getActivePage();

  return (
    <div class="dash-layout">
      {/* Mobile hamburger button */}
      <button
        class="dash-hamburger"
        onClick$={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          {sidebarOpen.value ? (
            <path d="M18 6 6 18M6 6l12 12" />
          ) : (
            <path d="M3 12h18M3 6h18M3 18h18" />
          )}
        </svg>
      </button>

      {/* Mobile backdrop */}
      <div
        class={`dash-sidebar-backdrop ${sidebarOpen.value ? "visible" : ""}`}
        onClick$={closeSidebar}
      />

      {/* Sidebar */}
      <aside class={`dash-sidebar ${sidebarOpen.value ? "open" : ""}`}>
        {/* Header */}
        <div class="dash-sidebar-header">
          <div class="dash-sidebar-brand">
            {wallet.displayName.value
              ? `Welcome, ${wallet.displayName.value}`
              : "Dashboard"}
          </div>
          <div class="dash-sidebar-meta">
            <div
              class="dash-sidebar-dot"
              style={{
                background:
                  activeNetwork.value === "xahau" ? "#f5a623" : "#6340bc",
              }}
            />
            <span
              class="dash-sidebar-network"
              style={{ color: networkConfig.color }}
            >
              {networkConfig.shortLabel}
            </span>
            <span class="dash-sidebar-currency">
              {networkConfig.nativeCurrency}
            </span>
          </div>
        </div>

        {/* Connected wallet details */}
        {wallet.connected.value && (
          <div class="dash-wallet-card">
            <div class="dash-wallet-status">
              <div class="dash-wallet-status-dot" />
              <span class="dash-wallet-status-label">
                {wallet.walletType.value ?? "Unknown"} ·{" "}
                {networkConfig.shortLabel}
              </span>
            </div>
            <div class="dash-wallet-address">
              {truncateAddress(wallet.address.value)}
            </div>
            <div class="dash-wallet-ws">{wsUrl.value}</div>
          </div>
        )}

        {!wallet.connected.value && (
          <div class="dash-wallet-warn">
            <p>No wallet connected</p>
            <Link href="/" onClick$={closeSidebar}>
              Go home to connect →
            </Link>
          </div>
        )}

        {/* Navigation */}
        <nav class="dash-nav">
          {navItems.map((item) => {
            const iconPath = SIDEBAR_ICONS[item.icon] || "";
            const isActive = activePage === item.id;

            return (
              <Link
                key={item.id}
                href={item.href}
                class={`dash-nav-item ${isActive ? "active" : ""}`}
                onClick$={closeSidebar}
              >
                <svg
                  class="dash-nav-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d={iconPath} />
                </svg>
                <span>{item.label}</span>
                {item.networkOnly && (
                  <span
                    class="dash-nav-badge"
                    style={{
                      backgroundColor:
                        item.networkOnly === "xahau"
                          ? "rgba(245,166,35,0.12)"
                          : "rgba(99,64,188,0.12)",
                      color:
                        item.networkOnly === "xahau" ? "#b87a15" : "#5a38a8",
                    }}
                  >
                    {item.networkOnly === "xahau" ? "XAH" : "XRP"}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div class="dash-sidebar-footer">
          {wallet.connected.value && (
            <button class="dash-disconnect-btn" onClick$={handleDisconnect}>
              Disconnect
            </button>
          )}

          <div class="dash-sidebar-links">
            <Link
              href="https://www.nrdxlab.com"
              target="_blank"
              rel="noopener noreferrer"
              title="Home"
            >
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            </Link>
            <Link
              href="https://github.com/NerdyXLabs"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub"
            >
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </Link>
            <Link
              href="https://twitter.com/NerdyXLabs"
              target="_blank"
              rel="noopener noreferrer"
              title="Twitter"
            >
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </Link>
          </div>

          <div class="dash-sidebar-credit">
            <Link
              href="https://x.com/NerdyXLabs"
              target="_blank"
              rel="noopener noreferrer"
            >
              Created by {"{NRDX}Labs"}
            </Link>
          </div>
          <div class="dash-sidebar-legal">
            Terms of Service | Privacy Policy | Contact Us
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main class="dash-main">
        <header class="dash-topbar">
          <h1>
            {navItems.find((i) => i.id === activePage)?.label || "Dashboard"}
          </h1>
          <div class="dash-topbar-right">
            <span
              class="dash-network-pill"
              style={{
                backgroundColor:
                  activeNetwork.value === "xahau"
                    ? "rgba(245,166,35,0.12)"
                    : "rgba(99,64,188,0.12)",
                color: networkConfig.color,
              }}
            >
              {networkConfig.shortLabel} · {networkConfig.nativeCurrency}
            </span>
          </div>
        </header>

        <div class="dash-content">
          <Slot />
        </div>
      </main>
    </div>
  );
});

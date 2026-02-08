import { component$, useSignal } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";

import "./dashboard.css";

export default component$(() => {
  const activePage = useSignal<string>("dex");

  const navItems = [
    { id: "accounts", label: "Accounts", href: "./dashboard/accounts" },
    { id: "explorer", label: "Explorer", href: "./dashboard/explorer" },
    { id: "assets", label: "Assets", href: "./dashboard/assets" },
    { id: "markets", label: "Markets", href: "./dashboard/markets" },
    { id: "minting", label: "Minting", href: "./dashboard/minting" },
    { id: "trading", label: "Swap", href: "./dashboard/trading" },
    { id: "rewards", label: "Rewards", href: "./dashboard/rewards" },
    { id: "bridging", label: "Bridging", href: "./dashboard/bridging" },
    { id: "settings", label: "Settings", href: "./dashboard/settings" },
  ];

  const userID = useSignal<string>("");

  const userWalletType = useSignal<string>("");

  const userWalletNetwork = useSignal<string>("");

  const userAddress = useSignal<string>("");

  const userBalance = useSignal<string>("");

  return (
    <div class="mt-14 app-layout">
      {/* Sidebar */}
      <aside class="sidebar">
        <section class="sidebar-section">Welcome, {userID.value}!</section>
        <div class="flex items-center gap-4 rounded-2xl bg-transparent px-4 py-2 shadow-md">
          <div class="flex items-center gap-2">
            <div class="text-sm font-medium text-gray-900">
              {userWalletType.value}
            </div>
            <div class="text-sm font-medium text-gray-900">
              {userWalletNetwork.value}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="text-sm font-medium text-gray-900">
              {userAddress.value}
            </div>
            <div class="text-sm font-medium text-gray-900">
              {userBalance.value}
            </div>
          </div>
        </div>
        <section />
        <nav class="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              class={{
                "nav-item": true,
                active: activePage.value === item.id,
              }}
              onClick$={() => (activePage.value = item.id)}
            >
              <span>{item.label}</span>
            </Link>
          ))}
          <footer class="text-center border-t border-gray-200 font-extralight mb-1 pt-4 mt-auto">
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
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
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
            {navItems.find((i) => i.id === activePage.value)?.label ||
              "Dashboard"}
          </h1>
        </header>

        <div class="content-area">
          <div class="flex justify-center items-center h-full">
            <p class="text-gray-500">No content available</p>
          </div>
        </div>
      </main>
    </div>
  );
});

export const head: DocumentHead = {
  title: "XRPL OS • Dashboard",
  meta: [
    {
      name: "description",
      content:
        "Modern XRPL dashboard — trade, explore DEX, browse NFTs, analyze charts, inspect ledger",
    },
  ],
};

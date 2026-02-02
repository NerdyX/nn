import { component$, useSignal, Slot } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";

import "./dashboard.css";

export default component$(() => {
  const activePage = useSignal<string>("dex");

  const navItems = [
    { id: "accounts", label: "Accounts", href: "/dashboard/accounts" },
    { id: "explorer", label: "Explorer", href: "/dashboard/explorer" },
    { id: "assets", label: "Assets", href: "/dashboard/assets" },
    { id: "markets", label: "Markets", href: "/dashboard/markets" },
    { id: "minting", label: "Minting", href: "/dashboard/minting" },
    { id: "trading", label: "Swap", href: "/dashboard/trading" },
    { id: "rewards", label: "Rewards", href: "/dashboard/rewards" },
    { id: "bridging", label: "Bridging", href: "/dashboard/bridging" },
    { id: "settings", label: "Settings", href: "/dashboard/settings" },
  ];

  return (
    <div class="app-layout">
      {/* Sidebar */}
      <aside class="sidebar">
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
          <footer class="text-center border-t border-gray-200 font-extralight mb-1.5 mt-auto">
            <div>
              <Link
                href="https://x.com/NerdyXLabs"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center text-gray-950 hover:text-blue-500 transition-colors"
              >
                <span class="hover:underline">{"{NRDX}Labs"}</span>
              </Link>
            </div>
            <div>
              <Link
                href="https://www.nrdxlab.com"
                target="_blank"
                rel="noopener noreferrer"
                class="text-gray-950 hover:text-blue-500 hover:underline transition-colors"
              >
                Visit Our Website
              </Link>
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
          <Slot />
          {/*
            In real routes you would remove <Slot/> and each page would be rendered
            by the file-based router (pages/trading/index.tsx, pages/dex/index.tsx etc.)
          */}
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

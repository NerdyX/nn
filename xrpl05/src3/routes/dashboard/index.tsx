import { component$, useSignal, Signal } from "@builder.io/qwik";

type Category =
  | "overview"
  | "accounts"
  | "assets"
  | "markets"
  | "governance"
  | "network";

export default component$(() => {
  const activeCategory = useSignal<Category>("overview");

  return (
    <div class="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside class="w-64 border-r bg-white">
        <div class="px-6 py-5">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">
            [user.rAddress]
          </h2>
        </div>

        <nav class="flex flex-col gap-1 px-3 text-sm">
          <SidebarItem
            label="Overview"
            value="overview"
            activeCategory={activeCategory}
          />
          <SidebarItem
            label="Accounts"
            value="accounts"
            activeCategory={activeCategory}
          />
          <SidebarItem
            label="Assets"
            value="assets"
            activeCategory={activeCategory}
          />
          <SidebarItem
            label="Markets"
            value="markets"
            activeCategory={activeCategory}
          />
          <SidebarItem
            label="Governance"
            value="governance"
            activeCategory={activeCategory}
          />
          <SidebarItem
            label="Network"
            value="network"
            activeCategory={activeCategory}
          />
        </nav>
      </aside>

      {/* Main Content */}
      <main class="flex-1 overflow-y-auto p-10">
        {activeCategory.value === "overview" && <Overview />}
        {activeCategory.value === "accounts" && <Accounts />}
        {activeCategory.value === "assets" && <Assets />}
        {activeCategory.value === "markets" && <Markets />}
        {activeCategory.value === "governance" && <Governance />}
        {activeCategory.value === "network" && <Network />}
      </main>
    </div>
  );
});

/* ----------------------------
   Sidebar Item
----------------------------- */
const SidebarItem = component$(
  ({
    label,
    value,
    activeCategory,
  }: {
    label: string;
    value: Category;
    activeCategory: Signal<Category>;
  }) => {
    const isActive = activeCategory.value === value;

    return (
      <button
        onClick$={() => {
          activeCategory.value = value;
        }}
        class={[
          "w-full rounded-md px-3 py-2 text-left",
          isActive ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100",
        ]}
      >
        {label}
      </button>
    );
  },
);

/* ----------------------------
   Panels
----------------------------- */

const Overview = component$(() => (
  <section>
    <h1 class="mb-2 text-2xl font-semibold">Overview</h1>
    <p class="mb-6 text-gray-600">
      Real-time view of your ledger presence and network status.
    </p>

    <div class="grid gap-6 md:grid-cols-3">
      <StatCard title="Active Account" value="Not Connected" />
      <StatCard title="Network" value="XRPL Mainnet" />
      <StatCard title="WebSocket" value="Disconnected" />
    </div>
  </section>
));

const Accounts = component$(() => (
  <section>
    <h1 class="mb-2 text-2xl font-semibold">Accounts</h1>
    <p class="mb-6 text-gray-600">
      Manage account-level operations and settings.
    </p>

    <ActionGrid
      actions={["AccountSet", "AccountDelete", "Set Domain", "Set Flags"]}
    />
  </section>
));

const Assets = component$(() => (
  <section>
    <h1 class="mb-2 text-2xl font-semibold">Assets</h1>
    <p class="mb-6 text-gray-600">
      Trustlines, issued currencies, and token controls.
    </p>

    <ActionGrid
      actions={["TrustSet", "Clawback", "Freeze", "Deposit Authorization"]}
    />
  </section>
));

const Markets = component$(() => (
  <section>
    <h1 class="mb-2 text-2xl font-semibold">Markets</h1>
    <p class="mb-6 text-gray-600">AMMs, offers, and liquidity interactions.</p>

    <ActionGrid
      actions={[
        "Create Offer",
        "Cancel Offer",
        "AMM Create",
        "AMM Bid",
        "AMM Withdraw",
      ]}
    />
  </section>
));

const Governance = component$(() => (
  <section>
    <h1 class="mb-2 text-2xl font-semibold">Governance</h1>
    <p class="mb-6 text-gray-600">
      Ledger rules, hooks, and advanced permissions.
    </p>

    <ActionGrid actions={["Hook Set", "Signer List", "Amendments"]} />
  </section>
));

const Network = component$(() => (
  <section>
    <h1 class="mb-2 text-2xl font-semibold">Network</h1>
    <p class="mb-6 text-gray-600">Node connectivity and ledger diagnostics.</p>

    <ActionGrid
      actions={["Server Info", "Ledger State", "Fee Metrics", "Ping Node"]}
    />
  </section>
));

/* ----------------------------
   Shared UI
----------------------------- */

const StatCard = component$(
  ({ title, value }: { title: string; value: string }) => (
    <div class="rounded-xl border bg-white p-6">
      <p class="text-sm text-gray-500">{title}</p>
      <p class="mt-2 text-lg font-semibold">{value}</p>
    </div>
  ),
);

const ActionGrid = component$(({ actions }: { actions: string[] }) => (
  <div class="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
    {actions.map((action) => (
      <button
        key={action}
        class="rounded-lg border bg-white p-4 text-left hover:border-black"
      >
        <p class="font-medium">{action}</p>
        <p class="mt-1 text-sm text-gray-500">
          Configure and execute transaction
        </p>
      </button>
    ))}
  </div>
));

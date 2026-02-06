import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

interface Account {
  address: string;
  balanceXrp: string;
  network: "xrpl" | "xahau";
}

export default component$(() => {
  const loading = useSignal(true);
  const accounts = useSignal<Account[]>([]);

  useTask$(async () => {
    // Mock data for now – wire to your API later
    accounts.value = [
      {
        address: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
        balanceXrp: "1,234.56",
        network: "xrpl",
      },
      {
        address: "r9cZA1mLK5R5Am25ArfXFmqgNwjZgnfk59",
        balanceXrp: "98.02",
        network: "xahau",
      },
    ];

    loading.value = false;
  });

  return (
    <div class="mx-auto max-w-6xl px-6 pt-28">
      {/* Header */}
      <div class="mb-8 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-black">Accounts</h1>
          <p class="text-sm text-black">
            Wallets and ledger accounts connected to your dashboard
          </p>
        </div>

        <button class="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-100">
          + Add Account
        </button>
      </div>

      {/* Content */}
      {loading.value ? (
        <div class="flex h-40 items-center justify-center text-black">
          Loading accounts…
        </div>
      ) : accounts.value.length === 0 ? (
        <div class="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <p class="text-black">No accounts added yet</p>
        </div>
      ) : (
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.value.map((acc) => (
            <Link
              key={acc.address}
              href={`/dashboard/accounts/${acc.address}`}
              class="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
            >
              <div class="mb-3 flex items-center justify-between">
                <span class="text-xs uppercase tracking-wide text-black">
                  {acc.network}
                </span>
                <span class="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                  Live
                </span>
              </div>

              <div class="mb-2 font-mono text-sm text-black">
                {acc.address.slice(0, 8)}…{acc.address.slice(-6)}
              </div>

              <div class="text-lg font-semibold text-black">
                {acc.balanceXrp} XRP
              </div>

              <div class="mt-4 text-xs text-black/40 group-hover:text-black/60">
                View account →
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
});

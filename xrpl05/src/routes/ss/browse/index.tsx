import {
  component$,
  useSignal,
  useTask$,
  useComputed$,
} from "@builder.io/qwik";
import { DocumentHead, Link } from "@builder.io/qwik-city";
import { LuHeart, LuSlidersHorizontal, LuSearch } from "@qwikest/icons/lucide";
import { useNetworkContext } from "~/context/network-context";
import { networkActions } from "~/lib/store/network";
import type { NftItem } from "~/lib/marketplace-data";

const FALLBACK_IMG = "https://placehold.co/400x400/eeeeee/999999?text=NFT";

const formatPrice = (offers: any[]) => {
  if (!offers || offers.length === 0) return "Not Listed";
  const amount = offers[0].amount;
  if (typeof amount === "string") {
    return (Number(amount) / 1000000).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }
  return amount.value;
};

export default component$(() => {
  const networkCtx = useNetworkContext();
  const loading = useSignal(true);
  const nfts = useSignal<NftItem[]>([]);
  const searchQuery = useSignal("");

  useTask$(({ track }) => {
    const net = track(() => networkCtx.activeNetwork.value);
    loading.value = true;

    fetch(`/api/global-marketplace?network=${net}&limit=60`)
      .then((res) => res.json())
      .then((data: any) => {
        nfts.value = data.nfts || [];
        loading.value = false;
      })
      .catch(() => {
        loading.value = false;
      });
  });

  const filteredNfts = useComputed$(() => {
    const q = searchQuery.value.toLowerCase();
    if (!q) return nfts.value;
    return nfts.value.filter(
      (n) =>
        n.name.toLowerCase().includes(q) || n.issuer.toLowerCase().includes(q),
    );
  });

  return (
    <div class="h-[calc(100vh-4rem)] mt-16 bg-gray-50 flex flex-col md:flex-row overflow-hidden w-full">
      {/* Filters Sidebar */}
      <aside class="w-full md:w-64 bg-white border-r border-gray-200 p-6 flex-shrink-0 hidden md:flex flex-col shadow-sm overflow-y-auto h-full">
        <div class="flex items-center gap-2 font-extrabold text-xl mb-8 text-gray-900 tracking-tight">
          <LuSlidersHorizontal class="w-5 h-5 text-blue-600" /> Filters
        </div>
        <div class="space-y-8">
          {/* Network Filter */}
          <div>
            <h3 class="font-bold text-xs uppercase tracking-wider mb-4 text-gray-400">
              Network
            </h3>
            <div class="space-y-3 text-sm text-gray-700 font-medium">
              <label
                class="flex items-center gap-3 cursor-pointer group"
                onClick$={() => networkActions.setActiveNetwork("xrpl")}
              >
                <img
                  src="/icons/XRPL.svg"
                  alt="XRPL"
                  class={[
                    "w-20 h-10 object-contain transition-all",
                    networkCtx.activeNetwork.value === "xrpl"
                      ? "opacity-100 scale-110"
                      : "opacity-40 grayscale group-hover:opacity-70",
                  ].join(" ")}
                />
                <span
                  class={
                    networkCtx.activeNetwork.value === "xrpl"
                      ? "font-bold text-blue-600"
                      : ""
                  }
                ></span>
              </label>
              <label
                class="flex items-center gap-3 cursor-pointer group"
                onClick$={() => networkActions.setActiveNetwork("xahau")}
              >
                <img
                  src="/icons/XAHAUL.png"
                  alt="Xahau"
                  class={[
                    "w-20 h-10 object-contain transition-all",
                    networkCtx.activeNetwork.value === "xahau"
                      ? "opacity-100 scale-110"
                      : "opacity-40 grayscale group-hover:opacity-70",
                  ].join(" ")}
                />
                <span
                  class={
                    networkCtx.activeNetwork.value === "xahau"
                      ? "font-bold text-yellow-600"
                      : ""
                  }
                ></span>
              </label>
            </div>
          </div>

          {/* Status */}
          <div class="border-t border-gray-100 pt-6">
            <h3 class="font-bold text-xs uppercase tracking-wider mb-4 text-gray-400">
              Status
            </h3>
            <div class="space-y-3 text-sm text-gray-700 font-medium">
              <label class="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Buy Now
              </label>
              <label class="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Has Offers
              </label>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main class="flex-1 p-4 md:p-8 flex flex-col overflow-y-auto h-full w-full">
        {/* Header Controls */}
        <div class="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <div class="relative w-full sm:max-w-md">
            <LuSearch class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search assets or issuers..."
              value={searchQuery.value}
              onInput$={(e) =>
                (searchQuery.value = (e.target as HTMLInputElement).value)
              }
              class="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-shadow"
            />
          </div>
          <div class="flex items-center gap-3 w-full sm:w-auto">
            <select class="w-full sm:w-auto bg-white border border-gray-200 text-sm rounded-2xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-gray-700 font-bold shadow-sm appearance-none pr-8 relative">
              <option>Recently Minted</option>
              <option>Price: Low to High</option>
              <option>Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Loading / Grid */}
        {loading.value ? (
          <div class="flex justify-center items-center py-32 min-h-[50vh] flex-col">
            <div class="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p class="mt-6 text-gray-500 font-medium tracking-wide">
              Syncing live ledger data...
            </p>
          </div>
        ) : (
          <>
            <div class="flex items-center justify-between mb-6">
              <span class="text-sm font-bold text-gray-500 tracking-wide uppercase">
                {filteredNfts.value.length} Assets Found
              </span>
            </div>

            {filteredNfts.value.length === 0 ? (
              <div class="flex flex-col items-center justify-center py-32 text-gray-400 bg-white rounded-3xl border border-gray-100 border-dashed">
                <LuSearch class="w-16 h-16 mb-6 opacity-20" />
                <p class="text-lg font-medium text-gray-500">
                  No assets found.
                </p>
                <p class="text-sm mt-2">
                  Try adjusting your filters or search query.
                </p>
              </div>
            ) : (
              <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                {filteredNfts.value.map((nft) => (
                  <Link
                    href={`/search?address=${nft.owner}`}
                    key={nft.nftokenId}
                  >
                    <div class="group relative bg-white rounded-2xl p-3 shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer h-full flex flex-col">
                      <div class="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-50">
                        <img
                          width={128}
                          height={128}
                          src={nft.image || FALLBACK_IMG}
                          alt={nft.name}
                          loading="lazy"
                          onError$={(e) => {
                            (e.target as HTMLImageElement).src = FALLBACK_IMG;
                          }}
                          class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                        <div class="absolute bottom-3 inset-x-0 flex justify-center translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                          <button class="bg-white/95 backdrop-blur-sm text-gray-900 text-xs font-bold px-5 py-2 rounded-full shadow-lg hover:bg-white hover:scale-105 transition-all">
                            View Owner
                          </button>
                        </div>

                        <button class="absolute top-3 right-3 p-2 rounded-full bg-black/20 backdrop-blur-md hover:bg-black/40 text-white transition-colors">
                          <LuHeart class="w-4 h-4" />
                        </button>
                      </div>
                      <div class="mt-4 px-1 flex-1 flex flex-col">
                        <h3 class="font-extrabold text-gray-900 truncate tracking-tight text-base group-hover:text-blue-600 transition-colors">
                          {nft.name}
                        </h3>
                        <p class="text-sm text-gray-500 font-medium truncate mt-1 flex items-center gap-1.5">
                          <span class="w-4 h-4 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-500 inline-block shrink-0 shadow-inner" />
                          {nft.issuer.slice(0, 8)}...
                        </p>
                        <div class="mt-auto pt-5 flex items-end justify-between">
                          <div>
                            <p class="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-0.5">
                              Price
                            </p>
                            <p class="text-sm font-black text-blue-600">
                              {formatPrice(nft.sellOffers)}
                            </p>
                          </div>
                          <span class="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-1 rounded-md">
                            {networkCtx.activeNetwork.value.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Browse | {XRPL}OS Marketplace",
  meta: [
    {
      name: "description",
      content: "Browse live NFTs across XRPL and Xahau.",
    },
  ],
};

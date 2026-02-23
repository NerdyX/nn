import { component$, useSignal, useComputed$ } from "@builder.io/qwik";
import { DocumentHead } from "@builder.io/qwik-city";
import {
  LuHeart,
  LuSlidersHorizontal,
  LuSearch,
  LuLayoutGrid,
  LuList,
} from "@qwikest/icons/lucide";

interface NFT {
  id: number;
  image: string;
  title: string;
  creator: string;
  price: number;
  likes: number;
  category: string;
  network: string;
}

// 32 mock items for a full 4×8 grid
const allNFTs: NFT[] = Array.from({ length: 32 }, (_, i) => ({
  id: i + 1,
  image: `https://source.unsplash.com/random/400x400?sig=br${i + 1}&${["nft", "art", "digital", "abstract", "cyber", "pixel", "space", "nature"][i % 8]}`,
  title: [
    "Dreamscape",
    "CryptoBeat",
    "Pixel Pals",
    "RareVibes",
    "MetaMask",
    "Neon Night",
    "Harmony",
    "Block Busters",
    "Virtual Vista",
    "Sound Sphere",
    "Void Walker",
    "Neon Genesis",
    "Cyber Ghost",
    "Silk Protocol",
    "Ghost Garden",
    "Abyss Club",
    "Solar Flare",
    "Dark Matter",
    "Prism Break",
    "Echo Chamber",
    "Starfall",
    "Midnight Bloom",
    "Glitch Art",
    "Iron Veil",
    "Crystal Pulse",
    "Polygon Heart",
    "Shadow Box",
    "Ether Bloom",
    "Minted Myth",
    "Byte Spirit",
    "Circuit Dream",
    "Hologram X",
  ][i],
  creator: [
    "ArtistAlpha",
    "MusicianBeta",
    "CreatorGamma",
    "ArtistDelta",
    "DesignerEpsilon",
    "ArtistZeta",
    "MusicianEta",
    "CreatorTheta",
    "DesignerIota",
    "ProducerKappa",
  ][i % 10],
  price: parseFloat((Math.random() * 20 + 0.5).toFixed(2)),
  likes: Math.floor(Math.random() * 600 + 10),
  category: ["Art", "Music", "Gaming", "Photography", "Collectibles", "Sports"][
    i % 6
  ],
  network: i % 3 === 0 ? "Xahau" : "XRPL",
}));

const CATEGORIES = [
  "All",
  "Art",
  "Music",
  "Gaming",
  "Photography",
  "Collectibles",
  "Sports",
];
const SORT_OPTIONS = [
  "Recently Listed",
  "Price: Low → High",
  "Price: High → Low",
  "Most Liked",
];
const NETWORKS = ["All Networks", "XRPL", "Xahau"];

export default component$(() => {
  const search = useSignal("");
  const selectedCategory = useSignal("All");
  const selectedSort = useSignal("Recently Listed");
  const selectedNetwork = useSignal("All Networks");
  const minPrice = useSignal("");
  const maxPrice = useSignal("");
  const viewMode = useSignal<"grid" | "list">("grid");
  const showFilters = useSignal(false);

  const filtered = useComputed$(() => {
    let items = [...allNFTs];

    if (search.value.trim()) {
      const q = search.value.toLowerCase();
      items = items.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.creator.toLowerCase().includes(q),
      );
    }
    if (selectedCategory.value !== "All") {
      items = items.filter((n) => n.category === selectedCategory.value);
    }
    if (selectedNetwork.value !== "All Networks") {
      items = items.filter((n) => n.network === selectedNetwork.value);
    }
    if (minPrice.value) {
      items = items.filter((n) => n.price >= parseFloat(minPrice.value));
    }
    if (maxPrice.value) {
      items = items.filter((n) => n.price <= parseFloat(maxPrice.value));
    }

    switch (selectedSort.value) {
      case "Price: Low → High":
        items.sort((a, b) => a.price - b.price);
        break;
      case "Price: High → Low":
        items.sort((a, b) => b.price - a.price);
        break;
      case "Most Liked":
        items.sort((a, b) => b.likes - a.likes);
        break;
    }

    return items;
  });

  return (
    <div class="min-h-screen mt-16 bg-gray-50">
      {/* Page Header */}
      <div class="bg-white border-b border-gray-200 px-4 md:px-8 py-5">
        <div class="max-w-screen-7l mx-auto">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 class="text-2xl font-bold text-gray-900">
                {"{XRPL}"}
                <span class="text-indigo-500">Browse</span>
              </h1>
              <p class="text-sm text-gray-500 mt-0.5">
                {filtered.value.length} items available
              </p>
            </div>

            {/* Search */}
            <div class="relative flex-1 max-w-md">
              <LuSearch class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search NFTs, creators..."
                value={search.value}
                onInput$={(e) => {
                  search.value = (e.target as HTMLInputElement).value;
                }}
                class="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50"
              />
            </div>

            {/* Sort & view controls */}
            <div class="flex items-center gap-2">
              <select
                value={selectedSort.value}
                onChange$={(e) => {
                  selectedSort.value = (e.target as HTMLSelectElement).value;
                }}
                class="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <button
                onClick$={() => {
                  showFilters.value = !showFilters.value;
                }}
                class={[
                  "flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm font-medium transition",
                  showFilters.value
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-gray-200 text-gray-700 hover:border-indigo-400",
                ].join(" ")}
              >
                <LuSlidersHorizontal class="w-4 h-4" />
                Filters
              </button>

              <button
                onClick$={() => {
                  viewMode.value = viewMode.value === "grid" ? "list" : "grid";
                }}
                class="border border-gray-200 bg-white rounded-lg p-2 text-gray-600 hover:border-indigo-400 transition"
                aria-label="Toggle view"
              >
                {viewMode.value === "grid" ? (
                  <LuList class="w-4 h-4" />
                ) : (
                  <LuLayoutGrid class="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Expandable filter bar */}
          {showFilters.value && (
            <div class="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4 items-end">
              {/* Category pills */}
              <div class="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick$={() => {
                      selectedCategory.value = cat;
                    }}
                    class={[
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition",
                      selectedCategory.value === cat
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white border-gray-200 text-gray-600 hover:border-indigo-400",
                    ].join(" ")}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Network */}
              <select
                value={selectedNetwork.value}
                onChange$={(e) => {
                  selectedNetwork.value = (e.target as HTMLSelectElement).value;
                }}
                class="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {NETWORKS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>

              {/* Price range */}
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">Price (XRP)</span>
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice.value}
                  onInput$={(e) => {
                    minPrice.value = (e.target as HTMLInputElement).value;
                  }}
                  class="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <span class="text-gray-400 text-xs">–</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice.value}
                  onInput$={(e) => {
                    maxPrice.value = (e.target as HTMLInputElement).value;
                  }}
                  class="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              {/* Reset */}
              <button
                onClick$={() => {
                  selectedCategory.value = "All";
                  selectedNetwork.value = "All Networks";
                  minPrice.value = "";
                  maxPrice.value = "";
                  search.value = "";
                  selectedSort.value = "Recently Listed";
                }}
                class="text-xs text-indigo-500 hover:text-indigo-700 underline"
              >
                Reset all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div class="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {filtered.value.length === 0 ? (
          <div class="flex flex-col items-center justify-center py-20 text-gray-400">
            <svg
              class="w-16 h-16 mb-4 opacity-30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p class="text-lg font-medium">No results found</p>
            <p class="text-sm">Try adjusting your filters</p>
          </div>
        ) : viewMode.value === "grid" ? (
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {filtered.value.map((nft) => (
              <div
                key={nft.id}
                class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group"
              >
                <div class="relative overflow-hidden">
                  <img
                    height={100}
                    width={100}
                    src={nft.image}
                    alt={nft.title}
                    class="w-full h-52 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div class="absolute inset-0 bg-linear-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <button class="absolute top-2.5 right-2.5 bg-white/80 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <LuHeart class="w-4 h-4 text-red-500" />
                  </button>
                  <span class="absolute top-2.5 left-2.5 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full">
                    {nft.category}
                  </span>
                </div>
                <div class="p-4">
                  <h3 class="font-semibold text-sm text-gray-900 truncate">
                    {nft.title}
                  </h3>
                  <p class="text-xs text-gray-400 mt-0.5 truncate">
                    by {nft.creator}
                  </p>
                  <div class="mt-3 flex items-center justify-between">
                    <div>
                      <p class="text-xs text-gray-400 leading-none">Price</p>
                      <p class="text-indigo-600 font-bold text-sm mt-0.5">
                        {nft.price} XRP
                      </p>
                    </div>
                    <button class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition">
                      Buy Now
                    </button>
                  </div>
                  <div class="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <span class="flex items-center gap-1">
                      <LuHeart class="w-3 h-3 text-red-400" /> {nft.likes}
                    </span>
                    <span
                      class={
                        nft.network === "Xahau"
                          ? "text-emerald-500 font-medium"
                          : "text-indigo-400 font-medium"
                      }
                    >
                      {nft.network}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List view */
          <div class="flex flex-col gap-3">
            {filtered.value.map((nft) => (
              <div
                key={nft.id}
                class="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition flex items-center gap-4 p-3 cursor-pointer"
              >
                <img
                  height={100}
                  width={100}
                  src={nft.image}
                  alt={nft.title}
                  class="w-16 h-16 rounded-lg object-cover flex-none"
                />
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold text-sm text-gray-900 truncate">
                    {nft.title}
                  </h3>
                  <p class="text-xs text-gray-400 truncate">by {nft.creator}</p>
                  <span class="text-xs text-gray-400">
                    {nft.category} · {nft.network}
                  </span>
                </div>
                <div class="flex items-center gap-4 flex-none">
                  <div class="text-right">
                    <p class="text-xs text-gray-400">Price</p>
                    <p class="text-indigo-600 font-bold text-sm">
                      {nft.price} XRP
                    </p>
                  </div>
                  <div class="flex items-center text-xs text-gray-400 gap-1">
                    <LuHeart class="w-3.5 h-3.5 text-red-400" /> {nft.likes}
                  </div>
                  <button class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-full transition">
                    Buy
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Browse | {XRPL}OS",
  meta: [
    {
      name: "description",
      content:
        "Browse all NFTs and digital assets on the XRP Ledger marketplace.",
    },
  ],
};

import { component$, useSignal } from "@builder.io/qwik";
import { useStylesScoped$ } from "@builder.io/qwik";
import styles from "./marketplace.css?inline";

interface Nft {
  id: string;
  name: string;
  image: string;
  collection: string;
  owner: string;
  price: string;
  lastSale: string;
}

export default component$(() => {
  useStylesScoped$(styles);

  // Mock NFTs for template preview
  const nfts = useSignal<Nft[]>(
    Array.from({ length: 20 }, (_, i) => ({
      id: `NFT-${i + 1}`,
      name: `XRPL NFT #${i + 1000}`,
      image: `https://picsum.photos/seed/nft${i}/600/600`,
      collection: `Collection ${Math.ceil((i + 1) / 5)}`,
      owner: `rOwner${i + 1}XYZ`,
      price: `${(Math.random() * 10 + 1).toFixed(2)} XRP`,
      lastSale: `${(Math.random() * 5 + 1).toFixed(2)} XRP`,
    })),
  );

  const selectedNft = useSignal<Nft | null>(null);
  const searchQuery = useSignal("");
  const currentPage = useSignal(1);
  const pageSize = 8;

  const filtered = nfts.value.filter(
    (nft) =>
      nft.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      nft.collection.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      nft.owner.toLowerCase().includes(searchQuery.value.toLowerCase()),
  );

  const paginated = filtered.slice(
    (currentPage.value - 1) * pageSize,
    currentPage.value * pageSize,
  );

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div class="bg-black/60 text-white px-4 py-2 rounded-xl text-sm">
      <div class="text-white/60 text-xs">{label}</div>
      <div class="font-semibold">{value}</div>
    </div>
  );

  return (
    <div class="min-h-screen bg-white text-black pb-20">
      {/* Search */}
      <div class="max-w-7xl mx-auto px-6 mt-6 flex gap-4">
        <input
          type="text"
          placeholder="Search NFTs, collections, owners..."
          class="flex-1 rounded-xl border px-4 py-3 text-black focus:outline-none focus:ring focus:ring-green-400"
          value={searchQuery.value}
          onInput$={(e) =>
            (searchQuery.value = (e.target as HTMLInputElement).value)
          }
        />
      </div>

      {/* Featured Header */}
      <section class="mt-3 relative overflow-hidden bg-linear-to-r from-violet-600 to-indigo-700">
        <div class="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 class="text-5xl font-bold text-white leading-tight">
              Discover the XRPL NFT Economy
            </h1>
            <p class="mt-4 text-white/80 max-w-lg">
              Explore trending collections, top movers, and record-breaking
              sales across the XRP Ledger ecosystem.
            </p>
            {/* Stats */}
            <div class="flex flex-wrap gap-3">
              <Stat label="Floor Price" value="4.38 XRP" />
              <Stat label="Items" value="8,888" />
              <Stat label="Total Volume" value="505K XRP" />
              <Stat label="Listed" value="2.7%" />
            </div>
          </div>

          <div class="hidden md:block">
            <img
              src={nfts.value[0].image}
              class="rounded-2xl shadow-2xl rotate-2"
              alt="Featured NFT"
              width={400}
              height={400}
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* Trending Collections */}
      <section class="max-w-7xl mx-auto px-6 mt-14">
        <h2 class="text-2xl font-bold mb-6">🔥 Trending Collections</h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              class="rounded-2xl border p-5 hover:shadow-lg transition"
            >
              <div class="flex items-center gap-4">
                <img
                  src={`https://picsum.photos/seed/collection${i}/100/100`}
                  class="w-14 h-14 rounded-xl"
                  height={100}
                  width={100}
                  loading="lazy"
                />
                <div>
                  <p class="font-semibold">Collection {i}</p>
                  <p class="text-xs text-slate-500">
                    Floor: {(i * 2.3).toFixed(2)} XRP
                  </p>
                </div>
              </div>

              <div class="mt-4 text-xs text-slate-400">
                Volume 24h: {(Math.random() * 1000).toFixed(0)} XRP
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Daily Top Movers */}
      <section class="max-w-7xl mx-auto px-6 mt-16">
        <h2 class="text-2xl font-bold mb-6">📈 Daily Top Movers</h2>

        <div class="overflow-x-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr class="text-left text-sm text-slate-500 border-b">
                <th class="pb-3">NFT</th>
                <th>Collection</th>
                <th>Price</th>
                <th>24h %</th>
              </tr>
            </thead>
            <tbody>
              {nfts.value.slice(0, 5).map((nft) => (
                <tr
                  key={nft.id}
                  class="border-b hover:bg-slate-50 cursor-pointer"
                  onClick$={() => (selectedNft.value = nft)}
                >
                  <td class="py-4 flex items-center gap-3">
                    <img
                      src={nft.image}
                      class="w-10 h-10 rounded-lg"
                      height={100}
                      width={100}
                      loading="lazy"
                    />
                    <span class="font-medium">{nft.name}</span>
                  </td>
                  <td class="text-sm">{nft.collection}</td>
                  <td class="text-sm">{nft.price}</td>
                  <td class="text-green-600 text-sm font-semibold">
                    +{(Math.random() * 25).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Highest Weekly Sale */}
      <section class="max-w-7xl mx-auto px-6 mt-20">
        <h2 class="text-2xl font-bold mb-6">🏆 Highest Weekly Sale</h2>

        <div class="flex flex-col md:flex-row gap-8 items-center border rounded-2xl p-6">
          <img
            src={nfts.value[3].image}
            class="w-full md:w-80 rounded-xl shadow-lg"
            height={100}
            width={100}
            loading="lazy"
          />

          <div>
            <h3 class="text-3xl font-bold mb-2">{nfts.value[3].name}</h3>
            <p class="text-slate-500 mb-2">{nfts.value[3].collection}</p>
            <p class="text-lg font-semibold text-green-600 mb-4">
              Sold for {(Math.random() * 500 + 200).toFixed(0)} XRP
            </p>
            <button
              class="px-5 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700"
              onClick$={() => (selectedNft.value = nfts.value[3])}
            >
              View NFT
            </button>
          </div>
        </div>
      </section>

      {/* NFT Grid */}
      <main class="max-w-7xl mx-auto px-6 mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {paginated.map((nft) => (
          <div
            key={nft.id}
            class="group rounded-2xl overflow-hidden hover:shadow-2xl hover:border-violet-600/50 transition cursor-pointer"
            onClick$={() => (selectedNft.value = nft)}
          >
            <div class="relative aspect-square overflow-hidden bg-slate-950">
              <img
                src={nft.image}
                alt={nft.name}
                height={40}
                width={40}
                class="w-full h-full object-cover transition-transform group-hover:scale-110"
              />
              <div class="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div class="p-4">
              <h3 class="font-semibold text-lg truncate">{nft.name}</h3>
              <p class="text-sm text-violet-300 truncate">{nft.collection}</p>
              <p class="text-xs text-slate-500 mt-1">Owner: {nft.owner}</p>
              <p class="text-xs text-slate-400">Price: {nft.price}</p>
              <p class="text-xs text-slate-400">Last Sale: {nft.lastSale}</p>
            </div>
          </div>
        ))}
      </main>

      {/* Pagination */}
      <div class="flex justify-center gap-4 mt-8">
        <button
          class="px-3 py-1 border rounded disabled:opacity-40"
          disabled={currentPage.value <= 1}
          onClick$={() => currentPage.value--}
        >
          Previous
        </button>
        <span class="px-2 py-1">{currentPage.value}</span>
        <button
          class="px-3 py-1 border rounded"
          disabled={currentPage.value * pageSize >= filtered.length}
          onClick$={() => currentPage.value++}
        >
          Next
        </button>
      </div>

      {/* NFT Modal */}
      {selectedNft.value && (
        <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div class="bg-slate-950/30 rounded-2xl p-6 w-11/12 max-w-2xl relative">
            <button
              class="absolute top-3 right-3 text-gray-400 hover:text-white"
              onClick$={() => (selectedNft.value = null)}
            >
              ✕
            </button>
            <img
              src={selectedNft.value.image}
              alt={selectedNft.value.name}
              height={40}
              width={40}
              class="w-full rounded-xl mb-4"
            />
            <h2 class="text-2xl font-bold mb-2">{selectedNft.value.name}</h2>
            <p class="text-sm text-violet-300 mb-2">
              {selectedNft.value.collection}
            </p>
            <p class="text-xs text-slate-400 mb-1">
              Owner: {selectedNft.value.owner}
            </p>
            <p class="text-xs text-slate-400 mb-1">
              Price: {selectedNft.value.price}
            </p>
            <p class="text-xs text-slate-400 mb-4">
              Last Sale: {selectedNft.value.lastSale}
            </p>
            <div class="flex gap-2">
              <button class="px-4 py-2 bg-green-600 rounded hover:bg-green-700">
                Buy
              </button>
              <button class="px-4 py-2 border rounded hover:bg-gray-800">
                Make Offer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

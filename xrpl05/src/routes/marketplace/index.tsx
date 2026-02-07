import { component$, useSignal } from "@builder.io/qwik";

interface Nft {
  id: string;
  name: string;
  image: string;
  collection: string;
  owner: string;
  price: string;
  lastSale: string;
}

interface MintFormData {
  nftName: string;
  collectionName: string;
  description: string;
  royalty: string;
}

export default component$(() => {
  // Mock NFTs for template preview
  const nfts = useSignal<Nft[]>(
    Array.from({ length: 20 }, (_, i) => ({
      id: `NFT-${i + 1}`,
      name: `Xahau NFT #${i + 1000}`,
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
  const pageSize = 12;
  const activeTab = useSignal<"explore" | "market" | "claim" | "mint" | "">(
    "explore",
  );
  const selectedCollection = useSignal<string | null>(null);
  const priceRange = useSignal<[number, number]>([0, 100]);
  const claimableNfts = useSignal<Nft[]>(nfts.value.slice(0, 8));
  const claimedNfts = useSignal<Nft[]>([]);
  const mintedNfts = useSignal<Nft[]>([]);
  const mintFormData = useSignal<MintFormData>({
    nftName: "",
    collectionName: "",
    description: "",
    royalty: "5",
  });
  const previewImage = useSignal<string>("");

  const filtered = nfts.value.filter((nft) => {
    const matchesSearch =
      nft.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      nft.collection.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      nft.owner.toLowerCase().includes(searchQuery.value.toLowerCase());

    const matchesCollection =
      !selectedCollection.value || nft.collection === selectedCollection.value;

    const price = parseFloat(nft.price);
    const matchesPrice =
      price >= priceRange.value[0] && price <= priceRange.value[1];

    return matchesSearch && matchesCollection && matchesPrice;
  });

  const paginated = filtered.slice(
    (currentPage.value - 1) * pageSize,
    currentPage.value * pageSize,
  );

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div class="backdrop-blur-md bg-white/30 text-gray-800 px-4 py-3 rounded-2xl text-sm border border-white/40 hover:bg-white/40 transition-all duration-300 shadow-lg">
      <div class="text-gray-600 text-xs font-medium">{label}</div>
      <div class="font-bold text-lg mt-1">{value}</div>
    </div>
  );

  return (
    <div class="min-h-screen bg-white text-gray-900 mt-24 pb-20">
      {/* Tabs Section */}
      <section class="max-w-7xl mx-auto px-6 mt-12">
        <div class="flex gap-4 border-b border-white/30">
          <button
            class={`px-6 py-3 font-semibold transition-all duration-300 ${
              activeTab.value === "explore"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
            onClick$={() => {
              activeTab.value = "explore";
              currentPage.value = 1;
            }}
          >
            Explore Features
          </button>
          <button
            class={`px-6 py-3 font-semibold transition-all duration-300 ${
              activeTab.value === "market"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
            onClick$={() => {
              activeTab.value = "market";
              currentPage.value = 1;
            }}
          >
            Market
          </button>
          <button
            class={`px-6 py-3 font-semibold transition-all duration-300 ${
              activeTab.value === "claim"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
            onClick$={() => {
              activeTab.value = "claim";
              currentPage.value = 1;
            }}
          >
            Claim NFTs
          </button>
          <button
            class={`px-6 py-3 font-semibold transition-all duration-300 ${
              activeTab.value === "mint"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
            onClick$={() => {
              activeTab.value = "mint";
              currentPage.value = 1;
            }}
          >
            Mint NFT
          </button>
        </div>

        {/* Explore Tab */}
        {activeTab.value === "explore" && (
          <div class="mt-8">
            {/* Search */}
            <div class="flex gap-4 mb-8">
              <div class="flex-1 relative group">
                <input
                  type="text"
                  placeholder="Search NFTs, collections, owners..."
                  class="w-full rounded-2xl backdrop-blur-md bg-white/40 border border-white/60 px-5 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white/60 transition-all duration-300 shadow-lg"
                  value={searchQuery.value}
                  onInput$={(e) =>
                    (searchQuery.value = (e.target as HTMLInputElement).value)
                  }
                />
              </div>
            </div>

            {/* Featured Hero - Bento Box */}
            <section class="max-w-7xl mx-auto px-6 mt-8">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-max">
                {/* Hero Section - Large Box */}
                <div class="md:col-span-2 rounded-3xl backdrop-blur-xl bg-linear-to-br from-blue-50/60 via-white/40 to-purple-50/60 border border-white/50 shadow-2xl p-8 md:p-12">
                  <h1 class="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
                    Discover Xahau NFTs
                  </h1>
                  <p class="mt-4 text-gray-700 max-w-lg text-lg">
                    Explore premium digital collections on the XRP Ledger's
                    innovative Xahau sidechain. Trade, collect, and invest in
                    the future.
                  </p>
                  <div class="flex flex-wrap gap-3 mt-6">
                    <Stat label="Floor Price" value="4.38 XRP" />
                    <Stat label="Total Items" value="8,888" />
                    <Stat label="Volume" value="505K XRP" />
                    <Stat label="Listed" value="2.7%" />
                  </div>
                </div>

                {/* Featured NFT - Side Box */}
                <div class="rounded-3xl overflow-hidden shadow-2xl border border-white/40 backdrop-blur-sm">
                  <img
                    src={nfts.value[0].image}
                    class="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    alt="Featured NFT"
                    width={400}
                    height={400}
                    loading="lazy"
                  />
                </div>

                {/* Top Movers - Box */}
                <div class="md:col-span-1 rounded-3xl backdrop-blur-md bg-white/40 border border-white/50 p-6 shadow-xl">
                  <h3 class="text-xl font-bold text-gray-900 mb-4">
                    📈 Top Movers
                  </h3>
                  <div class="space-y-3">
                    {nfts.value.slice(0, 3).map((nft) => (
                      <div
                        key={nft.id}
                        class="flex items-center gap-3 p-3 rounded-xl hover:bg-white/40 transition-all duration-200 cursor-pointer"
                        onClick$={() => (selectedNft.value = nft)}
                      >
                        <img
                          src={nft.image}
                          class="w-12 h-12 rounded-lg object-cover"
                          height={50}
                          width={50}
                          loading="lazy"
                        />
                        <div class="flex-1 min-w-0">
                          <p class="font-semibold text-sm text-gray-900 truncate">
                            {nft.name}
                          </p>
                          <p class="text-xs text-blue-600 font-medium">
                            +{(Math.random() * 25).toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trending Collections - Box */}
                <div class="md:col-span-2 rounded-3xl backdrop-blur-md bg-white/40 border border-white/50 p-6 shadow-xl">
                  <h3 class="text-xl font-bold text-gray-900 mb-4">
                    🔥 Trending Collections
                  </h3>
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        class="rounded-2xl backdrop-blur-sm bg-white/40 border border-white/50 p-4 hover:bg-white/60 transition-all duration-300 cursor-pointer group text-center"
                      >
                        <img
                          src={`https://picsum.photos/seed/collection${i}/100/100`}
                          class="w-16 h-16 rounded-xl object-cover group-hover:scale-110 transition-transform duration-300 mx-auto mb-2"
                          height={100}
                          width={100}
                          loading="lazy"
                        />
                        <p class="font-bold text-sm text-gray-900">
                          Collection {i}
                        </p>
                        <p class="text-xs text-gray-600 mt-1">
                          Floor: {(i * 2.3).toFixed(2)} XRP
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Market Tab */}
        {activeTab.value === "market" && (
          <div class="mt-8">
            {/* Search and Filters */}
            <div class="flex flex-col lg:flex-row gap-6 mb-8">
              {/* Search */}
              <div class="flex-1">
                <input
                  type="text"
                  placeholder="Search NFTs..."
                  class="w-full rounded-2xl backdrop-blur-md bg-white/40 border border-white/60 px-5 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white/60 transition-all duration-300 shadow-lg"
                  value={searchQuery.value}
                  onInput$={(e) =>
                    (searchQuery.value = (e.target as HTMLInputElement).value)
                  }
                />
              </div>

              {/* Filter Sidebar */}
              <div class="flex flex-col sm:flex-row gap-1 flex-wrap lg:flex-nowrap">
                {/* Collection Filter */}
                <div class=" min-w-48 rounded-2xl backdrop-blur-md bg-white/40 border border-white/50 p-4">
                  <select
                    class="w-full rounded-lg bg-white/40 border border-white/50 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={selectedCollection.value || ""}
                    onChange$={(e) =>
                      (selectedCollection.value =
                        (e.target as HTMLSelectElement).value || null)
                    }
                  >
                    <option value="">All Collections</option>
                    {Array.from({ length: 4 }, (_, i) => (
                      <option key={i} value={`Collection ${i + 1}`}>
                        {`Collection ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price Range Filter */}
                <div class="flex-1 min-w-48 rounded-2xl backdrop-blur-md bg-white/40 border border-white/50 p-4">
                  <div class="space-y-2">
                    <div class="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={priceRange.value[0]}
                        onInput$={(e) =>
                          (priceRange.value = [
                            parseFloat((e.target as HTMLInputElement).value),
                            priceRange.value[1],
                          ])
                        }
                        class="w-full h-2 bg-white/30 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div class="flex gap-2 text-xs text-gray-700">
                      <span>{priceRange.value[0]} XRP</span>
                      <span>-</span>
                      <span>{priceRange.value[1]} XRP</span>
                    </div>
                  </div>
                </div>

                {/* Clear Filters */}
                <button
                  class="px-6 py-2 backdrop-blur-md bg-transparent border border-white/50 text-gray-900 text-sm font-medium hover:bg-white/60 transition-all duration-300 rounded-full"
                  onClick$={() => {
                    selectedCollection.value = null;
                    priceRange.value = [0, 100];
                    searchQuery.value = "";
                  }}
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {/* NFT Grid */}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginated.length > 0 ? (
                paginated.map((nft) => (
                  <div
                    key={nft.id}
                    class="group rounded-2xl overflow-hidden backdrop-blur-md bg-white/40 border border-white/50 hover:border-blue-400/50 hover:bg-white/60 hover:shadow-2xl transition-all duration-300 cursor-pointer hover:-translate-y-1"
                    onClick$={() => (selectedNft.value = nft)}
                  >
                    <div class="relative aspect-square overflow-hidden bg-linear-to-br from-gray-100 to-gray-50">
                      <img
                        src={nft.image}
                        alt={nft.name}
                        height={400}
                        width={400}
                        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div class="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    <div class="p-5">
                      <h3 class="font-bold text-lg text-gray-900 truncate">
                        {nft.name}
                      </h3>
                      <p class="text-sm text-blue-600 truncate font-medium mt-1">
                        {nft.collection}
                      </p>
                      <p class="text-xs text-gray-700 mt-2">
                        Owner: {nft.owner}
                      </p>
                      <p class="text-xs text-gray-600 font-semibold mt-1">
                        {nft.price}
                      </p>
                      <p class="text-xs text-gray-600">Last: {nft.lastSale}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div class="col-span-full text-center py-12">
                  <p class="text-gray-600 text-lg">
                    No NFTs found matching your filters
                  </p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {filtered.length > pageSize && (
              <div class="flex justify-center gap-4 mt-12">
                <button
                  class="px-4 py-2 backdrop-blur-md bg-white/40 border border-white/50 rounded-xl text-gray-900 font-medium hover:bg-white/60 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={currentPage.value <= 1}
                  onClick$={() => currentPage.value--}
                >
                  Previous
                </button>
                <span class="px-4 py-2 font-semibold text-gray-900">
                  {currentPage.value} of {Math.ceil(filtered.length / pageSize)}
                </span>
                <button
                  class="px-4 py-2 backdrop-blur-md bg-white/40 border border-white/50 rounded-xl text-gray-900 font-medium hover:bg-white/60 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={currentPage.value * pageSize >= filtered.length}
                  onClick$={() => currentPage.value++}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* Claim Tab */}
        {activeTab.value === "claim" && (
          <div class="mt-8">
            {/* Claim Header */}
            <div class="rounded-3xl backdrop-blur-xl bg-linear-to-br from-green-50/60 via-white/40 to-emerald-50/60 border border-white/50 shadow-2xl p-8 md:p-12 mb-8">
              <h1 class="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
                🎁 Claim Your NFTs
              </h1>
              <p class="mt-4 text-gray-700 max-w-lg text-lg">
                You have {claimableNfts.value.length} NFTs available to claim.
                Click on any NFT below and claim it to add it to your wallet.
              </p>
              <div class="flex flex-wrap gap-3 mt-6">
                <Stat
                  label="Claimable NFTs"
                  value={claimableNfts.value.length.toString()}
                />
                <Stat
                  label="Already Claimed"
                  value={claimedNfts.value.length.toString()}
                />
                <Stat
                  label="Total Available"
                  value={(
                    claimableNfts.value.length + claimedNfts.value.length
                  ).toString()}
                />
              </div>
            </div>

            {/* Tabs for Claimable and Claimed */}
            <div class="flex gap-4 border-b border-white/30 mb-8">
              <button
                class={`px-6 py-3 font-semibold transition-all duration-300 ${
                  currentPage.value === 1
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                onClick$={() => (currentPage.value = 1)}
              >
                Available ({claimableNfts.value.length})
              </button>
              <button
                class={`px-6 py-3 font-semibold transition-all duration-300 ${
                  currentPage.value === 2
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                onClick$={() => (currentPage.value = 2)}
              >
                Claimed ({claimedNfts.value.length})
              </button>
            </div>

            {/* Claimable NFTs Grid */}
            {currentPage.value === 1 && (
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {claimableNfts.value.length > 0 ? (
                  claimableNfts.value.map((nft) => (
                    <div
                      key={nft.id}
                      class="group rounded-2xl overflow-hidden backdrop-blur-md bg-white/40 border border-white/50 hover:border-green-400/50 hover:bg-white/60 hover:shadow-2xl transition-all duration-300 cursor-pointer hover:-translate-y-1"
                    >
                      <div class="relative aspect-square overflow-hidden bg-linear-to-br from-gray-100 to-gray-50">
                        <img
                          src={nft.image}
                          alt={nft.name}
                          height={400}
                          width={400}
                          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div class="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                      <div class="p-5">
                        <h3 class="font-bold text-lg text-gray-900 truncate">
                          {nft.name}
                        </h3>
                        <p class="text-sm text-green-600 truncate font-medium mt-1">
                          {nft.collection}
                        </p>
                        <p class="text-xs text-gray-700 mt-3">Ready to claim</p>
                        <button
                          class="w-full mt-3 px-4 py-2 backdrop-blur-md bg-linear-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:shadow-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-300 font-semibold text-sm"
                          onClick$={() => {
                            claimableNfts.value = claimableNfts.value.filter(
                              (n) => n.id !== nft.id,
                            );
                            claimedNfts.value = [...claimedNfts.value, nft];
                          }}
                        >
                          ✓ Claim NFT
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div class="col-span-full text-center py-12">
                    <p class="text-gray-600 text-lg">
                      No NFTs available to claim
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Claimed NFTs Grid */}
            {currentPage.value === 2 && (
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {claimedNfts.value.length > 0 ? (
                  claimedNfts.value.map((nft) => (
                    <div
                      key={nft.id}
                      class="group rounded-2xl overflow-hidden backdrop-blur-md bg-white/40 border border-green-400/50 hover:bg-white/60 hover:shadow-2xl transition-all duration-300"
                    >
                      <div class="relative aspect-square overflow-hidden bg-linear-to-br from-gray-100 to-gray-50">
                        <img
                          src={nft.image}
                          alt={nft.name}
                          height={400}
                          width={400}
                          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div class="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                          ✓ Claimed
                        </div>
                        <div class="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                      <div class="p-5">
                        <h3 class="font-bold text-lg text-gray-900 truncate">
                          {nft.name}
                        </h3>
                        <p class="text-sm text-green-600 truncate font-medium mt-1">
                          {nft.collection}
                        </p>
                        <p class="text-xs text-gray-700 mt-3">In your wallet</p>
                        <button
                          class="w-full mt-3 px-4 py-2 backdrop-blur-md bg-white/40 border border-white/50 text-gray-900 rounded-xl hover:bg-white/60 transition-all duration-300 font-semibold text-sm"
                          onClick$={() => (selectedNft.value = nft)}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div class="col-span-full text-center py-12">
                    <p class="text-gray-600 text-lg">
                      You haven't claimed any NFTs yet
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mint Tab */}
        {activeTab.value === "mint" && (
          <div class="mt-8">
            {/* Mint Header */}
            <div class="rounded-3xl backdrop-blur-xl bg-linear-to-br from-purple-50/60 via-white/40 to-pink-50/60 border border-white/50 shadow-2xl p-8 md:p-12 mb-8">
              <h1 class="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
                ✨ Create Your NFT
              </h1>
              <p class="mt-4 text-gray-700 max-w-lg text-lg">
                Mint unique digital assets on the Xahau sidechain. Define your
                collection, set royalties, and launch your NFT to the world.
              </p>
              <div class="flex flex-wrap gap-3 mt-6">
                <Stat
                  label="NFTs Minted"
                  value={mintedNfts.value.length.toString()}
                />
                <Stat label="Mint Fee" value="0.5 XRP" />
                <Stat label="Max Royalty" value="50%" />
              </div>
            </div>

            {/* Mint Form and Preview */}
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Form Section */}
              <div class="rounded-3xl backdrop-blur-md bg-white/40 border border-white/50 p-8 shadow-xl">
                <h2 class="text-2xl font-bold text-gray-900 mb-6">
                  Mint Details
                </h2>

                {/* Mint Type Tabs */}
                <div class="flex gap-4 border-b border-white/30 mb-8">
                  <button
                    class={`px-4 py-2 font-semibold transition-all duration-300 ${
                      mintFormData.value.nftName === "single" ||
                      !mintFormData.value.nftName
                        ? "text-purple-600 border-b-2 border-purple-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    onClick$={() => {
                      mintFormData.value = {
                        nftName: "single",
                        collectionName: "",
                        description: "",
                        royalty: "5",
                      };
                    }}
                  >
                    Single NFT
                  </button>
                  <button
                    class={`px-4 py-2 font-semibold transition-all duration-300 ${
                      mintFormData.value.nftName === "collection"
                        ? "text-purple-600 border-b-2 border-purple-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    onClick$={() => {
                      mintFormData.value = {
                        nftName: "collection",
                        collectionName: "",
                        description: "",
                        royalty: "5",
                      };
                    }}
                  >
                    Collection
                  </button>
                </div>

                {/* Single NFT Form */}
                {mintFormData.value.nftName !== "collection" && (
                  <div class="space-y-6">
                    {/* NFT Name */}
                    <div>
                      <label class="block text-sm font-semibold text-gray-900 mb-2">
                        NFT Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Xahau Legends #001"
                        class="w-full rounded-xl backdrop-blur-md bg-white/40 border border-white/60 px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white/60 transition-all duration-300"
                        value={
                          mintFormData.value.nftName === "single"
                            ? ""
                            : mintFormData.value.nftName
                        }
                        onInput$={(e) =>
                          (mintFormData.value.nftName = (
                            e.target as HTMLInputElement
                          ).value)
                        }
                      />
                    </div>

                    {/* Collection Name */}
                    <div>
                      <label class="block text-sm font-semibold text-gray-900 mb-2">
                        Collection Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Xahau Legends"
                        class="w-full rounded-xl backdrop-blur-md bg-white/40 border border-white/60 px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white/60 transition-all duration-300"
                        value={mintFormData.value.collectionName}
                        onInput$={(e) =>
                          (mintFormData.value.collectionName = (
                            e.target as HTMLInputElement
                          ).value)
                        }
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label class="block text-sm font-semibold text-gray-900 mb-2">
                        Description
                      </label>
                      <textarea
                        placeholder="Describe your NFT..."
                        class="w-full rounded-xl backdrop-blur-md bg-white/40 border border-white/60 px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white/60 transition-all duration-300 resize-none h-24"
                        value={mintFormData.value.description}
                        onInput$={(e) =>
                          (mintFormData.value.description = (
                            e.target as HTMLTextAreaElement
                          ).value)
                        }
                      />
                    </div>

                    {/* Image Upload */}
                    <div>
                      <label class="block text-sm font-semibold text-gray-900 mb-2">
                        Image URL
                      </label>
                      <input
                        type="text"
                        placeholder="https://..."
                        class="w-full rounded-xl backdrop-blur-md bg-white/40 border border-white/60 px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white/60 transition-all duration-300"
                        value={previewImage.value}
                        onInput$={(e) =>
                          (previewImage.value = (
                            e.target as HTMLInputElement
                          ).value)
                        }
                      />
                    </div>

                    {/* Royalty */}
                    <div>
                      <label class="block text-sm font-semibold text-gray-900 mb-2">
                        Royalty Percentage: {mintFormData.value.royalty}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={mintFormData.value.royalty}
                        onInput$={(e) =>
                          (mintFormData.value.royalty = (
                            e.target as HTMLInputElement
                          ).value)
                        }
                        class="w-full h-2 bg-white/30 rounded-lg appearance-none cursor-pointer"
                      />
                      <p class="text-xs text-gray-600 mt-2">
                        You'll earn {mintFormData.value.royalty}% on secondary
                        sales
                      </p>
                    </div>

                    {/* Mint Button */}
                    <button
                      class="w-full mt-6 px-6 py-3 backdrop-blur-md bg-linear-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:shadow-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-300 font-semibold"
                      onClick$={() => {
                        if (
                          mintFormData.value.nftName &&
                          mintFormData.value.nftName !== "single" &&
                          mintFormData.value.collectionName
                        ) {
                          const newNft: Nft = {
                            id: `MINTED-${mintedNfts.value.length + 1}`,
                            name: mintFormData.value.nftName,
                            image:
                              previewImage.value ||
                              "https://picsum.photos/seed/mint/600/600",
                            collection: mintFormData.value.collectionName,
                            owner: "Your Wallet",
                            price: "0 XRP",
                            lastSale: "Just minted",
                          };
                          mintedNfts.value = [...mintedNfts.value, newNft];
                          mintFormData.value = {
                            nftName: "single",
                            collectionName: "",
                            description: "",
                            royalty: "5",
                          };
                          previewImage.value = "";
                        }
                      }}
                    >
                      🚀 Mint NFT
                    </button>
                  </div>
                )}

                {/* Collection Form */}
                {mintFormData.value.nftName === "collection" && (
                  <div class="space-y-6">
                    {/* Collection Name */}
                    <div>
                      <label class="block text-sm font-semibold text-gray-900 mb-2">
                        Collection Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Xahau Legends"
                        class="w-full rounded-xl backdrop-blur-md bg-white/40 border border-white/60 px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white/60 transition-all duration-300"
                        value={mintFormData.value.collectionName}
                        onInput$={(e) =>
                          (mintFormData.value.collectionName = (
                            e.target as HTMLInputElement
                          ).value)
                        }
                      />
                    </div>

                    {/* Collection Description */}
                    <div>
                      <label class="block text-sm font-semibold text-gray-900 mb-2">
                        Collection Description
                      </label>
                      <textarea
                        placeholder="Describe your collection..."
                        class="w-full rounded-xl backdrop-blur-md bg-white/40 border border-white/60 px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white/60 transition-all duration-300 resize-none h-24"
                        value={mintFormData.value.description}
                        onInput$={(e) =>
                          (mintFormData.value.description = (
                            e.target as HTMLTextAreaElement
                          ).value)
                        }
                      />
                    </div>

                    {/* Collection Image Upload */}
                    <div>
                      <label class="block text-sm font-semibold text-gray-900 mb-2">
                        Collection Image URL
                      </label>
                      <input
                        type="text"
                        placeholder="https://..."
                        class="w-full rounded-xl backdrop-blur-md bg-white/40 border border-white/60 px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white/60 transition-all duration-300"
                        value={previewImage.value}
                        onInput$={(e) =>
                          (previewImage.value = (
                            e.target as HTMLInputElement
                          ).value)
                        }
                      />
                    </div>

                    {/* File Upload for Multiple NFTs */}
                    <div>
                      <label class="block text-sm font-semibold text-gray-900 mb-2">
                        Upload NFT Files (CSV or JSON)
                      </label>
                      <div class="relative">
                        <input
                          type="file"
                          accept=".csv,.json"
                          class="w-full rounded-xl backdrop-blur-md bg-white/40 border border-white/60 px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white/60 transition-all duration-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                          multiple
                        />
                      </div>
                      <p class="text-xs text-gray-600 mt-2">
                        Upload a CSV or JSON file containing NFT details (name,
                        description, image URL)
                      </p>
                    </div>

                    {/* Royalty */}
                    <div>
                      <label class="block text-sm font-semibold text-gray-900 mb-2">
                        Royalty Percentage: {mintFormData.value.royalty}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={mintFormData.value.royalty}
                        onInput$={(e) =>
                          (mintFormData.value.royalty = (
                            e.target as HTMLInputElement
                          ).value)
                        }
                        class="w-full h-2 bg-white/30 rounded-lg appearance-none cursor-pointer"
                      />
                      <p class="text-xs text-gray-600 mt-2">
                        You'll earn {mintFormData.value.royalty}% on secondary
                        sales
                      </p>
                    </div>

                    {/* Create Collection Button */}
                    <button
                      class="w-full mt-6 px-6 py-3 backdrop-blur-md bg-linear-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:shadow-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-300 font-semibold"
                      onClick$={() => {
                        if (mintFormData.value.collectionName) {
                          const newNft: Nft = {
                            id: `COLLECTION-${mintedNfts.value.length + 1}`,
                            name: `${mintFormData.value.collectionName} Collection`,
                            image:
                              previewImage.value ||
                              "https://picsum.photos/seed/collection/600/600",
                            collection: mintFormData.value.collectionName,
                            owner: "Your Wallet",
                            price: "0 XRP",
                            lastSale: "Just created",
                          };
                          mintedNfts.value = [...mintedNfts.value, newNft];
                          mintFormData.value = {
                            nftName: "single",
                            collectionName: "",
                            description: "",
                            royalty: "5",
                          };
                          previewImage.value = "";
                        }
                      }}
                    >
                      🎨 Create Collection
                    </button>
                  </div>
                )}
              </div>

              {/* Preview Section */}
              <div class="space-y-6">
                <div class="rounded-3xl backdrop-blur-md bg-white/40 border border-white/50 p-8 shadow-xl">
                  <h2 class="text-2xl font-bold text-gray-900 mb-6">Preview</h2>

                  {/* Preview Card */}
                  <div class="rounded-2xl overflow-hidden backdrop-blur-md bg-white/40 border border-white/50 hover:shadow-2xl transition-all duration-300">
                    <div class="relative aspect-square overflow-hidden bg-linear-to-br from-gray-100 to-gray-50">
                      <img
                        src={
                          previewImage.value ||
                          "https://picsum.photos/seed/placeholder/600/600"
                        }
                        alt="NFT Preview"
                        height={400}
                        width={400}
                        class="w-full h-full object-cover"
                      />
                    </div>
                    <div class="p-5">
                      <h3 class="font-bold text-lg text-gray-900 truncate">
                        {mintFormData.value.nftName || "NFT Name"}
                      </h3>
                      <p class="text-sm text-purple-600 truncate font-medium mt-1">
                        {mintFormData.value.collectionName || "Collection Name"}
                      </p>
                      <p class="text-xs text-gray-700 mt-3 line-clamp-2">
                        {mintFormData.value.description ||
                          "Your NFT description will appear here"}
                      </p>
                      <div class="mt-4 pt-4 border-t border-white/30">
                        <p class="text-xs text-gray-600">
                          <span class="font-semibold">Royalty:</span>{" "}
                          {mintFormData.value.royalty}%
                        </p>
                        <p class="text-xs text-gray-600 mt-1">
                          <span class="font-semibold">Status:</span> Ready to
                          mint
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Minted NFTs List */}
                {mintedNfts.value.length > 0 && (
                  <div class="rounded-3xl backdrop-blur-md bg-white/40 border border-white/50 p-8 shadow-xl">
                    <h2 class="text-2xl font-bold text-gray-900 mb-6">
                      Your Minted NFTs ({mintedNfts.value.length})
                    </h2>
                    <div class="space-y-3 max-h-96 overflow-y-auto">
                      {mintedNfts.value.map((nft) => (
                        <div
                          key={nft.id}
                          class="flex items-center gap-3 p-3 rounded-xl bg-white/20 hover:bg-white/40 transition-all duration-200 cursor-pointer"
                          onClick$={() => (selectedNft.value = nft)}
                        >
                          <img
                            src={nft.image}
                            class="w-12 h-12 rounded-lg object-cover"
                            height={50}
                            width={50}
                            loading="lazy"
                          />
                          <div class="flex-1 min-w-0">
                            <p class="font-semibold text-sm text-gray-900 truncate">
                              {nft.name}
                            </p>
                            <p class="text-xs text-purple-600">
                              {nft.collection}
                            </p>
                          </div>
                          <div class="text-right">
                            <p class="text-xs text-gray-600 font-semibold">
                              ✓ Minted
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* NFT Modal */}
      {selectedNft.value && (
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div class="backdrop-blur-xl bg-white/80 rounded-3xl p-8 w-11/12 max-w-2xl relative border border-white/60 shadow-2xl">
            <button
              class="absolute top-4 right-4 text-gray-500 hover:text-gray-900 text-2xl transition-colors duration-200"
              onClick$={() => (selectedNft.value = null)}
            >
              ✕
            </button>
            <div class="rounded-2xl overflow-hidden mb-6 border border-white/40">
              <img
                src={selectedNft.value.image}
                alt={selectedNft.value.name}
                height={400}
                width={400}
                class="w-full h-auto object-cover"
              />
            </div>
            <h2 class="text-3xl font-bold mb-2 text-gray-900">
              {selectedNft.value.name}
            </h2>
            <p class="text-lg text-blue-600 mb-4 font-semibold">
              {selectedNft.value.collection}
            </p>
            <div class="space-y-2 mb-6 bg-white/30 backdrop-blur-sm rounded-xl p-4 border border-white/40">
              <p class="text-sm text-gray-700">
                <span class="font-semibold text-gray-900">Owner:</span>{" "}
                {selectedNft.value.owner}
              </p>
              <p class="text-sm text-gray-700">
                <span class="font-semibold text-gray-900">Price:</span>{" "}
                {selectedNft.value.price}
              </p>
              <p class="text-sm text-gray-700">
                <span class="font-semibold text-gray-900">Last Sale:</span>{" "}
                {selectedNft.value.lastSale}
              </p>
            </div>
            <div class="flex gap-3">
              <button class="flex-1 px-4 py-3 backdrop-blur-md bg-linear-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:shadow-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 font-semibold">
                Buy
              </button>
              <button class="flex-1 px-4 py-3 backdrop-blur-md bg-white/40 border border-white/50 text-gray-900 rounded-xl hover:bg-white/60 transition-all duration-300 font-semibold">
                Make Offer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

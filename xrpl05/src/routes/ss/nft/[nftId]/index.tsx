import {
  component$,
  $,
  useOnDocument,
  useTask$,
  useSignal,
} from "@builder.io/qwik";
import {
  useLocation,
  useNavigate,
  routeLoader$,
  type DocumentHead,
} from "@builder.io/qwik-city";
import {
  LuX,
  LuHeart,
  LuArrowUpRight,
  LuWallet,
  LuChevronDown,
} from "@qwikest/icons/lucide";
import type { NftItem } from "~/lib/marketplace-data";

const FALLBACK_IMG = "https://placehold.co/400x400/eeeeee/999999?text=NFT";

// Define a type for the API response
interface NftApiResponse {
  nfts: NftItem[];
}

export const useNftDetails = routeLoader$(
  async ({ params, platform, fail }) => {
    const nftId = params.nftId;
    if (!nftId) {
      // Correct usage of fail with an object
      throw fail(404, { error: "NFT ID not provided" });
    }

    // Safely access environment variables
    const apiUrl = platform?.env?.PUBLIC_API_URL;
    if (!apiUrl) {
      throw fail(500, {
        error: "Server configuration error: API URL not set.",
      });
    }

    try {
      const response = await fetch(
        `${apiUrl}/api/global-marketplace?nftId=${nftId}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch NFT: ${response.statusText}`);
      }
      // Type the response data
      const data: NftApiResponse = await response.json();
      if (!data.nfts || data.nfts.length === 0) {
        throw fail(404, { error: "NFT not found" });
      }
      return data.nfts[0] as NftItem;
    } catch (error: any) {
      console.error("Error fetching NFT details:", error);
      throw fail(500, {
        error: error.message || "Failed to load NFT details.",
      });
    }
  },
);

export default component$(() => {
  const nftDetails = useNftDetails();
  const nav = useNavigate();
  const loc = useLocation();
  const showDropdown = useSignal(false);

  const closeModal = $(() => {
    // Check if we can go back in history. If not, navigate to a safe default.
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // Correct usage of nav with replaceState
      nav("/ss", { replaceState: true });
    }
  });

  useOnDocument(
    "keydown",
    $((event) => {
      if ((event as KeyboardEvent).key === "Escape") {
        closeModal();
      }
    }),
  );

  // Prevent scrolling on the body when modal is open
  useTask$(({ cleanup }) => {
    document.body.style.overflow = "hidden";
    cleanup(() => {
      document.body.style.overflow = "auto";
    });
  });

  const formatPrice = (offers: any[]) => {
    if (!offers || offers.length === 0) return "Not Listed";
    const amount = offers[0].amount;
    if (typeof amount === "string") {
      return (Number(amount) / 1000000).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      });
    }
    return amount.value || "N/A";
  };

  const handleExternalLink = $((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  });

  if (nftDetails.value.error) {
    return (
      <div class="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
        <div class="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
          <button
            onClick$={closeModal}
            class="absolute top-4 right-4 text-gray-500 hover:text-gray-900 z-10 bg-gray-100 rounded-full p-2 transition-colors"
          >
            <LuX class="w-6 h-6" />
          </button>
          <h2 class="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p class="text-gray-700">{nftDetails.value.error}</p>
        </div>
      </div>
    );
  }

  const nft = nftDetails.value;

  return (
    <div
      class="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4 sm:p-6 md:p-8"
      onClick$={(e) => {
        // Close modal if backdrop is clicked
        if (e.target === e.currentTarget) {
          closeModal();
        }
      }}
    >
      <div class="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row">
        {/* Close Button */}
        <button
          onClick$={closeModal}
          class="absolute top-4 right-4 text-gray-500 hover:text-gray-900 z-10 bg-gray-100 rounded-full p-2 transition-colors"
        >
          <LuX class="w-6 h-6" />
        </button>

        {/* Image Section */}
        <div class="md:w-1/2 shrink-0 bg-gray-100 flex items-center justify-center p-4">
          <img
            src={nft.image || FALLBACK_IMG}
            alt={nft.name}
            class="max-h-full max-w-full object-contain rounded-xl shadow-lg"
            width={500}
            height={500}
            onError$={(e) => {
              (e.target as HTMLImageElement).src = FALLBACK_IMG;
            }}
          />
        </div>

        {/* Details Section */}
        <div class="md:w-1/2 p-6 md:p-8 flex flex-col overflow-y-auto grow">
          <h2 class="text-3xl font-extrabold text-gray-900 mb-2">{nft.name}</h2>
          <p class="text-lg text-gray-600 mb-4">{nft.collection}</p>

          <div class="flex items-center gap-4 text-sm text-gray-700 mb-6">
            <span class="flex items-center gap-1.5 font-medium">
              <span class="w-5 h-5 rounded-full bg-linear-to-tr from-purple-500 to-pink-500 inline-block shrink-0" />
              Issuer: {nft.issuer.slice(0, 6)}...{nft.issuer.slice(-4)}
            </span>
            <span class="w-1.5 h-1.5 rounded-full bg-gray-300" />
            <span class="font-medium">
              Owner: {nft.owner.slice(0, 6)}...{nft.owner.slice(-4)}
            </span>
          </div>

          <div class="bg-gray-50 p-4 rounded-xl mb-6 border border-gray-100">
            <p class="text-xs uppercase font-bold text-gray-500 mb-2">
              Current Price
            </p>
            <p class="text-2xl font-black text-blue-600">
              {formatPrice(nft.sellOffers)} <span class="text-xl">XRP</span>
            </p>
          </div>

          {nft.description && (
            <div class="mb-6">
              <h3 class="font-bold text-gray-800 mb-2">Description</h3>
              <p class="text-gray-700 text-sm leading-relaxed">
                {nft.description}
              </p>
            </div>
          )}

          <div class="flex gap-3 mb-6">
            <button class="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg">
              <LuWallet class="w-5 h-5" /> Buy Now
            </button>
            <button class="w-12 h-12 flex items-center justify-center rounded-xl bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-colors shadow-sm">
              <LuHeart class="w-5 h-5" />
            </button>
          </div>

          {/* More Details / External Links Dropdown */}
          <div class="relative">
            <button
              onClick$={() => (showDropdown.value = !showDropdown.value)}
              class="w-full flex items-center justify-between px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-800 font-bold hover:bg-gray-200 transition-colors shadow-sm"
            >
              More Details
              <LuChevronDown
                class={[
                  "w-5 h-5 transition-transform",
                  showDropdown.value ? "rotate-180" : "",
                ]}
              />
            </button>

            {showDropdown.value && (
              <div class="absolute bottom-full mb-2 left-0 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-10">
                <ul class="space-y-2">
                  <li>
                    <button
                      onClick$={() =>
                        handleExternalLink(
                          `https://bithomp.com/explorer/${nft.nftokenId}`,
                        )
                      }
                      class="flex items-center gap-2 text-gray-700 hover:text-blue-600 text-sm font-medium w-full text-left p-2 rounded-lg hover:bg-gray-50"
                    >
                      View on Bithomp <LuArrowUpRight class="w-4 h-4 ml-auto" />
                    </button>
                  </li>
                  <li>
                    <button
                      onClick$={() =>
                        handleExternalLink(
                          `https://xrpl.org/nft-explorer.html?nftid=${nft.nftokenId}`,
                        )
                      }
                      class="flex items-center gap-2 text-gray-700 hover:text-blue-600 text-sm font-medium w-full text-left p-2 rounded-lg hover:bg-gray-50"
                    >
                      View on XRPL Explorer{" "}
                      <LuArrowUpRight class="w-4 h-4 ml-auto" />
                    </button>
                  </li>
                  {nft.resolvedUri && (
                    <li>
                      <button
                        onClick$={() => handleExternalLink(nft.resolvedUri)}
                        class="flex items-center gap-2 text-gray-700 hover:text-blue-600 text-sm font-medium w-full text-left p-2 rounded-lg hover:bg-gray-50"
                      >
                        View Metadata URI{" "}
                        <LuArrowUpRight class="w-4 h-4 ml-auto" />
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const nft = resolveValue(useNftDetails);
  return {
    title: nft?.name ? `${nft.name} | NFT Details` : "NFT Details",
    meta: [
      {
        name: "description",
        content:
          nft?.description || "Details for an NFT on the XRPL marketplace.",
      },
    ],
  };
};

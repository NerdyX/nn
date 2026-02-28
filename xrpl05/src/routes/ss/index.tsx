import {
  component$,
  useSignal,
  useVisibleTask$,
  useTask$,
  $,
} from "@builder.io/qwik";
import { DocumentHead, Link } from "@builder.io/qwik-city";
import { LuHeart, LuChevronLeft, LuChevronRight } from "@qwikest/icons/lucide";
import { useNetworkContext } from "~/context/network-context";
import { useWalletContext } from "~/context/wallet-context";
import type { NftItem } from "~/lib/marketplace-data";
import { networkActions } from "~/lib/store/network";

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

// ─── Hero Slider ─────────────────────────────────────────────────────────────
export const HeroSlider = component$<{ slides: NftItem[] }>(({ slides }) => {
  const current = useSignal(0);
  const total = slides.length;

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => total);
    if (total <= 1) return;
    const id = setInterval(() => {
      current.value = (current.value + 1) % total;
    }, 5000);
    return () => clearInterval(id);
  });

  const prev = $(() => {
    current.value = (current.value - 1 + total) % total;
  });
  const next = $(() => {
    current.value = (current.value + 1) % total;
  });

  return (
    <section class="relative h-105 md:h-125 overflow-hidden">
      {/* Slides */}
      {slides.map((slide, i) => (
        <div
          key={slide.nftokenId}
          class={[
            "absolute inset-0 transition-opacity duration-700",
            i === current.value ? "opacity-100 z-10" : "opacity-0 z-0",
          ].join(" ")}
        >
          <img
            src={slide.image || FALLBACK_IMG}
            alt={slide.name}
            class="w-full h-full object-cover"
            loading="lazy"
            onError$={(e) => {
              (e.target as HTMLImageElement).src = FALLBACK_IMG;
            }}
          />
          {/* Dark gradient overlay */}
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* Content Box */}
          <div class="absolute bottom-8 left-8 right-8 md:bottom-12 md:left-12 max-w-2xl text-white">
            <span class="inline-block px-3 py-1 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-xs font-bold tracking-wider uppercase mb-3 shadow-sm">
              Featured
            </span>
            <h2 class="text-3xl md:text-5xl font-extrabold tracking-tight mb-2 drop-shadow-md">
              {slide.name}
            </h2>
            <div class="flex items-center gap-4 text-sm font-medium opacity-90 mb-6 drop-shadow">
              <span class="flex items-center gap-1.5">
                <div class="w-6 h-6 rounded-full bg-gradient-to-tr from-pink-500 to-violet-500 border border-white/50" />
                {slide.issuer.slice(0, 8)}...
              </span>
              <span class="w-1.5 h-1.5 rounded-full bg-white/50" />
              <span>{formatPrice(slide.sellOffers)}</span>
            </div>

            <div class="flex items-center gap-4">
              <button class="px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-100 transition-colors shadow-lg shadow-white/10">
                View Asset
              </button>
              <button class="w-12 h-12 flex items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all shadow-lg">
                <LuHeart class="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Arrow Controls */}
      <div class="absolute bottom-8 right-8 z-20 hidden md:flex gap-3">
        <button
          onClick$={prev}
          class="w-12 h-12 flex items-center justify-center rounded-full bg-black/40 backdrop-blur border border-white/20 text-white hover:bg-black/60 transition"
        >
          <LuChevronLeft class="w-6 h-6" />
        </button>
        <button
          onClick$={next}
          class="w-12 h-12 flex items-center justify-center rounded-full bg-black/40 backdrop-blur border border-white/20 text-white hover:bg-black/60 transition"
        >
          <LuChevronRight class="w-6 h-6" />
        </button>
      </div>
    </section>
  );
});

// ─── Horizontal Carousel ─────────────────────────────────────────────────────
export const HorizontalCarousel = component$<{
  title: string;
  items: NftItem[];
}>(({ title, items }) => {
  const scrollRef = useSignal<HTMLDivElement>();

  const scroll = $((direction: "left" | "right") => {
    if (!scrollRef.value) return;
    const amount = direction === "left" ? -400 : 400;
    scrollRef.value.scrollBy({ left: amount, behavior: "smooth" });
  });

  return (
    <section class="py-12 bg-transparent relative overflow-hidden">
      <div class="max-w-screen-2xl mx-auto px-4 md:px-8">
        <div class="flex items-center justify-between mb-8">
          <h2 class="text-2xl font-extrabold text-gray-900 tracking-tight">
            {title}
          </h2>
          <div class="flex gap-2">
            <button
              onClick$={() => scroll("left")}
              class="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm transition"
            >
              <LuChevronLeft class="w-5 h-5" />
            </button>
            <button
              onClick$={() => scroll("right")}
              class="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm transition"
            >
              <LuChevronRight class="w-5 h-5" />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          class="flex gap-6 overflow-x-auto pb-6 scrollbar-hide snap-x snap-mandatory"
        >
          {items.map((nft, i) => (
            <div key={nft.nftokenId} class="snap-start shrink-0">
              <NFTCard nft={nft} rank={i + 1} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

// ─── NFT Card ────────────────────────────────────────────────────────────────
export const NFTCard = component$<{ nft: NftItem; rank?: number }>((props) => {
  const { nft, rank } = props;
  return (
    <Link href={`/search?address=${nft.owner}`}>
      <div class="group relative w-64 bg-white rounded-2xl p-3 shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer">
        <div class="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-100">
          <img
            width={128}
            height={128}
            src={nft.image || FALLBACK_IMG}
            alt={nft.name}
            loading="lazy"
            onError$={(e) => {
              (e.target as HTMLImageElement).src = FALLBACK_IMG;
            }}
            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Overlay Gradient for contrast */}
          <div class="absolute inset-0 bg-gradient-to-b from-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Quick Actions overlay */}
          <div class="absolute bottom-3 right-3 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            <button class="bg-white/90 backdrop-blur text-black text-xs font-bold px-4 py-2 rounded-full shadow-lg hover:bg-white">
              View Info
            </button>
          </div>

          {/* Rank badge */}
          {rank && (
            <span class="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/20">
              #{rank}
            </span>
          )}
          {/* Heart */}
          <button class="absolute top-3 right-3 p-2 rounded-full bg-black/20 backdrop-blur hover:bg-black/40 text-white transition-colors">
            <LuHeart class="w-4 h-4" />
          </button>
        </div>

        <div class="mt-4 px-1">
          <h3 class="font-bold text-gray-900 truncate tracking-tight text-base">
            {nft.name}
          </h3>
          <p class="text-sm text-gray-500 font-medium truncate mt-0.5 flex items-center gap-1.5">
            <span class="w-4 h-4 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-500 inline-block shrink-0" />
            {nft.issuer.slice(0, 8)}...
          </p>

          <div class="mt-4 flex items-center justify-between">
            <div>
              <p class="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-0.5">
                Price
              </p>
              <p class="text-sm font-extrabold text-blue-600">
                {formatPrice(nft.sellOffers)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
});

// ─── Page ─────────────────────────────────────────────────────────────────────
export default component$(() => {
  const networkCtx = useNetworkContext();
  const walletCtx = useWalletContext();
  const loading = useSignal(true);
  const slides = useSignal<NftItem[]>([]);
  const sellers = useSignal<NftItem[]>([]);
  const trending = useSignal<NftItem[]>([]);

  useTask$(({ track }) => {
    const net = track(() => networkCtx.activeNetwork.value);

    // Ensure wallet network aligns (simple logic can be expanded)
    if (walletCtx.connected.value && walletCtx.walletType.value) {
      // check if connected to right network, handle mismatch if needed
    }

    loading.value = true;
    fetch(`/api/global-marketplace?network=${net}&limit=20`)
      .then((res) => res.json())
      .then((data: any) => {
        const nfts = data.nfts || [];
        slides.value = nfts.slice(0, 4);
        sellers.value = nfts.slice(4, 12);
        trending.value = nfts.slice(12, 20);
        loading.value = false;
      })
      .catch(() => {
        loading.value = false;
      });
  });

  return (
    <div class="min-h-screen mt-16 flex flex-col bg-gray-50">
      <div class="flex justify-between items-center px-4 md:px-8 py-4 bg-white border-b border-gray-100 shadow-sm">
        <h1 class="text-xl font-bold tracking-tight text-gray-900 hidden md:block">
          Marketplace
        </h1>
        {/* Dual Network Toggle */}
        <div class="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl shadow-inner border border-gray-200">
          <button
            onClick$={() => {
              networkActions.setActiveNetwork("xrpl");
            }}
            class={[
              "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
              networkCtx.activeNetwork.value === "xrpl"
                ? "bg-white border border-gray-200 shadow-sm ring-1 ring-blue-500/20"
                : "hover:bg-gray-100",
            ].join(" ")}
            title="XRPL Network"
          >
            {}
            {/* eslint-disable-next-line qwik/jsx-img */}
            <img
              src="/public/icons/xrpl.png"
              alt="XRPL"
              width={24}
              height={24}
              class={
                networkCtx.activeNetwork.value === "xrpl"
                  ? ""
                  : "grayscale opacity-50"
              }
            />
          </button>
          <button
            onClick$={() => {
              networkActions.setActiveNetwork("xahau");
            }}
            class={[
              "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
              networkCtx.activeNetwork.value === "xahau"
                ? "bg-white border border-gray-200 shadow-sm ring-1 ring-yellow-500/20"
                : "hover:bg-gray-100",
            ].join(" ")}
            title="Xahau Network"
          >
            {}
            {/* eslint-disable-next-line qwik/jsx-img */}
            <img
              src="/public/icons/xaman.png"
              alt="Xahau"
              width={24}
              height={24}
              class={
                networkCtx.activeNetwork.value === "xahau"
                  ? ""
                  : "grayscale opacity-50"
              }
            />
          </button>
        </div>
      </div>

      {loading.value ? (
        <div class="flex justify-center items-center py-20 min-h-[50vh]">
          <div class="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p class="mt-4 text-gray-500 ml-3 font-medium">
            Loading live ledger data...
          </p>
        </div>
      ) : (
        <>
          {slides.value.length > 0 && <HeroSlider slides={slides.value} />}

          {sellers.value.length > 0 && (
            <HorizontalCarousel title="🔥 Top Listings" items={sellers.value} />
          )}

          <div class="mx-4 md:mx-8 border-t border-gray-200" />

          {trending.value.length > 0 && (
            <HorizontalCarousel
              title="✨ Trending NFTs"
              items={trending.value}
            />
          )}
        </>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "Marketplace | {XRPL}OS",
  meta: [
    {
      name: "description",
      content: "Explore NFTs and tokens on the XRP Ledger and Xahau networks.",
    },
  ],
};

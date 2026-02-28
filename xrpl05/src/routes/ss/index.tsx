import {
  component$,
  useSignal,
  useVisibleTask$,
  $,
  Slot,
} from "@builder.io/qwik";
import { DocumentHead, Link } from "@builder.io/qwik-city";
import { LuHeart, LuChevronLeft, LuChevronRight } from "@qwikest/icons/lucide";

interface NFT {
  id: number;
  image: string;
  title: string;
  creator: string;
  price: number;
  likes: number;
}

interface Collection {
  id: number;
  image: string;
  name: string;
  floorPrice: number;
  volume: number;
  items: number;
}

// Hero / Featured slides
const featuredSlides: NFT[] = [
  {
    id: 1,
    image: "https://source.unsplash.com/random/1600x900?sig=feat1&nft",
    title: "Dreamscape #001",
    creator: "ArtistAlpha",
    price: 12.5,
    likes: 340,
  },
  {
    id: 2,
    image: "https://source.unsplash.com/random/1600x900?sig=feat2&digital+art",
    title: "Neon Genesis",
    creator: "CyberMuse",
    price: 8.8,
    likes: 212,
  },
  {
    id: 3,
    image: "https://source.unsplash.com/random/1600x900?sig=feat3&abstract",
    title: "Void Walker",
    creator: "GalacticInk",
    price: 22.0,
    likes: 587,
  },
  {
    id: 4,
    image: "https://source.unsplash.com/random/1600x900?sig=feat4&cyberpunk",
    title: "Pixel Deity",
    creator: "DesignerEpsilon",
    price: 5.0,
    likes: 160,
  },
];

// Top Sellers
const topSellers: NFT[] = [
  {
    id: 1,
    image: "https://source.unsplash.com/random/300x300?sig=ts1&art",
    title: "Dreamscape",
    creator: "ArtistAlpha",
    price: 2.5,
    likes: 340,
  },
  {
    id: 2,
    image: "https://source.unsplash.com/random/300x300?sig=ts2&music",
    title: "CryptoBeat",
    creator: "MusicianBeta",
    price: 1.8,
    likes: 212,
  },
  {
    id: 3,
    image: "https://source.unsplash.com/random/300x300?sig=ts3&pixel",
    title: "Pixel Pals",
    creator: "CreatorGamma",
    price: 0.75,
    likes: 140,
  },
  {
    id: 4,
    image: "https://source.unsplash.com/random/300x300?sig=ts4&rare",
    title: "RareVibes",
    creator: "ArtistDelta",
    price: 3.2,
    likes: 450,
  },
  {
    id: 5,
    image: "https://source.unsplash.com/random/300x300?sig=ts5&meta",
    title: "MetaMask",
    creator: "DesignerEpsilon",
    price: 5.0,
    likes: 600,
  },
  {
    id: 6,
    image: "https://source.unsplash.com/random/300x300?sig=ts6&neon",
    title: "Neon Night",
    creator: "ArtistZeta",
    price: 1.2,
    likes: 180,
  },
  {
    id: 7,
    image: "https://source.unsplash.com/random/300x300?sig=ts7&sound",
    title: "Harmony",
    creator: "MusicianEta",
    price: 0.9,
    likes: 250,
  },
  {
    id: 8,
    image: "https://source.unsplash.com/random/300x300?sig=ts8&block",
    title: "Block Busters",
    creator: "CreatorTheta",
    price: 2.3,
    likes: 400,
  },
];

// Top Collections
const topCollections: Collection[] = [
  {
    id: 1,
    image: "https://source.unsplash.com/random/300x300?sig=col1&landscape",
    name: "Cosmic Visions",
    floorPrice: 4.2,
    volume: 1240,
    items: 999,
  },
  {
    id: 2,
    image: "https://source.unsplash.com/random/300x300?sig=col2&space",
    name: "XRP Legends",
    floorPrice: 6.8,
    volume: 3100,
    items: 5000,
  },
  {
    id: 3,
    image: "https://source.unsplash.com/random/300x300?sig=col3&abstract",
    name: "Digital Dreamers",
    floorPrice: 1.5,
    volume: 890,
    items: 1000,
  },
  {
    id: 4,
    image: "https://source.unsplash.com/random/300x300?sig=col4&cyber",
    name: "Neon Punks",
    floorPrice: 9.1,
    volume: 5400,
    items: 3333,
  },
  {
    id: 5,
    image: "https://source.unsplash.com/random/300x300?sig=col5&geometric",
    name: "Void Fragments",
    floorPrice: 2.3,
    volume: 670,
    items: 777,
  },
  {
    id: 6,
    image: "https://source.unsplash.com/random/300x300?sig=col6&texture",
    name: "Silk Protocol",
    floorPrice: 3.7,
    volume: 2100,
    items: 2222,
  },
  {
    id: 7,
    image: "https://source.unsplash.com/random/300x300?sig=col7&minimal",
    name: "Ghost Garden",
    floorPrice: 0.8,
    volume: 430,
    items: 500,
  },
  {
    id: 8,
    image: "https://source.unsplash.com/random/300x300?sig=col8&dark",
    name: "Abyss Club",
    floorPrice: 12.0,
    volume: 8800,
    items: 10000,
  },
];

// ─── Hero Slider ─────────────────────────────────────────────────────────────
export const HeroSlider = component$(() => {
  const current = useSignal(0);
  const total = featuredSlides.length;

  // Auto-advance
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
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
      {featuredSlides.map((slide, i) => (
        <div
          key={slide.id}
          class={[
            "absolute inset-0 transition-opacity duration-700",
            i === current.value ? "opacity-100 z-10" : "opacity-0 z-0",
          ].join(" ")}
        >
          <img
            height={100}
            width={100}
            src={slide.image}
            alt={slide.title}
            class="w-full h-full object-cover"
          />
          {/* Dark gradient overlay */}
          <div class="absolute inset-0 bg-linear-to-t from-black/70 via-black/30 to-transparent" />

          {/* Slide info — bottom left */}
          <div class="absolute bottom-14 left-6 md:left-10 z-20 text-white">
            <p class="text-xs uppercase tracking-widest text-indigo-300 mb-1">
              Featured Drop
            </p>
            <h2 class="text-3xl md:text-4xl font-bold leading-tight">
              {slide.title}
            </h2>
            <p class="text-sm text-gray-300 mt-1">
              by <span class="text-white font-medium">{slide.creator}</span>
            </p>
            <p class="mt-2 text-indigo-300 font-semibold text-lg">
              {slide.price} XRP
            </p>
          </div>
        </div>
      ))}

      {/* Search bar overlay — top center */}
      <div class="absolute top-0 left-0 right-0 z-30 flex flex-col items-center pt-8 px-4 pointer-events-none">
        <h1 class="text-white text-3xl font-bold mb-4 drop-shadow-lg">
          {"{XRPL}"}
          <span class="text-indigo-400">Marketplace</span>
        </h1>
        <div class="flex w-full max-w-xl pointer-events-auto">
          <div class="relative flex-1">
            <input
              type="text"
              placeholder="Search NFTs, collections, creators..."
              class="w-full py-2.5 pl-10 pr-4 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-800 shadow-lg text-sm"
            />
            <svg
              class="absolute right-3 top-3 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Prev / Next arrows */}
      <button
        onClick$={prev}
        class="absolute left-3 top-1/2 -translate-y-1/2 z-30 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 transition backdrop-blur-sm"
        aria-label="Previous slide"
      >
        <LuChevronLeft class="w-5 h-5" />
      </button>
      <button
        onClick$={next}
        class="absolute right-3 top-1/2 -translate-y-1/2 z-30 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 transition backdrop-blur-sm"
        aria-label="Next slide"
      >
        <LuChevronRight class="w-5 h-5" />
      </button>

      {/* Dot indicators — bottom center */}
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-2">
        {featuredSlides.map((_, i) => (
          <button
            key={i}
            onClick$={() => {
              current.value = i;
            }}
            class={[
              "w-2 h-2 rounded-full transition-all",
              i === current.value ? "bg-white w-5" : "bg-white/40",
            ].join(" ")}
          />
        ))}
      </div>

      {/* Browse All pill — bottom right */}
      <div class="absolute bottom-4 right-5 z-30">
        <Link
          href="/ss/browse"
          class="bg-white/10 backdrop-blur-sm border border-white/30 text-white text-sm font-medium px-4 py-1.5 rounded-full hover:bg-white/20 transition"
        >
          Browse All →
        </Link>
      </div>
    </section>
  );
});

export const HorizontalCarousel = component$<{
  title: string;
}>((props) => {
  const scrollRef = useSignal<HTMLDivElement>();

  const scrollLeft = $(() => {
    if (scrollRef.value) {
      scrollRef.value.scrollBy({ left: -320, behavior: "smooth" });
    }
  });

  const scrollRight = $(() => {
    if (scrollRef.value) {
      scrollRef.value.scrollBy({ left: 320, behavior: "smooth" });
    }
  });

  return (
    <section class="px-4 py-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-gray-900">{props.title}</h2>
        <div class="flex gap-2">
          <button
            onClick$={scrollLeft}
            class="bg-gray-100 hover:bg-indigo-100 text-gray-700 rounded-full p-2 transition"
            aria-label="Scroll left"
          >
            <LuChevronLeft class="w-4 h-4" />
          </button>
          <button
            onClick$={scrollRight}
            class="bg-gray-100 hover:bg-indigo-100 text-gray-700 rounded-full p-2 transition"
            aria-label="Scroll right"
          >
            <LuChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        class="flex gap-4 overflow-x-auto pb-2 scroll-smooth"
        style="scrollbar-width: none; -ms-overflow-style: none;"
      >
        <Slot />
      </div>
    </section>
  );
});

// ─── NFT Card ─────────────────────────────────────────────────────────────────
export const NFTCard = component$<{ nft: NFT; rank?: number }>((props) => {
  const { nft, rank } = props;
  return (
    <div class="flex-none w-52 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer">
      <div class="relative">
        <img
          height={100}
          width={100}
          src={nft.image}
          alt={nft.title}
          class="w-full h-44 object-cover"
        />
        {rank && (
          <span class="absolute top-2 left-2 bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            #{rank}
          </span>
        )}
      </div>
      <div class="p-3">
        <h3 class="font-semibold text-sm text-gray-900 truncate">
          {nft.title}
        </h3>
        <p class="text-xs text-gray-400 mt-0.5 truncate">by {nft.creator}</p>
        <div class="mt-2 flex items-center justify-between">
          <span class="text-indigo-600 font-bold text-sm">{nft.price} XRP</span>
          <div class="flex items-center text-gray-400 text-xs">
            <LuHeart class="w-3.5 h-3.5 mr-0.5 text-red-400" /> {nft.likes}
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── Collection Card ──────────────────────────────────────────────────────────
export const CollectionCard = component$<{ col: Collection; rank?: number }>(
  (props) => {
    const { col, rank } = props;
    return (
      <div class="flex-none w-52 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer">
        <div class="relative">
          <img
            height={100}
            width={100}
            src={col.image}
            alt={col.name}
            class="w-full h-44 object-cover"
          />
          {rank && (
            <span class="absolute top-2 left-2 bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              #{rank}
            </span>
          )}
        </div>
        <div class="p-3">
          <h3 class="font-semibold text-sm text-gray-900 truncate">
            {col.name}
          </h3>
          <p class="text-xs text-gray-400 mt-0.5">
            {col.items.toLocaleString()} items
          </p>
          <div class="mt-2 flex items-center justify-between">
            <div>
              <p class="text-xs text-gray-400">Floor</p>
              <p class="text-indigo-600 font-bold text-sm">
                {col.floorPrice} XRP
              </p>
            </div>
            <div class="text-right">
              <p class="text-xs text-gray-400">Volume</p>
              <p class="text-emerald-600 font-bold text-sm">
                {col.volume.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

// ─── Page ─────────────────────────────────────────────────────────────────────
export default component$(() => {
  return (
    <div class="min-h-screen mt-16 flex flex-col bg-gray-50">
      <HeroSlider />

      {/* Top Sellers */}
      <HorizontalCarousel title="🔥 Top Sellers">
        {topSellers.map((nft, i) => (
          <NFTCard key={nft.id} nft={nft} rank={i + 1} />
        ))}
      </HorizontalCarousel>

      <div class="mx-4 border-t border-gray-200" />

      {/* Top Collections */}
      <HorizontalCarousel title="✨ Top Collections">
        {topCollections.map((col, i) => (
          <CollectionCard key={col.id} col={col} rank={i + 1} />
        ))}
      </HorizontalCarousel>
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

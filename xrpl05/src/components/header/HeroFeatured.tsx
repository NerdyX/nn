import { component$ } from "@builder.io/qwik";
type Nft = /*unresolved*/ any;
export const HeroFeatured = component$(({ nft }: { nft: Nft }) => (
  <div class="hero-content">
    <div>
      <h1>Discover the XRPL NFT Economy</h1>
      <p>
        Trending collections, market movers, and record sales across XRPL &
        Xahau.
      </p>
    </div>
    <img src={nft.image} width={420} height={420} />
  </div>
));

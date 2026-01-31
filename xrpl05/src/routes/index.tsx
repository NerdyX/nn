import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

export default component$(() => {
  return (
    <main>
      {/* Hero */}
      <section class="relative w-screen min-h-screen overflow-hidden">
        {/* Video */}

        <video
          id="bg-video"
          class="absolute inset-0 w-full h-full mx-auto object-cover"
          autoplay
          muted
          loop
          playsInline
          preload="metadata"
        >
          <source src="/media/bg_vid.mp4" type="video/mp4" />
        </video>

        {/* Overlay */}
        <div class="absolute inset-0 bg-black/50"></div>

        {/* Content */}
        <div class="relative z-10 flex min-h-screen items-center justify-center text-center px-6">
          <div>
            <h1 class="text-5xl font-bold text-white mb-6">
              The <span class="text-blue-500">Fastest</span>{" "}
              <span class="text-green-500">Safest</span> Terminal <br /> for the
              XRPL &amp; Xahau Network.
            </h1>
            <p class="text-xl text-gray-200 mb-8">
              A sovereign interface for sovereign transactions.
            </p>
          </div>
        </div>
      </section>

      {/* What is XRPL OS */}
      <section class="mb-20 text-center mt-6">
        <div>
          <h2 class="mb-4 text-4xl font-semibold">What is {`{XRPL}`}OS?</h2>
          <p class="mx-auto max-w-3xl text-gray-600">
            {`{XRPL}`}OS is not a wallet, exchange, or explorer. It is a
            transaction execution environment, a terminal-like interface where
            every XRPL and Xahau transaction type is categorized, visualized,
            and executed intentionally.
          </p>
        </div>
      </section>

      {/* Supported Networks */}
      <section class="mb-20 rounded-xl border bg-gray-50 p-10 text-center">
        <h2 class="mb-4 text-3xl font-semibold">Supported Networks</h2>
        <p class="mx-auto max-w-2xl text-gray-600">
          {`{XRPL}`}OS is built specifically for the XRP Ledger ecosystem
        </p>

        <div class="mt-6 flex justify-center gap-6 text-sm font-medium">
          <span>XRPL</span>
          <span>Xahau</span>
          <span>Sologenic</span>
        </div>
      </section>

      {/* Philosophy */}
      <section class="mb-20 text-center">
        <h2 class="mb-4 text-2xl font-semibold">Designed for Sovereignty</h2>
        <p class="mx-auto max-w-3xl text-gray-600">
          Every action in {`{XRPL}`}OS is explicit. Transactions are grouped by
          purpose — Create, Set, Claim, Deposit, Cancel — so users understand
          exactly what they are signing before they sign it. No hidden state. No
          dark UX.
        </p>
      </section>

      {/* Supported Networks */}
      <section class="mb-20 rounded-xl border bg-gray-50 p-10 text-center">
        <h2 class="mb-4 text-2xl font-semibold">Supported Wallets</h2>
        <p class="mx-auto max-w-2xl text-gray-600">
          {`{XRPL}`}OS is built specifically for the XRP Ledger ecosystem —
          including Xahau hooks — and communicates directly with the network
          over WebSockets for low-latency, real-time interaction.
        </p>

        <div class="mt-6 flex justify-center gap-6 text-sm font-medium">
          <span>Xaman</span>
          <span>Joey</span>
          <span>Grin</span>
          <span>Crossmark</span>
        </div>
      </section>
    </main>
  );
});

export const head: DocumentHead = {
  title: "{XRPL}OS",
  meta: [
    {
      name: "The XRP Ledger Operating System",
      content:
        "Built by {NRDX}LABS | Secure web terminal to access the XRP Ledger",
    },
  ],
};

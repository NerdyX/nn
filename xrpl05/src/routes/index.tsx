import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

const data = [
  {
    title: "XRPL",
    description:
      "The XRP Ledger is a decentralized, open-source blockchain designed for fast, low-cost, and energy-efficient transactions. It enables tokenization, decentralized exchange, and payments without intermediaries, using its native digital asset XRP to provide liquidity and facilitate cross-border transfers in seconds.",
  },
  {
    title: "Xahau",
    description:
      "Xahau Network is a Layer 1 blockchain built on the XRP Ledger’s codebase, designed to add smart-contract-like functionality through “Hooks” — small, efficient pieces of on-chain logic that automate account behavior.",
  },
  {
    title: "Sologenic",
    description:
      "Sologenic Network is a Layer 1 blockchain built on the XRP Ledger’s codebase, designed to add smart-contract-like functionality through “Hooks” — small, efficient pieces of on-chain logic that automate account behavior.",
  },
];

export default component$(() => {
  return (
    <div>
      {/* Hero */}
      <section class="relative bg-violet-200 border border-b-gray-400 w-full min-h-screen overflow-hidden">
        {/* Video */}

        <div class="fixed  w-full h-full overflow-hidden">
          {/* Static poster from public/ */}
          {/*<img
            src="/media/bg-poster.jpg"
            class="absolute inset-0 w-full h-full object-cover opacity-100 transition-opacity duration-500"
            data-poster
            alt=""
            loading="eager"
          />*/}

          {/* Video */}
          {/*<video
            id="bg-video"
            class="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-700"
            autoplay
            muted
            loop
            playsInline
            preload="auto"
            fetchPriority="high"
            onLoadedData$={() => {
              const video = document.getElementById(
                "bg-video",
              ) as HTMLVideoElement;
              const poster = document.querySelector(
                "[data-poster]",
              ) as HTMLElement;
              video
                ?.play()
                .then(() => {
                  video.style.opacity = "1";
                  poster.style.opacity = "0";
                })
                .catch(() => {
                  // Video failed - keep Qwik poster visible
                });
            }}
          >
            <source src="/media/bg_vid.mp4" type="video/mp4" />
          </video>}*/}
        </div>

        {/* Overlay */}
        {/*<div class="absolute inset-0 bg-black/50"></div>

        {/* Content */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: "0.5rem",
            zIndex: 0,
          }}
        >
          <h1
            style={{
              color: "black",
              margin: 0,
              lineHeight: 1.1,
              fontSize: "10.0rem",
              fontWeight: "300",
              fontFamily: "'Deco', sans-serif",
            }}
          >
            {"{XRPL}"}OS
          </h1>
          <h2
            class="text-3xl"
            style={{
              color: "black",
              margin: 0,
              fontWeight: 500,
              lineHeight: 1.2,
            }}
          >
            The Multi Ledger Operating System
          </h2>
          <h3
            class="text-center text-black container mx-auto px-6 pt-3 md:px-12 lg:px-20 leading-snug text-lg md:text-xl"
            style={{
              fontFamily: "'Deco', sans-serif",
              fontWeight: 100,
              fontSize: "1.0rem",
              color: "black",
              margin: 0,
              maxWidth: "900px",
            }}
          >
            The {"{XRPL}"}OS is a sovereignty-first platform that redefines how
            users interact with digital finance. Seamlessly connecting the XRP
            Ledger, Flare, and Xahau networks, it empowers individuals and
            businesses to create, manage, and trade digital assets with complete
            control and transparency.
            <br />
            <br />
            <span class="block mt-2">
              Designed for both simplicity and strength, the platform integrates
              enterprise-grade security, intuitive navigation, and real-time
              connectivity across networks, ensuring every transaction is
              efficient, verifiable, and user-owned. Whether you’re issuing
              tokens, exploring DeFi applications, or building on-chain systems,
              the XRPL Operating System provides the foundation for a secure,
              interoperable, and truly decentralized future.
            </span>
          </h3>
        </div>
      </section>

      {/* What is XRPL OS */}
      <section class="mb-20 text-center mt-6">
        <div class="flex flex-col container mx-auto">
          <h1 class="text-4xl sm:text-[80px] text-center">
            Three networks in one platform{" "}
          </h1>
          <div class="flex flex-wrap   justify-center  items-center">
            {data.map((n, index) => {
              return (
                <div key={index} class="flex flex-col max-w-sm p-5">
                  <h1 class="text-[60px] font-mono">{n.title}</h1>
                  <p class="font-extralight text-gray-800">{n.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section class="rounded-xl flex flex-col flex-3 border bg-black p-10 text-center">
        <h2 class="mb-4 text-white text-2xl font-semibold">
          Designed for Sovereignty
        </h2>
        <p class="mx-auto max-w-3xl text-white">
          Every action in {`{XRPL}`}OS is explicit. Transactions are grouped by
          purpose — Create, Set, Claim, Deposit, Cancel — so users understand
          exactly what they are signing before they sign it. No hidden state. No
          dark UX. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
          non risus. <br class="flex flex-row mb-2" />
          Suspendisse lectus tortor, dignissim sit amet, adipiscing nec,
          ultricies sed, dolor. <br class="flex items-wrap" />
          Cras elementum ultrices diam. Maecenas ligula massa, varius a, semper
          congue, euismod non, mi. Proin porttitor, orci nec nonummy molestie,
          enim est eleifend mi, non fermentum diam nisl sit amet erat. Duis
          semper. Duis arcu massa, scelerius et ultrices posuere cubilia Curae;
          Aliquam nibh. Mauris ac mauris sed pede pellentesque fermentum.
          Maecenas adipiscing ante non diam sodales hendrerit. Lorem ipsum dolor
          sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse
          lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed,
          dolor. Cras elementum ultrices diam. Maecenas ligula massa, varius a,
          semper congue, euismod non, mi. Proin porttitor, orci nec nonummy
          molestie, enim est eleifend mi, non fermentum diam nisl sit amet erat.
          Duis semper. Duis arcu massa, scelerisque vitae, consequat in, pretium
          a, enim. Pellentesque congue. Ut in risus volutpat libero pharetra
          tempor. Cras vestibulum bibendum augue. Praesent egestas leo in pede.
          Praesent blandit odio eu enim. Pellentesque sed dui ut augue blandit
          sodales. Vestibulum ante ipsum primis in faucibus orci luctus et
          ultrices posuere cubilia Curae; Aliquam nibh. Mauris ac mauris sed
          pede pellentesque fermentum. Maecenas adipiscing ante non diam sodales
          hendrerit.
          <br class="mt-2" />
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non
          risus. Suspendisse lectus tortor, dignissim sit amet, adipiscing nec,
          ultricies sed, dolor. Cras elementum ultrices diam. Maecenas ligula
          massa, varius a, semper congue, euismod non, mi. Proin porttitor, orci
          nec nonummy molestie, enim est eleifend mi, non fermentum diam nisl
          sit amet erat. Duis semper. Duis arcu massa, scelerisque vitae,
          consequat in, pretium a, enim. Pellentesque congue. Ut in risus
          volutpat libero pharetra tempor. Cras vestibulum bibendum augue.
          Praesent egestas leo in pede. Praesent blandit odio eu enim.
          Pellentesque sed dui ut augue blandit sodales. Vestibulum ante ipsum
          primis in faucibus orci luctus et ultrices posuere cubilia Curae;
          Aliquam nibh. Mauris ac mauris sed pede pellentesque fermentum.
          Maecenas adipiscing ante non diam sodales hendrerit.
        </p>
      </section>

      <div class="sm:pt-10 pl-6 font-spartan grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 border-t gap-12 lg:gap-8 pt-10 lg:pt-12 mb-16">
        <div class="col-span-full lg:col-span-2">
          <div class="lg:-mt-2 mb-4">
            <a
              href="/"
              class="inline-flex items-center text-black-800 text-xl md:text-2xl font-bold gap-2"
              aria-label="logo"
            >
              {"{XRPL}"}OS
            </a>
          </div>

          <p class="text--500 sm:pr-8 mb-6">
            The decentralized operating system is a sovereignty driven platform
            that empowers users to create, manage, and trade digital assets on
            the XRP Ledger, Flare & Xahau networks. With a focus on security,
            transparency, and user-friendly design, providing a seamless
            experience for all participants.
          </p>

          <div class="flex gap-4">
            <a
              href="#"
              target="_blank"
              class="text--400 hover:text--500 active:text--600 transition duration-100"
            >
              <svg
                class="w-5 h-5"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>

            <a
              href="#"
              target="_blank"
              class="text--400 hover:text--500 active:text--600 transition duration-100"
            >
              <svg
                class="w-5 h-5"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
              </svg>
            </a>

            <a
              href="#"
              target="_blank"
              class="text--400 hover:text--500 active:text--600 transition duration-100"
            >
              <svg
                class="w-5 h-5"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </a>

            <a
              href="#"
              target="_blank"
              class="text--400 hover:text--500 active:text--600 transition duration-100"
            >
              <svg
                class="w-5 h-5"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
          </div>
        </div>

        <div>
          <div class="text--800 font-bold tracking-widest uppercase mb-4">
            Products
          </div>

          <nav class="flex flex-col gap-4">
            <div>
              <a
                href="#"
                class="text--500 hover:text-indigo-500 active:text-indigo-600 transition duration-100"
              >
                Overview
              </a>
            </div>

            <div>
              <a
                href="#"
                class="text--500 hover:text-indigo-500 active:text-indigo-600 transition duration-100"
              >
                Solutions
              </a>
            </div>

            <div>
              <a
                href="#"
                class="text--500 hover:text-indigo-500 active:text-indigo-600 transition duration-100"
              >
                Pricing
              </a>
            </div>

            <div>
              <a
                href="#"
                class="text--500 hover:text-indigo-500 active:text-indigo-600 transition duration-100"
              >
                Customers
              </a>
            </div>
          </nav>
        </div>

        <div>
          <div class="text--800 font-bold tracking-widest uppercase mb-4">
            Company
          </div>

          <nav class="flex flex-col gap-4">
            <div>
              <a
                href="#"
                class="text--500 hover:text-indigo-500 active:text-indigo-600 transition duration-100"
              >
                About
              </a>
            </div>

            <div>
              <a
                href="#"
                class="text--500 hover:text-indigo-500 active:text-indigo-600 transition duration-100"
              >
                Investor Relations
              </a>
            </div>

            <div>
              <a
                href="#"
                class="text--500 hover:text-indigo-500 active:text-indigo-600 transition duration-100"
              >
                Jobs
              </a>
            </div>
          </nav>
        </div>

        <div>
          <div class="text--800 font-bold tracking-widest uppercase mb-4">
            Support
          </div>

          <nav class="flex flex-col gap-4">
            <div>
              <a
                href="#"
                class="text--500 hover:text-indigo-500 active:text-indigo-600 transition duration-100"
              >
                Contact
              </a>
            </div>

            <div>
              <a
                href="#"
                class="text--500 hover:text-indigo-500 active:text-indigo-600 transition duration-100"
              >
                Documentation
              </a>
            </div>

            <div>
              <a
                href="#"
                class="text--500 hover:text-indigo-500 active:text-indigo-600 transition duration-100"
              >
                FAQ
              </a>
            </div>
          </nav>
        </div>

        <div>
          <div class="text--800 font-bold tracking-widest uppercase mb-4">
            Legal
          </div>

          <nav class="flex flex-col gap-4">
            <div>
              <a
                href="#"
                class="text--500 hover:text-indigo-500 active:text-indigo-600 transition duration-100"
              >
                Terms of Service
              </a>
            </div>

            <div>
              <a
                href="#"
                class="text--500 hover:text-indigo-500 active:text-indigo-600 transition duration-100"
              >
                Privacy Policy
              </a>
            </div>

            <div>
              <a
                href="#"
                class="text--500 hover:text-indigo-500 active:text-indigo-600 transition duration-100"
              >
                Cookie settings
              </a>
            </div>
          </nav>
        </div>
      </div>
    </div>
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

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
      "Xahau Network is a Layer 1 blockchain built on the XRP Ledger's codebase, designed to add smart-contract-like functionality through Hooks — small, efficient pieces of on-chain logic that automate account behavior.",
  },
  {
    title: "Sologenic",
    description:
      "Sologenic Network is a Layer 1 blockchain built on the XRP Ledger's codebase, designed to add smart-contract-like functionality through Hooks — small, efficient pieces of on-chain logic that automate account behavior.",
  },
];

export default component$(() => {
  return (
    <div class="bg-white min-h-screen flex flex-col">
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes floatY {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(37, 99, 235, 0.3);
          }
          50% {
            box-shadow: 0 0 40px rgba(37, 99, 235, 0.6);
          }
        }

        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }

        .hero-title {
          animation: fadeInUp 0.8s ease-out 0.2s backwards;
        }

        .hero-subtitle {
          animation: fadeInUp 0.8s ease-out 0.4s backwards;
        }

        .hero-description {
          animation: fadeInUp 0.8s ease-out 0.6s backwards;
        }

        .hero-cards {
          animation: fadeInUp 0.8s ease-out 1s backwards;
        }

        .floating-element {
          animation: floatY 6s ease-in-out infinite;
        }

        .glow-element {
          animation: glow 3s ease-in-out infinite;
        }

        .marquee-container {
          display: flex;
          overflow: hidden;
          gap: 1.5rem;
        }

        .marquee-content {
          display: flex;
          gap: 1.5rem;
          animation: marquee 40s linear infinite;
          flex-shrink: 0;
        }

        .marquee-container:hover .marquee-content {
          animation-play-state: paused;
        }
      `}</style>

      {/* Hero Section */}
      <section class="relative w-full flex-1 overflow-hidden flex items-center justify-center pt-20 pb-20">
        {/* Glassmorphic Background Gradient */}
        <div class="absolute inset-0 bg-linear-to-br from-white via-blue-50/40 to-white"></div>

        {/* Animated Background Blobs */}
        <div class="absolute inset-0 overflow-hidden">
          <div class="floating-element absolute -top-32 -right-32 w-96 h-96 bg-linear-to-br from-blue-400/20 to-transparent rounded-full blur-3xl"></div>
          <div
            class="floating-element absolute -bottom-32 -left-32 w-96 h-96 bg-gradientlinear-to-br from-amber-400/20 to-transparent rounded-full blur-3xl"
            style={{ animationDelay: "-2s" }}
          ></div>
          <div
            class="floating-element absolute top-1/3 right-1/4 w-80 h-80 bg-linear-to-br from-blue-300/10 to-transparent rounded-full blur-3xl"
            style={{ animationDelay: "-1s" }}
          ></div>
        </div>

        {/* Content */}
        <div class="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Subtitle Badge */}
          <div class="hero-subtitle flex justify-center mb-8">
            <div class="glass px-4 py-2 rounded-full border border-blue-200/50">
              <span class="text-sm font-medium text-blue-700">
                ✨ Multi-Ledger Operating System
              </span>
            </div>
          </div>

          {/* Main Title */}
          <h1 class="hero-title text-5xl sm:text-6xl lg:text-9xl font-bold bg-linear-to-r from-blue-600 via-blue-600 to-amber-500 bg-clip-text text-transparent leading-tight tracking-tight mb-6">
            {"{XRPL}"}OS
          </h1>

          {/* Subtitle */}
          <p class="hero-subtitle text-2xl sm:text-2xl font-semibold text-gray-800 mb-6 leading-tight">
            Sovereignty-First Web Terminal
          </p>

          {/* Description */}
          <p class="hero-description text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto mb-12 leading-relaxed">
            The unified interface for creating, managing, and trading digital
            assets across XRP Ledger and Xahau networks. Enterprise-grade
            security meets intuitive design.
          </p>

          {/* Feature Cards */}
          <div class="hero-cards mt-16 w-full">
            <div class="marquee-container">
              <div class="marquee-content">
                {[
                  {
                    icon: "🪙",
                    title: "Issue & Manage Tokens",
                    desc: "Launch fungible tokens and stable assets directly",
                  },
                  {
                    icon: "💱",
                    title: "Trade On-Chain",
                    desc: "Swap assets and manage liquidity in real-time",
                  },
                  {
                    icon: "🏗️",
                    title: "Build Systems",
                    desc: "Develop workflows spanning multiple networks",
                  },
                  {
                    icon: "🔐",
                    title: "Enterprise Security",
                    desc: "Institutional-grade protection for your assets",
                  },
                  {
                    icon: "⚡",
                    title: "Instant Settlement",
                    desc: "Fast, low-cost transactions across ledgers",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    class="shrink-0 w-72 glass rounded-2xl p-6 border border-white/40 hover:border-blue-300/50 transition-all duration-300 group hover:shadow-xl"
                  >
                    <div class="text-4xl mb-3">{item.icon}</div>
                    <h4 class="font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </h4>
                    <p class="text-sm text-gray-600 group-hover:text-gray-700 transition-colors">
                      {item.desc}
                    </p>
                  </div>
                ))}
                {[
                  {
                    icon: "🪙",
                    title: "Issue & Manage Tokens",
                    desc: "Launch fungible tokens and stable assets directly",
                  },
                  {
                    icon: "💱",
                    title: "Trade On-Chain",
                    desc: "Swap assets and manage liquidity in real-time",
                  },
                ].map((item, i) => (
                  <div
                    key={`dup-${i}`}
                    class="shrink-0 w-72 glass rounded-2xl p-6 border border-white/40 hover:border-blue-300/50 transition-all duration-300 group hover:shadow-xl"
                  >
                    <div class="text-4xl mb-3">{item.icon}</div>
                    <h4 class="font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </h4>
                    <p class="text-sm text-gray-600 group-hover:text-gray-700 transition-colors">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three Networks Section */}
      <section class="relative w-full py-20 px-4 sm:px-6 lg:px-8 bg-linear-to-b from-white to-gray-50">
        <div class="max-w-7xl mx-auto">
          <div class="text-center mb-16">
            <h2 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 leading-tight">
              Three Networks.
              <span class="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-amber-500">
                {" "}
                One Platform.
              </span>
            </h2>
            <p class="text-lg text-gray-600 max-w-2xl mx-auto font-light">
              Seamlessly connect and manage assets across multiple blockchain
              networks
            </p>
          </div>

          <div class="grid md:grid-cols-3 gap-8">
            {data.map((n, index) => (
              <div
                key={index}
                class="group relative glass rounded-2xl p-8 border border-white/40 hover:border-blue-300/50 transition-all duration-500 hover:shadow-xl hover:shadow-blue-500/10 overflow-hidden"
              >
                <div class="absolute inset-0 bg-linear-to-br from-blue-500/0 to-blue-600/0 group-hover:from-blue-500/5 group-hover:to-blue-600/5 transition-all duration-500"></div>
                <div class="relative z-10">
                  <h3 class="text-3xl font-bold text-gray-900 mb-4 group-hover:text-blue-600 transition-colors">
                    {n.title}
                  </h3>
                  <p class="text-gray-700 leading-relaxed text-base font-light">
                    {n.description}
                  </p>
                </div>
                <div class="absolute bottom-0 left-0 w-full h-1 bg-linear-to-r from-blue-500 to-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section class="relative w-full py-20 px-4 sm:px-6 lg:px-8 bg-linear-to-b from-gray-50 to-white">
        <div class="max-w-4xl mx-auto">
          <div class="glass rounded-3xl p-12 border border-white/40 shadow-2xl hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500">
            <div class="mb-8">
              <span class="inline-block px-4 py-2 bg-blue-100 border border-blue-300/50 text-blue-700 text-sm font-semibold rounded-full mb-4">
                ✨ Our Philosophy
              </span>
            </div>
            <h2 class="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              Designed for Sovereignty
            </h2>
            <p class="text-gray-700 text-lg leading-relaxed font-light">
              Every action in {`{XRPL}`}OS is explicit and intentional.
              Transactions are grouped by purpose—Create, Set, Claim, Deposit,
              Cancel—so users understand exactly what they are signing before
              they commit. No hidden state. No dark UX patterns.
              <br />
              <br />
              We believe in transparency and user control. Our platform empowers
              individuals and teams with a dependable foundation for building
              within a secure, interoperable, and truly decentralized ecosystem.
              Enterprise-grade security meets intuitive design, giving you the
              confidence to operate with clarity every single time.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer class="bg-linear-to-b from-white to-gray-50 text-gray-600 border-t border-gray-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12 mb-12">
            <div class="lg:col-span-2">
              <div class="mb-4">
                <a
                  href="/"
                  class="text-2xl font-bold bg-linear-to-r from-blue-600 to-amber-500 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
                  aria-label="logo"
                >
                  {"{XRPL}"}OS
                </a>
              </div>
              <p class="text-gray-600 mb-6 text-sm leading-relaxed font-light">
                The decentralized operating system for creating, managing, and
                trading digital assets across XRP Ledger, Flare, and Xahau
                networks with security and sovereignty at its core.
              </p>
              <div class="flex gap-4">
                {[
                  {
                    name: "Instagram",
                    path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
                  },
                  {
                    name: "Twitter",
                    path: "M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z",
                  },
                  {
                    name: "LinkedIn",
                    path: "M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z",
                  },
                  {
                    name: "GitHub",
                    path: "M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z",
                  },
                ].map((social) => (
                  <a
                    key={social.name}
                    href="#"
                    target="_blank"
                    class="p-2 rounded-lg hover:bg-blue-100 text-gray-600 hover:text-blue-600 transition-all duration-300 group"
                    aria-label={social.name}
                  >
                    <svg
                      class="w-5 h-5 group-hover:scale-110 transition-transform"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d={social.path} />
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            {[
              {
                title: "Products",
                links: ["Overview", "Solutions", "Pricing", "Customers"],
              },
              {
                title: "Company",
                links: ["About", "Investor Relations", "Jobs"],
              },
              {
                title: "Support",
                links: ["Contact", "Documentation", "FAQ"],
              },
              {
                title: "Legal",
                links: [
                  "Terms of Service",
                  "Privacy Policy",
                  "Cookie settings",
                ],
              },
            ].map((section) => (
              <div key={section.title}>
                <h3 class="text-gray-900 font-semibold text-sm uppercase tracking-wider mb-4">
                  {section.title}
                </h3>
                <nav class="flex flex-col gap-3">
                  {section.links.map((link) => (
                    <a
                      key={link}
                      href="#"
                      class="text-gray-600 hover:text-blue-600 transition-colors text-sm font-light"
                    >
                      {link}
                    </a>
                  ))}
                </nav>
              </div>
            ))}
          </div>

          <div class="border-t border-gray-200 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p class="text-gray-600 text-sm font-light">
              © 2025 – Product of{" "}
              <a href="https://nrdxlab.com">{"{NRDX}"}Labs</a>. All rights
              reserved.
            </p>
            <div class="flex gap-6">
              <a
                href="#"
                class="text-gray-600 hover:text-blue-600 text-sm transition-colors"
              >
                Status
              </a>
              <a
                href="#"
                class="text-gray-600 hover:text-blue-600 text-sm transition-colors"
              >
                Changelog
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
});

export const head: DocumentHead = {
  title: "{XRPL}OS",
  meta: [
    {
      name: "description",
      content:
        "The XRP Ledger Operating System - Built by {NRDX}LABS | Secure web terminal to access the XRP Ledger, Xahau, and Sologenic networks",
    },
  ],
};

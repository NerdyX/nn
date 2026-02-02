import { component$, useSignal } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

export default component$(() => {
  const searchTerm = useSignal("");

  return (
    <div class="min-h-screen bg-liner-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div class="max-w-4xl mx-auto text-center">
        {/* Hero Error */}
        <div class="mb-16">
          <div class="inline-flex items-center justify-center w-24 h-24 bg-white rounded-3xl shadow-xl mb-8">
            <svg
              class="w-12 h-12 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>

          <h1 class="text-6xl font-black bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent mb-4 tracking-tight">
            404
          </h1>
          <h2 class="text-3xl font-bold text-slate-900 mb-6">Page Not Found</h2>

          <p class="text-xl text-slate-600 max-w-2xl mx-auto mb-12 leading-relaxed">
            The page you're looking for doesn't exist or has been moved. Try
            searching or return to the marketplace.
          </p>
        </div>

        {/* Search + Quick Links */}
        <div class="grid lg:grid-cols-2 gap-8 max-w-4xl w-full">
          <div class="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-slate-200/50">
            <h3 class="text-xl font-bold text-slate-900 mb-6">
              Search Marketplace
            </h3>
            <div class="relative max-w-md mx-auto">
              <input
                type="text"
                class="w-full px-5 py-4 pr-14 text-lg border-2 border-slate-200 rounded-2xl focus:border-blue-500 focus:outline-none placeholder-slate-400 bg-white/90"
                placeholder="Search NFTs, collections..."
                value={searchTerm.value}
                onInput$={(e) =>
                  (searchTerm.value = (e.target as HTMLInputElement).value)
                }
              />
              <button class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <svg
                  class="w-6 h-6"
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
              </button>
            </div>
          </div>

          <div class="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-slate-200/50 space-y-4">
            <h3 class="text-xl font-bold text-slate-900 mb-6">Quick Links</h3>
            <div class="grid grid-cols-2 gap-3">
              <Link
                href="/marketplace"
                class="group block p-4 rounded-xl bg-linear-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:shadow-lg transition-all border border-blue-100"
              >
                <svg
                  class="w-6 h-6 text-blue-600 mb-2 group-hover:scale-110 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                <span class="font-medium text-slate-900 group-hover:text-blue-700">
                  Marketplace
                </span>
              </Link>

              <Link
                href="/explorer"
                class="group block p-4 rounded-xl bg-linear-to-r from-emerald-50 to-green-50 hover:from-emerald-100 hover:shadow-lg transition-all border border-emerald-100"
              >
                <svg
                  class="w-6 h-6 text-emerald-600 mb-2 group-hover:scale-110 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span class="font-medium text-slate-900 group-hover:text-emerald-700">
                  Explorer
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Back Home */}
        <div class="mt-16">
          <Link
            href="/"
            class="inline-flex items-center px-8 py-4 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-semibold text-lg rounded-2xl shadow-xl hover:shadow-2xl hover:from-blue-700 hover:to-indigo-700 transition-all group"
          >
            ← Back to Home
            <svg
              class="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
});

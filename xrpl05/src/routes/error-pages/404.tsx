import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

export default component$(() => {
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

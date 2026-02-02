// src/routes/502.tsx (similar pattern for 503)
import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

export default component$(() => {
  return (
    <div class="min-h-screen bg-linear-to-br from-slate-50 to-orange-50 flex items-center justify-center p-4">
      <div class="max-w-2xl mx-auto text-center">
        <div class="inline-flex items-center justify-center w-24 h-24 bg-white rounded-3xl shadow-xl mb-8 border-4 border-orange-100">
          <svg
            class="w-12 h-12 text-orange-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 class="text-6xl font-black bg-linear-to-r from-orange-600 via-orange-700 to-slate-900 bg-clip-text text-transparent mb-4 tracking-tight">
          502
        </h1>
        <h2 class="text-3xl font-bold text-slate-900 mb-6">Bad Gateway</h2>

        <p class="text-xl text-slate-600 mb-12 leading-relaxed max-w-2xl mx-auto">
          We're having trouble connecting to our services. Please try again in a
          moment.
        </p>

        <div class="space-y-4 max-w-md mx-auto">
          <button
            class="block w-full bg-linear-to-r from-orange-500 to-orange-600 text-white font-semibold py-4 px-8 rounded-2xl shadow-xl hover:shadow-2xl hover:from-orange-600 hover:to-orange-700 transition-all text-lg"
            onClick$={() => window.location.reload()}
          >
            Retry
          </button>

          <Link
            href="/"
            class="block w-full bg-white/80 backdrop-blur-xl border border-slate-200 text-slate-900 font-semibold py-4 px-8 rounded-2xl shadow-lg hover:shadow-xl hover:bg-white transition-all text-lg"
          >
            Go Home
          </Link>
        </div>

        <div class="mt-12 grid grid-cols-2 gap-6 max-w-md mx-auto text-sm">
          <div class="text-left">
            <div class="font-semibold text-slate-900 mb-1">What happened?</div>
            <div class="text-slate-600">Service temporarily unavailable</div>
          </div>
          <div class="text-right">
            <div class="font-semibold text-slate-900 mb-1">Next steps</div>
            <div class="text-slate-600">Retry or visit home</div>
          </div>
        </div>
      </div>
    </div>
  );
});

// src/routes/error.tsx
import { component$, useSignal, useErrorBoundary } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

export default component$(() => {
  const errorStore = useErrorBoundary();
  const retryCount = useSignal(0);

  const status =
    (errorStore.error &&
      ((errorStore.error as any).status ||
        (errorStore.error as any).statusCode)) ||
    500;

  const statusText =
    (errorStore.error && (errorStore.error as any).statusText) ||
    (status === 404 ? "Not Found" : "Error");

  const message =
    (errorStore.error && (errorStore.error as any).message) ||
    (status === 404
      ? "The page you are looking for could not be found."
      : "Something unexpected happened.");

  const is404 = status === 404;

  return (
    <div class="min-h-screen bg-linear-to-br from-slate-50 to-rose-50 flex items-center justify-center p-4">
      <div class="max-w-2xl mx-auto text-center">
        <div class="inline-flex items-center justify-center w-24 h-24 bg-white rounded-3xl shadow-xl mb-8 border-4 border-rose-100">
          <svg
            class="w-12 h-12 text-rose-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 class="text-6xl font-black bg-linear-to-r from-rose-600 via-rose-700 to-slate-900 bg-clip-text text-transparent mb-4 tracking-tight">
          {status}
        </h1>
        <h2 class="text-3xl font-bold text-slate-900 mb-2">{statusText}</h2>
        <p class="text-xl text-slate-600 mb-12 leading-relaxed max-w-2xl mx-auto">
          {message}
        </p>

        <div class="flex flex-wrap gap-4 justify-center max-w-md mx-auto">
          {!is404 && (
            <button
              class="bg-linear-to-r from-rose-500 to-rose-600 text-white font-semibold py-4 px-8 rounded-2xl shadow-xl hover:shadow-2xl hover:from-rose-600 hover:to-rose-700 transition-all text-lg flex-1 min-w-35"
              onClick$={() => {
                retryCount.value++;
                if (retryCount.value <= 3) {
                  window.location.reload();
                }
              }}
            >
              Retry ({retryCount.value}/3)
            </button>
          )}

          <Link
            href="/"
            class="bg-white/80 backdrop-blur-xl border border-slate-200 text-slate-900 font-semibold py-4 px-8 rounded-2xl shadow-lg hover:shadow-xl hover:bg-white transition-all text-lg flex-1 min-w-35"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
});

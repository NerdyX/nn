import { component$, useSignal, $ } from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";

export const Xaman = component$(() => {
  const isLoading = useSignal(false);
  const qrImage = useSignal("");
  const showModal = useSignal(false);
  const errorMessage = useSignal("");
  const navigate = useNavigate();

  const handleXamanLogin = $(async () => {
    isLoading.value = true;
    errorMessage.value = "";

    try {
      const res = await fetch("/api/xaman/create-payload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txjson: { TransactionType: "SignIn" } }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create Xaman payload");
      }

      const { uuid, refs } = await res.json();
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        window.location.href = refs.xapp || refs.websocket;
        return;
      }

      // Show QR modal for desktop
      qrImage.value = refs.qr_png;
      showModal.value = true;
      isLoading.value = false;

      // Poll for payload status
      let attempts = 0;
      const maxAttempts = 150;
      const interval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
          clearInterval(interval);
          showModal.value = false;
          errorMessage.value = "Sign-in timed out. Please try again.";
          return;
        }

        try {
          const r = await fetch(`/api/xaman/check-payload?uuid=${uuid}`);
          if (!r.ok) return;
          const d = await r.json();

          if (d.meta.signed) {
            clearInterval(interval);
            showModal.value = false;

            // Store account info
            if (d.response?.account) {
              localStorage.setItem("xrpl_address", d.response.account);
              localStorage.setItem(
                "xaman_session",
                JSON.stringify({
                  account: d.response.account,
                  signedAt: new Date().toISOString(),
                }),
              );
            }

            navigate("/dashboard");
          } else if (d.meta.expired || d.meta.cancelled || d.meta.rejected) {
            clearInterval(interval);
            showModal.value = false;
            errorMessage.value = "Sign-in was cancelled or expired.";
          }
        } catch {
          // Silently retry on network errors
        }
      }, 2000);
    } catch (e) {
      console.error("Xaman connection failed", e);
      errorMessage.value = e instanceof Error ? e.message : "Connection failed";
      isLoading.value = false;
    }
  });

  return (
    <div class="flex flex-col items-center justify-center gap-3">
      <button
        onClick$={handleXamanLogin}
        disabled={isLoading.value}
        class="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed w-full"
      >
        {isLoading.value ? (
          <div class="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
        ) : (
          <span>Connect with Xaman</span>
        )}
      </button>

      {errorMessage.value && (
        <p class="text-red-500 text-sm text-center">{errorMessage.value}</p>
      )}

      {/* Xaman QR Modal */}
      {showModal.value ? (
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-white rounded-3xl p-10 max-w-md w-full text-center shadow-2xl">
            <h2 class="text-3xl font-bold mb-4 text-gray-900">
              Scan with Xaman
            </h2>
            <p class="text-gray-600 text-sm mb-6">
              Open the Xaman app on your phone and scan this QR code to sign in.
            </p>
            <div class="bg-gray-100 rounded-2xl p-8 mb-8">
              <img
                src={qrImage.value}
                alt="Xaman QR Code"
                class="w-64 h-64 mx-auto"
                width={256}
                height={256}
              />
            </div>
            <div class="flex items-center justify-center gap-3 text-gray-500 mb-6">
              <div class="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-transparent" />
              <span>Waiting for confirmation...</span>
            </div>
            <button
              onClick$={() => {
                showModal.value = false;
                errorMessage.value = "";
              }}
              class="text-gray-600 hover:text-gray-900 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
});

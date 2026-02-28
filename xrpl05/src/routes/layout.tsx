import {
  component$,
  Slot,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@builder.io/qwik";
import { routeLoader$, useLocation, useNavigate } from "@builder.io/qwik-city";
import { HeaderModern } from "../components/header/header-modern";
import { type Network, useNetworkContext } from "../context/network-context";
import {
  type WalletType,
  restoreWalletSession,
  useWalletContext,
} from "../context/wallet-context";
import { networkActions } from "../lib/store/network";
import { walletActions } from "../lib/store/wallet";

export const useXamanSession = routeLoader$(async ({ cookie }) => {
  const jwt = cookie.get("xaman_jwt")?.value;

  if (!jwt) {
    return { connected: false, address: null, name: null };
  }

  try {
    const res = await fetch("https://oauth2.xaman.app/userinfo", {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      cookie.delete("xaman_jwt", { path: "/" });
      return { connected: false, address: null, name: null };
    }

    const userinfo = (await res.json()) as { sub?: string; name?: string };
    return {
      connected: true,
      address: userinfo.sub ?? null,
      name: userinfo.name ?? null,
    };
  } catch (err: any) {
    const reason =
      err?.cause?.code === "ENOTFOUND"
        ? `DNS lookup failed for ${err.cause.hostname}`
        : err?.name === "TimeoutError"
          ? "request timed out"
          : String(err?.message ?? err);
    console.warn(`[xaman] session check skipped: ${reason}`);
    cookie.delete("xaman_jwt", { path: "/" });
    return { connected: false, address: null, name: null };
  }
});

export default component$(() => {
  const walletRestored = useSignal(false);
  const serverSession = useXamanSession();
  const location = useLocation();
  const nav = useNavigate();

  const { activeNetwork } = useNetworkContext();
  const { connected, walletType } = useWalletContext();

  // ── Network preference sync ──
  useTask$(({ track }) => {
    const net = track(() => activeNetwork.value);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("preferredNetwork", net);
    }
  });

  // ── Hydrate from localStorage ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("preferredNetwork");
      if (saved === "xahau" || saved === "xrpl") {
        networkActions.setActiveNetwork(saved as Network);
      }
    }

    const session = restoreWalletSession();
    if (session) {
      walletActions.setWalletState({
        connected: true,
        walletType: session.type as WalletType,
        address: session.address,
        displayName: session.name ?? "",
      });
    }

    // Mark restoration complete so the route guard below can act
    walletRestored.value = true;
  });

  // ── Hydrate wallet from server-side Xaman JWT (if present) ──
  useTask$(({ track }) => {
    const sess = track(() => serverSession.value);
    if (sess?.connected && sess.address) {
      walletActions.setWalletState({
        connected: true,
        address: sess.address,
        displayName: sess.name ?? "",
        walletType: walletType.value || "xaman",
      });
    }
  });

  // ── Dashboard route guard ──
  // Only redirect AFTER wallet restoration has completed on the client.
  // This prevents a flash-redirect when the user is actually connected
  // via localStorage but the signal hasn't been populated yet on first render.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const pathname = track(() => location.url.pathname);
    const clientConnected = track(() => connected.value);
    const restored = track(() => walletRestored.value);
    const serverConnected = serverSession.value?.connected;

    // Wait until client-side restoration is done before deciding
    if (!restored) return;

    if (
      pathname.startsWith("/dashboard") &&
      !serverConnected &&
      !clientConnected
    ) {
      nav("/");
    }
  });

  return (
    <div class="flex flex-col min-h-screen bg-white">
      <HeaderModern />
      <main class="flex-1">
        <div class="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <Slot />
        </div>
      </main>
    </div>
  );
});

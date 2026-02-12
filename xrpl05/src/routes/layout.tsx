import {
  component$,
  Slot,
  useContextProvider,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@builder.io/qwik";
import { routeLoader$, useLocation, useNavigate } from "@builder.io/qwik-city";
import { HeaderModern } from "../components/header/header-modern";
import {
  NetworkContext,
  NETWORK_CONFIG,
  type Network,
} from "../context/network-context";
import {
  WalletContext,
  type WalletType,
  restoreWalletSession,
} from "../context/wallet-context";

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
  } catch (err) {
    console.error("Xaman session validation failed:", err);
    cookie.delete("xaman_jwt", { path: "/" });
    return { connected: false, address: null, name: null };
  }
});

export default component$(() => {
  const activeNetwork = useSignal<Network>("xrpl");
  const wsUrl = useSignal<string>(NETWORK_CONFIG.xrpl.ws);

  useContextProvider(NetworkContext, { activeNetwork, wsUrl });

  const walletConnected = useSignal(false);
  const walletType = useSignal<WalletType>(null);
  const walletAddress = useSignal("");
  const walletDisplayName = useSignal("");

  // Track whether client-side wallet restoration has finished.
  // Until it has, we should NOT redirect away from /dashboard —
  // the user may well be connected but we haven't read localStorage yet.
  const walletRestored = useSignal(false);

  useContextProvider(WalletContext, {
    connected: walletConnected,
    walletType,
    address: walletAddress,
    displayName: walletDisplayName,
  });

  useTask$(({ track }) => {
    const net = track(() => activeNetwork.value);
    wsUrl.value = NETWORK_CONFIG[net].ws;

    if (typeof localStorage !== "undefined") {
      localStorage.setItem("preferredNetwork", net);
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("preferredNetwork");
      if (saved === "xahau" || saved === "xrpl") {
        activeNetwork.value = saved;
      }
    }

    const session = restoreWalletSession();
    if (session) {
      walletConnected.value = true;
      walletType.value = session.type;
      walletAddress.value = session.address;
      walletDisplayName.value = session.name ?? "";
    }

    // Mark restoration complete so the route guard below can act
    walletRestored.value = true;
  });

  const serverSession = useXamanSession();
  const location = useLocation();
  const nav = useNavigate();

  // ── Hydrate wallet from server-side Xaman JWT (if present) ──
  useTask$(({ track }) => {
    const sess = track(() => serverSession.value);
    if (sess?.connected && sess.address) {
      walletConnected.value = true;
      walletAddress.value = sess.address;
      walletDisplayName.value = sess.name ?? "";
      if (!walletType.value) {
        walletType.value = "xaman";
      }
    }
  });

  // ── Dashboard route guard ──
  // Only redirect AFTER wallet restoration has completed on the client.
  // This prevents a flash-redirect when the user is actually connected
  // via localStorage but the signal hasn't been populated yet on first render.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const pathname = track(() => location.url.pathname);
    const clientConnected = track(() => walletConnected.value);
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

import {
  component$,
  Slot,
  useContextProvider,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@builder.io/qwik";
import { routeLoader$, useLocation, useNavigate } from "@builder.io/qwik-city";
import { Header } from "../components/header/header";
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

// ──────────────────────────────────────────────
// Server-side: validate Xaman JWT from cookie
// ──────────────────────────────────────────────
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

// ──────────────────────────────────────────────
// Root layout
// ──────────────────────────────────────────────
export default component$(() => {
  // ── Network context (single source of truth) ──
  const activeNetwork = useSignal<Network>("xrpl");
  const wsUrl = useSignal<string>(NETWORK_CONFIG.xrpl.ws);

  useContextProvider(NetworkContext, { activeNetwork, wsUrl });

  // ── Wallet context (single source of truth) ──
  const walletConnected = useSignal(false);
  const walletType = useSignal<WalletType>(null);
  const walletAddress = useSignal("");
  const walletDisplayName = useSignal("");

  useContextProvider(WalletContext, {
    connected: walletConnected,
    walletType,
    address: walletAddress,
    displayName: walletDisplayName,
  });

  // Keep wsUrl in sync whenever activeNetwork changes
  useTask$(({ track }) => {
    const net = track(() => activeNetwork.value);
    wsUrl.value = NETWORK_CONFIG[net].ws;

    // Persist preference to localStorage (client only)
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("preferredNetwork", net);
    }
  });

  // Hydrate saved preferences from localStorage on client
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    // Restore network preference
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("preferredNetwork");
      if (saved === "xahau" || saved === "xrpl") {
        activeNetwork.value = saved;
      }
    }

    // Restore wallet session from localStorage
    const session = restoreWalletSession();
    if (session) {
      walletConnected.value = true;
      walletType.value = session.type;
      walletAddress.value = session.address;
      walletDisplayName.value = session.name ?? "";
    }
  });

  // ── Dashboard auth guard ──
  const serverSession = useXamanSession();
  const location = useLocation();
  const nav = useNavigate();

  useTask$(({ track }) => {
    const pathname = track(() => location.url.pathname);
    const serverConnected = track(() => serverSession.value?.connected);
    const clientConnected = track(() => walletConnected.value);

    // Only guard /dashboard routes — allow if either server
    // cookie session OR client-side wallet session is active
    if (
      pathname.startsWith("/dashboard") &&
      !serverConnected &&
      !clientConnected
    ) {
      nav("/");
    }
  });

  // Sync server session data into wallet context when available
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

  return (
    <div class="flex flex-col min-h-screen">
      <Header />
      <main class="flex-1">
        <Slot />
      </main>
    </div>
  );
});

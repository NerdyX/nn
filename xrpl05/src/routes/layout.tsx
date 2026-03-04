import {
  component$,
  Slot,
  useSignal,
  useTask$,
  useVisibleTask$,
  $,
} from "@builder.io/qwik";
import { routeLoader$, useLocation, useNavigate } from "@builder.io/qwik-city";
import { HeaderModern } from "../components/header/header-modern";
<<<<<<< Updated upstream
import { type Network, useNetworkContext } from "../context/network-context";
import {
  type WalletType,
  restoreWalletSession,
  useWalletContext,
} from "../context/wallet-context";
import { networkActions } from "../lib/store/network";
import { walletActions } from "../lib/store/wallet";
=======
>>>>>>> Stashed changes

import { useNetworkState, useNetworkActions } from "~/hooks/useNetwork";
import { useWalletActions, useWalletState } from "~/hooks/useWallet";

// Xaman session loader (unchanged)
export const useXamanSession = routeLoader$(async ({ cookie }) => {
  const jwt = cookie.get("xaman_jwt")?.value;

  if (!jwt) {
    return { connected: false, address: null, name: null };
  }

  try {
    const res = await fetch("https://oauth2.xaman.app/userinfo", {
      headers: { Authorization: `Bearer ${jwt}` },
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
    console.warn("[xaman] session check skipped:", err.message);
    cookie.delete("xaman_jwt", { path: "/" });
    return { connected: false, address: null, name: null };
  }
});

// Restore wallet session (inline – adjust if it's in a file)
const restoreWalletSession = () => {
  if (typeof localStorage === "undefined") return null;

  const saved = localStorage.getItem("walletSession");
  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
};

export default component$(() => {
<<<<<<< Updated upstream
=======
  // State only (reactive)
  const { activeNetwork } = useNetworkState();
  const { connected, address } = useWalletState();

  // Actions (client-safe)
  const { setNetwork } = useNetworkActions();
  const { connect, disconnect, restore } = useWalletActions();

>>>>>>> Stashed changes
  const walletRestored = useSignal(false);
  const serverSession = useXamanSession();
  const location = useLocation();
  const nav = useNavigate();

<<<<<<< Updated upstream
  const { activeNetwork } = useNetworkContext();
  const { connected, walletType } = useWalletContext();

  // ── Network preference sync ──
  useTask$(({ track }) => {
    const net = track(() => activeNetwork.value);
=======
  // Network persistence – read-only
  useTask$(({ track }) => {
    track(() => activeNetwork);

>>>>>>> Stashed changes
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("preferredNetwork", activeNetwork);
    }
  });

<<<<<<< Updated upstream
  // ── Hydrate from localStorage ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("preferredNetwork");
      if (saved === "xahau" || saved === "xrpl") {
        networkActions.setActiveNetwork(saved as Network);
=======
  // Client-side restoration – actions used inside $()
  useVisibleTask$(() => {
    const doRestore = $(() => {
      if (typeof localStorage !== "undefined") {
        const saved = localStorage.getItem("preferredNetwork");
        if (saved === "xahau" || saved === "xrpl") {
          setNetwork(saved as Network);
        }
>>>>>>> Stashed changes
      }

<<<<<<< Updated upstream
    const session = restoreWalletSession();
    if (session) {
      walletActions.setWalletState({
        connected: true,
        walletType: session.type as WalletType,
        address: session.address,
        displayName: session.name ?? "",
      });
    }
=======
      const session = restoreWalletSession();
      if (session) {
        restore(session);
      }
>>>>>>> Stashed changes

      walletRestored.value = true;
    });

    doRestore();
  });

<<<<<<< Updated upstream
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
=======
  // Server Xaman hydration
  const serverSession = useXamanSession();
  useTask$(({ track }) => {
    const sess = track(() => serverSession.value);
    if (sess && sess.connected && sess.address) {
      const doConnect = $(() => {
        connect(sess.address, "xaman" as const, sess.name ?? "");
      });
      doConnect();
    }
  });

  // Dashboard guard
  const location = useLocation();
  const nav = useNavigate();

  useVisibleTask$(() => {
    const pathname = track(() => location.url.pathname);
>>>>>>> Stashed changes

    const isClientConnected = connected;
    const isRestored = walletRestored.value;
    const isServerConnected = serverSession.value?.connected ?? false;

    if (!isRestored) return;

    if (
      pathname.startsWith("/dashboard") &&
      !isServerConnected &&
      !isClientConnected
    ) {
      nav("/");
    }
  });

  return (
    <div class="flex flex-col min-h-screen bg-white">
      <HeaderModern
        currentNetwork={activeNetwork}
        onNetworkChange={setNetwork}
        connected={connected}
        walletAddress={address}
        onConnect={connect}
        onDisconnect={disconnect}
      />
      <main class="flex-1">
        <div class="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <Slot />
        </div>
      </main>
    </div>
  );
});

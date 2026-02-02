import {
  component$,
  Signal,
  Slot,
  createContextId,
  useContextProvider,
  useSignal,
  useTask$,
} from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { Header } from "../components/header/header";

export const NetworkContext = createContextId<{
  activeNetwork: Signal<"xrpl" | "xahau">;
}>("network-context");

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
  } catch (err) {
    console.error("Xaman session validation failed:", err);
    cookie.delete("xaman_jwt", { path: "/" });
    return { connected: false, address: null, name: null };
  }
});

export default component$(() => {
  const activeNetwork = useSignal<"xrpl" | "xahau">(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("preferredNetwork");
      return saved === "xahau" ? "xahau" : "xrpl";
    }
    return "xrpl";
  });

  useContextProvider(NetworkContext, { activeNetwork });

  useTask$(({ track }) => {
    track(() => activeNetwork.value);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("preferredNetwork", activeNetwork.value);
    }
  });

  return (
    <div class="flex flex-col min-h-screen">
      <Header />

      <main class="flex-1">
        <Slot />
      </main>

      <footer class="text-center font-extralight mb-1.5">
        © 2025 – Product of <a href="https://nrdxlab.com">{"{NRDX}"}Labs</a>.
        All rights reserved.
      </footer>
    </div>
  );
});
